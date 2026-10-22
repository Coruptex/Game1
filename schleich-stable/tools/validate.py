#!/usr/bin/env python3
"""Digital validation of the exported stable geometry.

Run after:  python3 tools/build.py --placed --swing
            python3 tools/validate.py            (writes docs/VALIDATION.md)

Checks
  parts:    watertight / single body / positive volume, fits the Bambu A1
            build volume (incl. best rotation on the bed), overhang area
            that would need support, thin-wall estimate (ray casting)
  assembly: pairwise interference of all placed parts, nearest gaps,
            door / window swing range, roof lift-off, vertical extraction
            of panels from their grooves (assembly order)
"""
import glob, json, os, sys, time
import numpy as np
import trimesh
import manifold3d as mf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BED = (256.0, 256.0, 256.0)
MARGIN = 6.0                 # brim / handling margin per side
OVERHANG_DEG = 50.0          # from vertical; steeper down-facing area needs support
TOL = 0.5                    # mm^3 -- intersections below this are numerical noise

sys.path.insert(0, os.path.dirname(__file__))
from build import read_instances, unique_parts  # noqa: E402


def load(path):
    return trimesh.load(path, force="mesh")


def to_mf(tm):
    m = mf.Manifold(mf.Mesh(vert_properties=np.asarray(tm.vertices, np.float32),
                            tri_verts=np.asarray(tm.faces, np.uint32)))
    return m


def inter_vol(a, b):
    return (a ^ b).volume()


def bbox_overlap(b1, b2, pad=0.0):
    return np.all(b1[0] - pad <= b2[1]) and np.all(b2[0] - pad <= b1[1])


# ------------------------------------------------------------------ parts
def best_bed_fit(tm):
    """minimum-area rectangle of the XY footprint -> (w, h)"""
    pts = tm.vertices[:, :2]
    hull = trimesh.convex.hull_points(pts) if hasattr(trimesh.convex, "hull_points") else pts
    try:
        _, ext = trimesh.bounds.oriented_bounds_2D(hull)
    except Exception:
        ext = tm.extents[:2]
    return sorted(ext)


def overhang_area(tm):
    n = tm.face_normals
    c = tm.triangles_center
    lim = -np.cos(np.radians(90 - OVERHANG_DEG))  # normal z below this -> overhang
    down = (n[:, 2] < lim) & (c[:, 2] > 0.25)
    return float(tm.area_faces[down].sum())


def thin_wall(tm, n=6000, thr=0.8):
    rng = np.random.default_rng(1)
    pts, fid = trimesh.sample.sample_surface(tm, n, seed=1)
    nrm = tm.face_normals[fid]
    origins = pts - nrm * 1e-3
    loc, idx_ray, _ = tm.ray.intersects_location(origins, -nrm, multiple_hits=False)
    d = np.full(len(pts), np.inf)
    if len(idx_ray):
        dist = np.linalg.norm(loc - origins[idx_ray], axis=1)
        d[idx_ray] = dist
    d = d[np.isfinite(d)]
    if not len(d):
        return None
    return {"p2": float(np.percentile(d, 2)), "frac_below": float(np.mean(d < thr))}


def check_parts(report):
    insts = read_instances()
    rows = []
    for p, colour, qty in unique_parts(insts):
        f = os.path.join(ROOT, "stl", p + ".stl")
        tm = load(f)
        bodies = len(tm.split(only_watertight=False))
        ext = tm.extents
        fit_w, fit_h = best_bed_fit(tm)
        lim = BED[0] - 2 * MARGIN
        fits_axis = ext[0] <= lim and ext[1] <= lim
        fits_rot = fit_w <= lim and fit_h <= lim
        fits_z = ext[2] <= BED[2] - 2
        tw = thin_wall(tm)
        rows.append({
            "part": p, "qty": qty, "colour": colour,
            "watertight": bool(tm.is_watertight), "bodies": bodies,
            "volume_cm3": round(tm.volume / 1000, 1),
            "size": [round(x, 1) for x in ext],
            "fits_bed": bool(fits_z and (fits_axis or fits_rot)),
            "needs_rotation": bool(not fits_axis and fits_rot),
            "overhang_mm2": round(overhang_area(tm)),
            "thin_p2": round(tw["p2"], 2) if tw else None,
            "thin_frac": round(100 * tw["frac_below"], 1) if tw else None,
        })
    report["parts"] = rows
    return rows


# --------------------------------------------------------------- assembly
def load_placed():
    out = {}
    for n, p, c in read_instances():
        f = os.path.join(ROOT, "build", "placed", n + ".stl")
        if os.path.exists(f):
            tm = load(f)
            out[n] = (tm, to_mf(tm), tm.bounds)
    return out


def check_interference(placed, report):
    names = sorted(placed)
    hits, gaps = [], []
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            ta, ma, ba = placed[a]
            tb, mb, bb = placed[b]
            if not bbox_overlap(ba, bb, 1.0):
                continue
            v = inter_vol(ma, mb)
            if v > TOL:
                hits.append({"a": a, "b": b, "vol_mm3": round(v, 2)})
            else:
                g = ma.min_gap(mb, 1.0)
                if g < 1.0:
                    gaps.append({"a": a, "b": b, "gap": round(g, 3)})
    report["interference"] = hits
    report["near_gaps"] = sorted(gaps, key=lambda r: r["gap"])
    return hits


