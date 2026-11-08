#!/usr/bin/env node
/*
 * Protel Hilfe – alle automatischen Tests ausführen
 * Aufruf: node tests/run-all.js            (alle Testdateien t01 … t11)
 *         node tests/run-all.js t04 t06    (nur ausgewählte)
 * Ergebnis: Zusammenfassung in der Konsole und als Bericht in tests/.tmp/testbericht.md
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TMP = path.join(__dirname, '.tmp');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const only = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter((f) => /^t\d\d-.+\.js$/.test(f)).sort()
  .filter((f) => !only.length || only.some((o) => f.startsWith(o)));

const rows = [];
let total = 0;
let failedTotal = 0;
const started = Date.now();
for (const f of files) {
  const t0 = Date.now();
  process.stdout.write(f.padEnd(28) + ' … ');
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /Ergebnis: (\d+) bestanden, (\d+) fehlgeschlagen/.exec(out);
  const passed = m ? +m[1] : 0;
  const failed = m ? +m[2] : 1;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  total += passed + failed;
  failedTotal += failed;
  const ok = r.status === 0 && failed === 0;
  console.log((ok ? 'OK    ' : 'FEHLER') + '  ' + passed + ' bestanden, ' + failed + ' fehlgeschlagen  (' + secs + ' s)');
  if (!ok) console.log(out.split('\n').filter((l) => /✗|Ausnahme|Error/.test(l)).slice(0, 20).map((l) => '    ' + l.trim()).join('\n'));
  rows.push({ f, ok, passed, failed, secs, out });
  fs.writeFileSync(path.join(TMP, f.replace(/\.js$/, '.log')), out);
}

const sum = 'Gesamt: ' + (total - failedTotal) + ' von ' + total + ' Prüfungen bestanden, ' + failedTotal + ' fehlgeschlagen (' + ((Date.now() - started) / 1000).toFixed(0) + ' s)';
console.log('\n' + sum);
const md = ['# Testbericht Protel Hilfe', '', 'Stand: ' + new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC · Node ' + process.version, '', sum, '',
  '| Testdatei | Ergebnis | bestanden | fehlgeschlagen | Dauer |', '|---|---|---|---|---|']
  .concat(rows.map((r) => '| ' + r.f + ' | ' + (r.ok ? 'OK' : 'FEHLER') + ' | ' + r.passed + ' | ' + r.failed + ' | ' + r.secs + ' s |'))
  .concat(['', '## Einzelprüfungen', ''])
  .concat(rows.map((r) => '### ' + r.f + '\n\n```\n' + r.out.split('\n').filter((l) => /^\s*[✓✗▶]|Ergebnis/.test(l)).join('\n') + '\n```\n'));
fs.writeFileSync(path.join(TMP, 'testbericht.md'), md.join('\n'));
console.log('Bericht: ' + path.join(TMP, 'testbericht.md'));
process.exit(failedTotal ? 1 : 0);
