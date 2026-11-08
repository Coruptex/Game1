# Phase 1: Quellen- und Themenanalyse für „Protel Hilfe“ – Protel Cloud PMS (protel Air)

**Stand:** 08.11.2026 · **Produkt:** Protel Cloud PMS / protel Air im Browser (vom Hotel bestätigt) · **Aktuelle Version laut Release Notes:** 26.44 vom 28.10.2026

**Art der Arbeit:** reine Recherche. Am Programm, an den Artikeln, an Commits und am Deployment wurde nichts geändert. Alle Ergebnisse liegen nur als temporäre Dateien im Scratchpad. Dieser Bericht ist keine Rechtsberatung.

**Begleitdateien** (im selben Ordner):
- `themenkatalog.csv` / `themenkatalog.json` – alle 308 Abläufe mit Stufe, Quelle, URL, Datum, Produkt, Versionsrisiko, Format, Priorität und Rechtehinweis
- `quellenverzeichnis.csv` – alle 434 ausgewerteten Seiten mit Datum, Sprachfassungen, Umfang und Verwendung
- `umsetzungsliste.csv` / `umsetzungsliste.json` – 45 vorgeschlagene Anleitungspakete in vier Wellen

---

## 1. Ergebnis in Kürze

1. **Vollständig ausgewertet:**
   - alle 297 rezeptionsrelevanten deutschen Artikel der offiziellen Cloud-Hilfe (100 % der ausgewählten Kategorien)
   - alle 113 deutschen Release Notes (11/2020 bis 10/2026)
   - 24 englische und französische Zusatzseiten
   - zum Datumsabgleich zusätzlich die englische Fassung aller 108 P1-Quellartikel, die eine haben
2. **Katalogisiert:** 308 Abläufe, davon 280 für den Rezeptionsalltag und 28 reine Verwaltungs- und Konfigurationsabläufe.
3. **Abdeckung für ein Hotel in Deutschland** (276 Rezeptionsabläufe):

   | Stufe | Anzahl | Anteil |
   |---|---|---|
   | A | 176 | 64 % |
   | B | 81 | 29 % |
   | C | 5 | 2 % |
   | D | 14 | 5 % |

4. **Höchste Priorität (P1)** – Reservierungen, Check-in, Check-out, Rechnungen, Zahlungen, Anzahlungen, No-Shows, Kasse, Tagesabschluss – mit 150 Abläufen:

   | Ergebnis | Anzahl | Anteil |
   |---|---|---|
   | A insgesamt | 110 | 73 % |
   | davon A mit niedrigem oder mittlerem Versionsrisiko, ohne Lizenzbindung | 68 | 45 % |
   | davon A mit hohem Versionsrisiko | 34 | 23 % |
   | davon A nur mit lizenzierter Zusatzfunktion | 8 | 5 % |
   | B | 27 | 18 % |
   | C oder D | 13 | 9 % |

5. **Die deutsche Hilfe hinkt teilweise hinterher.**
   - 74 der 297 deutschen Artikel (25 %) wurden zuletzt vor 2023 geändert.
   - Bei 20 von 108 geprüften P1-Quellen ist die englische Fassung mindestens 30 Tage neuer, bei 12 mindestens 180 Tage. Beispiele: Zubuchbare Pakete (DE 2022, EN 2026), Reservierung stornieren (DE 2023, EN 2025), Reservierung im Kategoriespiegel anlegen (DE 2023, EN 2025).
6. **Belegte Widersprüche und Änderungen:**
   - 23 Release-Note-Hinweise betreffen 15 Abläufe. Beispiel: Die Kassenanmeldung wurde am 13.12.2023 umgestellt, die deutsche Anleitung von 2020 nennt noch die alte Schaltfläche.
   - 6 Abläufe sind ausdrücklich als widersprüchlich oder veraltet markiert. Beispiele: alte Menübezeichnungen wie „PMS – Anreisen“, der Stammdaten-Aufruf über ein Zahnrad statt über das App-Icon, eine deutlich neuere englische Fassung.
7. **Echte Lücken (D) sind Hausprozesse:**
   - Walk-in, Early Check-in, Late Check-out, Gutscheine ohne Givito, Kaution
   - abgelehnte Karte, Schicht- und Kassenübergabe, Nachtdienst-Ablauf
   - Notfallbetrieb, Druckprobleme, allgemeiner Fehlermeldungs-Katalog, Rechnung auf Debitor beim Check-out
8. **Neue Funde gegenüber dem Vorbericht:**
   - Stornierte Reservierungen lassen sich wieder einsetzen (Liste „Stornierungen“ mit STORNO RÜCKGÄNGIG).
   - Day Use ist auch auf Deutsch belegt (Checkbox „Tageszimmer“ in der Reservierungsanfrage).
   - Upgrade und Upsell sind beim Umziehen im Zimmerplan dokumentiert (Preis neu berechnen: JA/NEIN).
   - Rabatte sind eine neue Funktion seit 02/2026.
   - Die Zimmerliste für Gruppen lässt sich importieren (nur englische Hilfe).
9. **Empfehlung für Phase 2:**
   - Mit 23 gut belegten Anleitungspaketen beginnen (Welle 1, 66 Abläufe).
   - Jede Anleitung eigenständig formulieren, mit Quellenlink versehen und vor der Freigabe im eigenen System prüfen.
   - Echte protel-bezogene Inhalte nicht auf die öffentliche GitHub-Seite stellen, sondern als interne Importdatei verteilen (Abschnitt 11).

---

## 2. Methode (nachvollziehbar)

### 2.1 Umfang

