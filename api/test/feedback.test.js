import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, putInput } from '../src/feedback.js';

console.log = console.error = () => {}; // the handler logs ids and lengths; keep the test output readable

const AT = new Date('2026-03-04T05:06:07.000Z');
const ID = '11111111-2222-3333-4444-555555555555';

const setup = (put) => {
  const writes = [];
  const app = createApp({ put: put ?? (async (key, record) => void writes.push({ key, record })), now: () => AT, newId: () => ID });
  return { app, writes };
};

// An API Gateway REST (payload v1) proxy event, as the Lambda sees it behind CloudFront.
const event = (over = {}) => ({
  httpMethod: 'POST',
  path: '/api/feedback',
  resource: '/api/feedback',
  headers: { 'content-type': 'application/json', 'user-agent': 'test' },
  queryStringParameters: null,
  requestContext: { stage: 'prod', path: '/prod/api/feedback' },
  isBase64Encoded: false,
  body: JSON.stringify({ category: 'suggestion', message: 'Add a reminder for my I-94 date', honeypot: '' }),
  ...over,
});
const post = (body, over) => event({ body: typeof body === 'string' ? body : JSON.stringify(body), ...over });
const json = (r) => JSON.parse(r.body);

test('a valid post writes one object under the dated key and answers ok', async () => {
  const { app, writes } = setup();
  const r = await app.run(event(), {});
  assert.equal(r.statusCode, 200);
  assert.match(r.headers['content-type'], /application\/json/);
  assert.deepEqual(json(r), { ok: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].key, `feedback/2026/03/04/${ID}.json`);
  assert.deepEqual(writes[0].record, { v: 1, id: ID, at: AT.toISOString(), category: 'suggestion', message: 'Add a reminder for my I-94 date' });
});

test('the S3 write is encrypted JSON in the given bucket and key', () => {
  const input = putInput('bkt', 'feedback/2026/03/04/x.json', { v: 1, id: 'x' });
  assert.deepEqual(input, { Bucket: 'bkt', Key: 'feedback/2026/03/04/x.json', Body: '{"v":1,"id":"x"}', ContentType: 'application/json', ServerSideEncryption: 'AES256' });
});

test('a filled honeypot looks successful and writes nothing', async () => {
  const { app, writes } = setup();
  const r = await app.run(post({ category: 'other', message: 'buy pills', honeypot: 'http://spam.example' }), {});
  assert.equal(r.statusCode, 200);
  assert.deepEqual(json(r), { ok: true });
  assert.equal(writes.length, 0);
});

test('invalid fields are 400 invalid and write nothing', async () => {
  const { app, writes } = setup();
  const bad = [
    { category: 'suggestion', message: 'x'.repeat(1001) },
    { category: 'suggestion', message: 'ab' },
    { category: 'suggestion', message: '    ab   ' },
    { category: 'suggestion' },
    { category: 'suggestion', message: 42 },
    { category: 'spam', message: 'hello there' },
    { message: 'hello there' },
    [],
    'a string',
    null,
  ];
  for (const b of bad) {
    const r = await app.run(post(b), {});
    assert.equal(r.statusCode, 400, JSON.stringify(b));
    assert.deepEqual(json(r), { ok: false, error: 'invalid' });
  }
  assert.equal(writes.length, 0);
});

test('bad JSON, an empty body and a non-JSON content type are 400', async () => {
  const { app, writes } = setup();
  for (const over of [{ body: '{not json' }, { body: null }, { body: '' }, { headers: { 'content-type': 'text/plain' } }, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'category=other&message=hello+there' }]) {
    const r = await app.run(event(over), {});
    assert.equal(r.statusCode, 400, JSON.stringify(over));
    assert.deepEqual(json(r), { ok: false, error: 'invalid' });
  }
  assert.equal(writes.length, 0);
});

test('a body over 4096 bytes is 413 too_large, also when base64 encoded', async () => {
  const { app, writes } = setup();
  const big = JSON.stringify({ category: 'other', message: 'hello there', pad: 'x'.repeat(5000) });
  for (const over of [{ body: big }, { body: Buffer.from(big).toString('base64'), isBase64Encoded: true }]) {
    const r = await app.run(event(over), {});
    assert.equal(r.statusCode, 413);
    assert.deepEqual(json(r), { ok: false, error: 'too_large' });
  }
  assert.equal(writes.length, 0);
});

