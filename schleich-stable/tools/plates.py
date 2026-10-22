#!/usr/bin/env python3
"""Arrange the printable parts into Bambu Lab A1 print plates (one colour per
plate), check that every plate fits and nothing overlaps, export one 3MF per
plate (3mf/) and slice each plate with PrusaSlicer for time / filament
estimates (build/plates.json).  Usage: python3 tools/plates.py [--no-slice]
"""
import argparse, concurrent.futures as cf, json, os, sys
import numpy as np
import trimesh

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
from slice import slice_one  # noqa: E402

LO, HI = 6.0, 250.0          # usable bed area (mm) incl. brim margin

# plate id, colour, brim mm, note, [(part, x_min, y_min, rot_deg)]
PLATES = [
    ("P01_floor_LF", "grey", 0, "", [("floor_LF", 24, 34, 0)]),
    ("P02_floor_AF", "grey", 0, "", [("floor_AF", 34, 34, 0)]),
    ("P03_floor_RF", "grey", 0, "", [("floor_RF", 24, 34, 0)]),
    ("P04_floor_LB", "grey", 0, "", [("floor_LB", 24, 34, 0)]),
    ("P05_floor_AB", "grey", 0, "", [("floor_AB", 34, 34, 0)]),
    ("P06_floor_RB", "grey", 0, "", [("floor_RB", 24, 34, 0)]),
    ("P07_posts_short", "black", 5, "upright", [("post_corner", 80, 90, 0), ("post_corner", 120, 90, 0), ("post_corner", 160, 90, 0),
                                               ("post_corner", 80, 130, 0), ("post_sidemid", 120, 130, 0), ("post_sidemid", 160, 130, 0)]),
    ("P08_posts_tall", "black", 5, "upright, 240 mm", [("post_jamb_L", 65, 85, 0), ("post_jamb_L", 112, 85, 0), ("post_jamb_R", 159, 85, 0),
                                                       ("post_jamb_R", 65, 135, 0), ("post_mid", 116, 140, 0), ("post_mid", 163, 140, 0)]),
    ("P09_side_walls", "white", 0, "trim", [("side_wall", 47, 8, 0), ("side_wall", 47, 130, 0)]),
    ("P10_side_walls", "white", 0, "trim", [("side_wall", 47, 8, 0), ("side_wall", 47, 130, 0)]),
    ("P11_gable_wing_A", "white", 0, "trim", [("gable_wing_A", 37, 36, 0)]),
    ("P12_gable_wing_A", "white", 0, "trim", [("gable_wing_A", 37, 36, 0)]),
    ("P13_gable_wing_B", "white", 0, "trim", [("gable_wing_B", 37, 36, 0)]),
    ("P14_gable_wing_B", "white", 0, "trim", [("gable_wing_B", 37, 36, 0)]),
    ("P15_partition", "white", 0, "trim", [("partition", 37, 26, 0)]),
    ("P16_partition", "white", 0, "trim", [("partition", 37, 26, 0)]),
    ("P17_stall_front_A", "white", 0, "trim", [("stall_front_A", 47, 12, 0)]),
    ("P18_stall_front_A", "white", 0, "trim", [("stall_front_A", 47, 12, 0)]),
    ("P19_stall_front_B", "white", 0, "trim", [("stall_front_B", 47, 12, 0)]),
    ("P20_stall_front_B", "white", 0, "trim", [("stall_front_B", 47, 12, 0)]),
    ("P21_pediment", "white", 0, "trim", [("pediment", 47, 48, 0)]),
    ("P22_pediment", "white", 0, "trim", [("pediment", 47, 48, 0)]),
    ("P23_doors_1", "black", 0, "", [("main_leaf_A", 8, 30, 0), ("main_leaf_B", 90, 30, 0),
                                     ("stall_door_A", 172, 8, 0), ("casement_A", 180, 150, 0)]),
    ("P24_doors_2", "black", 0, "", [("main_leaf_A", 8, 30, 0), ("main_leaf_B", 90, 30, 0),
                                     ("stall_door_B", 172, 8, 0), ("casement_B", 180, 150, 0)]),
    ("P25_doors_3", "black", 0, "", [("stall_door_A", 10, 10, 0), ("stall_door_B", 94, 10, 0),
                                     ("casement_A", 10, 150, 0), ("casement_B", 80, 150, 0),
                                     ("bolt_bar", 150, 160, 0), ("bolt_bar", 150, 185, 0)]),
    ("P26_roof_central", "roof", 5, "", [("roof_central", 20, 37, 0)]),
    ("P27_roof_central", "roof", 5, "", [("roof_central", 20, 37, 0)]),
    ("P28_roof_side_A", "roof", 0, "", [("roof_side_A", 24, 37, 0)]),
    ("P29_roof_side_A", "roof", 0, "", [("roof_side_A", 24, 37, 0)]),
    ("P30_roof_side_B", "roof", 0, "", [("roof_side_B", 24, 37, 0)]),
    ("P31_roof_side_B", "roof", 0, "", [("roof_side_B", 24, 37, 0)]),
]
TEST_PLATES = [("T1_test_hinges_latches", "any", 3, "", [("tests/plate_T1", None, None, 0)]),
               ("T2_test_fits", "any", 3, "", [("tests/plate_T2", None, None, 0)])]


