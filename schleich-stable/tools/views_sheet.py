#!/usr/bin/env python3
"""Combine the view renders (tools/render_views.py) into one labelled sheet
-> docs/images/ansichten_alle.jpg"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
D = os.path.join(ROOT, "docs", "images", "views")
ORDER = [("vorne", "Vorne"), ("hinten", "Hinten"), ("links", "Links"), ("rechts", "Rechts"),
         ("vorne_links", "Vorne links"), ("vorne_rechts", "Vorne rechts"),
         ("hinten_links", "Hinten links"), ("hinten_rechts", "Hinten rechts"),
         ("oben", "Oben"), ("unten", "Unten (Bodenplatten von unten)")]
W, H, T = 800, 500, 40
sheet = Image.new("RGB", (2 * W, 5 * (H + T)), "white")
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
for i, (fn, label) in enumerate(ORDER):
    x, y = (i % 2) * W, (i // 2) * (H + T)
    sheet.paste(Image.open(os.path.join(D, fn + ".jpg")).convert("RGB").resize((W, H)), (x, y + T))
    d.text((x + 12, y + 6), label, fill="black", font=font)
out = os.path.join(ROOT, "docs", "images", "ansichten_alle.jpg")
sheet.save(out, quality=88, optimize=True)
print("wrote", out, round(os.path.getsize(out) / 1e6, 2), "MB")
