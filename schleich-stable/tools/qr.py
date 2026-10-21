#!/usr/bin/env python3
"""Quick render helper used during development.

usage: qr.py PART [--placed] [--png] [--stl] [--cam x,y,z,rx,ry,rz,d] [--out DIR] [-D k=v ...]
Renders cad/stable.scad with part=PART, prints mesh statistics.
"""
import argparse, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
CAD = os.path.join(HERE, "..", "cad", "stable.scad")


def run(cmd):
    t = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    msgs = [l for l in (r.stdout + r.stderr).splitlines()
            if any(k in l for k in ("WARNING", "ERROR", "ECHO"))]
    return r.returncode, time.time() - t, msgs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part")
    ap.add_argument("--placed", action="store_true")
    ap.add_argument("--png", action="store_true")
    ap.add_argument("--stl", action="store_true")
    ap.add_argument("--cam", default=None)
    ap.add_argument("--size", default="1200,900")
    ap.add_argument("--out", default=os.environ.get("QR_OUT", "/tmp"))
    ap.add_argument("-D", action="append", default=[])
    a = ap.parse_args()
    mode = "placed" if a.placed else "print"
    defs = ["-D", f'part="{a.part}"', "-D", f'mode="{mode}"']
    for d in a.D:
        defs += ["-D", d]
    base = os.path.join(a.out, a.part + ("_placed" if a.placed else ""))
    if a.stl or not a.png:
        rc, dt, msgs = run(["openscad", "-o", base + ".stl", *defs, CAD])
        print(f"STL rc={rc} {dt:.1f}s", *msgs[:15], sep="\n  ")
        if rc == 0:
            import trimesh
            m = trimesh.load(base + ".stl")
            b = m.bounds
            print(f"  bounds {b[0].round(2).tolist()} -> {b[1].round(2).tolist()}  size {(b[1]-b[0]).round(1).tolist()}")
            print(f"  watertight={m.is_watertight} bodies={len(m.split(only_watertight=False))} faces={len(m.faces)} vol={m.volume/1000:.1f} cm3")
    if a.png:
        cam = ["--camera=" + a.cam] if a.cam else ["--viewall", "--autocenter"]
        rc, dt, msgs = run(["xvfb-run", "-a", "-s", "-screen 0 1600x1200x24", "openscad", "-o", base + ".png",
                            "--imgsize=" + a.size, "--colorscheme=Tomorrow", *cam, *defs, CAD])
        print(f"PNG rc={rc} {dt:.1f}s -> {base}.png", *msgs[:15], sep="\n  ")


if __name__ == "__main__":
    main()
