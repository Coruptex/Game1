/* Protel Hilfe – Ansichten (Start, Kategorien, Listen, Suche, Artikel, Hilfe) */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc, fmtDate, relTime, truncate } = PH.util;
  const icon = PH.icon;
  const md = (s) => PH.md.render(s);
  const T = () => PH.model.TYPES;
  const app = () => PH.app;

  /* ------------------------------------------------------------ Bausteine */

  function typeBadge(type) {
    const t = T()[type] || T().info;
    return '<span class="badge badge-type type-' + esc(type) + '">' + icon(t.icon) + esc(t.label) + '</span>';
  }

  function exampleBadge(a) {
    return a && a.example ? '<span class="badge badge-example" title="Beispielinhalt – kein geprüfter Ablauf">Beispiel</span>' : '';
  }

  /** Prüfstatus als Kennzeichen (Entwurf, In Prüfung, Geprüft, Veraltet) */
  function reviewBadge(a) {
    const st = a && a.review && a.review.status;
    if (!st) return '';
    const r = PH.model.REVIEW_STATUS[st];
    return '<span class="badge badge-review review-' + esc(st) + '" title="' + esc(r.label) + '">' + esc(r.short) + '</span>';
  }

  function figMeta(img) {
    const parts = [];
    if (img.slot) parts.push(img.slot);
    parts.push('Herkunft: ' + PH.model.ORIGINS[img.origin].label);
    if (img.captured) parts.push('aufgenommen ' + fmtDate(img.captured));
    if (img.pmsVersion) parts.push('Version ' + img.pmsVersion);
    if (img.status) parts.push(PH.model.IMAGE_STATUS[img.status].label);
    return parts.join(' · ');
  }

  /** Abbildung mit Nummer, Bildunterschrift, Markierungen und (im Bearbeitungsmodus) Rechtekennzeichnung */
  function figureHtml(img, opts) {
    opts = opts || {};
    const zoom = opts.zoom !== false;
    const markers = (img.markers || []).map((m, j) =>
      '<span class="marker" style="left:' + m.x + '%;top:' + m.y + '%"' + (m.label ? ' title="' + esc(m.label) + '"' : '') + '>' + (j + 1) + '</span>'
    ).join('');
    const legend = (img.markers || []).some((m) => m.label)
      ? '<ol class="marker-legend">' + img.markers.map((m, j) => '<li><span class="marker-dot">' + (j + 1) + '</span><span>' + esc(m.label || '–') + '</span></li>').join('') + '</ol>'
      : '';
    const caption = img.caption || img.alt || '';
    const rights = img.rights === 'oeffentlich' ? 'oeffentlich' : 'intern';
    return '<figure class="shot" data-fig-id="' + esc(img.id || '') + '"' + (img.slot ? ' data-slot="' + esc(img.slot) + '"' : '') + '>' +
      '<div class="shot-frame"' + (zoom ? ' data-zoom tabindex="0" role="button" aria-label="' + esc((opts.label ? opts.label + ' ' : '') + 'vergrößern') + '"' : '') +
      ' data-src-label="' + esc(truncate(img.src.startsWith('data:') ? 'eingebettetes Bild' : img.src, 80)) + '">' +
      '<img src="' + esc(img.src) + '" alt="' + esc(img.alt || caption || 'Screenshot') + '" loading="lazy" decoding="async">' + markers + '</div>' +
      '<figcaption>' + (opts.label ? '<span class="fig-num">' + esc(opts.label) + '</span>' : '') +
      '<span class="fig-text">' + esc(caption) + '</span>' +
      (zoom ? '<span class="muted no-print fig-hint">Klicken zum Vergrößern</span>' : '') +
      '<span class="fig-admin edit-only"><span class="rights-badge rights-' + rights + '" title="' + esc(PH.model.RIGHTS[rights].desc) + '">' + (rights === 'oeffentlich' ? 'öffentlich' : 'intern') + '</span>' +
      '<span class="fig-meta">' + esc(figMeta(img)) + '</span></span>' +
      '</figcaption>' + legend + '</figure>';
  }

  /** Bisherige Schnittstelle (ein Bild ohne Nummer) */
  function shotHtml(img, opts) {
    return figureHtml(PH.model.normalizeImage(img) || img, opts);
  }

  /** Noch fehlender, geplanter Screenshot – nur im Bearbeitungsmodus sichtbar */
  function slotPlaceholder(a, i, sl) {
    const need = PH.model.SLOT_NEED[sl.need] || PH.model.SLOT_NEED.optional;
    return '<div class="slot-ph edit-only no-print" data-slot="' + esc(sl.id) + '">' +
      '<span class="slot-ph-icon">' + icon('slot') + '</span>' +
      '<div class="slot-ph-text"><div><strong>Bildplatz ' + esc(sl.id) + '</strong> <span class="slot-need need-' + esc(sl.need) + '">' + esc(need.label) + '</span></div>' +
      (sl.title ? '<div>' + esc(sl.title) + '</div>' : '') +
      '<div class="muted small">' + (sl.area ? 'Bereich: ' + esc(sl.area) + ' · ' : '') + (sl.test ? 'Aufnahme bei ' + esc(sl.test) + ' · ' : '') +
        (sl.same ? 'gleiche Aufnahme wie ' + esc(sl.same) + ' · ' : '') + 'noch kein Bild</div>' +
      (sl.instruction ? '<details class="slot-instr"><summary>Aufnahmeanweisung</summary><div class="md">' + md(sl.instruction) + '</div></details>' : '') +
      '</div>' +
      (a.id ? '<a class="btn btn-sm btn-secondary" href="#/bearbeiten/' + encodeURIComponent(a.id) + '?schritt=' + (i + 1) + '">' + icon('image') + 'Bild einfügen</a>' : '') +
      '</div>';
  }

  function catBadge(cat) {
    if (!cat) return '';
    return '<a class="badge badge-cat color-' + esc(cat.color) + '" href="#/kategorie/' + encodeURIComponent(cat.id) + '">' +
      icon(cat.icon) + esc(cat.name) + '</a>';
  }

  function articleHref(a, q) {
    return '#/artikel/' + encodeURIComponent(a.id) + (q ? '?q=' + encodeURIComponent(q) : '');
  }

  function articleCard(a, opts) {
    opts = opts || {};
    const cat = app().getCategory(a.categoryId);
    const t = T()[a.type];
    return '<a class="card article-card" href="' + articleHref(a) + '">' +
      '<span class="type-icon type-' + esc(a.type) + '">' + icon(t.icon) + '</span>' +
      '<span class="article-card-body">' +
      '<span class="article-card-title">' + esc(a.title) + exampleBadge(a) + reviewBadge(a) + '</span>' +
      (a.summary && !opts.compact ? '<span class="article-card-summary">' + esc(truncate(a.summary, 140)) + '</span>' : '') +
      '<span class="article-card-meta">' + esc(t.label) + (cat && !opts.hideCat ? ' · ' + esc(cat.name) : '') +
      (opts.meta ? ' · ' + opts.meta : '') + '</span>' +
      '</span>' + icon('chevronRight', 'chev') + '</a>';
  }

  function breadcrumb(items) {
    return '<nav class="breadcrumb no-print" aria-label="Brotkrumen"><ol>' +
      items.map((it, i) =>
        '<li>' + (it.href && i < items.length - 1 ? '<a href="' + it.href + '">' + esc(it.label) + '</a>' : '<span aria-current="page">' + esc(it.label) + '</span>') + '</li>'
      ).join('<li class="sep" aria-hidden="true">' + icon('chevronRight') + '</li>') +
      '</ol></nav>';
  }

  function emptyState(ic, title, text, extra) {
    return '<div class="empty">' + '<div class="empty-icon">' + icon(ic) + '</div>' +
      '<h3>' + esc(title) + '</h3>' + (text ? '<p>' + text + '</p>' : '') + (extra || '') + '</div>';
  }

  function newArticleButton(categoryId, label) {
    return '<button type="button" class="btn btn-primary btn-sm edit-only" data-global="new-article"' +
      (categoryId ? ' data-cat="' + esc(categoryId) + '"' : '') + '>' + icon('plus') + esc(label || 'Neuer Artikel') + '</button>';
  }

  function sortByTitle(list) {
    return list.slice().sort((a, b) => a.title.localeCompare(b.title, 'de'));
  }

  function groupByType(list) {
    return PH.model.TYPE_ORDER.map((type) => ({ type, items: sortByTitle(list.filter((a) => a.type === type)) })).filter((g) => g.items.length);
  }

  /* ------------------------------------------------------------ Start */

  function home() {
    const kb = app().kb;
    const prefs = app().prefs;
    const counts = app().categoryCounts();
    const examples = kb.meta.searchExamples.length ? kb.meta.searchExamples : ['Check-in', 'Drucker', 'Storno'];
    const trees = sortByTitle(kb.articles.filter((a) => a.type === 'decision'));
    const troubles = sortByTitle(kb.articles.filter((a) => a.type === 'troubleshooting')).slice(0, 6);
    const recent = prefs.recent.map((id) => app().getArticle(id)).filter(Boolean).slice(0, 5);
    const favs = prefs.favorites.map((id) => app().getArticle(id)).filter(Boolean).slice(0, 6);
    const popular = Object.entries(prefs.views).sort((a, b) => b[1] - a[1]).map(([id]) => app().getArticle(id)).filter(Boolean).slice(0, 5);
    const updated = kb.articles.slice().sort((a, b) => (b.updated || '').localeCompare(a.updated || '')).slice(0, 5);

    let html = '<section class="hero">' +
      '<div class="hero-inner">' +
      '<p class="hero-kicker">' + icon('bell') + 'Wissensdatenbank der Rezeption</p>' +
      '<h1>Wie können wir helfen?</h1>' +
      '<p class="hero-sub">Suchen Sie nach Abläufen, Fehlermeldungen oder Stichworten – die Suche versteht auch andere Begriffe und verzeiht Tippfehler.</p>' +
      '<div class="hero-search" data-searchbox="hero"></div>' +
      '<div class="hero-try"><span>Probieren Sie:</span>' +
      examples.map((q) => '<button type="button" class="chip" data-try="' + esc(q) + '">' + esc(q) + '</button>').join('') + '</div>' +
      '</div></section>';

    if (!kb.articles.length) {
      html += emptyState('database', 'Die Wissensdatenbank ist leer',
        'Aktivieren Sie oben rechts den Bearbeitungsmodus, um den ersten Artikel anzulegen, oder importieren Sie eine Wissensdatenbank unter <a href="#/verwaltung">Verwaltung</a>.',
        '<div class="empty-actions">' + newArticleButton('', 'Ersten Artikel anlegen') + '</div>');
    }

    if (kb.categories.length) {
      html += '<section class="section"><div class="section-head"><h2>Kategorien</h2>' +
        '<a class="link-more" href="#/alle">Alle Artikel ' + icon('chevronRight') + '</a></div>' +
        catGrid(counts) + '</section>';
    }

    const cols = [];
    if (trees.length) {
      cols.push('<section class="section"><div class="section-head"><h2>' + icon('tree') + 'Assistenten</h2><a class="link-more" href="#/typ/decision">Alle ' + icon('chevronRight') + '</a></div>' +
        '<p class="section-sub">Geführte Fragen helfen bei Entscheidungen Schritt für Schritt.</p>' +
        '<div class="stack">' + trees.slice(0, 5).map((a) => articleCard(a, { compact: true })).join('') + '</div></section>');
    }
    if (troubles.length) {
      cols.push('<section class="section"><div class="section-head"><h2>' + icon('wrench') + 'Häufige Störungen</h2><a class="link-more" href="#/typ/troubleshooting">Alle ' + icon('chevronRight') + '</a></div>' +
        '<p class="section-sub">Ursachen der Reihe nach prüfen und beheben.</p>' +
        '<div class="stack">' + troubles.map((a) => articleCard(a, { compact: true })).join('') + '</div></section>');
    }
    if (cols.length) html += '<div class="two-col">' + cols.join('') + '</div>';

    const cols2 = [];
    if (favs.length) cols2.push('<section class="section"><div class="section-head"><h2>' + icon('star') + 'Favoriten</h2><a class="link-more" href="#/favoriten">Alle ' + icon('chevronRight') + '</a></div><div class="stack">' + favs.map((a) => articleCard(a, { compact: true })).join('') + '</div></section>');
    if (recent.length) cols2.push('<section class="section"><div class="section-head"><h2>' + icon('history') + 'Zuletzt angesehen</h2></div><div class="stack">' + recent.map((a) => articleCard(a, { compact: true })).join('') + '</div></section>');
    else if (popular.length) cols2.push('<section class="section"><div class="section-head"><h2>' + icon('eye') + 'Häufig genutzt</h2></div><div class="stack">' + popular.map((a) => articleCard(a, { compact: true })).join('') + '</div></section>');
    if (updated.length) cols2.push('<section class="section"><div class="section-head"><h2>' + icon('clock') + 'Zuletzt aktualisiert</h2></div><div class="stack">' + updated.map((a) => articleCard(a, { compact: true, meta: esc(relTime(a.updated)) })).join('') + '</div></section>');
    if (cols2.length) html += '<div class="two-col">' + cols2.slice(0, 2).join('') + '</div>' + (cols2[2] ? '<div class="two-col">' + cols2[2] + '</div>' : '');

    return { title: '', html, after: bindTry };
  }

  function catGrid(counts) {
    return '<div class="grid cat-grid">' +
      app().kb.categories.map((c) =>
        '<a class="card cat-card color-' + esc(c.color) + '" href="#/kategorie/' + encodeURIComponent(c.id) + '">' +
        '<span class="cat-icon">' + icon(c.icon) + '</span>' +
        '<span class="cat-text"><span class="cat-name">' + esc(c.name) + '</span>' +
        (c.description ? '<span class="cat-desc">' + esc(truncate(c.description, 90)) + '</span>' : '') +
        '<span class="cat-count">' + (counts[c.id] || 0) + ' Artikel</span></span></a>'
      ).join('') + '</div>';
  }

  /** Übersicht aller Kategorien und Artikeltypen (Tab „Kategorien“ auf Smartphone/Tablet) */
  function categories() {
    const kb = app().kb;
    const counts = app().categoryCounts();
    const tc = {};
    kb.articles.forEach((a) => (tc[a.type] = (tc[a.type] || 0) + 1));
    const none = kb.articles.filter((a) => !app().getCategory(a.categoryId)).length;
    const html = breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Kategorien' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('grid') + '</span><div class="page-head-text"><h1>Kategorien</h1>' +
      '<p>' + kb.articles.length + ' Artikel in ' + kb.categories.length + ' Kategorien</p></div>' +
      '<div class="page-head-actions">' + newArticleButton('', 'Neuer Artikel') + '</div></header>' +
      (kb.categories.length ? catGrid(counts) : emptyState('folder', 'Noch keine Kategorien', 'Kategorien legen Sie unter <a href="#/verwaltung">Verwaltung</a> an.')) +
      (none ? '<p><a class="link-more" href="#/kategorie/_ohne">' + icon('folder') + 'Ohne Kategorie (' + none + ') ' + icon('chevronRight') + '</a></p>' : '') +
      '<section class="section"><div class="section-head"><h2>Nach Artikeltyp</h2><a class="link-more" href="#/alle">Alle Artikel ' + icon('chevronRight') + '</a></div>' +
      '<div class="grid type-grid">' + PH.model.TYPE_ORDER.map((t) =>
        '<a class="card type-card type-' + t + '" href="#/typ/' + t + '"><span class="type-icon">' + icon(T()[t].icon) + '</span>' +
        '<span class="cat-text"><span class="cat-name">' + esc(T()[t].plural) + '</span><span class="cat-count">' + (tc[t] || 0) + ' Artikel</span></span></a>'
      ).join('') + '</div></section>';
    return { title: 'Kategorien', html };
  }

  function bindTry(el) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-try]');
      if (!b) return;
      const input = el.querySelector('.hero-search input');
      if (input) {
        input.value = b.dataset.try;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    });
  }

  /* ------------------------------------------------------------ Listen */

  function listSection(list, opts) {
    opts = opts || {};
    if (!list.length) return '';
    return '<div class="stack">' + list.map((a) => articleCard(a, opts)).join('') + '</div>';
  }

  function typeTabs(baseHref, list, active) {
    const counts = {};
    list.forEach((a) => (counts[a.type] = (counts[a.type] || 0) + 1));
    const sep = baseHref.includes('?') ? '&' : '?';
    return '<div class="tabs no-print" role="tablist">' +
      '<a class="tab' + (!active ? ' active' : '') + '" href="' + baseHref + '">Alle <span class="tab-count">' + list.length + '</span></a>' +
      PH.model.TYPE_ORDER.filter((t) => counts[t]).map((t) =>
        '<a class="tab' + (active === t ? ' active' : '') + '" href="' + baseHref + sep + 'typ=' + t + '">' + icon(T()[t].icon) + esc(T()[t].plural) + ' <span class="tab-count">' + counts[t] + '</span></a>'
      ).join('') + '</div>';
  }

  function category(id, query) {
    const kb = app().kb;
    const isNone = id === '_ohne';
    const cat = isNone ? { id: '', name: 'Ohne Kategorie', description: 'Artikel, die keiner Kategorie zugeordnet sind.', icon: 'folder', color: 'slate' } : app().getCategory(id);
    if (!cat) return notFound('Kategorie nicht gefunden', 'Die Kategorie existiert nicht (mehr).');
    const all = kb.articles.filter((a) => (isNone ? !app().getCategory(a.categoryId) : a.categoryId === cat.id));
    const type = T()[query.typ] ? query.typ : '';
    const list = type ? all.filter((a) => a.type === type) : all;
    const base = '#/kategorie/' + encodeURIComponent(id);
    let html = breadcrumb([{ href: '#/', label: 'Start' }, { label: cat.name }]) +
      '<header class="page-head color-' + esc(cat.color) + '">' +
      '<span class="page-icon">' + icon(cat.icon) + '</span>' +
      '<div class="page-head-text"><h1>' + esc(cat.name) + '</h1>' + (cat.description ? '<p>' + esc(cat.description) + '</p>' : '') + '</div>' +
      '<div class="page-head-actions">' + newArticleButton(cat.id, 'Artikel hinzufügen') + '</div></header>';
    if (!all.length) {
      html += emptyState('folder', 'Noch keine Artikel in dieser Kategorie', 'Im Bearbeitungsmodus können Sie hier neue Artikel anlegen.');
    } else {
      html += typeTabs(base, all, type);
      if (type) html += listSection(sortByTitle(list), { hideCat: true });
      else {
        html += groupByType(list).map((g) =>
          '<section class="section"><h2 class="group-title">' + icon(T()[g.type].icon) + esc(T()[g.type].plural) + ' <span class="muted">(' + g.items.length + ')</span></h2>' +
          listSection(g.items, { hideCat: true }) + '</section>'
        ).join('');
      }
    }
    return { title: cat.name, html };
  }

  function typeList(type) {
    const t = T()[type];
    if (!t) return notFound();
    const kb = app().kb;
    const list = kb.articles.filter((a) => a.type === type);
    const groups = kb.categories.map((c) => ({ cat: c, items: sortByTitle(list.filter((a) => a.categoryId === c.id)) })).filter((g) => g.items.length);
    const none = sortByTitle(list.filter((a) => !app().getCategory(a.categoryId)));
    let html = breadcrumb([{ href: '#/', label: 'Start' }, { label: t.plural }]) +
      '<header class="page-head type-head type-' + type + '"><span class="page-icon">' + icon(t.icon) + '</span>' +
      '<div class="page-head-text"><h1>' + esc(t.plural) + '</h1><p>' + esc(t.desc) + ' · ' + list.length + ' Artikel</p></div>' +
      '<div class="page-head-actions"><button type="button" class="btn btn-primary btn-sm edit-only" data-global="new-article" data-type="' + type + '">' + icon('plus') + 'Neu</button></div></header>';
    if (!list.length) html += emptyState(t.icon, 'Noch keine ' + t.plural, '');
    html += groups.map((g) => '<section class="section"><h2 class="group-title">' + icon(g.cat.icon) + esc(g.cat.name) + '</h2>' + listSection(g.items, { hideCat: true }) + '</section>').join('');
    if (none.length) html += '<section class="section"><h2 class="group-title">' + icon('folder') + 'Ohne Kategorie</h2>' + listSection(none) + '</section>';
    return { title: t.plural, html };
  }

  function all(query) {
    const kb = app().kb;
    const html = breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Alle Artikel' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('list') + '</span><div class="page-head-text"><h1>Alle Artikel</h1><p>' + kb.articles.length + ' Artikel in ' + kb.categories.length + ' Kategorien</p></div>' +
      '<div class="page-head-actions">' + newArticleButton('', 'Neuer Artikel') + '</div></header>' +
      '<div class="filterbar no-print">' +
      '<label class="field-inline"><span class="sr-only">Titel filtern</span><input type="text" class="input" id="f-text" placeholder="Liste filtern …" value="' + esc(query.f || '') + '"></label>' +
      '<label class="field-inline"><span class="sr-only">Typ</span><select class="input" id="f-type"><option value="">Alle Typen</option>' +
      PH.model.TYPE_ORDER.map((t) => '<option value="' + t + '"' + (query.typ === t ? ' selected' : '') + '>' + esc(T()[t].plural) + '</option>').join('') + '</select></label>' +
      '<label class="field-inline"><span class="sr-only">Kategorie</span><select class="input" id="f-cat"><option value="">Alle Kategorien</option>' +
      kb.categories.map((c) => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('') + '<option value="_ohne">Ohne Kategorie</option></select></label>' +
      '<label class="field-inline"><span class="sr-only">Prüfstatus</span><select class="input" id="f-review"><option value="">Alle Prüfstände</option>' +
      Object.keys(PH.model.REVIEW_STATUS).filter(Boolean).map((k) => '<option value="' + k + '"' + (query.status === k ? ' selected' : '') + '>' + esc(PH.model.REVIEW_STATUS[k].short) + '</option>').join('') +
      '<option value="_ohne"' + (query.status === '_ohne' ? ' selected' : '') + '>ohne Prüfstatus</option></select></label>' +
      '<label class="field-inline"><span class="sr-only">Sortierung</span><select class="input" id="f-sort"><option value="title">Titel A–Z</option><option value="updated">Zuletzt aktualisiert</option><option value="type">Nach Typ</option></select></label>' +
      '<label class="field-inline check-inline edit-only"><input type="checkbox" id="f-example"> nur Beispiele</label>' +
      '</div><div id="all-list"></div>';
    return {
      title: 'Alle Artikel',
      html,
      after(el) {
        const listEl = el.querySelector('#all-list');
        const upd = () => {
          const f = PH.searchUtil.norm(el.querySelector('#f-text').value.trim());
          const ty = el.querySelector('#f-type').value;
          const ca = el.querySelector('#f-cat').value;
          const so = el.querySelector('#f-sort').value;
          const ex = el.querySelector('#f-example').checked;
          const rv = el.querySelector('#f-review').value;
          let list = kb.articles.filter((a) =>
            (!rv || (rv === '_ohne' ? !a.review.status : a.review.status === rv)) &&
            (!ty || a.type === ty) &&
            (!ca || (ca === '_ohne' ? !app().getCategory(a.categoryId) : a.categoryId === ca)) &&
            (!ex || a.example) &&
            (!f || PH.searchUtil.norm(a.title + ' ' + a.tags.join(' ')).includes(f))
          );
          if (so === 'updated') list.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
          else if (so === 'type') list.sort((a, b) => PH.model.TYPE_ORDER.indexOf(a.type) - PH.model.TYPE_ORDER.indexOf(b.type) || a.title.localeCompare(b.title, 'de'));
          else list = sortByTitle(list);
          listEl.innerHTML = list.length
            ? '<p class="muted list-count">' + list.length + ' Artikel</p>' + listSection(list, { meta: so === 'updated' ? null : undefined })
            : emptyState('filter', 'Keine Artikel gefunden', 'Passen Sie die Filter an oder nutzen Sie die Volltextsuche.');
        };
        el.querySelectorAll('.filterbar input, .filterbar select').forEach((x) => x.addEventListener('input', upd));
        upd();
      },
    };
  }

  function favorites() {
    const favs = app().prefs.favorites.map((id) => app().getArticle(id)).filter(Boolean);
    const html = breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Favoriten' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('star') + '</span><div class="page-head-text"><h1>Favoriten</h1><p>Ihre gemerkten Artikel auf diesem PC.</p></div></header>' +
      (favs.length ? listSection(favs) : emptyState('star', 'Noch keine Favoriten', 'Öffnen Sie einen Artikel und klicken Sie auf „Merken“, um ihn hier schnell wiederzufinden.'));
    return { title: 'Favoriten', html };
  }

  /* ------------------------------------------------------------ Suche */

  function searchUrl(q, typ, kat) {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (typ) p.set('typ', typ);
    if (kat != null && kat !== '') p.set('kat', kat);
    return '#/suche?' + p.toString();
  }

  function search(query) {
    const q = (query.q || '').trim();
    const typ = T()[query.typ] ? query.typ : '';
    const kat = query.kat != null ? query.kat : '';
    const idx = app().index;
    const res = idx.search(q, { type: typ, category: kat });
    if (q && !typ && !kat) app().logSearch(q, res.total);

    let html = breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Suche' }]) +
      '<header class="search-head"><h1>' + (q ? 'Suchergebnisse für <span class="q">„' + esc(q) + '“</span>' : 'Suche') + '</h1>' +
      '<div class="search-page-box" data-searchbox="page" data-value="' + esc(q) + '"></div></header>';

    if (!q) {
      html += emptyState('search', 'Wonach suchen Sie?', 'Geben Sie oben einen Suchbegriff ein, z. B. einen Ablauf, ein Stichwort oder den Text einer Fehlermeldung.');
      return { title: 'Suche', html };
    }

    const info = [];
    if (res.suggestion) {
      info.push('<div class="search-info suggestion">' + icon('sparkle') + 'Meinten Sie <a href="' + searchUrl(res.suggestion) + '"><strong>' + esc(res.suggestion) + '</strong></a>? ' +
        '<span class="muted">Ähnliche Schreibweisen wurden berücksichtigt.</span></div>');
    }
    if (res.synonyms.length) {
      info.push('<div class="search-info">' + icon('tag') + 'Auch gesucht: ' +
        res.synonyms.map((s) => '<span class="syn"><strong>' + esc(s.from) + '</strong> → ' + s.to.map(esc).join(', ') + '</span>').join(' · ') + '</div>');
    }

    const totalAll = Object.values(res.facets.type).reduce((x, y) => x + y, 0);
    const facets = '<div class="tabs no-print" role="tablist">' +
      '<a class="tab' + (!typ ? ' active' : '') + '" href="' + searchUrl(q, '', kat) + '">Alle <span class="tab-count">' + totalAll + '</span></a>' +
      PH.model.TYPE_ORDER.filter((t) => res.facets.type[t]).map((t) =>
        '<a class="tab' + (typ === t ? ' active' : '') + '" href="' + searchUrl(q, t, kat) + '">' + icon(T()[t].icon) + esc(T()[t].plural) + ' <span class="tab-count">' + res.facets.type[t] + '</span></a>'
      ).join('') + '</div>';
    const catIds = Object.keys(res.facets.category);
    const catSelect = catIds.length > 1 || kat
      ? '<label class="field-inline"><span class="muted">Kategorie:</span><select class="input input-sm" id="s-cat"><option value="">Alle</option>' +
        app().kb.categories.filter((c) => catIds.includes(c.id) || c.id === kat).map((c) =>
          '<option value="' + esc(c.id) + '"' + (c.id === kat ? ' selected' : '') + '>' + esc(c.name) + ' (' + (res.facets.category[c.id] || 0) + ')</option>'
        ).join('') + '</select></label>'
      : '';

    html += info.join('');
    if (totalAll) html += '<div class="search-filters">' + facets + catSelect + '</div>';

    if (!res.results.length) {
      const tips = '<ul class="tips"><li>Prüfen Sie die Schreibweise oder verwenden Sie ein anderes Stichwort.</li>' +
        '<li>Nutzen Sie allgemeinere Begriffe (z. B. „Drucker“ statt „Rechnungsdrucker Empfang“).</li>' +
        '<li>Durchsuchen Sie die <a href="#/alle">Liste aller Artikel</a> oder die Kategorien.</li></ul>';
      html += emptyState('search', totalAll ? 'Keine Treffer mit diesen Filtern' : 'Keine Treffer für „' + q + '“',
        totalAll ? '<a href="' + searchUrl(q) + '">Filter zurücksetzen</a>' : 'Der Suchbegriff wurde für die Pflege der Wissensdatenbank notiert.',
        totalAll ? '' : tips + '<div class="empty-actions">' + newArticleButton('', 'Artikel zu diesem Thema anlegen') + '</div>');
    } else {
      html += '<p class="muted result-count">' + res.total + (res.total === 1 ? ' Treffer' : ' Treffer') + ', sortiert nach Relevanz</p>';
      const top = res.results[0].score;
      html += '<div class="results">' + res.results.map((r) => {
        const a = r.article;
        const cat = app().getCategory(a.categoryId);
        const t = T()[a.type];
        const doc = idx.docs[r.d];
        const rel = Math.max(1, Math.round((r.score / top) * 5));
        return '<a class="result" href="' + articleHref(a, q) + '">' +
          '<span class="type-icon type-' + esc(a.type) + '">' + icon(t.icon) + '</span>' +
          '<span class="result-body">' +
          '<span class="result-title">' + idx.highlight(a.title, r.matched) + exampleBadge(a) + reviewBadge(a) + '</span>' +
          '<span class="result-meta">' + esc(t.label) + (cat ? ' · ' + esc(cat.name) : '') + ' · Stand ' + fmtDate(a.updated) +
          '<span class="relevance" title="Relevanz">' + [1, 2, 3, 4, 5].map((i) => '<i' + (i <= rel ? ' class="on"' : '') + '></i>').join('') + '</span></span>' +
          '<span class="result-snippet">' + idx.snippet(doc.plain, r.matched, 220) + '</span>' +
          '</span></a>';
      }).join('') + '</div>';
    }

    return {
      title: 'Suche: ' + q,
      html,
      after(el) {
        const sel = el.querySelector('#s-cat');
        if (sel) sel.addEventListener('change', () => { location.hash = searchUrl(q, typ, sel.value); });
      },
    };
  }

  /* ------------------------------------------------------------ Artikel */

  function stepsHtml(a) {
    const steps = a.steps || [];
    let lastGroup = '';
    if (!steps.length) return '<p class="muted">Für diese Anleitung sind noch keine Schritte hinterlegt.</p>';
    return '<section class="steps-section">' +
      '<div class="section-row"><h2>Schritt für Schritt</h2>' +
      '<div class="steps-progress no-print" aria-live="polite"><span class="sp-text">0 von ' + steps.length + ' erledigt</span>' +
      '<span class="sp-bar"><span></span></span>' +
      '<button type="button" class="btn btn-ghost btn-xs" data-action="steps-reset">' + icon('refresh') + 'Zurücksetzen</button></div></div>' +
      '<ol class="steps">' + steps.map((s, i) => {
        let pre = '';
        if (s.group && s.group !== lastGroup) {
          pre = '<li class="step-group"><h3>' + esc(s.group) + '</h3></li>';
          lastGroup = s.group;
        }
        const ht = PH.model.HINT_TYPES[s.hintType] || PH.model.HINT_TYPES.tipp;
        const missing = (s.slots || []).filter((sl) => PH.model.slotState(s, sl) === 'fehlt');
        return pre + '<li class="step" data-step="' + i + '" id="schritt-' + (i + 1) + '">' +
          '<div class="step-rail"><span class="step-num">' + (i + 1) + '</span></div>' +
          '<div class="step-main">' +
          '<div class="step-head"><h3>' + esc(s.title || 'Schritt ' + (i + 1)) + '</h3>' +
          '<label class="step-check no-print no-hl"><input type="checkbox" data-action="step-done"><span>Erledigt</span></label></div>' +
          (s.text ? '<div class="md">' + md(s.text) + '</div>' : '') +
          (s.images || []).map((img, k) => figureHtml(img, { label: 'Abb. ' + (i + 1) + '.' + (k + 1) })).join('') +
          missing.map((sl) => slotPlaceholder(a, i, sl)).join('') +
          (s.hint ? '<div class="callout callout-' + ht.cls + ' step-hint"><div class="callout-title">' + icon(ht.icon) + esc(ht.label) + '</div><div class="callout-body">' + md(s.hint) + '</div></div>' : '') +
          '</div></li>';
      }).join('') + '</ol>' +
      '<div class="steps-done-msg" hidden>' + icon('checkCircle') + '<span>Alle Schritte erledigt.</span></div>' +
      '</section>';
  }

  function troubleshootingHtml(a) {
    const t = a.troubleshooting || { messages: [], causes: [] };
    let html = '';
    if (t.messages.length) {
      html += '<section class="ts-section"><h2>' + icon('alert') + 'Fehlermeldung' + (t.messages.length > 1 ? 'en' : '') + '</h2>' +
        '<div class="errmsgs">' + t.messages.map((m) =>
          '<div class="errmsg"><code>' + esc(m) + '</code><button type="button" class="icon-btn btn-xs no-print" data-copy="' + esc(m) + '" title="Text kopieren" aria-label="Fehlermeldung kopieren">' + icon('copy') + '</button></div>'
        ).join('') + '</div></section>';
    }
    if (t.symptoms) html += '<section class="ts-section"><h2>' + icon('eye') + 'Woran erkenne ich das Problem?</h2><div class="md">' + md(t.symptoms) + '</div></section>';
    if (t.causes.length) {
      html += '<section class="ts-section"><h2>' + icon('wrench') + 'Mögliche Ursachen &amp; Lösungen</h2>' +
        '<p class="muted no-print">Gehen Sie die Ursachen der Reihe nach durch – die häufigste steht oben.</p>' +
        '<div class="causes">' + t.causes.map((c, i) =>
          '<details class="cause" data-cause="' + i + '"' + (i === 0 ? ' open' : '') + '>' +
          '<summary><span class="cause-num">' + (i + 1) + '</span><span class="cause-title">' + esc(c.title || 'Ursache ' + (i + 1)) + '</span>' +
          '<span class="cause-state no-hl"></span>' + icon('chevronDown', 'chev') + '</summary>' +
          '<div class="cause-body">' +
          (c.check ? '<div class="cause-part"><h4>' + icon('search') + 'Prüfen</h4><div class="md">' + md(c.check) + '</div></div>' : '') +
          (c.solution ? '<div class="cause-part"><h4>' + icon('check') + 'Lösung</h4><div class="md">' + md(c.solution) + '</div></div>' : '') +
          '<div class="cause-actions no-print">' +
          '<button type="button" class="btn btn-success btn-sm" data-action="cause-solved">' + icon('check') + 'Problem gelöst</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="cause-next">' + (i < t.causes.length - 1 ? 'Hat nicht geholfen – nächste Ursache' : 'Hat nicht geholfen') + '</button>' +
          '</div></div></details>'
        ).join('') + '</div>' +
        '<div class="ts-solved" hidden>' + icon('checkCircle') + '<div><strong>Prima – Problem gelöst!</strong><br><span class="muted">Falls das Problem häufiger auftritt, melden Sie es bitte der verantwortlichen Person.</span></div></div>' +
        '</section>';
    }
    if (t.escalation) {
      html += '<section class="ts-section escalation" id="eskalation"><h2>' + icon('flag') + 'Wenn nichts hilft</h2><div class="md">' + md(t.escalation) + '</div></section>';
    }
    return html || '<p class="muted">Noch keine Informationen zur Fehlerbehebung hinterlegt.</p>';
  }

  /**
   * Rendert einen Artikel. opts: { preview: bool, query: string }
   * Wird auch von der Editor-Vorschau genutzt.
   */
  function renderArticle(a, opts) {
    // Verweise {{Abb:…}} im Text auf die Abbildungsnummern dieses Artikels auflösen
    return PH.md.withFigures(PH.model.figureLabels(a), () => renderArticleInner(a, opts || {}));
  }

  function reviewMeta(a) {
    const r = a.review || {};
    const parts = [];
    if (r.checkedAt) parts.push('Geprüft am ' + fmtDate(r.checkedAt) + (r.checkedBy ? ' durch ' + esc(r.checkedBy) : ''));
    if (r.pmsVersion) parts.push('protel-Version ' + esc(r.pmsVersion));
    if (r.nextReview) parts.push('Wiedervorlage ' + fmtDate(r.nextReview));
    return parts.length ? '<span>' + icon('shield') + parts.join(' · ') + '</span>' : '';
  }

  function reviewCallout(a) {
    const r = a.review || {};
    const note = r.note ? '<p>' + esc(r.note) + '</p>' : '';
    if (r.status === 'entwurf') {
      return '<div class="callout callout-warning review-callout"><div class="callout-title">' + icon('alert') + 'Entwurf – noch nicht im System geprüft</div>' +
        '<div class="callout-body"><p>Diese Anleitung ist aus Herstellerquellen abgeleitet und noch nicht im System geprüft. Bitte nur zusammen mit der verantwortlichen Person verwenden.</p>' + note + '</div></div>';
    }
    if (r.status === 'pruefung') {
      return '<div class="callout callout-info review-callout"><div class="callout-title">' + icon('infoCircle') + 'In Prüfung</div><div class="callout-body"><p>Der Ablauf wird gerade geprüft. Abweichungen bitte der verantwortlichen Person melden.</p>' + note + '</div></div>';
    }
    if (r.status === 'veraltet') {
      return '<div class="callout callout-danger review-callout"><div class="callout-title">' + icon('alert') + 'Veraltet – bitte erneut prüfen</div><div class="callout-body"><p>Der Ablauf hat sich möglicherweise geändert (z. B. durch ein Update).</p>' + note + '</div></div>';
    }
    if (r.status === 'geprueft' && r.nextReview && r.nextReview < new Date().toISOString().slice(0, 10)) {
      return '<div class="callout callout-info review-callout"><div class="callout-title">' + icon('clock') + 'Wiedervorlage fällig</div><div class="callout-body"><p>Die geplante erneute Prüfung (' + fmtDate(r.nextReview) + ') steht aus.</p>' + note + '</div></div>';
    }
    return '';
  }

  function sourcesHtml(a) {
    const list = a.sources || [];
    if (!list.length) return '';
    return '<section class="section sources" id="quellen"><h2>' + icon('book') + 'Quellen</h2>' +
      '<p class="muted small no-print">Links öffnen die Originalquelle und funktionieren nur mit Internetverbindung.</p>' +
      '<ol class="source-list">' + list.map((q, i) => {
        const url = PH.md.safeUrl(q.url);
        const title = esc(q.title || q.url);
        return '<li id="quelle-' + (i + 1) + '"><span class="src-tag">Q' + (i + 1) + '</span><span class="src-text">' +
          (url && !url.startsWith('#') ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + title + '</a>' : title) +
          (q.date ? ' <span class="muted">· Stand ' + esc(q.date) + '</span>' : '') +
          (q.note ? ' <span class="muted">· ' + esc(q.note) + '</span>' : '') + '</span></li>';
      }).join('') + '</ol></section>';
  }

  function renderArticleInner(a, opts) {
    const cat = app().getCategory(a.categoryId);
    const t = T()[a.type] || T().info;
    const fav = !opts.preview && app().isFavorite(a.id);
    let html = '';
    if (!opts.preview) {
      html += breadcrumb([{ href: '#/', label: 'Start' }, cat ? { href: '#/kategorie/' + encodeURIComponent(cat.id), label: cat.name } : { href: '#/kategorie/_ohne', label: 'Ohne Kategorie' }, { label: a.title }]);
    }
    html += '<article class="article type-' + esc(a.type) + '">' +
      '<header class="article-head">' +
      '<div class="article-kicker">' + typeBadge(a.type) + exampleBadge(a) + reviewBadge(a) + catBadge(cat) +
      (a.visibility === 'oeffentlich' ? '<span class="badge badge-public edit-only" title="Darf in der öffentlichen Version erscheinen">öffentlich</span>' : '') + '</div>' +
      '<h1>' + esc(a.title || 'Ohne Titel') + '</h1>' +
      (a.summary ? '<p class="lead">' + esc(a.summary) + '</p>' : '') +
      '<div class="article-meta">' +
      '<span>' + icon('clock') + 'Stand ' + fmtDate(a.updated || new Date().toISOString()) + '</span>' +
      (a.author ? '<span>' + icon('users') + esc(a.author) + '</span>' : '') +
      reviewMeta(a) +
      (a.tags.length ? '<span class="tags">' + icon('tag') + a.tags.map((x) => '<a class="tag" href="' + searchUrl(x) + '">' + esc(x) + '</a>').join('') + '</span>' : '') +
      '</div>' +
      (!opts.preview
        ? '<div class="article-actions no-print">' +
          '<button type="button" class="btn btn-secondary btn-sm' + (fav ? ' is-active' : '') + '" data-action="fav" aria-pressed="' + fav + '">' + icon('star') + '<span>' + (fav ? 'Gemerkt' : 'Merken') + '</span></button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="print">' + icon('printer') + 'Drucken</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="copy-link">' + icon('link') + 'Link kopieren</button>' +
          '<a class="btn btn-primary btn-sm edit-only" href="#/bearbeiten/' + encodeURIComponent(a.id) + '">' + icon('edit') + 'Bearbeiten</a>' +
          '<button type="button" class="btn btn-secondary btn-sm edit-only" data-action="duplicate">' + icon('copy') + 'Duplizieren</button>' +
          '<button type="button" class="btn btn-danger-ghost btn-sm edit-only" data-action="delete">' + icon('trash') + 'Löschen</button>' +
          '</div>'
        : '') +
      '</header>';

    if (a.example) {
      html += '<div class="callout callout-example"><div class="callout-title">' + icon('alert') + 'Beispielinhalt</div>' +
        '<div class="callout-body"><p>Dieser Artikel ist ein <strong>fiktives Muster</strong> und keine offizielle oder geprüfte protel-Bedienungsanleitung. ' +
        'Markierte <span class="placeholder">' + icon('edit') + 'Platzhalter</span> müssen durch Ihre tatsächlichen, intern geprüften Abläufe ersetzt werden.</p></div></div>';
    }
    html += reviewCallout(a);
    if (opts.query) {
      html += '<div class="hl-notice no-print no-hl" hidden>' + icon('search') + '<span>Suchbegriffe aus „' + esc(opts.query) + '“ sind markiert.</span>' +
        '<button type="button" class="btn btn-ghost btn-xs" data-action="next-hit">Nächster Treffer</button>' +
        '<button type="button" class="btn btn-ghost btn-xs" data-action="clear-hl">Markierung entfernen</button></div>';
    }

    html += '<div class="article-content">';
    if (a.body) html += '<div class="md article-body">' + md(a.body) + '</div>';
    const ov = a.images || [];
    if (ov.length) html += '<div class="article-figures">' + ov.map((img, k) => figureHtml(img, { label: ov.length > 1 ? 'Übersicht ' + (k + 1) : 'Übersicht' })).join('') + '</div>';
    if (a.type === 'guide') html += stepsHtml(a);
    else if (a.type === 'troubleshooting') html += troubleshootingHtml(a);
    else if (a.type === 'decision') html += '<section class="dt-section"><h2>' + icon('tree') + 'Assistent</h2><div class="dt-host"></div></section>';
    else if (!a.body && !ov.length) html += '<p class="muted">Noch kein Inhalt vorhanden.</p>';
    if (a.after) html += '<div class="md article-after">' + md(a.after) + '</div>';
    html += '</div>';
    html += sourcesHtml(a);

    const related = (a.related || []).map((id) => app().getArticle(id)).filter((x) => x && x.id !== a.id);
    if (related.length) {
      html += '<section class="section related no-print"><h2>Verwandte Artikel</h2><div class="stack">' + related.map((x) => articleCard(x, { compact: true })).join('') + '</div></section>';
    }
    if (!opts.preview && cat) {
      const more = sortByTitle(app().kb.articles.filter((x) => x.categoryId === cat.id && x.id !== a.id && !related.includes(x))).slice(0, 4);
      if (more.length) {
        html += '<section class="section related no-print"><h2>Weitere Artikel in „' + esc(cat.name) + '“</h2><div class="stack">' + more.map((x) => articleCard(x, { compact: true, hideCat: true })).join('') + '</div></section>';
      }
    }
    html += '</article>';

    return {
      html,
      after(el) {
        bindArticle(el, a, opts);
      },
    };
  }

  function bindArticle(el, a, opts) {
    // Entscheidungsbaum
    const host = el.querySelector('.dt-host');
    if (host) PH.tree.mount(host, a, { resolveArticle: opts.resolveArticle });

    // Suchtreffer hervorheben
    if (opts.query) {
      const res = app().index.search(opts.query);
      const r = res.results.find((x) => x.article.id === a.id);
      const n = r ? app().index.highlightDom(el.querySelector('.article-content'), r.matched) + app().index.highlightDom(el.querySelector('.article-head h1'), r.matched) : 0;
      const notice = el.querySelector('.hl-notice');
      if (n && notice) notice.hidden = false;
      // Treffer in geschlossenen Ursachen sichtbar machen
      el.querySelectorAll('details.cause').forEach((d) => { if (d.querySelector('mark.hl')) d.open = true; });
    }

    const updateProgress = () => {
      const steps = el.querySelectorAll('.step');
      const done = el.querySelectorAll('.step.done').length;
      const txt = el.querySelector('.sp-text');
      if (txt) txt.textContent = done + ' von ' + steps.length + ' erledigt';
      const bar = el.querySelector('.sp-bar > span');
      if (bar) bar.style.width = (steps.length ? (done / steps.length) * 100 : 0) + '%';
      const msg = el.querySelector('.steps-done-msg');
      if (msg) msg.hidden = !(steps.length && done === steps.length);
    };

    let hitIndex = -1;
    el.addEventListener('change', (e) => {
      if (e.target.matches('[data-action="step-done"]')) {
        e.target.closest('.step').classList.toggle('done', e.target.checked);
        updateProgress();
      }
    });

    el.addEventListener('click', async (e) => {
      const ref = e.target.closest('a.fig-ref[data-fig]');
      if (ref && el.contains(ref)) {
        e.preventDefault();
        const id = ref.dataset.fig;
        const fig = Array.from(el.querySelectorAll('figure[data-fig-id], figure[data-slot]')).find((f) => f.dataset.figId === id || f.dataset.slot === id);
        const frame = fig && fig.querySelector('.shot-frame[data-zoom]');
        if (frame) {
          fig.scrollIntoView({ behavior: 'smooth', block: 'center' });
          PH.app.openLightbox(frame);
        }
        return;
      }
      const btn = e.target.closest('[data-action]');
      if (!btn || !el.contains(btn)) return;
      const act = btn.dataset.action;
      if (act === 'fav') {
        const on = app().toggleFavorite(a.id);
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on);
        btn.querySelector('span').textContent = on ? 'Gemerkt' : 'Merken';
        PH.ui.toast(on ? 'Zu Favoriten hinzugefügt' : 'Aus Favoriten entfernt', 'success', { timeout: 2000 });
      } else if (act === 'print') {
        window.print();
      } else if (act === 'copy-link') {
        const url = location.href.split('#')[0] + '#/artikel/' + encodeURIComponent(a.id);
        const ok = await PH.util.copyText(url);
        PH.ui.toast(ok ? 'Link kopiert' : 'Kopieren nicht möglich: ' + url, ok ? 'success' : 'warning');
      } else if (act === 'duplicate') {
        app().duplicateArticle(a.id);
      } else if (act === 'delete') {
        app().deleteArticle(a.id);
      } else if (act === 'steps-reset') {
        el.querySelectorAll('.step').forEach((s) => s.classList.remove('done'));
        el.querySelectorAll('[data-action="step-done"]').forEach((c) => (c.checked = false));
        updateProgress();
      } else if (act === 'cause-solved') {
        const d = btn.closest('details.cause');
        el.querySelectorAll('details.cause').forEach((x) => { x.open = false; });
        d.classList.add('solved');
        d.classList.remove('failed');
        d.querySelector('.cause-state').textContent = 'Gelöst';
        const s = el.querySelector('.ts-solved');
        if (s) { s.hidden = false; s.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (act === 'cause-next') {
        const d = btn.closest('details.cause');
        d.open = false;
        d.classList.add('failed');
        d.classList.remove('solved');
        d.querySelector('.cause-state').textContent = 'Geprüft';
        const next = d.nextElementSibling;
        if (next && next.matches('details.cause')) {
          next.open = true;
          next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          const esc2 = el.querySelector('#eskalation');
          if (esc2) {
            esc2.classList.add('pulse');
            esc2.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => esc2.classList.remove('pulse'), 2400);
          }
        }
      } else if (act === 'clear-hl') {
        el.querySelectorAll('mark.hl').forEach((m) => m.replaceWith(document.createTextNode(m.textContent)));
        el.querySelector('.article-content').normalize();
        btn.closest('.hl-notice').hidden = true;
      } else if (act === 'next-hit') {
        const marks = el.querySelectorAll('mark.hl');
        if (!marks.length) return;
        marks.forEach((m) => m.classList.remove('current'));
        hitIndex = (hitIndex + 1) % marks.length;
        const m = marks[hitIndex];
        const d = m.closest('details');
        if (d) d.open = true;
        m.classList.add('current');
        m.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  function article(id, query) {
    const a = app().getArticle(id);
    if (!a) return notFound('Artikel nicht gefunden', 'Der Artikel existiert nicht (mehr). Vielleicht wurde er umbenannt oder gelöscht.');
    app().trackView(a.id);
    const r = renderArticle(a, { query: query.q });
    return { title: a.title, html: r.html, after: r.after };
  }

  /* ------------------------------------------------------------ Hilfe */

  const HELP_MD = [
    '## Suchen',
    '- Suchfeld oben anklicken oder {{Strg+K}} bzw. {{/}} drücken und lostippen – Ergebnisse erscheinen sofort.',
    '- Mit {{↓}} / {{↑}} durch die Vorschläge blättern, mit {{Enter}} öffnen, mit {{Esc}} schließen.',
    '- **Synonyme:** „Abreise“ findet auch Artikel zu „Check-out“, „Zimmerkarte“ auch „Schlüsselkarte“. Die Synonymliste wird unter *Verwaltung* gepflegt.',
    '- **Tippfehler** werden erkannt („Rechnug“ → „Rechnung“). Bei Bedarf erscheint „Meinten Sie …?“.',
    '- **Wortteile und Wortformen** werden gefunden („Karte“ findet „Kreditkarte“, „storniert“ findet „stornieren“).',
    '- Den Text einer **Fehlermeldung** können Sie direkt in die Suche kopieren.',
    '- Treffer sind nach Relevanz sortiert: Treffer im Titel, in Schlagwörtern und Fehlermeldungen zählen am stärksten.',
    '',
    '## Artikeltypen',
    '| Typ | Wofür? |',
    '|---|---|',
    '| Anleitung | Abläufe Schritt für Schritt, optional mit Screenshots und nummerierten Markierungen. Schritte lassen sich als „erledigt“ abhaken. |',
    '| Fehlerbehebung | Fehlermeldung, Symptome, mögliche Ursachen mit Prüf- und Lösungsschritten sowie Eskalation. |',
    '| Entscheidungsbaum | Ein Assistent führt mit Fragen zur passenden Lösung. |',
    '| Information | Nachschlagewissen, Kontaktlisten, Checklisten, Glossar. |',
    '',
    '## Bearbeiten',
    '1. Oben rechts **Bearbeiten** einschalten.',
    '2. Im Artikel auf **Bearbeiten** klicken oder über **Neuer Artikel** einen Artikel anlegen.',
    '3. Screenshots: mit {{Win+Umschalt+S}} einen Bildschirmausschnitt kopieren, das Bildfeld des Schritts anklicken und {{Strg+V}} drücken – oder eine Bilddatei hineinziehen. Ein Schritt kann **mehrere Bilder** haben.',
    '4. **Speichern** – die Änderung ist sofort in diesem Browser auf diesem PC gespeichert.',
    '',
    '## Bilder, Bildplätze und Rechte',
    '- Jedes Bild bekommt automatisch eine **Abbildungsnummer** („Abb. 3.1“ = Schritt 3, Bild 1). Im Text verweisen Sie mit `{{Abb:S-CIN-06}}` (Bildplatz oder Bild-ID) darauf.',
    '- **Bildplätze** sind geplante Screenshots mit Aufnahmeanweisung. Fehlende Bilder sehen Sie nur im Bearbeitungsmodus. Unter *Verwaltung → Bilder & Bildplätze* steht die Liste nach Bildschirmbereichen, dort können Sie auch mehrere Dateien auf einmal zuordnen (Dateiname beginnt mit der Nummer, z. B. `S-CIN-06_….png`).',
    '- **Rechte:** Neue Bilder sind **intern**. Öffentlich dürfen nur eigene Grafiken, Platzhalter und Screenshots dieser App sein. Eigene protel-Screenshots bleiben immer intern.',
    '- **Vergrößern:** Bild anklicken. Zoomen mit Mausrad, {{+}} / {{-}}, Doppelklick oder zwei Fingern; verschieben durch Ziehen; mit {{←}} / {{→}} oder Wischen zum nächsten Bild.',
    '',
    '## Prüfstatus und Quellen',
    '- Jede Anleitung kann einen **Prüfstatus** haben (Entwurf, In Prüfung, Geprüft, Veraltet) mit Datum, protel-Version und Wiedervorlage. *Alle Artikel* lässt sich danach filtern.',
    '- **Quellen** stehen am Ende des Artikels; im Text verweisen Kürzel wie [Q1] darauf.',
    '',
    '> [!WICHTIG]',
    '> Änderungen werden zunächst nur **lokal im Browser** dieses PCs gespeichert. Damit alle Rezeptions-PCs den neuen Stand erhalten, unter *Verwaltung → Für App-Ordner exportieren* die Datei `wissensdatenbank.js` erzeugen und im App-Ordner unter `data` ersetzen.',
    '',
    '## Formatierung in Textfeldern',
    '| Eingabe | Ergebnis |',
    '|---|---|',
    '| `**fett**` | **fett** |',
    '| `*kursiv*` | *kursiv* |',
    '| `- Punkt` | Aufzählung |',
    '| `1. Punkt` | Nummerierte Liste |',
    '| `- [ ] Aufgabe` | Abhakbare Checkliste |',
    '| `## Überschrift` | Zwischenüberschrift |',
    '| `{{Strg+P}}` | {{Strg+P}} (Tasten) |',
    '| `[[Text]]` | [[Platzhalter – noch auszufüllen]] |',
    '| `==Text==` | ==hervorgehoben== |',
    '| `[Linktext](#/artikel/ID)` | Link auf einen anderen Artikel |',
    '| `> [!HINWEIS]` / `[!TIPP]` / `[!WARNUNG]` / `[!WICHTIG]` | farbige Hinweisbox (Text in den Folgezeilen mit `>` beginnen) |',
    '',
    '## iPhone und iPad',
    '1. Die Adresse der App einmal in **Safari** mit Internetverbindung öffnen.',
    '2. Auf **Teilen** tippen (je nach Ansicht zuerst auf „•••“) und **„Zum Home-Bildschirm“** wählen.',
    '3. Protel Hilfe ab jetzt über das Symbol auf dem Home-Bildschirm starten – die App funktioniert dann vollständig **offline**, einschließlich Suche, Anleitungen und Bildern.',
    '',
    '- **Navigation:** Tab-Leiste unten (Start, Suchen, Kategorien, Favoriten, Mehr) und Zurück-Pfeil oben links.',
    '- **Screenshots** im Editor: „Datei wählen …“ öffnet Fotos, Kamera oder Dateien; „Aus Zwischenablage“ fügt ein kopiertes Bild ein.',
    '- **Sichern und Übertragen:** *Verwaltung → Sicherung exportieren* öffnet das Teilen-Menü („In Dateien sichern“, AirDrop, Mail). Auf dem anderen Gerät unter *Verwaltung → Importieren* die Datei auswählen.',
    '- **Updates:** Gibt es eine neue Version oder neue Inhalte, erscheint oben ein Hinweis. Ihre Änderungen bleiben beim Aktualisieren erhalten.',
    '',
    '> [!WICHTIG]',
    '> Safari und die App auf dem Home-Bildschirm haben **getrennte Speicher**. Bearbeiten Sie Inhalte daher immer in der installierten App und erstellen Sie regelmäßig eine Sicherung.',
    '',
    '## Sichern und Wiederherstellen',
    '- Vor riskanten Aktionen (Import, Ersetzen, Laden einer neuen Version, Umstellung des Datenformats) legt die App automatisch einen **Wiederherstellungspunkt** an. Sie finden die Punkte unter *Verwaltung*.',
    '- Ältere Sicherungen (auch aus früheren App-Versionen) lassen sich weiterhin importieren.',
    '- **Intern und öffentlich:** Die vollständige Sicherung und die Datendatei für die interne PC-Version enthalten alle Inhalte. Für die öffentliche Website gibt es einen eigenen Export, der nur ausdrücklich öffentliche Inhalte enthält.',
    '',
    '## Daten & Datenschutz',
    '- Die App läuft **vollständig offline**: kein Server-Programm, keine Cloud-Dienste, keine Verbindung zu protel-Systemen, keine KI.',
    '- Inhalte stammen aus `data/wissensdatenbank.js` (PC: im App-Ordner, Smartphone/Tablet: von der Website, danach offline gespeichert).',
    '- Eigene Änderungen, Favoriten, Verlauf und Suchstatistik bleiben lokal auf dem jeweiligen Gerät.',
    '- Die veröffentlichte Website ist **öffentlich erreichbar**. Vertrauliche Inhalte nur lokal pflegen (Import auf dem Gerät), nicht veröffentlichen.',
    '- Bitte keine personenbezogenen Gästedaten, Passwörter oder Kartendaten in Artikeln oder Screenshots speichern.',
    '',
    '## Lizenzen',
    '- Viele Bediensymbole stammen aus **Feather Icons** (MIT-Lizenz) und **Lucide** (ISC-Lizenz) oder sind daran angelehnt.',
    '- [Lizenzhinweise anzeigen](#/lizenzen) – dieselben Texte stehen in der Datei `LIZENZEN.txt` im App-Ordner.',
  ].join('\n');

  function help() {
    const html = breadcrumb([{ href: '#/', label: 'Start' }, { label: 'Hilfe zur App' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('help') + '</span><div class="page-head-text"><h1>Hilfe zur App</h1><p>So nutzen und pflegen Sie die Wissensdatenbank „Protel Hilfe“.</p></div></header>' +
      '<div class="card prose md">' + md(HELP_MD) + '</div>' +
      '<p class="muted small">Protel Hilfe ist eine interne Wissensdatenbank und kein offizielles Produkt des Herstellers von protel.</p>';
    return { title: 'Hilfe zur App', html };
  }

  /** Lizenzhinweise für Bestandteile Dritter (Text aus LIZENZEN.txt, erzeugt von tools/build-pwa.js) */
  function licenses() {
    const text = PH.LIZENZEN || '';
    const html = breadcrumb([{ href: '#/', label: 'Start' }, { href: '#/hilfe', label: 'Hilfe zur App' }, { label: 'Lizenzhinweise' }]) +
      '<header class="page-head"><span class="page-icon">' + icon('shield') + '</span><div class="page-head-text"><h1>Lizenzhinweise</h1>' +
      '<p>Bestandteile Dritter und ihre Lizenzen.</p></div></header>' +
      (text
        ? '<div class="card"><pre class="license-text">' + esc(text) + '</pre></div>'
        : emptyState('alert', 'Lizenztexte nicht gefunden', 'Die Datei <code>assets/js/lizenzen.js</code> fehlt. Die Texte stehen auch in <code>LIZENZEN.txt</code> im App-Ordner.'));
    return { title: 'Lizenzhinweise', html };
  }

  function notFound(title, text) {
    return {
      title: title || 'Nicht gefunden',
      html: emptyState('search', title || 'Seite nicht gefunden', esc(text || 'Diese Seite gibt es nicht.'), '<div class="empty-actions"><a class="btn btn-primary" href="#/">Zur Startseite</a></div>'),
    };
  }

  function error(err) {
    return {
      title: 'Fehler',
      html: emptyState('alert', 'Beim Anzeigen ist ein Fehler aufgetreten', esc(err && err.message ? err.message : String(err)),
        '<div class="empty-actions"><a class="btn btn-primary" href="#/">Zur Startseite</a></div>'),
    };
  }

  PH.views = {
    home, categories, category, typeList, all, favorites, search, article, help, licenses, notFound, error,
    renderArticle, articleCard, typeBadge, exampleBadge, reviewBadge, catBadge, breadcrumb, emptyState, shotHtml, figureHtml, searchUrl, articleHref,
  };
})();
