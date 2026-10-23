# Mole 1 Brunsbüttel – Schmuck-Schlüsselanhänger

Recherche, fotobasierte Rekonstruktion, 3D-Modell (Blender) und Prüfbericht für einen Anhänger nach dem Molenfeuer auf Mole 1 im Alten Vorhafen der Brunsbütteler Schleusen (Nord-Ostsee-Kanal, Baujahr 1894/95).

Bericht mit Bildern und Fotovergleich als Webseite: https://claude.ai/artifact/3NZxJzazqYaVMLd9e9qKw3 (privat; zum Weitergeben über das Teilen-Menü der Seite freigeben).

## Kurzfassung

| | |
|---|---|
| **Ergebnis** | STL `export/Mole1_Brunsbuettel_Anhaenger_35mm.stl`: **35,00 mm** hoch (inkl. Öse), **13,41 mm** breit, Maßstab **1 : 387**. Erzeugt mit Blender 5.2.3 und unabhängig geprüft: geschlossen, ein einziger Körper, keine Fehlkanten. |
| **Version 2** | **Vollständig neu aufgebaut nach fünf Referenzfotos** (F1–F5). Alle Proportionen sind an den Fotos gemessen. Die Modellkontur deckt sich mit Foto F4 (Abschnitt 4); F5 zeigt die bis dahin fehlende Rückseite. **Ergänzt:** der vollständige Sockel mit seinem breiteren Fuß aus zwei Stufen (F4, F3). Version 1 beruhte mangels Fotos auf Schätzungen und war deutlich zu lang und zu schmal. |
| **Detailgrad** | Sockelfuß aus zwei achteckigen Stufen (die untere steht 0,63 m vor), Granitsockel mit 4 Steinlagen im Läuferverband, Tür in Laibung mit Brettern, Bändern und Riegel, Abdeckplatte mit Schräge, Unterbau mit Bogenfenster und Steigleiter, Trichter mit Leiteraussparung, zwei runde Galerien mit 8 Pfosten und 3 bzw. 4 Holmen, Turm mit vier Treppenfenstern und der gravierten „1“ auf beiden Seiten, 32 Hohlkehl-Konsolen, Laterne mit 16 Zickzack-Sprossen, achtteilige Glockenhaube mit Rippen, Knauf mit Lüftungsschlitzen. |
| **Ausrichtung auf den Guss** | So viel Detail wie für einen Feinguss nach gedrucktem Wachs- oder Harzmodell sinnvoll. Feinste Teile 0,20–0,30 mm; die kritischen Stellen sind in Abschnitt 6 einzeln benannt. Die Gießerei entscheidet über das Verfahren. |
| **FDM-Probedruck** | Für den Bambu Lab A1 mit 0,2-mm-Düse gibt es eine **Prototyp-Variante** mit verstärkten Feinteilen: `export/Mole1_Brunsbuettel_Anhaenger_35mm_Prototyp_A1.stl`. Sie besteht die Slicer-Prüfung (alle Pfosten, Holme und Konsolen werden gedruckt, nichts beginnt in der Luft). Die Gussvorlage selbst ist für FDM zu fein (Abschnitt 7). |
| **Nicht durchgeführt** | Kein Testdruck, kein Lauf in Bambu Studio, kein Probeguss. Durchgeführt wurden Slicer-Prüfungen mit PrusaSlicer 2.7.2 und eine geometrische Gussprüfung. |

## 1. Lieferumfang

| Datei | Inhalt |
|---|---|
| `export/Mole1_Brunsbuettel_Anhaenger_35mm.stl` | **Finale STL**, binär, Einheit mm, Z nach oben, Unterkante des Sockelfußes (Molendeck) auf z = 0, Tür zeigt nach −Y |
| `export/Mole1_Brunsbuettel_Anhaenger.blend` | Blender-Datei: `01_Bauteile` (104 einzeln benannte Bauteile), `02_Hilfsgeometrie` (Gravuren, Aussparungen), `03_Export_Anhaenger` (Endkörper), `04_Farbmodell_Rekonstruktion` (Originalfarben); Skript als Textblock. Beim Öffnen ist nur der Endkörper eingeblendet (Augen-Symbol im Outliner). |
| `export/modell_parameter.json` | Alle Real- und Modellmaße mit Status und Quelle |
| `export/Mole1_Brunsbuettel_Anhaenger_35mm_Prototyp_A1.stl` | **Prototyp für den FDM-Probedruck** (Bambu Lab A1, 0,2-mm-Düse), gleiche Maße, verstärkte Feinteile; dazu `…_Prototyp_A1.blend` und `modell_parameter_prototyp_a1.json` |
| `blender/mole1_anhaenger.py` | Parametrisches Blender-Python-Skript (baut, vereinigt, graviert, exportiert) |
| `pruefung/pruefbericht.json` | Maschinenlesbarer Prüfbericht |
| `pruefung/slicer/` | Slicer-Prüfung der Gussvorlage: Ergebnis-JSON, Profile, Bahnbilder |
| `pruefung/prototyp_a1/` | Prüfbericht und Slicer-Prüfung des A1-Prototyps |
| `bilder/` | Ansichten von vorne, rechts, hinten, links; Perspektiven; Details; Silber- und PLA-Eindruck; Farbmodell (auch mit der Kamera von Foto F4); A1-Prototyp (`Prototyp_A1_*`); Maßzeichnung (PNG/PDF) |
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
| Grundriss | achteckig (5 Quellen) gegenüber sechseckig (Förderverein Roter Sand, MarineTraffic) | **achteckig**, durch alle fünf Fotos bestätigt |
| Höhe | 13,40 m (WSA), 13,00 m, 14 m, 11 m (nur Eisenturm), „36 m“ (Lighthouse Digest, Fuß statt Meter) | **13,40 m über Molendeck** bis zur Spitze der Wetterfahne; Maßstab für Foto F4 (Molendeck = Unterkante des Sockelfußes) |
| Lage der unteren Galerie | in Textquellen nirgends als Maß | an F4 gemessen: Bodenoberkante **4,58 m** über Molendeck |

