// Assemble the question gap-fill (2026-11-08) into public/index.html.
// Reads gap-fill/*.json (1,536 validated questions: the 1,530 delivered
// plus 6 best-buy/grouping questions added by the assembler — the spec
// omitted math-money/best_buy_grouping, so the assembler fills it to
// keep the 'all 161 sub-topics cov=yes' promise true), splices them into
// TOPICS / FRESH_BANK / MYKX_SUBJECTS, and verifies the assembled page.
// Deterministic and re-runnable: run it on a COPY of the project first
// (cp -r . /tmp/gapfill-assemble), run `npm test` there, and only then
// run it on the real project. It never touches the live site.
//   node scripts/assemble-gap-fill.js [--page <path>] [--gapfill <dir>]
// Defaults: page = <project>/public/index.html, gapfill = <project>/gap-fill.
// The page path is resolved relative to this script's project root, so
// the same script assembles the copy when copied there.
// Appends ONLY to existing banks (saved progress uses array indices),
// so a re-run on an already-assembled page FAILS fast (duplicate stems)
// instead of doubling the banks — to re-assemble, start from a clean copy.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
function argVal(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const PAGE_PATH = path.resolve(argVal('--page', path.join(ROOT, 'public', 'index.html')));
const GAP_DIR = path.resolve(argVal('--gapfill', path.join(ROOT, 'gap-fill')));
const FILES = ['maths-new.json', 'maths-topups.json', 'english.json', 'science.json', 'chinese-a.json', 'chinese-b.json'];
const KINDS = ['quest', 'warm', 'fresh', 'retry'];
const P4_KINDS = ['p4quest', 'p4warm', 'p4fresh', 'p4retry'];
const WANT = { quest: 5, warm: 8, fresh: 10, retry: 6, p4quest: 5, p4warm: 8, p4fresh: 10, p4retry: 6 };
// Spec counts for top-ups, keyed by the sub's CURRENT cov in MYKX:
//   no -> 5 per level, partial -> +3 per level, p4 -> 5 at P3 only.
const TOPUP_WANT = { no: { 3: 5, 4: 5 }, partial: { 3: 3, 4: 3 }, p4: { 3: 5, 4: 0 } };

function fail(msg) { throw new Error('assemble-gap-fill: ' + msg); }
function normStem(s) { return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }
// Escape a string for a single-quoted JS literal (the page's Q('...')
// convention; the page already uses \' for apostrophes).
function escJS(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
function qSrc(q) {
  return "Q('" + escJS(q.q) + "',['" + q.o.map(escJS).join("','") + "']," + q.a + ",'" + escJS(q.c || '') + "','" + escJS(q.j || '') + "')";
}
// String-aware bracket matcher: index of the ']' matching the '[' at openIdx.
function matchBracket(src, openIdx) {
  let depth = 0, inStr = false, strCh = '', esc = false;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === strCh) inStr = false; continue; }
    if (ch === '"' || ch === "'") { inStr = true; strCh = ch; continue; }
    if (ch === '[' || ch === '{') depth++;
    if (ch === ']' || ch === '}') { depth--; if (depth === 0) return i; }
  }
  fail('bracket never closed at offset ' + openIdx);
}
// Extract a var literal (TOPICS / FRESH_BANK / MYKX_SUBJECTS) as source text.
function extractVar(src, name) {
  const s = src.indexOf('var ' + name + '=');
  if (s < 0) fail('var ' + name + ' not found');
  const open = src.indexOf('=', s) + 1;
  const end = matchBracket(src, open);
  return src.slice(open, end + 1);
}
function Q(q, o, a, c, j) { return { q: q, o: o, a: a, c: c, j: j }; } // eslint-disable-line no-unused-vars

