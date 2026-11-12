import { findRequest } from './history.mjs';
import { getGame } from './games.mjs';
import { requestDescription } from './notify.mjs';
import { Client, GatewayIntentBits } from 'discord.js';

const {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_CHANNEL_ID,
  DISCORD_ADMIN_ROLE_ID,
  GITHUB_DISPATCH_TOKEN,
  GITHUB_REPOSITORY = 'divereth/dziki-pong',
} = process.env;

const required = {
  DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID,
  DISCORD_CHANNEL_ID,
  DISCORD_ADMIN_ROLE_ID,
  GITHUB_DISPATCH_TOKEN,
};
for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`Missing ${name}`);
}

const blockedPatterns = [
  /(?:exfiltrat|steal|dump|print).*(?:secret|token|password|cookie|key)/i,
  /(?:delete|destroy|drop|wipe).*(?:repository|repo|branch|database|github)/i,
  /(?:disable|bypass).*(?:security|protection|review|approval)/i,
  /(?:rm\s+-rf|format\s+c:|powershell\s+-enc|curl\s+.*\|\s*(?:sh|bash))/i,
  /(?:deploy|push).*(?:without|skip).*(?:review|test|approval)/i,
];

function rejectReason(text) {
  if (!text || text.length < 8) return 'Request is too short.';
  if (text.length > 2000) return 'Request is limited to 2000 characters.';
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) return 'Request contains control characters.';
  if (blockedPatterns.some((pattern) => pattern.test(text))) {
    return 'This request matches a blocked security or destructive pattern.';
  }
  return null;
}

async function dispatch(eventType, payload) {
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/dispatches`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${GITHUB_DISPATCH_TOKEN}`,
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'dziki-pong-discord-bridge',
    },
    body: JSON.stringify({ event_type: eventType, client_payload: payload }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub dispatch failed (${response.status}): ${detail.slice(0, 300)}`);
  }
}

function isAdmin(message) {
  return message.member?.roles?.cache?.has(DISCORD_ADMIN_ROLE_ID)
    || message.member?.permissions?.has('Administrator');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`Dziki Pong bridge online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || message.guildId !== DISCORD_GUILD_ID || message.channelId !== DISCORD_CHANNEL_ID) return;

    const promoteMatch = message.content.trim().match(/^!dziki\s+promote\s+([A-Za-z0-9_-]{3,40})$/i);
    if (promoteMatch) {
      if (!isAdmin(message)) {
        await message.reply('Only the configured Discord admin role can publish a request live.');
        return;
      }
      const requestId = promoteMatch[1];
      const metadata = await findRequest(getGame('dziki-pong'), requestId, { GITHUB_REPOSITORY, GITHUB_DISPATCH_TOKEN });
      if (metadata.channel_id && metadata.channel_id !== message.channelId) throw new Error('Request belongs to a different channel');
      await dispatch('dziki_promote', {
        game_id: 'dziki-pong',
        discord_channel_id: message.channelId,
        request_text: metadata.request_text,
        request_id: requestId,
        is_admin: true,
        discord_user_id: message.author.id,
        discord_user_name: message.author.tag,
        received_at: new Date().toISOString(),
      });
      await message.reply(`Publish queued for request \`${requestId}\`. Zlecona zmiana: ${requestDescription(metadata.request_text)}. GitHub will merge it and deploy production after checks.`);
      return;
    }

    const text = message.content.trim();
    const reason = rejectReason(text);
    if (reason) {
      await message.reply(`Request rejected: ${reason}`);
      return;
    }

    const requestId = message.id;
    await dispatch('dziki_request', {
      request_id: requestId,
      request_text: text,
      discord_user_id: message.author.id,
      discord_user_name: message.author.tag,
      discord_channel_id: message.channelId,
      is_admin: isAdmin(message),
      received_at: new Date().toISOString(),
    });
    await message.reply(
      `Queued as \`${requestId}\`. Zlecona zmiana: ${requestDescription(text)}. A separate Cloudflare preview will be created. An admin can publish it with \`!dziki promote ${requestId}\` after reviewing the PR.`,
    );
  } catch (error) {
    console.error(error);
    await message.reply('The request could not be queued. Check the bridge logs.').catch(() => {});
  }
});

client.login(DISCORD_BOT_TOKEN);
