#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Slicer-Prüfung der STL mit PrusaSlicer (CLI) und einem Profil, das den Bambu-Lab-A1-Vorgaben
für die 0,2-mm-Düse nachempfunden ist (Linienbreite 0,22 mm, Schichthöhe 0,08 mm).

Wichtig: Das ist KEIN Testdruck und KEIN Bambu-Studio-Lauf. Es zeigt, welche Bahnen ein
Slicer aus der Geometrie erzeugt (Wände, Brücken, Überhänge, Stützbedarf).

Aufruf: python slicer_pruefung.py --stl <datei.stl> --out <ordner> [--modell <modell_parameter.json>]
"""
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

PROFIL = {
    # Drucker / Düse (A1: 256 × 256 × 256 mm, 0,2-mm-Düse)
    "bed_shape": "0x0,256x0,256x256,0x256", "max_print_height": "256",
    "nozzle_diameter": "0.2", "filament_diameter": "1.75", "gcode_flavor": "marlin2",
    "printer_technology": "FFF",
    # Schichten und Linien (an "0.08mm Extra Fine @BBL A1 0.2 nozzle" angelehnt)
    "layer_height": "0.08", "first_layer_height": "0.1",
    "extrusion_width": "0.22", "perimeter_extrusion_width": "0.22",
    "external_perimeter_extrusion_width": "0.22", "infill_extrusion_width": "0.22",
    "solid_infill_extrusion_width": "0.22", "top_infill_extrusion_width": "0.22",
    "first_layer_extrusion_width": "0.25",
    "perimeters": "2", "top_solid_layers": "7", "bottom_solid_layers": "5",
    "fill_density": "15%", "fill_pattern": "gyroid",
    "perimeter_generator": "arachne", "thin_walls": "1",
    "overhangs": "1", "extra_perimeters_on_overhangs": "0",
    # Haftung / Kühlung (schlankes, hohes Teil auf Bettschubser A1)
    "brim_width": "4", "skirts": "0",
    "slowdown_below_layer_time": "8", "min_print_speed": "5", "cooling": "1",
    "fan_always_on": "1", "min_fan_speed": "100", "max_fan_speed": "100",
    "filament_type": "PLA", "filament_density": "1.24", "temperature": "220", "first_layer_temperature": "220",
    "bed_temperature": "60", "first_layer_bed_temperature": "60",
    "gcode_comments": "0", "support_material": "0",
}


def argumente():
    a = {"stl": None, "out": None, "modell": None}
    argv = sys.argv[1:]
    for i, x in enumerate(argv):
        if x in ("--stl", "--out", "--modell"):
            a[x[2:]] = os.path.abspath(argv[i + 1])
    return a


def profil_schreiben(pfad, extra=None):
    p = dict(PROFIL)
    p.update(extra or {})
    with open(pfad, "w") as f:
        for k, v in p.items():
            f.write(f"{k} = {v}\n")


def slicen(stl, ini, gcode):
    cmd = ["prusa-slicer", "--export-gcode", "--load", ini, "--center", "128,128",
           "--output", gcode, stl]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=1200)
    return r.returncode, (r.stdout + r.stderr)[-3000:]


def gcode_lesen(pfad):
    """Extrusionsbahnen je Schicht und Bahntyp aus dem G-Code."""
    bahnen = defaultdict(list)          # (z, typ) -> [((x0,y0),(x1,y1)), ...]
    laengen = Counter()
    typ, z, x, y, e_rel = "?", 0.0, 0.0, 0.0, False
    e_last = 0.0
    meta = {}
    for zeile in open(pfad, errors="ignore"):
        if zeile.startswith(";TYPE:"):
            typ = zeile[6:].strip()
            continue
        if zeile.startswith(";Z:"):
            z = round(float(zeile[3:]), 3)
            continue
        if zeile.startswith("; ") and "=" in zeile:
            k, _, v = zeile[2:].partition("=")
            meta[k.strip()] = v.strip()
            continue
        if zeile.startswith("M83"):
            e_rel = True
        elif zeile.startswith("M82"):
            e_rel = False
        if not (zeile.startswith("G1 ") or zeile.startswith("G0 ")):
            continue
        werte = dict(re.findall(r"([XYZEF])([-\d.]+)", zeile))
        nx, ny = float(werte.get("X", x)), float(werte.get("Y", y))
        extrudiert = False
        if "E" in werte:
            ev = float(werte["E"])
            extrudiert = ev > 0 if e_rel else ev > e_last
            if not e_rel:
                e_last = ev
        if extrudiert and (nx != x or ny != y):
            bahnen[(z, typ)].append(((x, y), (nx, ny)))
            laengen[typ] += ((nx - x) ** 2 + (ny - y) ** 2) ** 0.5
        x, y = nx, ny
    return bahnen, laengen, meta


def ring_bahnen(bahnen, z_soll, r0, r1, mitte=(128.0, 128.0)):
    """Extrusionslänge (mm) einer Schicht im Kreisring r0..r1 um die Bauteilachse."""
    zs = sorted({z for (z, _) in bahnen})
    z = min(zs, key=lambda v: abs(v - z_soll))
    laenge = 0.0
    for (zz, _), segs in bahnen.items():
        if zz != z:
            continue
        for (a, b) in segs:
            ra = ((a[0] - mitte[0]) ** 2 + (a[1] - mitte[1]) ** 2) ** 0.5
            rb = ((b[0] - mitte[0]) ** 2 + (b[1] - mitte[1]) ** 2) ** 0.5
            if r0 <= ra <= r1 and r0 <= rb <= r1:
                laenge += ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5
    return round(z, 3), round(laenge, 2)


def zone_typen(bahnen, zonen):
    """Bahntypen je Höhenzone (z. B. Überhänge an den Galerien)."""
    out = defaultdict(Counter)
    for (z, typ), segs in bahnen.items():
        name = next((n for (n, a, b) in zonen if a <= z < b), "sonstige")
        out[name][typ] += sum(((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5 for p0, p1 in segs)
    return {k: {t: round(v, 1) for t, v in c.most_common()} for k, c in out.items()}


FARBEN = {"External perimeter": "#d62728", "Perimeter": "#ff9896", "Overhang perimeter": "#1f77b4",
          "Internal infill": "#bcbd22", "Solid infill": "#9467bd", "Top solid infill": "#e377c2",
          "Bridge infill": "#17becf", "Gap fill": "#2ca02c", "Support material": "#7f7f7f",
          "Skirt/Brim": "#8c564b"}


def schichten_zeichnen(bahnen, ziele, pfad, titel):
    zs = sorted({z for (z, _) in bahnen})
    fig, axs = plt.subplots(1, len(ziele), figsize=(3.2 * len(ziele), 3.8))
    for ax, (name, z_soll) in zip(axs, ziele):
        z = min(zs, key=lambda v: abs(v - z_soll))
        typen = set()
        for (zz, typ), segs in bahnen.items():
            if zz != z:
                continue
            typen.add(typ)
            ax.add_collection(LineCollection(segs, colors=FARBEN.get(typ, "k"), linewidths=1.2))
        ax.set_aspect("equal")
        ax.set_xlim(120.5, 135.5)
        ax.set_ylim(120.5, 135.5)
        ax.set_title(f"{name}\nz = {z:.2f} mm", fontsize=8)
        ax.tick_params(labelsize=6)
    handles = [plt.Line2D([], [], color=c, lw=2, label=t) for t, c in FARBEN.items()]
    fig.legend(handles=handles, loc="lower center", ncol=5, fontsize=7, frameon=False)
    fig.suptitle(titel, fontsize=10)
    fig.subplots_adjust(bottom=0.22, top=0.82, wspace=0.25)
    fig.savefig(pfad, dpi=170)
    plt.close(fig)


def main():
    a = argumente()
    os.makedirs(a["out"], exist_ok=True)
    mm = None
    if a["modell"]:
        with open(a["modell"], encoding="utf-8") as f:
            mm = json.load(f)["modellmasse_mm"]
    bericht = {"hinweis": "PrusaSlicer-CLI mit A1-ähnlichem 0,2-mm-Profil; kein Testdruck, kein Bambu Studio.",
               "profil": PROFIL}
    for name, extra in (("ohne_stuetzen", {}),
                        ("ohne_stuetzen_classic", {"perimeter_generator": "classic"}),
                        ("stuetzbedarf_45grad", {"support_material": "1", "support_material_auto": "1",
                                                 "support_material_threshold": "45",
                                                 "dont_support_bridges": "1"})):
        ini = os.path.join(a["out"], f"profil_{name}.ini")
        gc = os.path.join(a["out"], f"mole1_{name}.gcode")
        profil_schreiben(ini, extra)
        code, log = slicen(a["stl"], ini, gc)
        r = {"returncode": code}
        if code != 0 or not os.path.exists(gc):
            r["log"] = log
            bericht[name] = r
            continue
        bahnen, laengen, meta = gcode_lesen(gc)
        os.remove(gc)   # generischer Prüf-G-Code – nicht für den A1 bestimmt, daher nicht aufbewahren
        zs = sorted({z for (z, _) in bahnen})
        r["schichten"] = len(zs)
        r["z_max_mm"] = zs[-1] if zs else None
        r["bahnlaenge_mm_nach_typ"] = {k: round(v, 1) for k, v in laengen.most_common()}
        r["druckzeit"] = meta.get("estimated printing time (normal mode)")
        r["filament_g"] = meta.get("total filament used [g]") or meta.get("filament used [g]")
        r["filament_mm"] = meta.get("filament used [mm]")
        if mm:
            s = mm["s"]
            zonen = [("Sockel+Platte", 0, mm["kappe_ok"]),
                     ("Unterbau", mm["kappe_ok"], mm["trichter_u"]),
                     ("Trichter+Galerie unten", mm["trichter_u"], mm["galerie1_ok"] + 0.9 * s),
                     ("Turm", mm["galerie1_ok"] + 0.9 * s, mm["turm_ok"]),
                     ("Konsolen+Galerie oben", mm["turm_ok"], mm["galerie2_ok"] + 0.8 * s),
                     ("Laterne+Dach", mm["galerie2_ok"] + 0.8 * s, mm["dach_spitze"]),
                     ("Knauf+Öse", mm["dach_spitze"], 99)]
            r["bahnen_nach_zone_mm"] = zone_typen(bahnen, zonen)
            # Feinteile: Werden Holme, Pfosten und Konsolen überhaupt als Bahnen erzeugt?
            ru, ro = mm["galerie1_d"] / 2.0, mm["galerie2_d"] / 2.0
            r["feinteile_bahnlaenge_je_schicht_mm"] = {
                f"{titel} (z={z_ist})": laenge for titel, z_ist, laenge in (
                    (t,) + ring_bahnen(bahnen, z, a0, a1) for t, z, a0, a1 in (
                        ("Geländer unten: Holm 2", mm["galerie1_ok"] + 0.50 * s, ru - 0.5, ru + 0.3),
                        ("Geländer unten: nur Pfosten (zwischen Holmen)", mm["galerie1_ok"] + 0.36 * s, ru - 0.5,
                         ru + 0.3),
                        ("Geländer oben: Holm 3", mm["galerie2_ok"] + 0.50 * s, ro - 0.5, ro + 0.3),
                        ("Geländer oben: nur Pfosten (zwischen Holmen)", mm["galerie2_ok"] + 0.40 * s, ro - 0.5,
                         ro + 0.3),
                        ("Konsolenkranz (32 Konsolen)", mm["turm_ok"] + 0.40 * s, mm["turm_sw_o"] / 2 + 0.05,
                         ro - 0.1)))}
            if name.startswith("ohne_stuetzen"):
                ziele = [("Holm unten", mm["galerie1_ok"] + 0.50 * s),
                         ("Pfosten unten (zw. Holmen)", mm["galerie1_ok"] + 0.36 * s),
                         ("Konsolen", mm["turm_ok"] + 0.4 * s),
                         ("Holm oben", mm["galerie2_ok"] + 0.50 * s),
                         ("Laternensprossen", (mm["glas_uk"] + mm["glas_ok"]) / 2),
                         ("Ösenmitte", mm["z_oese_mitte"])]
                gen = "Arachne" if name == "ohne_stuetzen" else "Classic"
                schichten_zeichnen(bahnen, ziele, os.path.join(a["out"], f"Slicer_Schichten_Details_{gen}.png"),
                                   f"PrusaSlicer-Bahnen, Wandgenerator {gen} (0,2-mm-Düse, 0,22 mm Linie, 0,08 mm Schicht)")
        bericht[name] = r
    with open(os.path.join(a["out"], "slicer_pruefung.json"), "w", encoding="utf-8") as f:
        json.dump(bericht, f, ensure_ascii=False, indent=2)
    print(json.dumps({k: v for k, v in bericht.items() if k != "profil"}, ensure_ascii=False, indent=1)[:5000])


if __name__ == "__main__":
    main()
