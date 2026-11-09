#!/usr/bin/env python3
"""Write the print documentation from build/plates.json (tools/plates.py),
build/validation.json (tools/validate.py) and tools/bambu3mf.py:

  docs/DRUCKPLAN.md        plates, status, presets, AMS slots, estimates, order (German)
  docs/BAMBU_STUDIO.md     how to use the project files (German)
  docs/BOM.md              parts and hardware (English)
  slicer/bambu_studio/*.json   the process presets (same values as in the projects)
"""
import glob, json, os, sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))
from build import read_instances, unique_parts  # noqa: E402
import bambu3mf as b3  # noqa: E402

plates = json.load(open(os.path.join(ROOT, "build", "plates.json")))
val = json.load(open(os.path.join(ROOT, "build", "validation.json")))
parts = unique_parts(read_instances())
pin_len = {}
for pn in val.get("pins", []):
    kind = pn["pin"].split("_")[1]
    pin_len[kind] = max(pin_len.get(kind, 0), pn["length_mm"])

SLOT = {1: "1 Weiß", 2: "2 Schwarz", 3: "3 Hellgrau", 4: "4 Dunkelgrau"}
STATUS = {"frei": "**freigegeben**", "T3": "gesperrt bis T3", "T4": "gesperrt bis T4"}


def hm(s):
    return f"{int(s // 3600)} h {int(s % 3600 // 60):02d} min"


def kg(g):
    return f"{g / 1000:.2f} kg".replace(".", ",")


def fname(pid, p):
    return os.path.basename(p["project"]) if p.get("project") else "(folgt nach dem Test)"


def special(pid, p):
    s = []
    if p.get("colour_change"):
        s.append(f"Filamentwechsel auf Schwarz ab {p['colour_change']:.2f} mm (gespeichert)".replace(".", ","))
    if p["process"] == "posts":
        s.append("Brim 8 mm, begrenzte Beschleunigung (gespeichert)")
    if p.get("support_moves"):
        s.append("Baumstützen unter den Scharnieraugen")
    if p["process"] == "central_roof":
        s.append("Brim 5 mm")
    if any(x.startswith("casement") for x in p["parts"]):
        s.append("Brim 3 mm am Fensterflügel")
    return "; ".join(s)


def names(p):
    c = defaultdict(int)
    for n in p["parts"]:
        c[n] += 1
    return ", ".join(f"{q} x {n}" if q > 1 else n for n, q in c.items())


# ------------------------------------------------------------- DRUCKPLAN
tests = {k: v for k, v in plates.items() if v["kind"] == "TEST"}
prod = {k: v for k, v in plates.items() if v["kind"] == "PROD"}
D = ["# Druckplan (Bambu Lab A1 mit AMS lite)", "",
     "Erzeugt von `tools/report.py`. Zeiten und Filamentmengen sind **Schätzungen** aus PrusaSlicer 2.7",
     "mit A1-ähnlichen Einstellungen (gleiche Schichthöhe, Wände, Füllung, Brim, Stützen).",
     "Bambu Studio zeigt nach dem Slicen eigene Werte, die abweichen können.", "",
     "AMS lite: **Slot 1 Weiß, Slot 2 Schwarz, Slot 3 Hellgrau, Slot 4 Dunkelgrau.**",
     "Jede Datei ist ein fertiges Bambu-Studio-Projekt. Öffnen, slicen, drucken; Anleitung:",
     "[BAMBU_STUDIO.md](BAMBU_STUDIO.md).", "",
     "Die Spalte *passt mit Brim/Stützen* ist das Ergebnis des Probe-Slicens: Alle Bahnen",
     "einschließlich Brim und Stützen liegen innerhalb des 256-mm-Betts.", "",
     "![Alle Platten von oben (Vorschau)](images/platten_uebersicht.jpg)", "",
     "## 1. Testplatten (zuerst)", "",
     "| Datei (`1_TEST/`) | Inhalt | Preset | Slot | Besonderheit | Zeit | Filament | passt mit Brim/Stützen |",
     "|---|---|---|---|---|---|---|---|"]
for pid, p in tests.items():
    D.append(f"| `{fname(pid, p)}` | {p['title']} | {p['preset']} | {SLOT[p['filament']]} | {special(pid, p)} | "
             f"{hm(p.get('time_s', 0))} | {p.get('filament_g', 0):.0f} g | {'ja' if p.get('fits_with_brim_support') else '**nein**'} |")
