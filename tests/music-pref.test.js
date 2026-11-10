// Music preference (2026-11-10, Bryan): each explorer's music choice
// (Background Music, Jungle Birds, or mute) is remembered, so the app
// plays THAT choice on next entry instead of always resetting to
// Background Music. The choice lives on the explorer as musicPref
// ('bg-music' | 'jungle-birds' | 'mute') with a musicPrefAt
// timestamp (later wins, same rule as diffPref), and autoVibe()
// honours it.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

// Brace-matching extractor (from tests/memory-merge.test.js): several
// of these functions nest other functions, so slicing to the next
// '\nfunction ' would cut them short.
function grabFn(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  let i = html.indexOf('{', start);
  let depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' braces never balanced');
}

const mergeExplorer = eval([
  'unionArr', 'unionObjMax', 'unionObjLatest', 'isThinkingMsg',
  'mergeThreads', 'pickCritterName', 'mergeCare', 'mergeLetters', 'mergeExplorer',
].map(grabFn).join('\n') + '\n; mergeExplorer;');

function explorer(overrides) {
  const base = {
    id: 'e1', name: 'Test', stars: 0, critterStage: 0, badges: [], treasures: [],
    discoveredCritters: [], completed: {}, completedDay: {}, playDoneDay: {},
    hclMissed: [], favAnswers: [], progress: {}, playProgress: {}, playBest: {},
    daily: {}, totalMinutes: 0, mood: {}, stuckCount: {}, threads: [],
    deletedThreadIds: [], flashcards: [], deletedFlashcards: [], planner: [],
    deletedPlanner: [], friends: [], deletedFriends: [], friendCode: 'ABCDEF',
    nameAt: null, glow: '#ffb020', badge: '⭐', face: '🦦', lookAt: null,
    critterName: 'Splash', critterNameAt: null, care: {}, careGrewDay: null,
  };
  return Object.assign(base, overrides);
}

// --- Vibe player block (real code, stub Audio + stub ex) ---

function vibePlayer(activeExplorer) {
  const start = html.indexOf('var VIBES=');
  const end = html.indexOf('/* Pip read-aloud', start);
  const code = html.slice(start, end);
  function AudioStub(file) { this.file = file; this.loop = false; this.volume = 0; this.played = false; this.paused = false; }
  AudioStub.prototype.play = function () { this.played = true; return Promise.resolve(); };
  AudioStub.prototype.pause = function () { this.paused = true; };
  // ex is a parameter so autoVibe can read the active explorer's
  // musicPref; passing undefined models "no active explorer".
  const fn = new Function('Audio', 'renderTop', 'ex', code + '\n;return {startVibe:startVibe, stopVibe:stopVibe, autoVibe:autoVibe, getVibeId:function(){return vibeId;}, getVibeAudio:function(){return vibeAudio;}};');
  return fn(AudioStub, function () {}, function () { return activeExplorer || null; });
}

test('new explorers default to musicPref bg-music', () => {
  assert.ok(html.includes("musicPref:'bg-music', musicPrefAt:null"), 'newExplorer must default musicPref to bg-music with a null timestamp');
});

