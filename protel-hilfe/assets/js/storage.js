/*
 * Protel Hilfe – lokale Speicherung im Browser
 *
 * Wissensdatenbank: IndexedDB (große Datenmengen, z. B. Screenshots), Fallback localStorage, sonst nur im Arbeitsspeicher.
 * Einstellungen (Favoriten, Verlauf, Design): localStorage.
 * Alle Schlüssel enthalten einen Hash des App-Ordners, damit mehrere Kopien der App sich nicht gegenseitig überschreiben.
 */
(function () {
  'use strict';
  const PH = (window.PH = window.PH || {});

  const folder = location.pathname.replace(/[^/]*$/, '');
  const NS = 'protelHilfe:' + PH.util.hashStr(location.protocol + '//' + location.host + folder);
  const DB_NAME = 'protel-hilfe';
  const STORE = 'kv';
  const KB_KEY = NS + ':kb';
  const PREFS_KEY = NS + ':prefs';

  let backend = 'memory';
  let memoryKB = null;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB nicht verfügbar'));
      let req;
      try {
        req = indexedDB.open(DB_NAME, 1);
      } catch (e) {
        return reject(e);
      }
      const timer = setTimeout(() => reject(new Error('IndexedDB antwortet nicht')), 4000);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => { clearTimeout(timer); resolve(req.result); };
      req.onerror = () => { clearTimeout(timer); reject(req.error || new Error('IndexedDB-Fehler')); };
      req.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blockiert')); };
    });
    return dbPromise;
  }

  function idb(mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const req = fn(store);
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error || new Error('Speicherfehler'));
      tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen (Speicher voll?)'));
    }));
  }

  function lsGet(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      return null;
    }
  }
  function lsSet(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  /** Ermittelt den verfügbaren Speicher und lädt die lokale Arbeitskopie (oder null). */
  async function loadLocal() {
    try {
      const rec = await idb('readonly', (s) => s.get(KB_KEY));
      backend = 'indexeddb';
      if (rec) return rec;
      // Migration: evtl. früher im localStorage gesichert
      const ls = lsGet(KB_KEY);
      return ls || null;
    } catch (e) {
      console.warn('[Protel Hilfe] IndexedDB nicht nutzbar, verwende localStorage:', e);
      try {
        localStorage.setItem(NS + ':test', '1');
        localStorage.removeItem(NS + ':test');
        backend = 'localstorage';
        return lsGet(KB_KEY);
      } catch (e2) {
        backend = 'memory';
        return memoryKB;
      }
    }
  }

  async function saveLocal(record) {
    if (backend === 'indexeddb') {
      await idb('readwrite', (s) => s.put(record, KB_KEY));
      return;
    }
    if (backend === 'localstorage') {
      try {
        lsSet(KB_KEY, record);
        return;
      } catch (e) {
        throw new Error('Der Browser-Speicher ist voll. Bitte die Wissensdatenbank exportieren und Bilder verkleinern.');
      }
    }
    memoryKB = record;
    throw new Error('Dieser Browser erlaubt keine dauerhafte Speicherung. Änderungen gehen beim Schließen verloren – bitte exportieren.');
  }

  async function clearLocal() {
    memoryKB = null;
    try { localStorage.removeItem(KB_KEY); } catch (e) { /* ignore */ }
    if (backend === 'indexeddb') await idb('readwrite', (s) => s.delete(KB_KEY));
  }

  /* ------------------------------------------------------- Wiederherstellungspunkte
   * Vor riskanten Aktionen (Import, Ersetzen, Umstellung des Datenformats …) wird der bisherige
   * Stand automatisch in der Browser-Datenbank abgelegt. Nur mit IndexedDB möglich (Platzbedarf).
   * Gespeichert werden höchstens MAX_SNAPSHOTS nicht angeheftete Punkte; angeheftete (z. B. vor der
   * Umstellung auf Datenformat 2) bleiben, bis sie von Hand gelöscht werden.
   */
  const SNAP_INDEX = NS + ':snapshots';
  const SNAP_PREFIX = NS + ':snapshot:';
  const MAX_SNAPSHOTS = 5;

  const canSnapshot = () => backend === 'indexeddb';

  async function listSnapshots() {
    if (!canSnapshot()) return [];
    const list = await idb('readonly', (s) => s.get(SNAP_INDEX));
    return Array.isArray(list) ? list : [];
  }

  /**
   * Legt einen Wiederherstellungspunkt an. info: { reason, pinned, schema, revision, articles, images, bytes }
   * Liefert die Metadaten oder null, wenn das hier nicht möglich ist.
   */
  async function saveSnapshot(kb, info) {
    if (!canSnapshot() || !kb) return null;
    info = info || {};
    const meta = {
      id: 'snap-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      createdAt: new Date().toISOString(),
      reason: String(info.reason || 'Automatische Sicherung'),
      pinned: !!info.pinned,
      schema: info.schema || 0,
      revision: info.revision || '',
      articles: info.articles || 0,
      images: info.images || 0,
      bytes: info.bytes || 0,
      tag: info.tag || '',
    };
    let list = await listSnapshots();
    await idb('readwrite', (s) => s.put(kb, SNAP_PREFIX + meta.id));
    list = [meta].concat(list);
    // älteste, nicht angeheftete Punkte entfernen
    const loose = list.filter((x) => !x.pinned);
    const drop = loose.slice(MAX_SNAPSHOTS);
    if (drop.length) {
      const ids = new Set(drop.map((x) => x.id));
      list = list.filter((x) => !ids.has(x.id));
      await idb('readwrite', (s) => { drop.forEach((x) => s.delete(SNAP_PREFIX + x.id)); return null; });
    }
    await idb('readwrite', (s) => s.put(list, SNAP_INDEX));
    return meta;
  }

  async function getSnapshot(id) {
    if (!canSnapshot()) return null;
    return (await idb('readonly', (s) => s.get(SNAP_PREFIX + id))) || null;
  }

  async function deleteSnapshot(id) {
    if (!canSnapshot()) return;
    const list = (await listSnapshots()).filter((x) => x.id !== id);
    await idb('readwrite', (s) => { s.delete(SNAP_PREFIX + id); return s.put(list, SNAP_INDEX); });
  }

  /* ------------------------------------------------------- Einstellungen */
  const DEFAULT_PREFS = {
    theme: '',
    editMode: false,
    favorites: [],
    recent: [],
    views: {},
    searches: {},
    noHits: {},
    history: [],
  };
  let prefsMemory = null;

  function loadPrefs() {
    const p = lsGet(PREFS_KEY) || prefsMemory || {};
    return Object.assign({}, PH.util.clone(DEFAULT_PREFS), p);
  }
  function savePrefs(p) {
    prefsMemory = p;
    try { lsSet(PREFS_KEY, p); } catch (e) { /* Einstellungen sind optional */ }
  }

  PH.store = {
    loadLocal, saveLocal, clearLocal, loadPrefs, savePrefs,
    canSnapshot, listSnapshots, saveSnapshot, getSnapshot, deleteSnapshot, MAX_SNAPSHOTS,
    get backend() { return backend; },
    backendLabel() {
      return { indexeddb: 'Browser-Datenbank (IndexedDB)', localstorage: 'Browser-Speicher (localStorage)', memory: 'Nur Arbeitsspeicher (nicht dauerhaft!)' }[backend];
    },
  };
})();