/* --- 1. Load + validate the gap-fill JSONs -------------------------------- */
const gap = FILES.map((f) => ({ file: f, data: JSON.parse(fs.readFileSync(path.join(GAP_DIR, f), 'utf8')) }));
let totalQuestions = 0;
const newTopics = [];
const topUps = [];
const allStems = new Map();
function checkQuestion(q, where) {
  totalQuestions++;
  if (typeof q.q !== 'string' || !q.q.trim()) fail(where + ': empty stem');
  if (!q.sub || typeof q.sub !== 'string') fail(where + ': missing sub: ' + q.q.slice(0, 50));
  if (!Array.isArray(q.o) || q.o.length !== 4 || new Set(q.o).size !== 4) fail(where + ': options must be 4 distinct strings: ' + q.q.slice(0, 50));
  if (typeof q.a !== 'number' || q.a < 0 || q.a > 3) fail(where + ': bad answer index: ' + q.q.slice(0, 50));
  if (typeof q.c !== 'string' || typeof q.j !== 'string') fail(where + ': c/j must be strings: ' + q.q.slice(0, 50));
  const n = normStem(q.q);
  if (allStems.has(n)) fail('duplicate normalised stem across the gap-fill files: ' + q.q.slice(0, 60) + ' (' + where + ' vs ' + allStems.get(n) + ')');
  allStems.set(n, where);
}
for (const { file, data } of gap) {
  for (const t of (data.newTopics || [])) {
    if (!t.id || !t.sub || !t.subName || !t.icon || !t.name || !t.blurb) fail(file + ': new topic missing metadata: ' + JSON.stringify(t).slice(0, 120));
    for (const k of [...KINDS, ...P4_KINDS]) {
      const arr = t[k];
      if (!Array.isArray(arr) || arr.length !== WANT[k]) fail(file + ' ' + t.id + ' ' + k + ': want ' + WANT[k] + ', got ' + (arr || []).length);
      arr.forEach((q) => checkQuestion(q, file + ' ' + t.id + ' ' + k));
      if (k === 'warm' || k === 'p4warm') arr.forEach((q) => { if (q.c !== '' || q.j !== '') fail(file + ' ' + t.id + ' ' + k + ': warm questions must have empty c/j'); });
    }
    // Distribution: every sub-skill gets >= 2 questions per level.
    for (const lvlKinds of [KINDS, P4_KINDS]) {
      const perSub = {};
      for (const k of lvlKinds) for (const q of t[k]) perSub[q.sub] = (perSub[q.sub] || 0) + 1;
      for (const [s, c] of Object.entries(perSub)) if (c < 2) fail(file + ' ' + t.id + ': sub ' + s + ' has only ' + c + ' questions at one level (want >= 2)');
    }
    newTopics.push(t);
  }
  for (const u of (data.topUps || [])) {
    if (!u.topicId || !KINDS.includes(u.kind) || (u.level !== 3 && u.level !== 4)) fail(file + ': bad top-up header: ' + JSON.stringify(u).slice(0, 120));
    if (!Array.isArray(u.questions) || !u.questions.length) fail(file + ': top-up with no questions: ' + u.topicId + ' ' + u.kind + ' L' + u.level);
    u.questions.forEach((q) => checkQuestion(q, file + ' topup ' + u.topicId + ' ' + u.kind + ' L' + u.level));
    topUps.push(u);
  }
}
if (newTopics.length !== 17) fail('want 17 new topics, got ' + newTopics.length);
if (totalQuestions !== 1536) fail('want 1,536 questions, got ' + totalQuestions);
const newIds = newTopics.map((t) => t.id);
if (new Set(newIds).size !== 17) fail('new topic ids are not unique');

