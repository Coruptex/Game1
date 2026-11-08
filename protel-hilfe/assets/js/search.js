/*
 * Protel Hilfe – Volltextsuche (vollständig lokal, ohne KI)
 *
 * - Normalisierung (Kleinschreibung, Umlaute, Akzente), leichtes deutsches Stemming, Stoppwörter
 * - BM25F-Relevanzbewertung mit Feldgewichten (Titel > Schlagwörter/Fehlermeldungen > Kurzbeschreibung > Text)
 * - Synonymgruppen (pflegbar), Präfixsuche beim Tippen, Teilwort-/Kompositasuche
 * - Tippfehlertoleranz (Damerau-Levenshtein) inkl. „Meinten Sie …?“-Vorschlag
 */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});

  const STOP = new Set((
    'aber alle allem allen aller alles als also am an andere anderem anderen anderer anderes auch auf aus bei beim bin bis bist ' +
    'da damit dann das dass dem den denn der des dessen dich die dies diese diesem diesen dieser dieses dir doch dort du durch ' +
    'ein eine einem einen einer eines er es etwas euch euer eure fuer hab habe haben hat hatte hatten hier hin ich ihm ihn ihnen ' +
    'ihr ihre im in ins ist jede jedem jeden jeder jedes jetzt kann kein keine man mein meine mich mir mit muss nach nicht nichts ' +
    'noch nun nur ob oder ohne sehr sein seine sich sie sind so soll sondern sonst ueber um und uns unser unter vom von vor ' +
    'wann war waren warum was weil welche welcher welches wenn wer werde werden wie wieder will wir wird wo wurde zu zum zur ' +
    'the a an and or of to is'
  ).split(' '));

  const FIELDS = ['title', 'keywords', 'summary', 'category', 'body'];
  const WEIGHTS = { title: 6, keywords: 4, summary: 2.2, category: 1.4, body: 1 };
  const K1 = 1.2;
  const B = 0.72;
  const WORD_RE = /[\p{L}\p{N}]+(?:[-‐–][\p{L}\p{N}]+)*/gu;

  function norm(w) {
    return w
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function stem(w) {
    if (w.length <= 4 || /\d/.test(w)) return w;
    const rules = [['ungen', 'ung'], ['heiten', 'heit'], ['keiten', 'keit'], ['innen', 'in']];
    for (const [suf, rep] of rules) if (w.endsWith(suf) && w.length - suf.length >= 3) return w.slice(0, -suf.length) + rep;
    for (const suf of ['ern', 'em', 'en', 'er', 'es']) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length);
    for (const suf of ['e', 's', 'n', 't']) if (w.endsWith(suf) && w.length - 1 >= 4) return w.slice(0, -1);
    return w;
  }

  /**
   * Zerlegt Text in Suchbegriffe: [{term, norm, surface}]
   * joinOnly: Wörter mit Bindestrich nur zusammengezogen liefern („Check-in“ → „checkin“),
   *           statt zusätzlich die Einzelteile („check“, „in“) – für Suchanfragen und Synonyme.
   */
  function analyze(text, keepStop, joinOnly) {
    const out = [];
    if (!text) return out;
    const s = String(text);
    WORD_RE.lastIndex = 0;
    let m;
    const add = (w, orig) => {
      const n = norm(w);
      if (!n) return;
      if (!keepStop && STOP.has(n)) return;
      if (n.length < 2 && !/\d/.test(n)) return;
      out.push({ term: stem(n), norm: n, surface: orig.toLowerCase(), orig });
    };
    while ((m = WORD_RE.exec(s))) {
      const orig = m[0];
      const parts = orig.split(/[-‐–]/);
      if (parts.length > 1) {
        if (!joinOnly) parts.forEach((p) => add(p, p));
        add(parts.join(''), orig);
      } else add(orig, orig);
    }
    return out;
  }

  /** Begrenzte Damerau-Levenshtein-Distanz (OSA). Liefert max+1, wenn größer als max. */
  function editDistance(a, b, max) {
    const la = a.length;
    const lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    let prev2 = new Array(lb + 1);
    let prev = new Array(lb + 1);
    let cur = new Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
      cur[0] = i;
      let rowMin = i;
      const ca = a.charCodeAt(i - 1);
      for (let j = 1; j <= lb; j++) {
        const cb = b.charCodeAt(j - 1);
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca === cb ? 0 : 1));
        if (i > 1 && j > 1 && ca === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === cb) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      const t = prev2;
      prev2 = prev;
      prev = cur;
      cur = t;
    }
    return prev[lb];
  }

  class SearchIndex {
    constructor(kb) {
      this.build(kb);
    }

    build(kb) {
      this.kb = kb;
      const catName = new Map(kb.categories.map((c) => [c.id, c.name]));
      this.docs = [];
      this.postings = new Map(); // term -> Map(docIdx -> gewichtete tf)
      this.surface = new Map(); // term -> Map(surface -> count)
      const lens = FIELDS.map(() => 0);
      const perDoc = [];

      kb.articles.forEach((a, d) => {
        const ts = a.troubleshooting;
        const fields = {
          title: a.title,
          keywords: [].concat(a.tags || [], a.keywords || [], ts ? ts.messages : []).join(' \n '),
          summary: a.summary,
          category: catName.get(a.categoryId) || '',
          body: PH.model.articleBodyText(a),
        };
        const tf = new Map(); // term -> array per field
        const flen = FIELDS.map(() => 0);
        FIELDS.forEach((f, fi) => {
          const toks = analyze(fields[f]);
          flen[fi] = toks.length;
          lens[fi] += toks.length;
          toks.forEach((t) => {
            let arr = tf.get(t.term);
            if (!arr) tf.set(t.term, (arr = [0, 0, 0, 0, 0]));
            arr[fi]++;
            let sm = this.surface.get(t.term);
            if (!sm) this.surface.set(t.term, (sm = new Map()));
            sm.set(t.orig, (sm.get(t.orig) || 0) + 1);
          });
        });
        this.docs.push({
          article: a,
          title: a.title,
          plain: [a.summary, fields.body].filter(Boolean).join('\n'),
          messages: ts ? ts.messages.map((x) => norm(x)) : [],
          normTitle: norm(a.title),
        });
        perDoc.push({ tf, flen });
      });

      const N = Math.max(1, this.docs.length);
      this.avg = lens.map((l) => l / N || 1);
      perDoc.forEach(({ tf, flen }, d) => {
        tf.forEach((arr, term) => {
          let w = 0;
          FIELDS.forEach((f, fi) => {
            if (!arr[fi]) return;
            w += (WEIGHTS[f] * arr[fi]) / (1 - B + (B * flen[fi]) / this.avg[fi]);
          });
          let p = this.postings.get(term);
          if (!p) this.postings.set(term, (p = new Map()));
          p.set(d, w);
        });
      });
      this.vocab = Array.from(this.postings.keys());

      // Synonyme
      this.synGroups = [];
      this.synOf = new Map(); // term -> Set(groupIdx)
      this.synSurface = new Map(); // term -> Anzeigeform
      (kb.synonyms || []).forEach((group, gi) => {
        const terms = new Set();
        const entries = [];
        group.forEach((entry) => {
          const ts = analyze(entry, false, true).map((t) => t.term);
          ts.forEach((t) => {
            terms.add(t);
            if (!this.synSurface.has(t)) this.synSurface.set(t, entry);
          });
          if (ts.length) entries.push({ text: entry, terms: ts });
        });
        this.synGroups.push({ terms, entries });
        terms.forEach((t) => {
          if (!this.synOf.has(t)) this.synOf.set(t, new Set());
          this.synOf.get(t).add(gi);
        });
      });
      this.synVocab = Array.from(this.synOf.keys());
      this.allVocab = Array.from(new Set(this.vocab.concat(this.synVocab)));
    }

    idf(term) {
      const p = this.postings.get(term);
      const df = p ? p.size : 0;
      const N = this.docs.length;
      return Math.log(1 + (N - df + 0.5) / (df + 0.5));
    }

    displayForm(term) {
      const sm = this.surface.get(term);
      if (sm) {
        let best = null;
        let bc = -1;
        sm.forEach((c, s) => { if (c > bc) { best = s; bc = c; } });
        return best;
      }
      return this.synSurface.get(term) || term;
    }

    /** Ermittelt für einen Suchbegriff alle passenden Index-Begriffe mit Gewicht. */
    expandToken(tok, prefixMode) {
      const s = tok.term;
      const cands = new Map();
      const info = { synonyms: [], correction: null };
      const put = (term, w, kind) => {
        const cur = cands.get(term);
        if (!cur || cur.w < w) cands.set(term, { w, kind });
      };
      const inIndex = this.postings.has(s);
      const isSyn = this.synOf.has(s);
      if (inIndex) put(s, 1, 'exact');

      const synFrom = (term, factor) => {
        const groups = this.synOf.get(term);
        if (!groups) return;
        groups.forEach((gi) => {
          const g = this.synGroups[gi];
          g.entries.forEach((en) => {
            if (en.terms.includes(term)) return;
            let any = false;
            en.terms.forEach((t) => {
              if (t !== term && this.postings.has(t)) {
                put(t, 0.85 * factor, 'synonym');
                any = true;
              }
            });
            if (any && !info.synonyms.includes(en.text)) info.synonyms.push(en.text);
          });
        });
      };
      synFrom(s, 1);

      // Präfix (beim Tippen) und Teilwörter – je kürzer der Anteil am Wort, desto geringer das Gewicht
      let prefixHits = 0;
      const minPrefix = prefixMode ? 2 : 4;
      if (s.length >= minPrefix || tok.norm.length >= minPrefix) {
        const keys = tok.norm !== s ? [tok.norm, s] : [s];
        for (const term of this.vocab) {
          if (term === s) continue;
          const key = keys.find((k) => k.length >= minPrefix && term.startsWith(k));
          if (key) {
            const ratio = Math.min(1, key.length / term.length);
            put(term, prefixMode ? 0.75 * (0.6 + 0.4 * ratio) : 0.6 * Math.sqrt(ratio), 'prefix');
            prefixHits++;
          } else if (s.length >= 4 && term.includes(s)) {
            put(term, 0.5 * Math.sqrt(s.length / term.length), 'compound');
          } else if (s.length >= 7 && term.length >= 4 && (s.startsWith(term) || s.endsWith(term))) {
            put(term, 0.42 * Math.sqrt(term.length / s.length), 'compound');
          }
        }
        // Unvollständig getipptes Wort, das ein Synonym einleitet (z. B. „abrei“ → Abreise → Check-out)
        if (s.length >= 4 && !inIndex && !isSyn) {
          for (const term of this.synVocab) {
            if (term !== s && term.startsWith(s)) synFrom(term, prefixMode ? 0.8 : 0.65);
          }
        }
      }

      // Tippfehler
      if (!inIndex && !isSyn && !prefixHits && s.length >= 4) {
        const max = s.length >= 7 ? 2 : 1;
        let best = null;
        for (const term of this.allVocab) {
          if (Math.abs(term.length - s.length) > max) continue;
          const d = editDistance(s, term, max);
          if (d > max) continue;
          const w = d === 1 ? 0.7 : 0.45;
          if (this.postings.has(term)) put(term, w, 'fuzzy');
          synFrom(term, w);
          const df = this.postings.has(term) ? this.postings.get(term).size : 0;
          if (!best || d < best.d || (d === best.d && df > best.df)) best = { term, d, df };
        }
        if (best) info.correction = { from: tok.surface, to: this.displayForm(best.term) };
      }
      return { cands, info };
    }

    /**
     * Suche. opts: { prefix: bool (letztes Wort als Präfix), type, category, limit }
     * Ergebnis: { results: [{article, score, coverage, matched:Set}], total, corrections, synonyms, suggestion, tokens }
     */
    search(query, opts) {
      opts = opts || {};
      const q = String(query || '').trim();
      const empty = { results: [], total: 0, corrections: [], synonyms: [], suggestion: null, tokens: [], query: q, facets: { type: {}, category: {} } };
      if (!q) return empty;
      let toks = analyze(q, false, true);
      if (!toks.length) toks = analyze(q, true, true);
      if (!toks.length) return empty;
      // doppelte Begriffe entfernen
      const seen = new Set();
      toks = toks.filter((t) => (seen.has(t.term) ? false : (seen.add(t.term), true)));
      const endsOpen = opts.prefix && !/\s$/.test(String(query));

      const n = toks.length;
      const scores = new Map(); // d -> Float64Array(n): bester Wert je Suchwort
      const quality = new Map(); // d -> Float64Array(n): beste Trefferqualität je Suchwort (1 = exakt)
      const matched = new Map(); // d -> Set(term)
      const corrections = [];
      const synonyms = [];

      toks.forEach((tok, k) => {
        const isLast = k === n - 1;
        const { cands, info } = this.expandToken(tok, endsOpen && isLast);
        if (info.correction) corrections.push(info.correction);
        if (info.synonyms.length) synonyms.push({ from: tok.surface, to: info.synonyms.slice(0, 4) });
        cands.forEach(({ w }, term) => {
          const post = this.postings.get(term);
          if (!post) return;
          const idf = this.idf(term);
          post.forEach((tfw, d) => {
            const sc = w * idf * ((tfw * (K1 + 1)) / (tfw + K1));
            let arr = scores.get(d);
            if (!arr) {
              scores.set(d, (arr = new Float64Array(n)));
              quality.set(d, new Float64Array(n));
              matched.set(d, new Set());
            }
            if (sc > arr[k]) arr[k] = sc;
            const qa = quality.get(d);
            if (w > qa[k]) qa[k] = w;
            matched.get(d).add(term);
          });
        });
      });

      const nq = norm(q);
      let results = [];
      scores.forEach((arr, d) => {
        let total = 0;
        let cov = 0;
        const qa = quality.get(d);
        for (let k = 0; k < n; k++) {
          total += arr[k];
          cov += Math.min(1, qa[k]);
        }
        // Abdeckung: Anteil der Suchwörter, gewichtet nach Trefferqualität (Teilwort zählt weniger als exakt)
        const coverage = cov / n;
        let score = total * (0.25 + 0.75 * coverage * coverage);
        const doc = this.docs[d];
        if (n > 1 && doc.normTitle.includes(nq)) score *= 1.35;
        if (nq.length >= 6 && doc.messages.some((m) => m.includes(nq))) score *= 1.6;
        results.push({ d, article: doc.article, score, coverage, matched: matched.get(d) });
      });
      results.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title, 'de'));

      // Schwache Ausreißer abschneiden (nur sehr unpassende Teiltreffer)
      if (results.length) {
        const top = results[0].score;
        results = results.filter((r) => r.score >= top * 0.04);
      }

      const facets = { type: {}, category: {} };
      results.forEach((r) => {
        facets.type[r.article.type] = (facets.type[r.article.type] || 0) + 1;
        facets.category[r.article.categoryId] = (facets.category[r.article.categoryId] || 0) + 1;
      });
      if (opts.type) results = results.filter((r) => r.article.type === opts.type);
      if (opts.category != null && opts.category !== '') results = results.filter((r) => r.article.categoryId === opts.category);
      const total = results.length;
      if (opts.limit) results = results.slice(0, opts.limit);

      let suggestion = null;
      if (corrections.length) {
        let sq = q;
        corrections.forEach((c) => {
          const re = new RegExp('(^|[^\\p{L}\\p{N}])' + c.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}\\p{N}])', 'iu');
          sq = sq.replace(re, (m0, pre) => pre + c.to);
        });
        if (norm(sq) !== nq) suggestion = sq;
      }
      return { results, total, corrections, synonyms, suggestion, tokens: toks, query: q, facets };
    }

    /* --------------------------------------------------- Hervorhebung */

    isHit(word, matched) {
      if (!matched || !matched.size) return false;
      return analyze(word, true).some((t) => matched.has(t.term));
    }

    /** Escaptes HTML mit <mark> um Treffer */
    highlight(text, matched) {
      const esc = PH.util.esc;
      const s = String(text || '');
      if (!matched || !matched.size) return esc(s);
      let out = '';
      let last = 0;
      WORD_RE.lastIndex = 0;
      let m;
      const re = new RegExp(WORD_RE.source, 'gu');
      while ((m = re.exec(s))) {
        if (this.isHit(m[0], matched)) {
          out += esc(s.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
          last = m.index + m[0].length;
        }
      }
      return out + esc(s.slice(last));
    }

    /** Textausschnitt rund um die meisten Treffer */
    snippet(text, matched, maxLen) {
      maxLen = maxLen || 200;
      const s = String(text || '').replace(/\s+/g, ' ').trim();
      if (!s) return '';
      if (s.length <= maxLen) return this.highlight(s, matched);
      const re = new RegExp(WORD_RE.source, 'gu');
      const hits = [];
      let m;
      while ((m = re.exec(s))) if (this.isHit(m[0], matched)) hits.push(m.index);
      let start = 0;
      if (hits.length) {
        let best = 0;
        let bestCount = 0;
        for (let i = 0; i < hits.length; i++) {
          let c = 0;
          for (let j = i; j < hits.length && hits[j] - hits[i] < maxLen * 0.8; j++) c++;
          if (c > bestCount) { bestCount = c; best = hits[i]; }
        }
        start = Math.max(0, best - Math.round(maxLen * 0.2));
        if (start > 0) {
          const sp = s.indexOf(' ', start);
          if (sp > -1 && sp - start < 20) start = sp + 1;
        }
      }
      let end = Math.min(s.length, start + maxLen);
      if (end < s.length) {
        const sp = s.lastIndexOf(' ', end);
        if (sp > start + maxLen * 0.6) end = sp;
      }
      return (start > 0 ? '… ' : '') + this.highlight(s.slice(start, end), matched) + (end < s.length ? ' …' : '');
    }

    /** Treffer im DOM (Artikelansicht) markieren */
    highlightDom(root, matched) {
      if (!root || !matched || !matched.size) return 0;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const p = node.parentElement;
          if (!p || p.closest('button, script, style, mark, .no-hl, input, textarea, select')) return NodeFilter.FILTER_REJECT;
          return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      let count = 0;
      const re = new RegExp(WORD_RE.source, 'gu');
      nodes.forEach((node) => {
        const s = node.nodeValue;
        re.lastIndex = 0;
        let m;
        let last = 0;
        const frag = document.createDocumentFragment();
        let any = false;
        while ((m = re.exec(s))) {
          if (!this.isHit(m[0], matched)) continue;
          any = true;
          count++;
          frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          const mark = document.createElement('mark');
          mark.className = 'hl';
          mark.textContent = m[0];
          frag.appendChild(mark);
          last = m.index + m[0].length;
        }
        if (!any) return;
        frag.appendChild(document.createTextNode(s.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
      return count;
    }

    /** Für die Verwaltung: wie wird eine Anfrage interpretiert? */
    explain(query) {
      const toks = analyze(query, false, true);
      return toks.map((tok) => {
        const { cands, info } = this.expandToken(tok, false);
        const list = Array.from(cands.entries())
          .sort((a, b) => b[1].w - a[1].w)
          .slice(0, 12)
          .map(([term, c]) => ({ term: this.displayForm(term), kind: c.kind, w: c.w, docs: this.postings.has(term) ? this.postings.get(term).size : 0 }));
        return { word: tok.surface, term: tok.term, candidates: list, correction: info.correction };
      });
    }
  }

  PH.Search = SearchIndex;
  PH.searchUtil = { analyze, norm, stem, editDistance };
})();