### 2.4 Referenzfotos

| Foto | Blick | Ausgewertet für |
|---|---|---|
| F1 | von der Wasserseite (Hafen), leicht von unten | „1“ (Lage, Form, Höhe), Steigleiter, Trichteraussparung, Ausrichtung zur Mole |
| F2 | von der Elbe | „1“, Fenster links neben der „1“ |
| F3 | erhöht, schräg von oben | „1“, Ausrichtung, Fenster neben der „1“ |
| F4 | frontal vom Molenweg auf die Tür, hochauflösend (960 × 1628 px) | alle Maße: Silhouette Zeile für Zeile, Steinlagen, Tür, Fenster, Geländer, Konsolen, Laterne, Dachprofil, Knauf |
| F5 | vom Wasser auf die andere Seite der Mole, Funkmast dahinter (1586 × 2379 px) | Flächen 90°–180°: zweite „1“ (180°), viertes Treppenfenster (135°), Mauerwerk der Rückseite |

Weitere Bildquellen (Wikimedia Commons, deutsche-leuchtfeuer.de, Architektur-Bildarchiv u. a.) sind im Quellenverzeichnis genannt. Ich konnte sie in dieser Umgebung nicht öffnen.

## 3. Rekonstruktion nach den Fotos

### 3.1 Vorgehen

- **Maßstab:** In F4 reicht das Bauwerk vom Molendeck an der Unterkante des Sockelfußes (Bildzeile 1350,5) bis zur Spitze der Wetterfahne (Zeile 42). Das sind 13,40 m, also 97,65 Pixel je Meter. Bis zur Ergänzung des Fußes hatte ich die Unterkante des Mauerwerks (Zeile 1305) für das Molendeck gehalten; dadurch waren alle Meterangaben um 3,6 % zu groß. Die Form des Anhängers hängt davon nicht ab, weil er ohnehin auf 35 mm skaliert wird.
- **Breiten:** Ich habe die Silhouette vor dem blauen Himmel Zeile für Zeile ausgelesen. Breiten an der Silhouette sind frei von Perspektivfehlern.
- **Höhen von Bauteilen auf der Vorderseite** (Geländerholme, Glasband, Fenster): Der Höhenversatz zwischen vorderen und hinteren Geländerholmen zeigt, dass F4 aus rund 87 m Entfernung und aus etwa 1,6 m Augenhöhe über dem Molendeck aufgenommen wurde (passt zu einer Person, die auf dem Molenweg steht). Damit habe ich diese Höhen um einige Zentimeter korrigiert. Holmhöhen sind der Mittelwert aus vorderem und hinterem Holm.
- **Ausrichtung:** Auf F1–F3 liegt der Molenweg und damit die Tür links neben der „1“. Die „1“ sitzt also 90° rechts der Tür und nicht gegenüber. Die Leiter (F1) liegt auf der Nachbarfläche rechts der „1“. Das Fenster links neben der „1“ (F2/F3) ist dasselbe Bogenfenster, das auf F4 rechts zu sehen ist.
- **Zweite „1“ (F5):** F5 ist von der anderen Seite der Mole aufgenommen; der Molenweg mit seinen Bogenleuchten läuft dort nach rechts. Trotzdem ist eine „1“ zu sehen, schräg rechts am Turm. Eine einzige „1“ kann nicht von beiden Seiten der Mole sichtbar sein. Die „1“ steht also zweimal, auf beiden Seiten quer zur Mole (0° und 180°), gut sichtbar für Schiffe auf der Elbe in beiden Fahrtrichtungen. Auf F4 liegen beide Flächen genau auf der Silhouette und sind deshalb nicht zu sehen. Damit sind alle fünf Fotos widerspruchsfrei.
- **Sockelfuß:** Unter dem Mauerwerk stehen zwei achteckige Stufen. In F4 sind unter der Tür ihre Vorderflächen zu sehen, der Rest ist von Brüstung, Rettungsring und Poller verdeckt. Die Höhen stammen aus den Kanten (Zeilen 1305, 1330,5, 1350,5). Den Vorsprung liefert die Ecke zwischen Vorder- und Schrägfläche, die im Sonnenlicht scharf zu sehen ist: Sie liegt beim Mauerwerk bei x = 519,0, bei der oberen Stufe bei 525,7 und bei der unteren bei 544,4. Der Versatz entspricht dem Vorsprung × tan 22,5°. F3 zeigt die untere Stufe von oben, etwa 0,6 m breiter als das Mauerwerk.
- **Abgleich:** Das Modell wird mit derselben Kamera wie F4 in das Foto projiziert und als Kontur eingezeichnet (`werkzeuge/fotovergleich.py`).

