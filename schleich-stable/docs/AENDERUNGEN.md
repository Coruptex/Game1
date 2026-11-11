# Änderungsliste (8. bis 11. November 2026)

## Eckpfosten in zwei Ausführungen (11. November)

* **Fehler gefunden (dein Video):** Seit die Eckpfosten oben der Dachschräge folgen (8. November),
  sind die vier Ecken nicht mehr gleich. Vorne rechts und hinten links braucht es das
  **Spiegelbild**. Mit vier gleichen Pfosten passt dort entweder die Schräge oder die Wandnut,
  nie beides. Mein Fehler: Ich hatte nach der Schräge nicht geprüft, ob die 4 Ecken noch ein
  einziges Druckteil sein können.
* **Jetzt:** `Eckpfosten_A_2x` (vor einem Tor stehend: linke Ecke) und `Eckpfosten_B_2x`
  (rechte Ecke). Der Pfostenblock außen enthält 2 × A und 2 × B.
* **Von deinen 4 gedruckten Eckpfosten** passen 2 als A. Neu drucken musst du nur
  **2 × Eckpfosten B**.
* **Alle anderen Teile geprüft**, mit einem neuen Prüfprogramm (`tools/check_instances.py`):
  Für jedes der 51 eingebauten Teile wird getestet, ob es durch bloßes Drehen aus seiner
  Druckdatei entsteht. Ergebnis: Nur die Eckpfosten waren betroffen. Bei den Seitenwänden liegt
  an einem Ende eine 0,55 mm tiefe Zierfuge zwischen zwei Brettern an der anderen Stelle; die
  Wand passt an allen vier Stellen genau gleich.


## Finale Version (10. November)

* **Dachzapfen** 0,15 mm Luft je Seite (T2 „15“; vorher 0,25). Neu sind dadurch die
  **3 Dächer** (Taschen für die Zapfen). Nachgeprüft: Das Mitteldach hält die Seitendächer
  weiter fest, ein Seitendach lässt sich erst nach Abnehmen des Mitteldachs abheben.
* **Torriegel** gleitet (T4), bleibt unverändert.
* **Fallriegel, Anschlag unter dem Hebel** (dein Hinweis): Er ragt jetzt 2,8 mm über die
  Vorderseite des Hebels hinaus (vorher endete er 0,4 mm davor) und ist 5 statt 4 mm breit.
  Ein Hebel, der auf seinem Zapfen etwas kippelt, rutscht nicht mehr daran vorbei. Am Rechner
  geprüft: auch bei 15 Grad Schiefstand und 0,6 mm Spiel liegt der Hebel auf dem Anschlag.
  Einrasten, Sperren und Abziehen funktionieren wie vorher, die Tür schwenkt wie vorher. Neu
  ist dadurch die **Boxentür** (4 Stück).
* Damit ist **jede Passung durch einen deiner Testdrucke bestätigt**.
* Neu: **Aufbauanleitung als PDF** (`Aufbauanleitung.pdf`), Schritt für Schritt mit Bildern.


## T2 und T4 eingearbeitet (10. November, später)

* **Pfostensockel** in den Bodenplatten: 0,15 mm Luft je Seite (T2 „15“; vorher 0,20).
* **Bodenverzahnung**: 0,15 mm Luft je Seite (T2 „15“; vorher 0,25). Die Höhenluft über der
  Zunge bleibt bei 0,4 mm.
* Neu sind dadurch nur die **6 Bodenplatten**. Alle anderen Dateien sind unverändert.
* Beim Prüfen gefunden: Die Aussparungen des Mitteldachs um die beiden Mittelpfosten nutzten
  denselben Wert wie die Bodensockel. Das hat nichts miteinander zu tun. Sie haben jetzt einen
  eigenen Wert und bleiben bei 0,20 mm; das Mitteldach ist unverändert.
* **Fallriegel** durch T4 bestätigt („funktioniert“).
* Neue Bilder in der Testanleitung: wie der Dachzapfen-Test geht und wie der Torriegel das Tor
  verschließt.
* Nachgeprüft: keine Überschneidung, alle Stifte frei, Türen schwenken wie vorher, Pferde passen.


## Deine Testergebnisse, Fallriegel, Pfostenblock, STL (10. November)

* **Alles als STL-Dateien**, ohne meine Druckeinstellungen. Die Bambu-Studio-Projekte sind
  entfernt. Was ich beim Einstellen empfehle und womit die Tests gedruckt wurden, steht in
  `LIES_MICH.md`.
