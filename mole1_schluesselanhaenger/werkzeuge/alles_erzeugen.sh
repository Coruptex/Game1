#!/usr/bin/env bash
# Erzeugt alle Ergebnisse neu: 3D-Modell, Geometrieprüfung,
# Slicer-Prüfung, Maßzeichnung und Vorschaubilder.
# Voraussetzungen: Python 3.13 mit den Paketen bpy (5.2.x), trimesh, manifold3d, shapely,
# rtree, scipy, matplotlib; für die Slicer-Prüfung zusätzlich PrusaSlicer (CLI).
set -euo pipefail
PY=${PY:-python3}
BASIS="$(cd "$(dirname "$0")/.." && pwd)"
"$PY" "$BASIS/blender/mole1_anhaenger.py" --out "$BASIS/export"
"$PY" "$BASIS/werkzeuge/pruefung_geometrie.py" --export "$BASIS/export" --out "$BASIS/pruefung"
if command -v prusa-slicer >/dev/null; then
  STL_A=$("$PY" -c 'import json,sys; print(json.load(open(sys.argv[1]))["dateien"]["stl_A"])' \
          "$BASIS/export/modell_parameter.json")
  "$PY" "$BASIS/werkzeuge/slicer_pruefung.py" --stl "$BASIS/export/$STL_A" \
        --out "$BASIS/pruefung/slicer" --modell "$BASIS/export/modell_parameter.json"
fi
"$PY" "$BASIS/werkzeuge/masszeichnung.py" --export "$BASIS/export" --bilder "$BASIS/bilder"
"$PY" "$BASIS/werkzeuge/render_vorschau.py" --export "$BASIS/export" --bilder "$BASIS/bilder"
