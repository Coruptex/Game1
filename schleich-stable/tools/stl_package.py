#!/usr/bin/env python3
"""STL delivery (since 10 Nov 2026 the user sets up the slicer himself):
every print part as STL in print orientation, the white wall parts split into
"Wand" (white, up to the wall face z = wall_t) and "Leisten" (black, above it)
with identical coordinates, the post blocks, the open tests T2 and T4, the
German guides -> build/Stall_STL.zip, and the part lists docs/TEILELISTE.md
(German) and docs/BOM.md.

  python3 tools/stl_package.py        (after tools/build.py)
"""
import os, re, shutil, sys, zipfile
import numpy as np
import trimesh
import manifold3d as mf

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "tools"))
from build import read_instances, unique_parts  # noqa: E402

STL = os.path.join(ROOT, "stl")
STAGE = os.path.join(ROOT, "build", "Stall_STL")
ZIP = os.path.join(ROOT, "build", "Stall_STL.zip")
WALL_T = 2.8          # wall face = colour boundary (config.scad wall_t)

COL = {"floor": "hellgrau", "post": "schwarz", "wall": "weiß + schwarze Leisten", "door": "schwarz", "roof": "dunkelgrau"}
FOLDER = {"floor": "1_Boden_hellgrau", "post": "2_Pfosten_schwarz", "wall": "3_Waende_weiss_mit_schwarzen_Leisten",
          "door": "4_Tueren_Fenster_schwarz", "roof": "5_Dach_dunkelgrau"}
# part -> (German file name, support, brim, note)
NAMES = {
    "floor_LF": ("Boden_links_vorne", "", "", ""),
    "floor_AF": ("Boden_Gang_vorne", "", "", ""),
    "floor_RF": ("Boden_rechts_vorne", "", "", ""),
    "floor_LB": ("Boden_links_hinten", "", "", ""),
    "floor_AB": ("Boden_Gang_hinten", "", "", ""),
    "floor_RB": ("Boden_rechts_hinten", "", "", ""),
    "post_corner": ("Eckpfosten", "", "8 mm", "stehend; oder im Pfostenblock außen"),
    "post_sidemid": ("Seitenpfosten", "", "8 mm", "stehend; oder im Pfostenblock außen"),
    "post_jamb_L": ("Torpfosten_mit_Boxentuer", "unter den Scharnieraugen", "8 mm", "stehend; oder im Pfostenblock Gang"),
    "post_jamb_R": ("Torpfosten_ohne_Boxentuer", "unter den Scharnieraugen", "8 mm", "stehend; oder im Pfostenblock Gang"),
    "post_mid": ("Mittelpfosten", "unter den Scharnieraugen", "8 mm", "stehend; oder im Pfostenblock Gang"),
    "side_wall": ("Seitenwand", "", "", ""),
    "gable_wing_A": ("Giebelwand_A_Fenster", "", "", "spiegelbildlich zu B"),
    "gable_wing_B": ("Giebelwand_B_Fenster", "", "", "spiegelbildlich zu A"),
    "partition": ("Trennwand", "", "", ""),
    "stall_front": ("Boxenfront", "", "", "mit T-Haken für den Fallriegel"),
    "pediment": ("Giebelfeld_ueber_Tor", "", "", ""),
    "main_leaf_A": ("Torfluegel_links", "", "", ""),
    "main_leaf_B": ("Torfluegel_rechts", "", "", ""),
    "bolt_bar": ("Torriegel", "", "", "Stab, durch die Schlaufen der Torflügel"),
    "stall_door": ("Boxentuer", "", "", "mit Zapfen für den Fallriegel"),
    "stall_lever": ("Fallriegel_Hebel", "", "", "steckt auf dem Zapfen der Boxentür"),
    "casement_A": ("Fensterfluegel_A", "", "3 mm", "spiegelbildlich zu B"),
    "casement_B": ("Fensterfluegel_B", "", "3 mm", "spiegelbildlich zu A"),
    "roof_central": ("Mitteldach", "", "5 mm", ""),
    "roof_side_A": ("Seitendach_links", "", "", ""),
    "roof_side_B": ("Seitendach_rechts", "", "", ""),
}
BLOCKS = [("posts_block_short", "Pfostenblock_aussen_4_Eck_2_Seitenpfosten", "", "5 mm",
           "statt 4 Eckpfosten + 2 Seitenpfosten"),
          ("posts_block_hinge", "Pfostenblock_Gang_6_Pfosten_mit_Scharnieraugen", "unter den Scharnieraugen", "5 mm",
           "statt 2 + 2 Torpfosten + 2 Mittelpfosten")]
