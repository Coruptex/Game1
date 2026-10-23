# Mole 1 Brunsbüttel – Schmuck-Schlüsselanhänger

Recherche, fotobasierte Rekonstruktion, 3D-Modell (Blender) und Prüfbericht für einen Anhänger nach dem Molenfeuer auf Mole 1 im Alten Vorhafen der Brunsbütteler Schleusen (Nord-Ostsee-Kanal, Baujahr 1894/95).

Bericht mit Bildern und Fotovergleich als Webseite: https://claude.ai/artifact/3NZxJzazqYaVMLd9e9qKw3 (privat; zum Weitergeben über das Teilen-Menü der Seite freigeben).

## Kurzfassung

| | |
|---|---|
| **Ergebnis** | STL `export/Mole1_Brunsbuettel_Anhaenger_35mm.stl`: **35,00 mm** hoch (inkl. Öse), **13,98 mm** breit, Maßstab **1 : 384**. Erzeugt mit Blender 5.2.3 und unabhängig geprüft: geschlossen, ein einziger Körper, keine Fehlkanten. |
| **Version 2** | **Vollständig neu aufgebaut nach vier Referenzfotos** (F1–F4). Alle Proportionen sind an den Fotos gemessen. Die Modellkontur deckt sich mit Foto F4 (Abschnitt 4). Version 1 beruhte mangels Fotos auf Schätzungen und war deutlich zu lang und zu schmal. |
| **Detailgrad** | Granitsockel mit 4 Steinlagen im Läuferverband, Tür in Laibung mit Brettern, Bändern und Riegel, Abdeckplatte mit Schräge, Unterbau mit Bogenfenster und Steigleiter, Trichter mit Leiteraussparung, zwei runde Galerien mit 8 Pfosten und 3 bzw. 4 Holmen, Turm mit drei Treppenfenstern und gravierter „1“, 32 Hohlkehl-Konsolen, Laterne mit 16 Zickzack-Sprossen, achtteilige Glockenhaube mit Rippen, Knauf mit Lüftungsschlitzen. |
| **Ausrichtung auf den Guss** | So viel Detail wie für einen Feinguss nach gedrucktem Wachs- oder Harzmodell sinnvoll. Feinste Teile 0,20–0,30 mm; die kritischen Stellen sind in Abschnitt 6 einzeln benannt. Die Gießerei entscheidet über das Verfahren. |
| **Wichtigster Hinweis** | Diese Gussvorlage eignet sich **nicht** für einen FDM-Probedruck mit 0,2-mm-Düse: Der Slicer lässt die 0,28–0,30 mm dünnen Geländerpfosten weg (Abschnitt 7). Dafür wäre im nächsten Schritt eine verstärkte Prototyp-Variante nötig. |
| **Nicht durchgeführt** | Kein Testdruck, kein Lauf in Bambu Studio, kein Probeguss. Durchgeführt wurden eine Slicer-Prüfung mit PrusaSlicer 2.7.2 und eine geometrische Gussprüfung. |

## 1. Lieferumfang

| Datei | Inhalt |
|---|---|
| `export/Mole1_Brunsbuettel_Anhaenger_35mm.stl` | **Finale STL**, binär, Einheit mm, Z nach oben, Sockelunterkante auf z = 0, Tür zeigt nach −Y |
| `export/Mole1_Brunsbuettel_Anhaenger.blend` | Blender-Datei: `01_Bauteile` (102 einzeln benannte Bauteile), `02_Hilfsgeometrie` (Gravuren, Aussparungen), `03_Export_Anhaenger` (Endkörper), `04_Farbmodell_Rekonstruktion` (Originalfarben); Skript als Textblock. Beim Öffnen ist nur der Endkörper eingeblendet (Augen-Symbol im Outliner). |
| `export/modell_parameter.json` | Alle Real- und Modellmaße mit Status und Quelle |
| `blender/mole1_anhaenger.py` | Parametrisches Blender-Python-Skript (baut, vereinigt, graviert, exportiert) |
| `pruefung/pruefbericht.json` | Maschinenlesbarer Prüfbericht |
| `pruefung/slicer/` | Slicer-Prüfung: Ergebnis-JSON, Profile, Bahnbilder |
| `bilder/` | Ansichten von vorne, rechts, hinten, links; Perspektiven; Details; Silber- und PLA-Eindruck; Farbmodell (auch mit der Kamera von Foto F4); Maßzeichnung (PNG/PDF) |
| `werkzeuge/` | Prüf-, Render-, Zeichnungs-, Slicer- und Fotovergleichsskripte; `alles_erzeugen.sh` |

Die Referenzfotos und die Bilder, die sie enthalten (Überlagerung, Gegenüberstellung), liegen **nicht** im Repository, weil die Bildrechte unklar sind. Sie stehen nur im privaten Bericht.

## 2. Recherche

