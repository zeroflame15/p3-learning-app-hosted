// Screenshot the round-2 avatar preview with the downloaded Chrome.
'use strict';
const { chromium } = require('/tmp/shot/node_modules/playwright-core');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({
    executablePath: path.join(process.env.HOME, 'chrome-render', 'chrome-linux64', 'chrome'),
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const dir = process.argv[2];
  await page.goto('file://' + path.join(dir, 'preview.html'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(dir, 'proof-full.png'), fullPage: true });
  // Section close-ups: each h2 section's following row.
  const sections = await page.$$('h2');
  const names = ['topleft', 'natural', 'pink', 'teal', 'accs', 'tricky', 'closeups'];
  for (let i = 0; i < sections.length; i++) {
    const el = await sections[i].evaluateHandle(h => h.nextElementSibling);
    await el.screenshot({ path: path.join(dir, 'proof-' + names[i] + '.png') });
  }
  await browser.close();
  console.log('screenshots done');
})().catch(e => { console.error(e); process.exit(1); });