def place(part, x, y, rot):
    m = trimesh.load(os.path.join(ROOT, "stl", part + ".stl"), force="mesh")
    if rot:
        m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(rot), [0, 0, 1]))
    b = m.bounds
    if x is None:      # test plates are already arranged
        return m
    m.apply_translation([x - b[0][0], y - b[0][1], -b[0][2]])
    return m


def build_plate(pid, parts):
    meshes = [(p, place(p, x, y, r)) for p, x, y, r in parts]
    issues = []
    for p, m in meshes:
        b = m.bounds
        if b[0][0] < LO - 1e-6 or b[0][1] < LO - 1e-6 or b[1][0] > HI + 1e-6 or b[1][1] > HI + 1e-6 or b[1][2] > 256:
            issues.append(f"{p} outside bed: {np.round(b, 1).tolist()}")
    for i in range(len(meshes)):
        for j in range(i + 1, len(meshes)):
            bi, bj = meshes[i][1].bounds, meshes[j][1].bounds
            gap = max(bj[0][0] - bi[1][0], bi[0][0] - bj[1][0], bj[0][1] - bi[1][1], bi[0][1] - bj[1][1])
            if gap < 4:
                issues.append(f"{meshes[i][0]} and {meshes[j][0]} closer than 4 mm ({gap:.1f})")
    return meshes, issues


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-slice", action="store_true")
    a = ap.parse_args()
    os.makedirs(os.path.join(ROOT, "3mf"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "build", "plates"), exist_ok=True)
    out, jobs = {}, []
    for pid, colour, brim, note, parts in PLATES + TEST_PLATES:
        meshes, issues = build_plate(pid, parts)
        scene = trimesh.Scene()
        for k, (p, m) in enumerate(meshes):
            scene.add_geometry(m, node_name=f"{os.path.basename(p)}_{k + 1}", geom_name=f"{os.path.basename(p)}_{k + 1}")
        scene.export(os.path.join(ROOT, "3mf", pid + ".3mf"))
        merged = trimesh.util.concatenate([m for _, m in meshes])
        stl = os.path.join(ROOT, "build", "plates", pid + ".stl")
        merged.export(stl)
        out[pid] = {"colour": colour, "brim": brim, "note": note,
                    "parts": [os.path.basename(p) for p, *_ in parts], "issues": issues}
        jobs.append((pid, stl, brim))
        print(pid, "OK" if not issues else issues, flush=True)
    if not a.no_slice:
        import slice as sl
        for pid, _, brim in jobs:
            sl.BRIM[pid] = brim
        with cf.ProcessPoolExecutor(4) as ex:
            for pid, r in ex.map(slice_one, [(p, s) for p, s, _ in jobs]):
                out[pid].update(r)
                print(pid, r, flush=True)
    json.dump(out, open(os.path.join(ROOT, "build", "plates.json"), "w"), indent=1)
    main_plates = [v for k, v in out.items() if k.startswith("P")]
    if not a.no_slice:
        t = sum(v.get("time_s", 0) for v in main_plates) / 3600
        g = sum(v.get("filament_g", 0) for v in main_plates)
        print(f"TOTAL {len(main_plates)} plates: {t:.1f} h, {g:.0f} g")


if __name__ == "__main__":
    main()
