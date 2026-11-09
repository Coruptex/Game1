# Testanleitung: T2, T3a, T3b, T4

Stand 9. November 2026. Die Projektdateien liegen im Ordner **`1_TEST`**. Jede Datei enthält
Druckerprofil, Filament, Druckeinstellungen, Ausrichtung, Brim und, wo nötig, Stützen. Es sind
dieselben Einstellungen wie später bei den Produktionsteilen. Du musst nichts einstellen.

**Wichtig für alle Tests:** nicht aufbohren, nicht feilen, nicht nachschneiden. Stützen und
Brim entfernen ist erlaubt. Bewerte jedes Teil so, wie es vom Drucker kommt.

**Stifte:** Alle Scharnierstifte sind Stücke von 1,75-mm-Filament. Ziehe ein Stück gerade,
schneide es mit dem Seitenschneider quer ab und entgrate die Enden leicht mit dem Fingernagel.

## Übersicht

| Datei | Wozu | Druckzeit (Schätzung) | Muss? |
|---|---|---|---|
| `TEST_T3a_Pfosten_Scharnier.3mf` | Lochgröße der Pfosten-Scharnieraugen, Wandnut, Wandzapfen | etwa 3 h 50 min | **ja** |
| `TEST_T3b_Tuer_Fenster.3mf` | Türflügel-Teststück, neues Fenster, Fensterstift-Klemmung | etwa 1 h 25 min | **ja** |
| `TEST_T4_Verschluss.3mf` | Fallriegel-Prüfstand, Tor-Riegel | etwa 50 min | **ja** |
| `TEST_T2_Boden_Passungen.3mf` | Bodensockel, Bodenverzahnung, Dach-Zapfentaschen | etwa 40 min | **ja**, auch wenn du T2 schon früher gedruckt hast |

Zeiten sind Schätzungen (PrusaSlicer mit gleichen Einstellungen), Bambu Studio zeigt eigene Werte.

Druckreihenfolge: T3a, T3b, T4, T2, danach die freigegebenen Produktionsplatten (siehe
[DRUCKPLAN.md](DRUCKPLAN.md)). Die gesperrten Teile erzeuge ich neu, sobald du mir die
Ergebnisse meldest.

## Welche Farbe?

Die Tests müssen nicht schwarz sein. Nimm eine Farbe, die du selten brauchst, aber **dieselbe
Filamentsorte** wie für den Stall, also Bambu PLA Basic (oder genau das PLA, das du später nimmst).
Andere Sorten wie Matte, Silk, PETG oder ein anderer Hersteller schrumpfen und fließen anders. Das
verfälscht die Passung stärker als die Farbe. Zwischen den Farben derselben Sorte sind die
Unterschiede kleiner als die Testschritte (0,05 bis 0,1 mm). Eine helle Farbe hat sogar einen
Vorteil: Stützreste in den Löchern sieht man besser.

So geht es: Im Druckdialog bei Projekt-Filament 2 (Schwarz) den AMS-Slot mit deiner Testfarbe
wählen. Sonst nichts ändern.

Zwei Teile in den Tests sind echte Produktionsteile: der Fensterflügel (T3b) und der Torriegel
(T4). In Schwarz kannst du sie später einbauen. In einer anderen Farbe sind sie eben nur
Teststücke. Die Produktionsplatten enthalten alle Flügel und Riegel ohnehin vollständig.

## Was auf den Platten liegt und warum

Ich habe die Platten am 9. November verkleinert. Was übrig ist, beantwortet jeweils eine eigene
Frage, die ich sonst nur berechnen könnte:

| Platte | Weggefallen | Grund |
|---|---|---|
| T3b | zweites Türflügel-Teststück | Eins reicht, du steckst es nacheinander an zwei Pfostenstücke. Hast du noch dein 2,15-Stück aus T1, kannst du auch dieses nehmen und das Teststück in Bambu Studio löschen (Rechtsklick > Löschen) |
| T4 | Fuß | Der Fuß aus T3b passt auch zum Prüfstand |
| T3b → T3a | Wandstreifen, Wandzapfen-Stück | Die Wände werden jetzt mit 0,24 mm gedruckt, darum liegen ihre Teststücke auf T3a, der einzigen 0,24-mm-Testplatte |
| T3b → T2 | Zapfenplatte | Das Dach wird jetzt mit 0,28 mm gedruckt, wie der Boden auf T2 |

Die 5 Pfostenstücke in T3a sind der größte Brocken (gut drei Stunden). Ich lasse alle 5 drauf. Mit
weniger Größen müsstest du vielleicht ein zweites Mal testen, und das kostet mehr. Sie sind so lang
wie ein echtes Türscharnier, weil der Stift durch alle 5 Augen gehen muss. Kurze Stücke würden
genau das nicht prüfen.

Darum ist T2 jetzt Pflicht: Boden und Dach werden seit dem 9. November mit 0,28 statt 0,24 bzw.
0,20 mm Schichthöhe gedruckt. Die Höhe der Bodenverzahnung hängt an der Schichthöhe. Ein früher
gedrucktes T2 gilt dafür nicht mehr.

