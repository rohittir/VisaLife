import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { latest, status, movement, estimate, ambiguity, gap, progress } from './bulletin.js';

const dir = new URL('../../../data/visa-bulletin/', import.meta.url);
const bulletins = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));

test('every bulletin file is well formed', () => {
  const cut = /^(\d{4}-\d{2}-\d{2}|C|U)$/;
  for (const b of bulletins) {
    assert.match(b.month, /^\d{4}-\d{2}$/);
    assert.ok(['finalAction', 'datesForFiling'].includes(b.uscisChart), b.month);
    for (const chart of ['finalAction', 'datesForFiling'])
      for (const c of ['EB1', 'EB2', 'EB3']) assert.match(b[chart][c], cut, `${b.month} ${chart} ${c}`);
    assert.match(b.source, /^https:\/\/travel\.state\.gov\//);
  }
});

test('latest is the newest month', () => {
  assert.equal(latest(bulletins).month, [...bulletins].map((b) => b.month).sort().at(-1));
});

test('current / not current on both charts', () => {
  const two = [
    { month: '2026-01', finalAction: { EB2: '2013-01-01' }, datesForFiling: { EB2: '2013-06-01' }, uscisChart: 'finalAction' },
    { month: '2026-02', finalAction: { EB2: '2013-03-01' }, datesForFiling: { EB2: 'C' }, uscisChart: 'datesForFiling' },
  ];
  assert.deepEqual(status(two, '2013-02-01', 'EB2'), {
    month: '2026-02', finalAction: 'current', datesForFiling: 'current', chartUsedByUscis: 'datesForFiling',
    cutoffs: { finalAction: '2013-03-01', datesForFiling: 'C' },
  });
  // Only dates earlier than the cut-off qualify.
  assert.equal(status(two, '2013-03-01', 'EB2').finalAction, 'not current');
  const u = [{ month: '2026-03', finalAction: { EB2: 'U' }, datesForFiling: { EB2: '2015-01-15' }, uscisChart: 'finalAction' }];
  assert.deepEqual([status(u, '2010-01-01', 'EB2').finalAction, status(u, '2014-05-01', 'EB2').datesForFiling], ['not current', 'current']);
  assert.equal(status(two, null, 'EB2'), null);
  assert.equal(status(two, '2013-02-01', 'EB9'), null);
});

test('movement is the day change of the Final Action cut-off, null across C/U', () => {
  const b = [
    { month: '2026-01', finalAction: { EB3: '2013-08-22' } },
    { month: '2026-03', finalAction: { EB3: 'U' } },
    { month: '2026-02', finalAction: { EB3: '2013-09-22' } },
    { month: '2026-04', finalAction: { EB3: '2013-11-15' } },
  ];
  assert.deepEqual(movement(b, 'EB3'), [31, null, null]);
  assert.deepEqual(movement(b, 'EB3', 1), [null]);
  assert.equal(movement(bulletins, 'EB3').length, Math.min(12, bulletins.length - 1));
});

test('estimate: last 12 months pace, 0 when current, null when not moving forward', () => {
  const mk = (...fa) => fa.map((c, i) => ({ month: `2026-0${i + 1}`, finalAction: { EB2: c }, datesForFiling: { EB2: c } }));
  // 60 days over 2 months (U counts as no movement) = 30 days/month; 360 days to go = 1 year.
  assert.equal(estimate(mk('2013-01-01', '2013-03-02', 'U'), '2014-02-25', 'EB2'), 1);
  assert.equal(estimate(mk('2013-01-01', '2013-03-02'), '2013-01-15', 'EB2'), 0);
  assert.equal(estimate(mk('2013-03-01', '2013-01-01'), '2014-01-01', 'EB2'), null);
  assert.equal(estimate(mk('2013-01-01', '2013-01-01'), '2014-01-01', 'EB2'), null);
  assert.equal(estimate(mk('U', 'U'), '2014-01-01', 'EB2'), null);
  const real = estimate(bulletins, '2014-05-01', 'EB2');
  assert.ok(real > 0 && real < 100, String(real));
});

const sep = [{ month: '2026-09', finalAction: { EB2: 'U', EB3: '2014-01-17' }, datesForFiling: { EB2: '2015-01-15', EB3: '2015-01-01' }, uscisChart: 'finalAction' }];

test('ambiguity: the cut-off month equals the entered month and the day decides', () => {
  assert.deepEqual(ambiguity(sep, '2014-01', 'EB3'), { finalAction: true, datesForFiling: false });
  assert.deepEqual(ambiguity(sep, '2015-01', 'EB2'), { finalAction: false, datesForFiling: true });
  // A cut-off on the 1st leaves no qualifying day: not ambiguous. U and other months are not ambiguous either.
  assert.deepEqual(ambiguity(sep, '2015-01', 'EB3'), { finalAction: false, datesForFiling: false });
  assert.deepEqual(ambiguity(sep, '2014-05', 'EB2'), { finalAction: false, datesForFiling: false });
  // Exact days and missing data are never "ambiguous".
  assert.equal(ambiguity(sep, '2014-01-10', 'EB3'), null);
  assert.equal(ambiguity(sep, undefined, 'EB3'), null);
  assert.equal(ambiguity([], '2014-01', 'EB3'), null);
});

test('ambiguity: the month-end assumption never claims current, an exact day decides', () => {
  assert.equal(status(sep, '2014-01-31', 'EB3').finalAction, 'not current');
  assert.equal(status(sep, '2014-01-10', 'EB3').finalAction, 'current');
});

test('gap in years and months, null when the chart has no date', () => {
  assert.deepEqual(gap(sep, '2015-01-31', 'EB3'), { years: 1, months: 0, behind: true, same: false });
  assert.deepEqual(gap(sep, '2019-05-31', 'EB3'), { years: 5, months: 4, behind: true, same: false });
  assert.deepEqual(gap(sep, '2014-05-31', 'EB2', 'datesForFiling'), { years: 0, months: 8, behind: false, same: false });
  assert.deepEqual(gap(sep, '2014-01-31', 'EB3'), { years: 0, months: 0, behind: false, same: true });
  assert.equal(gap(sep, '2014-05-31', 'EB2'), null);
});

test('progress: share of the way the cut-off came toward your date, 1 once current', () => {
  const mk = (...fa) => fa.map((c, i) => ({ month: `2026-0${i + 1}`, finalAction: { EB2: c }, datesForFiling: { EB2: c } }));
  assert.equal(progress(mk('2013-01-01', '2013-04-01', '2013-07-01'), '2014-01-01', 'EB2'), 181 / 365);
  assert.equal(progress(mk('2013-01-01', 'C'), '2014-01-01', 'EB2'), 1);
  assert.equal(progress(mk('2013-01-01', '2013-04-01'), '2012-01-01', 'EB2'), 1);
  assert.equal(progress(mk('U', 'U'), '2014-01-01', 'EB2'), null);
  const p = progress(bulletins, '2014-05-31', 'EB2');
  assert.ok(p >= 0 && p <= 1, String(p));
});
