// Numerical verification of the synthesized audio (dev tool, not shipped).
//
// Opens audio-test.html in headless Chromium, renders every SoundId through an OfflineAudioContext
// (via playSynth) at several pitches, renders the ambience layers offline, runs the master-chain
// stress test and an AudioManager API smoke test, then checks:
//   - every sound is non-silent (RMS > 0.003), peak < 0.95, no NaN, no DC offset
//   - audible durations are sensible (footsteps < 0.3 s, swings 0.2–0.6 s, ...)
//   - the sound has died away before SOUND_INFO.maxDuration (voices are released after it)
//   - every ambience layer is audible, peaks < 0.95, no NaN; master chain never exceeds 0.99
//
// Usage: node scripts/audio-check.mjs [--verbose] [--url http://localhost:5173]
// Uses the running Vite dev server on :5173; if it is down, starts its own on :5184 (and stops it).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node-tools/node_modules/playwright');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const urlIdx = args.indexOf('--url');
const explicitUrl = urlIdx >= 0 ? args[urlIdx + 1] : null;

// ------------------------------------------------------------------------------------------
// Expected audible durations (s, last sample above -40 dB re peak).
// ------------------------------------------------------------------------------------------
const FOOT = [0.03, 0.3];
const RANGES = {
  swordSwing: [0.2, 0.6],
  swordSwingHeavy: [0.2, 0.6],
  swordHitFlesh: [0.08, 0.6],
  swordHitHeavy: [0.1, 0.8],
  swordClash: [0.25, 1.5],
  footstepSand: FOOT,
  footstepWood: FOOT,
  footstepStone: FOOT,
  footstepGrass: FOOT,
  footstepWater: FOOT,
  dodgeRoll: [0.25, 0.7],
  playerHurt: [0.12, 0.6],
  playerDeath: [0.6, 2.0],
  enemyHurt: [0.12, 0.6],
  enemyDeath: [0.6, 2.0],
  enemyAlert: [0.25, 1.0],
  enemyTelegraph: [0.15, 0.8],
  bodyFall: [0.15, 0.9],
  chestOpen: [0.8, 2.4],
  coins: [0.2, 1.4],
  shrineIgnite: [1.5, 4.5],
  shrineRest: [2.0, 5.6],
  uiMove: [0.02, 0.15],
  uiConfirm: [0.1, 0.6],
  uiBack: [0.08, 0.5],
  lockOn: [0.08, 0.5],
  lockOff: [0.05, 0.4],
  staminaEmpty: [0.1, 0.5],
  doorSealed: [1.5, 3.4],
  splash: [0.3, 1.5],
  regionDiscovered: [2.0, 5.0],
  youDied: [2.5, 6.8],
  victory: [0.6, 2.6],
};

const MIN_RMS = 0.003;
const MAX_PEAK = 0.95;

// ------------------------------------------------------------------------------------------
// Dev server
// ------------------------------------------------------------------------------------------
async function reachable(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    // Vite answers unknown paths with index.html (SPA fallback): make sure it is really our page.
    return r.ok && (await r.text()).includes('audioTestPage');
  } catch {
    return false;
  }
}

