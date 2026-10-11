import { randomUUID } from 'node:crypto';
import createAPI from 'lambda-api';
import { redact } from './redact.js';

// POST /api/feedback: anonymous, write-only. The only place a message is read is here, once, on its way to S3.
// Never answer 403 or 404 for the known route: CloudFront turns both into index.html with status 200 (see docs/TDD.md B1).
const CATEGORIES = ['suggestion', 'problem', 'thanks', 'other'];
const VISAS = ['H1B', 'H4', 'F1'];
const ROUTES = ['/home', '/journey', '/policy', '/me'];
const PATH = '/api/feedback';
const MAX_BODY = 4096;

export const putInput = (bucket, key, record) => ({
  Bucket: bucket,
  Key: key,
  Body: JSON.stringify(record),
  ContentType: 'application/json',
  ServerSideEncryption: 'AES256',
});

let s3;
// The client is imported on first use: the Lambda runtime provides it, and tests never load it.
async function putS3(key, record) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  s3 ??= new S3Client({});
  await s3.send(new PutObjectCommand(putInput(process.env.BUCKET, key, record)));
}

const context = (c) => {
  if (!c || typeof c !== 'object') return undefined;
  const out = {};
  if (VISAS.includes(c.visa)) out.visa = c.visa;
  if (typeof c.stage === 'string' && /^[a-z0-9_]{1,40}$/.test(c.stage)) out.stage = c.stage;
  if (ROUTES.includes(c.route)) out.route = c.route;
  return Object.keys(out).length ? out : undefined;
};

export function createApp({ put = putS3, now = () => new Date(), newId = () => randomUUID() } = {}) {
  const api = createAPI();
  const fail = (res, status, error) => res.status(status).json({ ok: false, error });

  api.use((req, res, next) => {
    res.header('Cache-Control', 'no-store');
    next();
  });

  api.post(PATH, async (req, res) => {
    const raw = req.rawBody ?? '';
    const bytes = req.isBase64Encoded ? Buffer.from(raw, 'base64').length : Buffer.byteLength(raw);
    if (bytes > MAX_BODY) return fail(res, 413, 'too_large');
    // A cross-site form can only send simple content types, so requiring JSON keeps other pages from posting for a visitor.
    const type = req.headers['content-type'];
    const b = req.body;
    if ((type && !/application\/json/i.test(type)) || !b || typeof b !== 'object' || Array.isArray(b)) return fail(res, 400, 'invalid');

    // A bot filled the hidden field: look successful, store nothing.
    if (b.honeypot != null && String(b.honeypot).trim() !== '') return res.json({ ok: true });

    const message = typeof b.message === 'string' ? b.message.trim() : '';
    if (!CATEGORIES.includes(b.category) || message.length < 3 || message.length > 1000) return fail(res, 400, 'invalid');

    const at = now();
    const id = newId();
    const record = { v: 1, id, at: at.toISOString(), category: b.category, message: redact(message) };
    const ctx = context(b.context);
    if (ctx) record.context = ctx;
    const day = record.at.slice(0, 10).replaceAll('-', '/');
    try {
      await put(`feedback/${day}/${id}.json`, record);
    } catch (e) {
      console.error(JSON.stringify({ msg: 'feedback_store_failed', id, error: e?.name }));
      return fail(res, 500, 'server');
    }
    console.log(JSON.stringify({ msg: 'feedback_stored', id, length: message.length })); // never the text
    return res.json({ ok: true });
  });

  // Unknown paths and wrong methods are answered here as JSON, never as lambda-api's default 404.
  api.use((err, req, res, next) => {
    if (err.name === 'MethodError' && err.path === PATH) return res.header('Allow', 'POST').status(405).json({ ok: false, error: 'method' });
    if (err.name === 'RouteError' || err.name === 'MethodError') return fail(res, 400, 'invalid');
    console.error(JSON.stringify({ msg: 'feedback_unhandled', error: err?.name }));
    return fail(res, 500, 'server');
  });

  return api;
}

const app = createApp();
export const handler = (event, context) => app.run(event, context);
