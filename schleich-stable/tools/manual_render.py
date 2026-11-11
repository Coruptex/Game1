"""Pictures for the assembly manual (tools/manual_pdf.py): one picture per
step, line-drawing look (Freestyle outlines, white background, orthographic
view). New parts float above (or beside) their place; the image positions of
the arrows and part codes go to build/manual/scenes.json.

  blender -b -P tools/manual_render.py -- [samples] [scene ...]
Needs build/placed/*.stl, build/swing/*.stl (tools/build.py --placed --swing) and
build/manual/stl/*.stl (stall doors without lever, lever poses: cad/manual_poses.scad,
exported by tools/manual_pdf.py)."""
import bpy, json, math, os, sys
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SAMPLES = int(argv[0]) if argv else 24
ONLY = set(argv[1:])
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PL, SW, MS = (os.path.join(ROOT, "build", d) for d in ("placed", "swing", os.path.join("manual", "stl")))
OUT = os.path.join(ROOT, "build", "manual")
VIEW = Vector((420, 520, -420)).normalized()          # look direction: from front-left, above
COL = {"floor": (0.66, 0.66, 0.64), "post": (0.20, 0.20, 0.22), "wall": (0.97, 0.96, 0.93),
       "door": (0.22, 0.22, 0.25), "roof": (0.45, 0.46, 0.50), "pin": (0.95, 0.45, 0.05)}


def pl(n):
    return os.path.join(PL, n + ".stl")


def ms(n):
    return os.path.join(MS, n + ".stl")


def colour_of(n):
    n = os.path.basename(n)
    if n.startswith("floor"): return "floor"
    if n.startswith("post"): return "post"
    if n.startswith("pin"): return "pin"
    if n.startswith(("main_leaf", "stall_door", "sd_", "casement", "bolt", "lever")): return "door"
    if n.startswith("roof"): return "roof"
    return "wall"


def item(path, off=(0, 0, 0), new=False, code=None, arrow=None, num=None):
    return dict(f=path, off=off, new=new, code=code, arrow=arrow, num=num)


# ------------------------------------------------------------------ parts
FLOOR = ["floor_LF", "floor_AF", "floor_RF", "floor_LB", "floor_AB", "floor_RB"]
# post -> (code, things hung on it before it goes in)
POSTS = {"post_corner_FL": ("P1A", []), "post_corner_FR": ("P1B", []), "post_corner_BL": ("P1B", []), "post_corner_BR": ("P1A", []),
         "post_sidemid_FL": ("P2", []), "post_sidemid_FR": ("P2", []),
         "post_jamb_FL": ("P3", ["main_leaf_FL", "SD:FL", "pin_main_FL", "pin_stall_FL"]),
         "post_jamb_BR": ("P3", ["main_leaf_BR", "SD:BR", "pin_main_BR", "pin_stall_BR"]),
         "post_jamb_FR": ("P4", ["main_leaf_FR", "pin_main_FR"]),
         "post_jamb_BL": ("P4", ["main_leaf_BL", "pin_main_BL"]),
         "post_mid_FL": ("P5", ["SD:BL", "pin_stall_BL"]),
         "post_mid_FR": ("P5", ["SD:FR", "pin_stall_FR"])}
SIDE = ["side_wall_FL", "side_wall_FR", "side_wall_BL", "side_wall_BR"]
PART = ["partition_L", "partition_R"]
GABLE = {"gable_wing_FL": "W3", "gable_wing_BR": "W3", "gable_wing_FR": "W4", "gable_wing_BL": "W4"}
CASE = {"casement_FL": "F1", "casement_BR": "F1", "casement_FR": "F2", "casement_BL": "F2"}
FRONT = ["stall_front_FL", "stall_front_FR", "stall_front_BL", "stall_front_BR"]
PED = ["pediment_F", "pediment_B"]
QS = ["FL", "FR", "BL", "BR"]


def door_path(spec, sd="closed"):
    """'SD:FL' -> stall door without lever (closed / open) or with lever (placed)"""
    q = spec[3:]
    if sd == "placed":
        return pl("stall_door_" + q)
    return ms(f"sd_{sd}_{q}")


def posts_set(off=(0, 0, 0), new=False, sd="closed", arrows=False):
    out = []
    for p, (code, hung) in POSTS.items():
        out.append(item(pl(p), off, new, code if new else None, "down" if arrows else None))
        for h in hung:
            out.append(item(door_path(h, sd) if h.startswith("SD:") else pl(h), off, new))
    return out


