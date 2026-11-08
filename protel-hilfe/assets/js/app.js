/* Protel Hilfe – App-Steuerung: Start, Routing, Navigation, Suche im Kopfbereich, Speichern, Export */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc, fmtDate, debounce } = PH.util;
  const icon = PH.icon;
  const T = PH.model.TYPES;
  /** Text je nach Umgebung: PC-Version (file://) oder Web/App */
  const txt = (pc, web) => (PH.env.isFile ? pc : web);

  const state = {
    kb: null,
    index: null,
    prefs: null,
    byId: new Map(),
    catById: new Map(),
    hasLocal: false,
    dirty: false,
    baseRevision: '',
    bundled: null,
    bundledError: '',
    leaveGuard: null,
    currentHash: '',
    lastLogged: '',
  };

  /* ------------------------------------------------------------ Daten */

  function setKB(kb) {
    state.kb = kb;
    state.byId = new Map(kb.articles.map((a) => [a.id, a]));
    state.catById = new Map(kb.categories.map((c) => [c.id, c]));
    state.index = new PH.Search(kb);
  }

  async function persist() {
    try {
      await PH.store.saveLocal({ kb: state.kb, baseRevision: state.baseRevision, dirty: state.dirty, savedAt: PH.model.now() });
      state.hasLocal = true;
      return true;
    } catch (e) {
      console.error(e);
      PH.ui.toast(e.message || 'Speichern fehlgeschlagen.', 'error', { timeout: 10000 });
      return false;
    }
  }

  async function commit(kb, opts) {
    opts = opts || {};
    const next = Object.assign({}, kb, { meta: Object.assign({}, kb.meta, { updated: PH.model.now() }) });
    setKB(next);
    state.dirty = opts.dirty !== false;
    const ok = await persist();
    renderSidebar();
    updateChrome();
    return ok;
  }

  /**
   * Legt einen Wiederherstellungspunkt an (nur mit IndexedDB möglich).
   * kbRaw darf auch eine ältere, nicht umgewandelte Wissensdatenbank sein.
   * Liefert die Metadaten, false bei Fehler oder null, wenn nicht unterstützt.
   */
  async function snapshot(kbRaw, reason, opts) {
    opts = opts || {};
    if (!kbRaw || !PH.store.canSnapshot()) return null;
    try {
      let norm = kbRaw;
      try { norm = PH.model.normalizeKB(PH.util.clone(kbRaw)); } catch (e) { /* Rohdaten trotzdem sichern */ }
      const stats = norm.articles ? PH.model.imageStats(norm) : { total: 0 };
      const meta = await PH.store.saveSnapshot(kbRaw, {
        reason,
        pinned: !!opts.pinned,
        tag: opts.tag || '',
        schema: Number(kbRaw.schemaVersion) || 1,
        revision: (kbRaw.meta && kbRaw.meta.revision) || '',
        articles: Array.isArray(kbRaw.articles) ? kbRaw.articles.length : 0,
        images: stats.total || 0,
        bytes: JSON.stringify(kbRaw).length,
      });
      return meta;
    } catch (e) {
      console.warn('[Protel Hilfe] Wiederherstellungspunkt nicht möglich:', e);
      return false;
    }
  }

  /** Sicherung vor einer riskanten Aktion; meldet, falls das nicht möglich war */
  async function safetySnapshot(reason) {
    const r = await snapshot(state.kb, reason);
    if (r === false) PH.ui.toast('Hinweis: Der automatische Wiederherstellungspunkt konnte nicht angelegt werden (Speicher voll?). Bitte vorher eine Sicherung exportieren.', 'warning', { timeout: 9000 });
    return r;
  }

  async function adoptBundled(silent) {
    if (!state.bundled) return;
    if (state.hasLocal) await safetySnapshot(txt('Vor dem Laden der Datei aus dem App-Ordner', 'Vor dem Laden der veröffentlichten Version'));
    setKB(state.bundled);
    state.hasLocal = false;
    state.dirty = false;
    state.baseRevision = state.bundled.meta.revision;
    try { await PH.store.clearLocal(); } catch (e) { console.warn(e); }
    if (!silent) PH.ui.toast('Wissensdatenbank ' + txt('aus dem App-Ordner', 'aus der veröffentlichten Version') + ' geladen (Stand ' + fmtDate(state.bundled.meta.updated, true) + ').', 'success');
    refresh();
  }

  function categoryCounts() {
    const c = {};
    state.kb.articles.forEach((a) => { c[a.categoryId] = (c[a.categoryId] || 0) + 1; });
    return c;
  }

  function withoutRefs(a, ids) {
    const copy = Object.assign({}, a, { related: a.related.filter((r) => !ids.has(r)) });
    if (a.tree) {
      copy.tree = Object.assign({}, a.tree, {
        nodes: a.tree.nodes.map((n) => (n.links ? Object.assign({}, n, { links: n.links.filter((l) => !ids.has(l)) }) : n)),
      });
    }
    return copy;
  }

  function folderPath() {
    try {
      let p = decodeURIComponent(location.pathname.replace(/[^/]*$/, ''));
      if (location.protocol !== 'file:') return location.href.replace(/[^/]*$/, '');
      if (location.host) return '\\\\' + location.host + p.replace(/\//g, '\\');
      if (/^\/[A-Za-z]:\//.test(p)) return p.slice(1).replace(/\//g, '\\');
      return p;
    } catch (e) {
      return '';
    }
  }

  /* ------------------------------------------------------------ Aktionen */

  /** Kennzeichnet einen Stand mit internen Inhalten als „interner Inhaltsstand“ */
  function withPackage(kb) {
    if (PH.model.hasInternal(kb) && kb.meta.package !== 'intern') return Object.assign({}, kb, { meta: Object.assign({}, kb.meta, { package: 'intern' }) });
    return kb;
  }

  async function exportForFolder() {
    const rev = PH.model.newRevision();
    const kb = withPackage(Object.assign({}, state.kb, { meta: Object.assign({}, state.kb.meta, { revision: rev, updated: PH.model.now() }) }));
    const result = await PH.util.saveFile('wissensdatenbank.js', PH.model.toJS(kb), 'text/javascript;charset=utf-8');
    if (result === 'cancelled') {
      PH.ui.toast('Export abgebrochen – es wurde nichts verändert.', 'info');
      return;
    }
    setKB(kb);
    if (PH.env.isFile) {
      // PC-Version: Die exportierte Datei ersetzt die Datei im App-Ordner → lokaler Stand gilt als verteilt
      state.baseRevision = rev;
      state.dirty = false;
    }
    state.prefs.lastBackup = PH.model.now();
    savePrefs();
    await persist();
    renderSidebar();
    updateChrome();
    const how = result === 'shared' ? 'über „Teilen“ weitergegeben' : 'in Ihren Download-Ordner gespeichert';
    let body;
    if (PH.env.isFile) {
      const folder = folderPath();
      body = '<p>Die Datei <code>wissensdatenbank.js</code> wurde ' + how + '. So verteilen Sie den neuen Stand:</p>' +
        '<ol class="steps-plain">' +
        '<li>Download-Ordner öffnen (im Browser: {{Strg+J}}).</li>' +
        '<li>Die Datei in den Ordner <code>data</code> der App kopieren und die vorhandene Datei <strong>ersetzen</strong>' +
        (folder ? ':<br><code class="path">' + esc(folder) + 'data\\</code>' : '.') + '</li>' +
        '<li>Auf allen Rezeptions-PCs die App neu laden ({{F5}}).</li></ol>' +
        '<p class="muted small">Heißt die Datei im Download-Ordner z. B. „wissensdatenbank (1).js“, bitte beim Kopieren in „wissensdatenbank.js“ umbenennen.</p>';
    } else {
      body = '<p>Die Datei <code>wissensdatenbank.js</code> wurde ' + how + '. Verwendung:</p>' +
        '<ul class="steps-plain">' +
        '<li><strong>Interne PC-Version:</strong> Datei in den Ordner <code>data</code> der App kopieren und die vorhandene Datei ersetzen.</li>' +
        '<li><strong>Nicht veröffentlichen:</strong> Diese Datei enthält den vollständigen, internen Stand. Für die öffentliche Website gibt es unter <em>Verwaltung</em> den eigenen Export „Öffentliche Datendatei“.</li>' +
        '<li><strong>Anderes iPhone/iPad:</strong> Dafür besser die Sicherung (.json) verwenden und auf dem anderen Gerät importieren.</li></ul>';
    }
    if (PH.model.hasInternal(kb)) {
      body += '<div class="callout callout-warning"><div class="callout-title">' + icon('shield') + 'Interne Inhalte</div><div class="callout-body"><p>' +
        'Die Datei ist als <strong>interner Inhaltsstand</strong> gekennzeichnet. Nur intern verteilen (App-Ordner auf dem internen Laufwerk, privates Repository) – ' +
        'nicht ins öffentliche Repository und nicht auf GitHub Pages.</p></div></div>';
    }
    await PH.ui.dialog({
      title: 'Datei wurde erstellt',
      body,
      buttons: [{ label: 'Verstanden', value: true, kind: 'primary', autofocus: true }],
      onOpen: (dlg) => {
        dlg.querySelectorAll('.modal-body li').forEach((li) => { li.innerHTML = li.innerHTML.replace(/\{\{([^{}]+)\}\}/g, (_, k) => '<kbd>' + k + '</kbd>'); });
      },
    });
    if (location.hash.startsWith('#/verwaltung')) refresh();
  }

  function dateStamp() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  async function exportBackup() {
    const kb = withPackage(state.kb);
    const internal = kb.meta.package === 'intern';
    const name = (internal ? 'protel-hilfe-intern-sicherung-' : 'protel-hilfe-sicherung-') + dateStamp() + '.json';
    const result = await PH.util.saveFile(name, PH.model.toJSON(kb), 'application/json;charset=utf-8');
    if (result === 'cancelled') {
      PH.ui.toast('Sicherung abgebrochen.', 'info');
      return false;
    }
    state.prefs.lastBackup = PH.model.now();
    savePrefs();
    PH.ui.toast((result === 'shared' ? 'Sicherung wurde weitergegeben.' : 'Sicherung wurde heruntergeladen.') +
      (internal ? ' Sie enthält interne Inhalte – nur intern ablegen.' : ''), 'success', { timeout: internal ? 6000 : 3800 });
    if (location.hash.startsWith('#/verwaltung')) refresh();
    return true;
  }

  /**
   * Öffentliche Datendatei: nur ausdrücklich öffentliche Artikel und Bilder (Rechte geklärt),
   * ohne Bildplätze und ohne Personennamen. Vorher wird angezeigt, was entfällt.
   */
  async function exportPublic() {
    const { kb, removed } = PH.model.toPublic(state.kb);
    const issues = PH.model.publicIssues(kb);
    const li = (n, t) => (n ? '<li><strong>' + n + '</strong> ' + t + '</li>' : '');
    const body =
      '<p>Erzeugt eine <code>wissensdatenbank.js</code> nur mit Inhalten, die ausdrücklich als <strong>öffentlich</strong> gekennzeichnet sind.</p>' +
      '<dl class="kv"><dt>Enthalten</dt><dd>' + kb.articles.length + ' Artikel · ' + PH.model.countImages(kb) + ' Bilder</dd>' +
      '<dt>Nicht enthalten</dt><dd>' + ((removed.articles + removed.images + removed.slots + removed.names)
        ? '<ul class="plain-list">' + li(removed.articles, 'interne Artikel') + li(removed.images, 'interne oder nicht freigegebene Bilder') +
          li(removed.slots, 'geplante Bildplätze') + li(removed.names, 'Personennamen (Prüfung/Aufnahme)') + '</ul>'
        : 'nichts – alle Inhalte sind öffentlich') + '</dd></dl>' +
      (issues.length ? '<div class="callout callout-danger"><div class="callout-title">' + icon('xCircle') + 'Prüfung fehlgeschlagen</div><div class="callout-body"><ul>' +
        issues.slice(0, 8).map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div></div>' : '') +
      '<p class="muted small">Eigene protel-Screenshots sind nie enthalten. Die Website ist öffentlich – vor dem Veröffentlichen bitte den Inhalt prüfen.</p>';
    const ok = await PH.ui.dialog({
      title: 'Öffentliche Datendatei exportieren',
      body,
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Exportieren', value: true, kind: 'primary', autofocus: true }].filter((b) => !issues.length || !b.value),
    });
    if (!ok) return false;
    const result = await PH.util.saveFile('wissensdatenbank.js', PH.model.toJS(kb), 'text/javascript;charset=utf-8');
    if (result === 'cancelled') {
      PH.ui.toast('Export abgebrochen.', 'info');
      return false;
    }
    PH.ui.toast('Öffentliche Datendatei erstellt (' + kb.articles.length + ' Artikel).', 'success');
    return true;
  }

  /* ------------------------------------------------------------ Wiederherstellungspunkte */

  async function restoreSnapshot(id) {
    const list = await PH.store.listSnapshots();
    const meta = list.find((x) => x.id === id);
    const raw = meta && (await PH.store.getSnapshot(id));
    if (!raw) {
      PH.ui.toast('Der Wiederherstellungspunkt ist nicht mehr vorhanden.', 'error');
      return false;
    }
    let kb;
    try {
      kb = PH.model.normalizeKB(PH.util.clone(raw));
    } catch (e) {
      PH.ui.toast('Der Wiederherstellungspunkt ist nicht lesbar: ' + e.message, 'error');
      return false;
    }
    const ok = await PH.ui.confirm({
      title: 'Wiederherstellen?',
      html: 'Der Stand vom <strong>' + fmtDate(meta.createdAt, true) + '</strong> („' + esc(meta.reason) + '“, ' + kb.articles.length + ' Artikel) ersetzt die aktuelle Wissensdatenbank. ' +
        'Der aktuelle Stand wird vorher selbst als Wiederherstellungspunkt gesichert.',
      okLabel: 'Wiederherstellen',
    });
    if (!ok) return false;
    await safetySnapshot('Vor dem Wiederherstellen eines älteren Stands');
    await commit(kb);
    PH.ui.toast('Stand vom ' + fmtDate(meta.createdAt, true) + ' wiederhergestellt.', 'success');
    refresh();
    return true;
  }

  async function downloadSnapshot(id) {
    const list = await PH.store.listSnapshots();
    const meta = list.find((x) => x.id === id);
    const raw = meta && (await PH.store.getSnapshot(id));
    if (!raw) {
      PH.ui.toast('Der Wiederherstellungspunkt ist nicht mehr vorhanden.', 'error');
      return;
    }
    // Rohdaten unverändert (auch Datenformat 1) – lassen sich wieder importieren
    const name = 'protel-hilfe-wiederherstellungspunkt-' + meta.createdAt.slice(0, 10) + '.json';
    const result = await PH.util.saveFile(name, JSON.stringify(raw, null, 1), 'application/json;charset=utf-8');
    if (result !== 'cancelled') PH.ui.toast('Wiederherstellungspunkt gespeichert.', 'success');
  }

  /** Neue Inhalte der mitgelieferten/veröffentlichten Version übernehmen, ohne eigene zu verlieren */
  async function mergeBundled() {
    if (!state.bundled) return;
    await safetySnapshot(txt('Vor dem Zusammenführen mit der Datei aus dem App-Ordner', 'Vor dem Zusammenführen mit der veröffentlichten Version'));
    const plan = PH.model.planMerge(state.kb, state.bundled);
    const merged = PH.model.applyMerge(state.kb, plan);
    state.baseRevision = state.bundled.meta.revision;
    await commit(merged);
    PH.ui.toast('Zusammengeführt: ' + plan.added.length + ' neue, ' + plan.updated.length + ' aktualisierte Artikel. Ihre eigenen Inhalte sind erhalten.', 'success', { timeout: 6000 });
    refresh();
  }

  async function resetToBundled() {
    if (!state.bundled) {
      PH.ui.toast(txt('Die Datei data/wissensdatenbank.js ist nicht verfügbar.', 'Die veröffentlichte Wissensdatenbank ist nicht verfügbar.'), 'error');
      return;
    }
    const internal = PH.model.hasInternal(state.kb) && !PH.model.hasInternal(state.bundled);
    const ok = await PH.ui.confirm({
      title: 'Lokale Änderungen verwerfen?',
      html: 'Alle ' + txt('in diesem Browser', 'auf diesem Gerät') + ' gespeicherten Änderungen werden verworfen und der Stand ' +
        txt('aus <code>data/wissensdatenbank.js</code>', 'der veröffentlichten Version') + ' (' + fmtDate(state.bundled.meta.updated, true) + ') geladen.' +
        (internal ? '<br><strong>Achtung:</strong> Ihr Stand enthält interne Inhalte, die dort nicht enthalten sind.' : '') +
        (PH.store.canSnapshot() ? '<br>Der bisherige Stand wird vorher als Wiederherstellungspunkt gesichert (Verwaltung → Wiederherstellungspunkte).' : ''),
      okLabel: 'Verwerfen und laden',
      danger: true,
    });
    if (ok) adoptBundled();
  }

  async function deleteArticle(id, opts) {
    const a = state.byId.get(id);
    if (!a) return;
    const ok = await PH.ui.confirm({
      title: 'Artikel löschen?',
      html: 'Der Artikel <strong>' + esc(a.title) + '</strong> wird gelöscht. Verweise aus anderen Artikeln werden entfernt.',
      okLabel: 'Löschen',
      danger: true,
    });
    if (!ok) return;
    const ids = new Set([id]);
    const kb = state.kb;
    await commit(Object.assign({}, kb, { articles: kb.articles.filter((x) => x.id !== id).map((x) => withoutRefs(x, ids)) }));
    state.prefs.favorites = state.prefs.favorites.filter((x) => x !== id);
    state.prefs.recent = state.prefs.recent.filter((x) => x !== id);
    savePrefs();
    state.leaveGuard = null;
    PH.ui.toast('„' + a.title + '“ wurde gelöscht.', 'success');
    const target = state.catById.has(a.categoryId) ? '#/kategorie/' + encodeURIComponent(a.categoryId) : '#/';
    if (location.hash === target) refresh();
    else location.hash = target;
  }

  async function duplicateArticle(id) {
    const a = state.byId.get(id);
    if (!a) return;
    const copy = PH.util.clone(a);
    copy.title = a.title + ' (Kopie)';
    copy.id = PH.model.uniqueArticleId(state.kb, copy.title);
    copy.created = copy.updated = PH.model.now();
    await commit(Object.assign({}, state.kb, { articles: state.kb.articles.concat(copy) }));
    PH.ui.toast('Kopie angelegt – jetzt anpassen.', 'success');
    location.hash = '#/bearbeiten/' + encodeURIComponent(copy.id);
  }

  async function openNewArticleDialog(opts) {
    opts = opts || {};
    const kb = state.kb;
    const body =
      '<p class="muted">Welche Art von Artikel möchten Sie anlegen?</p>' +
      '<div class="type-picker" role="radiogroup" aria-label="Artikeltyp">' +
      PH.model.TYPE_ORDER.map((t, i) =>
        '<label class="type-option"><input type="radio" name="nt" value="' + t + '"' + ((opts.type ? opts.type === t : i === 0) ? ' checked' : '') + '>' +
        '<span class="type-icon type-' + t + '">' + icon(T[t].icon) + '</span><span class="type-option-text"><strong>' + esc(T[t].label) + '</strong><small>' + esc(T[t].desc) + '</small></span></label>'
      ).join('') + '</div>' +
      '<div class="field"><label class="field-label" for="nt-cat">Kategorie</label><select class="input" id="nt-cat"><option value="">– ohne Kategorie –</option>' +
      kb.categories.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === opts.categoryId ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></div>';
    const res = await PH.ui.dialog({
      title: 'Neuer Artikel',
      body,
      buttons: [
        { label: 'Abbrechen', value: null },
        { label: 'Weiter', kind: 'primary', value: (dlg) => ({ type: dlg.querySelector('input[name="nt"]:checked').value, cat: dlg.querySelector('#nt-cat').value }) },
      ],
    });
    if (!res) return;
    location.hash = '#/neu/' + res.type + (res.cat ? '?kat=' + encodeURIComponent(res.cat) : '');
  }

  /* ------------------------------------------------------------ Einstellungen */

  function savePrefs() {
    PH.store.savePrefs(state.prefs);
  }

  function isFavorite(id) {
    return state.prefs.favorites.includes(id);
  }

  function toggleFavorite(id) {
    const f = state.prefs.favorites;
    const on = !f.includes(id);
    state.prefs.favorites = on ? [id].concat(f) : f.filter((x) => x !== id);
    savePrefs();
    renderSidebar();
    return on;
  }

  function trackView(id) {
    state.prefs.recent = [id].concat(state.prefs.recent.filter((x) => x !== id)).slice(0, 12);
    state.prefs.views[id] = (state.prefs.views[id] || 0) + 1;
    savePrefs();
  }

  function trimMap(obj, max) {
    const keys = Object.keys(obj);
    if (keys.length <= max) return obj;
    const keep = keys.sort((a, b) => (obj[b].count || 0) - (obj[a].count || 0)).slice(0, max);
    const out = {};
    keep.forEach((k) => (out[k] = obj[k]));
    return out;
  }

  function logSearch(q, hits) {
    const key = q.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key.length < 2 || key === state.lastLogged) return;
    state.lastLogged = key;
    const p = state.prefs;
    const now = PH.model.now();
    const s = p.searches[key] || { count: 0 };
    p.searches[key] = { count: s.count + 1, last: now, hits };
    if (!hits) {
      const n = p.noHits[key] || { count: 0 };
      p.noHits[key] = { count: n.count + 1, last: now };
    } else delete p.noHits[key];
    p.searches = trimMap(p.searches, 300);
    p.noHits = trimMap(p.noHits, 200);
    p.history = [q.trim()].concat(p.history.filter((x) => x.toLowerCase() !== key)).slice(0, 8);
    savePrefs();
  }

  /* ------------------------------------------------------------ Darstellung */

  function effectiveTheme() {
    if (state.prefs.theme) return state.prefs.theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const t = effectiveTheme();
    document.documentElement.dataset.theme = t;
    const b = document.getElementById('btn-theme');
    if (b) {
      b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
      b.title = t === 'dark' ? 'Helles Design' : 'Dunkles Design';
      b.setAttribute('aria-label', b.title);
    }
    const meta = document.getElementById('meta-theme');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#141b26' : '#ffffff');
  }

  function applyEditMode() {
    const on = !!state.prefs.editMode;
    document.body.classList.toggle('edit-mode', on);
    const b = document.getElementById('btn-edit-mode');
    if (b) {
      b.setAttribute('aria-pressed', on);
      b.classList.toggle('is-active', on);
      b.querySelector('span').textContent = on ? 'Bearbeitung an' : 'Bearbeiten';
      b.title = on ? 'Bearbeitungsmodus beenden' : 'Bearbeitungsmodus einschalten (Artikel anlegen und ändern)';
    }
  }

  function updateChrome() {
    const banner = document.getElementById('example-banner');
    const hasExamples = state.kb.articles.some((a) => a.example);
    if (banner) banner.hidden = !hasExamples;
    const pill = document.getElementById('dirty-pill');
    if (pill) pill.hidden = !state.dirty;
  }

  function sideLink(href, ic, label, count, cls) {
    return '<a class="side-link' + (cls ? ' ' + cls : '') + '" href="' + href + '">' +
      '<span class="side-icon">' + icon(ic) + '</span><span class="side-label">' + esc(label) + '</span>' +
      (count !== undefined && count !== '' ? '<span class="side-count">' + count + '</span>' : '') + '</a>';
  }

  function renderSidebar() {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const kb = state.kb;
    const counts = categoryCounts();
    const tc = {};
    kb.articles.forEach((a) => (tc[a.type] = (tc[a.type] || 0) + 1));
    const none = kb.articles.filter((a) => !state.catById.has(a.categoryId)).length;
    const favs = state.prefs.favorites.filter((id) => state.byId.has(id)).length;
    el.innerHTML =
      '<div class="side-section">' +
      sideLink('#/', 'home', 'Startseite') +
      sideLink('#/alle', 'list', 'Alle Artikel', kb.articles.length) +
      PH.model.TYPE_ORDER.map((t) => sideLink('#/typ/' + t, T[t].icon, T[t].plural, tc[t] || 0)).join('') +
      sideLink('#/favoriten', 'star', 'Favoriten', favs) +
      '</div>' +
      '<div class="side-section">' +
      '<div class="side-title">Kategorien</div>' +
      kb.categories.map((c) => sideLink('#/kategorie/' + encodeURIComponent(c.id), c.icon, c.name, counts[c.id] || 0, 'color-' + c.color)).join('') +
      (none ? sideLink('#/kategorie/_ohne', 'folder', 'Ohne Kategorie', none, 'color-slate') : '') +
      (!kb.categories.length ? '<p class="side-empty">Noch keine Kategorien.</p>' : '') +
      '</div>' +
      '<div class="side-section side-bottom">' +
      '<button type="button" class="btn btn-primary btn-block edit-only" data-global="new-article">' + icon('plus') + 'Neuer Artikel</button>' +
      sideLink('#/verwaltung', 'settings', 'Verwaltung', state.dirty ? '●' : undefined, state.dirty ? 'has-dot' : '') +
      sideLink('#/hilfe', 'help', 'Hilfe zur App') +
      '<div class="side-foot">' + icon('shield') + '<span>' + (PH.env.isFile ? 'Offline · ohne Cloud' : 'Offline nutzbar · ohne Cloud') + '<br>Stand ' + fmtDate(kb.meta.updated) + '</span></div>' +
      '</div>';
    markActive();
  }

  function markActive() {
    const h = location.hash || '#/';
    const path = h.split('?')[0];
    let catHref = null;
    const m = /^#\/artikel\/([^/?]+)/.exec(path);
    if (m) {
      const a = state.byId.get(decodeURIComponent(m[1]));
      if (a && state.catById.has(a.categoryId)) catHref = '#/kategorie/' + encodeURIComponent(a.categoryId);
    }
    document.querySelectorAll('#sidebar .side-link').forEach((l) => {
      const href = l.getAttribute('href');
      const on = href === path || href === catHref || (href === '#/' && (path === '#' || path === ''));
      l.classList.toggle('active', on);
      if (on) l.setAttribute('aria-current', 'page');
      else l.removeAttribute('aria-current');
    });
    const route = (path.replace(/^#\/?/, '').split('/')[0]) || 'home';
    const tab = { home: 'home', suche: 'search', kategorien: 'cats', kategorie: 'cats', typ: 'cats', alle: 'cats', artikel: 'cats', favoriten: 'favs' }[route] || 'more';
    document.querySelectorAll('#tabbar .tab-item').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
  }

  /* ------------------------------------------------------------ Tab-Leiste (Smartphone/Tablet) */

  function renderTabbar() {
    const el = document.getElementById('tabbar');
    if (!el) return;
    const item = (tag, tab, ic, label, href) =>
      '<' + tag + ' class="tab-item" data-tab="' + tab + '"' + (href ? ' href="' + href + '"' : ' type="button"') + '>' +
      icon(ic) + '<span>' + label + '</span></' + tag + '>';
    el.innerHTML =
      item('a', 'home', 'home', 'Start', '#/') +
      item('button', 'search', 'search', 'Suchen') +
      item('a', 'cats', 'grid', 'Kategorien', '#/kategorien') +
      item('a', 'favs', 'star', 'Favoriten', '#/favoriten') +
      item('button', 'more', 'menu', 'Mehr');
    markActive();
  }

  const isVisible = (el) => !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');

  /** Suche öffnen – fokussiert synchron, damit iPhone/iPad die Tastatur anzeigt */
  function openSearch() {
    document.body.classList.remove('sidebar-open');
    let input = document.querySelector('#main .hero-search input') || document.querySelector('#main .search-page-box input');
    if (!isVisible(input)) input = document.querySelector('#topbar-search input');
    if (isVisible(input)) {
      input.focus();
      if (input.select) input.select();
      return;
    }
    location.hash = '#/suche';
    if (state.leaveGuard && state.leaveGuard()) return; // Rückfrage übernimmt onHashChange
    render();
    const inp = document.querySelector('#main .search-page-box input');
    if (inp) inp.focus();
  }

  const navStack = [];
  function trackNav() {
    const h = location.hash || '#/';
    if (navStack.length >= 2 && navStack[navStack.length - 2] === h) navStack.pop();
    else if (navStack[navStack.length - 1] !== h) navStack.push(h);
    if (navStack.length > 60) navStack.shift();
  }

  function goBack() {
    if (navStack.length > 1) {
      history.back();
      return;
    }
    const m = /^#\/artikel\/([^/?]+)/.exec(location.hash);
    const a = m && state.byId.get(decodeURIComponent(m[1]));
    location.hash = a && state.catById.has(a.categoryId) ? '#/kategorie/' + encodeURIComponent(a.categoryId) : '#/';
  }

  /* ------------------------------------------------------------ Suchfeld */

  function mountSearchBox(host, variant) {
    const id = 'sb-list-' + variant;
    host.innerHTML =
      '<div class="searchbox sb-' + variant + '">' +
      '<span class="sb-icon">' + icon('search') + '</span>' +
      '<input type="search" class="sb-input" placeholder="Suchen: Ablauf, Stichwort oder Fehlermeldung …" aria-label="Wissensdatenbank durchsuchen" ' +
      'autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-controls="' + id + '">' +
      '<kbd class="sb-kbd" aria-hidden="true">Strg K</kbd>' +
      '<div class="sb-dropdown" id="' + id + '" role="listbox" hidden></div></div>';
    const input = host.querySelector('input');
    const dd = host.querySelector('.sb-dropdown');
    if (host.dataset.value) input.value = host.dataset.value;
    let items = [];
    let active = -1;

    const close = () => {
      dd.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    };
    const open = (html) => {
      dd.innerHTML = html;
      dd.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      items = Array.from(dd.querySelectorAll('.sb-item'));
      active = -1;
    };
    const setActive = (i) => {
      items.forEach((it, k) => it.classList.toggle('active', k === i));
      active = i;
      if (items[i]) items[i].scrollIntoView({ block: 'nearest' });
    };

    const update = () => {
      if (document.activeElement !== input) return;
      const q = input.value;
      if (!q.trim()) {
        const h = state.prefs.history.slice(0, 6);
        if (!h.length) return close();
        open('<div class="sb-section">Zuletzt gesucht</div>' +
          h.map((x) => '<a class="sb-item sb-history" role="option" href="' + PH.views.searchUrl(x) + '">' + icon('history') + '<span>' + esc(x) + '</span></a>').join(''));
        return;
      }
      const idx = state.index;
      const res = idx.search(q, { prefix: true, limit: 7 });
      let html = '';
      if (res.suggestion) {
        html += '<div class="sb-suggest">' + icon('sparkle') + '<span>Meinten Sie <button type="button" data-sb-q="' + esc(res.suggestion) + '">' + esc(res.suggestion) + '</button>?</span></div>';
      }
      if (res.results.length) {
        html += res.results.map((r) => {
          const a = r.article;
          const cat = state.catById.get(a.categoryId);
          return '<a class="sb-item" role="option" href="' + PH.views.articleHref(a, q.trim()) + '">' +
            '<span class="type-icon sm type-' + esc(a.type) + '">' + icon(T[a.type].icon) + '</span>' +
            '<span class="sb-item-text"><span class="sb-title">' + idx.highlight(a.title, r.matched) + PH.views.exampleBadge(a) + '</span>' +
            '<span class="sb-meta">' + esc(T[a.type].label) + (cat ? ' · ' + esc(cat.name) : '') + '</span></span></a>';
        }).join('');
        html += '<a class="sb-item sb-all" role="option" href="' + PH.views.searchUrl(q.trim()) + '">' + icon('search') +
          '<span>' + (res.total === 1 ? '1 Ergebnis' : 'Alle ' + res.total + ' Ergebnisse') + ' anzeigen</span><kbd>Enter</kbd></a>';
      } else {
        html += '<div class="sb-empty">' + icon('search') + '<span>Keine Treffer für „' + esc(q.trim()) + '“.<br><span class="muted">Enter drücken für Suchtipps.</span></span></div>';
      }
      open(html);
    };
    const debounced = debounce(update, 60);

    input.addEventListener('input', debounced);
    input.addEventListener('focus', update);
    input.addEventListener('blur', () => setTimeout(close, 160));
    dd.addEventListener('mousedown', (e) => e.preventDefault());
    dd.addEventListener('click', (e) => {
      const s = e.target.closest('[data-sb-q]');
      if (s) {
        input.value = s.dataset.sbQ;
        update();
        input.focus();
        return;
      }
      if (e.target.closest('a')) {
        close();
        input.blur();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (dd.hidden) update();
        if (!items.length) return;
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        setActive(active < 0 ? (dir > 0 ? 0 : items.length - 1) : (active + dir + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (active >= 0 && items[active]) location.hash = items[active].getAttribute('href');
        else if (q) location.hash = PH.views.searchUrl(q);
        close();
        input.blur();
      } else if (e.key === 'Escape') {
        if (!dd.hidden) close();
        else if (input.value) input.value = '';
        else input.blur();
      }
    });
    return input;
  }

  /* ------------------------------------------------------------ Bildansicht */

  /**
   * Bildansicht mit Zoom und Verschieben (Maus, Tastatur, Touch/Pinch) und Blättern
   * durch alle Bilder der aktuellen Seite. Markierungen bleiben lesbar (Gegenskalierung).
   */
  function openLightbox(frame) {
    const scope = frame.closest('.view') || document;
    const frames = Array.from(scope.querySelectorAll('.shot-frame[data-zoom]')).filter((f) => !f.classList.contains('broken'));
    let index = Math.max(0, frames.indexOf(frame));
    const tb = (act, ic, label) => '<button type="button" class="lb-btn" data-lb="' + act + '" title="' + label + '" aria-label="' + label + '">' + icon(ic) + '</button>';
    const ov = document.createElement('div');
    ov.className = 'lightbox';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Bildansicht');
    ov.innerHTML =
      '<div class="lb-bar">' +
      '<div class="lb-title"><span class="lb-num"></span><span class="lb-cap"></span></div>' +
      '<div class="lb-tools">' +
      '<span class="lb-count" aria-live="polite"></span>' +
      tb('out', 'minus', 'Verkleinern (−)') + '<span class="lb-zoom" aria-live="polite">100 %</span>' + tb('in', 'plus', 'Vergrößern (+)') +
      tb('fit', 'fit', 'Einpassen (0)') + tb('one', 'actual', 'Originalgröße (1)') + tb('close', 'x', 'Schließen (Esc)') +
      '</div></div>' +
      '<div class="lb-stage"><div class="lb-canvas"></div></div>' +
      '<button type="button" class="lb-nav lb-prev" data-lb="prev" aria-label="Vorheriges Bild (←)">' + icon('chevronLeft') + '</button>' +
      '<button type="button" class="lb-nav lb-next" data-lb="next" aria-label="Nächstes Bild (→)">' + icon('chevronRight') + '</button>' +
      '<div class="lb-legend"></div>' +
      '<p class="lb-help no-print">' + (PH.env.isTouch ? 'Zwei Finger zum Zoomen · doppelt tippen · wischen zum Blättern' : 'Mausrad zum Zoomen · ziehen zum Verschieben · Doppelklick · ← → blättern') + '</p>';
    const stage = ov.querySelector('.lb-stage');
    const canvas = ov.querySelector('.lb-canvas');
    const zoomLabel = ov.querySelector('.lb-zoom');
    const v = { s: 1, tx: 0, ty: 0, fit: 1, w: 1, h: 1, ready: false };

    const maxS = () => Math.max(v.fit * 6, 3);
    const apply = () => {
      const r2 = (n) => Math.round(n * 100) / 100;
      canvas.style.transform = 'translate(' + r2(v.tx) + 'px,' + r2(v.ty) + 'px) scale(' + Math.round(v.s * 10000) / 10000 + ')';
      canvas.style.setProperty('--inv', String(1 / v.s));
      zoomLabel.textContent = Math.round(v.s * 100) + ' %';
      ov.classList.toggle('is-zoomed', v.s > v.fit * 1.02);
    };
    const clamp = () => {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const cw = v.w * v.s;
      const ch = v.h * v.s;
      v.tx = cw <= sw ? (sw - cw) / 2 : Math.min(0, Math.max(sw - cw, v.tx));
      v.ty = ch <= sh ? (sh - ch) / 2 : Math.min(0, Math.max(sh - ch, v.ty));
    };
    const zoomTo = (s, cx, cy) => {
      s = Math.min(maxS(), Math.max(v.fit, s));
      if (cx == null) { cx = stage.clientWidth / 2; cy = stage.clientHeight / 2; }
      v.tx = cx - (cx - v.tx) * (s / v.s);
      v.ty = cy - (cy - v.ty) * (s / v.s);
      v.s = s;
      clamp();
      apply();
    };
    const fitView = () => {
      const sw = stage.clientWidth || 1;
      const sh = stage.clientHeight || 1;
      const isSvg = /\.svg(\?|$)|^data:image\/svg/i.test(canvas.dataset.src || '');
      v.fit = Math.min(sw / v.w, sh / v.h, isSvg ? 2 : 1);
      v.s = v.fit;
      clamp();
      apply();
    };

    const show = (i) => {
      index = (i + frames.length) % frames.length;
      const f = frames[index];
      const img = f.querySelector('img');
      const fig = f.closest('figure');
      canvas.innerHTML = '';
      const copy = document.createElement('img');
      copy.src = img.currentSrc || img.src;
      copy.alt = img.alt;
      copy.draggable = false;
      canvas.dataset.src = img.getAttribute('src') || '';
      canvas.appendChild(copy);
      f.querySelectorAll('.marker').forEach((m) => canvas.appendChild(m.cloneNode(true)));
      ov.querySelector('.lb-num').textContent = fig && fig.querySelector('.fig-num') ? fig.querySelector('.fig-num').textContent : '';
      ov.querySelector('.lb-cap').textContent = fig && fig.querySelector('.fig-text') ? fig.querySelector('.fig-text').textContent : img.alt;
      ov.querySelector('.lb-count').textContent = frames.length > 1 ? (index + 1) + ' / ' + frames.length : '';
      ov.querySelectorAll('.lb-nav').forEach((b) => { b.hidden = frames.length < 2; });
      const legend = fig && fig.querySelector('.marker-legend');
      const lh = ov.querySelector('.lb-legend');
      lh.innerHTML = legend ? legend.outerHTML : '';
      lh.hidden = !legend;
      const init = () => {
        v.w = copy.naturalWidth || img.naturalWidth || img.clientWidth || 800;
        v.h = copy.naturalHeight || img.naturalHeight || img.clientHeight || 600;
        canvas.style.width = v.w + 'px';
        canvas.style.height = v.h + 'px';
        v.ready = true;
        fitView();
      };
      if (copy.complete && copy.naturalWidth) init();
      else { copy.onload = init; copy.onerror = init; }
    };

    // Zeiger: Verschieben, Zwei-Finger-Zoom, Wischen, Doppeltippen
    const pts = new Map();
    let gesture = null;
    let lastTap = { t: 0, x: 0, y: 0 };
    const rel = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const toggleZoom = (p) => {
      if (v.s > v.fit * 1.05) fitView();
      else zoomTo(Math.min(maxS(), Math.max(v.fit * 2.5, 1)), p.x, p.y);
    };
    stage.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button > 0) return;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* z. B. bereits beendeter Zeiger */ }
      pts.set(e.pointerId, rel(e));
      if (pts.size === 2) {
        const [a, b] = Array.from(pts.values());
        gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: v.s };
      } else if (pts.size === 1) {
        const p = rel(e);
        gesture = { kind: 'pan', x0: p.x, y0: p.y, tx0: v.tx, ty0: v.ty, t0: Date.now(), moved: false };
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId) || !gesture) return;
      pts.set(e.pointerId, rel(e));
      if (gesture.kind === 'pinch' && pts.size >= 2) {
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomTo(gesture.s0 * (d / gesture.d0), (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else if (gesture.kind === 'pan') {
        const p = rel(e);
        const dx = p.x - gesture.x0;
        const dy = p.y - gesture.y0;
        if (Math.abs(dx) + Math.abs(dy) > 4) gesture.moved = true;
        if (v.s > v.fit * 1.02) {
          v.tx = gesture.tx0 + dx;
          v.ty = gesture.ty0 + dy;
          clamp();
          apply();
        }
      }
    });
    const endPointer = (e) => {
      if (!pts.has(e.pointerId)) return;
      const p = rel(e);
      pts.delete(e.pointerId);
      if (gesture && gesture.kind === 'pan' && !pts.size) {
        const dx = p.x - gesture.x0;
        const dy = p.y - gesture.y0;
        if (v.s <= v.fit * 1.02 && frames.length > 1 && Math.abs(dx) > 60 && Math.abs(dy) < 60 && Date.now() - gesture.t0 < 700) {
          show(index + (dx < 0 ? 1 : -1));
        } else if (!gesture.moved && e.pointerType === 'touch') {
          if (Date.now() - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30) {
            toggleZoom(p);
            lastTap = { t: 0, x: 0, y: 0 };
          } else lastTap = { t: Date.now(), x: p.x, y: p.y };
        }
      }
      gesture = pts.size === 1 ? { kind: 'pan', x0: Array.from(pts.values())[0].x, y0: Array.from(pts.values())[0].y, tx0: v.tx, ty0: v.ty, t0: Date.now(), moved: true } : pts.size ? gesture : null;
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('dblclick', (e) => toggleZoom(rel(e)));
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = rel(e);
      zoomTo(v.s * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), p.x, p.y);
    }, { passive: false });

    const close = () => {
      ov.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      const f = frames[index] && frames[index].isConnected ? frames[index] : frame;
      if (f.isConnected) f.focus({ preventScroll: true });
    };
    const act = (a) => {
      if (a === 'close') close();
      else if (a === 'in') zoomTo(v.s * 1.4);
      else if (a === 'out') zoomTo(v.s / 1.4);
      else if (a === 'fit') fitView();
      else if (a === 'one') zoomTo(1);
      else if (a === 'prev') show(index - 1);
      else if (a === 'next') show(index + 1);
    };
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-lb]');
      if (b) { act(b.dataset.lb); return; }
      if (e.target === ov || e.target.classList.contains('lb-legend') || e.target.classList.contains('lb-help')) close();
    });
    const onKey = (e) => {
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); close(); }
      else if (k === '+' || k === '=') { e.preventDefault(); act('in'); }
      else if (k === '-' || k === '_') { e.preventDefault(); act('out'); }
      else if (k === '0') { e.preventDefault(); act('fit'); }
      else if (k === '1') { e.preventDefault(); act('one'); }
      else if (k === 'ArrowLeft' && frames.length > 1) { e.preventDefault(); act('prev'); }
      else if (k === 'ArrowRight' && frames.length > 1) { e.preventDefault(); act('next'); }
      else if (k === 'Tab') {
        const items = Array.from(ov.querySelectorAll('button:not([hidden])'));
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
      }
    };
    const onResize = PH.util.debounce(() => { if (v.ready) { const atFit = v.s <= v.fit * 1.02; if (atFit) fitView(); else { clamp(); apply(); } } }, 80);

    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    show(index);
    ov.querySelector('[data-lb="close"]').focus();
  }

  /* ------------------------------------------------------------ Routing */

  function parseHash() {
    let h = location.hash.replace(/^#/, '');
    if (!h.startsWith('/')) h = '/' + h;
    const qi = h.indexOf('?');
    const p = qi >= 0 ? h.slice(0, qi) : h;
    const qs = qi >= 0 ? h.slice(qi + 1) : '';
    const parts = p.split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const query = {};
    new URLSearchParams(qs).forEach((v, k) => (query[k] = v));
    return { parts, query };
  }

  function render(keepScroll) {
    const main = document.getElementById('main');
    const { parts, query } = parseHash();
    const y = window.scrollY;
    state.leaveGuard = null;
    let v;
    try {
      switch (parts[0]) {
        case undefined: v = PH.views.home(); break;
        case 'kategorien': v = PH.views.categories(); break;
        case 'kategorie': v = PH.views.category(parts[1] || '', query); break;
        case 'artikel': v = PH.views.article(parts[1] || '', query); break;
        case 'typ': v = PH.views.typeList(parts[1]); break;
        case 'alle': v = PH.views.all(query); break;
        case 'favoriten': v = PH.views.favorites(); break;
        case 'suche': v = PH.views.search(query); break;
        case 'bearbeiten': v = PH.editor.view({ id: parts[1], step: query.schritt }); break;
        case 'neu': v = PH.editor.view({ type: parts[1], categoryId: query.kat }); break;
        case 'verwaltung': v = PH.admin.view(query); break;
        case 'hilfe': v = PH.views.help(); break;
        case 'lizenzen': v = PH.views.licenses(); break;
        default: v = PH.views.notFound();
      }
    } catch (err) {
      console.error(err);
      v = PH.views.error(err);
    }
    const view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = v.html;
    main.innerHTML = '';
    main.appendChild(view);
    document.body.dataset.route = parts[0] || 'home';
    document.title = (v.title ? v.title + ' – ' : '') + 'Protel Hilfe';
    view.querySelectorAll('[data-searchbox]').forEach((h) => mountSearchBox(h, h.dataset.searchbox));
    try {
      if (v.after) v.after(view);
    } catch (err) {
      console.error(err);
      PH.ui.toast('Fehler beim Anzeigen: ' + err.message, 'error');
    }
    trackNav();
    markActive();
    document.body.classList.remove('sidebar-open');
    if (keepScroll) window.scrollTo(0, y);
    else {
      window.scrollTo(0, 0);
      if (parts[0] !== 'suche' && parts[0] !== 'neu' && !PH.env.isTouch) main.focus({ preventScroll: true });
    }
    state.currentHash = location.hash;
  }

  function refresh() {
    renderSidebar();
    updateChrome();
    render(true);
  }

  let suppressHash = false;
  async function onHashChange() {
    if (suppressHash) {
      suppressHash = false;
      return;
    }
    if (location.hash === state.currentHash) return; // bereits angezeigt (z. B. nach openSearch)
    if (state.leaveGuard && state.leaveGuard()) {
      const target = location.hash;
      suppressHash = true;
      location.hash = state.currentHash || '#/';
      const ok = await PH.ui.confirm({
        title: 'Ungespeicherte Änderungen',
        message: 'Sie haben Änderungen, die noch nicht gespeichert wurden. Seite trotzdem verlassen und Änderungen verwerfen?',
        okLabel: 'Verwerfen',
        cancelLabel: 'Weiter bearbeiten',
        danger: true,
      });
      if (!ok) return;
      state.leaveGuard = null;
      location.hash = target;
      return;
    }
    render();
  }

  /* ------------------------------------------------------------ Konflikt beim Start */

  async function showConflict(localKB) {
    const b = state.bundled;
    // Interner Inhaltsstand auf dem Gerät, mitgeliefert/veröffentlicht nur Beispiel- bzw. öffentliche Daten:
    // dann nie das Ersetzen vorschlagen, sondern Behalten bzw. Zusammenführen.
    const protect = PH.model.hasInternal(localKB) && !PH.model.hasInternal(b);
    const choice = await PH.ui.dialog({
      title: txt('Andere Version im App-Ordner gefunden', 'Neue veröffentlichte Version gefunden'),
      body:
        txt('<p>Die Datei <code>data/wissensdatenbank.js</code> im App-Ordner unterscheidet sich von der Version, die in diesem Browser gespeichert ist.</p>',
          '<p>Die veröffentlichte Wissensdatenbank unterscheidet sich von der Version mit Ihren Änderungen, die auf diesem Gerät gespeichert ist.</p>') +
        '<dl class="kv">' +
        '<dt>' + txt('App-Ordner', 'Veröffentlicht') + '</dt><dd>Stand ' + fmtDate(b.meta.updated, true) + ' · ' + b.articles.length + ' Artikel' +
        (b.meta.package ? ' · ' + esc(PH.model.PACKAGES[b.meta.package]) : '') + '</dd>' +
        '<dt>' + txt('Dieser PC', 'Dieses Gerät') + '</dt><dd>Stand ' + fmtDate(localKB.meta.updated, true) + ' · ' + localKB.articles.length + ' Artikel' +
        (PH.model.hasInternal(localKB) ? ' · <strong>interner Inhaltsstand</strong>' : '') +
        (state.dirty ? ' · <strong>mit eigenen Änderungen</strong>' : ' · bereits exportiert, aber im Ordner noch nicht ersetzt') + '</dd>' +
        '</dl>' +
        (protect
          ? '<div class="callout callout-warning"><div class="callout-title">' + icon('shield') + 'Interne Inhalte schützen</div><div class="callout-body"><p>' +
            'Auf diesem ' + txt('PC', 'Gerät') + ' liegen interne Inhalte, die in der ' + txt('Datei im App-Ordner', 'veröffentlichten Version') + ' nicht enthalten sind. ' +
            'Empfohlen: <strong>Zusammenführen</strong> – neue ' + txt('Inhalte', 'öffentliche Inhalte') + ' kommen hinzu, Ihre internen bleiben erhalten.</p></div></div>'
          : '<p>Welche Version möchten Sie verwenden? Tipp: Vorher eine Sicherung erstellen – dann geht nichts verloren.</p>') +
        (PH.store.canSnapshot() ? '<p class="muted small">Vor dem Zusammenführen oder Ersetzen wird der bisherige Stand automatisch als Wiederherstellungspunkt gesichert.</p>' : ''),
      buttons: [
        { label: 'Sicherung erstellen', value: 'backup', kind: 'ghost', icon: 'download' },
        { label: txt('Lokale Version behalten', 'Meine Version behalten'), value: 'local', kind: protect ? 'secondary' : 'secondary' },
        { label: 'Zusammenführen', value: 'merge', kind: protect ? 'primary' : 'secondary' },
        { label: txt('Version aus App-Ordner laden', 'Veröffentlichte Version laden'), value: 'bundled', kind: protect ? 'danger' : 'primary' },
      ],
    });
    if (choice === 'backup') {
      await exportBackup();
      return showConflict(localKB);
    }
    if (choice === 'merge') return mergeBundled();
    if (choice === 'bundled') {
      if (protect) {
        const sure = await PH.ui.confirm({
          title: 'Interne Inhalte ersetzen?',
          html: 'Ihre internen Inhalte werden durch ' + txt('die Datei aus dem App-Ordner', 'die veröffentlichte Version') + ' ersetzt.' +
            (PH.store.canSnapshot() ? ' Sie bleiben als Wiederherstellungspunkt erhalten.' : ' <strong>Bitte vorher eine Sicherung exportieren.</strong>'),
          okLabel: 'Trotzdem ersetzen', danger: true,
        });
        if (!sure) return showConflict(localKB);
      }
      return adoptBundled();
    }
    if (choice === 'local') {
      state.baseRevision = b.meta.revision;
      state.dirty = true;
      await persist();
      renderSidebar();
      updateChrome();
    }
  }

  /* ------------------------------------------------------------ Start */

  function bindGlobal() {
    document.getElementById('btn-theme').addEventListener('click', () => {
      state.prefs.theme = effectiveTheme() === 'dark' ? 'light' : 'dark';
      savePrefs();
      applyTheme();
    });
    document.getElementById('btn-edit-mode').addEventListener('click', () => {
      state.prefs.editMode = !state.prefs.editMode;
      savePrefs();
      applyEditMode();
      PH.ui.toast(state.prefs.editMode ? 'Bearbeitungsmodus eingeschaltet' : 'Bearbeitungsmodus ausgeschaltet', 'info', { timeout: 1800 });
    });
    document.getElementById('btn-menu').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    document.getElementById('btn-back').addEventListener('click', goBack);
    document.getElementById('tabbar').addEventListener('click', (e) => {
      const t = e.target.closest('.tab-item');
      if (!t) return;
      if (t.dataset.tab === 'search') {
        e.preventDefault();
        openSearch();
      } else if (t.dataset.tab === 'more') {
        e.preventDefault();
        document.body.classList.toggle('sidebar-open');
      } else {
        document.body.classList.remove('sidebar-open');
        if (t.getAttribute('href') === location.hash) window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    document.getElementById('sidebar-backdrop').addEventListener('click', () => document.body.classList.remove('sidebar-open'));

    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const fn = () => { if (!state.prefs.theme) applyTheme(); };
      if (mq.addEventListener) mq.addEventListener('change', fn);
    }

    document.addEventListener('click', (e) => {
      const g = e.target.closest('[data-global]');
      if (g && g.dataset.global === 'new-article') {
        openNewArticleDialog({ categoryId: g.dataset.cat, type: g.dataset.type });
        return;
      }
      const z = e.target.closest('[data-zoom]');
      if (z) {
        openLightbox(z);
        return;
      }
      const c = e.target.closest('[data-copy]');
      if (c) {
        PH.util.copyText(c.dataset.copy).then((ok) => PH.ui.toast(ok ? 'In die Zwischenablage kopiert' : 'Kopieren nicht möglich', ok ? 'success' : 'warning', { timeout: 1800 }));
      }
    });

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) {
        if (document.querySelector('dialog[open], .lightbox')) return;
        e.preventDefault();
        const input = document.querySelector('#main [data-searchbox] input') || document.querySelector('#topbar-search input');
        if (input) {
          input.focus();
          input.select();
        }
      }
      if ((e.key === 'Enter' || e.key === ' ') && t && t.matches && t.matches('[data-zoom]')) {
        e.preventDefault();
        openLightbox(t);
      }
    });

    // Fehlende (verlinkte) Bilder kennzeichnen
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img && img.tagName === 'IMG') {
        const f = img.closest('.shot-frame');
        if (f) f.classList.add('broken');
      }
    }, true);

    // Drucken (auch über Strg+P): helles Schema und alle Ursachen aufgeklappt
    let themeBeforePrint = null;
    window.addEventListener('beforeprint', () => {
      themeBeforePrint = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = 'light';
      document.querySelectorAll('#main details').forEach((d) => {
        if (!d.open) { d.dataset.printOpened = '1'; d.open = true; }
      });
    });
    window.addEventListener('afterprint', () => {
      if (themeBeforePrint) document.documentElement.dataset.theme = themeBeforePrint;
      document.querySelectorAll('#main details[data-print-opened]').forEach((d) => { d.open = false; delete d.dataset.printOpened; });
    });

    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('beforeunload', (e) => {
      if (state.leaveGuard && state.leaveGuard()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  async function boot() {
    state.prefs = PH.store.loadPrefs();
    applyTheme();
    applyEditMode();

    const raw = window[PH.model.GLOBAL_VAR];
    if (raw) {
      try {
        state.bundled = PH.model.normalizeKB(raw);
      } catch (e) {
        state.bundledError = 'Die Datei data/wissensdatenbank.js ist fehlerhaft: ' + e.message;
      }
    } else {
      state.bundledError = 'Die Datei data/wissensdatenbank.js wurde nicht gefunden.';
    }

    let local = null;
    try {
      local = await PH.store.loadLocal();
    } catch (e) {
      console.warn(e);
    }
    let conflictKB = null;
    let migration = null;
    if (local && local.kb) {
      let localKB = null;
      try {
        localKB = PH.model.normalizeKB(PH.util.clone(local.kb));
      } catch (e) {
        console.warn('Lokale Kopie unlesbar', e);
        // Unlesbare Kopie nicht stillschweigend überschreiben: als Wiederherstellungspunkt aufheben
        await snapshot(local.kb, 'Unlesbare lokale Kopie beim Start', { pinned: true });
      }
      if (localKB) {
        state.hasLocal = true;
        state.dirty = !!local.dirty;
        state.baseRevision = local.baseRevision || '';
        setKB(localKB);
        // Umstellung von Datenformat 1 auf 2: alten Stand unverändert sichern, dann im neuen Format speichern
        const oldSchema = Number(local.kb.schemaVersion) || 1;
        if (oldSchema < PH.model.SCHEMA) {
          migration = await snapshot(local.kb, 'Vor der Umstellung auf Datenformat ' + PH.model.SCHEMA + ' (automatisch)', { pinned: true, tag: 'migration' });
          if (migration || !PH.store.canSnapshot()) await persist();
        }
        if (state.bundled && state.bundled.meta.revision !== state.baseRevision) {
          if (state.bundled.meta.revision === localKB.meta.revision) {
            // Die mitgelieferte Datei ist ein Export genau dieses Stands → kein Konflikt
            state.baseRevision = state.bundled.meta.revision;
            if (localKB.meta.updated <= state.bundled.meta.updated) state.dirty = false;
            await persist();
          } else if (PH.model.hasInternal(localKB) && !PH.model.hasInternal(state.bundled)) {
            // Interne Inhalte nie stillschweigend durch Beispiel-/öffentliche Daten ersetzen
            conflictKB = localKB;
          } else if (!state.dirty && state.bundled.meta.updated >= localKB.meta.updated) {
            await snapshot(localKB, txt('Vor dem automatischen Laden der neuen Datei aus dem App-Ordner', 'Vor dem automatischen Laden der neuen veröffentlichten Version'));
            setKB(state.bundled);
            state.hasLocal = false;
            state.baseRevision = state.bundled.meta.revision;
            try { await PH.store.clearLocal(); } catch (e) { /* ignore */ }
            setTimeout(() => PH.ui.toast('Neuer Stand der Wissensdatenbank geladen (' + fmtDate(state.bundled.meta.updated, true) + ').', 'success'), 300);
          } else {
            conflictKB = localKB;
          }
        }
      }
    }
    if (!state.kb) {
      setKB(state.bundled || PH.model.emptyKB());
      state.baseRevision = state.bundled ? state.bundled.meta.revision : '';
    }

    const top = document.getElementById('topbar-search');
    if (top) mountSearchBox(top, 'top');
    bindGlobal();
    renderTabbar();
    renderSidebar();
    updateChrome();
    if (!location.hash) {
      try { history.replaceState(null, '', '#/'); } catch (e) { /* file:// ohne replaceState – Startseite trotzdem anzeigen */ }
    }
    render();
    document.documentElement.classList.add('ready');

    if (state.bundledError && !state.hasLocal) PH.ui.toast(state.bundledError, 'error', { timeout: 12000 });
    if (PH.store.backend === 'memory') PH.ui.toast('Hinweis: Dieser Browser erlaubt keine dauerhafte Speicherung. Änderungen bitte exportieren.', 'warning', { timeout: 12000 });
    if (migration) {
      setTimeout(() => PH.ui.toast('Die App wurde aktualisiert. Ihr bisheriger Stand ist zusätzlich als Wiederherstellungspunkt gesichert (Verwaltung).', 'info', { timeout: 8000 }), 600);
    } else if (migration === false) {
      setTimeout(() => PH.ui.toast('Die App wurde aktualisiert, die automatische Sicherung des alten Stands war aber nicht möglich. Bitte jetzt eine Sicherung exportieren.', 'warning', {
        timeout: 15000, action: { label: 'Jetzt sichern', onClick: exportBackup },
      }), 600);
    }
    if (conflictKB) showConflict(conflictKB);
    else remindBackup();
  }

  /** Erinnert an eine Sicherung, wenn eigene Änderungen nur auf diesem Gerät liegen */
  function remindBackup() {
    const p = state.prefs;
    const DAY = 864e5;
    const since = (iso) => (iso ? Date.now() - new Date(iso).getTime() : Infinity);
    if (!state.hasLocal || !state.dirty) return;
    if (since(p.lastBackup) < 7 * DAY || since(p.backupReminder) < DAY) return;
    p.backupReminder = PH.model.now();
    savePrefs();
    setTimeout(() => PH.ui.toast('Ihre Änderungen sind nur auf diesem ' + txt('PC', 'Gerät') + ' gespeichert. Bitte regelmäßig eine Sicherung erstellen.', 'warning', {
      timeout: 12000,
      action: { label: 'Jetzt sichern', onClick: exportBackup },
    }), 1500);
  }

  PH.app = {
    get kb() { return state.kb; },
    get index() { return state.index; },
    get prefs() { return state.prefs; },
    savePrefs,
    getArticle: (id) => state.byId.get(id) || null,
    getCategory: (id) => (id ? state.catById.get(id) || null : null),
    categoryCounts,
    status: () => ({
      hasLocal: state.hasLocal,
      dirty: state.dirty,
      baseRevision: state.baseRevision,
      bundledAvailable: !!state.bundled,
      bundledRevision: state.bundled ? state.bundled.meta.revision : '',
      bundledUpdated: state.bundled ? state.bundled.meta.updated : '',
    }),
    isFavorite, toggleFavorite, trackView, logSearch,
    commit, refresh, withoutRefs, snapshot, safetySnapshot, restoreSnapshot, downloadSnapshot, mergeBundled,
    setLeaveGuard: (fn) => { state.leaveGuard = fn || null; },
    hasUnsavedChanges: () => !!(state.leaveGuard && state.leaveGuard()),
    openSearch, openLightbox,
    deleteArticle, duplicateArticle, exportForFolder, exportBackup, exportPublic, resetToBundled, openNewArticleDialog,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
