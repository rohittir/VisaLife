// All date math in one place. Dates are ISO strings (YYYY-MM-DD); `today` is a Date.
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
export const formatDate = (iso) =>
  parseISO(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

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
