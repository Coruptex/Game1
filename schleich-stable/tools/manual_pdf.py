#!/usr/bin/env python3
"""Assembly manual as PDF, picture-led like a furniture manual
-> docs/Aufbauanleitung.pdf

  python3 tools/manual_pdf.py --poses     # export the extra poses (cad/manual_poses.scad)
  blender -b -P tools/manual_render.py     # pictures -> build/manual/
  python3 tools/manual_pdf.py             # PDF

A4 landscape. Pictures: build/manual/*.png with arrows and part codes from
build/manual/scenes.json, drawn here as vector graphics."""
import json, math, os, subprocess, sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, white, black
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MAN = os.path.join(ROOT, "build", "manual")
OUT = os.path.join(ROOT, "docs", "Aufbauanleitung.pdf")
W, H = landscape(A4)
FD = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("Sans", FD + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("SansB", FD + "DejaVuSans-Bold.ttf"))
INK = Color(0.12, 0.12, 0.12)
ACCENT = Color(0.93, 0.45, 0.05)
GREY = Color(0.45, 0.45, 0.45)
LIGHT = Color(0.94, 0.94, 0.94)

# code -> (name, count)
PARTS = {"B1": ("Boden links vorne", 1), "B2": ("Boden Gang vorne", 1), "B3": ("Boden rechts vorne", 1),
         "B4": ("Boden links hinten", 1), "B5": ("Boden Gang hinten", 1), "B6": ("Boden rechts hinten", 1),
         "P1A": ("Eckpfosten A", 2), "P1B": ("Eckpfosten B", 2), "P2": ("Seitenpfosten", 2), "P3": ("Torpfosten mit Boxentür", 2),
         "P4": ("Torpfosten ohne Boxentür", 2), "P5": ("Mittelpfosten", 2),
         "W1": ("Seitenwand", 4), "W2": ("Trennwand", 2), "W3": ("Giebelwand A", 2), "W4": ("Giebelwand B", 2),
         "W5": ("Boxenfront", 4), "W6": ("Giebelfeld über dem Tor", 2),
         "T1": ("Torflügel links", 2), "T2": ("Torflügel rechts", 2), "T3": ("Boxentür", 4),
         "T4": ("Fallriegel-Hebel", 4), "T5": ("Torriegel", 2),
         "F1": ("Fensterflügel A", 2), "F2": ("Fensterflügel B", 2),
         "D1": ("Seitendach links", 1), "D2": ("Seitendach rechts", 1), "D3": ("Mitteldach", 1)}
PINS = {"S1": ("Stift Tor (Filament 1,75 mm)", 4, 126), "S2": ("Stift Boxentür (Filament 1,75 mm)", 4, 122),
        "S3": ("Stift Fenster (Filament 1,75 mm)", 4, 30)}

