/*
 * Umstellung vorhandener Gerätedaten: Die bisherige App-Version (Datenformat 1) speichert Daten,
 * danach wird im selben Ordner die neue Version gestartet (wie bei einem Update auf einem Rezeptions-PC).
 * Geprüft wird, dass nichts verloren geht und der alte Stand als Wiederherstellungspunkt erhalten bleibt.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

async function oldAppStores(appDir, profile, opts) {
  const ctx = await L.chromium.launchPersistentContext(profile, {});
  if (opts && opts.noIndexedDB) await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  const page = await L.openApp(ctx, L.fileUrl(appDir));
  const stored = await page.evaluate(async (raw) => {
    const kb = PH.model.normalizeKB(raw);
    // alte App: zusätzlich die Beispieldaten behalten, eigene Artikel dazu
    const merged = Object.assign({}, PH.app.kb, { articles: PH.app.kb.articles.concat(kb.articles), categories: PH.app.kb.categories.concat(kb.categories) });
    await PH.app.commit(merged);
    PH.app.toggleFavorite('test-anleitung');
    return { kb: JSON.parse(JSON.stringify(PH.app.kb)), backend: PH.store.backend, backup: PH.model.toJSON(PH.app.kb) };
  }, L.legacyKB());
  const errors = page._errors.slice();
  await ctx.close();
  return Object.assign(stored, { errors });
}

function articleDigest(a) {
  const steps = (a.steps || []).map((s) => {
    const imgs = s.images ? s.images : s.image ? [s.image] : [];
    return [s.title, s.text, s.hint, imgs.map((i) => [i.src.length, i.src.slice(0, 40), i.alt, (i.markers || []).map((m) => [m.x, m.y, m.label])])];
  });
  return [a.id, a.type, a.title, a.summary, a.body, a.tags, a.keywords, a.related, a.updated, steps, a.troubleshooting || null, a.tree || null];
}

(async () => {
  const base = L.tmpDir('migration');
  const appDir = L.extractOldApp(path.join(base, 'ordner'));
  if (!appDir) {
    L.ok(false, 'alte App-Version konnte nicht aus Git geladen werden');
    L.done();
    return;
  }

  await L.section('Update auf einem PC mit IndexedDB (Normalfall)', async () => {
    const profile = path.join(base, 'profil-idb');
    const before = await oldAppStores(appDir, profile);
    L.eq(before.backend, 'indexeddb', 'alte Version speichert in IndexedDB');
    L.ok(!before.errors.length, 'alte Version ohne Fehler');
    fs.writeFileSync(path.join(base, 'alte-sicherung.json'), before.backup);

    // Update: neue App-Dateien in denselben Ordner
    L.replaceDir(appDir, L.APP);
    const ctx = await L.chromium.launchPersistentContext(profile, {});
    const page = await L.openApp(ctx, L.fileUrl(appDir));
    await page.waitForTimeout(900);
    const after = await page.evaluate(async () => {
      const rec = await PH.store.loadLocal();
      const snaps = await PH.store.listSnapshots();
      const raw = snaps[0] ? await PH.store.getSnapshot(snaps[0].id) : null;
      return {
        kb: JSON.parse(JSON.stringify(PH.app.kb)), storedSchema: rec && rec.kb && rec.kb.schemaVersion, dirty: rec && rec.dirty,
        snaps, raw, favs: PH.app.prefs.favorites, toast: Array.from(document.querySelectorAll('.toast-msg')).map((t) => t.textContent).join(' | '),
        dialog: !!document.querySelector('dialog[open]'),
      };
    });
    L.eq(after.kb.articles.length, before.kb.articles.length, 'gleiche Anzahl Artikel (' + before.kb.articles.length + ')');
    const byId = new Map(after.kb.articles.map((a) => [a.id, a]));
    const diffs = before.kb.articles.filter((a) => JSON.stringify(articleDigest(a)) !== JSON.stringify(articleDigest(byId.get(a.id) || {})));
    L.eq(diffs.map((a) => a.id), [], 'alle Artikel inhaltlich unverändert (Texte, Bilder, Markierungen)');
    L.eq(after.kb.categories.length, before.kb.categories.length, 'Kategorien unverändert');
    L.eq(after.kb.synonyms, before.kb.synonyms, 'Synonyme unverändert');
    L.eq(after.kb.meta.revision, before.kb.meta.revision, 'Revision unverändert');
    L.eq(after.storedSchema, 2, 'gespeicherter Stand liegt jetzt im Datenformat 2 vor');
    L.eq(after.dirty, true, 'eigene Änderungen bleiben als „nicht exportiert“ markiert');
    L.eq(after.snaps.length, 1, 'genau ein Wiederherstellungspunkt angelegt');
    L.ok(after.snaps[0] && after.snaps[0].pinned && after.snaps[0].tag === 'migration', 'Punkt ist angeheftet und als Umstellung gekennzeichnet');
    L.eq(after.raw, before.kb, 'Wiederherstellungspunkt enthält den alten Stand unverändert (Datenformat 1)');
    L.ok(after.favs.includes('test-anleitung'), 'Favoriten bleiben erhalten');
    L.ok(/aktualisiert/.test(after.toast), 'Hinweis auf die Aktualisierung wird angezeigt');
    L.ok(!after.dialog, 'kein unnötiger Rückfrage-Dialog');
    L.ok(!page._errors.length, 'neue Version ohne Fehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));

    // erneuter Start: keine zweite Umstellung
    await page.reload();
    await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
    await page.waitForTimeout(700);
    const again = await page.evaluate(async () => ({ n: (await PH.store.listSnapshots()).length, toast: Array.from(document.querySelectorAll('.toast-msg')).map((t) => t.textContent).join(' | ') }));
    L.eq(again.n, 1, 'beim nächsten Start kein weiterer Wiederherstellungspunkt');
    L.ok(!/aktualisiert/.test(again.toast), 'beim nächsten Start kein Update-Hinweis mehr');

    // alte Sicherung (Format 1) aus der Vorversion lässt sich importieren
    await L.go(page, '#/verwaltung', '#imp-file');
    await page.setInputFiles('#imp-file', path.join(base, 'alte-sicherung.json'));
    await page.waitForSelector('.import-preview');
    const prev = await page.locator('.import-preview').innerText();
    L.ok(/Datenformat 1/.test(prev), 'Importvorschau erkennt Datenformat 1');
    L.ok(/0 neue Artikel/.test(prev), 'gleicher Stand: keine Dubletten beim Zusammenführen');
    await ctx.close();
  });

  await L.section('Update in einem Browser ohne IndexedDB (Ersatzspeicher)', async () => {
    const dir2 = L.extractOldApp(path.join(base, 'ordner2'));
    const profile = path.join(base, 'profil-ls');
    const before = await oldAppStores(dir2, profile, { noIndexedDB: true });
    L.eq(before.backend, 'localstorage', 'alte Version speichert im localStorage');
    L.replaceDir(dir2, L.APP);
    const ctx = await L.chromium.launchPersistentContext(profile, {});
    await ctx.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
    const page = await L.openApp(ctx, L.fileUrl(dir2));
    await page.waitForTimeout(600);
    const after = await page.evaluate(async () => {
      const rec = await PH.store.loadLocal();
      return { n: PH.app.kb.articles.length, schema: rec.kb.schemaVersion, backend: PH.store.backend, can: PH.store.canSnapshot() };
    });
    L.eq(after.n, before.kb.articles.length, 'alle Artikel vorhanden');
    L.eq([after.backend, after.can], ['localstorage', false], 'Ersatzspeicher: keine Wiederherstellungspunkte möglich');
    L.eq(after.schema, 2, 'Stand trotzdem verlustfrei im Datenformat 2 gespeichert');
    await L.go(page, '#/verwaltung', '#snap-list');
    await page.waitForTimeout(200);
    L.ok(/nicht verfügbar/.test(await page.locator('#snap-list').innerText()), 'Verwaltung erklärt, dass Wiederherstellungspunkte hier fehlen');
    L.ok(!page._errors.length, 'ohne Fehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  L.done();
})();