### 2.1 Welche Mole ist gemeint?

Die Brunsbütteler Schleusen haben zwei Vorhäfen zur Elbe. **Mole 1 und Mole 2** begrenzen seit 1895 den **Alten Vorhafen** der Alten (Kleinen) Schleusen, **Mole 3 und 4** den Neuen Vorhafen (1913/14). Verwechslungsgefahr besteht vor allem mit Mole 2: Ihr Leuchtturm war ein **baugleicher Zwilling** von 1895, wurde im Dezember 2013 für die Verlängerung der Mole abgebaut und eingelagert und soll später auf Mole 4 wieder aufgestellt werden. Auf der verlängerten Mole 2 steht seit 2014 ein neuer, 16 m hoher Turm. **Der historische Turm von 1895, der heute noch an Ort und Stelle steht, ist der auf Mole 1.**

Lage laut WSA: 53° 53′ 19″ N, 9° 08′ 38″ E.

### 2.2 Belegte Fakten (Textquellen)

| Merkmal | Angabe | Quellen |
|---|---|---|
| Bauzeit / Inbetriebnahme | 1894/95; angezündet 3.8.1895 (Datenbank) bzw. 30.8.1895 (Kaiserliches Kanalamt) | WSA, deutsche-leuchtfeuer.de, baken-net.de |
| Höhe | **13,40 m über Molendeck** (bis zur Wetterfahne) | WSA |
| Sockel | achteckig, Granitsteinmauerwerk | WSA, deutsche-leuchtfeuer.de |
| Turm | achteckig, nach oben verjüngt, vernietete Gussplatten | deutsche-leuchtfeuer.de, brunsbuettel-wiki.de, baken-net.de |
| Galerien | zwei offene Galerien, die untere um 1914 angebaut | deutsche-leuchtfeuer.de, WSA |
| Laterne / Dach | rund, schwarz / Kupferblech, weiß | Dröger, deutsche-leuchtfeuer.de |
| Wetterfahne | reich verziert, Jahreszahl 1895 | deutsche-leuchtfeuer.de, Dithmarschen-Wiki |
| Geschichte | 1993 demontiert, instandgesetzt, 1995 auf neuer Pfahlgründung mit Granitsockel wieder aufgestellt; Denkmalschutz | WSA, deutsche-leuchtfeuer.de |
| Farbgebung | Granitsockel, schwarzer Unterbau, weißer Turm mit schwarzer „1“, schwarze obere Galerie und Laterne, weißes Dach | Leuchtturm-Atlas, leuchttuerme.net; durch die Fotos bestätigt |

### 2.3 Widersprüche und Entscheidungen

| Punkt | Angaben | Entscheidung |
|---|---|---|
| Grundriss | achteckig (5 Quellen) gegenüber sechseckig (Förderverein Roter Sand, MarineTraffic) | **achteckig**, durch alle vier Fotos bestätigt |
| Höhe | 13,40 m (WSA), 13,00 m, 14 m, 11 m (nur Eisenturm), „36 m“ (Lighthouse Digest, Fuß statt Meter) | **13,40 m** bis zur Spitze der Wetterfahne; dient als Maßstab für Foto F4 |
| Lage der unteren Galerie | in Textquellen nirgends als Maß | an F4 gemessen: Bodenoberkante **4,27 m** |

### 2.4 Referenzfotos

| Foto | Blick | Ausgewertet für |
|---|---|---|
| F1 | von der Wasserseite (Hafen), leicht von unten | „1“ (Lage, Form, Höhe), Steigleiter, Trichteraussparung, Ausrichtung zur Mole |
| F2 | von der Elbe | „1“, Fenster links neben der „1“ |
| F3 | erhöht, schräg von oben | „1“, Ausrichtung, Fenster neben der „1“ |
| F4 | frontal vom Molenweg auf die Tür, hochauflösend (960 × 1628 px) | alle Maße: Silhouette Zeile für Zeile, Steinlagen, Tür, Fenster, Geländer, Konsolen, Laterne, Dachprofil, Knauf |

Weitere Bildquellen (Wikimedia Commons, deutsche-leuchtfeuer.de, Architektur-Bildarchiv u. a.) sind im Quellenverzeichnis genannt. Ich konnte sie in dieser Umgebung nicht öffnen.

## 3. Rekonstruktion nach den Fotos

### 3.1 Vorgehen

