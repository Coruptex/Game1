# Testanleitung: T2, T3a, T3b, T4

Stand 8. November 2026. Die Projektdateien liegen im Ordner **`1_TEST`**. Jede Datei enthält
Druckerprofil, Filament, Druckeinstellungen, Ausrichtung, Brim und, wo nötig, Stützen. Es sind
dieselben Einstellungen wie später bei den Produktionsteilen. Du musst nichts einstellen.

**Wichtig für alle Tests:** nicht aufbohren, nicht feilen, nicht nachschneiden. Stützen und
Brim entfernen ist erlaubt. Bewerte jedes Teil so, wie es vom Drucker kommt.

**Stifte:** Alle Scharnierstifte sind Stücke von 1,75-mm-Filament. Ziehe ein Stück gerade,
schneide es mit dem Seitenschneider quer ab und entgrate die Enden leicht mit dem Fingernagel.

## Übersicht

| Datei | Wozu | Druckzeit (Schätzung) | Muss? |
|---|---|---|---|
| `TEST_T3a_Pfosten_Scharnier.3mf` | Lochgröße der Pfosten-Scharnieraugen, Nutenpfosten | siehe Druckplan | **ja** |
| `TEST_T3b_Tuer_Fenster.3mf` | Türflügel-Teststücke, neues Fenster, Fensterstift-Klemmung, Wand- und Dachzapfen | siehe Druckplan | **ja** |
| `TEST_T4_Verschluss.3mf` | Fallriegel-Prüfstand, Tor-Riegel | siehe Druckplan | **ja** |
| `TEST_T2_Boden_Passungen.3mf` | Bodensockel und Bodenverzahnung | siehe Druckplan | nur falls T2 noch nicht gedruckt |

Druckreihenfolge: T3a, T3b, T4 (und T2), danach die freigegebenen Produktionsplatten (siehe
[DRUCKPLAN.md](DRUCKPLAN.md)). Die gesperrten Teile erzeuge ich neu, sobald du mir die
Ergebnisse meldest.

---

## T3a: Pfosten-Scharnieraugen

**Was wird getestet?** Wie groß das Loch in den Scharnieraugen der **stehend gedruckten
Pfosten** sein muss. In T1 waren 1,75, 1,85 und 1,95 mm alle zu eng. T3a probiert 2,05 / 2,15 /
2,25 / 2,35 / 2,45 mm. Die Zahl steht hinten auf jedem Stück. Gedruckt wird wie die echten
Pfosten: stehend, mit Baumstützen unter den Augen, gleiche Einstellungen. Neu ist eine kleine
Einführschräge unten an jedem Auge. Sie hilft dem Stift, das nächste Auge zu finden.

**Teile:** 5 Pfostenstücke (2,05 bis 2,45) und der Nutenpfosten (für den Wandtest, siehe T3b).

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

**Test 2, zusammengebautes Scharnier:** ein Türflügel-Teststück **2,15** aus T3b (oder dein
2,15-Teststück aus T1) mit seinen Augen in die Lücken des besten Pfostenstücks halten und den
Stift von unten durch alle Augen schieben. Dann prüfen:

* Der Flügel dreht sich von zu bis über 90 Grad, ohne zu haken oder zu kratzen.
* In den Lücken zwischen den Augen reibt nichts (Stützreste!).
* Wackeln: Drück die freie Ecke des Flügels leicht auf und ab. Gut ist, wenn sie sich weniger
  als etwa 1 mm bewegt.
* Wiederhole das mit dem nächstgrößeren Pfostenstück zum Vergleich.

**Melde mir:** für jedes der 5 Stücke A, B oder C, ob ein Loch verschlossen war, und wie sich
das zusammengebaute Scharnier anfühlt (dreht frei? wackelt?).

---

## T3b: Türflügel, Fenster, Fensterstift, Wand- und Dachzapfen

**Teile, die zusammengehören:**

| Teile | Gehören zu |
|---|---|
| 2 Türflügel-Teststücke „2,15“ | Test 2 von T3a |
| Fenster-Teststück (Wandausschnitt mit Fenster) + Fensterflügel + Fuß + 30-mm-Stift | Fenstertest |
| 3 Fensterstift-Stücke „1,85“, „1,95“, „2,05“ | Klemmtest |
| Wandstreifen + Nutenpfosten (aus T3a) | Wandnut-Test |
| Zapfenplatte + Zapfenstück | Dachzapfen-Test |

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

**Wandnut-Test:** den Wandstreifen in die drei Nuten des Nutenpfostens schieben (Zahlen 15 / 20 /
30 = Luft je Seite in Hundertstel-Millimeter). Gut ist, wenn er ohne Kraft gleitet und nicht
merklich wackelt. Im Modell sind 20 eingestellt.

**Dachzapfen-Test:** das Zapfenstück in die drei Taschen der Zapfenplatte stecken (15 / 25 / 35).
Gut ist, wenn es von selbst hineinfällt und kaum Spiel hat. Im Modell sind 25 eingestellt.

**Melde mir:** Fenster (Rahmen geschlossen? schwenkt frei? Stift hält?), das beste Fensterstift-
Stück, die beste Wandnut, die beste Dachzapfen-Tasche.

---

## T4: Fallriegel und Tor-Riegel

![Fallriegel-Prüfstand](images/fallriegel_T4.jpg)

**Was wird getestet?** Der neue Verschluss für die Boxentüren (Erklärung und Vergleich:
[VERSCHLUSS.md](VERSCHLUSS.md)) und der Schieberiegel der großen Tore.

**Teile, die zusammengehören:**

| Teile | Gehören zu |
|---|---|
| Rahmen + Testtür + Hebel + Fuß + 45-mm-Stift | Fallriegel-Prüfstand. Rahmen und Tür sind ein Stück Boxenfront und Boxentür in Originalmaßen |
| Riegelplatte + Torriegel | Tor-Riegel. Der Riegel ist ein echtes Produktionsteil |

**Aufbau des Prüfstands:**

1. Rahmen mit der Unterkante in den Fuß stecken.
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

## T2: Bodensockel und Bodenverzahnung (nur falls noch nicht gedruckt)

Gedruckt mit den Bodeneinstellungen (0,24 mm Schichthöhe).

* **Sockelplatte:** den Nutenpfosten aus T3a in die drei Sockel stecken (15 / 20 / 30). Gut ist,
  wenn er von Hand hineingeht und nicht wackelt. Im Modell sind 20 eingestellt.
* **Bodenverzahnung:** Stück A waagerecht in die drei Aussparungen von Stück B schieben (15 /
  25 / 35). Gut ist, wenn es leicht gleitet, ohne zu klemmen, und die Oberflächen bündig sind.
  Im Modell sind 25 eingestellt.

**Melde mir:** den besten Sockel und die beste Verzahnung. Hast du T2 schon früher gedruckt,
reichen mir diese Ergebnisse.
