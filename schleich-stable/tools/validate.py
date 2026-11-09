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
  horses:   a proxy of the design horse (config.scad horse_l/w/h) standing
            in every stall facing both ways, lifted out with the side roof
            off, led through an open stall door and (with a rider) through
            the main door
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
from dims import dims  # noqa: E402


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
    # everything open at 90 deg at the same time (doors, windows, bolts)
    opened = {}
    for f in glob.glob(os.path.join(ROOT, "build", "swing", "*_090.stl")):
        tm = load(f); opened[os.path.basename(f)[:-8]] = (tm, to_mf(tm), tm.bounds)
    hits = []
    names = sorted(opened)
    for i, a in enumerate(names):
        for b in names[i + 1:] + static:
            mb = opened[b] if b in opened else placed[b]
            if bbox_overlap(opened[a][2], mb[2], 0.5):
                v = inter_vol(opened[a][1], mb[1])
                if v > TOL:
                    hits.append({"a": a, "b": b, "vol_mm3": round(v, 1)})
    report["all_open_90"] = {"movers": len(opened), "collisions": hits}
    return res


def check_casement_path(placed, report):
    """casement FL over its whole opening path (5 deg steps up to 180 deg):
    first collision and the smallest clearance to the gable wing (frame band,
    sill, fixed knuckles) and every other part nearby"""
    files = sorted(glob.glob(os.path.join(ROOT, "build", "swing_fine", "casement_FL_*.stl")))
    if not files:
        return None
    static = [n for n in placed if not n.startswith(("main_leaf_", "stall_door_", "casement_", "bolt_bar"))]
    rows, free_to, first = [], None, None
    for f in files:
        ang = int(os.path.basename(f).rsplit("_", 1)[1][:3])
        tm = load(f); m = to_mf(tm); bb = tm.bounds
        worst, best = (0.0, None), (9.9, None)
        for s in static:
            ts, ms, bs = placed[s]
            if not bbox_overlap(bb, bs, 3.0):
                continue
            v = inter_vol(m, ms)
            if v > worst[0]:
                worst = (v, s)
            if v <= TOL:
                g = m.min_gap(ms, 3.0)
                if g < best[0]:
                    best = (g, s)
        hit = worst[0] > TOL
        rows.append({"angle": ang, "collision": {"with": worst[1], "vol_mm3": round(worst[0], 2)} if hit else None,
                     "min_gap_mm": round(best[0], 2) if best[1] else None, "nearest": best[1]})
        if hit and first is None:
            first = {"angle": ang, "with": worst[1], "vol_mm3": round(worst[0], 2)}
        if first is None:
            free_to = ang
    path = [r for r in rows if r["angle"] <= (free_to or 0) and r["min_gap_mm"] is not None]
    mn = min(path, key=lambda r: r["min_gap_mm"]) if path else None
    report["casement_path"] = {"free_to_deg": free_to, "first_collision": first,
                               "min_gap_mm": mn["min_gap_mm"] if mn else None,
                               "min_gap_at_deg": mn["angle"] if mn else None,
                               "min_gap_with": mn["nearest"] if mn else None, "rows": rows}
    return report["casement_path"]


def check_roof_lift(placed, report):
    """central roof: lifts straight off. Side roofs: LOCKED while the central
    roof is on (stopped before they rise off their tabs), free once it is off"""
    res = []
    roofs = [n for n in placed if n.startswith("roof_")]
    others = [n for n in placed if not n.startswith("roof_")]
    tab_h = dims()["tab_h_side"]
    steps = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3, 4, 6, 8, 12]

    def first_block(m, bb, against):
        for dz in steps:
            mt = m.translate((0, 0, dz)); bbt = bb + np.array([0, 0, dz])
            for s in against:
                ts, ms, bs = placed[s]
                if bbox_overlap(bbt, bs, 0.2) and inter_vol(mt, ms) > TOL:
                    return {"dz": dz, "by": s}
        return None
    for r in sorted(roofs):
        tm, m, bb = placed[r]
        blocked = first_block(m, bb, others + [x for x in roofs if x != r])
        if r.startswith("roof_side"):
            free = first_block(m, bb, others + [x for x in roofs if x not in (r, "roof_central")])
            res.append({"part": r, "lifts_12mm_freely": blocked is None, "blocked": blocked,
                        "locked_by_central": bool(blocked and blocked["by"] == "roof_central" and blocked["dz"] < tab_h),
                        "free_without_central": free is None, "tab_h": tab_h})
        else:
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
    """stall-door drop latch: results of tools/latch_sim.py production (real
    stall door FL and stall front FL, cropped around the latch)"""
    f = os.path.join(ROOT, "build", "latch_sim_production.json")
    if not os.path.exists(f):
        return {}
    d = json.load(open(f))
    res = {k: d[k] for k in ("closed", "locked", "max_lift_deg", "max_lift_mm_at_notch", "captive")}
    res["tolerance_all_lock"] = all(t["closed_free"] and t["blocked_at_deg"] for t in d["tolerance"])
    report["latch"] = res
    return res


