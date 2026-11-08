/*
 * Protel Hilfe – gemeinsame Hilfsfunktionen für die automatischen Tests
 *
 * Voraussetzungen: Node.js und Playwright mit Chromium (require('playwright')).
 * Alle temporären Dateien landen in tests/.tmp/ (nicht im Repository).
 * Es werden ausschließlich erfundene Testdaten verwendet – keine protel-Inhalte, keine echten Daten.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'protel-hilfe');
const TMP = path.join(__dirname, '.tmp');
/** Letzter Stand mit Datenformat 1 (vor den Erweiterungen von Phase 2) */
const OLD_REV = '111f797';

let passed = 0;
let failed = 0;
const failures = [];

function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + msg);
  } else {
    failed++;
    failures.push(msg);
    console.log('  ✗ ' + msg);
  }
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, msg + (a === b ? '' : '  [erwartet ' + String(b).slice(0, 300) + ' | erhalten ' + String(a).slice(0, 300) + ']'));
}

async function section(name, fn) {
  console.log('\n▶ ' + name);
  try {
    await fn();
  } catch (e) {
    failed++;
    failures.push(name + ': ' + e.message);
    console.log('  ✗ Ausnahme: ' + (e.stack || e.message).split('\n').slice(0, 4).join('\n    '));
  }
}

function done() {
  console.log('\nErgebnis: ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen');
  if (failed) console.log('Fehlgeschlagen:\n - ' + failures.join('\n - '));
  process.exit(failed ? 1 : 0);
}

function tmpDir(name) {
  const d = path.join(TMP, name + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function copyApp(dst) {
  fs.cpSync(APP, dst, { recursive: true });
  return dst;
}

/** Alte App-Version (Datenformat 1) aus Git auspacken; liefert den App-Ordner oder null */
function extractOldApp(dst, rev) {
  try {
    fs.mkdirSync(dst, { recursive: true });
    const tar = execFileSync('git', ['archive', rev || OLD_REV, 'protel-hilfe'], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', dst], { input: tar });
    return path.join(dst, 'protel-hilfe');
  } catch (e) {
    console.log('  (alte Version ' + (rev || OLD_REV) + ' nicht verfügbar: ' + e.message.split('\n')[0] + ')');
    return null;
  }
}

/** Inhalt eines Ordners durch einen anderen ersetzen (gleicher Pfad = gleicher Speicher im Browser) */
function replaceDir(dir, src) {
  for (const n of fs.readdirSync(dir)) fs.rmSync(path.join(dir, n), { recursive: true, force: true });
  fs.cpSync(src, dir, { recursive: true });
}

const fileUrl = (dir, hash) => 'file://' + path.join(dir, 'index.html') + (hash || '');

/** Seite öffnen und warten, bis die App bereit ist; sammelt Konsolenfehler in page._errors */
async function openApp(ctx, url) {
  const page = await ctx.newPage();
  page._errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page._errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => page._errors.push('pageerror: ' + e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.PH && PH.app && PH.app.kb && document.documentElement.classList.contains('ready'), null, { timeout: 15000 });
  return page;
}

async function go(page, hash, selector) {
  await page.evaluate((h) => { location.hash = h; }, hash);
  if (selector) await page.waitForSelector(selector, { timeout: 10000 });
  await page.waitForTimeout(80);
}

/** Wartet auf einen Download, ausgelöst durch fn; liefert { name, text } */
async function captureDownload(page, fn) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), fn()]);
  const p = await dl.path();
  return { name: dl.suggestedFilename(), text: fs.readFileSync(p, 'utf8') };
}

/** Testbild als PNG-Datei erzeugen (erfundene Oberfläche, keine protel-Inhalte) */
async function makePng(browser, file, opts) {
  opts = opts || {};
  const w = opts.width || 900;
  const h = opts.height || 560;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent('<html><body style="margin:0;font:20px sans-serif;background:' + (opts.bg || '#eef3fc') + '">' +
    '<div style="padding:30px"><h1 style="margin:0 0 12px">' + (opts.title || 'Testbild') + '</h1>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">' +
    Array.from({ length: 16 }, (_, i) => '<div style="height:70px;border:2px solid #2f5bd3;border-radius:8px;display:grid;place-items:center">Feld ' + (i + 1) + '</div>').join('') +
    '</div></div></body></html>');
  await page.screenshot({ path: file });
  await page.close();
  return file;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

/** Einfacher statischer Webserver (für PWA- und Offline-Tests) */
function serve(root) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(root, u);
      if (!f.startsWith(root)) { res.writeHead(403); res.end(); return; }
      if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
      if (!fs.existsSync(f)) { res.writeHead(404); res.end('nicht gefunden'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + srv.address().port, close: () => new Promise((r) => srv.close(r)) }));
  });
}

/** Erfundene Wissensdatenbank im Datenformat 1 (wie sie die alte App gespeichert hat) */
function legacyKB() {
  const px = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return {
    format: 'protel-hilfe',
    schemaVersion: 1,
    zusatzWurzel: { notiz: 'unbekanntes Feld auf oberster Ebene' },
    meta: { title: 'Testhaus-Wissen', description: 'Erfundene Testdaten', revision: 'rev-test-alt-1', updated: '2026-10-01T08:00:00.000Z', exampleData: false, searchExamples: ['Testfall'], zusatzMeta: 42 },
    categories: [{ id: 'test', name: 'Testkategorie', description: '', icon: 'folder', color: 'blue' }],
    synonyms: [['Testwort', 'Probewort']],
    articles: [
      {
        id: 'test-anleitung', type: 'guide', title: 'Test-Anleitung mit Bildern', categoryId: 'test', summary: 'Erfundener Ablauf', tags: ['Test'], keywords: ['probe'],
        example: false, author: 'Testteam', created: '2026-09-01T08:00:00.000Z', updated: '2026-10-01T08:00:00.000Z', body: 'Einleitung **fett**', related: [],
        zusatzArtikel: ['bleibt', 'erhalten'],
        steps: [
          { title: 'Erster Schritt', text: 'Text 1', hint: 'Tipp 1', image: { src: px, alt: 'Bild eins', markers: [{ x: 10, y: 20, label: 'Feld A' }, { x: 55.5, y: 60, label: '' }] }, zusatzSchritt: true },
          { title: 'Zweiter Schritt', text: 'Text 2', hint: '', image: null },
          { title: 'Dritter Schritt', text: 'Text 3', hint: '', image: { src: 'bilder/extern.png', alt: 'verlinkt', markers: [] } },
        ],
      },
      {
        id: 'test-info', type: 'info', title: 'Test-Information', categoryId: 'test', summary: '', tags: [], keywords: [], example: false, author: '',
        created: '2026-09-01T08:00:00.000Z', updated: '2026-09-02T08:00:00.000Z', body: '| A | B |\n|---|---|\n| 1 | 2 |', related: ['test-anleitung'],
      },
    ],
  };
}

module.exports = {
  ROOT, APP, TMP, OLD_REV, chromium, devices,
  ok, eq, section, done, tmpDir, copyApp, extractOldApp, replaceDir, fileUrl, openApp, go, captureDownload, makePng, serve, legacyKB,
  stats: () => ({ passed, failed }),
};
