/* Protel Hilfe – interaktiver Entscheidungsbaum (Assistent) */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const { esc } = PH.util;
  const icon = PH.icon;

  function mount(el, article, opts) {
    opts = opts || {};
    const tree = article.tree || { start: '', nodes: [] };
    const byId = new Map(tree.nodes.map((n) => [n.id, n]));
    // path: [{id, answer}] – answer = gewählte Antwortbeschriftung des jeweiligen Knotens
    let path = [{ id: tree.start, answer: null }];
    let showOverview = false;

    function linkHtml(id) {
      const a = (opts.resolveArticle || PH.app.getArticle)(id);
      if (!a) return '';
      const t = PH.model.TYPES[a.type];
      return '<a class="dt-link" href="#/artikel/' + encodeURIComponent(a.id) + '">' + icon(t.icon) +
        '<span>' + esc(a.title) + '</span>' + icon('chevronRight', 'chev') + '</a>';
    }

    function renderNode(node, step, anim) {
      const enter = anim ? ' dt-enter' : '';
      if (!node) {
        return '<div class="dt-card dt-missing' + enter + '">' + icon('alert') +
          '<p>Dieser Zweig ist noch nicht ausgearbeitet. Bitte wenden Sie sich an die verantwortliche Person.</p></div>';
      }
      if (node.kind === 'question') {
        return '<div class="dt-card' + enter + '">' +
          '<div class="dt-step">Frage ' + step + '</div>' +
          '<div class="dt-q md">' + PH.md.render(node.text || '_(ohne Text)_') + '</div>' +
          '<div class="dt-answers">' +
          (node.answers.length
            ? node.answers.map((a, i) => '<button type="button" class="dt-answer" data-dt-answer="' + i + '">' +
              '<span>' + esc(a.label || 'Antwort ' + (i + 1)) + '</span>' + icon('arrowRight') + '</button>').join('')
            : '<p class="muted">Für diese Frage sind noch keine Antworten hinterlegt.</p>') +
          '</div></div>';
      }
      const tone = PH.model.TONES[node.tone] || PH.model.TONES.info;
      const links = (node.links || []).map(linkHtml).filter(Boolean).join('');
      return '<div class="dt-card dt-result' + enter + ' tone-' + esc(node.tone || 'info') + '">' +
        '<div class="dt-result-head">' + icon(tone.icon) + '<span>' + (node.tone === 'danger' ? 'Bitte eskalieren' : node.tone === 'warning' ? 'Ergebnis – bitte beachten' : 'Ergebnis') + '</span></div>' +
        '<div class="md">' + PH.md.render(node.text || '_(ohne Text)_') + '</div>' +
        (links ? '<div class="dt-links"><div class="dt-links-title">Passende Artikel</div>' + links + '</div>' : '') +
        '</div>';
    }

    function overview() {
      const visited = new Set();
      function walk(id, depth) {
        const n = byId.get(id);
        if (!n) return '<span class="muted">(fehlender Knoten)</span>';
        if (visited.has(id)) return '<span class="dt-ov-ref">↺ siehe oben: ' + esc(PH.util.truncate(PH.md.toPlain(n.text), 60)) + '</span>';
        visited.add(id);
        if (n.kind === 'result') {
          return '<span class="dt-ov-result tone-' + esc(n.tone) + '">' + icon((PH.model.TONES[n.tone] || {}).icon || 'infoCircle') +
            esc(PH.util.truncate(PH.md.toPlain(n.text), 140)) + '</span>';
        }
        if (depth > 30) return '…';
        return '<span class="dt-ov-q">' + esc(PH.md.toPlain(n.text)) + '</span><ul>' +
          n.answers.map((a) => '<li><span class="dt-ov-a">' + esc(a.label) + '</span> ' + walk(a.next, depth + 1) + '</li>').join('') + '</ul>';
      }
      return '<div class="dt-overview"><ul class="dt-ov-root"><li>' + walk(tree.start, 0) + '</li></ul></div>';
    }

    function render(anim) {
      const cur = path[path.length - 1];
      const node = byId.get(cur.id);
      const history = path.slice(0, -1).map((p, i) => {
        const n = byId.get(p.id);
        return '<li><button type="button" class="dt-crumb" data-dt-back="' + i + '" title="Zu dieser Frage zurückspringen">' +
          '<span class="dt-crumb-q">' + esc(PH.util.truncate(PH.md.toPlain(n ? n.text : ''), 70)) + '</span>' +
          '<span class="dt-crumb-a">' + icon('check') + esc(p.answer) + '</span></button></li>';
      }).join('');
      el.innerHTML =
        '<div class="dt">' +
        (tree.nodes.length ? '' : '<div class="dt-card dt-missing">' + icon('alert') + '<p>Dieser Entscheidungsbaum ist noch leer.</p></div>') +
        (history ? '<ol class="dt-path" aria-label="Bisherige Antworten">' + history + '</ol>' : '') +
        (tree.nodes.length ? renderNode(node, path.length, anim) : '') +
        '<div class="dt-controls">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-dt="back"' + (path.length < 2 ? ' disabled' : '') + '>' + icon('arrowLeft') + 'Zurück</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-dt="restart"' + (path.length < 2 ? ' disabled' : '') + '>' + icon('refresh') + 'Neu starten</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-dt="overview" aria-expanded="' + showOverview + '">' + icon('tree') + (showOverview ? 'Übersicht ausblenden' : 'Gesamten Ablauf anzeigen') + '</button>' +
        '</div>' +
        (showOverview ? overview() : '') +
        '</div>';
    }

    el.addEventListener('click', (e) => {
      const ans = e.target.closest('[data-dt-answer]');
      if (ans) {
        const cur = path[path.length - 1];
        const node = byId.get(cur.id);
        const a = node && node.answers[+ans.dataset.dtAnswer];
        if (!a) return;
        cur.answer = a.label || 'Antwort';
        path.push({ id: a.next, answer: null });
        render(true);
        focusCard();
        return;
      }
      const back = e.target.closest('[data-dt-back]');
      if (back) {
        path = path.slice(0, +back.dataset.dtBack + 1);
        path[path.length - 1].answer = null;
        render(true);
        focusCard();
        return;
      }
      const ctl = e.target.closest('[data-dt]');
      if (!ctl) return;
      if (ctl.dataset.dt === 'back' && path.length > 1) {
        path.pop();
        path[path.length - 1].answer = null;
      } else if (ctl.dataset.dt === 'restart') {
        path = [{ id: tree.start, answer: null }];
      } else if (ctl.dataset.dt === 'overview') {
        showOverview = !showOverview;
      }
      render();
    });

    function focusCard() {
      const first = el.querySelector('.dt-answer, .dt-result, .dt-missing');
      if (first && first.focus) {
        if (!first.matches('button')) first.setAttribute('tabindex', '-1');
        first.focus({ preventScroll: true });
      }
      const card = el.querySelector('.dt-card');
      if (card) {
        const r = card.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    render();
  }

  PH.tree = { mount };
})();