/* --- 2. Read the current page --------------------------------------------- */
let html = fs.readFileSync(PAGE_PATH, 'utf8');
const TOPICS = eval('(' + extractVar(html, 'TOPICS') + ')'); // eslint-disable-line no-eval
// Runtime-effective FRESH_BANK: the literal (var FRESH_BANK={...}) holds
// all 14 topics, but the 10 non-English topics are RE-ASSIGNED by
// trailing FRESH_BANK['id']=[...] statements before the TOPICS.forEach
// wiring, so at runtime the trailing set wins for those 10. The tests
// read the literal only (extractVar), so this helper — literal overlaid
// with the trailing assignments — is what the app actually serves.
function effectiveFRESH(src) {
  const lit = eval('(' + extractVar(src, 'FRESH_BANK') + ')'); // eslint-disable-line no-eval
  const re = /FRESH_BANK\['([a-z0-9-]+)'\]=\[/g;
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf('=[', m.index) + 1; // the array's '[', not the ['id'] one
    const close = matchBracket(src, open);
    lit[m[1]] = eval('(' + src.slice(open, close + 1) + ')'); // eslint-disable-line no-eval
  }
  return lit;
}
const FRESH = effectiveFRESH(html);
const MYKX = eval('(' + extractVar(html, 'MYKX_SUBJECTS') + ')'); // eslint-disable-line no-eval
const origTopicIds = TOPICS.map((t) => t.id);
for (const id of newIds) if (origTopicIds.includes(id)) fail('new topic id already in TOPICS: ' + id);
for (const u of topUps) if (!origTopicIds.includes(u.topicId)) fail('top-up for unknown topic: ' + u.topicId);
// Original bank sizes (for the post-assembly delta check).
const origCounts = {};
for (const t of TOPICS) {
  origCounts[t.id] = (t.quest.length + t.warm.length + t.retry.length + t.p4quest.length + t.p4warm.length + t.p4retry.length + t.p4fresh.length + (FRESH[t.id] || []).length);
}
// New stems must not collide with the TARGET topic's existing banks.
const existingStemsByTopic = {};
for (const t of TOPICS) {
  const s = new Set();
  for (const k of [...KINDS, ...P4_KINDS]) {
    const arr = (k === 'fresh') ? (FRESH[t.id] || []) : (t[k] || []);
    arr.forEach((q) => s.add(normStem(q.q)));
  }
  existingStemsByTopic[t.id] = s;
}
function checkAgainstBank(topicId, q, where) {
  const set = existingStemsByTopic[topicId] || new Set(); // new topics have no existing bank
  if (set.has(normStem(q.q))) fail('new stem duplicates an existing ' + topicId + ' bank stem: ' + q.q.slice(0, 60) + ' (' + where + ')');
}
for (const t of newTopics) for (const k of [...KINDS, ...P4_KINDS]) t[k].forEach((q) => checkAgainstBank(t.id, q, 'new topic ' + t.id));
for (const u of topUps) u.questions.forEach((q) => checkAgainstBank(u.topicId, q, 'topup ' + u.topicId));

/* --- 3. Derive the sub -> TOPICS map --------------------------------------- */
// A new topic serves the one myKx topic whose sub-id set equals its own
// (this disambiguates read_scale, which lives in both math-length and
// math-bargraphs, and the three Chinese ids that differ from their
// myKx topic ids: chi-char-choice -> chi-char, chi-picture-word ->
// chi-picword, chi-sentence-work -> chi-sentence).
const mykxById = {};
for (const s of MYKX) for (const t of s.topics) mykxById[t.id] = t;
const subToTopic = {}; // myKxTopicId + '|' + subId -> TOPICS id
const mykxTopicToNew = {}; // myKxTopicId -> new TOPICS id
for (const t of newTopics) {
  const subs = new Set();
  for (const k of [...KINDS, ...P4_KINDS]) for (const q of t[k]) subs.add(q.sub);
  const match = Object.values(mykxById).filter((mt) => {
    const mtSubs = mt.subs.map((sb) => sb.id);
    return mtSubs.length === subs.size && mtSubs.every((s) => subs.has(s));
  });
  if (match.length !== 1) fail('new topic ' + t.id + ' matches ' + match.length + ' myKx topics by sub-set (want exactly 1)');
  const mt = match[0];
  if (mt.quests.length !== 0) fail('new topic ' + t.id + ' maps to myKx topic ' + mt.id + ' which already has quests');
  mykxTopicToNew[mt.id] = t.id;
  for (const s of subs) subToTopic[mt.id + '|' + s] = t.id;
}
// Top-ups: the myKx topic containing the sub whose quests include the
// top-up's topicId (word_choice lives in chi-word-choice, whose quests
// are [chi-family, chi-school]; the questions went into chi-school).
for (const u of topUps) {
  for (const q of u.questions) {
    const holders = Object.values(mykxById).filter((mt) => mt.subs.some((sb) => sb.id === q.sub));
    if (!holders.length) fail('top-up sub ' + q.sub + ' is in no myKx topic (' + u.topicId + ')');
    const holder = holders.find((mt) => (mt.quests || []).includes(u.topicId))
      || holders.find((mt) => (mt.subs.find((sb) => sb.id === q.sub) || {}).map === u.topicId)
      || (holders.length === 1 ? holders[0] : null);
    if (!holder) fail('top-up sub ' + q.sub + ' is ambiguous across myKx topics for ' + u.topicId);
    const key = holder.id + '|' + q.sub;
    if (subToTopic[key] && subToTopic[key] !== u.topicId) fail('sub ' + q.sub + ' maps to two topics: ' + subToTopic[key] + ' vs ' + u.topicId);
    subToTopic[key] = u.topicId;
  }
}
// Top-up counts must match the spec for every filled sub (no 5/level,
// partial +3/level, p4 5 at P3 only), measured from the CURRENT cov.
const topUpCounts = {};
for (const u of topUps) for (const q of u.questions) {
  const key = u.topicId + '|' + q.sub + '|' + u.level;
  topUpCounts[key] = (topUpCounts[key] || 0) + 1;
}
for (const s of MYKX) for (const t of s.topics) for (const sb of t.subs) {
  if (sb.cov === 'yes') continue;
  const want = TOPUP_WANT[sb.cov];
  for (const lvl of [3, 4]) {
    if (want[lvl] === 0) continue;
    const serving = Object.entries(subToTopic).find(([k, v]) => k.endsWith('|' + sb.id));
    if (!serving) fail('no top-up or new topic serves ' + sb.id + ' (cov ' + sb.cov + ')');
    const got = topUpCounts[serving[1] + '|' + sb.id + '|' + lvl] || 0;
    // New-topic subs are counted per level inside the topic (5+8+10+6=29),
    // not per top-up entry: skip the per-level exact check for them.
    if (mykxTopicToNew[t.id]) continue;
    if (got !== want[lvl]) fail('top-up count for ' + sb.id + ' L' + lvl + ': want ' + want[lvl] + ', got ' + got);
  }
}

