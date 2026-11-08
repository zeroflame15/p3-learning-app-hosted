// Screenshot the round-5 avatar preview with the downloaded Chrome,
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
  await page.goto('file://' + path.join(dir, 'preview-5.html'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(dir, 'proof-5-full.png'), fullPage: true });
  // Section close-ups: each h2 section's following row.
  const sections = await page.$$('h2');
  const names = ['topleft', 'all25', 'all25glitter', 'bgs-shapes', 'bgs-colours', 'bgs-effects', 'patterns', 'taptoplay', 'croc', 'closeups', 'anim'];
  for (let i = 0; i < sections.length; i++) {
    const el = await sections[i].evaluateHandle(h => h.nextElementSibling);
    await el.screenshot({ path: path.join(dir, 'proof-5-' + names[i] + '.png') });
  }
  // Animated backgrounds, second frame: the effects section (index 5)
  // holds the twinkle / bubbles / petals cells. The main loop shot it
  // as proof-5-bgs-effects.png (frame A); wait ~3.5s and shoot it
  // again — the bubbles have risen, the petals have fallen and the
  // twinkle stars are in a different phase, so the motion reads in
  // the two stills.
  await page.waitForTimeout(3500);
  const animBg = await sections[5].evaluateHandle(h => h.nextElementSibling);
  await animBg.screenshot({ path: path.join(dir, 'proof-5-anim-bg-b.png') });
  // Animation frames from the proof page: seek each animation to an
  // exact phase, keep it paused, screenshot. Frame 1: blink closed
  // (93% of the 4.6s blink = 4280ms), bob low, frog at the bottom of
  // its hop. Frame 2: eyes open, bob rising (25% of 3.6s = 900ms),
  // rabbit ears mid-wiggle (25% of 5s = 1250ms). Frame 3: eyes open,
  // frog at the top of its hop (12% of 2.8s = 336ms), bob at the top
  // (50% of 3.6s = 1800ms).
  const anim = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await anim.goto('file://' + path.join(dir, 'anim-proof-5.html'));
  await anim.waitForTimeout(400);
  const frames = [
    { name: 'anim-f1-blink', blink: 4280, bob: 0, hop: 0, earwig: 0 },
    { name: 'anim-f2-earwig', blink: 0, bob: 900, hop: 0, earwig: 1250 },
    { name: 'anim-f3-hop', blink: 0, bob: 1800, hop: 336, earwig: 0 },
  ];
  for (const f of frames) {
    await anim.evaluate((f) => {
      document.getAnimations().forEach((an) => {
        const n = an.animationName || '';
        // Iteration time = currentTime − delay. Seek the ITERATION
        // time to the target phase, then set currentTime to
        // iteration + delay — adding a whole cycle if that would
        // go negative, so the animation is actually running and
        // not sitting in its delay phase showing the 0% state.
        // (Wrapping currentTime itself into [0, duration) was
        // wrong: with a large positive delay it lands below the
        // delay and the animation shows nothing at all — that is
        // why the blink frame once showed every eye open.)
        const d = (an.effect && an.effect.getTiming) ? (an.effect.getTiming().delay || 0) : 0;
        const dur = (an.effect && an.effect.getTiming) ? (an.effect.getTiming().duration || 0) : 0;
        let target = 0;
        if (n === 'av5Blink') target = f.blink;
        else if (n === 'av5Bob') target = f.bob;
        else if (n === 'av5Hop') target = f.hop;
        else if (n === 'av5EarWig') target = f.earwig;
        let it = dur ? (target % dur) : target;
        let ct = it + d;
        if (ct < 0) ct += dur;
        an.currentTime = ct;
        an.pause();
      });
    }, f);
    await anim.waitForTimeout(150);
    await anim.screenshot({ path: path.join(dir, 'proof-5-' + f.name + '.png') });
  }
  await browser.close();
  console.log('screenshots done');
})().catch(e => { console.error(e); process.exit(1); });
