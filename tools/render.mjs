// Rendu image par image de animation.html -> frames JPEG (puis ffmpeg)
// Usage : node tools/render.mjs <outDir> <fps> [start end] | --stills t1,t2,...
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require('node:child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [outDir, fpsArg, a, b] = process.argv.slice(2);
const url = 'file://' + resolve('animation.html') + '?render';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
await page.goto(url);
await page.waitForFunction(() => window.ready === true);
await page.evaluate(() => document.fonts.ready);
const svgEl = await page.$('#stage');
if (fpsArg === '--stills') {
  for (const t of a.split(',').map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await svgEl.screenshot({ path: `${outDir}/still_${String(t).padStart(5, '0')}.png` });
  }
} else {
  const fps = +fpsArg, dur = await page.evaluate(() => window.DURATION);
  const f0 = a ? +a : 0, f1 = b ? +b : Math.round(dur * fps);
  for (let f = f0; f < f1; f++) {
    await page.evaluate(t => window.renderAt(t), f / fps);
    await svgEl.screenshot({ path: `${outDir}/f_${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  }
}
await browser.close();