/* --- 4. Splice TOPICS ------------------------------------------------------- */
function topicEntrySrc(t) {
  const arr = (k) => t[k].map(qSrc).join(',\n ');
  return "{id:'" + t.id + "',img:'',sub:'" + t.sub + "',subName:'" + t.subName + "',icon:'" + t.icon + "',name:'" + escJS(t.name) + "',blurb:'" + escJS(t.blurb) + "',\n"
    + ' quest:[' + arr('quest') + '],\n'
    + ' warm:[' + arr('warm') + '],\n'
    + ' retry:[' + arr('retry') + '],\n'
    + ' p4quest:[' + arr('p4quest') + '],\n'
    + ' p4warm:[' + arr('p4warm') + '],\n'
    + ' p4retry:[' + arr('p4retry') + '],\n'
    + ' p4fresh:[' + arr('p4fresh') + ']}';
}
// Insert before the closing '];' of the TOPICS array.
const topicsOpen = html.indexOf('var TOPICS=[');
if (topicsOpen < 0) fail('var TOPICS=[ not found');
const topicsClose = matchBracket(html, html.indexOf('[', topicsOpen));
const topicsInsert = ',\n' + newTopics.map(topicEntrySrc).join(',\n');
html = html.slice(0, topicsClose) + topicsInsert + html.slice(topicsClose);
// CONTENT comment: 14 -> 31 topics.
html = html.replace('CONTENT — 14 Primary 3 topics.', 'CONTENT — 31 Primary 3 topics.');
if (html.indexOf('CONTENT — 31 Primary 3 topics.') < 0) fail('CONTENT comment not updated');