def base(upto, sd="closed"):
    """everything assembled up to (and including) step `upto`"""
    s = [item(pl(n)) for n in FLOOR]
    if upto >= 3: s += posts_set(sd=sd)
    if upto >= 4: s += [item(pl(n)) for n in SIDE + PART]
    if upto >= 5: s += [item(pl(n)) for n in GABLE]
    if upto >= 6: s += [item(pl(n)) for n in CASE] + [item(pl("pin_case_" + q)) for q in QS]
    if upto >= 7: s += [item(pl(n)) for n in FRONT]
    if upto >= 9: s += [item(pl(n)) for n in PED] + [item(pl("bolt_bar_F")), item(pl("bolt_bar_B"))]
    if upto >= 10: s += [item(pl("roof_side_L")), item(pl("roof_side_R"))]
    if upto >= 11: s += [item(pl("roof_central"))]
    return s


UP = 130
SCENES = {
    "s01_boden": dict(items=[
        item(pl("floor_LF"), (0, 0, 0), True, "B1"),
        item(pl("floor_AF"), (40, 0, 0), True, "B2", ("move", (-40, 0, 0)), 1),
        item(pl("floor_RF"), (95, 0, 0), True, "B3", ("move", (-95, 0, 0)), 5),
        item(pl("floor_LB"), (0, 55, 0), True, "B4", ("move", (0, -55, 0)), 3),
        item(pl("floor_AB"), (40, 55, 0), True, "B5", ("move", (-40, 0, 0)), 2),
        item(pl("floor_RB"), (95, 55, 0), True, "B6", ("move", (0, -55, 0)), 4)]),
    "s02_tuer_P3": dict(res=(800, 1400), items=[
        item(pl("post_jamb_FL"), new=True, code="P3"), item(pl("main_leaf_FL"), new=True, code="T1"),
        item(ms("sd_closed_FL"), new=True, code="T3"),
        item(pl("pin_main_FL"), (0, 0, -150), True, "S1", "up"), item(pl("pin_stall_FL"), (0, 0, -150), True, "S2", "up")]),
    "s02_tuer_P4": dict(res=(800, 1400), items=[
        item(pl("post_jamb_FR"), new=True, code="P4"), item(pl("main_leaf_FR"), new=True, code="T2"),
        item(pl("pin_main_FR"), (0, 0, -150), True, "S1", "up")]),
    "s02_tuer_P5": dict(res=(800, 1400), items=[
        item(pl("post_mid_FL"), new=True, code="P5"), item(ms("sd_closed_BL"), new=True, code="T3"),
        item(pl("pin_stall_BL"), (0, 0, -150), True, "S2", "up")]),
    "s03_pfosten": dict(items=base(1) + posts_set((0, 0, 110), True, arrows=True)),
    "s04_waende": dict(items=base(3) + [item(pl(n), (0, 0, UP), True, "W1", "down") for n in SIDE]
                       + [item(pl(n), (0, 0, UP), True, "W2", "down") for n in PART]),
    "s05_giebel": dict(items=base(4) + [item(pl(n), (0, 0, UP), True, c, "down") for n, c in GABLE.items()]),
    "s06_fenster": dict(items=[item(pl("gable_wing_FL")), item(pl("post_corner_FL")), item(pl("post_jamb_FL")),
                               item(pl("floor_LF")),
                               item(pl("casement_FL"), new=True, code="F1"),
                               item(pl("pin_case_FL"), (0, 0, 55), True, "S3", "down")],
                        fit=["gable_wing_FL", "casement_FL", "pin_case_FL"]),
    "s07_fronten": dict(items=base(6, sd="open") + [item(pl(n), (0, 0, UP + 20), True, "W5", "down") for n in FRONT]),
    "s08_hebel_a": dict(res=(1100, 1150), items=[item(pl("stall_front_FL")), item(ms("sd_closed_FL")), item(pl("post_jamb_FL")),
                               item(ms("lever_up"), new=True, code="T4", arrow="lever")],
                        fit=["lever_up", "lever_hub_zone"], view=Vector((-0.55, 0.8, -0.3)).normalized()),
    "s08_hebel_b": dict(res=(1100, 1150), items=[item(pl("stall_front_FL")), item(ms("sd_closed_FL")), item(pl("post_jamb_FL")),
                               item(ms("lever_down"), new=True, code="T4", arrow="turn")],
                        fit=["lever_up", "lever_hub_zone"], view=Vector((-0.55, 0.8, -0.3)).normalized()),
    "s09_giebelfeld": dict(items=base(7, sd="placed") + [item(pl(n), (0, 0, UP), True, "W6", "down") for n in PED]),
    "s10_seitendach": dict(items=base(9, sd="placed") + [item(pl("roof_side_L"), (0, 0, 120), True, "D1", "down"),
                                                          item(pl("roof_side_R"), (0, 0, 120), True, "D2", "down")]),
    "s11_mitteldach": dict(items=base(10, sd="placed") + [item(pl("roof_central"), (0, 0, 120), True, "D3", "down")]),
    "s12_torriegel": dict(items=[item(pl(n)) for n in ("floor_AF", "post_jamb_FL", "post_jamb_FR", "main_leaf_FL",
                                                       "main_leaf_FR", "pediment_F", "floor_LF", "floor_RF")]
                          + [item(pl("bolt_bar_F"), (45, 0, 0), True, "T5", ("move", (-45, 0, 0)))],
                          fit=["main_leaf_FL", "main_leaf_FR", "bolt_bar_F"], view=Vector((0.25, 1, -0.28)).normalized()),
    "s13_fertig": dict(items=base(11, sd="placed")),
    "s14_oeffnen": dict(items=base(9, sd="placed") + [item(pl("roof_side_R")),
                                                      item(pl("roof_central"), (0, 0, 110), True, None, ("move", (0, 0, 60)), 1),
                                                      item(pl("roof_side_L"), (0, 0, 45), True, None, ("move", (0, 0, 50)), 2)]),
}

