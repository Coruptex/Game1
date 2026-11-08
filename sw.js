/*
 * Protel Hilfe – Service Worker
 *
 * Wird nur beim Aufruf über https:// (bzw. http://localhost) registriert.
 * Die PC-Version unter file:// verwendet ihn nicht und funktioniert unverändert.
 *
 * Strategie
 *  - App-Dateien: versionierter Vorab-Cache (cache-first). Eine neue App-Version wird im Hintergrund
 *    vollständig geladen und erst aktiviert, wenn die Person in der App auf „Aktualisieren“ tippt.
 *  - Wissensdatenbank (data/wissensdatenbank.js): sofort aus dem Cache, parallel Abgleich mit dem Server.
 *    Bei geänderten Inhalten wird die App benachrichtigt.
 *  - Weitere Dateien derselben Website im Gültigkeitsbereich (z. B. verlinkte Bilder): beim ersten Abruf zwischengespeichert.
 *  - Keine Anfragen an fremde Server. Lokale Bearbeitungen liegen in IndexedDB und werden hier nie verändert oder gelöscht.
 */
'use strict';

// <<PWA-BUILD>> – automatisch gepflegt von tools/build-pwa.js (nicht von Hand ändern)
const VERSION = 'db136ad42f46';
const ASSETS = [
  'assets/css/app.css',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/icon.svg',
  'assets/js/admin.js',
  'assets/js/app.js',
  'assets/js/editor.js',
  'assets/js/icons.js',
  'assets/js/markdown.js',
  'assets/js/model.js',
  'assets/js/pwa.js',
  'assets/js/search.js',
  'assets/js/storage.js',
  'assets/js/tree.js',
  'assets/js/util.js',
  'assets/js/views.js',
  'data/wissensdatenbank.js',
  'index.html',
  'manifest.webmanifest',
];
// <</PWA-BUILD>>

const SCOPE = self.registration.scope;
const PREFIX = 'protel-hilfe-' + hashStr(new URL(SCOPE).pathname) + '-';
const CACHE = PREFIX + 'app-' + VERSION;
const RUNTIME = PREFIX + 'dateien';
const DATA_URL = new URL('data/wissensdatenbank.js', SCOPE).href;
const INDEX_URL = new URL('index.html', SCOPE).href;

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const abs = (u) => new URL(u, SCOPE).href;

/* ------------------------------------------------------------ Installation */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS.map((u) => new Request(abs(u), { cache: 'reload' }))))
  );
  // Kein skipWaiting(): eine neue Version wird erst nach Bestätigung in der App aktiv (keine Unterbrechung beim Bearbeiten).
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Nur alte App-Versionen dieser Installation entfernen – niemals Caches anderer Apps oder Nutzerdaten
    await Promise.all(keys.filter((k) => k.startsWith(PREFIX + 'app-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* ------------------------------------------------------------ Nachrichten der App */

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  const reply = (data) => { if (event.source) event.source.postMessage(data); };
  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (msg.type === 'GET_INFO') {
    event.waitUntil(cacheInfo().then((info) => reply(Object.assign({ type: 'INFO' }, info))));
  } else if (msg.type === 'RECACHE') {
    event.waitUntil(
      caches.open(CACHE)
        .then((cache) => cache.addAll(ASSETS.map((u) => new Request(abs(u), { cache: 'reload' }))))
        .then(cacheInfo)
        .then((info) => reply(Object.assign({ type: 'RECACHED', ok: true }, info)))
        .catch((err) => reply({ type: 'RECACHED', ok: false, error: String(err && err.message || err) }))
    );
  }
});

async function cacheInfo() {
  const cache = await caches.open(CACHE);
  const keys = await cache.keys();
  const rt = await caches.open(RUNTIME);
  const rtKeys = await rt.keys();
  const have = new Set(keys.map((r) => r.url));
  const missing = ASSETS.filter((u) => !have.has(abs(u)));
  return { version: VERSION, files: keys.length, expected: ASSETS.length, missing, runtimeFiles: rtKeys.length };
}

async function notifyClients(msg) {
  const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  list.forEach((c) => c.postMessage(msg));
}

/* ------------------------------------------------------------ Abrufe */

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(SCOPE)) return; // fremde Server und andere Pfade nie anfassen
  const url = new URL(req.url);
  url.hash = '';
  url.search = '';
  if (url.href === DATA_URL) {
    event.respondWith(handleData(event));
  } else if (req.mode === 'navigate' && (url.pathname.endsWith('/') || url.pathname.endsWith('.html'))) {
    event.respondWith(handleNavigate(req));
  } else {
    event.respondWith(handleAsset(req, url.href));
  }
});

async function handleNavigate(req) {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(req, { ignoreSearch: true })) || (await cache.match(INDEX_URL));
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Protel Hilfe – offline</title><body style="font-family:system-ui;padding:2rem;line-height:1.5">' +
      '<h1>Protel Hilfe ist noch nicht offline verfügbar</h1><p>Bitte einmal mit Internetverbindung öffnen. ' +
      'Danach funktioniert die App auch ohne Netz.</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function handleAsset(req, key) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(key);
  if (hit) return hit;
  const rt = await caches.open(RUNTIME);
  const rtHit = await rt.match(key);
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') rt.put(key, res.clone()).catch(() => {});
    return res;
  });
  if (rtHit) {
    network.catch(() => {});
    return rtHit;
  }
  try {
    return await network;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Offline – Datei nicht im Speicher' });
  }
}

/** Wissensdatenbank: sofort aus dem Cache, im Hintergrund aktualisieren und App benachrichtigen */
async function handleData(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(DATA_URL);
  const cachedCopy = cached ? cached.clone() : null;
  const update = (async () => {
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res || !res.ok) return null;
      const text = await res.clone().text();
      const oldText = cachedCopy ? await cachedCopy.text() : null;
      if (text !== oldText) {
        await cache.put(DATA_URL, res.clone());
        if (oldText !== null) await notifyClients({ type: 'DATA_UPDATED' });
      }
      return res;
    } catch (e) {
      return null;
    }
  })();
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  const res = await update;
  return res || new Response('/* Protel Hilfe: Wissensdatenbank offline nicht verfügbar */', {
    status: 503, headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
  });
}
