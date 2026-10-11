// Anonymous feedback: the form's rules and the one network call. Plain JS so node:test can import it.
export const CATEGORIES = [
  ['suggestion', 'Suggestion'],
  ['problem', 'Something is wrong'],
  ['thanks', 'Thank you'],
  ['other', 'Other'],
];
export const MIN = 3;
export const MAX = 1000;

export function validateFeedback({ category, message }) {
  if (!CATEGORIES.some(([id]) => id === category)) return { ok: false, reason: 'category' };
  const n = (message ?? '').trim().length;
  if (n < MIN) return { ok: false, reason: 'short' };
  if (n > MAX) return { ok: false, reason: 'long' };
  return { ok: true };
}

// Sent only when the person ticked "Include my visa and stage"; the route is the page they were on.
export const feedbackContext = (profile, route) => ({ visa: profile?.visa, stage: profile?.stage, route });

/**
 * Success is only a 200 whose body is exactly { ok: true }, served as JSON. CloudFront maps any 403 or 404 to
 * /index.html with status 200 on every behavior, so an API error can arrive as HTML with status 200: that is a failure.
 * Returns { ok: true } or { ok: false, reason: 'invalid' | 'rate' | 'network' | 'server' }.
 */
export async function submitFeedback(payload, { fetchImpl = globalThis.fetch, url = '/api/feedback', timeoutMs = 10000 } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctl.signal,
    });
    if (res.status === 429) return { ok: false, reason: 'rate' };
    if (res.status === 400) return { ok: false, reason: 'invalid' };
    if (res.status !== 200 || !/application\/json/i.test(res.headers.get('content-type') ?? '')) return { ok: false, reason: 'server' };
    const body = await res.json().catch(() => null); // JSON content type, unparseable body: the server misbehaved
    const exact = body && typeof body === 'object' && Object.keys(body).length === 1 && body.ok === true;
    return exact ? { ok: true } : { ok: false, reason: 'server' };
  } catch {
    // A thrown fetch or an abort on timeout.
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
