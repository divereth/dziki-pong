import { getGame, statusWebhook } from './games.mjs';

// Only names of secrets appear in configuration. Tokens never enter dispatch payloads or logs.
export async function notify(content, { game = getGame(process.env.GAME_ID || 'dziki-pong'), channelId = process.env.DISCORD_CHANNEL_ID, env = process.env, send = fetch } = {}) {
  const webhook = statusWebhook(env, game);
  const messages = [];
  const body = JSON.stringify({ content, allowed_mentions: { parse: [] } });
  if (webhook) messages.push([webhook, { method: 'POST', headers: { 'content-type': 'application/json' }, body }]);
  else if (env.DISCORD_BOT_TOKEN && /^\d{15,22}$/.test(channelId || '')) {
    messages.push([`https://discord.com/api/v10/channels/${channelId}/messages`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, body }]);
  }
  if (env.DISCORD_DEV_WEBHOOK_URL) {
    messages.push([env.DISCORD_DEV_WEBHOOK_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: `${game.name}${channelId ? ` · <#${channelId}>` : ''}\n${content}`, allowed_mentions: { parse: [] } }) }]);
  }
  for (const [url, options] of messages) {
    try {
      const response = await send(url, options);
      if (!response.ok) console.error(`Discord notification failed (${response.status})`);
    } catch {
      console.error('Discord notification unavailable; game workflow continues.');
    }
  }
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/automation/notify.mjs')) {
  const env = process.env;
  const run = `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
  const messages = {
    started: `🐗 Zlecenie ${env.REQUEST_ID}: Dziki rozpoczął pracę nad zmianą.\n${run}`,
    result: env.JOB_STATUS === 'success'
      ? `✅ Zlecenie ${env.REQUEST_ID}: podgląd gotowy!\n${env.PREVIEW_URL}\nPR: ${env.PR_URL}\n${run}`
      : `⚠️ Zlecenie ${env.REQUEST_ID}: nie udało się przygotować zmiany.\n${run}`,
    production: env.JOB_STATUS === 'success'
      ? `✅ Zlecenie ${env.REQUEST_ID}: zmiana opublikowana w głównej wersji gry!\n${env.GAME_URL}\n${run}`
      : `⚠️ Zlecenie ${env.REQUEST_ID}: publikacja nie powiodła się.\n${run}`,
    promotion: env.JOB_STATUS === 'success'
      ? `🟣 Zlecenie ${env.REQUEST_ID}: zmiana zatwierdzona, trwa publikacja.\n${run}`
      : `⚠️ Zlecenie ${env.REQUEST_ID}: zatwierdzenie nie powiodło się. Sprawdź, czy zlecenie pochodzi z tej gry i kanału.\n${run}`,
  };
  await notify(messages[process.argv[2]] || 'Nieznany status.');
}