| Schritt | Ergebnis |
|---|---|
| Inventar über die Sitemap der Cloud-Hilfe | 1.629 Seiten: 610 deutsch (497 Artikel und 113 Release Notes), 605 englisch, 413 französisch |
| Auswahl rezeptionsrelevanter Kategorien | 297 deutsche Artikel aus 56 Kategorien |
| Bewusst ausgeschlossen | 200 deutsche Artikel aus 48 Kategorien, siehe Tabelle |
| Release Notes | alle 113 deutschen Fassungen |
| Zusatzsprachen | 17 englische Kandidaten ohne erkennbares deutsches Gegenstück, 6 französische, 1 französischer Artikel aus dem Vorbericht |
| Datumsabgleich | 108 englische Fassungen der P1-Quellartikel |
| Zugangsprüfung | 2 deutsche Sprachlinks: einer liefert 404, einer leitet auf eine Anmeldeseite um |

Ausgeschlossene Bereiche:

| Bereich | Artikel | Grund |
|---|---|---|
| Stammdaten (Konfiguration) | 74 | Admin-Aufgaben; nur als Voraussetzung relevant |
| MICE/Veranstaltungen | 33 | eigenes Modul (Bankett/Sales) |
| Protel CENTRAL, zentrale Konfiguration | 33 | Mehrhaus-/Zentralprodukt |
| Management und Analyse (Manager-Berichte, Pulse, Budget, Mitgliedschaften, Datenverteilung) | 24 | nicht Rezeptionsalltag |
| Schnittstellen und Fremdsysteme (WBE, IDS, FiBu, Accor, FRIVA, Marketplace, Zusatzprodukte) | 23 | Fremdprodukte und Einrichtung |
| Channel App | 9 | Distribution |
| Onboarding, GoBD | 4 | einmalige Einrichtung |

### 2.2 Abruf und Auswertung
- Seiten wurden einzeln, nacheinander und gedrosselt abgerufen (eine Anfrage etwa alle 3 Sekunden). Ausgewertet wurde nur lokal, nichts wurde weitergegeben.
- Je Seite wurden erfasst:
  - Titel und Datumsangaben („Updated“ und „Posted“ aus der Seite)
  - Brotkrumenpfad und Sprachfassungen
  - Wortzahl, Bilder, Videos
  - Zahl der Handlungsschritte, also Sätze wie „Klicken Sie …“ oder „Wählen Sie …“
  - Menüpfade, Schaltflächen in Großschrift
  - Produktmerkmale (protel Air, Cloud PMS, SPE, MPE, On-Premise) und Lizenz-, Länder- und Konfigurationshinweise
- Jeder Ablauf wurde anschließend **manuell** anhand der Schrittfolgen und relevanter Textabschnitte bewertet. Gespeichert wurde nur die eigene Bewertung, keine Textübernahme.

### 2.3 Bewertungsregeln

| Stufe | Regel |
|---|---|
| **A** | Der Text nennt Einstieg (Menü, Dialog oder Liste), die nötigen Bedienschritte mit benannten Schaltflächen oder Feldern und den Abschluss. Bilder und Videos wurden **nicht** ausgewertet; A heißt also „im Text vollständig beschrieben“. |
| **B** | Funktion belegt, aber Schritte unvollständig: Abschluss fehlt, nur Erklärung oder Beispiel, nur Video, nur Fundort genannt, oder nur in einer anderen Sprache knapp beschrieben. |
| **C** | Nur mit zusätzlichem Zugang überprüfbar: Hauskonfiguration oder Rechte, Gerät eines Drittanbieters, Lizenz, Login. |
| **D** | Keine ausreichende Herstellerquelle, höchstens eine Erwähnung oder nur Release Notes. |

Die reine Existenz eines Artikels zählt nicht. Beispiele:
- „Bucher ändern“ ist **B**, weil das Speichern fehlt.
- „Garantie- und Stornoinfo“ ist **B**, weil nur der Fundort beschrieben ist.

**Versionsrisiko** je Ablauf:
- **Grundwert** nach dem Aktualisierungsdatum der neuesten Quelle: ab 2025 *niedrig*, 2023–2024 *mittel*, vor 2023 *hoch*.
- **Eine Stufe höher**, wenn
  - eine spätere Release Note den Ablauf ändert (manuell geprüft),
  - die englische Fassung mindestens 180 Tage neuer ist (30–179 Tage werden nur vermerkt), oder
  - ein Widerspruch oder eine veraltete Angabe in einer Quelle gefunden wurde.

**Priorität:**
- **P1** sind die von Ihnen genannten Kernbereiche.
- **P2** sind häufige Nebenabläufe: Profile, Gruppen, Housekeeping, Berichte, Grundlagen.
- **P3** sind seltene, verwaltende oder länderspezifische Abläufe.

**Zählweise:** Jeder Ablauf zählt gleich, ohne Gewichtung nach Häufigkeit. Eine Gewichtung wäre eine Schätzung.

### 2.4 Grenzen
- Nicht geprüft: Inhalte von Bildern und Videos, Bereiche hinter Logins, Ihr eigenes System und Ihre Konfiguration.
- Release Notes wurden per Stichwortsuche gefiltert. Für P1 habe ich die Treffer gelesen, für P2 und P3 nur stichprobenartig.
- Den Abgleich mit der englischen Fassung gibt es nur für die P1-Quellen.

---

## 3. Produktzuordnung und mögliche Verwechslungen

**Zuordnung:** Alle 297 deutschen Artikel stammen aus der Cloud-Hilfe (help.protelair.com → protelair.helpjuice.com).
- 267 davon tragen am Ende das Kürzel `prd-clo`. Vermutlich steht es für „Produkt Cloud“; das ist eine plausible Deutung, keine belegte.
- Hinweise auf SPE, MPE oder On-Premise kommen in nur zwei Cloud-Seiten vor (siehe Punkt 3 und 8 der Tabelle).
- Produktfremde Hilfen (On-Premise-Hilfe, alte Air-Hilfe, PDF von 2018) wurden **nicht** als Quelle verwendet.

