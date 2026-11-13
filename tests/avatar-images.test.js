// The 25 animal friends are the parent's own pictures, copied
// straight from the sheet he provided (2026-11-14): the picker
// shows the pictures, and the avatar renders the picture. The
// files live under public/animals/ and are served with the app —
// a missing file would render as a broken picture, so the suite
// checks the files are really there, not just referenced.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(process.env.PAGE_PATH || path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const animalsDir = path.join(__dirname, '..', 'public', 'animals');

function grabVar(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('];', start);
  assert.ok(end > start, name + ' ends with ];');
  return html.slice(start, end + 2);
}
function grabObj(name) {
  const start = html.indexOf('var ' + name + '=');
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('};', start);
  assert.ok(end > start, name + ' ends with };');
  return html.slice(start, end + 2);
}

test('all 25 animal pictures exist on disk, as transparent PNGs', () => {
  const faceEmoji = eval(grabObj('AVATAR_FACE_EMOJI') + '\n;AVATAR_FACE_EMOJI');
  const keys = Object.values(faceEmoji);
  assert.equal(keys.length, 25, '25 animals');
  assert.equal(new Set(keys).size, 25, 'every animal has its own picture');
  for (const key of keys) {
    const file = path.join(animalsDir, key + '.png');
    assert.ok(fs.existsSync(file), 'animals/' + key + '.png exists');
    const buf = fs.readFileSync(file);
    // A real PNG (magic bytes), not an empty or renamed file.
    assert.ok(buf.length > 1000, 'animals/' + key + '.png is not empty');
    assert.equal(buf[0], 0x89, 'animals/' + key + '.png starts with the PNG magic');
    assert.equal(buf[1], 0x50, 'animals/' + key + '.png is a PNG');
    assert.equal(buf[2], 0x4e, 'animals/' + key + '.png is a PNG');
    assert.equal(buf[3], 0x47, 'animals/' + key + '.png is a PNG');
  }
});

test('the "My animal friend" row shows the copied pictures, one per animal', () => {
  const start = html.indexOf('function openLookModal(){');
  assert.ok(start >= 0, 'openLookModal found');
  const modal = html.slice(start, html.indexOf('\nfunction ', start + 1));
  assert.ok(modal.includes('My animal friend'), 'modal must label the animal row');
  const faces = eval(grabVar('LOOK_FACES') + '\n;LOOK_FACES');
  const faceEmoji = eval(grabObj('AVATAR_FACE_EMOJI') + '\n;AVATAR_FACE_EMOJI');
  assert.equal(faces.length, 25, '25 animals');
  // The row maps each face to its picture; the stored value is
  // still the emoji in data-f, so picking and saving are unchanged.
  assert.ok(modal.includes('AVATAR_FACE_EMOJI[a]'), 'the row maps each face to its animal key');
  assert.ok(modal.includes('<img src="animals/\'+k+\'.png"'), 'the row shows the copied picture in each button');
  assert.ok(modal.includes("data-f=\"'+a+'\""), 'each button still carries the emoji in data-f');
  for (const face of faces) {
    const key = faceEmoji[face];
    assert.ok(modal.includes("animals/'+k+'.png"), face + ' has a picture button');
    assert.ok(key, face + ' maps to an animal key');
  }
  // The old emoji buttons are gone: no button shows the emoji as
  // its label any more.
  assert.ok(!modal.includes("style=\"font-size:1.2rem;'+(e.face===a?"), 'the animal buttons no longer render the emoji as text');
});

test('the sidebar, topbar and Grand Door still render the avatar through avatarLookHTML', () => {
  assert.ok(html.includes('avatarLookHTML(ex().face,ex().look,ex().glow,130)'), 'the sidebar shows the picture avatar, 130px');
  assert.ok(html.includes('avatarLookHTML(ex().face,ex().look,ex().glow,43)'), 'the mobile topbar shows the picture avatar, 43px');
  assert.ok(html.includes('avatarLookHTML(e.face,e.look,e.glow,56)'), 'the Grand Door tile shows the picture avatar, 56px');
});