---

## T3a: Pfosten-Scharnieraugen

**Was wird getestet?** Wie groß das Loch in den Scharnieraugen der **stehend gedruckten
Pfosten** sein muss. In T1 waren 1,75, 1,85 und 1,95 mm alle zu eng. T3a probiert 2,05 / 2,15 /
2,25 / 2,35 / 2,45 mm. Die Zahl steht hinten auf jedem Stück. Gedruckt wird wie die echten
Pfosten: stehend, mit Baumstützen unter den Augen, gleiche Einstellungen. Neu ist eine kleine
Einführschräge unten an jedem Auge. Sie hilft dem Stift, das nächste Auge zu finden.

**Teile:** 5 Pfostenstücke (2,05 bis 2,45), dazu für die Wandtests der Nutenpfosten, ein
Wandstreifen und das Wandzapfen-Stück (ein Stück Wandkante mit Zapfen). Die Wandteile sind mit
0,24 mm gedruckt wie die echten Wände.

**Nach dem Druck:** die kleinen Stützen unter den Augen mit der Spitzzange herausdrehen. Schau
von unten in jedes Loch. Ist ein Loch durch Stützreste verschlossen, notiere das und bohre es
nicht auf.

**Test 1, Pfosten allein:** ein 90 mm langes Filamentstück von **unten** in jedes Pfostenstück
schieben, bis es oben am geschlossenen Ende anstößt.

| Ergebnis | Bedeutung |
|---|---|
| A: geht nicht ganz hinein | zu eng |
| B: geht mit leichtem, gleichmäßigem Druck hinein und bleibt stecken, wenn du das Stück umdrehst und leicht schüttelst | **ideal** |
| C: rutscht leicht hinein und fällt beim Umdrehen heraus | etwas locker, aber brauchbar (im Stall hält der Boden den Stift) |

Gesucht ist das **kleinste Loch mit B**. Gibt es kein B, dann das kleinste mit C.

**Test 2, zusammengebautes Scharnier:** das Türflügel-Teststück **2,15** aus T3b (oder dein
2,15-Teststück aus T1) mit seinen Augen in die Lücken des besten Pfostenstücks halten und den
Stift von unten durch alle Augen schieben. Dann prüfen:

* Der Flügel dreht sich von zu bis über 90 Grad, ohne zu haken oder zu kratzen.
* In den Lücken zwischen den Augen reibt nichts (Stützreste!).
* Wackeln: Drück die freie Ecke des Flügels leicht auf und ab. Gut ist, wenn sie sich weniger
  als etwa 1 mm bewegt.
* Wiederhole das mit dem nächstgrößeren Pfostenstück zum Vergleich.

**Test 3, Wandnut:** den Wandstreifen in die drei Nuten des Nutenpfostens schieben (Zahlen 15 / 20
/ 30 = Luft je Seite in Hundertstel-Millimeter). Gut ist, wenn er ohne Kraft gleitet und nicht
merklich wackelt. Im Modell sind 20 eingestellt.

Das Wandzapfen-Stück brauchst du für den Dachzapfen-Test bei T2.

**Melde mir:** für jedes der 5 Stücke A, B oder C, ob ein Loch verschlossen war, wie sich
das zusammengebaute Scharnier anfühlt (dreht frei? wackelt?) und die beste Wandnut.

---

## T3b: Türflügel, Fenster, Fensterstift

**Teile, die zusammengehören:**

| Teile | Gehören zu |
|---|---|
| Türflügel-Teststück „2,15“ | Test 2 von T3a |
| Fenster-Teststück (Wandausschnitt mit Fenster) + Fensterflügel + Fuß + 30-mm-Stift | Fenstertest |
| 3 Fensterstift-Stücke „1,85“, „1,95“, „2,05“ | Klemmtest |

Der Fensterflügel ist ein echtes Produktionsteil. Ist er gut, kannst du ihn später einbauen.

**Fenstertest.** Was wird getestet? Der neue Fensterrahmen läuft ganz herum, das Scharnier sitzt
außen. Getestet werden Schwenkweg, Abstände und Stiftsitz.

1. Wandausschnitt mit der Unterkante in den Fuß stecken (wie in die Sockelnut).
2. Fensterflügel geschlossen vor die Öffnung halten: die zwei Bänder liegen über dem
   schwarzen Rahmen, die Augen greifen ineinander.
3. Den 30-mm-Stift **von oben** in die Augen stecken. Durch das oberste Auge geht er mit
   leichtem Widerstand (Klemmloch), danach rutscht er bis auf den Boden.

Gutes Ergebnis:

* Der schwarze Rahmen ist rundherum geschlossen, bei zu- und bei aufgeklapptem Fenster.
* Das Fenster schwenkt von zu bis etwa 170 Grad, ohne irgendwo zu streifen. Kein Kratzen.
* Geschlossen berühren die Bänder den Rahmen nicht. Ein Blatt Papier passt dazwischen.
* Wandstück umdrehen und leicht schütteln: Der Stift bleibt drin.

