#!/usr/bin/env python3
"""Key dimensions of the current configuration, read from OpenSCAD
(cad/stable.scad with part = "dims") so the Python tools never hard-code
them. Cached in build/dims.json, refreshed when any .scad file is newer.

  python3 tools/dims.py        # print them
  from dims import dims; d = dims(); d["XC"]
"""
import glob, json, os, re, subprocess, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CACHE = os.path.join(ROOT, "build", "dims.json")


def dims():
    scad = glob.glob(os.path.join(ROOT, "cad", "**", "*.scad"), recursive=True)
    if os.path.exists(CACHE) and os.path.getmtime(CACHE) > max(os.path.getmtime(f) for f in scad):
        return json.load(open(CACHE))
    out = os.path.join(tempfile.gettempdir(), f"stable_dims_{os.getpid()}.echo")
    subprocess.run(["openscad", "-o", out, "-D", 'part="dims"', os.path.join(ROOT, "cad", "stable.scad")],
                   capture_output=True, text=True, check=True)
    d = {k: float(v) for k, v in re.findall(r'DIM (\w+)=([-\d.e]+)', open(out).read())}
    os.remove(out)
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(d, open(CACHE, "w"), indent=1)
    return d


if __name__ == "__main__":
    for k, v in dims().items():
        print(f"{k:16s} {v:g}")
