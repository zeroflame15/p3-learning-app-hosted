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
