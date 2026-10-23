#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Molenfeuer Mole 1, Brunsbüttel – parametrisches Modell für einen Schmuck-Schlüsselanhänger
==========================================================================================

Getestet mit Blender 5.2.3 LTS (pip-Paket "bpy" 5.2.3). Benötigt Blender >= 4.5,
weil der Boolean-Solver "MANIFOLD" verwendet wird.

Was das Skript tut
------------------
1. Rechnet die rekonstruierten Realmaße (Meter, Tabelle REAL) in Modellmaße (mm) um,
   sodass die Gesamthöhe inklusive Öse P["GESAMTHOEHE_MM"] beträgt.
2. Hebt filigrane Bauteile auf Mindestmaße an (Tabelle P), weil die maßstäblichen
   Werte (z. B. Geländerstab ≈ 0,1 mm) weder druck- noch gießbar wären.
3. Baut jedes Bauteil als eigenes, geschlossenes Objekt (Collection "01_Bauteile").
4. Vereinigt alle Bauteile per Boolean (UNION, Solver MANIFOLD) zu EINEM Volumenkörper.
5. Speichert eine editierbare .blend-Datei und exportiert die STL in Millimetern.
6. Optional (--relief): erzeugt Variante B (Halbrelief mit flacher Rückseite) zum Vergleich.

Ausführen
---------
ACHTUNG: Das Skript leert die aktuelle Szene (Objekte, Collections, Netze) und baut sie neu auf.
Nur in einer neuen, leeren Datei oder in der mitgelieferten .blend ausführen.

* Blender-Oberfläche: Arbeitsbereich "Scripting" → Text → Öffnen → diese Datei → "Run Script".
  Ausgabeordner ist "export" neben der Skriptdatei bzw. neben der gespeicherten .blend
  (liegt die .blend bereits in einem Ordner "export", wird dieser verwendet).
* Konsole:                 blender -b -P mole1_anhaenger.py -- --out ./export --relief
* Python mit pip-Paket bpy: python mole1_anhaenger.py --out ./export --relief

