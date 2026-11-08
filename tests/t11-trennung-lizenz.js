/* Trennung von öffentlicher App und internen Inhalten: Positivliste des App-Ordners, Build und Offline-Liste (PWA-Cache),
   committete Offline-Dateien, Systemdateien, Lizenzhinweise (Datei, App-Seite, offline), GitHub-Prüfung ohne Deployment.
   Geprüft an Kopien des Projekts mit erfundenen Inhalten. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib');

function project() {
  const dir = L.tmpDir('trennung');
  fs.cpSync(L.APP, path.join(dir, 'protel-hilfe'), { recursive: true });
  fs.cpSync(path.join(L.ROOT, 'tools'), path.join(dir, 'tools'), { recursive: true });
  return dir;
}
const node = (dir, script, args) => {
  const r = spawnSync(process.execPath, [path.join(dir, 'tools', script)].concat(args || []), { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
};
const assetsOf = (dir) => {
  const sw = fs.readFileSync(path.join(dir, 'protel-hilfe', 'sw.js'), 'utf8');
  return Array.from(sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
};

(async () => {
  const { isAppFile } = require('../tools/pruefe-veroeffentlichung.js');

  await L.section('Offline-Liste (PWA-Cache) enthält nur App-Dateien', async () => {
    const assets = assetsOf(L.ROOT);
    L.ok(assets.length > 15 && assets.every((a) => isAppFile(a)), 'alle ' + assets.length + ' Dateien der Offline-Liste stehen in der Positivliste');
    ['index.html', 'LIZENZEN.txt', 'assets/js/lizenzen.js', 'data/wissensdatenbank.js'].forEach((f) => L.ok(assets.includes(f), 'Offline-Liste enthält ' + f));
    const html = fs.readFileSync(path.join(L.APP, 'index.html'), 'utf8');
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map((m) => m[1]);
    L.ok(scripts.length > 10 && scripts.every((s) => assets.includes(s)), 'jedes Skript der Startseite ist offline verfügbar');
    const sw = fs.readFileSync(path.join(L.APP, 'sw.js'), 'utf8');
    L.ok(/if \(!req\.url\.startsWith\(SCOPE\)\) return;/.test(sw), 'Service Worker fasst nur Dateien der eigenen Website an');
  });

  await L.section('Unbekannte Dateien im App-Ordner: gesperrt, nicht im Build', async () => {
    const cases = [
      ['Entwurf-01-Check-in.md', '# Entwurf (erfunden)\nInterner Ablauf ohne Kennzeichen\n'],
      ['data/notizen.txt', 'Hausregel (erfunden): Kasse um 22 Uhr\n'],
      ['data/sicherung.json', '{"articles":[]}'],
      ['assets/js/Kopie von app.js', '// erfunden'],
    ];
    for (const [rel, content] of cases) {
      const dir = project();
      fs.writeFileSync(path.join(dir, 'protel-hilfe', rel), content);
      const g = node(dir, 'pruefe-veroeffentlichung.js');
      L.ok(g.code === 1 && /gehört nicht zur App/.test(g.out), rel + ': Veröffentlichungsprüfung sperrt');
      const b = node(dir, 'build-pwa.js');
      L.ok(b.code === 1 && !assetsOf(dir).includes(rel), rel + ': Build bricht ab, Datei nicht im Offline-Cache');
    }
  });

  await L.section('Systemdateien (Thumbs.db, desktop.ini, .DS_Store) stören nicht und werden nicht gebaut', async () => {
    const dir = project();
    fs.writeFileSync(path.join(dir, 'protel-hilfe', 'assets', 'icons', 'Thumbs.db'), 'x');
    fs.writeFileSync(path.join(dir, 'protel-hilfe', 'desktop.ini'), 'x');
    fs.writeFileSync(path.join(dir, 'protel-hilfe', 'data', '.DS_Store'), 'x');
    L.eq(node(dir, 'pruefe-veroeffentlichung.js').code, 0, 'Prüfung besteht');
    L.eq(node(dir, 'build-pwa.js').code, 0, 'Build läuft');
    L.ok(!assetsOf(dir).some((a) => /Thumbs\.db|desktop\.ini|DS_Store/.test(a)), 'Systemdateien nicht in der Offline-Liste');
    const ign = fs.readFileSync(path.join(L.ROOT, '.gitignore'), 'utf8');
    L.ok(/^Thumbs\.db$/m.test(ign) && /^desktop\.ini$/m.test(ign) && /^\.DS_Store$/m.test(ign), '.gitignore schließt Systemdateien aus');
  });

  await L.section('Offline-Dateien müssen committet sein (sonst fehlten sie in der veröffentlichten App)', async () => {
    const dir = project();
    const git = (args) => spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com'].concat(args), { cwd: dir, encoding: 'utf8' });
    git(['init', '-q']);
    git(['add', '-A']);
    L.eq(git(['commit', '-q', '-m', 'Ausgangsstand']).status, 0, 'Ausgangsstand committet');
    L.eq(node(dir, 'pruefe-veroeffentlichung.js', ['--repo']).code, 0, 'Prüfung des Repositorys besteht');
    fs.writeFileSync(path.join(dir, 'protel-hilfe', 'assets', 'js', 'neu.js'), '/* neue Datei (erfunden) */\n');
    L.eq(node(dir, 'build-pwa.js').code, 0, 'Build nimmt die neue Datei in die Offline-Liste auf');
    const g = node(dir, 'pruefe-veroeffentlichung.js', ['--repo']);
    L.ok(g.code === 1 && /neu\.js: steht in der Offline-Liste/.test(g.out), 'nicht committete Offline-Datei wird gemeldet');
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'neu']);
    L.eq(node(dir, 'pruefe-veroeffentlichung.js', ['--repo']).code, 0, 'nach dem Commit besteht die Prüfung');
  });

  await L.section('Lizenzhinweise: Datei, Symbol-Quelle, Anzeige in der App', async () => {
    const txt = fs.readFileSync(path.join(L.APP, 'LIZENZEN.txt'), 'utf8');
    L.ok(/Feather Icons/.test(txt) && /The MIT License/.test(txt) && /Cole Bemis/.test(txt), 'LIZENZEN.txt: Feather Icons mit MIT-Lizenztext');
    L.ok(/Lucide/.test(txt) && /ISC License/.test(txt) && /Lucide Contributors/.test(txt), 'LIZENZEN.txt: Lucide mit ISC-Lizenztext');
    const icons = fs.readFileSync(path.join(L.APP, 'assets', 'js', 'icons.js'), 'utf8').slice(0, 800);
    L.ok(/Feather/.test(icons) && /MIT/.test(icons) && /Lucide/.test(icons) && /ISC/.test(icons) && /LIZENZEN\.txt/.test(icons), 'icons.js nennt Herkunft und Lizenzen im Dateikopf');
    const win = {};
    new Function('window', fs.readFileSync(path.join(L.APP, 'assets', 'js', 'lizenzen.js'), 'utf8'))(win);
    L.eq(win.PH.LIZENZEN, txt.replace(/\r\n/g, '\n'), 'lizenzen.js enthält genau den Text aus LIZENZEN.txt');
    // Änderung an LIZENZEN.txt: --check meldet sie, der Build übernimmt sie
    const dir = project();
    fs.appendFileSync(path.join(dir, 'protel-hilfe', 'LIZENZEN.txt'), '\nTestzeile (erfunden)\n');
    let b = node(dir, 'build-pwa.js', ['--check']);
    L.ok(b.code === 1 && /lizenzen\.js passt nicht zu LIZENZEN\.txt/.test(b.out), '--check erkennt veraltete Lizenzanzeige');
    b = node(dir, 'build-pwa.js');
    L.eq(b.code, 0, 'Build aktualisiert die Lizenzanzeige');
    L.ok(/Testzeile \(erfunden\)/.test(fs.readFileSync(path.join(dir, 'protel-hilfe', 'assets', 'js', 'lizenzen.js'), 'utf8')), 'neuer Text steht in lizenzen.js');
    L.eq(node(dir, 'build-pwa.js', ['--check']).code, 0, 'danach besteht --check');
  });

  await L.section('Lizenzseite offline in der Web-App (PWA)', async () => {
    const browser = await L.chromium.launch();
    const site = L.tmpDir('lizenz-pwa');
    L.copyApp(path.join(site, 'app'));
    const srv = await L.serve(path.join(site, 'app'));
    const ctx = await browser.newContext();
    const page = await L.openApp(ctx, srv.url + '/index.html');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(async () => {
      const keys = await caches.keys();
      for (const k of keys) { if ((await (await caches.open(k)).keys()).length > 15) return true; }
      return false;
    }, null, { timeout: 15000 });
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
    await L.go(page, '#/lizenzen', '.license-text');
    L.ok(/ISC License/.test(await page.locator('.license-text').innerText()), 'Lizenzhinweise auch ohne Netz lesbar');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
    await srv.close();
    await browser.close();
  });

  await L.section('GitHub-Prüfung bei jedem Push – prüft nur, veröffentlicht nichts', async () => {
    const f = path.join(L.ROOT, '.github', 'workflows', 'veroeffentlichungspruefung.yml');
    L.ok(fs.existsSync(f), 'Ablauf vorhanden');
    const y = fs.readFileSync(f, 'utf8');
    L.ok(/node tools\/pruefe-veroeffentlichung\.js --repo/.test(y) && /node tools\/build-pwa\.js --check/.test(y), 'führt Veröffentlichungsprüfung und Build-Prüfung aus');
    L.ok(/permissions:\s*\n\s*contents: read/.test(y), 'nur Leserechte');
    L.ok(!/gh-pages|git push|deploy-gh-pages|pages: write|secrets\./.test(y), 'kein Deployment, kein Push, keine Geheimnisse');
  });

  L.done();
})();
