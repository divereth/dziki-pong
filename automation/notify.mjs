import { getGame, statusWebhook } from './games.mjs';

const runtimeEnv = typeof process === 'undefined' ? {} : process.env || {};
const developerGames = new Set(['dziki-sprzedawca', 'dziki-bieg', 'dziki-karabin']);

export function notificationTarget(game, channelId, env) {
  // Public game updates still use the originating signed interaction's channel.
  if (env.DISCORD_BOT_TOKEN && /^\d{15,22}$/.test(channelId || '')) {
    return { url: `https://discord.com/api/v10/channels/${channelId}/messages`, headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, type: 'bot' };
  }
  const webhook = statusWebhook(env, game);
  return webhook ? { url: webhook, headers: { 'content-type': 'application/json' }, type: 'webhook' } : null;
}

export function developerNotificationTarget(game, env) {
  if (!developerGames.has(game.id) || !env.DISCORD_BOT_TOKEN || !/^\d{15,22}$/.test(env.DISCORD_DEV_CHANNEL_ID || '')) return null;
  return { url: `https://discord.com/api/v10/channels/${env.DISCORD_DEV_CHANNEL_ID}/messages`, headers: { 'content-type': 'application/json', authorization: `Bot ${env.DISCORD_BOT_TOKEN}` }, type: 'bot' };
}

export function developerMessage(content, env, channelId) {
  const context = [];
  if (/^\d{15,22}$/.test(channelId || '')) context.push(`Kanał gry: <#${channelId}>`);
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY || '')) {
    const run = /^\d+$/.test(env.GITHUB_RUN_ID || '') ? `/runs/${env.GITHUB_RUN_ID}` : '';
    context.push(`[Przebieg zadania](https://github.com/${env.GITHUB_REPOSITORY}/actions${run})`);
  }
  const suffix = context.length ? `\n\n${context.join(' · ')}` : '';
  return `${content.slice(0, 2000 - suffix.length)}${suffix}`;
}

async function deliver(target, content, send, label) {
  if (!target) {
    return { delivered: false, destination: null };
  }
  try {
    const response = await send(target.url, { method: 'POST', headers: target.headers, body: JSON.stringify({ content, allowed_mentions: { parse: [] } }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) console.error(`${label} notification failed (${response.status}); check the bot's channel permissions.`);
    return { delivered: response.ok, destination: target.type, status: response.status };
  } catch {
    console.error(`${label} notification unavailable; game workflow continues.`);
    return { delivered: false, destination: target.type };
  }
}

export async function notifyDeveloper(content, { game = getGame(runtimeEnv.GAME_ID || 'dziki-pong'), channelId = runtimeEnv.DISCORD_CHANNEL_ID, env = runtimeEnv, send = fetch } = {}) {
  return deliver(developerNotificationTarget(game, env), developerMessage(content, env, channelId), send, 'Developer');
}

export async function notify(content, { game = getGame(runtimeEnv.GAME_ID || 'dziki-pong'), channelId = runtimeEnv.DISCORD_CHANNEL_ID, env = runtimeEnv, send = fetch } = {}) {
  const target = notificationTarget(game, channelId, env);
  if (!target) console.error(`Public notifications are not configured for ${game.name}. Set DISCORD_BOT_TOKEN with permission to send messages in the game channel.`);
  const [result, developer] = await Promise.all([
    deliver(target, content, send, 'Public game'),
    notifyDeveloper(content, { game, channelId, env, send }),
  ]);
  return { ...result, developer };
}

function stageMessage(stage, env, game = getGame(env.GAME_ID || 'dziki-pong')) {
  const heading = `**${game.name} · zlecenie ${env.REQUEST_ID}**`;
  if (stage === 'result' && env.JOB_STATUS === 'success' && env.REQUEST_CHANGED === 'false') {
    const reason = Buffer.from(env.REQUEST_SUMMARY_B64 || '', 'base64').toString('utf8').slice(0, 1000);
    return `ℹ️ ${heading}\nNie powstały zmiany w grze, więc nie utworzono podglądu ani PR-a.\n${reason || 'Generator nie podał wyjaśnienia.'}`;
  }
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

export function requestDescription(text) {
  return String(text || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[\\`*_{}[\]()~>|]/g, char => '\\' + char).slice(0, 500);
}
export function progressMessage(stage, env, game = getGame(env.GAME_ID || 'dziki-pong')) {
  const decode = value => Buffer.from(value || '', 'base64').toString('utf8');
  const lines = stageMessage(stage, env, game).split('\n');
  lines.splice(1, 0, 'Zlecona zmiana: ' + (requestDescription(env.REQUEST_TEXT || decode(env.REQUEST_TEXT_B64)) || 'Opis niedostępny — sprawdź pierwotne zlecenie.'));
  if (env.JOB_STATUS === 'success' && ['result','production'].includes(stage) && env.REQUEST_CHANGED !== 'false') lines.push('Wprowadzono: ' + (requestDescription(decode(env.REQUEST_SUMMARY_B64)) || 'Brak podsumowania wykonawcy; szczegóły w PR.'));
  if (env.JOB_STATUS && env.JOB_STATUS !== 'success') lines.push('Powód: ' + (requestDescription(env.FAILURE_REASON) || (env.JOB_STATUS === 'cancelled' ? 'Zadanie anulowano lub przekroczyło limit czasu.' : 'Błąd wykonania; szczegóły w GitHub Actions.')));
  return lines.join('\n').slice(0,1900);
}

if (typeof process !== 'undefined' && process.argv?.[1]?.replaceAll('\\', '/').endsWith('/automation/notify.mjs')) {
  const env = { ...process.env };
  if (!env.REQUEST_TEXT && !env.REQUEST_TEXT_B64 && env.REQUEST_ID && env.GH_TOKEN) {
    try {
      const { execFileSync } = await import('node:child_process');
      const { requestMetadata } = await import('./history.mjs');
      const prs = JSON.parse(execFileSync('gh', ['pr','list','--repo',env.GITHUB_REPOSITORY,'--state','all','--head','discord/' + env.REQUEST_ID,'--json','body'], {encoding:'utf8'}));
      const metadata = requestMetadata(prs[0]?.body);
      if (metadata?.request_id === env.REQUEST_ID && (metadata.game_id || 'dziki-pong') === env.GAME_ID) {
        env.REQUEST_TEXT = metadata.request_text;
        env.REQUEST_SUMMARY_B64 ||= Buffer.from(metadata.change_summary || '').toString('base64');
      }
    } catch { console.error('Request metadata unavailable'); }
  }
  await notify(progressMessage(process.argv[2], env));
}