* **Testergebnisse übernommen:**
  * Pfosten-Scharnieraugen: Loch **2,05 mm** (T3a; vorher 1,85 und gesperrt).
  * Wandnuten in den Pfosten: **0,15 mm** Luft je Seite (T3a „15“; vorher 0,20). Die Nut in
    Sockel und Boden bleibt bei 0,20 mm, denn so ist der Fuß aus T3b gebaut, und der hat gepasst.
  * Oberes Fensterauge: **1,95 mm** (T3b), war schon so eingestellt, jetzt bestätigt.
* **Fallriegel eingebaut** in die 4 Boxentüren und 4 Boxenfronten, auf deinen Wunsch noch ohne
  T4-Ergebnis. Der alte Klickverschluss ist entfernt. Neu ist der lose Hebel (4 Stück). Am
  Rechner mit den echten Teilen nachgeprüft ([VERSCHLUSS.md](VERSCHLUSS.md)). Bitte T4 vor den
  Boxentüren drucken.
* **Pfostenblock** gegen das Umfallen: 6 Pfosten werden zusammen gedruckt, verbunden über eine
  dünne Mittelwand und Stege mit kleinen Bruchzähnen in den Wandnuten. Die Einzelpfosten gibt es
  weiterhin.
* **Wände zweiteilig:** weiße Wand und schwarze Leisten als getrennte Dateien mit gleichen
  Koordinaten (für die Filamentzuordnung pro Teil). Einteilige Ersatzdateien liegen bei.
* Geprüft: alle Teile neu exportiert, keine Überschneidung, alle Stifte frei, Türen und Fenster
  schwenken wie vorher, Pferde passen. Beim Pfostenblock berühren die Stege die Pfosten nur an
  den Zähnen (sonst mindestens 0,5 mm Abstand); im Probe-Slicing werden die Zähne gedruckt.


## Schlankere Testplatten, 68-Stunden-Variante (9. November)

* Du hast die **68-Stunden-Variante** gewählt: Pfosten mit 25 % Füllung und zwei Kontaktlagen an
  den Stützen. Der kleine Zusatzschritt (20 %, eine Kontaktlage, 1 h weniger) ist zurückgenommen.
  Ganzer Stall: 67 h 29 min (Schätzung).
* Testplatten verkleinert, nur was eine eigene Frage beantwortet, bleibt drauf
  ([TESTANLEITUNG.md](TESTANLEITUNG.md), Abschnitt „Was auf den Platten liegt“):
  * T3b: ein Türflügel-Teststück statt zwei. T4: kein eigener Fuß mehr, der aus T3b passt.
  * Wandstreifen und Wandzapfen-Stück liegen jetzt auf T3a (0,24 mm wie die Wände), die
    Zapfenplatte auf T2 (0,28 mm wie das Dach). Vorher lagen sie auf T3b mit 0,20 mm, das hätte
    nach der Umstellung der Schichthöhen nicht mehr ganz gepasst.
  * **T2 ist jetzt Pflicht**, auch wenn du es früher gedruckt hast: Boden jetzt 0,28 statt 0,24 mm.
  * Alle Tests zusammen: etwa 6 h 40 min statt 7 h (die Pfostenstücke bleiben alle 5).
* Die Tests darfst du in einer selten genutzten Farbe drucken, wenn es dieselbe Filamentsorte ist.


## Kürzere Druckzeit (9. November)

Ganzer Stall: **etwa 67½ statt 88 Stunden** (−24 %), 2,25 statt 2,5 kg Filament (PrusaSlicer-Schätzung
mit den gleichen Einstellungen; Bambu Studio zeigt eigene Werte). Gemessen habe ich vorher, wo die
Zeit wirklich hingeht, und nur geändert, was keine getestete Passung berührt:

