"""Render preview images of the EXPORTED STL geometry with Blender (Cycles).
Blender is only a renderer here; nothing is modelled in it.

  blender -b -P tools/render_blender.py -- <view> <out.png> [samples]
views: hero, roof_off, doors_open, roof_lifted, hinge_detail, roof_detail
Needs: build/placed/*.stl (tools/build.py --placed) and build/render/*.stl
(tools/render_export.py)."""
import bpy, os, sys, math, glob
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
VIEW, OUT = argv[0], argv[1]
SAMPLES = int(argv[2]) if len(argv) > 2 else 64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PL = os.path.join(ROOT, "build", "placed")
RD = os.path.join(ROOT, "build", "render")
XC, YC = 272.0, 168.0

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def material(name, rgb, rough, spec=0.4):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = spec
    return m

MATS = {"white": material("white", (0.80, 0.79, 0.75), 0.55),
        "black": material("black", (0.012, 0.012, 0.014), 0.5, 0.3),
        "grey": material("grey", (0.30, 0.295, 0.285), 0.85),
        "roof": material("roof", (0.045, 0.048, 0.055), 0.55, 0.3),
        "ground": material("ground", (0.72, 0.68, 0.60), 0.9)}

def imp(path, mat, dz=0.0, dxy=(0.0, 0.0)):
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    for o in set(bpy.data.objects) - before:
        o.data.materials.clear(); o.data.materials.append(MATS[mat])
        o.location.z += dz; o.location.x += dxy[0]; o.location.y += dxy[1]
        o.scale = (1, 1, 1)
    return

def colour(name):
    if name.startswith("floor_"): return "grey"
    if name.startswith("roof_"): return "roof"
    return "black"

PANELS = ("side_wall", "gable_wing", "partition", "stall_front", "pediment")
MOVERS = ("main_leaf", "stall_door", "casement", "bolt_bar")

def load_stable(roof=True, door=None, roof_dz=0.0, side_out=0.0, skip=()):
    for f in sorted(glob.glob(os.path.join(PL, "*.stl"))):
        n = os.path.basename(f)[:-4]
        if n.startswith("pin_") or any(n.startswith(s) for s in skip):
            continue
        if n.startswith("roof_"):
            if not roof: continue
            if n.startswith("roof_side"):
                sgn = -1 if n.endswith(("FL", "BL")) else 1
                imp(f, "roof", roof_dz * 0.55, (sgn * side_out, 0))
            else:
                imp(f, "roof", roof_dz)
            continue
        if n.startswith(PANELS):
            imp(os.path.join(RD, n + "__base.stl"), "white")
            imp(os.path.join(RD, n + "__trim.stl"), "black")
            continue
        if n.startswith(MOVERS) and door:
            ang = next((a for k, a in door.items() if n.startswith(k)), 0)
            if ang:
                imp(os.path.join(RD, f"{n}__open{ang}.stl"), "black"); continue
        imp(f, colour(n))

# ground
bpy.ops.mesh.primitive_plane_add(size=4000, location=(XC, YC, -0.05))
bpy.context.object.data.materials.append(MATS["ground"])

V = {
    "hero":        dict(cam=(-330, -560, 430), tgt=(282, 150, 120), lens=50),
    "roof_off":    dict(cam=(560, -330, 690), tgt=(272, 175, 40), lens=42, roof=False,
                        door={"main_leaf": 90, "stall_door": 70, "casement": 70, "bolt_bar": 70}),
    "doors_open":  dict(cam=(272, -640, 210), tgt=(272, 150, 140), lens=48,
                        door={"main_leaf": 90, "stall_door": 0, "casement": 90, "bolt_bar": 90}),
    "roof_lifted": dict(cam=(-430, -520, 560), tgt=(282, 168, 170), lens=46, roof_dz=110, side_out=40),
    "hinge_detail": dict(cam=(255, -95, 120), tgt=(196, 5, 85), lens=55, roof=False,
                         door={"main_leaf": 70, "stall_door": 70, "casement": 0, "bolt_bar": 70}),
    "roof_detail": dict(cam=(105, 40, 330), tgt=(190, 168, 235), lens=50, roof_dz=45, side_out=0,
                        skip=("roof_side", "roof_central_B")),
}
v = V[VIEW]
load_stable(roof=v.get("roof", True), door=v.get("door"), roof_dz=v.get("roof_dz", 0),
            side_out=v.get("side_out", 0), skip=v.get("skip", ()))

# camera
cam = bpy.data.cameras.new("cam"); cam.lens = v["lens"]; cam.clip_end = 10000
co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
co.location = Vector(v["cam"])
d = Vector(v["tgt"]) - co.location
co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

# light: key sun + soft fill from the sky
sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 2.6; sun.angle = math.radians(10)
so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(50), math.radians(-12), math.radians(-38))
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.82, 0.88, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55

sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = SAMPLES
try:
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception:
    sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.render.film_transparent = False
sc.view_settings.view_transform = "Standard"
sc.view_settings.look = "None"
sc.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
