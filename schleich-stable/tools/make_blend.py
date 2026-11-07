"""Build a Blender scene of the stable from the EXPORTED STL files
-> blender/stall_kompakt.blend. Blender is only a viewer here: nothing is
modelled in it, so the scene shows exactly the geometry that gets printed.

  blender -b -P tools/make_blend.py

Needs build/placed (tools/build.py --placed --swing), build/render
(tools/render_export.py), build/render/horses (tools/validate.py),
build/plates (tools/plates.py) and build/dims.json (tools/dims.py).

Collections (outliner; the eye icon shows / hides them):
  Stall (zusammengebaut)        the assembled stable, doors closed
  Tueren offen (90 Grad)        alternative door / window poses   [hidden]
  Scharnierstifte               the 12 filament pins, orange      [hidden]
  Pferd-Platzhalter             design-horse proxies 170x53x120   [hidden]
  Druckplatten                  all print plates on 256 mm beds   [hidden]
  Kameras                       10 named views (Numpad 0 = active camera)
Units: millimetres (1 Blender unit = 1 m, display in mm).
"""
import bpy, bmesh, glob, json, math, os
from mathutils import Matrix, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PL = os.path.join(ROOT, "build", "placed")
RD = os.path.join(ROOT, "build", "render")
OUT = os.path.join(ROOT, "blender", "stall_kompakt.blend")
D = json.load(open(os.path.join(ROOT, "build", "dims.json")))
MM = 0.001                                   # STL millimetres -> metres
C = Vector((D["XC"] * MM, D["YC"] * MM, 0))  # building centre on the table

# factory start-up keeps the default workspaces; drop its cube, camera, light
bpy.ops.wm.read_factory_settings(use_empty=False)
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
for m in list(bpy.data.materials):
    bpy.data.materials.remove(m)
sc = bpy.context.scene
sc.unit_settings.system = "METRIC"
sc.unit_settings.length_unit = "MILLIMETERS"
sc.unit_settings.scale_length = 1.0


# ------------------------------------------------------------- materials
def material(name, rgb, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1)              # solid viewport colour
    return m


MAT = {"white": material("Weiss (Waende)", (0.80, 0.79, 0.75), 0.55),
       "black": material("Schwarz (Pfosten, Tueren, Zierleisten)", (0.02, 0.02, 0.025), 0.5),
       "grey": material("Grau (Boden)", (0.33, 0.32, 0.30), 0.85),
       "roof": material("Dunkelgrau (Dach)", (0.06, 0.065, 0.075), 0.55),
       "pin": material("Orange (Scharnierstift aus Filament)", (0.95, 0.35, 0.02), 0.4),
       "horse": material("Braun (Pferd-Platzhalter)", (0.36, 0.20, 0.10), 0.6),
       "bed": material("Druckbett", (0.55, 0.55, 0.52), 0.9)}


# ----------------------------------------------------------- collections
def coll(name, parent=None, hidden=False):
    c = bpy.data.collections.new(name)
    (parent or sc.collection).children.link(c)
    c["hidden"] = hidden
    return c


def stl(path, name, mat, col, offset=(0, 0, 0)):
    """import one STL (mm), merge duplicate vertices, smooth-shade with a 30 deg
    auto-smooth so cylinders look round and edges stay crisp"""
    before = set(bpy.data.objects)
    try:
        bpy.ops.wm.stl_import(filepath=path)
    except Exception:
        bpy.ops.import_mesh.stl(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    o.name = name
    me = o.data
    me.name = name
    me.transform(Matrix.Scale(MM, 4) @ Matrix.Translation(Vector(offset)))
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bm.to_mesh(me); bm.free()
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    if hasattr(me, "use_auto_smooth"):                 # Blender <= 4.0
        me.use_auto_smooth = True
        me.auto_smooth_angle = math.radians(30)
    me.materials.clear(); me.materials.append(MAT[mat])
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    return o


def join(objs, name):
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


GROUPS = [("Boden", ("floor_",)), ("Pfosten", ("post_",)),
          ("Waende", ("side_wall", "gable_wing", "partition", "stall_front", "pediment")),
          ("Tueren und Fenster", ("main_leaf", "stall_door", "casement", "bolt_bar")),
          ("Dach", ("roof_",))]
PANELS = GROUPS[2][1]
MOVERS = GROUPS[3][1]


def colour(n):
    return "grey" if n.startswith("floor_") else "roof" if n.startswith("roof_") else "black"


main = coll("Stall (zusammengebaut)")
sub = {g: coll(g, main) for g, _ in GROUPS}
names = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(PL, "*.stl")))
for n in names:
    if n.startswith("pin_"):
        continue
    g = next(g for g, pre in GROUPS if n.startswith(pre))
    if n.startswith(PANELS):                  # two-tone panels: white boards + black trims
        a = stl(os.path.join(RD, n + "__base.stl"), n, "white", sub[g])
        b = stl(os.path.join(RD, n + "__trim.stl"), n + "_trim", "black", sub[g])
        o = join([a, b], n)
    else:
        stl(os.path.join(PL, n + ".stl"), n, colour(n), sub[g])