Koordinaten: z = 0 ist die Unterseite des Granitsockels (= Molendeck), z zeigt nach oben,
die "Vorderseite" (eine Achteckfläche und die Öffnung der Öse) zeigt nach −Y.
Einheiten: 1 Blender-Einheit = 1 mm (Szene metrisch, Längeneinheit Millimeter).
"""
import bpy
import bmesh
import math
import os
import sys
import json

# ---------------------------------------------------------------------------
# 1) REKONSTRUIERTE REALMASSE  (Meter, z = 0 auf Höhe Molendeck)
#    Status: "belegt"     = direkt aus einer Quelle
#            "abgeleitet" = aus belegten Werten berechnet
#            "Schätzung"  = nicht belegt, plausibel angenommen → vor dem Guss am Foto prüfen
# ---------------------------------------------------------------------------
REAL = {
    "H_GESAMT":         (13.40, "belegt",     "Turmhöhe über Molendeck (WSA Nord-Ostsee-Kanal); Oberkante inkl. Wetterfahne angenommen"),
    "Z_FEUER":          (11.50, "abgeleitet", "Feuerhöhe ≈ 15 m ü. NHN (WSV) minus Molendeck NN +3,50 m; 13,50 m ü. MThw passt dazu"),
    "SOCKEL_H":         (2.40,  "Schätzung",  "13,40 m Gesamthöhe minus ≈ 11 m Eisenturm (Lighthouse Directory)"),
    "SOCKEL_SW":        (3.00,  "Schätzung",  "Schlüsselweite des achteckigen Granitsockels (Achteck belegt, Maß nicht)"),
    "TURM_SW_UNTEN":    (2.50,  "Schätzung",  "Schlüsselweite Gussturm am Fuß (Verjüngung belegt, Maß nicht)"),
    "TURM_SW_OBEN":     (1.75,  "Schätzung",  "Schlüsselweite Gussturm unter der oberen Galerie"),
    "Z_GALERIE_UNTEN":  (4.50,  "Schätzung",  "≈ 1/3 der Höhe; Farbbeschreibung: oberhalb der unteren Galerie weiß, unteres Drittel schwarz"),
    "AUSKRAG_UNTEN":    (0.70,  "Schätzung",  "Laufbreite der unteren Galerie"),
    "Z_GALERIE_OBEN":   (10.00, "abgeleitet", "Brennebene 11,50 m minus halbe Verglasung minus Brüstung; Licht muss über das Geländer (OK 11,0 m) scheinen"),
    "AUSKRAG_OBEN":     (0.60,  "Schätzung",  "Laufbreite der oberen Galerie"),
    "GELAENDER_H":      (1.00,  "Schätzung",  "übliche Geländerhöhe"),
    "LATERNE_D":        (1.40,  "Schätzung",  "runde Laterne belegt; Ø aus der 460 mm hohen Gürtellinse abgeschätzt"),
    "BRUESTUNG_H":      (0.95,  "Schätzung",  "geschlossener Laternenunterbau; Verglasung beginnt etwa auf Geländerhöhe"),
    "VERGLASUNG_H":     (1.10,  "Schätzung",  "Brennebene (11,50 m) liegt in Verglasungsmitte, Linse 460 mm hoch"),
    "DACH_D":           (1.60,  "Schätzung",  "Kupferdach (helm-/kuppelförmig belegt) mit kleinem Traufüberstand"),
    "Z_DACH_SPITZE":    (12.90, "Schätzung",  "darüber bis 13,40 m die Wetterfahne von 1895 – im Modell durch die Öse ersetzt"),
}

# ---------------------------------------------------------------------------
# 2) MODELL- UND FERTIGUNGSPARAMETER  (Millimeter im fertigen Anhänger)
# ---------------------------------------------------------------------------
P = {
    "GESAMTHOEHE_MM":      35.0,   # Sockelunterseite bis Oberkante Öse (ohne Schlüsselring)
    # Filigrane Bauteile – Mindestmaße statt maßstäblicher Werte
    "BODEN_DICKE_MM":      0.60,   # Galerieboden (maßstäblich ≈ 0,2 mm)
    "KRAGARM_DICKE_MM":    0.60,   # gusseiserne Kragarme unter den Galerien
    "KRAGARM_ANZAHL":      8,      # Schätzung: je ein Kragarm unter jeder Turmecke
    "GELAENDER_DICKE_MM":  0.60,   # Wandstärke des Geländerbands
    "HANDLAUF_H_MM":       0.60,   # Höhe des Handlaufs
    "PFOSTEN_B_MM":        0.55,   # Eckpfosten: Breite je anschließender Seite (außen)
    "GELAENDER_DURCHBROCHEN": True,  # False = nur angedeutete (blinde) Felder, robuster
    "BLINDTIEFE_MM":       0.30,   # Tiefe der Felder, falls nicht durchbrochen
    "SPROSSEN_ANZAHL":     8,      # Schätzung: senkrechte Laternensprossen
    "SPROSSEN_B_MM":       0.45,
    "SCHEIBEN_TIEFE_MM":   0.20,   # Rücksprung der Laternenscheiben
    "KRANZ_H_MM":          0.25,   # oberer Laternenkranz
    "TRAUFE_DICKE_MM":     0.40,
    # Öse (ersetzt die Wetterfahne auf der Dachspitze)
    "OESE_INNEN_D_MM":     3.60,
    "OESE_RING_RADIAL_MM": 1.30,
    "OESE_RING_AXIAL_MM":  1.90,
    "HALS_D_MM":           1.40,   # Schaft zwischen Dachspitze und Öse (= Fahnenstange)
    "HALS_KRAGEN_D_MM":    1.70,   # Kragen, wo der Schaft aus dem Dach kommt
    "HALS_SPALT_MM":       0.60,   # sichtbare Schaftlänge zwischen Dachspitze und Öse
    # Sonstiges
    "SOCKEL_FASE_UNTEN_MM": 0.25,  # gegen Elefantenfuß (FDM) und für angenehme Kanten
    "SOCKEL_FASE_OBEN_MM":  0.15,
    "SEGMENTE":            96,     # Auflösung runder Teile
    "UEBERLAPPUNG_MM":     0.10,   # Bauteile greifen ineinander → sichere Vereinigung
    "INSCHRIFT_1":         False,  # optional: gravierte "1" (Lage am Original nicht belegt)
    "INSCHRIFT_TIEFE_MM":  0.25,
    # Variante B (Halbrelief)
    "RELIEF_TIEFENFAKTOR": 0.75,   # Stauchung der Tiefe der vorderen Hälfte
}

OKT = math.pi / 8.0          # halber Mittelpunktswinkel des Achtecks (22,5°)


# ---------------------------------------------------------------------------
# 3) ABGELEITETE MODELLMASSE
# ---------------------------------------------------------------------------
def berechne_masse():
    r = {k: v[0] for k, v in REAL.items()}
    oese_aussen = P["OESE_INNEN_D_MM"] + 2.0 * P["OESE_RING_RADIAL_MM"]
    s = (P["GESAMTHOEHE_MM"] - oese_aussen - P["HALS_SPALT_MM"]) / r["Z_DACH_SPITZE"]

    m = {"s": s, "massstab": 1000.0 / s, "oese_aussen": oese_aussen}
    m["sockel_h"] = r["SOCKEL_H"] * s
    m["sockel_sw"] = r["SOCKEL_SW"] * s
    m["turm_sw_u"] = r["TURM_SW_UNTEN"] * s
    m["turm_sw_o"] = r["TURM_SW_OBEN"] * s
    m["z_gu"] = r["Z_GALERIE_UNTEN"] * s
    m["z_go"] = r["Z_GALERIE_OBEN"] * s
    m["ausk_u"] = r["AUSKRAG_UNTEN"] * s
    m["ausk_o"] = r["AUSKRAG_OBEN"] * s
    m["gel_h"] = r["GELAENDER_H"] * s
    m["lat_r"] = r["LATERNE_D"] * s / 2.0
    m["z_bruest"] = m["z_go"] + r["BRUESTUNG_H"] * s
    m["z_glas"] = m["z_bruest"] + r["VERGLASUNG_H"] * s
    m["z_feuer"] = r["Z_FEUER"] * s
    m["dach_r"] = r["DACH_D"] * s / 2.0
    m["z_traufe"] = m["z_glas"] + P["TRAUFE_DICKE_MM"]
    m["z_spitze"] = r["Z_DACH_SPITZE"] * s
    m["z_oese_unten"] = m["z_spitze"] + P["HALS_SPALT_MM"]
    m["oese_R"] = P["OESE_INNEN_D_MM"] / 2.0 + P["OESE_RING_RADIAL_MM"] / 2.0
    m["z_oese_mitte"] = m["z_oese_unten"] + oese_aussen / 2.0
    m["z_oben"] = m["z_oese_unten"] + oese_aussen
    # Galerieböden: Schlüsselweite = Turm an dieser Höhe + 2 × Auskragung
    m["deck_sw_u"] = turm_sw(m, m["z_gu"]) + 2.0 * m["ausk_u"]
    m["deck_sw_o"] = turm_sw(m, m["z_go"]) + 2.0 * m["ausk_o"]
    return m


def turm_sw(m, z):
    """Schlüsselweite des sich verjüngenden Gussturms auf Höhe z (linear)."""
    t = (z - m["sockel_h"]) / (m["z_go"] - m["sockel_h"])
    return m["turm_sw_u"] + (m["turm_sw_o"] - m["turm_sw_u"]) * t


def umkreis(sw):
    """Umkreisradius eines regelmäßigen Achtecks aus seiner Schlüsselweite."""
    return sw / (2.0 * math.cos(OKT))


# ---------------------------------------------------------------------------
# 4) GEOMETRIE-HILFSFUNKTIONEN (alle erzeugen geschlossene, nach außen orientierte Netze)
# ---------------------------------------------------------------------------
def _objekt(name, verts, faces, coll):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.validate()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    coll.objects.link(obj)
    return obj


def loft(name, ringe, n, winkel0, coll, spitze_unten=None, spitze_oben=None):
    """Körper aus übereinanderliegenden regelmäßigen n-Ecken.
    ringe: Liste (Umkreisradius, z) von unten nach oben. Optional Spitzenpunkt (z) unten/oben."""
    verts, faces = [], []
    for (rad, z) in ringe:
        for i in range(n):
            a = winkel0 + 2.0 * math.pi * i / n
            verts.append((rad * math.cos(a), rad * math.sin(a), z))
    for j in range(len(ringe) - 1):
        for i in range(n):
            a, b = j * n + i, j * n + (i + 1) % n
            faces.append((a, b, b + n, a + n))
    if spitze_unten is None:
        faces.append(tuple(reversed(range(n))))
    else:
        verts.append((0.0, 0.0, spitze_unten))
        c = len(verts) - 1
        faces += [(c, (i + 1) % n, i) for i in range(n)]
    top0 = (len(ringe) - 1) * n
    if spitze_oben is None:
        faces.append(tuple(top0 + i for i in range(n)))
    else:
        verts.append((0.0, 0.0, spitze_oben))
        c = len(verts) - 1
        faces += [(top0 + i, top0 + (i + 1) % n, c) for i in range(n)]
    return _objekt(name, verts, faces, coll)


def ring_prisma(name, r_aussen, r_innen, z0, z1, n, winkel0, coll):
    """Prismatischer Ring (z. B. Geländerband) mit n-eckigem Außen- und Innenumriss."""
    verts = []
    for (rad, z) in ((r_aussen, z0), (r_aussen, z1), (r_innen, z0), (r_innen, z1)):
        for i in range(n):
            a = winkel0 + 2.0 * math.pi * i / n
            verts.append((rad * math.cos(a), rad * math.sin(a), z))
    ob, ot, ib, it = 0, n, 2 * n, 3 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((ob + i, ob + j, ot + j, ot + i))      # außen
        faces.append((ib + j, ib + i, it + i, it + j))      # innen
        faces.append((ot + i, ot + j, it + j, it + i))      # oben
        faces.append((ob + j, ob + i, ib + i, ib + j))      # unten
    return _objekt(name, verts, faces, coll)


def quader(name, mitte, groesse, drehung_z, coll):
    """Quader; groesse = (radial/x, tangential/y, z); um die z-Achse gedreht."""
    cx, cy, cz = mitte
    hx, hy, hz = (g / 2.0 for g in groesse)
    ca, sa = math.cos(drehung_z), math.sin(drehung_z)
    verts = []
    for (x, y, z) in ((-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                      (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)):
        verts.append((cx + x * ca - y * sa, cy + x * sa + y * ca, cz + z))
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return _objekt(name, verts, faces, coll)


def prisma_radial(name, profil, dicke, winkel, coll):
    """Senkrechtes, radial ausgerichtetes Prisma (z. B. Kragarm).
    profil: Polygon [(u, z), ...] in der radialen Ebene (u = Abstand zur Achse), gegen den
    Uhrzeigersinn; dicke: Stärke quer zur radialen Ebene; winkel: Richtung der Ebene."""
    ca, sa = math.cos(winkel), math.sin(winkel)
    n = len(profil)
    verts = []
    for v in (-dicke / 2.0, dicke / 2.0):
        for (u, z) in profil:
            verts.append((u * ca - v * sa, u * sa + v * ca, z))
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, n + i, n + j, j))
    return _objekt(name, verts, faces, coll)


_phase_zaehler = [0]


def rotationskoerper(name, profil, n, coll):
    """Rotationskörper um die z-Achse. profil: [(r, z), ...] von unten nach oben;
    Punkte mit r == 0 werden zu Polen (geschlossener Körper).
    Jeder Körper erhält eine eigene Winkelphase, damit Kanten verschiedener Bauteile
    nicht exakt aufeinanderliegen (vermeidet entartete Schnitte beim Boolean)."""
    _phase_zaehler[0] += 1
    phase = (2.0 * math.pi / n) * ((0.618034 * _phase_zaehler[0]) % 1.0)
    verts, faces, ringe = [], [], []
    for (rad, z) in profil:
        if rad <= 1e-9:
            verts.append((0.0, 0.0, z))
            ringe.append(("pol", len(verts) - 1))
        else:
            start = len(verts)
            for i in range(n):
                a = phase + 2.0 * math.pi * i / n
                verts.append((rad * math.cos(a), rad * math.sin(a), z))
            ringe.append(("ring", start))
    for (ta, a0), (tb, b0) in zip(ringe[:-1], ringe[1:]):
        if ta == "ring" and tb == "ring":
            for i in range(n):
                j = (i + 1) % n
                faces.append((a0 + i, a0 + j, b0 + j, b0 + i))
        elif ta == "pol" and tb == "ring":
            for i in range(n):
                faces.append((a0, b0 + (i + 1) % n, b0 + i))
        elif ta == "ring" and tb == "pol":
            for i in range(n):
                faces.append((a0 + i, a0 + (i + 1) % n, b0))
    if ringe[0][0] == "ring":
        faces.append(tuple(reversed(range(ringe[0][1], ringe[0][1] + n))))
    if ringe[-1][0] == "ring":
        faces.append(tuple(range(ringe[-1][1], ringe[-1][1] + n)))
    return _objekt(name, verts, faces, coll)


def oese(name, mitte_z, R, a, b, coll, nu=96, nv=32):
    """Öse als Ring mit elliptischem Querschnitt in der XZ-Ebene (Lochachse = Y).
    R = Radius der Ringmittellinie, a = halbe radiale Stärke, b = halbe Stärke in Y."""
    verts, faces = [], []
    for i in range(nu):
        u = 2.0 * math.pi * i / nu
        cu, su = math.cos(u), math.sin(u)
        for j in range(nv):
            v = 2.0 * math.pi * j / nv
            rr = R + a * math.cos(v)
            verts.append((rr * cu, b * math.sin(v), mitte_z + rr * su))
    for i in range(nu):
        for j in range(nv):
            i2, j2 = (i + 1) % nu, (j + 1) % nv
            faces.append((i * nv + j, i2 * nv + j, i2 * nv + j2, i * nv + j2))
    return _objekt(name, verts, faces, coll)


# ---------------------------------------------------------------------------
# 5) SZENE, MATERIALIEN, BOOLEAN
# ---------------------------------------------------------------------------
def szene_vorbereiten():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.scale_length = 0.001
    sc.unit_settings.length_unit = "MILLIMETERS"
    return sc


def collection(name, eltern=None, versteckt=False):
    c = bpy.data.collections.new(name)
    (eltern or bpy.context.scene.collection).children.link(c)
    c.hide_render = versteckt
    c.hide_viewport = versteckt
    return c


def material(name, farbe, metall=0.0, rauheit=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*farbe, 1.0)
        bsdf.inputs["Metallic"].default_value = metall
        bsdf.inputs["Roughness"].default_value = rauheit
    mat.diffuse_color = (*farbe, 1.0)
    return mat


def material_setzen(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def boolean_anwenden(ziel, operanden_coll, operation):
    """Boolean mit Collection-Operanden (Solver MANIFOLD) auswerten und als festes Netz übernehmen."""
    mod = ziel.modifiers.new(name=f"Bool_{operation}", type="BOOLEAN")
    mod.operation = operation
    mod.operand_type = "COLLECTION"
    mod.collection = operanden_coll
    mod.solver = "MANIFOLD"
    dg = bpy.context.evaluated_depsgraph_get()
    neu = bpy.data.meshes.new_from_object(ziel.evaluated_get(dg))
    alt = ziel.data
    ziel.modifiers.remove(mod)
    ziel.data = neu
    bpy.data.meshes.remove(alt)
    netz_bereinigen(ziel)
    return ziel


def netz_bereinigen(obj, toleranz=1e-6):
    """Dreiecksnetz erzwingen und entartete Elemente (Fläche/Länge ≈ 0) auflösen.
    So exportiert der STL-Export exakt dieses Netz, ohne eigene (fehleranfällige)
    Triangulierung von Vielecken mit kollinearen Punkten."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    for _ in range(3):
        bmesh.ops.dissolve_degenerate(bm, dist=toleranz, edges=bm.edges[:])
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=toleranz)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3],
                              quad_method="BEAUTY", ngon_method="BEAUTY")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()