/* --- 5. Splice FRESH_BANK (new topics) + top-ups --------------------------- */
// Locate a topic's array of kind `kind` inside the TOPICS literal and
// return [openBracketIdx, closeBracketIdx]. kind is quest/warm/retry or p4*.
function topicArraySpan(topicId, kind) {
  const entryAt = html.indexOf("{id:'" + topicId + "',");
  if (entryAt < 0) fail('TOPICS entry not found: ' + topicId);
  const nextEntry = html.indexOf("{id:'", entryAt + 5);
  const kindAt = html.indexOf('\n ' + kind + ':[', entryAt);
  if (kindAt < 0 || (nextEntry >= 0 && kindAt > nextEntry)) fail('array ' + kind + ' not found in ' + topicId);
  const open = html.indexOf('[', kindAt);
  return [open, matchBracket(html, open)];
}
// Locate a topic's P3 fresh array: trailing FRESH_BANK['id'] assignment,
// or the 'id':[...] entry inside the FRESH_BANK literal.
function freshArraySpan(topicId) {
  const assignAt = html.indexOf("FRESH_BANK['" + topicId + "']=[");
  if (assignAt >= 0) {
    const open = html.indexOf('=[', assignAt) + 1; // the array's '[', not the ['id'] one
    return [open, matchBracket(html, open)];
  }
  const litAt = html.indexOf("'" + topicId + "':[", html.indexOf('var FRESH_BANK={'));
  if (litAt < 0) fail('FRESH_BANK entry not found: ' + topicId);
  const open = html.indexOf('[', litAt);
  return [open, matchBracket(html, open)];
}
// Append Q(...) sources to an array span, working right-to-left so
// earlier spans stay valid.
function appendToSpan(span, sources) {
  const [open, close] = span;
  html = html.slice(0, close) + ',' + sources.join(',') + html.slice(close);
}
// New topics: FRESH_BANK['id']=[...10 P3 fresh...] after the last
// existing assignment, before the TOPICS.forEach line.
const forEachAt = html.indexOf('TOPICS.forEach(function(t){ t.fresh=');
if (forEachAt < 0) fail('TOPICS.forEach fresh assignment not found');
const freshAssigns = newTopics.map((t) => "FRESH_BANK['" + t.id + "']=[" + t.fresh.map(qSrc).join(',') + "];\n").join('');
html = html.slice(0, forEachAt) + freshAssigns + html.slice(forEachAt);
// FRESH DAILY BANK comment: 14 -> 31 topics.
html = html.replace('FRESH DAILY BANK — extra questions for EVERY one of the 14\n   topics', 'FRESH DAILY BANK — extra questions for EVERY one of the 31\n   topics');
if (html.indexOf('EVERY one of the 31') < 0) fail('FRESH DAILY BANK comment not updated');
// Top-ups: group by (topicId, arrayKey), append in file order.
// Apply from the END of the file backwards so spans stay valid.
const topUpGroups = new Map();
for (const u of topUps) {
  const key = (u.kind === 'fresh' && u.level === 3) ? (u.topicId + '|FRESH') : (u.topicId + '|' + (u.level === 4 ? 'p4' + u.kind : u.kind));
  if (!topUpGroups.has(key)) topUpGroups.set(key, []);
  topUpGroups.get(key).push(...u.questions.map(qSrc));
}
const spans = [];
for (const [key, sources] of topUpGroups) {
  const [topicId, arrKey] = key.split('|');
  const span = arrKey === 'FRESH' ? freshArraySpan(topicId) : topicArraySpan(topicId, arrKey);
  spans.push([span[0], sources]);
}
spans.sort((a, b) => b[0] - a[0]);
for (const [open, sources] of spans) {
  const close = matchBracket(html, open);
  html = html.slice(0, close) + ',' + sources.join(',') + html.slice(close);
}

