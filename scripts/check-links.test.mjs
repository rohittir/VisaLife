import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractUrls, classify } from './check-links.mjs';

test('extracts urls from frontmatter, markdown links and prose, without trailing punctuation or fragments', () => {
  const text = [
    'sources:',
    '  - https://www.uscis.gov/i-129',
    '  - https://www.ecfr.gov/current/title-8/section-214.2#p-214.2(h)(9)(iv)',
    'See [the form](https://www.uscis.gov/i-539). Also https://travel.state.gov/x.html, and **https://sevp.ice.gov/opt/**',
    'again https://www.uscis.gov/i-129',
  ].join('\n');
  assert.deepEqual(extractUrls(text), [
    'https://www.uscis.gov/i-129',
    'https://www.ecfr.gov/current/title-8/section-214.2',
    'https://www.uscis.gov/i-539',
    'https://travel.state.gov/x.html',
    'https://sevp.ice.gov/opt/',
  ]);
});

test('only 404 and 410 count as dead; bot blocks and server errors do not', () => {
  assert.deepEqual([200, 301, 404, 410, 403, 429, 503].map((s) => classify(s)), ['ok', 'blocked', 'dead', 'dead', 'blocked', 'blocked', 'blocked']);
});
