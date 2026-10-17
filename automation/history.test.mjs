import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { GAMES, getGame, previewUrl } from './games.mjs';
import { historyCandidate, recentChanges, historyMessage, requestMetadata } from './history.mjs';
import { commands, registerCommands } from './discord-worker/commands.mjs';
import worker from './discord-worker/src/index.js';

function pr(gameId, id = '1560576345384296479', date = '2026-10-17T12:00:00Z') {
  const metadata = { request_id: id, game_id: gameId, author_discord_id: '123456789012345678', request_text: 'Dodaj fioletowy kolor nieba' };
  return { body: `<!-- dziki-pong-request:start -->\n${JSON.stringify(metadata)}\n<!-- dziki-pong-request:end -->`, head: { ref: `discord/${id}` }, base: { ref: 'main' }, created_at: date, merged_at: null };
}

test('history selects the correct game and preserves author, date, text and game link', async () => {
  const game = getGame('dziki-bieg');
  const calls = [];
  const entries = await recentChanges(game, { GITHUB_REPOSITORY: 'owner/games' }, { send: async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith('https://api.github.com/')) return Response.json([pr('dziki-pong'), pr('dziki-bieg')]);
    return new Response(null, { status: 200 });
  } });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].authorId, '123456789012345678');
  assert.equal(entries[0].date, Date.parse('2026-10-17T12:00:00Z'));
  assert.match(entries[0].change, /kolor nieba/);
  assert.equal(entries[0].url, previewUrl(game, entries[0].id));
  assert.equal(calls.filter(call => call.options.method === 'HEAD').length, 1);
});

test('history excludes failed uploads, tolerates failed preview checks, and returns five newest working versions', async () => {
  const prs = Array.from({ length: 8 }, (_, i) => pr('dziki-karabin', `156057634538429647${i}`, `2026-10-17T12:0${i}:00Z`));
  const missing = previewUrl(getGame('dziki-karabin'), '1560576345384296477');
  const entries = await recentChanges(getGame('dziki-karabin'), { GITHUB_REPOSITORY: 'owner/games' }, { send: async url => {
    if (url.startsWith('https://api.github.com/')) return Response.json(prs);
    if (url === missing) return new Response(null, { status: 404 });
    if (url.includes('1560576345384296476')) throw new Error('unavailable');
    return new Response(null, { status: 200 });
  } });
  assert.equal(entries.length, 5);
  assert.equal(entries[0].id, '1560576345384296475');
  assert.ok(entries.every((entry, index) => index === 0 || entries[index - 1].date >= entry.date));
});

test('legacy Pong requests remain readable, and malformed or unrelated PRs do not enter history', () => {
  const legacy = pr(undefined);
  assert.ok(historyCandidate(legacy, getGame()));
  assert.equal(historyCandidate(legacy, getGame('dziki-sprzedawca')), null);
  assert.equal(historyCandidate({ ...pr('dziki-bieg'), head: { ref: 'automation/other' } }, getGame('dziki-bieg')), null);
  assert.equal(historyCandidate({ ...pr('dziki-bieg'), created_at: 'invalid' }, getGame('dziki-bieg')), null);
  assert.equal(requestMetadata('<!-- dziki-pong-request:start -->\ninvalid\n<!-- dziki-pong-request:end -->'), null);
});

test('the final metadata block is used even when a request quotes another metadata block', () => {
  const result = requestMetadata(`${pr('dziki-pong').body}\n${pr('dziki-bieg').body}`);
  assert.equal(result.game_id, 'dziki-bieg');
});

test('public history renders all required fields without pinging anyone', () => {
  const game = getGame('dziki-sprzedawca');
  const entry = historyCandidate(pr(game.id), game);
  const message = historyMessage(game, [entry]);
  assert.deepEqual(message.allowed_mentions, { parse: [] });
  assert.equal(message.flags, undefined);
  assert.equal(message.embeds[0].fields[0].value, '<@123456789012345678>');
  assert.match(message.embeds[0].fields[1].value, /^<t:\d+:f>$/);
  assert.ok(message.embeds[0].fields[2].value.includes(entry.url));
  assert.match(message.embeds[0].description, /kolor nieba/);
  assert.match(historyMessage(game, []).content, /Nie ma jeszcze gotowych podglądów/);
});