**Fensterstift-Klemmtest.** Was wird getestet? Wie eng das oberste Fensterauge sein muss, damit
der Stift hält. Je ein 20-mm-Stift in jedes der drei Stücke drücken.

* Gut ist ein Stück, bei dem der Stift mit leichtem Daumendruck hineingeht und beim Schütteln
  nicht herausfällt.
* Gesucht ist das **größte** Loch, das noch hält, denn das lässt sich am leichtesten montieren.

**Melde mir:** Fenster (Rahmen geschlossen? schwenkt frei? Stift hält?) und das beste
Fensterstift-Stück.

Den Fuß brauchst du auch für T4.

---

## T4: Fallriegel und Tor-Riegel

![Fallriegel-Prüfstand](images/fallriegel_T4.jpg)

**Was wird getestet?** Der neue Verschluss für die Boxentüren (Erklärung und Vergleich:
[VERSCHLUSS.md](VERSCHLUSS.md)) und der Schieberiegel der großen Tore.

**Teile, die zusammengehören:**

| Teile | Gehören zu |
|---|---|
| Rahmen + Testtür + Hebel + 45-mm-Stift, dazu der Fuß aus T3b | Fallriegel-Prüfstand. Rahmen und Tür sind ein Stück Boxenfront und Boxentür in Originalmaßen |
| Riegelplatte + Torriegel | Tor-Riegel. Der Riegel ist ein echtes Produktionsteil |

**Aufbau des Prüfstands:**

1. Rahmen mit der Unterkante in den Fuß aus T3b stecken.
2. Die Testtür mit ihren Augen in die Lücken der Rahmenaugen halten und den 45-mm-Stift
   **von oben** durch alle Augen stecken.
3. **Hebel aufstecken:** Hebel senkrecht nach oben halten, sodass seine Kerbe über der Nase
   des Zapfens steht. Aufschieben, dann nach unten drehen, bis er auf dem kleinen Anschlag
   liegt.

**Test 1, Einrasten:** Tür ganz öffnen und mit einem Finger zudrücken. Der Hebel muss über die
Schräge des T-Hakens gleiten und dahinter hörbar einfallen. Mach das 10-mal, auch langsam.

**Test 2, Halt:** Tür geschlossen, an der freien Kante ziehen. Sie darf sich nur 1 bis 2 mm
bewegen und muss dann fest halten, auch bei einem kräftigen Ruck wie im Spiel. Dabei darf sich
nichts sichtbar verbiegen.

**Test 3, Öffnen:** Hebel am runden Griff etwa 4 mm anheben und die Tür aufziehen. Das soll mit
einer Hand und ohne Kraft gehen. Lässt du den Hebel bei offener Tür los, fällt er wieder auf
seinen Anschlag.

**Test 4, Dauertest:** 100-mal öffnen und schließen (mitzählen). Danach prüfen:

* Rastet es noch zuverlässig ein?
* Fällt der Hebel noch von selbst?
* Ist irgendwo Abrieb zu sehen (glänzende oder abgerundete Kanten an der Schräge)?

**Test 5, unverlierbar:** Versuch, den Hebel abzuziehen, einmal waagerecht und einmal halb
angehoben. Er darf nicht abgehen. Senkrecht nach oben gestellt geht er ab; so wird er montiert.

**Test 6, Kippen:** Prüfstand um etwa 30 Grad nach vorn und nach hinten neigen. Die Tür muss
verriegelt bleiben. Auf dem Kopf fällt der Hebel auf, das ist bei einem Fallriegel normal.

**Tor-Riegel:** den Riegel durch beide Schlaufen der Riegelplatte schieben. Gut ist, wenn er
von Hand ohne Kraft gleitet, nicht klemmt und nicht spürbar wackelt (Luft 0,3 mm je Seite).

**Melde mir:** Einrasten (immer? manchmal?), Bedienkraft beim Anheben (leicht / mittel /
schwer), Halt (hält einen Ruck?), Zustand nach 100-mal, Kipptest, Tor-Riegel (gleitet / klemmt
/ wackelt). Fotos helfen.

---

## T2: Bodensockel, Bodenverzahnung, Dach-Zapfentaschen

Gedruckt mit den Bodeneinstellungen (0,28 mm Schichthöhe, wie Boden und Dach).

* **Sockelplatte:** den Nutenpfosten aus T3a in die drei Sockel stecken (15 / 20 / 30). Gut ist,
  wenn er von Hand hineingeht und nicht wackelt. Im Modell sind 20 eingestellt.
* **Bodenverzahnung:** Stück A waagerecht in die drei Aussparungen von Stück B schieben (15 /
  25 / 35). Gut ist, wenn es leicht gleitet, ohne zu klemmen, und die Oberflächen bündig sind.
  Im Modell sind 25 eingestellt.
* **Dachzapfen:** das Wandzapfen-Stück aus T3a mit dem Zapfen in die drei Taschen der
  Zapfenplatte stecken (15 / 25 / 35). Gut ist, wenn es von selbst hineinfällt und kaum Spiel
  hat. Im Modell sind 25 eingestellt.

**Melde mir:** den besten Sockel, die beste Verzahnung und die beste Dachzapfen-Tasche.
