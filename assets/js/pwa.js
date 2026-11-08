/*
 * Protel Hilfe – Progressive Web App (nur bei Aufruf über https:// bzw. localhost)
 *
 * - registriert den Service Worker (Offline-Betrieb)
 * - meldet neue App-Versionen und neue Inhalte, aktualisiert erst nach Bestätigung
 * - zeigt den Verbindungsstatus und einen Installationshinweis für iPhone/iPad
 * - bittet den Browser um dauerhaften Speicher, damit lokale Bearbeitungen erhalten bleiben
 *
 * Unter file:// (PC-Version) wird nichts davon aktiv.
 */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});
  const env = PH.util ? PH.env : {};
  const icon = (n) => (PH.icon ? PH.icon(n) : '');

  const st = {
    reg: null,
    error: '',
    waiting: null,
    reloading: false,
    offlineReady: false,
    lastCheck: 0,
    info: null,
    deferredInstall: null,
  };
  const listeners = new Set();
  const changed = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });

  /* ------------------------------------------------------------ Hinweisleiste */

  function bar(kind, html, actions) {
    const el = document.getElementById('app-bar');
    if (!el) return;
    if (!html) {
      if (!kind || el.dataset.kind === kind) { el.hidden = true; el.innerHTML = ''; el.dataset.kind = ''; }
      return;
    }
    el.dataset.kind = kind;
    el.className = 'app-bar app-bar-' + kind;
    el.innerHTML = '<span class="app-bar-text">' + html + '</span><span class="app-bar-actions">' +
      actions.map((a, i) => '<button type="button" class="btn btn-sm ' + (a.primary ? 'btn-primary' : 'btn-ghost') + '" data-bar="' + i + '">' + a.label + '</button>').join('') +
      '</span>';
    el.hidden = false;
    el.onclick = (e) => {
      const b = e.target.closest('[data-bar]');
      if (b) actions[+b.dataset.bar].run();
    };
  }

  async function confirmLeave() {
    if (!PH.app || !PH.app.hasUnsavedChanges || !PH.app.hasUnsavedChanges()) return true;
    return PH.ui.confirm({
      title: 'Ungespeicherte Änderungen',
      message: 'Zum Aktualisieren wird die App neu geladen. Ungespeicherte Änderungen gehen dabei verloren. Trotzdem fortfahren?',
      okLabel: 'Neu laden', cancelLabel: 'Abbrechen', danger: true,
    });
  }

  function onWaiting(worker) {
    st.waiting = worker;
    changed();
    bar('update', icon('refresh') + '<span><strong>Neue Version verfügbar.</strong> Ihre Daten bleiben erhalten.</span>', [
      { label: 'Später', run: () => bar('update') },
      { label: 'Aktualisieren', primary: true, run: applyUpdate },
    ]);
  }

  async function applyUpdate() {
    if (!st.waiting) return;
    if (!(await confirmLeave())) return;
    if (PH.app && PH.app.setLeaveGuard) PH.app.setLeaveGuard(null);
    st.reloading = true;
    st.waiting.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(() => location.reload(), 4000); // Rückfall, falls „controllerchange“ ausbleibt
  }

  function onDataUpdated() {
    bar('data', icon('database') + '<span><strong>Neue Inhalte der Wissensdatenbank verfügbar.</strong></span>', [
      { label: 'Später', run: () => bar('data') },
      {
        label: 'Jetzt laden', primary: true,
        run: async () => {
          if (!(await confirmLeave())) return;
          if (PH.app && PH.app.setLeaveGuard) PH.app.setLeaveGuard(null);
          location.reload();
        },
      },
    ]);
  }

  /* ------------------------------------------------------------ Service Worker */

  function register() {
    const sw = navigator.serviceWorker;
    sw.addEventListener('controllerchange', () => {
      if (st.reloading) location.reload();
    });
    sw.addEventListener('message', (e) => {
      const m = e.data || {};
      if (m.type === 'DATA_UPDATED') onDataUpdated();
      if (m.type === 'INFO' || m.type === 'RECACHED') {
        st.info = m;
        changed();
      }
    });
    const hadController = !!sw.controller;
    sw.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
      st.reg = reg;
      if (reg.waiting && sw.controller) onWaiting(reg.waiting);
      if (reg.active && sw.controller) st.offlineReady = true;
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed') {
            if (sw.controller) onWaiting(nw);
          } else if (nw.state === 'activated' && !hadController) {
            st.offlineReady = true;
            changed();
            if (PH.ui) PH.ui.toast('Offline bereit: Protel Hilfe funktioniert jetzt auch ohne Internet.', 'success', { timeout: 6000 });
          }
        });
      });
      st.lastCheck = Date.now();
      changed();
      requestInfo();
    }).catch((err) => {
      st.error = (err && err.message) || String(err);
      console.warn('[Protel Hilfe] Service Worker nicht verfügbar:', err);
      changed();
    });

    // Regelmäßig nach Updates sehen, wenn die App wieder in den Vordergrund kommt
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Date.now() - st.lastCheck > 30 * 60 * 1000) checkForUpdates(true);
    });
  }

  function requestInfo() {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (c) c.postMessage({ type: 'GET_INFO' });
  }

  /** Sucht nach neuer App-Version und neuen Inhalten. Ergebnis: Promise<'update'|'none'|'offline'|'unsupported'> */
  async function checkForUpdates(silent) {
    if (!st.reg) return 'unsupported';
    if (!navigator.onLine) return 'offline';
    st.lastCheck = Date.now();
    try {
      await st.reg.update();
      // Inhalte prüfen (der Service Worker vergleicht im Hintergrund und meldet Änderungen)
      fetch('data/wissensdatenbank.js', { cache: 'no-cache' }).catch(() => {});
    } catch (e) {
      if (!silent && PH.ui) PH.ui.toast('Prüfung nicht möglich: ' + e.message, 'warning');
      return 'offline';
    }
    await new Promise((r) => setTimeout(r, 1500));
    changed();
    return st.reg.installing || st.reg.waiting ? 'update' : 'none';
  }

  function recache() {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!c) return false;
    c.postMessage({ type: 'RECACHE' });
    return true;
  }

  /* ------------------------------------------------------------ Speicher, Netz, Installation */

  async function storageInfo() {
    const out = { persisted: null, usage: null, quota: null };
    try {
      if (navigator.storage && navigator.storage.persisted) out.persisted = await navigator.storage.persisted();
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        out.usage = e.usage;
        out.quota = e.quota;
      }
    } catch (e) { /* nicht unterstützt */ }
    return out;
  }

  async function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) {
        await navigator.storage.persist();
      }
    } catch (e) { /* optional */ }
  }

  function updateNet(initial) {
    const pill = document.getElementById('net-pill');
    const off = !navigator.onLine;
    if (pill) pill.hidden = !off;
    if (initial || !PH.ui) return;
    if (off) PH.ui.toast('Keine Internetverbindung – Protel Hilfe arbeitet mit den gespeicherten Daten weiter.', 'info', { timeout: 4500 });
    else {
      PH.ui.toast('Wieder online.', 'success', { timeout: 2000 });
      checkForUpdates(true);
    }
  }

  function installHint() {
    const el = document.getElementById('install-hint');
    if (!el || env.isStandalone()) return;
    const prefs = PH.app && PH.app.prefs;
    if (prefs && prefs.installHintHidden) return;
    try { if (sessionStorage.getItem('ph-install-later')) return; } catch (e) { /* ignore */ }
    let text = '';
    if (env.isAppleMobile) {
      text = '<strong>Als App installieren:</strong> In Safari auf <span class="ios-share" aria-label="Teilen">' + shareGlyph() +
        '</span> <em>Teilen</em> tippen (je nach Ansicht zuerst auf „•••“), dann <em>„Zum Home-Bildschirm“</em>. So ist Protel Hilfe offline nutzbar und Ihre Daten bleiben dauerhaft gespeichert.';
    } else if (st.deferredInstall) {
      text = '<strong>Als App installieren</strong> – startet wie eine eigene App und funktioniert offline.';
    } else return;
    el.innerHTML = '<span class="ih-icon">' + icon('download') + '</span><span class="ih-text">' + text + '</span>' +
      '<span class="ih-actions">' +
      (st.deferredInstall ? '<button type="button" class="btn btn-primary btn-sm" data-ih="install">Installieren</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm" data-ih="later">Später</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-ih="never">Nicht mehr zeigen</button></span>';
    el.hidden = false;
    el.onclick = async (e) => {
      const b = e.target.closest('[data-ih]');
      if (!b) return;
      if (b.dataset.ih === 'install' && st.deferredInstall) {
        st.deferredInstall.prompt();
        try { await st.deferredInstall.userChoice; } catch (err) { /* ignore */ }
        st.deferredInstall = null;
      }
      if (b.dataset.ih === 'later') { try { sessionStorage.setItem('ph-install-later', '1'); } catch (err) { /* ignore */ } }
      if (b.dataset.ih === 'never' && PH.app) { PH.app.prefs.installHintHidden = true; PH.app.savePrefs(); }
      el.hidden = true;
    };
  }

  function shareGlyph() {
    return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  }

  /* ------------------------------------------------------------ Start */

  function init() {
    if (env.isStandalone && env.isStandalone()) document.documentElement.classList.add('standalone');
    if (!env.isWeb) return; // PC-Version (file://): keine PWA-Funktionen
    updateNet(true);
    window.addEventListener('online', () => updateNet(false));
    window.addEventListener('offline', () => updateNet(false));
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      st.deferredInstall = e;
      installHint();
    });
    window.addEventListener('appinstalled', () => {
      const el = document.getElementById('install-hint');
      if (el) el.hidden = true;
    });
    if (env.canOffline) {
      register();
      requestPersistence();
    }
    setTimeout(installHint, 1200);
  }

  PH.pwa = {
    get active() { return !!env.canOffline; },
    status() {
      const c = navigator.serviceWorker && navigator.serviceWorker.controller;
      return {
        supported: !!env.canOffline,
        registered: !!st.reg,
        controlled: !!c,
        offlineReady: st.offlineReady || !!c,
        updateWaiting: !!st.waiting,
        error: st.error,
        info: st.info,
        standalone: env.isStandalone ? env.isStandalone() : false,
        online: navigator.onLine,
      };
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    requestInfo, checkForUpdates, recache, storageInfo, applyUpdate,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