D += ["", "Testanleitung: [TESTANLEITUNG.md](TESTANLEITUNG.md). T2 nur, falls du T2 noch nicht gedruckt hast.", "",
      "## 2. Produktionsplatten", "",
      "Freigegebene Platten liegen in `2_PRODUKTION/`. Ihre Teile hängen nicht an den neuen Scharnier-",
      "und Verschlusstests. Ihre Passungen (Bodensockel, Verzahnung, Wandnuten, Dachzapfen) sind aber",
      "nur berechnet; T2, T3a und T3b prüfen sie mit. Die gesperrten Platten hängen an T3 oder T4. Ihre",
      "Projektdateien erzeuge ich, sobald du mir die Testergebnisse meldest.", "",
      "| Platte | Datei | Teile | Status | Preset | Slot | Besonderheit | Zeit | Filament | passt mit Brim/Stützen |",
      "|---|---|---|---|---|---|---|---|---|---|"]
tot = defaultdict(lambda: [0.0, 0.0])
for pid, p in prod.items():
    D.append(f"| {pid.split('_')[0]} | `{fname(pid, p)}` | {names(p)} | {STATUS[p['release']]} | {p['preset']} | "
             f"{SLOT[p['filament']]}{' + 2' if p.get('colour_change') else ''} | {special(pid, p)} | {hm(p.get('time_s', 0))} | "
             f"{p.get('filament_g', 0):.0f} g | {'ja' if p.get('fits_with_brim_support') else '**nein**'} |")
    key = "frei" if p["release"] == "frei" else "gesperrt"
    tot[key][0] += p.get("time_s", 0); tot[key][1] += p.get("filament_g", 0)
    tot["alle"][0] += p.get("time_s", 0); tot["alle"][1] += p.get("filament_g", 0)
D += ["", "| Summe | Platten | Zeit | Filament |", "|---|---|---|---|",
      f"| freigegeben | {sum(1 for p in prod.values() if p['release'] == 'frei')} | {hm(tot['frei'][0])} | {kg(tot['frei'][1])} |",
      f"| gesperrt (nach T3/T4) | {sum(1 for p in prod.values() if p['release'] != 'frei')} | {hm(tot['gesperrt'][0])} | {kg(tot['gesperrt'][1])} |",
      f"| **ganzer Stall** | **{len(prod)}** | **{hm(tot['alle'][0])}** | **{kg(tot['alle'][1])}** |", "",
      f"Filamentkosten bei 19,99 €/kg: etwa **{tot['alle'][1] / 1000 * 19.99:.0f} €** für den ganzen Stall (ohne Tests und Fehldrucke).", "",
      "## 3. Druckreihenfolge", "",
      "1. **Tests:** T3a, T3b, T4 (und T2, falls noch nicht gedruckt). Ergebnisse an mich.",
      "2. **Freigegebene Platten:** die Bodenplatten P01–P06, die Eck- und Seitenpfosten P07, die Wände",
      "   P08–P11 und das Dach P12–P14. Druck sie, sobald die Passungstests gut ausgefallen sind: Sockel und",
      "   Verzahnung (T2), Wandnut (T3a + T3b), Dachzapfen (T3b) mit den im Modell eingestellten Werten",
      "   20 / 25 / 20 / 25. Passt ein anderer Wert besser, erzeuge ich diese Platten neu.",
      "3. **Nach T3:** Pfosten mit Scharnieraugen P15, Giebelwände P16–P19, Fensterflügel P20.",
      "4. **Nach T4:** Boxenfronten P21–P22, Türen P23–P24.", "",
      "Die hohen Pfosten (P15) sind der heikelste Druck: Platte mit Spülmittel waschen und die erste Stunde",
      "zuschauen. Die sanfteren Beschleunigungen sind in den Einstellungen gespeichert, am Drucker musst du",
      "nichts umstellen.", ""]
open(os.path.join(ROOT, "docs", "DRUCKPLAN.md"), "w").write("\n".join(D) + "\n")
old = os.path.join(ROOT, "docs", "PRINT_PLAN.md")
if os.path.exists(old):
    os.remove(old)

# -------------------------------------------------------------------- BOM
used_on = defaultdict(set)
for pid, p in plates.items():
    for n in p["parts"]:
        used_on[n].add(pid.split("_")[0])
