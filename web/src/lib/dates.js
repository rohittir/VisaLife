// All date math in one place. Dates are ISO strings (YYYY-MM-DD, or YYYY-MM for month-only profile values); `today` is a Date.
const DAY = 86400000;

export const parseISO = (s) => new Date(`${s}T00:00:00Z`);
export const toISO = (d) => d.toISOString().slice(0, 10);
const startOfDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const addDays = (iso, n) => toISO(new Date(parseISO(iso).getTime() + n * DAY));
export function addMonths(iso, n) {
  const d = parseISO(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toISO(d);
}
export const daysUntil = (iso, today = new Date()) => Math.floor((parseISO(iso) - startOfDay(today)) / DAY);
export const sameMonth = (a, b) => a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
export function inSeason(today, from, to) {
  const md = toISO(startOfDay(today)).slice(5);
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}
export const isMonth = (v) => /^\d{4}-\d{2}$/.test(v ?? '');
export const monthEnd = (ym) => toISO(new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)));
// What a month-and-year picker offers once we know whether a date has passed or is still ahead of `today`.
// timingOf: "past" or "ahead" for an entered value (this month counts as ahead), null when empty.
export const timingOf = (value, today = new Date()) =>
  value ? (value.slice(0, 7) < toISO(today).slice(0, 7) ? 'past' : 'ahead') : null;
// Years nearest to today first: this year and `back` years before it, or this year and nine after it.
export const yearChoices = (when, today = new Date(), back = 10) => {
  const y = today.getUTCFullYear();
  return when === 'past' ? Array.from({ length: back + 1 }, (_, i) => y - i) : Array.from({ length: 10 }, (_, i) => y + i);
};
// All twelve months, except that in this year a past date cannot be after this month nor a future one before it.
export const monthChoices = (when, year, today = new Date()) => {
  const all = Array.from({ length: 12 }, (_, i) => i + 1);
  if (Number(year) !== today.getUTCFullYear()) return all;
  const cur = today.getUTCMonth() + 1;
  return all.filter((n) => (when === 'past' ? n <= cur : n >= cur));
};
// "This month", "Next month", "5 months" for a month-only date: a day count would claim precision we do not have.
export function monthsLabel(ym, today = new Date()) {
  const n = (+ym.slice(0, 4) - today.getUTCFullYear()) * 12 + (+ym.slice(5, 7) - (today.getUTCMonth() + 1));
  return n <= 0 ? 'This month' : n === 1 ? 'Next month' : `${n} months`;
}
// "May 2014" for YYYY-MM, "14 May 2014" style for a full date.
export const formatDate = (iso) =>
  isMonth(iso)
    ? parseISO(`${iso}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : parseISO(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// Profile dates -> full ISO dates for checks, bulletin and countdowns. `fields` is visas.json's `fields`: a month-only
// value (YYYY-MM) becomes the 1st or the last day of its month by the field's `assume`, always the conservative side.
// optStart / stemOptStart are not asked: they follow from the end date (OPT 12 months, STEM OPT 24 months).
export function resolveDates(dates = {}, fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(dates)) {
    if (!v) continue;
    out[k] = isMonth(v) ? (fields[k]?.assume === 'end' ? monthEnd(v) : `${v}-01`) : v;
  }
  delete out.optStart;
  delete out.stemOptStart;
  if (out.optEnd) out.optStart = addMonths(addDays(out.optEnd, 1), -12);
  if (out.stemOptEnd) out.stemOptStart = addMonths(addDays(out.stemOptEnd, 1), -24);
  return out;
}

// H-1B: six years of H-1B time; full days spent outside the US can be recaptured (8 CFR 214.2(h)(13)(iii)(C)).
export const h1bSixYearEnd = (firstStart, outsideDays = 0) => addDays(addMonths(firstStart, 72), Number(outsideDays) || 0);
// An extension may be filed up to six months before the current petition expires.
export const extensionWindowOpens = (i797Expiry) => addDays(i797Expiry, -180);
// 60-day grace after H-1B employment ends (8 CFR 214.1(l)(2)) and after an F-1 program or OPT ends.
export const gracePeriodEnd = (lastDay, days = 60) => addDays(lastDay, days);
// Post-completion OPT: file I-765 from 90 days before to 60 days after the program end date (8 CFR 214.2(f)(11)).
export const optWindow = (programEnd) => ({ opens: addDays(programEnd, -90), closes: addDays(programEnd, 60) });
// STEM OPT: 24 months; evaluations at 12 months and at the end; validation reports every 6 months.
export const stemDates = (stemStart) => ({
  eval12: addMonths(stemStart, 12),
  final: addMonths(stemStart, 24),
  validations: [6, 12, 18, 24].map((m) => addMonths(stemStart, m)),
});
// 90 unemployment days on OPT, 150 in total once on STEM OPT.
export const unemploymentRemaining = (used, stem = false) => (stem ? 150 : 90) - (Number(used) || 0);