| # | Verwechslungsgefahr | Beleg / Einordnung |
|---|---|---|
| 1 | **Zwei ähnlich benannte Hilfen:** „protel Air Wissen“ (Cloud) und „protel Wissen“ (On-Premise, protel.helpjuice.com), dazu die Alt-Hilfe help.protel.net | gleiche Kategorienamen (Update-News, Stammdaten); nur die Cloud-Hilfe verwenden |
| 2 | **Gleiche Themen in beiden Produkten:** Auto No-Show, Auto Deposit, Pay by Link, KassenSichV, IDS connect, E-Mail-Versand | gleiche Titel, andere Bedienung; immer die URL prüfen |
| 3 | **„MPE“ in der Cloud** bedeutet *Multi Property Edition* (Konten mit mehreren Häusern) | so im Cloud-Glossar und in Release Notes („MPE-Hotelumgebungen“); nicht protel MPE (On-Premise) |
| 4 | **„Front Office“ in der Cloud** = Berichtskategorie, Rolle „PMS_Front Office“, Bezeichnung „protel Air Front Office“ | nicht das Windows-Programm „Front Office“ von protel SPE |
| 5 | **App „Protel dSignature“** dient in der Cloud dem digitalen Meldeschein und gibt es auch im On-Premise-Umfeld | nur die Cloud-Artikel „Digitaler Meldeschein“ verwenden |
| 6 | **Zusatzprodukte in der Cloud-Hilfe:** Protel CENTRAL, Booking Engine (WBE), Channel App, MICE | eigene Module; nicht mit dem PMS-Kern vermischen |
| 7 | **Alte Air-Hilfe** (connect.protel.net, Stand 2022) und **Air-Handbuch** (PDF 2018) | Oberfläche seit 2020 geändert, veraltet |
| 8 | **Artikel „E-Invoicing (ZUGFeRD)“** spricht On-Premise und Cloud gemeinsam an | rechtlicher Hinweis, kein Bedienablauf |
| 9 | **Doppelte Benennung:** Titel „protel Air …“, Text „Protel Cloud PMS“; in einem Artikel heißen die Stammdaten „Systemdaten“, früher hießen sie „Settings“ | Release Note vom 21.04.2021: „Settings heißen wieder Stammdaten“ |
| 10 | **Neue Listenversionen** „Reservierungen (v2)“, „Gäste (v2)“, „Gruppenbuchung (v2)“, „Kontingente (v2)“ | Release Notes ab 2023; ältere Artikel beschreiben teils die Vorgänger |

**Begriffsvarianten** sind wichtig für die Suche in der App und gehören in Phase 2 in die Synonymliste:
- Kategoriespiegel – Kategorieplan (room type plan)
- Gästekartei – Profil – Kartei
- Rechnungsfenster – Folio
- Umleitungsregel – Zahlungsinstruktion
- Anzahlung – Deposit
- Passantenrechnung – Shop
- Dashboard – Active Desktop
- Tagesabschluss – TA – End of Day
- Mehr-Menü – drei Punkte

Das englische **„Protel Cloud Glossary“** (Stand 23.07.2026, mit deutschen Begriffen) ist dafür eine gute Fundstelle. Übernommen werden nur Begriffe, keine Texte.

---

## 4. Quellenkatalog

### 4.1 Hauptquelle: offizielle Cloud-Hilfe (öffentlich, ohne Login)
| Merkmal | Wert |
|---|---|
| Ausgewertete deutsche Artikel | 297 (rund 145.000 Wörter, 1.334 Bilder in 242 Artikeln, Videos in 16 Artikeln) |
| Letzte Änderung der deutschen Artikel | 2020: 14 · 2021: 29 · 2022: 31 · 2023: 80 · 2024: 10 · 2025: 79 · 2026: 54 |
| Sprachfassungen | englische Fassung zu 279 von 297, französische zu 185 |
| Release Notes (deutsch) | 113 (2020: 4 · 2021: 25 · 2022: 23 · 2023: 25 · 2024: 15 · 2025: 11 · 2026: 9 · aktuelle Seite: 1) |
| Zugang | öffentlich; `robots.txt` sperrt automatisierte Zugriffe (Abschnitt 10) |

### 4.2 Nur in anderen Sprachen oder nicht öffentlich
| Thema | Fundstelle | Befund |
|---|---|---|
| Zimmerliste (Rooming List) für Gruppen importieren | nur englisch, 14.08.2025 | deutsche Fassung liefert **404**; deutsche Schaltfläche „Zimmerliste importieren“ laut Release Note vom 20.03.2024 |
| Marktsegment und Vertriebsweg setzen | englisch, 15.04.2021 | deutsche Fassung **nur nach Anmeldung** erreichbar (Umleitung auf eine Login-Seite) |
| Housekeeping mobil: Arbeitsblätter (Attendant Sheets) | nur englisch, 06.08.2026 | keine deutsche Fassung |
| Glossar | nur englisch, 23.07.2026 | Begriffsquelle |
| Day Use | französisch, 13.06.2022 | ergänzt die deutsche Checkbox „Tageszimmer“ |
| Gutscheine über Givito | nur englisch, 20.05.2025 | nur mit Lizenz (Vorbericht) |
| Kleinere Themen (Preis am Profil, Field Management, Übertragungswege, Zimmerplan-Filter, Listen-Besonderheiten) | englisch | P3 |

