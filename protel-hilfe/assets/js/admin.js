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
    const isFile = PH.env.isFile;
    const lastBackup = PH.app.prefs.lastBackup;
    const ist = PH.model.imageStats(kb);
    const internal = PH.model.hasInternal(kb);
    const smallStore = PH.store.backend !== 'indexeddb';
    const statusLine = !s.hasLocal
      ? '<span class="status ok">' + icon('checkCircle') + (isFile ? 'Entspricht der Datei <code>data/wissensdatenbank.js</code>' : 'Entspricht der veröffentlichten Version') + '</span>'
      : s.dirty
        ? '<span class="status warn">' + icon('alert') + (isFile ? 'Lokale Änderungen – noch nicht für den App-Ordner exportiert' : 'Eigene Änderungen – nur auf diesem Gerät gespeichert') + '</span>'
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
      stat('Bilder', ist.total, ist.intern + ' intern · ' + ist.oeffentlich + ' öffentlich') +
      stat('Datenmenge', formatBytes(size), formatBytes(ist.bytes) + ' davon Bilder') +
      '</div>' +
      (smallStore && size > 3 * 1024 * 1024
        ? '<div class="callout callout-warning"><div class="callout-title">' + icon('alert') + 'Wenig Speicherplatz</div><div class="callout-body"><p>Dieser Browser speichert nur im kleinen ' +
          esc(PH.store.backendLabel()) + '. Bei vielen Bildern kann das Speichern fehlschlagen. Bitte regelmäßig eine Sicherung exportieren oder die App in einem anderen Browser bzw. als installierte App nutzen.</p></div></div>'
        : '') +
      '<dl class="kv">' +
      '<dt>Status</dt><dd>' + statusLine + '</dd>' +
      '<dt>Inhaltsstand</dt><dd>' + (internal
        ? '<span class="status warn">' + icon('shield') + 'Interne Inhalte – nur intern verteilen, nicht veröffentlichen</span>'
        : '<span class="status ok">' + icon('checkCircle') + esc(kb.meta.package ? PH.model.PACKAGES[kb.meta.package] : 'nur öffentliche Inhalte') + '</span>') + '</dd>' +
      '<dt>Datenformat</dt><dd>Version ' + PH.model.SCHEMA + ' <span class="muted">(ältere Sicherungen werden beim Import automatisch umgewandelt)</span></dd>' +
      '<dt>Letzte Änderung</dt><dd>' + fmtDate(kb.meta.updated, true) + '</dd>' +
      '<dt>Revision</dt><dd><code>' + esc(kb.meta.revision) + '</code></dd>' +
      '<dt>' + (isFile ? 'Datei im App-Ordner' : 'Veröffentlichte Version') + '</dt><dd>' + (s.bundledAvailable ? 'Stand ' + fmtDate(s.bundledUpdated, true) + ' · <code>' + esc(s.bundledRevision) + '</code>' : '<span class="status warn">' + icon('alert') + 'nicht gefunden oder fehlerhaft</span>') + '</dd>' +
      '<dt>Speicherort lokal</dt><dd>' + esc(PH.store.backendLabel()) + '</dd>' +
      '<dt>Letzte Sicherung</dt><dd>' + (lastBackup ? fmtDate(lastBackup, true) : '<span class="status warn">' + icon('alert') + 'noch keine auf diesem Gerät</span>') + '</dd>' +
      '</dl></section>' +

      (PH.env.isWeb ? '<section class="card admin-card" id="app-offline"><h2>' + icon('wifi') + 'App &amp; Offline</h2><div id="pwa-status"><p class="muted">Wird geprüft …</p></div></section>' : '') +

      '<div class="admin-grid">' +
      '<section class="card admin-card">' +
      '<h2>' + icon('download') + 'Exportieren</h2>' +
      (isFile
        ? '<div class="action-block"><button type="button" class="btn btn-primary" data-adm="export-js">' + icon('download') + 'Für App-Ordner exportieren (intern)</button>' +
          '<p class="field-hint">Erzeugt <code>wissensdatenbank.js</code> mit allen Inhalten. Ersetzen Sie damit die gleichnamige Datei im Unterordner <code>data</code> der App auf dem internen Laufwerk. Alle PCs sehen den neuen Stand nach dem Neuladen ({{F5}}).</p></div>' +
          '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="export-json">' + icon('save') + 'Sicherung exportieren (.json)</button>' +
          '<p class="field-hint">Vollständige Sicherung inkl. Bilder – kann jederzeit wieder importiert werden. Dient auch als <strong>interne Importdatei</strong> für iPhone/iPad.</p></div>'
        : '<div class="action-block"><button type="button" class="btn btn-primary" data-adm="export-json">' + icon('save') + 'Sicherung exportieren (.json)</button>' +
          '<p class="field-hint">Vollständige Sicherung inkl. Bilder. ' + (PH.env.isAppleMobile ? 'Öffnet das Teilen-Menü: „In Dateien sichern“, AirDrop oder Mail. ' : '') +
          'Zum Übertragen auf ein anderes iPhone/iPad dort unter Verwaltung importieren.</p></div>' +
          '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="export-js">' + icon('download') + 'Datendatei für die interne PC-Version</button>' +
          '<p class="field-hint">Erzeugt <code>wissensdatenbank.js</code> mit allen Inhalten für den Ordner <code>data</code> der internen PC-Version. Nicht veröffentlichen.</p></div>') +
      '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="export-public">' + icon('shield') + 'Öffentliche Datendatei exportieren</button>' +
      '<p class="field-hint">Nur ausdrücklich öffentliche Artikel und Bilder; ohne Bildplätze, ohne Namen. Eigene protel-Screenshots sind nie enthalten.</p></div>' +
      '</section>' +

      '<section class="card admin-card">' +
      '<h2>' + icon('upload') + 'Importieren</h2>' +
      '<label class="file-drop" for="imp-file">' + icon('upload') + '<span><strong>Datei auswählen</strong><br><span class="muted">.json-Sicherung oder wissensdatenbank.js</span></span>' +
      '<input type="file" id="imp-file"' + (PH.env.isAppleMobile ? '' : ' accept=".json,.js,application/json,text/javascript"') + ' class="sr-only"></label>' +
      '<div id="imp-preview"></div>' +
      '</section>' +
      '</div>' +

      '<section class="card admin-card">' +
      '<h2>' + icon('refresh') + 'Zurücksetzen &amp; Beispiele</h2>' +
      '<div class="admin-grid inner">' +
      '<div class="action-block"><button type="button" class="btn btn-secondary" data-adm="reset"' + (s.hasLocal && s.bundledAvailable ? '' : ' disabled') + '>' + icon('refresh') + 'Lokale Änderungen verwerfen</button>' +
      '<p class="field-hint">Lädt wieder den Stand ' + (isFile ? 'aus <code>data/wissensdatenbank.js</code>' : 'der veröffentlichten Version') + '. ' + (s.hasLocal ? 'Vorher ggf. eine Sicherung exportieren.' : 'Aktuell gibt es keine lokalen Änderungen.') + '</p></div>' +
      '<div class="action-block"><button type="button" class="btn btn-danger-ghost" data-adm="remove-examples"' + (examples ? '' : ' disabled') + '>' + icon('trash') + 'Alle Beispielartikel löschen (' + examples + ')</button>' +
      '<p class="field-hint">Entfernt alle als „Beispiel“ markierten Artikel. Kategorien, Synonyme und eigene Artikel bleiben erhalten.</p></div>' +
      '</div></section>' +

      '<section class="card admin-card" id="wiederherstellung">' +
      '<h2>' + icon('history') + 'Wiederherstellungspunkte</h2>' +
      '<p class="field-hint">Vor riskanten Aktionen (Import, Ersetzen, Laden einer neuen Version, Umstellung des Datenformats) sichert die App den bisherigen Stand automatisch auf diesem Gerät. ' +
      'Es bleiben die letzten ' + PH.store.MAX_SNAPSHOTS + ' Punkte; angeheftete Punkte bleiben, bis Sie sie löschen. Ersetzt keine regelmäßige Sicherung.</p>' +
      '<div id="snap-list"><p class="muted">Wird geladen …</p></div></section>' +

      '<section class="card admin-card" id="bilder">' +
      '<div class="admin-card-head"><h2>' + icon('image') + 'Bilder &amp; Bildplätze</h2><div class="btn-row">' +
      '<label class="btn btn-secondary btn-sm" for="bulk-files">' + icon('upload') + 'Screenshots zuordnen …</label>' +
      '<input type="file" id="bulk-files" multiple accept="image/*" class="sr-only">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-adm="slots-csv">' + icon('download') + 'Liste als CSV</button></div></div>' +
      '<p class="field-hint"><strong>Screenshots zuordnen:</strong> mehrere Bilddateien auf einmal wählen. Beginnt der Dateiname mit der Nummer eines Bildplatzes (z. B. <code>S-CIN-06_wizard.png</code>), ' +
      'wird das Bild automatisch dort eingefügt, verkleinert und als <strong>intern</strong> gekennzeichnet. Vorher sehen Sie eine Vorschau.</p>' +
      '<div id="bulk-preview"></div>' +
      '<div id="slot-list"></div></section>' +

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
    const todayIso = new Date().toISOString().slice(0, 10);
    const toCheck = kb.articles.filter((a) => ['entwurf', 'pruefung', 'veraltet'].includes(a.review.status) || (a.review.nextReview && a.review.nextReview <= todayIso))
      .sort((a, b) => a.title.localeCompare(b.title, 'de'));
    const editLink = (a) => '<a href="#/bearbeiten/' + encodeURIComponent(a.id) + '" class="edit-only">bearbeiten</a>';
    const block = (title, ic, inner, extra) => '<div class="care-block"><h3>' + icon(ic) + esc(title) + '</h3>' + (extra || '') + inner + '</div>';

    return '<div class="care-grid">' +
      block('Zu prüfen (Prüfstatus)', 'shield',
        toCheck.length
          ? '<ul class="care-list">' + toCheck.slice(0, 20).map((a) => '<li><a href="#/artikel/' + encodeURIComponent(a.id) + '">' + esc(truncate(a.title, 60)) + '</a><span class="muted">' +
            esc(a.review.status ? PH.model.REVIEW_STATUS[a.review.status].short : 'Wiedervorlage') + (a.review.nextReview ? ' · bis ' + fmtDate(a.review.nextReview) : '') + '</span></li>').join('') + '</ul>'
          : '<p class="muted small">Keine offenen Prüfungen.</p>') +
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

  /* ------------------------------------------------------------ Wiederherstellungspunkte */

  async function snapListHtml() {
    if (!PH.store.canSnapshot()) {
      return '<p class="status warn">' + icon('alert') + 'In diesem Browser nicht verfügbar (' + esc(PH.store.backendLabel()) + '). Bitte regelmäßig eine Sicherung exportieren.</p>';
    }
    let list = [];
    try { list = await PH.store.listSnapshots(); } catch (e) { return '<p class="status warn">' + icon('alert') + esc(e.message) + '</p>'; }
    if (!list.length) return '<p class="muted small">Noch keine Wiederherstellungspunkte auf diesem Gerät.</p>';
    return '<div class="table-wrap"><table class="snap-table"><thead><tr><th>Zeitpunkt</th><th>Anlass</th><th>Inhalt</th><th></th></tr></thead><tbody>' +
      list.map((x) => '<tr data-snap="' + esc(x.id) + '"><td>' + fmtDate(x.createdAt, true) + (x.pinned ? ' <span class="badge badge-pin" title="Wird nicht automatisch gelöscht">angeheftet</span>' : '') + '</td>' +
        '<td>' + esc(x.reason) + '</td>' +
        '<td class="muted small">' + x.articles + ' Artikel · ' + x.images + ' Bilder · ' + formatBytes(x.bytes) + (x.schema && x.schema < PH.model.SCHEMA ? ' · Datenformat ' + x.schema : '') + '</td>' +
        '<td class="snap-actions"><button type="button" class="btn btn-secondary btn-xs" data-snap-act="restore">' + icon('refresh') + 'Wiederherstellen</button>' +
        '<button type="button" class="btn btn-ghost btn-xs" data-snap-act="download">' + icon('download') + 'Herunterladen</button>' +
        '<button type="button" class="icon-btn btn-xs danger" data-snap-act="delete" title="Löschen" aria-label="Wiederherstellungspunkt löschen">' + icon('trash') + '</button></td></tr>'
      ).join('') + '</tbody></table></div>';
  }

  /* ------------------------------------------------------------ Bildplätze (nach Bildschirmbereich) */

  function slotRows() {
    return PH.model.allSlots(PH.app.kb).map((x) => ({
      area: x.slot.area || 'ohne Bereich',
      id: x.slot.id,
      article: x.article,
      step: x.stepIndex + 1,
      need: (PH.model.SLOT_NEED[x.slot.need] || PH.model.SLOT_NEED.optional).label,
      title: x.slot.title,
      test: x.slot.test,
      same: x.slot.same,
      state: x.state,
    })).sort((a, b) => a.area.localeCompare(b.area, 'de') || a.id.localeCompare(b.id, 'de'));
  }

  function slotListHtml() {
    const st = PH.model.imageStats(PH.app.kb);
    const rows = slotRows();
    const count = (k) => rows.filter((r) => r.state === k).length;
    let html = '<div class="stats small-stats">' +
      stat('Bilder', st.total, st.intern + ' intern · ' + st.oeffentlich + ' öffentlich') +
      stat('Bildplätze', rows.length, count('fehlt') + ' fehlen') +
      stat('Vorhanden', count('vorhanden') + count('geprueft'), count('geprueft') + ' geprüft') +
      stat('Veraltet', count('veraltet')) + '</div>';
    if (!rows.length) return html + '<p class="muted small">Noch keine Bildplätze geplant. Bildplätze legen Sie im Editor je Schritt an.</p>';
    const groups = [];
    rows.forEach((r) => {
      const g = groups[groups.length - 1];
      if (g && g.area === r.area) g.rows.push(r);
      else groups.push({ area: r.area, rows: [r] });
    });
    html += '<div class="filterbar"><label class="field-inline"><span class="muted">Anzeigen:</span><select class="input input-sm" id="slot-filter">' +
      '<option value="">alle</option><option value="fehlt">nur fehlende</option><option value="veraltet">nur veraltete</option></select></label></div>';
    html += groups.map((g) => '<details class="slot-group" open><summary><strong>' + esc(g.area) + '</strong> <span class="muted">' + g.rows.length + ' Bildplätze · ' +
      g.rows.filter((r) => r.state === 'fehlt').length + ' fehlen</span></summary>' +
      '<div class="table-wrap"><table class="slot-table"><thead><tr><th>Nr.</th><th>Motiv</th><th>Artikel / Schritt</th><th>Bedarf</th><th>Testfall</th><th>Status</th></tr></thead><tbody>' +
      g.rows.map((r) => '<tr data-state="' + r.state + '"><td><code>' + esc(r.id) + '</code>' + (r.same ? '<span class="muted small slot-same" title="gleiche Aufnahme wie ' + esc(r.same) + '"> = ' + esc(r.same) + '</span>' : '') + '</td><td>' + esc(r.title) + '</td>' +
        '<td><a href="#/bearbeiten/' + encodeURIComponent(r.article.id) + '?schritt=' + r.step + '">' + esc(truncate(r.article.title, 40)) + '</a> · ' + r.step + '</td>' +
        '<td>' + esc(r.need) + '</td><td>' + esc(r.test) + '</td>' +
        '<td><span class="slot-state state-' + r.state + '">' + esc(PH.model.SLOT_STATES[r.state].label) + '</span></td></tr>').join('') +
      '</tbody></table></div></details>').join('');
    return html;
  }

  function slotsCsv() {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Bildschirmbereich', 'Nr.', 'Motiv', 'Artikel', 'Schritt', 'Bedarf', 'Testfall', 'Status', 'Gleiche Aufnahme wie'].map(q).join(';')];
    slotRows().forEach((r) => lines.push([r.area, r.id, r.title, r.article.title, r.step, r.need, r.test, PH.model.SLOT_STATES[r.state].label, r.same].map(q).join(';')));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  /* ------------------------------------------------------------ Sammelimport von Screenshots */

  let pendingBulk = null;

  /** Ordnet Dateien anhand der Bildplatz-Nummer am Anfang des Dateinamens zu */
  function planBulk(files) {
    // Nummer → alle Bildplätze mit dieser Nummer, dazu Bildplätze, die diese Aufnahme mitbenutzen („gleiche Aufnahme wie“)
    const index = new Map();
    const add = (key, x) => {
      if (!key) return;
      const k = key.toUpperCase();
      if (!index.has(k)) index.set(k, []);
      if (!index.get(k).includes(x)) index.get(k).push(x);
    };
    PH.model.allSlots(PH.app.kb).forEach((x) => { add(x.slot.id, x); add(x.slot.same, x); });
    return files.map((f) => {
      const m = /^\s*([A-Za-z]-[A-Za-z]{3}-\d{2,3})/.exec(f.name);
      const id = m ? m[1].toUpperCase() : '';
      const hits = id ? index.get(id) || [] : [];
      const replaced = hits.filter((h) => h.state !== 'fehlt').length;
      const action = !id ? 'keine Nummer im Dateinamen' : !hits.length ? 'kein passender Bildplatz'
        : (hits.length > 1 ? hits.length + ' Bildplätze – ' : '') +
          (!replaced ? 'neu' : replaced === hits.length ? 'ersetzt vorhandenes Bild' : 'neu bzw. ersetzt vorhandenes Bild');
      return { file: f, id, hits, hit: hits[0] || null, action };
    });
  }

  function bulkPreviewHtml(plan) {
    const ok = plan.filter((x) => x.hits.length);
    const nImg = ok.reduce((n, x) => n + x.hits.length, 0);
    return '<div class="import-preview"><h3>' + icon('image') + plan.length + ' Datei(en) gewählt – ' + ok.length + ' zuordenbar</h3>' +
      '<div class="table-wrap"><table class="slot-table"><thead><tr><th>Datei</th><th>Bildplatz</th><th>Artikel / Schritt</th><th>Ergebnis</th></tr></thead><tbody>' +
      plan.map((x) => '<tr class="' + (x.hit ? '' : 'muted') + '"><td>' + esc(x.file.name) + ' <span class="muted small">' + formatBytes(x.file.size) + '</span></td>' +
        '<td>' + (x.id ? '<code>' + esc(x.id) + '</code>' : '–') + '</td>' +
        '<td>' + (x.hits.length ? x.hits.map((h) => esc(truncate(h.article.title, 40)) + ' · ' + (h.stepIndex + 1) +
          (h.slot.id.toUpperCase() !== x.id ? ' <span class="muted small">(' + esc(h.slot.id) + ', gleiche Aufnahme)</span>' : '')).join('<br>') : '–') + '</td>' +
        '<td>' + esc(x.action) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="field-hint">Alle Bilder werden verkleinert und als <strong>intern</strong> (Herkunft: eigener Screenshot) gekennzeichnet. Vorher wird ein Wiederherstellungspunkt angelegt.</p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary btn-sm" data-adm="bulk-apply"' + (ok.length ? '' : ' disabled') + '>' + nImg + ' Bild(er) übernehmen</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-adm="bulk-cancel">Abbrechen</button></div></div>';
  }

  async function applyBulk(plan) {
    const kb = PH.util.clone(PH.app.kb);
    const byId = new Map(kb.articles.map((a) => [a.id, a]));
    let n = 0;
    const errors = [];
    for (const x of plan) {
      if (!x.hits || !x.hits.length) continue;
      try {
        const src = await PH.editor._processImage(x.file);
        const date = x.file.lastModified ? new Date(x.file.lastModified).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        for (const h of x.hits) {
          const a = byId.get(h.article.id);
          const step = a && a.steps[h.stepIndex];
          const slot = step && step.slots.find((sl) => sl.id === h.slot.id);
          if (!slot) continue;
          const k = step.images.findIndex((img) => img.slot === slot.id);
          const base = k >= 0 ? step.images[k] : { caption: slot.title, alt: '', pmsVersion: a.review.pmsVersion };
          const img = PH.model.normalizeImage(Object.assign({}, base, {
            id: slot.id, slot: slot.id, src, markers: [], rights: 'intern', origin: 'screenshot', captured: date, status: '',
          }));
          if (k >= 0) step.images[k] = img;
          else step.images.push(img);
          a.updated = PH.model.now();
          n++;
        }
      } catch (e) {
        errors.push(x.file.name + ': ' + e.message);
      }
    }
    if (!n) {
      PH.ui.toast('Keine Bilder übernommen. ' + errors.join(' '), 'error');
      return;
    }
    await PH.app.safetySnapshot('Vor dem Sammelimport von ' + n + ' Screenshot(s)');
    await PH.app.commit(kb);
    PH.ui.toast(n + ' Bild(er) eingefügt und als intern gekennzeichnet.' + (errors.length ? ' Fehler: ' + errors.join('; ') : ''), errors.length ? 'warning' : 'success', { timeout: 6000 });
    PH.app.refresh();
  }

  /* ------------------------------------------------------------ Import */

  let pendingImport = null;

  function importPreview(file, info) {
    const inc = info.kb;
    const kb = PH.app.kb;
    const plan = PH.model.planMerge(kb, inc);
    pendingImport = { inc, plan, name: file.name };
    const ist = PH.model.imageStats(inc);
    const incInternal = PH.model.hasInternal(inc);
    const nIntern = inc.articles.filter((a) => !PH.model.isPublicArticle(a)).length;
    const nSlots = PH.model.allSlots(inc).length;
    const nDraft = inc.articles.filter((a) => a.review.status === 'entwurf').length;
    return '<div class="import-preview">' +
      '<p><strong>' + esc(file.name) + '</strong> · ' + formatBytes(file.size) + ' · Stand ' + fmtDate(inc.meta.updated, true) + '</p>' +
      '<ul class="import-stats">' +
      '<li><strong>' + inc.articles.length + '</strong> Artikel, <strong>' + inc.categories.length + '</strong> Kategorien, <strong>' + inc.synonyms.length + '</strong> Synonymgruppen, <strong>' + ist.total + '</strong> Bilder in der Datei' +
      (ist.total ? ' (davon <strong>' + ist.intern + '</strong> intern, ' + ist.oeffentlich + ' öffentlich)' : '') + '</li>' +
      (nIntern || nSlots || nDraft ? '<li class="import-intern">' + [
        nIntern ? '<strong>' + nIntern + '</strong> ' + (nIntern === 1 ? 'interner Artikel' : 'interne Artikel') : '',
        nSlots ? '<strong>' + nSlots + '</strong> ' + (nSlots === 1 ? 'geplanter Bildplatz' : 'geplante Bildplätze') : '',
        nDraft ? '<strong>' + nDraft + '</strong> ' + (nDraft === 1 ? 'ungeprüfter Entwurf' : 'ungeprüfte Entwürfe') : '',
      ].filter(Boolean).join(' · ') + '</li>' : '') +
      '<li>Datenformat ' + info.schema + (info.schema < PH.model.SCHEMA ? ' (ältere App-Version) – wird beim Import automatisch umgewandelt; Bilder gelten danach als <strong>intern</strong>.' : '') + '</li>' +
      (info.newer ? '<li class="status warn">' + icon('alert') + 'Die Datei stammt aus einer neueren App-Version. Unbekannte Angaben bleiben erhalten, werden aber hier nicht angezeigt.</li>' : '') +
      (incInternal ? '<li>' + icon('shield') + ' Enthält <strong>interne Inhalte</strong> – nach dem Import gilt dieser Stand als intern.</li>' : '') +
      '</ul>' +
      (PH.store.canSnapshot() ? '<p class="muted small">Vor dem Zusammenführen oder Ersetzen wird der aktuelle Stand automatisch als Wiederherstellungspunkt gesichert.</p>' : '') +
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

  /* ------------------------------------------------------------ App & Offline (nur Web/PWA) */

  async function pwaStatusHtml() {
    const p = PH.pwa ? PH.pwa.status() : { supported: false };
    const store = PH.pwa ? await PH.pwa.storageInfo() : {};
    const yes = (t) => '<span class="status ok">' + icon('checkCircle') + t + '</span>';
    const warn = (t) => '<span class="status warn">' + icon('alert') + t + '</span>';
    let offline;
    if (!p.supported) offline = warn('Nicht verfügbar (Aufruf über https:// nötig)');
    else if (p.error) offline = warn('Fehler: ' + esc(p.error));
    else if (p.info && p.info.missing && p.info.missing.length) offline = warn(p.info.missing.length + ' Datei(en) fehlen noch – bitte einmal online öffnen');
    else if (p.offlineReady) offline = yes('Bereit' + (p.info ? ' – alle ' + p.info.files + ' App-Dateien gespeichert' : ''));
    else offline = warn('Wird eingerichtet …');
    const persisted = store.persisted === true
      ? yes('Ja – der Browser löscht die Daten nicht automatisch')
      : store.persisted === false ? warn('Nicht bestätigt' + (PH.env.isAppleMobile ? ' – App über „Zum Home-Bildschirm“ installieren' : '')) : '<span class="muted">unbekannt</span>';
    return '<dl class="kv">' +
      '<dt>Als App installiert</dt><dd>' + (p.standalone ? yes('Ja (Home-Bildschirm)') : PH.env.isAppleMobile ? warn('Nein – Teilen → „Zum Home-Bildschirm“') : '<span class="muted">Nein (im Browser geöffnet)</span>') + '</dd>' +
      '<dt>Offline-Betrieb</dt><dd>' + offline + '</dd>' +
      '<dt>App-Version</dt><dd><code>' + esc((p.info && p.info.version) || '–') + '</code>' + (p.updateWaiting ? ' · ' + warn('neue Version bereit') : '') + '</dd>' +
      '<dt>Dauerhafter Speicher</dt><dd>' + persisted + '</dd>' +
      (store.usage != null ? '<dt>Belegter Speicher</dt><dd>' + formatBytes(store.usage) + (store.quota ? ' von ca. ' + formatBytes(store.quota) : '') + '</dd>' : '') +
      '<dt>Verbindung</dt><dd>' + (p.online ? 'online' : 'offline – alle gespeicherten Inhalte nutzbar') + '</dd>' +
      '</dl>' +
      '<div class="btn-row pwa-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm" data-adm="pwa-check"' + (p.supported ? '' : ' disabled') + '>' + icon('refresh') + 'Nach Updates suchen</button>' +
      (p.updateWaiting ? '<button type="button" class="btn btn-primary btn-sm" data-adm="pwa-apply">' + icon('download') + 'Update installieren</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-adm="pwa-recache"' + (p.controlled ? '' : ' disabled') + '>' + icon('database') + 'Offline-Dateien neu laden</button>' +
      '</div>' +
      '<p class="field-hint">Ihre Änderungen liegen getrennt von den App-Dateien und bleiben bei Updates erhalten. ' +
      (PH.env.isAppleMobile ? 'Hinweis: Safari und die App auf dem Home-Bildschirm haben getrennte Speicher.' : '') + '</p>';
  }

  /* ------------------------------------------------------------ Bindung */

  function bind(el) {
    const kb = PH.app.kb;
    const catState = { cats: clone(kb.categories), deleted: [], dirty: false };
    const catHost = el.querySelector('#cat-editor');
    const renderCats = () => { catHost.innerHTML = catEditor(catState); };
    renderCats();
    el.querySelector('#care').innerHTML = careHtml();
    const snapHost = el.querySelector('#snap-list');
    const renderSnaps = () => snapListHtml().then((h) => { if (snapHost.isConnected) snapHost.innerHTML = h; });
    renderSnaps();
    const slotHost = el.querySelector('#slot-list');
    slotHost.innerHTML = slotListHtml();
    slotHost.addEventListener('change', (e) => {
      if (e.target.id !== 'slot-filter') return;
      const f = e.target.value;
      slotHost.querySelectorAll('tr[data-state]').forEach((tr) => { tr.hidden = !!f && tr.dataset.state !== f; });
      slotHost.querySelectorAll('details.slot-group').forEach((d) => { d.hidden = !d.querySelector('tr[data-state]:not([hidden])'); });
    });
    snapHost.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-snap-act]');
      if (!b) return;
      const id = b.closest('[data-snap]').dataset.snap;
      const a = b.dataset.snapAct;
      if (a === 'restore') {
        await PH.app.restoreSnapshot(id);
      } else if (a === 'download') {
        await PH.app.downloadSnapshot(id);
      } else if (a === 'delete') {
        const ok = await PH.ui.confirm({ title: 'Wiederherstellungspunkt löschen?', message: 'Der gesicherte Stand wird von diesem Gerät gelöscht.', okLabel: 'Löschen', danger: true });
        if (!ok) return;
        await PH.store.deleteSnapshot(id);
        PH.ui.toast('Wiederherstellungspunkt gelöscht.', 'success');
      }
      renderSnaps();
    });
    el.querySelector('#bulk-files').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      pendingBulk = planBulk(files);
      el.querySelector('#bulk-preview').innerHTML = bulkPreviewHtml(pendingBulk);
    });

    const pwaHost = el.querySelector('#pwa-status');
    if (pwaHost) {
      const upd = () => { if (pwaHost.isConnected) pwaStatusHtml().then((h) => { pwaHost.innerHTML = h; }); };
      upd();
      if (PH.pwa) {
        const off = PH.pwa.onChange(upd);
        PH.pwa.requestInfo();
        const stop = () => { if (!pwaHost.isConnected) { off(); window.removeEventListener('hashchange', stop); } };
        window.addEventListener('hashchange', stop);
      }
    }

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
        out.innerHTML = importPreview(f, PH.model.parseImport(text));
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
      } else if (act === 'export-public') {
        PH.app.exportPublic();
      } else if (act === 'slots-csv') {
        const d = new Date().toISOString().slice(0, 10);
        const r = await PH.util.saveFile('protel-hilfe-bildplaetze-' + d + '.csv', slotsCsv(), 'text/csv;charset=utf-8');
        if (r !== 'cancelled') PH.ui.toast('Liste der Bildplätze gespeichert (intern).', 'success');
      } else if (act === 'bulk-cancel') {
        pendingBulk = null;
        el.querySelector('#bulk-preview').innerHTML = '';
      } else if (act === 'bulk-apply' && pendingBulk) {
        b.disabled = true;
        const plan = pendingBulk;
        pendingBulk = null;
        await applyBulk(plan);
      } else if (act === 'pwa-check') {
        b.disabled = true;
        const r = await PH.pwa.checkForUpdates(false);
        b.disabled = false;
        PH.ui.toast({ update: 'Neue Version gefunden – sie wird geladen. Danach erscheint oben „Aktualisieren“.', none: 'Sie verwenden die aktuelle Version.', offline: 'Keine Verbindung – Prüfung nicht möglich.', unsupported: 'Updates sind hier nicht verfügbar.' }[r], r === 'none' ? 'success' : 'info');
      } else if (act === 'pwa-apply') {
        PH.pwa.applyUpdate();
      } else if (act === 'pwa-recache') {
        if (!navigator.onLine) { PH.ui.toast('Dafür ist eine Internetverbindung nötig.', 'warning'); return; }
        if (PH.pwa.recache()) PH.ui.toast('Offline-Dateien werden neu geladen …', 'info');
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
        await PH.app.safetySnapshot('Vor dem Löschen der Beispielartikel');
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
        await PH.app.safetySnapshot('Vor dem Import (Zusammenführen): ' + pendingImport.name);
        const merged = PH.model.applyMerge(PH.app.kb, pendingImport.plan);
        const p = pendingImport.plan;
        await PH.app.commit(merged);
        pendingImport = null;
        PH.ui.toast('Import abgeschlossen: ' + p.added.length + ' neu, ' + p.updated.length + ' aktualisiert.', 'success');
        PH.app.refresh();
      } else if (act === 'import-replace' && pendingImport) {
        const ok = await PH.ui.confirm({
          title: 'Wissensdatenbank ersetzen?',
          html: 'Alle aktuellen Artikel, Kategorien und Synonyme werden durch den Inhalt der Datei ersetzt. ' +
            (PH.store.canSnapshot() ? 'Der bisherige Stand wird vorher als Wiederherstellungspunkt gesichert.' : 'Dies kann nicht rückgängig gemacht werden – exportieren Sie vorher eine Sicherung.'),
          okLabel: 'Ersetzen', danger: true,
        });
        if (!ok) return;
        await PH.app.safetySnapshot('Vor dem Import (Ersetzen): ' + pendingImport.name);
        await PH.app.commit(pendingImport.inc);
        pendingImport = null;
        PH.ui.toast('Wissensdatenbank ersetzt.', 'success');
        PH.app.refresh();
      }
    });
  }

  PH.admin = { view };
})();
