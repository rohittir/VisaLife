import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, validateFeedback, submitFeedback, feedbackContext } from './feedback.js';

const reply = (status, body, type = 'application/json') =>
  async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: type ? { 'Content-Type': type } : {} });
const payload = { category: 'suggestion', message: 'Add a reminder', honeypot: '' };
const send = (fetchImpl, opts) => submitFeedback(payload, { fetchImpl, ...opts });

test('the four categories, in order', () => {
  assert.deepEqual(CATEGORIES.map(([id]) => id), ['suggestion', 'problem', 'thanks', 'other']);
});

test('validateFeedback: category, and 3 to 1000 characters after trimming', () => {
  const ok = (message, category = 'other') => validateFeedback({ category, message }).ok;
  assert.equal(ok('abc'), true);
  assert.equal(ok('x'.repeat(1000)), true);
  assert.equal(ok('ab'), false);
  assert.equal(ok('  ab  '), false);
  assert.equal(ok('x'.repeat(1001)), false);
  assert.equal(ok(undefined), false);
  assert.equal(ok('hello there', 'spam'), false);
});

test('success is a 200 JSON body that is exactly { ok: true }', async () => {
  assert.deepEqual(await send(reply(200, { ok: true })), { ok: true });
  assert.deepEqual(await send(reply(200, { ok: true }, 'application/json; charset=utf-8')), { ok: true });
});

test('the SPA fallback (index.html with status 200) is a failure, never "sent"', async () => {
  const r = await send(reply(200, '<!doctype html><html></html>', 'text/html'));
  assert.deepEqual(r, { ok: false, reason: 'server' });
});

test('a 200 with a missing or wrong content type is a failure, even when the body parses', async () => {
  assert.equal((await send(reply(200, { ok: true }, 'text/plain'))).ok, false);
  assert.equal((await send(reply(200, { ok: true }, null))).ok, false);
});

test('a 200 JSON body that is not exactly { ok: true } is a failure', async () => {
  for (const b of [{ ok: false }, { ok: 'true' }, { ok: true, extra: 1 }, {}, [], null, '"ok"']) {
    assert.deepEqual(await send(reply(200, b)), { ok: false, reason: 'server' }, JSON.stringify(b));
  }
});

test('a 200 JSON content type with an HTML body is a failure', async () => {
  assert.deepEqual(await send(reply(200, '<html></html>', 'application/json')), { ok: false, reason: 'server' });
});

test('400 is invalid, 429 is rate, anything else is server', async () => {
  assert.deepEqual(await send(reply(400, { ok: false, error: 'invalid' })), { ok: false, reason: 'invalid' });
  assert.deepEqual(await send(reply(429, { message: 'Too Many Requests' })), { ok: false, reason: 'rate' });
  for (const s of [403, 404, 413, 500, 502, 503]) assert.deepEqual(await send(reply(s, { ok: false })), { ok: false, reason: 'server' }, String(s));
});

test('a thrown fetch is network', async () => {
  assert.deepEqual(await send(async () => { throw new TypeError('Failed to fetch'); }), { ok: false, reason: 'network' });
});

test('a request that outlives the timeout is aborted and is network', async () => {
  const hang = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  assert.deepEqual(await send(hang, { timeoutMs: 20 }), { ok: false, reason: 'network' });
});

test('the request is a JSON POST of the payload to /api/feedback', async () => {
  let seen;
  await send(async (url, init) => { seen = { url, init }; return new Response('{"ok":true}', { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  assert.equal(seen.url, '/api/feedback');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.init.body), payload);
});

test('feedbackContext carries only visa, stage and route', () => {
  assert.deepEqual(feedbackContext({ visa: 'H1B', stage: 'working', dates: { optEnd: '2026-01-01' } }, '/me'), { visa: 'H1B', stage: 'working', route: '/me' });
});