### 4.3 Weitere Quellen (aus dem Vorbericht, weiterhin gültig)
- **Planet:** Ressourcenbibliothek (Kartenterminals, Pay by Link) und eCampus-Kurs „PMS Pay By Link“. Nur relevant, wenn Ihr Haus Planet-Terminals oder integrierte Zahlungen nutzt.
- **Statusseite und Cloud-Status** im PMS; sie sind über die Hilfe dokumentiert.
- **Nicht verwendet:** On-Premise-Hilfen, alte Air-Hilfe, PDF-Handbuch 2018, Partnerseiten, YouTube (leer).

Jede einzelne Quelle steht mit URL und Datum in `quellenverzeichnis.csv`. 18 ausgewertete Seiten sind keinem Ablauf zugeordnet: Sprachfassungen, Glossar, Rechtshinweise, Funktionsüberblick, Open API, Frankreich-Pflichtangaben, historische IAM-Hinweise. Der Grund steht in der Spalte „Hinweis“.

---

## 5. Themenkatalog und Abdeckung

### 5.1 Rezeptionsabläufe nach Bereich (Szenario Hotel in Deutschland, ohne Admin)

| Bereich | Abläufe | A | B | C | D |
|---|---|---|---|---|---|
| Reservierungen | 52 | 39 | 11 | 0 | 2 |
| Rechnungen | 31 | 26 | 4 | 0 | 1 |
| Zahlungen | 22 | 12 | 7 | 0 | 3 |
| Grundlagen (Login, Suche, Listen, Navigation) | 20 | 11 | 9 | 0 | 0 |
| Gruppen | 17 | 16 | 1 | 0 | 0 |
| Berichte und Listen | 17 | 2 | 15 | 0 | 0 |
| Check-in | 15 | 10 | 3 | 0 | 2 |
| Gästeprofile | 14 | 9 | 4 | 1 | 0 |
| Kasse | 10 | 8 | 1 | 0 | 1 |
| Zimmer und Housekeeping | 10 | 5 | 5 | 0 | 0 |
| Benutzer und Sicherheit | 8 | 2 | 5 | 1 | 0 |
| Kontingente | 7 | 6 | 1 | 0 | 0 |
| No-Shows | 7 | 5 | 2 | 0 | 0 |
| Check-out | 6 | 5 | 0 | 0 | 1 |
| Stornierungen | 6 | 5 | 1 | 0 | 0 |
| Anzahlungen | 5 | 2 | 3 | 0 | 0 |
| Firmenkunden und Debitoren | 5 | 4 | 1 | 0 | 0 |
| Kasse (KassenSichV, nur Deutschland) | 5 | 4 | 1 | 0 | 0 |
| Fehlerbehebung | 5 | 1 | 1 | 0 | 3 |
| Schnittstellen | 5 | 0 | 2 | 3 | 0 |
| Datenschutz (DSGVO) | 4 | 1 | 3 | 0 | 0 |
| Tagesabschluss | 4 | 3 | 0 | 0 | 1 |
| Gesetzliches | 1 | 0 | 1 | 0 | 0 |
| **Summe** | **276** | **176** | **81** | **5** | **14** |

Weitere Kennzahlen:
- **Österreich (RKSV):** 2 zusätzliche Abläufe, beide A.
- **Länder mit Fiskalisierungspflicht:** 1 Ablauf.
- **Verwaltung und Konfiguration:** 28 Abläufe (26 A, 2 B), zum Beispiel Buchungsbedingungen, Multiwährung, Ortstaxe, digitaler Meldeschein, Benutzer und Rollen.
- **Nach Priorität:**
  - P1: 150 Abläufe, 73 % A
  - P2: 87 Abläufe, 59 % A
  - P3: 39 Abläufe, 38 % A

### 5.2 P1 nach Bereich

| P1-Bereich | Abläufe | A | B | C | D |
|---|---|---|---|---|---|
| Reservierungen | 35 | 28 | 6 | 0 | 1 |
| Rechnungen | 30 | 25 | 4 | 0 | 1 |
| Zahlungen | 16 | 11 | 2 | 0 | 3 |
| Check-in | 13 | 10 | 2 | 0 | 1 |
| Kasse (+ KassenSichV) | 13 | 11 | 1 | 0 | 1 |
| No-Shows | 7 | 5 | 2 | 0 | 0 |
| Check-out | 6 | 5 | 0 | 0 | 1 |
| Stornierungen | 6 | 5 | 1 | 0 | 0 |
| Berichte für Kasse und Nachtdienst | 6 | 0 | 6 | 0 | 0 |
| Tagesabschluss | 4 | 3 | 0 | 0 | 1 |
| Gruppen (Rechnung, Storno) | 4 | 4 | 0 | 0 | 0 |
| Anzahlungen | 3 | 2 | 1 | 0 | 0 |
| Fehlerbehebung, Schnittstellen, Rechte, DSGVO | 7 | 1 | 2 | 3 | 1 |
| **Summe P1** | **150** | **110** | **27** | **3** | **10** |

---

## 6. Veraltete und widersprüchliche Informationen

### 6.1 Ausdrücklich markierte Widersprüche bzw. veraltete Angaben (6 Abläufe)

| Ablauf | Befund |
|---|---|
| CIN-02 Gruppen-Check-in | Artikel von 2021 nennt „PMS – ANREISEN“ und andere Schaltflächenpositionen. Die Fassung von 2025 ist maßgeblich. |
| RCH-01 Rechnungsübersicht öffnen | Stand 2021, nennt das Menü „PMS > Anreisen / Abreisen / Im Haus“ |
| GRP-05 Gruppe erkennen | Stand 2020, nennt „PMS – Abreisen“ |
| ADM-20 / ADM-24 Stammdaten | Aufruf über ein Zahnrad (Artikel 2022–2025) statt über App-Icon > STAMMDATEN („Stammdaten aufrufen“, 02/2026) |
| BER-13 Umsatz- und Außenstandskontrolle | DE 05.07.2023, EN 07.10.2025 |