STEPS = [
    dict(n=1, title="Boden", scenes=["s01_boden"], parts=[("B1", 1), ("B2", 1), ("B3", 1), ("B4", 1), ("B5", 1), ("B6", 1)],
         hint="Die Platten waagerecht zusammenschieben, in der Reihenfolge 1 bis 5. Nicht von oben drücken."),
    dict(n=2, title="Türen anhängen", scenes=["s02_tuer_P3", "s02_tuer_P4", "s02_tuer_P5"],
         badges=["2×", "2×", "2×"],
         parts=[("P3", 2), ("P4", 2), ("P5", 2), ("T1", 2), ("T2", 2), ("T3", 4), ("S1", 4), ("S2", 4)],
         hint="Tür so halten, dass ihre Augen in den Lücken der Pfostenaugen sitzen. Stift von unten durch alle Augen schieben."),
    dict(n=3, title="Pfosten in den Boden stecken", scenes=["s03_pfosten"], parts=[("P1A", 2), ("P1B", 2), ("P2", 2)],
         hint="Vor einem Tor stehend: links Eckpfosten A, rechts Eckpfosten B (an beiden Toren gleich). Die Schräge oben "
              "steigt zur Stallmitte an, die Nuten zeigen zu den Wänden."),
    dict(n=4, title="Seitenwände und Trennwände", scenes=["s04_waende"], parts=[("W1", 4), ("W2", 2)],
         hint="Von oben in die Nuten der Pfosten schieben. Die Fensterleisten zeigen nach außen."),
    dict(n=5, title="Giebelwände", scenes=["s05_giebel"], parts=[("W3", 2), ("W4", 2)],
         hint="A vorne links und hinten rechts, B vorne rechts und hinten links."),
    dict(n=6, title="Fenster einhängen", scenes=["s06_fenster"], parts=[("F1", 2), ("F2", 2), ("S3", 4)],
         hint="Fenster zuhalten, Stift von oben einstecken. Das letzte Stück leicht drücken, oben hält er. 4-mal."),
    dict(n=7, title="Boxenfronten", scenes=["s07_fronten"], parts=[("W5", 4)],
         hint="Boxentüren vorher in den Gang aufklappen. Gitter und Haken zeigen zum Gang."),
    dict(n=8, title="Fallriegel-Hebel", scenes=["s08_hebel_a", "s08_hebel_b"], badges=["1", "2"], parts=[("T4", 4)],
         hint="1: Hebel senkrecht nach oben auf den Zapfen stecken. 2: nach unten drehen. Tür zudrücken: der Hebel fällt "
              "hinter den Haken. Öffnen: Hebel am Griff anheben. 4-mal."),
    dict(n=9, title="Giebelfelder über dem Tor", scenes=["s09_giebelfeld"], parts=[("W6", 2)],
         hint="Tor schließen. Giebelfeld von oben zwischen die Torpfosten schieben, vorne und hinten."),
    dict(n=10, title="Seitendächer", scenes=["s10_seitendach"], parts=[("D1", 1), ("D2", 1)],
         hint="Gerade auflegen. Die kleinen Zapfen oben an den Wänden finden die Taschen unter dem Dach."),
    dict(n=11, title="Mitteldach", scenes=["s11_mitteldach"], parts=[("D3", 1)],
         hint="Gerade von oben auflegen. Das Mitteldach hält die Seitendächer fest."),
    dict(n=12, title="Torriegel", scenes=["s12_torriegel"], parts=[("T5", 2)],
         hint="Mit dem glatten Ende von rechts durch beide Schlaufen, bis der Knopf anliegt. Zum Öffnen 13 mm nach rechts "
              "ziehen. Vorne und hinten."),
]


def jpg(path, q=85):
    """PNG render -> JPEG next to it (keeps the PDF small)"""
    out = os.path.splitext(path)[0] + ".jpg"
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
        Image.open(path).convert("RGB").save(out, quality=q)
    return out


def thumb(code):
    return jpg(os.path.join(MAN, "thumbs", code + ".png"))


def text(c, x, y, s, size=11, bold=False, colour=INK, anchor="l"):
    c.setFillColor(colour); c.setFont("SansB" if bold else "Sans", size)
    if anchor == "c": c.drawCentredString(x, y, s)
    elif anchor == "r": c.drawRightString(x, y, s)
    else: c.drawString(x, y, s)


def wrap(s, font, size, width):
    words, lines, cur = s.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if pdfmetrics.stringWidth(t, font, size) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def arrow(c, a, b, width=2.6, colour=INK, head=9):
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    bb = (b[0] - math.cos(ang) * head * 0.8, b[1] - math.sin(ang) * head * 0.8)
    c.setStrokeColor(colour); c.setLineWidth(width); c.setLineCap(1)
    c.line(a[0], a[1], bb[0], bb[1])
    p = c.beginPath()
    p.moveTo(b[0], b[1])
    p.lineTo(b[0] - head * math.cos(ang - 0.42), b[1] - head * math.sin(ang - 0.42))
    p.lineTo(b[0] - head * math.cos(ang + 0.42), b[1] - head * math.sin(ang + 0.42))
    p.close(); c.setFillColor(colour); c.drawPath(p, fill=1, stroke=0)


def badge(c, x, y, s, r=8, fill=INK, fg=white, size=10):
    c.setFillColor(fill); c.circle(x, y, r, fill=1, stroke=0)
    text(c, x, y - size * 0.36, s, size, True, fg, "c")


def code_label(c, x, y, s):
    w = pdfmetrics.stringWidth(s, "SansB", 9) + 7
    c.setFillColor(white); c.setStrokeColor(INK); c.setLineWidth(0.8)
    c.roundRect(x - w / 2, y, w, 13, 3, fill=1, stroke=1)
    text(c, x, y + 3.6, s, 9, True, INK, "c")


