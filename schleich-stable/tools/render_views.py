"""Render every camera of blender/stall_kompakt.blend (all view directions)
-> docs/images/views/<camera>.jpg; tools/views_sheet.py combines them

  blender -b blender/stall_kompakt.blend -P tools/render_views.py -- [samples]
"""
import bpy, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 48
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(ROOT, "docs", "images", "views")
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
sc.cycles.samples = SAMPLES
# Linux builds without OpenImageDenoise fail at render time with denoising on
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 1200, 750
sc.render.image_settings.file_format = "JPEG"
sc.render.image_settings.quality = 90

# ground plane that catches the shadows (not for the view from below)
bpy.ops.mesh.primitive_plane_add(size=6, location=(0.23, 0.12, -0.0002))
ground = bpy.context.active_object
m = bpy.data.materials.new("Tisch"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.72, 0.68, 0.60, 1)
ground.data.materials.append(m)
# fill light for the view from below
up = bpy.data.lights.new("Licht von unten", "SUN"); up.energy = 2.0
upo = bpy.data.objects.new("Licht von unten", up); sc.collection.objects.link(upo)
upo.rotation_euler = (math.radians(180 + 30), 0, math.radians(20))

FILE = {"Vorne": "vorne", "Hinten": "hinten", "Links": "links", "Rechts": "rechts",
        "Vorne links": "vorne_links", "Vorne rechts": "vorne_rechts",
        "Hinten links": "hinten_links", "Hinten rechts": "hinten_rechts",
        "Oben": "oben", "Unten": "unten"}
for cam, fn in FILE.items():
    below = cam == "Unten"
    ground.hide_render = below
    upo.hide_render = not below
    sc.camera = bpy.data.objects[cam]
    sc.render.filepath = os.path.join(OUT, fn + ".jpg")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", fn, flush=True)
