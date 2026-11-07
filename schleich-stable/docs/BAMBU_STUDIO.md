# Drucken mit Bambu Studio (A1 mit AMS lite)

Erzeugt von `tools/report.py`. Die Zeiten sind Schätzungen aus PrusaSlicer mit A1-ähnlichen
Einstellungen; Bambu Studio zeigt nach dem Slicen seine eigenen Werte.

## Einmal einrichten

1. **Presets importieren:** Bambu Studio > Datei > Importieren > *Konfigurationen importieren*,
   dann alle vier Dateien aus `slicer/bambu_studio/` wählen. Sie erscheinen beim Prozess unter
   den Benutzer-Presets. Sie bauen auf den Bambu-Profilen „0.20mm Standard @BBL A1“ und
   „0.24mm Draft @BBL A1“ auf und ändern nur das, was dieser Stall braucht.
2. **AMS lite belegen:** Slot 1 Weiß, Slot 2 Schwarz, Slot 3 Hellgrau, Slot 4 Dunkelgrau.
3. Drucker *Bambu Lab A1 0.4 nozzle*, Platte *Textured PEI Plate*, Filament z. B. *Bambu PLA Basic*.

## Jede Platte

1. Die Datei aus `3mf/` öffnen. Fragt Bambu Studio, ob nur die Geometrie geladen werden soll: ja.
2. Prozess-Preset aus der Tabelle wählen.
3. Alle Teile markieren (Strg+A), Rechtsklick > *Filament ändern* > Slot aus der Tabelle.
4. Nur bei den Wandplatten: in der Vorschau den Ebenen-Schieberegler auf **3,00 mm** stellen,
   Rechtsklick > *Filament wechseln* > Slot 2 (Schwarz). Ab dort druckt der A1 die erhabenen
   Zierleisten schwarz, das AMS wechselt selbst.
5. Slicen, prüfen, drucken.

| Platte | Teile | Preset | AMS-Slot | Besonderheit | Zeit (ca.) |
|---|---|---|---|---|---|
| `P01_floor_LF` | floor_LF | Stall 0.24mm Boden | 3 Hellgrau |  | 2 h 55 min |
| `P02_floor_AF` | floor_AF | Stall 0.24mm Boden | 3 Hellgrau |  | 1 h 57 min |
| `P03_floor_RF` | floor_RF | Stall 0.24mm Boden | 3 Hellgrau |  | 2 h 56 min |
| `P04_floor_LB` | floor_LB | Stall 0.24mm Boden | 3 Hellgrau |  | 2 h 56 min |
| `P05_floor_AB` | floor_AB | Stall 0.24mm Boden | 3 Hellgrau |  | 1 h 57 min |
| `P06_floor_RB` | floor_RB | Stall 0.24mm Boden | 3 Hellgrau |  | 2 h 56 min |
| `P07_posts_short` | post_corner, post_sidemid | Stall 0.20mm Pfosten Stuetzen | 2 Schwarz | keine Stützen nötig (Brim 8 mm) | 5 h 07 min |
| `P08_posts_tall` | post_jamb_L, post_jamb_R, post_mid | Stall 0.20mm Pfosten Stuetzen | 2 Schwarz | Baumstützen unter den Scharnieraugen; am Drucker Geschwindigkeit **Leise** (Silent) | 12 h 58 min |
| `P09_walls_1` | partition | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 11 min |
| `P10_walls_2` | partition | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 11 min |
| `P11_walls_3` | gable_wing_A | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 00 min |
| `P12_walls_4` | gable_wing_A | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 00 min |
| `P13_walls_5` | gable_wing_B | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 00 min |
| `P14_walls_6` | gable_wing_B | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 2 h 00 min |
| `P15_walls_7` | stall_front | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 1 h 49 min |
| `P16_walls_8` | stall_front | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 1 h 49 min |
| `P17_walls_9` | pediment, side_wall | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 3 h 34 min |
| `P18_walls_10` | side_wall | Stall 0.20mm Standard | 1 Weiß | Filamentwechsel bei **3,0 mm** auf Slot 2 (Schwarz) | 1 h 51 min |
| `P19_doors_1` | stall_door, casement_B, bolt_bar | Stall 0.20mm Standard | 2 Schwarz |  | 3 h 08 min |
| `P20_doors_2` | casement_B, casement_A, main_leaf_A, main_leaf_B | Stall 0.20mm Standard | 2 Schwarz |  | 3 h 23 min |
| `P21_roof_central` | roof_central | Stall 0.20mm Mitteldach | 4 Dunkelgrau |  | 7 h 16 min |
| `P22_roof_side_1` | roof_side_A | Stall 0.20mm Standard | 4 Dunkelgrau |  | 6 h 08 min |
| `P23_roof_side_2` | roof_side_B | Stall 0.20mm Standard | 4 Dunkelgrau |  | 6 h 07 min |
| `T1_test_hinges_latches` | plate_T1 | Stall 0.20mm Pfosten Stuetzen | beliebig | Stützen unter den Scharnieraugen der Pfosten-Stücke | 3 h 20 min |
| `T2_test_fits` | plate_T2 | Stall 0.20mm Standard | beliebig |  | 1 h 26 min |

## Stützen an den Pfosten

* Unter jedem Scharnierauge eines hohen Pfostens entsteht eine kleine Baumstütze. Sie steht auf
  dem Auge darunter, genau in der Lücke, in die später das Auge der Tür kommt.
* **Entfernen:** mit einer Spitzzange greifen und herausdrehen, Reste mit einem Cutter glätten.
  Die Lücke muss sauber sein, sonst klemmt die Tür. Etwas Spiel (0,4 mm je Seite) ist eingeplant.
* Das Stiftloch bleibt frei. Falls doch ein Rest drin ist: mit dem Filamentstift oder einem
  1,8-mm-Bohrer von Hand durchstoßen.
* Ohne Stützen geht es auch: `knuckle_chamfer = true` in `cad/config.scad` setzen und neu
  exportieren, dann haben die Augen unten eine 45-Grad-Schräge.

## Falls der Import der Presets nicht klappt

Die Einstellungen von Hand, jeweils auf Basis des genannten Bambu-Profils:

| Preset | Basis | Änderungen |
|---|---|---|
| Stall 0.20mm Standard | 0.20mm Standard @BBL A1 | Wandlinien 3, untere Schichten 4, Stützen aus, Prime-Tower aus |
| Stall 0.20mm Pfosten Stuetzen | 0.20mm Standard @BBL A1 | Wandlinien 4, Füllung 25 %; Stützen an: Typ Baum (auto), Stil *Tree Slim*, Schwellwinkel 30°, *nur auf der Druckplatte* aus, *Brücken nicht stützen* an; Brim außen 8 mm |
| Stall 0.20mm Mitteldach | 0.20mm Standard @BBL A1 | Wandlinien 3, Stützen aus, Brim außen 5 mm |
| Stall 0.24mm Boden | 0.24mm Draft @BBL A1 | Wandlinien 3, untere Schichten 4, Stützen aus, kein Brim |