COLOUR = {"floor": "light grey", "post": "black", "wall": "white + black trim", "door": "black", "roof": "dark grey"}
B = ["# Bill of materials", "", "Generated by `tools/report.py`.", "",
     f"## Printed parts ({len(parts)} unique STL files, {sum(q for _, _, q in parts)} pieces)", "",
     "| STL (`stl/`) | Qty | Colour | Plates |", "|---|---|---|---|"]
for p, c, q in parts:
    B.append(f"| `{p}.stl` | {q} | {COLOUR[c]} | {', '.join(sorted(used_on[p]))} |")
B += ["", "Mirror pairs (`_A` / `_B`, `_L` / `_R`) are different files. Each is printed twice.",
      "Parts listed with qty 4 are identical rotated copies (all stall fronts, all stall doors).",
      "Plates P15-P24 wait for the test prints T3 / T4 (see docs/DRUCKPLAN.md).", "",
      "## Hardware", "",
      "| Item | Qty | Notes |", "|---|---|---|",
      f"| Hinge pin, main door: 1.75 mm filament, **{pin_len.get('main', 0):.0f} mm** | 4 | pushed in from below, captured by the floor |",
      f"| Hinge pin, stall door: 1.75 mm filament, **{pin_len.get('stall', 0):.0f} mm** | 4 | pushed in from below, captured by the floor |",
      f"| Hinge pin, casement: 1.75 mm filament, **{round(pin_len.get('case', 0)):.0f} mm** | 4 | dropped in from above, clamped by the top knuckle |",
      f"| Total filament for pins | about {4 * sum(pin_len.values()) / 1000 + 0.05:.2f} m | straighten a piece from the spool, cut with flush cutters |", "",
      "No screws, magnets or glue are needed.", ""]
open(os.path.join(ROOT, "docs", "BOM.md"), "w").write("\n".join(B) + "\n")

# ---------------------------------------------------------- JSON presets
pdir = os.path.join(ROOT, "slicer", "bambu_studio")
for f in glob.glob(os.path.join(pdir, "*.json")):
    os.remove(f)
for proc in b3.PROCESSES.values():
    fn = proc["name"].replace(" @BBL A1", "").replace(" ", "_") + ".json"
    json.dump(b3.preset_json(proc), open(os.path.join(pdir, fn), "w"), indent=4, ensure_ascii=False)
print("wrote docs/DRUCKPLAN.md, docs/BOM.md, slicer/bambu_studio/*.json")

# ------------------------------------------------- plate overview sheet
def plate_sheet():
    import io
    import trimesh
    from PIL import Image, ImageDraw, ImageFont
    fnt = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    f1 = ImageFont.truetype(fnt, 17) if os.path.exists(fnt) else ImageFont.load_default()
    f2 = ImageFont.truetype(fnt.replace("-Bold", ""), 14) if os.path.exists(fnt) else ImageFont.load_default()
    order = [k for k, v in plates.items() if v["kind"] == "TEST"] + [k for k, v in plates.items() if v["kind"] == "PROD"]
    T, H, cols = 256, 300, 7
    rows = (len(order) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (T + 10) + 10, rows * (H + 10) + 10), (255, 255, 255))
    for i, pid in enumerate(order):
        p = plates[pid]
        m = trimesh.load(os.path.join(ROOT, "build", "plates", pid + ".stl"), force="mesh")
        png, _ = b3.thumbnail_png([{"mesh": m, "extruder": p["filament"]}], size=T)
        im = Image.open(io.BytesIO(png)).convert("RGB")
        x, y = 10 + (i % cols) * (T + 10), 10 + (i // cols) * (H + 10)
        sheet.paste(im, (x, y))
        d = ImageDraw.Draw(sheet)
        st = {"frei": ("frei", (20, 110, 40)), "T3": ("nach T3", (190, 90, 20)), "T4": ("nach T4", (190, 90, 20))}[p["release"]]
        if p["kind"] == "TEST":
            st = ("TEST", (40, 80, 160))
        d.text((x + 4, y + T + 4), pid.split("_")[0] + "  " + st[0], font=f1, fill=st[1])
        d.text((x + 4, y + T + 24), p["title"][:34], font=f2, fill=(60, 60, 60))
    sheet.save(os.path.join(ROOT, "docs", "images", "platten_uebersicht.jpg"), quality=85)
    print("wrote docs/images/platten_uebersicht.jpg")


plate_sheet()