- **Maßstab:** In F4 reicht der Turm von der Sockelunterkante (Bildzeile 1305) bis zur Spitze der Wetterfahne (Zeile 42). Das sind 13,40 m, also 94,25 Pixel je Meter.
- **Breiten:** Ich habe die Silhouette vor dem blauen Himmel Zeile für Zeile ausgelesen. Breiten an der Silhouette sind frei von Perspektivfehlern.
- **Höhen von Bauteilen auf der Vorderseite** (Geländerholme, Glasband, Fenster): Der Höhenversatz zwischen vorderen und hinteren Geländerholmen zeigt, dass F4 aus rund 90 m Entfernung und aus etwa 1,2 m Augenhöhe aufgenommen wurde. Damit habe ich diese Höhen um einige Zentimeter korrigiert. Holmhöhen sind der Mittelwert aus vorderem und hinterem Holm.
- **Ausrichtung:** Auf F1–F3 liegt der Molenweg und damit die Tür links neben der „1“. Die „1“ sitzt also 90° rechts der Tür und nicht gegenüber. Die Leiter (F1) liegt auf der Nachbarfläche rechts der „1“. Das Fenster links neben der „1“ (F2/F3) ist dasselbe Bogenfenster, das auf F4 rechts zu sehen ist. Damit sind alle Fotos widerspruchsfrei.
- **Abgleich:** Das Modell wird mit derselben Kamera wie F4 in das Foto projiziert und als Kontur eingezeichnet (`werkzeuge/fotovergleich.py`).

### 3.2 Maße (Status F = an Fotos gemessen, B = belegt, S = Schätzung)

| Bauteil | Original | Status | Modell |
|---|---|---|---|
| Gesamthöhe bis Spitze Wetterfahne | 13,40 m | B | Maßstabsbezug |
| Granitsockel, achteckig: Höhe / Schlüsselweite | 1,645 m / 3,10 m | F | 4,28 / 8,07 mm |
| Steinlagen (Lagerfugen) | 0,50 / 0,88 / 1,24 m | F | 4 Lagen |
| Tür in Laibung: Breite × Höhe / Laibungstiefe | 0,86 × 1,57 m / 0,22 m | F / S | 2,24 × 4,09 / 0,57 mm |
| Abdeckplatte: Schlüsselweite, Kante, Oberkante | 3,25 m, 0,18 m, 2,02 m | F | 8,46 mm, 0,47 mm, 5,25 mm |
| Schwarzer Unterbau: Schlüsselweite unten / oben | 2,32 / 2,17 m (bis 3,16 m) | F | 6,04 / 5,65 mm |
| Trichter (achteckig) bis Galerieboden | 3,16 → 4,11 m | F | 8,23 → 10,69 mm |
| Untere Galerie: Ø / Boden / Holme über Boden | 5,30 m / 4,11–4,27 m / 0,23, 0,50, 0,78 m | F | 13,80 mm / 0,41 mm / 3 Holme |
| Weißer Turm: Schlüsselweite unten / oben, Oberkante | 1,93 / 1,83 m, 6,87 m | F | 5,02 / 4,76 mm, 17,87 mm |
| „1“: Höhe / Stammbreite / Unterkante | 1,74 m / 0,26 m / 4,70 m | F | 4,53 / 0,68 / 12,24 mm |
| Konsolenkranz: Hohlkehle R / Anzahl | 0,62 m / ≈ 32 | F | 1,61 mm / 32 |
| Obere Galerie: Ø / Boden / Holme über Boden | 2,95 m / 7,49–7,59 m / 0,10, 0,30, 0,50, 0,71 m | F | 7,68 mm / 0,26 mm / 4 Holme |
| Laterne: Ø / Glasband | 1,74 m / 8,38–8,97 m | F | 4,53 mm / 1,54 mm |
| Glockenhaube: Traufe Ø / Traufe / Spitze | 2,04 m / 9,10 m / 10,43 m | F | 5,31 / 23,69 / 27,15 mm |
| Knauf bis | 11,14 m | F | 29,00 mm |
| Wetterfahne | 11,14–13,40 m | F | durch die Öse ersetzt |

Das Dachprofil ist an 14 Höhen gemessen, der Knauf an 9. Alle Werte stehen mit Bildzeile bzw. Bildspalte in `REAL`, `DACH_PROFIL`, `KNAUF_PROFIL` und `FENSTER` am Anfang des Skripts.

### 3.3 Bauteile von unten nach oben