def check_swing(placed, report):
    res = []
    movers = [n for n in placed if n.startswith(("main_leaf_", "stall_door_", "casement_"))]
    static = [n for n in placed if n not in movers and not n.startswith("bolt_bar")]
    for n in sorted(movers):
        files = sorted(glob.glob(os.path.join(ROOT, "build", "swing", n + "_*.stl")))
        if not files:
            continue
        free_to, first_hit = None, None
        for f in files:
            ang = int(os.path.basename(f).rsplit("_", 1)[1][:3])
            tm = load(f); m = to_mf(tm); bb = tm.bounds
            worst = (0.0, None)
            for s in static + [x for x in movers if x != n]:
                ts, ms, bs = placed[s]
                if bbox_overlap(bb, bs, 0.5):
                    v = inter_vol(m, ms)
                    if v > worst[0]:
                        worst = (v, s)
            if worst[0] > TOL:
                first_hit = {"angle": ang, "with": worst[1], "vol_mm3": round(worst[0], 1)}
                break
            free_to = ang
        res.append({"part": n, "free_to_deg": free_to, "first_collision": first_hit})
    report["swing"] = res
    return res


def check_roof_lift(placed, report):
    res = []
    roofs = [n for n in placed if n.startswith("roof_")]
    others = [n for n in placed if not n.startswith("roof_")]
    for r in sorted(roofs):
        tm, m, bb = placed[r]
        blocked = None
        for dz in [0.5, 1, 2, 3, 4, 6, 8, 12]:
            mt = m.translate((0, 0, dz))
            bbt = bb + np.array([0, 0, dz])
            for s in others + [x for x in roofs if x != r]:
                ts, ms, bs = placed[s]
                if bbox_overlap(bbt, bs, 0.2) and inter_vol(mt, ms) > TOL:
                    blocked = {"dz": dz, "by": s}
                    break
            if blocked:
                break
        res.append({"part": r, "lifts_12mm_freely": blocked is None, "blocked": blocked})
    report["roof_lift"] = res
    return res


def check_extraction(placed, report):
    """each panel must slide straight up out of its grooves (roof removed)"""
    res = []
    panels = [n for n in placed if n.startswith(("side_wall", "gable_wing", "partition", "stall_front", "pediment"))]
    fixed = [n for n in placed if n.startswith(("floor_", "post_"))]
    for n in sorted(panels):
        tm, m, bb = placed[n]
        blocked = None
        for dz in [1, 3, 6, 12, 25, 50, 100, 200, 300]:
            mt = m.translate((0, 0, dz)); bbt = bb + np.array([0, 0, dz])
            for s in fixed:
                ts, ms, bs = placed[s]
                if bbox_overlap(bbt, bs, 0.2) and inter_vol(mt, ms) > TOL:
                    blocked = {"dz": dz, "by": s}
                    break
            if blocked:
                break
        res.append({"part": n, "slides_out": blocked is None, "blocked": blocked})
    report["extraction"] = res
    return res


def check_pins(placed, report):
    """virtual pins must pass through all knuckle bores without touching"""
    res = []
    for f in sorted(glob.glob(os.path.join(ROOT, "build", "placed", "pin_*.stl"))):
        n = os.path.basename(f)[:-4]
        tm = load(f); m = to_mf(tm); bb = tm.bounds
        touching = []
        for s, (ts, ms, bs) in placed.items():
            if s.startswith("pin_") or not bbox_overlap(bb, bs, 0.5):
                continue
            v = inter_vol(m, ms)
            if v > 0.05:
                touching.append((s, round(v, 2)))
        res.append({"pin": n, "length_mm": round(float(tm.extents[2]), 1), "clear": not touching, "touching": touching})
    report["pins"] = res
    return res


def check_latch(placed, report):
    """stall door FL closing: the barb must overlap the stile (= tongue deflection)
    between closed and a few degrees open, and be free when fully closed"""
    files = sorted(glob.glob(os.path.join(ROOT, "build", "latch", "stall_door_FL_*.stl")))
    if not files or "stall_front_FL" not in placed:
        return []
    _, msf, _ = placed["stall_front_FL"]
    res = []
    for f in files:
        ang = float(os.path.basename(f).rsplit("_", 1)[1][:-4])
        tm = load(f); m = to_mf(tm)
        ov = m ^ msf
        v = ov.volume()
        depth = 0.0
        if v > 1e-4:
            bb = ov.bounding_box()
            depth = round(min(bb[3] - bb[0], bb[4] - bb[1]), 2)
        res.append({"angle": ang, "overlap_mm3": round(v, 3), "overlap_extent_mm": depth})
    report["latch"] = res
    return res


