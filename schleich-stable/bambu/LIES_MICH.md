# Stall: Druckdateien (Stand 8. November 2026)

Jede `.3mf`-Datei ist ein fertiges **Bambu-Studio-Projekt** für den A1 mit AMS lite. Drucker,
Filamente, Einstellungen, Ausrichtung, Brim, Stützen und Filamentwechsel sind gespeichert.
Öffnen (**Datei > Projekt öffnen**), **Druckplatte slicen**, **drucken**. Mehr dazu in
`Anleitungen/BAMBU_STUDIO.md`.

**AMS lite:** Slot 1 Weiß, Slot 2 Schwarz, Slot 3 Hellgrau, Slot 4 Dunkelgrau.

## Ordner

| Ordner | Inhalt |
|---|---|
| `1_TEST/` | **neue Testdateien, zuerst drucken:** T3a, T3b, T4, T2 (alle vier nötig) |
| `2_PRODUKTION/` | **endgültige Produktionsdateien**, die schon freigegeben sind: Boden, Eck- und Seitenpfosten, Wände, Dach |
| `Presets/` | die Prozess-Presets als Datei (nicht nötig, die Projekte enthalten sie) |
| `Anleitungen/` | Änderungsliste, Testanleitung, Verschluss-Vergleich, Verbindungen, Druckplan, Analyse |

## Reihenfolge

1. `1_TEST/TEST_T3a_Pfosten_Scharnier.3mf`
2. `1_TEST/TEST_T3b_Tuer_Fenster.3mf`
3. `1_TEST/TEST_T4_Verschluss.3mf`
4. `1_TEST/TEST_T2_Boden_Passungen.3mf`, auch wenn du T2 früher schon gedruckt hast (Boden und Dach jetzt 0,28 mm)
5. Testen nach `Anleitungen/TESTANLEITUNG.md` und mir die Ergebnisse melden
6. `2_PRODUKTION/PROD_P01` bis `PROD_P14`, sobald die Passungstests (Sockel, Verzahnung, Wandnut,
   Dachzapfen) zu den Modellwerten passen.
7. Die übrigen Platten (Pfosten mit Scharnieren, Giebelwände, Fensterflügel, Boxenfronten,
   Türen) erzeuge ich nach deinen T3- und T4-Ergebnissen als fertige Projekte. Übersicht und
   Status: `Anleitungen/DRUCKPLAN.md`.

Farbe: Die Tests darfst du in einer Farbe drucken, die du selten brauchst, solange es dieselbe
Filamentsorte ist (Bambu PLA Basic). Details in `Anleitungen/TESTANLEITUNG.md`, Abschnitt „Welche Farbe?“.

## Was ich von dir brauche

* **T3a:** für jedes Pfostenstück A (zu eng), B (ideal) oder C (locker), und wie sich das
  zusammengebaute Scharnier anfühlt, beste Wandnut
* **T3b:** Fenster (Rahmen geschlossen? schwenkt frei? Stift hält?), bestes Fensterstift-Stück
* **T4:** Einrasten, Kraft beim Anheben, Halt, Zustand nach 100-mal, Tor-Riegel
* **T2:** bester Sockel, beste Verzahnung, beste Dachzapfen-Tasche
* beim ersten Öffnen: Zeigt Bambu Studio Drucker, Filamente und Prozess wie beschrieben an?

Bambu Studio selbst konnte ich beim Erstellen nicht starten. Die Dateien sind maschinell geprüft
und mit einem zweiten Slicer probegesliced. Sieh bitte beim ersten Projekt kurz nach (siehe
`Anleitungen/BAMBU_STUDIO.md`).