def netz_statistik(obj):
    """Anzahl offener/nicht-manifold Kanten und entarteter Dreiecke."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    offen = sum(1 for e in bm.edges if not e.is_manifold)
    entartet = sum(1 for f in bm.faces if f.calc_area() < 1e-9)
    bm.free()
    return {"nicht_manifold_kanten": offen, "entartete_flaechen": entartet}


def ist_geschlossen(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    offen = sum(1 for e in bm.edges if not e.is_manifold)
    bm.free()
    return offen == 0


# ---------------------------------------------------------------------------
# 6) BAUTEILE
# ---------------------------------------------------------------------------
def baue_bauteile(m, c_teile, c_hilf):
    ov = P["UEBERLAPPUNG_MM"]
    n = P["SEGMENTE"]
    teile = {}

    # --- Granitsockel (achteckig, belegt) -----------------------------------
    fu, fo = P["SOCKEL_FASE_UNTEN_MM"], P["SOCKEL_FASE_OBEN_MM"]
    R = umkreis(m["sockel_sw"])
    ru, ro = umkreis(m["sockel_sw"] - 2 * fu), umkreis(m["sockel_sw"] - 2 * fo)
    teile["Sockel_Granit"] = loft("Sockel_Granit",
                                  [(ru, 0.0), (R, fu), (R, m["sockel_h"] - fo), (ro, m["sockel_h"])],
                                  8, OKT, c_teile)

    # --- Gussturm (achteckig, verjüngt, belegt) -----------------------------
    teile["Turm_Gusseisen"] = loft("Turm_Gusseisen",
                                   [(umkreis(m["turm_sw_u"]), m["sockel_h"] - ov),
                                    (umkreis(turm_sw(m, m["z_go"])), m["z_go"] - ov)],
                                   8, OKT, c_teile)

    # --- Galerien: Boden, Kragarme, Geländer --------------------------------
    for key, z_deck, sw_deck in (("unten", m["z_gu"], m["deck_sw_u"]),
                                 ("oben", m["z_go"], m["deck_sw_o"])):
        t_b = P["BODEN_DICKE_MM"]
        R_deck = umkreis(sw_deck)
        teile[f"Galerie_{key}_Boden"] = loft(f"Galerie_{key}_Boden",
                                             [(R_deck, z_deck - t_b), (R_deck, z_deck)],
                                             8, OKT, c_teile)
        # Kragarme unter den Turmecken (45° → stützenfrei druckbar)
        z_ub = z_deck - t_b
        u_turm = umkreis(turm_sw(m, z_ub))
        # An der Achteckecke weicht die Bodenkante seitlich um tan(22,5°) zurück: das Kragarmende
        # muss bei halber Kragarmdicke noch 0,05 mm innerhalb der Bodenkante liegen (keine Grate).
        u_ende = R_deck - (P["KRAGARM_DICKE_MM"] / 2.0) * math.tan(OKT) - 0.05
        tiefe = u_ende - u_turm
        kragarme = []
        for k in range(P["KRAGARM_ANZAHL"]):
            w = OKT + 2.0 * math.pi * k / P["KRAGARM_ANZAHL"]
            profil = [(u_turm - 0.30, z_ub - tiefe - 0.30),
                      (u_ende, z_ub + ov),
                      (u_turm - 0.30, z_ub + ov)]
            # gegen den Uhrzeigersinn in der (u, z)-Ebene
            profil = [profil[0], profil[1], profil[2]] if _ccw(profil) else list(reversed(profil))
            kragarme.append(prisma_radial(f"Galerie_{key}_Kragarm_{k + 1}", profil,
                                          P["KRAGARM_DICKE_MM"], w, c_teile))
        teile[f"Galerie_{key}_Kragarme"] = kragarme

        # Geländerband mit Öffnungen zwischen den Eckpfosten
        t_g = P["GELAENDER_DICKE_MM"]
        gel = ring_prisma(f"Galerie_{key}_Gelaender", R_deck, umkreis(sw_deck - 2 * t_g),
                          z_deck - ov, z_deck + m["gel_h"], 8, OKT, c_teile)
        seite = sw_deck * math.tan(OKT)
        breite = seite - 2.0 * P["PFOSTEN_B_MM"]
        h_off = m["gel_h"] - P["HANDLAUF_H_MM"]
        c_off = collection(f"Hilf_Oeffnungen_{key}", c_hilf, versteckt=True)
        if P["GELAENDER_DURCHBROCHEN"]:
            r_mitte, tiefe_o = sw_deck / 2.0 - t_g / 2.0, t_g + 0.6
        else:
            r_mitte, tiefe_o = sw_deck / 2.0 - P["BLINDTIEFE_MM"] / 2.0 + 0.15, P["BLINDTIEFE_MM"] + 0.3
        z0, z1 = z_deck - ov / 2.0, z_deck + h_off
        for k in range(8):
            w = 2.0 * math.pi * k / 8
            quader(f"Hilf_Oeffnung_{key}_{k + 1}",
                   (r_mitte * math.cos(w), r_mitte * math.sin(w), (z0 + z1) / 2.0),
                   (tiefe_o, breite, z1 - z0), w, c_off)
        boolean_anwenden(gel, c_off, "DIFFERENCE")
        teile[f"Galerie_{key}_Gelaender"] = gel

    # --- Laterne (rund, belegt) --------------------------------------------
    r_l = m["lat_r"]
    teile["Laterne_Bruestung"] = rotationskoerper(
        "Laterne_Bruestung", [(0, m["z_go"] - ov), (r_l, m["z_go"] - ov), (r_l, m["z_bruest"]),
                              (0, m["z_bruest"])], n, c_teile)
    r_kern = r_l - P["SCHEIBEN_TIEFE_MM"]
    teile["Laterne_Verglasung"] = rotationskoerper(
        "Laterne_Verglasung", [(0, m["z_bruest"] - ov), (r_kern, m["z_bruest"] - ov),
                               (r_kern, m["z_glas"] + ov), (0, m["z_glas"] + ov)], n, c_teile)
    sprossen = []
    h_spr = m["z_glas"] - m["z_bruest"]
    # Außenfläche so weit zurück, dass die Sprossenkanten genau auf dem Laternenzylinder liegen
    r_aussen = math.sqrt(r_l ** 2 - (P["SPROSSEN_B_MM"] / 2.0) ** 2)
    for k in range(P["SPROSSEN_ANZAHL"]):
        w = OKT + 2.0 * math.pi * k / P["SPROSSEN_ANZAHL"]
        rm = (r_kern - 0.10 + r_aussen) / 2.0
        sprossen.append(quader(f"Laterne_Sprosse_{k + 1}",
                               (rm * math.cos(w), rm * math.sin(w), m["z_bruest"] + h_spr / 2.0),
                               (r_aussen - r_kern + 0.10, P["SPROSSEN_B_MM"], h_spr + 2 * ov), w, c_teile))
    teile["Laterne_Sprossen"] = sprossen
    teile["Laterne_Kranz"] = rotationskoerper(
        "Laterne_Kranz", [(0, m["z_glas"] - P["KRANZ_H_MM"]), (r_l, m["z_glas"] - P["KRANZ_H_MM"]),
                          (r_l, m["z_glas"] + ov), (0, m["z_glas"] + ov)], n, c_teile)

    # --- Dach (Kupfer, helm-/kuppelförmig, belegt) --------------------------
    r_d = m["dach_r"]
    teile["Dach_Traufe"] = rotationskoerper(
        "Dach_Traufe", [(0, m["z_glas"]), (r_d, m["z_glas"]), (r_d, m["z_traufe"]),
                        (0, m["z_traufe"])], n, c_teile)
    # Kuppel als Ellipsenviertel; Basis liegt um "ov" in der Traufe (nicht koplanar)
    r_k = r_d * 0.96
    z0_k = m["z_traufe"] - ov
    h_k = m["z_spitze"] - z0_k
    profil = [(0, z0_k - ov)]
    for i in range(0, 17):
        t = (math.pi / 2.0) * i / 16.0
        profil.append((r_k * math.cos(t), z0_k + h_k * math.sin(t)))
    profil[-1] = (0.0, m["z_spitze"])
    teile["Dach_Kuppel"] = rotationskoerper("Dach_Kuppel", profil, n, c_teile)

    # --- Schaft (ersetzt Fahnenstange) und Öse -------------------------------
    rk = P["HALS_KRAGEN_D_MM"] / 2.0
    rh = P["HALS_D_MM"] / 2.0
    z_kragen = dach_hoehe_bei(m, rk) - 0.15            # Kragen sitzt im Dach
    z_hals_oben = m["z_oese_unten"] + P["OESE_RING_RADIAL_MM"] * 0.55
    teile["Oese_Schaft"] = rotationskoerper(
        "Oese_Schaft", [(0, z_kragen), (rk, z_kragen), (rk, dach_hoehe_bei(m, rk) + 0.05),
                        (rh, m["z_spitze"] + 0.25), (rh, z_hals_oben), (0, z_hals_oben)], n, c_teile)
    teile["Oese"] = oese("Oese", m["z_oese_mitte"], m["oese_R"],
                         P["OESE_RING_RADIAL_MM"] / 2.0, P["OESE_RING_AXIAL_MM"] / 2.0, c_teile)
    return teile


def _ccw(poly):
    a = 0.0
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        a += x1 * y2 - x2 * y1
    return a > 0


def dach_hoehe_bei(m, r):
    """z der Kuppeloberfläche bei Radius r (Ellipsenviertel, siehe Dach_Kuppel)."""
    r_k = m["dach_r"] * 0.96
    z0_k = m["z_traufe"] - P["UEBERLAPPUNG_MM"]
    h_k = m["z_spitze"] - z0_k
    x = min(max(r / r_k, 0.0), 1.0)
    return z0_k + h_k * math.sqrt(1.0 - x * x)


def inschrift_1(m, c_hilf):
    """Optionale gravierte "1" auf der Vorderfläche (−Y) des unteren Turmabschnitts.
    Am Original ist eine Aufschrift "1" belegt (Leuchtturm-Atlas, Stand 2009), Lage/Größe nicht.
    Eigene serifenlose Glyphe (Strichstärke ≈ 0,5 mm) als geschlossenes Prisma, senkrecht zur
    geneigten Turmfläche – eine Schrift-Kurve wäre für diese Größe zu dünn und nicht geschlossen."""
    umriss = [(-0.60, -1.20), (0.60, -1.20), (0.60, -0.85), (0.25, -0.85), (0.25, 1.20),
              (-0.10, 1.20), (-0.70, 0.62), (-0.70, 0.05), (-0.25, 0.485), (-0.25, -0.85),
              (-0.60, -0.85)]
    h_frei = m["z_gu"] - P["BODEN_DICKE_MM"] - m["sockel_h"]
    k = min(1.0, 0.6 * h_frei / 2.4)                      # Glyphe 2,4 mm hoch, ggf. kleiner
    z_mitte = m["sockel_h"] + 0.45 * h_frei
    neigung = math.atan((m["turm_sw_u"] - m["turm_sw_o"]) / 2.0 / (m["z_go"] - m["sockel_h"]))
    tiefe, ueber = P["INSCHRIFT_TIEFE_MM"], 0.40
    verts = []
    for d in (-tiefe, ueber):                              # d < 0: in den Turm hinein
        for (u, w) in umriss:
            w_k = w * k
            # Punkt auf der geneigten Fläche, dann entlang der Flächennormale versetzen
            z = z_mitte + w_k * math.cos(neigung)
            y_flaeche = -(turm_sw(m, z_mitte) / 2.0) + w_k * math.sin(neigung)
            verts.append((u * k, y_flaeche - d * math.cos(neigung), z + d * math.sin(neigung)))
    n = len(umriss)
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return _objekt("Hilf_Inschrift_1", verts, faces, c_hilf)


# ---------------------------------------------------------------------------
# 7) HAUPTABLAUF
# ---------------------------------------------------------------------------
def alle_objekte(teile):
    for v in teile.values():
        if isinstance(v, list):
            yield from v
        else:
            yield v


def stl_export(obj, pfad):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.stl_export(filepath=pfad, export_selected_objects=True, apply_modifiers=True,
                          global_scale=1.0, use_scene_unit=False, ascii_format=False,
                          forward_axis="Y", up_axis="Z")


def main(out_dir, relief=False, blend_name="Mole1_Brunsbuettel_Anhaenger.blend"):
    os.makedirs(out_dir, exist_ok=True)
    sc = szene_vorbereiten()
    m = berechne_masse()

    c_teile = collection("01_Bauteile")
    c_hilf = collection("02_Hilfsgeometrie", versteckt=True)
    c_union = collection("Hilf_Union_Operanden", c_hilf, versteckt=True)
    c_export = collection("03_Export_Anhaenger")

    teile = baue_bauteile(m, c_teile, c_hilf)

    # Farben nach der realen Farbgebung (nur zur Dokumentation)
    mats = {
        "granit": material("Granit_grau", (0.42, 0.42, 0.40), 0.0, 0.8),
        "weiss": material("Anstrich_weiss", (0.85, 0.85, 0.83), 0.0, 0.45),
        "schwarz": material("Anstrich_schwarz", (0.03, 0.03, 0.03), 0.0, 0.5),
        "glas": material("Laterne_Glas", (0.25, 0.35, 0.38), 0.0, 0.1),
        "kupfer_weiss": material("Dach_weiss", (0.88, 0.88, 0.86), 0.0, 0.4),
        "silber": material("Silber_925", (0.90, 0.90, 0.92), 1.0, 0.18),
    }
    for ob in alle_objekte(teile):
        nm = ob.name
        if nm.startswith("Sockel"):
            mat = mats["granit"]
        elif nm.startswith("Turm"):
            mat = mats["weiss"]
        elif nm.startswith("Galerie") or nm.startswith("Laterne_Bruestung") or \
                nm.startswith("Laterne_Sprosse") or nm.startswith("Laterne_Kranz"):
            mat = mats["schwarz"]
        elif nm.startswith("Laterne_Verglasung"):
            mat = mats["glas"]
        elif nm.startswith("Dach"):
            mat = mats["kupfer_weiss"]
        else:
            mat = mats["silber"]
        material_setzen(ob, mat)

    pruef = {ob.name: ist_geschlossen(ob) for ob in alle_objekte(teile)}
    nicht_geschlossen = [k for k, v in pruef.items() if not v]

    # --- Vereinigung zu einem Körper ---------------------------------------
    basis = teile["Sockel_Granit"]
    for ob in alle_objekte(teile):
        if ob is not basis:
            c_union.objects.link(ob)
    if P["INSCHRIFT_1"]:
        c_gravur = collection("Hilf_Inschrift", c_hilf, versteckt=True)
        inschrift_1(m, c_gravur)

    final = bpy.data.objects.new("Mole1_Anhaenger_A_3D", basis.data.copy())
    c_export.objects.link(final)
    boolean_anwenden(final, c_union, "UNION")
    if P["INSCHRIFT_1"]:
        boolean_anwenden(final, c_gravur, "DIFFERENCE")
    material_setzen(final, mats["silber"])
    c_teile.hide_viewport = True
    c_teile.hide_render = True

    ergebnis = {
        "blender_version": bpy.app.version_string,
        "massstab": f"1:{m['massstab']:.0f}",
        "mm_pro_m": round(m["s"], 4),
        "teile_geschlossen": len(pruef) - len(nicht_geschlossen),
        "teile_nicht_geschlossen": nicht_geschlossen,
        "final_geschlossen": ist_geschlossen(final),
        "final_netz": netz_statistik(final),
        "final_vertices": len(final.data.vertices),
        "final_faces": len(final.data.polygons),
        "modellmasse_mm": {k: round(v, 4) for k, v in m.items()},
        "parameter": P,
        "realmasse": {k: {"wert_m": v[0], "status": v[1], "begruendung": v[2]} for k, v in REAL.items()},
        "dateien": {},
    }

    stl_a = os.path.join(out_dir, f"Mole1_Brunsbuettel_Anhaenger_A_{P['GESAMTHOEHE_MM']:.0f}mm.stl")
    stl_export(final, stl_a)
    ergebnis["dateien"]["stl_A"] = os.path.basename(stl_a)

    # --- Variante B: Halbrelief (Vergleich) ---------------------------------
    if relief:
        c_rel = collection("04_Variante_B_Relief")
        c_rel_hilf = collection("Hilf_Relief", c_hilf, versteckt=True)
        b = bpy.data.objects.new("Mole1_Anhaenger_B_Relief", final.data.copy())
        c_rel.objects.link(b)
        groesse = 100.0
        quader("Hilf_Relief_Hinterseite", (0.0, groesse / 2.0, groesse / 4.0),
               (groesse, groesse, groesse), 0.0, c_rel_hilf)
        boolean_anwenden(b, c_rel_hilf, "DIFFERENCE")          # hintere Hälfte (y > 0) entfernen
        k = P["RELIEF_TIEFENFAKTOR"]
        for v in b.data.vertices:
            v.co.y *= k
        c_rel_oese = collection("Hilf_Relief_Oese", c_hilf, versteckt=True)
        b_oese = oese("Hilf_Relief_Oese_voll", m["z_oese_mitte"], m["oese_R"],
                      P["OESE_RING_RADIAL_MM"] / 2.0, P["OESE_RING_AXIAL_MM"] / 2.0, c_rel_oese)
        for v in b_oese.data.vertices:                          # volle Ösenstärke vor der Rückseite
            v.co.y -= P["OESE_RING_AXIAL_MM"] / 2.0
        boolean_anwenden(b, c_rel_oese, "UNION")
        material_setzen(b, mats["silber"])
        b.location.x = 15.0                                     # nur zur Ansicht neben Variante A
        ergebnis["relief_geschlossen"] = ist_geschlossen(b)
        ergebnis["relief_netz"] = netz_statistik(b)
        stl_b = os.path.join(out_dir, "Mole1_Brunsbuettel_Variante_B_Relief_Vergleich.stl")
        loc = b.location.copy()
        b.location = (0.0, 0.0, 0.0)
        stl_export(b, stl_b)
        b.location = loc
        ergebnis["dateien"]["stl_B"] = os.path.basename(stl_b)

    # Skript als Textblock in die .blend legen (dort erneut ausführbar)
    try:
        with open(os.path.abspath(__file__), encoding="utf-8") as f:
            txt = bpy.data.texts.new("mole1_anhaenger.py")
            txt.write(f.read())
    except (NameError, OSError):
        pass

    blend = os.path.join(out_dir, blend_name)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    ergebnis["dateien"]["blend"] = os.path.basename(blend)
    with open(os.path.join(out_dir, "modell_parameter.json"), "w", encoding="utf-8") as f:
        json.dump(ergebnis, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in ergebnis.items()
                      if k not in ("modellmasse_mm", "parameter", "realmasse")}, ensure_ascii=False, indent=2))
    return ergebnis


def _argumente():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    out, relief = None, False
    i = 0
    while i < len(argv):
        if argv[i] == "--out" and i + 1 < len(argv):
            out = argv[i + 1]
            i += 1
        elif argv[i] == "--relief":
            relief = True
        elif argv[i] == "--hoehe" and i + 1 < len(argv):
            P["GESAMTHOEHE_MM"] = float(argv[i + 1])
            i += 1
        elif argv[i] == "--inschrift":
            P["INSCHRIFT_1"] = True
        elif argv[i] == "--blind":
            P["GELAENDER_DURCHBROCHEN"] = False
        i += 1
    if out is None:
        basis = bpy.data.filepath and os.path.dirname(bpy.data.filepath)
        if not basis:
            try:
                basis = os.path.dirname(os.path.abspath(__file__))
            except NameError:
                basis = os.getcwd()
        out = basis if os.path.basename(basis) == "export" else os.path.join(basis, "export")
    return os.path.abspath(out), relief


if __name__ == "__main__":
    ziel, mit_relief = _argumente()
    main(ziel, relief=mit_relief)
