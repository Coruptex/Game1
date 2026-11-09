# Testanleitung: T2 und T4 (noch offen)

Stand 10. November 2026. Die STL-Dateien liegen im Ordner **`1_TEST_noch_offen`**. Die
Druckeinstellungen wählst du selbst. Nimm für jeden Test die Einstellungen, die du später für
die zugehörigen Teile verwendest, und dasselbe Filament (Sorte und Hersteller). Die Farbe ist
egal.

**Wichtig für alle Tests:** nicht aufbohren, nicht feilen, nicht nachschneiden. Stützen und
Brim entfernen ist erlaubt. Bewerte jedes Teil so, wie es vom Drucker kommt.

**Stifte:** Alle Scharnierstifte sind Stücke von 1,75-mm-Filament. Ziehe ein Stück gerade,
schneide es mit dem Seitenschneider quer ab und entgrate die Enden leicht mit dem Fingernagel.

## Deine bisherigen Ergebnisse (eingearbeitet)

| Test | Ergebnis | Übernommen |
|---|---|---|
| T1 Türflügel | 2,15 am besten | Loch in Türen und Fensterflügeln 2,15 mm |
| T3a Pfostenstücke | **2,05** am besten | Loch in allen Pfosten-Scharnieraugen 2,05 mm |
| T3a Nutenpfosten | **15** am besten | Wandnuten in allen Pfosten 0,15 mm Luft je Seite (vorher 0,20) |
| T3b Fuß | Wandstück passt | Nut in Sockel und Boden bleibt bei 0,20 mm, wie im Fuß |
| T3b Fensterstift | **1,95** am besten | oberes Fensterauge an der Giebelwand 1,95 mm (war schon so) |

## Was noch offen ist

| Ordner | Wozu | Wann drucken |
|---|---|---|
| `T4_Fallriegel` | Fallriegel der Boxentüren und Schieberiegel der Tore | **vor** den Boxentüren, Boxenfronten und Toren |
| `T2_Boden_und_Dach` | Pfostensockel im Boden, Bodenverzahnung, Dachzapfen | **vor** den Bodenplatten und Dächern |

Der Fallriegel ist schon in die Boxentüren und Boxenfronten eingebaut (dein Wunsch). T4 ist ein
kleines Stück aus Boxentür und Boxenfront in Originalmaßen. Druck es zuerst, dann merkst du
einen Fehler an einem kleinen Teil statt an vier großen.

Teile, die du schon hast, brauchst du nicht neu zu drucken: Nutenpfosten und Wandzapfen-Stück
aus T3a (für T2), den Fuß aus T3b (für T4). Sie liegen in den Unterordnern `schon_gedruckt_...`
bei, falls eins fehlt.

---

## T4: Fallriegel und Tor-Riegel

![Fallriegel-Prüfstand](images/fallriegel_T4.jpg)

**Was wird getestet?** Der neue Verschluss für die Boxentüren (Erklärung und Vergleich:
[VERSCHLUSS.md](VERSCHLUSS.md)) und der Schieberiegel der großen Tore.

**Teile, die zusammengehören:**

| Teile | Gehören zu |
|---|---|
| Rahmen + Testtür + Hebel + 45-mm-Stift, dazu der Fuß aus T3b (liegt auch als STL bei) | Fallriegel-Prüfstand. Rahmen und Tür sind ein Stück Boxenfront und Boxentür in Originalmaßen |
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

Druck T2 mit denselben Einstellungen, die du später für Boden und Dach nimmst. Nur dann sagt der
Test etwas über deine Bodenplatten und Dächer.

* **Sockelplatte:** den Nutenpfosten aus T3a in die drei Sockel stecken (15 / 20 / 30). Gut ist,
  wenn er von Hand hineingeht und nicht wackelt. Im Modell sind 20 eingestellt.
* **Bodenverzahnung:** Stück A waagerecht in die drei Aussparungen von Stück B schieben (15 /
  25 / 35). Gut ist, wenn es leicht gleitet, ohne zu klemmen, und die Oberflächen bündig sind.
  Im Modell sind 25 eingestellt.
* **Dachzapfen:** das Wandzapfen-Stück aus T3a mit dem Zapfen in die drei Taschen der
  Zapfenplatte stecken (15 / 25 / 35). Gut ist, wenn es von selbst hineinfällt und kaum Spiel
  hat. Im Modell sind 25 eingestellt.

**Melde mir:** den besten Sockel, die beste Verzahnung und die beste Dachzapfen-Tasche.
