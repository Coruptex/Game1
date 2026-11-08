#!/usr/bin/env node
/*
 * Protel Hilfe – Veröffentlichungssperre
 *
 * Verhindert, dass interne Inhalte in die öffentliche Website (GitHub Pages) oder in das öffentliche
 * Repository gelangen. Geprüft wird:
 *  1. data/wissensdatenbank.js: nur ausdrücklich öffentliche Artikel und Bilder (Rechte „oeffentlich“,
 *     Herkunft eigene Grafik, Platzhalter oder Screenshot dieser App), keine Bildplätze, keine Personennamen,
 *     kein „interner Inhaltsstand“.
 *  2. Alle Dateien im App-Ordner: Bilddateien nur, wenn sie in tools/bildfreigabe.json mit passender
 *     Prüfsumme stehen; keine Dateien nach dem Screenshot-Schema (S-ABC-01 …) oder mit „intern“ im Namen;
 *     keine Dateien mit dem Kennzeichen interner Exporte; keine eingebetteten Rasterbilder im Code.
 *  3. Mit --repo zusätzlich alle Dateien des Repositorys (für Commits): dieselben Namens- und Inhaltsregeln.
 *
 * Aufruf:
 *   node tools/pruefe-veroeffentlichung.js              App-Ordner prüfen (auch Teil von build-pwa.js)
 *   node tools/pruefe-veroeffentlichung.js --repo       zusätzlich das ganze Repository prüfen
 *   node tools/pruefe-veroeffentlichung.js --staged     nur zum Commit vorgemerkte Dateien (Git-Hook)
 *   node tools/pruefe-veroeffentlichung.js --freigeben <Pfad im App-Ordner> "<Herkunft>"
 *                                                       eigene, öffentliche Bilddatei in die Freigabeliste aufnehmen
 * Exit-Code: 0 = in Ordnung, 1 = gesperrt, 2 = Bedienfehler.
 * Keine Abhängigkeiten – benötigt nur Node.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP_DIR = 'protel-hilfe';
const ALLOWLIST = path.join(__dirname, 'bildfreigabe.json');
const DATA_FILE = 'data/wissensdatenbank.js';
const PUBLIC_ORIGINS = new Set(['grafik', 'platzhalter', 'app']);
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|ico|tiff?|heic|avif)$/i;
const TEXT_EXT = /\.(js|mjs|cjs|html?|css|json|md|txt|csv|webmanifest|svg|xml|yml|yaml|sh|ps1)$/i;
// Kennzeichen, das die App in interne Exporte schreibt (aus Teilen zusammengesetzt, damit diese Datei sich nicht selbst meldet)
const MARKER = ['PROTEL', 'HILFE', 'INTERN'].join('-');
const PACKAGE_INTERN = /"package"\s*:\s*"intern"/;
const SCREENSHOT_NAME = /(^|[\\/])S-[A-Z]{3}-\d{2,3}[^\\/]*$/i;
const INTERN_NAME = /(^|[\\/])intern([\\/]|$)|protel-hilfe-intern|(^|[-_. ])intern[-_. ]/i;
const RASTER_DATA_URI = /data:image\/(png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]{200,}/;
// Dateien, die das Kennzeichen bewusst enthalten (Code, der es schreibt, und diese Prüfung)
const MARKER_OK = new Set(['protel-hilfe/assets/js/model.js', 'tools/pruefe-veroeffentlichung.js']);

const rel = (p) => p.split(path.sep).join('/');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function loadAllowlist() {
  try {
    const j = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
    return Array.isArray(j.dateien) ? j.dateien : [];
  } catch (e) {
    return [];
  }
}

function walk(dir, base) {
  let out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name === '.git' || name === 'node_modules') continue;
    const full = path.join(dir, name);
    const r = base ? base + '/' + name : name;
    const st = fs.statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full, r));
    else out.push(r);
  }
  return out;
}

function readDataFile(text) {
  const m = text.match(/PROTEL_HILFE_DATEN\s*=\s*/);
  if (!m) throw new Error('Kennung „PROTEL_HILFE_DATEN“ nicht gefunden');
  return JSON.parse(text.slice(m.index + m[0].length).trim().replace(/;\s*$/, ''));
}