# ------------------------------------------------------------------ horses
def horse_proxy(L, W, H, rider_h=None):
    """Blocky stand-in for a horse figure, larger than the real shape:
    local x from the nose (0) to the tail (L), y centred, z up from the hooves.
    Proportions (head length, ear position) are estimates from figure photos."""
    blocks = [((0.20 * L, -W / 2, 0), (0.92 * L, W / 2, 0.68 * H)),          # body and legs
              ((0.0, -0.25 * W, 0.50 * H), (0.32 * L, 0.25 * W, 0.88 * H)),  # neck and head
              ((0.17 * L, -0.20 * W, 0.88 * H), (0.30 * L, 0.20 * W, H)),    # poll and ears
              ((0.92 * L, -0.20 * W, 0.30 * H), (L, 0.20 * W, 0.66 * H))]    # rump and tail
    if rider_h:
        blocks += [((0.38 * L, -32, 0.45 * H), (0.58 * L, 32, 0.75 * H)),   # rider's legs
                   ((0.40 * L, -14, 0.60 * H), (0.56 * L, 14, rider_h - 12)),
                   ((0.42 * L, -9, rider_h - 14), (0.54 * L, 9, rider_h))]   # head and helmet
    m = None
    for lo, hi in blocks:
        b = mf.Manifold.cube([hi[i] - lo[i] for i in range(3)]).translate(list(lo))
        m = b if m is None else m + b
    return m


FACING = {"+x": 180, "-x": 0, "+y": -90, "-y": 90}    # rotation that points the nose that way


def place_horse(m, nose_xy, z0, facing):
    return m.rotate([0, 0, FACING[facing]]).translate([nose_xy[0], nose_xy[1], z0])


def gaps_to(m, placed, names, search=40.0):
    """[(gap, name)] for every part within `search`; gap < 0 means overlap"""
    bb = np.array(m.bounding_box()).reshape(2, 3)
    out = []
    for n in names:
        tm, ms, bs = placed[n]
        if not bbox_overlap(bb, bs, search):
            continue
        v = inter_vol(m, ms)
        if v > 0.01:
            out.append((-round(v, 2), n))
            continue
        g = m.min_gap(ms, search)
        if g < search:
            out.append((round(g, 1), n))
    return sorted(out)


