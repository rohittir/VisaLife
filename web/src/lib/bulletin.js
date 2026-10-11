// Visa Bulletin helpers over data/visa-bulletin/*.json (India EB rows). Pure: callers pass the bulletins in.
// A cut-off is an ISO date, "C" (current for everyone) or "U" (unavailable to everyone).
import { parseISO } from './dates.js';

const DAY = 86400000;
const isDate = (c) => /^\d{4}-\d{2}-\d{2}$/.test(c ?? '');
const days = (from, to) => Math.round((parseISO(to) - parseISO(from)) / DAY);
const monthsBetween = (a, b) => (b.slice(0, 4) - a.slice(0, 4)) * 12 + (b.slice(5, 7) - a.slice(5, 7));
const byMonth = (bulletins) => [...bulletins].sort((a, b) => a.month.localeCompare(b.month));
// Only priority dates *earlier* than the listed date qualify.
const current = (pd, cut) => (cut === 'C' || (isDate(cut) && pd < cut) ? 'current' : 'not current');

export const latest = (bulletins) => byMonth(bulletins).at(-1);

export function status(bulletins, pd, category) {
  const b = latest(bulletins);
  if (!b || !pd || !b.finalAction[category]) return null;
  const cutoffs = { finalAction: b.finalAction[category], datesForFiling: b.datesForFiling[category] };
  return {
    month: b.month,
    finalAction: current(pd, cutoffs.finalAction),
    datesForFiling: current(pd, cutoffs.datesForFiling),
    chartUsedByUscis: b.uscisChart,
    cutoffs,
  };
}

// Final Action cut-off of the last `count` bulletins, oldest first.
export const history = (bulletins, category, count = 12) =>
  byMonth(bulletins).slice(-count).map((b) => ({ month: b.month, cutoff: b.finalAction[category] }));

// Days the Final Action cut-off moved into each of the last `months` bulletins; null when either side is C or U.
export function movement(bulletins, category, months = 12) {
  const h = history(bulletins, category, months + 1).map((x) => x.cutoff);
  return h.slice(1).map((c, i) => (isDate(c) && isDate(h[i]) ? days(h[i], c) : null));
}

// Years until the Final Action cut-off passes `pd` at the last 12 months' average pace. A crude guide, not a prediction.
// Months spent at "U" count as zero movement; null when there is no forward movement to extrapolate.
export function estimate(bulletins, pd, category) {
  const s = status(bulletins, pd, category);
  if (!s) return null;
  if (s.finalAction === 'current') return 0;
  const h = history(bulletins, category, 13);
  const dated = h.filter((x) => isDate(x.cutoff));
  if (dated.length < 2) return null;
  const [first, last] = [dated[0], dated.at(-1)];
  const pace = days(first.cutoff, last.cutoff) / monthsBetween(first.month, h.at(-1).month);
  if (!(pace > 0)) return null;
  return Math.max(0, days(last.cutoff, pd)) / pace / 12;
}
