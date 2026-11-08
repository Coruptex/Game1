"""Close-up renders of the casement window FL (front-left gable wing):
old design open, new design shut / open 90 deg / wide open, and a grazing
detail of the hinge straps -> build/render_window/*.png
(tools/annotate_window.py adds the labels -> docs/images/fenster_*.png)

  blender -b -P tools/render_window.py -- <max_angle> [samples]
Needs build/render_window/{old,new}_gw_{base,trim}.stl, old_cs_*.stl,
build/swing_fine/casement_FL_*.stl and build/placed/ (tools/build.py)."""
import bpy, math, os, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MAXA = int(argv[0]) if argv else 150
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RW = os.path.join(ROOT, "build", "render_window")
PL = os.path.join(ROOT, "build", "placed")
SW = os.path.join(ROOT, "build", "swing_fine")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1100, 850
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.80, 0.84, 0.88, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.2
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    return sc


MATS = {}
def mat(name, rgb, rough=0.6):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    MATS[name] = m
    return m


def imp(path, m):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.materials.append(m)
    return o


def scene(gw, cs, extra=True):
    MATS.clear()
    sc = reset()
    white, black = mat("white", (0.86, 0.85, 0.80)), mat("black", (0.035, 0.035, 0.04), 0.45)
    imp(os.path.join(RW, gw + "_base.stl"), white)
    imp(os.path.join(RW, gw + "_trim.stl"), black)
    imp(cs, mat("case", (0.05, 0.05, 0.06), 0.4))
    if extra:
        imp(os.path.join(PL, "post_corner_FL.stl"), mat("post", (0.15, 0.15, 0.16)))
        imp(os.path.join(PL, "side_wall_FL.stl"), white)
        imp(os.path.join(PL, "floor_LF.stl"), mat("floor", (0.55, 0.54, 0.50)))
        pin = os.path.join(PL, "pin_case_FL.stl")
        if os.path.exists(pin) and "new" in gw:
            imp(pin, mat("pin", (0.95, 0.35, 0.02), 0.35))
    return sc


def shot(sc, loc, target, lens, out):
    cam = bpy.data.cameras.new("c"); cam.lens = lens; cam.clip_end = 5000
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector(loc)
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(RW, out)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out, flush=True)


VIEW = ((150, -175, 140), (80, -12, 99), 62)        # front right, slightly from above
DETAIL = ((28, -118, 112), (64, -2, 92), 85)        # from the front left onto the hinge and the frame band
if "details" not in argv:
    shot(scene("old_gw", os.path.join(RW, "old_cs_090.stl")), *VIEW, "a_old_open90.png")
    shot(scene("new_gw", os.path.join(SW, "casement_FL_000.stl")), *VIEW, "b_new_closed.png")
    shot(scene("new_gw", os.path.join(SW, "casement_FL_090.stl")), *VIEW, "c_new_open90.png")
    shot(scene("new_gw", os.path.join(SW, f"casement_FL_{MAXA:03d}.stl")), *VIEW, "d_new_openmax.png")
shot(scene("new_gw", os.path.join(SW, "casement_FL_000.stl")), *DETAIL, "e_new_detail_closed.png")
shot(scene("new_gw", os.path.join(SW, "casement_FL_045.stl")), *DETAIL, "f_new_detail_open45.png")