| Bauteil | Ausführung im Modell | Beleg |
|---|---|---|
| Granitsockel | Achteck, 3 Lagerfugen ringsum, Stoßfugen im Läuferverband (Lagen abwechselnd mit 3 bzw. 2 Stoßfugen je Fläche), graviert 0,12 × 0,08 mm | F4 (linke Schrägfläche Lage für Lage ausgezählt) |
| Tür | Nische 0,57 mm tief, 6 senkrechte Bretter, 2 Bandeisen mit Zierring und Kloben (Bänder rechts angeschlagen), Riegel | F4 (Vergrößerung) |
| Abdeckplatte | senkrechte Kante, darüber Schräge bis zum Unterbau | F4 |
| Unterbau | schwarzes, verjüngtes Achteck; schmales Bogenfenster auf der Fläche links vorne (225°) | F4 |
| Steigleiter | zwei Holme, 8 Sprossen im Abstand 0,24 m, von der Abdeckplatte bis unter den Galerieboden; Fläche 45° | F1 |
| Trichter | achteckig, oben im Kreis des Galeriebodens; 0,70 m breite Aussparung für die Leiter | F4, F1 |
| Untere Galerie | runder Boden, 8 Pfosten an den Achteckecken, Handlauf und 2 Holme; Holme stehen leicht über die Bodenkante vor | F4 |
| Weißer Turm | verjüngtes Achteck; drei Fenster, die wie bei einer Wendeltreppe ansteigen (225° Bogen, 270° rechteckig, 315° Bogen); gravierte „1“ auf der Fläche 0° | F4, F1–F3 |
| Konsolenkranz | 32 Konsolen, Außenkante als Viertelkreis-Hohlkehle | F4 (Silhouette auf ±2 cm getroffen) |
| Obere Galerie | runder Boden, 8 Pfosten, 4 Holme (der unterste als Fußleiste, siehe 3.5) | F4 |
| Laterne | Zylinder, Fensterbank, zurückgesetztes Glasband mit 8 „V“ aus 16 Diagonalsprossen (Fußpunkte auf den Flächenmitten, Spitzen an den Ecken) | F4 (Vergrößerung) |
| Glockenhaube | gemessenes Glockenprofil; 8 bauchige Segmente, Rippen an den Achteckecken mit Falzgrat | F4 |
| Knauf | Kragen, Wulst, Lüfter mit 8 Schlitzen, Kappe, Hals | F4 |
| Öse | ersetzt die Wetterfahne | – |

### 3.4 Was sich gegenüber Version 1 geändert hat

| Thema | Version 1 (Schätzung ohne Fotos) | Version 2 (nach Fotos) |
|---|---|---|
| Proportion Breite : Höhe | 8,07 : 35 mm (1 : 4,3), wirkte lang und schmal | **13,98 : 35 mm (1 : 2,5)** |
| Maßstab | 1 : 457 | 1 : 384 (Höhe bis Knauf 11,14 m, darüber die Öse) |
| Sockel | 2,40 m hoch, glatt | 1,645 m hoch, Mauerwerk, Tür, abgeschrägte Abdeckplatte |
| Unterbau / Trichter | fehlten (durchgehend verjüngter Turm) | schwarzer Unterbau + achteckiger Trichter |
| Untere Galerie | achteckig auf 8 Kragarmen, auf 4,50 m | **rund, Ø 5,30 m**, auf dem Trichter, auf 4,27 m |
| Obere Galerie | achteckig auf 8 Kragarmen, auf 10,00 m | **rund, Ø 2,95 m**, auf 32 Hohlkehl-Konsolen, auf 7,59 m |
| Geländer | Eckpfosten, ein Band, Handlauf | 8 Pfosten; unten 3, oben 4 Holme |
| Laterne | Ø 1,40 m, 8 senkrechte Sprossen | **Ø 1,74 m**, 16 Diagonalsprossen (Zickzack) |
| Dach | helmförmige Kuppel Ø 1,60 m | **Glockenhaube Ø 2,04 m**, 8 Segmente mit Rippen |
| Neu | – | „1“, Leiter, 4 Fenster, Tür, Knauf mit Schlitzen |

Keine Geometrie aus Version 1 wurde übernommen; das Skript ist neu geschrieben.

### 3.5 Anpassungen für Guss und Schlüsselanhänger

| Anpassung | Grund |
|---|---|
| **Öse statt Wetterfahne** (Ø 6,2 / 3,6 mm) | Die Fahne wäre im Modell 5,9 mm hoch mit Ranken unter 0,1 mm, also weder gießbar noch als Schlüsselanhänger haltbar. |
| **Knauf radial ×1,92**, mindestens Ø 1,4 mm | Er trägt die Öse. Die Höhen und das Profil (Kragen, Wulst, Lüfter, Kappe) folgen F4. |
| Bauteile **dicker als maßstäblich**: Holme 0,22 × 0,28 mm, Pfosten 0,28–0,30 mm, Konsolen 0,25 mm, Laternensprossen 0,20 mm, Fugen 0,12 mm, Traufkante 0,25 mm, Wülste ≥ 0,2 mm | Maßstäblich wären es 0,05–0,13 mm, und das ist nicht abformbar. |
| Unterster Holm der oberen Galerie als **Fußleiste** | Der Spalt zum Boden wäre im Modell nur 0,15 mm. |
| Holme und Pfosten sitzen an der Bodenkante | So zeigt es F4; die Holmschleifen stehen etwas über den Boden hinaus. |
| Massiver Körper | Aushöhlen entscheidet die Gießerei. |

### 3.6 Nicht eindeutig durch Fotos belegt

