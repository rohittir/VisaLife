// Evaluates content/checks/*.json rules against a profile. Pure; `today` is injectable for tests.
import { daysUntil, inSeason, sameMonth, h1bSixYearEnd, parseISO, unemploymentRemaining } from './dates.js';
import { ambiguity, status } from './bulletin.js';

function computed(name, profile, today) {
  const d = profile.dates || {};
  const f = profile.flags || {};
  switch (name) {
    case 'kidAge':
      return f.kidBirthYear ? today.getUTCFullYear() - Number(f.kidBirthYear) : null;
    case 'daysToSixYearMax':
      return d.h1bFirstStart ? daysUntil(h1bSixYearEnd(d.h1bFirstStart, d.timeOutsideUsDays), today) : null;
    case 'unemploymentRemaining':
      return ['opt', 'stem_opt'].includes(profile.stage)
        ? unemploymentRemaining(d.unemploymentDaysUsed, profile.stage === 'stem_opt')
        : null;
    default:
      return null;
  }
}

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function matches(when, profile, today, bulletins = []) {
  if (!when) return false;
  if (when.always) return true;
  if (when.all) return when.all.every((w) => matches(w, profile, today, bulletins));
  if (when.any) return when.any.some((w) => matches(w, profile, today, bulletins));
  if (when.not) return !matches(when.not, profile, today, bulletins);
  const d = profile.dates || {};
  if (when.situation) return (profile.situations || []).includes(when.situation);
  if (when.stage) return when.stage.includes(profile.stage);
  if (when.dateSet) return Boolean(d[when.dateSet]);
  if (when.dateUnset) return !d[when.dateUnset];
  if (when.dateWithin) {
    const v = d[when.dateWithin.field];
    if (!v) return false;
    const n = daysUntil(v, today);
    return n >= 0 && n <= when.dateWithin.days;
  }
  if (when.datePast) return Boolean(d[when.datePast]) && daysUntil(d[when.datePast], today) < 0;
  if (when.season) return inSeason(today, when.season.from, when.season.to);
  if (when.field) return get(profile, when.field) === when.eq;
  if (when.computed) {
    const v = computed(when.computed, profile, today);
    if (v == null) return false;
    if ('gte' in when && !(v >= when.gte)) return false;
    if ('lte' in when && !(v <= when.lte)) return false;
    return true;
  }
  // pdCurrent / pdAmbiguous take a chart name, or "uscis" for the chart USCIS accepts for I-485 filing this month.
  if (when.pdCurrent) {
    const s = status(bulletins, d.priorityDate, d.ebCategory);
    return s?.[when.pdCurrent === 'uscis' ? s.chartUsedByUscis : when.pdCurrent] === 'current';
  }
  // `rawDates` is the profile as entered: only a month-only priority date can be ambiguous.
  if (when.pdAmbiguous) {
    const s = status(bulletins, d.priorityDate, d.ebCategory);
    const a = ambiguity(bulletins, profile.rawDates?.priorityDate, d.ebCategory);
    return Boolean(s && a?.[when.pdAmbiguous === 'uscis' ? s.chartUsedByUscis : when.pdAmbiguous]);
  }
  if (when.followUpOf) return profile.checks?.[when.followUpOf]?.answer === 'no';
  return false;
}

function isDone(check, state, today) {
  if (!state || state.answer !== 'yes') return false;
  if (check.repeat === 'monthly') return sameMonth(parseISO(state.at.slice(0, 10)), today);
  return true;
}

const byPriority = (a, b) => (a.priority ?? 5) - (b.priority ?? 5);

export function evaluate(profile, checks, today = new Date(), bulletins = []) {
  const open = [];
  const done = [];
  for (const c of checks) {
    if (c.visas && !c.visas.includes(profile.visa)) continue;
    if (!matches(c.when, profile, today, bulletins)) continue;
    (isDone(c, profile.checks?.[c.id], today) ? done : open).push(c);
  }
  return { open: open.sort(byPriority), done: done.sort(byPriority) };
}

function mentionsSituation(when, s) {
  if (!when) return false;
  if (when.situation === s) return true;
  return [...(when.all || []), ...(when.any || [])].some((w) => mentionsSituation(w, s));
}

// Checks tied to a situation start fresh each time it is switched on (a new entry gets a new I-94 check).
export function resetForSituation(checks, situation, state = {}) {
  const next = { ...state };
  const reset = new Set();
  for (const c of checks) {
    if (c.repeat === 'perTrigger' && mentionsSituation(c.when, situation)) {
      delete next[c.id];
      reset.add(c.id);
    }
  }
  for (const c of checks) if (c.when?.followUpOf && reset.has(c.when.followUpOf)) delete next[c.id];
  return next;
}

// One supporting line for the Home hero: the first sentence of `why`, cut at a word boundary near `max` characters.
export function supportLine(why, max = 90) {
  const first = /^.*?[.!?](?=\s|$)/.exec(why)?.[0] ?? why;
  if (first.length <= max) return first;
  let cut = first.slice(0, first.lastIndexOf(' ', max - 1));
  if (cut.split('(').length > cut.split(')').length) cut = cut.slice(0, cut.lastIndexOf('(')); // never stop inside a bracket
  return `${cut.replace(/[\s,;:]+$/, '')}…`;
}