# thumbnails: code -> (one placed instance, extra files drawn with it)
THUMBS = {"B1": ["floor_LF"], "B2": ["floor_AF"], "B3": ["floor_RF"], "B4": ["floor_LB"], "B5": ["floor_AB"], "B6": ["floor_RB"],
          "P1A": ["post_corner_FL"], "P1B": ["post_corner_FR"], "P2": ["post_sidemid_FL"], "P3": ["post_jamb_FL"], "P4": ["post_jamb_FR"], "P5": ["post_mid_FL"],
          "W1": ["side_wall_FL"], "W2": ["partition_L"], "W3": ["gable_wing_FL"], "W4": ["gable_wing_FR"],
          "W5": ["stall_front_FL"], "W6": ["pediment_F"],
          "T1": ["main_leaf_FL"], "T2": ["main_leaf_FR"], "T3": ["MS:sd_closed_FL"], "T4": ["MS:lever_down"], "T5": ["bolt_bar_F"],
          "F1": ["casement_FL"], "F2": ["casement_FR"],
          "D1": ["roof_side_L"], "D2": ["roof_side_R"], "D3": ["roof_central"]}


# ------------------------------------------------------------------ blender
def mat(rgb):
    m = bpy.data.materials.new("m"); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = 0.75
    return m


def reset(res, thick):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"; sc.cycles.samples = SAMPLES
    try:
        sc.cycles.use_denoising = True; sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        sc.cycles.use_denoising = False
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    sun = bpy.data.lights.new("s", "SUN"); sun.energy = 2.4
    so = bpy.data.objects.new("s", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), 0, math.radians(-35))
    sc.render.use_freestyle = True; sc.render.line_thickness_mode = "ABSOLUTE"
    fs = bpy.context.view_layer.freestyle_settings; fs.crease_angle = math.radians(130)
    ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("l")
    ls.select_by_visibility = True; ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
    lst = ls.linestyle or bpy.data.linestyles.new("ls"); ls.linestyle = lst
    lst.color = (0.08, 0.08, 0.08); lst.thickness = thick
    return sc


MATS = {}


def imp(path, colour, off):
    before = set(bpy.data.objects)
    bpy.ops.wm.stl_import(filepath=path)
    o = (set(bpy.data.objects) - before).pop()
    if colour not in MATS:
        MATS[colour] = mat(COL[colour])
    o.data.materials.append(MATS[colour])
    o.location = off
    bpy.context.view_layer.update()
    return o


