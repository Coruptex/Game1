# Bambu Studio: die fertigen Projektdateien

Stand 8. November 2026. Jede Druckplatte ist jetzt ein **fertiges Bambu-Studio-Projekt** (`.3mf`).
Gespeichert sind:

* Drucker **Bambu Lab A1 0.4 nozzle**, Druckplatte *Textured PEI Plate*;
* vier Filamente für das AMS lite: **1 Weiß, 2 Schwarz, 3 Hellgrau, 4 Dunkelgrau** (Bambu PLA
  Basic), und welches Teil mit welchem Filament gedruckt wird;
* das Prozess-Preset mit allen geänderten Werten (Wände, Füllung, Stützen, Brim, bei den Pfosten
  sanftere Geschwindigkeiten);
* Lage und Ausrichtung aller Teile auf der Platte;
* bei den weißen Wandplatten der **Filamentwechsel auf Schwarz ab 3,0 mm** für die erhabenen Leisten;
* beim Fensterflügel ein eigener 3-mm-Brim, nur für dieses Teil.

Du musst **nichts mehr einstellen**: Datei öffnen, slicen, drucken. Welche Datei wann dran ist,
steht in [DRUCKPLAN.md](DRUCKPLAN.md).

## Öffnen

1. **Datei > Projekt öffnen** (Strg+O) und die `.3mf`-Datei wählen. Doppelklick auf die Datei geht
   auch.
2. Ist schon ein Projekt offen, fragt Bambu Studio, ob du es speichern willst. Danach das neue Projekt
   **vollständig laden**, also mit Einstellungen, nicht „nur Geometrie“.

## Kurz prüfen (30 Sekunden, beim ersten Mal)

* Links oben: Drucker **Bambu Lab A1 0.4 nozzle**, Platte **Textured PEI Plate**.
* Filamentliste: 4 Einträge in Weiß, Schwarz, Hellgrau und Dunkelgrau. Druckst du ein anderes PLA als
  Bambu PLA Basic, wähle dort dein Filamentprofil (zum Beispiel *Generic PLA*). Die Farben bleiben.
* Prozess: der Name aus dem Druckplan, zum Beispiel *Stall 0.20mm Pfosten Stuetzen v2 @BBL A1*.
  Ein Sternchen oder ein Zusatz wie „(…3mf)“ hinter dem Namen ist in Ordnung: Bambu Studio zeigt so,
  dass die Werte aus dem Projekt kommen.

## Slicen und prüfen

1. **Druckplatte slicen**.
2. In der Vorschau:
   * **Pfosten-Platten:** grüne Baumstützen nur unter den Scharnieraugen, nicht in den Löchern.
   * **Wandplatten:** am Ebenen-Schieberegler ist bei 3,00 mm eine farbige Markierung zu sehen, der
     Filamentwechsel. Darüber sind die Leisten schwarz.
   * Der Brim liegt vollständig auf der Platte.
3. **Druckplatte drucken**. Im Dialog die AMS-Zuordnung prüfen: Projekt-Filament 1 auf deinen weißen
   Slot, 2 auf Schwarz und so weiter. Bambu Studio ordnet nach Farbe zu, du bestätigst nur.

## Die Presets (nicht mehr nötig, nur zur Information)

Die Projekte tragen ihre Einstellungen selbst. Die Preset-Dateien in `Presets/` brauchst du nur, wenn
du eigene Teile mit denselben Einstellungen drucken willst (**Datei > Importieren > Konfigurationen
importieren**). Neu ist **Stall 0.20mm Pfosten Stuetzen v2**: wie bisher, aber mit sanfteren
Geschwindigkeiten und Beschleunigungen für die hohen, schmalen Pfosten. Du musst am Drucker nicht
mehr auf „Leise“ stellen. Das alte Pfosten-Preset wird nicht mehr benutzt.

## Stützen an den Pfosten entfernen

* Unter jedem Scharnierauge steht eine kleine Baumstütze auf dem Auge darunter, in der Lücke, in die
  später das Türauge kommt. Mit der Spitzzange greifen und herausdrehen.
* Die Lücke muss frei sein. In die Löcher selbst setzt der Slicer keine Stützen. Das habe ich beim
  Probe-Slicen kontrolliert: keine Stützbahn innerhalb eines Lochs.

## Wie die Dateien entstanden sind und was ich nicht prüfen konnte

Die Projekte erzeuge ich mit meinen eigenen Werkzeugen (`tools/plates.py`, `tools/bambu3mf.py`)
genau im Dateiformat von Bambu Studio 2.x. Das Format habe ich aus dem veröffentlichten Quellcode
von Bambu Studio übernommen. **Bambu Studio selbst konnte ich in dieser Umgebung nicht starten.**
Geprüft habe ich:

* den Aufbau jeder Datei (alle Verweise, Kennungen und Einstellungen), maschinell;
* die Geometrie: aus jeder Datei zurückgelesen, identisch mit den Druckteilen, alles auf dem Bett;
* Stützen, Brim und Platzbedarf mit einem zweiten Slicer (PrusaSlicer, gleiche Einstellungen).
  Bambus Baumstützen sehen etwas anders aus, liegen aber an denselben Stellen.

Bitte schau beim ersten Projekt kurz nach, ob Drucker, Filamente und Prozess wie oben angezeigt
werden. Meldet Bambu Studio etwas wie „nur Geometrie geladen“ oder fehlen Einstellungen, schick mir
die Meldung oder einen Screenshot. Bis dahin geht es wie bisher: Preset aus `Presets/` importieren und
von Hand wählen.