def write_md(rep, path):
    L = ["# Digital validation report", "",
         f"Generated by `tools/validate.py` on {time.strftime('%Y-%m-%d %H:%M')} from the exported STL files.",
         "These are geometric checks only -- nothing here replaces printing the test coupons.", ""]
    L += ["## Printable parts", "",
          "| part | qty | watertight | bodies | volume cm3 | size X x Y x Z mm | fits A1 | overhang >50 deg mm2 | thin-wall p2 mm | % < 0.8 mm |",
          "|---|---|---|---|---|---|---|---|---|---|"]
    for r in rep["parts"]:
        fit = ("yes (rotate on bed)" if r["needs_rotation"] else "yes") if r["fits_bed"] else "**NO**"
        L.append(f"| {r['part']} | {r['qty']} | {'yes' if r['watertight'] else '**NO**'} | {r['bodies']} | {r['volume_cm3']} | "
                 f"{' x '.join(str(x) for x in r['size'])} | {fit} | {r['overhang_mm2']} | {r['thin_p2']} | {r['thin_frac']} |")
    L += ["", "## Assembly interference (all placed parts, pairwise)", ""]
    if rep["interference"]:
        L += ["| part A | part B | overlap mm3 |", "|---|---|---|"]
        L += [f"| {h['a']} | {h['b']} | {h['vol_mm3']} |" for h in rep["interference"]]
    else:
        L.append("No overlapping parts (threshold %.1f mm3)." % TOL)
    L += ["", "Closest non-overlapping pairs (gap < 1 mm, expected at grooves, sockets, tabs and hinges):", "",
          "| part A | part B | gap mm |", "|---|---|---|"]
    L += [f"| {g['a']} | {g['b']} | {g['gap']} |" for g in rep["near_gaps"][:40]]
    if rep.get("swing"):
        L += ["", "## Door and window swing", "",
              "| part | free from 0 deg to | first collision |", "|---|---|---|"]
        for s in rep["swing"]:
            fc = s["first_collision"]
            L.append(f"| {s['part']} | {s['free_to_deg']} deg | " + (f"{fc['angle']} deg with {fc['with']} ({fc['vol_mm3']} mm3)" if fc else "none up to the last tested angle") + " |")
    if rep.get("pins"):
        L += ["", "## Hinge pins (virtual, 1.75 mm) through all knuckles", "",
              "| pin | length mm | passes freely | touches |", "|---|---|---|---|"]
        for p in rep["pins"]:
            L.append(f"| {p['pin']} | {p['length_mm']} | {'yes' if p['clear'] else '**no**'} | {p['touching'] or ''} |")
    if rep.get("latch"):
        L += ["", "## Stall-door click latch (door FL closing, fine sweep)", "",
              "Overlap between the barb and the latch stile = how far the flexure tongue must deflect.",
              "Expected: zero when fully closed (barb seated in its recess), a small overlap of about",
              "0.8 mm while the barb rides over the crest, zero once clear.", "",
              "| door angle deg | overlap mm3 | overlap extent mm |", "|---|---|---|"]
        for r in rep["latch"]:
            L.append(f"| {r['angle']} | {r['overlap_mm3']} | {r['overlap_extent_mm']} |")
    L += ["", "## Roof lift-off (vertical, others in place)", "", "| roof unit | lifts 12 mm freely | blocked |", "|---|---|---|"]
    for r in rep["roof_lift"]:
        L.append(f"| {r['part']} | {'yes' if r['lifts_12mm_freely'] else '**no**'} | {r['blocked'] or ''} |")
    L += ["", "## Panel extraction (slide straight up, roof off)", "", "| panel | slides out | blocked |", "|---|---|---|"]
    for r in rep["extraction"]:
        L.append(f"| {r['part']} | {'yes' if r['slides_out'] else '**no**'} | {r['blocked'] or ''} |")
    open(path, "w").write("\n".join(L) + "\n")


def main():
    t = time.time()
    rep = {}
    print("parts ...", flush=True); check_parts(rep)
    print("loading placed ...", flush=True); placed = load_placed()
    print("interference ...", flush=True); check_interference(placed, rep)
    print("swing ...", flush=True); check_swing(placed, rep)
    print("pins / latch ...", flush=True)
    pins_placed = {k: v for k, v in placed.items()}
    check_pins(pins_placed, rep); check_latch(placed, rep)
    print("roof lift ...", flush=True); check_roof_lift(placed, rep)
    print("extraction ...", flush=True); check_extraction(placed, rep)
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    json.dump(rep, open(os.path.join(ROOT, "build", "validation.json"), "w"), indent=1)
    write_md(rep, os.path.join(ROOT, "docs", "VALIDATION.md"))
    bad = [r["part"] for r in rep["parts"] if not (r["watertight"] and r["bodies"] == 1 and r["fits_bed"])]
    print(f"parts with problems: {bad}")
    print(f"interferences: {len(rep['interference'])}")
    for h in rep["interference"]:
        print("   ", h)
    for s in rep.get("swing", []):
        print("   swing", s)
    for p in rep.get("pins", []):
        print("   pin", p)
    for r in rep.get("latch", []):
        print("   latch", r)
    for r in rep["roof_lift"]:
        print("   roof", r)
    for r in rep["extraction"]:
        if not r["slides_out"]:
            print("   extract", r)
    print(f"done in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