### 6.2 Spätere Änderungen laut Release Notes (Auswahl, P1)

| Ablauf (Artikeldatum) | Release Note | Änderung |
|---|---|---|
| KAS-01 Kasse öffnen (2020) | 13.12.2023 | Anmeldung überarbeitet, Schaltfläche ANMELDEN statt „Öffnen“ |
| KAS-08 Passantenrechnung mit Empfänger (2020) | 25.01.2023 | ZAHLUNG im Shop nur noch bei aktivem X-Setup |
| RCH-15 Rechnung stornieren (2021) | 11.01.2023, 12.07.2023, 23.08.2023, 07.02.2024 | automatischer Druck; Storno bei EFT-Zahlungen KSV-konform umgestellt; DE/AT ohne Zahlungsauswahl beim Neu-Buchen; neuer Dialog |
| STO-01 Reservierung stornieren (2023) | 18.10.2023 | Info-Dialog durch Pop-up ersetzt; englische Fassung 2025 neuer |
| ZAH-22 Vorautorisierung (2023) | 17.05.2023, 31.05.2023 | Bezeichnung „VORAUT. FÄLLIG“; keine Autorisierung nach Check-out |
| DEP-01 Anzahlung verbuchen (2024) | 30.09.2024, 13.11.2024, 15.04.2025 | Darstellung im Tagesabschluss, Pay by Link im Rechnungsdialog, Verbuchung von Pay-by-Link-Anzahlungen |
| RES-08 Buchungsbedingungen (2023) | 04.12.2024 | Abfrage zum Versand eines Zahlungslinks beim Hinzufügen |
| RES-20 Reservierungsanfrage (2025) | 29.10.2025, 15.10.2026 | Verhalten bei Anzahlungsbedingung; Preis-Schaltflächen |
| GRP-07 / GRP-08 / GRP-11 Gruppen (2020) | 2021–2022 | Gruppenrechnungsübersicht, Fixleistungen-Dialog, Pakete am Gruppenmaster |

Alle 23 Hinweise stehen in der Spalte „Risikogründe“ von `themenkatalog.csv`.

### 6.3 Englische Fassung deutlich neuer (Auszug der 12 Fälle mit mindestens 180 Tagen)
- Zubuchbare Pakete: DE 17.01.2022, EN 28.01.2026
- Artikel zu einem Paket hinzufügen: DE 31.08.2021, EN 11.08.2025
- Reservierung im Kategoriespiegel anlegen: DE 04.04.2023, EN 30.07.2025
- Reservierung verlängern: DE 06.04.2023, EN 30.07.2025
- Reservierung stornieren: DE 12.06.2023, EN 31.07.2025
- Automatische No-Show-Gebühr: DE 12.05.2023, EN 31.07.2025
- Forderungen (Buchungsbedingungen): DE 14.08.2023, EN 31.07.2025
- weitere: Paketinhalt anzeigen, Kasse öffnen, Passantenrechnung wiederfinden, Gruppenrechnung anlegen

Ergebnis des Abgleichs über alle 108 P1-Quellen:

| Ergebnis | Anzahl |
|---|---|
| ungefähr gleich (±30 Tage) | 64 |
| deutsche Fassung neuer | 24 |
| englische Fassung neuer | 20 |

**Folge:** Vor jeder Anleitung aus Welle 2 sollte die englische Fassung gegengelesen werden.

### 6.4 Versionsrisiko der A-Abläufe

| | niedrig | mittel | hoch |
|---|---|---|---|
| alle Rezeptionsabläufe mit A (176) | 68 | 61 | 47 |
| davon P1 (110) | 47 | 28 | 35 |

---

## 7. Eignung für Anleitungen, Fehlerbehebungen und Entscheidungsbäume

| Format | Abläufe | davon A |
|---|---|---|
| Schritt-für-Schritt-Anleitung | 169 | 162 |
| Fehlerbehebung | 12 | 9 |
| Entscheidungsbaum | 9 | 5 |
| Checkliste (Hausprozess) | 8 | 0 |
| Referenz/Übersicht | 78 | 0 |

**Gut belegte Entscheidungsbäume** (Quelle jeweils A):
- **Tagesabschluss: Was blockiert noch?** – fällige oder nicht fiskalisierte Rechnungen, offene Abreisen, Anreisen und No-Shows, Kassen, Anzahlungen, Autorisierungen (TAB-02)
- **Stornieren: mit Gebühr, ohne Gebühr oder nicht stornieren** – auch mit verbuchter Anzahlung (STO-02, STO-06)
- **No-Show mit Anzahlung** – Gebühr berechnen, nicht setzen oder Gebühr und Anzahlung ignorieren (NOS-07)
- **Zimmerwechsel: Preis beibehalten (Upgrade) oder neu berechnen (Upsell)** (ZPL-07)
- **Welche Rechnungsart?** – Proforma, Info, Zwischen- oder Vorausrechnung (RCH-07 bis RCH-10)
- **Rechnung korrigieren** – erneut öffnen, stornieren oder umbuchen (RCH-16, RCH-15, RCH-04)
- **Gast reist am Anreisetag ab** (COU-04, CIN-07 teilweise)

**Gut belegte Fehlerbehebungen:**
- Buchen-Schaltfläche ausgegraut (RES-21)
- „Stornieren“ fehlt (STO-03)
- Kassendialog erscheint beim Check-out (COU-05)
- Kassendifferenz (KAS-03)
- TSE-Ausfall und Nullbeleg (KSV-DE-04)
- Digitaler Meldeschein (CIN-14)
- Fehlermeldungen beim Zimmersperren (HSK-04)
- Cloud-Status (FEH-01)
- Passwort vergessen (GRD-07)

