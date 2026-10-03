// Scripted gameplay test using the debug API (fixed-step simulation, no real-time dependency).
// Usage: node scripts/playtest.mjs <scenario.json> [url]
// Steps: {"eval": js} | {"down": code} | {"up": code} | {"advance": seconds} | {"press": action}
//        {"shot": file} | {"mouse": "down"|"up", "button": "left"|"right"|"middle"} | {"wheel": dy} | {"sleep": ms} | {"log": label}
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node-tools/node_modules/playwright'); }

const [, , scenarioPath, url = 'http://localhost:5190/?debug&nosave'] = process.argv;
const steps = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
const browser = await playwright.chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const touchMode = !!steps[0]?.touch_device;
const page = await browser.newPage({
  viewport: { width: Number(process.env.W || (touchMode ? 932 : 1280)), height: Number(process.env.H || (touchMode ? 430 : 720)) },
  hasTouch: touchMode,
  isMobile: touchMode,
  deviceScaleFactor: 1,
});
const cdp = touchMode ? await page.context().newCDPSession(page) : null;
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
if (steps[0]?.fakepad) {
  await page.addInitScript((id) => {
    const pad = { id, axes: [0, 0, 0, 0], pressed: new Set() };
    window.__fakePad = pad;
    navigator.getGamepads = () => [
      {
        id: pad.id,
        index: 0,
        connected: true,
        mapping: 'standard',
        timestamp: performance.now(),
        axes: pad.axes.slice(),
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pad.pressed.has(i), touched: pad.pressed.has(i), value: pad.pressed.has(i) ? 1 : 0 })),
      },
    ];
  }, steps[0].fakepad);
}
await page.goto(url, { waitUntil: 'load' });
const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  const ready = await page.evaluate(() => !!window.__game && window.__game.phase !== 'loading').catch(() => false);
  if (ready) break;
  await page.waitForTimeout(500);
}
await page.evaluate(() => {
  window.__game.debug.start();
  window.__game.debug.drive(true);
});
fs.mkdirSync('screenshots', { recursive: true });
for (const s of steps) {
  if (s.log) console.log(`--- ${s.log}`);
  if (s.down) await page.keyboard.down(s.down);
  if (s.up) await page.keyboard.up(s.up);
  if (s.mouse) {
    await page.mouse.move(640, 360);
    if (s.mouse === 'down') await page.mouse.down({ button: s.button ?? 'left' });
    else await page.mouse.up({ button: s.button ?? 'left' });
  }
  if (s.sleep) await page.waitForTimeout(s.sleep);
  if (s.wheel) {
    await page.mouse.move(640, 360);
    await page.mouse.wheel(0, s.wheel);
  }
  if (s.press) await page.evaluate((a) => window.__game.debug.press(a), s.press);
  if (s.touch && cdp) {
    const type = s.touch === 'start' ? 'touchStart' : s.touch === 'move' ? 'touchMove' : 'touchEnd';
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: s.touch === 'end' ? [] : s.points });
  }
  if (s.pad) {
    await page.evaluate((p) => {
      const pad = window.__fakePad;
      if (p.axes) pad.axes = p.axes;
      if (p.down) for (const b of p.down) pad.pressed.add(b);
      if (p.up) for (const b of p.up) pad.pressed.delete(b);
    }, s.pad);
  }
  if (s.advance) await page.evaluate((sec) => window.__game.debug.advance(sec), s.advance);
  if (s.eval) {
    const r = await page.evaluate(s.eval);
    if (r !== undefined) console.log(JSON.stringify(r));
  }
  if (s.shot) {
    await page.evaluate(() => window.__game.frame(0.0001));
    await page.screenshot({ path: s.shot });
  }
}
const errs = logs.filter((l) => /error/i.test(l));
if (errs.length) console.log('ERRORS:\n' + errs.slice(0, 20).join('\n'));
await browser.close();