def picture(c, scene, x, y, w, h, data):
    """scene picture fitted into the box, with its arrows / codes; returns used box"""
    s = data[scene]
    iw, ih = s["size"]
    k = min(w / iw, h / ih)
    dw, dh = iw * k, ih * k
    ox, oy = x + (w - dw) / 2, y + (h - dh) / 2
    c.drawImage(jpg(os.path.join(MAN, s["img"])), ox, oy, dw, dh)
    P = lambda p: (ox + p[0] * k, oy + (ih - p[1]) * k)
    for arc in s.get("arcs", []):
        pts = [P(p) for p in arc]
        c.setStrokeColor(ACCENT); c.setLineWidth(2.6)
        for i in range(len(pts) - 2):
            c.line(*pts[i], *pts[i + 1])
        arrow(c, pts[-2], pts[-1], 2.6, ACCENT)
    for a in s["arrows"]:
        A, B = P(a["a"]), P(a["b"])
        if math.dist(A, B) < 6:
            continue
        arrow(c, A, B, 2.4, ACCENT)
        if a.get("n"):
            badge(c, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + 13, str(a["n"]), 9, INK, white, 11)
    for lab in s["labels"]:
        X, Y = P(lab["at"])
        code_label(c, X, Y + 2, lab["text"])
    return ox, oy, dw, dh


def header(c, n, title):
    if n is not None:
        badge(c, 22 * mm, H - 20 * mm, str(n), 11 * mm, INK, white, 30)
        text(c, 37 * mm, H - 23 * mm, title, 20, True)
    else:
        text(c, 14 * mm, H - 23 * mm, title, 22, True)


def footer(c, page, hint=None):
    text(c, W - 12 * mm, 8 * mm, str(page), 9, False, GREY, "r")
    text(c, 12 * mm, 8 * mm, "Pferdestall · Aufbauanleitung", 8, False, GREY)
    if hint:
        lines = wrap(hint, "Sans", 11, W - 40 * mm)
        yy = 14 * mm + (len(lines) - 1) * 13
        c.setFillColor(LIGHT); c.roundRect(12 * mm, 11 * mm, W - 24 * mm, (len(lines)) * 13 + 9, 4, fill=1, stroke=0)
        for i, l in enumerate(lines):
            text(c, 17 * mm, yy - i * 13, l, 11)


def parts_box(c, parts, x_right, y_top, x_min):
    """parts strip: thumbnail, count and code for every part used in this step,
    right-aligned, never left of x_min (the end of the title)"""
    n = len(parts)
    cw, ch = min(30 * mm, (x_right - x_min - 4 * mm) / n), 27 * mm
    w = n * cw + 4 * mm
    x0 = x_right - w
    c.setStrokeColor(INK); c.setLineWidth(1); c.setFillColor(white)
    c.roundRect(x0, y_top - ch - 4 * mm, w, ch + 4 * mm, 4, fill=1, stroke=1)
    for i, (code, cnt) in enumerate(parts):
        x = x0 + 2 * mm + i * cw
        if code in PINS:
            yy = y_top - 15 * mm
            c.setStrokeColor(ACCENT); c.setLineWidth(2.2); c.line(x + 5 * mm, yy, x + cw - 5 * mm, yy)
            text(c, x + cw / 2, yy - 5 * mm, f"{PINS[code][2]} mm", 8, False, GREY, "c")
        else:
            im = thumb(code)
            iw, ih = Image.open(im).size
            k = min((cw - 3 * mm) / iw, (ch - 10 * mm) / ih)
            c.drawImage(im, x + (cw - iw * k) / 2, y_top - 2 * mm - ih * k - (ch - 10 * mm - ih * k) / 2, iw * k, ih * k)
        text(c, x + 1.5 * mm, y_top - ch + 0.5 * mm, f"{cnt}×", 10, True)
        code_label(c, x + cw - 6 * mm, y_top - ch - 0.5 * mm, code)
    return x0


def page_cover(c, data):
    text(c, W / 2, H - 28 * mm, "Pferdestall", 34, True, INK, "c")
    text(c, W / 2, H - 38 * mm, "Aufbauanleitung", 18, False, GREY, "c")
    picture(c, "s13_fertig", 20 * mm, 22 * mm, W - 40 * mm, H - 66 * mm, data)
    text(c, W / 2, 14 * mm, "Für Schleich-Pferde · ohne Kleber und Schrauben · alles lässt sich wieder auseinandernehmen",
         11, False, GREY, "c")


