import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { groupBySection, parseFrontmatter, sourceLabel, validateLeavingKeys, visibleSteps } from './steps.js';

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

const step = (id, section, leavingTo) => ({ id, section, ...(leavingTo && { leavingTo }) });
const steps = [step('a', 'Status'), step('b', 'Money'), step('c', 'Moving to India', 'India'), step('d', 'Moving to India', 'India'), step('e', 'Money')];
const idsOf = (list) => list.map((s) => s.id);

test('leaving journey: with no destination only the steps for everyone show; the destination adds or hides its own', () => {
  assert.deepEqual(idsOf(visibleSteps(steps, undefined)), ['a', 'b', 'e']);
  assert.deepEqual(idsOf(visibleSteps(steps, '')), ['a', 'b', 'e']);
  assert.deepEqual(idsOf(visibleSteps(steps, 'India')), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(idsOf(visibleSteps(steps, 'Another country')), ['a', 'b', 'e']);
  // an unknown stored value behaves like an unset one
  assert.deepEqual(idsOf(visibleSteps(steps, 'Mars')), ['a', 'b', 'e']);
});

test('leaving journey: consecutive steps with one section share a heading, and hidden steps do not split a group', () => {
  const groups = (list) => groupBySection(list).map((g) => [g.section, idsOf(g.steps)]);
  assert.deepEqual(groups(visibleSteps(steps, 'India')), [['Status', ['a']], ['Money', ['b']], ['Moving to India', ['c', 'd']], ['Money', ['e']]]);
  assert.deepEqual(groups(visibleSteps(steps, 'Another country')), [['Status', ['a']], ['Money', ['b', 'e']]]);
  assert.deepEqual(groups([]), []);
});

test('step frontmatter: section is a non-empty string and leavingTo is one of the destinations', () => {
  const to = ['India', 'Another country'];
  assert.deepEqual(validateLeavingKeys({}, to), []);
  assert.deepEqual(validateLeavingKeys({ section: 'Taxes in the US', leavingTo: 'India' }, to), []);
  assert.deepEqual(validateLeavingKeys({ leavingTo: 'Another country' }, to), []);
  assert.match(validateLeavingKeys({ leavingTo: 'Canada' }, to)[0], /leavingTo must be one of India, Another country/);
  assert.match(validateLeavingKeys({ section: '' }, to)[0], /section must be a non-empty string/);
  assert.match(validateLeavingKeys({ section: [] }, to)[0], /section must be a non-empty string/); // "section:" with no value parses to []
  // the frontmatter parser keeps a colon inside a value, so "Before you go: money" is one string
  assert.equal(parseFrontmatter('---\nsection: Before you go: money\nleavingTo: Another country\n---\nx').data.section, 'Before you go: money');
});

// The shipped Leaving-the-USA content, read from disk: one shared set of steps, listed identically in every journey.
const stepDir = new URL('../../content/steps/', import.meta.url);
const leavingSteps = Object.fromEntries(
  readdirSync(stepDir)
    .filter((f) => f.startsWith('leaving-'))
    .map((f) => parseFrontmatter(readFileSync(new URL(f, stepDir), 'utf8')))
    .map(({ data, body }) => [data.id, { ...data, body }]),
);
const journey = (visa) => JSON.parse(readFileSync(new URL(`../../content/journeys/${visa}.json`, import.meta.url), 'utf8'));
const leavingIds = (visa) => journey(visa).stages.find((s) => s.id === 'leaving').steps;

test('leaving journey content: every visa lists the same shared steps in the same order, and no step is orphaned', () => {
  const h1b = leavingIds('h1b');
  assert.deepEqual(leavingIds('h4'), h1b);
  assert.deepEqual(leavingIds('f1'), h1b);
  assert.deepEqual([...h1b].sort(), Object.keys(leavingSteps).sort());
  assert.equal(new Set(h1b).size, h1b.length);
  for (const s of Object.values(leavingSteps)) {
    assert.deepEqual([s.visas, s.stages], [['H1B', 'H4', 'F1'], ['leaving']], s.id);
    assert.ok(s.section, `${s.id} has a section`);
    assert.ok(['India', undefined].includes(s.leavingTo), s.id);
    assert.equal(typeof s.verify, 'boolean', s.id);
  }
});

test('leaving journey content: the destination filter and counts on the real steps', () => {
  const all = leavingIds('h1b').map((id) => leavingSteps[id]);
  const india = all.filter((s) => s.leavingTo === 'India');
  assert.ok(india.length >= 8 && india.every((s) => s.section === 'Moving to India'));
  assert.equal(visibleSteps(all, undefined).length, all.length - india.length);
  assert.equal(visibleSteps(all, 'Another country').length, all.length - india.length);
  assert.equal(visibleSteps(all, 'India').length, all.length);
  // "Another country" still gets the finance and tax sections; the India section is a single block at the end.
  const sections = (list) => groupBySection(list).map((g) => g.section);
  assert.deepEqual(sections(visibleSteps(all, 'Another country')), ['Your status when you leave', 'Before you go: money', 'Taxes in the US', 'Your US investments']);
  assert.deepEqual(sections(all), [...sections(visibleSteps(all, 'Another country')), 'Moving to India']);
});

test('leaving journey content: the four standard headings, and a closing line on who to ask', () => {
  for (const s of Object.values(leavingSteps)) {
    const heads = [...s.body.matchAll(/^#### (.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(heads, ['What it is', 'When', 'Forms and fees', 'What to watch for'], s.id);
    const last = s.body.trim().split('\n').pop();
    assert.match(last, /Talk to|lawyer/, `${s.id} ends with who to talk to`);
  }
});
