// Screenshot the round-4 avatar preview with the downloaded Chrome,
// plus 3 deterministic animation frames (seek the real CSS animations
// via the Web Animations API and pause them — the blink is a 0.14s
// event in a 4.6s cycle, so wall-clock timing would almost never
// catch it).
'use strict';
const { chromium } = require('/tmp/shot/node_modules/playwright-core');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    executablePath: path.join(process.env.HOME, 'chrome-render', 'chrome-linux64', 'chrome'),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const dir = process.argv[2];
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto('file://' + path.join(dir, 'preview-4.html'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(dir, 'proof-4-full.png'), fullPage: true });
  // Section close-ups: each h2 section's following row.
  const sections = await page.$$('h2');
  const names = ['topleft', 'natural', 'pink', 'teal', 'accs', 'tricky', 'closeups', 'anim'];
  for (let i = 0; i < sections.length; i++) {
    const el = await sections[i].evaluateHandle(h => h.nextElementSibling);
    await el.screenshot({ path: path.join(dir, 'proof-4-' + names[i] + '.png') });
  }
  // Animation frames from the proof page: seek each animation to an
  // exact phase, keep it paused, screenshot. Frame 1: blink closed
  // (93% of the 4.6s blink = 4280ms), bob low, flutter open.
  // Frame 2: eyes open, flutter most folded (50% of 1.8s = 900ms),
  // bob rising (25% of 3.6s = 900ms). Frame 3: eyes open, flutter
  // open, frog at the top of its hop (86% of 2.8s = 2408ms), bob at
  // the top (50% of 3.6s = 1800ms).
  const anim = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await anim.goto('file://' + path.join(dir, 'anim-proof-4.html'));
  await anim.waitForTimeout(400);
  const frames = [
    { name: 'anim-f1-blink', blink: 4280, bob: 0, flutter: 0, hop: 0 },
    { name: 'anim-f2-flutter', blink: 0, bob: 900, flutter: 900, hop: 0 },
    { name: 'anim-f3-hop', blink: 0, bob: 1800, flutter: 0, hop: 2408 },
  ];
  for (const f of frames) {
    await anim.evaluate((f) => {
      document.getAnimations().forEach((an) => {
        const n = an.animationName || '';
        // Iteration time = currentTime − delay, and the bob/blink
        // groups carry a negative inline delay (staggered starts),
        // so seek to target + delay or the phase lands wrong.
        const d = (an.effect && an.effect.getTiming) ? (an.effect.getTiming().delay || 0) : 0;
        const dur = (an.effect && an.effect.getTiming) ? (an.effect.getTiming().duration || 0) : 0;
        let target = 0;
        if (n === 'avBlink') target = f.blink;
        else if (n === 'avBob') target = f.bob;
        else if (n === 'avHop') target = f.hop;
        else if (n === 'avFlutterL' || n === 'avFlutterR') target = f.flutter;
        // currentTime may not go negative (the animation would sit
        // in its delay phase showing the 0% state), so wrap it into
        // [0, duration): the infinite animation wraps anyway.
        let ct = target + d;
        if (dur) ct = ((ct % dur) + dur) % dur;
        an.currentTime = ct;
        an.pause();
      });
    }, f);
    await anim.waitForTimeout(150);
    await anim.screenshot({ path: path.join(dir, 'proof-4-' + f.name + '.png') });
  }
  await browser.close();
  console.log('screenshots done');
})().catch(e => { console.error(e); process.exit(1); });
