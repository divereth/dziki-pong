import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker, {CANONICAL_ORIGIN} from './worker.mjs';

test('the old address forwards every game route and query to the canonical game', async () => {
  for (const path of ['/', '/?v=old', '/index.html?wish=2', '/engine.js', '/manifest.webmanifest', '/always-free.mp3']) {
    const response = await worker.fetch(new Request('https://uniboar.pages.dev' + path));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), CANONICAL_ORIGIN + path);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('old tabs can read and submit scores without redirecting a cross-origin POST', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async request => {
      assert.equal(request.url, CANONICAL_ORIGIN + '/api/leaderboard?near=player');
      assert.equal(request.headers.get('Origin'), CANONICAL_ORIGIN);
      if (request.method === 'POST') assert.equal(await request.text(), '{"nickname":"Boar","score":123}');
      return new Response('{"scores":[]}', {headers: {'Content-Type':'application/json'}});
    };
    for (const method of ['GET', 'POST']) {
      const response = await worker.fetch(new Request('https://uniboar.pages.dev/api/leaderboard?near=player', {
        method, headers: {Origin: 'https://uniboar.pages.dev'},
        ...(method === 'POST' ? {body: '{"nickname":"Boar","score":123}'} : {}),
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {scores: []});
    }
    const denied = await worker.fetch(new Request('https://uniboar.pages.dev/api/leaderboard', {
      method: 'POST', headers: {Origin: 'https://unrelated.example'}, body: '{}',
    }));
    assert.equal(denied.status, 403);
  } finally { globalThis.fetch = original; }
});

test('upgrading an old PWA retires its worker, removes only game caches and moves open clients', async () => {
  const response = await worker.fetch(new Request('https://uniboar.pages.dev/sw.js?old=1'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Service-Worker-Allowed'), '/');
  const events = {}, removed = [], navigated = [];
  let skipped = false, unregistered = false, completed;
  vm.runInNewContext(await response.text(), {
    URL,
    self: {
      addEventListener: (name, fn) => events[name] = fn,
      skipWaiting: () => skipped = true,
      registration: {unregister: async () => unregistered = true},
      clients: {matchAll: async () => [{url: 'https://uniboar.pages.dev/?v=old#game', navigate: async url => navigated.push(url)}]},
    },
    caches: {keys: async () => ['robot-uniboar-old', 'robot-uniboar-new', 'unrelated-cache'], delete: async key => removed.push(key)},
  });
  events.install(); events.activate({waitUntil: promise => completed = promise}); await completed;
  assert.equal(skipped, true); assert.equal(unregistered, true);
  assert.deepEqual(removed, ['robot-uniboar-old', 'robot-uniboar-new']);
  assert.deepEqual(navigated, [CANONICAL_ORIGIN + '/?v=old#game']);
});
