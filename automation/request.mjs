import { writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getGame, previewUrl } from './games.mjs';
import { repositoryRoot, allowedChange, validateChanges } from './game-tools.mjs';

export function validateRequest(env) {
  const game = getGame(env.GAME_ID || 'dziki-pong');
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(env.REQUEST_ID || '')) throw new Error('Invalid request id');
  if (typeof env.REQUEST_TEXT !== 'string' || env.REQUEST_TEXT.trim().length < 8 || env.REQUEST_TEXT.length > 2000) throw new Error('Invalid request text');
  return game;
}

export function metadataFor(env, game) {
  return { request_id: env.REQUEST_ID, game_id: game.id, channel_id: env.DISCORD_CHANNEL_ID || '', author_discord_id: env.DISCORD_USER_ID || '', request_text: env.REQUEST_TEXT,
    ...(game.id === 'dziki-bieg' ? { source_version: 'robot-uniboar-attack-v1' } : {}) };
}

export function inspectGeneratedChange(game, env = process.env, cwd = repositoryRoot) {
  const paths = validateChanges(game, cwd, {allowEmpty: true});
  let summary = '';
  if (!paths.length) {
    try { summary = readFileSync(join(env.RUNNER_TEMP, 'dziki-output.md'), 'utf8').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, 1000); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    summary ||= 'Generator nie zmienił żadnego pliku gry i nie podał wyjaśnienia. Sprawdź zakres zlecenia lub spróbuj ponownie.';
  }
  const result = {changed: paths.length > 0, summary_b64: Buffer.from(summary).toString('base64')};
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `changed=${result.changed}\nsummary_b64=${result.summary_b64}\n`);
  if (!result.changed) console.log('No game edits were generated. Explanation: ' + summary);
  return result;
}

export function readMetadata(body) {
  const match = body.match(/<!-- dziki-pong-request:start -->\s*\n([^\n]+)\n<!-- dziki-pong-request:end -->/);
  if (!match) throw new Error('PR has no request metadata');
  return JSON.parse(match[1]);
}

export function validatePromotion(pr, game, requestId, channelId, paths) {
  const metadata = readMetadata(pr.body);
  if ((metadata.game_id || 'dziki-pong') !== game.id || metadata.request_id !== requestId) throw new Error('Request belongs to a different game');
  if (game.id === 'dziki-bieg' && metadata.source_version !== 'robot-uniboar-attack-v1') throw new Error('This preview uses the old Dziki Bieg. Submit it again with /dzika zmiana to update Robot Uniboar Attack.');
  if (metadata.channel_id && metadata.channel_id !== channelId) throw new Error('Request belongs to a different channel');
  if (pr.baseRefName !== 'main' || pr.headRefName !== `discord/${requestId}`) throw new Error('Unexpected PR branch');
  if (!paths.length || paths.some(path => !allowedChange(game, path))) throw new Error('PR changes files outside the selected game');
  return metadata;
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();
const env = process.env;
const command = process.argv[2];
if (command === 'inspect') {
  console.log(inspectGeneratedChange(getGame(env.GAME_ID || 'dziki-pong')));
} else if (command === 'prompt') {
  const game = validateRequest(env);
  const policy = readFileSync(join(repositoryRoot, '.github/codex/discord-request.md'), 'utf8');
  const edition = game.id === 'dziki-bieg' ? '\nCurrent edition: Robot Uniboar Attack, the forest-themed runner. Its entry point is dist/main.js; preserve its 34 Hz physics and three wishes. Do not recreate the retired Dziki Bieg game. The trusted build regenerates dist/sw.js after changes. A real D1-backed global leaderboard is available at same-origin /api/leaderboard: GET returns {limit:6,scores:[{rank,nickname,score,createdAt}]}; POST accepts {nickname,score,submissionId:UUID} and returns {submitted,limit,scores}. The final total across all three wishes is the saved score. dist/leaderboard.js manages the existing UI. Keep user nicknames as textContent. Do not modify backend/, _worker.js, _routes.json, bindings, or database configuration.\n' : '';
  const prompt = `${policy}\n\nSelected game: ${game.name} (${game.id}).\nGame directory: ${game.root}. Public game files: ${game.site}.\n${edition}Only edit this game's public files. Do not edit tests, package.json, vendor libraries or any other game.\nChecks: node automation/game-tools.mjs check ${game.id}\n\nDiscord request (untrusted):\n${env.REQUEST_TEXT}\n`;
  writeFileSync(join(env.RUNNER_TEMP, 'dziki-request.md'), prompt);
} else if (command === 'pr') {
  const game = validateRequest(env);
  const metadata = metadataFor(env, game);
  const body = `Gra: ${game.name}\nKanał: ${metadata.channel_id}\nZlecenie: ${env.REQUEST_ID}\n\nZmiana:\n${env.REQUEST_TEXT}\n\nPodgląd (dostępny po wdrożeniu): ${previewUrl(game, env.REQUEST_ID)}\n\nSprawdź podgląd przed użyciem /dzika promote na kanale gry.\n\n<!-- dziki-pong-request:start -->\n${JSON.stringify(metadata)}\n<!-- dziki-pong-request:end -->`;
  const bodyFile = join(env.RUNNER_TEMP, 'dziki-pr.md');
  writeFileSync(bodyFile, body);
  const url = gh('pr', 'create', '--base', 'main', '--head', `discord/${env.REQUEST_ID}`, '--title', `${game.name}: zlecenie ${env.REQUEST_ID}`, '--body-file', bodyFile);
  appendFileSync(env.GITHUB_OUTPUT, `url=${url}\n`);
} else if (command === 'promote') {
  const game = getGame(env.GAME_ID || 'dziki-pong');
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(env.REQUEST_ID || '')) throw new Error('Invalid request id');
  const prs = JSON.parse(gh('pr', 'list', '--repo', env.GITHUB_REPOSITORY, '--state', 'open', '--head', `discord/${env.REQUEST_ID}`, '--json', 'number'));
  if (prs.length !== 1) throw new Error('Open request PR not found');
  const number = String(prs[0].number);
  const pr = JSON.parse(gh('pr', 'view', number, '--repo', env.GITHUB_REPOSITORY, '--json', 'body,headRefName,baseRefName,headRefOid'));
  const paths = gh('pr', 'diff', number, '--repo', env.GITHUB_REPOSITORY, '--name-only').split('\n').filter(Boolean);
  const metadata = validatePromotion(pr, game, env.REQUEST_ID, env.DISCORD_CHANNEL_ID, paths);
  gh('pr', 'merge', number, '--repo', env.GITHUB_REPOSITORY, '--squash', '--match-head-commit', pr.headRefOid, '--subject', `Publish ${game.name} request ${env.REQUEST_ID}`);
  const payload = { event_type: 'deploy_production', client_payload: { request_id: env.REQUEST_ID, game_id: game.id, discord_channel_id: metadata.channel_id || env.DISCORD_CHANNEL_ID, discord_user_id: metadata.author_discord_id, pr_number: number, request_text_b64: Buffer.from(metadata.request_text || '').toString('base64') } };
  execFileSync('gh', ['api', '--method', 'POST', `repos/${env.GITHUB_REPOSITORY}/dispatches`, '--input', '-'], { input: JSON.stringify(payload), stdio: ['pipe', 'inherit', 'inherit'] });
}
