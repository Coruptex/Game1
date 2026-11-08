/* Protel Hilfe – Datenmodell, Validierung, Import/Export, Zusammenführen */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { uid, slugify } = PH.util;

  const FORMAT = 'protel-hilfe';
  const SCHEMA = 1;
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

  const str = (v) => (v == null ? '' : String(v));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const arrStr = (v) =>
    Array.isArray(v) ? v.map((x) => str(x).trim()).filter(Boolean) : typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
  const iso = (v) => {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  };
  const now = () => new Date().toISOString();

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

  function normalizeImage(img) {
    if (!isObj(img)) return null;
    const src = safeImageSrc(img.src);
    if (!src) return null;
    const clamp = (n) => Math.max(0, Math.min(100, Math.round((Number(n) || 0) * 10) / 10));
    return {
      src,
      alt: str(img.alt),
      markers: Array.isArray(img.markers) ? img.markers.filter(isObj).map((m) => ({ x: clamp(m.x), y: clamp(m.y), label: str(m.label) })) : [],
    };
  }

  function normalizeStep(s) {
    s = isObj(s) ? s : { text: str(s) };
    return { title: str(s.title), text: str(s.text), hint: str(s.hint), image: normalizeImage(s.image) };
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

  function normalizeArticle(a) {
    a = isObj(a) ? a : {};
    const type = TYPES[a.type] ? a.type : 'info';
    const art = {
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
    };
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

  /** Prüft und vervollständigt eine (importierte) Wissensdatenbank. Wirft bei ungültigen Daten. */
  function normalizeKB(raw) {
    if (!isObj(raw)) throw new Error('Die Datei enthält keine gültige Wissensdatenbank.');
    if (!Array.isArray(raw.articles)) throw new Error('Die Datei enthält keine Artikelliste („articles“ fehlt).');
    if (raw.format && raw.format !== FORMAT) throw new Error('Unbekanntes Datenformat: ' + raw.format);
    const meta = isObj(raw.meta) ? raw.meta : {};
    const kb = {
      format: FORMAT,
      schemaVersion: SCHEMA,
      meta: {
        title: str(meta.title) || 'Protel Hilfe',
        description: str(meta.description),
        revision: str(meta.revision) || newRevision(),
        updated: iso(meta.updated) || now(),
        exampleData: !!meta.exampleData,
        searchExamples: arrStr(meta.searchExamples).slice(0, 8),
      },
      categories: dedupeIds((Array.isArray(raw.categories) ? raw.categories : []).map(normalizeCategory), 'kategorie'),
      synonyms: normalizeSynonyms(raw.synonyms),
      articles: dedupeIds(raw.articles.map(normalizeArticle), 'artikel'),
    };
    return kb;
  }

  function emptyKB() {
    return normalizeKB({ meta: { title: 'Protel Hilfe' }, categories: [], synonyms: [], articles: [] });
  }

  function newArticle(type, categoryId) {
    const t = TYPES[type] ? type : 'guide';
    return normalizeArticle({
      id: '',
      type: t,
      title: '',
      categoryId: categoryId || '',
      steps: t === 'guide' ? [{ title: '', text: '' }] : undefined,
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

  /** Alle Freitextfelder eines Artikels (Markdown) */
  function articleTexts(a) {
    const out = [a.body];
    (a.steps || []).forEach((s) => out.push(s.title, s.text, s.hint, s.image ? s.image.alt : '', ...(s.image ? s.image.markers.map((m) => m.label) : [])));
    if (a.troubleshooting) {
      const t = a.troubleshooting;
      out.push(t.symptoms, t.escalation);
      t.causes.forEach((c) => out.push(c.title, c.check, c.solution));
    }
    if (a.tree) a.tree.nodes.forEach((n) => out.push(n.text, ...(n.answers || []).map((x) => x.label)));
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

  function countImages(kb) {
    let n = 0;
    kb.articles.forEach((a) => (a.steps || []).forEach((s) => { if (s.image) n++; }));
    return n;
  }

  /** Prüft einen Entscheidungsbaum und liefert Warnungen (Text) */
  function validateTree(tree) {
    const warn = [];
    if (!tree || !tree.nodes.length) return ['Der Entscheidungsbaum enthält noch keine Knoten.'];
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    if (!byId.has(tree.start)) warn.push('Kein gültiger Startknoten gewählt.');
    tree.nodes.forEach((n, i) => {
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

  /* --------------------------------------------------------- Serialisierung */

  function toJSON(kb) {
    return JSON.stringify(Object.assign({ format: FORMAT, schemaVersion: SCHEMA }, kb), null, 1);
  }

  function toJS(kb) {
    const stamp = PH.util.fmtDate(kb.meta.updated, true);
    return (
      '/*\n' +
      ' * Protel Hilfe – Wissensdatenbank\n' +
      ' * Stand: ' + stamp + '  |  Revision: ' + kb.meta.revision + '\n' +
      ' *\n' +
      ' * Diese Datei gehört in den Unterordner „data“ der App und heißt „wissensdatenbank.js“.\n' +
      ' * Bitte nicht von Hand bearbeiten – Änderungen in der App vornehmen und erneut exportieren.\n' +
      ' */\n' +
      'window.' + GLOBAL_VAR + ' = ' + toJSON(kb) + ';\n'
    );
  }

  /** Liest eine exportierte .json- oder .js-Datei (ohne eval) */
  function parseImportText(text) {
    let t = String(text || '').replace(/^﻿/, '').trim();
    if (!t) throw new Error('Die Datei ist leer.');
    if (!t.startsWith('{')) {
      const m = t.match(new RegExp(GLOBAL_VAR + '\\s*=\\s*'));
      if (!m) throw new Error('Unbekanntes Dateiformat. Erwartet wird eine Protel-Hilfe-Exportdatei (.json oder .js).');
      t = t.slice(m.index + m[0].length).trim().replace(/;\s*$/, '');
    }
    let obj;
    try {
      obj = JSON.parse(t);
    } catch (e) {
      throw new Error('Die Datei ist beschädigt oder kein gültiges JSON (' + e.message + ').');
    }
    return normalizeKB(obj);
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
    return plan;
  }

  function synKey(g) {
    return g.map((x) => x.toLowerCase()).sort().join('|');
  }

  function applyMerge(cur, plan) {
    const upd = new Map(plan.updated.map((a) => [a.id, a]));
    return Object.assign({}, cur, {
      meta: Object.assign({}, cur.meta),
      categories: cur.categories.concat(plan.newCategories),
      synonyms: cur.synonyms.concat(plan.newSynonyms),
      articles: cur.articles.map((a) => upd.get(a.id) || a).concat(plan.added),
    });
  }

  PH.model = {
    FORMAT, SCHEMA, GLOBAL_VAR, TYPES, TYPE_ORDER, COLORS, COLOR_LABELS, CAT_ICONS, TONES,
    normalizeKB, normalizeArticle, normalizeTree, normalizeImage, normalizeSynonyms, emptyKB, newArticle, uniqueArticleId,
    articleTexts, articleBodyText, countPlaceholders, countImages, validateTree, nodeLabel, safeImageSrc,
    toJSON, toJS, parseImportText, planMerge, applyMerge, newRevision, now,
  };
})();