# open tests: (source in stl/, file name, subfolder)
TESTS = [("tests/socket_plate", "T2_Sockelplatte", "T2_Boden_und_Dach"),
         ("tests/tile_a", "T2_Bodenverzahnung_A", "T2_Boden_und_Dach"),
         ("tests/tile_b", "T2_Bodenverzahnung_B", "T2_Boden_und_Dach"),
         ("tests/tab_plate", "T2_Zapfenplatte", "T2_Boden_und_Dach"),
         ("tests/groove_post", "Nutenpfosten", "T2_Boden_und_Dach/schon_gedruckt_in_T3a"),
         ("tests/tab_key", "Wandzapfen_Stueck", "T2_Boden_und_Dach/schon_gedruckt_in_T3a"),
         ("tests/T4_frame", "T4_Rahmen", "T4_Fallriegel"),
         ("tests/T4_door", "T4_Testtuer", "T4_Fallriegel"),
         ("tests/T4_lever", "T4_Hebel", "T4_Fallriegel"),
         ("tests/T4_bolt_test", "T4_Riegelplatte", "T4_Fallriegel"),
         ("bolt_bar", "T4_Torriegel", "T4_Fallriegel"),
         ("tests/T3b_stand", "Fuss", "T4_Fallriegel/schon_gedruckt_in_T3b")]
DOCS = ["TEILELISTE.md", "TESTANLEITUNG.md", "AENDERUNGEN.md", "VERSCHLUSS.md", "VERBINDUNGEN.md"]


def to_mf(tm):
    return mf.Manifold(mf.Mesh(vert_properties=np.asarray(tm.vertices, np.float32),
                               tri_verts=np.asarray(tm.faces, np.uint32)))


def to_tm(m):
    mesh = m.to_mesh()
    return trimesh.Trimesh(np.asarray(mesh.vert_properties)[:, :3], np.asarray(mesh.tri_verts), process=True)


def split_wall(p):
    """-> (wall below z = WALL_T, trims above), cut by OpenSCAD (tools/build.py,
    stl/split/), same coordinates as the one-piece part; checked against it"""
    tm = trimesh.load(os.path.join(STL, p + ".stl"), force="mesh")
    w = trimesh.load(os.path.join(STL, "split", p + "__base.stl"), force="mesh")
    t = trimesh.load(os.path.join(STL, "split", p + "__trim.stl"), force="mesh")
    assert abs(w.volume + t.volume - tm.volume) < 0.005 * tm.volume, p
    assert abs(w.bounds[1][2] - WALL_T) < 1e-3 and abs(t.bounds[0][2] - WALL_T) < 1e-3, p
    return w, t, tm


def centre_shift(tm, *others):
    """xy bounding-box centre to the origin, underside to z = 0. STL stores
    float32: a shift can merge two nearly coincident vertices and break a
    fine mesh (shingle joints). Use the first candidate that keeps every
    given mesh watertight after a float32 round trip."""
    lo, hi = tm.bounds
    exact = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    for sh in (exact, np.round(exact), np.round(exact / 16) * 16, np.array([0.0, 0.0, -lo[2]])):
        ok = True
        for m in (tm,) + others:
            if not m.is_watertight:
                continue
            v = (np.asarray(m.vertices) + sh).astype(np.float32)
            r = trimesh.Trimesh(v[m.faces.ravel()].reshape(-1, 3), np.arange(len(m.faces) * 3).reshape(-1, 3))
            if not r.is_watertight:
                ok = False; break
        if ok:
            return sh
    return np.array([0.0, 0.0, -lo[2]])


