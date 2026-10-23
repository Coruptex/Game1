#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Abgleich des Modells mit Referenzfoto F4 (frontal vom Molenweg).

Projiziert die exportierte STL mit derselben Kamera wie in render_vorschau.py (FOTO4) in das
Foto und zeichnet die Modell-Silhouette als Kontur ein. Optional wird das farbige Render
("Farbmodell_Kamera_wie_Foto4.png") neben das Foto gestellt und überblendet.

Die Fotos selbst gehören nicht zum Projekt (Bildrechte) – sie werden nur als Pfad übergeben.

Aufruf: python fotovergleich.py --export <export-ordner> --foto <foto4.jpg> --out <ordner>
                                [--render <Farbmodell_Kamera_wie_Foto4.png>]
"""
import json
import os
import sys

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon
from shapely.ops import unary_union

# Kamera F4: 97,65 px/m in der Turmachse (13,40 m vom Molendeck, Zeile 1350,5, bis Spitze Wetterfahne, Zeile 42),
# Abstand ≈ 87 m, Augenhöhe ≈ 1,62 m über dem Molendeck (wie render_vorschau.py).
FOTO4 = {"breite_px": 960, "hoehe_px": 1628, "px_pro_m": 97.65, "achse_x": 463.5, "y_molendeck": 1350.5,
         "abstand_m": 86.87, "augenhoehe_m": 1.624}


def argumente():
    a = {"export": None, "foto": None, "out": None, "render": None}
    argv = sys.argv[1:]
    for i, x in enumerate(argv):
        if x in ("--export", "--foto", "--out", "--render"):
            a[x[2:]] = os.path.abspath(argv[i + 1])
    return a


def projektion(punkte_mm, s):
    """Lochkamera wie F4: Kamera bei (0, −D, h) [m], waagerecht in +Y-Richtung."""
    f = FOTO4
    p = punkte_mm / s
    tiefe = p[..., 1] + f["abstand_m"]
    k = f["abstand_m"] / tiefe
    x = f["achse_x"] + f["px_pro_m"] * p[..., 0] * k
    y_h = f["y_molendeck"] - f["px_pro_m"] * f["augenhoehe_m"]
    y = y_h - f["px_pro_m"] * (p[..., 2] - f["augenhoehe_m"]) * k
    return np.stack([x, y], axis=-1)


def silhouette(m, s):
    tri = projektion(m.triangles, s)
    polys = [Polygon(t) for t in tri]
    return unary_union([p for p in polys if p.is_valid and p.area > 1e-6])


def konturen(geom):
    for g in getattr(geom, "geoms", [geom]):
        yield list(g.exterior.coords)
        for i in g.interiors:
            yield list(i.coords)


def schrift(groesse):
    for pfad in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                 "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(pfad):
            return ImageFont.truetype(pfad, groesse)
    return ImageFont.load_default()


def beschriften(img, text):
    d = ImageDraw.Draw(img)
    f = schrift(22)
    d.rectangle([0, 0, img.width, 34], fill=(255, 255, 255))
    d.text((10, 5), text, fill=(20, 20, 20), font=f)
    return img


def main():
    a = argumente()
    os.makedirs(a["out"], exist_ok=True)
    with open(os.path.join(a["export"], "modell_parameter.json"), encoding="utf-8") as fh:
        par = json.load(fh)
    s = par["modellmasse_mm"]["s"]
    m = trimesh.load(os.path.join(a["export"], par["dateien"]["stl"]))
    foto = Image.open(a["foto"]).convert("RGB")

    sil = silhouette(m, s)
    kontur = foto.copy()
    d = ImageDraw.Draw(kontur)
    for ring in konturen(sil):
        d.line([tuple(p) for p in ring], fill=(255, 30, 30), width=2)
    beschriften(kontur, "Foto F4 + Modellkontur (rot)")
    kontur.save(os.path.join(a["out"], "Vergleich_F4_Kontur.png"))

    if a["render"] and os.path.exists(a["render"]):
        r = Image.open(a["render"]).convert("RGB").resize(foto.size)
        paar = Image.new("RGB", (foto.width * 2 + 20, foto.height), (255, 255, 255))
        paar.paste(beschriften(foto.copy(), "Foto F4 (Molenweg)"), (0, 0))
        paar.paste(beschriften(r.copy(), "Modell, gleiche Kamera"), (foto.width + 20, 0))
        paar.save(os.path.join(a["out"], "Vergleich_F4_nebeneinander.png"))
        misch = Image.blend(foto, r, 0.5)
        beschriften(misch, "Überblendung 50 % Foto / 50 % Modell")
        misch.save(os.path.join(a["out"], "Vergleich_F4_Ueberblendung.png"))
    print("Vergleichsbilder gespeichert in", a["out"])


if __name__ == "__main__":
    main()
