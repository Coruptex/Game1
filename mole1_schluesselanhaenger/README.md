# Mole 1 Brunsbüttel – Schmuck-Schlüsselanhänger

Recherche, Rekonstruktion, 3D-Modell (Blender) und Prüfbericht für einen Anhänger nach dem Molenfeuer auf Mole 1 im Alten Vorhafen der Brunsbütteler Schleusen (Nord-Ostsee-Kanal, Baujahr 1894/95).

Bericht mit Bildern als Webseite: https://claude.ai/artifact/3NZxJzazqYaVMLd9e9qKw3 (privat; zum Weitergeben über das Teilen-Menü der Seite freigeben).

## Kurzfassung

| | |
|---|---|
| **Ergebnis** | STL-Datei `export/Mole1_Brunsbuettel_Anhaenger_A_35mm.stl`, Gesamthöhe **35,00 mm** inkl. Öse, Maßstab **1 : 457**, in Blender 5.2.3 erzeugt und unabhängig geprüft: geschlossen, ein einziger Körper, keine Fehlkanten. |
| **Gewählte Ausführung** | Variante A, dreidimensionale Miniatur (Begründung in Abschnitt 4). Variante B (Halbrelief) liegt zum Vergleich bei. |
| **Belegt** | Gesamthöhe 13,40 m über Molendeck, achteckiger Granitsockel, achteckiger, sich verjüngender Turm aus vernieteten Gussplatten, zwei offene Galerien auf gusseisernen Kragarmen, runde Laterne, helmförmiges Kupferdach, Wetterfahne von 1895. |
| **Wichtigste Einschränkung** | Ich konnte **keine Fotos ansehen**. Diese Arbeitsumgebung lässt nur Paketquellen und GitHub zu, und die Websuche liefert nur Text. Die Bauteile sind durch Textquellen belegt, **die Proportionen sind Schätzungen** und vor dem Guss an Fotos zu prüfen (Abschnitt 2.5). |
| **Nicht durchgeführt** | Kein Testdruck (kein Drucker verfügbar), kein Lauf in Bambu Studio. Durchgeführt wurde eine Slicer-Prüfung mit PrusaSlicer 2.7.2 und einem A1-ähnlichen 0,2-mm-Profil. |

## 1. Lieferumfang

| Datei | Inhalt |
|---|---|
| `export/Mole1_Brunsbuettel_Anhaenger_A_35mm.stl` | **Finale STL**, binär, Einheit mm, Z nach oben, Sockel auf z = 0 |
| `export/Mole1_Brunsbuettel_Anhaenger.blend` | Editierbare Blender-Datei: Einzelbauteile (Collection `01_Bauteile`), Endkörper (`03_Export_Anhaenger`), Variante B (`04_Variante_B_Relief`), Skript als Textblock |
| `export/Mole1_Brunsbuettel_Variante_B_Relief_Vergleich.stl` | Variante B, nur zum Vergleich |
| `export/modell_parameter.json` | Alle Real- und Modellmaße mit Status |
| `blender/mole1_anhaenger.py` | Parametrisches Blender-Python-Skript (baut, vereinigt, exportiert) |
| `pruefung/pruefbericht.json` | Maschinenlesbarer Prüfbericht |
| `pruefung/slicer/` | Slicer-Prüfung: Ergebnis-JSON, Profile, Bahnbilder |
| `bilder/` | Renderings, Maßzeichnung (PNG/PDF) |
| `werkzeuge/` | Prüf-, Render-, Zeichnungs- und Slicer-Skripte, `alles_erzeugen.sh` |

## 2. Recherche

### 2.1 Welche Mole ist gemeint?

Die Brunsbütteler Schleusen haben zwei Vorhäfen zur Elbe. **Mole 1 und Mole 2** begrenzen seit 1895 den **Alten Vorhafen** der Alten (Kleinen) Schleusen, **Mole 3 und 4** den Neuen Vorhafen (1913/14). Verwechslungsgefahr besteht vor allem mit Mole 2: Ihr Leuchtturm war ein **baugleicher Zwilling** von 1895, wurde im Dezember 2013 für die Verlängerung der Mole abgebaut und eingelagert und soll später auf Mole 4 wieder aufgestellt werden. Auf der verlängerten Mole 2 steht seit 2014 ein neuer, 16 m hoher Turm. Mole 4 trägt einen GFK-Turm von 1977, der 2009 durch eine Havarie beschädigt wurde. **Der historische Turm von 1895, der heute noch an Ort und Stelle steht, ist der auf Mole 1.**