---

## 8. Priorisierte Umsetzungsliste (45 Pakete, alle 150 P1-Abläufe zugeordnet)

| Welle | Bedeutung | Pakete | Abläufe |
|---|---|---|---|
| **Welle 1** | gut belegt, Versionsrisiko niedrig oder mittel | 23 | 66 |
| **Welle 2** | belegt, aber hohes Versionsrisiko: zuerst im System und mit der englischen Fassung prüfen | 14 | 44 |
| **Welle 3** | nur mit Lizenz oder Zusatzfunktion, oder nur teilweise dokumentiert | 6 | 29 |
| **Welle 4** | Eigendokumentation (Hausprozesse, Konfiguration, Geräte) | 2 | 13 |

Zwei P2-Abläufe (Suche, Warenkorb) sind in Paketen der Welle 1 mit enthalten. Deshalb ergeben die Wellen zusammen 152 Abläufe.

| # | Welle | Vorgeschlagene Anleitung | Format | Abläufe (Stufen) | Höchstes Risiko |
|---|---|---|---|---|---|
| 1 | 1 | Reservierung über die Reservierungsanfrage oder die Gästekartei anlegen (inkl. Warenkorb, Day Use) | Anleitung | 5 (A 5) | mittel |
| 3 | 1 | Reservierung öffnen, finden und kopieren | Anleitung | 3 (A 3) | mittel |
| 4 | 1 | Gäste einer Reservierung verwalten | Anleitung | 6 (A 5, B 1) | mittel |
| 6 | 1 | Zimmer zuweisen und Reservierung umziehen | Anleitung | 4 (A 4) | mittel |
| 7 | 1 | Reservierungsbestätigung versenden | Anleitung | 1 (A 1) | mittel |
| 8 | 1 | Zahlungsorganisation der Reservierung | Anleitung | 2 (A 2) | niedrig |
| 9 | 1 | Check-in (Anreiseliste, Suche, Dialog, Zimmerplan, Check-in-Wizard) | Anleitung | 5 (A 5) | niedrig |
| 10 | 1 | Gruppen-Check-in | Anleitung | 1 (A 1) | mittel |
| 11 | 1 | Meldeschein drucken | Anleitung | 3 (A 2, B 1) | niedrig |
| 12 | 1 | Check-out inkl. Kassenanmeldung | Anleitung | 4 (A 4) | mittel |
| 13 | 1 | Vorzeitiger Check-out und Abreise am Anreisetag | Entscheidungsbaum | 2 (A 1, B 1) | niedrig |
| 14 | 1 | Rechnung abschließen, Rechnungsliste, Rechnungsstatus | Anleitung | 3 (A 2, B 1) | mittel |
| 15 | 1 | Welche Rechnungsart? (Proforma, Zwischenrechnung) | Entscheidungsbaum | 2 (A 2) | niedrig |
| 16 | 1 | Umleitungsregeln: Wer zahlt was? | Entscheidungsbaum | 3 (A 2, B 1) | niedrig |
| 17 | 1 | Rabatt anwenden, Gast von der Ortstaxe befreien | Anleitung | 2 (A 2) | niedrig |
| 19 | 1 | No-Shows (markieren, Liste, wiedereinsetzen, Richtlinie, mit Anzahlung) | Entscheidungsbaum | 5 (A 5) | mittel |
| 20 | 1 | Anzahlung stornieren oder korrigieren | Anleitung | 1 (A 1) | mittel |
| 21 | 1 | Kassenabschluss und Kassendifferenzen | Anleitung | 2 (A 2) | niedrig |
| 22 | 1 | Ein- und Auszahlungen | Anleitung | 3 (A 3) | mittel |
| 23 | 1 | Passantenrechnung im Shop | Anleitung | 1 (A 1) | niedrig |
| 24 | 1 | Tagesabschluss ausführen und offene Punkte klären | Entscheidungsbaum | 3 (A 3) | niedrig |
| 25 | 1 | KassenSichV im Alltag (nur Deutschland) | Fehlerbehebung | 3 (A 3) | niedrig |
| 26 | 1 | Störung: Cloud-Status und Statusseite | Fehlerbehebung | 2 (A 1, B 1) | niedrig |
| 2 | 2 | Reservierung im Zimmerplan oder Kategoriespiegel anlegen | Anleitung | 2 (A 2) | hoch |
| 5 | 2 | Reservierung ändern (verlängern, Preise, Raten, Logis, Notizen) | Anleitung | 6 (A 6) | hoch |
| 18 | 2 | Reservierung stornieren (Grundablauf, Gebühr, Anzahlung, Storno rückgängig) | Entscheidungsbaum | 5 (A 5) | hoch |
| 27 | 2 | Kasse öffnen/anmelden | Anleitung | 1 (A 1) | hoch |
| 28 | 2 | Passantenrechnung mit Empfänger / wiederfinden | Anleitung | 2 (A 1, B 1) | hoch |
| 29 | 2 | Zimmerplan: umziehen, Upgrade/Upsell | Entscheidungsbaum | 2 (A 2) | hoch |
| 30 | 2 | Rechnungsübersicht, Leistungen buchen und umbuchen | Anleitung | 4 (A 3, B 1) | hoch |
| 31 | 2 | Rechnung per E-Mail, Empfänger ändern, Info- und Vorausrechnung | Anleitung | 5 (A 5) | hoch |
| 32 | 2 | Rechnung korrigieren (erneut öffnen, stornieren, Folio löschen) | Entscheidungsbaum | 3 (A 3) | hoch |
| 33 | 2 | Pakete in der Rechnung | Anleitung | 5 (A 5) | hoch |
| 34 | 2 | Zahlung buchen, Zahlungsbeleg nachdrucken | Anleitung | 2 (A 2) | hoch |
| 35 | 2 | Anzahlung verbuchen | Anleitung | 1 (A 1) | hoch |
| 36 | 2 | Buchungsbedingungen und zubuchbare Pakete | Anleitung | 2 (A 2) | hoch |
| 37 | 2 | Gruppenrechnung, Gruppen-Vorausrechnung, Gruppenmitglied stornieren | Anleitung | 4 (A 4) | hoch |
| 38 | 3 | Kreditkarten (nur mit integrierter Kartenzahlung) | Anleitung | 9 (A 7, B 2) | hoch |
| 39 | 3 | Pay by Link (nur mit Aktivierung) | Anleitung | 1 (A 1) | niedrig |
| 40 | 3 | Digitaler Meldeschein (nur mit Lizenz) | Anleitung | 2 (A 2) | niedrig |
| 41 | 3 | Automatische Gebühren und Anzahlungen verstehen | Referenz | 3 (B 3) | hoch |
| 42 | 3 | Kontrollberichte für Kasse und Nachtdienst | Referenz | 6 (B 6) | hoch |
| 43 | 3 | Weitere P1-Bausteine mit Teildokumentation | Referenz | 8 (B 8) | hoch |
| 44 | 4 | Hausprozesse ohne Herstellerdoku | Checkliste | 10 (D 10) | – |
| 45 | 4 | Hauskonfiguration und Geräte (Rechte, Kartenterminal, Schlüsselkarten) | Referenz | 3 (C 3) | niedrig |

