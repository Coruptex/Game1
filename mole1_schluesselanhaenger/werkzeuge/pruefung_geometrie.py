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
        [--parameter modell_parameter_prototyp_a1.json]   (Standard: modell_parameter.json)
(benötigt trimesh, shapely, numpy, rtree, embreex; für den Bauteilabgleich zusätzlich das pip-Paket bpy)
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
    a = {"export": None, "out": None, "parameter": "modell_parameter.json"}
    for i, x in enumerate(argv):
        if x in ("--export", "--out"):
            a[x[2:]] = os.path.abspath(argv[i + 1])
        elif x == "--parameter":
            a["parameter"] = argv[i + 1]
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


def strahlen(m, start, richtung, block=20000):
    """Erster Treffer je Strahl, blockweise. Mit dem Paket "embreex" nutzt trimesh Embree (schnell,
    wenig Speicher); ohne Embree braucht die Strahlsuche bei diesem Modell sehr viel Arbeitsspeicher."""
    locs, rays, tris = [], [], []
    for i in range(0, len(start), block):
        loc, ir, it = m.ray.intersects_location(start[i:i + block], richtung[i:i + block], multiple_hits=False)
        locs.append(loc)
        rays.append(ir + i)
        tris.append(it)
    return np.concatenate(locs), np.concatenate(rays), np.concatenate(tris)


def wandstaerken(m, n=60000, seed=1):
    """Lokale Wandstärke: Strahl vom Oberflächenpunkt nach innen bis zur Gegenseite.
    Gewertet wird nur, wenn die Austrittsfläche der Startfläche gegenüberliegt (echte Wand);
    Treffer seitlicher Nachbarflächen an Außenkanten sind Messartefakte (→ NaN)."""
    pts, fid = trimesh.sample.sample_surface_even(m, n, seed=seed)
    nrm = m.face_normals[fid]
    start = pts - nrm * 1e-4
    loc, idx_ray, idx_tri = strahlen(m, start, -nrm)
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
    loc, idx_ray, idx_tri = strahlen(m, start, nrm)
    d = np.full(len(pts), np.inf)
    gegen = (m.face_normals[idx_tri] * nrm[idx_ray]).sum(axis=1) < -GEGENUEBER_COS
    d[idx_ray[gegen]] = np.linalg.norm(loc[gegen] - start[idx_ray[gegen]], axis=1)
    roh = np.full(len(pts), np.inf)
    roh[idx_ray] = np.linalg.norm(loc - start[idx_ray], axis=1)
    return pts, d, roh


def zone(p, mm):
    """Ordnet einen Punkt (x, y, z in mm) dem Bauteil zu (Geländer über den Radius getrennt)."""
    x, y, z = p
    r = math.hypot(x, y)
    s = mm["s"]
    if mm["galerie1_ok"] < z < mm["galerie1_ok"] + 0.92 * s and r > mm["galerie1_d"] / 2 - 0.5:
        return "Geländer unten"
    if mm["galerie2_ok"] < z < mm["galerie2_ok"] + 0.82 * s and r > mm["galerie2_d"] / 2 - 0.5:
        return "Geländer oben"
    grenzen = [
        (-1.0, mm["sockel_uk"], "Sockelfuß (2 Stufen)"),
        (mm["sockel_uk"], mm["sockel_ok"], "Granitsockel (Mauerwerk, Tür)"),
        (mm["sockel_ok"], mm["kappe_ok"], "Abdeckplatte"),
        (mm["kappe_ok"], mm["trichter_u"], "Unterbau (Leiter, Fenster)"),
        (mm["trichter_u"], mm["galerie1_uk"], "Trichter"),
        (mm["galerie1_uk"], mm["galerie1_ok"], "Galerieboden unten"),
        (mm["galerie1_ok"], mm["turm_ok"], "weißer Turm"),
        (mm["turm_ok"], mm["galerie2_uk"], "Konsolenkranz"),
        (mm["galerie2_uk"], mm["galerie2_ok"], "Galerieboden oben"),
        (mm["galerie2_ok"], mm["glas_uk"], "Laterne unten"),
        (mm["glas_uk"], mm["traufe"], "Laterne Glasband (Sprossen)"),
        (mm["traufe"], mm["dach_spitze"], "Glockenhaube"),
        (mm["dach_spitze"], mm["z_oese_unten"], "Knauf"),
        (mm["z_oese_unten"], 1e9, "Öse"),
    ]
    for a, b, name in grenzen:
        if a <= z < b:
            return name
    return "?"


