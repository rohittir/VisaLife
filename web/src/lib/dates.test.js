import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as d from './dates.js';

const today = new Date('2026-10-10T00:00:00Z');

test('daysUntil and addDays', () => {
  assert.equal(d.daysUntil('2026-10-20', today), 10);
  assert.equal(d.daysUntil('2026-10-09', today), -1);
  assert.equal(d.addDays('2026-12-31', 1), '2027-01-01');
});

test('six-year clock with recapture', () => {
  assert.equal(d.h1bSixYearEnd('2021-10-01'), '2027-10-01');
  assert.equal(d.h1bSixYearEnd('2021-10-01', 45), '2027-11-15');
});

test('extension window and grace period', () => {
  assert.equal(d.extensionWindowOpens('2027-04-01'), '2026-10-03');
  assert.equal(d.gracePeriodEnd('2026-10-01'), '2026-11-30');
});

test('OPT window and STEM dates', () => {
  assert.deepEqual(d.optWindow('2027-05-15'), { opens: '2027-02-14', closes: '2027-07-14' });
  const s = d.stemDates('2026-07-01');
  assert.equal(s.eval12, '2027-07-01');
  assert.equal(s.final, '2028-07-01');
  assert.equal(s.validations.length, 4);
});

test('unemployment days', () => {
  assert.equal(d.unemploymentRemaining(30), 60);
  assert.equal(d.unemploymentRemaining(100, true), 50);
});

test('season handles year wrap', () => {
  assert.equal(d.inSeason(today, '02-01', '03-31'), false);
  assert.equal(d.inSeason(new Date('2026-03-05T00:00:00Z'), '02-01', '03-31'), true);
  assert.equal(d.inSeason(new Date('2026-01-05T00:00:00Z'), '12-15', '01-15'), true);
});
