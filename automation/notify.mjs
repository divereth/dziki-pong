import { getGame, statusWebhook } from './games.mjs';

export function notificationTarget(game, channelId, env) {
  // The signed interaction's channel is authoritative. Never copy a game update elsewhere.
  if (env.DISCORD_BOT_TOKEN && /^\d{15,22}$/.test(channelId || '')) {
    return { url: `https://discord.com/api/v10/channels/${channelId}/messages`, headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, type: 'bot' };
  }
  const webhook = statusWebhook(env, game);
  return webhook ? { url: webhook, headers: { 'content-type': 'application/json' }, type: 'webhook' } : null;
}

export async function notify(content, { game = getGame(process.env.GAME_ID || 'dziki-pong'), channelId = process.env.DISCORD_CHANNEL_ID, env = process.env, send = fetch } = {}) {
  const target = notificationTarget(game, channelId, env);
  if (!target) {
    console.error(`Public notifications are not configured for ${game.name}. Set DISCORD_BOT_TOKEN with permission to send messages in the game channel.`);
    return { delivered: false, destination: null };
  }
  try {
    const response = await send(target.url, { method: 'POST', headers: target.headers, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }) });
    if (!response.ok) console.error(`Public game notification failed (${response.status}); check the bot's channel permissions.`);
    return { delivered: response.ok, destination: target.type, status: response.status };
  } catch {
    console.error('Discord notification unavailable; game workflow continues.');
    return { delivered: false, destination: target.type };
  }
}

export function progressMessage(stage, env, game = getGame(env.GAME_ID || 'dziki-pong')) {
  const heading = `**${game.name} · zlecenie ${env.REQUEST_ID}**`;
  const messages = {
    started: `🐗 ${heading}\nDziki rozpoczął przygotowywanie zmiany.`,
    generated: `🔵 ${heading}\nKod zmiany jest gotowy. Trwa sprawdzanie poprawności gry.`,
    preview: `🟣 ${heading}\nSprawdzanie zakończone. Trwa publikowanie podglądu.`,
    result: env.JOB_STATUS === 'success'
      ? `✅ ${heading}\nPodgląd gotowy — możecie zagrać i sprawdzić zmianę!\n${env.PREVIEW_URL}`
      : `⚠️ ${heading}\nNie udało się przygotować zmiany. Opiekun sprawdzi problem.`,
    production: env.JOB_STATUS === 'success'
      ? `✅ ${heading}\nZmiana jest już w głównej wersji gry!\n${env.GAME_URL}`
      : `⚠️ ${heading}\nNie udało się opublikować zmiany w głównej wersji gry.`,
    promotion: env.JOB_STATUS === 'success'
      ? `🟣 ${heading}\nZmiana zatwierdzona. Trwa publikowanie głównej wersji gry.`
      : `⚠️ ${heading}\nNie udało się zatwierdzić zmiany. Sprawdź, czy numer zlecenia pochodzi z tej gry i tego kanału.`,
  };
  if (!Object.hasOwn(messages, stage)) throw new Error('Unknown notification stage');
  return messages[stage];
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/automation/notify.mjs')) {
  await notify(progressMessage(process.argv[2], process.env));
}
