/* Datenmodell: Datenformat 1 → 2, unbekannte Felder, Rechte, öffentlicher Stand, Abbildungen, Markdown-Verweise */
'use strict';
const L = require('./lib');

(async () => {
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext();
  const page = await L.openApp(ctx, L.fileUrl(L.APP));
  const legacy = L.legacyKB();

  await L.section('Datenformat 1 wird verlustfrei umgewandelt', async () => {
    const r = await page.evaluate((raw) => {
      const kb = PH.model.normalizeKB(JSON.parse(JSON.stringify(raw)));
      const a = kb.articles.find((x) => x.id === 'test-anleitung');
      return {
        format: kb.format, schema: kb.schemaVersion, root: kb.zusatzWurzel, meta: kb.meta.zusatzMeta, art: a.zusatzArtikel,
        step0: a.steps[0], step1Images: a.steps[1].images.length, step2: a.steps[2].images[0], vis: a.visibility, review: a.review.status,
        hasLegacyImage: 'image' in a.steps[0], rev: kb.meta.revision, syn: kb.synonyms, info: kb.articles[1].related,
      };
    }, legacy);
    L.eq([r.format, r.schema], ['protel-hilfe-2', 2], 'Format und Schema-Version 2');
    L.eq(r.root, legacy.zusatzWurzel, 'unbekanntes Feld auf oberster Ebene bleibt erhalten');
    L.eq(r.meta, 42, 'unbekanntes Feld in meta bleibt erhalten');
    L.eq(r.art, ['bleibt', 'erhalten'], 'unbekanntes Feld im Artikel bleibt erhalten');
    L.eq(r.step0.zusatzSchritt, true, 'unbekanntes Feld im Schritt bleibt erhalten');
    L.ok(!r.hasLegacyImage, 'altes Feld „image“ wird zu „images“');
    L.eq(r.step0.images.length, 1, 'Bild aus Format 1 übernommen');
    L.eq(r.step0.images[0].src, legacy.articles[0].steps[0].image.src, 'Bildinhalt unverändert');
    L.eq(r.step0.images[0].alt, 'Bild eins', 'Bildbeschreibung unverändert');
    L.eq(r.step0.images[0].markers.map((m) => [m.x, m.y, m.label]), [[10, 20, 'Feld A'], [55.5, 60, '']], 'Markierungen unverändert');
    L.eq(r.step0.images[0].rights, 'intern', 'Bild ohne Rechteangabe gilt als intern');
    L.eq(r.step0.hint, 'Tipp 1', 'Hinweistext unverändert');
    L.eq(r.step0.hintType, 'tipp', 'Hinweisart Standard „Tipp“');
    L.eq(r.step1Images, 0, 'Schritt ohne Bild bleibt ohne Bild');
    L.eq(r.step2.src, 'bilder/extern.png', 'verlinktes Bild bleibt verlinkt');
    L.eq(r.vis, 'intern', 'Artikel ohne Sichtbarkeit gilt als intern');
    L.eq(r.review, '', 'kein Prüfstatus erfunden');
    L.eq(r.rev, 'rev-test-alt-1', 'Revision unverändert');
    L.eq(r.syn, [['Testwort', 'Probewort']], 'Synonyme unverändert');
    L.eq(r.info, ['test-anleitung'], 'Verweise unverändert');
  });

  await L.section('Bild-IDs sind stabil und eindeutig zuordenbar', async () => {
    const r = await page.evaluate((raw) => {
      const a1 = PH.model.normalizeKB(JSON.parse(JSON.stringify(raw)));
      const a2 = PH.model.normalizeKB(JSON.parse(JSON.stringify(raw)));
      return [a1.articles[0].steps[0].images[0].id, a2.articles[0].steps[0].images[0].id];
    }, legacy);
    L.ok(r[0] && r[0] === r[1], 'gleiche ID bei erneutem Laden (' + r[0] + ')');
  });

  await L.section('Hin- und Rückweg über JSON ändert nichts', async () => {
    const r = await page.evaluate((raw) => {
      const kb = PH.model.normalizeKB(JSON.parse(JSON.stringify(raw)));
      const again = PH.model.parseImport(PH.model.toJSON(kb)).kb;
      return { same: JSON.stringify(kb) === JSON.stringify(again), schema: PH.model.parseImport(PH.model.toJSON(kb)).schema };
    }, legacy);
    L.ok(r.same, 'Export → Import ergibt denselben Stand');
    L.eq(r.schema, 2, 'Export trägt Datenformat 2');
  });

  await L.section('Formaterkennung und neuere Versionen', async () => {
    const r = await page.evaluate((raw) => {
      const v1 = PH.model.parseImport(JSON.stringify(raw));
      const v3raw = Object.assign({}, raw, { format: 'protel-hilfe-3', schemaVersion: 3, neuesFeld: { a: 1 } });
      const v3 = PH.model.parseImport(JSON.stringify(v3raw));
      let errX = '';
      try { PH.model.parseImport(JSON.stringify(Object.assign({}, raw, { format: 'protel-hilfe-x' }))); } catch (e) { errX = e.message; }
      let errOther = '';
      try { PH.model.parseImport(JSON.stringify(Object.assign({}, raw, { format: 'anderes' }))); } catch (e) { errOther = e.message; }
      let errJs = '';
      const js = 'window.PROTEL_HILFE_DATEN = ' + JSON.stringify(raw) + ';';
      const fromJs = PH.model.parseImport(js);
      try { PH.model.parseImport('kaputt {'); } catch (e) { errJs = e.message; }
      return { v1: [v1.schema, v1.newer], v3: [v3.schema, v3.newer, v3.kb.neuesFeld], errX, errOther, js: fromJs.kb.articles.length, errJs };
    }, legacy);
    L.eq(r.v1, [1, false], 'Datei aus alter App erkannt (Format 1)');
    L.eq(r.v3, [3, true, { a: 1 }], 'Datei aus neuerer App: Warnung, unbekannte Felder bleiben');
    L.ok(/neueren Version/.test(r.errX), 'unbekannte Formatvariante: verständliche Meldung');
    L.ok(/Unbekanntes Datenformat/.test(r.errOther), 'fremdes Format wird abgelehnt');
    L.eq(r.js, 2, 'Datendatei (.js) wird gelesen');
    L.ok(/Unbekanntes Dateiformat|beschädigt/.test(r.errJs), 'kaputte Datei: verständliche Meldung');
  });

  await L.section('Öffentlicher Stand enthält nur Freigegebenes', async () => {
    const r = await page.evaluate((raw) => {
      const kb = PH.model.normalizeKB(JSON.parse(JSON.stringify(raw)));
      // ein öffentlicher Artikel mit gemischten Bildern, Bildplatz und Namen
      const pub = PH.model.normalizeArticle({
        id: 'oeffentlich-1', type: 'guide', title: 'Öffentlicher Test', visibility: 'oeffentlich', related: ['test-anleitung'],
        review: { status: 'geprueft', checkedBy: 'Erika Test' },
        images: [{ src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>', rights: 'oeffentlich', origin: 'grafik', capturedBy: 'Max Test' }],
        steps: [{ title: 'S1', images: [
          { src: 'data:image/png;base64,AAAA', rights: 'oeffentlich', origin: 'screenshot' },
          { src: 'data:image/png;base64,BBBB', rights: 'intern', origin: 'grafik' },
          { src: 'data:image/png;base64,CCCC', rights: 'oeffentlich', origin: 'app' },
        ], slots: [{ id: 'S-TST-01', need: 'pflicht', title: 'geplant' }] }],
      });
      kb.articles.push(pub);
      const before = PH.model.publicIssues(kb);
      const res = PH.model.toPublic(kb);
      const a = res.kb.articles[0];
      return {
        beforeCount: before.length, removed: res.removed, ids: res.kb.articles.map((x) => x.id), issues: PH.model.publicIssues(res.kb),
        stepImgs: a.steps[0].images.map((i) => i.origin), slots: a.steps[0].slots.length, checkedBy: a.review.checkedBy, capturedBy: a.images[0].capturedBy,
        related: a.related, pkg: res.kb.meta.package, internal: PH.model.hasInternal(res.kb), cats: res.kb.categories.length,
      };
    }, legacy);
    L.ok(r.beforeCount >= 5, 'Prüfung meldet interne Artikel, Bilder, Bildplätze und Namen (' + r.beforeCount + ' Hinweise)');
    L.eq(r.ids, ['oeffentlich-1'], 'nur ausdrücklich öffentliche Artikel');
    L.eq(r.stepImgs, ['app'], 'eigene protel-Screenshots und interne Bilder entfernt');
    L.eq(r.slots, 0, 'Bildplätze entfernt');
    L.eq([r.checkedBy, r.capturedBy], ['', ''], 'Personennamen entfernt');
    L.eq(r.related, [], 'Verweise auf interne Artikel entfernt');
    L.eq(r.issues, [], 'Ergebnis besteht die eigene Prüfung');
    L.eq([r.pkg, r.internal], ['oeffentlich', false], 'als öffentlicher Stand gekennzeichnet');
    L.eq(r.removed.articles, 2, 'Anzahl entfernter Artikel gemeldet');
  });

  await L.section('Abbildungsnummern, Bildplätze und Verweise im Text', async () => {
    const r = await page.evaluate(() => {
      const a = PH.model.normalizeArticle({
        id: 'x', type: 'guide', title: 'X',
        images: [{ src: 'a.svg', id: 'G-TST-01', rights: 'oeffentlich', origin: 'grafik' }],
        steps: [
          { title: 'eins', images: [{ src: 'b.png', slot: 'S-TST-01' }, { src: 'c.png' }], slots: [{ id: 'S-TST-01' }, { id: 'S-TST-02', need: 'pflicht' }] },
          { title: 'zwei', images: [{ src: 'd.png', slot: 'S-TST-03', status: 'veraltet' }], slots: [{ id: 'S-TST-03' }] },
        ],
      });
      const labels = PH.model.figureLabels(a);
      const html = PH.md.withFigures(labels, () => PH.md.render('Siehe {{Abb:S-TST-01}} und {{Abb:G-TST-01}} sowie {{Abb:S-TST-99}}. Taste {{Strg+P}}.'));
      const kb = { articles: [a] };
      return {
        labels: Array.from(labels.entries()),
        states: [PH.model.slotState(a.steps[0], a.steps[0].slots[0]), PH.model.slotState(a.steps[0], a.steps[0].slots[1]), PH.model.slotState(a.steps[1], a.steps[1].slots[0])],
        all: PH.model.allSlots(kb).length,
        html, plain: PH.md.toPlain('Siehe {{Abb:S-TST-01}}.'),
        outside: PH.md.render('{{Abb:S-TST-01}}'),
      };
    });
    const m = new Map(r.labels);
    L.eq(m.get('G-TST-01'), 'Übersicht', 'Übersichtsbild heißt „Übersicht“');
    L.eq(m.get('S-TST-01'), 'Abb. 1.1', 'Bild 1 in Schritt 1 = Abb. 1.1');
    L.eq(m.get('S-TST-03'), 'Abb. 2.1', 'Bild 1 in Schritt 2 = Abb. 2.1');
    L.eq(r.states, ['vorhanden', 'fehlt', 'veraltet'], 'Status der Bildplätze');
    L.eq(r.all, 3, 'alle Bildplätze gefunden');
    L.ok(/<a href="#" class="fig-ref" data-fig="S-TST-01">Abb\. 1\.1<\/a>/.test(r.html), 'Verweis wird zur Abbildungsnummer');
    L.ok(/fig-ref missing/.test(r.html), 'fehlende Abbildung wird markiert');
    L.ok(/<kbd>Strg<\/kbd>/.test(r.html), 'Tastenschreibweise funktioniert weiter');
    L.eq(r.plain, 'Siehe Abb..', 'Suche/Textauszug ohne Steuerzeichen');
    L.ok(/missing/.test(r.outside), 'ohne Artikelbezug kein falscher Verweis');
  });

  await L.section('Sicherheit: nur Bilddaten und sichere Links', async () => {
    const r = await page.evaluate(() => {
      const bad = PH.model.normalizeImage({ src: 'javascript:alert(1)' });
      const badData = PH.model.normalizeImage({ src: 'data:text/html,<script>' });
      const html = PH.md.render('[x](javascript:alert(1)) <script>alert(1)</script> {{Abb:"><img src=x onerror=alert(1)>}}');
      // Ergebnis als HTML auswerten: keine Skripte, keine Bilder, keine on…-Attribute, keine javascript:-Links
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const bad2 = doc.querySelectorAll('script, img, iframe, object, embed').length +
        Array.from(doc.body.querySelectorAll('*')).filter((el) => Array.from(el.attributes).some((at) => /^on/i.test(at.name) || /^\s*javascript:/i.test(at.value))).length;
      return { bad, badData, dangerous: bad2 };
    });
    L.eq([r.bad, r.badData], [null, null], 'unsichere Bildquellen werden verworfen');
    L.eq(r.dangerous, 0, 'kein ausführbarer Code aus Texten (Markdown wird entschärft)');
  });

  L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
  await browser.close();
  L.done();
})();
