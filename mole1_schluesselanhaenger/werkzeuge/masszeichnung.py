#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bemaßte Ansicht + Schnitt (y = 0) des Anhängers als PNG/PDF, direkt aus der STL berechnet.

Aufruf: python masszeichnung.py --export <export-ordner> --bilder <bilder-ordner>
"""
import json
import math
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
from matplotlib.patches import Polygon as MplPolygon
import numpy as np
import trimesh
from shapely.geometry import Polygon
from shapely.ops import unary_union


def argumente():
    a = {}
    argv = sys.argv[1:]
    for i, x in enumerate(argv):
        if x in ("--export", "--bilder"):
            a[x[2:]] = os.path.abspath(argv[i + 1])
    return a


def silhouette(m):
    """Projektion aller Dreiecke auf die XZ-Ebene (Blick von vorne, −Y)."""
    tri = m.triangles[:, :, [0, 2]]
    polys = [Polygon(t) for t in tri if Polygon(t).area > 1e-9]
    return unary_union(polys)


def zeichne_flaeche(ax, geom, **kw):
    geoms = getattr(geom, "geoms", [geom])
    for g in geoms:
        ax.add_patch(MplPolygon(np.array(g.exterior.coords), closed=True, **kw))
        for i in g.interiors:
            ax.add_patch(MplPolygon(np.array(i.coords), closed=True, facecolor="white",
                                    edgecolor=kw.get("edgecolor", "k"), linewidth=kw.get("linewidth", 0.6)))


def hoehenmass(ax, x, z0, z1, text, seite="links"):
    ax.annotate("", xy=(x, z0), xytext=(x, z1), arrowprops=dict(arrowstyle="<->", lw=0.7, color="#1f4e79"))
    dx = -0.25 if seite == "links" else 0.25
    ax.text(x + dx, (z0 + z1) / 2.0, text, rotation=90, va="center", ha="right" if seite == "links" else "left",
            fontsize=7, color="#1f4e79")


def breitenmass(ax, z, x0, x1, text, oben=True):
    ax.annotate("", xy=(x0, z), xytext=(x1, z), arrowprops=dict(arrowstyle="<->", lw=0.7, color="#7a2e0e"))
    ax.text((x0 + x1) / 2.0, z + (0.18 if oben else -0.18), text, ha="center", va="bottom" if oben else "top",
            fontsize=7, color="#7a2e0e")


def hilfslinie(ax, z, x0, x1):
    ax.plot([x0, x1], [z, z], lw=0.4, ls=":", color="#888888")


def main():
    a = argumente()
    with open(os.path.join(a["export"], "modell_parameter.json"), encoding="utf-8") as f:
        par = json.load(f)
    mm, P, R = par["modellmasse_mm"], par["parameter"], par["realmasse"]
    m = trimesh.load(os.path.join(a["export"], par["dateien"]["stl_A"]))

    fig = plt.figure(figsize=(11.69, 8.27))     # A4 quer
    ax1 = fig.add_axes([0.03, 0.06, 0.40, 0.86])
    ax2 = fig.add_axes([0.45, 0.06, 0.22, 0.86])
    ax3 = fig.add_axes([0.69, 0.06, 0.30, 0.86])
    for ax in (ax1, ax2):
        ax.set_aspect("equal")
        ax.set_xlim(-10.5, 8.5)
        ax.set_ylim(-1.5, 37.0)
        ax.axis("off")
    ax2.set_xlim(-5.5, 5.5)

    # --- Ansicht von vorne -----------------------------------------------------
    sil = silhouette(m)
    zeichne_flaeche(ax1, sil, facecolor="#d9dde2", edgecolor="#222222", linewidth=0.6)
    ax1.set_title("Ansicht von vorne (Maße in mm)", fontsize=10)
    xl = -6.2
    stufen = [
        (0.0, mm["sockel_h"], f"Sockel {mm['sockel_h']:.2f}"),
        (mm["sockel_h"], mm["z_gu"], f"{mm['z_gu'] - mm['sockel_h']:.2f}"),
        (mm["z_gu"], mm["z_go"], f"{mm['z_go'] - mm['z_gu']:.2f}"),
        (mm["z_go"], mm["z_glas"], f"Laterne {mm['z_glas'] - mm['z_go']:.2f}"),
        (mm["z_glas"], mm["z_spitze"], f"{mm['z_spitze'] - mm['z_glas']:.2f}"),
        (mm["z_spitze"], mm["z_oben"], f"Öse+Schaft {mm['z_oben'] - mm['z_spitze']:.2f}"),
    ]
    for z0, z1, t in stufen:
        hoehenmass(ax1, xl, z0, z1, t)
        hilfslinie(ax1, z1, xl, 0)
    hoehenmass(ax1, -9.3, 0.0, mm["z_oben"], f"Gesamthöhe {mm['z_oben']:.2f} mm")
    for z, t in ((mm["z_gu"], "OK Boden untere Galerie"), (mm["z_go"], "OK Boden obere Galerie"),
                 (mm["z_feuer"], "Brennebene (Feuerhöhe)")):
        ax1.text(4.6, z, f"{t}\nz = {z:.2f}", fontsize=6.5, va="center", color="#444444")
        hilfslinie(ax1, z, 0, 4.5)
    breitenmass(ax1, -0.9, -mm["sockel_sw"] / 2, mm["sockel_sw"] / 2, f"SW {mm['sockel_sw']:.2f}", oben=False)
    breitenmass(ax1, mm["z_gu"] + mm["gel_h"] + 0.35, -mm["deck_sw_u"] / 2, mm["deck_sw_u"] / 2,
                f"SW {mm['deck_sw_u']:.2f}")
    breitenmass(ax1, mm["z_go"] + mm["gel_h"] + 0.35, -mm["deck_sw_o"] / 2, mm["deck_sw_o"] / 2,
                f"SW {mm['deck_sw_o']:.2f}")
    breitenmass(ax1, mm["z_oese_mitte"], -mm["oese_aussen"] / 2, mm["oese_aussen"] / 2, "")
    ax1.text(mm["oese_aussen"] / 2 + 0.3, mm["z_oese_mitte"] + 0.6,
             f"Öse Ø {mm['oese_aussen']:.1f} außen\nØ {P['OESE_INNEN_D_MM']:.1f} innen", fontsize=6.5,
             color="#7a2e0e")

    # --- Schnitt y = 0 ---------------------------------------------------------
    seg = trimesh.intersections.mesh_plane(m, plane_normal=[0, 1, 0], plane_origin=[0, 0, 0])
    lines = seg[:, :, [0, 2]]
    ax2.add_collection(LineCollection(lines, colors="#222222", linewidths=0.6))
    ax2.set_title("Schnitt durch die Achse (y = 0)", fontsize=10)
    ax2.text(0, -1.0, "massiv – keine Hohlräume", ha="center", fontsize=7, color="#444444")

    # --- Tabelle Modell ↔ Realität ---------------------------------------------
    ax3.axis("off")
    s = mm["s"]
    zeilen = [
        ("Maßstab", f"1 : {mm['massstab']:.0f}", f"{s:.3f} mm je m"),
        ("Gesamthöhe Anhänger", f"{mm['z_oben']:.2f}", "inkl. Öse"),
        ("Sockel H / SW", f"{mm['sockel_h']:.2f} / {mm['sockel_sw']:.2f}",
         f"{R['SOCKEL_H']['wert_m']:.2f} / {R['SOCKEL_SW']['wert_m']:.2f} m (S)"),
        ("Turm SW unten / oben", f"{mm['turm_sw_u']:.2f} / {mm['turm_sw_o']:.2f}",
         f"{R['TURM_SW_UNTEN']['wert_m']:.2f} / {R['TURM_SW_OBEN']['wert_m']:.2f} m (S)"),
        ("untere Galerie OK", f"{mm['z_gu']:.2f}", f"{R['Z_GALERIE_UNTEN']['wert_m']:.2f} m (S)"),
        ("obere Galerie OK", f"{mm['z_go']:.2f}", f"{R['Z_GALERIE_OBEN']['wert_m']:.2f} m (A)"),
        ("Brennebene", f"{mm['z_feuer']:.2f}", f"{R['Z_FEUER']['wert_m']:.2f} m (A)"),
        ("Geländerhöhe", f"{mm['gel_h']:.2f}", f"{R['GELAENDER_H']['wert_m']:.2f} m (S)"),
        ("Laterne Ø", f"{2 * mm['lat_r']:.2f}", f"{R['LATERNE_D']['wert_m']:.2f} m (S)"),
        ("Dach Ø / Spitze", f"{2 * mm['dach_r']:.2f} / {mm['z_spitze']:.2f}",
         f"{R['DACH_D']['wert_m']:.2f} / {R['Z_DACH_SPITZE']['wert_m']:.2f} m (S)"),
        ("Mindestmaße (statt maßstäblich)", "", ""),
        ("Galerieboden", f"{P['BODEN_DICKE_MM']:.2f}", "maßstäbl. ≈ 0,2"),
        ("Geländerband / Handlauf", f"{P['GELAENDER_DICKE_MM']:.2f} / {P['HANDLAUF_H_MM']:.2f}", "maßstäbl. ≈ 0,1"),
        ("Eckpfosten (je Seite)", f"{P['PFOSTEN_B_MM']:.2f}", ""),
        ("Kragarme", f"{P['KRAGARM_DICKE_MM']:.2f}", f"{P['KRAGARM_ANZAHL']} Stück, 45°"),
        ("Laternensprossen", f"{P['SPROSSEN_B_MM']:.2f}", f"Scheiben −{P['SCHEIBEN_TIEFE_MM']:.2f}"),
        ("Traufe", f"{P['TRAUFE_DICKE_MM']:.2f}", "dünnste Stelle"),
        ("Öse innen / Ring", f"{P['OESE_INNEN_D_MM']:.2f} / {P['OESE_RING_RADIAL_MM']:.2f}×{P['OESE_RING_AXIAL_MM']:.2f}", ""),
        ("Schaft Ø", f"{P['HALS_D_MM']:.2f}", "ersetzt Wetterfahne"),
    ]
    y = 0.97
    ax3.text(0.0, y, "Bauteil", fontsize=8, weight="bold", transform=ax3.transAxes)
    ax3.text(0.47, y, "Modell [mm]", fontsize=8, weight="bold", transform=ax3.transAxes)
    ax3.text(0.72, y, "Realität / Hinweis", fontsize=8, weight="bold", transform=ax3.transAxes)
    for (t1, t2, t3) in zeilen:
        y -= 0.042
        fett = t2 == "" and t3 == ""
        ax3.text(0.0, y, t1, fontsize=7.5, transform=ax3.transAxes, weight="bold" if fett else "normal")
        ax3.text(0.47, y, t2, fontsize=7.5, transform=ax3.transAxes)
        ax3.text(0.72, y, t3, fontsize=7, transform=ax3.transAxes, color="#444444")
    y -= 0.07
    ax3.text(0.0, y, "(S) = Schätzung, (A) = aus belegten Werten abgeleitet.\n"
                     "Belegt: 13,40 m Höhe über Molendeck, achteckiger Granitsockel,\n"
                     "achteckiger verjüngter Gussturm, 2 Galerien, runde Laterne,\n"
                     "helmförmiges Kupferdach, Wetterfahne 1895.\n"
                     "SW = Schlüsselweite (Abstand gegenüberliegender Achteckseiten).",
             fontsize=7, transform=ax3.transAxes, va="top", color="#333333")
    fig.suptitle("Mole 1 Brunsbüttel – Schlüsselanhänger Variante A (3D) – Maßzeichnung", fontsize=12)
    os.makedirs(a["bilder"], exist_ok=True)
    for ext in ("png", "pdf"):
        fig.savefig(os.path.join(a["bilder"], f"Masszeichnung_Variante_A.{ext}"), dpi=200)
    print("Maßzeichnung gespeichert")


if __name__ == "__main__":
    main()
