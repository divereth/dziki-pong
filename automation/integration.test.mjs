import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readdirSync, readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import worker from './discord-worker/src/index.js';
import { GAMES, getGame, gameForInteraction, statusWebhook } from './games.mjs';
import { allowedChange, buildGame, filesUnder, validateChanges } from './game-tools.mjs';
import { validateRequest, validatePromotion, metadataFor } from './request.mjs';
import { gamesForPaths } from './select-games.mjs';
import { notify, notifyDeveloper, developerMessage, progressMessage } from './notify.mjs';

const keys = await webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
const publicKey = Buffer.from(await webcrypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
const env = { DISCORD_PUBLIC_KEY: publicKey, DISCORD_GUILD_ID: 'guild', DISCORD_CHANNEL_ID: 'pong-channel', DISCORD_ADMIN_ROLE_ID: 'admin', GITHUB_REPOSITORY: 'divereth/dziki-pong', GITHUB_DISPATCH_TOKEN: 'test-dispatch-token' };
function interaction(id, command = 'zmiana', roles = []) {
  return { id: '1551969431788453888', type: 2, application_id: 'app', token: 'private-interaction-token', guild_id: 'guild', channel_id: id === 'dziki-pong' ? 'pong-channel' : `${id}-channel`, channel: { name: id, type: 0 }, member: { roles, user: { id: '123456789012345678', username: 'Tester' } }, data: { name: 'dzika', options: [{ name: command, options: command === 'zmiana' ? [{ name: 'text', value: 'Dodaj fioletowy kolor nieba' }] : [{ name: 'request_id', value: '1551969431788453888' }] }] } };
}
async function call(data, customEnv = {}, respond = () => new Response(null, { status: 204 })) {
  const body = JSON.stringify(data), timestamp = String(Math.floor(Date.now() / 1000));
  const signature = Buffer.from(await webcrypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode(timestamp + body))).toString('hex');
  const request = new Request('https://discord.example/', { method: 'POST', body, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } });
  const pending = [], calls = [];
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return respond(url, options); };
  try {
    const result = await worker.fetch(request, { ...env, ...customEnv }, { waitUntil(promise) { pending.push(promise); } });
    const response = await result.json();
    await Promise.all(pending);
    return { response, calls };
  } finally { globalThis.fetch = previousFetch; }
}

test('signed commands publicly acknowledge each game and dispatch only that game', async () => {
  for (const [id, config] of Object.entries(GAMES)) {
    const { response, calls } = await call(interaction(id));
    assert.equal(response.type, 4);
    assert.match(response.data.content, new RegExp(config.name));
    assert.equal((response.data.flags || 0) & 64, 0);
    assert.match(response.data.content, /Postęp i link do gotowego podglądu pojawią się tutaj/);
    assert.ok(!response.data.content.includes('1398036719101542601'));
    assert.equal(calls.length, 1);
    const dispatched = JSON.parse(calls[0].options.body);
    assert.equal(dispatched.event_type, 'dziki_request');
    assert.equal(dispatched.client_payload.game_id, id);
    assert.equal(dispatched.client_payload.discord_channel_id, interaction(id).channel_id);
    assert.ok(!calls[0].options.body.includes('private-interaction-token'));
  }
});

test('invalid signatures, unknown channels and other servers cannot launch jobs', async () => {
  const invalid = await worker.fetch(new Request('https://test/', { method: 'POST', body: '{}' }), env, { waitUntil() { assert.fail(); } });
  assert.equal(invalid.status, 401);
  for (const input of [{ ...interaction('general') }, { ...interaction('dziki-bieg'), guild_id: 'other-guild' }]) {
    const result = await call(input);
    assert.equal(result.calls.length, 0);
  }
});

test('channel IDs override names and reject duplicate or renamed channels', () => {
  const pinned = { ...env, DISCORD_BIEG_CHANNEL_ID: 'pinned-bieg' };
  assert.equal(gameForInteraction(interaction('dziki-bieg'), pinned), null);
  assert.equal(gameForInteraction({ ...interaction('anything'), channel_id: 'pinned-bieg' }, pinned).id, 'dziki-bieg');
  assert.equal(gameForInteraction({ ...interaction('dziki-pong'), channel_id: 'copy-pong' }, pinned), null);
});