1. **Flächen 135° und 180° (hinten links)**: Keines der Fotos zeigt sie. Sie sind glatt modelliert; ob dort Fenster sitzen, ist offen.
2. **Mauerwerk auf den nicht sichtbaren Sockelflächen** und **Stoßfugen der untersten Steinlage**: In F4 sind diese Stellen verdeckt. Das Muster der sichtbaren Flächen ist übertragen.
3. **Tiefe der Türlaibung** (0,22 m): aus dem Schattenwurf geschätzt.
4. **Anzahl der Konsolen**: 28–36 erkennbar, 32 gewählt (4 je Achteckfläche). Hinter den Konsolen ist der Turmkern angenommen.
5. **Lage der „1“ quer auf der Fläche** (mittig) und die Feinform der Fahne: nur aus den niedrig aufgelösten Fotos F1–F3.
6. **Sprossenabstand der Leiter** (0,24 m): aus F1 bei niedriger Auflösung.
7. **Kameraabstand von F4** (≈ 90 m, Unsicherheit etwa ±30 m): Davon hängen die Höhen der Holme, des Glasbands und der Fenster um wenige Zentimeter ab.
8. **Unterteil der Laterne** unter dem Glasband: Gliederung nicht auflösbar, deshalb glatt.
9. **Unklare Elemente**, nicht modelliert: ein zusätzlicher Pfosten links an der unteren Galerie (F4, ohne Gegenstück rechts), eine Trennlinie im Rand des unteren Galeriebodens, eine Strebe/Leitung am Unterbau vorne.

### 3.7 Bewusst nicht modelliert

- **Moderne Ausrüstung** (nicht Teil des historischen Bauwerks): Kameras, Lautsprecherhörner, Lampen, Sensorkästen, Kabelrohr, Schaltkästen am Sockel.
- **Molenkopf** (rundes Bruchsteinmauerwerk mit Klinkerband) und der Molenweg.
- **Nieten und Blechstöße**: Nietköpfe wären 0,05–0,08 mm groß, also unterhalb der Abformgrenze.
- Fensterrahmen, Türschwelle unterhalb der Sockelunterkante.

## 4. Kontrolle anhand der Referenzbilder

Ansichten von vorne (Tür), rechts („1“), hinten und links sowie Perspektiven liegen in `bilder/`. Der Fotovergleich (Kontur auf F4, Gegenüberstellung, Überblendung) steht im privaten Bericht.

| Frage | Ergebnis |
|---|---|
| Weniger lang und schmal? | Ja. Breite zu Höhe jetzt 13,98 : 35 mm statt 8,07 : 35 mm. Die mit der F4-Kamera projizierte Modellkontur liegt auf der Fotosilhouette (Sockel, Platte, Unterbau, Trichter, Galerien, Turm, Konsolen, Laterne, Dach). |
| Oberer Teil breiter und originalgetreu? | Ja. Obere Galerie Ø 7,68 mm auf Hohlkehl-Konsolen, Laterne Ø 4,53 mm, Glockenhaube Ø 5,31 mm. Das Dachprofil folgt der Fotosilhouette Zeile für Zeile. Einzige gewollte Abweichung: Knauf und Öse statt der schlanken Spitze und der Wetterfahne. |
| Mauerwerk realistisch? | Gemessene Lagenhöhen und das ausgezählte Stoßfugenmuster (Läuferverband), kein gleichmäßiges Raster. Tür mit Laibung, Brettern und Beschlägen. |
| „1“ korrekt? | Fläche 0° (rechts der Tür), Höhe 4,70–6,44 m, serifenlose Form mit schräger Fahne, graviert 0,20 mm. Das Fenster links daneben und die Leiter auf der Nachbarfläche rechts stimmen mit F1–F3 überein. |
| Streben, Leitern, Plattformen, Geländer vollständig? | 2 Galerien, 16 Pfosten, 7 Holme, 32 Konsolen, Leiter mit 8 Sprossen, 16 Laternensprossen. Freistehende Diagonalstreben zeigt keines der Fotos: Die untere Galerie trägt der geschlossene Trichter, die obere die Konsolen. Diagonal verlaufen nur die Laternensprossen und die Trichterkanten. |
| Vorder- und Rückseite? | Vorderseite und rechte Seite sind durch F4 bzw. F1–F3 belegt. Hinten (90°) zeigt F1 schräg eine glatte Fläche. Die Flächen 135° und 180° sind ohne Foto (Abschnitt 3.6, Punkt 1). |

## 5. Öse

