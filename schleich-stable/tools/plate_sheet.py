#!/usr/bin/env python3
"""Contact sheet of all print plates (rendered from build/plates/*.stl with
OpenSCAD on a 256 x 256 mm bed) -> docs/images/plates.png"""
import concurrent.futures as cf, glob, os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
COL = {"floor": "#9c978e", "posts": "#2c2c30", "doors": "#2c2c30", "roof": "#3d4046", "T": "#6d8fb0"}


def colour(pid):
    for k, c in COL.items():
        if k in pid:
            return c
    return "#ecebe6"


def render(stl):
    pid = os.path.basename(stl)[:-4]
    png = os.path.join(tempfile.gettempdir(), pid + "_sheet.png")
    scad = os.path.join(tempfile.gettempdir(), pid + "_sheet.scad")
    open(scad, "w").write(f'color("#d9d4c7") translate([0,0,-1.2]) cube([256,256,1]);\n'
                          f'color("{colour(pid)}") import("{stl}");\n')
    subprocess.run(["xvfb-run", "-a", "-s", "-screen 0 800x800x24", "openscad", "-o", png,
                    "--imgsize=420,420", "--camera=128,128,40,40,0,20,700", "--colorscheme=Tomorrow",
                    "--projection=o", scad], capture_output=True)
    return pid, png


def main():
    stls = sorted(glob.glob(os.path.join(ROOT, "build", "plates", "*.stl")))
    with cf.ThreadPoolExecutor(4) as ex:
        res = list(ex.map(render, stls))
    cols = 6
    rows = (len(res) + cols - 1) // cols
    W, H = 420, 450
    sheet = Image.new("RGB", (cols * W, rows * H), "white")
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
    except Exception:
        font = ImageFont.load_default()
    for i, (pid, png) in enumerate(res):
        x, y = (i % cols) * W, (i // cols) * H
        if os.path.exists(png):
            sheet.paste(Image.open(png).convert("RGB"), (x, y + 30))
        d.text((x + 10, y + 5), pid, fill="black", font=font)
    out = os.path.join(ROOT, "docs", "images", "plates.png")
    sheet.save(out, optimize=True)
    print("wrote", out, len(res), "plates")


if __name__ == "__main__":
    main()
