/* Protel Hilfe – Verwaltung: Datenstand, Import/Export, Kategorien, Synonyme, Pflegebedarf */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc, fmtDate, formatBytes, truncate, clone, slugify } = PH.util;
  const icon = PH.icon;

  const ICON_LABELS = {
    logIn: 'Anreise', logOut: 'Abreise', calendar: 'Kalender', card: 'Karte', euro: 'Geld', users: 'Personen', monitor: 'Bildschirm',
    moon: 'Nacht', phone: 'Telefon', key: 'Schlüssel', coffee: 'Kaffee', bed: 'Bett', book: 'Buch', shield: 'Sicherheit', mail: 'Post',
    wifi: 'WLAN', flag: 'Fahne', folder: 'Ordner', luggage: 'Gepäck', printer: 'Drucker', help: 'Fragezeichen', bell: 'Glocke', grid: 'Raster', pin: 'Ort',
  };
  const KIND_LABELS = { exact: 'exakt', synonym: 'Synonym', prefix: 'Wortanfang', compound: 'Wortteil', fuzzy: 'Tippfehler' };

  function stat(label, value, sub) {
    return '<div class="stat"><div class="stat-value">' + value + '</div><div class="stat-label">' + esc(label) + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  function view() {
    const kb = PH.app.kb;
    const s = PH.app.status();
    const size = new Blob([PH.model.toJSON(kb)]).size;
    const examples = kb.articles.filter((a) => a.example).length;
    const statusLine = !s.hasLocal
      ? '<span class="status ok">' + icon('checkCircle') + 'Entspricht der Datei <code>data/wissensdatenbank.js</code></span>'
      : s.dirty
        ? '<span class="status warn">' + icon('alert') + 'Lokale Änderungen – noch nicht für den App-Ordner exportiert</span>'
        : '<span class="status ok">' + icon('checkCircle') + 'Lokale Kopie, zuletzt exportiert</span>';

    const html =
      PH.views.breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Verwaltung' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('settings') + '</span><div class="page-head-text"><h1>Verwaltung</h1>' +
      '<p>Wissensdatenbank sichern, verteilen, importieren und pflegen.</p></div></header>' +

      '<section class="card admin-card">' +
      '<h2>' + icon('database') + 'Datenbestand</h2>' +
      '<div class="stats">' +
      stat('Artikel', kb.articles.length, examples ? examples + ' davon Beispiele' : '') +
      stat('Kategorien', kb.categories.length) +
      stat('Synonymgruppen', kb.synonyms.length) +
      stat('Bilder', PH.model.countImages(kb), formatBytes(size) + ' gesamt') +
      '</div>' +
      '<dl class="kv">' +
      '<dt>Status</dt><dd>' + statusLine + '</dd>' +
      '<dt>Letzte Änderung</dt><dd>' + fmtDate(kb.meta.updated, true) + '</dd>' +
      '<dt>Revision</dt><dd><code>' + esc(kb.meta.revision) + '</code></dd>' +
      '<dt>Datei im App-Ordner</dt><dd>' + (s.bundledAvailable ? 'Stand ' + fmtDate(s.bundledUpdated, true) + ' · <code>' + esc(s.bundledRevision) + '</code>' : '<span class="status warn">' + icon('alert') + 'nicht gefunden oder fehlerhaft</span>') + '</dd>' +
      '<dt>Speicherort lokal</dt><dd>' + esc(PH.store.backendLabel()) + '</dd>' +
      '</dl></section>' +

      '<div class="admin-grid">' +
      '<section class="card admin-card">' +
      '<h2>' + icon('download') + 'Exportieren</h2>' +
      '<div class="action-block"><button type="button" class="btn btn-primary" data-adm="export-js">' + icon('download') + 'Für App-Ordner exportieren</button>' +
      '<p class="field-hint">Erzeugt <code>wissensdatenbank.js</code>. Ersetzen Sie damit die gleichnamige Datei im Unterordner <code>data</code> der App (z. B. auf dem Netzlaufwerk). Alle PCs sehen den neuen Stand nach dem Neuladen ({{F5}}).</p></div>' +
      '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="export-json">' + icon('save') + 'Sicherung exportieren (.json)</button>' +
      '<p class="field-hint">Vollständige Sicherung inkl. Bilder – kann jederzeit wieder importiert werden.</p></div>' +
      '</section>' +

      '<section class="card admin-card">' +
      '<h2>' + icon('upload') + 'Importieren</h2>' +
      '<label class="file-drop" for="imp-file">' + icon('upload') + '<span><strong>Datei auswählen</strong><br><span class="muted">.json-Sicherung oder wissensdatenbank.js</span></span>' +
      '<input type="file" id="imp-file" accept=".json,.js,application/json,text/javascript" class="sr-only"></label>' +
      '<div id="imp-preview"></div>' +
      '</section>' +
      '</div>' +

      '<section class="card admin-card">' +
      '<h2>' + icon('refresh') + 'Zurücksetzen &amp; Beispiele</h2>' +
      '<div class="admin-grid inner">' +
      '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="reset"' + (s.hasLocal && s.bundledAvailable ? '' : ' disabled') + '>' + icon('refresh') + 'Lokale Änderungen verwerfen</button>' +
      '<p class="field-hint">Lädt wieder den Stand aus <code>data/wissensdatenbank.js</code>. ' + (s.hasLocal ? 'Vorher ggf. eine Sicherung exportieren.' : 'Aktuell gibt es keine lokalen Änderungen.') + '</p></div>' +
      '<div class="action-block"><button type="button" class="btn btn-danger-ghost" data-adm="remove-examples"' + (examples ? '' : ' disabled') + '>' + icon('trash') + 'Alle Beispielartikel löschen (' + examples + ')</button>' +
      '<p class="field-hint">Entfernt alle als „Beispiel“ markierten Artikel. Kategorien, Synonyme und eigene Artikel bleiben erhalten.</p></div>' +
      '</div></section>' +

      '<section class="card admin-card" id="kategorien">' +
      '<div class="admin-card-head"><h2>' + icon('grid') + 'Kategorien</h2><div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-adm="cat-add">' + icon('plus') + 'Kategorie hinzufügen</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-adm="cat-save">' + icon('save') + 'Kategorien speichern</button></div></div>' +
      '<div id="cat-editor"></div></section>' +

      '<section class="card admin-card" id="synonyme">' +
      '<div class="admin-card-head"><h2>' + icon('tag') + 'Synonyme</h2><button type="button" class="btn btn-primary btn-sm" data-adm="syn-save">' + icon('save') + 'Synonyme speichern</button></div>' +
      '<p class="field-hint">Eine Gruppe pro Zeile, Begriffe durch Komma getrennt. Sucht jemand nach einem Begriff, werden alle Begriffe der Gruppe mitgesucht. Beispiel: <code>Check-out, Abreise, auschecken</code></p>' +
      '<textarea class="input mono" id="syn-text" rows="10" spellcheck="false">' + esc(kb.synonyms.map((g) => g.join(', ')).join('\n')) + '</textarea>' +
      '<div class="search-test">' +
      '<h3>' + icon('search') + 'Suchtest</h3>' +
      '<p class="field-hint">Zeigt, wie die Suche einen Begriff interpretiert (nach dem Speichern der Synonyme).</p>' +
      '<input class="input" id="syn-test" placeholder="z. B. Abreise, Rechnug, Zimmerkarte …" autocomplete="off">' +
      '<div id="syn-test-out"></div></div>' +
      '</section>' +

      '<section class="card admin-card" id="pflege">' +
      '<h2>' + icon('flag') + 'Pflegebedarf</h2>' +
      '<div id="care"></div></section>';

    return { title: 'Verwaltung', html, after: bind };
  }

  /* ------------------------------------------------------------ Pflegebedarf */

  function careHtml() {
    const kb = PH.app.kb;
    const prefs = PH.app.prefs;
    const noHits = Object.entries(prefs.noHits).sort((a, b) => b[1].count - a[1].count).slice(0, 15);
    const top = Object.entries(prefs.searches).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    const ph = kb.articles.map((a) => ({ a, n: PH.model.countPlaceholders(a) })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const trees = kb.articles.filter((a) => a.type === 'decision').map((a) => ({ a, w: PH.model.validateTree(a.tree) })).filter((x) => x.w.length);
    const old = kb.articles.filter((a) => a.updated && Date.now() - new Date(a.updated).getTime() > 365 * 86400000);
    const editLink = (a) => '<a href="#/bearbeiten/' + encodeURIComponent(a.id) + '" class="edit-only">bearbeiten</a>';
    const block = (title, ic, inner, extra) => '<div class="care-block"><h3>' + icon(ic) + esc(title) + '</h3>' + (extra || '') + inner + '</div>';

    return '<div class="care-grid">' +
      block('Suchanfragen ohne Treffer', 'search',
        noHits.length
          ? '<ul class="care-list">' + noHits.map(([q, v]) => '<li><a href="' + PH.views.searchUrl(q) + '">' + esc(q) + '</a><span class="muted">' + v.count + '× · ' + fmtDate(v.last) + '</span></li>').join('') + '</ul>' +
            '<button type="button" class="btn btn-ghost btn-xs" data-adm="clear-nohits">' + icon('trash') + 'Liste leeren</button>'
          : '<p class="muted small">Bisher keine – sehr gut.</p>',
        '<p class="field-hint">Hinweis auf fehlende Artikel oder Synonyme (nur auf diesem PC erfasst).</p>') +
      block('Häufigste Suchanfragen', 'history',
        top.length
          ? '<ul class="care-list">' + top.map(([q, v]) => '<li><a href="' + PH.views.searchUrl(q) + '">' + esc(q) + '</a><span class="muted">' + v.count + '× · ' + v.hits + ' Treffer</span></li>').join('') + '</ul>'
          : '<p class="muted small">Noch keine Suchanfragen erfasst.</p>') +
      block('Artikel mit offenen Platzhaltern', 'edit',
        ph.length
          ? '<ul class="care-list">' + ph.slice(0, 15).map((x) => '<li><a href="#/artikel/' + encodeURIComponent(x.a.id) + '">' + esc(truncate(x.a.title, 60)) + '</a><span class="muted">' + x.n + ' Platzhalter · ' + editLink(x.a) + '</span></li>').join('') + '</ul>'
          : '<p class="muted small">Keine offenen Platzhalter.</p>') +
      block('Entscheidungsbäume mit offenen Punkten', 'tree',
        trees.length
          ? '<ul class="care-list">' + trees.map((x) => '<li><a href="#/artikel/' + encodeURIComponent(x.a.id) + '">' + esc(truncate(x.a.title, 60)) + '</a><span class="muted">' + x.w.length + ' Hinweis(e) · ' + editLink(x.a) + '</span></li>').join('') + '</ul>'
          : '<p class="muted small">Alle Entscheidungsbäume sind vollständig verknüpft.</p>') +
      block('Länger als 12 Monate nicht aktualisiert', 'clock',
        old.length
          ? '<ul class="care-list">' + old.slice(0, 15).map((a) => '<li><a href="#/artikel/' + encodeURIComponent(a.id) + '">' + esc(truncate(a.title, 60)) + '</a><span class="muted">' + fmtDate(a.updated) + '</span></li>').join('') + '</ul>'
          : '<p class="muted small">Alle Artikel sind aktuell.</p>') +
      '</div>';
  }

  /* ------------------------------------------------------------ Kategorien */

  function catEditor(state) {
    const counts = PH.app.categoryCounts();
    if (!state.cats.length) return '<p class="muted">Noch keine Kategorien angelegt.</p>';
    return '<div class="cat-rows">' + state.cats.map((c, i) =>
      '<div class="cat-row" data-ci="' + i + '">' +
      '<span class="cat-icon color-' + esc(c.color) + '">' + icon(c.icon) + '</span>' +
      '<input class="input" data-cf="name" value="' + esc(c.name) + '" placeholder="Name" aria-label="Name der Kategorie">' +
      '<input class="input" data-cf="description" value="' + esc(c.description) + '" placeholder="Kurzbeschreibung (optional)" aria-label="Beschreibung">' +
      '<select class="input" data-cf="icon" aria-label="Symbol">' + PH.model.CAT_ICONS.map((n) => '<option value="' + n + '"' + (n === c.icon ? ' selected' : '') + '>' + esc(ICON_LABELS[n] || n) + '</option>').join('') + '</select>' +
      '<select class="input" data-cf="color" aria-label="Farbe">' + PH.model.COLORS.map((n) => '<option value="' + n + '"' + (n === c.color ? ' selected' : '') + '>' + esc(PH.model.COLOR_LABELS[n]) + '</option>').join('') + '</select>' +
      '<span class="muted small cat-n">' + (c._new ? 'neu' : (counts[c.id] || 0) + ' Artikel') + '</span>' +
      '<div class="item-tools">' +
      '<button type="button" class="icon-btn btn-xs" data-cat-move="-1" title="Nach oben"' + (i === 0 ? ' disabled' : '') + '>' + icon('arrowUp') + '</button>' +
      '<button type="button" class="icon-btn btn-xs" data-cat-move="1" title="Nach unten"' + (i === state.cats.length - 1 ? ' disabled' : '') + '>' + icon('arrowDown') + '</button>' +
      '<button type="button" class="icon-btn btn-xs danger" data-cat-del title="Kategorie löschen">' + icon('trash') + '</button></div>' +
      '</div>'
    ).join('') + '</div>' + (state.dirty ? '<p class="status warn">' + icon('alert') + 'Ungespeicherte Änderungen an den Kategorien</p>' : '');
  }

  /* ------------------------------------------------------------ Suchtest */

  function searchTestHtml(q) {
    if (!q.trim()) return '';
    const idx = PH.app.index;
    const ex = idx.explain(q);
    const res = idx.search(q, { limit: 5 });
    return '<div class="table-wrap"><table class="explain"><thead><tr><th>Wort</th><th>Wird gesucht als</th></tr></thead><tbody>' +
      ex.map((t) => '<tr><td><strong>' + esc(t.word) + '</strong>' + (t.correction ? '<br><span class="muted small">Tippfehler? → ' + esc(t.correction.to) + '</span>' : '') + '</td><td>' +
        (t.candidates.length
          ? t.candidates.map((c) => '<span class="xchip kind-' + c.kind + '">' + esc(c.term) + ' <small>' + KIND_LABELS[c.kind] + ' · ' + c.docs + '</small></span>').join(' ')
          : '<span class="muted">kein passender Begriff im Index</span>') +
        '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<h4>Beste Treffer</h4>' +
      (res.results.length
        ? '<ol class="explain-results">' + res.results.map((r) => '<li><a href="#/artikel/' + encodeURIComponent(r.article.id) + '">' + esc(r.article.title) + '</a> <span class="muted small">Relevanz ' + r.score.toFixed(2).replace('.', ',') + ' · ' + Math.round(r.coverage * 100) + ' % der Wörter</span></li>').join('') + '</ol>'
        : '<p class="muted">Keine Treffer.</p>');
  }

  /* ------------------------------------------------------------ Import */

  let pendingImport = null;

  function importPreview(file, inc) {
    const kb = PH.app.kb;
    const plan = PH.model.planMerge(kb, inc);
    pendingImport = { inc, plan };
    return '<div class="import-preview">' +
      '<p><strong>' + esc(file.name) + '</strong> · ' + formatBytes(file.size) + ' · Stand ' + fmtDate(inc.meta.updated, true) + '</p>' +
      '<ul class="import-stats">' +
      '<li><strong>' + inc.articles.length + '</strong> Artikel, <strong>' + inc.categories.length + '</strong> Kategorien, <strong>' + inc.synonyms.length + '</strong> Synonymgruppen in der Datei</li>' +
      '</ul>' +
      '<div class="import-options">' +
      '<div class="import-option"><h4>Zusammenführen</h4><ul>' +
      '<li>' + plan.added.length + ' neue Artikel</li>' +
      '<li>' + plan.updated.length + ' Artikel werden aktualisiert (neuer in der Datei)</li>' +
      '<li>' + plan.skipped.length + ' Artikel bleiben unverändert (lokal gleich oder neuer)</li>' +
      '<li>' + plan.newCategories.length + ' neue Kategorien, ' + plan.newSynonyms.length + ' neue Synonymgruppen</li></ul>' +
      '<button type="button" class="btn btn-primary btn-sm" data-adm="import-merge">Zusammenführen</button></div>' +
      '<div class="import-option"><h4>Komplett ersetzen</h4><p class="small">Die aktuelle Wissensdatenbank wird vollständig durch den Inhalt der Datei ersetzt.</p>' +
      '<button type="button" class="btn btn-danger-ghost btn-sm" data-adm="import-replace">Alles ersetzen</button></div>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-xs" data-adm="import-cancel">Abbrechen</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------ Bindung */

  function bind(el) {
    const kb = PH.app.kb;
    const catState = { cats: clone(kb.categories), deleted: [], dirty: false };
    const catHost = el.querySelector('#cat-editor');
    const renderCats = () => { catHost.innerHTML = catEditor(catState); };
    renderCats();
    el.querySelector('#care').innerHTML = careHtml();

    // Formatierte Hinweise ({{F5}} etc.)
    el.querySelectorAll('.field-hint').forEach((p) => {
      if (p.innerHTML.includes('{{')) p.innerHTML = p.innerHTML.replace(/\{\{([^{}]+)\}\}/g, (_, k) => '<kbd>' + k + '</kbd>');
    });

    let synOrig = el.querySelector('#syn-text').value;
    const synDirty = () => el.querySelector('#syn-text').value !== synOrig;
    PH.app.setLeaveGuard(() => catState.dirty || synDirty());

    catHost.addEventListener('input', (e) => {
      const row = e.target.closest('[data-ci]');
      if (!row || !e.target.dataset.cf) return;
      const c = catState.cats[+row.dataset.ci];
      c[e.target.dataset.cf] = e.target.value;
      catState.dirty = true;
      if (e.target.dataset.cf === 'icon' || e.target.dataset.cf === 'color') {
        const ic = row.querySelector('.cat-icon');
        ic.className = 'cat-icon color-' + c.color;
        ic.innerHTML = icon(c.icon);
      }
    });
    catHost.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-ci]');
      if (!row) return;
      const i = +row.dataset.ci;
      const mv = e.target.closest('[data-cat-move]');
      if (mv) {
        const j = i + +mv.dataset.catMove;
        [catState.cats[i], catState.cats[j]] = [catState.cats[j], catState.cats[i]];
        catState.dirty = true;
        renderCats();
        return;
      }
      if (e.target.closest('[data-cat-del]')) {
        const c = catState.cats[i];
        const n = PH.app.categoryCounts()[c.id] || 0;
        if (n && !c._new) {
          const ok = await PH.ui.confirm({
            title: 'Kategorie löschen?',
            html: 'Die Kategorie <strong>' + esc(c.name) + '</strong> enthält ' + n + ' Artikel. Diese werden beim Speichern „Ohne Kategorie“ zugeordnet.',
            okLabel: 'Löschen', danger: true,
          });
          if (!ok) return;
        }
        catState.deleted.push(c.id);
        catState.cats.splice(i, 1);
        catState.dirty = true;
        renderCats();
      }
    });

    const synTest = el.querySelector('#syn-test');
    const synOut = el.querySelector('#syn-test-out');
    synTest.addEventListener('input', PH.util.debounce(() => { synOut.innerHTML = searchTestHtml(synTest.value); }, 120));

    el.querySelector('#imp-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      const out = el.querySelector('#imp-preview');
      if (!f) return;
      try {
        const text = await PH.util.readFile(f, 'text');
        const inc = PH.model.parseImportText(text);
        out.innerHTML = importPreview(f, inc);
      } catch (err) {
        pendingImport = null;
        out.innerHTML = '<div class="callout callout-danger"><div class="callout-title">' + icon('xCircle') + 'Import nicht möglich</div><div class="callout-body"><p>' + esc(err.message) + '</p></div></div>';
      }
      e.target.value = '';
    });

    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-adm]');
      if (!b) return;
      const act = b.dataset.adm;
      if (act === 'export-js') {
        PH.app.exportForFolder();
      } else if (act === 'export-json') {
        PH.app.exportBackup();
      } else if (act === 'reset') {
        PH.app.resetToBundled();
      } else if (act === 'remove-examples') {
        const ex = PH.app.kb.articles.filter((a) => a.example);
        const ok = await PH.ui.confirm({
          title: 'Beispielartikel löschen?',
          html: ex.length + ' als „Beispiel“ markierte Artikel werden gelöscht. Tipp: vorher eine Sicherung exportieren.',
          okLabel: 'Beispiele löschen', danger: true,
        });
        if (!ok) return;
        const ids = new Set(ex.map((a) => a.id));
        const cur = PH.app.kb;
        const articles = cur.articles.filter((a) => !ids.has(a.id)).map((a) => PH.app.withoutRefs(a, ids));
        await PH.app.commit(Object.assign({}, cur, { articles, meta: Object.assign({}, cur.meta, { exampleData: false }) }));
        PH.ui.toast(ex.length + ' Beispielartikel gelöscht.', 'success');
        PH.app.refresh();
      } else if (act === 'cat-add') {
        catState.cats.push({ id: '', name: '', description: '', icon: 'folder', color: 'slate', _new: true });
        catState.dirty = true;
        renderCats();
        const inputs = catHost.querySelectorAll('[data-cf="name"]');
        inputs[inputs.length - 1].focus();
      } else if (act === 'cat-save') {
        const cur = PH.app.kb;
        const used = new Set(cur.categories.map((c) => c.id));
        const cats = catState.cats.map((c) => {
          const name = c.name.trim() || 'Neue Kategorie';
          let id = c.id;
          if (c._new || !id) {
            const base = slugify(name);
            id = base;
            let n = 2;
            while (used.has(id)) id = base + '-' + n++;
            used.add(id);
          }
          return { id, name, description: c.description.trim(), icon: c.icon, color: c.color };
        });
        const del = new Set(catState.deleted);
        const articles = cur.articles.map((a) => (del.has(a.categoryId) ? Object.assign({}, a, { categoryId: '' }) : a));
        await PH.app.commit(Object.assign({}, cur, { categories: cats, articles }));
        catState.cats = clone(cats);
        catState.deleted = [];
        catState.dirty = false;
        renderCats();
        PH.ui.toast('Kategorien gespeichert.', 'success');
      } else if (act === 'syn-save') {
        const ta = el.querySelector('#syn-text');
        const groups = PH.model.normalizeSynonyms(ta.value.split('\n').map((l) => l.split(',')));
        await PH.app.commit(Object.assign({}, PH.app.kb, { synonyms: groups }));
        ta.value = groups.map((g) => g.join(', ')).join('\n');
        synOrig = ta.value;
        PH.ui.toast(groups.length + ' Synonymgruppen gespeichert.', 'success');
        synOut.innerHTML = searchTestHtml(synTest.value);
      } else if (act === 'clear-nohits') {
        PH.app.prefs.noHits = {};
        PH.app.savePrefs();
        el.querySelector('#care').innerHTML = careHtml();
      } else if (act === 'import-cancel') {
        pendingImport = null;
        el.querySelector('#imp-preview').innerHTML = '';
      } else if (act === 'import-merge' && pendingImport) {
        const merged = PH.model.applyMerge(PH.app.kb, pendingImport.plan);
        const p = pendingImport.plan;
        await PH.app.commit(merged);
        pendingImport = null;
        PH.ui.toast('Import abgeschlossen: ' + p.added.length + ' neu, ' + p.updated.length + ' aktualisiert.', 'success');
        PH.app.refresh();
      } else if (act === 'import-replace' && pendingImport) {
        const ok = await PH.ui.confirm({
          title: 'Wissensdatenbank ersetzen?',
          html: 'Alle aktuellen Artikel, Kategorien und Synonyme werden durch den Inhalt der Datei ersetzt. Dies kann nicht rückgängig gemacht werden – exportieren Sie vorher ggf. eine Sicherung.',
          okLabel: 'Ersetzen', danger: true,
        });
        if (!ok) return;
        await PH.app.commit(pendingImport.inc);
        pendingImport = null;
        PH.ui.toast('Wissensdatenbank ersetzt.', 'success');
        PH.app.refresh();
      }
    });
  }

  PH.admin = { view };
})();
