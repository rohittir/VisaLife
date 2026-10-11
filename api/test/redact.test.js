import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact } from '../src/redact.js';

test('masks emails, phone numbers, receipt numbers, A-numbers and SSNs', () => {
  const cases = [
    ['write to jane.doe+visa@mail.example.com please', 'write to [removed] please'],
    ['call +1 (415) 555-0132 tonight', 'call [removed] tonight'],
    ['or 415.555.0132, or 4155550132', 'or [removed], or [removed]'],
    ['my receipt is IOE0123456789.', 'my receipt is [removed].'],
    ['lowercase ioe0123456789 too', 'lowercase [removed] too'],
    ['A-123456789 and A12345678', '[removed] and [removed]'],
    ['ssn 123-45-6789', 'ssn [removed]'],
  ];
  for (const [input, want] of cases) assert.equal(redact(input), want);
});

test('leaves ordinary text, years, dates and amounts alone', () => {
  for (const s of [
    'My H-1B was filed on 2024-03-15 and approved 12.05.2025.',
    'The 2026 cap season opened in March; the fee was $215, then $1,234,567 in total.',
    'Between 2024 and 2026 I worked 3 jobs and filed I-485 and I-765.',
    'Form I-129 and I-140, section 104(c), 180 days, 240 days.',
    'a plain note',
  ]) assert.equal(redact(s), s);
});
