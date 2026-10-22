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
BRIM = {"post_corner": 5, "post_sidemid": 5, "post_jamb_L": 5, "post_jamb_R": 5, "post_mid": 5,
        "roof_central": 5, "plate_T1": 3, "plate_T2": 3}


def tsec(s):
    t = 0
    for v, u in re.findall(r"(\d+)([dhms])", s):
        t += int(v) * {"d": 86400, "h": 3600, "m": 60, "s": 1}[u]
    return t


def slice_one(args):
    name, stl = args
    out = os.path.join(tempfile.gettempdir(), f"slice_{os.getpid()}_{name}.gcode")
    cmd = ["prusa-slicer", "--export-gcode", "--load", INI, "--center", "128,128",
           "--brim-width", str(BRIM.get(name, 0)), "-o", out, stl]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(out):
        return name, {"error": (r.stdout + r.stderr)[-500:]}
    res = {}
    with open(out, errors="ignore") as f:
        for line in f:
            if line.startswith("; estimated printing time (normal mode)"):
                res["time_s"] = tsec(line.split("=")[1])
            elif line.startswith("; filament used [g]"):
                res["filament_g"] = float(line.split("=")[1])
            elif line.startswith("; filament used [mm]"):
                res["filament_m"] = round(float(line.split("=")[1]) / 1000, 2)
    os.remove(out)
    return name, res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", type=int, default=4)
    a = ap.parse_args()
    parts = unique_parts(read_instances())
    jobs = [(p, os.path.join(ROOT, "stl", p + ".stl")) for p, _, _ in parts]
    jobs += [(t, os.path.join(ROOT, "stl", "tests", t + ".stl")) for t in ("plate_T1", "plate_T2")]
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