test('the limit is bytes, so a body of exactly 4096 passes and one more fails', async () => {
  const { app } = setup();
  const base = JSON.stringify({ category: 'other', message: 'hello there', pad: '' });
  const at = (n) => JSON.stringify({ category: 'other', message: 'hello there', pad: 'x'.repeat(n - base.length) });
  assert.equal((await app.run(event({ body: at(4096) }), {})).statusCode, 200);
  assert.equal((await app.run(event({ body: at(4097) }), {})).statusCode, 413);
});

test('other methods are 405 and unknown paths are 400, both JSON', async () => {
  const { app, writes } = setup();
  for (const httpMethod of ['GET', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
    const r = await app.run(event({ httpMethod, body: null }), {});
    assert.equal(r.statusCode, 405, httpMethod);
    assert.equal(r.headers.Allow ?? r.headers.allow, 'POST');
    if (httpMethod !== 'HEAD') assert.deepEqual(json(r), { ok: false, error: 'method' });
  }
  for (const path of ['/api/other', '/api/feedback/extra', '/api', '/feedback', '/']) {
    const r = await app.run(event({ path }), {});
    assert.equal(r.statusCode, 400, path);
    assert.match(r.headers['content-type'], /application\/json/);
    assert.deepEqual(json(r), { ok: false, error: 'invalid' });
  }
  assert.equal(writes.length, 0);
});

test('identifiers are redacted before the message is stored', async () => {
  const { app, writes } = setup();
  const message = 'I am jane@example.com, receipt IOE0123456789, A-123456789, ssn 123-45-6789, +1 415 555 0132. Filed 2024-03-15.';
  assert.equal((await app.run(post({ category: 'problem', message }), {})).statusCode, 200);
  assert.equal(writes[0].record.message, 'I am [removed], receipt [removed], [removed], ssn [removed], [removed]. Filed 2024-03-15.');
});

test('the message is trimmed and counted after trimming', async () => {
  const { app, writes } = setup();
  await app.run(post({ category: 'thanks', message: '  thanks!  ' }), {});
  assert.equal(writes[0].record.message, 'thanks!');
});

test('context keeps only an allowlist and is dropped when nothing survives', async () => {
  const { app, writes } = setup();
  await app.run(post({ category: 'other', message: 'hello there', context: { visa: 'H1B', stage: 'gc_waiting_pd', route: '/journey', email: 'a@b.co', extra: 1 } }), {});
  assert.deepEqual(writes[0].record.context, { visa: 'H1B', stage: 'gc_waiting_pd', route: '/journey' });

  await app.run(post({ category: 'other', message: 'hello there', context: { visa: 'O1', stage: 'Has Space', route: '/me?x=1' } }), {});
  assert.equal('context' in writes[1].record, false);

  await app.run(post({ category: 'other', message: 'hello there', context: { visa: 'F1', stage: 'x'.repeat(41), route: '/me' } }), {});
  assert.deepEqual(writes[2].record.context, { visa: 'F1', route: '/me' });

  await app.run(post({ category: 'other', message: 'hello there', context: 'H1B' }), {});
  assert.equal('context' in writes[3].record, false);
});

test('a store failure is 500 server and the message is not logged', async () => {
  const logs = [];
  const { error, log } = console;
  console.error = (...a) => logs.push(a.join(' '));
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const { app } = setup(async () => { throw Object.assign(new Error('AccessDenied for secret text'), { name: 'AccessDenied' }); });
    const r = await app.run(post({ category: 'other', message: 'my private words' }), {});
    assert.equal(r.statusCode, 500);
    assert.deepEqual(json(r), { ok: false, error: 'server' });
    const ok = await createApp({ put: async () => {}, newId: () => ID }).run(post({ category: 'other', message: 'my private words' }), {});
    assert.equal(ok.statusCode, 200);
  } finally {
    console.error = error;
    console.log = log;
  }
  assert.ok(logs.length >= 2);
  assert.doesNotMatch(logs.join('\n'), /private words|secret text/);
  assert.match(logs.join('\n'), new RegExp(ID));
});

test('the known route never answers 403 or 404, whatever is sent', async () => {
  const { app } = setup(async () => { throw new Error('boom'); });
  const events = [
    event(),
    event({ body: '{' }),
    event({ body: null }),
    event({ httpMethod: 'GET' }),
    event({ httpMethod: 'OPTIONS' }),
    event({ headers: {} }),
    event({ headers: null }),
    event({ body: 'x'.repeat(10000) }),
    event({ path: '/api/feedback/' }),
    event({ path: '/api/nope' }),
  ];
  for (const e of events) {
    const r = await app.run(e, {});
    assert.ok(![403, 404].includes(r.statusCode), `${e.httpMethod} ${e.path} gave ${r.statusCode}`);
    assert.match(r.headers['content-type'], /application\/json/);
  }
});
