import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { evaluate, resetForSituation, supportLine } from './checks.js';
import { resolveDates } from './dates.js';

const dir = new URL('../../content/checks/', import.meta.url);
const checks = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const today = new Date('2026-10-10T00:00:00Z');
const ids = (r) => r.open.map((c) => c.id);

const h1b = { visa: 'H1B', stage: 'working', dates: {}, flags: {}, situations: [], checks: {} };

test('entering the US surfaces the I-94 check; answering no reveals the follow-up', () => {
  const p = { ...h1b, situations: ['ENTERED_US'] };
  assert.ok(ids(evaluate(p, checks, today)).includes('common-i94-after-entry'));
  assert.ok(!ids(evaluate(p, checks, today)).includes('common-i94-fix'));
  p.checks = { 'common-i94-after-entry': { answer: 'no', at: '2026-10-10' } };
  assert.ok(ids(evaluate(p, checks, today)).includes('common-i94-fix'));
});

test('yes hides a check; toggling the situation again resets perTrigger checks and follow-ups', () => {
  const p = {
    ...h1b,
    situations: ['ENTERED_US'],
    checks: { 'common-i94-after-entry': { answer: 'yes', at: '2026-10-01' }, 'common-i94-fix': { answer: 'yes', at: '2026-10-01' } },
  };
  assert.ok(!ids(evaluate(p, checks, today)).includes('common-i94-after-entry'));
  const reset = resetForSituation(checks, 'ENTERED_US', p.checks);
  assert.deepEqual(reset, {});
});

test('date windows: extension within 180 days, expired I-797, six-year clock', () => {
  const r1 = evaluate({ ...h1b, dates: { i797Expiry: '2027-03-01' } }, checks, today);
  assert.ok(ids(r1).includes('h1b-extension-window'));
  const r2 = evaluate({ ...h1b, dates: { i797Expiry: '2026-10-01' } }, checks, today);
  assert.ok(ids(r2).includes('h1b-240-day'));
  const r3 = evaluate({ ...h1b, dates: { h1bFirstStart: '2021-01-01' } }, checks, today);
  assert.ok(ids(r3).includes('h1b-six-year-clock'));
});

test('month-only expiry dates never claim a date has passed or a window has opened early', () => {
  const resolved = (dates) => ({ ...h1b, dates: resolveDates(dates, fields) });
  // Entered "October 2026" on 10 Oct: the I-797 may still be valid until 31 Oct, so no "date has passed".
  assert.ok(!ids(evaluate(resolved({ i797Expiry: '2026-10' }), checks, today)).includes('h1b-240-day'));
  assert.ok(ids(evaluate(resolved({ i797Expiry: '2026-09' }), checks, today)).includes('h1b-240-day'));
  // "April 2027" ends 30 Apr, 202 days away: the six-month filing window is not open yet, "March 2027" (172 days) is.
  assert.ok(!ids(evaluate(resolved({ i797Expiry: '2027-04' }), checks, today)).includes('h1b-extension-window'));
  assert.ok(ids(evaluate(resolved({ i797Expiry: '2027-03' }), checks, today)).includes('h1b-extension-window'));
});

test('the PERM date question is not asked of EB-1, which has no PERM', () => {
  const p = { ...h1b, stage: 'gc_perm_i140', dates: {} };
  assert.ok(ids(evaluate(p, checks, today)).includes('gc-perm-priority-date'));
  assert.ok(ids(evaluate({ ...p, dates: { ebCategory: 'EB2' } }, checks, today)).includes('gc-perm-priority-date'));
  assert.ok(!ids(evaluate({ ...p, dates: { ebCategory: 'EB1' } }, checks, today)).includes('gc-perm-priority-date'));
});

test('monthly checks come back each month', () => {
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: { priorityDate: '2014-05-01' }, checks: { 'gc-bulletin-monthly': { answer: 'yes', at: '2026-09-15' } } };
  assert.ok(ids(evaluate(p, checks, today)).includes('gc-bulletin-monthly'));
  p.checks['gc-bulletin-monthly'].at = '2026-10-02';
  assert.ok(!ids(evaluate(p, checks, today)).includes('gc-bulletin-monthly'));
});

test('the filing check follows the chart USCIS accepts, for the profile category', () => {
  const bulletin = (uscisChart) => [{ month: '2026-09', finalAction: { EB2: 'U', EB3: '2014-01-01' }, datesForFiling: { EB2: '2015-01-15', EB3: '2015-01-15' }, uscisChart }];
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: { priorityDate: '2014-05-01', ebCategory: 'EB2' } };
  assert.ok(ids(evaluate(p, checks, today, bulletin('datesForFiling'))).includes('gc-pd-current-filing'));
  // Dates for Filing is current, but USCIS is on Final Action (unavailable): not current for filing.
  assert.ok(!ids(evaluate(p, checks, today, bulletin('finalAction'))).includes('gc-pd-current-filing'));
  assert.ok(!ids(evaluate(p, checks, today)).includes('gc-pd-current-filing'));
  p.dates = { priorityDate: '2015-01-15', ebCategory: 'EB2' };
  assert.ok(!ids(evaluate(p, checks, today, bulletin('datesForFiling'))).includes('gc-pd-current-filing'));
});