| Maß | Wert | Begründung |
|---|---|---|
| Lochdurchmesser | **3,60 mm** (gemessen 3,598–3,600 mm) | Ein Spaltring trägt den Anhänger auf zwei Drahtlagen. Bei üblichen 25–28-mm-Ringen sind das ≈ 2,0 × 3,0 mm, und die passen durch 3,6 mm. |
| Ring | 1,30 mm radial × 1,90 mm quer, außen Ø 6,20 mm | elliptischer, gerundeter Querschnitt ohne Kanten |
| Kraftfluss Öse → Knauf → Dach | kleinster Querschnitt **1,37 mm²** (Lüfter mit Schlitzen; kreisgleich Ø 1,32 mm); Ringflanken 3,86 mm², Ringscheitel 1,93 mm² | aus der STL gemessen |
| Hängelage | Schwerpunkt auf der Achse (x = −0,02, y = 0,00 mm) | hängt senkrecht; Ösenebene parallel zur Türfläche |

Belastbarkeit nur als grobe Abschätzung mit Literaturwerten und **nicht geprüft**: Silber 925 gegossen bei 1,37 mm² deutlich über 250 N Zug.

## 6. Guss: Detailgrad und kritische Stellen

Das Modell ist **massiv** und schreibt **kein Gussverfahren** vor. Die feinen Teile sind auf ein **gedrucktes Gussmodell aus Wachs oder gießbarem Harz** (Auflösung ≈ 0,03–0,05 mm) ausgelegt. Allgemeingültige Mindestmaße lege ich bewusst nicht fest, weil sie von Verfahren, Legierung, Anguss und Ausstattung abhängen. Die Gießerei entscheidet.

**Gewicht** (Volumen 918 mm³): Silber 925 ≈ 9,5 g · Gold 585 ≈ 12,0 g · Gold 750 ≈ 14,2 g (Richtwerte ohne Anguss).

| Element | Modell | Bewertung für den Feinguss |
|---|---|---|
| Geländerholme | 0,22 × 0,28 mm, Ringe Ø 13,7 / 7,6 mm, getragen von 8 Pfosten | **kritisch**: lange dünne Querschnitte, Formfüllung prüfen |
| Geländerpfosten | 0,30 mm (unten) / 0,28 mm (oben) | **kritisch** |
| Lichte Weite zwischen den Holmen | unten 0,48 mm, oben 0,30 mm | oben **kritisch**: dünne Stege in der Einbettmasse |
| Konsolen | 0,25 mm dick, Zwischenräume 0,22–0,50 mm (am Turm am engsten) | **kritisch** |
| Laternensprossen | 0,20 mm breit, 0,12 mm erhaben | feines Relief, gut zum Schwärzen |
| Leiter | Holme 0,22 mm, Sprossen 0,20 mm, als Relief | fein |
| Mauerfugen / Fenster / „1“ | graviert 0,12 × 0,08 mm / 0,12 mm tief / 0,20 mm tief | gut; beim Polieren nicht verschleifen, Schwärzen empfohlen |
| Brettfugen der Tür | 0,06 × 0,05 mm | **wahrscheinlich nicht abformbar** (Haarlinien) |
| Türbänder | 0,15 mm hoch, 0,07 mm erhaben, Zierring 0,16 mm breit | feinstes Relief, Grenzbereich |
| Knaufschlitze | 0,18 × 0,12 mm | Grenzbereich |
| Traufkante | 0,25 mm | gut |
| Materialanhäufung | Sockel und Turm massiv (bis 8 mm), Feinteile 0,2–0,3 mm | ungleichmäßige Abkühlung; Aushöhlen oder Anguss am Sockel prüfen |
| Schwindmaß | STL hat **Endmaß** | Zugabe je nach Verfahren aufschlagen |

Weitere Hinweise: Die Taschen unter den Galerieböden (zwischen Konsolen bzw. über dem Trichter) und die Spalte zwischen Geländer und Turm sind schwer zu polieren. Bei Gummi- oder Silikonformen sind die umlaufenden, durchbrochenen Geländer Hinterschnitte. Die flache Sockelunterseite (52,5 mm²) eignet sich als unauffällige Anschnittstelle. Die Entscheidung liegt bei der Gießerei.

## 7. FDM-Probedruck (Bambu Lab A1, 0,2-mm-Düse)

Die FDM-Prüfung ist für den nächsten Schritt vorgesehen. Den Slicer habe ich trotzdem schon laufen lassen, damit das Ergebnis vorliegt (PrusaSlicer 2.7.2, A1-ähnliches Profil: 0,22 mm Linie, 0,08 mm Schicht; **kein Testdruck, kein Bambu Studio**):

- 437 Schichten, ≈ 1 h 8 min, ≈ 1,2 g PLA.
- Holme, Galerieböden, Konsolenkranz und Laternensprossen erzeugt der Slicer als Bahnen.
- **Die Geländerpfosten fehlen:** In Schichten zwischen den Holmen erzeugt Arachne nur 0,3 mm Bahn für alle 8 Pfosten, Classic gar keine. Die Holmringe würden damit frei in der Luft gedruckt.
- **Von den 32 Konsolen** erzeugt Arachne nur Bruchstücke, Classic weniger als die Hälfte.

