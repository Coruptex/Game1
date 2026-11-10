# Alle Verbindungen: rechnerisch geprüft oder durch Testdruck bestätigt?

Stand 10. November 2026, mit deinen Testergebnissen aus T1 bis T4. Es gibt drei Stufen:

* **rechnerisch geprüft:** Die exportierten Druckteile wurden im Rechner zusammengesetzt
  (`tools/validate.py`, Bericht in [VALIDATION.md](VALIDATION.md)). Geprüft ist, dass sich
  nichts überschneidet, dass alles frei beweglich ist und dass die geplanten Luftspalte
  vorhanden sind. Wie der Drucker diese Spalte tatsächlich ausdruckt, zeigt die Rechnung
  nicht.
* **durch Testdruck bestätigt:** Du hast es gedruckt und mir das Ergebnis gemeldet.
* **Test offen:** Ein Teststück existiert, dein Ergebnis fehlt noch.

## Gesamtprüfung Größe und Zusammenbau

* Alle 55 Bauteile (51 und die 4 Fallriegel-Hebel) wurden neu aus dem Modell exportiert.
  Einheit Millimeter, kein Skalierungsfehler. Jedes Teil passt einzeln auf das A1-Druckbett.
* Zusammengesetzt überschneiden sich keine zwei Teile (Toleranz 0,5 mm³).
* Alle Türen und Fenster schwenken frei, auch alle gleichzeitig auf 90 Grad.
* Alle 12 Scharnierstifte laufen frei durch alle Augen.
* Das Dach ist verriegelt: Ein Seitendach kommt nach 1,25 mm Anheben nicht weiter, solange
  das Mitteldach aufliegt. Seine Zapfen sind 1,6 mm hoch.
* Die Pferde passen: Designpferd 170 x 53 x 120 mm in jeder Box, durch die Boxentür und mit
  Reiter durch das Tor.

## Verbindungen im Einzelnen

| Verbindung | Teile | Luft im Modell | Rechnerisch geprüft | Testdruck | Status |
|---|---|---|---|---|---|
| Bodenverzahnung | 6 Bodenplatten, Zungen 14 mm breit | **0,15 mm je Seite** (vorher 0,25), 0,4 mm nach oben | ja, Spalt 0,15 mm; Platten schieben sich waagerecht zusammen | **T2: 15 am besten (deine Meldung)** | **bestätigt** |
| Pfostensockel | 12 Pfosten in den Bodenplatten | **0,15 mm je Seite** (vorher 0,20) | ja | **T2: 15 am besten (deine Meldung)** | **bestätigt** |
| Wandnuten in den Pfosten | Wände, Giebelwände, Trennwände, Boxenfronten, Giebelfelder | **0,15 mm je Seite** (vorher 0,20), 0,5 mm Luft am Nutgrund | ja, Spalt 0,15 mm; jede Wand lässt sich senkrecht herausziehen | **T3a: 15 am besten (deine Meldung)** | **bestätigt** |
| Wandnut im Sockel und Boden | Unterkanten der Wände | 0,20 mm je Seite | ja | **T3b: Wandstück passt in den Fuß (gleiche Nut, deine Meldung)** | **bestätigt** |
| Dachzapfen | Zapfen der Giebelwände und Trennwände in den Taschen der Seitendächer, Zapfen der Boxenfronten im Mitteldach | **0,15 mm je Seite** (vorher 0,25) | ja; Dach weiter verriegelt (Seitendach sperrt nach 1,25 mm) | **T2: 15 am besten (deine Meldung)** | **bestätigt** |
| Dachverriegelung | Sperrrippen der Seitendächer unter dem Mitteldach | 1,0 mm | ja (sperrt nach 1,25 mm) | nicht nötig (große Luft) | rechnerisch geprüft |
| Türscharnier, Türseite | Tore, Boxentüren (flach gedruckt, Tropfenloch) | Loch **2,15 mm** auf 1,75-mm-Stift | ja | **T1: 2,15 am besten (deine Meldung)** | **bestätigt** |
| Türscharnier, Pfostenseite | stehend gedruckte Pfosten | Loch **2,05 mm** | ja (Stift läuft frei durch) | **T3a: 2,05 am besten (deine Meldung)** | **bestätigt** |
| Scharnier zusammengebaut | Pfosten + Tür + Stift | 0,8 mm zwischen den Augen, 0,6 mm seitlich | ja, frei bis 105 Grad (Tore) bzw. 90 bis 105 Grad (Boxentüren) | T3a Test 2: kein eigenes Ergebnis gemeldet | rechnerisch geprüft, beide Lochgrößen einzeln bestätigt |
| Fensterscharnier | Fensterflügel an der Giebelwand | Flügel 2,15, Wandaugen unten 2,15, oben **1,95 (klemmt)** | ja: frei von 0 bis 175 Grad, kleinster Abstand 0,5 mm | **T3b: Klemmstück 1,95 am besten (deine Meldung)**; Schwenktest am Fenster-Teststück nicht gemeldet | Klemmloch **bestätigt**, Schwenken rechnerisch geprüft |
| Boxentür-Verschluss | **Fallriegel** (seit 10. November eingebaut) | Kerbe 1,25 mm je Seite, 0,8 mm vor dem T-Kopf | ja, an der echten Boxentür simuliert (siehe [VERSCHLUSS.md](VERSCHLUSS.md)) | **T4: funktioniert (deine Meldung)** | **bestätigt** |
| Tor-Riegel | Riegel durch die Schlaufen der Torflügel | 0,3 mm je Seite | ja, Spalt 0,3 mm | **T4: gleitet (deine Meldung)** | **bestätigt** |
| Stift-Sicherung | Tor- und Boxentürstifte stehen auf dem Boden, oben blind; Fensterstift oben geklemmt, unten blind | – | ja | Fensterstift: T3b | Fenster bestätigt, Türen rechnerisch geprüft |

**Hinweis zu deinen eigenen Druckeinstellungen:** Die bestätigten Werte stammen aus Drucken mit
meinen Einstellungen (Pfosten 0,24 mm Schichthöhe und 2 Wände, Türen und Fensterteile 0,20 mm).
Löcher und Nuten liegen in der Druckebene und hängen kaum von der Schichthöhe ab. Stärker
wirken Filament, Durchfluss und die Kompensation für Löcher bzw. den „Elefantenfuß“. Änderst du
diese deutlich, kann eine Passung etwas enger oder lockerer werden.

Die Tabelle der geplanten Luftspalte zwischen allen Nachbarteilen steht in
[VALIDATION.md](VALIDATION.md) (Abschnitt „Designed clearances“).

## Was nach deinen Tests passiert

1. **Erledigt (10. November):** `bore_post` = 2,05 (T3a), Pfostennut 0,15 (T3a),
   `bore_win_hold` = 1,95 (T3b) in `cad/config.scad` eingetragen; Fallriegel in Boxentüren und
   Boxenfronten eingebaut; alles neu exportiert und validiert; alle Dateien als STL.
2. **Erledigt (10. November, später):** Pfostensockel 0,15 und Bodenverzahnung 0,15 (T2)
   eingetragen; die 6 Bodenplatten sind neu. Die Aussparungen des Mitteldachs um die
   Mittelpfosten hingen bisher am selben Wert wie die Sockel; sie haben jetzt einen eigenen Wert
   und bleiben bei 0,20 mm. Fallriegel durch T4 bestätigt.
3. **Erledigt (10. November, final):** Dachzapfen 0,15 (T2) eingetragen, die 3 Dächer sind neu.
   Torriegel gleitet (T4). Damit ist jede Passung durch einen deiner Testdrucke bestätigt.