test('visa filter and F-1 computed unemployment', () => {
  const f1 = { visa: 'F1', stage: 'opt', dates: { unemploymentDaysUsed: 50 }, flags: {}, situations: [], checks: {} };
  const r = ids(evaluate(f1, checks, today));
  assert.ok(r.includes('f1-unemployment'));
  assert.ok(!r.some((id) => id.startsWith('h1b-')));
});

const fields = JSON.parse(readFileSync(new URL('../../content/visas.json', import.meta.url), 'utf8')).fields;
const bulletin = (fa, dff, chart = 'datesForFiling') => [{ month: '2026-09', finalAction: { EB2: fa }, datesForFiling: { EB2: dff }, uscisChart: chart }];

test('month-only dates evaluate through resolveDates: passport 2027-06 and priority date 2014-05', () => {
  const raw = { passportExpiry: '2027-06', priorityDate: '2014-05', ebCategory: 'EB2' };
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: resolveDates(raw, fields), rawDates: raw };
  const r = ids(evaluate(p, checks, today, bulletin('U', '2015-01-15')));
  // 2027-06-01 is 234 days away from 2026-10-10, inside the 365-day passport window.
  assert.ok(r.includes('common-passport-expiring'));
  // PD 2014-05-31 is before the 2015-01-15 Dates for Filing cut-off, so the filing check shows; no day is ambiguous.
  assert.ok(r.includes('gc-pd-current-filing'));
  assert.ok(!r.includes('gc-pd-exact-day'));
  const later = { ...p, dates: resolveDates({ ...raw, passportExpiry: '2028-06' }, fields) };
  assert.ok(!ids(evaluate(later, checks, today, bulletin('U', '2015-01-15'))).includes('common-passport-expiring'));
});

test('priority date in the cut-off month: the exact-day check replaces the current/not-current claim', () => {
  const raw = { priorityDate: '2015-01', ebCategory: 'EB2' };
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: resolveDates(raw, fields), rawDates: raw };
  const b = bulletin('U', '2015-01-15');
  const r = ids(evaluate(p, checks, today, b));
  assert.ok(r.includes('gc-pd-exact-day'));
  assert.ok(!r.includes('gc-pd-current-filing')); // month end is not before the 15th: never over-claims
  // Once the exact day is added the ambiguity is gone and the answer is definite.
  const exact = { ...raw, priorityDate: '2015-01-10' };
  const q = { ...p, dates: resolveDates(exact, fields), rawDates: exact };
  const r2 = ids(evaluate(q, checks, today, b));
  assert.ok(!r2.includes('gc-pd-exact-day'));
  assert.ok(r2.includes('gc-pd-current-filing'));
});

test('supportLine: first sentence, trimmed at a word boundary', () => {
  assert.equal(supportLine('The I-94 controls how long you may stay. Officers sometimes cut it.'), 'The I-94 controls how long you may stay.');
  const long = 'Errors on the notice are easier to fix early, and you will need the copy for every future extension and to carry the date.';
  const s = supportLine(long);
  assert.ok(s.length <= 91 && s.endsWith('…') && !s.includes('  '), s);
  assert.equal(supportLine('No full stop here'), 'No full stop here');
  const bracket = 'Unreported employment counts as unemployment, and 90 days of unemployment on OPT (150 with STEM) ends your status.';
  assert.equal(supportLine(bracket), 'Unreported employment counts as unemployment, and 90 days of unemployment on OPT…');
});

test('the exact-day check is about the chart USCIS accepts', () => {
  const raw = { priorityDate: '2015-01', ebCategory: 'EB2' };
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: resolveDates(raw, fields), rawDates: raw };
  // Cut-off day in the entered month on Dates for Filing, but USCIS is on Final Action (U): nothing to decide.
  assert.ok(!ids(evaluate(p, checks, today, bulletin('U', '2015-01-15', 'finalAction'))).includes('gc-pd-exact-day'));
  assert.ok(ids(evaluate(p, checks, today, bulletin('2015-01-15', 'U', 'finalAction'))).includes('gc-pd-exact-day'));
});

test('an I-797 marked "Already passed" fires the 240-day check; a passed I-94 stays quiet', () => {
  const resolved = (dates, p = h1b) => ({ ...p, dates: resolveDates(dates, fields, today) });
  assert.ok(ids(evaluate(resolved({ i797Expiry: 'passed' }), checks, today)).includes('h1b-240-day'));
  const quiet = ids(evaluate(resolved({ i94Expiry: 'passed' }), checks, today));
  assert.ok(!quiet.includes('h1b-240-day') && !quiet.includes('h1b-extension-window'));
  // a passed program end fires the late-OPT check for an enrolled F-1 student
  const f1 = { visa: 'F1', stage: 'enrolled', flags: {}, situations: [], checks: {} };
  assert.ok(ids(evaluate(resolved({ programEnd: 'passed' }, f1), checks, today)).includes('f1-opt-window-late'));
});