/** Prüft den Inhalt der mitgelieferten Wissensdatenbank */
function checkData(raw, where) {
  const p = [];
  const add = (msg) => p.push(where + ': ' + msg);
  if (raw.format !== 'protel-hilfe-2' || Number(raw.schemaVersion) !== 2) add('Datenformat ' + (raw.format || '?') + ' / ' + raw.schemaVersion + ' – erwartet wird Datenformat 2 mit Rechtekennzeichnung.');
  if (raw.meta && raw.meta.package === 'intern') add('ist als „interner Inhaltsstand“ gekennzeichnet.');
  (raw.articles || []).forEach((a) => {
    const t = '„' + (a.title || a.id) + '“';
    if (a.visibility !== 'oeffentlich') add(t + ' ist nicht ausdrücklich als öffentlich gekennzeichnet.');
    if (a.review && a.review.checkedBy) add(t + ' enthält den Namen der prüfenden Person.');
    const imgs = (a.images || []).slice();
    (a.steps || []).forEach((s, i) => {
      if (Array.isArray(s.slots) && s.slots.length) add(t + ', Schritt ' + (i + 1) + ': enthält geplante Bildplätze (interne Aufnahmeplanung).');
      if (s.image) imgs.push(s.image); // Datenformat 1
      (s.images || []).forEach((img) => imgs.push(img));
    });
    imgs.forEach((img) => {
      const name = '„' + (img.caption || img.alt || img.id || 'Bild') + '“';
      if (img.rights !== 'oeffentlich') add(t + ': Bild ' + name + ' ist nicht als öffentlich gekennzeichnet.');
      else if (!PUBLIC_ORIGINS.has(img.origin)) add(t + ': Bild ' + name + ' hat die Herkunft „' + (img.origin || 'nicht angegeben') + '“ – öffentlich sind nur eigene Grafiken, Platzhalter und Screenshots dieser App.');
      if (img.capturedBy) add(t + ': Bild ' + name + ' enthält den Namen der aufnehmenden Person.');
    });
  });
  return p;
}

/** Prüft eine einzelne Datei; relPath relativ zum Repository */
function checkFile(relPath, buf, opts) {
  const p = [];
  const inApp = relPath.startsWith(APP_DIR + '/');
  if (SCREENSHOT_NAME.test(relPath)) p.push(relPath + ': Dateiname nach dem Screenshot-Schema (S-ABC-01 …) – interne Screenshots gehören nicht ins Repository.');
  if (INTERN_NAME.test(relPath)) p.push(relPath + ': „intern“ im Datei- oder Ordnernamen – interne Dateien gehören nicht ins Repository.');
  if (IMAGE_EXT.test(relPath)) {
    const appRel = inApp ? relPath.slice(APP_DIR.length + 1) : relPath;
    const entry = opts.allow.find((x) => x.pfad === appRel || x.pfad === relPath);
    const hash = sha256(buf);
    if (!entry) p.push(relPath + ': Bilddatei steht nicht in tools/bildfreigabe.json (nur eigene, öffentlich zulässige Bilder).');
    else if (entry.sha256 !== hash) p.push(relPath + ': Bilddatei wurde verändert – Prüfsumme passt nicht zur Freigabeliste.');
    else if (entry.rechte !== 'oeffentlich') p.push(relPath + ': Bilddatei ist in der Freigabeliste nicht als öffentlich gekennzeichnet.');
  }
  if (TEXT_EXT.test(relPath) && buf.length < 64 * 1024 * 1024) {
    const text = buf.toString('utf8');
    if (!MARKER_OK.has(relPath) && text.includes(MARKER)) p.push(relPath + ': enthält das Kennzeichen interner Exporte.');
    if (PACKAGE_INTERN.test(text)) p.push(relPath + ': enthält einen „internen Inhaltsstand“.');
    if (relPath === APP_DIR + '/' + DATA_FILE) {
      try {
        p.push(...checkData(readDataFile(text), relPath));
      } catch (e) {
        p.push(relPath + ': nicht lesbar (' + e.message + ').');
      }
    } else if (inApp && RASTER_DATA_URI.test(text)) {
      p.push(relPath + ': enthält ein eingebettetes Rasterbild (data:image/…;base64) – Bilder gehören in die Freigabeliste.');
    }
  }
  return p;
}