def save_mesh(m, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    me = m.to_mesh()
    trimesh.Trimesh(np.asarray(me.vert_properties)[:, :3], np.asarray(me.tri_verts)).export(path)


def check_horses(placed, report):
    d = dims()
    hdir = os.path.join(ROOT, "build", "render", "horses")      # proxies for the "horses" render
    for f in glob.glob(os.path.join(hdir, "*.stl")):
        os.remove(f)
    L, W, H, wt, ft = d["horse_l"], d["horse_w"], d["horse_h"], d["wall_t"], d["floor_top"]
    horse = horse_proxy(L, W, H)
    solid = [n for n in placed if not n.startswith(("pin_", "floor_"))]
    res = {"design_horse": [L, W, H], "rider_h": d["rider_h"], "stalls": [], "passages": []}
    # stalls: clear box between the board faces, horse centred, both ways round
    for q in ("FL", "FR", "BL", "BR"):
        left, front = q[1] == "L", q[0] == "F"
        xa, xb = (d["X1"] - d["bay_x_stall"], d["X1"]) if left else (d["X2"], d["X3"])
        xa, xb = xa + wt / 2, xb - wt / 2
        ya, yb = (0.0, d["Y1"]) if front else (d["Y1"], d["Y2"])
        ya, yb = ya + wt / 2, yb - wt / 2
        c = (xb - xa - L) / 2
        yc = (ya + yb) / 2
        aisle = "+x" if left else "-x"
        for facing, label in ((aisle, "facing the aisle"), ("-x" if left else "+x", "facing the outer wall")):
            nose_x = (xb - c) if facing == "+x" else (xa + c)
            m = place_horse(horse, (nose_x, yc), ft + 0.05, facing)
            if label == "facing the aisle":
                save_mesh(m, os.path.join(hdir, f"horse_{q}.stl"))
            g = gaps_to(m, placed, solid)
            res["stalls"].append({"stall": q, "pose": label, "end_clearance_mm": round(c, 1),
                                  "side_clearance_mm": round((yb - ya - W) / 2, 1),
                                  "fits": not g or g[0][0] >= 0, "closest": g[:3]})
    # lift out of stall FL (head at the stall front, the worst place) along a path
    m0 = place_horse(horse, (d["X1"] - wt / 2 - 1.6, d["Y1"] / 2), ft + 0.05, "+x")

    def path_block(steps, removed):
        names = [n for n in solid if n not in removed]
        for dx, dz in steps:
            g = gaps_to(m0.translate([dx, 0, dz]), placed, names, 0.5)
            if g and g[0][0] < 0:
                return {"dx": dx, "dz": dz, "by": g[0][1]}
        return None
    up = [(0, z) for z in range(5, 205, 5)]
    # a typical 150 mm horse standing back against the outer wall
    typ = place_horse(horse_proxy(150, 45, 110), (d["X1"] - d["bay_x_stall"] + wt / 2 + 1.6 + 150, d["Y1"] / 2), ft + 0.05, "+x")
    tblock = None
    for dx, dz in up:
        g = gaps_to(typ.translate([0, 0, dz]), placed, [n for n in solid if n != "roof_side_L"], 0.5)
        if g and g[0][0] < 0:
            tblock = {"dx": 0, "dz": dz, "by": g[0][1]}
            break
    res["lift_out_FL"] = [
        {"how": "typical horse 150 x 45 x 110 mm standing against the outer wall: straight up, side roof off", "blocked": tblock},
        {"how": "design horse: straight up, side roof off", "blocked": path_block(up, {"roof_side_L"})},
        {"how": "design horse: straight up, side roof and central roof off", "blocked": path_block(up, {"roof_side_L", "roof_central"})}]
    # led out through the open stall door FL (90 deg), lifted over the 3 mm sill
    door = os.path.join(ROOT, "build", "swing", "stall_door_FL_090.stl")
    if os.path.exists(door):
        tm = load(door)
        v = tm.vertices[(tm.vertices[:, 0] > d["X1"] + 6)]
        y0 = float(v[:, 1].max())                      # open leaf, aisle-side face
        y1 = d["sf_ud"] - d["stop_bevel"]               # latch stile edge, past its stop bevel
        pas = dict(placed); pas["stall_door_FL"] = (tm, to_mf(tm), tm.bounds)
        # the same horse without its top and bottom 5 mm: its gaps are the side room
        sides = horse ^ mf.Manifold.cube([1000, 1000, H - 10]).translate([-500, -500, 5])
        door_parts = ["stall_front_FL", "stall_door_FL", "post_jamb_FL"]
        worst, side = None, None
        # straight out until the nose nearly touches the stall front opposite;
        # by then the head, ears and body have passed the door
        for nx in np.arange(d["X1"] - wt / 2 - 2, d["X2"] - wt / 2 - 3, 5.0):
            for prox, key in ((horse, "w"), (sides, "s")):
                m = place_horse(prox, (nx, (y0 + y1) / 2), d["sill_top"] + 1.0, "+x")
                g = gaps_to(m, pas, solid if key == "w" else door_parts, 20)
                if key == "w" and g and (worst is None or g[0][0] < worst[0]):
                    worst = g[0]
                if key == "s" and g and (side is None or g[0][0] < side[0]):
                    side = g[0]
        res["passages"].append({"what": "horse through stall door FL (open 90 deg)",
                                "opening_mm": f"{y1 - y0:.1f} x {d['stall_door_top'] - d['sill_top']:.0f}",
                                "passes": worst is None or worst[0] >= 0, "side_room": side,
                                "head_room_mm": round(d["stall_door_top"] - d["sill_top"] - 1.0 - H, 1)})
    # with rider through the open front main door (leaves at 90 deg)
    rider = horse_proxy(L, W, H, d["rider_h"])
    files = {n: os.path.join(ROOT, "build", "swing", f"{n}_090.stl") for n in ("main_leaf_FL", "main_leaf_FR", "bolt_bar_F")}
    if all(os.path.exists(f) for f in files.values()):
        pas = dict(placed)
        for n, f in files.items():
            tm = load(f); pas[n] = (tm, to_mf(tm), tm.bounds)
        save_mesh(place_horse(rider, (d["XC"], -0.45 * L), ft + 0.2, "-y"), os.path.join(hdir, "horse_rider.stl"))
        worst = None
        for ny in np.arange(20.0, -L - 30, -5.0):      # nose 20 mm inside -> tail 30 mm outside
            m = place_horse(rider, (d["XC"], ny), ft + 0.2, "-y")
            g = gaps_to(m, pas, solid, 20)
            if g and (worst is None or g[0][0] < worst[0]):
                worst = g[0]
        res["passages"].append({"what": "horse with rider through the front main door (open 90 deg)",
                                "opening_mm": f"{2 * (d['XC'] - d['md_ax_x']) - 7.0:.1f} x {d['door_crown_z'] - ft:.0f}",
                                "passes": worst is None or worst[0] >= 0, "side_room": None, "min_gap": worst})
    report["horses"] = res
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
    contacts = [g for g in rep["near_gaps"] if g["gap"] <= 0.001]
    clear = [g for g in rep["near_gaps"] if g["gap"] > 0.001]
    L += ["", f"Resting contacts (gap 0, by design): {len(contacts)} pairs. These are posts standing on socket floors,",
          "panels on groove bottoms, roof units on rakes and wall tops, and tile edges.", "",
          "Designed clearances between neighbouring parts (gap < 1 mm), one row per distinct",
          "value and pair type:", "",
          "| gap mm | example pair | pairs with this gap |", "|---|---|---|"]
    seen = {}
    for g in clear:
        key = (round(g["gap"], 2), g["a"].rsplit("_", 1)[0], g["b"].rsplit("_", 1)[0])
        seen.setdefault(key, []).append(g)
    for (gap, ta, tb), lst in sorted(seen.items()):
        L.append(f"| {gap} | {lst[0]['a']} / {lst[0]['b']} | {len(lst)} |")
    if rep.get("swing"):
        L += ["", "## Door and window swing", "",
              "| part | free from 0 deg to | first collision |", "|---|---|---|"]
        for s in rep["swing"]:
            fc = s["first_collision"]
            L.append(f"| {s['part']} | {s['free_to_deg']} deg | " + (f"{fc['angle']} deg with {fc['with']} ({fc['vol_mm3']} mm3)" if fc else "none up to the last tested angle") + " |")
    cp = rep.get("casement_path")
    if cp:
        L += ["", "## Casement FL, whole opening path (5 deg steps)", "",
              f"Free from 0 to {cp['free_to_deg']} deg; first contact: " +
              (f"{cp['first_collision']['angle']} deg with {cp['first_collision']['with']} ({cp['first_collision']['vol_mm3']} mm3)" if cp["first_collision"] else "none up to 180 deg") + ".",
              f"Smallest clearance on the free path: {cp['min_gap_mm']} mm at {cp['min_gap_at_deg']} deg (to {cp['min_gap_with']}).", "",
              "| angle | nearest part | clearance mm | contact |", "|---|---|---|---|"]
        for r in cp["rows"]:
            c = r["collision"]
            L.append(f"| {r['angle']} | {r['nearest'] or ''} | {r['min_gap_mm'] if r['min_gap_mm'] is not None else ''} | " +
                     (f"{c['with']} {c['vol_mm3']} mm3" if c else "") + " |")
    ao = rep.get("all_open_90")
    if ao:
        L += ["", f"All {ao['movers']} moving parts open at 90 deg at the same time: " +
              ("no collisions." if not ao["collisions"] else f"**collisions** {ao['collisions']}")]
    if rep.get("pins"):
        L += ["", "## Hinge pins (virtual, 1.75 mm) through all knuckles", "",
              "| pin | length mm | passes freely | touches |", "|---|---|---|---|"]
        for p in rep["pins"]:
            L.append(f"| {p['pin']} | {p['length_mm']} | {'yes' if p['clear'] else '**no**'} | {p['touching'] or ''} |")
    if rep.get("latch"):
        r = rep["latch"]
        L += ["", "## Stall-door drop latch (door FL + stall front FL, tools/latch_sim.py production)", "",
              f"* closed: lever/front overlap {r['closed']['lever_frame_mm3']} mm3, lever/door {r['closed']['lever_door_mm3']} mm3, door/front {r['closed']['door_frame_mm3']} mm3",
              f"* locked: the lowered lever stops the door at {r['locked']['blocked_at_deg']:.1f} deg = {r['locked']['play_mm_at_catch']} mm play at the catch",
              f"* closing: the ramp lifts the lever by up to {r['max_lift_deg']} deg ({r['max_lift_mm_at_notch']} mm at the notch), then it drops in",
              f"* captive: pulled off level {r['captive']['pull_off_level_mm3']} mm3 overlap (blocked), pointing up {r['captive']['pull_off_up_mm3']} mm3 (comes off)",
              f"* stall front shifted +-1 mm along the panel and +-0.4 mm in height: locks every time = {r['tolerance_all_lock']}"]
    h = rep.get("horses")
    if h:
        L += ["", "## Horse fit (design horse %g x %g x %g mm)" % tuple(h["design_horse"]), "",
              "A blocky proxy of the design horse (`horse_l/w/h` in `config.scad`) is placed in every stall,",
              "centred, both ways round. It is larger than a real figure (no tapering legs, neck or head).",
              "Gaps are the nearest distances to any part; negative = overlap in mm3.", "",
              "| stall | pose | room at each end mm | room at each side mm | fits | closest parts (gap mm) |", "|---|---|---|---|---|---|"]
        for r in h["stalls"]:
            cl = ", ".join(f"{n} {g}" for g, n in r["closest"])
            L.append(f"| {r['stall']} | {r['pose']} | {r['end_clearance_mm']} | {r['side_clearance_mm']} | {'yes' if r['fits'] else '**NO**'} | {cl} |")
        L += ["", "Taking a horse out of stall FL from above (design horse: head at the stall front, the worst place):", "",
              "| path | result |", "|---|---|"]
        for r in h["lift_out_FL"]:
            bl = r["blocked"]
            L.append(f"| {r['how']} | " + ("free (to 200 mm up)" if not bl else
                     f"stops after {bl['dz']} mm" + (f" up and {abs(bl['dx'])} mm out" if bl["dx"] else "") +
                     f" at {bl['by']}") + " |")
        L += ["", "Led through the doors (horse lifted 1 mm over the 3 mm sill):", ""]
        L += ["| passage | clear opening w x h mm | passes | smallest gap while moving through |", "|---|---|---|---|"]
        for p in h["passages"]:
            if p.get("side_room") is not None:
                gap = f"{p['side_room'][0]} mm at the sides ({p['side_room'][1]}), {p['head_room_mm']} mm head room"
            else:
                g = p.get("min_gap")
                gap = f"{g[0]} mm ({g[1]})" if g else "> 20 mm"
            L.append(f"| {p['what']} | {p['opening_mm']} | {'yes' if p['passes'] else '**NO**'} | {gap} |")
        L.append(f"\nThe rider height ({h['rider_h']:g} mm above the floor) is an estimate.")
    L += ["", "## Roof lift-off and lock (others in place)", "",
          "The central roof lifts straight up. Each side roof must be LOCKED while the central roof is on",
          "(its lock fins meet the central roof before the side roof rises off its tabs) and lift freely",
          "once the central roof is off.", "",
          "| roof unit | first contact going up | locked by the central roof | lifts 12 mm freely without the central roof |", "|---|---|---|---|"]
    for r in rep["roof_lift"]:
        fc = (str(r['blocked']['dz']) + ' mm, ' + r['blocked']['by']) if r['blocked'] else 'none (lifts 12 mm)'
        if r["part"].startswith("roof_side"):
            L.append(f"| {r['part']} | {fc} | {'yes' if r['locked_by_central'] else '**no**'} (tabs {r['tab_h']:g} mm) | "
                     f"{'yes' if r['free_without_central'] else '**no**'} |")
        else:
            L.append(f"| {r['part']} | {fc} | - | {'yes' if r['lifts_12mm_freely'] else '**no**'} |")
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
    print("casement path ...", flush=True); cp = check_casement_path(placed, rep)
    if cp:
        print("   casement path:", {k: v for k, v in cp.items() if k != "rows"})
    print("pins / latch ...", flush=True)
    pins_placed = {k: v for k, v in placed.items()}
    check_pins(pins_placed, rep); check_latch(placed, rep)
    print("horses ...", flush=True); check_horses(placed, rep)
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
    print("   all open at 90:", rep.get("all_open_90"))
    for p in rep.get("pins", []):
        print("   pin", p)
    print("   latch", rep.get("latch"))
    for r in rep["horses"]["stalls"]:
        print("   horse", r)
    for r in rep["horses"]["lift_out_FL"]:
        print("   horse lift-out FL:", r)
    for r in rep["horses"]["passages"]:
        print("   passage", r)
    for r in rep["roof_lift"]:
        print("   roof", r)
    for r in rep["extraction"]:
        if not r["slides_out"]:
            print("   extract", r)
    print(f"done in {time.time() - t:.0f}s")


if __name__ == "__main__":
    main()
