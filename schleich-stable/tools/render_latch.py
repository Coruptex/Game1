"""Renders of the T4 drop latch test rig, assembled and standing upright:
locked, and lever lifted with the door opening -> build/latch_rig/*.png
(tools/annotate_latch.py labels them -> docs/images/fallriegel_T4.jpg)

  blender -b -P tools/render_latch.py -- [samples]
Needs build/latch_rig/{rig_frame,rig_door,fl_lever}.stl (tools/latch_sim.py)."""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 48
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "latch_rig")
D = json.load(open(os.path.join(ROOT, "build", "latch_sim.json")))["dims"]

# rig frame (x, y = height, z = thickness, aisle side +z) -> world: x, -z, y
TO_WORLD = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1000, 900
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.85, 0.89, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.0
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(55), math.radians(15), math.radians(-35))
    return sc


def mat(rgb, rough=0.5):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def imp(path, m, M):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.transform(M)
    o.data.materials.append(m)
    return o


def door_rot(a):
    """door opening about the hinge axis (x = 0, z = kz along y), free edge toward +z"""
    T = Matrix.Translation((0, 0, D["kz"]))
    return T @ Matrix.Rotation(math.radians(-a), 4, "Y") @ T.inverted()


def lever_pose(b):
    return Matrix.Translation((D["px"], D["py"], D["pz"])) @ Matrix.Rotation(math.radians(b), 4, "Z")


def scene(a, b, out, cam_loc, target, lens=55):
    sc = reset()
    frame_m, door_m, lever_m = mat((0.20, 0.42, 0.62)), mat((0.06, 0.06, 0.07)), mat((0.90, 0.48, 0.08), 0.4)
    imp(os.path.join(RD, "rig_frame.stl"), frame_m, TO_WORLD)
    imp(os.path.join(RD, "rig_door.stl"), door_m, TO_WORLD @ door_rot(a))
    imp(os.path.join(RD, "fl_lever.stl"), lever_m, TO_WORLD @ door_rot(a) @ lever_pose(b))
    cam = bpy.data.cameras.new("c"); cam.lens = lens
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector(cam_loc)
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(RD, out)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out, flush=True)


VIEW = ((75, -150, 75), (30, 0, 36), 50)
DETAIL = ((95, -70, 62), (46, -6, 36), 60)
scene(0, 0, "rig_locked.png", *VIEW)
scene(0, 0, "rig_locked_detail.png", *DETAIL)
scene(22, 16, "rig_open.png", *VIEW)


# old click latch (T1 coupons latch_door + latch_stile, e = 0.8), seen from above
def old_latch():
    sc = reset()
    sc.render.resolution_x, sc.render.resolution_y = 1000, 760
    I = Matrix.Identity(4)
    imp(os.path.join(RD, "old_latch_door.stl"), mat((0.06, 0.06, 0.07)), I)
    # the stile as installed next to the door edge (door edge x = 30, gap 1 mm)
    imp(os.path.join(RD, "old_latch_stile.stl"), mat((0.20, 0.42, 0.62)), Matrix.Translation((31.0, 0, 0)))
    cam = bpy.data.cameras.new("c"); cam.lens = 60
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector((31, 26, 120))
    co.rotation_euler = (Vector((31, 28, 0)) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(RD, "old_click_latch.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED old_click_latch.png", flush=True)


old_latch()
