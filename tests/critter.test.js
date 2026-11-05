// Critter Lab regressions (reported by Bryan with a video, 2026-11-05):
// (1) renaming the critter to a shorter name reverted to the old name
//     on the next sync ("Teddy" lost to "Splash"); (2) tapping a
//     life-cycle stage to look at it kept snapping back to Adult Frog.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function grab(name) {
  const start = html.indexOf('function ' + name);
  assert.ok(start >= 0, name + ' found');
  const end = html.indexOf('\n}\n', start);
  return html.slice(start, end + 3);
}

const pickCritterName = eval(grab('pickCritterName') + '\n;pickCritterName');

test('a later rename wins even when the new name is shorter (Teddy beats Splash)', () => {
  const server = { critterName: 'Splash', critterNameAt: '2026-11-01T10:00:00.000Z' };
  const local = { critterName: 'Teddy', critterNameAt: '2026-11-05T22:30:00.000Z' };
  assert.equal(pickCritterName(server, local).name, 'Teddy', 'the later rename wins');
  assert.equal(pickCritterName(local, server).name, 'Teddy', 'argument order must not matter');
  assert.equal(pickCritterName(server, local).at, '2026-11-05T22:30:00.000Z', 'the winning timestamp is kept');
});

test('an older rename loses to a newer one, whichever side it is on', () => {
  const old = { critterName: 'Teddy', critterNameAt: '2026-11-05T10:00:00.000Z' };
  const newer = { critterName: 'Splash', critterNameAt: '2026-11-05T22:00:00.000Z' };
  assert.equal(pickCritterName(old, newer).name, 'Splash', 'the newer rename wins');
});

test('names never renamed fall back to the old longer-name rule', () => {
  assert.equal(pickCritterName({ critterName: 'Splash' }, { critterName: 'Teddy' }).name, 'Splash', 'no timestamps: longer name wins as before');
  assert.equal(pickCritterName({ critterName: 'Bo' }, { critterName: 'Splash' }).name, 'Splash', 'no timestamps: longer name wins as before');
  assert.equal(pickCritterName({ critterName: 'Teddy', critterNameAt: '2026-11-05T22:00:00.000Z' }, { critterName: 'Splash' }).name, 'Teddy', 'one renamed side beats an unrenamed longer name');
});

test('the merge uses the rename rule, and renaming stamps the time', () => {
  const merge = grab('mergeExplorer');
  assert.ok(merge.includes('pickCritterName(a,b)'), 'mergeExplorer picks the name by rename time');
  assert.ok(!merge.includes('critterName.length>='), 'the old longer-name rule is gone from the merge');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 2000);
  assert.ok(bind.includes('e.critterNameAt=new Date().toISOString()'), 'saving a name stamps when it was renamed');
  assert.ok(html.includes("critterNameAt:null"), 'new explorers start with no rename timestamp');
});

test('the stage viewer is separate from the growth stage', () => {
  assert.ok(html.includes('var critterView=null;'), 'a view-only stage variable exists');
  const page = html.slice(html.indexOf('function critterHTML(){'), html.indexOf('function bindCritter(){'));
  assert.ok(page.includes('var view=(critterView==null?e.critterStage:critterView)'), 'the page shows the viewed stage, defaulting to the growth stage');
  assert.ok(page.includes("STAGE_IMGS[view]"), 'the big picture follows the viewed stage');
  assert.ok(page.includes("(view===i?'sel':'')"), 'the selected thumbnail follows the viewed stage');
  const bind = html.slice(html.indexOf('function bindCritter(){'), html.indexOf('function bindCritter(){') + 2000);
  assert.ok(bind.includes('critterView=i'), 'tapping a stage sets the view');
  // The only write to the growth stage in the handler is the guarded
  // forward-only one — never a plain "e.critterStage=i".
  const withoutGuard = bind.replace('if(i>e.critterStage)e.critterStage=i;', '');
  assert.ok(!withoutGuard.includes('e.critterStage=i'), 'tapping a stage must never overwrite the growth stage outright');
  assert.ok(bind.includes('if(i>e.critterStage)e.critterStage=i'), 'exploring a later stage still grows the frog forward, never backwards');
});
