# Technical specification

Scope: a modular, 3D-printable toy horse stable for Schleich-size figures,
printed on a Bambu Lab A1 (256 x 256 x 256 mm, 0.4 mm nozzle), in PLA/PLA+.

## 1. Reference analysis

**Reference:** mymodelhorse.com, "Customized Schleich Stable, 4 Stalls, Horses & Tack"
(`/de-de/products/stable-for-schleich-model-horses`).

The product page could not be opened from the build environment: direct HTTPS was
refused by the network policy (proxy 403) and the fetch tool could not resolve
the host. What is known comes from web-search summaries of that page and of retailer
pages, plus the seven reference photos supplied with the request.

| Item | Source | Status |
|---|---|---|
| A brand-new **Schleich 42195 or 42344** stable, hand-painted black and white, 4 stalls, removable roof | search summary of the product page | verified as a listing claim |
| Sold with two Mustang figures, a rider, tack, fences, hay; ~USD 435, "sold out" | search summary | not relevant to the design |
| Schleich 42195 "83 x 26 x 39 cm" | official Schleich DE/AT listing (summary) | dimension type unclear, most likely the **box** |
| 42195 / 42344 "57 x 38 x 14 cm" | several retailers | most likely a box or a mislabelled field |
| "60 x 40 x 29.5 cm" | retailers, but item 42485 (a different stable) | not applicable |

No trustworthy assembled dimensions were found. The values used here are estimated from
the photos, with the door opening and the Schleich figures as scale references.

**Estimated from the photos (not verified):**

* Facade about 55-57 cm wide; overall height to the ridge about 31 cm.
* Stepped "basilica" section: a tall central gable with the main door, and lower side
  wings with lean-to roofs. The central roof is about 34 deg, the side roofs about 20 deg.
* Central arched double door, about 17-18 cm wide and 17 cm to the crown. A mounted rider
  reaches about 88 % of the opening.
* Four stalls, two on each side of a central cobbled aisle. In the top view, each stall is
  about as deep as the aisle is wide.
* Stall fronts: black grilles with ball finials over white slotted or boarded lower panels.
  The swinging stall door has a curved neck yoke.
* White vertical-board walls with wood grain, black trim, arched four-pane windows (the
  facade casements open outward), a grey stone plinth and a dark tiled roof with four
  skylights.
* The back of the model is open in the roof-off photo. It is not shown otherwise.

**What makes it attractive:** the strong black-and-white contrast, the arched openings, the
stepped silhouette, and real texture (boards, tiles, cobbles, stones).

**What is adopted:** the layout (4 stalls, central aisle, drive-through gable doors), the
stepped roof with skylights, the arched double doors with 2x2 panes and Z-braces, the arched
casement windows, the stone plinth, board walls, black trim, stall doors with neck yokes,
and the cobbled aisle.

**What changed for FDM printing and robustness:**

* A timber-frame **post-and-panel system** replaces large moulded shells. 16 mm posts are
  printed upright; panels are printed flat and slide into grooves.
* The central roof is **45 deg** instead of about 34 deg. At 45 deg it prints in one piece
  standing on its eaves, with no support.
* The wood grain is replaced by crisp V-grooved boards (fine grain does not print well at
  0.4 mm). Ball finials were left out (small and fragile).
* Every hinge uses a full-length separate pin and robust knuckles, not moulded clips.
* Both gables are identical, so the aisle is a drive-through. Play access is through the
  removable roof sections.

## 2. Figure sizes (design inputs)

Retailer listings, so sizes are approximate and vary by model:

| Figure | L x W x H (cm) |
|---|---|
| Arabian stallion 13981 | 15 x 4.5 x 10 |
| Friesian stallion 13975 | 15.5 x 5.3 x 11.2 |
| Andalusian stallion 13821 | 14 x 5 x 11.5 |
| Shire stallion 13734 (largest common) | about 17 x 4 x 12 |
| Mares | 13-14.5 x 3.4-4.5 x 10-11.2 |

Design envelope: horse up to **170 x 55 x 125 mm**. The mounted-rider height (helmet top) is
estimated at 145-160 mm. This is an estimate: no published rider-figure height was found.

## 3. Requirements and how they are met