### 3.2 Maße (Status F = an Fotos gemessen, B = belegt, S = Schätzung)

| Bauteil | Original | Status | Modell |
|---|---|---|---|
| Gesamthöhe über Molendeck bis Spitze Wetterfahne | 13,40 m | B | Maßstabsbezug |
| Sockelfuß, zwei achteckige Stufen: Höhe unten / oben | 0,20 / 0,26 m | F | 0,53 / 0,67 mm |
| Sockelfuß: Schlüsselweite unten / oben (Vorsprung je Seite) | 4,25 m (0,63 m) / 3,32 m (0,17 m) | F | 10,98 / 8,59 mm |
| Granitsockel, achteckig: Höhe / Schlüsselweite | 1,59 m / 2,99 m | F | 4,11 / 7,73 mm |
| Steinlagen (Lagerfugen über Unterkante Mauerwerk) | 0,48 / 0,85 / 1,20 m | F | 4 Lagen |
| Tür in Laibung: Breite × Höhe / Laibungstiefe | 0,83 × 1,52 m / 0,21 m | F / S | 2,15 × 3,92 / 0,55 mm |
| Abdeckplatte: Schlüsselweite, Kante, Oberkante | 3,14 m, 0,17 m, 2,41 m | F | 8,11 mm, 0,45 mm, 6,24 mm |
| Schwarzer Unterbau: Schlüsselweite unten / oben | 2,24 / 2,09 m (bis 3,52 m) | F | 5,79 / 5,41 mm |
| Trichter (achteckig) bis Galerieboden | 3,52 → 4,43 m | F | 9,09 → 11,45 mm |
| Untere Galerie: Ø / Boden / Holme über Boden | 5,12 m / 4,43–4,58 m / 0,22, 0,48, 0,75 m | F | 13,23 mm / 0,40 mm / 3 Holme |
| Weißer Turm: Schlüsselweite unten / oben, Oberkante | 1,86 / 1,77 m, 7,09 m | F | 4,82 / 4,57 mm, 18,33 mm |
| „1“ (zweimal, 0° und 180°): Höhe / Stammbreite / Unterkante | 1,68 m / 0,25 m / 5,00 m | F | 4,34 / 0,65 / 12,93 mm |
| Konsolenkranz: Hohlkehle R / Anzahl | 0,60 m / ≈ 32 | F | 1,55 mm / 32 |
| Obere Galerie: Ø / Boden / Holme über Boden | 2,85 m / 7,69–7,79 m / 0,10, 0,29, 0,48, 0,69 m | F | 7,36 mm / 0,25 mm / 4 Holme |
| Laterne: Ø / Glasband | 1,68 m / 8,55–9,12 m | F | 4,34 mm / 1,47 mm |
| Glockenhaube: Traufe Ø / Traufe / Spitze | 1,97 m / 9,25 m / 10,53 m | F | 5,09 / 23,91 / 27,23 mm |
| Knauf bis | 11,22 m | F | 29,00 mm |
| Wetterfahne | 11,22–13,40 m | F | durch die Öse ersetzt |

Höhen über dem Molendeck; Lagerfugen und Tür über der Unterkante des Mauerwerks (0,47 m über dem Molendeck).

Das Dachprofil ist an 14 Höhen gemessen, der Knauf an 9. Alle Werte stehen mit Bildzeile bzw. Bildspalte in `REAL`, `DACH_PROFIL`, `KNAUF_PROFIL` und `FENSTER` am Anfang des Skripts.

### 3.3 Bauteile von unten nach oben