/** Dateiliste aus Git – nur, wenn ROOT selbst das Wurzelverzeichnis eines Git-Arbeitsbereichs ist */
function gitFiles(args) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (fs.realpathSync(top) !== fs.realpathSync(ROOT)) return null;
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').map((x) => x.trim()).filter(Boolean);
  } catch (e) {
    return null;
  }
}

/**
 * Führt die Prüfung aus. opts: { repo, staged, root }
 * Liefert { problems: string[], files: number }
 */
function check(opts) {
  opts = opts || {};
  const root = opts.root || ROOT;
  const allow = opts.allow || loadAllowlist();
  let files;
  if (opts.staged) {
    files = gitFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
    if (!files) throw new Error('--staged funktioniert nur im Wurzelverzeichnis eines Git-Arbeitsbereichs.');
  } else if (opts.repo) {
    files = gitFiles(['ls-files', '-co', '--exclude-standard']);
    if (!files) files = walk(root, '');
    files = files.filter((f) => !f.startsWith('.git/'));
  } else {
    files = walk(path.join(root, APP_DIR), '').map((f) => APP_DIR + '/' + f);
    if (!files.includes(APP_DIR + '/' + DATA_FILE)) files.push(APP_DIR + '/' + DATA_FILE);
  }
  const problems = [];
  files.forEach((f) => {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) {
      if (f === APP_DIR + '/' + DATA_FILE) problems.push(f + ': fehlt.');
      return;
    }
    if (fs.statSync(full).isDirectory()) return;
    problems.push(...checkFile(f, fs.readFileSync(full), { allow }));
  });
  return { problems, files: files.length };
}

function freigeben(appRelPath, herkunft) {
  const full = path.join(ROOT, APP_DIR, appRelPath);
  if (!fs.existsSync(full)) throw new Error('Datei nicht gefunden: ' + full);
  if (!IMAGE_EXT.test(appRelPath)) throw new Error('Keine Bilddatei: ' + appRelPath);
  if (SCREENSHOT_NAME.test(appRelPath) || INTERN_NAME.test(appRelPath)) throw new Error('Interne Datei (Name) – nicht freigebbar: ' + appRelPath);
  if (!herkunft) throw new Error('Bitte die Herkunft angeben, z. B. "Eigene Grafik".');
  let j = { hinweis: '', dateien: [] };
  try { j = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8')); } catch (e) { /* neu anlegen */ }
  const entry = { pfad: appRelPath, sha256: sha256(fs.readFileSync(full)), herkunft, rechte: 'oeffentlich', freigegeben: new Date().toISOString().slice(0, 10) };
  j.dateien = (j.dateien || []).filter((x) => x.pfad !== appRelPath).concat(entry).sort((a, b) => a.pfad.localeCompare(b.pfad));
  fs.writeFileSync(ALLOWLIST, JSON.stringify(j, null, 2) + '\n');
  return entry;
}

module.exports = { check, checkData, checkFile, freigeben, MARKER };

if (require.main === module) {
  const argv = process.argv.slice(2);
  try {
    if (argv[0] === '--freigeben') {
      const e = freigeben(argv[1] || '', argv[2] || '');
      console.log('Freigegeben: ' + e.pfad + ' (' + e.herkunft + ')');
      process.exit(0);
    }
    const res = check({ repo: argv.includes('--repo'), staged: argv.includes('--staged') });
    if (res.problems.length) {
      console.error('VERÖFFENTLICHUNG GESPERRT – ' + res.problems.length + ' Problem(e):');
      res.problems.forEach((x) => console.error('  - ' + x));
      console.error('Interne Inhalte gehören in das private Repository bzw. die interne Importdatei, nicht in das öffentliche Repository.');
      process.exit(1);
    }
    console.log('Veröffentlichungsprüfung bestanden (' + res.files + ' Dateien geprüft).');
  } catch (e) {
    console.error('Fehler: ' + e.message);
    process.exit(2);
  }
}
