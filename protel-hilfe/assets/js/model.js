/* Protel Hilfe – Datenmodell, Validierung, Import/Export, Zusammenführen
 *
 * Datenformat 2 (seit 11/2026):
 *  - mehrere Bilder je Schritt (steps[].images) und Übersichtsbilder je Artikel (images)
 *  - Rechtekennzeichnung je Bild (rights: intern | oeffentlich – fehlt sie, gilt „intern“)
 *  - geplante Bildplätze (steps[].slots), Prüfstatus (review), Quellen (sources), Text nach den Schritten (after)
 *  - Sichtbarkeit je Artikel (visibility: intern | oeffentlich – fehlt sie, gilt „intern“)
 *  - unbekannte Felder aus neueren Versionen bleiben beim Import erhalten
 * Dateien im Format 1 (bis 11/2026) werden weiterhin gelesen und beim Import umgewandelt.
 */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { uid, slugify } = PH.util;

  const FORMAT_V1 = 'protel-hilfe';
  const FORMAT = 'protel-hilfe-2';
  const SCHEMA = 2;
  const GLOBAL_VAR = 'PROTEL_HILFE_DATEN';

  const TYPES = {
    guide: { label: 'Anleitung', plural: 'Anleitungen', icon: 'guide', desc: 'Schritt-für-Schritt-Ablauf mit Screenshots' },
    troubleshooting: { label: 'Fehlerbehebung', plural: 'Fehlerbehebungen', icon: 'wrench', desc: 'Fehlermeldungen, Ursachen und Lösungen' },
    decision: { label: 'Entscheidungsbaum', plural: 'Entscheidungsbäume', icon: 'tree', desc: 'Geführte Fragen bis zur passenden Lösung' },
    info: { label: 'Information', plural: 'Informationen', icon: 'info', desc: 'Nachschlagewissen, Listen, Checklisten' },
  };
  const TYPE_ORDER = ['guide', 'troubleshooting', 'decision', 'info'];

  const COLORS = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'violet', 'pink', 'slate'];
  const COLOR_LABELS = {
    blue: 'Blau', teal: 'Petrol', green: 'Grün', amber: 'Gelb', orange: 'Orange', red: 'Rot', violet: 'Violett', pink: 'Pink', slate: 'Grau',
  };
  const CAT_ICONS = [
    'logIn', 'logOut', 'calendar', 'card', 'euro', 'users', 'monitor', 'moon', 'phone', 'key', 'coffee', 'bed',
    'book', 'shield', 'mail', 'wifi', 'flag', 'folder', 'luggage', 'printer', 'help', 'bell', 'grid', 'pin',
  ];
  const TONES = {
    success: { label: 'Erledigt / Lösung', icon: 'checkCircle' },
    info: { label: 'Information', icon: 'infoCircle' },
    warning: { label: 'Achtung', icon: 'alert' },
    danger: { label: 'Eskalation', icon: 'flag' },
  };

  /** Art des Hinweises an einem Schritt */
  const HINT_TYPES = {
    tipp: { label: 'Tipp', cls: 'tip', icon: 'sparkle' },
    hinweis: { label: 'Hinweis', cls: 'info', icon: 'infoCircle' },
    warnung: { label: 'Warnung', cls: 'warning', icon: 'alert' },
    wichtig: { label: 'Wichtig', cls: 'danger', icon: 'alert' },
  };

  /** Prüfstatus eines Artikels */
  const REVIEW_STATUS = {
    '': { label: 'ohne Prüfstatus', short: '', tone: '' },
    entwurf: { label: 'Entwurf – noch nicht im System geprüft', short: 'Entwurf', tone: 'warning' },
    pruefung: { label: 'In Prüfung', short: 'In Prüfung', tone: 'info' },
    geprueft: { label: 'Geprüft', short: 'Geprüft', tone: 'success' },
    veraltet: { label: 'Veraltet – bitte erneut prüfen', short: 'Veraltet', tone: 'danger' },
  };

  /** Rechteklasse je Bild. Fehlt sie, gilt das Bild als intern. */
  const RIGHTS = {
    intern: { label: 'intern', desc: 'Nur intern verwenden, nicht veröffentlichen' },
    oeffentlich: { label: 'öffentlich', desc: 'Darf veröffentlicht werden (Rechte geklärt)' },
  };

  /** Herkunft eines Bildes; publicOk: darf überhaupt als öffentlich gekennzeichnet werden */
  const ORIGINS = {
    '': { label: 'nicht angegeben', publicOk: 'confirm' },
    screenshot: { label: 'Eigener Screenshot (protel oder Drittsystem)', publicOk: false },
    app: { label: 'Screenshot dieser App', publicOk: true },
    grafik: { label: 'Eigene Grafik', publicOk: true },
    foto: { label: 'Eigenes Foto', publicOk: 'confirm' },
    platzhalter: { label: 'Platzhalter', publicOk: true },
  };

  const IMAGE_STATUS = {
    '': { label: 'aufgenommen' },
    geprueft: { label: 'geprüft' },
    veraltet: { label: 'veraltet' },
  };

  /** Bedarf eines geplanten Bildplatzes */
  const SLOT_NEED = {
    pflicht: { label: 'Pflicht' },
    bedingt: { label: 'Pflicht, falls zutreffend' },
    freigabe: { label: 'nur mit Freigabe' },
    optional: { label: 'optional' },
  };

  const VISIBILITY = {
    intern: { label: 'intern', desc: 'Nur intern (Standard) – wird nicht veröffentlicht' },
    oeffentlich: { label: 'öffentlich', desc: 'Darf in der öffentlichen Version erscheinen' },
  };

  const PACKAGES = { '': 'unbekannt', beispiel: 'Beispieldaten', intern: 'interner Inhaltsstand', oeffentlich: 'öffentlicher Stand' };

  const str = (v) => (v == null ? '' : String(v));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const arrStr = (v) =>
    Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const iso = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  };
  /** Datum ohne Uhrzeit (JJJJ-MM-TT) oder '' */
  const day = (v) => {
    const s = str(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
    if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    const d = new Date(s);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const now = () => new Date().toISOString();
  const pick = (map, v, dflt) => (Object.prototype.hasOwnProperty.call(map, v) ? v : dflt);

  /** Unbekannte Felder (z. B. aus neueren App-Versionen) unverändert übernehmen */
  function extras(src, known) {
    const out = {};
    if (!isObj(src)) return out;
    Object.keys(src).forEach((k) => {
      if (known.has(k) || k.startsWith('_')) return;
      const v = src[k];
      if (v === undefined || typeof v === 'function') return;
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch (e) { /* nicht serialisierbar – weglassen */ }
    });
    return out;
  }

  function newRevision() {
    return 'rev-' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z') + '-' + Math.random().toString(36).slice(2, 6);
  }

  function safeImageSrc(src) {
    const s = str(src).trim();
    if (!s) return '';
    if (/^data:/i.test(s)) return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml)[;,]/i.test(s) ? s : '';
    if (/^(javascript|vbscript):/i.test(s)) return '';
    return s;
  }

  /** Stabile Bild-ID aus dem Inhalt (für Verweise im Text) */
  function imageIdFor(src, alt) {
    const s = str(src);
    return 'abb-' + PH.util.hashStr(s.length > 4000 ? s.slice(0, 2000) + s.slice(-2000) + s.length : s + '|' + str(alt));
  }

  const IMAGE_KEYS = new Set(['id', 'src', 'alt', 'caption', 'markers', 'rights', 'origin', 'captured', 'pmsVersion', 'capturedBy', 'slot', 'status']);
  const MARKER_KEYS = new Set(['x', 'y', 'label']);

  function normalizeImage(img) {
    if (!isObj(img)) return null;
    const src = safeImageSrc(img.src);
    if (!src) return null;
    const clamp = (n) => Math.max(0, Math.min(100, Math.round((Number(n) || 0) * 10) / 10));
    const slot = str(img.slot).trim();
    return Object.assign(extras(img, IMAGE_KEYS), {
      id: str(img.id).trim() || slot || imageIdFor(src, img.alt),
      src,
      alt: str(img.alt),
      caption: str(img.caption),
      markers: Array.isArray(img.markers)
        ? img.markers.filter(isObj).map((m) => Object.assign(extras(m, MARKER_KEYS), { x: clamp(m.x), y: clamp(m.y), label: str(m.label) }))
        : [],
      rights: img.rights === 'oeffentlich' ? 'oeffentlich' : 'intern',
      origin: pick(ORIGINS, img.origin, ''),
      captured: day(img.captured),
      pmsVersion: str(img.pmsVersion).trim(),
      capturedBy: str(img.capturedBy).trim(),
      slot,
      status: pick(IMAGE_STATUS, img.status, ''),
    });
  }

  const SLOT_KEYS = new Set(['id', 'need', 'title', 'area', 'instruction', 'test']);

  function normalizeSlot(sl) {
    if (!isObj(sl)) return null;
    const id = str(sl.id).trim();
    if (!id) return null;
    return Object.assign(extras(sl, SLOT_KEYS), {
      id,
      need: pick(SLOT_NEED, sl.need, 'optional'),
      title: str(sl.title),
      area: str(sl.area).trim(),
      instruction: str(sl.instruction),
      test: str(sl.test).trim(),
    });
  }

  function normalizeImages(list) {
    return (Array.isArray(list) ? list : []).map(normalizeImage).filter(Boolean);
  }

  const STEP_KEYS = new Set(['title', 'text', 'hint', 'hintType', 'group', 'image', 'images', 'slots']);

  function normalizeStep(s) {
    s = isObj(s) ? s : { text: str(s) };
    // Format 1: genau ein Bild in „image“
    const images = Array.isArray(s.images) ? s.images : s.image ? [s.image] : [];
    const seen = new Set();
    return Object.assign(extras(s, STEP_KEYS), {
      title: str(s.title),
      text: str(s.text),
      hint: str(s.hint),
      hintType: pick(HINT_TYPES, s.hintType, 'tipp'),
      group: str(s.group).trim(),
      images: normalizeImages(images),
      slots: (Array.isArray(s.slots) ? s.slots : []).map(normalizeSlot).filter((x) => x && !seen.has(x.id) && seen.add(x.id)),
    });
  }

  function normalizeTroubleshooting(t) {
    t = isObj(t) ? t : {};
    return {
      messages: arrStr(t.messages),
      symptoms: str(t.symptoms),
      causes: Array.isArray(t.causes)
        ? t.causes.filter(isObj).map((c) => ({ title: str(c.title), check: str(c.check), solution: str(c.solution) }))
        : [],
      escalation: str(t.escalation),
    };
  }

  function normalizeTree(t) {
    t = isObj(t) ? t : {};
    const seen = new Set();
    const nodes = (Array.isArray(t.nodes) ? t.nodes : []).filter(isObj).map((n, i) => {
      let id = str(n.id).trim() || 'n' + (i + 1);
      while (seen.has(id)) id = id + '_' + i;
      seen.add(id);
      const kind = n.kind === 'result' ? 'result' : 'question';
      const node = { id, kind, text: str(n.text) };
      if (kind === 'question') {
        node.answers = (Array.isArray(n.answers) ? n.answers : []).filter(isObj).map((a) => ({ label: str(a.label), next: str(a.next) }));
      } else {
        node.tone = TONES[n.tone] ? n.tone : 'info';
        node.links = arrStr(n.links);
      }
      return node;
    });
    const start = nodes.some((n) => n.id === t.start) ? t.start : nodes[0] ? nodes[0].id : '';
    return { start, nodes };
  }

  function normalizeReview(r) {
    r = isObj(r) ? r : {};
    return {
      status: pick(REVIEW_STATUS, r.status, ''),
      checkedAt: day(r.checkedAt),
      checkedBy: str(r.checkedBy).trim(),
      pmsVersion: str(r.pmsVersion).trim(),
      nextReview: day(r.nextReview),
      note: str(r.note),
    };
  }

  function normalizeSource(s) {
    if (!isObj(s)) return null;
    const out = { title: str(s.title).trim(), url: str(s.url).trim(), date: str(s.date).trim(), note: str(s.note).trim() };
    return out.title || out.url ? out : null;
  }

  const ARTICLE_KEYS = new Set([
    'id', 'type', 'title', 'categoryId', 'summary', 'tags', 'keywords', 'example', 'author', 'created', 'updated', 'body', 'related',
    'steps', 'troubleshooting', 'tree', 'visibility', 'review', 'sources', 'after', 'images',
  ]);

  function normalizeArticle(a) {
    a = isObj(a) ? a : {};
    const type = TYPES[a.type] ? a.type : 'info';
    const art = Object.assign(extras(a, ARTICLE_KEYS), {
      id: str(a.id).trim() || uid('artikel'),
      type,
      title: str(a.title).trim() || 'Ohne Titel',
      categoryId: str(a.categoryId),
      summary: str(a.summary),
      tags: arrStr(a.tags),
      keywords: arrStr(a.keywords),
      example: !!a.example,
      author: str(a.author),
      created: iso(a.created),
      updated: iso(a.updated),
      body: str(a.body),
      related: arrStr(a.related),
      visibility: a.visibility === 'oeffentlich' ? 'oeffentlich' : 'intern',
      review: normalizeReview(a.review),
      sources: (Array.isArray(a.sources) ? a.sources : []).map(normalizeSource).filter(Boolean),
      after: str(a.after),
      images: normalizeImages(a.images),
    });
    if (type === 'guide') art.steps = (Array.isArray(a.steps) ? a.steps : []).map(normalizeStep);
    if (type === 'troubleshooting') art.troubleshooting = normalizeTroubleshooting(a.troubleshooting);
    if (type === 'decision') art.tree = normalizeTree(a.tree);
    return art;
  }

  function normalizeCategory(c, i) {
    c = isObj(c) ? c : {};
    return {
      id: str(c.id).trim() || 'kategorie-' + (i + 1),
      name: str(c.name).trim() || 'Kategorie ' + (i + 1),
      description: str(c.description),
      icon: CAT_ICONS.includes(c.icon) ? c.icon : 'folder',
      color: COLORS.includes(c.color) ? c.color : 'slate',
    };
  }

  function dedupeIds(list, prefix) {
    const seen = new Set();
    list.forEach((x, i) => {
      let id = x.id;
      let n = 2;
      while (seen.has(id)) id = x.id + '-' + n++;
      if (id !== x.id) x.id = id || prefix + '-' + i;
      seen.add(x.id);
    });
    return list;
  }

  function normalizeSynonyms(s) {
    if (!Array.isArray(s)) return [];
    return s
      .map((g) => (Array.isArray(g) ? g : typeof g === 'string' ? g.split(',') : []))
      .map((g) => Array.from(new Set(g.map((x) => str(x).trim()).filter(Boolean))))
      .filter((g) => g.length >= 2);
  }

  const META_KEYS = new Set(['title', 'description', 'revision', 'updated', 'exampleData', 'searchExamples', 'package']);
  const ROOT_KEYS = new Set(['format', 'schemaVersion', 'meta', 'categories', 'synonyms', 'articles']);

  /** Ermittelt Format und Schema-Version einer Rohdatei (ohne sie zu verändern) */
  function detectFormat(raw) {
    const f = isObj(raw) ? str(raw.format) : '';
    const declared = isObj(raw) ? Number(raw.schemaVersion) || 0 : 0;
    let schema = declared || (f === FORMAT ? 2 : 1);
    const m = /^protel-hilfe-(\d+)$/.exec(f);
    if (m) schema = Math.max(schema, Number(m[1]));
    return { format: f, schema, known: !f || f === FORMAT_V1 || f === FORMAT || !!m, newer: schema > SCHEMA };
  }

  /** Prüft und vervollständigt eine (importierte) Wissensdatenbank. Wirft bei ungültigen Daten. */
  function normalizeKB(raw) {
    if (!isObj(raw)) throw new Error('Die Datei enthält keine gültige Wissensdatenbank.');
    if (!Array.isArray(raw.articles)) throw new Error('Die Datei enthält keine Artikelliste („articles“ fehlt).');
    const fmt = detectFormat(raw);
    if (!fmt.known) throw new Error('Unbekanntes Datenformat: ' + raw.format);
    const meta = isObj(raw.meta) ? raw.meta : {};
    const kb = Object.assign(extras(raw, ROOT_KEYS), {
      format: FORMAT,
      schemaVersion: SCHEMA,
      meta: Object.assign(extras(meta, META_KEYS), {
        title: str(meta.title) || 'Protel Hilfe',
        description: str(meta.description),
        revision: str(meta.revision) || newRevision(),
        updated: iso(meta.updated) || now(),
        exampleData: !!meta.exampleData,
        searchExamples: arrStr(meta.searchExamples).slice(0, 8),
        package: pick(PACKAGES, meta.package, ''),
      }),
      categories: dedupeIds((Array.isArray(raw.categories) ? raw.categories : []).map(normalizeCategory), 'kategorie'),
      synonyms: normalizeSynonyms(raw.synonyms),
      articles: dedupeIds(raw.articles.map(normalizeArticle), 'artikel'),
    });
    return kb;
  }

  function emptyKB() {
    return normalizeKB({ meta: { title: 'Protel Hilfe' }, categories: [], synonyms: [], articles: [] });
  }

  function newStep() {
    return { title: '', text: '', hint: '', hintType: 'tipp', group: '', images: [], slots: [] };
  }

  function newArticle(type, categoryId) {
    const t = TYPES[type] ? type : 'guide';
    return normalizeArticle({
      id: '',
      type: t,
      title: '',
      categoryId: categoryId || '',
      steps: t === 'guide' ? [newStep()] : undefined,
      troubleshooting: t === 'troubleshooting' ? { causes: [{ title: '', check: '', solution: '' }] } : undefined,
      tree: t === 'decision'
        ? {
          start: 'n1',
          nodes: [
            { id: 'n1', kind: 'question', text: '', answers: [{ label: 'Ja', next: 'n2' }, { label: 'Nein', next: 'n3' }] },
            { id: 'n2', kind: 'result', text: '', tone: 'success' },
            { id: 'n3', kind: 'result', text: '', tone: 'info' },
          ],
        }
        : undefined,
    });
  }

  function uniqueArticleId(kb, title) {
    const base = slugify(title);
    let id = base;
    let n = 2;
    const ids = new Set(kb.articles.map((a) => a.id));
    while (ids.has(id)) id = base + '-' + n++;
    return id;
  }

  /* --------------------------------------------------------- Bilder und Bildplätze */

  /** Alle Bilder eines Artikels in Lesereihenfolge: { img, stepIndex (-1 = Übersicht), k, label } */
  function articleFigures(a) {
    const out = [];
    const ov = a.images || [];
    ov.forEach((img, k) => out.push({ img, stepIndex: -1, k, label: ov.length > 1 ? 'Übersicht ' + (k + 1) : 'Übersicht' }));
    (a.steps || []).forEach((s, i) => (s.images || []).forEach((img, k) => out.push({ img, stepIndex: i, k, label: 'Abb. ' + (i + 1) + '.' + (k + 1) })));
    return out;
  }

  /** Bezeichnungen für Verweise {{Abb:ID}} */
  function figureLabels(a) {
    const map = new Map();
    articleFigures(a).forEach((f) => {
      if (f.img.id && !map.has(f.img.id)) map.set(f.img.id, f.label);
      if (f.img.slot && !map.has(f.img.slot)) map.set(f.img.slot, f.label);
    });
    return map;
  }

  /** Status eines Bildplatzes: fehlt | vorhanden | geprueft | veraltet */
  function slotState(step, slot) {
    const img = (step.images || []).find((x) => x.slot === slot.id);
    if (!img) return 'fehlt';
    if (img.status === 'geprueft') return 'geprueft';
    if (img.status === 'veraltet') return 'veraltet';
    return 'vorhanden';
  }

  const SLOT_STATES = {
    fehlt: { label: 'fehlt', tone: 'warning' },
    vorhanden: { label: 'vorhanden', tone: 'info' },
    geprueft: { label: 'geprüft', tone: 'success' },
    veraltet: { label: 'veraltet', tone: 'danger' },
  };

  /** Alle Bildplätze der Wissensdatenbank mit Status */
  function allSlots(kb) {
    const out = [];
    kb.articles.forEach((a) => (a.steps || []).forEach((s, i) => (s.slots || []).forEach((sl) => {
      out.push({ article: a, stepIndex: i, step: s, slot: sl, state: slotState(s, sl) });
    })));
    return out;
  }

  function forEachImage(kb, fn) {
    kb.articles.forEach((a) => {
      (a.images || []).forEach((img) => fn(img, a, -1));
      (a.steps || []).forEach((s, i) => (s.images || []).forEach((img) => fn(img, a, i)));
    });
  }

  function countImages(kb) {
    let n = 0;
    forEachImage(kb, () => { n++; });
    return n;
  }

  function imageStats(kb) {
    const st = { total: 0, intern: 0, oeffentlich: 0, bytes: 0, embedded: 0, linked: 0 };
    forEachImage(kb, (img) => {
      st.total++;
      st[img.rights]++;
      if (img.src.startsWith('data:')) {
        st.embedded++;
        st.bytes += Math.round(img.src.length * 0.75);
      } else st.linked++;
    });
    return st;
  }

  /* --------------------------------------------------------- Texte (Suche, Platzhalter) */

  function imageTexts(img) {
    return [img.caption, img.alt].concat(img.markers.map((m) => m.label));
  }

  /** Alle Freitextfelder eines Artikels (Markdown) */
  function articleTexts(a) {
    const out = [a.body];
    (a.images || []).forEach((img) => out.push(...imageTexts(img)));
    (a.steps || []).forEach((s) => {
      out.push(s.group, s.title, s.text, s.hint);
      (s.images || []).forEach((img) => out.push(...imageTexts(img)));
    });
    if (a.troubleshooting) {
      const t = a.troubleshooting;
      out.push(t.symptoms, t.escalation);
      t.causes.forEach((c) => out.push(c.title, c.check, c.solution));
    }
    if (a.tree) a.tree.nodes.forEach((n) => out.push(n.text, ...(n.answers || []).map((x) => x.label)));
    out.push(a.after);
    return out.filter(Boolean);
  }

  function articleBodyText(a) {
    return articleTexts(a).map(PH.md.toPlain).join('\n');
  }

  function countPlaceholders(a) {
    let n = 0;
    [a.title, a.summary].concat(articleTexts(a)).forEach((t) => {
      const m = String(t || '').replace(/`[^`]*`/g, '').match(/\[\[[^[\]]+\]\]/g);
      if (m) n += m.length;
    });
    return n;
  }

  /** Prüft einen Entscheidungsbaum und liefert Warnungen (Text) */
  function validateTree(tree) {
    const warn = [];
    if (!tree || !tree.nodes.length) return ['Der Entscheidungsbaum enthält noch keine Knoten.'];
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    if (!byId.has(tree.start)) warn.push('Kein gültiger Startknoten gewählt.');
    tree.nodes.forEach((n) => {
      const label = nodeLabel(tree, n);
      if (!n.text.trim()) warn.push(label + ': Text fehlt.');
      if (n.kind === 'question') {
        if (!n.answers.length) warn.push(label + ': Frage hat keine Antworten.');
        n.answers.forEach((a, k) => {
          if (!a.label.trim()) warn.push(label + ': Antwort ' + (k + 1) + ' hat keine Beschriftung.');
          if (!a.next) warn.push(label + ': Antwort „' + (a.label || k + 1) + '“ führt nirgendwohin.');
          else if (!byId.has(a.next)) warn.push(label + ': Antwort „' + (a.label || k + 1) + '“ verweist auf einen gelöschten Knoten.');
        });
      }
    });
    // Erreichbarkeit
    const reach = new Set();
    const stack = [tree.start];
    while (stack.length) {
      const id = stack.pop();
      if (reach.has(id) || !byId.has(id)) continue;
      reach.add(id);
      (byId.get(id).answers || []).forEach((a) => stack.push(a.next));
    }
    tree.nodes.forEach((n) => {
      if (!reach.has(n.id)) warn.push(nodeLabel(tree, n) + ': ist vom Start aus nicht erreichbar.');
    });
    return warn;
  }

  function nodeLabel(tree, node) {
    const qs = tree.nodes.filter((n) => n.kind === node.kind);
    const idx = qs.indexOf(node) + 1;
    return (node.kind === 'question' ? 'Frage ' : 'Ergebnis ') + idx;
  }

  /* --------------------------------------------------------- Öffentlich / intern */

  /** Ist der Artikel bzw. das Bild ausdrücklich zur Veröffentlichung freigegeben? */
  const isPublicArticle = (a) => a.visibility === 'oeffentlich';
  const isPublicImage = (img) => img.rights === 'oeffentlich' && ORIGINS[img.origin] && ORIGINS[img.origin].publicOk === true;

  /** Enthält die Wissensdatenbank interne Inhalte? */
  function hasInternal(kb) {
    if (kb.meta.package === 'intern') return true;
    let internal = kb.articles.some((a) => !isPublicArticle(a) || allSlotsOf(a).length);
    if (!internal) forEachImage(kb, (img) => { if (!isPublicImage(img)) internal = true; });
    return internal;
  }

  function allSlotsOf(a) {
    const out = [];
    (a.steps || []).forEach((s) => (s.slots || []).forEach((sl) => out.push(sl)));
    return out;
  }

  /**
   * Prüft, ob eine Wissensdatenbank veröffentlicht werden darf.
   * Liefert eine Liste von Problemen (leer = in Ordnung).
   */
  function publicIssues(kb) {
    const issues = [];
    if (kb.meta.package === 'intern') issues.push('Der Datenbestand ist als „interner Inhaltsstand“ gekennzeichnet.');
    kb.articles.forEach((a) => {
      const t = '„' + a.title + '“';
      if (!isPublicArticle(a)) issues.push(t + ': Artikel ist nicht ausdrücklich als öffentlich gekennzeichnet.');
      if (a.review.checkedBy) issues.push(t + ': enthält den Namen der prüfenden Person.');
      if (allSlotsOf(a).length) issues.push(t + ': enthält geplante Bildplätze (interne Aufnahmeplanung).');
      const imgs = [];
      (a.images || []).forEach((img) => imgs.push(img));
      (a.steps || []).forEach((s) => (s.images || []).forEach((img) => imgs.push(img)));
      imgs.forEach((img) => {
        if (img.rights !== 'oeffentlich') issues.push(t + ': Bild „' + (img.caption || img.alt || img.id) + '“ ist nicht als öffentlich gekennzeichnet.');
        else if (!ORIGINS[img.origin] || ORIGINS[img.origin].publicOk !== true) issues.push(t + ': Bild „' + (img.caption || img.alt || img.id) + '“ hat eine Herkunft, die nicht veröffentlicht werden darf (' + ORIGINS[img.origin].label + ').');
        if (img.capturedBy) issues.push(t + ': Bild „' + (img.caption || img.alt || img.id) + '“ enthält den Namen der aufnehmenden Person.');
      });
    });
    return issues;
  }

  /**
   * Öffentlicher Stand: nur ausdrücklich öffentliche Artikel und Bilder, ohne Bildplätze,
   * ohne Personennamen und ohne unbekannte Zusatzfelder. Liefert { kb, removed }.
   */
  function toPublic(kb) {
    const removed = { articles: 0, images: 0, slots: 0, names: 0 };
    const keep = new Set(kb.articles.filter(isPublicArticle).map((a) => a.id));
    removed.articles = kb.articles.length - keep.size;
    const cleanImage = (img) => {
      if (!isPublicImage(img)) {
        removed.images++;
        return null;
      }
      if (img.capturedBy) removed.names++;
      return {
        id: img.id, src: img.src, alt: img.alt, caption: img.caption,
        markers: img.markers.map((m) => ({ x: m.x, y: m.y, label: m.label })),
        rights: 'oeffentlich', origin: img.origin, captured: img.captured, pmsVersion: img.pmsVersion, capturedBy: '', slot: '', status: img.status,
      };
    };
    const articles = kb.articles.filter((a) => keep.has(a.id)).map((a) => {
      const out = {
        id: a.id, type: a.type, title: a.title, categoryId: a.categoryId, summary: a.summary, tags: a.tags.slice(), keywords: a.keywords.slice(),
        example: a.example, author: a.author, created: a.created, updated: a.updated, body: a.body,
        related: a.related.filter((id) => keep.has(id)), visibility: 'oeffentlich',
        review: Object.assign({}, a.review, { checkedBy: '' }),
        sources: a.sources.map((s) => Object.assign({}, s)), after: a.after,
        images: a.images.map(cleanImage).filter(Boolean),
      };
      if (a.review.checkedBy) removed.names++;
      if (a.steps) {
        out.steps = a.steps.map((s) => {
          removed.slots += (s.slots || []).length;
          return { title: s.title, text: s.text, hint: s.hint, hintType: s.hintType, group: s.group, images: s.images.map(cleanImage).filter(Boolean), slots: [] };
        });
      }
      if (a.troubleshooting) out.troubleshooting = JSON.parse(JSON.stringify(a.troubleshooting));
      if (a.tree) {
        out.tree = JSON.parse(JSON.stringify(a.tree));
        out.tree.nodes.forEach((n) => { if (n.links) n.links = n.links.filter((id) => keep.has(id)); });
      }
      return out;
    });
    const usedCats = new Set(articles.map((a) => a.categoryId));
    const pub = normalizeKB({
      format: FORMAT,
      schemaVersion: SCHEMA,
      meta: {
        title: kb.meta.title, description: kb.meta.description, revision: newRevision(), updated: now(),
        exampleData: articles.some((a) => a.example), searchExamples: kb.meta.searchExamples.slice(), package: 'oeffentlich',
      },
      categories: kb.categories.filter((c) => usedCats.has(c.id)),
      synonyms: kb.synonyms,
      articles,
    });
    return { kb: pub, removed };
  }

  /* --------------------------------------------------------- Serialisierung */

  function toJSON(kb) {
    return JSON.stringify(Object.assign({}, kb, { format: FORMAT, schemaVersion: SCHEMA }), null, 1);
  }

  function toJS(kb) {
    const stamp = PH.util.fmtDate(kb.meta.updated, true);
    const internal = hasInternal(kb);
    return (
      '/*\n' +
      ' * Protel Hilfe – Wissensdatenbank (Datenformat ' + SCHEMA + ')\n' +
      ' * Stand: ' + stamp + '  |  Revision: ' + kb.meta.revision + '\n' +
      (internal
        ? ' *\n * PROTEL-HILFE-INTERN: Diese Datei enthält interne Inhalte. Nicht veröffentlichen,\n * nicht in ein öffentliches Repository und nicht auf GitHub Pages stellen.\n'
        : ' *\n * Öffentlicher Stand: enthält nur als öffentlich gekennzeichnete Inhalte.\n') +
      ' *\n' +
      ' * Diese Datei gehört in den Unterordner „data“ der App und heißt „wissensdatenbank.js“.\n' +
      ' * Bitte nicht von Hand bearbeiten – Änderungen in der App vornehmen und erneut exportieren.\n' +
      ' */\n' +
      'window.' + GLOBAL_VAR + ' = ' + toJSON(kb) + ';\n'
    );
  }

  function extractJSONText(text) {
    let t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) throw new Error('Die Datei ist leer.');
    if (!t.startsWith('{')) {
      const m = t.match(new RegExp(GLOBAL_VAR + '\\s*=\\s*'));
      if (!m) throw new Error('Unbekanntes Dateiformat. Erwartet wird eine Protel-Hilfe-Exportdatei (.json oder .js).');
      t = t.slice(m.index + m[0].length).trim().replace(/;\s*$/, '');
    }
    return t;
  }

  /** Liest eine exportierte .json- oder .js-Datei (ohne eval). Liefert { kb, schema, newer, format }. */
  function parseImport(text) {
    const t = extractJSONText(text);
    let obj;
    try {
      obj = JSON.parse(t);
    } catch (e) {
      throw new Error('Die Datei ist beschädigt oder kein gültiges JSON (' + e.message + ').');
    }
    const fmt = detectFormat(obj);
    if (!fmt.known) {
      throw new Error(/^protel-hilfe/.test(fmt.format)
        ? 'Diese Datei stammt aus einer neueren Version der App (' + fmt.format + '). Bitte zuerst die App aktualisieren.'
        : 'Unbekanntes Datenformat: ' + fmt.format);
    }
    return { kb: normalizeKB(obj), schema: fmt.schema, newer: fmt.newer, format: fmt.format || FORMAT_V1 };
  }

  /** Kompatibel zu Format 1: liefert nur die Wissensdatenbank */
  function parseImportText(text) {
    return parseImport(text).kb;
  }

  /* ------------------------------------------------------------ Zusammenführen */

  function planMerge(cur, inc) {
    const byId = new Map(cur.articles.map((a) => [a.id, a]));
    const plan = { added: [], updated: [], skipped: [], newCategories: [], newSynonyms: [] };
    inc.articles.forEach((a) => {
      const ex = byId.get(a.id);
      if (!ex) plan.added.push(a);
      else if ((a.updated || '') > (ex.updated || '')) plan.updated.push(a);
      else plan.skipped.push(a);
    });
    const catIds = new Set(cur.categories.map((c) => c.id));
    plan.newCategories = inc.categories.filter((c) => !catIds.has(c.id));
    const synKeys = new Set(cur.synonyms.map(synKey));
    plan.newSynonyms = inc.synonyms.filter((g) => !synKeys.has(synKey(g)));
    plan.package = inc.meta.package;
    return plan;
  }

  function synKey(g) {
    return g.map((x) => x.toLowerCase()).sort().join('|');
  }

  function applyMerge(cur, plan) {
    const upd = new Map(plan.updated.map((a) => [a.id, a]));
    const meta = Object.assign({}, cur.meta);
    // Wer interne Inhalte hinzufügt, hat danach einen internen Inhaltsstand
    if (plan.package === 'intern' && (plan.added.length || plan.updated.length)) meta.package = 'intern';
    return Object.assign({}, cur, {
      meta,
      categories: cur.categories.concat(plan.newCategories),
      synonyms: cur.synonyms.concat(plan.newSynonyms),
      articles: cur.articles.map((a) => upd.get(a.id) || a).concat(plan.added),
    });
  }

  PH.model = {
    FORMAT, FORMAT_V1, SCHEMA, GLOBAL_VAR, TYPES, TYPE_ORDER, COLORS, COLOR_LABELS, CAT_ICONS, TONES,
    HINT_TYPES, REVIEW_STATUS, RIGHTS, ORIGINS, IMAGE_STATUS, SLOT_NEED, SLOT_STATES, VISIBILITY, PACKAGES,
    normalizeKB, normalizeArticle, normalizeTree, normalizeImage, normalizeSlot, normalizeStep, normalizeSynonyms, emptyKB, newArticle, newStep, uniqueArticleId,
    articleTexts, articleBodyText, countPlaceholders, countImages, imageStats, validateTree, nodeLabel, safeImageSrc, imageIdFor,
    articleFigures, figureLabels, slotState, allSlots, forEachImage, isPublicArticle, isPublicImage, hasInternal, publicIssues, toPublic,
    toJSON, toJS, parseImport, parseImportText, detectFormat, planMerge, applyMerge, newRevision, now, day,
  };
})();
