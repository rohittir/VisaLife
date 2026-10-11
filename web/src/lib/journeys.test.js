import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, sourceLabel } from './steps.js';

test('frontmatter: strings, booleans, inline and block lists, body split', () => {
  const raw = [
    '---',
    'id: h4-study',
    'title: You can study on H-4',
    'visas: [H4]',
    'stages: [no_ead, ead_eligible]',
    'sources:',
    '  - https://www.uscis.gov/i-539',
    '  - https://www.ecfr.gov/current/title-8/section-214.2#p-214.2(h)(9)(iv)',
    'lastReviewed: 2026-10-10',
    'verify: false',
    '---',
    '#### What it is',
    '',
    'Body: with a colon.',
  ].join('\n');
  const { data, body } = parseFrontmatter(raw);
  assert.deepEqual(data, {
    id: 'h4-study',
    title: 'You can study on H-4',
    visas: ['H4'],
    stages: ['no_ead', 'ead_eligible'],
    sources: ['https://www.uscis.gov/i-539', 'https://www.ecfr.gov/current/title-8/section-214.2#p-214.2(h)(9)(iv)'],
    lastReviewed: '2026-10-10',
    verify: false,
  });
  assert.equal(body, '#### What it is\n\nBody: with a colon.');
});

test('frontmatter: no block means no data; a malformed line throws', () => {
  assert.deepEqual(parseFrontmatter('just text'), { data: {}, body: 'just text' });
  assert.throws(() => parseFrontmatter('---\nid: x\nnot a key value\n---\n'), /bad frontmatter line/);
  assert.equal(parseFrontmatter('---\r\nverify: true\r\n---\r\nhi').data.verify, true);
});

test('source labels: eCFR paragraph links read as citations, others as host/page', () => {
  assert.equal(sourceLabel('https://www.ecfr.gov/on/2026-08-10/title-8/section-214.2#p-214.2(f)(5)(vi)'), '8 CFR 214.2(f)(5)(vi)');
  assert.equal(sourceLabel('https://www.ecfr.gov/current/title-20/section-655.731#p-655.731(c)(7)'), '20 CFR 655.731(c)(7)');
  assert.equal(sourceLabel('https://www.uscis.gov/i-539'), 'uscis.gov/i-539');
  assert.equal(sourceLabel('https://i94.cbp.dhs.gov'), 'i94.cbp.dhs.gov');
  assert.equal(sourceLabel('https://www.ice.gov/doclib/sevis/pdf/Nonimmigrant%20Class%20Who%20Can%20Study.pdf'), 'ice.gov/Nonimmigrant Class Who Can Study.pdf');
});
