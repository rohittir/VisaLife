const { test } = require('node:test');
const assert = require('node:assert/strict');
const { redirectCode } = require('../lib/redirect');

// The function source is plain CloudFront JS, so evaluate it the way the edge would.
const handler = new Function(`${redirectCode('visalife.example.com')}\nreturn handler;`)();
const go = (uri, querystring = {}) => handler({ request: { uri, querystring } });

test('redirects with a 302 and keeps the path', () => {
  const r = go('/journey');
  assert.equal(r.statusCode, 302);
  assert.equal(r.headers.location.value, 'https://visalife.example.com/journey');
  assert.equal(go('/').headers.location.value, 'https://visalife.example.com/');
});

test('keeps the query string, including empty and repeated parameters', () => {
  const q = { a: { value: '1' }, flag: { value: '' }, t: { value: 'x', multiValue: [{ value: 'x' }, { value: 'y' }] } };
  assert.equal(go('/home', q).headers.location.value, 'https://visalife.example.com/home?a=1&flag&t=x&t=y');
});