| Bauteil | Ausführung im Modell | Beleg |
|---|---|---|
| Sockelfuß | zwei achteckige Stufen, wie der Sockel ausgerichtet: oben 0,26 m hoch und 0,17 m vorstehend, unten 0,20 m hoch und 0,63 m vorstehend; glatt, weil keine Fugen zu erkennen sind; die Tür steht auf der oberen Stufe | F4 (Vorderflächen unter der Tür), F3 |
| Granitsockel | Achteck, 3 Lagerfugen ringsum, Stoßfugen im Läuferverband (Lagen abwechselnd mit 3 bzw. 2 Stoßfugen je Fläche), graviert 0,12 × 0,08 mm | F4 (linke Schrägfläche Lage für Lage ausgezählt) |
| Tür | Nische 0,57 mm tief, 6 senkrechte Bretter, 2 Bandeisen mit Zierring und Kloben (Bänder rechts angeschlagen), Riegel | F4 (Vergrößerung) |
| Abdeckplatte | senkrechte Kante, darüber Schräge bis zum Unterbau | F4 |
| Unterbau | schwarzes, verjüngtes Achteck; schmales Bogenfenster auf der Fläche links vorne (225°) | F4 |
| Steigleiter | zwei Holme, 8 Sprossen im Abstand 0,23 m, von der Abdeckplatte bis unter den Galerieboden; Fläche 45° | F1 |
| Trichter | achteckig, oben im Kreis des Galeriebodens; 0,68 m breite Aussparung für die Leiter | F4, F1 |
| Untere Galerie | runder Boden, 8 Pfosten an den Achteckecken, Handlauf und 2 Holme; Holme stehen leicht über die Bodenkante vor | F4 |
| Weißer Turm | verjüngtes Achteck; vier Fenster, die wie bei einer Wendeltreppe um etwa 0,32 m je Fläche ansteigen (135° rechteckig, 225° Bogen, 270° rechteckig, 315° Bogen); gravierte „1“ auf den Flächen 0° und 180° | F4, F1–F3, F5 |
| Konsolenkranz | 32 Konsolen, Außenkante als Viertelkreis-Hohlkehle | F4 (Silhouette auf ±2 cm getroffen) |
| Obere Galerie | runder Boden, 8 Pfosten, 4 Holme (der unterste als Fußleiste, siehe 3.5) | F4 |
| Laterne | Zylinder, Fensterbank, zurückgesetztes Glasband mit 8 „V“ aus 16 Diagonalsprossen (Fußpunkte auf den Flächenmitten, Spitzen an den Ecken) | F4 (Vergrößerung) |
| Glockenhaube | gemessenes Glockenprofil; 8 bauchige Segmente, Rippen an den Achteckecken mit Falzgrat | F4 |
| Knauf | Kragen, Wulst, Lüfter mit 8 Schlitzen, Kappe, Hals | F4 |
| Öse | ersetzt die Wetterfahne | – |

### 3.4 Was sich gegenüber Version 1 geändert hat

| Thema | Version 1 (Schätzung ohne Fotos) | Version 2 (nach Fotos) |
|---|---|---|
| Proportion Breite : Höhe | 8,07 : 35 mm (1 : 4,3), wirkte lang und schmal | **13,41 : 35 mm (1 : 2,6)** |
| Maßstab | 1 : 457 | 1 : 387 (Höhe bis Knauf 11,22 m über Molendeck, darüber die Öse) |
| Sockel | 2,40 m hoch, glatt | Fuß aus zwei Stufen (0,47 m), Mauerwerk 1,59 m hoch, Tür, abgeschrägte Abdeckplatte |
| Unterbau / Trichter | fehlten (durchgehend verjüngter Turm) | schwarzer Unterbau + achteckiger Trichter |
| Untere Galerie | achteckig auf 8 Kragarmen, auf 4,50 m | **rund, Ø 5,12 m**, auf dem Trichter, auf 4,58 m |
| Obere Galerie | achteckig auf 8 Kragarmen, auf 10,00 m | **rund, Ø 2,85 m**, auf 32 Hohlkehl-Konsolen, auf 7,79 m |
| Geländer | Eckpfosten, ein Band, Handlauf | 8 Pfosten; unten 3, oben 4 Holme |
| Laterne | Ø 1,40 m, 8 senkrechte Sprossen | **Ø 1,68 m**, 16 Diagonalsprossen (Zickzack) |
| Dach | helmförmige Kuppel Ø 1,60 m | **Glockenhaube Ø 1,97 m**, 8 Segmente mit Rippen |
| Neu | – | Sockelfuß, „1“ auf beiden Seiten, Leiter, 5 Fenster, Tür, Knauf mit Schlitzen |

Keine Geometrie aus Version 1 wurde übernommen; das Skript ist neu geschrieben.

### 3.5 Anpassungen für Guss und Schlüsselanhänger

| Anpassung | Grund |
|---|---|
| **Öse statt Wetterfahne** (Ø 6,2 / 3,6 mm) | Die Fahne wäre im Modell 5,6 mm hoch mit Ranken unter 0,1 mm, also weder gießbar noch als Schlüsselanhänger haltbar. |
| **Knauf radial ×1,92**, mindestens Ø 1,4 mm | Er trägt die Öse. Die Höhen und das Profil (Kragen, Wulst, Lüfter, Kappe) folgen F4. |
| Bauteile **dicker als maßstäblich**: Holme 0,22 × 0,28 mm, Pfosten 0,28–0,30 mm, Konsolen 0,25 mm, Laternensprossen 0,20 mm, Fugen 0,12 mm, Traufkante 0,25 mm, Wülste ≥ 0,2 mm | Maßstäblich wären es 0,05–0,13 mm, und das ist nicht abformbar. |
| Unterster Holm der oberen Galerie als **Fußleiste** | Der Spalt zum Boden wäre im Modell nur 0,14 mm. |
| Holme und Pfosten sitzen an der Bodenkante | So zeigt es F4; die Holmschleifen stehen etwas über den Boden hinaus. |
| Massiver Körper | Aushöhlen entscheidet die Gießerei. |

### 3.6 Nicht eindeutig durch Fotos belegt

