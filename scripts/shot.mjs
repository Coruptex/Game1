// Headless screenshot / scripted-play harness (dev tool, not shipped).
// Usage: node scripts/shot.mjs <url> <out.png> [script.json]
//   script.json: array of steps { "eval": "js" } | { "wait": ms } | { "shot": "file.png" } | { "key": "KeyW", "ms": 500 }
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright');
}

const [, , url = 'http://localhost:5173/?debug', out = 'screenshots/shot.png', scriptPath] = process.argv;
const steps = scriptPath ? JSON.parse(fs.readFileSync(scriptPath, 'utf8')) : [];

const browser = await playwright.chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1280), height: Number(process.env.H || 720) } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(url, { waitUntil: 'load' });
// wait for the game to finish loading
const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  const ready = await page.evaluate(() => {
    if (window.__viewerReady) return true;
    const g = window.__game;
    return !!g && g.state !== 'loading';
  }).catch(() => false);
  if (ready) break;
  await page.waitForTimeout(500);
}
await page.waitForTimeout(Number(process.env.SETTLE || 1500));

fs.mkdirSync('screenshots', { recursive: true });
for (const step of steps) {
  if (step.eval) {
    const r = await page.evaluate(step.eval);
    if (r !== undefined) console.log('eval:', JSON.stringify(r));
  }
  if (step.wait) await page.waitForTimeout(step.wait);
  if (step.key) {
    await page.keyboard.down(step.key);
    await page.waitForTimeout(step.ms ?? 300);
    await page.keyboard.up(step.key);
  }
  if (step.shot) await page.screenshot({ path: step.shot });
}
await page.screenshot({ path: out });
fs.writeFileSync(out.replace(/\.png$/, '.log'), logs.join('\n'));
console.log(logs.filter((l) => /error|warn/i.test(l)).slice(0, 40).join('\n'));
await browser.close();