test('promotion requires the configured admin role and carries both game and channel', async () => {
  const denied = await call(interaction('dziki-karabin', 'promote'));
  assert.equal(denied.calls.length, 0);
  const accepted = await call(interaction('dziki-karabin', 'promote', ['admin']));
  const data = JSON.parse(accepted.calls[0].options.body);
  assert.equal(data.event_type, 'dziki_promote');
  assert.equal(data.client_payload.game_id, 'dziki-karabin');
  assert.equal(data.client_payload.discord_channel_id, 'dziki-karabin-channel');
});

test('Pong webhook is never reused for another game', async () => {
  const config = { DISCORD_STATUS_WEBHOOK_URL: 'https://discord.test/pong', DISCORD_DEV_WEBHOOK_URL: 'https://discord.test/dev' };
  assert.equal(statusWebhook(config, getGame('dziki-bieg')), '');
  const calls = [];
  await notify('Podgląd gotowy', { env: config, game: getGame('dziki-bieg'), channelId: '123456789012345678', send: async (url, options) => { calls.push({ url, options }); return new Response(null, { status: 204 }); } });
  assert.deepEqual(calls, []);
});

test('every game retains public source-channel delivery when dev reporting is not configured', async () => {
  for (const id of Object.keys(GAMES)) {
    const calls = [];
    const delivered = await notify('Gotowe', { env: { DISCORD_BOT_TOKEN: 'fake-bot', DISCORD_DEV_WEBHOOK_URL: 'https://discord.test/dev', DISCORD_STATUS_WEBHOOK_URL: 'https://discord.test/pong' }, game: getGame(id), channelId: '123456789012345678', send: async (url, options) => { calls.push({ url, options }); return new Response(null, { status: 204 }); } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://discord.com/api/v10/channels/123456789012345678/messages');
    assert.equal(calls[0].options.headers.authorization, 'Bot fake-bot');
    assert.equal(JSON.parse(calls[0].options.body).flags, undefined);
    assert.deepEqual(JSON.parse(calls[0].options.body).allowed_mentions, { parse: [] });
    assert.equal(delivered.delivered, true);
  }
});

test('a failed public notification does not block the game or use unconfigured destinations', async () => {
  let attempts = 0;
  await notify('Gotowe', { env: { DISCORD_STATUS_WEBHOOK_URL: 'https://discord.test/pong', DISCORD_DEV_WEBHOOK_URL: 'https://discord.test/dev' }, game: getGame(), send: async () => { attempts++; if (attempts === 1) throw new Error('offline'); return new Response(null, { status: 204 }); } });
  assert.equal(attempts, 1);
});

const reportingEnv = { DISCORD_BOT_TOKEN: 'fake-bot', DISCORD_DEV_CHANNEL_ID: '1398036719101542601', GITHUB_REPOSITORY: 'divereth/dziki-pong', GITHUB_RUN_ID: '123456' };

test('all progress and failure stages for the three new games reach dev and their public game channel', async () => {
  for (const id of ['dziki-sprzedawca', 'dziki-bieg', 'dziki-karabin']) {
    for (const [stage, status] of [['started','success'],['generated','success'],['preview','success'],['result','success'],['result','failure'],['result','cancelled'],['promotion','failure'],['production','failure']]) {
      const game=getGame(id), config={ ...reportingEnv, GAME_ID:id, REQUEST_ID:'request-123', JOB_STATUS:status, PREVIEW_URL:'https://preview.test/' };
      const calls=[];
      const result=await notify(progressMessage(stage,config),{game,channelId:'123456789012345678',env:config,send:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(null,{status:204});}});
      assert.equal(calls.length,2);
      assert.equal(result.delivered,true);
      assert.equal(result.developer.delivered,true);
      const dev=calls.find(c=>c.url.endsWith('/1398036719101542601/messages'));
      assert.ok(dev);
      assert.ok(dev.body.content.includes(game.name));
      assert.ok(dev.body.content.includes('request-123'));
      assert.ok(dev.body.content.includes('https://github.com/divereth/dziki-pong/actions/runs/123456'));
      assert.ok(dev.body.content.includes('<#123456789012345678>'));
      assert.equal(dev.body.flags,undefined);
      assert.deepEqual(dev.body.allowed_mentions,{parse:[]});
      if(status==='failure') assert.match(dev.body.content,/Nie udało/);
    }
  }
});

test('Pong is not added to the new games dev feed', async () => {
  const calls=[];
  await notify('Pong progress',{game:getGame(),channelId:'123456789012345678',env:reportingEnv,send:async url=>{calls.push(url);return new Response(null,{status:204});}});
  assert.deepEqual(calls,['https://discord.com/api/v10/channels/123456789012345678/messages']);
});

test('a broken public notification still reaches dev, and a broken dev delivery leaves the public update working', async () => {
  for(const failure of ['public','dev']) {
    const calls=[];
    const result=await notify('Failure report',{game:getGame('dziki-bieg'),channelId:'123456789012345678',env:reportingEnv,send:async url=>{
      calls.push(url);
      const isDev=url.endsWith('/1398036719101542601/messages');
      if(failure==='public'&&!isDev) throw new Error('unavailable');
      return new Response(null,{status:failure==='dev'&&isDev?403:204});
    }});
    assert.equal(calls.length,2);
    assert.equal(result.delivered,failure!=='public');
    assert.equal(result.developer.delivered,failure!=='dev');
  }
});

test('invalid dev configuration cannot redirect reports and long reports preserve their run link within Discord limits', async () => {
  let attempts=0;
  const result=await notifyDeveloper('failure',{game:getGame('dziki-karabin'),env:{...reportingEnv,DISCORD_DEV_CHANNEL_ID:'not-a-channel'},send:()=>{attempts++;assert.fail();}});
  assert.equal(result.delivered,false);
  assert.equal(attempts,0);
  const text=developerMessage('x'.repeat(3000),reportingEnv,'123456789012345678');
  assert.ok(text.length<=2000);
  assert.ok(text.includes('/actions/runs/123456'));
});

test('new game dispatch acceptance and failures reach dev before a GitHub job exists', async () => {
  for(const id of ['dziki-sprzedawca','dziki-bieg','dziki-karabin']) {
    for(const command of ['zmiana','promote']) {
      for(const status of [204,500]) {
        const result=await call(interaction(id,command,['admin']),reportingEnv,url=>new Response(null,{status:url.startsWith('https://api.github.com/')?status:204}));
        const dev=result.calls.filter(c=>c.url.endsWith('/1398036719101542601/messages'));
        assert.equal(dev.length,1);
        const text=JSON.parse(dev[0].options.body).content;
        assert.ok(text.includes(getGame(id).name));
        assert.match(text,status===500?/Nie udało się przekazać/:/Przyjęto/);
        assert.ok(text.includes('https://github.com/divereth/dziki-pong/actions'));
      }
    }
  }
});

test('progress is readable publicly and a completed preview message contains the working link', () => {
  const env = { GAME_ID: 'dziki-bieg', REQUEST_ID: '12345', JOB_STATUS: 'success', PREVIEW_URL: 'https://discord-12345.dzikibieg.pages.dev/' };
  for (const stage of ['started', 'generated', 'preview']) {
    const content = progressMessage(stage, env);
    assert.match(content, /Dziki Bieg/);
    assert.ok(!content.includes(env.PREVIEW_URL));
  }
  assert.ok(progressMessage('result', env).includes(env.PREVIEW_URL));
  assert.match(progressMessage('result', { ...env, JOB_STATUS: 'failure' }), /Nie udało/);
});

test('game file boundaries reject other games, CI, vendor, tests, and traversal', () => {
  const game = getGame('dziki-sprzedawca');
  assert.ok(allowedChange(game, 'games/dziki-sprzedawca/world.js'));
  assert.ok(allowedChange(game, 'games/dziki-sprzedawca/assets/new-icon.png'));
  for (const path of ['game.js', '.github/workflows/deploy.yml', 'games/dziki-bieg/dist/game.js', 'games/dziki-sprzedawca/vendor/three.module.min.js', 'games/dziki-sprzedawca/economy.test.js', 'games/dziki-sprzedawca/package.json', 'games/dziki-sprzedawca/../../automation/run.js', 'games/dziki-sprzedawca/.env.json']) assert.equal(allowedChange(game, path), false, path);
  assert.ok(allowedChange(getGame(), 'manifest.webmanifest'));
  assert.ok(allowedChange(getGame(), 'service-worker.js'));
});

test('the real Git boundary check catches staged infrastructure edits and deleted game files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dziki-boundary-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  const file = 'games/dziki-bieg/dist/index.html';
  try {
    mkdirSync(join(directory, 'games/dziki-bieg/dist'), { recursive: true });
    writeFileSync(join(directory, file), '<html>Original</html>');
    git('init', '-q');
    git('add', '.');
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'Baseline');
    writeFileSync(join(directory, file), '<html>Changed</html>');
    assert.deepEqual(validateChanges(getGame('dziki-bieg'), directory), [file]);
    mkdirSync(join(directory, '.github/workflows'), { recursive: true });
    writeFileSync(join(directory, '.github/workflows/unsafe.yml'), 'name: unsafe');
    git('add', '.github');
    assert.throws(() => validateChanges(getGame('dziki-bieg'), directory), /Blocked unexpected file change/);
    git('reset', '--', '.github');
    rmSync(join(directory, '.github/workflows/unsafe.yml'));
    rmSync(join(directory, file));
    assert.throws(() => validateChanges(getGame('dziki-bieg'), directory));
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir(), 'dziki-boundary-')));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('promotion rejects a different game, channel, request ID, or an infrastructure edit before merging', () => {
  const game = getGame('dziki-sprzedawca');
  const data = metadataFor({ REQUEST_ID: 'request-123', REQUEST_TEXT: 'Dodaj żółty parasol', DISCORD_CHANNEL_ID: 'channel-123' }, game);
  const pr = { baseRefName: 'main', headRefName: 'discord/request-123', body: `<!-- dziki-pong-request:start -->\n${JSON.stringify(data)}\n<!-- dziki-pong-request:end -->` };
  assert.equal(validatePromotion(pr, game, 'request-123', 'channel-123', ['games/dziki-sprzedawca/world.js']).game_id, game.id);
  assert.throws(() => validatePromotion(pr, getGame(), 'request-123', 'channel-123', ['game.js']));
  assert.throws(() => validatePromotion(pr, game, 'request-123', 'other-channel', ['games/dziki-sprzedawca/world.js']));
  assert.throws(() => validatePromotion(pr, game, 'other-id', 'channel-123', ['games/dziki-sprzedawca/world.js']));
  assert.throws(() => validatePromotion(pr, game, 'request-123', 'channel-123', ['automation/notify.mjs']));
});

