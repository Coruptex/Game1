"""How to test the roof tabs (T2 tab plate + T3a tab key): the plate turned
over (pockets up), the key held upright like a wall, its tab above pocket
"25" -> build/render_tabs/tabs.png + points.json (tools/annotate_tabs.py)

  blender -b -P tools/render_tabs.py -- [samples]"""
import bpy, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 48
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "build", "render_tabs")
os.makedirs(OUT, exist_ok=True)
RES = (1100, 800)


def mat(rgb, rough=0.5):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def imp(path, m, loc, rot):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.data.materials.append(m); o.location = loc; o.rotation_euler = rot
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = RES
sc.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.85, 0.89, 1)
sun = bpy.data.lights.new("s", "SUN"); sun.energy = 2.2
so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(40), math.radians(-15), math.radians(-30))
# plate 70 x 30 x 3.6, pockets (from the bed side) at x = 12 / 35 / 58, y = 15, 1.9 deep.
# Turned over about its long edge (x axis): pockets face up, x order unchanged.
imp(os.path.join(ROOT, "stl", "tests", "tab_plate.stl"), mat((0.12, 0.12, 0.14)), (0, 30, 3.6), (math.radians(180), 0, 0))
# key 40 x 14 x 2.8 with the tab (x 15..25) beyond y = 14. Rotated -90 deg about x:
# local y -> -z (tab points down), local z -> +y (thickness across the pocket)
imp(os.path.join(ROOT, "stl", "tests", "tab_key.stl"), mat((0.95, 0.45, 0.05)), (15, 13.6, 3.6 + 16 + 15.6), (math.radians(-90), 0, 0))
cam = bpy.data.cameras.new("c"); cam.lens = 60
co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
co.location = Vector((40, -70, 120))
co.rotation_euler = (Vector((35, 16, 14)) - co.location).to_track_quat("-Z", "Y").to_euler()
bpy.context.view_layer.update()
pts = {"p15": (12, 15, 3.6), "p25": (35, 15, 3.6), "p35": (58, 15, 3.6), "tab": (35, 15, 3.6 + 16 + 0.8),
       "key": (50, 15, 3.6 + 16 + 10)}
P = {}
for k, p in pts.items():
    v = world_to_camera_view(sc, co, Vector(p))
    P[k] = [round(v[0] * RES[0]), round(RES[1] - v[1] * RES[1])]
json.dump(P, open(os.path.join(OUT, "points.json"), "w"), indent=1)
sc.render.filepath = os.path.join(OUT, "tabs.png")
bpy.ops.render.render(write_still=True)
print("RENDERED tabs", flush=True)