Die Nummern entsprechen `umsetzungsliste.csv`. Dort stehen auch die zugehörigen Ablauf-IDs.

---

## 9. Offene Lücken

**D – nicht ausreichend belegbar (14):**
- Walk-in
- Early Check-in, Late Check-out
- Gutschein ohne Givito
- Kaution
- abgelehnte Karte bzw. gestörtes Terminal
- Schicht- und Kassenübergabe
- Nachtdienst-Checkliste
- Notfallbetrieb bei Ausfall
- Druckprobleme
- allgemeiner Fehlermeldungs-Katalog
- Rechnung beim Check-out auf Debitor übertragen (nur in Release Notes erwähnt)
- Meldepflicht und Aufbewahrung
- Upgrade-Politik

**C – nur mit zusätzlichem Zugang (5):**
- Rechte und Rollen im eigenen Haus
- Kartenterminal-Bedienung
- Schlüsselkarten (Schließsystem)
- Ausweis-Scan (Lizenz)
- Telefonanlage, POS und Channel Manager im Zusammenspiel

**Wichtige B-Fälle in P1 (27), Auswahl:**
- Reservierungsstatus ändern
- Garantie- und Stornoinfo
- Bucher ändern
- Check-in rückgängig machen (in einer Release Note von 2023 für Gruppen und im Artikel „Vorzeitiger Check-out“ erwähnt, ohne Schritte)
- No-Show-Gebühren kontrollieren
- automatische Gebühren (lizenzabhängig)
- Voraussetzungen für Kartenzahlung und Terminalanmeldung
- alle Kontrollberichte für Kasse und Nachtdienst: nur Berichtsbeschreibungen, keine Bedienabläufe

**Zusätzlich gilt für alle Abläufe:** Hauskonfiguration (Kassen, Zahlarten, Preistypen, Richtlinien, X-Setups) und lizenzierte Module bestimmen, welche Anleitung in Ihrem Haus überhaupt zutrifft.

---

## 10. Rechtliche Hinweise (Nutzungsrechte ungeklärt)

- **Texte, Bilder und Videos der Hilfe sind geschützt** („© protel hotelsoftware GmbH. All rights reserved.“, keine Nutzungserlaubnis). Übernahme, auch übersetzt oder leicht umformuliert, ist nicht vorgesehen.
- **Später erlaubt und geplant:** eigenständig formulierte Anleitungen mit Link auf die Originalquelle. Reine Fakten wie Menüpfade oder Schaltflächennamen dienen nur als Bedienhinweis.
- **Eigene Screenshots** zeigen eine geschützte Oberfläche. **Nutzungsrecht ungeklärt** – nur intern, nur mit Testdaten und erst nach Klärung mit Planet bzw. laut Lizenzvertrag.
- **Automatisierter Abruf:**
  - Die Cloud-Hilfe sperrt per `robots.txt` (`User-agent: * / Disallow: /`) jeden automatisierten Zugriff.
  - Für diese Prüfung wurden in Ihrem Auftrag in Phase 1 rund 480 Seiten einzeln und gedrosselt abgerufen, im Vorbericht weitere rund 95. Ausgewertet wurde nur lokal.
  - Ob das mit dem Vorbehalt des Herstellers vereinbar ist (Text-und-Data-Mining, § 44b UrhG), ist **ungeklärt**.
  - **Empfehlung:**
    - keine weiteren automatisierten Abrufe ohne Zustimmung von Planet;
    - für die Anleitungen in Phase 2 nur gezielte Einzelaufrufe zum Gegenlesen;
    - die zwischengespeicherten Seiten (nur im Scratchpad) lösche ich auf Wunsch sofort, spätestens zum Ende von Phase 2.
- **Kennzeichnung:** Im Themenkatalog trägt jeder Ablauf die Spalte „Rechte“ mit diesem Vermerk.
- **Empfohlener Schritt:** eine kurze schriftliche Anfrage an Planet/protel. Redaktionskontakt der Hilfe: documentation@protel.net. Inhalt der Anfrage:
  1. interne Nutzung eigener Anleitungen mit Quellenlinks,
  2. eigene Screenshots für den internen Gebrauch,
  3. die durchgeführte Auswertung.

