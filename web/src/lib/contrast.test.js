import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Reads the real tokens out of styles.css and checks every text/background pair the UI uses, in both modes.
// TABLE=1 npm test -w web  prints the ratios.
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = tokens(/:root\s*\{([^}]*)\}/.exec(css)[1]);
const dark = { ...light, ...tokens(/prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)[1]) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, where it is used]. Text needs 4.5:1; controls and focus rings need 3:1.
const TEXT = [
  ['ink', 'page', 'titles and body on the page'],
  ['ink', 'card', 'body in cards, rows and sheets'],
  ['muted', 'page', 'labels on the page'],
  ['muted', 'card', 'labels, hints, row values'],
  ['ink', 'tint', 'chips, "Why it matters" block'],
  ['on-action', 'action', 'orange buttons and the active tab'],
  ['on-hero', 'hero', 'hero headline'],
  ['on-hero-2', 'hero', 'hero supporting line and eyebrow'],
  ['done-fg', 'done-bg', 'done icon circle'],
  ['warn-fg', 'warn-bg', 'needs-attention rows and notes'],
  ['over-fg', 'over-bg', 'past-due rows'],
  ['done-fg', 'card', '"Current" status text'],
  ['over-fg', 'card', '"Past due" text, danger button'],
  ['on-nav', 'nav', 'navigation'],
  ['on-nav-2', 'nav', 'inactive tabs'],
  ['card', 'ink', 'selected chip, solid button'],
];
const NON_TEXT = [
  ['edge', 'card', 'input and outline-button borders'],
  ['edge', 'page', 'dashed next-stage row, outline buttons'],
  ['ring', 'page', 'focus ring on the page'],
  ['ring', 'card', 'focus ring in cards and sheets'],
  ['on-hero', 'hero', 'focus ring in the hero'],
  ['on-nav', 'nav', 'focus ring in the navigation'],
  ['on-hero-2', 'hero', 'outline button border in the hero'],
  ['ink', 'tint', 'progress bar fill'],
];

for (const [mode, t] of [['light', light], ['dark', dark]]) {
  test(`${mode}: text pairs meet WCAG AA 4.5:1`, () => {
    for (const [f, b, use] of TEXT) {
      const r = ratio(t[f], t[b]);
      if (process.env.TABLE) console.log(`${mode.padEnd(5)} ${f.padEnd(10)} on ${b.padEnd(8)} ${r.toFixed(2).padStart(5)}  ${use}`);
      assert.ok(r >= 4.5, `${mode} ${f} on ${b} is ${r.toFixed(2)} (${use})`);
    }
  });
  test(`${mode}: control borders, rings and bars meet 3:1`, () => {
    for (const [f, b, use] of NON_TEXT) {
      const r = ratio(t[f], t[b]);
      if (process.env.TABLE) console.log(`${mode.padEnd(5)} ${f.padEnd(10)} on ${b.padEnd(8)} ${r.toFixed(2).padStart(5)}  ${use}`);
      assert.ok(r >= 3, `${mode} ${f} on ${b} is ${r.toFixed(2)} (${use})`);
    }
  });
}

test('orange keeps the navy label in both modes', () => {
  assert.equal(light['on-action'], '#14224a');
  assert.equal(dark['on-action'], '#14224a');
  assert.equal(light.action, dark.action);
});
