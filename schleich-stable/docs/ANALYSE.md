# Analyse: Druckbarkeit, Mängel, Stärken und Schwächen

Stand 7. November 2026, kompakte Version. Geprüft wurde die exportierte Geometrie, also genau
die Teile, die gedruckt werden: mit `tools/validate.py`, zusätzlichen Prüfungen und dem
Stabilitätscheck von PrusaSlicer. **Gedruckt wurde noch nichts.** Passungen und Kräfte sind
berechnet, nicht gemessen. Deshalb zuerst die beiden Testplatten T1 und T2 drucken (`TESTING.md`).

## Kurzfazit

* **Gut druckbar auf dem Bambu Lab A1:** Alle 26 verschiedenen Teile passen (das breiteste ist
  197 mm, das längste 207 mm, das höchste 216 mm). Kein Teil braucht Stützmaterial. Fertige
  Druckplatten liegen als 3MF bei.
* **Ein echter Fehler wurde gefunden und behoben** (Abschnitt 2): Die Scharnieraugen an den
  Pfosten hatten flache statt 45-Grad-Unterseiten.
* **Heikelster Druck:** die sechs 216 mm hohen Pfosten. Das Druckbett des A1 bewegt sich unter ihnen.
* **Fürs Spielen:** Die Grundkonstruktion ist kräftig. Dach und Wände sind aber nur gesteckt.
  Fensterflügel, Riegel und Stifte sind die Schwachstellen.

## 1. Druckbarkeit auf dem A1

| Teile | Druckrichtung | Bewertung | Was zu beachten ist |
|---|---|---|---|
| Bodenplatten (6) | flach | sehr gut | große Auflagefläche. Unten werden die Aussparungen für die Steckzungen 20 mm überbrückt (PrusaSlicer: „Long bridging extrusions“). Für PLA ist das machbar, aber dort sind nur 0,25 mm Luft: Hängt die Brücke durch, klemmen die Platten beim Zusammenschieben. Testplatte T2 prüft genau diese Verbindung |
| Wände, Trennwände, Boxenfronten, Giebel (16) | flach, Schauseite oben | sehr gut | für schwarze Zierleisten Farbwechsel bei 2,8 mm (AMS lite oder Pause) |
| Seitendächer (4) | flach, Schindeln oben | sehr gut | große Auflagefläche |
| Türen, Fensterflügel, Riegel (14) | flach | gut | Scharnierbohrungen sind tropfenförmig und brauchen keine Stütze |
| Kurze Pfosten (6, 118 mm) | stehend | gut | 8 mm Brim |
| Hohe Pfosten (6, 216 mm) | stehend | **heikel** | stehen auf nur 14 x 14 mm; PrusaSlicer meldet „Low bed adhesion“. 8 mm Brim, Platte mit Spülmittel reinigen, Druckmodus **Silent**, die erste Stunde zuschauen |
| Mitteldach (2) | stehend wie eingebaut, 45 Grad | gut, etwas heikel | steht auf zwei 5 mm breiten Streifen; 5 mm Brim, gute Kühlung; PrusaSlicer meldet ebenfalls „Low bed adhesion“ |

Zahlen dazu: Ein hoher Pfosten ist 216 mm hoch und steht auf 202 mm² (Verhältnis Höhe zu
Wurzel der Auflagefläche 15). Das Mitteldach kommt auf 2,3, alle anderen Teile liegen unter 1.
Die stehenden Pfosten sind trotzdem die richtige Wahl: Nur so werden die Nuten und
Scharnierbohrungen rund, maßhaltig und fest. Liegend bräuchten die Scharnieraugen Stützen.

## 2. Gefundene Mängel

1. **Behoben: flache Unterseiten an den Scharnieraugen der Pfosten.** Jedes feste Scharnierauge
   (14 Stück an 6 Pfosten) sollte unten eine 45-Grad-Schräge haben. Die Schräge war in
   `cad/lib/hinges.scad` falsch herum gedreht und hatte keine Wirkung. Jedes Auge begann
   deshalb als flacher, bis zu 7,6 mm frei überstehender Absatz. Beim Drucken hängt so ein
   Absatz durch oder wellt sich, und die Düse kann daran hängen bleiben. Bei einem 216 mm hohen
   Pfosten kann das den ganzen Pfosten umwerfen. Dieser Fehler war auch in der großen Version.
   Jetzt wächst jedes Auge Schicht für Schicht (5, 25, 51, 92 mm² auf den ersten 8 mm).
   Die Überhangfläche der Türpfosten sank von 317 auf 27 mm² (nur noch die Deckel der
   Stiftlöcher, 1,85 mm). PrusaSlicer meldet die Warnungen „Loose extrusions“ und „Floating
   bridge anchors“ nicht mehr.