Lage laut WSA: 53° 53′ 19″ N, 9° 08′ 38″ E. Baken-net bezeichnet Mole 1 als westliche Mole.

### 2.2 Belegte Fakten

| Merkmal | Angabe | Quellen |
|---|---|---|
| Bauzeit / Inbetriebnahme | 1894/95; angezündet 3.8.1895 (Datenbank) bzw. 30.8.1895 (Mitteilung des Kaiserlichen Kanalamts) | WSA, deutsche-leuchtfeuer.de, baken-net.de |
| Höhe | **13,40 m über Molendeck**; Bauwerkshöhe 13,00 m | WSA; deutsche-leuchtfeuer.de |
| Molendeck | NN +3,50 m (zusammen mit den 13,40 m genannt; die Seite ließ sich in der Suche nicht eindeutig zuordnen) | Suchergebnisse zu WSA / Brunsbüttel-Wiki |
| Feuerhöhe | 13,50 m über MThw; ≈ 15 m über NHN; 14 m (gerundet); 14,97 m über Seekartennull (historisch) | deutsche-leuchtfeuer.de, WSV-Broschüre, Leuchtturm-Atlas, Förderverein Roter Sand |
| Sockel | achteckig, Granitsteinmauerwerk | WSA, deutsche-leuchtfeuer.de, ibiblio |
| Turm | achteckig, nach oben verjüngt, vernietete Gussplatten | deutsche-leuchtfeuer.de, brunsbuettel-wiki.de, baken-net.de, ibiblio |
| Galerien | zwei offene Galerien, untere um 1914 angebaut; schwarz gefasst; gusseiserne Kragarme, mit Winkelprofilen verbunden | deutsche-leuchtfeuer.de, WSA, ibiblio |
| Innen | gusseiserne Wendeltreppe mit Jugendstil-Ornamenten | WSA, deutsche-leuchtfeuer.de |
| Laterne | rund, schwarz | Verzeichnis Werner Dröger |
| Optik | Gürtellinse 460 mm hoch, Brennweite 185 mm (Fresnel V. Ordnung), Glühlampe mit Wechsler, 2 500 cd | deutsche-leuchtfeuer.de |
| Dach | Kupferblech, helmförmig / kuppelartig / halbkugelförmig, weiß | deutsche-leuchtfeuer.de, brunsbuettel-wiki.de, Dröger |
| Wetterfahne | reich verziert, Jahreszahl 1895, noch funktionsfähig | deutsche-leuchtfeuer.de, Dithmarschen-Wiki |
| Kennung | F WG (Festfeuer weiß/grün), Tragweite W 10 sm, G 6,6 sm | deutsche-leuchtfeuer.de, leuchttuerme.net |
| Geschichte | 1993 wegen Einsturzgefahr des Molenkopfs demontiert, instandgesetzt, 1995 auf neuer, eigener Pfahlgründung mit Granitsockel wieder aufgestellt; Denkmalschutz | WSA, deutsche-leuchtfeuer.de, baken-net.de, ibiblio |
| Farbgebung | weißer Turm, weißes Dach, schwarze Galerien, Aufschrift „1“ (Stand 2009); unteres Drittel schwarz; WSA: Farbgestaltung wird später angepasst | Leuchtturm-Atlas, Beacon Light Philately, leuchttuerme.net, WSA |
| Briefmarke | Deutsche Post, 45 ct, 7.7.2005 (Michel 2473), Entwurf Johannes Graf | Colnect, wolkenmond.de |

### 2.3 Widersprüche und wie ich sie aufgelöst habe

| Punkt | Angaben | Entscheidung |
|---|---|---|
| Grundriss | achteckig (5 unabhängige Quellen) gegenüber sechseckig (Förderverein Roter Sand, MarineTraffic) | **achteckig** |
| Höhe | 13,40 m (WSA, über Molendeck), 13,00 m, 14 m, 11 m (nur Eisenturm), „36 m“ (Lighthouse Digest; offensichtlich Fuß statt Meter) | **13,40 m** einschließlich Wetterfahne |
| Material | Gusseisen (WSA, mehrere) gegenüber „Stahloberbau“ (Förderverein) | **Gusseisen** (amtliche Angabe) |
| Farbe | weiß/schwarz (mehrere); „bojenartiger schwarzer Turm mit weißem Band“ (Dröger, vermutlich älterer Zustand); „rot-weiß gestreift“ (Komoot-Nutzerhinweis, passt zum Richtfeuer auf der Schleuseninsel) | für ein einfarbiges Metallstück ohne Bedeutung |
| Lage der unteren Galerie | nirgends als Maß angegeben; Farbbeschreibung „oberhalb der unteren Galerie weiß, unteres Drittel schwarz“ | **≈ 1/3 der Höhe (4,50 m)**, als Schätzung gekennzeichnet |

