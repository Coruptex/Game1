#!/usr/bin/env python3
"""Print plates for the Bambu Lab A1 (with AMS lite) -> Bambu Studio projects.

  python3 tools/plates.py [--no-slice]

* Arranges the printable parts onto plates (one preset and one filament per
  plate), checks that every plate fits and nothing overlaps.
* Writes one Bambu Studio project per plate (tools/bambu3mf.py) to bambu/:
    bambu/TEST/        test plates (print these first)
    bambu/PRODUKTION/  production plates that are released now
  Plates whose parts still wait for a test result (T3, T4) are planned and
  listed, but no project is written for them yet.
* Slices every plate with PrusaSlicer (A1-like profile, the same layer
  height, walls, infill, brim and support settings) for time / filament
  estimates, the footprint including brim and supports, support statistics
  and support inside hinge bores -> build/plates.json.
"""
import argparse, concurrent.futures as cf, glob, json, os, shutil, sys
import numpy as np
import trimesh

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
from slice import slice_one  # noqa: E402
import bambu3mf as b3  # noqa: E402

LO, HI = 6.0, 250.0          # usable bed area (mm) incl. brim margin
GAP = 6.0                    # between parts on a plate (flat parts)
EXT = {"white": 1, "black": 2, "grey": 3, "roof": 4}
def trim_z(layer, first=0.2, face=2.8):
    """print_z of the first layer above the panel face (wall_t = 2.8 mm):
    from this layer on the trims print black (filament change)"""
    z = first
    while z < face + 0.05:
        z = round(z + layer, 3)
    return z

# (id, title, colour, process, gap, [(part, qty)], release, note)
# release: "frei" = project written now; "T3" / "T4" = waits for that test
GROUPS = [
    ("Boden_LF", "Bodenplatte links vorne", "grey", "floor", GAP, [("floor_LF", 1)], "frei", ""),
    ("Boden_AF", "Bodenplatte Gang vorne", "grey", "floor", GAP, [("floor_AF", 1)], "frei", ""),
    ("Boden_RF", "Bodenplatte rechts vorne", "grey", "floor", GAP, [("floor_RF", 1)], "frei", ""),
    ("Boden_LB", "Bodenplatte links hinten", "grey", "floor", GAP, [("floor_LB", 1)], "frei", ""),
    ("Boden_AB", "Bodenplatte Gang hinten", "grey", "floor", GAP, [("floor_AB", 1)], "frei", ""),
    ("Boden_RB", "Bodenplatte rechts hinten", "grey", "floor", GAP, [("floor_RB", 1)], "frei", ""),
    # upright posts: wide spacing so a post that comes loose on the moving
    # bed (A1 = bed slinger) cannot knock over its neighbours
    ("Pfosten_kurz", "Eck- und Seitenpfosten (ohne Scharniere)", "black", "posts", 34,
     [("post_corner", 4), ("post_sidemid", 2)], "frei", ""),
    ("Waende", "Seitenwände, Trennwände, Giebelfelder", "white", "walls", GAP,
     [("side_wall", 4), ("partition", 2), ("pediment", 2)], "frei", "trim"),
    ("Mitteldach", "Mitteldach", "roof", "central_roof", GAP, [("roof_central", 1)], "frei", ""),
    ("Seitendaecher", "Seitendächer", "roof", "roof", GAP, [("roof_side_A", 1), ("roof_side_B", 1)], "frei", ""),
    ("Pfosten_Scharnier", "Pfosten mit Scharnieraugen", "black", "posts", 60,
     [("post_jamb_L", 2), ("post_jamb_R", 2), ("post_mid", 2)], "T3", "supports"),
    ("Giebelwaende", "Giebelwände mit Fenster", "white", "standard", GAP, [("gable_wing_A", 2), ("gable_wing_B", 2)], "T3", "trim"),
    ("Fensterfluegel", "Fensterflügel", "black", "standard", GAP, [("casement_A", 2), ("casement_B", 2)], "T3", ""),
    ("Boxenfronten", "Boxenfronten", "white", "standard", GAP, [("stall_front", 4)], "T4", "trim"),
    ("Tueren", "Tore, Boxentüren, Riegel", "black", "standard", GAP,
     [("main_leaf_A", 2), ("main_leaf_B", 2), ("stall_door", 4), ("bolt_bar", 4)], "T4", ""),
]

