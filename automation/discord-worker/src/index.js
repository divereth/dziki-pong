import { GAMES, gameForInteraction } from '../../games.mjs';
import { recentChanges, historyMessage } from '../../history.mjs';
import { notifyDeveloper } from '../../notify.mjs';

const DISCORD_API = 'https://discord.com/api/v10';
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

function publicMessage(content) {
  return json({ type: 4, data: { content, allowed_mentions: { parse: [] } } });
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
  const roleId = env.DISCORD_ADMIN_ROLE_ID;
  return Boolean(roleId) && (interaction.member?.roles || []).includes(roleId);
}

function validRequest(text) {
  if (!text || text.length < 8) return 'Napisz trochę więcej — prośba powinna mieć co najmniej 8 znaków.';
  if (text.length > 2000) return 'Prośba może mieć maksymalnie 2000 znaków.';
  if (blockedPatterns.some((pattern) => pattern.test(text))) return 'Nie mogę przyjąć tej prośby, bo wygląda na niebezpieczną lub destrukcyjną.';
  return null;
}

function requestSummary(text) {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > 1700 ? `${compact.slice(0, 1699)}…` : compact;
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
    signal: AbortSignal.timeout(10000),
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

async function processRequest(interaction, env, requestText, game) {
  try {
    await githubDispatch(env, 'dziki_request', {
      request_id: interaction.id,
      game_id: game.id,
      request_text: requestText,
      discord_user_id: interaction.member?.user?.id || interaction.user?.id,
      discord_user_name: userName(interaction),
      discord_channel_id: interaction.channel_id,
      is_admin: isAdmin(interaction, env),
      received_at: new Date().toISOString(),
    });
    await notifyDeveloper(`🟡 **${game.name} · zlecenie ${interaction.id}**\nPrzyjęto zmianę. Oczekiwanie na rozpoczęcie zadania.`, { game, channelId: interaction.channel_id, env });
  } catch (error) {
    console.error(error);
    await Promise.allSettled([
      followup(interaction, '⚠️ Nie udało się przyjąć prośby. Opiekun sprawdzi, co się stało.'),
      notifyDeveloper(`⚠️ **${game.name} · zlecenie ${interaction.id}**\nNie udało się przekazać zmiany do GitHuba. Zadanie nie zostało uruchomione.`, { game, channelId: interaction.channel_id, env }),
    ]);
  }
}

async function processHistory(interaction, env, game) {
  let message;
  try { message = historyMessage(game, await recentChanges(game, env)); }
  catch { message = { content: `⚠️ ${game.name}: nie udało się teraz pobrać ostatnich zmian. Spróbuj ponownie za chwilę.`, allowed_mentions: { parse: [] } }; }
  const response = await fetch(`${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(message),
  });
  if (!response.ok) console.error(`History response failed (${response.status})`);
}

async function processPromotion(interaction, env, requestId, game) {
  try {
    await githubDispatch(env, 'dziki_promote', {
      request_id: requestId,
      game_id: game.id,
      discord_channel_id: interaction.channel_id,
      is_admin: true,
      discord_user_id: interaction.member?.user?.id || interaction.user?.id,
      discord_user_name: userName(interaction),
      received_at: new Date().toISOString(),
    });
    await notifyDeveloper(`🟣 **${game.name} · zlecenie ${requestId}**\nPrzyjęto prośbę o publikację głównej wersji gry.`, { game, channelId: interaction.channel_id, env });
  } catch (error) {
    console.error(error);
    await Promise.allSettled([
      followup(interaction, '⚠️ Nie udało się uruchomić publikowania. Opiekun sprawdzi, co się stało.'),
      notifyDeveloper(`⚠️ **${game.name} · zlecenie ${requestId}**\nNie udało się przekazać prośby o publikację do GitHuba.`, { game, channelId: interaction.channel_id, env }),
    ]);
  }
}
export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') return json({ service: 'Dziki Discord', games: Object.keys(GAMES), commands: ['dzika zmiana', 'dzika promote', 'ostatnie zmiany'], public_updates: true });
    const body = await request.text();
    if (!(await verifyDiscordSignature(request, body, env.DISCORD_PUBLIC_KEY))) return new Response('Invalid request signature', { status: 401 });

    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    if (interaction.type === 1) return json({ type: 1 });
    if (interaction.type !== 2) return ephemeral('Ta akcja Discorda nie jest obsługiwana.');
    if (env.DISCORD_GUILD_ID && interaction.guild_id !== env.DISCORD_GUILD_ID) return ephemeral('Ta komenda nie jest dostępna na tym serwerze.');
    const game = gameForInteraction(interaction, env);
    if (!game) return ephemeral('Użyj tej komendy na #dziki-pong, #dziki-sprzedawca, #dziki-bieg lub #dziki-karabin.');
    if (interaction.data?.name === 'ostatnie' && interaction.data.options?.[0]?.name === 'zmiany') {
      ctx.waitUntil(processHistory(interaction, env, game));
      return json({ type: 5, data: { allowed_mentions: { parse: [] } } });
    }
    if (interaction.data?.name !== 'dzika') return ephemeral('Nie znam tej komendy.');

    const subcommand = interaction.data.options?.[0];
    if (!subcommand) return ephemeral('Wybierz zmianę albo publikowanie.');

    if (subcommand.name === 'zmiana') {
      const requestText = String(option(subcommand.options, 'text') || '').trim();
      const reason = validRequest(requestText);
      if (reason) return ephemeral(`Prośba odrzucona: ${reason}`);
      ctx.waitUntil(processRequest(interaction, env, requestText, game));
      const requester = interaction.member?.user?.id || interaction.user?.id;
      return publicMessage(`🟡 **${game.name}: przyjęto zmianę**${requester ? ` od <@${requester}>` : ''}\n> ${requestSummary(requestText)}\n\nPostęp i link do gotowego podglądu pojawią się tutaj.\nZlecenie: \`${interaction.id}\`.`);
    }

    if (subcommand.name === 'promote') {
      if (!isAdmin(interaction, env)) return ephemeral('Tylko administrator może opublikować zmianę na żywo.');
      const requestId = String(option(subcommand.options, 'request_id') || '');
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(requestId)) return ephemeral('Nieprawidłowe oznaczenie prośby.');
      ctx.waitUntil(processPromotion(interaction, env, requestId, game));
      return publicMessage(`🟣 **${game.name}: publikowanie uruchomione.**\nZlecenie: \`${requestId}\`.`);
    }

    return ephemeral('Nie znam tej komendy.');
  },
};
