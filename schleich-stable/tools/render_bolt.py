"""How the main-door slide bolt works, and what the T4 bolt test plate is:
locked, unlocked, gate open, test plate with the bar -> build/render_bolt/*.png
plus the pixel positions of the labelled points (points.json) for
tools/annotate_bolt.py.

  blender -b -P tools/render_bolt.py -- [samples]
Needs build/placed/*.stl and build/swing/*_030.stl (tools/build.py --placed --swing)."""
import bpy, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 48
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PL, SW, OUT = (os.path.join(ROOT, "build", d) for d in ("placed", "swing", "render_bolt"))
os.makedirs(OUT, exist_ok=True)
XC, BZ, TRAVEL = 234.0, 92.0, 13.0          # aisle centre, bolt height, bolt travel (cad/parts/doors.scad)
RES = (1000, 900)
points = {}


def mat(rgb, rough=0.5):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def imp(path, m, loc=(0, 0, 0), rot=(0, 0, 0)):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.materials.append(m)
    o.location = loc; o.rotation_euler = rot
    return o


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.85, 0.89, 1)
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.0
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(-10), math.radians(-25))
    return sc


def shoot(sc, name, cam_loc, target, lens, pts):
    cam = bpy.data.cameras.new("c"); cam.lens = lens
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector(cam_loc)
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    points[name] = {k: [round(c * s) for c, s in zip(world_to_camera_view(sc, co, Vector(p))[:2], RES)]
                    for k, p in pts.items()}
    for v in points[name].values():
        v[1] = RES[1] - v[1]                    # image y runs downward
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name, flush=True)


DOOR, WHITE, POST, FLOOR, BOLT = (0.06, 0.06, 0.07), (0.86, 0.85, 0.80), (0.09, 0.09, 0.10), (0.55, 0.54, 0.50), (0.95, 0.45, 0.05)


def gate(ang, bolt_dx, bolt_file):
    sc = reset()
    suf = f"_{ang:03d}" if ang else ""
    src = SW if ang else PL
    for n in ("main_leaf_FL", "main_leaf_FR"):
        imp(os.path.join(src, n + suf + ".stl"), mat(DOOR, 0.45))
    imp(os.path.join(src, bolt_file + suf + ".stl"), mat(BOLT, 0.4), loc=(bolt_dx, 0, 0))
    for n in ("post_jamb_FL", "post_jamb_FR"):
        imp(os.path.join(PL, n + ".stl"), mat(POST, 0.45))
    imp(os.path.join(PL, "pediment_F.stl"), mat(WHITE))
    imp(os.path.join(PL, "floor_AF.stl"), mat(FLOOR))
    return sc


# 1 locked, 2 unlocked (doors still closed), close-ups from the front
lp = {"loopL": (XC - 6, -17, BZ + 4), "loopR": (XC + 11, -17, BZ + 4), "seam": (XC, -4, BZ - 22),
      "knob": (XC + 23, -18, BZ), "barL": (XC - 11.5, -17, BZ)}
sc = gate(0, 0, "bolt_bar_F")
shoot(sc, "locked", (XC + 35, -175, BZ + 45), (XC + 2, -10, BZ - 3), 85, lp)
up = dict(lp); up["knob"] = (XC + 23 + TRAVEL, -18, BZ); up["barL"] = (XC - 11.5 + TRAVEL, -17, BZ)
sc = gate(0, TRAVEL, "bolt_bar_F")
shoot(sc, "unlocked", (XC + 35, -175, BZ + 45), (XC + 2, -10, BZ - 3), 85, up)
# wide views: gate shut and locked, and open 30 deg (the bar rides on the right leaf)
sc = gate(0, 0, "bolt_bar_F")
shoot(sc, "closed", (XC + 60, -330, BZ + 120), (XC, -20, BZ - 5), 50, {"bolt": (XC + 5, -17, BZ)})
sc = gate(30, 0, "bolt_bar_F")
shoot(sc, "open", (XC + 60, -330, BZ + 120), (XC, -20, BZ - 5), 50, {"bolt": (XC + 25, -40, BZ)})
# 4 the T4 test plate: the same two loops at their real spacing on one plate,
# stood up like the gate (plate face toward -Y), the bar pushed through
sc = reset()
rx = (math.radians(90), 0, 0)                   # plate z (face) -> -Y, plate y -> +Z
imp(os.path.join(ROOT, "stl", "tests", "T4_bolt_test.stl"), mat(DOOR, 0.45), loc=(0, 0, 0), rot=rx)
# bar: plate frame x 10.5 (left end), tunnel centre y 13, z 8.2 -> world (x, -z, y)
imp(os.path.join(ROOT, "stl", "bolt_bar.stl"), mat(BOLT, 0.4), loc=(10.5, -5.2, 10.0), rot=rx)
shoot(sc, "testplate", (52, -150, 60), (32, -6, 12), 70,
      {"loopL": (16, -12, 17), "loopR": (33, -12, 17), "knob": (45, -14, 13)})
json.dump(points, open(os.path.join(OUT, "points.json"), "w"), indent=1)
