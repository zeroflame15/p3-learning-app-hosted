// LIVE-GENERATED QUESTIONS — EXPERIMENT (one topic only: math-ntuc).
// Shared, dependency-free validator + prompt builder, used by
// api/generate-questions.js (server, authoritative) and mirrored by a
// small client copy in public/index.html (second net). The rule of
// this experiment: code decides whether a generated question is
// usable — the model never grades its own work. For a Maths topic
// that means every answer must RECOMPUTE from the numbers in the
// stem (see liveGenRecompute). Anything that cannot be recomputed
// (estimation, "closest to", multiples, factors, rounding) is
// rejected, not guessed at — the quest then falls back silently to
// the pre-written bank. See EXPERIMENT-REPORT.md.
'use strict';

const LIVE_GEN_TOPIC = 'math-ntuc';
const LIVE_GEN_COUNT = 5;

// Words that mark a question as NOT exactly computable from its
// stem. The prompt forbids these; the validator rejects them anyway.
const NON_COMPUTABLE_WORDS = ['closest', 'estimate', 'about', 'round', 'nearest', 'multiple', 'factor'];

function liveGenNormStem(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function liveGenOptNum(opt) {
  if (opt == null) return null;
  const n = parseFloat(String(opt).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function liveGenNumbers(stem) {
  const out = [];
  String(stem || '').replace(/-?\d[\d,]*(\.\d+)?/g, (m) => { out.push(parseFloat(m.replace(/,/g, ''))); return m; });
  return out;
}

function liveGenApply(a, op, b) {
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  if (op === '*') return a * b;
  if (op === '/') return b === 0 ? null : a / b;
  return null;
}

// Try to recompute the claimed answer from the numbers in the stem.
// Candidates: every single operation on any ordered pair, every
// two-step combination on any ordered triple in all three groupings
// (including paid-amount-last change problems), and
// (a*b) +/- (c*d) on ordered quadruples (the two-step money problems
// in the P4 bank are exactly that shape). A match within one cent
// counts — BUT only if the match uses EVERY number in the stem.
// Otherwise an intermediate step can pass: in "4 notebooks at $6,
// pay with $50", the answer 24 (= 4 x 6) is computable yet wrong,
// because it ignores the $50. That case is reported separately as
// 'answer-ignores-numbers', so a wrong intermediate is never silently
// accepted as the answer.
function liveGenRecompute(stem, answer) {
  const lower = String(stem || '').toLowerCase();
  for (const w of NON_COMPUTABLE_WORDS) {
    if (new RegExp('\\b' + w + '\\b').test(lower)) return { ok: false, reason: 'non-computable-type' };
  }
  const nums = liveGenNumbers(stem);
  if (nums.length < 2) return { ok: false, reason: 'too-few-numbers' };
  const EPS = 0.011;
  const fullMask = (1 << nums.length) - 1;
  const cands = [];
  const push = (v, used) => { if (v != null && Number.isFinite(v)) cands.push({ v, used }); };
  const OPS = ['+', '-', '*', '/'];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      for (const op of OPS) push(liveGenApply(nums[i], op, nums[j]), (1 << i) | (1 << j));
      // Order matters for - and /: "a watermelon costs $7, pay with
      // $10" is 10-7, but the stem lists 7 first — so try the reverse
      // too (found live 2026-11-08: a valid change question was
      // rejected because only 7-10 was ever tried). + and * commute.
      push(liveGenApply(nums[j], '-', nums[i]), (1 << i) | (1 << j));
      push(liveGenApply(nums[j], '/', nums[i]), (1 << i) | (1 << j));
    }
  }
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      for (let k = j + 1; k < nums.length; k++) {
        const used = (1 << i) | (1 << j) | (1 << k);
        for (const op1 of OPS) {
          const v1 = liveGenApply(nums[i], op1, nums[j]);
          if (v1 == null) continue;
          for (const op2 of OPS) push(liveGenApply(v1, op2, nums[k]), used);
          const w1 = liveGenApply(nums[j], op1, nums[k]);
          if (w1 == null) continue;
          for (const op2 of OPS) push(liveGenApply(nums[i], op2, w1), used);
          // Change problems: the paid amount comes last in the stem,
          // e.g. "$4.25 + $1.75, pay with $10" -> 10 - (4.25 + 1.75).
          for (const op2 of OPS) push(liveGenApply(nums[k], op2, v1), used);
        }
      }
    }
  }
  if (nums.length >= 4) {
    for (let i = 0; i + 3 < nums.length; i++) {
      const used = (1 << i) | (1 << (i + 1)) | (1 << (i + 2)) | (1 << (i + 3));
      push(nums[i] * nums[i + 1] + nums[i + 2] * nums[i + 3], used);
      push(nums[i] * nums[i + 1] - nums[i + 2] * nums[i + 3], used);
    }
  }
  if (cands.some((c) => c.used === fullMask && Math.abs(c.v - answer) < EPS)) return { ok: true, value: answer };
  if (cands.some((c) => Math.abs(c.v - answer) < EPS)) return { ok: false, reason: 'answer-ignores-numbers' };
  return { ok: false, reason: 'answer-does-not-recompute' };
}