**Folgerung:** Diese Gussvorlage ist für den 0,2-mm-FDM-Druck zu fein. Für den Probedruck schlage ich als nächsten Schritt eine **Prototyp-Variante** aus demselben Skript vor: Pfosten, Holme und Konsolen auf etwa 0,45 mm verstärkt. Alternativ ginge ein Druck im doppelten Maßstab (70 mm) oder ein Harzdruck bei einem Dienstleister. Der von der Prüfung erzeugte G-Code ist **nicht** für den A1 bestimmt und wurde nicht aufbewahrt.

## 8. Prüfbericht

| Prüfpunkt | Ergebnis |
|---|---|
| 1. Gesamthöhe und Abmessungen | 35,000 × 13,977 × 13,977 mm; Ziel erreicht |
| 2. Vollständigkeit | alle 102 Einzelbauteile zu 100 % im Endkörper (je bis 200 Stichproben; Punkte in gewollten Gravuren ausgenommen); alle Geländerfelder (2 × 3 Reihen × 8), alle 32 Konsolenzwischenräume und das Ösenloch offen |
| 3. Geschlossene Oberfläche | wasserdicht, Orientierung konsistent, gültiges Volumen |
| 4. Nicht-manifold Kanten, offene Flächen | 0 / 0; 0 entartete, 0 doppelte Dreiecke |
| 5. Lose oder schwebende Teile | genau 1 Körper; keine schwebenden Inseln in 437 Schichten der Geometrie (siehe aber Abschnitt 7: Der Slicer verwirft die Pfosten) |
| 6. Dünne Bereiche | Minimum planmäßig 0,20–0,25 mm (Sprossen, Leiter, Fensterbank, Holme, Konsolen), 0,15 mm am Zierring der Türbänder. Lokale Werte nahe 0 nur an den spitzen Winkeln der Ziffernfahne (Gravur, 42°) und an den Haarlinien der Brettfugen. Beim Prüfen gefunden und behoben: Hohlräume unter den Türbändern (0,03 mm), Traufkante 0,10 mm, Fensterbank 0,13 mm, Spalt am Leiterfuß, Absatz am Übergang Knauf/Öse (0,004 mm). |
| 7. Öse | Loch 3,60 mm; kleinster Querschnitt im Kraftfluss 1,37 mm²; Schwerpunkt auf der Achse |
| 8. FDM mit 0,2-mm-Düse | **nicht geeignet** ohne Prototyp-Variante (Abschnitt 7); Testdruck nicht durchgeführt |
| 9. Details im Verhältnis zur Größe | Tabelle in Abschnitt 6 |
| 10. Skalierung und Export | binäre STL in mm, nach dem Export erneut eingelesen und geprüft; Blender-Szene 1 Einheit = 1 mm |
| Fotoabgleich | Modellkontur mit der Kamera von F4 projiziert: deckungsgleich bis auf Knauf und Öse (gewollt) |
| Reproduzierbarkeit | Neuaufbau mit dem Skript ergibt eine bitgleiche STL (SHA-256 verglichen); der Endkörper in der .blend ist dreieck- und volumengleich mit der STL (43 908 Dreiecke, 917,98 mm³) |

Messmethoden: Wandstärke per Strahl von 60 000 Oberflächenpunkten nach innen, Spaltweite per Strahl nach außen (Embree). Gewertet wurde jeweils nur eine gegenüberliegende Fläche (±45°). Die Inselprüfung schneidet das Modell in 0,08-mm-Schichten.

**Nicht geprüft:** Testdruck, Bambu Studio, Probeguss, Festigkeit (FEM oder Versuch), Beurteilung durch eine Gießerei.

SHA-256-Prüfsumme der STL:

```
b7ec2851014b9507219b6f451f6ea6458158f205fea3dfed18dd5bb13bb0e447  Mole1_Brunsbuettel_Anhaenger_35mm.stl
```

## 9. Arbeitsweise und Ausführung

Alles in diesem Ordner wurde in dieser Arbeitsumgebung tatsächlich erzeugt. Blender 5.2.3 lief als Python-Modul (`bpy`); die STL ist ein echtes Exportergebnis. Auf dem iPad selbst lässt sich Blender nicht ausführen.

- **Ansehen auf dem iPad:** Die STL lässt sich in der Dateien-App als 3D-Vorschau öffnen; die Bilder liegen in `bilder/`.
- **Maße ändern in Blender (Computer):** `export/Mole1_Brunsbuettel_Anhaenger.blend` öffnen, im Arbeitsbereich „Scripting“ den Textblock `mole1_anhaenger.py` wählen, Werte in `REAL`, `FENSTER` oder `P` ändern, „Run Script“ ausführen. Die neuen Dateien landen im Ordner `export` neben der .blend.
- **Kommandozeile:** `blender -b -P blender/mole1_anhaenger.py -- --out export [--hoehe 40]`.
- **Gesamte Kette** (Modell, Prüfung, Slicer, Bilder): `werkzeuge/alles_erzeugen.sh`. Mit `FOTO4=<Pfad>` entsteht zusätzlich der Konturvergleich mit Foto F4.
- Alternativ in dieser Sitzung: die gewünschte Änderung beschreiben; ich passe die Parameter an und erzeuge alles neu.

