// Simple arithmetic, worked out by CODE — never by the model.
// Pip's live reply for "what is 3 x 4" once said "3 + 3 + 3 = 7":
// a small model can fumble repeated addition, and a hint that shows
// wrong working teaches the wrong thing. So when a question is one
// plain sum, the server works it out exactly here and hands the
// model the fact to explain. The model explains; code decides the
// number — the same rule as marks and rewards, applied to sums.
// Only plain sums are covered: two whole numbers (0-1000) with
// +, -, x (times), or an exact ÷. Anything else returns null and
// the model answers normally.
'use strict';

function parseNum(s) {
  if (!/^\d{1,4}$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n <= 1000 ? n : null;
}

function extractSimpleSum(text) {
  const s = String(text || '').toLowerCase().replace(/,/g, '');
  // "3 times 4", "3 multiplied by 4", "3 plus 4", "12 divided by 3", "20 minus 6"
  const word = s.match(/(\d{1,4})\s*(times|multiplied by|plus|minus|divided by)\s*(\d{1,4})/);
  const sym = !word && s.match(/(\d{1,4})\s*([x×*+\-÷\/])\s*(\d{1,4})/);
  const m = word || sym;
  if (!m) return null;
  const a = parseNum(m[1]);
  const b = parseNum(m[3]);
  if (a === null || b === null) return null;
  const opWord = m[2];
  let op, answer, working;
  if (opWord === 'times' || opWord === 'multiplied by' || opWord === 'x' || opWord === '×' || opWord === '*') {
    op = 'x';
    answer = a * b;
    if (answer > 10000) return null;
    if (b > 12) {
      working = a + ' x ' + b + ' = ' + answer;
    } else {
      const parts = [];
      for (let i = 0; i < b; i++) parts.push(String(a));
      working = a + ' added ' + b + ' times is ' + parts.join(' + ') + ' = ' + answer;
    }
  } else if (opWord === 'plus' || opWord === '+') {
    op = '+';
    answer = a + b;
    working = a + ' + ' + b + ' = ' + answer;
  } else if (opWord === 'minus' || opWord === '-') {
    op = '-';
    if (a < b) return null; // keep P3 sums non-negative; let the model handle the rest
    answer = a - b;
    working = a + ' - ' + b + ' = ' + answer;
  } else if (opWord === 'divided by' || opWord === '÷' || opWord === '/') {
    if (b === 0 || a % b !== 0) return null; // only exact division, P3 level
    op = '÷';
    answer = a / b;
    working = a + ' ÷ ' + b + ' = ' + answer + ', because ' + b + ' x ' + answer + ' = ' + a;
  } else {
    return null;
  }
  return { a, b, op, answer, expression: a + ' ' + op + ' ' + b + ' = ' + answer, working };
}

module.exports = { extractSimpleSum };
