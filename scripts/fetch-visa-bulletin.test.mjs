import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, cutoff } from './fetch-visa-bulletin.mjs';

test('parses the India EB rows of a saved July 2026 bulletin', () => {
  const html = readFileSync(new URL('./fixtures/visa-bulletin-july-2026.html', import.meta.url), 'utf8');
  assert.deepEqual(parse(html, 'x'), {
    month: '2026-07',
    finalAction: { EB1: '2022-10-15', EB2: 'U', EB3: '2014-01-01' },
    datesForFiling: { EB1: '2023-12-01', EB2: '2015-01-15', EB3: '2015-01-15' },
    source: 'x',
  });
});

test('cut-off formats', () => {
  assert.equal(cutoff('15JAN15'), '2015-01-15');
  assert.equal(cutoff('C'), 'C');
  assert.throws(() => cutoff('15XYZ15'));
});
