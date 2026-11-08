/* Bildansicht: Zoom (Tasten, Mausrad, Doppelklick), Verschieben mit Grenzen, Blättern, Markierungen lesbar,
   Touch: Zwei-Finger-Zoom, Wischen, Doppeltippen (iPhone-Emulation) */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

async function seed(page, files) {
  const srcs = files.map((f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  await page.evaluate(async (s) => {
    const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#eef3fc"/><text x="20" y="40" font-size="24">Übersicht (Test)</text></svg>');
    const a = PH.model.normalizeArticle({
      id: 'zoom-test', type: 'guide', title: 'Zoomtest (erfunden)',
      images: [{ src: svg, caption: 'Schema', rights: 'oeffentlich', origin: 'grafik' }],
      steps: [{ title: 'Eins', images: s.map((src, k) => ({ src, caption: 'Testbild ' + (k + 1), markers: [{ x: 50, y: 50, label: 'Mitte' }] })) }],
    });
    await PH.app.commit(Object.assign({}, PH.app.kb, { articles: PH.app.kb.articles.concat(a) }));
  }, srcs);
}

const state = (page) => page.evaluate(() => {
  const c = document.querySelector('.lb-canvas');
  const st = document.querySelector('.lb-stage');
  const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\)\s*scale\(([-\d.e]+)\)/.exec(c.style.transform) || [];
  const mk = c.querySelector('.marker');
  return {
    tx: +m[1], ty: +m[2], s: +m[3], w: c.offsetWidth, h: c.offsetHeight, sw: st.clientWidth, sh: st.clientHeight,
    zoom: document.querySelector('.lb-zoom').textContent, count: document.querySelector('.lb-count').textContent,
    num: document.querySelector('.lb-num').textContent, marker: mk ? Math.round(mk.getBoundingClientRect().width) : 0,
  };
});

(async () => {
  const base = L.tmpDir('zoom');
  const browser = await L.chromium.launch();
  const files = [];
  for (let k = 1; k <= 3; k++) files.push(await L.makePng(browser, path.join(base, 'bild' + k + '.png'), { title: 'Testbild ' + k, width: 1400, height: 900 }));

  await L.section('Desktop: Zoom, Verschieben, Blättern, Tastatur', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    await seed(page, files);
    await L.go(page, '#/artikel/zoom-test', '.steps');
    await page.click('.step .shot-frame[data-zoom]');
    await page.waitForSelector('.lightbox .lb-canvas img');
    await page.waitForTimeout(250);
    let s0 = await state(page);
    L.eq([s0.count, s0.num], ['2 / 4', 'Abb. 1.1'], 'öffnet das angeklickte Bild (2 von 4, Abb. 1.1)');
    L.ok(s0.s <= 1 && s0.w * s0.s <= s0.sw + 1 && s0.h * s0.s <= s0.sh + 1, 'Bild ist eingepasst (' + s0.zoom + ')');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    let s1 = await state(page);
    L.ok(s1.s > s0.s * 1.9, 'Tasten + vergrößern (' + s1.zoom + ')');
    L.ok(Math.abs(s1.marker - s0.marker) <= 2, 'Markierung bleibt gleich groß und lesbar (' + s0.marker + ' → ' + s1.marker + ' px)');
    // Ziehen mit der Maus, Grenzen
    const st = await page.locator('.lb-stage').boundingBox();
    await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2);
    await page.mouse.down();
    await page.mouse.move(st.x + st.width / 2 + 5000, st.y + st.height / 2 + 5000, { steps: 4 });
    await page.mouse.up();
    let s2 = await state(page);
    L.ok(s2.tx <= 0.5 && s2.ty <= 0.5, 'Verschieben ist begrenzt (Bildrand bleibt im Fenster)');
    await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2);
    await page.mouse.down();
    await page.mouse.move(st.x + st.width / 2 - 5000, st.y + st.height / 2 - 5000, { steps: 4 });
    await page.mouse.up();
    s2 = await state(page);
    L.ok(s2.tx >= s2.sw - s2.w * s2.s - 0.5 && s2.ty >= s2.sh - s2.h * s2.s - 0.5, 'auch in die andere Richtung begrenzt');
    await page.keyboard.press('0');
    let s3 = await state(page);
    L.ok(Math.abs(s3.s - s0.s) < 0.001, 'Taste 0 passt wieder ein');
    // Mausrad
    await page.mouse.move(st.x + st.width / 2, st.y + st.height / 2);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(100);
    s3 = await state(page);
    L.ok(s3.s > s0.s * 1.5, 'Mausrad vergrößert (' + s3.zoom + ')');
    // Doppelklick
    await page.mouse.dblclick(st.x + st.width / 2, st.y + st.height / 2);
    s3 = await state(page);
    L.ok(Math.abs(s3.s - s0.s) < 0.001, 'Doppelklick bei Zoom passt wieder ein');
    await page.mouse.dblclick(st.x + st.width / 2, st.y + st.height / 2);
    s3 = await state(page);
    L.ok(s3.s > s0.s * 1.5, 'Doppelklick vergrößert');
    // Originalgröße und Schaltflächen
    await page.click('[data-lb="one"]');
    L.eq((await state(page)).zoom, '100 %', 'Schaltfläche „Originalgröße“');
    await page.click('[data-lb="fit"]');
    await page.click('[data-lb="in"]');
    L.ok((await state(page)).s > s0.s, 'Schaltfläche „Vergrößern“');
    // Blättern
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    let s4 = await state(page);
    L.eq([s4.count, s4.num], ['3 / 4', 'Abb. 1.2'], 'Pfeil rechts: nächstes Bild');
    L.ok(Math.abs(s4.s - s0.s) < 0.01, 'neues Bild wird eingepasst angezeigt');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    s4 = await state(page);
    L.eq([s4.count, s4.num], ['1 / 4', 'Übersicht'], 'Pfeil links: zurück bis zur Übersicht');
    L.ok(await page.locator('.lb-legend .marker-legend').count() === 0, 'Übersicht ohne Markierungen: keine Legende');
    await page.click('[data-lb="next"]');
    L.ok(/Mitte/.test(await page.locator('.lb-legend').innerText()), 'Legende der Markierungen wird angezeigt');
    // Tab-Fokus bleibt im Dialog, Esc schließt
    for (let i = 0; i < 9; i++) await page.keyboard.press('Tab');
    L.ok(await page.evaluate(() => !!document.activeElement.closest('.lightbox')), 'Tab-Fokus bleibt in der Bildansicht');
    await page.keyboard.press('Escape');
    L.ok(!(await page.locator('.lightbox').count()), 'Esc schließt die Bildansicht');
    L.ok(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest('.shot-frame'))), 'Fokus kehrt zum Bild zurück');
    L.ok(!(await page.evaluate(() => document.body.classList.contains('no-scroll'))), 'Seite ist wieder scrollbar');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  for (const devName of ['iPhone 13', 'iPad (gen 7)']) {
    await L.section(devName + ': Zwei-Finger-Zoom, Wischen, Doppeltippen', async () => {
      const ctx = await browser.newContext(Object.assign({}, L.devices[devName]));
      const page = await L.openApp(ctx, L.fileUrl(L.APP));
      await seed(page, files);
      await L.go(page, '#/artikel/zoom-test', '.steps');
      await page.locator('.step .shot-frame[data-zoom]').first().tap();
      await page.waitForSelector('.lightbox .lb-canvas img');
      await page.waitForTimeout(250);
      const s0 = await state(page);
      L.ok(s0.w * s0.s <= s0.sw + 1, 'Bild passt auf den Bildschirm (' + s0.zoom + ')');
      const box = await page.locator('.lb-stage').boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      // Zwei-Finger-Zoom
      await page.evaluate(({ cx, cy }) => {
        const st = document.querySelector('.lb-stage');
        const ev = (type, id, x, y) => st.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: id === 1, button: 0 }));
        ev('pointerdown', 1, cx - 40, cy);
        ev('pointerdown', 2, cx + 40, cy);
        for (let i = 1; i <= 6; i++) { ev('pointermove', 1, cx - 40 - i * 20, cy); ev('pointermove', 2, cx + 40 + i * 20, cy); }
        ev('pointerup', 1, cx - 160, cy);
        ev('pointerup', 2, cx + 160, cy);
      }, { cx, cy });
      const s1 = await state(page);
      L.ok(s1.s > s0.s * 2, 'Zwei-Finger-Zoom vergrößert (' + s0.zoom + ' → ' + s1.zoom + ')');
      // Doppeltippen: zurück zur eingepassten Ansicht
      await page.evaluate(({ cx, cy }) => {
        const st = document.querySelector('.lb-stage');
        const ev = (type, id) => st.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true, isPrimary: true, button: 0 }));
        ev('pointerdown', 7); ev('pointerup', 7); ev('pointerdown', 8); ev('pointerup', 8);
      }, { cx, cy });
      const s2 = await state(page);
      L.ok(Math.abs(s2.s - s0.s) < 0.01, 'Doppeltippen passt wieder ein' + (Math.abs(s2.s - s0.s) < 0.01 ? '' : ' ' + JSON.stringify([s0, s1, s2])));
      // Wischen nach links: nächstes Bild
      await page.evaluate(({ cx, cy }) => {
        const st = document.querySelector('.lb-stage');
        const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: cy, bubbles: true, isPrimary: true, button: 0 }));
        ev('pointerdown', cx + 100); ev('pointermove', cx); ev('pointermove', cx - 100); ev('pointerup', cx - 100);
      }, { cx, cy });
      await page.waitForTimeout(150);
      L.eq((await state(page)).num, 'Abb. 1.2', 'Wischen blättert zum nächsten Bild');
      await page.locator('[data-lb="close"]').tap();
      L.ok(!(await page.locator('.lightbox').count()), 'Schließen per Tippen');
      L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
      await ctx.close();
    });
  }

  await L.section('iPhone: lange Bildunterschrift – Schließen bleibt erreichbar', async () => {
    const ctx = await browser.newContext(Object.assign({}, L.devices['iPhone 13']));
    const page = await L.openApp(ctx, L.fileUrl(L.APP));
    await page.evaluate(async () => {
      const svg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="900"><rect width="640" height="900" fill="#eef3fc"/></svg>');
      const cap = 'Sehr lange Bildunterschrift zum Testen der Kopfleiste – schematische Darstellung mit vielen Wörtern, die auf einem schmalen Bildschirm nicht in eine Zeile passen (erfunden)';
      const a = PH.model.normalizeArticle({ id: 'lang-test', type: 'guide', title: 'Langer Text (erfunden)', images: [{ src: svg, caption: cap }], steps: [{ title: 'Eins' }] });
      await PH.app.commit(Object.assign({}, PH.app.kb, { articles: PH.app.kb.articles.concat(a) }));
    });
    await L.go(page, '#/artikel/lang-test', '.article-figures');
    await page.locator('.article-figures .shot-frame').tap();
    await page.waitForSelector('.lightbox');
    await page.waitForTimeout(250);
    const r = await page.evaluate(() => {
      const b = document.querySelector('[data-lb="close"]').getBoundingClientRect();
      const bar = document.querySelector('.lb-bar').getBoundingClientRect();
      return { right: b.right, top: b.top, bar: bar.width, vw: innerWidth };
    });
    L.ok(r.bar <= r.vw + 1, 'Kopfleiste bleibt so breit wie der Bildschirm (' + Math.round(r.bar) + ' ≤ ' + r.vw + ')');
    L.ok(r.right <= r.vw && r.top >= 0, 'Schließen-Schaltfläche liegt im sichtbaren Bereich');
    const bb = await page.locator('[data-lb="close"]').boundingBox();
    await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForFunction(() => !document.querySelector('.lightbox'));
    L.ok(true, 'Schließen per Antippen');
    L.ok(!page._errors.length, 'keine Konsolenfehler' + (page._errors.length ? ': ' + page._errors.join(' | ') : ''));
    await ctx.close();
  });

  await browser.close();
  L.done();
})();
