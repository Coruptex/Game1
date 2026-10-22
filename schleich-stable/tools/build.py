#!/usr/bin/env python3
"""Export the stable's STL files with OpenSCAD.

  python3 tools/build.py            # unique print parts -> stl/
  python3 tools/build.py --placed   # also every instance at its assembled
                                    # position -> build/placed/ (validation)
  python3 tools/build.py --swing    # also doors/windows at several opening
                                    # angles -> build/swing/
  python3 tools/build.py --only stall_door --jobs 4

Works with OpenSCAD 2021.01 (CGAL); with a 2023+ snapshot add
--backend manifold for a large speed-up.
"""
import argparse, concurrent.futures as cf, os, re, subprocess, sys, time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CAD = os.path.join(ROOT, "cad", "stable.scad")
SWING_ANGLES = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150]
LATCH_ANGLES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6]          # fine sweep, stall door FL
PINS = [f"pin_{k}_{q}" for k in ("main", "stall", "case") for q in ("FL", "FR", "BL", "BR")]


def read_instances():
    """[(instance, print_part, colour)] parsed from cad/instances.scad"""
    txt = open(os.path.join(ROOT, "cad", "instances.scad")).read()
    block = txt[txt.index("instances = ["):txt.index("];", txt.index("instances = ["))]
    return re.findall(r'\["([\w]+)",\s*"([\w]+)",\s*"([\w]+)"\]', block)


def unique_parts(insts):
    out, seen = [], set()
    for _, p, c in insts:
        if p not in seen:
            seen.add(p)
            out.append((p, c, sum(1 for _, q, _ in insts if q == p)))
    return out


def export(job):
    out, defs, backend = job
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tmp = out + ".ascii.stl"
    cmd = ["openscad", "-o", tmp]
    if backend:
        cmd += ["--backend", backend]
    src = defs.pop("__file", CAD)
    for k, v in defs.items():
        cmd += ["-D", f"{k}={v}"]
    cmd.append(src)
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    warn = [l for l in (r.stdout + r.stderr).splitlines() if "WARNING" in l or "ERROR" in l]
    # OpenSCAD reports some geometry failures only as ERROR lines (rc 0):
    # treat them as failures so nothing is dropped silently
    if r.returncode != 0 or not os.path.exists(tmp) or any("ERROR" in w for w in warn):
        return out, False, time.time() - t, warn or [r.stderr[-400:]]
    # convert to binary STL (much smaller)
    import trimesh
    m = trimesh.load(tmp, force="mesh")
    m.export(out)
    os.remove(tmp)
    return out, True, time.time() - t, warn


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--placed", action="store_true")
    ap.add_argument("--swing", action="store_true")
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--no-parts", action="store_true")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--backend", default=None)
    a = ap.parse_args()

    insts = read_instances()
    jobs = []
    if not a.no_parts:
        for p, _, _ in unique_parts(insts):
            if a.only and p not in a.only:
                continue
            jobs.append((os.path.join(ROOT, "stl", p + ".stl"), {"part": f'"{p}"', "mode": '"print"'}, a.backend))
    if a.placed:
        for n, _, _ in insts:
            if a.only and n not in a.only:
                continue
            jobs.append((os.path.join(ROOT, "build", "placed", n + ".stl"),
                         {"part": f'"{n}"', "mode": '"placed"', "door_ang": 0}, a.backend))
    if not a.no_parts and (not a.only or "tests" in a.only):
        coupons = os.path.join(ROOT, "cad", "tests", "coupons.scad")
        for t in ("plate_T1", "plate_T2"):
            jobs.append((os.path.join(ROOT, "stl", "tests", t + ".stl"), {"part": f'"{t}"', "__file": coupons}, a.backend))
    if a.placed:
        for n in PINS:
            if a.only and n not in a.only:
                continue
            jobs.append((os.path.join(ROOT, "build", "placed", n + ".stl"),
                         {"part": f'"{n}"', "mode": '"placed"', "door_ang": 0}, a.backend))
    if a.swing:
        for n, _, _ in insts:
            if not any(n.startswith(k) for k in ("main_leaf_", "stall_door_", "casement_", "bolt_bar_")):
                continue
            if a.only and n not in a.only:
                continue
            for ang in SWING_ANGLES:
                jobs.append((os.path.join(ROOT, "build", "swing", f"{n}_{ang:03d}.stl"),
                             {"part": f'"{n}"', "mode": '"placed"', "door_ang": ang}, a.backend))
    if a.swing and (not a.only or "stall_door_FL" in a.only):
        for ang in LATCH_ANGLES:
            jobs.append((os.path.join(ROOT, "build", "latch", f"stall_door_FL_{ang:04.1f}.stl"),
                         {"part": '"stall_door_FL"', "mode": '"placed"', "door_ang": ang}, a.backend))
    # longest first for better packing
    jobs.sort(key=lambda j: ("floor" not in j[0], "roof" not in j[0]))
    t0 = time.time()
    fails = 0
    with cf.ProcessPoolExecutor(a.jobs) as ex:
        for out, ok, dt, warn in ex.map(export, jobs):
            rel = os.path.relpath(out, ROOT)
            print(f"{'ok ' if ok else 'ERR'} {dt:6.1f}s  {rel}", flush=True)
            for w in warn[:5]:
                print("      ", w)
            fails += not ok
    print(f"{len(jobs)} exports, {fails} failed, {time.time() - t0:.0f}s total")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