1. **Sockelfuß**: nur auf F4 unter der Tür (Vorderflächen) und klein auf F3 zu sehen. Die Höhen sind auf etwa ±0,04 m genau, die Vorsprünge auf ±0,03 m (oben) bzw. ±0,04 m (unten). Seiten und Rückseite sind verdeckt; dort ist der Fuß achteckig und gleich ausgerichtet angenommen. Fugen sind nicht zu erkennen, deshalb sind die Stufen glatt. Eine helle Kante oben an der oberen Stufe (etwa 3 cm) könnte eine leichte Abschrägung sein; ausgeführt ist sie eben (im Anhänger wären das 0,08 mm).
2. **Absoluter Maßstab**: Bezug ist die WSA-Angabe 13,40 m über Molendeck; andere Quellen nennen 13,00 m oder 14 m. Die Meterangaben sind deshalb auf etwa ±4 % unsicher. Die Proportionen des Anhängers hängen davon nicht ab.
3. **Rückseite (F5)**: Die Flächen 90°–180° zeigt nur F5, schräg und aus größerer Entfernung. Daraus stammen die zweite „1“ und das Fenster auf 135°. Dessen seitliche Lage (0,12 m rechts der Flächenmitte) ist auf etwa ±0,07 m unsicher; die Feinform der zweiten „1“ ist wie bei der ersten angenommen.
4. **Mauerwerk**: F5 bestätigt den Läuferverband auch auf der Rückseite (drei sichtbare Lagen, abwechselnd drei und zwei Stoßfugen). Die genaue Lage der Stoßfugen dort und die unterste Steinlage sind verdeckt bzw. nicht messbar; das Muster von F4 ist übertragen.
5. **Tiefe der Türlaibung** (0,21 m): aus dem Schattenwurf geschätzt.
6. **Anzahl der Konsolen**: 28–36 erkennbar, 32 gewählt (4 je Achteckfläche). Hinter den Konsolen ist der Turmkern angenommen.
7. **Lage der „1“ quer auf der Fläche** (mittig) und die Feinform der Fahne: nur aus den niedrig aufgelösten Fotos F1–F3.
8. **Sprossenabstand der Leiter** (0,23 m): aus F1 bei niedriger Auflösung.
9. **Kameraabstand von F4** (≈ 87 m, Unsicherheit etwa ±30 m): Davon hängen die Höhen der Holme, des Glasbands und der Fenster um wenige Zentimeter ab.
10. **Unterteil der Laterne** unter dem Glasband: Gliederung nicht auflösbar, deshalb glatt.
11. **Unklare Elemente**, nicht modelliert: ein zusätzlicher Pfosten links an der unteren Galerie (F4, ohne Gegenstück rechts), eine Trennlinie im Rand des unteren Galeriebodens, eine Strebe/Leitung am Unterbau vorne.

### 3.7 Bewusst nicht modelliert

- **Moderne Ausrüstung** (nicht Teil des historischen Bauwerks): Kameras, Lautsprecherhörner, Lampen, Sensorkästen, Kabelrohr, Schaltkästen am Sockel.
- **Molenkopf** (rundes Bruchsteinmauerwerk mit Klinkerband) und der Molenweg.
- **Nieten und Blechstöße**: Nietköpfe wären 0,05–0,08 mm groß, also unterhalb der Abformgrenze.
- Fensterrahmen.

## 4. Kontrolle anhand der Referenzbilder

Ansichten von vorne (Tür), rechts („1“), hinten und links sowie Perspektiven liegen in `bilder/`. Der Fotovergleich (Kontur auf F4, Gegenüberstellungen mit F1, F3, F4 und F5) steht im privaten Bericht.

| Frage | Ergebnis |
|---|---|
| Weniger lang und schmal? | Ja. Breite zu Höhe jetzt 13,41 : 35 mm statt 8,07 : 35 mm. Die mit der F4-Kamera projizierte Modellkontur liegt auf der Fotosilhouette (Sockel, Platte, Unterbau, Trichter, Galerien, Turm, Konsolen, Laterne, Dach). |
| Oberer Teil breiter und originalgetreu? | Ja. Obere Galerie Ø 7,36 mm auf Hohlkehl-Konsolen, Laterne Ø 4,34 mm, Glockenhaube Ø 5,09 mm. Das Dachprofil folgt der Fotosilhouette Zeile für Zeile. Einzige gewollte Abweichung: Knauf und Öse statt der schlanken Spitze und der Wetterfahne. |
| Ganzer Sockel? | Ja, nach dem Hinweis ergänzt: Unter dem Mauerwerk sitzt ein Fuß aus zwei achteckigen Stufen; die untere steht 0,63 m vor. In F4 sind seine Vorderflächen unter der Tür zu sehen, Brüstung, Rettungsring und Poller verdecken den Rest. Die projizierte Modellkontur verschwindet genau hinter diesen Gegenständen. |
| Mauerwerk realistisch? | Gemessene Lagenhöhen und das ausgezählte Stoßfugenmuster (Läuferverband), kein gleichmäßiges Raster. Tür mit Laibung, Brettern und Beschlägen. |
| „1“ korrekt? | Zweimal, auf beiden Seiten quer zur Mole (0° und 180°, F1–F3 und F5), Höhe 5,00–6,68 m über Molendeck, serifenlose Form mit schräger Fahne, graviert 0,20 mm. Fenster und Leiter daneben stimmen mit F1–F3 überein. |
| Streben, Leitern, Plattformen, Geländer vollständig? | 2 Galerien, 16 Pfosten, 7 Holme, 32 Konsolen, Leiter mit 8 Sprossen, 16 Laternensprossen. Freistehende Diagonalstreben zeigt keines der Fotos: Die untere Galerie trägt der geschlossene Trichter, die obere die Konsolen. Diagonal verlaufen nur die Laternensprossen und die Trichterkanten. |
| Vorder- und Rückseite? | Alle acht Seiten sind jetzt durch Fotos abgedeckt: vorne und rechts F4 bzw. F1–F3, hinten und links F5 (zweite „1“, viertes Fenster, glatte Fläche 90°). Die Gegenüberstellung mit F5 steht im privaten Bericht. |

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

