"""Close-up of the front-left corner: corner post under the side roof,
before (flat top) and after (top follows the roof pitch)
-> build/render_window/post_old.png, post_new.png

  blender -b -P tools/render_post.py -- [samples]"""
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RW, PL, RD = (os.path.join(ROOT, "build", d) for d in ("render_window", "placed", "render"))


def mat(rgb, rough=0.55):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def imp(path, m):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.materials.append(m)


def shot(post, out):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 1000, 900
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.85, 0.89, 1)
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.2
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-30))
    white, black = mat((0.86, 0.85, 0.80)), mat((0.035, 0.035, 0.04), 0.45)
    for n in ("gable_wing_FL", "side_wall_FL"):
        imp(os.path.join(RD, n + "__base.stl"), white); imp(os.path.join(RD, n + "__trim.stl"), black)
    imp(post, mat((0.10, 0.10, 0.11)))
    imp(os.path.join(PL, "roof_side_L.stl"), mat((0.26, 0.27, 0.30)))
    imp(os.path.join(PL, "floor_LF.stl"), mat((0.55, 0.54, 0.50)))
    cam = bpy.data.cameras.new("c"); cam.lens = 50
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector((55, -95, 150))
    co.rotation_euler = (Vector((2, -2, 120)) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(RW, out)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out, flush=True)


shot(os.path.join(RW, "old_post_corner_FL.stl"), "post_old.png")
shot(os.path.join(PL, "post_corner_FL.stl"), "post_new.png")