// Validate ONE generated question. bankStems = normalised stems of
// the topic's bank pool (supplied by the caller); seenStems = the
// normalised stems already accepted in this set.
function validateLiveGenQuestion(q, bankStems, seenStems) {
  const reasons = [];
  if (!q || typeof q !== 'object') return ['bad-shape'];
  const stem = typeof q.q === 'string' ? q.q.trim() : '';
  if (stem.length < 12) reasons.push('stem-too-short');
  if (!Array.isArray(q.o) || q.o.length !== 4) reasons.push('options-not-4');
  if (typeof q.a !== 'number' || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) reasons.push('bad-answer-index');
  if (typeof q.c !== 'string' || q.c.trim().length < 8) reasons.push('explanation-missing');
  else if (!/[\d×x+\-÷]|times|plus|minus|divide|add|subtract/i.test(q.c)) reasons.push('explanation-has-no-working');
  if (reasons.includes('options-not-4') || reasons.includes('bad-answer-index')) return reasons;

  const opts = q.o.map((o) => String(o == null ? '' : o).trim());
  const normOpts = opts.map((o) => o.replace(/\s+/g, ' ').toLowerCase());
  if (new Set(normOpts).size !== 4) reasons.push('duplicate-options');
  const values = opts.map(liveGenOptNum);
  if (values.some((v) => v == null)) reasons.push('non-numeric-option');
  if (values.some((v, i) => v != null && values.some((w, j) => j > i && w === v))) reasons.push('duplicate-option-values');
  const answer = values[q.a];
  if (answer == null) { reasons.push('answer-not-numeric'); return reasons; }

  // Distractor quality: reject a set whose distractors are ALL
  // within a whisker of the answer (the lazy "answer +/- 1" set).
  // Threshold: 50 cents for money, else max(1, 5% of the answer).
  const isMoney = opts.some((o) => o.indexOf('$') >= 0);
  const thresh = isMoney ? 0.5 : Math.max(1, 0.05 * Math.abs(answer));
  const diffs = values.map((v, i) => (i === q.a ? null : Math.abs(v - answer))).filter((d) => d != null);
  if (diffs.length === 3 && diffs.every((d) => d <= thresh)) reasons.push('weak-distractors');

  // The answer must not already appear as a number in the stem.
  const stemNums = liveGenNumbers(stem);
  if (stemNums.some((n) => Math.abs(n - answer) < 0.011)) reasons.push('answer-in-stem');

  // The answer must recompute from the stem (also rejects
  // estimation / multiples / factors / rounding questions).
  const rc = liveGenRecompute(stem, answer);
  if (!rc.ok) reasons.push(rc.reason);

  const norm = liveGenNormStem(stem);
  if (norm && Array.isArray(bankStems) && bankStems.indexOf(norm) >= 0) reasons.push('duplicate-of-bank');
  if (norm && Array.isArray(seenStems) && seenStems.indexOf(norm) >= 0) reasons.push('duplicate-in-set');
  return reasons;
}

