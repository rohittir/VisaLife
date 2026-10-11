// Masks identifiers a person might paste into free text, before anything is stored.
// Over-masking is the safe direction, so this errs that way except for dates and years, which are ordinary content here.
const MASK = '[removed]';

const EMAIL = /[^\s@<>()[\],;:]+@[^\s@<>()[\],;:]+\.[a-z]{2,}/gi;
const RECEIPT = /\b[a-z]{3}\d{10}\b/gi; // IOE0123456789
const A_NUMBER = /\bA-?\d{8,9}\b/gi;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE = /(?<![\w-])\+?\d(?:[\d\s().-]{5,}\d)(?![\w-])/g; // digits with common separators

const dateLike = (g) =>
  g.length === 3 && ((g[0].length === 4 && g[1].length <= 2 && g[2].length <= 2) || (g[0].length <= 2 && g[1].length <= 2 && g[2].length === 4));
const yearsOnly = (g) => g.every((x) => /^(19|20)\d\d$/.test(x));

function maskPhones(text) {
  return text.replace(PHONE, (m) => {
    const groups = m.split(/\D+/).filter(Boolean);
    if (m.replace(/\D/g, '').length < 7 || dateLike(groups) || yearsOnly(groups)) return m;
    return MASK;
  });
}

export function redact(text) {
  // The specific patterns run first: the phone pattern would otherwise take their digits.
  return maskPhones(text.replace(EMAIL, MASK).replace(RECEIPT, MASK).replace(A_NUMBER, MASK).replace(SSN, MASK));
}
