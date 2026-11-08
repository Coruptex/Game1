/*
 * Protel Hilfe – schlanker, sicherer Markdown-Renderer
 *
 * Unterstützt: Überschriften (#), Absätze, Listen (-, 1.), Aufgabenlisten (- [ ]),
 * Hinweisboxen (> [!HINWEIS] / [!TIPP] / [!WARNUNG] / [!WICHTIG]), Zitate, Tabellen,
 * Trennlinie (---), **fett**, *kursiv*, `Code`, ==Markierung==, {{Strg+C}} (Tasten),
 * [[Platzhalter]] und [Linktext](Ziel).
 * Sämtlicher Text wird zuerst HTML-escaped – importierte Inhalte können kein HTML/JS einschleusen.
 */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const esc = PH.util.esc;

  const CALLOUTS = {
    HINWEIS: { cls: 'info', label: 'Hinweis', icon: 'infoCircle' },
    INFO: { cls: 'info', label: 'Info', icon: 'infoCircle' },
    TIPP: { cls: 'tip', label: 'Tipp', icon: 'sparkle' },
    WARNUNG: { cls: 'warning', label: 'Warnung', icon: 'alert' },
    ACHTUNG: { cls: 'warning', label: 'Achtung', icon: 'alert' },
    WICHTIG: { cls: 'danger', label: 'Wichtig', icon: 'alert' },
  };

  const LIST_RE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;
  const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
  const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

  function safeUrl(raw) {
    const url = String(raw || '').trim();
    if (!url) return null;
    if (/^(javascript|vbscript|data):/i.test(url)) return null;
    const scheme = url.match(/^([a-z][a-z0-9+.-]*):/i);
    if (scheme && !/^(https?|mailto|tel|file)$/i.test(scheme[1])) return null;
    return url;
  }

  function fmt(s) {
    // s ist bereits escaped
    s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\p{L}\p{N}])\*(?!\s)([^*]+?)\*(?![\p{L}\p{N}])/gu, '$1<em>$2</em>');
    s = s.replace(/(^|[^_\p{L}\p{N}])_(?!\s)([^_]+?)_(?![\p{L}\p{N}])/gu, '$1<em>$2</em>');
    s = s.replace(/==([^=]+?)==/g, '<mark>$1</mark>');
    return s;
  }

  function inline(text) {
    let s = esc(text);
    const tokens = [];
    const keep = (html) => {
      tokens.push(html);
      return '\u0000' + (tokens.length - 1) + '\u0000';
    };
    s = s.replace(/`([^`]+)`/g, (_, c) => keep('<code>' + c + '</code>'));
    // Verweis auf eine Abbildung des Artikels: {{Abb:ID}} (ID = Bildplatz, z. B. S-CIN-06, oder Bild-ID)
    s = s.replace(/\{\{Abb:\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_, id) => keep(figRef(id)));
    s = s.replace(/\{\{([^{}]+)\}\}/g, (_, k) =>
      keep('<span class="keys">' + k.split('+').map((x) => '<kbd>' + x.trim() + '</kbd>').join('<span class="kbd-plus">+</span>') + '</span>')
    );
    s = s.replace(/\[\[([^[\]]+)\]\]/g, (_, t) =>
      keep('<span class="placeholder" title="Platzhalter – bitte durch den tatsächlichen Ablauf ersetzen">' + PH.icon('edit') + t + '</span>')
    );
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const raw = u.replace(/&amp;/g, '&');
      const url = safeUrl(raw);
      if (!url) return t;
      const internal = url.startsWith('#');
      return keep(
        '<a href="' + esc(url) + '"' + (internal ? '' : ' target="_blank" rel="noopener noreferrer"') + '>' + fmt(t) + '</a>'
      );
    });
    s = fmt(s);
    return s.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[+n]);
  }

  /* Abbildungsverweise: Beim Rendern eines Artikels setzt die Ansicht die Zuordnung ID → „Abb. 3.1“ */
  let figCtx = null;
  function figRef(id) {
    const label = figCtx && figCtx.get(id);
    if (label) return '<a href="#" class="fig-ref" data-fig="' + esc(id) + '">' + esc(label) + '</a>';
    return '<span class="fig-ref missing" title="Abbildung „' + esc(id) + '“ ist (noch) nicht vorhanden">Abb. ' + esc(id) + '</span>';
  }
  /** Rendert mit einer Abbildungszuordnung (Map ID → Bezeichnung) */
  function withFigures(map, fn) {
    const prev = figCtx;
    figCtx = map || null;
    try {
      return fn();
    } finally {
      figCtx = prev;
    }
  }

  function isBlockStart(line, next) {
    return (
      /^\s*#{1,4}\s+/.test(line) ||
      /^\s*>/.test(line) ||
      LIST_RE.test(line) ||
      /^\s*(-{3,}|\*{3,})\s*$/.test(line) ||
      (TABLE_ROW_RE.test(line) && next != null && TABLE_SEP_RE.test(next))
    );
  }

  function splitRow(line) {
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|')) l = l.slice(0, -1);
    return l.split('|').map((c) => c.trim());
  }

  function render(src) {
    if (!src) return '';
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) { i++; continue; }

      let m = line.match(/^\s*(#{1,4})\s+(.*)$/);
      if (m) {
        const lvl = Math.min(m[1].length + 2, 6);
        html += '<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>';
        i++;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { html += '<hr>'; i++; continue; }

      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        const head = buf[0].match(/^\s*\[!([A-ZÄÖÜa-zäöü]+)\]\s*(.*)$/);
        const kind = head && CALLOUTS[head[1].toUpperCase()];
        if (kind) {
          buf[0] = head[2];
          if (!buf[0].trim()) buf.shift();
          html += '<div class="callout callout-' + kind.cls + '"><div class="callout-title">' + PH.icon(kind.icon) +
            esc(kind.label) + '</div><div class="callout-body">' + render(buf.join('\n')) + '</div></div>';
        } else {
          html += '<blockquote>' + render(buf.join('\n')) + '</blockquote>';
        }
        continue;
      }

      if (TABLE_ROW_RE.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
        const head = splitRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && TABLE_ROW_RE.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        html += '<div class="table-wrap"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') +
          '</tr></thead><tbody>' +
          rows.map((r) => '<tr>' + head.map((_, k) => '<td>' + inline(r[k] || '') + '</td>').join('') + '</tr>').join('') +
          '</tbody></table></div>';
        continue;
      }

      m = line.match(LIST_RE);
      if (m) {
        const baseIndent = m[1].length;
        const ordered = /\d/.test(m[2]);
        const start = ordered ? parseInt(m[2], 10) : 1;
        const items = [];
        while (i < lines.length) {
          const lm = lines[i].match(LIST_RE);
          if (!lm || lm[1].length !== baseIndent || /\d/.test(lm[2]) !== ordered) break;
          let first = lm[3];
          const rest = [];
          i++;
          while (i < lines.length) {
            const l = lines[i];
            if (/^\s*$/.test(l)) {
              // Leerzeile: Liste geht weiter, wenn danach eingerückt/gleichartig fortgesetzt wird
              const nx = lines[i + 1];
              if (nx != null && (/^\s{2,}\S/.test(nx) && (nx.match(/^(\s*)/)[1].length > baseIndent))) { rest.push(''); i++; continue; }
              break;
            }
            const ind = l.match(/^(\s*)/)[1].length;
            if (ind > baseIndent) { rest.push(l.slice(Math.min(ind, baseIndent + 2))); i++; continue; }
            if (LIST_RE.test(l) || isBlockStart(l, lines[i + 1])) break;
            rest.push(l.trim()); // Fortsetzungszeile
            i++;
          }
          let task = null;
          const tm = first.match(/^\[( |x|X)\]\s+(.*)$/);
          if (tm) { task = tm[1] !== ' '; first = tm[2]; }
          const plainRest = [];
          const blockRest = [];
          rest.forEach((r) => (blockRest.length || LIST_RE.test(r) || /^\s*>/.test(r) ? blockRest : plainRest).push(r));
          let inner = inline(first);
          if (plainRest.length) inner += '<br>' + plainRest.map(inline).join('<br>');
          if (blockRest.length) inner += render(blockRest.join('\n'));
          if (task !== null) {
            items.push('<li class="task"><label><input type="checkbox"' + (task ? ' checked' : '') + '><span>' + inner + '</span></label></li>');
          } else {
            items.push('<li>' + inner + '</li>');
          }
        }
        const isTasks = items.length && items.every((x) => x.startsWith('<li class="task"'));
        html += ordered
          ? '<ol' + (start !== 1 ? ' start="' + start + '"' : '') + '>' + items.join('') + '</ol>'
          : '<ul' + (isTasks ? ' class="tasklist"' : '') + '>' + items.join('') + '</ul>';
        continue;
      }

      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !(buf.length && isBlockStart(lines[i], lines[i + 1]))) {
        buf.push(lines[i].trim());
        i++;
      }
      html += '<p>' + buf.map(inline).join('<br>') + '</p>';
    }
    return html;
  }

  /** Markdown in reinen Text umwandeln (für Suche und Textausschnitte) */
  function toPlain(src) {
    if (!src) return '';
    return String(src)
      .replace(/\r\n?/g, '\n')
      .replace(/^\s*>\s?\[![A-Za-zÄÖÜäöü]+\]\s*/gm, '')
      .replace(/^\s*>\s?/gm, '')
      .replace(/^\s*#{1,4}\s+/gm, '')
      .replace(/^\s*([-*•]|\d+[.)])\s+(\[( |x|X)\]\s+)?/gm, '')
      .replace(/^\s*\|?\s*:?-{2,}.*$/gm, '')
      .replace(/^\s*(-{3,}|\*{3,})\s*$/gm, '')
      .replace(/\|/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\[\[([^[\]]+)\]\]/g, '$1')
      .replace(/\{\{Abb:\s*[^{}]+\}\}/g, 'Abb.')
      .replace(/\{\{([^{}]+)\}\}/g, '$1')
      .replace(/(\*\*|==|`)/g, '')
      .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|[.,;:!?]|$)/g, '$1$2')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  PH.md = { render, inline, toPlain, safeUrl, withFigures };
})();
