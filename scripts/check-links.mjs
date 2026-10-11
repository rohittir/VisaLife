// Requests every https URL used by the app's content and data, once, and reports the dead ones.
// Usage: node scripts/check-links.mjs [--json]. Exit 1 when a URL is dead (404, 410 or unresolvable).
// shortcut: no anchor checks; a 429 is retried with backoff, other bot blocks (403, 5xx) are listed for a manual look.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const DIRS = ['web/content/checks', 'web/content/steps', 'web/content/journeys', 'data/visa-bulletin'];
const URL_RE = /https?:\/\/[^\s)"'<>\]]+/g;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

export const extractUrls = (text) => [
  ...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:*_]+$/, '').split('#')[0])),
];

export function classify(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 404 || status === 410) return 'dead';
  return 'blocked';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function check(url) {
  try {
    let res;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, {
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*' },
        signal: AbortSignal.timeout(20000),
      });
      await res.body?.cancel();
      if (res.status !== 429) break;
      await sleep((Number(res.headers.get('retry-after')) || 3) * 1000 * (attempt + 1));
    }
    const moved = new URL(res.url).pathname !== new URL(url).pathname ? res.url : null;
    return { url, status: res.status, kind: classify(res.status), moved };
  } catch (e) {
    const dns = e.cause?.code === 'ENOTFOUND';
    return { url, status: 0, kind: dns ? 'dead' : 'blocked', note: e.cause?.code ?? e.name };
  }
}

async function main() {
  const where = new Map();
  for (const dir of DIRS) {
    const base = new URL(`${dir}/`, root);
    for (const f of readdirSync(base)) {
      for (const u of extractUrls(readFileSync(new URL(f, base), 'utf8'))) {
        where.set(u, [...(where.get(u) ?? []), `${dir}/${f}`]);
      }
    }
  }
  const urls = [...where.keys()];
  const results = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < urls.length) results.push(await check(urls[next++]));
    }),
  );
  results.sort((a, b) => a.url.localeCompare(b.url));
  if (process.argv.includes('--json')) console.log(JSON.stringify(results.map((r) => ({ ...r, files: where.get(r.url) })), null, 2));
  else {
    const show = (title, rows, fmt) => rows.length && console.log(`\n${title} (${rows.length})\n${rows.map(fmt).join('\n')}`);
    show('DEAD', results.filter((r) => r.kind === 'dead'), (r) => `  ${r.status || r.note}  ${r.url}\n        in ${where.get(r.url).slice(0, 3).join(', ')}`);
    show('NEEDS A MANUAL LOOK (blocked to scripts or flaky)', results.filter((r) => r.kind === 'blocked'), (r) => `  ${r.status || r.note}  ${r.url}`);
    show('REDIRECTED (works, consider updating)', results.filter((r) => r.moved), (r) => `  ${r.url}\n        -> ${r.moved}`);
    console.log(`\nchecked ${results.length} urls: ${results.filter((r) => r.kind === 'ok').length} ok, ${results.filter((r) => r.kind === 'dead').length} dead, ${results.filter((r) => r.kind === 'blocked').length} blocked`);
  }
  process.exitCode = results.some((r) => r.kind === 'dead') ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
