#!/usr/bin/env python3
"""Picture of the post block for the guide: overview, cutaway and a
horizontal section through one break-off tooth -> docs/images/pfostenblock.jpg

  python3 tools/annotate_blocks.py   (after tools/render_blocks.py)"""
import os
import numpy as np
import trimesh
from PIL import Image, ImageDraw
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from annotate_latch import font, head, tag  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "blocks")
OUT = os.path.join(ROOT, "docs", "images", "pfostenblock.jpg")


def section_png(path, z=101.5):
    """horizontal section of the hinge block through the middle post of the +x
    row (post_mid, groove from z = 3, teeth every 10 mm from z = 11.5)"""
    fig, ax = plt.subplots(figsize=(4.5, 5.0), dpi=200)
    for name, col in (("posts", "#2b2b2f"), ("aids", "#e0a020"), ("teeth", "#d42020")):
        m = trimesh.load(os.path.join(RD, f"posts_block_hinge_{name}.stl"), force="mesh")
        s = m.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
        if s is None:
            continue
        p2, _ = s.to_2D(to_2D=np.eye(4))
        for poly in p2.polygons_full:
            x, y = poly.exterior.xy
            ax.fill(x, y, color=col, lw=0)
            for hole in poly.interiors:
                hx, hy = hole.xy
                ax.fill(hx, hy, color="white", lw=0)
    ax.set_xlim(-1.5, 16.5); ax.set_ylim(26, 46); ax.set_aspect("equal")
    ax.set_xticks([]); ax.set_yticks([])
    ax.text(0.5, 44.3, "Mittelwand", fontsize=9, color="#9a6a00")
    ax.text(3.0, 35.4, "Steg", fontsize=9, color="#9a6a00")
    ax.annotate("Zahn (bricht hier ab)", xy=(11.7, 34.0), xytext=(1.3, 38.6), fontsize=8, color="#b01010",
                arrowprops=dict(arrowstyle="->", color="#b01010"))
    ax.text(12.3, 44.3, "Pfosten", fontsize=9, color="#222222")
    ax.annotate("Wandnut: die Wand\nbleibt 0,5 mm vor\ndem Nutgrund", xy=(10.0, 33.0), xytext=(1.3, 27.2), fontsize=7.5,
                color="#222222", arrowprops=dict(arrowstyle="->", color="#222222"))
    ax.set_title("Schnitt von oben, Höhe eines Zahns", fontsize=10)
    fig.tight_layout(); fig.savefig(path); plt.close(fig)


def main():
    sec = os.path.join(RD, "block_section.png")
    section_png(sec)
    a = head(Image.open(os.path.join(RD, "block_hinge.png")).convert("RGB"), "Pfostenblock", "6 Pfosten, gemeinsam gedruckt")
    b = head(Image.open(os.path.join(RD, "block_cutaway.png")).convert("RGB"), "Innen (eine Reihe ausgeblendet)",
             "Mittelwand und Stege, orange")
    tag(b, "Bruchzähne", (300, 160), (288, 300))
    c = Image.open(sec).convert("RGB")
    c = c.resize((int(c.width * 1000 / c.height), 1000))
    c = head(c, "Verbindung", "nur über kleine Zähne")
    W = a.width + b.width + c.width
    out = Image.new("RGB", (W, 1000), (255, 255, 255))
    out.paste(a, (0, 0)); out.paste(b, (a.width, 0)); out.paste(c, (a.width + b.width, 0))
    d = ImageDraw.Draw(out)
    for x in (a.width, a.width + b.width):
        d.line([(x, 0), (x, 1000)], fill=(200, 200, 200), width=3)
    out.save(OUT, quality=88)
    print("wrote", OUT, out.size)


if __name__ == "__main__":
    main()