# test plates: parts from stl/tests/ (tools/build.py TEST_PARTS) or stl/
TESTS = [
    ("T2_Boden_Passungen", "T2: Bodensockel, Bodenverzahnung, Dach-Zapfentaschen (0,28 mm wie Boden und Dach)", "black", "floor", 12,
     [("tests/socket_plate", 1), ("tests/tile_a", 1), ("tests/tile_b", 1), ("tests/tab_plate", 1)]),
    ("T3a_Pfosten_Scharnier", "T3a: Pfosten-Scharnieraugen 2,05 bis 2,45, Nutenpfosten, Wandstreifen, Wandzapfen (0,24 mm wie Pfosten und Wände)", "black", "posts", 40,
     [("tests/T3a_post_2.05", 1), ("tests/T3a_post_2.15", 1), ("tests/T3a_post_2.25", 1),
      ("tests/T3a_post_2.35", 1), ("tests/T3a_post_2.45", 1), ("tests/groove_post", 1),
      ("tests/panel_strip", 1), ("tests/tab_key", 1)]),
    ("T3b_Tuer_Fenster", "T3b: Türflügel-Teststück 2,15, Fenster-Teststück mit Flügel und Fuß, Fensterstift-Klemmstücke", "black", "standard", 7,
     [("tests/T3b_leaf_2.15", 1), ("tests/T3b_window_section", 1), ("casement_A", 1), ("tests/T3b_stand", 1),
      ("tests/T3b_pin_1.85", 1), ("tests/T3b_pin_1.95", 1), ("tests/T3b_pin_2.05", 1)]),
    ("T4_Verschluss", "T4: Fallriegel-Prüfstand (Fuß aus T3b) und Tor-Riegel", "black", "standard", 7,
     [("tests/T4_frame", 1), ("tests/T4_door", 1), ("tests/T4_lever", 1),
      ("tests/T4_bolt_test", 1), ("bolt_bar", 1)]),
]

def kn_seg(z0, z1, n, i, gap=0.8):
    """same as kn_seg() in cad/lib/hinges.scad (hinge_gap = 0.8)"""
    L = (z1 - z0) / n
    return (z0 + i * L + (gap / 2 if i > 0 else 0), z0 + (i + 1) * L - (gap / 2 if i < n - 1 else 0))


# hinge bore axes in the part's own STL frame: (x, y, bore radius, [z ranges of
# the FIXED knuckles]) -- support extrusions there would sit inside a bore
def part_axes(part):
    if part.startswith("tests/T3a_post_"):
        d = json.load(open(os.path.join(ROOT, "build", "dims.json")))
        ax = d["post_w"] / 2 + 3.5 + 0.6
        rng = [kn_seg(6.0, 86.0, 5, i) for i in (0, 2, 4)]
        rng[-1] = (rng[-1][0], 86.0 - 1.6)          # blind top
        return [(ax, 0.0, 0.95, rng)]
    return []


# objects that get their own brim: the casement's hinge knuckles stand as
# small islands on the bed until the straps join them (1.4 mm up)
OBJ_SETTINGS = {"casement_A": {"brim_type": "outer_only", "brim_width": "3", "brim_object_gap": "0.1"},
                "casement_B": {"brim_type": "outer_only", "brim_width": "3", "brim_object_gap": "0.1"}}


def stl_path(part):
    return os.path.join(ROOT, "stl", part + ".stl")


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
    """Shelf packing: items [(part, w, h)] -> plates [[(part, x, y, rot)]];
    each part may be turned 90 deg to fit a shelf. flat: a new shelf lays
    the part on its long side (low shelves)."""
    W = HI - LO
    def shelf_orients(w, h):
        o = [(w, h, 0), (h, w, 90)]
        return sorted(o, key=lambda t: t[1]) if flat else o
    plates = []
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
    return [pl["parts"] for pl in plates]


def footprint(part):
    m = trimesh.load(stl_path(part), force="mesh")
    return m.extents[0], m.extents[1]


