// Vibe Zone: Forest Morning (synthesised) was removed 2026-11-05
// at Bryan's request and replaced with two real audio files he
// sent: a background-music track and jungle birdsong.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const assets = path.join(__dirname, '..', 'public', 'assets');

test('both vibe audio files exist and are playable MP3s under 3 MB', () => {
  for (const f of ['vibe-background-music.mp3', 'vibe-jungle-birds.mp3']) {
    const p = path.join(assets, f);
    const st = fs.statSync(p);
    assert.ok(st.size > 100000, f + ' should hold real audio');
    assert.ok(st.size < 3 * 1024 * 1024, f + ' must stay small enough to ship');
    const head = fs.readFileSync(p).subarray(0, 3).toString('latin1');
    assert.ok(head === 'ID3' || head.startsWith('\xff\xfb'), f + ' should be an MP3');
  }
});

test('Vibe Zone offers exactly the two new tracks', () => {
  assert.ok(html.includes("id:'bg-music', name:'Background Music'"), 'Background Music option');
  assert.ok(html.includes("id:'jungle-birds', name:'Jungle Birds'"), 'Jungle Birds option');
  assert.ok(html.includes('assets/vibe-background-music.mp3'), 'bg music file wired in');
  assert.ok(html.includes('assets/vibe-jungle-birds.mp3'), 'jungle birds file wired in');
});

test('Forest Morning is gone: no synth engine, no toggle, no mention in the UI', () => {
  assert.ok(!html.includes('startForest'), 'startForest removed');
  assert.ok(!html.includes('stopForest'), 'stopForest removed');
  assert.ok(!html.includes('forestOn'), 'forestOn flag removed');
  assert.ok(!html.includes('▶ Play Forest Morning'), 'no Forest Morning button');
  assert.ok(!html.includes('Sound: Forest Morning'), 'no Forest Morning in the profile line');
  assert.ok(html.includes('startVibe'), 'file-based startVibe exists');
  assert.ok(html.includes('stopVibe'), 'file-based stopVibe exists');
});

test('vibe player loops the track and switches cleanly', () => {
  const vibe = html.slice(html.indexOf('function startVibe'));
  assert.ok(vibe.includes('a.loop=true'), 'track loops');
  assert.ok(vibe.includes('stopVibe(true)'), 'starting one vibe stops the other first');
  assert.ok(html.includes("if(vibeId===id)stopVibe(); else startVibe(id)"), 'tapping the playing track pauses it');
});

test('Grand Door entry auto-plays Background Music', () => {
  assert.ok(html.includes('function autoVibe()'), 'autoVibe helper exists');
  const calls = (html.match(/sndEntrance\(\); autoVibe\(\);/g) || []).length;
  assert.equal(calls, 2, 'both Grand Door entries (new + returning explorer) auto-play');
});

test('autoVibe: background music starts on entry, stays if already playing', () => {
  // Run the vibe player block with a stub Audio (no real sound in tests).
  const start = html.indexOf('var VIBES=');
  const end = html.indexOf('/* Pip read-aloud', start);
  const code = html.slice(start, end);
  function AudioStub(file) { this.file = file; this.loop = false; this.volume = 0; this.played = false; this.paused = false; }
  AudioStub.prototype.play = function () { this.played = true; return Promise.resolve(); };
  AudioStub.prototype.pause = function () { this.paused = true; };
  const fn = new Function('Audio', 'renderTop', code + '\n;return {startVibe:startVibe, stopVibe:stopVibe, autoVibe:autoVibe, getVibeId:function(){return vibeId;}, getVibeAudio:function(){return vibeAudio;}};');
  const v = fn(AudioStub, function () {});
  assert.equal(v.getVibeId(), null, 'nothing playing at first');
  v.autoVibe();
  assert.equal(v.getVibeId(), 'bg-music', 'autoVibe starts Background Music');
  assert.ok(v.getVibeAudio(), 'an audio object is playing');
  assert.equal(v.getVibeAudio().loop, true, 'it loops');
  assert.equal(v.getVibeAudio().file, 'assets/vibe-background-music.mp3', 'it is the Background Music track');
  const first = v.getVibeAudio();
  v.autoVibe();
  assert.equal(v.getVibeAudio(), first, 'autoVibe does not restart it when already playing');
  v.startVibe('jungle-birds');
  assert.equal(v.getVibeId(), 'jungle-birds', 'jungle birds can play');
  v.autoVibe();
  assert.equal(v.getVibeId(), 'bg-music', 'autoVibe switches back to Background Music');
});