| # | Requirement | Solution |
|---|---|---|
| 1 | Schleich-size horses | Stall 185 x 165 mm between walls; aisle 165 mm between stall fronts; main door 152 mm wide, 182 mm clear at the crown and 152 mm at the springing; tie beam 209 mm above the floor |
| 2 | Attractive, coherent | Reference-inspired facade, textures, black trim by filament change |
| 3 | Sturdy | 16 mm posts in 6-28 mm deep sockets; 2.8 mm panels held on three or four edges; 8 mm sandwich floor; interlocking floor tiles |
| 4 | Printable on the A1 | 28 unique parts, all <= 231 x 215 mm footprint, <= 240 mm tall; checked in `docs/VALIDATION.md` |
| 5 | Roof removable without tools | 6 gravity-seated roof units, located by tabs/pockets and post notches |
| 6 | Stall doors open/close | Knuckle hinges with a full-length pin, 0-90 deg (stops at the closed main door) |
| 7 | Other doors functional | Main double doors 0-105 deg with slide bolt; casement windows 0-150 deg |
| 8 | No excessively thin walls | Walls 2.8 mm (2.25 mm at board grooves), posts 16 mm, roof 2.4-3.6 mm |
| 9 | Straightforward assembly | Slide-in panels, drop-in pins, one assembly order (`docs/ASSEMBLY.md`) |
| 10 | Replaceable parts | No glue anywhere; every part comes out by lifting it or pulling a pin |
| 11 | Minimal supports / post-processing | Zero support material by design (45 deg rule, teardrop bores, chamfered knuckles) |
| 12 | PLA / PLA+ | All parts PLA; PETG optional for doors (tougher flexures) |

## 4. Architecture

Grid of post centre lines (mm): X0 = 0, X1 = 188, X2 = 356, X3 = 544; Y0 = 0, Y1 = 168, Y2 = 336.

| Module | Qty | Notes |
|---|---|---|
| Floor tiles | 6 | 3 x 2 grid; aisle: cobbles, stalls: rubber-mat grid; perimeter stone plinth (22 mm) with wall grooves; post sockets straddle the tile joints |
| Posts | 12 | 16 x 16 mm, printed upright: 4 corner, 2 side-mid, 4 door-jamb (with hinge knuckles), 2 mid-aisle; aisle posts bevelled 45 deg under the central roof |
| Side walls | 4 | Barred arched window |
| Gable wings | 4 | Casement window with hinge knuckles; sloped top carries the side roof |
| Partitions | 2 | Horizontal boards with a bar window; sloped top carries the side roofs |
| Stall fronts | 4 | Portal frame: boards, bars, latch stile, sill, gallery with knee braces, roof beam with tabs |
| Pediments | 2 | Door arch, round gable window, name plate; rake carries the central roof |
| Main door leaves | 4 | 2x2 panes, Z-brace, strap hinges; slide-bolt loops |
| Stall doors | 4 | Boards, bars, neck yoke; click latch; stop bevel |
| Casements | 4 | 4 panes |
| Bolt bars | 2 | Slide through the loops of both leaves |
| Central roof units | 2 | 45 deg, skylights, ridge roll, barge boards; the rear end frame is a truss notched over the mid posts |
| Side roof units | 4 | 20 deg lean-to, shingles |

Main heights above the table: floor 8, plinth 30, side eaves 142, central eaves 229,
apex (roof underside) 321, ridge about 329 mm.
Footprint: base 565 x 357 mm, roof 577 x 363 mm.

## 5. Mechanisms

### Hinges (all doors and windows)
* Knuckle hinge with a **separate pin**: 1.75 mm filament by default, or a 2 mm steel rod
  with bigger bores (`config.scad`).
* The fixed knuckles sit on the posts. Posts print upright, so the bores are round and the
  knuckle rings lie within layers (strongest direction). Each knuckle has a 45 deg underside
  so it prints without support. Bore 1.85 mm (snug).
* The moving knuckles sit on the doors. Doors print flat, so these bores are teardrops
  (2.3 mm, free fit). The radial gap to the fixed parts is 0.6 mm; the axial gap is 0.5 mm.
* The pin is inserted from below. The top fixed knuckle is blind, and the floor under the
  post captures the pin once the post stands in its socket (main and stall doors). Casement
  pins drop in from the top onto a blind bottom bore.