/* --- 6. MYKX_SUBJECTS: cov='yes' everywhere, maps, quests ----------------- */
// Per-sub replacement INSIDE its own topic's subs[...] span — the sub id
// alone is not unique (read_scale lives in both math-length and
// math-bargraphs, with different maps), so the replacement is scoped
// to the topic.
for (const s of MYKX) for (const t of s.topics) {
  const headerAt = html.indexOf("{id:'" + t.id + "',name:'");
  if (headerAt < 0) fail('MYKX topic header not found: ' + t.id);
  const subsAt = html.indexOf('subs:[', headerAt);
  if (subsAt < 0) fail('MYKX subs array not found: ' + t.id);
  const open = html.indexOf('[', subsAt);
  const close = matchBracket(html, open);
  let span = html.slice(open, close + 1);
  for (const sb of t.subs) {
    const key = t.id + '|' + sb.id;
    const map = subToTopic[key] || sb.map;
    if (!map) fail('no map for sub ' + sb.id + ' in ' + t.id + ' (and none in the JSONs)');
    const re = new RegExp("\\{id:'" + sb.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "',name:'[^']*',map:(?:null|'[^']*'),cov:'(?:yes|partial|p4|no)'\\}");
    const replacement = "{id:'" + sb.id + "',name:'" + sb.name.replace(/'/g, "\\'") + "',map:'" + map + "',cov:'yes'}";
    if (!re.test(span)) fail('MYKX sub entry not found for ' + sb.id + ' in ' + t.id);
    span = span.replace(re, replacement);
  }
  html = html.slice(0, open) + span + html.slice(close + 1);
}
// The 17 myKx topics with quests:[] get their new Practise quest.
for (const [mykxId, newId] of Object.entries(mykxTopicToNew)) {
  const re = new RegExp("(\\{id:'" + mykxId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "',name:'[^']*',quests:)\\[\\]");
  if (!re.test(html)) fail('MYKX topic header not found for ' + mykxId);
  html = html.replace(re, "$1['" + newId + "']");
}

/* --- 7. Renderer: keep poster/passage line breaks -------------------------- */
// The new visual-text posters and Chinese reading passages use \n for
// paragraph breaks. The quiz and warm-up stems render through esc(),
// which keeps \n as a collapsible newline — turn it into <br> so the
// poster layout survives. No existing question contains \n, so this
// changes nothing for the old banks.
const h3Warm = "+'<h3 style=\"margin-top:14px\">'+esc(q.q)+'</h3>'";
const h3Quiz = "+'<h3 style=\"font-size:1.3rem\">'+esc(q.q)+'</h3>'+listenBtn";
if (!html.includes(h3Warm)) fail('warm-up h3 not found for the line-break tweak');
if (!html.includes(h3Quiz)) fail('quiz h3 not found for the line-break tweak');
html = html.replace(h3Warm, "+'<h3 style=\"margin-top:14px\">'+esc(q.q).replace(/\\n/g,'<br>')+'</h3>'");
html = html.replace(h3Quiz, "+'<h3 style=\"font-size:1.3rem\">'+esc(q.q).replace(/\\n/g,'<br>')+'</h3>'+listenBtn");

/* --- 7b. Pre-existing duplicate repair (found by the post-check) --------- */
// chi-family's TRAILING fresh assignment (the runtime-effective one)
// repeats two warm-up stems verbatim: 叔叔 (shū shu) and 外婆 (wài pó).
// The literal fresh bank does not have them, which is why the tests
// never caught it — but at runtime a child could meet the same question
// in warm-up and again in the quest pool. Replace those two trailing
// fresh questions with two unused family words (孙子 grandson,
// 全家 whole family), verified free of every chi-family bank. Exact
// string match: fail loudly if the file ever changes under us.
const DUP_REPAIRS = [
  ["Q('叔叔 (shū shu) is your…',['grandmother','father’s younger brother','cousin','teacher'],1,'叔叔 is dad’s younger brother.','')",
   "Q('孙子 (sūn zi) means…',['grandson','granddaughter','nephew','cousin'],0,'孙子 is a grandson — your son’s son!','')"],
  ["Q('外婆 (wài pó) is your…',['grandmother (mother’s side)','aunt','sister','neighbour'],0,'外婆 is mum’s mother.','')",
   "Q('全家 (quán jiā) means…',['the whole family','a family photo','my family name','a big house'],0,'全 = whole, 家 = family — the whole family!','')"],
  ["Q('课本 (kè běn) is a…',['textbook','school bag','pencil case','timetable'],0,'课本 is your lesson book.','')",
   "Q('文具 (wén jù) means…',['stationery','textbook','school bag','toy'],0,'文具 is stationery — pens, pencils and rulers!','')"],
  ["Q('铅笔 (qiān bǐ) is a…',['pen','pencil','eraser','ruler'],1,'铅笔 has a wooden body.','')",
   "Q('校车 (xiào chē) is the…',['school bus','school hall','library','canteen'],0,'校 = school, 车 = vehicle — the school bus!','')"],
];
for (const [oldQ, newQ] of DUP_REPAIRS) {
  const first = html.indexOf(oldQ);
  if (first < 0) fail('duplicate-repair target not found: ' + oldQ.slice(0, 50));
  if (html.indexOf(oldQ, first + 1) >= 0) fail('duplicate-repair target is not unique: ' + oldQ.slice(0, 50));
  html = html.slice(0, first) + newQ + html.slice(first + oldQ.length);
}
console.log('  repaired 4 pre-existing Chinese fresh/warm duplicates (chi-family 叔叔/外婆 -> 孙子/全家; chi-school 课本/铅笔 -> 文具/校车)');

/* --- 8. Post-assembly verification (eval the assembled page) ---------------- */
const TOPICS2 = eval('(' + extractVar(html, 'TOPICS') + ')'); // eslint-disable-line no-eval
const FRESH2 = effectiveFRESH(html);
const FRESH2_LITERAL = eval('(' + extractVar(html, 'FRESH_BANK') + ')'); // eslint-disable-line no-eval
const MYKX2 = eval('(' + extractVar(html, 'MYKX_SUBJECTS') + ')'); // eslint-disable-line no-eval
if (TOPICS2.length !== 31) fail('assembled TOPICS.length = ' + TOPICS2.length + ', want 31');
let added = 0;
const sizes = {};
for (const t of TOPICS2) {
  const fresh = FRESH2[t.id] || [];
  const lens = { quest: t.quest.length, warm: t.warm.length, retry: t.retry.length, fresh: fresh.length, p4quest: t.p4quest.length, p4warm: t.p4warm.length, p4retry: t.p4retry.length, p4fresh: t.p4fresh.length };
  for (const [k, min] of [['quest', 5], ['warm', 8], ['retry', 6], ['fresh', 10], ['p4quest', 5], ['p4warm', 8], ['p4retry', 6], ['p4fresh', 10]]) {
    if (lens[k] < min) fail('assembled ' + t.id + ' ' + k + ' = ' + lens[k] + ', want >= ' + min);
  }
  const all = [...t.quest, ...t.warm, ...t.retry, ...fresh, ...t.p4quest, ...t.p4warm, ...t.p4retry, ...t.p4fresh];
  if (new Set(all.map((q) => normStem(q.q))).size !== all.length) fail('assembled ' + t.id + ': duplicate stems inside its combined banks');
  // NOTE: no bag-of-words warm-up/quest check here, deliberately.
  // lib/rules.js warmupOverlapsQuest (union of the whole quest bank's
  // vocabulary, >=3 shared long words) was removed with the fill: once
  // warm-up and quest banks cover the SAME sub-skills, same-skill
  // variants legitimately share phrasing ("What is the missing digit?"
  // with different numbers), and the heuristic flags those as repeats.
  // The real requirement — warm-up never repeats a quest QUESTION —
  // is the exact-stem uniqueness check above.
  const before = origCounts[t.id] || 0;
  const now = all.length;
  added += (now - before);
  sizes[t.id] = lens;
}
if (added !== 1536) fail('assembled banks grew by ' + added + ' questions, want 1,536');
const ids31 = new Set(TOPICS2.map((t) => t.id));
let subsChecked = 0, topicsWithQuests = 0;
for (const s of MYKX2) for (const t of s.topics) {
  if ((t.quests || []).length) topicsWithQuests++;
  else fail('myKx topic still has no quests after the fill: ' + t.id);
  for (const sb of t.subs) {
    subsChecked++;
    if (sb.cov !== 'yes') fail('sub not yes after fill: ' + sb.id);
    if (!sb.map || !ids31.has(sb.map)) fail('sub map missing/not a real topic: ' + sb.id + ' -> ' + sb.map);
  }
}
if (subsChecked !== 161) fail('MYKX subs after fill = ' + subsChecked + ', want 161');
if (topicsWithQuests !== 34) fail('myKx topics with quests = ' + topicsWithQuests + ', want 34');
// math-ntuc BANK_STEMS total (live-gen.test.js expectation).
// Two numbers: the LITERAL count (what live-gen.test.js reads via
// extractVar — its fresh-L3 top-ups land in the trailing assignment,
// invisible to the literal reader) and the RUNTIME-EFFECTIVE count
// (what the app serves: trailing fresh + all top-ups).
const ntuc = TOPICS2.find((t) => t.id === 'math-ntuc');
const ntucStems = [...ntuc.quest, ...ntuc.p4quest, ...FRESH2['math-ntuc'], ...ntuc.p4fresh, ...ntuc.warm, ...ntuc.retry].length;
const ntucStemsLiteral = [...ntuc.quest, ...ntuc.p4quest, ...FRESH2_LITERAL['math-ntuc'], ...ntuc.p4fresh, ...ntuc.warm, ...ntuc.retry].length;

fs.writeFileSync(PAGE_PATH, html);
console.log('assemble-gap-fill OK: ' + PAGE_PATH);
console.log('  topics: 14 -> 31; questions added: ' + added + ' (1,530)');
console.log('  new topics: ' + newIds.join(', '));
console.log('  myKx topics with a Practise quest: ' + topicsWithQuests + '/34; sub-topics cov=yes: ' + subsChecked + '/161');
console.log('  math-ntuc BANK_STEMS now: ' + ntucStems + ' runtime-effective (was 44); ' + ntucStemsLiteral + ' literal-based (live-gen.test.js reads the literal)');
console.log('  assembled bank sizes (quest/warm/fresh/retry/p4quest/p4warm/p4fresh/p4retry):');
for (const [id, l] of Object.entries(sizes)) console.log('    ' + id + ': ' + [l.quest, l.warm, l.fresh, l.retry, l.p4quest, l.p4warm, l.p4fresh, l.p4retry].join('/'));
