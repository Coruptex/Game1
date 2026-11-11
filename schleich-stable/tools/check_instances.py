#!/usr/bin/env python3
"""Can every installed part be made from its print file by ROTATION alone?

The BOM prints one STL several times (e.g. 4 corner posts). That only works
if each instance in the assembly is a rotated copy of the print part. If an
instance is the MIRROR image, it needs its own print file. For every instance
this script tries all 48 axis-aligned orientations (24 rotations, 24 with a
mirror) of the print part, aligns the bounding boxes and measures the
symmetric difference to the placed instance (build/placed/). Parts placed at
other angles (sloped roofs) fall back to ICP registration.

  python3 tools/check_instances.py      (after tools/build.py --placed)
"""
import itertools, os, sys
import numpy as np
import trimesh
import manifold3d as mf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from build import read_instances  # noqa: E402

TOL = 2e-3      # relative symmetric difference that still counts as "the same"
# known, checked differences that do not affect the fit
COSMETIC = {"side_wall": (3e-3, "one decorative board joint (0.55 mm deep) sits at the other end of the wall: "
                                "plank_profile2d skips the first joint after the panel edge; fit identical")}


def to_mf(v, f):
    return mf.Manifold(mf.Mesh(vert_properties=np.asarray(v, np.float32), tri_verts=np.asarray(f, np.uint32)))


def xor_rel(pv, pf, q):
    a = to_mf(pv, pf)
    b = to_mf(q.vertices, q.faces)
    return ((a - b).volume() + (b - a).volume()) / q.volume


def signed_perms():
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product((1, -1), repeat=3):
            M = np.zeros((3, 3))
            for r, (c, s) in enumerate(zip(perm, signs)):
                M[r, c] = s
            yield M


def check(print_mesh, placed):
    best = {1: (9.0, None), -1: (9.0, None)}
    qlo, qhi = placed.bounds
    qc, qe = (qlo + qhi) / 2, qhi - qlo
    for M in signed_perms():
        v = print_mesh.vertices @ M.T
        lo, hi = v.min(0), v.max(0)
        if np.abs((hi - lo) - qe).max() > 0.05:
            continue
        v = v + (qc - (lo + hi) / 2)
        f = print_mesh.faces if np.linalg.det(M) > 0 else print_mesh.faces[:, ::-1]
        r = xor_rel(v, f, placed)
        d = int(round(np.linalg.det(M)))
        if r < best[d][0]:
            best[d] = (r, M)
    if best[1][0] > TOL and best[-1][0] > TOL:
        # not axis-aligned (sloped roof units): ICP with and without mirror
        for refl, d in ((False, 1), (True, -1)):
            T, cost = trimesh.registration.mesh_other(print_mesh, placed, samples=3000, icp_first=20, icp_final=200,
                                                      reflection=refl, seed=1)
            if refl and np.linalg.det(T[:3, :3]) > 0:
                continue
            v = trimesh.transform_points(print_mesh.vertices, T)
            f = print_mesh.faces if np.linalg.det(T[:3, :3]) > 0 else print_mesh.faces[:, ::-1]
            r = xor_rel(v, f, placed)
            if r < best[d][0]:
                best[d] = (r, T)
    return best[1][0], best[-1][0]


def main():
    rows, bad = [], []
    cache = {}
    for inst, part, colour in read_instances():
        f = os.path.join(ROOT, "build", "placed", inst + ".stl")
        if part not in cache:
            cache[part] = trimesh.load(os.path.join(ROOT, "stl", part + ".stl"), force="mesh")
        placed = trimesh.load(f, force="mesh")
        if inst.startswith("stall_door_"):
            # the placed stall door carries its lever: compare without it
            placed = trimesh.load(os.path.join(ROOT, "build", "manual", "stl", "sd_closed_" + inst[-2:] + ".stl"), force="mesh")
        rot, mir = check(cache[part], placed)
        verdict = "ok" if rot <= TOL else ("MIRROR NEEDED" if mir <= TOL else "NO MATCH")
        if verdict != "ok" and part in COSMETIC and rot <= COSMETIC[part][0]:
            verdict = "ok (cosmetic: " + COSMETIC[part][1] + ")"
        rows.append((inst, part, rot, mir, verdict))
        if not verdict.startswith("ok"):
            bad.append(inst)
        print(f"{inst:18s} {part:14s} rotation {rot:9.5f}  mirror {mir:9.5f}  {verdict}", flush=True)
    print("problems:", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
