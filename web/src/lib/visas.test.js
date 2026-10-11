import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateVisas } from './visas.js';

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
  assert.deepEqual(quick('F1', 'ending'), ['optEnd', 'stemOptEnd']);
});

test('optStart and stemOptStart are not inputs any more', () => {
  assert.ok(!('optStart' in data.fields) && !('stemOptStart' in data.fields));
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
  assert.match(bad((d) => (d.fields.i94Expiry.assume = 'end'))[0], /assume only applies/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['i94Expiry', 'i797Expiry', 'passportExpiry']))[0], /at most two/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['nope']))[0], /unknown quick/);
  assert.match(bad((d) => (d.visas.H1B.stages[0].quick = ['priorityDate']))[0], /not in the stage/);
  assert.match(bad((d) => (d.visas.H1B.stages[1].quick = ['timeOutsideUsDays']))[0], /number field/);
  assert.match(bad((d) => delete d.visas.H1B.stages[0].quick)[0], /quick must be a list/);
});
