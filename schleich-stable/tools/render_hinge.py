"""Explanatory render of a hinge: door post (grey), stall door (black) and
the filament pin (orange), pushed halfway up from below
-> build/render/scharnier_raw.png; tools/annotate_hinge.py adds the labels
-> docs/images/scharnier.png

  blender -b -P tools/render_hinge.py -- [samples]
Needs build/placed and build/swing (tools/build.py --placed --swing)."""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 96
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
D = json.load(open(os.path.join(ROOT, "build", "dims.json")))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def mat(rgb, rough=0.55):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def imp(path, m, dz=0.0):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.transform(Matrix.Translation((0, 0, dz)))
    o.data.materials.append(m)
    return o


imp(os.path.join(ROOT, "build", "placed", "post_jamb_FL.stl"), mat((0.55, 0.55, 0.53)))
imp(os.path.join(ROOT, "build", "swing", "stall_door_FL_060.stl"), mat((0.03, 0.03, 0.035)))
imp(os.path.join(ROOT, "build", "placed", "pin_stall_FL.stl"), mat((0.95, 0.35, 0.02), 0.35), dz=-45)

ax = Vector((D["sd_ax_x"], D["sd_ax_y"], 0))
cam = bpy.data.cameras.new("c"); cam.lens = 50; cam.clip_end = 5000
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
co.location = ax + Vector((-85, 205, 70))
d = (ax + Vector((6, 0, 30))) - co.location
co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

sun = bpy.data.lights.new("s", "SUN"); sun.energy = 3.0
so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(55), 0, math.radians(150))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.86, 0.88, 0.91, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 1200, 1000
sc.view_settings.view_transform = "Standard"
sc.render.filepath = os.path.join(ROOT, "build", "render", "scharnier_raw.png")
bpy.ops.render.render(write_still=True)
print("RENDERED", sc.render.filepath)