---

## 11. Empfehlung für Phase 2

### 11.1 Vorab von Ihnen zu klären
1. **Land des Hotels.** Deutschland? Davon hängen KassenSichV, Meldeschein-Regeln, Ortstaxe und E-Rechnung ab.
2. **Aktive Module und Lizenzen:**
   - integrierte Kartenzahlung/EFT (Planet) und Pay by Link
   - digitaler Meldeschein, Schlüssel-Interface, ID-Scanning
   - automatische Anzahlungs-, Storno- und No-Show-Gebühren
   - Sharer, Daily Rates V2, Komponentenzimmer, Ortstaxenmodul, Givito
3. **Prüfung im System:** Wer kann Anleitungen im echten System nachvollziehen? Gibt es ein Test- oder Trainingshaus bzw. Testreservierungen und eine Testkasse?
4. **Rechteklärung mit Planet:** Ich kann einen Textentwurf für die Anfrage vorbereiten.
5. **Verteilung der echten Inhalte:** Die bestehende Seite auf GitHub Pages ist öffentlich. Hausinterne Inhalte und protel-bezogene Anleitungen gehören dort nicht hin. Mein Vorschlag (kostenlos, ohne Server):
   - Die öffentliche App bleibt mit Beispieldaten.
   - Die echte Wissensdatenbank wird als interne Importdatei verteilt, etwa per Dateifreigabe, USB oder AirDrop.
   - Am Windows-PC wird sie wie bisher als Datendatei eingesetzt, auf iPhone und iPad über „Import“ aus der Dateien-App geladen.
   - Danach ist alles offline verfügbar. Private GitHub-Pages-Seiten sind nicht kostenlos und kommen daher nicht in Frage.

### 11.2 Vorgehen (nach Ihrer Freigabe)
1. **Kleine, abwärtskompatible Erweiterung des Datenmodells:**
   - je Artikel: Quellen (URL, Datum), Stufe, Versionsrisiko, „geprüft am / von / bei Version“, Kennzeichen „Hausregel“
   - Bestehende Artikel und lokale Daten bleiben unverändert erhalten.
   - Vor jedem Import wird eine Sicherung exportiert (vorhandene Funktion).
2. **Pilot mit 5 Anleitungen aus Welle 1** (eigene Formulierung, Quellenlinks, Platzhalter für Screenshots, Prüfliste):
   - Check-in (Paket 9)
   - Check-out (12)
   - Kassenabschluss (21)
   - Tagesabschluss mit Entscheidungsbaum (24)
   - No-Shows mit Entscheidungsbaum (19)

   Sie oder eine Kollegin prüfen im System, danach folgen die Screenshots.
3. **Restliche Welle 1** (18 Pakete), dann **Welle 2** nach Abgleich mit System und englischer Fassung.
4. **Welle 3** nur für die bei Ihnen aktiven Module.
5. **Welle 4** als Vorlagen und Checklisten, die Sie mit Ihren Hausregeln füllen.
6. **Suche:** Synonymliste um die Begriffsvarianten aus Abschnitt 3 ergänzen.
7. **Pflege:**
   - Release Notes monatlich prüfen (Planet veröffentlicht alle 2–4 Wochen).
   - Jeder Artikel zeigt „Stand: Version 26.xx, geprüft am …“.

### 11.3 Technische Vorgaben (bestätigt, für Phase 2)
- Kostenlos, ohne KI und externe APIs, ohne protel-Anbindung. Die App bleibt eine reine Offline-Wissensdatenbank (Windows per `file://`, iPhone/iPad als PWA).
- **Screenshots in der Windows-Desktop-Browseransicht:**
  - Chrome oder Edge, Fenster maximiert, 1920×1080 bei 100 % Zoom (laut Systemvoraussetzungen mindestens 1366×768, empfohlen 1920×1080)
  - nur Testdaten, auf den relevanten Bereich zugeschnitten, mit eigenen Markierungen
  - komprimiert (JPEG/WebP), damit die Importdatei auch auf dem iPhone klein bleibt
  - nur intern und erst nach Rechteklärung
- Bestehende App und lokale Nutzerdaten bleiben erhalten: nur additive Änderungen, Import über die vorhandene Import-/Export-Funktion.

---

## Anhang

**Dateien (temporär, nicht im Projekt):** `Phase1-Abschlussbericht.md`, `themenkatalog.csv/json`, `quellenverzeichnis.csv`, `umsetzungsliste.csv/json` im Ordner `out` des Scratchpads.

**Aufbau des Themenkatalogs für die spätere Wissensdatenbank:**

| Katalogfeld | Entspricht in der App |
|---|---|
| Bereich | Kategorie |
| Ablauf | Artikeltitel |
| Format | Artikeltyp (Anleitung, Entscheidungsbaum, Fehlerbehebung, Checkliste, Referenz) |
| Quellen | Quellenlinks |
| Priorität, Stufe, Versionsrisiko | Metadaten |
| Rechte | interner Vermerk |

**Netzwerk:** Die im Vorbericht genannten 21 Freigaben in Ihrer Cloud-Umgebung „Standard“ bestehen weiter und lassen sich auf Wunsch entfernen.

**Nicht verifizierbar:**
- Bild- und Videoinhalte
- deutsche Fassungen hinter Login (Beispiel: Marktsegment/Vertriebsweg)
- Inhalte des Kundenportals und von confluence.protel.net
- Ihr eigenes System, Ihre Konfiguration und Ihre Lizenzen
- Release Notes für P2/P3 nur stichprobenartig
