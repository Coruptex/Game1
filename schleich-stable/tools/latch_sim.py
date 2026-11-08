#!/usr/bin/env python3
"""Kinematic check of the T4 drop latch test rig (cad/lib/droplatch.scad).

The rig door turns about its hinge axis (door angle a, positive = open), the
lever turns about its peg (lift angle b, positive = tip up). For every door
angle the script finds the smallest lift at which the lever does not touch
the frame or its T-catch:

  * closing: the lift the ramp of the T-head has to produce while the door
    swings shut. A smooth curve that rises and then falls back to 0 means the
    lever rides up and drops in by itself; a sudden step would be a wall.
  * locked: with the lever down, the door may only open by the small play
    before the lever hits the T-head.
  * captive: the lever comes off its peg only when it points straight up.

  python3 tools/latch_sim.py          (exports the rig parts first)
Writes build/latch_sim.json and docs/images/latch_curve.png.
"""
import json, os, subprocess, sys
import numpy as np
import trimesh
import manifold3d as mf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "build", "latch_rig")
SCAD = os.path.join(ROOT, "cad", "tests", "coupons.scad")


def export(part):
    os.makedirs(OUT, exist_ok=True)
    f = os.path.join(OUT, part + ".stl")
    subprocess.run(["openscad", "-o", f, "-D", f'part="{part}"', SCAD], check=True, capture_output=True)
    return f


def dims():
    """read rig constants from OpenSCAD via echo"""
    tmp = os.path.join(OUT, "dims.scad")
    open(tmp, "w").write('use_part = 0;\ninclude <../../cad/tests/coupons.scad>\n'
                         'echo(str("RIG ", rig_px, " ", rig_py, " ", sd_t + fl_lift, " ", kz(dk_door), " ", fl_L(), " ", fl_lift_open));\n')
    echo = os.path.join(OUT, "dims.echo")
    subprocess.run(["openscad", "-o", echo, "-D", 'part="none"', tmp], capture_output=True, text=True, check=True)
    line = [l for l in open(echo).read().splitlines() if "RIG " in l][0]
    v = [float(x) for x in line.split("RIG ")[1].strip('"').split()]
    return dict(px=v[0], py=v[1], pz=v[2], kz=v[3], L=v[4], lift_open=v[5])


def to_mf(tm):
    return mf.Manifold(mf.Mesh(vert_properties=np.asarray(tm.vertices, np.float32), tri_verts=np.asarray(tm.faces, np.uint32)))


def rot_door(a_deg, kz):
    """door opening: rotation about the hinge axis (x = 0, z = kz, along y), free edge toward +z"""
    a = np.radians(a_deg)
    T = trimesh.transformations.translation_matrix([0, 0, kz])
    R = trimesh.transformations.rotation_matrix(-a, [0, 1, 0])
    return T @ R @ np.linalg.inv(T)


def lever_pose(b_deg, d):
    T = trimesh.transformations.translation_matrix([d["px"], d["py"], d["pz"]])
    R = trimesh.transformations.rotation_matrix(np.radians(b_deg), [0, 0, 1])
    return T @ R