def bbox(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def camera(sc, pts, view, res, margin=1.10):
    rot = view.to_track_quat("-Z", "Y")
    R = rot.to_matrix()
    Ri = R.inverted()
    loc = [Ri @ p for p in pts]
    xs, ys, zs = [p.x for p in loc], [p.y for p in loc], [p.z for p in loc]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam = bpy.data.cameras.new("c"); cam.type = "ORTHO"
    # Blender fits the ortho scale to the larger side of the picture
    if res[0] >= res[1]:
        cam.ortho_scale = max(w, h * res[0] / res[1]) * margin
    else:
        cam.ortho_scale = max(h, w * res[1] / res[0]) * margin
    cam.clip_start = 1; cam.clip_end = 5000
    co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
    co.rotation_euler = rot.to_euler()
    co.location = R @ Vector((cx, cy, max(zs) + 1500))
    bpy.context.view_layer.update()
    return co


def px(sc, co, p, res):
    v = world_to_camera_view(sc, co, Vector(p))
    return [round(v.x * res[0], 1), round(res[1] - v.y * res[1], 1)]


def render_scene(name, spec, out):
    res = spec.get("res", (1800, 1150))
    sc = reset(res, 1.3)
    objs = []
    for it in spec["items"]:
        o = imp(it["f"], colour_of(it["f"]), it["off"])
        objs.append((it, o))
    view = spec.get("view", VIEW)
    fit_names = spec.get("fit")
    pts = []
    for it, o in objs:
        base_name = os.path.basename(it["f"])[:-4]
        if fit_names is None or base_name in fit_names:
            lo, hi = bbox(o)
            pts += [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    if fit_names and "lever_hub_zone" in fit_names:
        # lever close-up: frame the latch region of door FL around the lever
        for it, o in objs:
            if os.path.basename(it["f"]).startswith("lever"):
                lo, hi = bbox(o)
                c = (lo + hi) / 2
                pts += [c + Vector((dx, dy, dz)) for dx in (-16, 16) for dy in (-30, 28) for dz in (-22, 22)]
    co = camera(sc, pts, view, res, spec.get("margin", 1.12))
    info = {"img": os.path.basename(out), "size": list(res), "arrows": [], "labels": [], "arcs": []}
    for it, o in objs:
        if not it["new"]:
            continue
        lo, hi = bbox(o)
        c = (lo + hi) / 2
        off = Vector(it["off"])
        a = it["arrow"]
        if it["code"]:
            # pins pushed up from below: code under the pin, the arrow is above it;
            # sliding parts: code off the centre, where the arrow starts
            if a == "up":
                top = Vector((c.x, c.y, lo.z - 14))
            elif isinstance(a, tuple):
                top = Vector((lo.x + 0.3 * (hi.x - lo.x), lo.y + 0.75 * (hi.y - lo.y), hi.z + 2))
            else:
                top = Vector((c.x, c.y, hi.z + 4))
            info["labels"].append({"text": it["code"], "at": px(sc, co, top, res)})
        if a == "down":
            s = Vector((c.x, c.y, lo.z - 3)); e = Vector((c.x, c.y, lo.z - 0.8 * off.z))
            info["arrows"].append({"a": px(sc, co, s, res), "b": px(sc, co, e, res), "n": it["num"]})
        elif a == "up":
            s = Vector((c.x, c.y, hi.z + 3)); e = Vector((c.x, c.y, hi.z - 0.33 * off.z))
            info["arrows"].append({"a": px(sc, co, s, res), "b": px(sc, co, e, res), "n": it["num"]})
        elif isinstance(a, tuple) and a[0] == "move":
            m = Vector(a[1])
            z = hi.z + 2 if m.z == 0 else c.z
            s = Vector((c.x, c.y, z)) if m.z == 0 else Vector((c.x, c.y, hi.z + 3))
            info["arrows"].append({"a": px(sc, co, s, res), "b": px(sc, co, s + m, res), "n": it["num"]})
        elif a == "lever":
            # lever held pointing up, 14 mm off the door: push it onto the peg (along world -X)
            hub = Vector((c.x, (lo.y + hi.y) / 2, lo.z + 5.5))
            info["arrows"].append({"a": px(sc, co, hub + Vector((4, 0, 0)), res), "b": px(sc, co, hub - Vector((11, 0, 0)), res), "n": None})
        elif a == "turn":
            # lever turned down from pointing up (+Z) to level (+Y), about its hub
            hub = Vector((c.x, lo.y + 5.5, c.z))
            r = 22.0
            arc = [px(sc, co, hub + Vector((2, r * math.sin(math.radians(t)), r * math.cos(math.radians(t)))), res)
                   for t in range(5, 80, 5)]
            info["arcs"].append(arc)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print("RENDERED", name, flush=True)
    return info


def render_thumb(code, names, out):
    res = (700, 520)
    sc = reset(res, 1.0)
    pts = []
    for n in names:
        f = ms(n[3:]) if n.startswith("MS:") else pl(n)
        o = imp(f, colour_of(f), (0, 0, 0))
        lo, hi = bbox(o)
        pts += [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    camera(sc, pts, VIEW, res, 1.08)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print("THUMB", code, flush=True)


def main():
    os.makedirs(os.path.join(OUT, "thumbs"), exist_ok=True)
    jf = os.path.join(OUT, "scenes.json")
    data = json.load(open(jf)) if os.path.exists(jf) else {}
    for name, spec in SCENES.items():
        if ONLY and name not in ONLY and "scenes" not in ONLY:
            continue
        data[name] = render_scene(name, spec, os.path.join(OUT, name + ".png"))
        json.dump(data, open(jf, "w"), indent=1)
    if not ONLY or "thumbs" in ONLY:
        for code, names in THUMBS.items():
            render_thumb(code, names, os.path.join(OUT, "thumbs", code + ".png"))


main()
