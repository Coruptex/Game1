#!/usr/bin/env python3
"""Add German labels to the hinge render (tools/render_hinge.py):
build/render/scharnier_raw.png -> docs/images/scharnier.png"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
raw = Image.open(os.path.join(ROOT, "build", "render", "scharnier_raw.png")).convert("RGB")   # 1200 x 1000
TOP, RIGHT = 80, 320
im = Image.new("RGB", (raw.width + RIGHT, raw.height + TOP), raw.getpixel((raw.width - 4, raw.height // 2)))
im.paste(raw, (0, TOP))
d = ImageDraw.Draw(im)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
f = ImageFont.truetype(FONT, 27)
fb = ImageFont.truetype(FONT.replace(".ttf", "-Bold.ttf"), 34)
d.rectangle([0, 0, im.width, TOP], fill=(255, 255, 255))
d.text((24, 20), "So funktioniert das Scharnier (Boxentür am Türpfosten)", fill=(20, 20, 20), font=fb)
S = raw.width / 720.0                     # tips were picked on a 720 px wide preview


def label(lines, x, y, tip):
    tx, ty = tip[0] * S, tip[1] * S + TOP
    tw = max(d.textlength(t, font=f) for t in lines)
    h = 36 * len(lines)
    d.line([(x - 10, y + h / 2), (tx, ty)], fill=(200, 60, 0), width=4)
    d.ellipse([tx - 6, ty - 6, tx + 6, ty + 6], fill=(200, 60, 0))
    d.rectangle([x - 10, y - 6, x + tw + 10, y + h + 2], fill=(255, 255, 255), outline=(200, 60, 0), width=2)
    for i, t in enumerate(lines):
        d.text((x, y + 36 * i), t, fill=(20, 20, 20), font=f)


label(["Pfosten: feste Scharnieraugen,", "enges Loch 1,85 mm:", "hier klemmt der Stift"], 860, 110, (402, 95))
label(["Tür: bewegliches Auge,", "weites Loch 2,3 mm:", "dreht sich um den Stift"], 860, 330, (395, 215))
label(["Unterseite jedes Auges: hier", "setzt beim Druck eine kleine", "Baumstütze an (abbrechen)"], 860, 540, (395, 345))
label(["Stift = Stück 1,75-mm-Filament.", "Von unten bis zum Anschlag", "einschieben. Steht der Pfosten", "im Boden, kann er nicht", "mehr herausfallen."], 860, 740, (384, 480))
out = os.path.join(ROOT, "docs", "images", "scharnier.png")
im.save(out, optimize=True)
print("wrote", out, im.size)
