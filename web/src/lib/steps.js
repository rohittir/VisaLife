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

// Short link text for a source URL: "8 CFR 214.2(f)(6)" for eCFR paragraph links (title from the path), else host/last-path-segment.
export function sourceLabel(url) {
  const { hostname, pathname, hash } = new URL(url);
  if (hash.startsWith('#p-')) return `${/title-(\d+)/.exec(pathname)?.[1] ?? 8} CFR ${decodeURIComponent(hash.slice(3))}`;
  const last = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
  return [hostname.replace(/^www\./, ''), last].filter(Boolean).join('/');
}
