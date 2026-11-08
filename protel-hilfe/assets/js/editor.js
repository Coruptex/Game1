/* Protel Hilfe – Artikel-Editor (Grunddaten, Prüfstatus, Markdown, Schritte mit Bildern und Bildplätzen,
 * Fehlerbehebung, Entscheidungsbaum, Quellen) */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc, clone, setPath, getPath, truncate } = PH.util;
  const icon = PH.icon;
  const M = PH.model;
  const T = M.TYPES;
  const kbdHint = (s) => PH.md.inline(s);

  let st = null; // { draft, isNew, original, tab, markerMode, el, focusStep }

  function ensureSections(d) {
    if (!Array.isArray(d.steps)) d.steps = [];
    d.steps.forEach((s) => {
      if (!Array.isArray(s.images)) s.images = [];
      if (!Array.isArray(s.slots)) s.slots = [];
      if (!s.hintType) s.hintType = 'tipp';
      if (s.group == null) s.group = '';
    });
    if (!d.troubleshooting) d.troubleshooting = { messages: [], symptoms: '', causes: [], escalation: '' };
    if (!d.tree) d.tree = { start: '', nodes: [] };
    if (!Array.isArray(d.images)) d.images = [];
    if (!Array.isArray(d.sources)) d.sources = [];
    if (!d.review) d.review = M.normalizeArticle({}).review;
    if (d.after == null) d.after = '';
    if (!d.visibility) d.visibility = 'intern';
    return d;
  }

  function seedForType(d) {
    if (d.type === 'guide' && !d.steps.length) d.steps.push(M.newStep());
    if (d.type === 'troubleshooting' && !d.troubleshooting.causes.length) d.troubleshooting.causes.push({ title: '', check: '', solution: '' });
    if (d.type === 'decision' && !d.tree.nodes.length) {
      d.tree = M.newArticle('decision').tree;
    }
  }

  const isDirty = () => !!st && JSON.stringify(st.draft) !== st.original;
  const today = () => new Date().toISOString().slice(0, 10);

  /* ------------------------------------------------------------ Feld-Bausteine */

  const fid = (path) => 'f-' + String(path).replace(/[^a-zA-Z0-9]+/g, '-');

  function field(label, control, hint, opts) {
    opts = opts || {};
    return '<div class="field ' + (opts.cls || '') + '">' +
      (label ? '<label class="field-label"' + (opts.for ? ' for="' + opts.for + '"' : '') + '>' + label + (opts.required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' : '') +
      control + (hint ? '<p class="field-hint">' + hint + '</p>' : '') + '</div>';
  }

  function input(path, value, attrs) {
    return '<input class="input" id="' + fid(path) + '" data-path="' + path + '" value="' + esc(value) + '" ' + (attrs || '') + '>';
  }

  function textarea(path, value, rows, attrs) {
    return '<textarea class="input" id="' + fid(path) + '" data-path="' + path + '" rows="' + (rows || 3) + '" ' + (attrs || '') + '>' + esc(value) + '</textarea>';
  }

  function select(path, value, options, attrs) {
    return '<select class="input" id="' + fid(path) + '" data-path="' + path + '" ' + (attrs || '') + '>' +
      options.map(([v, l]) => '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(l) + '</option>').join('') + '</select>';
  }

  const MD_TOOLS = [
    ['bold', '<b>B</b>', 'Fett (Strg+B)'],
    ['italic', '<i>I</i>', 'Kursiv (Strg+I)'],
    ['h', 'H', 'Zwischenüberschrift'],
    ['ul', '•&nbsp;Liste', 'Aufzählung'],
    ['ol', '1.&nbsp;Liste', 'Nummerierte Liste'],
    ['task', '☐&nbsp;Check', 'Abhakbare Checkliste'],
    ['hint', 'Hinweis', 'Hinweisbox'],
    ['warn', 'Warnung', 'Warnbox'],
    ['kbd', 'Taste', 'Tastenkombination, z. B. {{Strg+P}}'],
    ['ph', 'Platzhalter', 'Platzhalter für noch fehlende Angaben'],
    ['link', 'Link', 'Link auf einen anderen Artikel'],
    ['fig', 'Abb.', 'Verweis auf eine Abbildung dieses Artikels'],
  ];

  function mdArea(path, value, rows, placeholder, opts) {
    opts = opts || {};
    return '<div class="md-editor">' +
      '<div class="md-toolbar" role="toolbar" aria-label="Formatierung">' +
      MD_TOOLS.filter((t) => !opts.tools || opts.tools.includes(t[0])).map((t) =>
        '<button type="button" class="md-btn" data-md="' + t[0] + '" data-for="' + fid(path) + '" title="' + esc(t[2]) + '">' + t[1] + '</button>'
      ).join('') +
      '</div>' +
      textarea(path, value, rows, 'data-md-field placeholder="' + esc(placeholder || '') + '"') +
      '</div>';
  }

  function itemTools(kind, i, n, extra) {
    return '<div class="item-tools">' +
      '<button type="button" class="icon-btn btn-xs" data-ed="move" data-kind="' + kind + '" data-i="' + i + '" data-dir="-1"' + (extra || '') + ' title="Nach oben"' + (i === 0 ? ' disabled' : '') + '>' + icon('arrowUp') + '</button>' +
      '<button type="button" class="icon-btn btn-xs" data-ed="move" data-kind="' + kind + '" data-i="' + i + '" data-dir="1"' + (extra || '') + ' title="Nach unten"' + (i >= n - 1 ? ' disabled' : '') + '>' + icon('arrowDown') + '</button>' +
      '<button type="button" class="icon-btn btn-xs danger" data-ed="remove" data-kind="' + kind + '" data-i="' + i + '"' + (extra || '') + ' title="Entfernen">' + icon('trash') + '</button>' +
      '</div>';
  }

  /* ------------------------------------------------------------ Abschnitte */

  function basics(d) {
    const kb = PH.app.kb;
    const cats = [['', '– ohne Kategorie –']].concat(kb.categories.map((c) => [c.id, c.name]));
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('info') + 'Grunddaten</h2>' +
      '<div class="ed-grid">' +
      field('Titel', input('title', d.title, 'maxlength="160" placeholder="z. B. Gast einchecken" autocomplete="off"'), '', { required: true, cls: 'span-2', for: fid('title') }) +
      field('Typ', select('type', d.type, M.TYPE_ORDER.map((t) => [t, T[t].label + ' – ' + T[t].desc]), 'data-rerender'), '', { for: fid('type') }) +
      field('Kategorie', select('categoryId', d.categoryId, cats), '', { for: fid('categoryId') }) +
      field('Kurzbeschreibung', textarea('summary', d.summary, 2, 'placeholder="Ein bis zwei Sätze: Worum geht es, wann brauche ich das?"'),
        'Erscheint in Listen und Suchergebnissen sowie als Einleitung des Artikels.', { cls: 'span-2', for: fid('summary') }) +
      field('Schlagwörter', input('tags', d.tags.join(', '), 'data-kind="list" placeholder="z. B. Check-in, Anreise"'),
        'Durch Komma getrennt. Werden angezeigt und bei der Suche stark gewichtet.', { for: fid('tags') }) +
      field('Zusätzliche Suchbegriffe', input('keywords', d.keywords.join(', '), 'data-kind="list" placeholder="z. B. einchecken, ankommen"'),
        'Unsichtbar – nur für die Suche, z. B. umgangssprachliche Begriffe.', { for: fid('keywords') }) +
      field('Verantwortlich / Autor', input('author', d.author, 'placeholder="z. B. Front-Office-Leitung"'), '', { for: fid('author') }) +
      field('Sichtbarkeit', select('visibility', d.visibility, Object.keys(M.VISIBILITY).map((k) => [k, M.VISIBILITY[k].desc]), 'data-rerender'),
        'Nur „öffentlich“ gekennzeichnete Artikel können in die öffentliche Version exportiert werden. Interne Anleitungen bleiben intern.', { for: fid('visibility') }) +
      '<div class="field span-2"><span class="field-label">Kennzeichnung</span><label class="check"><input type="checkbox" data-path="example" data-kind="bool"' + (d.example ? ' checked' : '') + '> Als <strong>Beispielinhalt</strong> markieren</label>' +
      '<p class="field-hint">Beispielartikel werden deutlich gekennzeichnet. Haken entfernen, sobald der Inhalt intern geprüft ist.</p></div>' +
      '</div></section>';
  }

  function reviewSection(d) {
    const r = d.review;
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('shield') + 'Prüfstatus und Versionsstand</h2>' +
      '<div class="ed-grid">' +
      field('Prüfstatus', select('review.status', r.status, Object.keys(M.REVIEW_STATUS).map((k) => [k, k ? M.REVIEW_STATUS[k].short : '– ohne –'])), '', { for: fid('review.status') }) +
      field('protel-Version', input('review.pmsVersion', r.pmsVersion, 'placeholder="z. B. 26.44"'), 'Stand von protel, auf den sich die Anleitung bezieht.', { for: fid('review.pmsVersion') }) +
      field('Geprüft am', input('review.checkedAt', r.checkedAt, 'type="date"'), '', { for: fid('review.checkedAt') }) +
      field('Geprüft von', input('review.checkedBy', r.checkedBy, 'placeholder="Name oder Funktion" autocomplete="off"'), 'Wird in öffentliche Exporte nicht übernommen.', { for: fid('review.checkedBy') }) +
      field('Nächste Prüfung', input('review.nextReview', r.nextReview, 'type="date"'), '', { for: fid('review.nextReview') }) +
      field('Bemerkung', input('review.note', r.note, 'placeholder="z. B. Abschnitt D im Testhaus nicht prüfbar"'), '', { for: fid('review.note') }) +
      '</div></section>';
  }

  function bodySection(d) {
    const titles = {
      guide: ['Einleitung & Voraussetzungen', 'Optional: Was wird benötigt, was ist vorab zu beachten?'],
      troubleshooting: ['Einleitung', 'Optional: kurze Einordnung des Problems.'],
      decision: ['Einleitung', 'Optional: Wann nutzt man diesen Assistenten?'],
      info: ['Inhalt', 'Text, Listen, Tabellen und Checklisten. Formatierung über die Leiste oder Kurzschreibweise (siehe Hilfe).'],
    };
    const [title, hint] = titles[d.type];
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('edit') + esc(title) + '</h2>' +
      '<p class="field-hint">' + esc(hint) + '</p>' +
      mdArea('body', d.body, d.type === 'info' ? 14 : 4, d.type === 'info' ? 'Inhalt des Artikels …' : 'Optionaler Einleitungstext …') +
      '</section>';
  }

  function overviewSection(d) {
    return '<section class="ed-section card" data-img-prefix="images">' +
      '<h2 class="ed-section-title">' + icon('image') + 'Übersichtsbilder</h2>' +
      '<p class="field-hint">Optional: Grafiken für den ganzen Artikel (z. B. eine eigene schematische Ablaufgrafik). Sie erscheinen nach der Einleitung.</p>' +
      imagesEditor(d.images, 'images', [], 'Übersicht') +
      '</section>';
  }

  function afterSection(d) {
    const t = d.type === 'guide' ? 'Nach den Schritten: Warnhinweise, Sonderfälle' : 'Abschluss: Hinweise, Sonderfälle';
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('alert') + esc(t) + '</h2>' +
      '<p class="field-hint">Optional. Erscheint unter dem Hauptteil – gut für Sonderfälle, Warnhinweise und offene Punkte.</p>' +
      mdArea('after', d.after, 4, 'z. B. ## Sonderfälle …') +
      '</section>';
  }

  function sourcesSection(d) {
    return '<section class="ed-section card">' +
      '<div class="ed-section-head"><h2 class="ed-section-title">' + icon('book') + 'Quellen</h2><span class="muted">' + d.sources.length + '</span></div>' +
      '<p class="field-hint">Titel, Link und Stand der Quelle. Im Text verweisen Kürzel wie [Q1] auf die erste Quelle. Links funktionieren nur online.</p>' +
      (d.sources.length
        ? '<div class="ed-sources">' + d.sources.map((q, i) =>
          '<div class="ed-source">' +
          '<span class="src-tag">Q' + (i + 1) + '</span>' +
          '<input class="input input-sm" data-path="sources.' + i + '.title" value="' + esc(q.title) + '" placeholder="Titel" aria-label="Titel der Quelle ' + (i + 1) + '">' +
          '<input class="input input-sm" data-path="sources.' + i + '.url" value="' + esc(q.url) + '" placeholder="https://…" aria-label="Link der Quelle ' + (i + 1) + '">' +
          '<input class="input input-sm src-date" data-path="sources.' + i + '.date" value="' + esc(q.date) + '" placeholder="Stand" aria-label="Stand der Quelle ' + (i + 1) + '">' +
          '<input class="input input-sm" data-path="sources.' + i + '.note" value="' + esc(q.note) + '" placeholder="Hinweis (optional)" aria-label="Hinweis zur Quelle ' + (i + 1) + '">' +
          itemTools('source', i, d.sources.length) + '</div>'
        ).join('') + '</div>'
        : '<p class="muted small">Noch keine Quellen.</p>') +
      '<button type="button" class="btn btn-secondary btn-sm" data-ed="source-add">' + icon('plus') + 'Quelle hinzufügen</button>' +
      '</section>';
  }

  /* ------------------------------------------------------------ Bilder (mehrere je Schritt) */

  const imgKey = (prefix, k) => prefix + '.' + k;

  function rightsHint(img) {
    if (img.rights === 'oeffentlich') return '<span class="rights-badge rights-oeffentlich">öffentlich</span>';
    return '<span class="rights-badge rights-intern">intern</span>';
  }

  function imageItem(img, prefix, k, n, slots, labelBase) {
    const key = imgKey(prefix, k);
    const on = st.markerMode === key;
    const p = prefix + '.' + k;
    const size = img.src.startsWith('data:') ? PH.util.formatBytes(Math.round(img.src.length * 0.75)) : 'verlinkt: ' + img.src;
    const slotOpts = [['', '– kein Bildplatz –']].concat(slots.map((sl) => [sl.id, sl.id + (sl.title ? ' – ' + truncate(sl.title, 40) : '')]));
    if (img.slot && !slots.some((sl) => sl.id === img.slot)) slotOpts.push([img.slot, img.slot + ' (nicht geplant)']);
    return '<div class="ed-img" data-img-key="' + esc(key) + '">' +
      '<div class="ed-img-head"><span class="fig-num">' + esc(labelBase) + '</span>' + rightsHint(img) +
      (img.slot ? '<span class="slot-chip">' + icon('slot') + esc(img.slot) + '</span>' : '') +
      '<div class="item-tools">' +
      '<button type="button" class="icon-btn btn-xs" data-ed="img-move" data-p="' + esc(prefix) + '" data-k="' + k + '" data-dir="-1" title="Nach oben"' + (k === 0 ? ' disabled' : '') + '>' + icon('arrowUp') + '</button>' +
      '<button type="button" class="icon-btn btn-xs" data-ed="img-move" data-p="' + esc(prefix) + '" data-k="' + k + '" data-dir="1" title="Nach unten"' + (k >= n - 1 ? ' disabled' : '') + '>' + icon('arrowDown') + '</button>' +
      '<button type="button" class="icon-btn btn-xs danger" data-ed="img-remove" data-p="' + esc(prefix) + '" data-k="' + k + '" title="Bild entfernen">' + icon('trash') + '</button>' +
      '</div></div>' +
      '<div class="ed-shot">' +
      '<div class="shot-frame' + (on ? ' marker-mode' : '') + '" data-ed-shot="' + esc(key) + '" data-src-label="' + esc(truncate(img.src.startsWith('data:') ? 'eingebettetes Bild' : img.src, 80)) + '">' +
      '<img src="' + esc(img.src) + '" alt="' + esc(img.alt) + '">' +
      img.markers.map((m, j) => '<span class="marker" style="left:' + m.x + '%;top:' + m.y + '%">' + (j + 1) + '</span>').join('') +
      '</div>' +
      '<div class="ed-shot-side">' +
      '<div class="btn-row">' +
      '<button type="button" class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-secondary') + '" data-ed="marker-mode" data-key="' + esc(key) + '" aria-pressed="' + on + '">' + icon('target') + (on ? 'Markieren beenden' : 'Markierungen setzen') + '</button>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-pick" data-p="' + esc(prefix) + '" data-k="' + k + '">' + icon('upload') + 'Ersetzen</button>' +
      '</div>' +
      (on ? '<p class="field-hint strong">' + icon('target') + 'Klicken Sie im Bild auf die Stelle, die nummeriert markiert werden soll.</p>' : '') +
      field('Bildunterschrift', input(p + '.caption', img.caption, 'placeholder="z. B. Check-in-Wizard, Schritt „Übersicht“"'), '', { for: fid(p + '.caption') }) +
      field('Bildbeschreibung (für Screenreader)', input(p + '.alt', img.alt, 'placeholder="Was ist auf dem Bild zu sehen?"'), '', { for: fid(p + '.alt') }) +
      '<div class="ed-grid tight">' +
      field('Rechte', select(p + '.rights', img.rights, [['intern', 'intern (Standard)'], ['oeffentlich', 'öffentlich']], 'data-rights'), img.rights === 'oeffentlich' ? 'Darf veröffentlicht werden.' : 'Wird nicht veröffentlicht.', { for: fid(p + '.rights') }) +
      field('Herkunft', select(p + '.origin', img.origin, Object.keys(M.ORIGINS).map((o) => [o, M.ORIGINS[o].label]), 'data-origin'), '', { for: fid(p + '.origin') }) +
      '</div>' +
      '<details class="ed-more"><summary>Bildplatz, Aufnahme und Prüfung</summary><div class="ed-grid tight">' +
      field('Bildplatz', select(p + '.slot', img.slot, slotOpts, 'data-rerender'), '', { for: fid(p + '.slot') }) +
      field('Status', select(p + '.status', img.status, Object.keys(M.IMAGE_STATUS).map((s) => [s, M.IMAGE_STATUS[s].label])), '', { for: fid(p + '.status') }) +
      field('Aufgenommen am', input(p + '.captured', img.captured, 'type="date"'), '', { for: fid(p + '.captured') }) +
      field('protel-Version', input(p + '.pmsVersion', img.pmsVersion, 'placeholder="z. B. 26.44"'), '', { for: fid(p + '.pmsVersion') }) +
      field('Aufgenommen von', input(p + '.capturedBy', img.capturedBy, 'autocomplete="off"'), '', { for: fid(p + '.capturedBy') }) +
      '</div></details>' +
      (img.markers.length
        ? '<ol class="ed-markers">' + img.markers.map((m, j) =>
          '<li><span class="marker-dot">' + (j + 1) + '</span>' +
          '<input class="input input-sm" data-path="' + p + '.markers.' + j + '.label" value="' + esc(m.label) + '" placeholder="Beschriftung (optional)" aria-label="Beschriftung Markierung ' + (j + 1) + '">' +
          '<button type="button" class="icon-btn btn-xs danger" data-ed="marker-del" data-key="' + esc(key) + '" data-j="' + j + '" title="Markierung entfernen">' + icon('x') + '</button></li>'
        ).join('') + '</ol>'
        : '') +
      '<p class="muted small">' + icon('image') + esc(size) + '</p>' +
      '</div></div></div>';
  }

  function dropzone(prefix, label, slot) {
    const canClip = !!(navigator.clipboard && navigator.clipboard.read);
    return '<div class="dropzone' + (slot ? ' dropzone-slot' : '') + '" tabindex="0" data-drop="' + esc(prefix) + '"' + (slot ? ' data-slot="' + esc(slot) + '"' : '') + ' aria-label="' + esc(label) + '">' +
      icon(slot ? 'slot' : 'image') +
      '<div class="dropzone-text"><strong>' + esc(label) + '</strong>' +
      '<span class="only-pointer">Hier klicken und ' + kbdHint('{{Strg+V}}') + ' drücken oder Bilddatei hierher ziehen</span>' +
      '<span class="only-touch">Foto, Kamera oder Datei wählen – oder ein kopiertes Bild einfügen</span></div>' +
      '<span class="btn-row">' +
      (canClip ? '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-clip" data-p="' + esc(prefix) + '"' + (slot ? ' data-slot="' + esc(slot) + '"' : '') + '>' + icon('copy') + 'Aus Zwischenablage</button>' : '') +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-pick" data-p="' + esc(prefix) + '"' + (slot ? ' data-slot="' + esc(slot) + '"' : '') + '>' + icon('upload') + 'Datei wählen …</button></span>' +
      '</div>';
  }

  function imagesEditor(images, prefix, slots, labelBase) {
    const n = images.length;
    return '<div class="ed-images">' +
      images.map((img, k) => imageItem(img, prefix, k, n, slots, labelBase.replace('#', String(k + 1)))).join('') +
      dropzone(prefix, n ? 'Weiteres Bild einfügen' : 'Bild einfügen') +
      '<details class="ed-more"><summary>Oder Bild aus dem App-Ordner verlinken</summary>' +
      '<div class="input-row"><input class="input input-sm" data-img-path="' + esc(prefix) + '" placeholder="z. B. bilder/check-in-1.png" aria-label="Bildpfad">' +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-path" data-p="' + esc(prefix) + '">Übernehmen</button></div>' +
      '<p class="field-hint">Pfad relativ zur Datei index.html. Das Bild muss zusammen mit der App verteilt werden.</p></details>' +
      '</div>';
  }

  function slotsEditor(s, i) {
    const slots = s.slots;
    const missing = slots.filter((sl) => M.slotState(s, sl) === 'fehlt');
    return '<details class="ed-more ed-slots"' + (missing.length ? ' open' : '') + '><summary>Bildplätze (geplante Screenshots): ' + slots.length +
      (slots.length ? ' · ' + missing.length + ' fehlen' : '') + '</summary>' +
      '<p class="field-hint">Ein Bildplatz beschreibt, welcher Screenshot hier hingehört. Fehlende Bilder sind nur im Bearbeitungsmodus sichtbar.</p>' +
      slots.map((sl, k) => {
        const p = 'steps.' + i + '.slots.' + k;
        const state = M.slotState(s, sl);
        return '<div class="ed-slot">' +
          '<div class="ed-slot-head"><span class="slot-state state-' + state + '">' + esc(M.SLOT_STATES[state].label) + '</span>' +
          '<input class="input input-sm slot-id" data-path="' + p + '.id" value="' + esc(sl.id) + '" placeholder="z. B. S-CIN-06" aria-label="Nummer des Bildplatzes" data-rerender-blur>' +
          '<select class="input input-sm" data-path="' + p + '.need" aria-label="Bedarf">' + Object.keys(M.SLOT_NEED).map((nd) => '<option value="' + nd + '"' + (nd === sl.need ? ' selected' : '') + '>' + esc(M.SLOT_NEED[nd].label) + '</option>').join('') + '</select>' +
          itemTools('slot', k, slots.length, ' data-s="' + i + '"') + '</div>' +
          '<div class="ed-grid tight">' +
          field('Motiv', input(p + '.title', sl.title, 'placeholder="z. B. Check-in-Wizard, Schritt „Übersicht“"'), '', { for: fid(p + '.title') }) +
          field('Bildschirmbereich', input(p + '.area', sl.area, 'placeholder="z. B. Check-in-Wizard"'), '', { for: fid(p + '.area') }) +
          field('Aufnahme bei Testfall', input(p + '.test', sl.test, 'placeholder="z. B. T-CIN-03"'), '', { for: fid(p + '.test') }) +
          '</div>' +
          field('Aufnahmeanweisung', textarea(p + '.instruction', sl.instruction, 3, 'placeholder="Was muss sichtbar sein? Was ist abzudecken?"'), '', { for: fid(p + '.instruction') }) +
          (state === 'fehlt' ? dropzone('steps.' + i + '.images', 'Bild für ' + sl.id + ' einfügen', sl.id) : '') +
          '</div>';
      }).join('') +
      '<button type="button" class="btn btn-xs btn-ghost" data-ed="slot-add" data-i="' + i + '">' + icon('plus') + 'Bildplatz hinzufügen</button>' +
      '</details>';
  }

  function stepsSection(d) {
    return '<section class="ed-section card">' +
      '<div class="ed-section-head"><h2 class="ed-section-title">' + icon('guide') + 'Schritte</h2><span class="muted">' + d.steps.length + ' Schritt' + (d.steps.length === 1 ? '' : 'e') + '</span></div>' +
      '<p class="field-hint only-pointer">' + icon('image') + 'Screenshot: mit ' + kbdHint('{{Win+Umschalt+S}}') + ' einen Bildschirmausschnitt kopieren, das Bildfeld des Schritts anklicken und ' + kbdHint('{{Strg+V}}') + ' drücken. Neue Bilder sind <strong>intern</strong>.</p>' +
      '<p class="field-hint only-touch">' + icon('image') + 'Bilder: „Datei wählen …“ öffnet Fotos, Kamera und Dateien. Ein kopiertes Bildschirmfoto fügen Sie mit „Aus Zwischenablage“ ein.</p>' +
      '<div class="ed-list">' + d.steps.map((s, i) =>
        '<div class="ed-item ed-step" data-step-index="' + i + '" data-img-prefix="steps.' + i + '.images" id="ed-step-' + (i + 1) + '">' +
        '<div class="ed-item-head"><span class="step-num">' + (i + 1) + '</span>' +
        '<input class="input input-strong" data-path="steps.' + i + '.title" value="' + esc(s.title) + '" placeholder="Titel des Schritts, z. B. „Reservierung aufrufen“" aria-label="Titel von Schritt ' + (i + 1) + '">' +
        itemTools('step', i, d.steps.length) + '</div>' +
        '<div class="ed-group-row"><label class="field-inline small"><span class="muted">Abschnitt</span>' +
        '<input class="input input-sm" data-path="steps.' + i + '.group" value="' + esc(s.group) + '" placeholder="optional, z. B. „B. Check-in-Wizard“" aria-label="Abschnitt von Schritt ' + (i + 1) + '"></label></div>' +
        mdArea('steps.' + i + '.text', s.text, 3, 'Was ist in diesem Schritt zu tun?') +
        imagesEditor(s.images, 'steps.' + i + '.images', s.slots, 'Abb. ' + (i + 1) + '.#') +
        slotsEditor(s, i) +
        '<details class="ed-more"' + (s.hint ? ' open' : '') + '><summary>Tipp / Hinweis / Warnung zu diesem Schritt</summary>' +
        '<div class="ed-grid tight">' + field('Art', select('steps.' + i + '.hintType', s.hintType, Object.keys(M.HINT_TYPES).map((h) => [h, M.HINT_TYPES[h].label])), '', { for: fid('steps.' + i + '.hintType') }) + '</div>' +
        mdArea('steps.' + i + '.hint', s.hint, 2, 'Optional: Tipp, Warnung, typische Fehler, Sonderfälle', { tools: ['bold', 'italic', 'kbd', 'ph', 'fig'] }) + '</details>' +
        '</div>'
      ).join('') + '</div>' +
      '<button type="button" class="btn btn-secondary" data-ed="step-add">' + icon('plus') + 'Schritt hinzufügen</button>' +
      '</section>';
  }

  function troubleSection(d) {
    const t = d.troubleshooting;
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('wrench') + 'Fehlerbehebung</h2>' +
      field('Fehlermeldungen', textarea('troubleshooting.messages', t.messages.join('\n'), 3, 'data-kind="lines" class="input mono" placeholder="Eine Meldung pro Zeile – möglichst wörtlich"'),
        'Wortgetreu eintragen: Mitarbeitende können den Meldungstext direkt in die Suche kopieren.', { for: fid('troubleshooting.messages') }) +
      field('Woran erkenne ich das Problem?', mdArea('troubleshooting.symptoms', t.symptoms, 3, 'Symptome, z. B. „Rechnung wird nicht gedruckt“')) +
      '<div class="ed-subhead"><h3>Mögliche Ursachen</h3><span class="muted">Häufigste Ursache zuerst</span></div>' +
      '<div class="ed-list">' + t.causes.map((c, i) =>
        '<div class="ed-item">' +
        '<div class="ed-item-head"><span class="step-num">' + (i + 1) + '</span>' +
        '<input class="input input-strong" data-path="troubleshooting.causes.' + i + '.title" value="' + esc(c.title) + '" placeholder="Ursache, z. B. „Papier leer“" aria-label="Ursache ' + (i + 1) + '">' +
        itemTools('cause', i, t.causes.length) + '</div>' +
        '<div class="ed-grid">' +
        field('Prüfen', mdArea('troubleshooting.causes.' + i + '.check', c.check, 3, 'Wie stelle ich fest, ob das die Ursache ist?')) +
        field('Lösung', mdArea('troubleshooting.causes.' + i + '.solution', c.solution, 3, 'Was ist zu tun?')) +
        '</div></div>'
      ).join('') + '</div>' +
      '<button type="button" class="btn btn-secondary" data-ed="cause-add">' + icon('plus') + 'Ursache hinzufügen</button>' +
      '<div class="ed-spacer"></div>' +
      field('Wenn nichts hilft (Eskalation)', mdArea('troubleshooting.escalation', t.escalation, 3, 'Wen informieren? Welche Übergangslösung gibt es?')) +
      '</section>';
  }

  function nodeOptions(tree, self, value) {
    const opts = ['<option value="">– Ziel wählen –</option>'];
    tree.nodes.forEach((n) => {
      if (n.id === self) return;
      opts.push('<option value="' + esc(n.id) + '"' + (n.id === value ? ' selected' : '') + '>' +
        esc(M.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), 50) || '(ohne Text)')) + '</option>');
    });
    opts.push('<option value="__new_q">＋ neue Frage anlegen</option>', '<option value="__new_r">＋ neues Ergebnis anlegen</option>');
    return opts.join('');
  }

  function articleOptions(excludeIds, placeholder) {
    const ex = new Set(excludeIds);
    return '<option value="">' + esc(placeholder) + '</option>' +
      PH.app.kb.articles.filter((a) => !ex.has(a.id)).slice().sort((a, b) => a.title.localeCompare(b.title, 'de'))
        .map((a) => '<option value="' + esc(a.id) + '">' + esc(a.title) + '</option>').join('');
  }

  function chips(ids, action, k) {
    return ids.map((id) => {
      const a = PH.app.getArticle(id);
      return '<span class="chip chip-removable">' + esc(a ? a.title : id + ' (fehlt)') +
        '<button type="button" data-ed="' + action + '" data-id="' + esc(id) + '"' + (k != null ? ' data-k="' + k + '"' : '') + ' aria-label="Entfernen">' + icon('x') + '</button></span>';
    }).join('');
  }

  function treeWarnHtml(warns) {
    return warns.length
      ? '<div class="callout callout-warning"><div class="callout-title">' + icon('alert') + warns.length + (warns.length === 1 ? ' offener Punkt' : ' offene Punkte') + '</div><div class="callout-body"><ul>' +
        warns.slice(0, 12).map((w) => '<li>' + esc(w) + '</li>').join('') + (warns.length > 12 ? '<li>…</li>' : '') + '</ul></div></div>'
      : '<div class="ok-note">' + icon('checkCircle') + 'Alle Antworten sind verknüpft und alle Knoten erreichbar.</div>';
  }

  /** Hinweise und Knotennamen in Auswahllisten beim Tippen aktualisieren (ohne Neuaufbau des Formulars) */
  const refreshTreeHints = PH.util.debounce(() => {
    if (!st || !st.el || st.draft.type !== 'decision') return;
    const tree = st.draft.tree;
    const box = st.el.querySelector('#ed-tree-warn');
    if (box) box.innerHTML = treeWarnHtml(M.validateTree(tree));
    tree.nodes.forEach((n) => {
      const label = M.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), n.kind === 'question' ? 60 : 50) || '(ohne Text)');
      st.el.querySelectorAll('select[data-ed-next] option[value="' + CSS.escape(n.id) + '"], select[data-path="tree.start"] option[value="' + CSS.escape(n.id) + '"]')
        .forEach((o) => { o.textContent = label; });
    });
  }, 250);

  function treeSection(d) {
    const tree = d.tree;
    const warns = M.validateTree(tree);
    const startOpts = tree.nodes.filter((n) => n.kind === 'question').map((n) => [n.id, M.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), 60) || '(ohne Text)')]);
    return '<section class="ed-section card">' +
      '<div class="ed-section-head"><h2 class="ed-section-title">' + icon('tree') + 'Entscheidungsbaum</h2>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="tab" data-tab="preview">' + icon('eye') + 'Testen</button></div>' +
      '<p class="field-hint">Jede <strong>Frage</strong> hat Antworten, die zur nächsten Frage oder zu einem <strong>Ergebnis</strong> führen. Ergebnisse beschreiben, was zu tun ist, und können auf passende Artikel verweisen.</p>' +
      field('Startfrage', select('tree.start', tree.start, startOpts.length ? startOpts : [['', '– zuerst eine Frage anlegen –']], 'data-rerender'), '', { for: fid('tree.start') }) +
      '<div id="ed-tree-warn">' + treeWarnHtml(warns) + '</div>' +
      '<div class="ed-list">' + tree.nodes.map((n, k) => {
        const isQ = n.kind === 'question';
        return '<div class="ed-item ed-node kind-' + n.kind + '" id="ednode-' + esc(n.id) + '">' +
          '<div class="ed-item-head">' +
          '<span class="node-badge kind-' + n.kind + '">' + icon(isQ ? 'help' : 'flag') + esc(M.nodeLabel(tree, n)) + '</span>' +
          (tree.start === n.id ? '<span class="badge badge-start">Start</span>' : '') +
          '<select class="input input-sm node-kind" data-path="tree.nodes.' + k + '.kind" data-rerender aria-label="Knotenart">' +
          '<option value="question"' + (isQ ? ' selected' : '') + '>Frage</option><option value="result"' + (!isQ ? ' selected' : '') + '>Ergebnis</option></select>' +
          itemTools('node', k, tree.nodes.length) + '</div>' +
          (isQ
            ? textarea('tree.nodes.' + k + '.text', n.text, 2, 'placeholder="Frage, z. B. „Ist ein passendes Zimmer bereits frei?“" aria-label="Fragetext"') +
              '<div class="ed-answers">' + (n.answers || []).map((a, m) =>
                '<div class="ed-answer">' +
                '<input class="input input-sm" data-path="tree.nodes.' + k + '.answers.' + m + '.label" value="' + esc(a.label) + '" placeholder="Antwort, z. B. Ja" aria-label="Antwort ' + (m + 1) + '">' +
                '<span class="ed-arrow" aria-hidden="true">' + icon('arrowRight') + '</span>' +
                '<select class="input input-sm" data-ed-next data-k="' + k + '" data-m="' + m + '" aria-label="Ziel der Antwort">' + nodeOptions(tree, n.id, a.next) + '</select>' +
                (a.next && tree.nodes.some((x) => x.id === a.next) ? '<button type="button" class="icon-btn btn-xs" data-ed="goto-node" data-id="' + esc(a.next) + '" title="Zum Zielknoten springen">' + icon('chevronDown') + '</button>' : '') +
                '<button type="button" class="icon-btn btn-xs danger" data-ed="answer-del" data-k="' + k + '" data-m="' + m + '" title="Antwort entfernen">' + icon('x') + '</button>' +
                '</div>'
              ).join('') +
              '<button type="button" class="btn btn-xs btn-ghost" data-ed="answer-add" data-k="' + k + '">' + icon('plus') + 'Antwort hinzufügen</button></div>'
            : mdArea('tree.nodes.' + k + '.text', n.text, 3, 'Was ist zu tun?') +
              '<div class="ed-grid">' +
              field('Art des Ergebnisses', select('tree.nodes.' + k + '.tone', n.tone, Object.keys(M.TONES).map((t) => [t, M.TONES[t].label])), '', { for: fid('tree.nodes.' + k + '.tone') }) +
              field('Passende Artikel', '<div class="chips">' + chips(n.links || [], 'link-del', k) + '</div>' +
                '<select class="input input-sm" data-ed-linkadd data-k="' + k + '" aria-label="Artikel verknüpfen">' + articleOptions(n.links || [], '＋ Artikel verknüpfen …') + '</select>') +
              '</div>') +
          '</div>';
      }).join('') + '</div>' +
      '<div class="btn-row"><button type="button" class="btn btn-secondary" data-ed="node-add" data-kind="question">' + icon('plus') + 'Frage hinzufügen</button>' +
      '<button type="button" class="btn btn-secondary" data-ed="node-add" data-kind="result">' + icon('plus') + 'Ergebnis hinzufügen</button></div>' +
      '</section>';
  }

  function relatedSection(d) {
    return '<section class="ed-section card">' +
      '<h2 class="ed-section-title">' + icon('link') + 'Verwandte Artikel</h2>' +
      '<p class="field-hint">Werden unter dem Artikel als weiterführende Links angezeigt.</p>' +
      '<div class="chips">' + (d.related.length ? chips(d.related, 'related-del') : '<span class="muted small">Keine verknüpft.</span>') + '</div>' +
      '<select class="input" data-ed-related-add aria-label="Verwandten Artikel hinzufügen">' + articleOptions(d.related.concat(d.id ? [d.id] : []), '＋ Artikel hinzufügen …') + '</select>' +
      '</section>';
  }

  /* ------------------------------------------------------------ Rendern */

  function renderForm() {
    if (!st || !st.el) return;
    const body = st.el.querySelector('#ed-body');
    st.el.querySelectorAll('[data-ed="tab"][data-tab]').forEach((b) => {
      if (b.closest('.seg')) {
        b.classList.toggle('active', b.dataset.tab === st.tab);
        b.setAttribute('aria-selected', b.dataset.tab === st.tab);
      }
    });
    const d = st.draft;
    if (st.tab === 'preview') {
      const a = M.normalizeArticle(clone(d));
      a.id = d.id || 'vorschau';
      a.updated = M.now();
      if (!d.title.trim()) a.title = '(Ohne Titel)';
      const r = PH.views.renderArticle(a, { preview: true });
      body.innerHTML = '<div class="preview-note">' + icon('eye') + '<span>Vorschau – so erscheint der Artikel nach dem Speichern. Entscheidungsbäume und Checklisten sind hier testbar.</span>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-ed="tab" data-tab="edit">' + icon('edit') + 'Weiter bearbeiten</button></div>' +
        '<div class="preview-frame"></div>';
      const frame = body.querySelector('.preview-frame');
      frame.innerHTML = r.html;
      r.after(frame);
      return;
    }
    let html = basics(d) + reviewSection(d) + bodySection(d) + overviewSection(d);
    if (d.type === 'guide') html += stepsSection(d);
    if (d.type === 'troubleshooting') html += troubleSection(d);
    if (d.type === 'decision') html += treeSection(d);
    html += afterSection(d) + sourcesSection(d) + relatedSection(d);
    html += '<div class="ed-footer">' +
      (!st.isNew ? '<button type="button" class="btn btn-danger-ghost" data-ed="delete">' + icon('trash') + 'Artikel löschen</button>' : '<span></span>') +
      '<div class="btn-row"><button type="button" class="btn btn-secondary" data-ed="cancel">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary" data-ed="save">' + icon('save') + 'Speichern</button></div></div>';
    body.innerHTML = html;
  }

  function rerender(scrollToId) {
    const y = window.scrollY;
    renderForm();
    updateHead();
    if (scrollToId) {
      const t = st.el.querySelector('#' + CSS.escape(scrollToId));
      if (t) {
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
        t.classList.add('flash');
        setTimeout(() => t.classList.remove('flash'), 1600);
        const f = t.querySelector('textarea, input');
        if (f) f.focus({ preventScroll: true });
      }
    } else window.scrollTo(0, y);
  }

  function updateHead() {
    if (!st || !st.el) return;
    const h = st.el.querySelector('#ed-title');
    if (h) h.textContent = st.draft.title.trim() || (st.isNew ? 'Neuer Artikel' : '(Ohne Titel)');
    const dirty = st.el.querySelector('#ed-dirty');
    if (dirty) dirty.hidden = !isDirty();
  }

  /* ------------------------------------------------------------ Bilder */

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
      img.src = src;
    });
  }

  /** Verkleinert Bilder (max. 1600 px) und wählt das kleinste Format (WebP, JPEG oder PNG) */
  async function processImage(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Bitte eine Bilddatei (PNG, JPG, WebP, GIF, SVG) verwenden.');
    const dataUrl = await PH.util.readFile(file, 'dataurl');
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl;
    const img = await loadImage(dataUrl);
    const MAX = 1600;
    const scale = Math.min(1, MAX / img.naturalWidth, MAX / img.naturalHeight);
    if (scale === 1 && file.size < 400 * 1024) return dataUrl;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/webp', 0.88);
    if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.88);
    const png = c.toDataURL('image/png');
    if (png.length < out.length) out = png;
    return out.length < dataUrl.length ? out : dataUrl;
  }

  /** Neues Bildobjekt: intern, Herkunft Screenshot (SVG: eigene Grafik), Aufnahmedatum heute */
  function newImage(src, file, slot) {
    const isSvg = /^data:image\/svg/i.test(src) || (file && file.type === 'image/svg+xml');
    const date = file && file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : today();
    return M.normalizeImage({
      id: slot || '', src, alt: '', caption: '', markers: [], rights: 'intern',
      origin: isSvg ? 'grafik' : 'screenshot', captured: date, pmsVersion: (st && st.draft.review.pmsVersion) || '', slot: slot || '',
    });
  }

  function listAt(prefix) {
    let list = getPath(st.draft, prefix);
    if (!Array.isArray(list)) {
      setPath(st.draft, prefix, []);
      list = getPath(st.draft, prefix);
    }
    return list;
  }

  /** Bild einfügen: target = { prefix, k (ersetzen), slot } */
  async function addImage(target, file) {
    try {
      const src = await processImage(file);
      const list = listAt(target.prefix);
      if (target.k != null && list[target.k]) {
        const old = list[target.k];
        list[target.k] = M.normalizeImage(Object.assign({}, old, { src, markers: [], id: old.slot || '', captured: today() }));
      } else {
        const existing = target.slot ? list.findIndex((x) => x.slot === target.slot) : -1;
        if (existing >= 0) {
          const ok = await PH.ui.confirm({ title: 'Bild ersetzen?', message: 'Für den Bildplatz ' + target.slot + ' gibt es schon ein Bild. Ersetzen?', okLabel: 'Ersetzen' });
          if (!ok) return;
          const old = list[existing];
          list[existing] = M.normalizeImage(Object.assign({}, old, { src, markers: [], captured: today() }));
        } else {
          const img = newImage(src, file, target.slot);
          if (target.slot) {
            const step = stepForPrefix(target.prefix);
            const sl = step && step.slots.find((x) => x.id === target.slot);
            if (sl && sl.title) img.caption = sl.title;
          }
          list.push(img);
        }
      }
      st.markerMode = null;
      rerender();
      PH.ui.toast('Bild eingefügt (' + PH.util.formatBytes(Math.round(src.length * 0.75)) + ', intern).', 'success', { timeout: 2400 });
    } catch (e) {
      PH.ui.toast(e.message, 'error');
    }
  }

  function stepForPrefix(prefix) {
    const m = /^steps\.(\d+)\.images$/.exec(prefix);
    return m ? st.draft.steps[+m[1]] : null;
  }

  /** Bild aus der Zwischenablage (iPhone/iPad: Safari fragt mit „Einsetzen“ nach) */
  async function pasteFromClipboard(target) {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find((t) => /^image\//.test(t));
        if (type) {
          const blob = await it.getType(type);
          await addImage(target, new File([blob], 'zwischenablage.' + (type.split('/')[1] || 'png'), { type }));
          return;
        }
      }
      PH.ui.toast('In der Zwischenablage befindet sich kein Bild.', 'warning');
    } catch (e) {
      PH.ui.toast('Kein Zugriff auf die Zwischenablage. Bitte das Bild über „Datei wählen …“ einfügen.', 'warning');
    }
  }

  function pickFile(target) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.addEventListener('change', () => {
      if (inp.files && inp.files[0]) addImage(target, inp.files[0]);
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
  }

  function targetFrom(el) {
    const drop = el && el.closest && el.closest('[data-drop]');
    if (drop) return { prefix: drop.dataset.drop, slot: drop.dataset.slot || '' };
    const shot = el && el.closest && el.closest('[data-ed-shot]');
    if (shot) {
      const key = shot.dataset.edShot;
      const i = key.lastIndexOf('.');
      return { prefix: key.slice(0, i), k: +key.slice(i + 1) };
    }
    const host = el && el.closest && el.closest('[data-img-prefix]');
    if (host) return { prefix: host.dataset.imgPrefix };
    return null;
  }

  // Einfügen aus der Zwischenablage (global, nur aktiv solange der Editor angezeigt wird)
  document.addEventListener('paste', (e) => {
    if (!st || !st.el || !document.body.contains(st.el) || st.tab !== 'edit') return;
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    const fileItem = items.find((it) => it.kind === 'file' && /^image\//.test(it.type));
    if (!fileItem) return;
    const target = e.target && e.target.nodeType === 1 ? e.target : document.activeElement;
    const text = e.clipboardData.getData('text/plain');
    if (text && text.trim() && target && target.matches && target.matches('input, textarea')) return; // normaler Text
    e.preventDefault();
    const tgt = targetFrom(target) || targetFrom(document.activeElement);
    if (!tgt) {
      PH.ui.toast('Bitte zuerst das Bildfeld des gewünschten Schritts anklicken und dann erneut einfügen.', 'warning');
      return;
    }
    // Einfügen in ein vorhandenes Bild ersetzt es nur, wenn es ausdrücklich angeklickt ist; sonst wird angehängt
    if (tgt.k != null && !(target.closest && target.closest('[data-ed-shot]'))) delete tgt.k;
    addImage(tgt, fileItem.getAsFile());
  });

  /* ------------------------------------------------------------ Markdown-Werkzeuge */

  function figOptions() {
    const a = M.normalizeArticle(clone(st.draft));
    const figs = M.articleFigures(a);
    const slots = [];
    (a.steps || []).forEach((s, i) => (s.slots || []).forEach((sl) => {
      if (!figs.some((f) => f.img.slot === sl.id)) slots.push({ id: sl.id, label: 'Schritt ' + (i + 1) + ' · Bildplatz (noch ohne Bild)', title: sl.title });
    }));
    return figs.map((f) => ({ id: f.img.slot || f.img.id, label: f.label, title: f.img.caption || f.img.alt }))
      .concat(slots);
  }

  async function mdAction(ta, act) {
    const v = ta.value;
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const sel = v.slice(s, e);
    const atLineStart = s === 0 || v[s - 1] === '\n';
    let ins = '';
    let from = 0;
    let to = 0;
    const wrap = (a, b, ph) => {
      const t = sel || ph;
      ins = a + t + b;
      from = s + a.length;
      to = from + t.length;
    };
    const prefix = (p, ph) => {
      const lines = (sel || ph).split('\n');
      const pre = atLineStart ? '' : '\n';
      ins = pre + lines.map((l, i) => (typeof p === 'function' ? p(i) : p) + l).join('\n');
      from = s + pre.length;
      to = s + ins.length;
    };
    const block = (head, ph) => {
      const pre = atLineStart ? '' : '\n';
      const bodyText = (sel || ph).split('\n').map((l) => '> ' + l).join('\n');
      ins = pre + head + '\n' + bodyText;
      from = s + pre.length + head.length + 3;
      to = s + ins.length;
    };
    switch (act) {
      case 'bold': wrap('**', '**', 'fett'); break;
      case 'italic': wrap('*', '*', 'kursiv'); break;
      case 'h': prefix('## ', 'Überschrift'); break;
      case 'ul': prefix('- ', 'Punkt'); break;
      case 'ol': prefix((i) => i + 1 + '. ', 'Punkt'); break;
      case 'task': prefix('- [ ] ', 'Aufgabe'); break;
      case 'hint': block('> [!HINWEIS]', 'Hinweistext'); break;
      case 'warn': block('> [!WARNUNG]', 'Warnhinweis'); break;
      case 'kbd': wrap('{{', '}}', 'Strg+C'); break;
      case 'ph': wrap('[[', ']]', 'Hier den tatsächlichen Ablauf eintragen'); break;
      case 'link': {
        const id = await PH.ui.dialog({
          title: 'Link auf Artikel einfügen',
          body: '<div class="field"><label class="field-label" for="dlg-link">Artikel</label><select class="input" id="dlg-link">' + articleOptions(st.draft.id ? [st.draft.id] : [], '– Artikel wählen –') + '</select></div>',
          buttons: [{ label: 'Abbrechen', value: null }, { label: 'Einfügen', kind: 'primary', value: (dlg) => dlg.querySelector('#dlg-link').value || null }],
        });
        if (!id) return;
        const a = PH.app.getArticle(id);
        const text = sel || (a ? a.title : id);
        ins = '[' + text + '](#/artikel/' + id + ')';
        from = s + 1;
        to = from + text.length;
        break;
      }
      case 'fig': {
        const opts = figOptions();
        if (!opts.length) {
          PH.ui.toast('Dieser Artikel hat noch keine Bilder oder Bildplätze.', 'info');
          return;
        }
        const id = await PH.ui.dialog({
          title: 'Verweis auf Abbildung einfügen',
          body: '<div class="field"><label class="field-label" for="dlg-fig">Abbildung</label><select class="input" id="dlg-fig">' +
            opts.map((o) => '<option value="' + esc(o.id) + '">' + esc(o.label + ' – ' + (o.title || o.id)) + '</option>').join('') + '</select>' +
            '<p class="field-hint">Im Text erscheint die aktuelle Nummer (z. B. „Abb. 3.1“); ein Klick öffnet das Bild.</p></div>',
          buttons: [{ label: 'Abbrechen', value: null }, { label: 'Einfügen', kind: 'primary', value: (dlg) => dlg.querySelector('#dlg-fig').value || null }],
        });
        if (!id) return;
        ins = '{{Abb:' + id + '}}';
        from = s + ins.length;
        to = from;
        break;
      }
      default: return;
    }
    ta.focus();
    ta.setRangeText(ins, s, e, 'end');
    ta.setSelectionRange(from, to);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /* ------------------------------------------------------------ Aktionen */

  function newNodeId(tree) {
    let max = 0;
    tree.nodes.forEach((n) => {
      const m = /^n(\d+)$/.exec(n.id);
      if (m) max = Math.max(max, +m[1]);
    });
    let id = 'n' + (max + 1);
    while (tree.nodes.some((n) => n.id === id)) id = 'n' + ++max;
    return id;
  }

  function addNode(kind) {
    const tree = st.draft.tree;
    const node = kind === 'question'
      ? { id: newNodeId(tree), kind: 'question', text: '', answers: [{ label: 'Ja', next: '' }, { label: 'Nein', next: '' }] }
      : { id: newNodeId(tree), kind: 'result', text: '', tone: 'info', links: [] };
    tree.nodes.push(node);
    if (!tree.start && kind === 'question') tree.start = node.id;
    return node;
  }

  function fixNode(node) {
    if (node.kind === 'question') {
      if (!Array.isArray(node.answers)) node.answers = [{ label: 'Ja', next: '' }, { label: 'Nein', next: '' }];
    } else {
      if (!node.tone) node.tone = 'info';
      if (!Array.isArray(node.links)) node.links = [];
    }
  }

  function imageAt(key) {
    const i = key.lastIndexOf('.');
    const list = getPath(st.draft, key.slice(0, i));
    return Array.isArray(list) ? list[+key.slice(i + 1)] : null;
  }

  function nextSlotId(d) {
    let max = 0;
    let prefix = 'S-' + (d.id ? d.id.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() : 'NEU');
    if (prefix.length < 5) prefix = 'S-NEU';
    d.steps.forEach((s) => (s.slots || []).forEach((sl) => {
      const m = /^(S-[A-Z]{3})-(\d+)$/.exec(sl.id);
      if (m) { prefix = m[1]; max = Math.max(max, +m[2]); }
    }));
    return prefix + '-' + String(max + 1).padStart(2, '0');
  }

  async function onClick(e) {
    const mdBtn = e.target.closest('[data-md]');
    if (mdBtn) {
      const ta = st.el.querySelector('#' + CSS.escape(mdBtn.dataset.for));
      if (ta) mdAction(ta, mdBtn.dataset.md);
      return;
    }

    // Markierung im Bild setzen
    const shot = e.target.closest('[data-ed-shot]');
    if (shot && st.markerMode === shot.dataset.edShot) {
      const img = shot.querySelector('img');
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      imageAt(st.markerMode).markers.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, label: '' });
      const key = st.markerMode;
      rerender();
      const inputs = st.el.querySelectorAll('[data-img-key="' + CSS.escape(key) + '"] .ed-markers input');
      if (inputs.length) inputs[inputs.length - 1].focus({ preventScroll: true });
      return;
    }

    const btn = e.target.closest('[data-ed]');
    if (!btn || !st.el.contains(btn)) return;
    const d = st.draft;
    const i = +btn.dataset.i;
    const act = btn.dataset.ed;

    switch (act) {
      case 'tab':
        st.tab = btn.dataset.tab;
        st.markerMode = null;
        renderForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      case 'save': return save();
      case 'cancel':
        location.hash = st.isNew ? '#/' : '#/artikel/' + encodeURIComponent(d.id);
        return;
      case 'delete':
        PH.app.deleteArticle(d.id, { fromEditor: true });
        return;
      case 'step-add':
        d.steps.push(M.newStep());
        rerender();
        {
          const items = st.el.querySelectorAll('.ed-step');
          const last = items[items.length - 1];
          if (last) { last.scrollIntoView({ behavior: 'smooth', block: 'center' }); last.querySelector('input').focus({ preventScroll: true }); }
        }
        return;
      case 'cause-add':
        d.troubleshooting.causes.push({ title: '', check: '', solution: '' });
        rerender();
        return;
      case 'source-add':
        d.sources.push({ title: '', url: '', date: '', note: '' });
        rerender();
        {
          const rows = st.el.querySelectorAll('.ed-source input');
          if (rows.length) rows[rows.length - 4].focus({ preventScroll: true });
        }
        return;
      case 'slot-add': {
        const s = d.steps[i];
        s.slots.push({ id: nextSlotId(d), need: 'optional', title: '', area: '', instruction: '', test: '' });
        rerender();
        return;
      }
      case 'move': {
        const kind = btn.dataset.kind;
        const list = kind === 'slot' ? d.steps[+btn.dataset.s].slots : { step: d.steps, cause: d.troubleshooting.causes, node: d.tree.nodes, source: d.sources }[kind];
        const j = i + +btn.dataset.dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        if (kind === 'step') st.markerMode = null;
        rerender();
        return;
      }
      case 'remove': {
        const kind = btn.dataset.kind;
        const list = kind === 'slot' ? d.steps[+btn.dataset.s].slots : { step: d.steps, cause: d.troubleshooting.causes, node: d.tree.nodes, source: d.sources }[kind];
        const item = list[i];
        const filled = (x) => !!(x && String(x).trim());
        const hasContent = kind === 'step'
          ? filled(item.title) || filled(item.text) || filled(item.hint) || item.images.length > 0 || item.slots.length > 0
          : kind === 'cause'
            ? filled(item.title) || filled(item.check) || filled(item.solution)
            : kind === 'source' ? filled(item.title) || filled(item.url)
              : kind === 'slot' ? filled(item.title) || filled(item.instruction)
                : filled(item.text);
        const names = { step: 'diesen Schritt', cause: 'diese Ursache', node: 'diesen Knoten', source: 'diese Quelle', slot: 'diesen Bildplatz' };
        if (hasContent && !(await PH.ui.confirm({ title: 'Entfernen?', message: 'Möchten Sie ' + names[kind] + ' wirklich entfernen?', okLabel: 'Entfernen', danger: true }))) return;
        list.splice(i, 1);
        if (kind === 'node') {
          d.tree.nodes.forEach((n) => (n.answers || []).forEach((a) => { if (a.next === item.id) a.next = ''; }));
          if (d.tree.start === item.id) {
            const q = d.tree.nodes.find((n) => n.kind === 'question');
            d.tree.start = q ? q.id : '';
          }
        }
        if (kind === 'step') st.markerMode = null;
        rerender();
        return;
      }
      case 'img-pick':
        pickFile({ prefix: btn.dataset.p, k: btn.dataset.k != null ? +btn.dataset.k : null, slot: btn.dataset.slot || '' });
        return;
      case 'img-clip':
        pasteFromClipboard({ prefix: btn.dataset.p, slot: btn.dataset.slot || '' });
        return;
      case 'img-remove': {
        const list = listAt(btn.dataset.p);
        const ok = await PH.ui.confirm({ title: 'Bild entfernen?', message: 'Das Bild wird aus diesem Artikel entfernt.', okLabel: 'Entfernen', danger: true });
        if (!ok) return;
        list.splice(+btn.dataset.k, 1);
        st.markerMode = null;
        rerender();
        return;
      }
      case 'img-move': {
        const list = listAt(btn.dataset.p);
        const k = +btn.dataset.k;
        const j = k + +btn.dataset.dir;
        if (j < 0 || j >= list.length) return;
        [list[k], list[j]] = [list[j], list[k]];
        st.markerMode = null;
        rerender();
        return;
      }
      case 'img-path': {
        const inp = st.el.querySelector('[data-img-path="' + CSS.escape(btn.dataset.p) + '"]');
        const src = M.safeImageSrc(inp ? inp.value : '');
        if (!src) { PH.ui.toast('Bitte einen gültigen Bildpfad eingeben.', 'warning'); return; }
        listAt(btn.dataset.p).push(newImage(src, null, ''));
        rerender();
        return;
      }
      case 'marker-mode':
        st.markerMode = st.markerMode === btn.dataset.key ? null : btn.dataset.key;
        rerender();
        return;
      case 'marker-del':
        imageAt(btn.dataset.key).markers.splice(+btn.dataset.j, 1);
        rerender();
        return;
      case 'node-add': {
        const node = addNode(btn.dataset.kind);
        rerender('ednode-' + node.id);
        return;
      }
      case 'answer-add': {
        const node = d.tree.nodes[+btn.dataset.k];
        node.answers.push({ label: '', next: '' });
        rerender();
        const inputs = st.el.querySelectorAll('#ednode-' + CSS.escape(node.id) + ' .ed-answer input');
        if (inputs.length) inputs[inputs.length - 1].focus();
        return;
      }
      case 'answer-del':
        d.tree.nodes[+btn.dataset.k].answers.splice(+btn.dataset.m, 1);
        rerender();
        return;
      case 'goto-node': {
        const t = st.el.querySelector('#ednode-' + CSS.escape(btn.dataset.id));
        if (t) {
          t.scrollIntoView({ behavior: 'smooth', block: 'center' });
          t.classList.add('flash');
          setTimeout(() => t.classList.remove('flash'), 1600);
        }
        return;
      }
      case 'link-del': {
        const node = d.tree.nodes[+btn.dataset.k];
        node.links = node.links.filter((x) => x !== btn.dataset.id);
        rerender();
        return;
      }
      case 'related-del':
        d.related = d.related.filter((x) => x !== btn.dataset.id);
        rerender();
        return;
      default:
    }
  }

  /** Rechte eines Bildes ändern – eigene protel-Screenshots dürfen nie öffentlich sein */
  async function changeRights(t, path, value) {
    const img = getPath(st.draft, path.replace(/\.rights$/, ''));
    if (value !== 'oeffentlich') {
      img.rights = 'intern';
      rerender();
      return;
    }
    const origin = M.ORIGINS[img.origin] || M.ORIGINS[''];
    if (origin.publicOk === false) {
      t.value = 'intern';
      await PH.ui.dialog({
        title: 'Nicht möglich',
        body: '<p>Eigene <strong>protel- oder Drittsystem-Screenshots</strong> bleiben intern, solange die Nutzungsrechte nicht geklärt sind. Öffentlich dürfen nur eigene Grafiken, Platzhalter und Screenshots dieser App sein.</p>',
      });
      return;
    }
    if (origin.publicOk !== true) {
      const ok = await PH.ui.confirm({
        title: 'Als öffentlich kennzeichnen?',
        html: 'Die Herkunft ist „' + esc(origin.label) + '“. Nur kennzeichnen, wenn die Veröffentlichung rechtlich geklärt ist – keine Personen, keine Gäste-, Karten- oder Systemdaten.',
        okLabel: 'Öffentlich kennzeichnen',
      });
      if (!ok) { t.value = 'intern'; return; }
    }
    img.rights = 'oeffentlich';
    rerender();
  }

  async function changeOrigin(path, value) {
    const img = getPath(st.draft, path.replace(/\.origin$/, ''));
    img.origin = value;
    if (img.rights === 'oeffentlich' && (M.ORIGINS[value] || {}).publicOk !== true) {
      img.rights = 'intern';
      PH.ui.toast('Rechte auf „intern“ zurückgesetzt – diese Herkunft ist nicht ohne Weiteres veröffentlichbar.', 'warning', { timeout: 5000 });
    }
    rerender();
  }

  async function changeVisibility(t, value) {
    if (value === 'oeffentlich') {
      const ok = await PH.ui.confirm({
        title: 'Artikel als öffentlich kennzeichnen?',
        html: 'Öffentliche Artikel können in die öffentliche Website exportiert werden. Interne Abläufe, Hausregeln und Screenshots gehören nicht dorthin. ' +
          'Interne Bilder und Bildplätze werden beim öffentlichen Export trotzdem entfernt.',
        okLabel: 'Öffentlich kennzeichnen',
      });
      if (!ok) { t.value = 'intern'; return; }
    }
    st.draft.visibility = value === 'oeffentlich' ? 'oeffentlich' : 'intern';
    rerender();
  }

  function onInput(e) {
    const t = e.target;
    if (e.type === 'change' && t.matches('[data-ed-next]')) {
      const node = st.draft.tree.nodes[+t.dataset.k];
      const ans = node.answers[+t.dataset.m];
      if (t.value === '__new_q' || t.value === '__new_r') {
        const nn = addNode(t.value === '__new_q' ? 'question' : 'result');
        ans.next = nn.id;
        rerender('ednode-' + nn.id);
      } else {
        ans.next = t.value;
        rerender();
      }
      return;
    }
    if (e.type === 'change' && t.matches('[data-ed-linkadd]')) {
      if (!t.value) return;
      const node = st.draft.tree.nodes[+t.dataset.k];
      if (!node.links.includes(t.value)) node.links.push(t.value);
      rerender();
      return;
    }
    if (e.type === 'change' && t.matches('[data-ed-related-add]')) {
      if (!t.value) return;
      if (!st.draft.related.includes(t.value)) st.draft.related.push(t.value);
      rerender();
      return;
    }
    const path = t.dataset.path;
    if (!path) return;
    if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return; // wird über change verarbeitet
    if (e.type === 'change' && t.hasAttribute('data-rights')) { changeRights(t, path, t.value); return; }
    if (e.type === 'change' && t.hasAttribute('data-origin')) { changeOrigin(path, t.value); return; }
    if (e.type === 'change' && path === 'visibility') { changeVisibility(t, t.value); return; }
    let v;
    switch (t.dataset.kind) {
      case 'bool': v = t.checked; break;
      case 'list': v = t.value.split(',').map((x) => x.trim()).filter(Boolean); break;
      case 'lines': v = t.value.split('\n').map((x) => x.trim()).filter(Boolean); break;
      default: v = t.value;
    }
    setPath(st.draft, path, v);
    if (path === 'type') seedForType(st.draft);
    const nodeKind = /^tree\.nodes\.(\d+)\.kind$/.exec(path);
    if (nodeKind) fixNode(st.draft.tree.nodes[+nodeKind[1]]);
    // Bild einem Bildplatz zuordnen: ID des Bildes folgt dem Bildplatz (für Verweise im Text)
    const slotSel = /^(.*\.images\.\d+)\.slot$/.exec(path);
    if (slotSel && v) getPath(st.draft, slotSel[1]).id = v;
    if (e.type === 'change' && (t.hasAttribute('data-rerender') || t.hasAttribute('data-rerender-blur'))) rerender();
    else {
      updateHead();
      if (path.startsWith('tree.')) refreshTreeHints();
    }
  }

  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
      return;
    }
    const t = e.target;
    if (t.matches && t.matches('[data-md-field]') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'b' || k === 'i') {
        e.preventDefault();
        mdAction(t, k === 'b' ? 'bold' : 'italic');
      }
    }
    // Dropzone: Enter/Leertaste öffnet Dateiauswahl
    if (t.matches && t.matches('.dropzone') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      pickFile({ prefix: t.dataset.drop, slot: t.dataset.slot || '' });
    }
  }

  function onDrag(e) {
    const zone = e.target.closest && e.target.closest('[data-drop], [data-ed-shot]');
    if (!zone) return;
    if (e.type === 'dragover' || e.type === 'dragenter') {
      e.preventDefault();
      zone.classList.add('dragover');
    } else if (e.type === 'dragleave') {
      zone.classList.remove('dragover');
    } else if (e.type === 'drop') {
      e.preventDefault();
      zone.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      const tgt = targetFrom(zone);
      if (f && tgt) addImage(tgt, f);
    }
  }

  /* ------------------------------------------------------------ Speichern */

  async function save() {
    const d = st.draft;
    if (!d.title.trim()) {
      st.tab = 'edit';
      renderForm();
      PH.ui.toast('Bitte einen Titel eingeben.', 'warning');
      const f = st.el.querySelector('#' + fid('title'));
      if (f) { f.focus(); f.classList.add('invalid'); }
      return;
    }
    const kb = PH.app.kb;
    const a = M.normalizeArticle(clone(d));
    if (a.steps) a.steps = a.steps.filter((s) => s.title.trim() || s.text.trim() || s.images.length || s.slots.length || s.hint.trim());
    if (a.troubleshooting) a.troubleshooting.causes = a.troubleshooting.causes.filter((c) => c.title.trim() || c.check.trim() || c.solution.trim());
    const ts = M.now();
    a.updated = ts;
    if (st.isNew) {
      a.id = M.uniqueArticleId(kb, a.title);
      a.created = ts;
    }
    a.related = a.related.filter((id) => id !== a.id && kb.articles.some((x) => x.id === id));
    const articles = st.isNew ? kb.articles.concat(a) : kb.articles.map((x) => (x.id === a.id ? a : x));
    const ok = await PH.app.commit(Object.assign({}, kb, { articles }));
    st.original = JSON.stringify(st.draft);
    PH.app.setLeaveGuard(null);
    if (ok !== false) PH.ui.toast('„' + a.title + '“ gespeichert.', 'success');
    location.hash = '#/artikel/' + encodeURIComponent(a.id);
  }

  /* ------------------------------------------------------------ Ansicht */

  function view(params) {
    let draft;
    let isNew = false;
    if (params.id) {
      const a = PH.app.getArticle(params.id);
      if (!a) return PH.views.notFound('Artikel nicht gefunden', 'Der Artikel kann nicht bearbeitet werden, da er nicht existiert.');
      draft = clone(a);
    } else {
      draft = M.newArticle(params.type, params.categoryId);
      isNew = true;
    }
    ensureSections(draft);
    seedForType(draft);
    st = { draft, isNew, original: JSON.stringify(draft), tab: 'edit', markerMode: null, el: null };
    PH.app.setLeaveGuard(isDirty);
    const t = T[draft.type];
    const html =
      '<div class="editor">' +
      '<div class="editor-head">' +
      '<div class="editor-title"><p class="kicker">' + icon(isNew ? 'plus' : 'edit') + (isNew ? 'Neuer Artikel' : 'Artikel bearbeiten') + ' · ' + esc(t.label) +
      '<span id="ed-dirty" class="dirty-dot" hidden>Ungespeicherte Änderungen</span></p>' +
      '<h1 id="ed-title">' + esc(draft.title || (isNew ? 'Neuer Artikel' : '(Ohne Titel)')) + '</h1></div>' +
      '<div class="editor-actions">' +
      '<div class="seg" role="tablist" aria-label="Ansicht">' +
      '<button type="button" role="tab" class="active" data-ed="tab" data-tab="edit" aria-selected="true">' + icon('edit') + 'Bearbeiten</button>' +
      '<button type="button" role="tab" data-ed="tab" data-tab="preview" aria-selected="false">' + icon('eye') + 'Vorschau</button></div>' +
      '<button type="button" class="btn btn-secondary" data-ed="cancel">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary" data-ed="save" title="Speichern (Strg+S)">' + icon('save') + 'Speichern</button>' +
      '</div></div>' +
      '<div id="ed-body"></div></div>';
    return {
      title: isNew ? 'Neuer Artikel' : 'Bearbeiten: ' + draft.title,
      html,
      after(el) {
        st.el = el;
        el.addEventListener('click', onClick);
        el.addEventListener('input', onInput);
        el.addEventListener('change', onInput);
        el.addEventListener('keydown', onKey);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) => el.addEventListener(ev, onDrag));
        renderForm();
        const title = el.querySelector('#' + fid('title'));
        if (title && isNew) title.focus();
        const n = +params.step;
        if (n > 0) {
          const target = el.querySelector('#ed-step-' + n);
          if (target) {
            setTimeout(() => {
              target.scrollIntoView({ block: 'start' });
              target.classList.add('flash');
              setTimeout(() => target.classList.remove('flash'), 1600);
            }, 30);
          }
        }
      },
    };
  }

  PH.editor = { view, isDirty, _processImage: processImage, _state: () => st };
})();