**Gewicht** (Volumen 907 mm³): Silber 925 ≈ 9,4 g · Gold 585 ≈ 11,9 g · Gold 750 ≈ 14,1 g (Richtwerte ohne Anguss).

Mit dem Sockelfuß ist das Bauwerk im Anhänger um 4,2 % kleiner als vorher, weil die Gesamthöhe von 35 mm bleibt. Holme, Pfosten und Konsolen behalten ihre Dicke, die Zwischenräume werden dadurch etwas enger (Werte unten). Soll der Turm so groß bleiben wie vorher, wird der Anhänger 36,3 mm hoch (`--hoehe 36.3`).

| Element | Modell | Bewertung für den Feinguss |
|---|---|---|
| Geländerholme | 0,22 × 0,28 mm, Ringe Ø 13,1 / 7,3 mm, getragen von 8 Pfosten | **kritisch**: lange dünne Querschnitte, Formfüllung prüfen |
| Geländerpfosten | 0,30 mm (unten) / 0,28 mm (oben) | **kritisch** |
| Lichte Weite zwischen den Holmen | unten 0,45 mm, oben 0,27 mm | oben **kritisch**: dünne Stege in der Einbettmasse |
| Konsolen | 0,25 mm dick, Zwischenräume 0,20–0,46 mm (am Turm am engsten) | **kritisch** |
| Laternensprossen | 0,20 mm breit, 0,12 mm erhaben | feines Relief, gut zum Schwärzen |
| Leiter | Holme 0,22 mm, Sprossen 0,20 mm, als Relief | fein |
| Mauerfugen / Fenster / „1“ | graviert 0,12 × 0,08 mm / 0,12 mm tief / 0,20 mm tief | gut; beim Polieren nicht verschleifen, Schwärzen empfohlen |
| Brettfugen der Tür | 0,06 × 0,05 mm | **wahrscheinlich nicht abformbar** (Haarlinien) |
| Türbänder | 0,15 mm hoch, 0,07 mm erhaben, Zierring 0,16 mm breit | feinstes Relief, Grenzbereich |
| Knaufschlitze | 0,18 × 0,12 mm | Grenzbereich |
| Traufkante | 0,25 mm | gut |
| Materialanhäufung | Fuß, Sockel und Turm massiv (Fuß 11 mm breit), Feinteile 0,2–0,3 mm | ungleichmäßige Abkühlung; Aushöhlen oder Anguss am Sockel prüfen |
| Schwindmaß | STL hat **Endmaß** | Zugabe je nach Verfahren aufschlagen |

Weitere Hinweise: Die Taschen unter den Galerieböden (zwischen Konsolen bzw. über dem Trichter) und die Spalte zwischen Geländer und Turm sind schwer zu polieren. Bei Gummi- oder Silikonformen sind die umlaufenden, durchbrochenen Geländer Hinterschnitte. Die flache Unterseite des Sockelfußes (≈ 100 mm²) eignet sich als unauffällige Anschnittstelle. Die Entscheidung liegt bei der Gießerei.

## 7. FDM-Probedruck (Bambu Lab A1, 0,2-mm-Düse)

Die Gussvorlage ist für den FDM-Druck zu fein. Deshalb erzeugt das Skript mit `--prototyp` eine eigene **Prototyp-Variante**: `export/Mole1_Brunsbuettel_Anhaenger_35mm_Prototyp_A1.stl`. Maße, Anordnung und Anzahl aller Teile sind gleich. Nur Querschnitte und Gravurtiefen sind für die 0,22 mm breite Bahn der 0,2-mm-Düse verstärkt. Der PLA-Druck zeigt Größe, Proportionen und Wirkung; ein Gussmodell ist er nicht.

| Element | Gussvorlage | Prototyp A1 |
|---|---|---|
| Pfosten unten / oben | 0,30 / 0,28 mm | **0,48 / 0,44 mm** |
| Holme unten (Höhe × Tiefe) | 0,22 × 0,28 mm | **0,32 × 0,44 mm** (zwei Bahnen) |
| Holme oben (Höhe × Tiefe) | 0,22 × 0,26 mm | **0,24 × 0,40 mm** |
| Konsolen (32) | 0,25 mm | **0,40 mm** |
| Leiter: Holme / Sprossen | 0,22 / 0,20 mm | 0,30 / 0,24 mm |
| Laternensprossen | 0,20 mm breit, 0,12 mm erhaben | 0,30 mm breit, 0,15 mm erhaben |
| Mauerfugen | 0,12 × 0,08 mm | 0,20 × 0,12 mm |
| Tiefe Fenster / „1“ | 0,12 / 0,20 mm | 0,20 / 0,25 mm |