def page_parts(c):
    header(c, None, "Teile")
    codes = list(PARTS) + list(PINS)
    cols = 8
    cw, ch = (W - 24 * mm) / cols, 33 * mm
    for i, code in enumerate(codes):
        r, k = divmod(i, cols)
        x, y = 12 * mm + k * cw, H - 36 * mm - (r + 1) * ch
        c.setStrokeColor(Color(0.85, 0.85, 0.85)); c.setLineWidth(0.6); c.roundRect(x + 1, y + 1, cw - 2, ch - 2, 3, fill=0, stroke=1)
        if code in PINS:
            name, cnt, L = PINS[code]
            c.setStrokeColor(ACCENT); c.setLineWidth(2.4); c.line(x + 5 * mm, y + ch / 2 + 2 * mm, x + cw - 5 * mm, y + ch / 2 + 2 * mm)
            text(c, x + cw / 2, y + ch / 2 - 3 * mm, f"{L} mm", 8, True, GREY, "c")
        else:
            name, cnt = PARTS[code]
            im = thumb(code)
            iw, ih = Image.open(im).size
            s = min((cw - 4 * mm) / iw, (ch - 14 * mm) / ih)
            c.drawImage(im, x + (cw - iw * s) / 2, y + 12.5 * mm, iw * s, ih * s)
        text(c, x + 2.5 * mm, y + 2.6 * mm, f"{cnt}×", 10, True)
        code_label(c, x + cw - 7 * mm, y + 1.8 * mm, code)
        lines = wrap(name, "Sans", 6.8, cw - 4 * mm)[:2]
        for j, l in enumerate(lines):
            text(c, x + cw / 2, y + 7.6 * mm + (len(lines) - 1 - j) * 7.5, l, 6.8, False, GREY, "c")
    text(c, 12 * mm, 14 * mm, "Die Codes (B1, P3, …) findest du in den Bildern wieder. Die Dateinamen der STL-Dateien stehen in der Teileliste.",
         9, False, GREY)


def page_prep(c):
    header(c, None, "Vorbereitung")
    # pins at 1:1
    text(c, 14 * mm, H - 40 * mm, "Stifte zuschneiden (Maßstab 1:1, Seite mit 100 % drucken)", 13, True)
    y = H - 54 * mm
    for code, (name, cnt, L) in PINS.items():
        c.setStrokeColor(ACCENT); c.setLineWidth(1.75 * mm / 1.0 * 0.55)
        c.line(16 * mm, y, 16 * mm + L * mm, y)
        c.setStrokeColor(INK); c.setLineWidth(0.6)
        c.line(16 * mm, y - 3 * mm, 16 * mm, y + 3 * mm); c.line(16 * mm + L * mm, y - 3 * mm, 16 * mm + L * mm, y + 3 * mm)
        code_label(c, 16 * mm + L * mm + 9 * mm, y - 2.5 * mm, code)
        text(c, 16 * mm + L * mm + 17 * mm, y - 1.5 * mm, f"{cnt}×  {L} mm  {name}", 11, True)
        y -= 14 * mm
    tips = ["1,75-mm-Filament gerade ziehen, mit dem Seitenschneider quer abschneiden, Enden mit dem Fingernagel entgraten.",
            "Stützen unter den Scharnieraugen der Pfosten P3, P4, P5 mit der Spitzzange herausdrehen. Die Lücken zwischen den Augen müssen frei sein.",
            "Brim überall entfernen. Die Nuten der Pfosten müssen sauber sein.",
            "Pfostenblock: jeden Pfosten oben greifen und von der Mittelwand weg biegen, bis alle Zähne abgebrochen sind."]
    yy = y - 6 * mm
    for t in tips:
        lines = wrap(t, "Sans", 11, 150 * mm)
        badge(c, 18 * mm, yy + 1.2 * mm, "•", 2.2 * mm, INK, white, 8)
        for j, l in enumerate(lines):
            text(c, 23 * mm, yy - j * 13, l, 11)
        yy -= (len(lines) * 13 + 7)
    blk = os.path.join(ROOT, "docs", "images", "pfostenblock.jpg")
    if os.path.exists(blk):
        iw, ih = Image.open(blk).size
        w = 95 * mm; h = w * ih / iw
        c.drawImage(blk, W - 12 * mm - w, 18 * mm, w, h)
        text(c, W - 12 * mm - w, 18 * mm + h + 2 * mm, "Pfostenblock (falls du die Pfosten so gedruckt hast)", 9, False, GREY)
    text(c, 14 * mm, 14 * mm, "Werkzeug: Seitenschneider, Spitzzange. Kein Kleber, keine Schrauben.", 10, False, GREY)


