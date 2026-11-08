# Protel Hilfe – Offline-Wissensdatenbank für die Hotelrezeption

**Protel Hilfe** ist eine eigenständige Web-App, die vollständig offline im Browser läuft.
Sie dient als interne Wissensdatenbank für die Rezeption: Anleitungen, Fehlerbehebung,
Entscheidungsbäume und Nachschlagewissen, durchsuchbar mit einer fehlertoleranten Volltextsuche.

> **Prototyp mit Beispieldaten.** Alle als „Beispiel“ markierten Inhalte sind fiktive Muster und
> **keine** offiziellen oder geprüften protel-Bedienungsanleitungen. Konkrete Arbeitsschritte in
> protel sind als gelbe Platzhalter `[[…]]` markiert und müssen intern ergänzt werden.
> Protel Hilfe ist kein Produkt des protel-Herstellers und hat keine Verbindung zu protel-Systemen.

## Zwei Betriebsarten – derselbe Ordner

| | PC-Version | iPhone/iPad-App (PWA) |
|---|---|---|
| **Start** | `protel-hilfe/index.html` doppelklicken (Edge, Chrome) | Website-Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“ |
| **Adresse** | `file://…/protel-hilfe/index.html` | **https://coruptex.github.io/Game1/** (GitHub Pages) |
| **Offline** | immer (lokale Dateien) | nach dem ersten Laden vollständig (Service Worker) |
| **Datenquelle** | `data/wissensdatenbank.js` im Ordner | `data/wissensdatenbank.js` der Website, danach offline gespeichert |
| **Eigene Änderungen** | im Browser des PCs | auf dem Gerät (in der installierten App) |

Keine Installation, keine Server-Software, keine Cloud-Dienste, keine KI und keine Verbindung zu protel – weder auf dem PC noch auf dem iPhone/iPad.
Alle Ressourcen (Skripte, Design, Symbole, Beispielbilder) liegen im Ordner; zur Laufzeit werden keine fremden Server angesprochen.

## Funktionen

| Bereich | Umfang |
|---|---|
| **Volltextsuche** | Sofortergebnisse beim Tippen (`Strg+K` bzw. `/`). Relevanzsortierung nach BM25 mit Feldgewichten (Titel > Schlagwörter/Fehlermeldungen > Kurzbeschreibung > Text). Pflegbare **Synonyme** („Abreise“ findet „Check-out“). **Tippfehlertoleranz** per Damerau-Levenshtein mit „Meinten Sie …?“. Deutsche Wortformen und Wortteile („storniert“ → „stornieren“, „Karte“ → „Kreditkarte“). Filter nach Typ und Kategorie, Treffer werden im Artikel markiert. |
| **Kategorien** | Frei anlegbar, mit Symbol, Farbe und Beschreibung. |
| **Anleitungen** | Schritt für Schritt, mit Screenshots und nummerierten Markierungen. Schritte lassen sich als „erledigt“ abhaken. Bilder öffnen sich per Klick vergrößert. |
| **Fehlerbehebung** | Fehlermeldungen (kopierbar), Symptome, Ursachen mit „Prüfen“ und „Lösung“ als geführter Ablauf („Problem gelöst“ / „Hat nicht geholfen“) sowie Eskalation. |
| **Entscheidungsbäume** | Interaktive Assistenten mit Fragen, Antworten und Ergebnissen, dazu Pfadanzeige, Zurück-Funktion und Gesamtübersicht. Der Editor prüft, ob alle Knoten verknüpft und erreichbar sind. |
| **Bearbeiten** | Editor mit Formatierungsleiste und Vorschau. Screenshots lassen sich per `Strg+V` oder Drag & Drop einfügen und werden automatisch verkleinert. Artikel können dupliziert und gelöscht werden; die App warnt vor dem Verlassen mit ungespeicherten Änderungen. |
| **Import/Export** | Export der `wissensdatenbank.js` für den App-Ordner, JSON-Sicherung, Import mit Vorschau zum Zusammenführen oder Ersetzen. |
| **Pflege** | Die Verwaltung zeigt Suchanfragen ohne Treffer, Artikel mit offenen Platzhaltern, unvollständige Entscheidungsbäume und veraltete Artikel. Dazu kommen ein Suchtest und ein Synonym-Editor. |
| **Komfort** | Favoriten, zuletzt angesehene Artikel, Druckansicht, Hell- und Dunkelmodus, responsives Layout (Desktop, Tablet, Smartphone) und Tastaturbedienung. |
| **iPhone/iPad** | Installierbar auf dem Home-Bildschirm, vollständig offline (Suche, Anleitungen, Bilder). Tab-Leiste und Zurück-Pfeil, Touch-Ziele ab 44 px, Safe Areas (Notch, Home-Indikator). Export über das Teilen-Menü („In Dateien sichern“, AirDrop), Import aus „Dateien“, Bilder aus Fotos, Kamera oder Zwischenablage. Hinweise bei neuer App-Version oder neuen Inhalten – aktualisiert wird erst nach Bestätigung. |

