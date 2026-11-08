# Alle Verbindungen: rechnerisch geprüft oder durch Testdruck bestätigt?

Stand 8. November 2026, nach der Überarbeitung. Es gibt drei Stufen:

* **rechnerisch geprüft:** Die exportierten Druckteile wurden im Rechner zusammengesetzt
  (`tools/validate.py`, Bericht in [VALIDATION.md](VALIDATION.md)). Geprüft ist, dass sich
  nichts überschneidet, dass alles frei beweglich ist und dass die geplanten Luftspalte
  vorhanden sind. Wie der Drucker diese Spalte tatsächlich ausdruckt, zeigt die Rechnung
  nicht.
* **durch Testdruck bestätigt:** Du hast es gedruckt und mir das Ergebnis gemeldet.
* **Test offen:** Ein Teststück existiert, dein Ergebnis fehlt noch.

## Gesamtprüfung Größe und Zusammenbau

* Alle 51 Bauteile (dazu 2 Ersatzriegel) wurden neu aus dem Modell exportiert. Einheit
  Millimeter, kein Skalierungsfehler. Alle Teile passen auf das A1-Druckbett (Prüfung mit
  Brim und Stützen beim Slicen: siehe [DRUCKPLAN.md](DRUCKPLAN.md)).
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
| Bodenverzahnung | 6 Bodenplatten, Zungen 14 mm breit | 0,25 mm je Seite, 0,4 mm nach oben | ja, Spalt 0,25 mm; Platten schieben sich waagerecht zusammen | T2 (Bodenverzahnung) | **Test offen** |
| Pfostensockel | 12 Pfosten in den Bodenplatten | 0,20 mm je Seite | ja | T2 (Sockelplatte + Nutenpfosten aus T3a) | **Test offen** |
| Wandnuten | Wände, Giebelwände, Trennwände, Boxenfronten, Giebelfelder in den Pfostennuten und in der Sockel- bzw. Bodennut | 0,20 mm je Seite, 0,5 mm Luft am Nutgrund | ja, Spalt 0,2 mm; jede Wand lässt sich senkrecht herausziehen | T3b (Wandstreifen) + T3a (Nutenpfosten) | **Test offen** |
| Dachzapfen | Zapfen der Giebelwände und Trennwände in den Taschen der Seitendächer, Zapfen der Boxenfronten im Mitteldach | 0,25 mm je Seite | ja | T3b (Zapfenplatte) | **Test offen** |
| Dachverriegelung | Sperrrippen der Seitendächer unter dem Mitteldach | 1,0 mm | ja (sperrt nach 1,25 mm) | nicht nötig (große Luft) | rechnerisch geprüft |
| Türscharnier, Türseite | Tore, Boxentüren (flach gedruckt, Tropfenloch) | Loch **2,15 mm** auf 1,75-mm-Stift | ja | **T1: 2,15 am besten (deine Meldung)** | **bestätigt** (Teststück allein) |
| Türscharnier, Pfostenseite | stehend gedruckte Pfosten mit Baumstützen | Loch noch offen | ja (Stift läuft frei durch) | T1: 1,75 / 1,85 / 1,95 alle zu eng (deine Meldung). T3a: 2,05 bis 2,45 | **Test offen**, Pfosten gesperrt |
| Scharnier zusammengebaut | Pfosten + Tür + Stift | 0,8 mm zwischen den Augen, 0,6 mm seitlich | ja, frei bis 105 Grad (Tore) bzw. 150 Grad | T3a Test 2 (mit Flügel aus T3b oder T1) | **Test offen** |
| Fensterscharnier (neu) | Fensterflügel an der Giebelwand | Flügel 2,15 (von den Türen übernommen), Wandaugen unten 2,15, oben 1,95 (klemmt) | ja: frei von 0 bis 175 Grad, kleinster Abstand 0,5 mm, zum schwarzen Rahmen mindestens 0,6 mm | T3b (Fenster-Teststück, Fensterstift-Klemmtest) | **Test offen**, Giebelwände und Flügel gesperrt |
| Boxentür-Verschluss | bisher Klickverschluss, neu Fallriegel | Fallriegel: Kerbe 1,25 mm je Seite, 0,8 mm vor dem T-Kopf | ja, Fallriegel im Prüfstand simuliert (siehe [VERSCHLUSS.md](VERSCHLUSS.md)) | T4 | **Test offen**, Boxentüren und Boxenfronten gesperrt |
| Tor-Riegel | Riegel durch die Schlaufen der Torflügel | 0,3 mm je Seite | ja, Spalt 0,3 mm | T4 (Riegelplatte) | **Test offen**, Tore gesperrt |
| Stift-Sicherung | Tor- und Boxentürstifte stehen auf dem Boden, oben blind; Fensterstift oben geklemmt, unten blind | – | ja | mit T3a / T3b | **Test offen** |

Die Tabelle der geplanten Luftspalte zwischen allen Nachbarteilen steht in
[VALIDATION.md](VALIDATION.md) (Abschnitt „Designed clearances“).

## Was nach deinen Tests passiert

1. Deine Ergebnisse trage ich in `cad/config.scad` ein: `bore_post` aus T3a, `bore_win_hold`
   aus T3b, die Passungen aus T2 und T3b, falls nötig.
2. Bei einem guten T4 baue ich den Fallriegel in Boxentüren und Boxenfronten ein und entferne
   den Klickverschluss.
3. Alles wird neu exportiert und validiert. Dann erzeuge ich die gesperrten Produktionsplatten
   als fertige Bambu-Studio-Projekte (Pfosten mit Scharnieren, Giebelwände, Fensterflügel,
   Boxenfronten, Türen).
