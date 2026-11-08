/* Protel Hilfe – Hilfsfunktionen und UI-Bausteine (Toast, Dialoge) */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC[c]);
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      const self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  }

  const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

  const fmtD = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fmtDT = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  function fmtDate(iso, withTime) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '–';
    return (withTime ? fmtDT : fmtD).format(d);
  }

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'gerade eben';
    if (diff < 3600) return 'vor ' + Math.round(diff / 60) + ' Min.';
    if (diff < 86400) return 'vor ' + Math.round(diff / 3600) + ' Std.';
    const days = Math.round(diff / 86400);
    if (days === 1) return 'gestern';
    if (days < 31) return 'vor ' + days + ' Tagen';
    return 'am ' + fmtD.format(d);
  }

  function slugify(s) {
    const out = String(s || '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
    return out || 'artikel';
  }

  function formatBytes(n) {
    if (!n && n !== 0) return '–';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' KB';
    return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }

  function truncate(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  /** Datei-Download über Blob-URL – funktioniert auch unter file:// */
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
  }

  function readFile(file, as) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('Datei konnte nicht gelesen werden.'));
      if (as === 'dataurl') r.readAsDataURL(file);
      else r.readAsText(file, 'utf-8');
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) { /* Fallback unten */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) {
      return false;
    }
  }

  /** Einfacher, stabiler Hash (für Speicherschlüssel je App-Ordner) */
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function getPath(obj, path) {
    return String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function setPath(obj, path, value) {
    const keys = String(path).split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      o = o[k];
    }
    o[keys[keys.length - 1]] = value;
  }

  /* ------------------------------------------------------------ Umgebung */
  const ua = navigator.userAgent || '';
  const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const env = {
    /** PC-Version per Doppelklick (file://) */
    isFile: location.protocol === 'file:',
    /** Über eine Website (https:// bzw. localhost) geöffnet */
    isWeb: /^https?:$/.test(location.protocol),
    /** Service Worker möglich (sicherer Kontext) */
    canOffline: 'serviceWorker' in navigator && (location.protocol === 'https:' || (location.protocol === 'http:' && isLocalHost)),
    /** iPhone, iPod oder iPad (iPadOS meldet sich als „Macintosh“ mit Touch) */
    isAppleMobile: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
    isTouch: (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0,
    isStandalone() {
      return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    },
    /** Bezeichnung der mitgelieferten Datenquelle für Hinweistexte */
    sourceLabel() {
      return this.isFile ? 'App-Ordner' : 'veröffentlichten Version';
    },
  };
  PH.env = env;

  /**
   * Datei speichern. Auf iPhone/iPad über das Teilen-Menü („In Dateien sichern“, AirDrop, Mail …),
   * sonst als Download. Ergebnis (Promise): 'shared' | 'downloaded' | 'cancelled'.
   * Muss direkt aus einer Tipp-/Klick-Aktion aufgerufen werden.
   */
  function saveFile(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    if (env.isAppleMobile && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
      try {
        const file = new File([blob], filename, { type: (mime || blob.type || 'application/octet-stream').split(';')[0] });
        if (navigator.canShare({ files: [file] })) {
          return navigator.share({ files: [file] }).then(
            () => 'shared',
            (err) => {
              if (err && err.name === 'AbortError') return 'cancelled';
              download(filename, blob);
              return 'downloaded';
            }
          );
        }
      } catch (e) { /* weiter mit Download */ }
    }
    download(filename, blob);
    return Promise.resolve('downloaded');
  }

  PH.util = {
    esc, $, $$, uid, debounce, clone, fmtDate, relTime, slugify, formatBytes, truncate,
    download, saveFile, readFile, copyText, hashStr, getPath, setPath,
  };

  /* ---------------------------------------------------------------- UI */

  function toast(message, type, opts) {
    opts = opts || {};
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const ic = { success: 'checkCircle', error: 'xCircle', warning: 'alert', info: 'infoCircle' }[type || 'info'];
    el.innerHTML =
      PH.icon(ic) + '<div class="toast-msg">' + esc(message) + '</div>' +
      (opts.action ? '<button type="button" class="toast-action">' + esc(opts.action.label) + '</button>' : '') +
      '<button type="button" class="toast-close" aria-label="Schließen">' + PH.icon('x') + '</button>';
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const close = () => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    };
    el.querySelector('.toast-close').addEventListener('click', close);
    if (opts.action) {
      el.querySelector('.toast-action').addEventListener('click', () => {
        close();
        opts.action.onClick();
      });
    }
    setTimeout(close, opts.timeout || (type === 'error' ? 7000 : 3800));
  }

  /**
   * Modaler Dialog. buttons: [{label, value, kind:'primary'|'danger'|'secondary'|'ghost', autofocus}]
   * value darf eine Funktion (dialogElement) => Ergebnis sein.
   */
  function dialog(opts) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal' + (opts.wide ? ' modal-wide' : '');
      const buttons = opts.buttons || [{ label: 'OK', value: true, kind: 'primary' }];
      dlg.innerHTML =
        '<div class="modal-inner">' +
        '<header class="modal-head"><h2>' + esc(opts.title || '') + '</h2>' +
        '<button type="button" class="icon-btn" data-close aria-label="Schließen">' + PH.icon('x') + '</button></header>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        '<footer class="modal-foot">' +
        buttons.map((b, i) =>
          '<button type="button" class="btn btn-' + (b.kind || 'secondary') + '" data-i="' + i + '"' +
          (b.autofocus ? ' autofocus' : '') + '>' + (b.icon ? PH.icon(b.icon) : '') + esc(b.label) + '</button>'
        ).join('') +
        '</footer></div>';
      document.body.appendChild(dlg);
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        try { dlg.close(); } catch (e) { /* ignore */ }
        dlg.remove();
        resolve(v);
      };
      dlg.addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]');
        if (b && dlg.contains(b)) {
          const def = buttons[+b.dataset.i];
          const v = typeof def.value === 'function' ? def.value(dlg) : def.value;
          if (v === undefined && def.keepOpen) return;
          finish(v);
          return;
        }
        if (e.target.closest('[data-close]') || e.target === dlg) finish(null);
      });
      dlg.addEventListener('cancel', (e) => {
        e.preventDefault();
        finish(null);
      });
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      if (opts.onOpen) opts.onOpen(dlg, finish);
    });
  }

  function confirmDialog(opts) {
    return dialog({
      title: opts.title || 'Bitte bestätigen',
      body: '<p>' + (opts.html || esc(opts.message || '')) + '</p>',
      buttons: [
        { label: opts.cancelLabel || 'Abbrechen', value: false, kind: 'secondary' },
        { label: opts.okLabel || 'OK', value: true, kind: opts.danger ? 'danger' : 'primary', autofocus: true },
      ],
    }).then((v) => v === true);
  }

  PH.ui = { toast, dialog, confirm: confirmDialog };
})();