## Daten: Speicherung und Verteilung

- Die Inhalte stammen aus **`protel-hilfe/data/wissensdatenbank.js`**. Die Datei wird per `<script>` geladen, weil `fetch()` unter `file://` nicht funktioniert.
- Änderungen in der App werden zunächst **lokal im Browser** dieses PCs gespeichert (IndexedDB, ersatzweise localStorage).
  Die Speicherschlüssel enthalten den Ordnerpfad, sodass sich mehrere Kopien der App nicht gegenseitig überschreiben.
- **Verteilen:** *Verwaltung → Für App-Ordner exportieren* lädt eine neue `wissensdatenbank.js` herunter. Mit ihr ersetzen Sie die Datei im Ordner `data`.
  Alle PCs sehen den neuen Stand nach dem Neuladen.
- Hat ein PC noch nicht exportierte eigene Änderungen und liegt im Ordner eine andere Version, fragt die App beim Start, welche Version gelten soll.
  Dabei kann sie vorher eine Sicherung anbieten.
- Wenn die Browserdaten gelöscht werden, gehen auch lokale, nicht exportierte Änderungen verloren. Deshalb regelmäßig exportieren.

Datenschutz: Bitte keine personenbezogenen Gästedaten, Passwörter oder Kartendaten in Artikel oder Screenshots aufnehmen.

### Auf iPhone und iPad

- **Einmal online öffnen, dann installieren:** Safari → Teilen (ggf. über „•••“) → „Zum Home-Bildschirm“. Danach funktioniert die App ohne Netz.
- **Getrennte Speicher:** Safari und die installierte App speichern getrennt. Bitte nur in der installierten App bearbeiten.
  Die App fordert dauerhaften Speicher an. Trotzdem regelmäßig sichern: Beim Löschen der App oder der Website-Daten gehen lokale Änderungen verloren.
- **Sicherung und Übertragung:** *Verwaltung → Sicherung exportieren* öffnet das Teilen-Menü. Auf dem anderen Gerät *Verwaltung → Importieren*. Die App erinnert an eine Sicherung, wenn eigene Änderungen nur auf dem Gerät liegen.
- **Updates:** Eine neue App-Version wird im Hintergrund geladen und erst nach Tippen auf „Aktualisieren“ aktiv. Neue Inhalte der veröffentlichten Wissensdatenbank werden gemeldet; eigene Änderungen werden nie stillschweigend überschrieben (Rückfrage mit Sicherungsangebot).
- **PC → iPhone:** Auf dem PC eine Sicherung (.json) exportieren, z. B. per Mail/Cloud-Ordner aufs iPhone bringen und in der App importieren (Zusammenführen).

## Veröffentlichung (GitHub Pages, kostenlos)

- Die Website ist der Inhalt von `protel-hilfe/` im Branch **`gh-pages`** (nur fertige Dateien, inkl. `.nojekyll`).
- GitHub Pages hat sich beim ersten Anlegen des Branches `gh-pages` automatisch eingeschaltet. Falls die Website einmal nicht erreichbar ist,
  im Repository prüfen: **Settings → Pages → Source: „Deploy from a branch“ → Branch `gh-pages`, Ordner `/ (root)`.**
- Neue Version veröffentlichen: Änderungen committen, dann `tools/deploy-gh-pages.sh` (prüft die PWA-Dateiliste und überträgt `protel-hilfe/` nach `gh-pages`).
- Nach Änderungen an App-Dateien vorher `node tools/build-pwa.js` ausführen (aktualisiert Dateiliste und Versionskennung im Service Worker).