def put(tm, path, shift=None):
    m = tm.copy()
    m.apply_translation(centre_shift(tm) if shift is None else shift)
    m.export(path)


def main():
    shutil.rmtree(STAGE, ignore_errors=True)
    os.makedirs(STAGE)
    rows, checks = [], []
    parts = unique_parts(read_instances())
    for p, colour, qty in parts:
        name, sup, brim, note = NAMES[p]
        folder = os.path.join(STAGE, "2_PRODUKTION", FOLDER[colour])
        if colour == "post":
            folder = os.path.join(folder, "Einzeln")
        os.makedirs(folder, exist_ok=True)
        src = os.path.join(STL, p + ".stl")
        if colour == "wall":
            w, t, tm = split_wall(p)
            fw, ft = f"{name}_{qty}x_Wand_weiss.stl", f"{name}_{qty}x_Leisten_schwarz.stl"
            sh = centre_shift(tm, w, t)                   # same shift for both halves
            put(w, os.path.join(folder, fw), sh); put(t, os.path.join(folder, ft), sh)
            one = os.path.join(folder, "einteilig_mit_Farbwechsel")
            os.makedirs(one, exist_ok=True)
            put(tm, os.path.join(one, f"{name}_{qty}x_einteilig_Farbwechsel_ueber_2,8mm.stl"), sh)
            checks.append((p, w.is_watertight and t.is_watertight, round(w.volume / 1000, 1), round(t.volume / 1000, 1)))
            rows.append((FOLDER[colour], f"{fw} + {ft}", qty, "weiß + schwarz", sup, brim,
                         (note + "; " if note else "") + "beide Dateien zusammen laden"))
        else:
            fn = f"{name}_{qty}x.stl"
            put(trimesh.load(src, force="mesh"), os.path.join(folder, fn))
            rows.append((FOLDER[colour] + ("/Einzeln" if colour == "post" else ""), fn, qty, COL[colour], sup, brim, note))
    bfolder = os.path.join(STAGE, "2_PRODUKTION", FOLDER["post"], "Pfostenblock")
    os.makedirs(bfolder)
    for p, name, sup, brim, note in BLOCKS:
        fn = f"{name}_1x.stl"
        put(trimesh.load(os.path.join(STL, "blocks", p + ".stl"), force="mesh"), os.path.join(bfolder, fn))
        rows.append((FOLDER["post"] + "/Pfostenblock", fn, 1, "schwarz", sup, brim, note))
    # all tests are printed and confirmed (10 Nov 2026): no test folder in the final delivery;
    # TESTS stays as the record of which coupon file belonged to which test
    pdf = os.path.join(ROOT, "docs", "Aufbauanleitung.pdf")
    if os.path.exists(pdf):
        shutil.copy(pdf, os.path.join(STAGE, "Aufbauanleitung.pdf"))
    else:
        print("WARNING: docs/Aufbauanleitung.pdf missing (tools/manual_pdf.py)")

    # part lists
    n_pieces = sum(q for _, _, q in parts)
    T = ["# Teileliste", "",
         f"Stand 10. November 2026. {len(parts)} verschiedene Teile, {n_pieces} Stück. Alle STL-Dateien liegen schon",
         "in Druckrichtung: flache Teile mit der Schauseite nach oben, Pfosten stehend. Die Zahl im",
         "Dateinamen ist die Stückzahl. Stützen und Brim sind meine Empfehlung, einstellen kannst du sie selbst.", "",
         "| Ordner | Datei | Stück | Farbe | Stützen | Brim | Hinweis |", "|---|---|---|---|---|---|---|"]
    for r in sorted(rows, key=lambda r: r[0]):      # stable: keeps the order inside a folder
        T.append("| " + " | ".join(str(x) if x != "" else "–" for x in r) + " |")
    T += ["", "**Pfosten:** entweder die Einzelpfosten aus `Einzeln/` oder die zwei Pfostenblöcke aus",
          "`Pfostenblock/`, nicht beides. Die Blöcke enthalten alle 12 Pfosten.", "",
          "**Lose Teile ohne eigene Datei:** Scharnierstifte aus 1,75-mm-Filament (siehe ASSEMBLY bzw.",
          "Testanleitung): 4 × Tor etwa 126 mm, 4 × Boxentür etwa 122 mm, 4 × Fenster etwa 30 mm."]
    open(os.path.join(ROOT, "docs", "TEILELISTE.md"), "w", encoding="utf-8").write("\n".join(T) + "\n")
    B = ["# Bill of materials", "", "Generated by `tools/stl_package.py`. Delivery: `build/Stall_STL.zip` (German file names).", "",
         f"## Printed parts ({len(parts)} unique STL files, {n_pieces} pieces)", "",
         "| STL (`stl/`) | Qty | Colour |", "|---|---|---|"]
    for p, colour, qty in parts:
        B.append(f"| `{p}.stl` | {qty} | {COL[colour]} |")
    B += ["", "Print aids: `stl/blocks/posts_block_short.stl` (4 corner + 2 side-mid posts) and",
          "`stl/blocks/posts_block_hinge.stl` (2 + 2 jamb + 2 mid posts), see cad/parts/post_blocks.scad.", "",
          "Hinge pins: pieces of 1.75 mm filament, 4 x about 126 mm (main door), 4 x about 122 mm (stall doors),",
          "4 x about 30 mm (casements)."]
    open(os.path.join(ROOT, "docs", "BOM.md"), "w", encoding="utf-8").write("\n".join(B) + "\n")

    # guides
    shutil.copy(os.path.join(ROOT, "docs", "STL_LIES_MICH.md"), os.path.join(STAGE, "LIES_MICH.md"))
    images = set()
    os.makedirs(os.path.join(STAGE, "Anleitungen"))
    for d in DOCS + ["STL_LIES_MICH.md"]:
        txt = open(os.path.join(ROOT, "docs", d), encoding="utf-8").read()
        images |= set(re.findall(r"\]\((images/[^)]+)\)", txt))
        if d != "STL_LIES_MICH.md":
            shutil.copy(os.path.join(ROOT, "docs", d), os.path.join(STAGE, "Anleitungen", d))
    for im in sorted(images):
        s = os.path.join(ROOT, "docs", im)
        if os.path.exists(s):
            os.makedirs(os.path.dirname(os.path.join(STAGE, "Anleitungen", im)), exist_ok=True)
            shutil.copy(s, os.path.join(STAGE, "Anleitungen", im))
    # LIES_MICH sits in the root: its image links point into Anleitungen/
    lm = os.path.join(STAGE, "LIES_MICH.md")
    txt = open(lm, encoding="utf-8").read().replace("](images/", "](Anleitungen/images/")
    txt = re.sub(r"\]\((?!http|Anleitungen/)([A-Z_]+\.md)\)", r"](Anleitungen/\1)", txt)
    open(lm, "w", encoding="utf-8").write(txt)

    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for dp, _, fs in sorted(os.walk(STAGE)):
            for f in sorted(fs):
                full = os.path.join(dp, f)
                z.write(full, os.path.relpath(full, os.path.dirname(STAGE)))
    for c in checks:
        print("split", c)
    n = len(zipfile.ZipFile(ZIP).namelist())
    print(ZIP, n, "files", round(os.path.getsize(ZIP) / 1e6, 1), "MB")


if __name__ == "__main__":
    main()
