/* Protel Hilfe – Artikel-Editor (Grunddaten, Markdown, Schritte mit Screenshots, Fehlerbehebung, Entscheidungsbaum) */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc, clone, setPath, getPath, truncate } = PH.util;
  const icon = PH.icon;
  const T = PH.model.TYPES;
  const kbdHint = (s) => PH.md.inline(s);

  let st = null; // { draft, isNew, original, tab, markerMode, el }

  function ensureSections(d) {
    if (!Array.isArray(d.steps)) d.steps = [];
    if (!d.troubleshooting) d.troubleshooting = { messages: [], symptoms: '', causes: [], escalation: '' };
    if (!d.tree) d.tree = { start: '', nodes: [] };
    return d;
  }

  function seedForType(d) {
    if (d.type === 'guide' && !d.steps.length) d.steps.push({ title: '', text: '', hint: '', image: null });
    if (d.type === 'troubleshooting' && !d.troubleshooting.causes.length) d.troubleshooting.causes.push({ title: '', check: '', solution: '' });
    if (d.type === 'decision' && !d.tree.nodes.length) {
      d.tree = PH.model.newArticle('decision').tree;
    }
  }

  const isDirty = () => !!st && JSON.stringify(st.draft) !== st.original;

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

  function itemTools(kind, i, n) {
    return '<div class="item-tools">' +
      '<button type="button" class="icon-btn btn-xs" data-ed="move" data-kind="' + kind + '" data-i="' + i + '" data-dir="-1" title="Nach oben"' + (i === 0 ? ' disabled' : '') + '>' + icon('arrowUp') + '</button>' +
      '<button type="button" class="icon-btn btn-xs" data-ed="move" data-kind="' + kind + '" data-i="' + i + '" data-dir="1" title="Nach unten"' + (i >= n - 1 ? ' disabled' : '') + '>' + icon('arrowDown') + '</button>' +
      '<button type="button" class="icon-btn btn-xs danger" data-ed="remove" data-kind="' + kind + '" data-i="' + i + '" title="Entfernen">' + icon('trash') + '</button>' +
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
      field('Typ', select('type', d.type, PH.model.TYPE_ORDER.map((t) => [t, T[t].label + ' – ' + T[t].desc]), 'data-rerender'), '', { for: fid('type') }) +
      field('Kategorie', select('categoryId', d.categoryId, cats), '', { for: fid('categoryId') }) +
      field('Kurzbeschreibung', textarea('summary', d.summary, 2, 'placeholder="Ein bis zwei Sätze: Worum geht es, wann brauche ich das?"'),
        'Erscheint in Listen und Suchergebnissen sowie als Einleitung des Artikels.', { cls: 'span-2', for: fid('summary') }) +
      field('Schlagwörter', input('tags', d.tags.join(', '), 'data-kind="list" placeholder="z. B. Check-in, Anreise"'),
        'Durch Komma getrennt. Werden angezeigt und bei der Suche stark gewichtet.', { for: fid('tags') }) +
      field('Zusätzliche Suchbegriffe', input('keywords', d.keywords.join(', '), 'data-kind="list" placeholder="z. B. einchecken, ankommen"'),
        'Unsichtbar – nur für die Suche, z. B. umgangssprachliche Begriffe.', { for: fid('keywords') }) +
      field('Verantwortlich / Autor', input('author', d.author, 'placeholder="z. B. Front-Office-Leitung"'), '', { for: fid('author') }) +
      '<div class="field"><span class="field-label">Kennzeichnung</span><label class="check"><input type="checkbox" data-path="example" data-kind="bool"' + (d.example ? ' checked' : '') + '> Als <strong>Beispielinhalt</strong> markieren</label>' +
      '<p class="field-hint">Beispielartikel werden deutlich gekennzeichnet. Haken entfernen, sobald der Inhalt intern geprüft ist.</p></div>' +
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

  function imageEditor(img, i) {
    if (img) {
      const on = st.markerMode === i;
      const size = img.src.startsWith('data:') ? PH.util.formatBytes(Math.round(img.src.length * 0.75)) : 'verlinkt: ' + img.src;
      return '<div class="ed-shot">' +
        '<div class="shot-frame' + (on ? ' marker-mode' : '') + '" data-ed-shot="' + i + '" data-src-label="' + esc(truncate(img.src.startsWith('data:') ? 'eingebettetes Bild' : img.src, 80)) + '">' +
        '<img src="' + esc(img.src) + '" alt="' + esc(img.alt) + '">' +
        img.markers.map((m, j) => '<span class="marker" style="left:' + m.x + '%;top:' + m.y + '%">' + (j + 1) + '</span>').join('') +
        '</div>' +
        '<div class="ed-shot-side">' +
        '<div class="btn-row">' +
        '<button type="button" class="btn btn-sm ' + (on ? 'btn-primary' : 'btn-secondary') + '" data-ed="marker-mode" data-i="' + i + '" aria-pressed="' + on + '">' + icon('target') + (on ? 'Markieren beenden' : 'Markierungen setzen') + '</button>' +
        '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-pick" data-i="' + i + '">' + icon('upload') + 'Ersetzen</button>' +
        '<button type="button" class="btn btn-sm btn-danger-ghost" data-ed="img-remove" data-i="' + i + '">' + icon('trash') + 'Entfernen</button>' +
        '</div>' +
        (on ? '<p class="field-hint strong">' + icon('target') + 'Klicken Sie im Bild auf die Stelle, die nummeriert markiert werden soll.</p>' : '') +
        field('Bildbeschreibung', input('steps.' + i + '.image.alt', img.alt, 'placeholder="z. B. Suchmaske für Reservierungen"'), '', { for: fid('steps.' + i + '.image.alt') }) +
        (img.markers.length
          ? '<ol class="ed-markers">' + img.markers.map((m, j) =>
            '<li><span class="marker-dot">' + (j + 1) + '</span>' +
            '<input class="input input-sm" data-path="steps.' + i + '.image.markers.' + j + '.label" value="' + esc(m.label) + '" placeholder="Beschriftung (optional)" aria-label="Beschriftung Markierung ' + (j + 1) + '">' +
            '<button type="button" class="icon-btn btn-xs danger" data-ed="marker-del" data-i="' + i + '" data-j="' + j + '" title="Markierung entfernen">' + icon('x') + '</button></li>'
          ).join('') + '</ol>'
          : '') +
        '<p class="muted small">' + icon('image') + esc(size) + '</p>' +
        '</div></div>';
    }
    return '<div class="dropzone" tabindex="0" data-drop="' + i + '" aria-label="Screenshot für Schritt ' + (i + 1) + ' einfügen">' +
      icon('image') +
      '<div class="dropzone-text"><strong>Screenshot einfügen</strong>' +
      '<span>Hier klicken und ' + kbdHint('{{Strg+V}}') + ' drücken oder Bilddatei hierher ziehen</span></div>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-pick" data-i="' + i + '">' + icon('upload') + 'Datei wählen …</button>' +
      '</div>' +
      '<details class="ed-more"><summary>Oder Bild aus dem App-Ordner verlinken</summary>' +
      '<div class="input-row"><input class="input input-sm" data-img-path="' + i + '" placeholder="z. B. bilder/check-in-1.png" aria-label="Bildpfad">' +
      '<button type="button" class="btn btn-sm btn-secondary" data-ed="img-path" data-i="' + i + '">Übernehmen</button></div>' +
      '<p class="field-hint">Pfad relativ zur Datei index.html. Das Bild muss zusammen mit der App verteilt werden.</p></details>';
  }

  function stepsSection(d) {
    return '<section class="ed-section card">' +
      '<div class="ed-section-head"><h2 class="ed-section-title">' + icon('guide') + 'Schritte</h2><span class="muted">' + d.steps.length + ' Schritt' + (d.steps.length === 1 ? '' : 'e') + '</span></div>' +
      '<p class="field-hint">' + icon('image') + 'Screenshot: mit ' + kbdHint('{{Win+Umschalt+S}}') + ' einen Bildschirmausschnitt kopieren, das Bildfeld des Schritts anklicken und ' + kbdHint('{{Strg+V}}') + ' drücken.</p>' +
      '<div class="ed-list">' + d.steps.map((s, i) =>
        '<div class="ed-item ed-step" data-step-index="' + i + '">' +
        '<div class="ed-item-head"><span class="step-num">' + (i + 1) + '</span>' +
        '<input class="input input-strong" data-path="steps.' + i + '.title" value="' + esc(s.title) + '" placeholder="Titel des Schritts, z. B. „Reservierung aufrufen“" aria-label="Titel von Schritt ' + (i + 1) + '">' +
        itemTools('step', i, d.steps.length) + '</div>' +
        mdArea('steps.' + i + '.text', s.text, 3, 'Was ist in diesem Schritt zu tun?') +
        imageEditor(s.image, i) +
        '<details class="ed-more"' + (s.hint ? ' open' : '') + '><summary>Tipp / Hinweis zu diesem Schritt</summary>' +
        mdArea('steps.' + i + '.hint', s.hint, 2, 'Optional: Tipp, typische Fehler, Sonderfälle', { tools: ['bold', 'italic', 'kbd', 'ph'] }) + '</details>' +
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
        esc(PH.model.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), 50) || '(ohne Text)')) + '</option>');
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
    if (box) box.innerHTML = treeWarnHtml(PH.model.validateTree(tree));
    tree.nodes.forEach((n) => {
      const label = PH.model.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), n.kind === 'question' ? 60 : 50) || '(ohne Text)');
      st.el.querySelectorAll('select[data-ed-next] option[value="' + CSS.escape(n.id) + '"], select[data-path="tree.start"] option[value="' + CSS.escape(n.id) + '"]')
        .forEach((o) => { o.textContent = label; });
    });
  }, 250);

  function treeSection(d) {
    const tree = d.tree;
    const warns = PH.model.validateTree(tree);
    const startOpts = tree.nodes.filter((n) => n.kind === 'question').map((n) => [n.id, PH.model.nodeLabel(tree, n) + ': ' + (truncate(PH.md.toPlain(n.text), 60) || '(ohne Text)')]);
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
          '<span class="node-badge kind-' + n.kind + '">' + icon(isQ ? 'help' : 'flag') + esc(PH.model.nodeLabel(tree, n)) + '</span>' +
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
              field('Art des Ergebnisses', select('tree.nodes.' + k + '.tone', n.tone, Object.keys(PH.model.TONES).map((t) => [t, PH.model.TONES[t].label])), '', { for: fid('tree.nodes.' + k + '.tone') }) +
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
      const a = PH.model.normalizeArticle(clone(d));
      a.id = d.id || 'vorschau';
      a.updated = PH.model.now();
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
    let html = basics(d) + bodySection(d);
    if (d.type === 'guide') html += stepsSection(d);
    if (d.type === 'troubleshooting') html += troubleSection(d);
    if (d.type === 'decision') html += treeSection(d);
    html += relatedSection(d);
    html += '<div class="ed-footer">' +
      (!st.isNew ? '<button type="button" class="btn btn-danger-ghost" data-ed="delete">' + icon('trash') + 'Artikel löschen</button>' : '<span></span>') +
      '<div class="btn-row"><button type="button" class="btn btn-secondary" data-ed="cancel">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary" data-ed="save">' + icon('save') + 'Speichern</button></div></div>';
    body.innerHTML = html;
  }

  function rerender(scrollToId) {
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
    }
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

  async function processImage(file) {
    if (!file || !/^image\//.test(file.type)) throw new Error('Bitte eine Bilddatei (PNG, JPG, WebP, GIF) verwenden.');
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

  async function setStepImage(i, file) {
    try {
      const src = await processImage(file);
      const step = st.draft.steps[i];
      if (!step) return;
      const old = step.image;
      step.image = { src, alt: old ? old.alt : '', markers: [] };
      st.markerMode = -1;
      rerender();
      PH.ui.toast('Bild eingefügt (' + PH.util.formatBytes(Math.round(src.length * 0.75)) + ').', 'success', { timeout: 2200 });
    } catch (e) {
      PH.ui.toast(e.message, 'error');
    }
  }

  function pickFile(i) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.style.display = 'none';
    inp.addEventListener('change', () => {
      if (inp.files && inp.files[0]) setStepImage(i, inp.files[0]);
      inp.remove();
    });
    document.body.appendChild(inp);
    inp.click();
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
    if (st.draft.type !== 'guide') {
      PH.ui.toast('Screenshots können in die Schritte einer Anleitung eingefügt werden.', 'info');
      return;
    }
    const stepEl = (target && target.closest && target.closest('[data-step-index]')) ||
      (document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-step-index]'));
    if (!stepEl) {
      PH.ui.toast('Bitte zuerst das Bildfeld des gewünschten Schritts anklicken und dann erneut einfügen.', 'warning');
      return;
    }
    setStepImage(+stepEl.dataset.stepIndex, fileItem.getAsFile());
  });

  /* ------------------------------------------------------------ Markdown-Werkzeuge */

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

  async function onClick(e) {
    const mdBtn = e.target.closest('[data-md]');
    if (mdBtn) {
      const ta = st.el.querySelector('#' + CSS.escape(mdBtn.dataset.for));
      if (ta) mdAction(ta, mdBtn.dataset.md);
      return;
    }

    // Markierung im Bild setzen
    const shot = e.target.closest('[data-ed-shot]');
    if (shot && st.markerMode === +shot.dataset.edShot) {
      const i = +shot.dataset.edShot;
      const img = shot.querySelector('img');
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
      st.draft.steps[i].image.markers.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, label: '' });
      rerender();
      const inputs = st.el.querySelectorAll('[data-step-index="' + i + '"] .ed-markers input');
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
        st.markerMode = -1;
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
        d.steps.push({ title: '', text: '', hint: '', image: null });
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
      case 'move': {
        const list = { step: d.steps, cause: d.troubleshooting.causes, node: d.tree.nodes }[btn.dataset.kind];
        const j = i + +btn.dataset.dir;
        if (j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        if (btn.dataset.kind === 'step') st.markerMode = -1;
        rerender();
        return;
      }
      case 'remove': {
        const kind = btn.dataset.kind;
        const list = { step: d.steps, cause: d.troubleshooting.causes, node: d.tree.nodes }[kind];
        const item = list[i];
        const filled = (x) => !!(x && String(x).trim());
        const hasContent = kind === 'step'
          ? filled(item.title) || filled(item.text) || filled(item.hint) || !!item.image
          : kind === 'cause'
            ? filled(item.title) || filled(item.check) || filled(item.solution)
            : filled(item.text);
        const names = { step: 'diesen Schritt', cause: 'diese Ursache', node: 'diesen Knoten' };
        if (hasContent && !(await PH.ui.confirm({ title: 'Entfernen?', message: 'Möchten Sie ' + names[kind] + ' wirklich entfernen?', okLabel: 'Entfernen', danger: true }))) return;
        list.splice(i, 1);
        if (kind === 'node') {
          d.tree.nodes.forEach((n) => (n.answers || []).forEach((a) => { if (a.next === item.id) a.next = ''; }));
          if (d.tree.start === item.id) {
            const q = d.tree.nodes.find((n) => n.kind === 'question');
            d.tree.start = q ? q.id : '';
          }
        }
        if (kind === 'step') st.markerMode = -1;
        rerender();
        return;
      }
      case 'img-pick': pickFile(i); return;
      case 'img-remove':
        d.steps[i].image = null;
        st.markerMode = -1;
        rerender();
        return;
      case 'img-path': {
        const inp = st.el.querySelector('[data-img-path="' + i + '"]');
        const src = PH.model.safeImageSrc(inp ? inp.value : '');
        if (!src) { PH.ui.toast('Bitte einen gültigen Bildpfad eingeben.', 'warning'); return; }
        d.steps[i].image = { src, alt: '', markers: [] };
        rerender();
        return;
      }
      case 'marker-mode':
        st.markerMode = st.markerMode === i ? -1 : i;
        rerender();
        return;
      case 'marker-del':
        d.steps[i].image.markers.splice(+btn.dataset.j, 1);
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
    let v;
    switch (t.dataset.kind) {
      case 'bool': v = t.checked; break;
      case 'list': v = t.value.split(',').map((x) => x.trim()).filter(Boolean); break;
      case 'lines': v = t.value.split('\n').map((x) => x.trim()).filter(Boolean); break;
      default: v = t.value;
    }
    if (e.type === 'input' && (t.tagName === 'SELECT' || t.type === 'checkbox')) return; // wird über change verarbeitet
    setPath(st.draft, path, v);
    if (path === 'type') seedForType(st.draft);
    const nodeKind = /^tree\.nodes\.(\d+)\.kind$/.exec(path);
    if (nodeKind) fixNode(st.draft.tree.nodes[+nodeKind[1]]);
    if (e.type === 'change' && t.hasAttribute('data-rerender')) rerender();
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
      pickFile(+t.dataset.drop);
    }
  }

  function onDrag(e) {
    const zone = e.target.closest && e.target.closest('[data-drop], [data-ed-shot]');
    if (!zone) return;
    const i = zone.dataset.drop != null ? +zone.dataset.drop : +zone.dataset.edShot;
    if (e.type === 'dragover' || e.type === 'dragenter') {
      e.preventDefault();
      zone.classList.add('dragover');
    } else if (e.type === 'dragleave') {
      zone.classList.remove('dragover');
    } else if (e.type === 'drop') {
      e.preventDefault();
      zone.classList.remove('dragover');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setStepImage(i, f);
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
    const a = PH.model.normalizeArticle(clone(d));
    if (a.steps) a.steps = a.steps.filter((s) => s.title.trim() || s.text.trim() || s.image || s.hint.trim());
    if (a.troubleshooting) a.troubleshooting.causes = a.troubleshooting.causes.filter((c) => c.title.trim() || c.check.trim() || c.solution.trim());
    const ts = PH.model.now();
    a.updated = ts;
    if (st.isNew) {
      a.id = PH.model.uniqueArticleId(kb, a.title);
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
      draft = PH.model.newArticle(params.type, params.categoryId);
      isNew = true;
    }
    ensureSections(draft);
    seedForType(draft);
    st = { draft, isNew, original: JSON.stringify(draft), tab: 'edit', markerMode: -1, el: null };
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
      },
    };
  }

  PH.editor = { view, isDirty, _processImage: processImage, _state: () => st };
})();