**Geprüfte Bedingungen (GitHub-Doku, Stand 08.11.2026):** GitHub Pages ist für öffentliche Repositories mit GitHub Free kostenlos, ohne Zahlungsdaten.
Limits: Website max. 1 GB, weiches Bandbreitenlimit 100 GB/Monat, Deployments max. 10 Minuten. HTTPS ist für `github.io` automatisch aktiv.
Nicht erlaubt ist der Betrieb als kostenloses Hosting für ein Online-Geschäft, E-Commerce oder SaaS; eine interne Nachschlage-App ohne Bezahlfunktionen fällt nicht darunter.
**Pages-Sites sind auf Free-Plänen immer öffentlich im Internet erreichbar** – deshalb werden nur die Beispieldaten veröffentlicht.
Vertrauliche interne Inhalte gehören nicht auf die öffentliche Website, sondern werden auf den Geräten per Import gepflegt (sie bleiben dann lokal).

### Portabilität / Anbieterwechsel

Die Website besteht ausschließlich aus statischen Dateien mit relativen Pfaden und funktioniert in jedem Unterordner und bei jedem Anbieter für statische Websites
mit HTTPS (z. B. Cloudflare Pages, Netlify, Codeberg Pages, eigener Webspace). Für einen Wechsel genügt es, den Inhalt von `protel-hilfe/`
(bzw. den Branch `gh-pages` als ZIP) hochzuladen. Es gibt keinen Build-Zwang, keine Datenbank und keine Server-Abhängigkeiten.
Da Browser-Speicher an die Adresse gebunden ist, eigene Änderungen vor einem Umzug als Sicherung exportieren und unter der neuen Adresse importieren.

## Projektstruktur

```
protel-hilfe/
├── index.html                 Einstiegspunkt (Doppelklick bzw. Website)
├── manifest.webmanifest       Web-App-Manifest (Name, Symbole, Startverhalten)
├── sw.js                      Service Worker für den Offline-Betrieb (nur über https://)
├── .nojekyll                  GitHub Pages: Dateien unverändert ausliefern
├── LIESMICH.txt               Kurzanleitung für den Betrieb
├── data/
│   └── wissensdatenbank.js    Wissensdatenbank (Beispieldaten, über die App exportierbar)
└── assets/
    ├── css/app.css            Gestaltung (Hell/Dunkel, responsiv, Touch, Druck)
    ├── icons/                 App-Symbole (PNG für iOS/Android, SVG-Vorlage)
    └── js/
        ├── util.js            Hilfsfunktionen, Toasts, Dialoge
        ├── icons.js           Inline-SVG-Symbole
        ├── markdown.js        sicherer Markdown-Renderer (escaped jede Eingabe)
        ├── model.js           Datenmodell, Validierung, Import/Export, Zusammenführen
        ├── storage.js         IndexedDB / localStorage
        ├── search.js          Suchindex: BM25F, Stemming, Synonyme, Tippfehler
        ├── tree.js            Entscheidungsbaum-Assistent
        ├── views.js           Ansichten (Start, Listen, Suche, Artikel, Hilfe)
        ├── editor.js          Artikel-Editor
        ├── admin.js           Verwaltung
        ├── app.js             Start, Routing, Navigation, Speichern
        └── pwa.js             Offline-App: Service Worker, Updates, Installationshinweis
tools/
├── build-pwa.js               aktualisiert Dateiliste und Version in sw.js (Node, ohne Abhängigkeiten)
└── deploy-gh-pages.sh         veröffentlicht protel-hilfe/ im Branch gh-pages
recherche/
└── phase-1/                   Quellen- und Themenanalyse Protel Cloud PMS (nicht Teil der App)
```

**Recherche-Unterlagen:** `recherche/phase-1/` enthält die Quellen- und Themenanalyse vom 08.11.2026. Dazu gehören Abschlussbericht, Themenkatalog, Quellenverzeichnis und Umsetzungsliste.
- Der Ordner wird weder in die App noch nach `gh-pages` übernommen.
- Er enthält keine Texte oder Bilder aus der protel-Hilfe, sondern nur Titel, Links, Datumsangaben und eigene Bewertungen. Näheres steht in `recherche/phase-1/README.md`.

