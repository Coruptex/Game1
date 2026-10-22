# Assumptions and known limitations

## What has and has not been verified

| Claim | How it was checked |
|---|---|
| Every part is a closed, single-body mesh that fits the A1 build volume | **Digitally**: `tools/validate.py` (trimesh) on the exported STLs |
| No two assembled parts overlap | **Digitally**: pairwise boolean intersection (manifold3d) of all 54 placed parts |
| Doors and windows swing without collision | **Digitally**: swept at 15 deg steps. Main doors 0-105 deg, stall doors 0-90 deg (they then meet the closed main leaf), casements 0-150 deg |
| Hinge pins pass through all knuckles | **Digitally**: virtual 1.75 mm pins, no contact |
| Latch engages (barb seated when closed, 0.8 mm interference while passing) | **Digitally**: fine sweep of the stall-door angle |
| Roof units lift off; panels slide out of their grooves | **Digitally**: translation sweeps |
| Print time and filament | **Estimated** with PrusaSlicer 2.7.2 using A1-equivalent settings, not Bambu Studio |
| Fits (grooves, sockets, bores, latch, tile fingers, tabs) | **Not physically tested.** Calculated starting values; print the coupons |
| Latch force (~2 N), strain (~0.45 %) and fatigue life | **Calculated only** (beam theory, typical PLA properties) |
| Strength under play loads | **Not tested**; judged from section sizes and load paths |
| Safety (EN 71 / ASTM F963) | **Not assessed or certified** |

## Assumptions

* **Reference dimensions are estimates.** The product page could not be accessed from the
  build environment. Retailer data for the base Schleich set (42195 / 42344) conflicts and
  most likely describes the box. Proportions were taken from the photos (see `SPEC.md`).
* **Figure sizes** come from retailer listings: horses up to about 17 x 5.5 x 12.5 cm. The
  mounted-rider height of about 15-16 cm is an estimate.
* **Printer behaviour:** a well-calibrated A1 with a 0.4 mm nozzle, PLA at default Bambu
  settings, textured PEI plate. Holes printed flat come out slightly small; this is
  compensated by teardrop bores and the `bore_*` parameters.
* **Filament as hinge pins:** a straight 1.75 mm PLA or PETG piece. Steel rod is optional.

## Known limitations

* **Size and time.** It is about 57 x 36 x 33 cm, about 3.4 kg of filament, and about 116 h of
  printing (estimate). That is inherent at this scale. To go faster: 0.28 mm layers for the
  posts and floor tiles, or a 0.6 mm nozzle for the floor and roof. Neither has been tested
  with this model.
* **Tall posts:** the six 240 mm posts print upright, which is the strongest orientation for
  their grooves and hinge rings. Very tall, narrow prints need a clean plate and a brim. The
  plate is staggered so a failure costs one plate, not the whole build.
* **The central roof prints standing on its 5 mm eave strips** with 45 deg slopes. It needs
  good part cooling. If the underside sags on your printer, enable tree supports for that part
  only.
* **Side-roof removal with the central roof in place:** lift about 5 mm, then pull outward.
  Removing the central unit first is easier.
* **Main doors open to about 105 deg**, then stop against the door post. They do not fold
  flat against the wall.
* **Stall doors open about 90 deg into the aisle.** Two opposite doors open together block the
  aisle.
* **The base can be lifted by its edges** (the floor tiles interlock). The roof is loose by
  design: carry the stable level, or take the roof off first.
* **No glazing:** the windows and skylights are open. Thin clear PETG could be cut and fitted
  if wanted.
* **Black trim** needs a filament change at Z = 2.8 mm, or painting. Without it, the panels are
  plain white.
* **PLA flexure fatigue:** the latch tongue is low-strain by design, but it has not been
  cycle-tested. A broken tongue means reprinting one stall door (about 22 g). PETG doors are a
  good upgrade.
* **OpenSCAD version:** built and tested with OpenSCAD 2021.01 (CGAL). Newer versions should
  work, faster with `--backend manifold`, but that was not tested here.
* **Small parts:** hinge pins (33-146 mm x 1.75 mm) and the two 63 mm bolt bars are captured
  when assembled. They are still a hazard for children under 3. This is a printed toy without
  certification; supervise young children.
