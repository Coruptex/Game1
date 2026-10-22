#!/bin/sh
# Render all preview views into docs/images (needs Blender, see README)
cd "$(dirname "$0")/.." || exit 1
SAMPLES=${1:-96}
for v in hero roof_off doors_open roof_lifted hinge_detail roof_detail; do
  blender -b -P tools/render_blender.py -- "$v" "docs/images/$v.png" "$SAMPLES" 2>&1 | grep -E "RENDERED|Error"
done
