#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Unabhängige Geometrieprüfung der exportierten STL-Dateien (trimesh + shapely).

Prüft: Maße/Skalierung, geschlossene Oberfläche, nicht-manifold Kanten, entartete Flächen,
Anzahl Körper (lose Teile), Vollständigkeit aller Bauteile (aus der .blend), Durchbrüche,
Wandstärken (Raycasting nach innen), enge Spalte (Raycasting nach außen), Überhänge und
schwebende Inseln für die Druckausrichtung "aufrecht", Öse (Lochweite, Querschnitte),
Volumen und Gewicht.

Aufruf: python pruefung_geometrie.py --export <export-ordner> --out <pruef-ordner>
(benötigt trimesh, shapely, numpy, rtree; für den Bauteilabgleich zusätzlich das pip-Paket bpy)
"""
import json
import math
import os
import sys
from collections import Counter

import numpy as np
import trimesh
from shapely.geometry import Polygon
from shapely.ops import unary_union

DICHTE = {  # g/cm³, typische Werte – je nach Legierung abweichend
    "PLA (Prototyp)": 1.24,
    "Gusswachs/Resin (Modell)": 1.10,
    "Sterlingsilber 925": 10.36,
    "Gelbgold 585 (14 kt)": 13.1,
    "Gelbgold 750 (18 kt)": 15.5,
}


def argumente():
    argv = sys.argv[1:]
    a = {"export": None, "out": None}
    for i, x in enumerate(argv):
        if x in ("--export", "--out"):
            a[x[2:]] = os.path.abspath(argv[i + 1])
    return a


def lade(pfad):
    return trimesh.load(pfad, force="mesh")


def grundpruefung(m):
    kanten = np.sort(m.edges, axis=1)
    nutzung = Counter(Counter(map(tuple, kanten)).values())
    koerper = m.split(only_watertight=False)
    return {
        "dreiecke": int(len(m.faces)),
        "punkte": int(len(m.vertices)),
        "bbox_min_mm": np.round(m.bounds[0], 3).tolist(),
        "bbox_max_mm": np.round(m.bounds[1], 3).tolist(),
        "abmessungen_mm": np.round(m.extents, 3).tolist(),
        "wasserdicht": bool(m.is_watertight),
        "orientierung_konsistent": bool(m.is_winding_consistent),
        "gueltiges_volumen": bool(m.is_volume),
        "kanten_nutzung": {str(k): int(v) for k, v in sorted(nutzung.items())},
        "nicht_manifold_kanten": int(sum(v for k, v in nutzung.items() if k != 2)),
        "entartete_dreiecke": int((m.area_faces < 1e-10).sum()),
        "doppelte_dreiecke": int(len(m.faces) - len(np.unique(np.sort(m.faces, axis=1), axis=0))),
        "euler_charakteristik": int(m.euler_number),
        "geschlecht_genus": int((2 - m.euler_number) // 2),
        "anzahl_koerper": int(len(koerper)),
        "volumen_mm3": round(float(m.volume), 3),
        "oberflaeche_mm2": round(float(m.area), 2),
        "schwerpunkt_mm": np.round(m.center_mass, 3).tolist(),
    }


GEGENUEBER_COS = 0.7   # Gegenfläche gilt als "gegenüber", wenn ihre Normale höchstens ~45° abweicht


def wandstaerken(m, n=60000, seed=1):
    """Lokale Wandstärke: Strahl vom Oberflächenpunkt nach innen bis zur Gegenseite.
    Gewertet wird nur, wenn die Austrittsfläche der Startfläche gegenüberliegt (echte Wand);
    Treffer seitlicher Nachbarflächen an Außenkanten sind Messartefakte (→ NaN)."""
    pts, fid = trimesh.sample.sample_surface_even(m, n, seed=seed)
    nrm = m.face_normals[fid]
    start = pts - nrm * 1e-4
    loc, idx_ray, idx_tri = m.ray.intersects_location(start, -nrm, multiple_hits=False)
    d = np.full(len(pts), np.nan)
    gegen = (m.face_normals[idx_tri] * nrm[idx_ray]).sum(axis=1) < -GEGENUEBER_COS
    d[idx_ray[gegen]] = np.linalg.norm(loc[gegen] - start[idx_ray[gegen]], axis=1)
    roh = np.full(len(pts), np.nan)
    roh[idx_ray] = np.linalg.norm(loc - start[idx_ray], axis=1)
    return pts, d, roh


def spalte(m, n=60000, seed=2):
    """Lichte Weite vor der Oberfläche: Strahl nach außen bis zur nächsten Gegenfläche.
    Gewertet wird nur eine gegenüberliegende Fläche (echter Spalt); Treffer an Innenecken
    (Nachbarfläche steht quer zum Strahl) sind keine Spalte (→ inf)."""
    pts, fid = trimesh.sample.sample_surface_even(m, n, seed=seed)
    nrm = m.face_normals[fid]
    start = pts + nrm * 1e-4
    loc, idx_ray, idx_tri = m.ray.intersects_location(start, nrm, multiple_hits=False)
    d = np.full(len(pts), np.inf)
    gegen = (m.face_normals[idx_tri] * nrm[idx_ray]).sum(axis=1) < -GEGENUEBER_COS
    d[idx_ray[gegen]] = np.linalg.norm(loc[gegen] - start[idx_ray[gegen]], axis=1)
    roh = np.full(len(pts), np.inf)
    roh[idx_ray] = np.linalg.norm(loc - start[idx_ray], axis=1)
    return pts, d, roh


def zone(z, mm):
    """Ordnet eine Höhe (mm) dem Bauteil zu."""
    grenzen = [
        (0.0, mm["sockel_h"], "Granitsockel"),
        (mm["sockel_h"], mm["z_gu"] - 0.6 - 2.0, "Turmschaft unten"),
        (mm["z_gu"] - 0.6 - 2.0, mm["z_gu"] + mm["gel_h"] + 0.05, "untere Galerie (Kragarme/Boden/Geländer)"),
        (mm["z_gu"] + mm["gel_h"] + 0.05, mm["z_go"] - 0.6 - 1.7, "Turmschaft oben"),
        (mm["z_go"] - 0.6 - 1.7, mm["z_go"] + mm["gel_h"] + 0.05, "obere Galerie (Kragarme/Boden/Geländer)"),
        (mm["z_go"] + mm["gel_h"] + 0.05, mm["z_glas"] + 0.05, "Laterne"),
        (mm["z_glas"] + 0.05, mm["z_oese_unten"], "Dach/Kuppel/Schaft"),
        (mm["z_oese_unten"], 1e9, "Öse"),
    ]
    for a, b, name in grenzen:
        if a <= z < b:
            return name
    return "?"


def statistik_nach_zone(pts, werte, mm, grenzen_mm):
    out = {}
    for z, w in zip(pts[:, 2], werte):
        if not np.isfinite(w):
            continue
        name = zone(z, mm)
        e = out.setdefault(name, {"n": 0, "min": 1e9, **{f"anteil_unter_{g}": 0 for g in grenzen_mm}})
        e["n"] += 1
        e["min"] = min(e["min"], float(w))
        for g in grenzen_mm:
            if w < g:
                e[f"anteil_unter_{g}"] += 1
    for e in out.values():
        for g in grenzen_mm:
            e[f"anteil_unter_{g}"] = round(e[f"anteil_unter_{g}"] / e["n"], 4)
        e["min"] = round(e["min"], 3)
    return out


def ueberhaenge(m, grenzwinkel=45.0):
    """Flächen, die steiler als grenzwinkel (gegen die Senkrechte) nach unten zeigen."""
    nz = m.face_normals[:, 2]
    zmin = m.triangles[:, :, 2].min(axis=1)
    unten = (nz < -math.cos(math.radians(grenzwinkel))) & (zmin > 1e-3)
    return unten, zmin


def inseln(m, schicht=0.08):
    """Schichtweise Schnitte (wie im Slicer): Bereiche, die ohne Verbindung zur Schicht darunter beginnen."""
    zs = np.arange(schicht / 2.0, m.bounds[1][2], schicht)
    schnitte = m.section_multiplane(plane_origin=[0, 0, 0], plane_normal=[0, 0, 1], heights=zs)
    vorher = None
    befunde = []
    for z, s in zip(zs, schnitte):
        if s is None:
            vorher = None
            continue
        polys = [Polygon(p.exterior.coords, [i.coords for i in p.interiors]).buffer(0) for p in s.polygons_full]
        if vorher is not None:
            for p in polys:
                if p.area > 1e-4 and not p.intersects(vorher):
                    befunde.append({"z_mm": round(float(z), 3), "flaeche_mm2": round(p.area, 4),
                                    "mitte_mm": [round(c, 2) for c in p.centroid.coords[0]]})
        vorher = unary_union(polys).buffer(1e-3) if polys else None
    return befunde, len(zs)


def querschnitt(m, z, normal=(0, 0, 1), nur_ueber_z=None):
    """Schnittfläche (mm²) der Ebene durch (0, 0, z); optional nur Teilflächen oberhalb nur_ueber_z."""
    s = m.section(plane_origin=[0, 0, z], plane_normal=list(normal))
    if s is None:
        return 0.0, 0
    p2, T = s.to_planar()
    polys = list(p2.polygons_full)
    if nur_ueber_z is not None:
        def z_welt(p):
            c = np.array([*p.centroid.coords[0], 0.0, 1.0])
            return (T @ c)[2]
        polys = [p for p in polys if z_welt(p) > nur_ueber_z]
    return float(sum(p.area for p in polys)), len(polys)


def oesen_pruefung(m, mm, prm):
    """Lochweite der Öse und Querschnitte im Kraftfluss Öse → Schaft → Kuppel."""
    zc = mm["z_oese_mitte"]
    # Lochweite: Strahlen in der Ösenebene (y = 0) vom Mittelpunkt nach außen
    winkel = np.radians(np.arange(0, 360, 5))
    start = np.tile([0.0, 0.0, zc], (len(winkel), 1))
    richt = np.stack([np.cos(winkel), np.zeros_like(winkel), np.sin(winkel)], axis=1)
    loc, idx, _ = m.ray.intersects_location(start, richt, multiple_hits=False)
    r = np.linalg.norm(loc - start[idx], axis=1)
    loch_mitte_frei = not bool(m.contains([[0.0, 0.0, zc]])[0])
    # Querschnitte: Schaft (waagerecht) und Ringflanken (waagerechter Schnitt durch Ösenmitte)
    z_schaft = (mm["z_spitze"] + mm["z_oese_unten"]) / 2.0
    a_schaft, _ = querschnitt(m, z_schaft)
    a_flanken, n_flanken = querschnitt(m, zc)
    # senkrechter Schnitt x = 0, nur oberer Ringbogen (dort liegt der Schlüsselring an)
    a_scheitel, _ = querschnitt(m, zc, normal=(1, 0, 0), nur_ueber_z=zc)
    return {
        "loch_mitte_frei": loch_mitte_frei,
        "lochdurchmesser_min_mm": round(2 * float(r.min()), 3),
        "lochdurchmesser_max_mm": round(2 * float(r.max()), 3),
        "soll_innen_d_mm": prm["OESE_INNEN_D_MM"],
        "aussen_d_mm": round(mm["oese_aussen"], 3),
        "ring_radial_mm": prm["OESE_RING_RADIAL_MM"],
        "ring_axial_mm": prm["OESE_RING_AXIAL_MM"],
        "querschnitt_schaft_mm2": round(a_schaft, 3),
        "z_schaft_schnitt_mm": round(z_schaft, 3),
        "querschnitt_ringflanken_gesamt_mm2": round(a_flanken, 3),
        "ringflanken_anzahl": n_flanken,
        "querschnitt_ringscheitel_oben_mm2": round(a_scheitel, 3),
    }


def bauteile_aus_blend(blend):
    """Netze der Einzelbauteile aus der .blend lesen (für den Vollständigkeitsabgleich)."""
    try:
        import bpy
    except ImportError:
        return None
    bpy.ops.wm.open_mainfile(filepath=blend)
    coll = bpy.data.collections.get("01_Bauteile")
    teile = {}
    for ob in coll.objects:
        me = ob.data
        me.calc_loop_triangles()
        v = np.array([ob.matrix_world @ x.co for x in me.vertices])
        f = np.array([t.vertices[:] for t in me.loop_triangles])
        teile[ob.name] = trimesh.Trimesh(v, f, process=True)
    return teile


def vollstaendigkeit(final, teile, n=200, seed=3):
    """Punkte aus dem Inneren jedes Bauteils müssen im Endkörper liegen."""
    rng = np.random.default_rng(seed)
    ergebnis = {}
    for name, t in sorted(teile.items()):
        if not t.is_volume:
            ergebnis[name] = {"fehler": "Bauteil nicht geschlossen"}
            continue
        lo, hi = t.bounds
        kand = rng.uniform(lo, hi, size=(n * 15, 3))
        innen = kand[t.contains(kand)][:n]
        if len(innen) == 0:
            ergebnis[name] = {"stichproben": 0}
            continue
        drin = final.contains(innen)
        ergebnis[name] = {"stichproben": int(len(innen)), "anteil_im_endkoerper": round(float(drin.mean()), 4)}
    return ergebnis


def durchbrueche(final, mm, prm):
    """Mittelpunkte der Geländeröffnungen und das Ösenloch müssen frei sein (nicht im Körper)."""
    tests = {}
    t_g = prm["GELAENDER_DICKE_MM"]
    for key, z, sw in (("unten", mm["z_gu"], mm["deck_sw_u"]), ("oben", mm["z_go"], mm["deck_sw_o"])):
        zm = z + (mm["gel_h"] - prm["HANDLAUF_H_MM"]) / 2.0
        r = sw / 2.0 - t_g / 2.0
        pkt = [[r * math.cos(w), r * math.sin(w), zm] for w in np.radians(np.arange(0, 360, 45))]
        tests[f"Geländeröffnungen {key} (8 Stück) frei"] = bool(not final.contains(pkt).any())
    tests["Ösenloch frei"] = bool(not final.contains([[0, 0, mm["z_oese_mitte"]]])[0])
    return tests


def main():
    a = argumente()
    os.makedirs(a["out"], exist_ok=True)
    with open(os.path.join(a["export"], "modell_parameter.json"), encoding="utf-8") as f:
        par = json.load(f)
    mm, prm = par["modellmasse_mm"], par["parameter"]

    bericht = {"quelle": par["dateien"], "massstab": par["massstab"]}
    dateien = {"A": par["dateien"]["stl_A"]}

    for var, datei in dateien.items():
        m = lade(os.path.join(a["export"], datei))
        r = {"datei": datei, "grund": grundpruefung(m)}
        r["gewicht_g"] = {k: round(m.volume / 1000.0 * d, 2) for k, d in DICHTE.items()}

        pts, d, d_roh = wandstaerken(m)
        r["wandstaerke"] = {
            "methode": "Raycasting nach innen, nur gegenüberliegende Austrittsfläche (±45°) gewertet",
            "min_mm": round(float(np.nanmin(d)), 3),
            "p01_mm": round(float(np.nanpercentile(d, 1)), 3),
            "p05_mm": round(float(np.nanpercentile(d, 5)), 3),
            "median_mm": round(float(np.nanmedian(d)), 3),
            "gewertete_messpunkte": int(np.isfinite(d).sum()),
            "kantenartefakte_verworfen": int(np.isfinite(d_roh).sum() - np.isfinite(d).sum()),
            "roh_min_mm_inkl_kanten": round(float(np.nanmin(d_roh)), 3),
            "nach_zone": statistik_nach_zone(pts, d, mm, (0.4, 0.5, 0.6)),
        }
        pts_g, g, g_roh = spalte(m)
        fin = np.isfinite(g)
        r["spalte"] = {
            "methode": "Raycasting nach außen, nur gegenüberliegende Fläche (±45°) gewertet",
            "min_mm": round(float(g[fin].min()), 3) if fin.any() else None,
            "roh_min_mm_inkl_innenecken": round(float(g_roh[np.isfinite(g_roh)].min()), 3),
            "nach_zone": statistik_nach_zone(pts_g[fin], g[fin], mm, (0.5, 0.8, 1.0)),
        }
        if var == "A":
            unten, zmin = ueberhaenge(m)
            fl = m.area_faces
            flz = Counter()
            for z, a_ in zip(zmin[unten], fl[unten]):
                flz[zone(z, mm)] += a_
            r["ueberhaenge_aufrecht_45grad"] = {
                "flaeche_mm2": round(float(fl[unten].sum()), 3),
                "anteil_an_oberflaeche": round(float(fl[unten].sum() / fl.sum()), 4),
                "nach_zone": {k: round(v, 3) for k, v in flz.items()},
            }
            inseln_befund, n_schichten = inseln(m)
            r["schwebende_inseln_aufrecht"] = {"schichten_0_08mm": n_schichten, "befunde": inseln_befund}
            r["oese"] = oesen_pruefung(m, mm, prm)
            r["durchbrueche"] = durchbrueche(m, mm, prm)
            fuss, _ = querschnitt(m, 0.04)
            r["druck_standflaeche_mm2"] = round(fuss, 3)
            r["schlankheit_hoehe_zu_fussbreite"] = round(m.extents[2] / math.sqrt(max(fuss, 1e-9)), 2)
            blend = os.path.join(a["export"], par["dateien"]["blend"])
            teile = bauteile_aus_blend(blend) if os.path.exists(blend) else None
            if teile:
                r["vollstaendigkeit_bauteile"] = vollstaendigkeit(m, teile)
        bericht[f"variante_{var}"] = r

    with open(os.path.join(a["out"], "pruefbericht.json"), "w", encoding="utf-8") as f:
        json.dump(bericht, f, ensure_ascii=False, indent=2)
    print(json.dumps(bericht, ensure_ascii=False, indent=1)[:6000])


if __name__ == "__main__":
    main()
