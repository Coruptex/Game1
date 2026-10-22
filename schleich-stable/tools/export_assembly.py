#!/usr/bin/env python3
"""Export the assembled stable as one file for viewing (not for printing):
  docs/assembly_preview.glb  coloured, opens in any glTF viewer
  3mf/assembly_preview.3mf   all 54 parts at their assembled positions
Needs build/placed/ (tools/build.py --placed) and build/render/ (tools/render_export.py)."""
import glob, os
import numpy as np
import trimesh

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PL, RD = os.path.join(ROOT, "build", "placed"), os.path.join(ROOT, "build", "render")
RGB = {"white": (236, 234, 226), "black": (32, 32, 36), "grey": (150, 146, 138), "roof": (58, 61, 68)}
PANELS = ("side_wall", "gable_wing", "partition", "stall_front", "pediment")


def coloured(path, c):
    m = trimesh.load(path, force="mesh")
    m.visual.face_colors = np.tile(np.array([*RGB[c], 255], np.uint8), (len(m.faces), 1))
    return m


scene, plain = trimesh.Scene(), trimesh.Scene()
for f in sorted(glob.glob(os.path.join(PL, "*.stl"))):
    n = os.path.basename(f)[:-4]
    if n.startswith("pin_"):
        continue
    plain.add_geometry(trimesh.load(f, force="mesh"), node_name=n, geom_name=n)
    if n.startswith(PANELS):
        scene.add_geometry(coloured(os.path.join(RD, n + "__base.stl"), "white"), node_name=n + "_base", geom_name=n + "_base")
        scene.add_geometry(coloured(os.path.join(RD, n + "__trim.stl"), "black"), node_name=n + "_trim", geom_name=n + "_trim")
    else:
        c = "grey" if n.startswith("floor_") else "roof" if n.startswith("roof_") else "black"
        scene.add_geometry(coloured(f, c), node_name=n, geom_name=n)
# glTF is Y-up: rotate Z-up model, metres
scene.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
scene.apply_scale(0.001)
scene.export(os.path.join(ROOT, "docs", "assembly_preview.glb"))
plain.export(os.path.join(ROOT, "3mf", "assembly_preview.3mf"))
for p in ("docs/assembly_preview.glb", "3mf/assembly_preview.3mf"):
    print(p, round(os.path.getsize(os.path.join(ROOT, p)) / 1e6, 1), "MB")
