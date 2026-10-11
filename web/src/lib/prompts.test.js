import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextPrompt } from './prompts.js';

const data = JSON.parse(readFileSync(new URL('../../content/visas.json', import.meta.url), 'utf8'));
const today = new Date('2026-10-10T00:00:00Z');
const stage = (id) => data.visas.H1B.stages.find((s) => s.id === id);
const ask = (id, dates = {}, dismissed = [], st = stage(id)) => nextPrompt(st, { visa: 'H1B', stage: id, dates, dismissed }, data.fields, today);
// Everything this stage asks before the first month in H-1B is answered, so that field is the next one if it is asked at all.
const answered = { i94Expiry: '2027-03', i797Expiry: '2027-06', passportExpiry: '2030-01', ebCategory: 'EB2', priorityDate: '2014-05' };

test('the first H-1B month is asked until an approved I-140 is confirmed', () => {
  assert.equal(ask('working', answered), 'h1bFirstStart');
  assert.equal(ask('new', answered), 'h1bFirstStart');
  assert.equal(ask('gc_perm_i140', answered), 'h1bFirstStart'); // PERM started or I-140 filed is not "approved"
});

test('it is not asked once i140ApprovedOn is set', () => {
  assert.equal(ask('working', { ...answered, i140ApprovedOn: '2024-02' }), undefined);
  assert.equal(ask('gc_perm_i140', { ...answered, i140ApprovedOn: '2024-02' }), undefined);
});

test('it is not asked in a stage that already says the I-140 is approved', () => {
  assert.equal(ask('gc_waiting_pd', answered), undefined); // the real stage lists the field
  // i485_pending and approved do not list the field, so borrow the fields of "working" under each id
  for (const id of ['gc_waiting_pd', 'i485_pending', 'approved']) assert.equal(ask(id, answered, [], { ...stage('working'), id }), undefined, id);
});

test('a dismissed field is skipped and a "passed" date counts as answered', () => {
  assert.equal(ask('working', { i94Expiry: '2027-03' }), 'i797Expiry');
  assert.equal(ask('working', { i94Expiry: '2027-03' }, ['i797Expiry']), 'passportExpiry');
  assert.equal(ask('working', { i94Expiry: 'passed', i797Expiry: 'passed', passportExpiry: '2030-01' }), 'h1bFirstStart');
  assert.equal(ask('working', answered, ['h1bFirstStart']), undefined);
});

test('the next eligible field is returned in place of a skipped one', () => {
  const st = { id: 'gc_waiting_pd', fields: ['h1bFirstStart', 'passportExpiry'] };
  assert.equal(ask('gc_waiting_pd', {}, [], st), 'passportExpiry');
  assert.equal(ask('working', {}, [], { id: 'working', fields: ['h1bFirstStart', 'passportExpiry'] }), 'h1bFirstStart');
  assert.equal(nextPrompt(undefined, { dates: {} }, data.fields, today), undefined);
});

test('skipWhen sees resolved dates: a "passed" date is in the past', () => {
  const fields = {
    e: { type: 'date', precision: 'month', assume: 'end', deadline: true },
    a: { unlock: 'ask a', skipWhen: { datePast: 'e' } },
  };
  const st = { id: 's', fields: ['a'] };
  assert.equal(nextPrompt(st, { dates: { e: 'passed' }, dismissed: [] }, fields, today), undefined);
  assert.equal(nextPrompt(st, { dates: { e: '2027-01' }, dismissed: [] }, fields, today), 'a');
  assert.equal(nextPrompt(st, { dates: {}, dismissed: [] }, fields, today), 'a');
});

test('a leaving user is asked the destination, then the month; a skipped one is not asked again', () => {
  assert.equal(ask('leaving'), 'leavingTo');
  assert.equal(ask('leaving', { leavingTo: 'India' }), 'leaveOn');
  assert.equal(ask('leaving', {}, ['leavingTo']), 'leaveOn');
  assert.equal(ask('leaving', { leavingTo: 'India' }, ['leaveOn']), 'passportExpiry');
  assert.equal(ask('leaving', { leavingTo: 'India', leaveOn: '2027-03', passportExpiry: '2030-01' }), undefined);
});
