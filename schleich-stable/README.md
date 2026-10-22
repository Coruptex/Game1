# Compact horse stable for Schleich-size figures (3D-printable)

![The assembled stable (render of the exported STL geometry)](docs/images/hero.png)

A compact, sturdy, modular toy stable with four boxes, a cobbled drive-through aisle,
working doors and windows, and a removable roof. Its dimensions are derived from the
horse figures (see [docs/DIMENSION_PLAN.md](docs/DIMENSION_PLAN.md)): every stall fits the
largest common Schleich horse plus room for a hand, and no more.
It is designed for FDM printing on a **Bambu Lab A1** in PLA, with **no support material**
and **no glue, screws or magnets**. It is inspired by the hand-painted Schleich stable sold by
mymodelhorse.com, but it is an original design and is not affiliated with Schleich.

| | |
|---|---|
| Size | **489 x 253 mm** base; **497 x 268 x 276 mm** overall (roof eaves and door bolts) |
| Stalls | 4, each 173 x 113 mm inside, for horses up to 170 x 53 x 120 mm (checked in the validation with a horse proxy) |
| Aisle / main door | 113 mm aisle; arched double doors 100 mm wide, 160 mm clear at the crown |
| Stall doors | 72 x 125 mm opening (62 mm passage when open) with neck yoke and click latch; left and right doors hinge at opposite ends, so all open fully in the narrow aisle |
| Moving parts | 4 main door leaves (slide bolt), 4 stall doors, 4 casement windows, 6 lift-off roof units |
| Parts | 54 printed pieces from 26 STL files; 12 hinge pins cut from 1.75 mm filament |
| Print | 26 plates, about **80 h** and **2.3 kg PLA** (PrusaSlicer estimate with A1-equivalent settings) |

This is the compact version (v2). The first, full-size version was 565 x 357 x 329 mm with
3.4 kg / 116 h of printing. Section 4 of the dimension plan explains where the space was
saved and why nothing was simply scaled down.

| Roof off, doors open | Design-horse proxies in the stalls |
|---|---|
| ![](docs/images/roof_off.png) | ![](docs/images/horses.png) |

## Quick start

1. **Print the test coupons** `3mf/T1_test_hinges_latches.3mf` and `3mf/T2_test_fits.3mf`.
   Follow [docs/TESTING.md](docs/TESTING.md) to pick the clearances for your printer.
2. If you changed values in `cad/config.scad`, regenerate (see below).
3. **Print plates `P01`-`P26`** from `3mf/`, or the single STLs in `stl/`. Settings, colours
   and order are in [docs/PRINT_PLAN.md](docs/PRINT_PLAN.md).
4. **Assemble** with [docs/ASSEMBLY.md](docs/ASSEMBLY.md).

Viewing the assembled model: `docs/assembly_preview.glb` is coloured and opens in any glTF
viewer. `3mf/assembly_preview.3mf` has all parts at their assembled positions, for viewing
only; print from the `P..` plates.

## Documentation

* [docs/DIMENSION_PLAN.md](docs/DIMENSION_PLAN.md): horse sizes, how each dimension follows from them, comparison with the reference and v1
* [docs/SPEC.md](docs/SPEC.md): reference analysis, requirements, dimensions, mechanisms, CAD workflow
* [docs/PRINT_PLAN.md](docs/PRINT_PLAN.md): Bambu Studio settings, plates, time and filament per plate
* [docs/BOM.md](docs/BOM.md): parts list with quantities, pin lengths, tools
* [docs/ASSEMBLY.md](docs/ASSEMBLY.md): step by step, plus a placement map
* [docs/TESTING.md](docs/TESTING.md): how to read the test coupons
* [docs/VALIDATION.md](docs/VALIDATION.md): digital checks (generated)
* [docs/LIMITATIONS.md](docs/LIMITATIONS.md): assumptions, what is and is not verified

## Folder layout

```
cad/            OpenSCAD source (parametric)
  config.scad     ALL dimensions and tolerances
  stable.scad     main file: pick `part` (assembly or a printable part)
  instances.scad  where every part sits in the assembly, which STL it uses
  lib/            textures, hinges, latch, helpers
  parts/          floor, posts, panels, frames, doors, roof
  tests/          test coupons
stl/            printable parts (print orientation), stl/tests/ coupon plates
3mf/            ready-arranged A1 plates (one colour per plate)
tools/          build, validate, plates/slicing, report, render scripts
docs/           documentation and renders
```

## Regenerating the files

Requirements: OpenSCAD 2021.01 or newer. For validation and plates: Python 3.9+ with
`pip install trimesh manifold3d numpy scipy rtree`. Optional: PrusaSlicer (estimates) and
Blender (renders only).

```sh
python3 tools/build.py                    # all printable STLs -> stl/ (about 1 min with OpenSCAD 2021)
python3 tools/build.py --placed --swing   # + assembled poses for validation -> build/
python3 tools/validate.py                 # writes docs/VALIDATION.md (incl. horse-fit checks)
python3 tools/plates.py                   # arrange plates -> 3mf/, slice for estimates
python3 tools/report.py                   # writes docs/PRINT_PLAN.md and docs/BOM.md
python3 tools/render_export.py && tools/render_all.sh   # renders -> docs/images/
```

With OpenSCAD 2023 or newer, add `--backend manifold` to `build.py` for a large speed-up.
Interactive use: open `cad/stable.scad`, choose `part` in the Customizer, then F5 to preview
or F6 + Export STL. `part = "assembly"` shows the whole stable; `door_ang`, `show_roof` and
`explode` change the view.

### Customising
Everything is driven by `cad/config.scad`: the design horse (`horse_l/w/h`), fits
(`fit_slide`, `fit_socket`, `fit_tile`, `fit_tab`), hinge bores and pin size, `latch_engage`,
wall/post/floor sizes, bay sizes (stall depth and width, aisle), heights and roof pitches,
openings and textures. After a change, rebuild **and re-run the validation**: it reports
collisions, swing ranges, horse clearances and parts that no longer fit the bed. The plates
are re-packed automatically by `tools/plates.py`.