| Was | Vorher | Jetzt | Wirkung |
|---|---|---|---|
| Pfosten (alle, auch Test T3a) | 0,20 mm, 4 Wände, 25 %, sanfte Geschwindigkeit | **0,24 mm, 2 Wände**, 25 %, normale Geschwindigkeit, nur die Beschleunigung begrenzt; Stützen wie bisher mit zwei Kontaktlagen | hohe Pfosten 17,7 → 11,1 h, kurze 7,6 → 4,7 h |
| Boden | 0,24 mm, 3 Wände, 15 % | **0,28 mm**, 2 Wände, 10 % | 6 Platten zusammen 15,6 → 12,8 h |
| Seitenwände, Trennwände, Giebelfelder | 0,20 mm, 3 Wände | **0,24 mm**, 2 Wände | 9,9 → 8,2 h |
| Dach | 0,20 mm | **0,28 mm**, Seitendächer vollmassiv (steifer, keine langsamen Brückenlagen) | 19,5 → 14,1 h |
| Dachziegel-Fugen | durch die ganze Ziegelreihe geschnitten | nur 0,4 mm tief, sieht gleich aus, viel weniger Einzelinseln beim Druck | in der Dachzeit enthalten |
| Bretterfugen auf der Innenseite der Wände (Druckbett-Seite) | 0,4 mm tief | **weggelassen**: Sie erzwangen langsame Brückenlagen. Außen bleiben die Fugen | etwa −13 % je Wandplatte |

**Unverändert bei 0,20 mm** bleiben Türen, Fensterflügel, Giebelwände und Boxenfronten. Ihre
Passungen (Türscharnier 2,15, Fensterstift, Verschluss) sind bei 0,20 mm getestet bzw. werden es in
T3b und T4. Nach deinen Tests kann ich auch diese Platten beschleunigen.

Die Pfosten-Testplatte T3a und der Boden-Test T2 sind mit den neuen Einstellungen erzeugt, damit sie
genau so gedruckt werden wie die Pfosten und Bodenplatten später. Der Filamentwechsel der Wände liegt
bei 0,24-mm-Schichten bei 3,08 mm (erste Schicht über der Wandfläche), auch das ist gespeichert.

**Grenze ohne Qualitätsverlust:** Viel weiter geht es mit der 0,4-mm-Düse nicht. Die großen flachen
Teile laufen schon an der Durchflussgrenze des Filaments (21 mm³/s). Was noch ginge, kostet sichtbar
Qualität (gemessen):

| Möglichkeit | Ersparnis | Nachteil |
|---|---|---|
| Pfosten mit 0,28 statt 0,24 mm | etwa 2,6 h | deutlichere Schichtlinien an den schwarzen Pfosten, Scharnierlücken ungenauer |
| Scharnieraugen mit 45-Grad-Schräge statt Stützen | etwa 2,6 h | die Schräge unter jedem Auge, die du nicht wolltest |
| Wände mit 0,28 mm | etwa 0,8 h | gröbere Bretterfugen und Leistenkanten |

Wer noch schneller will: Am A1 kann man während des Drucks auf „Sport“ stellen. Für Boden und Dach
geht das meist gut; für die Pfosten nicht, die kippeln sonst.


## Fenster

![Fenster vorher und nachher](images/fenster_vorher_nachher.jpg)

* Der schwarze Fensterrahmen läuft jetzt **ganz herum**, bei geschlossenem und bei offenem Fenster.
  Die Aussparung auf der Scharnierseite ist weg. Ich habe sie nicht einfach gefüllt: Das Scharnier
  sitzt jetzt **außerhalb des Rahmens**.
* Der Fensterflügel greift mit **zwei Bändern über den Rahmen**, mit 0,6 mm Luft. Das Scharnier hat
  jetzt 5 Augen statt 3: 3 an der Wand, 2 am Flügel.
* Der ganze Schwenkweg ist in 5-Grad-Schritten geprüft: frei von 0 bis 175 Grad, erst bei 180 Grad
  berührt der Flügel den Eckpfosten. Kleinster Abstand unterwegs 0,5 mm, zum schwarzen Rahmen
  mindestens 0,6 mm. Unter den drehenden Augen ist die Wand 0,4 mm vertieft (verdeckt).
* Die Fensterbank reicht unter das Scharnier.
* Der Stift wird weiter von oben eingesteckt. Das oberste Wandauge ist etwas enger (1,95 mm,
  vorläufig) und hält den Stift fest. Die übrigen Augen sind frei.
* Der Fensterflügel bekommt beim Druck einen kleinen 3-mm-Brim (in der Projektdatei gespeichert).

![Scharnier-Detail](images/fenster_scharnier.jpg)

## Eck- und Seitenpfosten (dein Wunsch vom 8. November)

![Eckpfosten vorher und nachher](images/eckpfosten_vorher_nachher.jpg)

* Die Oberkante der 4 Eckpfosten und der 2 Seitenpfosten folgt jetzt der Neigung des Seitendachs
  (20 Grad), 0,6 mm darunter. Es gibt keine Stufe mehr unter dem Dach. Das Dach liegt weiterhin
  nicht auf den Pfosten, sondern auf den Wänden; nachgeprüft: überall 0,56 mm Luft, Dach hebt sich
  ab und bleibt verriegelt wie vorher.