def plan():
    """[{id, title, colour, process, release, note, parts:[(part, x, y, rot)], kind}]"""
    res, k = [], 1
    for gid, title, colour, proc, gap, parts, release, note in GROUPS:
        items = []
        for part, q in parts:
            w, h = footprint(part)
            items += [(part, w, h)] * q
        plates = pack(items, gap)
        for i, pl in enumerate(plates):
            suffix = f"_{i + 1}" if len(plates) > 1 else ""
            res.append({"id": f"P{k:02d}_{gid}{suffix}", "title": title + (f" ({i + 1}/{len(plates)})" if len(plates) > 1 else ""),
                        "colour": colour, "process": proc, "release": release, "note": note, "parts": pl, "kind": "PROD"})
            k += 1
    for tid, title, colour, proc, gap, parts in TESTS:
        items = []
        for part, q in parts:
            w, h = footprint(part)
            items += [(part, w, h)] * q
        plates = pack(items, gap)
        if len(plates) != 1:
            raise SystemExit(f"test plate {tid} needs {len(plates)} plates")
        res.append({"id": tid, "title": title, "colour": colour, "process": proc, "release": "frei", "note": "",
                    "parts": plates[0], "kind": "TEST"})
    return res


def place(part, x, y, rot):
    """mesh on the bed and the transform that was applied to it"""
    m = trimesh.load(stl_path(part), force="mesh")
    T = np.eye(4)
    if rot:
        R = trimesh.transformations.rotation_matrix(np.radians(rot), [0, 0, 1])
        m.apply_transform(R); T = R @ T
    b = m.bounds
    D = trimesh.transformations.translation_matrix([x - b[0][0], y - b[0][1], -b[0][2]])
    m.apply_transform(D)
    return m, D @ T


def build_plate(p):
    meshes = []
    for part, x, y, rot in p["parts"]:
        m, T = place(part, x, y, rot)
        meshes.append([part, m, T])
    # centre the plate content on the bed
    lo = np.min([m.bounds[0] for _, m, _ in meshes], axis=0)
    hi = np.max([m.bounds[1] for _, m, _ in meshes], axis=0)
    d = trimesh.transformations.translation_matrix([(LO + HI) / 2 - (lo[0] + hi[0]) / 2, (LO + HI) / 2 - (lo[1] + hi[1]) / 2, 0])
    for e in meshes:
        e[1].apply_transform(d); e[2] = d @ e[2]
    issues = []
    for part, m, _ in meshes:
        b = m.bounds
        if b[0][0] < LO - 1e-6 or b[0][1] < LO - 1e-6 or b[1][0] > HI + 1e-6 or b[1][1] > HI + 1e-6 or b[1][2] > 250:
            issues.append(f"{part} outside bed: {np.round(b, 1).tolist()}")
    for i in range(len(meshes)):
        for j in range(i + 1, len(meshes)):
            bi, bj = meshes[i][1].bounds, meshes[j][1].bounds
            gap = max(bj[0][0] - bi[1][0], bi[0][0] - bj[1][0], bj[0][1] - bi[1][1], bi[0][1] - bj[1][1])
            if gap < 4:
                issues.append(f"{meshes[i][0]} and {meshes[j][0]} closer than 4 mm ({gap:.1f})")
    axes = []
    for part, m, T in meshes:
        for ax, ay, r, rng in part_axes(part):
            q = T @ np.array([ax, ay, 0, 1.0])
            for z0, z1 in rng:
                axes.append((float(q[0]), float(q[1]), r, z0, z1))
    return meshes, issues, axes


def slice_opts(p, axes):
    proc = b3.PROCESSES[p["process"]]["keys"]
    pr = b3.PROCESSES[p["process"]]
    o = {"layer": pr["layer"],
         "walls": int(proc.get("wall_loops", 3)), "infill": int(proc.get("sparse_infill_density", "15%").rstrip("%")),
         "support": proc.get("enable_support") == "1",
         "brim": {"posts": 8, "central_roof": 5}.get(p["process"], 0), "axes": axes, "cli": []}
    if "top_shell_layers" in proc:
        o["cli"] += ["--top-solid-layers", proc["top_shell_layers"]]
    if "bottom_shell_layers" in proc:
        o["cli"] += ["--bottom-solid-layers", proc["bottom_shell_layers"]]
    if "support_interface_top_layers" in proc:
        o["cli"] += ["--support-material-interface-layers", proc["support_interface_top_layers"]]
    if p["process"] == "posts":
        o["cli"] += ["--default-acceleration", "3000", "--external-perimeter-acceleration", "2000",
                     "--perimeter-acceleration", "3000", "--infill-acceleration", "4000", "--travel-acceleration", "4000"]
    if any(q[0] in OBJ_SETTINGS for q in p["parts"]):
        o["brim"] = 3                                   # casement brim (PrusaSlicer: whole plate)
    return o