opened = coll("Tueren offen (90 Grad)", hidden=True)
for f in sorted(glob.glob(os.path.join(RD, "*__open90.stl"))):
    n = os.path.basename(f).split("__")[0]
    stl(f, n + " (offen)", "black", opened)

pins = coll("Scharnierstifte (Filament 1,75 mm)", hidden=True)
for n in names:
    if n.startswith("pin_"):
        stl(os.path.join(PL, n + ".stl"), n, "pin", pins)

horses = coll("Pferd-Platzhalter (170 x 53 x 120 mm)", hidden=True)
for f in sorted(glob.glob(os.path.join(RD, "horses", "*.stl"))):
    stl(f, os.path.basename(f)[:-4], "horse", horses)

# print plates on 256 x 256 mm beds, in a grid to the right of the stable
plates = coll("Druckplatten (A1, 256 x 256 mm)", hidden=True)
ids = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(ROOT, "build", "plates", "*.stl")))
x0 = D["X3"] + 150
for k, pid in enumerate(ids):
    ox, oy = x0 + (k % 6) * 300, (k // 6) * 330
    stl(os.path.join(ROOT, "build", "plates", pid + ".stl"), pid, "white" if "walls" in pid else
        "grey" if "floor" in pid else "roof" if "roof" in pid else "black", plates, (ox, oy, 0))
    bpy.ops.mesh.primitive_cube_add(size=1)
    bed = bpy.context.active_object
    bed.name = pid + " Bett"
    bed.scale = (0.256, 0.256, 0.001)
    bed.location = ((ox + 128) * MM, (oy + 128) * MM, -0.0005)
    bed.data.materials.append(MAT["bed"])
    bpy.ops.object.text_add(location=(ox * MM, (oy - 22) * MM, 0))
    t = bpy.context.active_object
    t.name = pid + " Name"
    t.data.body = pid
    t.data.size = 0.016
    t.data.materials.append(MAT["black"])
    for o in (bed, t):
        for c in o.users_collection:
            c.objects.unlink(o)
        plates.objects.link(o)

# ---------------------------------------------------------------- cameras
cams = coll("Kameras")


def camera(name, loc_mm, target_mm=None, rot=None, ortho=None, lens=50):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start, cd.clip_end = 0.01, 100
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho * MM
    o = bpy.data.objects.new(name, cd)
    cams.objects.link(o)
    o.location = C + Vector(loc_mm) * MM
    if rot is not None:
        o.rotation_euler = [math.radians(a) for a in rot]
    else:
        d = (C + Vector(target_mm) * MM) - o.location
        o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return o


W = D["X3"] + 2 * D["ext_out"] + 40         # framing width for the long side
camera("Vorne", (0, -2000, 140), (0, 0, 140), ortho=W)
camera("Hinten", (0, 2000, 140), (0, 0, 140), ortho=W)
camera("Links", (-2000, 0, 140), (0, 0, 140), ortho=W)
camera("Rechts", (2000, 0, 140), (0, 0, 140), ortho=W)
for nm, az in (("Vorne links", -40), ("Vorne rechts", 40), ("Hinten rechts", 140), ("Hinten links", 220)):
    a = math.radians(az)
    camera(nm, (860 * math.sin(a), -860 * math.cos(a), 540), (0, 0, 105), lens=45)
camera("Oben", (0, 0, 2000), rot=(0, 0, 0), ortho=W)
camera("Unten", (0, 0, -2000), rot=(180, 0, 0), ortho=W)
sc.camera = bpy.data.objects["Vorne links"]

# ------------------------------------------------- light, world, render
sun = bpy.data.lights.new("Sonne", "SUN"); sun.energy = 2.6; sun.angle = math.radians(10)
so = bpy.data.objects.new("Sonne", sun); cams.objects.link(so)
so.rotation_euler = (math.radians(50), math.radians(-12), math.radians(-38))
w = bpy.data.worlds.new("Welt"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.78, 0.82, 0.88, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
sc.render.engine = "CYCLES"
sc.cycles.samples = 64
try:
    sc.cycles.use_denoising = True
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
sc.view_settings.view_transform = "Standard"

# hidden collections: eye icon off in the outliner, also off in renders
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.collection.get("hidden"):
        lc.hide_viewport = True
        lc.collection.hide_render = True

# every 3D viewport: material colours, mm-friendly clipping, view on the stable
for scr in bpy.data.screens:
    for area in scr.areas:
        if area.type != "VIEW_3D":
            continue
        for sp in area.spaces:
            if sp.type != "VIEW_3D":
                continue
            sp.clip_start, sp.clip_end = 0.001, 100
            sp.shading.type = "SOLID"
            sp.shading.color_type = "MATERIAL"
            sp.shading.show_cavity = True
            r3 = sp.region_3d
            r3.view_location = C + Vector((0, 0, 0.11))
            r3.view_distance = 1.0
            r3.view_rotation = (Matrix.Rotation(math.radians(-35), 4, "Z") @
                                Matrix.Rotation(math.radians(62), 4, "X")).to_quaternion()

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("SAVED", OUT, round(os.path.getsize(OUT) / 1e6, 1), "MB",
      len(bpy.data.objects), "objects")
