import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABS, tabIndex } from './tabs.js';

test('the pill sits under the tab of the current route', () => {
  assert.deepEqual(TABS.map(([to]) => tabIndex(to)), [0, 1, 2, 3]);
  assert.equal(tabIndex('/journey/steps/anything'), 1); // a nested path keeps its tab
});

test('unknown paths fall back to the first tab, and a shared prefix is not a match', () => {
  assert.equal(tabIndex('/'), 0);
  assert.equal(tabIndex('/start'), 0);
  assert.equal(tabIndex('/menu'), 0); // starts with "/me" but is not the Me tab
  assert.equal(tabIndex(''), 0);
});