Technik: Die App verwendet reines HTML, CSS und JavaScript ohne externe Bibliotheken.
Es gibt keine ES-Module, keine Web Worker und kein `fetch` für die Daten, damit alles unter `file://` funktioniert.
Service Worker und Manifest werden nur bei Aufruf über `https://` (bzw. `localhost`) aktiv; unter `file://` bleiben sie aus.
Der Service Worker liefert App-Dateien aus einem versionierten Cache, die Wissensdatenbank sofort aus dem Cache mit Abgleich im Hintergrund,
und verändert nie die lokal gespeicherten Bearbeitungen (IndexedDB). Die Navigation läuft über Hash-Routen (`#/artikel/…`).

## Datenformat (Kurzüberblick)

```js
window.PROTEL_HILFE_DATEN = {
  format: "protel-hilfe", schemaVersion: 1,
  meta: { title, revision, updated, exampleData, searchExamples: [] },
  categories: [{ id, name, description, icon, color }],
  synonyms: [["Check-out", "Abreise", "auschecken"], ...],
  articles: [{
    id, type: "guide" | "troubleshooting" | "decision" | "info",
    title, categoryId, summary, tags: [], keywords: [], example, author, created, updated, body, related: [],
    steps: [{ title, text, hint, image: { src, alt, markers: [{ x, y, label }] } }],          // guide
    troubleshooting: { messages: [], symptoms, causes: [{ title, check, solution }], escalation }, // troubleshooting
    tree: { start, nodes: [{ id, kind: "question", text, answers: [{ label, next }] }
                         | { id, kind: "result", text, tone, links: [] }] }                     // decision
  }]
};
```

Beim Import wird nichts ausgeführt: Der JSON-Teil wird geparst und validiert.
Alle Texte werden beim Anzeigen HTML-escaped, deshalb können importierte Inhalte keinen Code einschleusen.

## Getestet

Automatisiert in Chromium (Playwright) unter `file://` (PC-Version):

- Suche: Synonyme, Tippfehler, Wortformen, Fehlermeldungstext
- Navigation und Tastaturbedienung
- Anleitung, Fehlerbehebung und Entscheidungsbaum
- Editor: Bild-Upload, Einfügen aus der Zwischenablage, Markierungen, Toolbar, Vorschau, Baum-Editor
- Speicherung über Neuladen hinweg
- Export und Import (Zusammenführen, Ersetzen, fehlerhafte Datei)
- Versionskonflikt beim Start, Kategorien und Synonyme
- Beispiele entfernen und Zurücksetzen
- Dunkelmodus, Druckansicht, Smartphone-Layout ohne horizontales Scrollen
- Start ohne Datendatei

Automatisiert als PWA über einen lokalen HTTPS-gleichwertigen Ursprung (`localhost`) mit iPhone- und iPad-Emulation in Chromium:

- Service Worker, Vorab-Cache aller 21 App-Dateien, Manifest und iOS-Meta-Tags
- Mobile Navigation: Tab-Leiste, Zurück-Pfeil, „Mehr“-Menü, Suche mit sofort geöffneter Tastatur, Eingabeschrift ≥ 16 px
- **Komplett offline:** Start, Suche, Anleitung mit Bildern, Entscheidungsbaum, Bearbeiten, Export, Import – ohne eine einzige Server-Anfrage
- Teilen-Menü beim Export (iOS-Verhalten simuliert), Abbruch wird erkannt
- Neue Inhalte auf dem Server → Hinweis, eigene Änderungen bleiben erhalten (Rückfrage)
- Neue App-Version → Hinweis, Aktualisierung nach Bestätigung, alter Cache entfernt, eigene Änderungen erhalten
- Kein seitliches Scrollen auf iPhone SE, iPad hoch und quer (auch nach Interaktion)

**Nicht direkt testbar:** echtes iOS/iPadOS-Safari (WebKit) und die Installation auf dem Home-Bildschirm. Die Emulation bildet Bildschirmgröße,
Touch und Benutzeragent nach, nicht aber die Safari-Engine. Firefox wurde nicht getestet. Microsoft Edge nutzt dieselbe Engine wie Chrome.