def objects_for(p, meshes):
    ext = EXT[p["colour"]]
    objs, count = [], {}
    for part, m, _ in meshes:
        base = os.path.basename(part)
        count[base] = count.get(base, 0) + 1
        objs.append({"name": f"{base}_{count[base]}" if sum(1 for q, *_ in meshes if q == part) > 1 else base,
                     "mesh": m, "extruder": ext, "settings": OBJ_SETTINGS.get(part, {})})
    return objs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-slice", action="store_true")
    ap.add_argument("--only", nargs="*", help="re-slice only these plates (others keep build/plates.json results)")
    a = ap.parse_args()
    old = {}
    if a.only and os.path.exists(os.path.join(ROOT, "build", "plates.json")):
        old = json.load(open(os.path.join(ROOT, "build", "plates.json")))
    out_dir = os.path.join(ROOT, "bambu")
    for sub in ("TEST", "PRODUKTION"):
        shutil.rmtree(os.path.join(out_dir, sub), ignore_errors=True)
        os.makedirs(os.path.join(out_dir, sub))
    os.makedirs(os.path.join(ROOT, "build", "plates"), exist_ok=True)
    for f in glob.glob(os.path.join(ROOT, "build", "plates", "*.stl")):
        os.remove(f)
    shutil.rmtree(os.path.join(ROOT, "3mf"), ignore_errors=True)       # old geometry-only plates
    res, jobs = {}, []
    for p in plan():
        meshes, issues, axes = build_plate(p)
        merged = trimesh.util.concatenate([m for _, m, _ in meshes])
        stl = os.path.join(ROOT, "build", "plates", p["id"] + ".stl")
        merged.export(stl)
        entry = {k: p[k] for k in ("title", "colour", "process", "release", "note", "kind")}
        entry.update({"parts": [os.path.basename(q) for q, *_ in p["parts"]], "issues": issues,
                      "preset": b3.PROCESSES[p["process"]]["name"], "filament": EXT[p["colour"]],
                      "colour_change": trim_z(b3.PROCESSES[p["process"]]["layer"]) if p["note"] == "trim" else None})
        if p["release"] == "frei":
            fn = ("TEST_" if p["kind"] == "TEST" else "PROD_") + p["id"] + ".3mf"
            path = os.path.join(out_dir, "TEST" if p["kind"] == "TEST" else "PRODUKTION", fn)
            cc = [(trim_z(b3.PROCESSES[p["process"]]["layer"]), EXT["black"])] if p["note"] == "trim" else []
            b3.write_project(path, p["id"], objects_for(p, meshes), p["process"], cc,
                             title=p["title"], description=f"{p['title']} - Bambu Lab A1, PLA, {b3.PROCESSES[p['process']]['name']}")
            chk = b3.check_project(path)
            entry["project"] = os.path.relpath(path, ROOT)
            entry["project_check"] = chk
        res[p["id"]] = entry
        if a.only and p["id"] not in a.only and p["id"] in old:
            for k in ("time_s", "filament_g", "filament_m", "stability", "extent_xy", "support_moves",
                      "support_in_bores", "support_box", "fits_with_brim_support"):
                if k in old[p["id"]]:
                    entry[k] = old[p["id"]][k]
        else:
            jobs.append((p["id"], stl, slice_opts(p, axes)))
        print(p["id"], p["release"], "OK" if not issues else issues, entry.get("project_check", ""), flush=True)
    if not a.no_slice:
        with cf.ProcessPoolExecutor(4) as ex:
            for pid, r in ex.map(slice_one, jobs):
                res[pid].update(r)
                ext = r.get("extent_xy")
                if ext:
                    res[pid]["fits_with_brim_support"] = ext[0] >= 1 and ext[1] >= 1 and ext[2] <= 255 and ext[3] <= 255
                print(pid, {k: r.get(k) for k in ("time_s", "filament_g", "stability", "extent_xy", "support_moves", "support_in_bores")}, flush=True)
    json.dump(res, open(os.path.join(ROOT, "build", "plates.json"), "w"), indent=1)
    prod = [v for v in res.values() if v["kind"] == "PROD"]
    if not a.no_slice:
        t = sum(v.get("time_s", 0) for v in prod) / 3600
        g = sum(v.get("filament_g", 0) for v in prod)
        print(f"TOTAL {len(prod)} production plates: {t:.1f} h, {g:.0f} g")


if __name__ == "__main__":
    main()