def page_step(c, st, data):
    header(c, st["n"], st["title"])
    title_end = 37 * mm + pdfmetrics.stringWidth(st["title"], "SansB", 20) + 8 * mm
    bx = parts_box(c, st["parts"], W - 10 * mm, H - 8 * mm, title_end)
    top = H - 42 * mm
    hint_h = 24 * mm
    bot = 12 * mm + hint_h
    scenes = st["scenes"]
    k = len(scenes)
    gap = 6 * mm
    wbox = (W - 24 * mm - (k - 1) * gap) / k
    for i, sc in enumerate(scenes):
        x = 12 * mm + i * (wbox + gap)
        ox, oy, dw, dh = picture(c, sc, x, bot, wbox, top - bot, data)
        if k > 1:
            c.setStrokeColor(Color(0.82, 0.82, 0.82)); c.setLineWidth(0.8)
            c.roundRect(x, bot, wbox, top - bot, 4, fill=0, stroke=1)
        if st.get("badges"):
            t = st["badges"][i]
            if t.endswith("×"):
                text(c, x + 4 * mm, top - 9 * mm, t, 16, True)
            else:
                badge(c, x + 8 * mm, top - 7 * mm, t, 5 * mm, ACCENT, white, 16)
    footer(c, c.getPageNumber(), st["hint"])


def page_end(c, data):
    header(c, None, "Fertig!")
    half = (W - 30 * mm) / 2
    picture(c, "s13_fertig", 12 * mm, 40 * mm, half, H - 85 * mm, data)
    picture(c, "s14_oeffnen", 18 * mm + half, 40 * mm, half, H - 85 * mm, data)
    text(c, 12 * mm + half / 2, 32 * mm, "Pferde durch die Boxentür hinein- und herausführen.", 11, False, INK, "c")
    for j, l in enumerate(wrap("Oder von oben: erst das Mitteldach abheben (1), dann ein Seitendach (2). Dann sind zwei Boxen offen.",
                               "Sans", 11, half - 10 * mm)):
        text(c, 18 * mm + half * 1.5, 32 * mm - j * 13, l, 11, False, INK, "c")
    tips = "Pflege: PLA wird bei etwa 55 °C weich, also nicht ins heiße Auto oder in die pralle Sonne hinter Glas stellen. " \
           "Die Stifte sind kleine Teile: von Kindern unter 3 Jahren fernhalten."
    footer(c, c.getPageNumber(), tips)


def export_poses():
    scad = os.path.join(ROOT, "cad", "manual_poses.scad")
    d = os.path.join(MAN, "stl"); os.makedirs(d, exist_ok=True)
    jobs = [(f"sd_{w}_{q}", {"which": f'"sd_{w}"', "q": f'"{q}"'}) for w in ("closed", "open") for q in ("FL", "FR", "BL", "BR")]
    jobs += [("lever_up", {"which": '"lever_up"'}), ("lever_down", {"which": '"lever_down"'})]
    for name, defs in jobs:
        cmd = ["openscad", "-o", os.path.join(d, name + ".stl"), "-D", 'part="none"']
        for k, v in defs.items():
            cmd += ["-D", f"{k}={v}"]
        subprocess.run(cmd + [scad], check=True, capture_output=True)
        print("pose", name)


def main():
    if "--poses" in sys.argv:
        export_poses(); return
    data = json.load(open(os.path.join(MAN, "scenes.json")))
    c = canvas.Canvas(OUT, pagesize=(W, H))
    c.setTitle("Pferdestall – Aufbauanleitung"); c.setAuthor("Pferdestall-Projekt")
    page_cover(c, data); c.showPage()
    page_parts(c); footer(c, 2); c.showPage()
    page_prep(c); footer(c, 3); c.showPage()
    for st in STEPS:
        page_step(c, st, data); c.showPage()
    page_end(c, data); c.showPage()
    c.save()
    print("wrote", OUT)


if __name__ == "__main__":
    main()
