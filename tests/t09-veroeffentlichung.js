/* Veröffentlichungssperre (tools/pruefe-veroeffentlichung.js), Build-Sperre und Git-Hook –
   geprüft an Kopien des Projekts, in die absichtlich interne Inhalte gelegt werden. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib');

const MARK = ['PROTEL', 'HILFE', 'INTERN'].join('-');

function project() {
  const dir = L.tmpDir('sperre');
  fs.cpSync(L.APP, path.join(dir, 'protel-hilfe'), { recursive: true });
  fs.cpSync(path.join(L.ROOT, 'tools'), path.join(dir, 'tools'), { recursive: true });
  return dir;
}

function run(dir, args) {
  const r = spawnSync(process.execPath, [path.join(dir, 'tools', 'pruefe-veroeffentlichung.js')].concat(args || []), { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

function editData(dir, fn) {
  const f = path.join(dir, 'protel-hilfe', 'data', 'wissensdatenbank.js');
  const text = fs.readFileSync(f, 'utf8');
  const i = text.indexOf('window.PROTEL_HILFE_DATEN = ');
  const raw = JSON.parse(text.slice(i + 28).trim().replace(/;\s*$/, ''));
  fn(raw);
  fs.writeFileSync(f, text.slice(0, i) + 'window.PROTEL_HILFE_DATEN = ' + JSON.stringify(raw, null, 1) + ';\n');
}

const firstImage = (raw) => {
  for (const a of raw.articles) for (const s of a.steps || []) if (s.images && s.images.length) return s.images[0];
  return null;
};

(async () => {
  await L.section('Sauberer Stand besteht die Prüfung', async () => {
    const dir = project();
    const a = run(dir);
    L.eq(a.code, 0, 'App-Ordner: bestanden');
    const b = run(dir, ['--repo']);
    L.eq(b.code, 0, 'ganzes Projekt: bestanden');
    const real = spawnSync(process.execPath, [path.join(L.ROOT, 'tools', 'pruefe-veroeffentlichung.js'), '--repo'], { cwd: L.ROOT, encoding: 'utf8' });
    L.eq(real.status, 0, 'echtes Repository: bestanden' + (real.status ? ' – ' + real.stderr : ''));
  });

  const dataCases = [
    ['interner Artikel', (raw) => { raw.articles[0].visibility = 'intern'; }, /nicht ausdrücklich als öffentlich/],
    ['Artikel ohne Sichtbarkeit (Datenformat 1)', (raw) => { delete raw.articles[0].visibility; }, /nicht ausdrücklich als öffentlich/],
    ['internes Bild', (raw) => { firstImage(raw).rights = 'intern'; }, /nicht als öffentlich gekennzeichnet/],
    ['Bild ohne Rechteangabe', (raw) => { delete firstImage(raw).rights; }, /nicht als öffentlich gekennzeichnet/],
    ['eigener protel-Screenshot als „öffentlich“', (raw) => { firstImage(raw).origin = 'screenshot'; }, /Herkunft „screenshot“/],
    ['geplanter Bildplatz', (raw) => { raw.articles[0].steps[0].slots = [{ id: 'S-TST-01' }]; }, /Bildplätze/],
    ['Name der prüfenden Person', (raw) => { raw.articles[0].review = { status: 'geprueft', checkedBy: 'Erika Test' }; }, /prüfenden Person/],
    ['Name der aufnehmenden Person', (raw) => { firstImage(raw).capturedBy = 'Max Test'; }, /aufnehmenden Person/],
    ['interner Inhaltsstand', (raw) => { raw.meta.package = 'intern'; }, /interner Inhaltsstand|internen Inhaltsstand/],
    ['altes Datenformat ohne Rechte', (raw) => { raw.format = 'protel-hilfe'; raw.schemaVersion = 1; }, /Datenformat 2/],
  ];
  for (const [name, fn, re] of dataCases) {
    await L.section('Gesperrt: ' + name, async () => {
      const dir = project();
      editData(dir, fn);
      const r = run(dir);
      L.eq(r.code, 1, 'Prüfung sperrt (Exit-Code 1)');
      L.ok(re.test(r.out), 'verständliche Meldung' + (re.test(r.out) ? '' : ': ' + r.out.slice(0, 300)));
    });
  }

  await L.section('Gesperrt: Bilddateien ohne Freigabe, veränderte Bilder, Screenshot-Namen', async () => {
    const dir = project();
    const app = path.join(dir, 'protel-hilfe');
    fs.mkdirSync(path.join(app, 'assets', 'grafiken'), { recursive: true });
    fs.writeFileSync(path.join(app, 'assets', 'grafiken', 'G-TST-01_schema.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    let r = run(dir);
    L.ok(r.code === 1 && /bildfreigabe\.json/.test(r.out), 'neue Bilddatei ohne Freigabe wird gesperrt');
    const f = spawnSync(process.execPath, [path.join(dir, 'tools', 'pruefe-veroeffentlichung.js'), '--freigeben', 'assets/grafiken/G-TST-01_schema.svg', 'Eigene Grafik'], { cwd: dir, encoding: 'utf8' });
    L.eq(f.status, 0, 'eigene Grafik lässt sich freigeben');
    r = run(dir);
    L.eq(r.code, 0, 'nach der Freigabe: bestanden');
    fs.appendFileSync(path.join(app, 'assets', 'icons', 'icon.svg'), '<!-- geändert -->');
    r = run(dir);
    L.ok(r.code === 1 && /Prüfsumme/.test(r.out), 'veränderte freigegebene Datei wird erkannt');
    const dir2 = project();
    fs.writeFileSync(path.join(dir2, 'protel-hilfe', 'S-CIN-06_wizard-uebersicht.png'), 'x');
    r = run(dir2);
    L.ok(r.code === 1 && /Screenshot-Schema/.test(r.out), 'Datei nach Screenshot-Schema wird gesperrt');
    const g = spawnSync(process.execPath, [path.join(dir2, 'tools', 'pruefe-veroeffentlichung.js'), '--freigeben', 'S-CIN-06_wizard-uebersicht.png', 'Eigene Grafik'], { cwd: dir2, encoding: 'utf8' });
    L.ok(g.status === 2 && /nicht freigebbar/.test(g.stderr), 'Screenshot-Datei lässt sich nicht freigeben');
    const dir3 = project();
    fs.writeFileSync(path.join(dir3, 'protel-hilfe', 'assets', 'js', 'zusatz.js'), 'var b = "data:image/png;base64,' + 'A'.repeat(400) + '";');
    r = run(dir3);
    L.ok(r.code === 1 && /eingebettetes Rasterbild/.test(r.out), 'eingebettetes Rasterbild im Code wird gesperrt');
  });

  await L.section('Gesperrt im ganzen Projekt: interne Ordner, Kennzeichen, interne Exporte', async () => {
    const dir = project();
    fs.mkdirSync(path.join(dir, 'intern'));
    fs.writeFileSync(path.join(dir, 'intern', 'notiz.md'), 'Notiz');
    let r = run(dir, ['--repo']);
    L.ok(r.code === 1 && /„intern“ im Datei- oder Ordnernamen/.test(r.out), 'Ordner „intern“ wird gesperrt');
    const dir2 = project();
    fs.writeFileSync(path.join(dir2, 'doku.md'), '# Notiz\n' + MARK + ': interne Datei\n');
    r = run(dir2, ['--repo']);
    L.ok(r.code === 1 && /Kennzeichen interner Exporte/.test(r.out), 'Datei mit Kennzeichen interner Exporte wird gesperrt');
    const dir3 = project();
    fs.writeFileSync(path.join(dir3, 'sicherung.json'), JSON.stringify({ format: 'protel-hilfe-2', meta: { package: 'intern' }, articles: [] }, null, 1));
    r = run(dir3, ['--repo']);
    L.ok(r.code === 1 && /internen Inhaltsstand/.test(r.out), 'interne Sicherung (.json) wird gesperrt');
  });

  await L.section('Build und Prüfung vor dem Veröffentlichen', async () => {
    const dir = project();
    let b = spawnSync(process.execPath, [path.join(dir, 'tools', 'build-pwa.js'), '--check'], { cwd: dir, encoding: 'utf8' });
    L.eq(b.status, 0, 'Build-Prüfung im sauberen Stand bestanden');
    editData(dir, (raw) => { raw.articles[0].visibility = 'intern'; });
    b = spawnSync(process.execPath, [path.join(dir, 'tools', 'build-pwa.js')], { cwd: dir, encoding: 'utf8' });
    L.ok(b.status === 1 && /Veröffentlichungsprüfung fehlgeschlagen/.test(b.stderr), 'Build bricht mit internem Inhalt ab');
    const deploy = fs.readFileSync(path.join(L.ROOT, 'tools', 'deploy-gh-pages.sh'), 'utf8');
    L.ok(/pruefe-veroeffentlichung\.js --repo/.test(deploy) && deploy.indexOf('pruefe-veroeffentlichung') < deploy.indexOf('git push'), 'Veröffentlichungsskript prüft vor dem Hochladen');
    L.ok(/\[ja\/nein\]/.test(deploy), 'Veröffentlichungsskript fragt ausdrücklich nach');
  });

  await L.section('Git-Hook verhindert Commits mit internen Inhalten', async () => {
    const dir = project();
    const git = (args) => spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'].concat(args), { cwd: dir, encoding: 'utf8' });
    git(['init', '-q']);
    fs.cpSync(path.join(L.ROOT, 'tools', 'git-hooks'), path.join(dir, 'tools', 'git-hooks'), { recursive: true });
    git(['config', 'core.hooksPath', 'tools/git-hooks']);
    git(['add', '-A']);
    let c = git(['commit', '-q', '-m', 'Ausgangsstand']);
    L.eq(c.status, 0, 'sauberer Commit wird angenommen');
    fs.writeFileSync(path.join(dir, 'S-KAS-02_kassenabschluss.png'), 'x');
    git(['add', '-f', 'S-KAS-02_kassenabschluss.png']);
    c = git(['commit', '-q', '-m', 'Screenshot']);
    L.ok(c.status !== 0 && /GESPERRT/.test(c.stdout + c.stderr), 'Commit mit Screenshot-Datei wird abgelehnt');
    const ign = fs.readFileSync(path.join(L.ROOT, '.gitignore'), 'utf8');
    L.ok(/^intern\/$/m.test(ign) && /protel-hilfe-intern-\*/.test(ign), '.gitignore schließt interne Ordner und Exporte aus');
  });

  L.done();
})();