function validateLiveGenSet(questions, bankStems) {
  if (!Array.isArray(questions) || questions.length !== LIVE_GEN_COUNT) {
    return { ok: false, reasons: ['set-must-have-' + LIVE_GEN_COUNT + '-questions'] };
  }
  const bankNorm = (bankStems || []).map(liveGenNormStem);
  const seen = [];
  const reasons = [];
  questions.forEach((q, i) => {
    validateLiveGenQuestion(q, bankNorm, seen).forEach((r) => reasons.push('q' + (i + 1) + ':' + r));
    if (q && typeof q.q === 'string') seen.push(liveGenNormStem(q.q));
  });
  return { ok: reasons.length === 0, reasons };
}

function liveGenScopeFor(level) {
  if (level >= 4) {
    return 'Primary 4 (age 9-10) Singapore MOE maths: multiply a 2-digit number by a 1-digit number, divide a 2- or 3-digit number by a 1-digit number, two-step money problems up to $100 (multiply then add or subtract), multiply by 10, 100 or 1000. Times tables up to 12.';
  }
  return 'Primary 3 (age 8-9) Singapore MOE maths: times tables 2 to 9, multiplication and exact division within 100, money totals and change up to $10, one- or two-step problems (add then multiply, multiply then add or subtract).';
}

function buildLiveGenPrompt(topicName, level, count, examples) {
  const ex = (examples || []).slice(0, 2).map((e) => '- "' + e.q + '" Answer: ' + e.o[e.a]).join('\n');
  return 'You write 5 maths quiz questions for a Singapore primary school child, topic "' + topicName + '".\n'
    + 'Level: ' + liveGenScopeFor(level) + '\n'
    + 'Context: an NTUC supermarket in Singapore — eggs, milk, fruit, rice, bread, snacks, drinks. Use dollars and cents where money is involved.\n'
    + 'RULES (all must hold, or the whole set is thrown away):\n'
    + '1. Reply with JSON ONLY, no other text, no markdown fences: {"questions":[{"q":"...","o":["...","...","...","..."],"a":0,"c":"..."}]} with exactly ' + count + ' questions.\n'
    + '2. Every question must have ONE exact answer that can be worked out from the numbers written in the question itself, using at most two steps (add, subtract, multiply, exact division). Every number needed for the working must appear in the question.\n'
    + '3. NEVER write estimation, rounding, "closest to", "about", multiples or factors questions. NEVER ask which number is a multiple or a factor of another.\n'
    + '4. Four options, all different numbers (money options use $ and two decimals, e.g. "$6.40"). Exactly one is correct. Distractors must be plausible wrong answers (a slip in the working, a wrong operation, a near table fact) — at least one distractor must be a real miss, not just 1 more or 1 less than the answer.\n'
    + '5. The correct answer must NOT appear as a number anywhere in the question text.\n'
    + '6. "c" is a short explanation (one or two sentences) that shows the working with numbers, e.g. "6 x 4 = 24. Count in sixes!". It must contain a number or an operation word.\n'
    + '7. Vary the contexts and the operations across the 5 questions. Do NOT reuse these example questions or their numbers:\n' + ex + '\n'
    + '8. Keep every question short enough for an 8-10 year old to read. No LaTeX, no $ sign except for money amounts, no markdown.\n'
    + '9. Every number in the question must be used in the working — do not include extra numbers that play no part.';
}

// Maths boost prompts (2026-11-08): 5 questions modelled on the ONE
// question she missed — same skill, easier first. Same hard rules as
// buildLiveGenPrompt (JSON only, recompute, no estimation), so the
// same validator gates the set. Keep the RULES in step with
// buildLiveGenPrompt: if a rule changes there, change it here too.
// The model question is named in the prompt; the two pool examples
// are only a do-not-reuse list.
const LIVE_GEN_BOOST_TOPICS = ['math-mrt', 'math-hawker', 'math-ntuc', 'math-frac'];
const LIVE_GEN_BOOST_INFO = {
  'math-mrt': { name: 'MRT Numbers', context: 'an MRT train in Singapore — stations, trips and platform counts. Add and subtract whole numbers; no money, no fractions.' },
  'math-hawker': { name: 'Hawker Change', context: 'a Singapore hawker centre — chicken rice, drinks, roti prata and making change. Use dollars and cents.' },
  'math-ntuc': { name: 'NTUC Totals', context: 'an NTUC supermarket in Singapore — eggs, milk, fruit, rice, bread, snacks, drinks. Use dollars and cents where money is involved.' },
  'math-frac': { name: 'Fractions Feast', context: 'sharing food fairly in Singapore — cakes, pizzas and fruit cut into equal parts. Answers are plain whole numbers (how many pieces, how many are left) — never a fraction like 1/4 as an option.' },
};

