import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const fields = JSON.parse(readFileSync(new URL('../../content/visas.json', import.meta.url), 'utf8')).fields;

test('month-only values resolve to the conservative end of their month, full dates pass through', () => {
  const r = d.resolveDates(
    { passportExpiry: '2027-06', priorityDate: '2014-05', i140ApprovedOn: '2024-02', h1bFirstStart: '2021-10', travelSignatureDate: '2026-03', i94Expiry: '2027-03-05', priorityDate2: '', unknown: '2020-01' },
    fields,
  );
  assert.equal(r.passportExpiry, '2027-06-01'); // start: warn earlier
  assert.equal(r.h1bFirstStart, '2021-10-01'); // start: six-year end comes earlier
  assert.equal(r.travelSignatureDate, '2026-03-01');
  assert.equal(r.priorityDate, '2014-05-31'); // end: never claim current
  assert.equal(r.i140ApprovedOn, '2024-02-29'); // end, leap year
  assert.equal(r.i94Expiry, '2027-03-05');
  assert.equal(d.resolveDates({ i94Expiry: '2027-03', i797Expiry: '2028-02', eadExpiry: '2026-12' }, fields).i797Expiry, '2028-02-29'); // end: not passed, window not early
  assert.equal(d.resolveDates({ i94Expiry: '2027-03' }, fields).i94Expiry, '2027-03-31');
  assert.equal(r.unknown, '2020-01-01'); // not in visas.json: treated as start
  assert.ok(!('priorityDate2' in r));
  assert.equal(d.resolveDates({ priorityDate: '2014-05-12' }, fields).priorityDate, '2014-05-12');
});

test('every month field declares assume and the choice is the conservative side', () => {
  const month = Object.entries(fields).filter(([, f]) => f.precision === 'month');
  assert.deepEqual(
    month.map(([k]) => k).sort(),
    ['apExpiry', 'eadExpiry', 'h1bFirstStart', 'i140ApprovedOn', 'i485FiledOn', 'i797Expiry', 'i94Expiry', 'optEnd', 'passportExpiry', 'priorityDate', 'primaryI140ApprovedOn', 'programEnd', 'stemOptEnd', 'travelSignatureDate', 'visaStampExpiry'].sort(),
  );
  const start = month.filter(([, f]) => f.assume === 'start').map(([k]) => k).sort();
  assert.deepEqual(start, ['h1bFirstStart', 'passportExpiry', 'travelSignatureDate', 'visaStampExpiry']);
});

test('OPT and STEM start are derived from the end date, never read from the profile', () => {
  const r = d.resolveDates({ optEnd: '2026-05-31', stemOptEnd: '2028-02-29', optStart: '1999-01-01', stemOptStart: '1999-01-01' }, fields);
  assert.equal(r.optStart, '2025-06-01');
  assert.equal(r.stemOptStart, '2026-03-01');
  assert.equal(d.stemDates(r.stemOptStart).final, '2028-03-01');
  assert.ok(!('optStart' in d.resolveDates({ stemOptEnd: '2028-02-29' }, fields)));
});

test('month values format as "May 2014"', () => {
  assert.equal(d.formatDate('2014-05'), 'May 2014');
  assert.equal(d.formatDate('2014-05-12'), 'May 12, 2014');
  assert.ok(d.isMonth('2014-05') && !d.isMonth('2014-05-12') && !d.isMonth(undefined));
});

test('passed or ahead narrows the pickers', () => {
  const t = new Date('2026-10-10T00:00:00Z');
  assert.equal(d.timingOf('2026-09', t), 'past');
  assert.equal(d.timingOf('2026-10', t), 'ahead'); // this month: the day decides, so it is not "passed"
  assert.equal(d.timingOf('2027-01-15', t), 'ahead');
  assert.equal(d.timingOf('', t), null);
  assert.deepEqual(d.yearChoices('ahead', t).slice(0, 3), [2026, 2027, 2028]);
  assert.equal(d.yearChoices('ahead', t).length, 10);
  assert.deepEqual(d.yearChoices('past', t, 2), [2026, 2025, 2024]);
  assert.deepEqual(d.monthChoices('ahead', 2026, t), [10, 11, 12]);
  assert.deepEqual(d.monthChoices('past', 2026, t), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(d.monthChoices('ahead', 2027, t).length, 12);
  assert.equal(d.monthChoices('past', 2025, t).length, 12);
});

test('month-only deadlines read as months, not days', () => {
  const t = new Date('2026-10-10T00:00:00Z');
  assert.equal(d.monthsLabel('2026-10', t), 'This month');
  assert.equal(d.monthsLabel('2026-11', t), 'Next month');
  assert.equal(d.monthsLabel('2027-03', t), '5 months');
  assert.equal(d.monthsLabel('2028-01', t), '15 months');
});
