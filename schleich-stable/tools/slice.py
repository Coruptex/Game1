#!/usr/bin/env python3
"""Slice every printable part with PrusaSlicer (A1-equivalent settings) and
collect print time and filament. Results -> build/slice.json and a table
printed to stdout. Usage: python3 tools/slice.py [--jobs 4]
These numbers are ESTIMATES (different slicer than Bambu Studio)."""
import argparse, concurrent.futures as cf, json, os, re, subprocess, sys, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INI = os.path.join(ROOT, "tools", "a1_pla_estimate.ini")
sys.path.insert(0, os.path.dirname(__file__))
from build import read_instances, unique_parts  # noqa: E402

# parts printed upright / standing on thin edges get a brim
# parts / plates that need support (the full hinge knuckles on the posts;
# the test plate T1 has the same knuckles). Supports may rest on the model:
# each knuckle's support stands on the knuckle below, in the door's gap.
SUPPORT = {"post_jamb_L", "post_jamb_R", "post_mid", "plate_T1"}
SUPPORT_ARGS = ["--support-material", "--support-material-auto", "--support-material-style", "organic",
                "--support-material-threshold", "30", "--support-material-contact-distance", "0.2"]
BRIM = {"post_corner_A": 8, "post_corner_B": 8, "post_sidemid": 8, "post_jamb_L": 8, "post_jamb_R": 8, "post_mid": 8,
        "roof_central": 5, "plate_T1": 3, "plate_T2": 3}


def tsec(s):
    t = 0
    for v, u in re.findall(r"(\d+)([dhms])", s):
        t += int(v) * {"d": 86400, "h": 3600, "m": 60, "s": 1}[u]
    return t


def gcode_scan(path, axes=()):
    """extrusion footprint (incl. brim, skirt, support) and support statistics
    from a PrusaSlicer G-code; axes = [(x, y, r, z0, z1)] bore axes: support
    extrusions inside r around an axis between z0 and z1 are counted"""
    x = y = z = 0.0
    e_abs, e_cur = False, 0.0
    typ = ""
    lo, hi = [1e9, 1e9], [-1e9, -1e9]
    sup_n, sup_in_bore, sup_lo, sup_hi = 0, 0, [1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]
    with open(path, errors="ignore") as f:
        for line in f:
            if line.startswith(";TYPE:"):
                typ = line[6:].strip(); continue
            if line.startswith("M82"):
                e_abs = True
            elif line.startswith("M83"):
                e_abs = False
            elif line.startswith("G92"):
                for tok in line.split(";")[0].split()[1:]:
                    if tok.startswith("E"):
                        e_cur = float(tok[1:] or 0)
                continue
            if not line.startswith(("G1 ", "G0 ")):
                continue
            nx, ny, nz, e = x, y, z, None
            for tok in line.split(";")[0].split()[1:]:
                k, v = tok[0], tok[1:]
                try:
                    v = float(v)
                except ValueError:
                    continue
                if k == "X": nx = v
                elif k == "Y": ny = v
                elif k == "Z": nz = v
                elif k == "E": e = v
            extruding = e is not None and ((e - e_cur > 1e-6) if e_abs else (e > 0))
            if e is not None and e_abs:
                e_cur = e
            if extruding and (nx != x or ny != y):
                for px, py in ((x, y), (nx, ny)):
                    lo[0] = min(lo[0], px); lo[1] = min(lo[1], py); hi[0] = max(hi[0], px); hi[1] = max(hi[1], py)
                if typ.startswith("Support"):
                    sup_n += 1
                    for i, v in enumerate((nx, ny, nz)):
                        sup_lo[i] = min(sup_lo[i], v); sup_hi[i] = max(sup_hi[i], v)
                    for ax, ay, r, z0, z1 in axes:
                        if z0 <= nz <= z1 and ((nx - ax) ** 2 + (ny - ay) ** 2) ** 0.5 < r:
                            sup_in_bore += 1
                            break
            x, y, z = nx, ny, nz
    return {"extent_xy": [round(lo[0], 1), round(lo[1], 1), round(hi[0], 1), round(hi[1], 1)],
            "support_moves": sup_n, "support_in_bores": sup_in_bore,
            "support_box": [round(v, 1) for v in sup_lo + sup_hi] if sup_n else None}


def slice_one(args):
    """args = (name, stl) or (name, stl, opts); opts: brim (mm), support (bool),
    layer (mm), walls, infill (%), cli (extra PrusaSlicer options), axes"""
    name, stl = args[0], args[1]
    o = args[2] if len(args) > 2 else {"brim": BRIM.get(name, 0), "support": name in SUPPORT,
                                       "layer": 0.24 if "floor" in name else 0.2}
    out = os.path.join(tempfile.gettempdir(), f"slice_{os.getpid()}_{name}.gcode")
    cmd = ["prusa-slicer", "--export-gcode", "--load", INI, "--dont-arrange", "--skirts", "0",
           "--brim-width", str(o.get("brim", 0)), *(SUPPORT_ARGS if o.get("support") else []),
           "--layer-height", str(o.get("layer", 0.2)),
           *(["--perimeters", str(o["walls"])] if o.get("walls") else []),
           *(["--fill-density", f"{o['infill']}%"] if o.get("infill") else []),
           *o.get("cli", []), "-o", out, stl]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        return name, {"error": (r.stdout + r.stderr)[-500:]}
    res = {}
    # PrusaSlicer's print-stability check ("Low bed adhesion", "Loose extrusions" ...)
    m = re.search(r"Detected print stability issues:\s*\n\s*\S+\.stl\s*\n([^\n]+)", r.stdout + r.stderr)
    res["stability"] = m.group(1).strip() if m else ""
    with open(out, errors="ignore") as f:
        for line in f:
            if line.startswith("; estimated printing time (normal mode)"):
                res["time_s"] = tsec(line.split("=")[1])
            elif line.startswith("; filament used [g]"):
                res["filament_g"] = float(line.split("=")[1])
            elif line.startswith("; filament used [mm]"):
                res["filament_m"] = round(float(line.split("=")[1]) / 1000, 2)
    res.update(gcode_scan(out, o.get("axes", ())))
    keep = os.path.join(ROOT, "build", "gcode")
    os.makedirs(keep, exist_ok=True)
    os.replace(out, os.path.join(keep, name + ".gcode"))
    return name, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    parts = unique_parts(read_instances())
    jobs = [(p, os.path.join(ROOT, "stl", p + ".stl")) for p, _, _ in parts]
    qty = {p: q for p, _, q in parts}
    res = {}
    with cf.ProcessPoolExecutor(a.jobs) as ex:
        for name, r in ex.map(slice_one, jobs):
            res[name] = r
            print(name, r, flush=True)
    tot_t = sum(r.get("time_s", 0) * qty.get(n, 1) for n, r in res.items() if n in qty)
    tot_g = sum(r.get("filament_g", 0) * qty.get(n, 1) for n, r in res.items() if n in qty)
    json.dump({"parts": res, "qty": qty, "total_time_h": round(tot_t / 3600, 1), "total_filament_g": round(tot_g)},
              open(os.path.join(ROOT, "build", "slice.json"), "w"), indent=1)
    print(f"TOTAL stable (all quantities): {tot_t / 3600:.1f} h, {tot_g:.0f} g PLA")


if __name__ == "__main__":
    main()