test('legacy Pong payloads still select Pong; unknown game IDs fail closed', () => {
  assert.equal(validateRequest({ REQUEST_ID: '123', REQUEST_TEXT: 'Zmień kolor tła' }).id, 'dziki-pong');
  for (const id of ['__proto__', '../../pong', 'other-game']) assert.throws(() => getGame(id));
});

test('production deploy selects only games whose public files changed', () => {
  assert.deepEqual(gamesForPaths(['automation/games.mjs', '.github/workflows/deploy.yml']), []);
  assert.deepEqual(gamesForPaths(['games/dziki-bieg/dist/engine.js']), ['dziki-bieg']);
  assert.deepEqual(gamesForPaths(['style.css', 'games/dziki-karabin/dist/core.js']), ['dziki-pong', 'dziki-karabin']);
});

test('all deploy packages contain an entry point and no tests, infrastructure, or other games', () => {
  for (const id of Object.keys(GAMES)) {
    const output = buildGame(getGame(id));
    assert.ok(existsSync(join(output, 'index.html')));
    const paths = filesUnder(output);
    assert.ok(paths.length >= 5);
    assert.ok(paths.every(path => !/(?:test\.|automation|package\.json|README|games\/|\.github)/.test(path)), id);
    assert.match(readFileSync(join(output, 'index.html'), 'utf8'), /<html/i);
    assert.ok(!readdirSync(output).includes('wrangler.toml'));
  }
});