* Die Pfosten werden dadurch 124 statt 118 mm hoch. Die Schräge ist beim stehenden Druck die
  Oberseite, braucht also keine Stützen. Die Gang-Pfosten folgen schon dem Mitteldach.
* Betrifft die freigegebene Platte P07; sie ist neu erzeugt und probegesliced.

## Scharnier-Passungen

* Drei getrennte Lochgrößen statt zwei, je nach Druckrichtung:
  * **Pfosten** (stehend gedruckt): `bore_post`, noch offen. Laut T1 sind 1,75 bis 1,95 mm zu eng,
    T3a testet 2,05 bis 2,45 mm.
  * **Türen und Fensterflügel** (flach gedruckt): `bore_free` = **2,15 mm**, durch deinen T1-Test
    bestätigt und übernommen. Betrifft Tore, Boxentüren und Fensterflügel.
  * **Fensterrahmen an der Wand** (flach gedruckt): unten 2,15 mm, oben 1,95 mm (klemmt). Der
    Klemmwert ist vorläufig, T3b prüft ihn.
* Neu: eine kleine 45-Grad-Einführschräge unten an jedem Pfostenauge, damit der Stift das nächste
  Auge leichter findet.

## Verschluss der Boxentüren

* Den Klickverschluss habe ich geprüft und mit Alternativen verglichen ([VERSCHLUSS.md](VERSCHLUSS.md)).
  Empfehlung: **Fallriegel**. Er fällt beim Schließen von selbst ein, sperrt formschlüssig und ist
  unempfindlich gegen Toleranzen.
* Der Fallriegel steckt bisher nur im **Teststück T4**. Die Produktionsteile behalten den alten
  Klickverschluss, bis dein Test gut ausfällt.

## Neue Teststücke

* **T3a:** 5 Pfosten-Scharnierstücke (2,05 bis 2,45) und der Nutenpfosten. Gleiche Druckrichtung und
  Einstellungen wie die echten Pfosten.
* **T3b:** ein Türflügel-Teststück 2,15 (für den zusammengebauten Scharniertest), ein Stück Giebelwand
  mit dem neuen Fenster, der echte Fensterflügel, ein Fuß, Fensterstift-Klemmstücke 1,85 / 1,95 /
  2,05. Wandstreifen und Zapfen: siehe oben.
* **T4:** Fallriegel-Prüfstand (Rahmen, Tür, Hebel; Fuß aus T3b) und der Tor-Riegel mit seinen Schlaufen.
* **T2:** Bodensockel, Bodenverzahnung, Zapfenplatte.

## Bambu-Studio-Projekte

* Jede Platte ist ein fertiges Projekt mit Drucker, Filamenten, Prozess, Ausrichtung, Brim, Stützen
  und Filamentwechsel (am 10. November durch STL-Dateien ersetzt). Die alten Nur-Geometrie-Dateien sind weg.
* Neues Pfosten-Preset **v2** mit sanfteren Geschwindigkeiten und Beschleunigungen. Am Drucker
  musst du nicht mehr auf „Leise“ stellen.
* Getrennte Ordner: **1_TEST** und **2_PRODUKTION**. In 2_PRODUKTION liegen nur die Platten, die nicht
  von den neuen Scharnier- und Verschlusstests abhängen: Boden, Eck- und Seitenpfosten, Wände, Dach.
  Ihre Passungen (Sockel, Verzahnung, Nuten, Zapfen) sind unverändert und nur berechnet. T2, T3a und
  T3b prüfen sie mit, deshalb diese Platten nach den Tests drucken.
* **Gesperrt bis zum Test:** Pfosten mit Scharnieraugen, Giebelwände, Fensterflügel (T3);
  Boxenfronten, Boxentüren, Tore mit Riegeln (T4).

## Prüfung

* Alle 51 Bauteile neu exportiert und geprüft: keine Überschneidung, alles beweglich, alle Stifte
  frei, Pferde passen, Dach verriegelt ([VERBINDUNGEN.md](VERBINDUNGEN.md), [VALIDATION.md](VALIDATION.md)).
* Jede Platte wurde probegesliced: Alles liegt einschließlich Brim und Stützen auf dem Bett, und
  keine Stütze sitzt in einem Scharnierloch.
