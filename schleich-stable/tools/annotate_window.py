#!/usr/bin/env python3
"""Labels and sheet for the casement close-ups (tools/render_window.py)
-> docs/images/fenster_vorher_nachher.jpg and docs/images/fenster_scharnier.jpg"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RW = os.path.join(ROOT, "build", "render_window")
OUT = os.path.join(ROOT, "docs", "images")


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def label(img, text, sub=None, colour=(30, 30, 30)):
    d = ImageDraw.Draw(img)
    f, fs = font(34), font(24)
    d.rectangle([0, 0, img.width, 92 if sub else 56], fill=(255, 255, 255))
    d.text((22, 10), text, font=f, fill=colour)
    if sub:
        d.text((22, 54), sub, font=fs, fill=(70, 70, 70))
    return img


def arrow(img, xy0, xy1, text):
    d = ImageDraw.Draw(img)
    d.line([xy0, xy1], fill=(220, 60, 20), width=5)
    x, y = xy1
    d.ellipse([x - 9, y - 9, x + 9, y + 9], outline=(220, 60, 20), width=5)
    d.text((xy0[0] - 10, xy0[1] - 36), text, font=font(26), fill=(220, 60, 20))


def main():
    tiles = [("a_old_open90.png", "VORHER: Fenster offen", "Rahmen auf der Scharnierseite unterbrochen", (180, 30, 30)),
             ("b_new_closed.png", "NEU: Fenster geschlossen", "Rahmen läuft ganz herum, Scharnier außen", (20, 110, 40)),
             ("c_new_open90.png", "NEU: Fenster offen (90°)", "Rahmen bleibt vollständig sichtbar", (20, 110, 40)),
             ("d_new_openmax.png", "NEU: weit offen (150°)", "frei bis 175°, kein Kontakt", (20, 110, 40))]
    ims = []
    for fn, t, s, c in tiles:
        im = Image.open(os.path.join(RW, fn)).convert("RGB")
        ims.append(label(im, t, s, c))
    w, h = ims[0].size
    sheet = Image.new("RGB", (2 * w + 12, 2 * h + 12), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % 2) * (w + 12), (i // 2) * (h + 12)))
    sheet = sheet.resize((sheet.width * 3 // 4, sheet.height * 3 // 4), Image.LANCZOS)
    sheet.save(os.path.join(OUT, "fenster_vorher_nachher.jpg"), quality=88)
    det = [label(Image.open(os.path.join(RW, "e_new_detail_closed.png")).convert("RGB"),
                 "Scharnier-Detail, geschlossen", "zwei Bänder überbrücken den Rahmen mit 0,6 mm Luft"),
           label(Image.open(os.path.join(RW, "f_new_detail_open45.png")).convert("RGB"),
                 "Scharnier-Detail, 45° offen", "Bänder heben vom Rahmen ab, Augen außerhalb des Rahmens")]
    w, h = det[0].size
    sheet = Image.new("RGB", (2 * w + 12, h), (255, 255, 255))
    for i, im in enumerate(det):
        sheet.paste(im, (i * (w + 12), 0))
    sheet = sheet.resize((sheet.width * 3 // 4, sheet.height * 3 // 4), Image.LANCZOS)
    sheet.save(os.path.join(OUT, "fenster_scharnier.jpg"), quality=88)
    print("written")


if __name__ == "__main__":
    main()