### 2.4 Bildreferenzen (gefunden, aber nicht selbst gesichtet)

Diese Seiten enthalten Fotos von Mole 1. Ich konnte sie wegen der Netzwerkbeschränkung **nicht öffnen** und habe sie deshalb nicht für Maße ausgewertet.

- [Wikimedia Commons, Kategorie „Lighthouses in Schleswig-Holstein“](https://commons.wikimedia.org/wiki/Category:Lighthouses_in_Schleswig-Holstein) mit der Unterkategorie „Brunsbüttel breakwater lights“ (18 Dateien) und der Datei „Brunsbuettel Molenfeuer 1.jpg“ ([Kategorie Cast-iron lighthouses](https://commons.wikimedia.org/wiki/Category:Cast-iron_lighthouses))
- [deutsche-leuchtfeuer.de – Brunsbüttel Molenfeuer 1](https://www.deutsche-leuchtfeuer.de/binnen/elbe/brunsbuettel-molenfeuer-1.html) (Foto vom September 2020)
- [Architektur-Bildarchiv, Foto Nr. 75969](https://www.architektur-bildarchiv.de/image/Leuchtfeuer-Mole-1-Brunsb%C3%BCttel-75969.html) (Thomas Robbin, 9.5.2018)
- [wolkenmond.de – Brunsbüttel Mole 1](http://wolkenmond.de/foto/leuchttuerme/brunsbuettel.html)
- [fotocommunity – „Mole Eins – Blick vom NOK auf die Elbe“](https://portfolio.fotocommunity.de/m-jennrich/photo/44506761)
- [Alamy 79741979](https://www.alamy.com/stock-photo-historic-mole-1-lighthouse-brunsbttel-schleswig-holstein-germany-79741979.html), [Dreamstime 178175802](https://www.dreamstime.com/lighthouse-mole-lock-entrance-kiel-canal-brunsbuettel-schleswig-holstein-north-sea-germany-architecture-lighthouses-image178175802), [Photo12 / imageBROKER](https://www.photo12.com/en/image/brk19i09_031), [Pond5 51915955](https://www.pond5.com/es/stock-images/photos/item/51915955-historic-mole-1-lighthouse-brunsbuttel-schleswigholstein-ger)
- Briefmarke Michel 2473: [Colnect](https://colnect.com/de/stamps/stamp/111479-Brunsb%C3%BCttel_Mole_1-Leuchtt%C3%BCrme-Deutschland_BRD), [suche-briefmarken.de](https://www.suche-briefmarken.de/marken/brd/d2005040.html)

### 2.5 Einschränkung und wie sie sich beheben lässt

Die Bauteile und ihre Reihenfolge sind belegt. Nicht belegt sind Durchmesser, Sockelmaße, die genaue Lage der unteren Galerie, Laternen- und Dachmaße, die Zahl der Laternensprossen und die Geländerteilung. Diese Werte habe ich aus den belegten Höhen, der Linsengröße und einer Funktionsüberlegung abgeleitet oder geschätzt (Abschnitt 3).

**Empfohlener Abgleich vor dem Guss:** 4–6 Fotos von Mole 1 schicken (Seitenansicht des ganzen Turms, beide Galerien, Laterne mit Dach, möglichst gerade von der Seite). Alternativ kann der Netzwerkzugriff der Arbeitsumgebung für `commons.wikimedia.org`, `upload.wikimedia.org`, `www.deutsche-leuchtfeuer.de` und `www.wsa-nord-ostsee-kanal.wsv.de` freigegeben werden. Die geschätzten Maße stehen gesammelt in der Tabelle `REAL` am Anfang des Skripts. Nach einem Fotoabgleich sind sie in wenigen Minuten angepasst, und das Skript erzeugt alles neu.

## 3. Rekonstruktion

Bezugshöhe z = 0 ist das Molendeck (Unterseite Granitsockel). Modellmaße bei 35,00 mm Gesamthöhe, Maßstab 1 : 457 (2,186 mm je Meter).

| Bauteil | Realmaß | Status | Modell |
|---|---|---|---|
| Gesamthöhe über Molendeck | 13,40 m | belegt | – |
| Granitsockel, achteckig: Höhe / Schlüsselweite | 2,40 m / 3,00 m | Schätzung (13,40 m minus ≈ 11 m Eisenturm laut ibiblio) | 5,25 / 6,56 mm |
| Gussturm, achteckig, verjüngt: Schlüsselweite unten / oben | 2,50 m / 1,75 m | Schätzung | 5,47 / 3,83 mm |
| Untere Galerie, Oberkante Boden | 4,50 m | Schätzung (≈ 1/3 der Höhe) | 9,84 mm |
| Untere Galerie, Laufbreite | 0,70 m | Schätzung | 1,53 mm |
| Obere Galerie, Oberkante Boden | 10,00 m | abgeleitet | 21,86 mm |
| Obere Galerie, Laufbreite | 0,60 m | Schätzung | 1,31 mm |
| Geländerhöhe | 1,00 m | Schätzung | 2,19 mm |
| Brennebene | 11,50 m | abgeleitet (≈ 15 m ü. NHN minus NN +3,50 m) | 25,14 mm |
| Laterne rund: Ø / Brüstung / Verglasung | 1,40 / 0,95 / 1,10 m | Form belegt, Maße geschätzt | 3,06 / 2,08 / 2,40 mm |
| Dach: Ø / Spitze | 1,60 m / 12,90 m | Form belegt, Maße geschätzt | 3,50 / 28,20 mm |
| Wetterfahne | 12,90–13,40 m | belegt, im Modell durch die Öse ersetzt | – |

**Herleitung der oberen Galerie.** Ein erster Entwurf hatte die obere Galerie auf 10,40 m. Damit hätte das Geländer (Oberkante 11,40 m) fast die Brennebene (11,50 m) erreicht und das eigene Leuchtfeuer abgeschattet. Das ist funktional unplausibel. Die Galerie liegt deshalb auf 10,00 m, und die Verglasung beginnt etwa auf Geländerhöhe.

**Bewusst nicht modelliert**, weil nicht belegt: Tür, Fenster, Außenleiter, Plattenstöße und Nieten, Blitzableiter, Geländer und Form des Molenkopfs. Die Pfahlgründung ist unsichtbar. Die Aufschrift „1“ ist belegt, Lage und Größe aber nicht. Sie ist deshalb als **Option** im Skript enthalten (`--inschrift`, gravierte „1“ auf der Vorderseite des unteren Turmabschnitts) und standardmäßig ausgeschaltet.

**Annahmen zu Details:** 8 Kragarme unter den Turmecken; achteckige Galerien, weil die Kragarme mit geraden Winkelprofilen verbunden sind; 8 Laternensprossen; Geländer vereinfacht auf Eckpfosten und Handlauf.

**Mindestmaße statt maßstäblicher Werte.** Maßstäblich wäre ein Geländerstab etwa 0,1 mm dick, ein Galerieboden etwa 0,2 mm. Beides ist weder druck- noch gießbar. Im Modell gelten:

| Element | Modellmaß |
|---|---|
| Galerieboden | 0,60 mm |
| Geländerband / Handlauf | 0,60 / 0,60 mm |
| Eckpfosten (je anschließende Seite) | 0,55 mm |
| Kragarme | 0,60 mm, 45° geneigt |
| Laternensprossen | 0,45 mm breit, Scheiben 0,20 mm zurückgesetzt |
| Traufkante | 0,40 mm (dünnste Stelle) |
| Sockelfasen | 0,25 mm unten, 0,15 mm oben |

## 4. Variante A (3D-Miniatur) oder Variante B (Halbrelief)?

Beide Varianten wurden tatsächlich gebaut und mit denselben Werkzeugen geprüft. Variante B ist die vordere Hälfte von A mit flacher Rückseite, in der Tiefe auf 75 % gestaucht, mit voll starker Öse.

| Kriterium | A: 3D-Miniatur | B: Halbrelief |
|---|---|---|
| Abmessungen | 8,07 × 8,07 × 35,00 mm | 8,07 × 3,03 × 35,00 mm |
| Volumen | 628,7 mm³ | 257,3 mm³ |
| Gewicht Silber 925 / Gold 750 (Rohguss, ca.) | 6,5 g / 9,7 g | 2,7 g / 4,0 g |
| Dünnste Wand | 0,40 mm (Traufe, geplant) | 0,32 mm (durch die Stauchung) |
| Engster Spalt | 1,01 mm | 0,59 mm |
| Detailtreue | Achteckiger Turm, Galerien rundum, runde Laterne, alles räumlich | nur Vorderhälfte, Proportionen in der Tiefe verfälscht |
| Wiedererkennbarkeit | von allen Seiten | nur von vorn |
| FDM-Druck | aufrecht, ohne Stützen; Galerieunterseiten als Überhang | liegend, nahezu ohne Überhänge |
| Alltag | 8 mm stark, rundum geschlossen | flach, leichter |
| Guss | massiv, mehr Metall, Hinterschnitte an den Galerien | weniger Metall, flache Rückseite erleichtert Anguss und Nacharbeit |

**Entscheidung: Variante A.** Das Motiv ist ein frei stehender, achsensymmetrischer Turm. Seine Erkennungsmerkmale sind der verjüngte Achteckschaft, die zwei umlaufenden Galerien und die runde Laterne mit Kuppel, und die wirken nur räumlich. Ein Schlüsselanhänger hängt frei und wird von allen Seiten gesehen. Mit 8 mm Breite bleibt A trotzdem schlank, und 6,5 g Silber sind für einen Schlüsselanhänger üblich. B ist leichter und einfacher zu gießen, hat aber dünnere Stellen und verliert die Raumwirkung. Wenn Gewicht oder Goldpreis entscheiden, ist B die sinnvolle Alternative und liegt fertig bei.

## 5. Öse

Die Öse sitzt auf der Dachspitze, also dort, wo am Original die Wetterfahne steht. Ein kurzer Schaft mit Kragen nimmt die Stelle der Fahnenstange ein.

| Maß | Wert | Begründung |
|---|---|---|
| Lochdurchmesser | **3,60 mm** (gemessen 3,598–3,600 mm) | Ein Spaltring trägt den Anhänger auf zwei Drahtlagen. Bei üblichen 25–28-mm-Ringen (Flachdraht ≈ 2,5–3,0 × 0,9–1,0 mm) ergibt das einen Querschnitt von ≈ 2,0 × 3,0 mm, und der passt durch 3,6 mm. |
| Ring | 1,30 mm radial × 1,90 mm quer, außen Ø 6,20 mm | elliptischer, gerundeter Querschnitt ohne Kanten |
| Schaft | Ø 1,40 mm, Kragen Ø 1,70 mm am Dach | kleinster Querschnitt im Kraftfluss: 1,54 mm² |
| Ringflanken / Scheitel | 3,86 mm² gesamt / 1,93 mm² | aus der STL gemessen |
| Hängelage | Schwerpunkt auf der Achse (x = y = 0) | hängt senkrecht; Ösenebene parallel zu einer Achteckfläche |

Grobe Tragfähigkeit des Schafts, nur als Schätzung mit Literaturwerten und **nicht geprüft**: PLA quer zu den Schichten etwa 30–45 N, Silber 925 gegossen deutlich über 300 N.

## 6. Druck auf dem Bambu Lab A1 mit 0,2-mm-Düse

**Empfohlene Einstellungen in Bambu Studio:**

- Prozessprofil „0.08mm Extra Fine @BBL A1 0.2 nozzle“ (feiner: 0.06 mm)
- PLA, bevorzugt matt und hellgrau, damit Details sichtbar bleiben
- **aufrecht** drucken, so wie exportiert (Sockel auf der Platte)
- **ohne Stützen**; Brim an (3–5 mm), weil das Teil hoch und schlank ist und der A1 das Bett bewegt
- Wandgenerator Arachne oder Classic (beide geprüft)
- Mindestschichtzeit ≈ 8 s; besser 2–3 Exemplare mit Abstand gleichzeitig drucken, dann kühlt jede Schicht länger, und ein Ersatzteil entsteht nebenbei

**Slicer-Prüfung** (PrusaSlicer 2.7.2, 0,22 mm Linienbreite, 0,08 mm Schichthöhe; **kein** Testdruck):

- 437 Schichten, ≈ 1 h Druckzeit, ≈ 0,8 g PLA (Bambu Studio wird etwas abweichen)
- Alle 8 Eckpfosten je Galerie entstehen als eigene geschlossene Bahnen, Handlauf und Galerieböden als vollständige Ringe, die Laternensprossen als Erhebungen der Außenwand, beide Ösenflanken sauber.
- Keine schwebenden Inseln. Die Galerieunterseiten zwischen den Kragarmen (≈ 1,5 mm Auskragung) und die Handläufe über den Öffnungen druckt der Slicer als Brücken und Überhänge. Mit automatischen Stützen bei 45° würde er Stützen bis zu den Galerien und der Öse aufbauen. Die wären zwischen den Geländerpfosten kaum zu entfernen und sind deshalb **nicht empfohlen**.
- Der von der Prüfung erzeugte G-Code ist **nicht** für den A1 bestimmt und wurde nicht aufbewahrt.

| Detail | Modellgröße | 0,2-mm-FDM | Metallguss |
|---|---|---|---|
| Achteckflächen des Turms | 1,6–2,3 mm breit | sicher | sicher |
| Sockelabsatz | 0,55 mm | sicher | sicher |
| Galerieböden und Kragarme | 0,60 mm, 45° | sicher; leichtes Durchhängen unter den Böden möglich | sicher |
| Geländerpfosten und Öffnungen | 0,55–0,60 mm; Öffnungen 2,2 × 1,6 mm (unten) bzw. 1,6 × 1,6 mm (oben) | druckbar, in PLA mechanisch empfindlich | Grenzbereich, siehe Abschnitt 7 |
| Laternensprossen und Scheiben | 0,45 mm / 0,20 mm tief | grenzwertig, weich gezeichnet | sichtbar |
| Traufkante | 0,40 mm stark, 0,22 mm Überstand | grenzwertig (≈ 1 Linienbreite) | sichtbar, empfindlich |
| Kuppel | Ø 3,5 mm | Schichtstufen sichtbar | glatt |
| Öse | Ø 6,2 / 3,6 mm | sicher; Lochoberseite hängt leicht durch | sicher |

## 7. Guss: verfahrensneutrale Ausgangsbasis und kritische Stellen

Das Modell ist **massiv** und schreibt **kein Gussverfahren** vor. Ich lege bewusst keine allgemeingültigen Mindestwandstärken fest, weil diese vom Verfahren, der Legierung, der Größe und der Ausstattung der Gießerei abhängen. Die verwendeten Konstruktionsmaße stehen oben. Ob die Datei für ein bestimmtes Verfahren geeignet ist, entscheidet die Gießerei.

**PLA ist nur der Prototyp.** Der PLA-Druck dient zur Beurteilung von Größe, Form und Gefühl in der Hand. Er ist kein Gussmodell. Für den Guss wählt die Gießerei ein eigenes Modellmaterial (zum Beispiel Gusswachs oder gießbares Harz) oder ein eigenes Verfahren.

**Kritische Stellen, die vor dem Guss geprüft oder angepasst werden sollten:**

1. **Geländer der Galerien.** Das ist die dünnste tragende Struktur: Eckpfosten 0,55 mm je Seite, Band und Handlauf 0,60 mm, Öffnungen 1,6–2,2 × 1,6 mm. Formfüllung und Bruchgefahr der Einbettmasse sind zu prüfen. Option: `--blind` erzeugt geschlossene, nur angedeutete Felder, oder die Stärken in `P` werden erhöht.
2. **Spalt zwischen Geländer und Turm bzw. Laterne.** Lichte Weite 1,01 mm (unten) und 1,10 mm (oben) bei ≈ 1,6–2,2 mm Tiefe. Hier entstehen dünne Stege in der Einbettmasse, und die Stelle ist zum Polieren schlecht zugänglich.
3. **Taschen zwischen den Kragarmen** unter beiden Galerieböden (≈ 1,5 mm Auskragung). Schwer zu polieren; bei Gummi- oder Silikonformen Hinterschnitte.
4. **Traufkante unter der Kuppel:** 0,40 mm stark mit 0,22 mm Überstand. Das ist die dünnste Stelle im Modell. Sie kann bei Bedarf verstärkt oder weggelassen werden.
5. **Laternensprossen und Scheibenrücksprung** (0,45 mm / 0,20 mm). Feines Relief, das beim Polieren nicht verschliffen werden sollte; gut zum Oxidieren (Schwärzen) geeignet, passend zur schwarzen Laterne des Originals.
6. **Öse und Schaft.** Der Schaft mit Ø 1,40 mm ist der kleinste Querschnitt im Kraftfluss (1,54 mm²). Belastbarkeit und Lochweite mit dem vorgesehenen Schlüsselring prüfen.
7. **Materialanhäufung.** Sockel und Turmschaft sind massiv (bis 6,6 mm stark), die Details nur 0,4–0,6 mm. Das bedeutet ungleichmäßige Abkühlung und Schwindung und mögliche Porosität. Ob und wie ausgehöhlt wird (etwa von unten), entscheidet die Gießerei.
8. **Anguss.** Die flache Sockelunterseite (≈ 31 mm²) ist unauffällig und gut zugänglich. Die Entscheidung liegt bei der Gießerei.
9. **Schwindmaß.** Die STL hat **Endmaß**. Eine Schwindungszugabe muss je nach Verfahren aufgeschlagen werden.
10. **Formteilung bei Gummi- oder Silikonformen.** Rundum laufende, durchbrochene Galerien erschweren das Schneiden der Form. Variante B oder `--blind` wären hier einfacher.

## 8. Prüfbericht

| Prüfpunkt | Ergebnis |
|---|---|
| 1. Gesamthöhe und Abmessungen | 35,000 mm hoch, 8,07 × 8,07 mm (Galerie unten), Ziel erreicht |
| 2. Vollständigkeit | alle 37 Einzelbauteile zu 100 % im Endkörper (Stichproben je Bauteil); alle 16 Geländeröffnungen und das Ösenloch offen; Topologie-Geschlecht 17 = 16 Öffnungen + 1 Öse, also stimmig |
| 3. Geschlossene Oberfläche | wasserdicht, Orientierung konsistent, gültiges Volumen |
| 4. Nicht-manifold Kanten, offene Flächen | 0 / 0; 0 entartete und 0 doppelte Dreiecke |
| 5. Lose oder schwebende Teile | genau 1 Körper; keine schwebenden Inseln in 437 Druckschichten |
| 6. Dünne Bereiche | Minimum 0,40 mm (Traufe), 0,45 mm (Sprossen), 0,55–0,60 mm (Geländer, Kragarme, Böden), alle so geplant; keine ungewollten Dünnstellen. Zwei Fehler habe ich dabei gefunden und behoben: überstehende Kragarmenden (Grate bis 0,07 mm) und Sprossenkanten (0,016 mm). |
| 7. Öse | Loch 3,60 mm gemessen; Querschnitte Schaft 1,54 mm², Flanken 3,86 mm²; Schwerpunkt auf der Achse |
| 8. FDM mit 0,2-mm-Düse | Slicer-Prüfung bestanden (Abschnitt 6); **Testdruck nicht durchgeführt** |
| 9. Details im Verhältnis zur Größe | Tabelle in Abschnitt 6 |
| 10. Skalierung und Export | binäre STL in mm, nach dem Export erneut eingelesen und geprüft; Blender-Szene mit 1 Einheit = 1 mm |
| Reproduzierbarkeit | Neuaufbau mit dem ausgelieferten Skript ergibt bitgenau identische STL-Dateien (SHA-256 verglichen); der komplette Ablauf `alles_erzeugen.sh` lief fehlerfrei durch; der Endkörper in der .blend ist dreieck- und volumengleich mit der STL |

Messmethoden: Wandstärke per Strahl von 60 000 Oberflächenpunkten nach innen, Spaltweite per Strahl nach außen. Gewertet wurde jeweils nur eine gegenüberliegende Fläche (±45°), sodass Treffer an Außenkanten und Innenecken nicht als Dünnstelle oder Spalt zählen. Die Inselprüfung schneidet das Modell in 0,08-mm-Schichten.

**Nicht geprüft:** Testdruck, Bambu Studio, Abgleich mit Fotos, Festigkeit (FEM oder Versuch), Beurteilung durch eine Gießerei.

SHA-256-Prüfsummen zur Kontrolle der Dateien:

```
e98ea318f724d3d1a3bae07cf9b8256144695d2b0be3df6683b4b468c04cd312  Mole1_Brunsbuettel_Anhaenger_A_35mm.stl
2963e4ad18e5e6f632e6b887b72fff0f40c64ca8825040f0a4e0f96b12e440cb  Mole1_Brunsbuettel_Variante_B_Relief_Vergleich.stl
```

## 9. Arbeitsweise und Ausführung

Alles in diesem Ordner wurde in dieser Arbeitsumgebung tatsächlich erzeugt. Blender 5.2.3 lief als Python-Modul (`bpy`), die STL ist also ein echtes Exportergebnis und kein ungetestetes Skript. Auf dem iPad selbst lässt sich Blender nicht ausführen.

- **STL drucken:** Die STL in Bambu Studio (Windows/macOS/Linux) öffnen. Ob die eigene Bambu-Handy-Version lokale STL-Dateien slicen kann, bitte in der App prüfen.
- **Maße ändern in Blender (Computer):** `export/Mole1_Brunsbuettel_Anhaenger.blend` öffnen, im Arbeitsbereich „Scripting“ den Textblock `mole1_anhaenger.py` wählen, die Werte in `REAL` (Realmaße) oder `P` (Modellmaße) ändern, „Run Script“ ausführen. Die neuen Dateien landen im Ordner `export` neben der .blend.
- **Kommandozeile:** `blender -b -P blender/mole1_anhaenger.py -- --out export --relief`, mit den Optionen `--hoehe 40`, `--blind` und `--inschrift`.
- **Gesamte Kette** (Modell, Prüfung, Slicer, Bilder): `werkzeuge/alles_erzeugen.sh`.
- Alternativ in dieser Sitzung: die gewünschte Änderung beschreiben; ich passe die Parameter an und erzeuge alles neu.

## 10. Nächste Schritte

1. **Fotoabgleich** (Abschnitt 2.5), dringend empfohlen vor dem Guss.
2. **Prototyp drucken** und Größe, Öse und Schlüsselring prüfen. Bei Wunsch nach mehr Detail ist `--hoehe 40` eine Option (Silber ≈ 10 g statt 6,5 g).
3. **Gießerei bzw. Onkel:** Liste der kritischen Stellen durchgehen, Verfahren wählen, über Aushöhlen, Anguss und Schwindmaß entscheiden.

## Quellen

- WSA Nord-Ostsee-Kanal: [Mole I](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/01_MoleI/MoleI_node.html) · [Leuchttürme Brunsbüttel](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/Leuchttuerme_Brunsbuettel_node.html) · [Mole IV](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/04_MoleIV/MoleIV_node.html)
- deutsche-leuchtfeuer.de: [Molenfeuer 1](https://www.deutsche-leuchtfeuer.de/binnen/elbe/brunsbuettel-molenfeuer-1.html) · [Molenfeuer 2](https://www.deutsche-leuchtfeuer.de/binnen/elbe/brunsbuettel-molenfeuer-2.html) · [Broschüre Leuchttürme auf Briefmarken (PDF)](https://www.deutsche-leuchtfeuer.de/themen/leuchttuerme-auf-briefmarken.pdf)
- baken-net.de: [Molen 1 und 2 der Alten Schleuse](https://www.baken-net.de/brunsbuettel_molen12.htm) · [Molen 3 und 4](https://www.baken-net.de/brunsbuettel_molen34.htm)
- Leuchtturm-Atlas: [Tabelle Brunsbüttel, Mole](https://www.leuchtturm-atlas.de/HTML/BrunsMT.html) · [Brunsbüttel, Mole](http://www.leuchtturm-atlas.de/HTML/BrunsM.html)
- Brunsbüttel-Wiki: [Mole 1](https://brunsbuettel-wiki.de/index.php?title=Mole_1_Brunsb%C3%BCttel) · [Mole 2](https://brunsbuettel-wiki.de/index.php?title=Mole_2_Brunsb%C3%BCttel)
- Dithmarschen-Wiki: [Mole 1](https://www.dithmarschen-wiki.de/Mole_1_Brunsb%C3%BCttel)
- Förderverein Leuchtturm Roter Sand: [Brunsbütteler Molenfeuer des Nord-Ostsee-Kanals](https://www.foerderverein-leuchtturm-roter-sand.de/seite/459631/brunsb%C3%BCtteler-molenfeuer-des-nord-ostsee-kanals.html)
- Maritime Landschaft Unterelbe: [Brunsbüttel Mole](https://www.maritime-elbe.de/brunsbuettel-mole/)
- leuchttuerme.net: [Portrait Brunsbüttel (Mole 1)](https://leuchttuerme.net/index.php?action=portrait&id=121&lang=1&nav=1000167) · [Molenfeuer / Einfahrtsfeuer](http://www.leuchttuerme.net/index.php?lang=1&nav=1000070)
- Lighthouse Directory (R. Rowlett): [Lighthouses of Germany: West Holstein](https://www.ibiblio.org/lighthouse/dewhol.htm)
- Werner Dröger: [Brunsbüttel-Schleusen Mole 1, 2, 3, 4](http://homepage.o2mail.de/wernerdroeger/index.html/BRUNSBUT.HTM)
- Beacon Light Philately: [0217 Brunsbuttel Mole-1 Lighthouse](http://ksbeacon.blogspot.com/2014/05/0217-germany-brunsbuttel-mole-1.html)
- Lighthouse Digest (mit Fuß/Meter-Fehler): [Datenbankeintrag 4092](https://www.lighthousedigest.com/Digest/database/uniquelighthouse.cfm?value=4092)
- MarineTraffic (Angabe „sechseckig“): [Brunsbüttel Mole 1 – Light Details](https://www.marinetraffic.com/en/ais/details/lights/1000006270)

Hinweis zur Methode: Alle Quellen wurden über eine Websuche ausgewertet, die Seiteninhalte als Text zusammenfasst. Die Seiten selbst und ihre Fotos konnte ich in dieser Umgebung nicht öffnen.
