#!/usr/bin/env python3
"""Explanation of the main-door slide bolt and the T4 bolt test plate:
renders (tools/render_bolt.py) + a front-view drawing from the model values
in cad/parts/doors.scad -> docs/images/torriegel.jpg

  python3 tools/annotate_bolt.py"""
import json, os
from PIL import Image, ImageDraw
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyArrowPatch
from annotate_latch import head, tag  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RD = os.path.join(ROOT, "build", "render_bolt")
OUT = os.path.join(ROOT, "docs", "images", "torriegel.jpg")

# model values (cad/parts/doors.scad, world X, Z in mm)
XC, BZ = 234.0, 92.0
LEAF_L, LEAF_R = (184.6, 233.2), (234.8, 283.4)
LOOP_L, LOOP_R = (XC - 6, 10), (XC + 11, 18)          # centre, length
H = 6.6                                              # tunnel height (bar 6 + 0.6)
LOOP_Z = (BZ - H / 2 - 2.5, BZ + H / 2 + 2.5)
BAR_X0, BAR_L, KNOB = XC - 11.5, 32.0, 5.0
TRAVEL = 13.0
TEST = (LOOP_L[0] - 16, LOOP_L[0] + 48, BZ - 13, BZ + 13)   # T4 bolt test plate (64 x 26)
ORANGE, DOOR = "#f08a10", "#3a3a40"


def drawing(path):
    fig, axs = plt.subplots(1, 2, figsize=(13, 4.6), dpi=150)
    for ax, dx, title in ((axs[0], 0.0, "Verriegelt: der Riegel steckt in beiden Schlaufen"),
                          (axs[1], TRAVEL, "Entriegelt: Riegel am Knopf 13 mm nach rechts gezogen")):
        for x0, x1 in (LEAF_L, LEAF_R):
            ax.add_patch(Rectangle((x0, 70), x1 - x0, 44, fc="#d9d9de", ec=DOOR, lw=1.2))
        ax.text(sum(LEAF_L) / 2 - 12, 108, "linker Torflügel", fontsize=10, ha="center")
        ax.text(sum(LEAF_R) / 2 + 12, 108, "rechter Torflügel", fontsize=10, ha="center")
        # bar (behind the loops: drawn first) and knob
        ax.add_patch(Rectangle((BAR_X0 + dx, BZ - 3), BAR_L, 6, fc=ORANGE, ec="#a05000", lw=1.2, zorder=2))
        ax.add_patch(Rectangle((BAR_X0 + dx + BAR_L - 0.5, BZ - 5), KNOB + 0.5, 10, fc=ORANGE, ec="#a05000", lw=1.2, zorder=2))
        # loops, see-through
        for c, L in (LOOP_L, LOOP_R):
            ax.add_patch(Rectangle((c - L / 2, LOOP_Z[0]), L, LOOP_Z[1] - LOOP_Z[0], fc=DOOR, alpha=0.35, ec=DOOR, lw=1.5, zorder=3))
        ax.annotate("Schlaufe\nam linken Flügel", xy=(LOOP_L[0], LOOP_Z[0]), xytext=(LOOP_L[0] - 22, 74),
                    fontsize=9, ha="center", arrowprops=dict(arrowstyle="->"))
        ax.annotate("lange Schlaufe\nam rechten Flügel", xy=(LOOP_R[0], LOOP_Z[0]), xytext=(LOOP_R[0] + 20, 74),
                    fontsize=9, ha="center", arrowprops=dict(arrowstyle="->"))
        ax.annotate("Knopf", xy=(BAR_X0 + dx + BAR_L + 2.5, BZ + 5), xytext=(BAR_X0 + dx + BAR_L + 2.5, 100.5),
                    fontsize=9, ha="center", arrowprops=dict(arrowstyle="->"))
        ax.text(XC - 1.5, 112.5, "Spalt zwischen den Flügeln", fontsize=8, ha="right", va="top", color="#555")
        ax.set_xlim(186, 282); ax.set_ylim(70, 114); ax.set_aspect("equal"); ax.axis("off")
        ax.set_title(title, fontsize=11)
    # left: the cut-out that is the T4 test plate
    a = axs[0]
    a.add_patch(Rectangle((TEST[0], TEST[2]), TEST[1] - TEST[0], TEST[3] - TEST[2], fill=False, ec="#c01010",
                          lw=1.8, ls="--", zorder=4))
    a.text(TEST[1] - 1, TEST[2] + 1, "Riegelplatte T4", color="#c01010", fontsize=9, ha="right", va="bottom", zorder=5)
    # right: arrow of the movement, and what is free now
    b = axs[1]
    b.add_patch(FancyArrowPatch((BAR_X0 + BAR_L + KNOB - 4, BZ - 8.5), (BAR_X0 + BAR_L + KNOB + TRAVEL - 1, BZ - 8.5),
                                arrowstyle="-|>", mutation_scale=14, color="#c01010", lw=1.8, zorder=5))
    b.text(LOOP_L[0] - 2, BZ - 1, "frei", color="#c01010", fontsize=11, ha="center", va="center", zorder=5, weight="bold")
    fig.tight_layout(); fig.savefig(path); plt.close(fig)


def main():
    pts = json.load(open(os.path.join(RD, "points.json")))
    a = head(Image.open(os.path.join(RD, "closed.png")).convert("RGB").crop((0, 0, 1000, 620)), "1  Tor zu, verriegelt", "Riegel (orange) über dem Spalt")
    tag(a, "Torriegel", (pts["closed"]["bolt"][0] + 200, pts["closed"]["bolt"][1] - 120), tuple(pts["closed"]["bolt"]))
    b = head(Image.open(os.path.join(RD, "open.png")).convert("RGB").crop((0, 0, 1000, 620)), "2  Tor offen", "Riegel bleibt am rechten Flügel")
    tag(b, "Torriegel", (pts["open"]["bolt"][0] + 170, pts["open"]["bolt"][1] - 150), tuple(pts["open"]["bolt"]))
    top = Image.new("RGB", (a.width + b.width, a.height), "white")
    top.paste(a, (0, 0)); top.paste(b, (a.width, 0))
    dpath = os.path.join(RD, "drawing.png")
    drawing(dpath)
    d = Image.open(dpath).convert("RGB")
    d = d.resize((top.width, int(d.height * top.width / d.width)))
    d = head(d, "3  So funktioniert der Riegel (Ansicht von vorn, Schlaufen durchsichtig gezeichnet)",
             "Die rot gestrichelte Fläche ist die Riegelplatte aus T4: beide Schlaufen im echten Abstand auf einem Stück")
    out = Image.new("RGB", (top.width, top.height + d.height), "white")
    out.paste(top, (0, 0)); out.paste(d, (0, top.height))
    dr = ImageDraw.Draw(out)
    dr.line([(a.width, 0), (a.width, top.height)], fill=(200, 200, 200), width=3)
    dr.line([(0, top.height), (out.width, top.height)], fill=(200, 200, 200), width=3)
    out = out.resize((out.width * 3 // 4, out.height * 3 // 4))
    out.save(OUT, quality=88)
    print("wrote", OUT, out.size)


if __name__ == "__main__":
    main()
