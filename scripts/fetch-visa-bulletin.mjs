// Prints the India EB-1/2/3 rows of one Visa Bulletin page as data/visa-bulletin/YYYY-MM.json.
// Usage: node scripts/fetch-visa-bulletin.mjs <bulletin URL | saved .html file>
// Add "uscisChart" by hand from https://www.uscis.gov/visabulletininfo (USCIS picks the chart, not State).
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const ROWS = { '1st': 'EB1', '2nd': 'EB2', '3rd': 'EB3' };

const text = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// "01JAN14" → "2014-01-01"; "C" and "U" pass through.
export function cutoff(s) {
  if (s === 'C' || s === 'U') return s;
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(s);
  if (!m || !MONTHS.includes(m[2])) throw new Error(`unexpected cut-off "${s}"`);
  return `${Number(m[3]) > 50 ? '19' : '20'}${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1]}`;
}

// The first table after `heading`, as the INDIA column of the 1st/2nd/3rd rows.
function indiaRows(html, heading) {
  const at = html.search(heading);
  if (at < 0) throw new Error(`section not found: ${heading}`);
  const table = /<table[\s\S]*?<\/table>/i.exec(html.slice(at))[0];
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => text(c[1])),
  );
  const col = rows[0].indexOf('INDIA');
  if (col < 0) throw new Error('INDIA column not found');
  const out = {};
  for (const r of rows) if (ROWS[r[0]]) out[ROWS[r[0]]] = cutoff(r[col]);
  if (Object.keys(out).length !== 3) throw new Error('EB1/EB2/EB3 rows not found');
  return out;
}

export function parse(raw, source) {
  const html = raw.replace(/&nbsp;/g, ' ');
  const [, name, year] = /Visa Bulletin For (\w+) (\d{4})/i.exec(html) ?? [];
  const month = MONTHS.indexOf(name?.slice(0, 3).toUpperCase());
  if (month < 0) throw new Error('bulletin month not found');
  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    finalAction: indiaRows(html, /FINAL ACTION DATES FOR\s+EMPLOYMENT-BASED/i),
    datesForFiling: indiaRows(html, /DATES FOR FILING OF\s+EMPLOYMENT-BASED/i),
    source,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = process.argv[2];
  if (!arg) throw new Error('usage: node scripts/fetch-visa-bulletin.mjs <url|file>');
  let html;
  if (/^https?:/.test(arg)) {
    const res = await fetch(arg);
    // travel.state.gov sits behind a bot check; save the page from a browser and pass the file instead.
    if (!res.ok) throw new Error(`${res.status} fetching ${arg}`);
    html = await res.text();
  } else {
    html = await readFile(arg, 'utf8');
  }
  console.log(JSON.stringify(parse(html, /^https?:/.test(arg) ? arg : undefined), null, 2));
}
