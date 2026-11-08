/* Verwaltung: Wiederherstellungspunkte (anlegen, begrenzen, wiederherstellen, herunterladen, löschen),
   Sammelimport von Screenshots nach Dateinamen, Bildplätze nach Bildschirmbereich + CSV,
   Schutz interner Inhalte beim Erscheinen einer neuen öffentlichen Version, Prüfstatus im Pflegebedarf */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

async function seedSlots(page) {
  await page.evaluate(async () => {
    const a = PH.model.normalizeArticle({
      id: 'slot-test', type: 'guide', title: 'Bildplatztest (erfunden)', review: { status: 'entwurf' },
      steps: [
        { title: 'Eins', slots: [{ id: 'S-TST-01', need: 'pflicht', title: 'Dialog A', area: 'Testdialog', test: 'T-TST-01' }, { id: 'S-TST-02', need: 'optional', title: 'Liste B', area: 'Testliste' }] },
        { title: 'Zwei', slots: [{ id: 'S-TST-03', need: 'freigabe', title: 'Dialog C', area: 'Testdialog' }] },
      ],
    });
    await PH.app.commit(Object.assign({}, PH.app.kb, { articles: PH.app.kb.articles.concat(a) }));
  });
}

(async () => {
  const base = L.tmpDir('verwaltung');
  const browser = await L.chromium.launch();

  await L.section('Wiederherstellungspunkte', async () => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    await page.click('#btn-edit-mode');
    // Beispiele löschen → automatischer Punkt
    await L.go(page, '#/verwaltung', '[data-adm="remove-examples"]');
    const nAll = await page.evaluate(() => PH.app.kb.articles.length);
    await page.click('[data-adm="remove-examples"]');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction((n) => PH.app.kb.articles.length < n, nAll);
    await L.go(page, '#/verwaltung', '#snap-list table');
    const rows = await page.locator('#snap-list tbody tr').allInnerTexts();
    L.ok(rows.length === 1 && /Beispielartikel/.test(rows[0]), 'Punkt „Vor dem Löschen der Beispielartikel“ angelegt');
    // Herunterladen
    const dl = await L.captureDownload(page, () => page.click('#snap-list [data-snap-act="download"]'));
    const j = JSON.parse(dl.text);
    L.eq(j.articles.length, nAll, 'heruntergeladener Punkt enthält den vollständigen alten Stand');
    // Wiederherstellen
    await page.click('#snap-list [data-snap-act="restore"]');
    await page.waitForSelector('dialog[open]');
    await page.click('dialog[open] .btn-primary');
    await page.waitForFunction((n) => PH.app.kb.articles.length === n, nAll);
    L.ok(true, 'Wiederherstellen bringt alle ' + nAll + ' Artikel zurück');
    await L.go(page, '#/verwaltung', '#snap-list table');
    const rows2 = await page.locator('#snap-list tbody tr').allInnerTexts();
    L.ok(rows2.length === 2 && /Vor dem Wiederherstellen/.test(rows2[0]), 'vor dem Wiederherstellen wird der aktuelle Stand gesichert');
    // Begrenzung auf 5 + angeheftete
    const n = await page.evaluate(async () => {
      await PH.app.snapshot(PH.app.kb, 'angeheftet', { pinned: true });
      for (let i = 0; i < 7; i++) await PH.app.snapshot(PH.app.kb, 'Test ' + i);
      const list = await PH.store.listSnapshots();
      return { total: list.length, pinned: list.filter((x) => x.pinned).length, newest: list[0].reason };
    });
    L.eq([n.total, n.pinned, n.newest], [6, 1, 'Test 6'], 'höchstens 5 automatische Punkte, angeheftete bleiben');
    // Löschen (Seite neu aufbauen, damit die Liste die neuen Punkte zeigt)
    await L.go(page, '#/', '.hero');
    await L.go(page, '#/verwaltung', '#snap-list table');
    await page.waitForFunction(() => document.querySelectorAll('#snap-list tbody tr').length === 6);
    await page.click('#snap-list tbody tr:first-child [data-snap-act="delete"]');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => document.querySelectorAll('#snap-list tbody tr').length === 5);
    L.ok(true, 'Punkt nach Rückfrage gelöscht');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  await L.section('Sammelimport von Screenshots nach Dateinamen', async () => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    await page.click('#btn-edit-mode');
    await seedSlots(page);
    const files = [
      await L.makePng(browser, path.join(base, 'S-TST-01_dialog-a.png'), { title: 'Dialog A' }),
      await L.makePng(browser, path.join(base, 's-tst-03 Dialog C.png'), { title: 'Dialog C' }),
      await L.makePng(browser, path.join(base, 'S-TST-99_unbekannt.png'), { title: 'Unbekannt' }),
      await L.makePng(browser, path.join(base, 'ohne-nummer.png'), { title: 'Ohne Nummer' }),
    ];
    await L.go(page, '#/verwaltung', '#bulk-files');
    await page.setInputFiles('#bulk-files', files);
    await page.waitForSelector('#bulk-preview .import-preview');
    const prev = await page.locator('#bulk-preview').innerText();
    L.ok(/4 Datei\(en\) gewählt – 2 zuordenbar/.test(prev), 'Vorschau: 2 von 4 Dateien zuordenbar');
    L.ok(/kein passender Bildplatz/.test(prev) && /keine Nummer im Dateinamen/.test(prev), 'Vorschau nennt nicht zuordenbare Dateien');
    await page.click('[data-adm="bulk-apply"]');
    await page.waitForFunction(() => PH.app.getArticle('slot-test').steps[0].images.length === 1 && PH.app.getArticle('slot-test').steps[1].images.length === 1);
    const r = await page.evaluate(async () => {
      const a = PH.app.getArticle('slot-test');
      return {
        i0: a.steps[0].images[0], i1: a.steps[1].images[0],
        snap: (await PH.store.listSnapshots())[0].reason,
      };
    });
    L.eq([r.i0.slot, r.i0.rights, r.i0.origin, r.i0.caption], ['S-TST-01', 'intern', 'screenshot', 'Dialog A'], 'S-TST-01 eingefügt: intern, Screenshot, Bildunterschrift vom Bildplatz');
    L.eq(r.i1.slot, 'S-TST-03', 'Kleinschreibung im Dateinamen wird erkannt (S-TST-03)');
    L.ok(/^data:image\/(webp|png|jpeg)/.test(r.i0.src), 'Bild eingebettet (verkleinert)');
    L.ok(/Sammelimport/.test(r.snap), 'Wiederherstellungspunkt vor dem Sammelimport');
    // erneuter Import ersetzt
    await L.go(page, '#/verwaltung', '#bulk-files');
    await page.setInputFiles('#bulk-files', [files[0]]);
    await page.waitForSelector('#bulk-preview .import-preview');
    L.ok(/ersetzt vorhandenes Bild/.test(await page.locator('#bulk-preview').innerText()), 'erneuter Import: „ersetzt vorhandenes Bild“');
    await page.click('[data-adm="bulk-cancel"]');

    // Bildplätze nach Bildschirmbereich, Filter, CSV
    await L.go(page, '#/verwaltung', '#slot-list');
    const groups = await page.locator('#slot-list details.slot-group > summary strong').allInnerTexts();
    L.eq(groups, ['Testdialog', 'Testliste'], 'Bildplätze nach Bildschirmbereich gruppiert');
    await page.selectOption('#slot-filter', 'fehlt');
    const visible = await page.locator('#slot-list tr[data-state]:visible').count();
    L.eq(visible, 1, 'Filter „nur fehlende“ zeigt 1 Bildplatz (S-TST-02)');
    const dl = await L.captureDownload(page, () => page.click('[data-adm="slots-csv"]'));
    L.ok(dl.text.charCodeAt(0) === 0xFEFF, 'CSV mit BOM (Excel erkennt Umlaute)');
    const lines = dl.text.replace(/^﻿/, '').trim().split(/\r\n/);
    L.eq(lines[0], '"Bildschirmbereich";"Nr.";"Motiv";"Artikel";"Schritt";"Bedarf";"Testfall";"Status"', 'CSV-Kopfzeile');
    L.eq(lines.length, 4, 'CSV enthält alle 3 Bildplätze');
    L.ok(lines.some((l) => /"S-TST-02".*"fehlt"/.test(l)), 'CSV enthält den Status');
    // Pflegebedarf: Prüfstatus
    L.ok(/Bildplatztest/.test(await page.locator('#care').innerText()), 'Pflegebedarf listet Artikel im Status „Entwurf“');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  await L.section('Neue öffentliche Version: interne Inhalte werden geschützt', async () => {
    const app = L.copyApp(path.join(base, 'app'));
    const ctx = await browser.newContext();
    const page = await L.openApp(ctx, L.fileUrl(app));
    await seedSlots(page); // interner Artikel, „nicht exportiert“
    // neue mitgelieferte Version (z. B. Update der Beispieldaten) im App-Ordner
    const dataFile = path.join(app, 'data', 'wissensdatenbank.js');
    const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8').replace(/^[\s\S]*?PROTEL_HILFE_DATEN\s*=\s*/, '').replace(/;\s*$/, ''));
    raw.meta.revision = 'rev-test-neu';
    raw.meta.updated = new Date(Date.now() + 60000).toISOString();
    raw.articles.push({ id: 'neu-oeffentlich', type: 'info', title: 'Neuer öffentlicher Artikel', visibility: 'oeffentlich', body: 'neu', updated: raw.meta.updated });
    fs.writeFileSync(dataFile, 'window.PROTEL_HILFE_DATEN = ' + JSON.stringify(raw) + ';\n');
    await page.reload();
    await page.waitForSelector('dialog[open]');
    const dlg = await page.locator('dialog[open]').innerText();
    L.ok(/Interne Inhalte schützen/.test(dlg), 'Rückfrage weist auf interne Inhalte hin');
    L.ok(await page.locator('dialog[open] .btn-primary', { hasText: 'Zusammenführen' }).count() === 1, '„Zusammenführen“ ist die empfohlene Wahl');
    L.ok(await page.locator('dialog[open] .btn-danger', { hasText: 'Veröffentlichte Version laden' }).count() + await page.locator('dialog[open] .btn-danger', { hasText: 'Version aus App-Ordner laden' }).count() === 1, 'Ersetzen ist als riskant gekennzeichnet');
    await page.click('dialog[open] .btn-primary');
    await page.waitForFunction(() => !!PH.app.getArticle('neu-oeffentlich'));
    const r = await page.evaluate(async () => ({ intern: !!PH.app.getArticle('slot-test'), snap: (await PH.store.listSnapshots())[0].reason, base: PH.app.status().baseRevision }));
    L.ok(r.intern, 'interner Artikel bleibt erhalten');
    L.ok(/Zusammenführen/.test(r.snap), 'Wiederherstellungspunkt vor dem Zusammenführen');
    L.eq(r.base, 'rev-test-neu', 'neue Version gilt danach als übernommen');
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
    await page.waitForTimeout(400);
    L.ok(!(await page.locator('dialog[open]').count()), 'keine erneute Rückfrage beim nächsten Start');
    // „Lokale Änderungen verwerfen“ sichert vorher
    await page.click('#btn-edit-mode');
    await L.go(page, '#/verwaltung', '[data-adm="reset"]');
    await page.click('[data-adm="reset"]');
    await page.waitForSelector('dialog[open]');
    L.ok(/interne Inhalte/.test(await page.locator('dialog[open]').innerText()), 'Verwerfen warnt vor internen Inhalten');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => !PH.app.getArticle('slot-test'));
    const snaps = await page.evaluate(async () => (await PH.store.listSnapshots()).map((x) => x.reason));
    L.ok(/Vor dem Laden/.test(snaps[0]), 'Wiederherstellungspunkt vor dem Verwerfen angelegt');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  await browser.close();
  L.done();
})();