let server = null;
// AUDIO_CHECK_BASE lets you point the default at another server (also used to test the fallback).
let base = explicitUrl ?? process.env.AUDIO_CHECK_BASE ?? 'http://localhost:5173';
if (!(await reachable(`${base}/audio-test.html`))) {
  if (explicitUrl) {
    console.error(`audio-test.html not reachable at ${explicitUrl}`);
    process.exit(2);
  }
  base = 'http://localhost:5184';
  if (!(await reachable(`${base}/audio-test.html`))) {
    console.log('Dev server on :5173 not reachable — starting vite on :5184 ...');
    // Spawn vite's CLI directly (not through npx) so that kill() really stops it.
    const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
    server = spawn(process.execPath, [viteBin, '--port', '5184', '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    const t0 = Date.now();
    while (!(await reachable(`${base}/audio-test.html`))) {
      if (Date.now() - t0 > 60000) {
        console.error('vite did not start on :5184');
        server.kill();
        process.exit(2);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ------------------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------------------
const BARS = ' ▁▂▃▄▅▆▇█';
function sparkline(envDb, width = 40) {
  if (!envDb.length) return '';
  const n = Math.min(width, envDb.length);
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * envDb.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * envDb.length) / n));
    let m = -90;
    for (let k = a; k < b; k++) m = Math.max(m, envDb[k]);
    const v = Math.max(0, Math.min(1, (m + 60) / 60));
    s += BARS[Math.round(v * (BARS.length - 1))];
  }
  return s;
}
const f3 = (v) => v.toFixed(3);
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

const failures = [];
const fail = (msg) => failures.push(msg);

// ------------------------------------------------------------------------------------------
// Run
// ------------------------------------------------------------------------------------------
const browser = await playwright.chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
let exitCode = 0;
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`[console.error] ${m.text()}`);
  });
  const ready = () => page.waitForFunction(() => window.__audioTest?.ready === true, null, { timeout: 60000 });
  await page.goto(`${base}/audio-test.html`, { waitUntil: 'load' });
  await ready();
  // The shared dev server may full-reload the page while we run (other people editing files):
  // retry a step once the page is ready again.
  const run = async (fn, arg) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await page.evaluate(fn, arg);
      } catch (err) {
        const msg = String(err?.message ?? err);
        if (attempt >= 4 || !/context was destroyed|navigation|Target closed|__audioTest/.test(msg)) throw err;
        console.log(`  (page reloaded by the dev server — retrying, attempt ${attempt + 1})`);
        await page.waitForLoadState('load').catch(() => undefined);
        await ready();
      }
    }
  };

  // ---- one-shots ------------------------------------------------------------------------
  const t0 = Date.now();
  const reports = await run(() => window.__audioTest.analyzeSounds({ pitches: [0.94, 1, 1.06], repeats: 2 }));
  const byId = new Map();
  for (const r of reports) {
    if (!byId.has(r.id)) byId.set(r.id, []);
    byId.get(r.id).push(r);
  }
  console.log(`\nOne-shots: ${reports.length} offline renders in ${((Date.now() - t0) / 1000).toFixed(1)} s (pitch 0.94/1/1.06 × 2, worst case shown)\n`);
  console.log(
    `${pad('sound', 18)} ${lpad('peak', 6)} ${lpad('rms', 7)} ${lpad('dur', 6)} ${lpad('tail', 6)} ${lpad('maxDur', 6)} ${lpad('centroid', 9)} ${lpad('attack', 6)}  envelope (-60..0 dB)`,
  );
  for (const [id, rs] of byId) {
    const peak = Math.max(...rs.map((r) => r.peak));
    const rmsMin = Math.min(...rs.map((r) => r.rms));
    const durMin = Math.min(...rs.map((r) => r.duration));
    const durMax = Math.max(...rs.map((r) => r.duration));
    const tailMax = Math.max(...rs.map((r) => r.tail));
    const nan = rs.some((r) => r.nan);
    const dc = Math.max(...rs.map((r) => Math.abs(r.dc)));
    const centroid = rs.reduce((a, r) => a + r.centroid, 0) / rs.length;
    const attack = Math.max(...rs.map((r) => r.attack));
    const nominal = rs.find((r) => r.pitch === 1) ?? rs[0];
    const range = RANGES[id];
    const flags = [];
    if (!(rmsMin > MIN_RMS)) flags.push(`silent (rms ${rmsMin.toFixed(4)})`);
    if (!(peak < MAX_PEAK)) flags.push(`peak ${f3(peak)} >= ${MAX_PEAK}`);
    if (nan) flags.push('NaN');
    if (dc > 0.01) flags.push(`DC ${dc.toFixed(4)}`);
    if (!range) flags.push('no duration range');
    else if (durMin < range[0] || durMax > range[1]) flags.push(`duration ${f3(durMin)}–${f3(durMax)} outside ${range[0]}–${range[1]}`);
    for (const r of rs) {
      if (r.tail > r.maxDuration) flags.push(`tail ${f3(r.tail)} > maxDuration ${f3(r.maxDuration)} @pitch ${r.pitch}`);
    }
    for (const fl of flags) fail(`${id}: ${fl}`);
    console.log(
      `${pad(id, 18)} ${lpad(f3(peak), 6)} ${lpad(rmsMin.toFixed(4), 7)} ${lpad(durMax.toFixed(2), 6)} ${lpad(tailMax.toFixed(2), 6)} ${lpad(nominal.maxDuration.toFixed(2), 6)} ${lpad(Math.round(centroid) + 'Hz', 9)} ${lpad(attack.toFixed(2), 6)}  ${sparkline(nominal.env)}${flags.length ? '   <-- ' + flags.join('; ') : ''}`,
    );
  }
  const ids = await run(() => [...window.__audioTest.soundIds]);
  for (const id of ids) if (!byId.has(id)) fail(`${id}: not rendered`);

  // ---- ambience -------------------------------------------------------------------------
  const amb = await run(() => window.__audioTest.analyzeAmbience(10));
  console.log('\nAmbience (10 s offline render each, RMS over 2–10 s after the fade-in):\n');
  console.log(`${pad('layer / mix', 18)} ${lpad('rms', 7)} ${lpad('peak', 6)} ${lpad('centroid', 9)}  per-second RMS`);
  for (const a of amb) {
    const flags = [];
    if (!(a.rms > MIN_RMS)) flags.push(`silent (rms ${a.rms.toFixed(4)})`);
    if (!(a.peak < MAX_PEAK)) flags.push(`peak ${f3(a.peak)}`);
    if (a.nan) flags.push('NaN');
    for (const fl of flags) fail(`ambience ${a.name}: ${fl}`);
    const win = a.windows.map((w) => w.toFixed(3)).join(' ');
    console.log(`${pad(a.name, 18)} ${lpad(a.rms.toFixed(4), 7)} ${lpad(f3(a.peak), 6)} ${lpad(Math.round(a.centroid) + 'Hz', 9)}  ${verbose ? win : sparkline(a.windows.map((w) => (w > 0 ? 20 * Math.log10(w) : -90)), 10)}${flags.length ? '   <-- ' + flags.join('; ') : ''}`);
  }

  // ---- master chain ---------------------------------------------------------------------
  const chain = await run(() => window.__audioTest.analyzeChain());
  let worstChain = 0;
  for (const c of chain) {
    worstChain = Math.max(worstChain, c.chainPeak);
    if (!(c.chainPeak < 0.99)) fail(`chain ${c.id}: peak ${f3(c.chainPeak)} through master chain`);
  }
  if (verbose) {
    console.log('\nThrough the master chain (compressor + limiter + reverb), steady state:\n');
    for (const c of chain) {
      const wet = c.wetRms > 0 ? `  reverb ${(20 * Math.log10(c.wetRms / c.chainRms)).toFixed(1)} dB re chain rms` : '';
      console.log(`${pad(c.id, 18)} dry peak ${f3(c.dryPeak)} rms ${c.dryRms.toFixed(4)}  →  chain peak ${f3(c.chainPeak)} rms ${c.chainRms.toFixed(4)}${wet}`);
    }
  }
  const startup = await run(() => window.__audioTest.startupTest('uiConfirm'));
  const startupRatio = startup.startupPeak / startup.steadyPeak;
  console.log(`\nStart-up (sound at t=0.01 s through fresh compressors): ${startup.id} peak ${f3(startup.startupPeak)} vs steady ${f3(startup.steadyPeak)} (${(20 * Math.log10(startupRatio)).toFixed(1)} dB)`);
  if (!(startupRatio > 0.5)) fail(`start-up: first sound attenuated by ${(20 * Math.log10(startupRatio)).toFixed(1)} dB`);
  const stress = await run(() => window.__audioTest.stressTest());
  console.log(`\nMaster chain: worst single-sound peak ${f3(worstChain)}; stress test (all ambience @1 + 36 loud one-shots at once) peak ${f3(stress.peak)}, NaN ${stress.nan}`);
  if (!(stress.peak < 0.99)) fail(`stress test peak ${f3(stress.peak)} >= 0.99`);
  if (stress.nan) fail('stress test produced NaN');

  // ---- AudioManager smoke test ----------------------------------------------------------
  const smoke = await run(() => window.__audioTest.managerSmokeTest());
  console.log('\nAudioManager API smoke test:');
  for (const s of smoke) {
    console.log(`  ${s.ok ? 'ok  ' : 'FAIL'} ${s.check}${s.detail ? ` (${s.detail})` : ''}`);
    if (!s.ok) fail(`manager: ${s.check} ${s.detail ?? ''}`);
  }

  // A failed sample fetch is expected (the smoke test registers a missing file on purpose).
  const unexpected = pageErrors.filter((e) => !/does-not-exist\.wav/.test(e) && !/Failed to load resource/.test(e));
  for (const e of unexpected) fail(`page: ${e}`);
} catch (err) {
  fail(`harness error: ${err?.stack ?? err}`);
} finally {
  await browser.close();
  if (server) server.kill();
}

if (failures.length) {
  console.log(`\nFAILED (${failures.length}):`);
  for (const f of failures) console.log(`  - ${f}`);
  exitCode = 1;
} else {
  console.log('\nAll audio checks passed.');
}
process.exit(exitCode);
