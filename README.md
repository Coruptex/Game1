# Protel Hilfe – Offline-Wissensdatenbank für die Hotelrezeption

**Protel Hilfe** ist eine eigenständige Web-App, die vollständig offline im Browser läuft.
Sie dient als interne Wissensdatenbank für die Rezeption: Anleitungen, Fehlerbehebung,
Entscheidungsbäume und Nachschlagewissen, durchsuchbar mit einer fehlertoleranten Volltextsuche.

> **Prototyp mit Beispieldaten.** Alle als „Beispiel“ markierten Inhalte sind fiktive Muster und
> **keine** offiziellen oder geprüften protel-Bedienungsanleitungen. Konkrete Arbeitsschritte in
> protel sind als gelbe Platzhalter `[[…]]` markiert und müssen intern ergänzt werden.
> Protel Hilfe ist kein Produkt des protel-Herstellers und hat keine Verbindung zu protel-Systemen.

## Starten

1. Den Ordner `protel-hilfe` auf den PC oder ein Netzlaufwerk kopieren.
2. `protel-hilfe/index.html` doppelklicken. Die Datei öffnet sich in Microsoft Edge, Google Chrome oder einem anderen aktuellen Browser.

Es ist keine Installation nötig. Die App braucht keinen Server, kein Internet und keine Cloud-Dienste und verwendet zur Laufzeit keine KI.
Alle Ressourcen (Skripte, Design, Symbole, Beispielbilder) liegen lokal im Ordner.

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

## Projektstruktur

```
protel-hilfe/
├── index.html                 Einstiegspunkt (Doppelklick)
├── LIESMICH.txt               Kurzanleitung für den Betrieb
├── data/
│   └── wissensdatenbank.js    Wissensdatenbank (Beispieldaten, über die App exportierbar)
└── assets/
    ├── css/app.css            Gestaltung (Hell/Dunkel, responsiv, Druck)
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
        └── app.js             Start, Routing, Navigation, Speichern
```

Technik: Die App verwendet reines HTML, CSS und JavaScript ohne Build-Schritt und ohne externe Bibliotheken.
Es gibt keine ES-Module, keine Service Worker, keine Web Worker und kein `fetch`, damit alles unter `file://` funktioniert.
Die Navigation läuft über Hash-Routen (`#/artikel/…`).

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

Automatisiert in Chromium (Playwright) unter `file://`:

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

Firefox und Safari wurden nicht getestet. Microsoft Edge nutzt dieselbe Engine wie Chrome.