def main():
    parts = {p: trimesh.load(export(p), force="mesh") for p in ("rig_frame", "rig_door", "fl_lever")}
    d = dims()
    frame = to_mf(parts["rig_frame"])
    door0 = parts["rig_door"]
    lever0 = parts["fl_lever"]

    def hit(a, b, with_door=False):
        lev = lever0.copy(); lev.apply_transform(rot_door(a, d["kz"]) @ lever_pose(b, d))
        v = (to_mf(lev) ^ frame).volume()
        if with_door:
            dr = door0.copy(); dr.apply_transform(rot_door(a, d["kz"]))
            v2 = (to_mf(lev) ^ to_mf(dr)).volume()
            return v, v2
        return v

    res = {"dims": d}
    # 1) closed and locked: nothing touches
    v_frame, v_door = hit(0, 0, True)
    dr = door0.copy()
    res["closed"] = {"lever_frame_mm3": round(v_frame, 4), "lever_door_mm3": round(v_door, 4),
                     "door_frame_mm3": round((to_mf(dr) ^ frame).volume(), 4)}
    # 2) locked play: door opening angle at which the lowered lever meets the T-head
    play = None
    for a in np.arange(0.05, 8.0, 0.05):
        if hit(a, 0) > 1e-3:
            play = float(a); break
    r_tip = float(np.hypot(d["px"] + d["L"], d["pz"] - d["kz"]))
    res["locked"] = {"blocked_at_deg": play, "play_mm_at_catch": round(np.radians(play) * r_tip, 2) if play else None}
    # 3) lift needed vs door angle (opening = closing path, the lever must clear the catch)
    curve = []
    for a in np.arange(0.0, 14.01, 0.25):
        lo, hi = 0.0, 40.0
        if hit(a, 0) <= 1e-3:
            curve.append((float(a), 0.0)); continue
        if hit(a, hi) > 1e-3:
            curve.append((float(a), None)); continue
        for _ in range(14):
            mid = (lo + hi) / 2
            if hit(a, mid) > 1e-3: lo = mid
            else: hi = mid
        curve.append((float(a), round(hi, 2)))
    res["lift_curve"] = curve
    lifts = [b for _, b in curve if b is not None]
    res["max_lift_deg"] = max(lifts) if lifts else None
    res["max_lift_mm_at_notch"] = round(np.radians(max(lifts)) * d["L"], 2) if lifts else None
    steps = [abs(curve[i + 1][1] - curve[i][1]) for i in range(len(curve) - 1)
             if curve[i][1] is not None and curve[i + 1][1] is not None]
    res["largest_step_deg_per_0.25deg"] = max(steps) if steps else None
    # 4) captive: with the lever level it cannot be pulled off (+z), pointing up it can
    def pull(b, dz):
        lev = lever0.copy(); lev.apply_transform(trimesh.transformations.translation_matrix([0, 0, dz]) @ lever_pose(b, d))
        dr = door0.copy()
        return (to_mf(lev) ^ to_mf(dr)).volume()
    res["captive"] = {"pull_off_level_mm3": round(pull(0, 2.0), 3), "pull_off_up_mm3": round(pull(90, 6.0), 3),
                      "pull_off_45_mm3": round(pull(45, 2.0), 3)}
    # 5) tolerance: stall front shifted along the panel (it floats +-0.5 mm in
    #    its post grooves, plus hinge play) and door height (knuckle gaps)
    tol = []
    base = parts["rig_frame"]
    for dx in (-1.0, 0.0, 1.0):
        for dy in (-0.4, 0.0, 0.4):
            fr = base.copy(); fr.apply_translation([dx, dy, 0])
            fm = to_mf(fr)
            def h2(a, b):
                lev = lever0.copy(); lev.apply_transform(rot_door(a, d["kz"]) @ lever_pose(b, d))
                return (to_mf(lev) ^ fm).volume()
            closed_free = h2(0, 0) <= 1e-3
            blocked = next((float(a) for a in np.arange(0.05, 8, 0.05) if h2(a, 0) > 1e-3), None)
            mx = 0.0
            for a in np.arange(0.0, 12.01, 0.5):
                if h2(a, 0) <= 1e-3: continue
                lo, hi = 0.0, 40.0
                for _ in range(10):
                    mid = (lo + hi) / 2
                    if h2(a, mid) > 1e-3: lo = mid
                    else: hi = mid
                mx = max(mx, hi)
            tol.append({"dx": dx, "dy": dy, "closed_free": closed_free, "blocked_at_deg": blocked, "max_lift_deg": round(mx, 1)})
    res["tolerance"] = tol
    os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
    json.dump(res, open(os.path.join(ROOT, "build", "latch_sim.json"), "w"), indent=1)
    print(json.dumps({k: v for k, v in res.items() if k != "lift_curve"}, indent=1))
    print("lift curve (door angle deg, lever lift deg):")
    print("  " + "  ".join(f"{a:.2f}:{b}" for a, b in curve))
    # plot
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        xs = [a for a, b in curve if b is not None]; ys = [b for a, b in curve if b is not None]
        fig, ax = plt.subplots(figsize=(6.4, 3.4), dpi=150)
        ax.plot(xs, ys, color="#2b5d8a", lw=2)
        ax.set_xlabel("Tür-Öffnungswinkel (Grad)"); ax.set_ylabel("nötiger Hub des Riegels (Grad)")
        ax.set_title("Fallriegel T4: Riegel gleitet über die Rampe und fällt ein")
        ax.grid(alpha=0.3); fig.tight_layout()
        fig.savefig(os.path.join(ROOT, "docs", "images", "latch_curve.png"))
    except Exception as e:  # noqa: BLE001
        print("plot skipped:", e)


if __name__ == "__main__":
    main()