Größte Breite 13,57 mm (Holme), Volumen 923 mm³, etwa 1,2 g PLA. Geometrieprüfung wie bei der Gussvorlage: wasserdicht, ein Körper, keine Fehlkanten, alle 104 Bauteile vollständig, alle Geländerfelder, Konsolenzwischenräume und das Ösenloch offen (`pruefung/prototyp_a1/`).

**Slicer-Prüfung** (PrusaSlicer 2.7.2, A1-ähnliches Profil: 0,22 mm Linie, 0,08 mm Schicht; beide Wandgeneratoren; **kein Testdruck, kein Bambu Studio**). Neu ist ein Test auf Bahninseln, die keine oder fast keine Auflage auf der Schicht darunter haben, also in die Luft gedruckt würden.

| Prüfung | Gussvorlage | Prototyp A1 |
|---|---|---|
| Pfosten in Schichten zwischen den Holmen (Bahnlänge aller 8 Pfosten, Arachne / Classic) | 0,3 / 0 mm | 7,2 / 8,1 mm |
| Holmringe | eine Bahn | zwei Bahnen |
| Konsolen | Bruchstücke | 32 einzelne Rippen |
| Bahninseln ohne ausreichende Auflage | Arachne: 6 Holmringe (1–3 % Auflage), Classic: 10 schwebende Inseln | **keine** (beide Generatoren) |
| Schichten / Druckzeit / PLA | 437 / ≈ 1 h 9 min / 1,16 g | 437 / ≈ 1 h 10 min / 1,18 g |

**Empfohlene Einstellungen in Bambu Studio** (aus der Prüfung abgeleitet, nicht im Druck getestet):

- Drucker A1 mit 0,2-mm-Düse, Prozess „0.08mm Extra Fine @BBL A1 0.2 nozzle“; PLA, am besten matt und hellgrau
- aufrecht drucken, wie exportiert (Sockelfuß auf der Platte, Standfläche ≈ 100 mm²)
- **Stützen aus.** Die steilste Überhangfläche ist der Trichter mit etwa 33–35° gegen die Waagerechte. Unter den Holmen überbrückt der Drucker die Strecke von Pfosten zu Pfosten: unten etwa 4,7 mm, oben etwa 2,4 mm. Stützen zwischen den Geländern ließen sich kaum entfernen.
- Brim 3–5 mm, weil das Teil hoch ist und der A1 das Bett bewegt. Der Sockelfuß hat die Standfläche gegenüber vorher fast verdoppelt (≈ 100 statt 52,5 mm²).
- 2–3 Exemplare mit Abstand gleichzeitig drucken: Jede Schicht kühlt länger, und ein Ersatzteil entsteht nebenbei.
- Vorsichtig vom Brim lösen; Pfosten und Holme sind in PLA zerbrechlich.

Was nur ein Testdruck klärt: Durchhängen der Holme zwischen den Pfosten, Oberfläche der Trichterunterseite, Sichtbarkeit der Fugen und der „1“. Der von der Prüfung erzeugte G-Code ist **nicht** für den A1 bestimmt und wurde nicht aufbewahrt.

## 8. Prüfbericht

