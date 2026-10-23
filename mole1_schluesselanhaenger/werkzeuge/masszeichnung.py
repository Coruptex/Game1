#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bemaßte Ansicht + Schnitt (y = 0) des Anhängers als PNG/PDF, direkt aus der STL berechnet.

Aufruf: python masszeichnung.py --export <export-ordner> --bilder <bilder-ordner>
"""
import json
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
    ax.annotate("", xy=(x, z0), xytext=(x, z1), arrowprops=dict(arrowstyle="<->", lw=0.6, color="#1f4e79",
                                                                shrinkA=0, shrinkB=0))
    dx = -0.15 if seite == "links" else 0.15
    ax.text(x + dx, (z0 + z1) / 2.0, text, rotation=90, va="center", ha="right" if seite == "links" else "left",
            fontsize=5.6, color="#1f4e79")


def breitenmass(ax, z, x0, x1, text, oben=True):
    ax.annotate("", xy=(x0, z), xytext=(x1, z), arrowprops=dict(arrowstyle="<->", lw=0.6, color="#7a2e0e",
                                                                shrinkA=0, shrinkB=0))
    ax.text((x0 + x1) / 2.0, z + (0.12 if oben else -0.12), text, ha="center", va="bottom" if oben else "top",
            fontsize=5.8, color="#7a2e0e")


def hilfslinie(ax, z, x0, x1):
    ax.plot([x0, x1], [z, z], lw=0.35, ls=":", color="#888888")


def main():
    a = argumente()
    with open(os.path.join(a["export"], "modell_parameter.json"), encoding="utf-8") as f:
        par = json.load(f)
    mm, P, R = par["modellmasse_mm"], par["parameter"], par["realmasse"]
    m = trimesh.load(os.path.join(a["export"], par["dateien"]["stl"]))
    s = mm["s"]

    fig = plt.figure(figsize=(11.69, 8.27))     # A4 quer
    ax1 = fig.add_axes([0.02, 0.05, 0.42, 0.88])
    ax2 = fig.add_axes([0.44, 0.05, 0.20, 0.88])
    ax3 = fig.add_axes([0.66, 0.05, 0.33, 0.88])
    for ax in (ax1, ax2):
        ax.set_aspect("equal")
        ax.set_ylim(-1.6, 36.2)
        ax.axis("off")
    ax1.set_xlim(-13.5, 9.0)
    ax2.set_xlim(-7.5, 7.5)

    # --- Ansicht von vorne (Tür) -----------------------------------------------
    sil = silhouette(m)
    zeichne_flaeche(ax1, sil, facecolor="#d9dde2", edgecolor="#222222", linewidth=0.5)
    ax1.set_title("Ansicht von vorne (Türseite) – Maße in mm", fontsize=10)
    stufen = [
        (0.0, mm["sockel_h"], "Sockel"),
        (mm["sockel_h"], mm["kappe_ok"], "Platte"),
        (mm["kappe_ok"], mm["trichter_u"], "Unterbau"),
        (mm["trichter_u"], mm["galerie1_uk"], "Trichter"),
        (mm["galerie1_ok"], mm["turm_ok"], "Turm"),
        (mm["turm_ok"], mm["galerie2_uk"], "Konsolen"),
        (mm["galerie2_ok"], mm["traufe"], "Laterne"),
        (mm["traufe"], mm["dach_spitze"], "Dach"),
        (mm["dach_spitze"], mm["knauf_ok"], "Knauf"),
        (mm["z_oese_unten"], mm["z_oben"], "Öse"),
    ]
    for i, (z0, z1, name) in enumerate(stufen):
        x = -9.2 if i % 2 == 0 else -10.6
        hoehenmass(ax1, x, z0, z1, f"{name} {z1 - z0:.2f}")
        hilfslinie(ax1, z1, x, -2.0)
        hilfslinie(ax1, z0, x, -2.0)
    hoehenmass(ax1, -12.4, 0.0, mm["z_oben"], f"Gesamthöhe {mm['z_oben']:.2f} mm")
    for z, t in ((mm["galerie1_ok"], "OK Galerieboden unten"), (mm["galerie2_ok"], "OK Galerieboden oben"),
                 (mm["glas_uk"], "UK Glasband Laterne")):
        ax1.text(7.2, z, f"{t}\nz = {z:.2f}", fontsize=5.6, va="center", color="#444444")
        hilfslinie(ax1, z, 0, 7.1)
    breitenmass(ax1, -0.8, -mm["sockel_sw"] / 2, mm["sockel_sw"] / 2, f"Sockel SW {mm['sockel_sw']:.2f}", oben=False)
    breitenmass(ax1, mm["galerie1_uk"] - 0.7, -mm["galerie1_d"] / 2, mm["galerie1_d"] / 2,
                f"Galerie unten Ø {mm['galerie1_d']:.2f}", oben=False)
    breitenmass(ax1, mm["turm_ok"] - 1.2, -mm["turm_sw_o"] / 2, mm["turm_sw_o"] / 2, f"SW {mm['turm_sw_o']:.2f}")
    breitenmass(ax1, mm["galerie2_uk"] - 0.55, -mm["galerie2_d"] / 2, mm["galerie2_d"] / 2,
                f"Ø {mm['galerie2_d']:.2f}", oben=False)
    breitenmass(ax1, mm["traufe"] - 0.45, -mm["laterne_d"] / 2, mm["laterne_d"] / 2, f"Ø {mm['laterne_d']:.2f}",
                oben=False)
    breitenmass(ax1, mm["z_oese_mitte"], -mm["oese_aussen"] / 2, mm["oese_aussen"] / 2, "")
    ax1.text(mm["oese_aussen"] / 2 + 0.3, mm["z_oese_mitte"] + 0.5,
             f"Öse Ø {mm['oese_aussen']:.1f} außen\nØ {P['OESE_INNEN_D_MM']:.1f} innen", fontsize=5.8, color="#7a2e0e")
    breite = float(m.extents[0])

    # --- Schnitt y = 0 ---------------------------------------------------------
    seg = trimesh.intersections.mesh_plane(m, plane_normal=[0, 1, 0], plane_origin=[0, 0, 0])
    ax2.add_collection(LineCollection(seg[:, :, [0, 2]], colors="#222222", linewidths=0.5))
    ax2.set_title("Schnitt durch die Achse (y = 0)", fontsize=10)
    ax2.text(0, -1.2, "massiv – keine Hohlräume", ha="center", fontsize=6.5, color="#444444")

    # --- Tabelle Modell ↔ Realität ---------------------------------------------
    ax3.axis("off")

    def real(k):
        e = R[k]
        st = {"Foto": "F", "belegt": "B", "Schätzung": "S"}[e["status"]]
        return e["wert_m"], st

    zeilen = [
        ("Maßstab", f"1 : {mm['massstab']:.0f}", f"{s:.3f} mm je m"),
        ("Gesamthöhe / größte Breite", f"{mm['z_oben']:.2f} / {breite:.2f}", "inkl. Öse"),
    ]
    for titel, k_mm, k_real in (("Sockel Höhe", "sockel_h", "SOCKEL_H"), ("Sockel SW", "sockel_sw", "SOCKEL_SW"),
                                ("Unterbau SW unten", "unterbau_sw_u", "UNTERBAU_SW_U"),
                                ("Galerie unten Ø", "galerie1_d", "GALERIE1_D"),
                                ("Galerie unten OK", "galerie1_ok", "GALERIE1_OK"),
                                ("Turm SW unten", "turm_sw_u", "TURM_SW_U"), ("Turm SW oben", "turm_sw_o", "TURM_SW_O"),
                                ("Ziffer 1 Höhe", None, None),
                                ("Galerie oben Ø", "galerie2_d", "GALERIE2_D"),
                                ("Galerie oben OK", "galerie2_ok", "GALERIE2_OK"),
                                ("Laterne Ø", "laterne_d", "LATERNE_D"), ("Traufe", "traufe", "TRAUFE"),
                                ("Dachspitze", "dach_spitze", "DACH_SPITZE"), ("Knauf OK", "knauf_ok", "KNAUF_OK")):
        if k_mm is None:
            h = mm["eins_ok"] - mm["eins_uk"]
            zeilen.append((titel, f"{h:.2f}", f"{h / s:.2f} m (F)"))
            continue
        w, st = real(k_real)
        zeilen.append((titel, f"{mm[k_mm]:.2f}", f"{w:.2f} m ({st})"))
    zeilen += [
        ("Fertigungsmaße (statt maßstäblich)", "", ""),
        ("Geländerholme H × T", f"{P['HOLM1_H_MM']:.2f} × {P['HOLM1_T_MM']:.2f}", "maßstäblich ≈ 0,13"),
        ("Pfosten unten / oben", f"{P['PFOSTEN1_MM']:.2f} / {P['PFOSTEN2_MM']:.2f}", "je 8, an den Ecken"),
        ("Konsolen (32) Dicke", f"{P['KONSOLE_DICKE_MM']:.2f}", "maßstäblich ≈ 0,18"),
        ("Laternensprossen B", f"{P['SPROSSE_LAT_B_MM']:.2f}", "16 Stück (8 V)"),
        ("Mauerfugen B × T", f"{P['FUGE_BREITE_MM']:.2f} × {P['FUGE_TIEFE_MM']:.2f}", "graviert"),
        ("Ziffer 1 Tiefe", f"{P['EINS_TIEFE_MM']:.2f}", "graviert"),
        ("Knauf min. Ø", f"{2 * P['KNAUF_R_MIN_MM']:.2f}", "trägt die Öse"),
        ("Öse innen / Ring", f"{P['OESE_INNEN_D_MM']:.2f} / {P['OESE_RING_RADIAL_MM']:.2f}×"
                             f"{P['OESE_RING_AXIAL_MM']:.2f}", "ersetzt Wetterfahne"),
    ]
    y = 0.975
    ax3.text(0.0, y, "Bauteil", fontsize=7.5, weight="bold", transform=ax3.transAxes)
    ax3.text(0.50, y, "Modell [mm]", fontsize=7.5, weight="bold", transform=ax3.transAxes)
    ax3.text(0.75, y, "Original", fontsize=7.5, weight="bold", transform=ax3.transAxes)
    for (t1, t2, t3) in zeilen:
        y -= 0.034
        fett = t2 == "" and t3 == ""
        if fett:
            y -= 0.012
        ax3.text(0.0, y, t1, fontsize=7, transform=ax3.transAxes, weight="bold" if fett else "normal")
        ax3.text(0.50, y, t2, fontsize=7, transform=ax3.transAxes)
        ax3.text(0.75, y, t3, fontsize=6.6, transform=ax3.transAxes, color="#444444")
    y -= 0.06
    ax3.text(0.0, y, "(F) = an Referenzfotos gemessen (Maßstab über 13,40 m Höhe),\n"
                     "(B) = belegt, (S) = Schätzung. SW = Schlüsselweite des Achtecks.\n"
                     "Ausrichtung: Tür vorne (−Y), „1“ rechts (+X), Leiter +45°.",
             fontsize=6.6, transform=ax3.transAxes, va="top", color="#333333")
    fig.suptitle("Mole 1 Brunsbüttel – Schmuck-Schlüsselanhänger (3D-Miniatur) – Maßzeichnung", fontsize=12)
    os.makedirs(a["bilder"], exist_ok=True)
    for ext in ("png", "pdf"):
        fig.savefig(os.path.join(a["bilder"], f"Masszeichnung.{ext}"), dpi=200)
    print("Maßzeichnung gespeichert")


if __name__ == "__main__":
    main()
