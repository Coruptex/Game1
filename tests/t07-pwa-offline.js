/* PWA: Offline-Speicher (Service Worker) enthält alle App-Dateien, die App startet ohne Netz,
   Wiederherstellungspunkte funktionieren auch in der installierten Web-App */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

(async () => {
  const srv = await L.serve(L.APP);
  const browser = await L.chromium.launch();
  const ctx = await browser.newContext();

  await L.section('Offline-Speicher wird vollständig angelegt', async () => {
    const page = await L.openApp(ctx, srv.url + '/index.html');
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(800);
    const sw = fs.readFileSync(path.join(L.APP, 'sw.js'), 'utf8');
    const assets = JSON.parse('[' + sw.slice(sw.indexOf('const ASSETS = [') + 16, sw.indexOf('];', sw.indexOf('const ASSETS = ['))).replace(/'/g, '"').replace(/,\s*$/, '') + ']');
    const missing = await page.evaluate(async (list) => {
      const keys = await caches.keys();
      const out = [];
      for (const a of list) {
        let hit = false;
        for (const k of keys) { if (await (await caches.open(k)).match(a)) { hit = true; break; } }
        if (!hit) out.push(a);
      }
      return out;
    }, assets);
    L.ok(assets.includes('LIZENZEN.txt'), 'Lizenzhinweise gehören zur App');
    L.ok(assets.includes('data/wissensdatenbank.js'), 'Wissensdatenbank gehört zum Offline-Speicher');
    L.eq(missing, [], 'alle ' + assets.length + ' App-Dateien offline gespeichert');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await page.close();
  });

  await L.section('Start ohne Netz', async () => {
    await ctx.setOffline(true);
    const page = await L.openApp(ctx, srv.url + '/index.html#/artikel/checkin-ablauf');
    await page.waitForSelector('.steps');
    L.eq(await page.locator('figure.shot .fig-num').allInnerTexts(), ['Abb. 1.1', 'Abb. 5.1'], 'Anleitung mit Abbildungen offline sichtbar');
    await page.locator('.shot-frame[data-zoom]').first().click();
    await page.waitForSelector('.lightbox .lb-canvas img');
    L.ok(true, 'Bildansicht offline nutzbar');
    await page.keyboard.press('Escape');
    // Suche offline
    await L.go(page, '#/suche?q=Rechnug', '.search-head');
    L.ok((await page.locator('.result-title').count()) > 0, 'Suche (mit Tippfehler) offline');
    // Wiederherstellungspunkt in der Web-App
    const snap = await page.evaluate(async () => {
      const ok = await PH.app.snapshot(PH.app.kb, 'Test in der Web-App');
      return { ok: !!ok, list: (await PH.store.listSnapshots()).length, backend: PH.store.backend };
    });
    L.eq([snap.backend, snap.ok, snap.list >= 1], ['indexeddb', true, true], 'Wiederherstellungspunkte auch in der Web-App');
    const lic = await page.evaluate(async () => (await fetch('LIZENZEN.txt')).text());
    L.ok(/Feather Icons/.test(lic) && /Lucide/.test(lic), 'Lizenzhinweise offline abrufbar');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.setOffline(false);
    await page.close();
  });

  await ctx.close();
  await browser.close();
  await srv.close();
  L.done();
})();
