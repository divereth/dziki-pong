const DISCORD_API = 'https://discord.com/api/v10';
const ADMINISTRATOR = 0x8n;

const blockedPatterns = [
  /(?:exfiltrat|steal|dump|print).*(?:secret|token|password|cookie|key)/i,
  /(?:delete|destroy|drop|wipe).*(?:repository|repo|branch|database|github)/i,
  /(?:disable|bypass).*(?:security|protection|review|approval)/i,
  /(?:rm\s+-rf|format\s+c:|powershell\s+-enc|curl\s+.*\|\s*(?:sh|bash))/i,
  /(?:deploy|push).*(?:without|skip).*(?:review|test|approval)/i,
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function ephemeral(content) {
  return json({ type: 4, data: { content, flags: 64, allowed_mentions: { parse: [] } } });
}

function hexBytes(value) {
  if (!value || !/^[0-9a-f]+$/i.test(value) || value.length % 2) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function verifyDiscordSignature(request, body, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const keyBytes = hexBytes(publicKey);
  const signatureBytes = hexBytes(signature);
  if (!timestamp || !keyBytes || !signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'Ed25519', namedCurve: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'Ed25519' }, key, signatureBytes, new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

function option(options, name) {
  return options?.find((item) => item.name === name)?.value;
}

function userName(interaction) {
  return interaction.member?.user?.global_name
    || interaction.member?.user?.username
    || interaction.user?.global_name
    || interaction.user?.username
    || 'Discord user';
}

function isAdmin(interaction, env) {
  if ((interaction.member?.roles || []).includes(env.DISCORD_ADMIN_ROLE_ID)) return true;
  try {
    return (BigInt(interaction.member?.permissions || '0') & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

function validRequest(text) {
  if (!text || text.length < 8) return 'Request is too short.';
  if (text.length > 2000) return 'Request is limited to 2000 characters.';
  if (blockedPatterns.some((pattern) => pattern.test(text))) return 'This request matches a blocked security or destructive pattern.';
  return null;
}

async function githubDispatch(env, eventType, payload) {
  const response = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'dziki-pong-cloudflare-worker',
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (!response.ok) throw new Error(`GitHub dispatch failed: ${response.status}`);
}

async function followup(interaction, content) {
  await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
  });
}

async function processRequest(interaction, env, requestText) {
  const requestId = interaction.id;
  try {
    await githubDispatch(env, 'dziki_request', {
      request_id: requestId,
      request_text: requestText,
      discord_user_id: interaction.member?.user?.id || interaction.user?.id,
      discord_user_name: userName(interaction),
      discord_channel_id: interaction.channel_id,
      is_admin: isAdmin(interaction, env),
      received_at: new Date().toISOString(),
    });
    await followup(interaction, `Queued as \`${requestId}\`. Progress updates and the Cloudflare Pages preview URL will be posted in this channel. An admin can publish it with \`/dziki promote request_id:${requestId}\` after reviewing the PR.`);
  } catch (error) {
    console.error(error);
    await followup(interaction, 'The request could not be queued. Check the Worker logs.');
  }
}

async function processPromotion(interaction, env, requestId) {
  try {
    await githubDispatch(env, 'dziki_promote', {
      request_id: requestId,
      is_admin: true,
      discord_user_id: interaction.member?.user?.id || interaction.user?.id,
      discord_user_name: userName(interaction),
      received_at: new Date().toISOString(),
    });
    await followup(interaction, `Publish queued for request \`${requestId}\`. GitHub will merge it and deploy production after checks.`);
  } catch (error) {
    console.error(error);
    await followup(interaction, 'The request could not be promoted. Check the Worker logs.');
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return new Response('Dziki Pong Discord endpoint', { status: 200 });
    const body = await request.text();
    if (!(await verifyDiscordSignature(request, body, env.DISCORD_PUBLIC_KEY))) return new Response('Invalid request signature', { status: 401 });

    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type !== 2) return ephemeral('Unsupported Discord interaction.');
    if (env.DISCORD_GUILD_ID && interaction.guild_id !== env.DISCORD_GUILD_ID) return ephemeral('This command is not enabled in this server.');
    if (env.DISCORD_CHANNEL_ID && interaction.channel_id !== env.DISCORD_CHANNEL_ID) return ephemeral('Use this command in #dziki-pong.');
    if (interaction.data?.name !== 'dziki') return ephemeral('Unknown command.');

    const subcommand = interaction.data.options?.[0];
    if (!subcommand) return ephemeral('Choose request or promote.');

    if (subcommand.name === 'request') {
      const requestText = String(option(subcommand.options, 'text') || '').trim();
      const reason = validRequest(requestText);
      if (reason) return ephemeral(`Request rejected: ${reason}`);
      ctx.waitUntil(processRequest(interaction, env, requestText));
      return json({ type: 5, data: { flags: 64 } });
    }

    if (subcommand.name === 'promote') {
      if (!isAdmin(interaction, env)) return ephemeral('Only the configured Discord admin role can publish a request live.');
      const requestId = String(option(subcommand.options, 'request_id') || '');
      if (!/^[A-Za-z0-9_-]{3,80}$/.test(requestId)) return ephemeral('Invalid request ID.');
      ctx.waitUntil(processPromotion(interaction, env, requestId));
      return json({ type: 5, data: { flags: 64 } });
    }

    return ephemeral('Unknown Dziki command.');
  },
};