## 10. Nächste Schritte

1. **Modell beurteilen** (Bilder, Bericht): Passt der Detailgrad? Sollen die offenen Punkte aus 3.6 noch geklärt werden, etwa mit einem Foto der Rückseite (Flächen 135°/180°)?
2. **FDM-Prototyp:** Prototyp-Variante mit verstärkten Feinteilen erzeugen und prüfen (Abschnitt 7).
3. **Gießerei bzw. Onkel:** Liste in Abschnitt 6 durchgehen; Verfahren, Modellmaterial, Aushöhlen, Anguss und Schwindmaß festlegen.

## Quellen

- WSA Nord-Ostsee-Kanal: [Mole I](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/01_MoleI/MoleI_node.html) · [Leuchttürme Brunsbüttel](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/Leuchttuerme_Brunsbuettel_node.html) · [Mole IV](https://www.wsa-nord-ostsee-kanal.wsv.de/Webs/WSA/WSA-Nord-Ostsee-Kanal/DE/2_Schifffahrt/f_Sportschifffahrt/g_Maritime_Ecken/1_Leuchttuerme_Brunsbuettel/04_MoleIV/MoleIV_node.html)
- deutsche-leuchtfeuer.de: [Molenfeuer 1](https://www.deutsche-leuchtfeuer.de/binnen/elbe/brunsbuettel-molenfeuer-1.html) · [Molenfeuer 2](https://www.deutsche-leuchtfeuer.de/binnen/elbe/brunsbuettel-molenfeuer-2.html)
- baken-net.de: [Molen 1 und 2 der Alten Schleuse](https://www.baken-net.de/brunsbuettel_molen12.htm) · [Molen 3 und 4](https://www.baken-net.de/brunsbuettel_molen34.htm)
- Leuchtturm-Atlas: [Tabelle Brunsbüttel, Mole](https://www.leuchtturm-atlas.de/HTML/BrunsMT.html) · [Brunsbüttel, Mole](http://www.leuchtturm-atlas.de/HTML/BrunsM.html)
- Brunsbüttel-Wiki: [Mole 1](https://brunsbuettel-wiki.de/index.php?title=Mole_1_Brunsb%C3%BCttel) · [Mole 2](https://brunsbuettel-wiki.de/index.php?title=Mole_2_Brunsb%C3%BCttel)
- Dithmarschen-Wiki: [Mole 1](https://www.dithmarschen-wiki.de/Mole_1_Brunsb%C3%BCttel)
- Förderverein Leuchtturm Roter Sand: [Brunsbütteler Molenfeuer des Nord-Ostsee-Kanals](https://www.foerderverein-leuchtturm-roter-sand.de/seite/459631/brunsb%C3%BCtteler-molenfeuer-des-nord-ostsee-kanals.html)
- leuchttuerme.net: [Portrait Brunsbüttel (Mole 1)](https://leuchttuerme.net/index.php?action=portrait&id=121&lang=1&nav=1000167)
- Lighthouse Directory (R. Rowlett): [Lighthouses of Germany: West Holstein](https://www.ibiblio.org/lighthouse/dewhol.htm)
- Werner Dröger: [Brunsbüttel-Schleusen Mole 1, 2, 3, 4](http://homepage.o2mail.de/wernerdroeger/index.html/BRUNSBUT.HTM)
- Lighthouse Digest (mit Fuß/Meter-Fehler): [Datenbankeintrag 4092](https://www.lighthousedigest.com/Digest/database/uniquelighthouse.cfm?value=4092) · MarineTraffic (Angabe „sechseckig“): [Light Details](https://www.marinetraffic.com/en/ais/details/lights/1000006270)
- Weitere Bildquellen (nicht gesichtet): [Wikimedia Commons, Lighthouses in Schleswig-Holstein](https://commons.wikimedia.org/wiki/Category:Lighthouses_in_Schleswig-Holstein) · [Architektur-Bildarchiv Nr. 75969](https://www.architektur-bildarchiv.de/image/Leuchtfeuer-Mole-1-Brunsb%C3%BCttel-75969.html) · [wolkenmond.de](http://wolkenmond.de/foto/leuchttuerme/brunsbuettel.html)
- **Referenzfotos F1–F4**: vom Auftraggeber bereitgestellt, Grundlage aller Maße; nicht im Repository.

Hinweis zur Methode: Die Textquellen wurden über eine Websuche ausgewertet, die Seiteninhalte als Text zusammenfasst. Die Maße stammen aus den vier bereitgestellten Fotos.
