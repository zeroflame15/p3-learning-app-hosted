// Tests for the simplified Ask Pip: a plain chatbot, no skill
// routing, no "how one agent thinks" machinery.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const askPipSrc = fs.readFileSync(path.join(__dirname, '..', 'api', 'ask-pip.js'), 'utf8');
const clientSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

test('ask-pip no longer routes through think()/skill pack', () => {
  assert.ok(!askPipSrc.includes("require('../lib/think')"), 'must not import think');
  assert.ok(!askPipSrc.includes("require('../lib/skills')"), 'must not import skills');
  assert.ok(!askPipSrc.includes('think('), 'must not call think()');
});

test('ask-pip prompt forbids $ and LaTeX, and demands direct answers', () => {
  assert.ok(askPipSrc.includes('Never use the $ character'), 'prompt forbids $');
  assert.ok(askPipSrc.includes('never deflect'), 'prompt forbids deflection');
  assert.ok(askPipSrc.includes('Answer the question directly'), 'prompt demands a direct answer');
});

test('ask-pip uses the code-decided sum as a fact', () => {
  assert.ok(askPipSrc.includes("require('../lib/arithmetic')"), 'imports arithmetic');
  assert.ok(askPipSrc.includes('extractSimpleSum'), 'extracts the sum');
  assert.ok(askPipSrc.includes('worked out exactly'), 'hands the model the fact');
});

test('ask-pip strips LaTeX from replies', () => {
  assert.ok(askPipSrc.includes('cleanReply'), 'has a cleaner');
  assert.ok(askPipSrc.includes("replace(/\\\\times/g, 'x')"), 'converts \\times');
});

test('client replaces the placeholder by index, not by last message', () => {
  assert.ok(clientSrc.includes('var phIdx=th.msgs.length;'), 'captures placeholder index');
  assert.ok(clientSrc.includes('var last=th2.msgs[phIdx];'), 'updates that exact placeholder');
});

test('offline fallback answers plant, butterfly and verb questions for real', () => {
  const plant = clientSrc.match(/if\(s\.indexOf\('plant'\)>=0[^;]*return '([^']*)'/);
  assert.ok(plant && plant[1].includes('seed'), 'plant fallback gives the life cycle');
  assert.ok(clientSrc.includes('metamorphosis'), 'butterfly fallback gives metamorphosis');
  assert.ok(clientSrc.includes('action word'), 'verb fallback defines a verb');
});
