#!/usr/bin/env bash
# Erzeugt alle Ergebnisse neu: 3D-Modell (Gussvorlage und A1-Prototyp), Geometrieprüfung,
# Slicer-Prüfung, Maßzeichnung und Vorschaubilder.
# Voraussetzungen: Python 3.13 mit den Paketen bpy (5.2.x), trimesh, embreex, manifold3d, shapely,
# rtree, scipy, matplotlib, pillow; für die Slicer-Prüfung zusätzlich PrusaSlicer (CLI).
# Optional: FOTO4=<pfad/zu/foto4.jpg> erzeugt zusätzlich den Konturvergleich mit Referenzfoto F4
# (die Fotos gehören nicht zum Projekt).
set -euo pipefail
PY=${PY:-python3}
BASIS="$(cd "$(dirname "$0")/.." && pwd)"
"$PY" "$BASIS/blender/mole1_anhaenger.py" --out "$BASIS/export"
"$PY" "$BASIS/werkzeuge/pruefung_geometrie.py" --export "$BASIS/export" --out "$BASIS/pruefung"
if command -v prusa-slicer >/dev/null; then
  STL=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["dateien"]["stl"])' \
        "$BASIS/export/modell_parameter.json")
  "$PY" "$BASIS/werkzeuge/slicer_pruefung.py" --stl "$BASIS/export/$STL" \
        --out "$BASIS/pruefung/slicer" --modell "$BASIS/export/modell_parameter.json"
fi
"$PY" "$BASIS/werkzeuge/masszeichnung.py" --export "$BASIS/export" --bilder "$BASIS/bilder"
"$PY" "$BASIS/werkzeuge/render_vorschau.py" --export "$BASIS/export" --bilder "$BASIS/bilder"

# Prototyp für den FDM-Probedruck (Bambu Lab A1, 0,2-mm-Düse): verstärkte Feinteile
"$PY" "$BASIS/blender/mole1_anhaenger.py" --out "$BASIS/export" --prototyp
"$PY" "$BASIS/werkzeuge/pruefung_geometrie.py" --export "$BASIS/export" --out "$BASIS/pruefung/prototyp_a1" \
      --parameter modell_parameter_prototyp_a1.json
if command -v prusa-slicer >/dev/null; then
  STL_P=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["dateien"]["stl"])' \
          "$BASIS/export/modell_parameter_prototyp_a1.json")
  "$PY" "$BASIS/werkzeuge/slicer_pruefung.py" --stl "$BASIS/export/$STL_P" \
        --out "$BASIS/pruefung/prototyp_a1/slicer" --modell "$BASIS/export/modell_parameter_prototyp_a1.json"
fi
"$PY" "$BASIS/werkzeuge/render_vorschau.py" --export "$BASIS/export" --bilder "$BASIS/bilder" --prototyp
if [ -n "${FOTO4:-}" ]; then
  "$PY" "$BASIS/werkzeuge/fotovergleich.py" --export "$BASIS/export" --foto "$FOTO4" \
        --out "${VERGLEICH:-$BASIS/vergleich_privat}" --render "$BASIS/bilder/Farbmodell_Kamera_wie_Foto4.png"
fi