def statistik_nach_zone(pts, werte, mm, grenzen_mm):
    out = {}
    for p, w in zip(pts, werte):
        if not np.isfinite(w):
            continue
        name = zone(p, mm)
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
    """Lochweite der Öse und Querschnitte im Kraftfluss Öse → Knauf → Dach."""
    zc = mm["z_oese_mitte"]
    # Lochweite: Strahlen in der Ösenebene (y = 0) vom Mittelpunkt nach außen
    winkel = np.radians(np.arange(0, 360, 5))
    start = np.tile([0.0, 0.0, zc], (len(winkel), 1))
    richt = np.stack([np.cos(winkel), np.zeros_like(winkel), np.sin(winkel)], axis=1)
    loc, idx, _ = m.ray.intersects_location(start, richt, multiple_hits=False)
    r = np.linalg.norm(loc - start[idx], axis=1)
    loch_mitte_frei = not bool(m.contains([[0.0, 0.0, zc]])[0])
    # Querschnitte: Knauf/Dachspitze (waagerecht, kleinster Wert) und Ringflanken (Schnitt durch Ösenmitte)
    zs = np.linspace(mm["dach_spitze"] - 0.6, mm["z_oese_unten"] - 0.02, 40)
    flaechen = [querschnitt(m, z)[0] for z in zs]
    i_min = int(np.argmin(flaechen))
    z_schaft, a_schaft = float(zs[i_min]), float(flaechen[i_min])
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
        "querschnitt_kraftfluss_min_mm2": round(a_schaft, 3),
        "z_querschnitt_min_mm": round(z_schaft, 3),
        "querschnitt_kraftfluss_kreis_aequivalent_d_mm": round(2 * math.sqrt(a_schaft / math.pi), 3),
        "querschnitt_ringflanken_gesamt_mm2": round(a_flanken, 3),
        "ringflanken_anzahl": n_flanken,
        "querschnitt_ringscheitel_oben_mm2": round(a_scheitel, 3),
    }


def _netze(coll):
    teile = {}
    for ob in coll.objects:
        me = ob.data
        me.calc_loop_triangles()
        v = np.array([ob.matrix_world @ x.co for x in me.vertices])
        f = np.array([t.vertices[:] for t in me.loop_triangles])
        teile[ob.name] = trimesh.Trimesh(v, f, process=True)
    return teile


def bauteile_aus_blend(blend):
    """Netze der Einzelbauteile und der Gravurkörper aus der .blend lesen (Vollständigkeitsabgleich)."""
    try:
        import bpy
    except ImportError:
        return None, None
    bpy.ops.wm.open_mainfile(filepath=blend)
    teile = _netze(bpy.data.collections["01_Bauteile"])
    grav = bpy.data.collections.get("Hilf_Gravuren_Aussparungen")
    return teile, (list(_netze(grav).values()) if grav else [])


def vollstaendigkeit(final, teile, gravuren, n=200, seed=3):
    """Punkte aus dem Inneren jedes Bauteils müssen im Endkörper liegen – außer sie liegen in einer
    gewollten Gravur/Aussparung (Fugen, Fenster, "1", Tür, Schlitze)."""
    rng = np.random.default_rng(seed)
    ergebnis = {}
    for name, t in sorted(teile.items()):
        if not t.is_volume:
            ergebnis[name] = {"fehler": "Bauteil nicht geschlossen"}
            continue
        lo, hi = t.bounds
        kand = rng.uniform(lo, hi, size=(n * 15, 3))
        innen = kand[t.contains(kand)]
        graviert = np.zeros(len(innen), dtype=bool)
        for g in gravuren:
            lo_g, hi_g = g.bounds
            nah = np.all((innen >= lo_g) & (innen <= hi_g), axis=1)
            if nah.any():
                graviert[nah] |= g.contains(innen[nah])
        innen = innen[~graviert][:n]
        if len(innen) == 0:
            ergebnis[name] = {"stichproben": 0}
            continue
        drin = final.contains(innen)
        ergebnis[name] = {"stichproben": int(len(innen)), "anteil_im_endkoerper": round(float(drin.mean()), 4),
                          "stichproben_in_gravur_verworfen": int(graviert.sum())}
    return ergebnis


