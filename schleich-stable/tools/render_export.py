#!/usr/bin/env python3
"""Export the extra meshes used only for renders: panel base/trim splits and
open door poses -> build/render/. Usage: python3 tools/render_export.py"""
import concurrent.futures as cf, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from build import read_instances, export, ROOT  # noqa: E402

PANELS = ("side_wall", "gable_wing", "partition", "stall_front", "pediment")
jobs = []
for n, p, c in read_instances():
    if n.startswith(PANELS):
        for sp in ("base", "trim"):
            jobs.append((os.path.join(ROOT, "build", "render", f"{n}__{sp}.stl"),
                         {"part": f'"{n}"', "mode": '"placed"', "split": f'"{sp}"'}, None))
    if n.startswith(("main_leaf", "stall_door", "casement", "bolt_bar")):
        for ang in (70, 90):
            jobs.append((os.path.join(ROOT, "build", "render", f"{n}__open{ang}.stl"),
                         {"part": f'"{n}"', "mode": '"placed"', "door_ang": ang}, None))
with cf.ProcessPoolExecutor(4) as ex:
    bad = [o for o, ok, dt, w in ex.map(export, jobs) if not ok]
print(len(jobs), "exports,", len(bad), "failed", bad[:5])
