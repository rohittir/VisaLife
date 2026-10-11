// Fails the build when a check is missing what the PRD requires: a question, an official link, sources and a review date.
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../content/checks/', import.meta.url);
const errors = [];
const seen = new Set();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const items = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  if (!Array.isArray(items)) errors.push(`${f}: must be an array of checks`);
  for (const c of items) {
    const where = `${f}#${c.id ?? '?'}`;
    for (const k of ['id', 'visas', 'when', 'title', 'ask', 'why', 'links', 'sources', 'lastReviewed']) {
      if (c[k] == null || (Array.isArray(c[k]) && c[k].length === 0)) errors.push(`${where}: missing ${k}`);
    }
    if (seen.has(c.id)) errors.push(`${where}: duplicate id`);
    seen.add(c.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.lastReviewed ?? '')) errors.push(`${where}: lastReviewed must be YYYY-MM-DD`);
    for (const u of [...(c.sources ?? []), ...(c.links ?? []).map((l) => l.url)]) {
      if (!/^https:\/\/[^ ]+\.(gov|org|com|in)(\/|$)/.test(u)) errors.push(`${where}: bad url ${u}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`content ok: ${seen.size} checks`);