2. **Geprüft, unkritisch:** Zwei der zwölf Scharnierstifte stehen teilweise über einer 0,6 mm
   tiefen Pflasterfuge. Die Fuge ist mit 1,1 mm schmaler als der Stift (1,75 mm); er liegt
   sicher auf.
3. **Konstruktionsentscheidungen, die beim Spielen auffallen werden:** Dach und Wände sind nur
   gesteckt. Die Fensterstifte halten nur durch Klemmung. Der Riegel ist ein loses Teil.
   Siehe Schwächen.

## 3. So funktionieren die Scharniere

Ja: Der Scharnierstift ist **ein Stück ganz normales 1,75-mm-Filament.**

![So funktioniert das Scharnier](images/scharnier.png)

* Am Pfosten sitzen feste **Scharnieraugen** mit einem engen Loch (1,85 mm): Dort klemmt der
  Stift. Die Tür hat ihre Augen in den Lücken dazwischen, mit einem weiteren Loch (2,3 mm):
  Dort dreht sie sich frei um den Stift.
* **Zuschneiden:** 4 x 126 mm (Haupttüren), 4 x 122 mm (Boxentüren), 4 x 30 mm (Fenster).
  Filament von der Rolle gerade ziehen, Enden mit dem Seitenschneider gerade abschneiden und
  leicht entgraten. Frisches, trockenes Filament nehmen; altes PLA wird spröde. PETG-Filament
  ist zäher.
* **Einbau Türen:** Tür so an den Pfosten halten, dass ihre Augen in den Lücken sitzen. Stift
  **von unten** durch alle Augen schieben, bis er oben anschlägt (das oberste Loch ist
  geschlossen). Dann den Pfosten in den Boden stecken: Der Boden verschließt das Loch unten,
  der Stift kann nicht mehr herausfallen.
* **Einbau Fenster:** Stift **von oben** in das Fensterscharnier stecken. Er steht unten auf
  einem geschlossenen Loch.
* **Vorher testen:** Testplatte T1 hat drei Lochgrößen für jede Seite. Passt der Stift nicht,
  den Wert in `cad/config.scad` ändern (`bore_fixed`, `bore_free`) und neu exportieren.
* **Ausbauen:** Pfosten herausziehen, Stift nach unten herausdrücken.

## 4. Stärken

* **Passt zu echten Schleich-Pferden:** Jede Box fasst auch den größten gängigen Schleich
  (Shire, 17 cm). Geprüft wurde das mit einem Pferde-Platzhalter, der größer ist als jede echte
  Figur. Die Türen sind groß genug, um Pferde hinein- und herauszuführen.
* **Kompakt:** 49 x 25 cm Grundfläche, 27,6 cm hoch.
* **Viel Spielwert:** 4 Boxentüren mit Klick-Verschluss und Halsausschnitt, zwei Doppeltore mit
  Riegel (die Stallgasse ist durchfahrbar), 4 Fenster zum Öffnen, das Dach in 6 Teilen
  abnehmbar.
* **Kräftige Grundkonstruktion:** 16-mm-Pfosten, 2,8 mm starke Wände in Nuten, 8 mm Boden aus
  verzahnten Platten.
* **Echte Scharniere mit Stift** statt gedruckter Clips oder Print-in-Place-Gelenke. Das hält
  viel mehr aus. Geht trotzdem eine Tür kaputt, druckt man nur diese eine nach (etwa 22 g).
* **Druckfreundlich:** keine Stützen, kein Kleber, keine Schrauben, keine Magnete; alle Teile
  passen auf den A1.
* **Schön:** Bretter, Schindeln, Pflaster und Sockelsteine, schwarz-weiß wie die Vorlage.
* **Anpassbar und geprüft:** Alle Maße stehen in einer Datei. Die Prüfung (Kollisionen,
  Türschwenk, Stifte, Verschluss, Dach, Pferde) läuft nach jeder Änderung automatisch.

## 5. Schwächen (für ein Geschenk, mit dem viel gespielt wird)

