# Automatische Tests – Protel Hilfe

Die Tests prüfen die App so, wie sie benutzt wird: im echten Browser (Chromium über Playwright), per `file://` wie auf den Rezeptions-PCs, als installierte Web-App (PWA) ohne Netz und in der Emulation von iPhone und iPad.

Sie verwenden **ausschließlich erfundene Testdaten** – keine protel-Inhalte, keine Screenshots, keine echten Gäste- oder Hausdaten. Temporäre Dateien entstehen nur in `tests/.tmp/` (nicht im Repository).

## Ausführen

```
node tests/run-all.js            # alle Tests, Bericht in tests/.tmp/testbericht.md
node tests/run-all.js t02 t09    # nur ausgewählte Testdateien
```

Voraussetzungen: Node.js, Playwright mit Chromium (`require('playwright')`), Git (für den Test mit der Vorversion).

## Was geprüft wird

| Datei | Inhalt |
|---|---|
| `t01-modell.js` | Datenformat 1 → 2 verlustfrei, unbekannte Felder bleiben erhalten, Rechte „intern“ als Standard, öffentlicher Stand, Abbildungsnummern, Verweise im Text, Schutz vor eingeschleustem Code |
| `t02-migration.js` | **Update vorhandener Geräte:** Die Vorversion (Git-Stand `111f797`, Datenformat 1) speichert Daten, danach startet im selben Ordner die neue Version. Nichts geht verloren, der alte Stand bleibt als angehefteter Wiederherstellungspunkt erhalten – auch ohne IndexedDB |
| `t03-import-export.js` | Import alter und „neuerer“ Sicherungen, Zusammenführen/Ersetzen mit Wiederherstellungspunkt, Sicherung (intern), Datendatei für die interne PC-Version, öffentliche Datendatei nur mit freigegebenen Inhalten |
| `t04-editor.js` | Mehrere Bilder je Schritt (Datei, Zwischenablage, Bildplatz), eigene Screenshots bleiben intern, Markierungen, Reihenfolge, Hinweisart, Abschnitt, Prüfstatus, Quellen, Text nach den Schritten, Abbildungsverweise, „Gleiche Aufnahme wie“, Dauerhaftigkeit |
| `t06-bildansicht.js` | Zoom (Tasten, Mausrad, Doppelklick, Schaltflächen), Verschieben mit Grenzen, Blättern, lesbare Markierungen, Fokus; Zwei-Finger-Zoom, Wischen und Doppeltippen auf iPhone und iPad; lange Bildunterschrift auf dem iPhone (Schließen bleibt erreichbar) |
| `t07-pwa-offline.js` | Offline-Speicher vollständig, Start ohne Netz, Suche und Bildansicht offline, Wiederherstellungspunkte in der Web-App |
| `t08-verwaltung.js` | Wiederherstellungspunkte (Begrenzung, Wiederherstellen, Herunterladen, Löschen), Sammelimport von Screenshots nach Dateinamen, gemeinsame Bildplätze (eine Aufnahme für zwei Anleitungen), Bildplätze nach Bildschirmbereich mit CSV, Importvorschau mit internen Bildern, Bildplätzen und Entwürfen, Schutz interner Inhalte bei einer neuen öffentlichen Version |
| `t09-veroeffentlichung.js` | Veröffentlichungssperre an absichtlich „verunreinigten“ Projektkopien: interne Artikel/Bilder, eigene Screenshots, Bildplätze, Namen, interne Exporte, unbekannte oder veränderte Bilddateien, Screenshot-Dateinamen; Build-Sperre; Git-Hook |
| `t10-regression.js` | Bisherige Funktionen: Suche (Tippfehler, Synonyme), Assistent, Fehlerbehebung, Schritte, Favoriten, Dunkelmodus, Prüfstatus-Filter, Kennzeichen „Entwurf“ in der Suche, Hilfe, Lizenzseite, Kategorien/Synonyme, Smartphone-Ansicht, Druck, fehlende Datendatei |
| `t11-trennung-lizenz.js` | Trennung öffentlich/intern: Positivliste des App-Ordners (unbekannte Dateien gesperrt, nicht gebaut, nicht im Offline-Cache), Systemdateien, Offline-Dateien müssen committet sein; Lizenzhinweise (Datei, Symbol-Quelle, App-Seite, offline); GitHub-Prüfung ohne Deployment |
