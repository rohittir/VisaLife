import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { evaluate, resetForSituation } from './checks.js';

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

test('monthly checks come back each month', () => {
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: { priorityDate: '2014-05-01' }, checks: { 'gc-bulletin-monthly': { answer: 'yes', at: '2026-09-15' } } };
  assert.ok(ids(evaluate(p, checks, today)).includes('gc-bulletin-monthly'));
  p.checks['gc-bulletin-monthly'].at = '2026-10-02';
  assert.ok(!ids(evaluate(p, checks, today)).includes('gc-bulletin-monthly'));
});

test('pdCurrent uses the bulletin cut-off for the profile category', () => {
  const bulletins = [{ month: '2026-09', finalAction: { EB2: 'U', EB3: '2014-01-01' }, datesForFiling: { EB2: '2015-01-15', EB3: '2015-01-15' }, uscisChart: 'finalAction' }];
  const p = { ...h1b, stage: 'gc_waiting_pd', dates: { priorityDate: '2014-05-01', ebCategory: 'EB2' } };
  assert.ok(ids(evaluate(p, checks, today, bulletins)).includes('gc-pd-current-filing'));
  assert.ok(!ids(evaluate(p, checks, today)).includes('gc-pd-current-filing'));
  p.dates = { priorityDate: '2015-01-15', ebCategory: 'EB2' };
  assert.ok(!ids(evaluate(p, checks, today, bulletins)).includes('gc-pd-current-filing'));
});

test('visa filter and F-1 computed unemployment', () => {
  const f1 = { visa: 'F1', stage: 'opt', dates: { unemploymentDaysUsed: 50 }, flags: {}, situations: [], checks: {} };
  const r = ids(evaluate(f1, checks, today));
  assert.ok(r.includes('f1-unemployment'));
  assert.ok(!r.some((id) => id.startsWith('h1b-')));
});