* **Noch nicht gedruckt:** Passungen und Verschlusskraft sind berechnet. Die Testplatten
  kosten rund 4,5 h und klären das vorher.
* **Hohe Pfosten:** das Druckrisiko auf dem A1 (Abschnitt 1).
* **Dach liegt nur auf:** Wer den Stall am Dach anhebt oder kippt, hat das Dach in der Hand.
  Immer am Boden tragen.
* **Wände sind gesteckt:** Ohne Dach kann man jede Wand nach oben herausziehen. Bei wildem
  Spiel geht der Stall eher auseinander als kaputt. Wer das nicht will, kann ihn verkleben;
  dann lässt er sich aber nicht mehr zerlegen.
* **Zierlichste Teile:** die Fensterflügel (2,4 mm Rahmen, Scharnierwand nur etwa 1,5 mm) und
  die Gitterstäbe. Türen, die mit Gewalt über ihren Anschlag gedrückt werden (Haupttore 105
  Grad, Boxentüren 90 bis 105 Grad), können am Scharnierauge brechen.
* **Kleinteile:** 12 Stifte (1,75 mm dick, 30 bis 126 mm lang) und 2 Riegel (37 mm). Eingebaut
  sind die Stifte gefangen, die Riegel nicht. **Nicht für Kinder unter 3 Jahren.** Ein gedrucktes
  Spielzeug hat keine Spielzeug-Zertifizierung (EN 71).
* **Knapp für die größten Pferde:** 1,6 mm Luft an jedem Ende. Ein 17-cm-Pferd mit dem Kopf an
  der Boxentür lässt sich nur senkrecht herausheben, wenn zusätzlich das Mitteldach abgenommen
  ist (oder man es schräg herausnimmt). Normale Pferde (bis etwa 15 cm), die nicht ganz vorn
  an der Tür stehen, lassen sich direkt nach oben herausheben.
* **PLA:** wird bei etwa 55 °C weich (Auto im Sommer, Fensterbank in der Sonne) und kann mit der
  Zeit spröde werden. Türen und Stifte aus PETG halten mehr aus.
* **Aufwand:** 26 Druckplatten, rund 80 h und 2,33 kg Filament (PrusaSlicer-Schätzung mit
  A1-Einstellungen; Bambu Studio weicht etwas ab), dazu etwa 1 bis 2 Stunden Zusammenbau.

## 6. Empfehlungen

* **Vor dem Druck:** T1 und T2 drucken und auswerten (`TESTING.md`).
* **Beim Druck:** Hohe Pfosten mit 8 mm Brim im Modus Silent, Platte vorher mit Spülmittel
  waschen. Türen und Fensterflügel gern in PETG.
* **Beim Zusammenbau:** Die Nuten müssen sauber sein; eine Wand muss sich von Hand einschieben
  lassen. Erst Boden, dann Pfosten mit Türen, dann Wände, dann Dach (`ASSEMBLY.md`).
* **Beim Verschenken:** zeigen, dass man den Stall am Boden trägt und das Dach zum Spielen
  abnimmt. Die Riegel bei kleinen Kindern weglassen.

## 7. Die Blender-Datei

![Alle Blickrichtungen](images/ansichten_alle.jpg)

`blender/stall_kompakt.blend` (erstellt mit Blender 4.0, öffnet sich in 4.0 und neuer) enthält
die exportierten Druckteile in Einbaulage, keine nachgebaute Geometrie. Erzeugt wird sie mit
`tools/make_blend.py`.

* **Sammlungen** (Outliner, Augen-Symbol zum Ein- und Ausblenden):
  „Stall (zusammengebaut)“ mit Boden, Pfosten, Wänden, Türen und Dach.
  Ausgeblendet: „Tueren offen (90 Grad)“, „Scharnierstifte“ (orange: wo das Filament steckt),
  „Pferd-Platzhalter“ und „Druckplatten“ (alle Platten auf 256-mm-Betten, rechts neben dem
  Stall).
* **Ansichten:** 10 Kameras (Vorne, Hinten, Links, Rechts, vier Schrägansichten, Oben, Unten).
  Kamera im Outliner anklicken, dann Strg+Ziffernblock 0. Frei drehen: mittlere Maustaste;
  Pos1-Taste zeigt alles.
* **Maße** in Millimetern. **F12** rendert die aktive Kamera.
* Für ältere Blender-Versionen oder ohne Blender: `docs/assembly_preview.glb` (glTF-Import oder
  ein beliebiger glTF-Viewer).
