"""Renders of the post blocks (print aid against tipping): whole block and a
close-up of the fin with its break-off teeth in a post groove
-> build/blocks/*.png (tools/annotate_blocks.py -> docs/images/pfostenblock.jpg)

  blender -b -P tools/render_blocks.py -- [samples]
Needs build/blocks/posts_block_hinge_{posts,aids}.stl and the teeth (block STL)."""
import bpy, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 48
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "blocks")


def mat(rgb, rough=0.5):
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
    return o


def shot(block, out, cam_loc, target, lens, posts="_posts"):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = 900, 1000
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.85, 0.89, 1)
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.0
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(45), math.radians(15), math.radians(-40))
    imp(os.path.join(RD, block + posts + ".stl"), mat((0.13, 0.13, 0.14)))
    imp(os.path.join(RD, block + "_aids.stl"), mat((0.85, 0.55, 0.12)))          # print aid: orange
    imp(os.path.join(RD, block + "_teeth.stl"), mat((0.85, 0.10, 0.10)))         # teeth: red
    cam = bpy.data.cameras.new("c"); cam.lens = lens
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = Vector(cam_loc)
    co.rotation_euler = (Vector(target) - co.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.join(RD, out)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out, flush=True)


shot("posts_block_hinge", "block_hinge.png", (230, -190, 230), (0, 34, 100), 50)
# cutaway: the posts of the -x row left out, view onto the spine and the fins
shot("posts_block_hinge", "block_cutaway.png", (-230, -150, 200), (6, 34, 95), 50, "_posts_half")
