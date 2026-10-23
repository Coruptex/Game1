#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vorschaubilder (Blender/Cycles, CPU) für den Mole-1-Anhänger.

Rendert die exportierten STL-Dateien (also exakt die geprüfte Geometrie) sowie die
farbige Bauteil-Rekonstruktion aus der .blend.

Aufruf:  python render_vorschau.py --export <export-ordner> --bilder <bilder-ordner> [--schnell]
"""
import bpy
import math
import os
import sys
from mathutils import Vector


def argumente():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = {"export": None, "bilder": None, "schnell": False}
    i = 0
    while i < len(argv):
        if argv[i] in ("--export", "--bilder"):
            a[argv[i][2:]] = os.path.abspath(argv[i + 1])
            i += 1
        elif argv[i] == "--schnell":
            a["schnell"] = True
        i += 1
    return a


def szene_leeren():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import addon_utils
    addon_utils.enable("cycles", default_set=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = False
    return sc


def welt(sc, hell=0.75):
    w = bpy.data.worlds.new("Studio")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    grad = nt.nodes.new("ShaderNodeTexGradient")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    mapn.inputs["Rotation"].default_value = (0.0, -math.pi / 2.0, 0.0)
    ramp.color_ramp.elements[0].color = (0.10, 0.11, 0.12, 1)
    ramp.color_ramp.elements[1].color = (hell, hell, hell * 1.02, 1)
    nt.links.new(coord.outputs["Generated"], mapn.inputs["Vector"])
    nt.links.new(mapn.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


def licht(name, ort, ziel, staerke, groesse):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = staerke
    ld.size = groesse
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = ort
    richtung = Vector(ziel) - Vector(ort)
    ob.rotation_euler = richtung.to_track_quat("-Z", "Y").to_euler()
    return ob


def mat_silber():
    m = bpy.data.materials.new("Silber")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.92, 0.92, 0.93, 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.22
    return m


def mat_pla():
    m = bpy.data.materials.new("PLA_hellgrau")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.62, 0.64, 0.66, 1)
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Roughness"].default_value = 0.55
    return m


def boden(z=0.0, farbe=(0.16, 0.17, 0.18)):
    me = bpy.data.meshes.new("Boden")
    s = 4000.0
    me.from_pydata([(-s, -s, z), (s, -s, z), (s, s, z), (-s, s, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new("Boden", me)
    bpy.context.scene.collection.objects.link(ob)
    m = bpy.data.materials.new("Boden")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*farbe, 1)
    b.inputs["Roughness"].default_value = 0.35
    me.materials.append(m)
    return ob


def stl_laden(pfad, mat, versatz=(0.0, 0.0, 0.0)):
    bpy.ops.wm.stl_import(filepath=pfad, global_scale=1.0, use_scene_unit=False)
    ob = bpy.context.selected_objects[0]
    ob.location = versatz
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def kamera(name, ziel, richtung_deg, hoehe_deg, abstand, ortho=None, brennweite=100.0):
    cd = bpy.data.cameras.new(name)
    cd.clip_start = 1.0
    cd.clip_end = 5000.0
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    else:
        cd.lens = brennweite
    ob = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(ob)
    a, e = math.radians(richtung_deg), math.radians(hoehe_deg)
    ziel = Vector(ziel)
    ob.location = ziel + abstand * Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))
    ob.rotation_euler = (ziel - ob.location).to_track_quat("-Z", "Y").to_euler()
    return ob


def rendern(sc, cam, pfad, aufl=(900, 1400), samples=96):
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = aufl
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.filepath = pfad
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("gerendert:", pfad)


def studio(sc):
    welt(sc)
    licht("Key", (60, -90, 90), (0, 0, 17), 90000, 60)
    licht("Fill", (-90, -40, 40), (0, 0, 17), 30000, 80)
    licht("Rim", (10, 100, 70), (0, 0, 20), 50000, 50)
    licht("Top", (0, 0, 160), (0, 0, 17), 20000, 80)


def main():
    a = argumente()
    os.makedirs(a["bilder"], exist_ok=True)
    smp = 24 if a["schnell"] else 64
    import json
    with open(os.path.join(a["export"], "modell_parameter.json"), encoding="utf-8") as f:
        dateien = json.load(f)["dateien"]
    stl_a = os.path.join(a["export"], dateien["stl_A"])
    stl_b = os.path.join(a["export"], dateien.get("stl_B", ""))

    # --- 1) Variante A in Silber und als PLA-Prototyp ------------------------
    for stil in ("silber", "pla"):
        sc = szene_leeren()
        studio(sc)
        boden()
        stl_laden(stl_a, mat_silber() if stil == "silber" else mat_pla())
        mitte = (0, 0, 17.5)
        ansichten = [
            ("vorne", kamera("v", mitte, -90, 0, 400, ortho=40)),
            ("seite", kamera("s", mitte, 0, 0, 400, ortho=40)),
            ("schraeg", kamera("q", mitte, -60, 22, 175, brennweite=140)),
            ("oben_schraeg", kamera("o", (0, 0, 20), -45, 55, 185, brennweite=140)),
        ]
        if stil == "silber":
            ansichten.append(("detail_laterne", kamera("d", (0, 0, 26.5), -70, 18, 85, brennweite=140)))
            ansichten.append(("detail_untere_galerie", kamera("g", (0, 0, 9.0), -50, 25, 80, brennweite=140)))
            ansichten.append(("draufsicht", kamera("t", (0, 0, 17), -90, 89.9, 400, ortho=14)))
        for name, cam in ansichten:
            aufl = (1000, 1000) if name.startswith("detail") or name == "draufsicht" else (800, 1400)
            rendern(sc, cam, os.path.join(a["bilder"], f"A_{stil}_{name}.png"), aufl, smp)

    # --- 2) Variante A und B nebeneinander -----------------------------------
    if os.path.isfile(stl_b):
        sc = szene_leeren()
        studio(sc)
        boden()
        stl_laden(stl_a, mat_silber(), (-6.5, 0, 0))
        stl_laden(stl_b, mat_silber(), (6.5, 0, 0))
        rendern(sc, kamera("vb", (0, 0, 17.5), -62, 18, 150, brennweite=110),
                os.path.join(a["bilder"], "Vergleich_A_3D_vs_B_Relief.png"), (1400, 1300), smp)
        rendern(sc, kamera("vb2", (0, 0, 17.5), 35, 15, 150, brennweite=110),
                os.path.join(a["bilder"], "Vergleich_A_3D_vs_B_Relief_hinten.png"), (1400, 1300), smp)

    # --- 3) Farbige Rekonstruktion (Bauteile aus der .blend) -----------------
    blend = os.path.join(a["export"], "Mole1_Brunsbuettel_Anhaenger.blend")
    if os.path.exists(blend):
        bpy.ops.wm.open_mainfile(filepath=blend)
        import addon_utils
        addon_utils.enable("cycles", default_set=True)
        sc = bpy.context.scene
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.view_settings.view_transform = "AgX"
        for c in bpy.data.collections:
            if c.name == "01_Bauteile":
                c.hide_viewport = False
                c.hide_render = False
            elif c.name.startswith(("03_", "04_")):
                c.hide_render = True
        studio(sc)
        boden(farbe=(0.30, 0.33, 0.36))
        rendern(sc, kamera("rk", (0, 0, 17.0), -65, 12, 130, brennweite=110),
                os.path.join(a["bilder"], "Rekonstruktion_Farbgebung_Original.png"), (900, 1400), smp)


if __name__ == "__main__":
    main()
