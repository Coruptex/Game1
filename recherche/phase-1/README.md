# Recherche Phase 1 – Quellen- und Themenanalyse Protel Cloud PMS

**Stand der Recherche:** 08.11.2026 · **Produkt:** Protel Cloud PMS / protel Air im Browser · **Protel-Version laut Release Notes:** 26.44 (28.10.2026)

Diese Unterlagen sind die Planungsgrundlage für die Wissensdatenbank von „Protel Hilfe“. Sie sind **nicht Teil der App**:
- Der Ordner wird weder in die App (`protel-hilfe/`) noch in die Veröffentlichung (Branch `gh-pages`) übernommen.
- Das Deploy-Skript überträgt ausschließlich `protel-hilfe/`.

## Dateien

| Datei | Inhalt |
|---|---|
| `Phase1-Abschlussbericht.md` | Abschlussbericht: Methode, Produktzuordnung, Quellenkatalog, Abdeckung, Widersprüche, Lücken, Rechtliches, Empfehlung für Phase 2 |
| `themenkatalog.csv` / `.json` | 308 Abläufe mit Stufe A–D, Quelle, URL, Datum, Produkt, Versionsrisiko, Format, Priorität, Abhängigkeiten und Rechtevermerk |
| `quellenverzeichnis.csv` | 434 ausgewertete Seiten der offiziellen Cloud-Hilfe mit Datum, Sprachfassungen, Umfang und Verwendung im Katalog |
| `umsetzungsliste.csv` / `.json` | 45 vorgeschlagene Anleitungspakete in vier Wellen; alle 150 P1-Abläufe zugeordnet |

Die CSV-Dateien sind UTF-8 mit Semikolon als Trennzeichen. Sie lassen sich direkt in Excel oder Numbers öffnen.

## Wichtige Hinweise

- **Keine Inhalte der protel-Hilfe übernommen.** Enthalten sind nur Titel, Links, Datumsangaben, Zählungen und eigene Bewertungen.
- **Nutzungsrechte ungeklärt.** Texte, Bilder und Videos der Hilfe sind urheberrechtlich geschützt. Spätere Anleitungen werden eigenständig formuliert und mit Quellenlinks versehen. Für Screenshots der Oberfläche ist das Nutzungsrecht noch zu klären (Abschnitt 10 des Berichts).
- **Das Repository ist öffentlich.** Hausinterne Anleitungen, Hausregeln und Screenshots gehören nicht in dieses Repository und nicht auf die öffentliche Website.
- **Momentaufnahme.** Die Bewertungen gelten für den Stand vom 08.11.2026. Protel veröffentlicht alle 2–4 Wochen neue Versionen; vor jeder Anleitung Quelle und Release Notes erneut prüfen.

## Bezug zum App-Stand bei der Sicherung

| | Commit |
|---|---|
| Entwicklungsbranch `claude/nice-johnson-ql3pk0` vor dieser Sicherung | `c3a0e979785c0069227062a99f4333ad8b82faf8` |
| Veröffentlichte Website (Branch `gh-pages`) | `454ed665fba4df3010fcd6de71cb538a014aa48e` |
