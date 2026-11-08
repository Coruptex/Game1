#!/usr/bin/env python3
"""Labels for the latch images (tools/render_latch.py)
-> docs/images/fallriegel_T4.jpg, docs/images/klickverschluss_alt.png"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "latch_rig")
OUT = os.path.join(ROOT, "docs", "images")
RED = (215, 55, 20)


def font(size, bold=True):
    f = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(f, size) if os.path.exists(f) else ImageFont.load_default()


def head(img, title, sub):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width, 88], fill=(255, 255, 255))
    d.text((20, 8), title, font=font(32), fill=(30, 30, 30))
    d.text((20, 52), sub, font=font(22, False), fill=(70, 70, 70))
    return img


def tag(img, text, at, to):
    d = ImageDraw.Draw(img)
    d.line([at, to], fill=RED, width=4)
    d.ellipse([to[0] - 7, to[1] - 7, to[0] + 7, to[1] + 7], outline=RED, width=4)
    f = font(24)
    w = d.textlength(text, font=f)
    x = at[0] - w / 2
    d.rectangle([x - 6, at[1] - 34, x + w + 6, at[1] - 2], fill=(255, 255, 255))
    d.text((x, at[1] - 32), text, font=f, fill=RED)


def main():
    a = head(Image.open(os.path.join(RD, "rig_locked.png")).convert("RGB"), "Verriegelt", "Hebel liegt hinter dem T-Haken")
    tag(a, "Hebel (Fallriegel)", (600, 330), (640, 455))
    tag(a, "T-Haken", (800, 600), (630, 500))
    tag(a, "Rahmen = Stück Boxenfront", (300, 820), (330, 700))
    b = head(Image.open(os.path.join(RD, "rig_locked_detail.png")).convert("RGB"), "Detail", "Kerbe umschließt den Zapfen")
    tag(b, "Zapfen mit Nase", (260, 250), (215, 370))
    tag(b, "Anschlag", (215, 700), (365, 520))
    tag(b, "T-Kopf mit Schräge", (520, 640), (470, 500))
    tag(b, "Griff", (720, 380), (690, 470))
    c = head(Image.open(os.path.join(RD, "rig_open.png")).convert("RGB"), "Öffnen", "Hebel 4 mm anheben, Tür aufziehen")
    w, h = a.size
    sheet = Image.new("RGB", (3 * w + 24, h), (255, 255, 255))
    for i, im in enumerate((a, b, c)):
        sheet.paste(im, (i * (w + 12), 0))
    sheet = sheet.resize((sheet.width * 6 // 10, sheet.height * 6 // 10), Image.LANCZOS)
    sheet.save(os.path.join(OUT, "fallriegel_T4.jpg"), quality=88)

    o = Image.open(os.path.join(RD, "old_click_latch.png")).convert("RGB")
    o = head(o, "Bisheriger Klickverschluss, von oben", "Teststück aus T1: links Boxentür, rechts Kante der Boxenfront")
    tag(o, "Schlitz 1 mm", (330, 200), (452, 300))
    tag(o, "federnde Zunge", (300, 690), (472, 560))
    tag(o, "Nase: Überstand 0,6 / 0,8 / 1 mm", (700, 210), (492, 330))
    tag(o, "Kerbe mit Grat", (690, 700), (503, 405))
    o.save(os.path.join(OUT, "klickverschluss_alt.png"))
    print("written")


if __name__ == "__main__":
    main()
