#!/usr/bin/env node
/*
 * Protel Hilfe – PWA-Dateiliste und Version aktualisieren
 *
 * Schreibt in protel-hilfe/sw.js die Liste aller App-Dateien (Vorab-Cache für den Offline-Betrieb)
 * und eine Versionskennung (Hash über alle Dateiinhalte). Ändert sich eine Datei, ändert sich die Version,
 * und installierte Apps laden die neue Version im Hintergrund.
 *
 * Vorher läuft immer die Veröffentlichungsprüfung (tools/pruefe-veroeffentlichung.js).
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

// Veröffentlichungssperre: Ohne bestandene Prüfung gibt es weder Build noch Veröffentlichung
// (keine internen Artikel, Bilder oder Bildplätze im App-Ordner, nur freigegebene Bilddateien).
const guard = require('./pruefe-veroeffentlichung.js').check();
if (guard.problems.length) {
  console.error('Abgebrochen – Veröffentlichungsprüfung fehlgeschlagen (' + guard.problems.length + ' Problem(e)):');
  guard.problems.forEach((x) => console.error('  - ' + x));
  process.exit(1);
}
const SW = path.join(APP, 'sw.js');
const EXCLUDE = new Set(['sw.js', 'LIESMICH.txt']);
const { isAppFile, isSystemJunk } = require('./pruefe-veroeffentlichung.js');
const CHECK = process.argv.includes('--check');

// Lizenztexte für die Anzeige in der App (#/lizenzen) aus LIZENZEN.txt erzeugen
const LIC_JS = path.join(APP, 'assets', 'js', 'lizenzen.js');
const licText = fs.readFileSync(path.join(APP, 'LIZENZEN.txt'), 'utf8').replace(/\r\n/g, '\n');
const licRe = /\/\/ <<LIZENZEN>>[\s\S]*?\/\/ <<\/LIZENZEN>>/;
const licOld = fs.readFileSync(LIC_JS, 'utf8');
if (!licRe.test(licOld)) {
  console.error('Markierung <<LIZENZEN>> in assets/js/lizenzen.js nicht gefunden.');
  process.exit(2);
}
const licNew = licOld.replace(licRe, '// <<LIZENZEN>> – automatisch erzeugt aus LIZENZEN.txt (nicht von Hand ändern)\n  PH.LIZENZEN = ' +
  JSON.stringify(licText) + ';\n  // <</LIZENZEN>>');
if (licNew !== licOld) {
  if (CHECK) {
    console.error('assets/js/lizenzen.js passt nicht zu LIZENZEN.txt. Bitte "node tools/build-pwa.js" ausführen.');
    process.exit(1);
  }
  fs.writeFileSync(LIC_JS, licNew);
  console.log('assets/js/lizenzen.js aus LIZENZEN.txt aktualisiert.');
}

// Nur Dateien, die zur App gehören (Positivliste der Veröffentlichungsprüfung); Systemdateien wie Thumbs.db nie
function walk(dir, base) {
  let out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.') || isSystemJunk(name)) continue;
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) out = out.concat(walk(full, rel));
    else if (!EXCLUDE.has(rel) && isAppFile(rel)) out.push(rel);
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
if (CHECK) {
  if (next !== sw) {
    console.error('sw.js ist veraltet. Bitte "node tools/build-pwa.js" ausführen.');
    process.exit(1);
  }
  console.log('sw.js ist aktuell (Version ' + version + ', ' + files.length + ' Dateien).');
} else {
  fs.writeFileSync(SW, next);
  console.log('sw.js aktualisiert: Version ' + version + ', ' + files.length + ' Dateien.');
}
