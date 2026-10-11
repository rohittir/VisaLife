// Pure helpers for journey steps (content/steps/*.md). Shared by the app and scripts/validate-content.mjs.

// Splits "---\nkey: value\n---\nbody". Supports the subset step files use: strings, true/false,
// inline lists ([a, b]) and block lists ("  - item"). Unknown lines throw so typos fail the build.
export function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { data: {}, body: raw };
  const data = {};
  let key;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s+(.+)$/.exec(line);
    const kv = /^(\w+):\s*(.*)$/.exec(line);
    if (item && Array.isArray(data[key])) data[key].push(item[1].trim());
    else if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (v === '') data[key] = [];
      else if (v === 'true' || v === 'false') data[key] = v === 'true';
      else if (/^\[.*\]$/.test(v)) data[key] = v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      else data[key] = v;
    } else if (line.trim()) throw new Error(`bad frontmatter line: ${line}`);
  }
  return { data, body: raw.slice(m[0].length) };
}

// Rules for the two optional Leaving-the-USA keys of a step's frontmatter; `destinations` is visas.json's leavingTo options.
export function validateLeavingKeys(s, destinations) {
  const errors = [];
  if ('section' in s && !(typeof s.section === 'string' && s.section.trim())) errors.push('section must be a non-empty string');
  if ('leavingTo' in s && !destinations.includes(s.leavingTo)) errors.push(`leavingTo must be one of ${destinations.join(', ')}`);
  return errors;
}

// The Leaving-the-USA journey: a step with a `leavingTo` ("India" or "Another country") shows only for that destination
// (profile.dates.leavingTo); steps without one always show, and with the destination unset only those show.
export const visibleSteps = (steps, leavingTo) => steps.filter((s) => !s.leavingTo || s.leavingTo === leavingTo);

// Consecutive steps with the same `section` frontmatter form one group, in order: [{ section, steps }].
export function groupBySection(steps) {
  const groups = [];
  for (const s of steps) {
    const last = groups[groups.length - 1];
    if (last && last.section === s.section) last.steps.push(s);
    else groups.push({ section: s.section, steps: [s] });
  }
  return groups;
}

// Short link text for a source URL: "8 CFR 214.2(f)(6)" for eCFR paragraph links (title from the path), else host/last-path-segment.
export function sourceLabel(url) {
  const { hostname, pathname, hash } = new URL(url);
  if (hash.startsWith('#p-')) return `${/title-(\d+)/.exec(pathname)?.[1] ?? 8} CFR ${decodeURIComponent(hash.slice(3))}`;
  const last = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
  return [hostname.replace(/^www\./, ''), last].filter(Boolean).join('/');
}
