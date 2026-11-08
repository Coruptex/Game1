#!/usr/bin/env node
/*
 * Protel Hilfe – PWA-Dateiliste und Version aktualisieren
 *
 * Schreibt in protel-hilfe/sw.js die Liste aller App-Dateien (Vorab-Cache für den Offline-Betrieb)
 * und eine Versionskennung (Hash über alle Dateiinhalte). Ändert sich eine Datei, ändert sich die Version,
 * und installierte Apps laden die neue Version im Hintergrund.
 *
 * Aufruf:   node tools/build-pwa.js           (aktualisiert sw.js)
 *           node tools/build-pwa.js --check   (prüft nur; Exit-Code 1, wenn sw.js veraltet ist)
 *
 * Keine Abhängigkeiten – benötigt nur Node.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = path.join(__dirname, '..', 'protel-hilfe');
const SW = path.join(APP, 'sw.js');
const EXCLUDE = new Set(['sw.js', 'LIESMICH.txt']);

function walk(dir, base) {
  let out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) out = out.concat(walk(full, rel));
    else if (!EXCLUDE.has(rel)) out.push(rel);
  }
  return out;
}

const files = walk(APP, '');
const hash = crypto.createHash('sha256');
files.forEach((f) => {
  hash.update(f + '\0');
  hash.update(fs.readFileSync(path.join(APP, f)));
});
const version = hash.digest('hex').slice(0, 12);

const block =
  '// <<PWA-BUILD>> – automatisch gepflegt von tools/build-pwa.js (nicht von Hand ändern)\n' +
  "const VERSION = '" + version + "';\n" +
  'const ASSETS = [\n' + files.map((f) => "  '" + f.replace(/'/g, "\\'") + "',").join('\n') + '\n];\n' +
  '// <</PWA-BUILD>>';

const sw = fs.readFileSync(SW, 'utf8');
const re = /\/\/ <<PWA-BUILD>>[\s\S]*?\/\/ <<\/PWA-BUILD>>/;
if (!re.test(sw)) {
  console.error('Markierung <<PWA-BUILD>> in sw.js nicht gefunden.');
  process.exit(2);
}
const next = sw.replace(re, block);
if (process.argv.includes('--check')) {
  if (next !== sw) {
    console.error('sw.js ist veraltet. Bitte "node tools/build-pwa.js" ausführen.');
    process.exit(1);
  }
  console.log('sw.js ist aktuell (Version ' + version + ', ' + files.length + ' Dateien).');
} else {
  fs.writeFileSync(SW, next);
  console.log('sw.js aktualisiert: Version ' + version + ', ' + files.length + ' Dateien.');
}
