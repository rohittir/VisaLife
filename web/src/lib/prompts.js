import { matches } from './checks.js';
import { resolveDates } from './dates.js';

// The field Today asks for next: the first of the stage's fields that has a reason to ask (`unlock`), is empty, was not
// skipped, and whose `skipWhen` (a check condition, see `matches` in checks.js) does not already hold. A date answered
// "Already passed" counts as answered. `fields` is visas.json's `fields`, passed in so tests need no import.meta.glob.
export function nextPrompt(stage, profile, fields, today = new Date()) {
  if (!stage) return undefined;
  // Conditions see full dates and the stage id, exactly as the checks do.
  const seen = { ...profile, stage: stage.id, dates: resolveDates(profile.dates, fields, today) };
  return stage.fields.find((k) => {
    const f = fields[k];
    return f.unlock && !profile.dates[k] && !profile.dismissed?.includes(k) && !(f.skipWhen && matches(f.skipWhen, seen, today));
  });
}