test('mergeExplorer carries musicPref: later timestamp wins', () => {
  const server = explorer({ musicPref: 'bg-music', musicPrefAt: '2026-11-10T08:00:00.000Z' });
  const local = explorer({ musicPref: 'jungle-birds', musicPrefAt: '2026-11-10T18:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.musicPref, 'jungle-birds', 'the newer jungle-birds pick survives the merge');
  assert.equal(merged.musicPrefAt, '2026-11-10T18:00:00.000Z', 'the newer timestamp is kept');
  const merged2 = mergeExplorer(local, server);
  assert.equal(merged2.musicPref, 'jungle-birds', 'the newer pick wins whichever side it arrives on');
});

test('mergeExplorer carries mute: a mute pick survives the merge', () => {
  const server = explorer({ musicPref: 'jungle-birds', musicPrefAt: '2026-11-10T08:00:00.000Z' });
  const local = explorer({ musicPref: 'mute', musicPrefAt: '2026-11-10T19:00:00.000Z' });
  const merged = mergeExplorer(server, local);
  assert.equal(merged.musicPref, 'mute', 'the newer mute pick survives the merge instead of reverting to a track');
});

test('mergeExplorer never invents musicPref on a legacy explorer', () => {
  const server = explorer({});
  const local = explorer({});
  delete server.musicPref; delete server.musicPrefAt;
  delete local.musicPref; delete local.musicPrefAt;
  const merged = mergeExplorer(server, local);
  assert.equal(merged.musicPref, undefined, 'a merge must not invent musicPref on a legacy explorer, or a no-change pull would report a change');
  assert.equal(merged.musicPrefAt, undefined, 'a merge must not invent musicPrefAt either');
});

test('mergeExplorer: a stale device cannot resurrect an old track choice', () => {
  // The child picked jungle birds (later timestamp) on one device;
  // the other device still holds the old bg-music pick (earlier
  // timestamp). The newer pick must win, not the stale one.
  const stale = explorer({ musicPref: 'bg-music', musicPrefAt: '2026-11-09T08:00:00.000Z' });
  const fresh = explorer({ musicPref: 'jungle-birds', musicPrefAt: '2026-11-10T08:00:00.000Z' });
  assert.equal(mergeExplorer(stale, fresh).musicPref, 'jungle-birds', 'fresh pick beats stale bg-music');
  assert.equal(mergeExplorer(fresh, stale).musicPref, 'jungle-birds', 'fresh pick beats stale bg-music whichever side it arrives on');
});

test('autoVibe honours the active explorer jungle-birds preference', () => {
  const v = vibePlayer({ musicPref: 'jungle-birds', musicPrefAt: '2026-11-10T08:00:00.000Z' });
  assert.equal(v.getVibeId(), null, 'nothing playing at first');
  v.autoVibe();
  assert.equal(v.getVibeId(), 'jungle-birds', 'autoVibe starts Jungle Birds for an explorer whose pick is jungle birds');
  assert.equal(v.getVibeAudio().file, 'assets/vibe-jungle-birds.mp3', 'it is the Jungle Birds track');
  assert.equal(v.getVibeAudio().loop, true, 'it loops');
  const first = v.getVibeAudio();
  v.autoVibe();
  assert.equal(v.getVibeAudio(), first, 'autoVibe does not restart it when already playing');
});

test('autoVibe honours a mute preference: nothing plays', () => {
  const v = vibePlayer({ musicPref: 'mute', musicPrefAt: '2026-11-10T08:00:00.000Z' });
  v.autoVibe();
  assert.equal(v.getVibeId(), null, 'autoVibe must not start any track for a muted explorer');
  assert.equal(v.getVibeAudio(), null, 'no audio object is playing');
});

test('autoVibe: mute stops a track still playing from a previous explorer', () => {
  // Build one player, start bg-music, then swap the active explorer
  // to a muted one and call autoVibe again — the track must stop.
  const start = html.indexOf('var VIBES=');
  const end = html.indexOf('/* Pip read-aloud', start);
  const code = html.slice(start, end);
  function AudioStub(file) { this.file = file; this.loop = false; this.volume = 0; this.played = false; this.paused = false; }
  AudioStub.prototype.play = function () { this.played = true; return Promise.resolve(); };
  AudioStub.prototype.pause = function () { this.paused = true; };
  let active = { musicPref: 'bg-music', musicPrefAt: '2026-11-10T08:00:00.000Z' };
  const fn = new Function('Audio', 'renderTop', 'ex', code + '\n;return {startVibe:startVibe, stopVibe:stopVibe, autoVibe:autoVibe, getVibeId:function(){return vibeId;}, getVibeAudio:function(){return vibeAudio;}};');
  const v = fn(AudioStub, function () {}, function () { return active; });
  v.startVibe('bg-music');
  assert.equal(v.getVibeId(), 'bg-music', 'bg-music playing');
  active = { musicPref: 'mute', musicPrefAt: '2026-11-10T09:00:00.000Z' };
  v.autoVibe();
  assert.equal(v.getVibeId(), null, 'autoVibe stops the track when the new explorer is muted');
});

test('autoVibe: legacy explorers without musicPref still get Background Music', () => {
  const v = vibePlayer({ name: 'Legacy' });
  v.autoVibe();
  assert.equal(v.getVibeId(), 'bg-music', 'a legacy explorer without musicPref defaults to Background Music');
  // No active explorer at all: same fallback.
  const v2 = vibePlayer(null);
  v2.autoVibe();
  assert.equal(v2.getVibeId(), 'bg-music', 'no active explorer falls back to Background Music');
});

test('Vibe page shows which choice is the saved preference', () => {
  assert.ok(html.includes('Your pick:'), 'Vibe page must show the saved pick');
  assert.ok(html.includes('✓ Your pick — plays when you come in.'), 'the picked track card must carry a Your pick badge');
  assert.ok(html.includes('🔇 Quiet is your pick'), 'a mute pick must be shown on the Vibe page');
});

test('picking a vibe on the Vibe page saves the preference', () => {
  const start = html.indexOf('function bindVibe(){');
  assert.ok(start >= 0, 'bindVibe not found');
  const b = html.slice(start, html.indexOf('\n}\n', start));
  assert.ok(b.includes("e.musicPref='mute'"), 'pausing a track must save mute');
  assert.ok(b.includes('e.musicPref=id'), 'playing a track must save its id');
  assert.ok(b.includes('e.musicPrefAt=new Date().toISOString()'), 'the pick must be timestamped so the merge can tell it is the newer choice');
  assert.ok(b.includes('save()'), 'the pick must be persisted');
});

test('toolbar music toggle saves the preference and unmutes to the saved pick', () => {
  const start = html.indexOf("document.getElementById('tbMusic')");
  assert.ok(start >= 0, 'tbMusic handler not found');
  const b = html.slice(start, html.indexOf('\n', start));
  assert.ok(b.includes("e.musicPref='mute'"), 'toggling music off must save mute');
  assert.ok(b.includes('var pref=(e&&e.musicPref)'), 'toggling music on must read the saved preference');
  assert.ok(b.includes("var id=(pref==='mute')?lastVibeId:pref"), 'unmuting must play the saved pick (or the last track when the pick is mute)');
  assert.ok(b.includes('save()'), 'the toggle must persist the choice');
});
