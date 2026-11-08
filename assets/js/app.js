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

  async function adoptBundled(silent) {
    if (!state.bundled) return;
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

  async function exportForFolder() {
    const rev = PH.model.newRevision();
    const kb = Object.assign({}, state.kb, { meta: Object.assign({}, state.kb.meta, { revision: rev, updated: PH.model.now() }) });
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
        '<li><strong>PC-Version:</strong> Datei in den Ordner <code>data</code> der App kopieren und die vorhandene Datei ersetzen.</li>' +
        '<li><strong>Veröffentlichte Version:</strong> Datei im Hosting (z. B. GitHub-Repository) unter <code>data/wissensdatenbank.js</code> ersetzen. ' +
        '<strong>Achtung:</strong> Die Website ist öffentlich erreichbar – nur Inhalte veröffentlichen, die öffentlich sein dürfen.</li>' +
        '<li><strong>Anderes iPhone/iPad:</strong> Dafür besser die Sicherung (.json) verwenden und auf dem anderen Gerät importieren.</li></ul>';
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

  async function exportBackup() {
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const result = await PH.util.saveFile('protel-hilfe-sicherung-' + stamp + '.json', PH.model.toJSON(state.kb), 'application/json;charset=utf-8');
    if (result === 'cancelled') {
      PH.ui.toast('Sicherung abgebrochen.', 'info');
      return false;
    }
    state.prefs.lastBackup = PH.model.now();
    savePrefs();
    PH.ui.toast(result === 'shared' ? 'Sicherung wurde weitergegeben.' : 'Sicherung wurde heruntergeladen.', 'success');
    if (location.hash.startsWith('#/verwaltung')) refresh();
    return true;
  }

  async function resetToBundled() {
    if (!state.bundled) {
      PH.ui.toast(txt('Die Datei data/wissensdatenbank.js ist nicht verfügbar.', 'Die veröffentlichte Wissensdatenbank ist nicht verfügbar.'), 'error');
      return;
    }
    const ok = await PH.ui.confirm({
      title: 'Lokale Änderungen verwerfen?',
      html: 'Alle ' + txt('in diesem Browser', 'auf diesem Gerät') + ' gespeicherten Änderungen werden verworfen und der Stand ' +
        txt('aus <code>data/wissensdatenbank.js</code>', 'der veröffentlichten Version') + ' (' + fmtDate(state.bundled.meta.updated, true) + ') geladen.',
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

  function openLightbox(frame) {
    const ov = document.createElement('div');
    ov.className = 'lightbox';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Bildansicht');
    ov.innerHTML = '<button type="button" class="lightbox-close icon-btn" aria-label="Schließen (Esc)">' + icon('x') + '</button><div class="lightbox-stage"></div>';
    const stage = ov.querySelector('.lightbox-stage');
    const copy = frame.cloneNode(true);
    ['data-zoom', 'tabindex', 'role', 'aria-label'].forEach((a) => copy.removeAttribute(a));
    stage.appendChild(copy);
    const fig = frame.closest('figure');
    const legend = fig && fig.querySelector('.marker-legend');
    if (legend) stage.appendChild(legend.cloneNode(true));
    document.body.appendChild(ov);
    document.body.classList.add('no-scroll');
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => {
      ov.remove();
      document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey, true);
      if (frame.isConnected) frame.focus({ preventScroll: true });
    };
    ov.addEventListener('click', (e) => {
      if (e.target.closest('.lightbox-close') || !e.target.closest('.shot-frame, .marker-legend')) close();
    });
    document.addEventListener('keydown', onKey, true);
    ov.querySelector('.lightbox-close').focus();
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
        case 'bearbeiten': v = PH.editor.view({ id: parts[1] }); break;
        case 'neu': v = PH.editor.view({ type: parts[1], categoryId: query.kat }); break;
        case 'verwaltung': v = PH.admin.view(query); break;
        case 'hilfe': v = PH.views.help(); break;
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
    const choice = await PH.ui.dialog({
      title: txt('Andere Version im App-Ordner gefunden', 'Neue veröffentlichte Version gefunden'),
      body:
        txt('<p>Die Datei <code>data/wissensdatenbank.js</code> im App-Ordner unterscheidet sich von der Version, die in diesem Browser gespeichert ist.</p>',
          '<p>Die veröffentlichte Wissensdatenbank unterscheidet sich von der Version mit Ihren Änderungen, die auf diesem Gerät gespeichert ist.</p>') +
        '<dl class="kv">' +
        '<dt>' + txt('App-Ordner', 'Veröffentlicht') + '</dt><dd>Stand ' + fmtDate(b.meta.updated, true) + ' · ' + b.articles.length + ' Artikel</dd>' +
        '<dt>' + txt('Dieser PC', 'Dieses Gerät') + '</dt><dd>Stand ' + fmtDate(localKB.meta.updated, true) + ' · ' + localKB.articles.length + ' Artikel' +
        (state.dirty ? ' · <strong>mit eigenen Änderungen</strong>' : ' · bereits exportiert, aber im Ordner noch nicht ersetzt') + '</dd>' +
        '</dl><p>Welche Version möchten Sie verwenden? Tipp: Vorher eine Sicherung erstellen – dann geht nichts verloren.</p>',
      buttons: [
        { label: 'Sicherung erstellen', value: 'backup', kind: 'ghost', icon: 'download' },
        { label: txt('Lokale Version behalten', 'Meine Version behalten'), value: 'local' },
        { label: txt('Version aus App-Ordner laden', 'Veröffentlichte Version laden'), value: 'bundled', kind: 'primary' },
      ],
    });
    if (choice === 'backup') {
      await exportBackup();
      return showConflict(localKB);
    }
    if (choice === 'bundled') return adoptBundled();
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
    if (local && local.kb) {
      let localKB = null;
      try {
        localKB = PH.model.normalizeKB(local.kb);
      } catch (e) {
        console.warn('Lokale Kopie unlesbar', e);
      }
      if (localKB) {
        state.hasLocal = true;
        state.dirty = !!local.dirty;
        state.baseRevision = local.baseRevision || '';
        setKB(localKB);
        if (state.bundled && state.bundled.meta.revision !== state.baseRevision) {
          if (state.bundled.meta.revision === localKB.meta.revision) {
            // Die mitgelieferte Datei ist ein Export genau dieses Stands → kein Konflikt
            state.baseRevision = state.bundled.meta.revision;
            if (localKB.meta.updated <= state.bundled.meta.updated) state.dirty = false;
            await persist();
          } else if (!state.dirty && state.bundled.meta.updated >= localKB.meta.updated) {
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
    commit, refresh, withoutRefs,
    setLeaveGuard: (fn) => { state.leaveGuard = fn || null; },
    hasUnsavedChanges: () => !!(state.leaveGuard && state.leaveGuard()),
    openSearch,
    deleteArticle, duplicateArticle, exportForFolder, exportBackup, resetToBundled, openNewArticleDialog,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
