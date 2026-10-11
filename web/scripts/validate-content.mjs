// Fails the build when a check or journey step is missing what the PRD requires (official sources, a review date),
// when a check has no short headline, when visas.json breaks its date/quick rules, or when a journey points at a
// step or stage that does not exist.
import { readdirSync, readFileSync } from 'node:fs';
import { parseFrontmatter } from '../src/lib/steps.js';
import { validateVisas } from '../src/lib/visas.js';

const dir = new URL('../content/checks/', import.meta.url);
const errors = [];
const seen = new Set();
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const items = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  if (!Array.isArray(items)) errors.push(`${f}: must be an array of checks`);
  for (const c of items) {
    const where = `${f}#${c.id ?? '?'}`;
    for (const k of ['id', 'visas', 'when', 'title', 'short', 'ask', 'why', 'links', 'sources', 'lastReviewed']) {
      if (c[k] == null || (Array.isArray(c[k]) && c[k].length === 0)) errors.push(`${where}: missing ${k}`);
    }
    if (c.short && (c.short.length > 60 || c.short.trim().split(/\s+/).length > 8)) errors.push(`${where}: short must be at most 8 words and 60 characters`);
    if (seen.has(c.id)) errors.push(`${where}: duplicate id`);
    seen.add(c.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.lastReviewed ?? '')) errors.push(`${where}: lastReviewed must be YYYY-MM-DD`);
    for (const u of [...(c.sources ?? []), ...(c.links ?? []).map((l) => l.url)]) {
      if (!/^https:\/\/[^ ]+\.(gov|org|com|in)(\/|$)/.test(u)) errors.push(`${where}: bad url ${u}`);
    }
  }
}

// Step done-state shares profile.checks with check answers, so step ids must not reuse check ids.
const stepDir = new URL('../content/steps/', import.meta.url);
const steps = new Set();
for (const f of readdirSync(stepDir).filter((f) => f.endsWith('.md'))) {
  const where = `steps/${f}`;
  let s;
  try {
    s = parseFrontmatter(readFileSync(new URL(f, stepDir), 'utf8')).data;
  } catch (e) {
    errors.push(`${where}: ${e.message}`);
    continue;
  }
  for (const k of ['id', 'title', 'visas', 'stages', 'sources', 'lastReviewed']) {
    if (s[k] == null || (Array.isArray(s[k]) && s[k].length === 0)) errors.push(`${where}: missing ${k}`);
  }
  if (typeof s.verify !== 'boolean') errors.push(`${where}: verify must be true or false`);
  if (`${s.id}.md` !== f) errors.push(`${where}: id must match the file name`);
  if (seen.has(s.id)) errors.push(`${where}: id duplicates a check id`);
  if (steps.has(s.id)) errors.push(`${where}: duplicate step id`);
  steps.add(s.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.lastReviewed ?? '')) errors.push(`${where}: lastReviewed must be YYYY-MM-DD`);
  for (const u of s.sources ?? []) {
    if (!/^https:\/\/[^ ]+\.(gov|org|com|in)(\/|$)/.test(u)) errors.push(`${where}: bad url ${u}`);
  }
}

const visasJson = JSON.parse(readFileSync(new URL('../content/visas.json', import.meta.url), 'utf8'));
errors.push(...validateVisas(visasJson).map((e) => `visas.json: ${e}`));
const { visas } = visasJson;
const journeyDir = new URL('../content/journeys/', import.meta.url);
for (const f of readdirSync(journeyDir).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(readFileSync(new URL(f, journeyDir), 'utf8'));
  const stageIds = visas[j.visa]?.stages.map((s) => s.id) ?? [];
  if (!stageIds.length) errors.push(`journeys/${f}: unknown visa ${j.visa}`);
  for (const s of j.stages ?? []) if (!stageIds.includes(s.id)) errors.push(`journeys/${f}: unknown stage ${s.id}`);
  for (const id of [...(j.stages ?? []), ...(j.groups ?? [])].flatMap((s) => s.steps)) {
    if (!steps.has(id)) errors.push(`journeys/${f}: missing step ${id}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`content ok: ${seen.size} checks, ${steps.size} steps`);