test('five descriptions with heavy Markdown stay within Discord embed limits', () => {
  const game = getGame('dziki-bieg');
  const entries = Array.from({ length: 5 }, (_, i) => ({ ...historyCandidate(pr(game.id), game), id: `${i}560576345384296479`, change: '['.repeat(2000) }));
  const message = historyMessage(game, entries);
  const total = message.embeds.reduce((sum, embed) => sum + embed.title.length + embed.description.length + embed.footer.text.length + embed.fields.reduce((n, field) => n + field.name.length + field.value.length, 0), 0);
  assert.ok(total <= 6000);
  assert.ok(message.embeds.every(embed => embed.description.length <= 700));
});

test('command registration adds the history command without deleting unrelated commands', async () => {
  const calls = [];
  const registered = await registerCommands({ token: 'test-bot-token', guildId: '123456789012345678', send: async (url, options) => {
    calls.push({ url, options });
    return options.method === 'POST' ? Response.json({}) : Response.json({ id: '234567890123456789' });
  } });
  assert.deepEqual(registered, ['dzika', 'ostatnie']);
  assert.equal(commands.find(command => command.name === 'ostatnie').options[0].name, 'zmiany');
  assert.equal(calls[0].url, 'https://discord.com/api/v10/applications/@me');
  assert.equal(calls.filter(call => call.options.method === 'POST').length, 2);
  assert.ok(calls.every(call => !['PUT', 'DELETE'].includes(call.options.method)));
});

test('a rejected registration fails clearly without exposing the bot token', async () => {
  await assert.rejects(registerCommands({ token: 'private-test-token', guildId: '123456789012345678', applicationId: '234567890123456789', send: async () => new Response(null, { status: 403 }) }), error => error.message.includes('403') && !error.message.includes('private-test-token'));
});

test('signed /ostatnie zmiany is public, lists only the channel game, and does not start GPT', async () => {
  const keys = await webcrypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const publicKey = Buffer.from(await webcrypto.subtle.exportKey('raw', keys.publicKey)).toString('hex');
  for (const gameId of Object.keys(GAMES)) {
    const data = { id: '1560576345384296479', type: 2, application_id: 'app', token: 'private-interaction', guild_id: 'guild', channel_id: 'channel', channel: { name: gameId }, data: { name: 'ostatnie', options: [{ name: 'zmiany' }] } };
    const body = JSON.stringify(data), timestamp = String(Math.floor(Date.now() / 1000));
    const signature = Buffer.from(await webcrypto.subtle.sign('Ed25519', keys.privateKey, new TextEncoder().encode(timestamp + body))).toString('hex');
    const calls = [], pending = [], previousFetch = globalThis.fetch;
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, options });
      if (url.startsWith('https://api.github.com/')) return Response.json([pr(gameId), pr(gameId === 'dziki-pong' ? 'dziki-bieg' : 'dziki-pong')]);
      return new Response(null, { status: options.method === 'PATCH' ? 204 : 200 });
    };
    try {
      const response = await worker.fetch(new Request('https://worker.test/', { method: 'POST', body, headers: { 'x-signature-ed25519': signature, 'x-signature-timestamp': timestamp } }), { DISCORD_PUBLIC_KEY: publicKey, DISCORD_GUILD_ID: 'guild', GITHUB_REPOSITORY: 'owner/games' }, { waitUntil(promise) { pending.push(promise); } });
      const initial = await response.json();
      assert.equal(initial.type, 5);
      assert.equal((initial.data.flags || 0) & 64, 0);
      await Promise.all(pending);
      assert.ok(!calls.some(call => call.url.endsWith('/dispatches')));
      const published = JSON.parse(calls.find(call => call.options.method === 'PATCH').options.body);
      assert.equal(published.embeds.length, 1);
      assert.ok(published.content.includes(getGame(gameId).name));
      assert.ok(published.embeds[0].fields[2].value.includes(getGame(gameId).project));
    } finally { globalThis.fetch = previousFetch; }
  }
});