def durchbrueche(final, mm, prm, real):
    """Mitten aller Geländeröffnungen, der Konsolenzwischenräume und das Ösenloch müssen frei sein."""
    tests = {}
    s = mm["s"]
    feld = np.radians(np.arange(0, 360, 45))            # Feldmitten zwischen den Eckpfosten
    for key, z_ok, d, holme, fuss in (("unten", mm["galerie1_ok"], mm["galerie1_d"],
                                       real["GELAENDER1_HOLME"]["wert_m"], False),
                                      ("oben", mm["galerie2_ok"], mm["galerie2_d"],
                                       real["GELAENDER2_HOLME"]["wert_m"], True)):
        r = d / 2.0 - 0.05
        hoehen = [0.0] + [h * s for h in holme]
        offen = []
        for i in range(len(hoehen) - 1):
            if fuss and i == 0:
                continue                                  # unterster Holm oben als Fußleiste ausgeführt
            zm = z_ok + (hoehen[i] + hoehen[i + 1]) / 2.0
            pkt = [[r * math.cos(w), r * math.sin(w), zm] for w in feld]
            offen.append(bool(not final.contains(pkt).any()))
        tests[f"Geländer {key}: {len(offen)} Öffnungsreihen × 8 Felder frei"] = all(offen)
    n = prm["KONSOLEN_ANZAHL"]
    zk = mm["turm_ok"] + 0.75 * (mm["galerie2_uk"] - mm["turm_ok"])
    rk = mm["konsole_r0"] + 0.6 * mm["konsole_radius"]
    pkt = [[rk * math.cos(w), rk * math.sin(w), zk] for w in 2 * math.pi * (np.arange(n) + 0.5) / n]
    tests[f"Konsolenzwischenräume ({n}) frei"] = bool(not final.contains(pkt).any())
    tests["Ösenloch frei"] = bool(not final.contains([[0, 0, mm["z_oese_mitte"]]])[0])
    return tests


def main():
    a = argumente()
    os.makedirs(a["out"], exist_ok=True)
    with open(os.path.join(a["export"], a["parameter"]), encoding="utf-8") as f:
        par = json.load(f)
    mm, prm = par["modellmasse_mm"], par["parameter"]
    datei = par["dateien"].get("stl") or par["dateien"]["stl_A"]

    m = lade(os.path.join(a["export"], datei))
    r = {"datei": datei, "variante": par.get("variante"), "massstab": par["massstab"], "grund": grundpruefung(m)}
    r["gewicht_g"] = {k: round(m.volume / 1000.0 * d, 2) for k, d in DICHTE.items()}

    r["strahl_backend"] = type(m.ray).__module__
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
        "nach_zone": statistik_nach_zone(pts, d, mm, (0.25, 0.3, 0.4, 0.5)),
    }
    pts_g, g, g_roh = spalte(m)
    fin = np.isfinite(g)
    r["spalte"] = {
        "methode": "Raycasting nach außen, nur gegenüberliegende Fläche (±45°) gewertet",
        "min_mm": round(float(g[fin].min()), 3) if fin.any() else None,
        "roh_min_mm_inkl_innenecken": round(float(g_roh[np.isfinite(g_roh)].min()), 3),
        "nach_zone": statistik_nach_zone(pts_g[fin], g[fin], mm, (0.2, 0.3, 0.4, 0.5)),
    }
    unten, _ = ueberhaenge(m)
    fl = m.area_faces
    flz = Counter()
    for p, a_ in zip(m.triangles_center[unten], fl[unten]):
        flz[zone(p, mm)] += a_
    r["ueberhaenge_aufrecht_45grad"] = {
        "flaeche_mm2": round(float(fl[unten].sum()), 3),
        "anteil_an_oberflaeche": round(float(fl[unten].sum() / fl.sum()), 4),
        "nach_zone": {k: round(v, 3) for k, v in flz.most_common()},
    }
    inseln_befund, n_schichten = inseln(m)
    r["schwebende_inseln_aufrecht"] = {"schichten_0_08mm": n_schichten, "anzahl": len(inseln_befund),
                                       "befunde": inseln_befund[:60]}
    r["oese"] = oesen_pruefung(m, mm, prm)
    r["durchbrueche"] = durchbrueche(m, mm, prm, par["realmasse"])
    fuss, _ = querschnitt(m, 0.04)
    r["druck_standflaeche_mm2"] = round(fuss, 3)
    r["schlankheit_hoehe_zu_fussbreite"] = round(m.extents[2] / math.sqrt(max(fuss, 1e-9)), 2)
    blend = os.path.join(a["export"], par["dateien"]["blend"])
    teile, gravuren = bauteile_aus_blend(blend) if os.path.exists(blend) else (None, None)
    if teile:
        r["vollstaendigkeit_bauteile"] = vollstaendigkeit(m, teile, gravuren)

    with open(os.path.join(a["out"], "pruefbericht.json"), "w", encoding="utf-8") as f:
        json.dump(r, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in r.items() if k != "vollstaendigkeit_bauteile"},
                     ensure_ascii=False, indent=1)[:8000])


if __name__ == "__main__":
    main()
