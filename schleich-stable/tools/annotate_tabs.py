#!/usr/bin/env python3
"""Labels for the roof-tab test picture (tools/render_tabs.py)
-> docs/images/dachzapfen_test.jpg

  python3 tools/annotate_tabs.py"""
import json, os
from PIL import Image, ImageDraw
from annotate_latch import font, head, tag  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "render_tabs")
OUT = os.path.join(ROOT, "docs", "images", "dachzapfen_test.jpg")


def main():
    P = json.load(open(os.path.join(RD, "points.json")))
    im = Image.open(os.path.join(RD, "tabs.png")).convert("RGB")
    d = ImageDraw.Draw(im)
    f = font(30)
    for k, txt in (("p15", "15"), ("p25", "25"), ("p35", "35")):
        x, y = P[k]
        w = d.textlength(txt, font=f)
        d.rectangle([x - w / 2 - 6, y + 34, x + w / 2 + 6, y + 70], fill=(255, 255, 255))
        d.text((x - w / 2, y + 36), txt, font=f, fill=(200, 40, 10))
    # arrow from the tab down into pocket 25
    x0, y0 = P["tab"]; x1, y1 = P["p25"]
    d.line([(x0, y0 + 8), (x1, y1 - 6)], fill=(200, 40, 10), width=5)
    d.polygon([(x1 - 10, y1 - 18), (x1 + 10, y1 - 18), (x1, y1 - 2)], fill=(200, 40, 10))
    tag(im, "Wandzapfen-Stück aus T3a, Zapfen nach unten", (P["key"][0] - 140, P["key"][1] - 150), tuple(P["key"]))
    im = head(im, "Dachzapfen-Test", "Zapfenplatte umgedreht (Taschen oben), Wandzapfen-Stück senkrecht hineinstecken")
    im.save(OUT, quality=88)
    print("wrote", OUT, im.size)


if __name__ == "__main__":
    main()
