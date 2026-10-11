import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GROUPS, validateVisas } from './visas.js';

const data = JSON.parse(readFileSync(new URL('../../content/visas.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(data);

test('visas.json is valid', () => {
  assert.deepEqual(validateVisas(data), []);
});

test('every stage has at most two quick fields and each exists in the stage', () => {
  for (const [visa, v] of Object.entries(data.visas))
    for (const s of v.stages) {
      assert.ok(Array.isArray(s.quick) && s.quick.length <= 2, `${visa}.${s.id}`);
      for (const k of s.quick) assert.ok(data.fields[k] && s.fields.includes(k), `${visa}.${s.id}.${k}`);
    }
  const quick = (v, s) => data.visas[v].stages.find((x) => x.id === s).quick;
  assert.deepEqual(quick('H1B', 'gc_waiting_pd'), ['ebCategory', 'priorityDate']);
  assert.deepEqual(quick('H1B', 'working'), ['i94Expiry']);
  assert.deepEqual(quick('H4', 'ead_working'), ['eadExpiry']);
  assert.deepEqual(quick('F1', 'stem_opt'), ['stemOptEnd']);
  // Both ask nothing in onboarding: Today asks for each date one at a time, where "Already passed" is one tap.
  assert.deepEqual(quick('F1', 'ending'), []);
  assert.deepEqual(quick('F1', 'h1b_selected'), []);
});

test('green card category offers EB-1, EB-2 and EB-3, each present in the bulletin data', () => {
  assert.deepEqual(data.fields.ebCategory.options, ['EB1', 'EB2', 'EB3']);
  assert.ok(!/PERM/.test(data.fields.priorityDate.label), 'EB-1 has no PERM, so the label must not say it');
});

test('optStart and stemOptStart are not inputs any more', () => {
  assert.ok(!('optStart' in data.fields) && !('stemOptStart' in data.fields));
});

test('expiry dates ask month and year only, and never claim a window opened early or a date passed', () => {
  for (const k of ['i94Expiry', 'i797Expiry', 'eadExpiry', 'apExpiry', 'programEnd', 'optEnd', 'stemOptEnd']) {
    assert.equal(data.fields[k].precision, 'month', k);
    assert.equal(data.fields[k].assume, 'end', k);
    assert.equal(data.fields[k].deadline, true, k);
  }
});

test('the validator rejects bad precision, assume and quick shapes', () => {
  const bad = (edit) => {
    const d = clone();
    edit(d);
    return validateVisas(d);
  };
  assert.match(bad((d) => (d.fields.i94Expiry.precision = 'week'))[0], /precision/);
  assert.match(bad((d) => delete d.fields.priorityDate.assume)[0], /assume/);
  assert.match(bad((d) => (d.fields.priorityDate.assume = 'middle'))[0], /assume/);
  assert.match(bad((d) => (d.fields.i94Expiry.precision = 'day'))[0], /assume only applies/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['i94Expiry', 'i797Expiry', 'passportExpiry']))[0], /at most two/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['nope']))[0], /unknown quick/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['priorityDate']))[0], /not in the stage/);
  assert.match(bad((d) => (d.visas.H1B.stages[1].quick = ['timeOutsideUsDays']))[0], /number field/);
  assert.match(bad((d) => delete d.visas.H1B.stages[0].quick)[0], /quick must be a list/);
});

test('date questions are plain sentences, and a field can be limited to future dates', () => {
  for (const k of ['i94Expiry', 'i797Expiry', 'eadExpiry', 'apExpiry', 'programEnd', 'optEnd', 'stemOptEnd', 'passportExpiry', 'visaStampExpiry'])
    assert.match(data.fields[k].question, /^When does your .+\?$/, k);
  const bad = (edit) => {
    const d = clone();
    edit(d);
    return validateVisas(d);
  };
  assert.deepEqual(bad((d) => (d.fields.i94Expiry.timing = 'ahead')), []);
  assert.match(bad((d) => (d.fields.i94Expiry.timing = 'passed'))[0], /timing must be "ahead"/);
  assert.match(bad((d) => (d.fields.ebCategory.timing = 'ahead'))[0], /only apply to date fields/);
  assert.match(bad((d) => (d.fields.i94Expiry.question = ''))[0], /question/);
});

test('the first H-1B month is not asked once an approved I-140 is confirmed, and skipWhen must be a condition object', () => {
  assert.deepEqual(data.fields.h1bFirstStart.skipWhen, {
    any: [{ dateSet: 'i140ApprovedOn' }, { stage: ['gc_waiting_pd', 'i485_pending', 'approved'] }],
  });
  const bad = (v) => {
    const d = clone();
    d.fields.h1bFirstStart.skipWhen = v;
    return validateVisas(d);
  };
  assert.deepEqual(bad({ dateSet: 'i140ApprovedOn' }), []);
  for (const v of ['gc_waiting_pd', 42, null, [{ dateSet: 'i140ApprovedOn' }]]) assert.match(bad(v)[0], /skipWhen must be a condition object/, JSON.stringify(v));
});

test('"Planning to leave the USA" is the last stage of every visa and asks only the destination and the month', () => {
  for (const visa of ['H1B', 'H4', 'F1']) {
    const s = data.visas[visa].stages.at(-1);
    assert.deepEqual(
      [s.id, s.label, s.hint, s.quick, s.fields],
      ['leaving', 'Planning to leave the USA', 'Soon, or within the next year', ['leavingTo', 'leaveOn'], ['leavingTo', 'leaveOn', 'passportExpiry', 'visaStampExpiry']],
      visa,
    );
  }
  const { leavingTo, leaveOn } = data.fields;
  assert.deepEqual(leavingTo.options, ['India', 'Another country']);
  assert.equal(leavingTo.type, 'select');
  assert.equal(leavingTo.question, 'Where are you moving to?');
  assert.ok(leavingTo.unlock && leaveOn.unlock, 'Today can ask for both when onboarding was skipped');
  assert.equal(leaveOn.question, 'When do you plan to leave?');
  assert.equal(leaveOn.label, 'Planned departure');
  // A future month only: no "already passed" choice, and the 1st of the month is the conservative end.
  assert.deepEqual([leaveOn.type, leaveOn.precision, leaveOn.assume, leaveOn.deadline, leaveOn.timing], ['date', 'month', 'start', true, 'ahead']);
  assert.ok(GROUPS.includes('Plans') && leavingTo.group === 'Plans' && leaveOn.group === 'Plans');
});
