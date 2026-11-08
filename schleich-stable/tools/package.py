#!/usr/bin/env python3
"""Bundle the print files for delivery -> build/Stall_Druckdateien.zip

  Stall_Druckdateien/
    LIES_MICH.md
    1_TEST/          Bambu Studio projects of the test plates
    2_PRODUKTION/    Bambu Studio projects of the released production plates
    Presets/         process presets (JSON)
    Anleitungen/     German guides + the images they show
"""
import glob, os, re, zipfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DOCS = ["AENDERUNGEN.md", "TESTANLEITUNG.md", "VERSCHLUSS.md", "VERBINDUNGEN.md", "BAMBU_STUDIO.md",
        "DRUCKPLAN.md", "ANALYSE.md"]
OUT = os.path.join(ROOT, "build", "Stall_Druckdateien.zip")


def main():
    base = "Stall_Druckdateien/"
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(ROOT, "bambu", "LIES_MICH.md"), base + "LIES_MICH.md")
        for f in sorted(glob.glob(os.path.join(ROOT, "bambu", "TEST", "*.3mf"))):
            z.write(f, base + "1_TEST/" + os.path.basename(f))
        for f in sorted(glob.glob(os.path.join(ROOT, "bambu", "PRODUKTION", "*.3mf"))):
            z.write(f, base + "2_PRODUKTION/" + os.path.basename(f))
        for f in sorted(glob.glob(os.path.join(ROOT, "slicer", "bambu_studio", "*.json"))):
            z.write(f, base + "Presets/" + os.path.basename(f))
        images = set()
        for d in DOCS:
            p = os.path.join(ROOT, "docs", d)
            txt = open(p, encoding="utf-8").read()
            images |= set(re.findall(r"\]\((images/[^)]+)\)", txt))
            z.write(p, base + "Anleitungen/" + d)
        for im in sorted(images):
            p = os.path.join(ROOT, "docs", im)
            if os.path.exists(p):
                z.write(p, base + "Anleitungen/" + im)
    n = len(zipfile.ZipFile(OUT).namelist())
    print(OUT, n, "files", round(os.path.getsize(OUT) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