function buildLiveGenBoostPrompt(topicId, level, count, examples, modelOn) {
  const info = LIVE_GEN_BOOST_INFO[topicId] || { name: topicId, context: 'everyday Singapore maths.' };
  const ex = (examples || []).slice(0, 2).map((e) => '- "' + e.q + '" Answer: ' + e.o[e.a]).join('\n');
  const modelAns = (typeof modelOn.a === 'number' && Array.isArray(modelOn.o)) ? String(modelOn.o[modelOn.a]) : String(modelOn.a);
  return 'You write 5 maths quiz questions for a Singapore primary school child, topic "' + info.name + '".\n'
    + 'Level: ' + liveGenScopeFor(level) + '\n'
    + 'Context: ' + info.context + '\n'
    + 'THE MODEL QUESTION — she got this one wrong, so the new set practises the SAME skill, EASIER first:\n'
    + '- "' + modelOn.q + '" Answer: ' + modelAns + (modelOn.c ? ' (' + modelOn.c + ')' : '') + '\n'
    + 'Write 5 NEW questions on the same skill as the model (same kind of working, same kinds of numbers). Make them EASIER first: the first questions should be easier than the model, the last ones about as hard as the model — never harder. Do NOT copy the model question or its numbers.\n'
    + 'RULES (all must hold, or the whole set is thrown away):\n'
    + '1. Reply with JSON ONLY, no other text, no markdown fences: {"questions":[{"q":"...","o":["...","...","...","..."],"a":0,"c":"..."}]} with exactly ' + count + ' questions.\n'
    + '2. Every question must have ONE exact answer that can be worked out from the numbers written in the question itself, using at most two steps (add, subtract, multiply, exact division). Every number needed for the working must appear in the question.\n'
    + '3. NEVER write estimation, rounding, "closest to", "about", multiples or factors questions. NEVER ask which number is a multiple or a factor of another.\n'
    + '4. Four options, all different numbers (money options use $ and two decimals, e.g. "$6.40"). Exactly one is correct. Distractors must be plausible wrong answers (a slip in the working, a wrong operation, a near table fact) — at least one distractor must be a real miss, not just 1 more or 1 less than the answer.\n'
    + '5. The correct answer must NOT appear as a number anywhere in the question text.\n'
    + '6. "c" is a short explanation (one or two sentences) that shows the working with numbers, e.g. "6 x 4 = 24. Count in sixes!". It must contain a number or an operation word.\n'
    + '7. Vary the contexts and the operations across the 5 questions. Do NOT reuse these example questions or their numbers:\n' + ex + '\n'
    + '8. Keep every question short enough for an 8-10 year old to read. No LaTeX, no $ sign except for money amounts, no markdown.\n'
    + '9. Every number in the question must be used in the working — do not include extra numbers that play no part.\n'
    + '10. Every answer must be a plain number (money as $x.xx) — never a fraction like 1/4 as an option.';
}

function parseLiveGenReply(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { error: 'empty_reply' };
  let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let data;
  try { data = JSON.parse(text); } catch (e) { return { error: 'unparseable_json' }; }
  const questions = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(questions)) return { error: 'no_questions_array' };
  return { questions };
}

module.exports = {
  LIVE_GEN_TOPIC,
  LIVE_GEN_COUNT,
  NON_COMPUTABLE_WORDS,
  liveGenNormStem,
  liveGenOptNum,
  liveGenNumbers,
  liveGenRecompute,
  validateLiveGenQuestion,
  validateLiveGenSet,
  liveGenScopeFor,
  buildLiveGenPrompt,
  buildLiveGenBoostPrompt,
  LIVE_GEN_BOOST_TOPICS,
  LIVE_GEN_BOOST_INFO,
  parseLiveGenReply,
};
