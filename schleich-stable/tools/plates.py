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
GAP = 6.0                    # between parts on a plate (flat parts)

# Print groups. One colour per plate; parts of a group are packed onto as
# few plates as possible. (prefix, colour, brim mm, note, gap, [(part, qty)])
GROUPS = [
    ("floor_LF", "grey", 0, "", GAP, [("floor_LF", 1)]),
    ("floor_AF", "grey", 0, "", GAP, [("floor_AF", 1)]),
    ("floor_RF", "grey", 0, "", GAP, [("floor_RF", 1)]),
    ("floor_LB", "grey", 0, "", GAP, [("floor_LB", 1)]),
    ("floor_AB", "grey", 0, "", GAP, [("floor_AB", 1)]),
    ("floor_RB", "grey", 0, "", GAP, [("floor_RB", 1)]),
    # upright posts: wide spacing for brims and cooling
    ("posts_short", "black", 5, "upright", 26, [("post_corner", 4), ("post_sidemid", 2)]),
    ("posts_tall", "black", 5, "upright", 26, [("post_jamb_L", 2), ("post_jamb_R", 2), ("post_mid", 2)]),
    ("walls", "white", 0, "trim", GAP, [("stall_front", 4), ("partition", 2), ("gable_wing_A", 2), ("gable_wing_B", 2),
                                          ("pediment", 2), ("side_wall", 4)]),
    ("doors", "black", 0, "", GAP, [("main_leaf_A", 2), ("main_leaf_B", 2), ("stall_door", 4),
                                     ("casement_A", 2), ("casement_B", 2), ("bolt_bar", 2)]),
    ("roof_central", "roof", 5, "", GAP, [("roof_central", 2)]),
    ("roof_side", "roof", 0, "", GAP, [("roof_side_A", 2), ("roof_side_B", 2)]),
]
TEST_PLATES = [("T1_test_hinges_latches", "any", 3, "", [("tests/plate_T1", None, None, 0)]),
               ("T2_test_fits", "any", 3, "", [("tests/plate_T2", None, None, 0)])]


def footprint(part):
    m = trimesh.load(os.path.join(ROOT, "stl", part + ".stl"), force="mesh")
    return m.extents[0], m.extents[1]


ORDERS = [lambda t: -t[1] * t[2],                  # area
          lambda t: (-max(t[1], t[2]), -min(t[1], t[2])),
          lambda t: (-min(t[1], t[2]), -max(t[1], t[2])),
          lambda t: (-t[2], -t[1]), lambda t: (-t[1], -t[2])]


def pack(items, gap):
    """Shelf packing, several orderings tried; the fewest plates wins (ties:
    the fullest first plates, i.e. the emptiest last plate)."""
    best = None
    for key in ORDERS:
        for flat in (True, False):
            r = pack_once(sorted(items, key=key), gap, flat)
            score = (len(r), len(r[-1]))
            if best is None or score < best[0]:
                best = (score, r)
    return best[1]


def pack_once(items, gap, flat=True):
    """Shelf packing: items [(part, w, h)] in the given order -> plates
    [[(part, x, y, rot)]]; each part may be turned 90 deg to fit a shelf.
    flat: a new shelf lays the part on its long side (low shelves);
    otherwise parts keep their own orientation when they fit."""
    W = HI - LO
    def shelf_orients(w, h):
        o = [(w, h, 0), (h, w, 90)]
        return sorted(o, key=lambda t: t[1]) if flat else o
    plates = []                       # each: {"shelves": [[y, h, x_used]], "y_used": float, "parts": []}
    for part, w, h in items:
        placed = False
        for pl in plates:
            for sh in pl["shelves"]:
                for (pw, ph, rot) in ((w, h, 0), (h, w, 90)):
                    if ph <= sh[1] + 1e-6 and sh[2] + pw <= W + 1e-6:
                        pl["parts"].append((part, LO + sh[2], LO + sh[0], rot))
                        sh[2] += pw + gap
                        placed = True
                        break
                if placed:
                    break
            if not placed:
                for (pw, ph, rot) in shelf_orients(w, h):
                    if pw <= W and pl["y_used"] + ph <= W + 1e-6:
                        pl["shelves"].append([pl["y_used"], ph, pw + gap])
                        pl["parts"].append((part, LO, LO + pl["y_used"], rot))
                        pl["y_used"] += ph + gap
                        placed = True
                        break
            if placed:
                break
        if not placed:
            pw, ph, rot = min(((w, h, 0), (h, w, 90)), key=lambda t: t[1] if t[0] <= W else 1e9)
            if pw > W or ph > W:
                raise SystemExit(f"{part} does not fit the bed ({w:.0f} x {h:.0f} mm)")
            plates.append({"shelves": [[0.0, ph, pw + gap]], "y_used": ph + gap, "parts": [(part, LO, LO, rot)]})
    # centre each plate's content on the bed
    out = []
    for pl in plates:
        out.append(pl["parts"])
    return out


def plan():
    """[(plate id, colour, brim, note, [(part, x, y, rot)])], numbered P01..."""
    res, k = [], 1
    for prefix, colour, brim, note, gap, parts in GROUPS:
        items = []
        for part, q in parts:
            w, h = footprint(part)
            items += [(part, w, h)] * q
        plates = pack(items, gap)
        for i, pl in enumerate(plates):
            suffix = f"_{i + 1}" if len(plates) > 1 else ""
            res.append((f"P{k:02d}_{prefix}{suffix}", colour, brim, note, pl))
            k += 1
    return res


def place(part, x, y, rot):
    m = trimesh.load(os.path.join(ROOT, "stl", part + ".stl"), force="mesh")
    if rot:
        m.apply_transform(trimesh.transformations.rotation_matrix(np.radians(rot), [0, 0, 1]))
    b = m.bounds
    if x is None:      # test plates are already arranged
        return m
    m.apply_translation([x - b[0][0], y - b[0][1], -b[0][2]])
    return m


def centre(meshes):
    """shift a whole plate so its content is centred on the bed"""
    lo = np.min([m.bounds[0] for _, m in meshes], axis=0)
    hi = np.max([m.bounds[1] for _, m in meshes], axis=0)
    d = [(LO + HI) / 2 - (lo[0] + hi[0]) / 2, (LO + HI) / 2 - (lo[1] + hi[1]) / 2, 0]
    for _, m in meshes:
        m.apply_translation(d)


def build_plate(pid, parts):
    meshes = [(p, place(p, x, y, r)) for p, x, y, r in parts]
    if parts[0][1] is not None:
        centre(meshes)
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
    # plates from an earlier layout must not linger (the plate count can change)
    import glob
    for f in glob.glob(os.path.join(ROOT, "3mf", "[PT][0-9]*.3mf")) + glob.glob(os.path.join(ROOT, "build", "plates", "*.stl")):
        os.remove(f)
    out, jobs = {}, []
    for pid, colour, brim, note, parts in plan() + TEST_PLATES:
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