* The casement axis is raised 0.6 mm off the wall, so the knuckle's flat underside cannot
  dig into the wall as it turns (found and fixed through validation).

### Stall-door click latch (no loose parts)
* A 22 mm cantilever tongue is cut into the door's free stile and flexes **in the print
  plane**. Its 45 deg barb snaps into a recess shaped into the latch stile.
* Engagement 0.8 mm. Estimated strain at full deflection is about 0.45 % (PLA yields around
  3 %), and the estimated opening force is about 2 N. These are calculations, not
  measurements.
* A 45 deg stop bevel on the stile, with a matching chamfer on the door, sets the closed
  position and stops the door swinging into the stall.

### Main doors
* The leaves close against the back of the pediment (4 mm overlap) and are locked by a
  sliding **bolt bar** through loops on both leaves. The knob is a stop; the bar stays on the
  right leaf when unlocked.

### Removable roof
* Six units: 2 central "tents" and 4 side panels. All are gravity-seated, with nothing to
  snap or wear.
* Central: the slopes rest on the pediment rake and on the bevelled aisle-post tops. The rear
  end-frame notches straddle the mid posts (locate in X and Y). Tabs on the stall-front beams
  (3.5 mm) enter pockets in the slopes. Lift straight up.
* Side: 1.6 mm tabs on the gable-wing and partition rakes enter pockets in the panel
  underside. The side units lift about 6 mm under the central eaves and then pull outward,
  or lift freely once the central unit is off.

### Structural joints
* **Panels to posts:** plain grooves, 3.2 mm wide (0.2 mm per side), 5 mm deep. Panels slide
  in from above.
* **Panels to floor:** 4 mm grooves in the plinth (exterior) and 3 mm grooves in the floor
  (interior).
* **Posts to floor:** sockets with 0.2 mm per side. Exterior posts sit 28 mm deep in the
  plinth; interior posts sit 6 mm deep and are braced by the panels on three or four faces.
* **Floor tile to tile:** sliding fingers, 20 x 10 x 3 mm, in bottom notches (0.25 mm per
  side), alternating ownership. They lock the tiles vertically **both ways**, so the stable
  can be lifted by its base. The posts then pin the joints horizontally.

## 6. Printing rules applied

* No support material anywhere. Overhangs are <= 45 deg, bridges are short (<= 20 mm), and
  horizontal holes are teardrops.
* Panels print flat with the exterior face up. Raised trims are 1.4 mm high. A filament
  change at Z = 2.8 mm (start of layer 15 at 0.2 mm) makes them black.
* Posts and the central roof print in their installed orientation. All other parts print flat.
* Fits are central parameters: `fit_slide`, `fit_tab`, `fit_socket`, `fit_tile`,
  `bore_fixed`, `bore_free`, `latch_engage`. Coupons let you test each one.

## 7. Safety

* Every pin, bar and part can be removed, but none is glued. The **hinge pins (1.75 mm, 33-146 mm long)
  and the 63 mm bolt bars are small, long parts**. They are captured when assembled, but
  are a hazard for children under 3. The latch has no loose parts.
* Exposed corners are rounded or chamfered: base corners r4, roof eave corners r4, door
  corners r1.2, post edges chamfered 1.2 mm, plinth edges chamfered.
* No magnets, no metal by default. A printed toy is **not** certified to toy-safety standards
  (EN 71 / ASTM F963). Supervise young children.

## 8. CAD workflow decision

Evaluated in this environment: OpenSCAD 2021.01 (apt), CadQuery 2.8 / build123d (pip),
Python manifold3d. FreeCAD was not available. Blender was available but is used only as a
renderer.

**Chosen: OpenSCAD.** It meets the requirement reliably. The source is plain parametric
text, the Customizer works, there is no extra runtime, and booleans are robust. CadQuery
would add fillets and STEP export, but it is a heavier install for the user, and its fillet
operations fail more often on textured geometry. To keep the old CGAL kernel fast, the
geometry is built 2D-first: each texture is a single extruded profile. With CGAL a full
build takes about 3 minutes on 4 cores; OpenSCAD 2023+ with `--backend manifold` is much
faster. Validation uses Python (trimesh + manifold3d); estimates use PrusaSlicer.
