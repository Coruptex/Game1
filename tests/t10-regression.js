/* Regression: bisherige Funktionen mit dem neuen Code – Suche, Assistent, Fehlerbehebung, Schritte, Favoriten,
   Dunkelmodus, Prüfstatus-Filter, Smartphone-Ansicht, Druck, fehlende Datendatei, Hilfe, Kategorien/Synonyme */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

(async () => {
  const browser = await L.chromium.launch();

  await L.section('Desktop (file://): Kernfunktionen', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    L.ok(await page.locator('.hero').isVisible(), 'Startseite');
    L.ok((await page.locator('.cat-card').count()) >= 5, 'Kategorien auf der Startseite');
    // Suche mit Tippfehler und Synonym
    const hero = page.locator('.hero-search input');
    await hero.fill('Rechnug');
    await page.waitForSelector('.hero-search .sb-dropdown:not([hidden])');
    L.ok(/Rechnung/.test(await page.locator('.hero-search .sb-dropdown').innerText()), 'Vorschläge trotz Tippfehler');
    await L.go(page, '#/suche?q=Abreise', '.search-head');
    L.ok((await page.locator('.result-title').allInnerTexts()).some((t) => /auschecken/i.test(t)), 'Synonym: „Abreise“ findet Check-out');
    // Assistent
    await L.go(page, '#/artikel/early-checkin', '.dt-answer');
    await page.click('.dt-answer >> nth=0');
    await page.waitForTimeout(150);
    await page.click('.dt-answer >> nth=0');
    await page.waitForSelector('.dt-result');
    L.ok(true, 'Entscheidungsbaum führt zu einem Ergebnis');
    // Fehlerbehebung
    await L.go(page, '#/artikel/drucker-druckt-nicht', 'details.cause');
    await page.click('details.cause[open] [data-action="cause-solved"]');
    L.ok(await page.locator('.ts-solved').isVisible(), 'Fehlerbehebung: „Problem gelöst“');
    // Schritte abhaken
    await L.go(page, '#/artikel/checkin-ablauf', '.steps');
    await page.check('.step[data-step="0"] [data-action="step-done"]');
    L.ok(/1 von/.test(await page.locator('.sp-text').innerText()), 'Fortschritt beim Abhaken');
    // Favoriten
    await page.click('[data-action="fav"]');
    await L.go(page, '#/favoriten', '.page-head');
    L.ok((await page.locator('.article-card').count()) === 1, 'Favorit gespeichert');
    // Dunkelmodus
    await page.click('#btn-theme');
    L.eq(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'Dunkelmodus');
    await page.click('#btn-theme');
    // Prüfstatus-Filter in „Alle Artikel“
    await page.evaluate(async () => {
      const kb = PH.app.kb;
      const articles = kb.articles.map((a) => (a.id === 'fundsachen' ? Object.assign({}, a, { review: Object.assign({}, a.review, { status: 'veraltet' }) }) : a));
      await PH.app.commit(Object.assign({}, kb, { articles }));
    });
    await L.go(page, '#/alle', '#all-list');
    await page.selectOption('#f-review', 'veraltet');
    await page.waitForTimeout(150);
    L.ok((await page.locator('#all-list .article-card-title').allInnerTexts()).every((t) => /Fundsachen/.test(t)), 'Filter nach Prüfstatus');
    L.eq(await page.locator('#all-list .article-card').count(), 1, 'Filter „Veraltet“ zeigt genau den veralteten Artikel');
    await L.go(page, '#/artikel/fundsachen', '.review-callout');
    L.ok(/Veraltet/.test(await page.locator('.review-callout').innerText()), 'Hinweis „Veraltet“ im Artikel');
    // Hilfe
    await L.go(page, '#/hilfe', '.prose');
    const help = await page.locator('.prose').innerText();
    L.ok(/Wiederherstellungspunkt/.test(help) && /Bildplätze/.test(help) && /LIZENZEN\.txt/.test(help), 'Hilfe beschreibt die neuen Funktionen und die Lizenzhinweise');
    // Verwaltung: Kategorien und Synonyme speichern wie bisher
    await page.click('#btn-edit-mode');
    await L.go(page, '#/verwaltung', '#syn-text');
    const syn = await page.inputValue('#syn-text');
    await page.fill('#syn-text', syn + '\nTestsynonym, Probebegriff');
    await page.click('[data-adm="syn-save"]');
    await page.waitForTimeout(200);
    L.ok(await page.evaluate(() => PH.app.kb.synonyms.some((g) => g.includes('Testsynonym'))), 'Synonyme speichern');
    await page.click('[data-adm="cat-add"]');
    await page.fill('#cat-editor .cat-row:last-child [data-cf="name"]', 'Testkategorie Regression');
    await page.click('[data-adm="cat-save"]');
    await page.waitForTimeout(200);
    L.ok(await page.evaluate(() => PH.app.kb.categories.some((c) => c.name === 'Testkategorie Regression')), 'Kategorie anlegen');
    // Neuer Artikel (Entscheidungsbaum) wie bisher
    await L.go(page, '#/neu/decision', '#f-title');
    await page.fill('#f-title', 'Regressionsbaum');
    await page.fill('textarea[data-path="tree.nodes.0.text"]', 'Testfrage?');
    await page.click('.editor-actions [data-ed="save"]');
    await page.waitForSelector('.dt-host .dt-answer');
    L.ok(true, 'neuer Entscheidungsbaum gespeichert und testbar');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    // Druckansicht: Verwaltungs- und Bildplatz-Elemente ausgeblendet
    await L.go(page, '#/artikel/checkin-ablauf', '.steps');
    await page.emulateMedia({ media: 'print' });
    L.ok(!(await page.locator('.fig-admin').first().isVisible()), 'Druck: Rechte-Kennzeichen ausgeblendet');
    L.ok(await page.locator('.fig-num').first().isVisible(), 'Druck: Abbildungsnummern bleiben sichtbar');
    await page.emulateMedia({ media: 'screen' });
    await ctx.close();
  });

  await L.section('iPhone: Navigation, Suche, Artikel mit Bildern', async () => {
    const ctx = await browser.newContext(Object.assign({}, L.devices['iPhone 13']));
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    L.ok(await page.locator('#tabbar').isVisible(), 'Tab-Leiste sichtbar');
    await page.locator('#tabbar [data-tab="cats"]').tap();
    await page.waitForSelector('.cat-grid');
    L.ok(true, 'Tab „Kategorien“');
    await page.locator('#tabbar [data-tab="more"]').tap();
    L.ok(await page.evaluate(() => document.body.classList.contains('sidebar-open')), 'Tab „Mehr“ öffnet das Menü');
    await page.locator('#sidebar-backdrop').tap();
    await L.go(page, '#/artikel/checkin-ablauf', '.steps');
    const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: window.innerWidth }));
    L.ok(w.doc <= w.vw + 1, 'kein seitliches Scrollen (' + w.doc + ' ≤ ' + w.vw + ')');
    L.ok(await page.locator('.fig-num').first().isVisible(), 'Abbildungsnummern sichtbar');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  await L.section('Fehlende Datendatei: verständliche Meldung, kein Absturz', async () => {
    const dir = L.copyApp(path.join(L.tmpDir('ohne-daten'), 'app'));
    fs.rmSync(path.join(dir, 'data', 'wissensdatenbank.js'));
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(L.fileUrl(dir));
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
    await page.waitForSelector('.toast-error');
    L.ok(/nicht gefunden/.test(await page.locator('.toast-error').innerText()), 'Meldung „nicht gefunden“');
    L.eq(errs, [], 'kein Skriptfehler');
    await ctx.close();
  });

  await browser.close();
  L.done();
})();
