/* Import (alt und neu, Zusammenführen und Ersetzen) und die drei Exporte: Sicherung, interne Datendatei, öffentliche Datendatei */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

(async () => {
  const base = L.tmpDir('import');
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await L.openApp(ctx, L.fileUrl(L.APP));
  await page.click('#btn-edit-mode');

  // Testdateien: Sicherung im Datenformat 1 (wie aus der alten App) und eine Datei aus einer „neueren“ Version
  const v1File = path.join(base, 'sicherung-format1.json');
  fs.writeFileSync(v1File, JSON.stringify(L.legacyKB(), null, 1));
  const v3 = L.legacyKB();
  v3.format = 'protel-hilfe-3';
  v3.schemaVersion = 3;
  v3.articles[0].zukunftsFeld = { neu: true };
  v3.articles[0].updated = '2026-12-01T08:00:00.000Z';
  const v3File = path.join(base, 'sicherung-neuer.json');
  fs.writeFileSync(v3File, JSON.stringify(v3, null, 1));

  await L.section('Import einer alten Sicherung (Datenformat 1) – Zusammenführen', async () => {
    await L.go(page, '#/verwaltung', '#imp-file');
    const n0 = await page.evaluate(() => PH.app.kb.articles.length);
    await page.setInputFiles('#imp-file', v1File);
    await page.waitForSelector('.import-preview');
    const prev = await page.locator('.import-preview').innerText();
    L.ok(/Datenformat 1/.test(prev) && /intern/.test(prev), 'Vorschau nennt Datenformat 1 und Rechte „intern“');
    L.ok(/2 neue Artikel/.test(prev), 'Vorschau: 2 neue Artikel');
    await page.click('[data-adm="import-merge"]');
    await page.waitForFunction((n) => PH.app.kb.articles.length === n + 2, n0);
    const r = await page.evaluate(async () => {
      const a = PH.app.getArticle('test-anleitung');
      const snaps = await PH.store.listSnapshots();
      return { imgs: a.steps[0].images.length, rights: a.steps[0].images[0].rights, extra: a.zusatzArtikel, snap: snaps[0] && snaps[0].reason, internal: PH.model.hasInternal(PH.app.kb) };
    });
    L.eq(r.imgs, 1, 'Bild übernommen');
    L.eq(r.rights, 'intern', 'Bild ist intern');
    L.eq(r.extra, ['bleibt', 'erhalten'], 'unbekannte Felder aus der Datei bleiben erhalten');
    L.ok(/Vor dem Import \(Zusammenführen\)/.test(r.snap || ''), 'Wiederherstellungspunkt vor dem Import angelegt');
    L.ok(r.internal, 'Stand gilt danach als intern');
  });

  await L.section('Import aus einer neueren Version – Warnung, Daten bleiben erhalten', async () => {
    await L.go(page, '#/verwaltung', '#imp-file');
    await page.setInputFiles('#imp-file', v3File);
    await page.waitForSelector('.import-preview');
    const prev = await page.locator('.import-preview').innerText();
    L.ok(/neueren App-Version/.test(prev), 'Vorschau warnt vor neuerer Version');
    L.ok(/1 Artikel werden aktualisiert/.test(prev), 'neuerer Artikel wird aktualisiert');
    await page.click('[data-adm="import-merge"]');
    await page.waitForFunction(() => !!(PH.app.getArticle('test-anleitung').zukunftsFeld));
    L.eq(await page.evaluate(() => PH.app.getArticle('test-anleitung').zukunftsFeld), { neu: true }, 'unbekanntes Feld der neueren Version bleibt erhalten');
  });

  await L.section('Sicherung exportieren (vollständig, intern)', async () => {
    await L.go(page, '#/verwaltung', '[data-adm="export-json"]');
    const dl = await L.captureDownload(page, () => page.click('[data-adm="export-json"]'));
    L.ok(/^protel-hilfe-intern-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(dl.name), 'Dateiname kennzeichnet interne Sicherung (' + dl.name + ')');
    const j = JSON.parse(dl.text);
    L.eq([j.format, j.schemaVersion, j.meta.package], ['protel-hilfe-2', 2, 'intern'], 'Datenformat 2, als intern gekennzeichnet');
    L.ok(j.articles.some((a) => a.id === 'test-anleitung' && a.zukunftsFeld), 'enthält alle Inhalte inkl. unbekannter Felder');
    // Wieder importierbar (Ersetzen) – mit Wiederherstellungspunkt
    const f = path.join(base, dl.name);
    fs.writeFileSync(f, dl.text);
    await page.setInputFiles('#imp-file', f);
    await page.waitForSelector('[data-adm="import-replace"]');
    await page.click('[data-adm="import-replace"]');
    await page.waitForSelector('dialog[open]');
    L.ok(/Wiederherstellungspunkt/.test(await page.locator('dialog[open]').innerText()), 'Rückfrage nennt den automatischen Wiederherstellungspunkt');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => ({ n: PH.app.kb.articles.length, snap: (await PH.store.listSnapshots())[0].reason }));
    L.eq(r.n, j.articles.length, 'Ersetzen übernimmt den gesicherten Stand vollständig');
    L.ok(/Ersetzen/.test(r.snap), 'Wiederherstellungspunkt vor dem Ersetzen angelegt');
  });

  await L.section('Datendatei für die interne PC-Version', async () => {
    await L.go(page, '#/verwaltung', '[data-adm="export-js"]');
    const dl = await L.captureDownload(page, () => page.click('[data-adm="export-js"]'));
    await page.waitForSelector('dialog[open]');
    const msg = await page.locator('dialog[open]').innerText();
    await page.click('dialog[open] .btn-primary');
    L.eq(dl.name, 'wissensdatenbank.js', 'Dateiname wissensdatenbank.js');
    L.ok(dl.text.includes(['PROTEL', 'HILFE', 'INTERN'].join('-')), 'Kopf enthält das Kennzeichen für interne Dateien');
    L.ok(new RegExp('"package": "' + 'intern' + '"').test(dl.text), 'als interner Inhaltsstand gekennzeichnet');
    L.ok(/Interne Inhalte/.test(msg) && /nicht ins öffentliche Repository/.test(msg), 'Hinweis: nur intern verteilen');
    const kb = await page.evaluate((t) => PH.model.parseImport(t).kb.articles.length, dl.text);
    L.ok(kb > 20, 'Datei ist wieder lesbar');
  });

  await L.section('Öffentliche Datendatei – nur Freigegebenes', async () => {
    await L.go(page, '#/verwaltung', '[data-adm="export-public"]');
    await page.click('[data-adm="export-public"]');
    await page.waitForSelector('dialog[open]');
    const msg = await page.locator('dialog[open]').innerText();
    L.ok(/interne Artikel/.test(msg), 'Vorschau nennt die entfernten internen Artikel');
    const dl = await L.captureDownload(page, () => page.click('dialog[open] .btn-primary'));
    const j = JSON.parse(dl.text.slice(dl.text.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
    L.ok(!j.articles.some((a) => a.id === 'test-anleitung' || a.id === 'test-info'), 'interne Artikel nicht enthalten');
    L.ok(j.articles.every((a) => a.visibility === 'oeffentlich'), 'nur öffentliche Artikel');
    const imgs = [];
    j.articles.forEach((a) => { (a.images || []).forEach((i) => imgs.push(i)); (a.steps || []).forEach((s) => (s.images || []).forEach((i) => imgs.push(i))); });
    L.ok(imgs.length > 0 && imgs.every((i) => i.rights === 'oeffentlich' && ['grafik', 'platzhalter', 'app'].includes(i.origin)), 'nur öffentliche Bilder (' + imgs.length + ')');
    L.eq(j.meta.package, 'oeffentlich', 'als öffentlicher Stand gekennzeichnet');
    L.ok(!dl.text.includes(['PROTEL', 'HILFE', 'INTERN'].join('-')), 'kein Kennzeichen für interne Dateien');
    // Gegenprobe mit der Veröffentlichungssperre (Node)
    const { checkData } = require('../tools/pruefe-veroeffentlichung.js');
    L.eq(checkData(j, 'export'), [], 'öffentliche Datei besteht die Veröffentlichungssperre');
  });

  await L.section('Ungültige Dateien werden verständlich abgelehnt', async () => {
    const bad = path.join(base, 'kaputt.json');
    fs.writeFileSync(bad, '{ "articles": [ kaputt ');
    await L.go(page, '#/verwaltung', '#imp-file');
    await page.setInputFiles('#imp-file', bad);
    await page.waitForSelector('#imp-preview .callout-danger');
    L.ok(/beschädigt|kein gültiges JSON/.test(await page.locator('#imp-preview').innerText()), 'Meldung „beschädigt“');
    const n = await page.evaluate(() => PH.app.kb.articles.length);
    L.ok(n > 20, 'Datenbestand bleibt unverändert');
  });

  L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
  await browser.close();
  L.done();
})();
