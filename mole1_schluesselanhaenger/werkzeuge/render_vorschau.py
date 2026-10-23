#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vorschaubilder (Blender/Cycles, CPU) für den Mole-1-Anhänger.

Rendert die exportierte STL (also exakt die geprüfte Geometrie) und das farbige
Rekonstruktionsmodell aus der .blend (Collection "04_Farbmodell_Rekonstruktion").

Ansichten der STL (hellgraues Modellmaterial, zeigt Details am besten):
  Ansicht_vorne (Tür, −Y), Ansicht_rechts ("1", +X), Ansicht_hinten (+Y), Ansicht_links (−X),
  Perspektiven und Detailansichten; zusätzlich Silber- und PLA-Eindruck.
Farbmodell: u. a. mit derselben Kamera wie Referenzfoto F4 (Molenweg, ca. 45 m Abstand).

Aufruf:  python render_vorschau.py --export <export-ordner> --bilder <bilder-ordner> [--schnell]
         [--prototyp]   Prototyp für den A1 (liest modell_parameter_prototyp_a1.json, nur PLA-Ansichten)
"""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

# Kamera von Foto F4 (Molenweg): 960 × 1628 px, 94,25 px/m in der Turmachse, Abstand ≈ 90 m
# (aus dem Höhenversatz vorderer/hinterer Geländerholme), Augenhöhe ≈ 1,2 m (Horizont), waagerecht.
FOTO4 = {"breite_px": 960, "hoehe_px": 1628, "px_pro_m": 94.25, "achse_x": 463.5, "y_sockel": 1305,
         "abstand_m": 90.0, "augenhoehe_m": 1.2}


def argumente():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = {"export": None, "bilder": None, "schnell": False, "nur": None, "prototyp": False}
    i = 0
    while i < len(argv):
        if argv[i] in ("--export", "--bilder", "--nur"):
            a[argv[i][2:]] = os.path.abspath(argv[i + 1]) if argv[i] != "--nur" else argv[i + 1]
            i += 1
        elif argv[i] == "--schnell":
            a["schnell"] = True
        elif argv[i] == "--prototyp":
            a["prototyp"] = True
        i += 1
    return a


def cycles_einrichten(sc):
    import addon_utils
    addon_utils.enable("cycles", default_set=True)
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.render.film_transparent = False


def szene_leeren():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    cycles_einrichten(sc)
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    return sc


def welt(sc, hell=0.75, himmel=False):
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
    if himmel:
        ramp.color_ramp.elements[0].color = (0.10, 0.22, 0.45, 1)
        ramp.color_ramp.elements[1].color = (0.35, 0.55, 0.85, 1)
    else:
        ramp.color_ramp.elements[0].color = (0.10, 0.11, 0.12, 1)
        ramp.color_ramp.elements[1].color = (hell, hell, hell * 1.02, 1)
    nt.links.new(coord.outputs["Generated"], mapn.inputs["Vector"])
    nt.links.new(mapn.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


def licht(name, ort, ziel, staerke, groesse, typ="AREA"):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = staerke
    if typ == "AREA":
        ld.size = groesse
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = ort
    richtung = Vector(ziel) - Vector(ort)
    ob.rotation_euler = richtung.to_track_quat("-Z", "Y").to_euler()
    return ob


def mat_einfach(name, farbe, metall, rauheit):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*farbe, 1)
    b.inputs["Metallic"].default_value = metall
    b.inputs["Roughness"].default_value = rauheit
    return m


MATERIALIEN = {
    "modell": (("Modell_hellgrau", (0.70, 0.71, 0.72), 0.0, 0.62)),
    "silber": (("Silber", (0.92, 0.92, 0.93), 1.0, 0.22)),
    "pla": (("PLA_hellgrau", (0.62, 0.64, 0.66), 0.0, 0.55)),
}


def boden(z=0.0, farbe=(0.16, 0.17, 0.18)):
    me = bpy.data.meshes.new("Boden")
    s = 4000.0
    me.from_pydata([(-s, -s, z), (s, -s, z), (s, s, z), (-s, s, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new("Boden", me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat_einfach("Boden", farbe, 0.0, 0.35))
    return ob


def stl_laden(pfad, mat):
    bpy.ops.wm.stl_import(filepath=pfad, global_scale=1.0, use_scene_unit=False)
    ob = bpy.context.selected_objects[0]
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


def kamera_foto4(s_mm_pro_m):
    """Waagerechte Kamera wie Referenzfoto F4: gleicher Bildausschnitt, Pixel für Pixel vergleichbar."""
    f = FOTO4
    cd = bpy.data.cameras.new("Kamera_wie_F4")
    cd.sensor_fit = "VERTICAL"
    cd.sensor_height = 36.0
    hoehe_m = f["hoehe_px"] / f["px_pro_m"]
    cd.lens = (cd.sensor_height / 2.0) / ((hoehe_m / 2.0) / f["abstand_m"])
    z_mitte = (f["y_sockel"] - f["hoehe_px"] / 2.0) / f["px_pro_m"]
    cd.shift_y = (z_mitte - f["augenhoehe_m"]) / hoehe_m
    cd.shift_x = (f["breite_px"] / 2.0 - f["achse_x"]) / f["hoehe_px"]
    cd.clip_start = 1.0
    cd.clip_end = 5000.0
    ob = bpy.data.objects.new("Kamera_wie_F4", cd)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (0.0, -f["abstand_m"] * s_mm_pro_m, f["augenhoehe_m"] * s_mm_pro_m)
    ob.rotation_euler = (math.pi / 2.0, 0.0, 0.0)
    return ob


def rendern(sc, cam, pfad, aufl=(900, 1400), samples=64):
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = aufl
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.filepath = pfad
    sc.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    print("gerendert:", pfad)


def studio(sc, himmel=False):
    welt(sc, himmel=himmel)
    licht("Key", (60, -90, 90), (0, 0, 17), 90000, 60)
    licht("Fill", (-90, -40, 40), (0, 0, 17), 30000, 80)
    licht("Rim", (10, 100, 70), (0, 0, 20), 50000, 50)
    licht("Top", (0, 0, 160), (0, 0, 17), 20000, 80)
    licht("Seite", (110, 30, 30), (0, 0, 17), 25000, 60)


def stl_ansichten(a, stl, smp, mm):
    s_hoehe = mm["z_oben"]
    m = (0, 0, s_hoehe / 2.0)
    for stil in ("modell", "silber", "pla"):
        sc = szene_leeren()
        studio(sc)
        boden()
        stl_laden(stl, mat_einfach(*MATERIALIEN[stil]))
        if stil == "modell":
            ansichten = [
                ("Ansicht_vorne_Tuer", kamera("v", m, -90, 0, 400, ortho=38), (900, 1500)),
                ("Ansicht_rechts_Ziffer1", kamera("r", m, 0, 0, 400, ortho=38), (900, 1500)),
                ("Ansicht_hinten", kamera("h", m, 90, 0, 400, ortho=38), (900, 1500)),
                ("Ansicht_links", kamera("l", m, 180, 0, 400, ortho=38), (900, 1500)),
                ("Perspektive_vorne_rechts", kamera("p1", m, -40, 15, 190, brennweite=140), (900, 1500)),
                ("Perspektive_hinten_links", kamera("p2", m, 140, 15, 190, brennweite=140), (900, 1500)),
                ("Perspektive_oben", kamera("p3", (0, 0, 20), -60, 50, 190, brennweite=140), (900, 1200)),
                ("Detail_Tuer_Sockel", kamera("d1", (0, -3, 3.0), -80, 8, 70, brennweite=140), (1100, 900)),
                ("Detail_Ziffer1_Turm", kamera("d2", (2.4, 0, 14.5), 0, 5, 75, brennweite=140), (900, 1100)),
                ("Detail_Leiter_Trichter", kamera("d3", (2.0, 2.0, 8.0), 45, 5, 80, brennweite=140), (1000, 1100)),
                ("Detail_Konsolen_obere_Galerie", kamera("d4", (0, 0, 19.0), -70, 12, 70, brennweite=140),
                 (1100, 900)),
                ("Detail_Laterne_Dach_Knauf", kamera("d5", (0, 0, 25.5), -60, 12, 75, brennweite=140), (1000, 1100)),
                ("Detail_untere_Galerie", kamera("d6", (0, 0, 10.5), -30, 28, 90, brennweite=140), (1100, 900)),
            ]
        elif stil == "silber":
            ansichten = [
                ("Silber_Perspektive", kamera("s1", m, -35, 12, 185, brennweite=140), (900, 1500)),
                ("Silber_Perspektive_Ziffer1", kamera("s2", m, 25, 10, 185, brennweite=140), (900, 1500)),
                ("Silber_Detail_oben", kamera("s3", (0, 0, 24.0), -55, 15, 95, brennweite=140), (1000, 1100)),
            ]
        else:
            ansichten = [("PLA_Perspektive", kamera("q1", m, -35, 12, 185, brennweite=140), (900, 1500))]
        for name, cam, aufl in ansichten:
            if a["nur"] and a["nur"] not in name:
                continue
            rendern(sc, cam, os.path.join(a["bilder"], f"{name}.png"), aufl, smp)


def prototyp_ansichten(a, stl, smp, mm):
    """PLA-Eindruck der FDM-Prototyp-Variante (gleiche Kameras wie bei der Gussvorlage)."""
    m = (0, 0, mm["z_oben"] / 2.0)
    sc = szene_leeren()
    studio(sc)
    boden()
    stl_laden(stl, mat_einfach(*MATERIALIEN["pla"]))
    ansichten = [
        ("Prototyp_A1_vorne", kamera("v", m, -90, 0, 400, ortho=38), (900, 1500)),
        ("Prototyp_A1_Perspektive", kamera("p", m, -35, 12, 185, brennweite=140), (900, 1500)),
        ("Prototyp_A1_Detail_Galerien", kamera("d", (0, 0, 16.0), -40, 20, 105, brennweite=140), (1000, 1100)),
    ]
    for name, cam, aufl in ansichten:
        if a["nur"] and a["nur"] not in name:
            continue
        rendern(sc, cam, os.path.join(a["bilder"], f"{name}.png"), aufl, smp)


def farbmodell_ansichten(a, blend, smp, mm):
    bpy.ops.wm.open_mainfile(filepath=blend)
    sc = bpy.context.scene
    cycles_einrichten(sc)
    sichtbar = "04_Farbmodell_Rekonstruktion"

    def lc_setzen(lc):
        lc.hide_viewport = lc.collection.name != sichtbar
        lc.exclude = lc.collection.name not in (sichtbar,)
        for k in lc.children:
            lc_setzen(k)
    for lc in bpy.context.view_layer.layer_collection.children:
        lc_setzen(lc)
    for c in bpy.data.collections:
        c.hide_render = c.name != sichtbar
    studio(sc, himmel=True)
    # Sonne von links vorne wie in F4 (Schatten nach rechts)
    sonne = bpy.data.lights.new("Sonne", "SUN")
    sonne.energy = 4.0
    sonne.angle = math.radians(1.0)
    so = bpy.data.objects.new("Sonne", sonne)
    sc.collection.objects.link(so)
    so.rotation_euler = (Vector((0, 0, 0)) - Vector((-60, -45, 40))).to_track_quat("-Z", "Y").to_euler()
    s = mm["s"]
    m = (0, 0, mm["z_oben"] / 2.0)
    ansichten = [
        ("Farbmodell_Kamera_wie_Foto4", kamera_foto4(s), (FOTO4["breite_px"], FOTO4["hoehe_px"])),
        ("Farbmodell_wie_Foto1_Wasserseite", kamera("f1", m, 32, 4, 135, brennweite=140), (900, 1500)),
        ("Farbmodell_wie_Foto3_erhoeht", kamera("f3", m, 25, 22, 135, brennweite=140), (900, 1400)),
        ("Farbmodell_wie_Foto5_Gegenseite", kamera("f5", m, 140, 3, 135, brennweite=140), (900, 1500)),
        ("Farbmodell_hinten_links", kamera("f5", m, 135, 10, 135, brennweite=140), (900, 1500)),
    ]
    for name, cam, aufl in ansichten:
        if a["nur"] and a["nur"] not in name:
            continue
        rendern(sc, cam, os.path.join(a["bilder"], f"{name}.png"), aufl, smp)


def main():
    a = argumente()
    os.makedirs(a["bilder"], exist_ok=True)
    smp = 16 if a["schnell"] else 64
    datei = "modell_parameter_prototyp_a1.json" if a["prototyp"] else "modell_parameter.json"
    with open(os.path.join(a["export"], datei), encoding="utf-8") as f:
        par = json.load(f)
    stl = os.path.join(a["export"], par["dateien"]["stl"])
    if a["prototyp"]:
        prototyp_ansichten(a, stl, smp, par["modellmasse_mm"])
        return
    stl_ansichten(a, stl, smp, par["modellmasse_mm"])
    blend = os.path.join(a["export"], par["dateien"]["blend"])
    if os.path.exists(blend):
        farbmodell_ansichten(a, blend, smp, par["modellmasse_mm"])


if __name__ == "__main__":
    main()
