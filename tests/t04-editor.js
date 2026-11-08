/* Editor: mehrere Bilder je Schritt, Bildplätze, Rechte (eigene Screenshots bleiben intern), Markierungen,
   Hinweisart, Abschnitt, Prüfstatus, Quellen, Text nach den Schritten, Abbildungsverweise, Speichern */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const pick = async (page, selector, file) => {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click(selector)]);
  await fc.setFiles(file);
};

(async () => {
  const base = L.tmpDir('editor');
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await L.openApp(ctx, L.fileUrl(L.APP));
  const img1 = await L.makePng(browser, path.join(base, 'S-TST-01_testdialog.png'), { title: 'Testdialog A' });
  const img2 = await L.makePng(browser, path.join(base, 'bild-zwei.png'), { title: 'Testdialog B', bg: '#fff6e0' });
  const img3 = await L.makePng(browser, path.join(base, 'bild-drei.png'), { title: 'Testdialog C', bg: '#e7f5ec', width: 700, height: 420 });

  await page.evaluate(async () => {
    const a = PH.model.normalizeArticle({
      id: 'bild-test', type: 'guide', title: 'Bildtest (erfunden)', categoryId: '', summary: 'Testartikel',
      steps: [
        { title: 'Dialog öffnen', text: 'Text 1', slots: [
          { id: 'S-TST-01', need: 'pflicht', title: 'Testdialog, Übersicht', area: 'Testdialog', instruction: 'Ganzen Dialog aufnehmen', test: 'T-TST-01' },
          { id: 'S-TST-02', need: 'optional', title: 'Menü geöffnet', area: 'Menü', instruction: 'Mit Verzögerung aufnehmen' },
        ] },
        { title: 'Abschließen', text: 'Text 2' },
      ],
    });
    await PH.app.commit(Object.assign({}, PH.app.kb, { articles: PH.app.kb.articles.concat(a) }));
  });
  await page.click('#btn-edit-mode');

  await L.section('Bilder einfügen: Datei, Zwischenablage, Bildplatz', async () => {
    await L.go(page, '#/bearbeiten/bild-test', '.ed-step');
    const step = '.ed-step[data-step-index="0"]';
    await pick(page, step + ' .ed-images > .dropzone [data-ed="img-pick"]', img2);
    await page.waitForSelector(step + ' .ed-img');
    // Einfügen per Strg+V (Zwischenablage-Ereignis mit Bilddatei)
    const b64 = fs.readFileSync(img3).toString('base64');
    await page.evaluate((b) => {
      const bin = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], 'zwischenablage.png', { type: 'image/png' }));
      const zone = document.querySelector('.ed-step[data-step-index="0"] .ed-images > .dropzone');
      zone.focus();
      zone.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    }, b64);
    await page.waitForFunction(() => document.querySelectorAll('.ed-step[data-step-index="0"] .ed-img').length === 2);
    // Bild für Bildplatz S-TST-01
    await pick(page, '.ed-slot .dropzone[data-slot="S-TST-01"] [data-ed="img-pick"]', img1);
    await page.waitForFunction(() => document.querySelectorAll('.ed-step[data-step-index="0"] .ed-img').length === 3);
    const imgs = await page.evaluate(() => PH.editor._state().draft.steps[0].images.map((i) => ({ rights: i.rights, origin: i.origin, slot: i.slot, caption: i.caption, captured: i.captured, id: i.id, webp: i.src.slice(0, 15) })));
    L.eq(imgs.length, 3, 'drei Bilder im Schritt');
    L.ok(imgs.every((i) => i.rights === 'intern'), 'neue Bilder sind intern');
    L.ok(imgs.every((i) => i.origin === 'screenshot'), 'Herkunft: eigener Screenshot');
    L.eq([imgs[2].slot, imgs[2].id, imgs[2].caption], ['S-TST-01', 'S-TST-01', 'Testdialog, Übersicht'], 'Bild dem Bildplatz zugeordnet, Bildunterschrift vom Bildplatz');
    L.ok(imgs.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.captured)), 'Aufnahmedatum gesetzt');
    const labels = await page.locator(step + ' .ed-img .fig-num').allInnerTexts();
    L.eq(labels, ['Abb. 1.1', 'Abb. 1.2', 'Abb. 1.3'], 'Abbildungsnummern im Editor');
    L.ok(await page.locator('.ed-slot .slot-state.state-vorhanden').count() === 1, 'Bildplatz S-TST-01 als „vorhanden“ angezeigt');
    // Gemeinsamer Bildplatz: „Gleiche Aufnahme wie“
    const sameInput = page.locator('[data-path="steps.0.slots.1.same"]');
    L.ok(await sameInput.count() === 1, 'Feld „Gleiche Aufnahme wie“ je Bildplatz vorhanden');
    await sameInput.fill('S-TST-01');
    await sameInput.dispatchEvent('input');
    L.eq(await page.evaluate(() => PH.editor._state().draft.steps[0].slots[1].same), 'S-TST-01', 'Eingabe landet im Bildplatz');
  });

  await L.section('Rechte: eigene Screenshots können nicht öffentlich werden', async () => {
    await page.selectOption('select[data-path="steps.0.images.0.rights"]', 'oeffentlich');
    await page.waitForSelector('dialog[open]');
    L.ok(/bleiben intern/.test(await page.locator('dialog[open]').innerText()), 'Hinweis: protel-Screenshots bleiben intern');
    await page.click('dialog[open] .btn-primary');
    await page.waitForTimeout(150);
    L.eq(await page.evaluate(() => PH.editor._state().draft.steps[0].images[0].rights), 'intern', 'Rechte bleiben intern');
    // eigene Grafik darf öffentlich sein
    await page.selectOption('select[data-path="steps.0.images.1.origin"]', 'grafik');
    await page.waitForTimeout(100);
    await page.selectOption('select[data-path="steps.0.images.1.rights"]', 'oeffentlich');
    await page.waitForTimeout(150);
    L.eq(await page.evaluate(() => PH.editor._state().draft.steps[0].images[1].rights), 'oeffentlich', 'eigene Grafik kann öffentlich gekennzeichnet werden');
    // Herkunft zurück auf Screenshot → Rechte automatisch intern
    await page.selectOption('select[data-path="steps.0.images.1.origin"]', 'screenshot');
    await page.waitForTimeout(150);
    L.eq(await page.evaluate(() => PH.editor._state().draft.steps[0].images[1].rights), 'intern', 'Herkunft „Screenshot“ setzt die Rechte zurück auf intern');
  });

  await L.section('Markierungen, Reihenfolge, Entfernen', async () => {
    const key = 'steps.0.images.0';
    await page.click('[data-ed="marker-mode"][data-key="' + key + '"]');
    const box = await page.locator('[data-ed-shot="' + key + '"] img').boundingBox();
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5);
    await page.waitForSelector('[data-img-key="' + key + '"] .ed-markers input');
    await page.fill('[data-img-key="' + key + '"] .ed-markers input', 'Feld 5');
    const m = await page.evaluate(() => PH.editor._state().draft.steps[0].images[0].markers);
    L.eq(m.length, 1, 'Markierung gesetzt');
    L.ok(Math.abs(m[0].x - 25) < 2 && Math.abs(m[0].y - 50) < 2, 'Position stimmt (' + m[0].x + ' %, ' + m[0].y + ' %)');
    L.eq(m[0].label, 'Feld 5', 'Beschriftung übernommen');
    await page.click('[data-ed="marker-mode"][data-key="' + key + '"]');
    // Bild 1 nach unten verschieben
    await page.click('[data-ed="img-move"][data-p="steps.0.images"][data-k="0"][data-dir="1"]');
    const order = await page.evaluate(() => PH.editor._state().draft.steps[0].images.map((i) => i.markers.length));
    L.eq(order, [0, 1, 0], 'Bild mit Markierung ist jetzt das zweite');
    // drittes Bild (Bildplatz) bleibt, erstes entfernen
    await page.click('[data-ed="img-remove"][data-p="steps.0.images"][data-k="0"]');
    await page.waitForSelector('dialog[open]');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => PH.editor._state().draft.steps[0].images.length === 2);
    L.ok(true, 'Bild nach Rückfrage entfernt');
  });

  await L.section('Hinweisart, Abschnitt, Prüfstatus, Quellen, Text nach den Schritten', async () => {
    await page.fill('input[data-path="steps.0.group"]', 'A. Testabschnitt');
    await page.locator('.ed-step[data-step-index="0"] details.ed-more:has(select[data-path="steps.0.hintType"]) > summary').click();
    await page.selectOption('select[data-path="steps.0.hintType"]', 'warnung');
    await page.fill('textarea[data-path="steps.0.hint"]', 'Nicht auf Buchen klicken.');
    await page.selectOption('select[data-path="review.status"]', 'entwurf');
    await page.fill('input[data-path="review.pmsVersion"]', '26.44');
    await page.fill('input[data-path="review.checkedBy"]', 'Testperson');
    await page.fill('textarea[data-path="after"]', '## Sonderfälle\n- Testsonderfall');
    await page.click('[data-ed="source-add"]');
    await page.fill('input[data-path="sources.0.title"]', 'Testquelle');
    await page.fill('input[data-path="sources.0.url"]', 'https://example.com/hilfe');
    await page.fill('input[data-path="sources.0.date"]', '30.07.2025');
    // Abbildungsverweis über die Werkzeugleiste im Text von Schritt 2
    await page.click('textarea[data-path="steps.1.text"]');
    await page.click('[data-md="fig"][data-for="f-steps-1-text"]');
    await page.waitForSelector('#dlg-fig');
    await page.selectOption('#dlg-fig', 'S-TST-01');
    await page.click('dialog[open] .btn-primary');
    await page.waitForTimeout(100);
    L.ok(/\{\{Abb:S-TST-01\}\}/.test(await page.inputValue('textarea[data-path="steps.1.text"]')), 'Verweis {{Abb:S-TST-01}} eingefügt');
    // Vorschau
    await page.click('.seg [data-tab="preview"]');
    await page.waitForSelector('.preview-frame .steps');
    const prev = await page.locator('.preview-frame').innerText();
    L.ok(/A\. Testabschnitt/.test(prev), 'Vorschau: Abschnittsüberschrift');
    L.ok(/Warnung/.test(prev) && /Nicht auf Buchen klicken/.test(prev), 'Vorschau: Warnung am Schritt');
    await page.click('.seg [data-tab="edit"]');
    await page.click('.editor-actions [data-ed="save"]');
    await page.waitForSelector('article.article');
  });

  await L.section('Gespeicherter Artikel: Anzeige und Dauerhaftigkeit', async () => {
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
    await L.go(page, '#/artikel/bild-test', 'article.article');
    const a = await page.evaluate(() => PH.app.getArticle('bild-test'));
    L.eq(a.steps[0].images.length, 2, 'nach Neuladen: zwei Bilder gespeichert');
    L.eq([a.steps[0].hintType, a.steps[0].group, a.review.status, a.review.pmsVersion, a.sources[0].title], ['warnung', 'A. Testabschnitt', 'entwurf', '26.44', 'Testquelle'], 'Hinweisart, Abschnitt, Prüfstatus, Version, Quelle gespeichert');
    L.eq(await page.locator('.step-group h3').allInnerTexts(), ['A. Testabschnitt'], 'Abschnittsüberschrift über dem Schritt');
    L.eq(await page.locator('.step[data-step="0"] .fig-num').allInnerTexts(), ['Abb. 1.1', 'Abb. 1.2'], 'Abbildungsnummern im Artikel');
    L.ok(await page.locator('.step[data-step="0"] .callout-warning.step-hint').count() === 1, 'Warnung als gelbe Hinweisbox');
    L.ok(/Entwurf – noch nicht im System geprüft/.test(await page.locator('.review-callout').innerText()), 'Hinweis „Entwurf“ oben im Artikel');
    L.ok(await page.locator('.badge-review.review-entwurf').count() >= 1, 'Kennzeichen „Entwurf“');
    const src = page.locator('.source-list a');
    L.eq([await src.innerText(), await src.getAttribute('target')], ['Testquelle', '_blank'], 'Quelle als Link (neuer Tab)');
    L.ok(/Testsonderfall/.test(await page.locator('.article-after').innerText()), 'Text nach den Schritten');
    L.eq(await page.locator('a.fig-ref').innerText(), 'Abb. 1.2', 'Verweis zeigt die aktuelle Abbildungsnummer');
    // fehlender Bildplatz S-TST-02 nur im Bearbeitungsmodus
    L.ok(await page.locator('.slot-ph[data-slot="S-TST-02"]').isVisible(), 'fehlender Bildplatz sichtbar (Bearbeitungsmodus)');
    L.ok(await page.locator('.rights-badge').first().isVisible(), 'Rechte-Kennzeichen sichtbar (Bearbeitungsmodus)');
    await page.click('#btn-edit-mode');
    L.ok(!(await page.locator('.slot-ph[data-slot="S-TST-02"]').isVisible()), 'fehlender Bildplatz unsichtbar für Lesende');
    L.ok(!(await page.locator('.rights-badge').first().isVisible()), 'Rechte-Kennzeichen unsichtbar für Lesende');
    // Klick auf den Verweis öffnet die Bildansicht
    await page.click('a.fig-ref');
    await page.waitForSelector('.lightbox');
    L.eq(await page.locator('.lb-num').innerText(), 'Abb. 1.2', 'Verweis öffnet die richtige Abbildung');
    await page.keyboard.press('Escape');
    await page.click('#btn-edit-mode');
    // „Bild einfügen“ am Bildplatz führt in den Editor zum richtigen Schritt
    await page.click('.slot-ph[data-slot="S-TST-02"] a.btn');
    await page.waitForSelector('#ed-step-1');
    L.ok(/schritt=1/.test(await page.evaluate(() => location.hash)), 'Editor öffnet beim Schritt des Bildplatzes');
    await page.click('.editor-actions [data-ed="cancel"]');
  });

  await L.section('Suche findet Bildunterschriften und Text nach den Schritten', async () => {
    await L.go(page, '#/suche?q=Testsonderfall', '.search-head');
    L.ok((await page.locator('.result-title').allInnerTexts()).some((t) => /Bildtest/.test(t)), 'Treffer über „Text nach den Schritten“');
    await L.go(page, '#/suche?q=Übersicht%20Testdialog', '.search-head');
    L.ok((await page.locator('.result-title').allInnerTexts()).some((t) => /Bildtest/.test(t)), 'Treffer über Bildunterschrift');
  });

  L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
  await browser.close();
  L.done();
})();