| Prüfpunkt | Ergebnis |
|---|---|
| 1. Gesamthöhe und Abmessungen | 35,000 × 13,405 × 13,405 mm; Ziel erreicht |
| 2. Vollständigkeit | alle 104 Einzelbauteile zu 100 % im Endkörper (je bis 200 Stichproben; Punkte in gewollten Gravuren ausgenommen); alle Geländerfelder (2 × 3 Reihen × 8), alle 32 Konsolenzwischenräume und das Ösenloch offen |
| 3. Geschlossene Oberfläche | wasserdicht, Orientierung konsistent, gültiges Volumen |
| 4. Nicht-manifold Kanten, offene Flächen | 0 / 0; 0 entartete, 0 doppelte Dreiecke |
| 5. Lose oder schwebende Teile | genau 1 Körper; keine schwebenden Inseln in 437 Schichten der Geometrie (im Slicer verliert die Gussvorlage aber die Pfosten, siehe Abschnitt 7) |
| 6. Dünne Bereiche | Minimum planmäßig 0,20–0,25 mm (Sprossen, Leiter, Fensterbank, Holme, Konsolen), 0,15 mm am Zierring der Türbänder. Lokale Werte nahe 0 nur an den spitzen Winkeln der Ziffernfahne (Gravur, 42°) und an den Haarlinien der Brettfugen. Beim Prüfen gefunden und behoben: Hohlräume unter den Türbändern (0,03 mm), Traufkante 0,10 mm, Fensterbank 0,13 mm, Spalt am Leiterfuß, Absatz am Übergang Knauf/Öse (0,004 mm); beim Einbau des Fußes: Laternensprossen berührten den Kranz tangential (3 offene Kanten), deshalb 5 µm nach innen gesetzt. |
| 7. Öse | Loch 3,60 mm; kleinster Querschnitt im Kraftfluss 1,37 mm²; Schwerpunkt auf der Achse |
| 8. FDM mit 0,2-mm-Düse | Gussvorlage **nicht geeignet**; **Prototyp A1**: Slicer-Prüfung bestanden (alle Feinteile als Bahnen, keine Bahninseln ohne Auflage). Testdruck nicht durchgeführt |
| 9. Details im Verhältnis zur Größe | Tabelle in Abschnitt 6 |
| 10. Skalierung und Export | binäre STL in mm, nach dem Export erneut eingelesen und geprüft; Blender-Szene 1 Einheit = 1 mm |
| Fotoabgleich | Modellkontur mit der Kamera von F4 projiziert: deckungsgleich bis auf Knauf und Öse (gewollt); der Sockelfuß ist im Foto bis auf die Vorderflächen unter der Tür verdeckt |
| Kontrolle der Umrechnung | Neuer Maßstabsbezug ohne Fuß: höchstens 0,007 mm Abweichung vom vorherigen Modell (Rundung der Meterwerte). Mit Fuß bei gleichem Maßstab: oberhalb des Fußes deckungsgleich (0,000 mm) bis auf die um 5 µm versetzten Laternensprossen |
| Reproduzierbarkeit | Neuaufbau mit dem Skript ergibt bitgleiche STL-Dateien (Gussvorlage und Prototyp, SHA-256 verglichen); der Endkörper in der .blend ist dreieck- und volumengleich mit der STL (44 328 Dreiecke, 906,72 mm³) |

Messmethoden: Wandstärke per Strahl von 60 000 Oberflächenpunkten nach innen, Spaltweite per Strahl nach außen (Embree). Gewertet wurde jeweils nur eine gegenüberliegende Fläche (±45°). Die Inselprüfung schneidet das Modell in 0,08-mm-Schichten.

**Nicht geprüft:** Testdruck, Bambu Studio, Probeguss, Festigkeit (FEM oder Versuch), Beurteilung durch eine Gießerei.

SHA-256-Prüfsummen der STL-Dateien:

```
327bc67e009136b0ce1be06b1c62f7849f1d30fd301eedc969139baa4e1b137e  Mole1_Brunsbuettel_Anhaenger_35mm.stl
ea6f3129ee29f365247f8cb3e08cf05bedb13a916a58f2fcc92fb8667b3383ae  Mole1_Brunsbuettel_Anhaenger_35mm_Prototyp_A1.stl
```

## 9. Arbeitsweise und Ausführung

Alles in diesem Ordner wurde in dieser Arbeitsumgebung tatsächlich erzeugt. Blender 5.2.3 lief als Python-Modul (`bpy`); die STL ist ein echtes Exportergebnis. Auf dem iPad selbst lässt sich Blender nicht ausführen.

- **Ansehen auf dem iPad:** Die STL lässt sich in der Dateien-App als 3D-Vorschau öffnen; die Bilder liegen in `bilder/`.
- **Maße ändern in Blender (Computer):** `export/Mole1_Brunsbuettel_Anhaenger.blend` öffnen, im Arbeitsbereich „Scripting“ den Textblock `mole1_anhaenger.py` wählen, Werte in `REAL`, `FENSTER` oder `P` ändern, „Run Script“ ausführen. Die neuen Dateien landen im Ordner `export` neben der .blend.
- **Kommandozeile:** `blender -b -P blender/mole1_anhaenger.py -- --out export [--hoehe 40] [--prototyp]`; `--prototyp` erzeugt die A1-Variante mit eigenen Dateinamen.
- **Gesamte Kette** (Gussvorlage und Prototyp: Modell, Prüfung, Slicer, Bilder): `werkzeuge/alles_erzeugen.sh`. Mit `FOTO4=<Pfad>` entsteht zusätzlich der Konturvergleich mit Foto F4.
- Alternativ in dieser Sitzung: die gewünschte Änderung beschreiben; ich passe die Parameter an und erzeuge alles neu.

## 10. Nächste Schritte

1. **Modell beurteilen** (Bilder, Bericht): Passt der Detailgrad? Die offenen Punkte aus 3.6 ließen sich mit einer Nahaufnahme der Rückseite oder des Konsolenkranzes weiter eingrenzen.
2. **FDM-Prototyp drucken** (Einstellungen in Abschnitt 7) und Größe, Proportionen, Öse und Schlüsselring prüfen. Auffälligkeiten (z. B. durchhängende Holme) lassen sich über die Werte in `PROTOTYP_A1` im Skript nachstellen.
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
- **Referenzfotos F1–F5**: vom Auftraggeber bereitgestellt, Grundlage aller Maße; nicht im Repository.

Hinweis zur Methode: Die Textquellen wurden über eine Websuche ausgewertet, die Seiteninhalte als Text zusammenfasst. Die Maße stammen aus den fünf bereitgestellten Fotos.
