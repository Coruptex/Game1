# Compact version: dimension plan

This plan was written **before** the compact model was built. Every dimension is derived
from the size of the horse figures first, then from structure and printability. The values
are the defaults in `cad/config.scad`, and everything else is derived from them.

The first version (v1, "full size") worked, but it was larger than it needed to be: its
stalls were three to five horse-widths wide, the aisle was as wide as a stall, and the roof
was tall. v2 is a redesign at the same 1:12 figure scale, not a scaled-down copy.

## 1. Design input: the horse figures

Sizes from retailer listings. They are approximate, and listings sometimes mix up the axes.
Where the axes were ambiguous, the longest value is taken as the length and the smallest
as the width.

| Figure | L x W x H (mm) | Source |
|---|---|---|
| Shire stallion 13734 (largest common figure) | 170 x 40 x 120 | [MediaMarkt AT](https://www.mediamarkt.at/de/product/_schleich-13734-shire-hengst-spielfigur-mehrfarbig-107752217.html) (170 / 40 / 120 mm); [Clockshop](https://www.clockshop.com.au/shire-stallion) gives 160 x 40 x 115 |
| Friesian stallion 13975 (widest) | 155 x 53 x 112 | [Minizoo](https://www.minizoo.com.au/schleich-friesian-stallion-model-horse/), [Smyths](https://www.smythstoys.com/uk/en-gb/toys/construction-and-cars/schleich/schleich-horse-club/schleich-horse-club-13975-friesian-stallion/p/232136) |
| Arabian stallion 13981 | 150 x 45 x 100 | [Minizoo](https://minizoo.com.au/schleich-arabian-stallion-2024) |
| Andalusian stallion 13821 | 140 x 50 x 115 | [Toybox](https://toybox.com.cy/products/schleich-andalusian-stallion) |
| Haflinger mare 13950 | 150 x 33 x 95 | [Smyths FR](https://www.smythstoys.com/fr/fr-fr/jouets/voitures-et-jeux-de-construction/schleich/schleich-horse-club-et-bayala/schleich-horse-club-13950-figurine-jument-haflinger/p/216507) |
| Hanoverian mare 13927 | about 145 x 35 x 107 (axes not labelled) | [Bruderland](https://bruderland-en.wpjshop.cz/black-hanoverian-mare-schleich-13927_z1934/) |
| Quarter Horse mare 13852 | 135 x 35 x 110 | [Clockshop](https://clockshop.com.au/quarter-horse-mare) |
| Trakehner mare 13888 | 133 x 47 x 98 | [Galaxus](https://www.galaxus.de/en/s5/product/schleich-trakehner-mare-toy-figure-10111033), [Clockshop](https://www.clockshop.com.au/trakehner-mare) |
| Haflinger foal 13951 | 90 x 25 x 74 | [Minizoo](https://www.minizoo.com.au/schleich-haflinger-foal-2023/), [Sports Direct](https://www.sportsdirect.com/schleich-horse-club-haflinger-foal-748557) |
| Clydesdale foal 13810 | 83 x 37 x 79 | [Buchmann](https://www.buchmann.ch/en/schleich-clydesdale-foal-p-502042.html) |

**Design horse:** 170 x 53 x 120 mm. This combines the longest (Shire), the widest
(Friesian) and the tallest (Shire) listed figures, so it is stricter than any single figure.
Most horses are 133-155 long, 33-50 wide and 95-115 tall.

**Estimates (not published; judged from photos of the figures):**

* Ear tips are 40-50 mm behind the nose tip. The back is at about 65 % of the total height.
* A mounted rider (horse plus seated rider, to the top of the helmet) is about 145-160 mm.
  No reliable rider-figure height was found.
* +5 mm on height is kept as a reserve for figures and editions not listed above.

## 2. How each dimension follows from the horse

| Dimension | Rule | Result |
|---|---|---|
| Stall depth (along the horse) | longest horse 170 + 3 mm | **173 mm** between the wall boards (post spacing 176) |
| Stall width | widest horse 53 + about 30 mm each side for fingers and a hand | **113 mm** between the boards (post spacing 116); 100 mm between the corner posts |
| Stall door width | widest horse plus 4-5 mm each side once the door is open | 72 mm clear when closed; about **62 mm** passage with the door open 90 deg, past the latch stop (changed from 70 during modelling, see section 7) |
| Stall door height | tallest horse 120 + 5 | **125 mm** clear above a 3 mm sill |
| Neck yoke in the stall door | head out over the door | 36 x 30 mm cut-out at the top, bottom 97 mm above the floor (changed from 34 x 20, see section 7) |
| Outer eave (lowest point inside) | horse facing the outer wall: nose at the wall, ears 45 mm in; ears 120 + 10 mm clearance | roof underside **116 mm** above the floor at the wall, 133 mm at 45 mm in |
| Aisle | horse 53 + 23 mm each side; an open stall door (70) must leave room | **113 mm** between the stall fronts, 100 mm between the posts |
| Main door | horse with rider, two leaves | **100 mm** wide between the posts (about 85 mm between the open leaves); **160 mm** high at the crown, 132 mm at the springing |
| Side roof | 20 deg (as the reference) over the 176 mm stall | rises 64 mm, to 188 mm at the stall front |
| Roof step | the side roof must lift above its 1.6 mm tabs and slide out under the central eave | 14 mm (about 7 mm free lift) |
| Central roof | 45 deg is the steepest overhang that prints without support (printed as installed) | apex 268 mm, ridge **275 mm** |

**What is not made smaller** (strength and printability come first): posts 16 x 16 mm, walls
and panels 2.8 mm, the 8 mm floor, groove depths (5 / 4 / 3 mm) and fits, hinge knuckles
(7 mm and 5.2 mm) with full-length 1.75 mm pins, the click-latch geometry, and the roof tabs.
The door heights and window sizes are tied to the figure scale, not to the building. So are
the textures (10 mm boards, 9 mm shingle rows, cobbles).

## 3. The plan

| Item | Value |
|---|---|
| Overall width x depth x height | **489 x 253 x 275 mm** (base; 495 x 255 mm including the roof) |
| Number of stalls | **4**, two on each side of a drive-through aisle (the reference layout) |
| Inside each stall | 173 x 113 mm between the walls (160 x 100 mm between the corner posts); clear height 116 mm at the outer wall, about 177 mm at the stall front |
| Aisle | 113 x 232 mm, doors at both gables |
| Stall door opening | 72 x 125 mm (above the 3 mm sill); about 62 mm passage when open |
| Main door opening | 100 mm wide; 132 mm high at the springing, 160 mm at the crown |
| Windows | casement (gable wings) 44 x 60 mm; side walls 36 x 48 mm, barred |
| Roof | 6 lift-off units: 2 central 45 deg "tents", each about 150 x 127 mm at the eaves; 4 side 20 deg lean-to panels, each about 193 x 127 mm along the slope |
| Roof overhang | 12 mm at the outer eaves, 9 mm at the central eaves, 10 mm at the gables |
| Assembled footprint | 489 x 253 mm = 0.124 m2 (v1: 0.202 m2, **-39 %**) |
| Estimated material | about **2.3 kg PLA** (+-15 %): grey 0.6, white 0.65, black 0.5, roof 0.5 kg. About **85-95 h** at 0.20 mm. These figures are scaled from the v1 slicer results; the real slicer estimate after modelling is in `PRINT_PLAN.md`. |
| Parts | 54 printed pieces from 26 STL files (v1: 28), 12 filament pins |

## 4. Comparison with the reference and v1

| | Reference (estimated from photos) | v1 full size | **v2 compact** |
|---|---|---|---|
| Width (facade) | about 550-570 mm | 565 mm | **489 mm** (-13 %) |
| Depth | not visible in the photos | 357 mm | **253 mm** (-29 %) |
| Height | about 310 mm | 329 mm | **275 mm** (-16 %) |
| Stalls | 4 | 4 | 4 |
| Stall inside | about as deep as the aisle is wide | 185 x 165 mm | **173 x 113 mm** |
| Aisle | 170-180 mm door | 165 mm | **113 mm** |
| Main door | 170-180 x 170 mm | 152 x 182 mm | **100 x 160 mm** |
| Material / print time | n/a | 3.44 kg / 116 h (slicer) | **2.33 kg / 80 h** (slicer, after modelling; planned about 2.3 kg / 85-95 h) |

**Where the space was saved:**

1. **Stall width, 165 to 113 mm.** That is two to three horse widths instead of three to five.
   There is still room for a hand beside the horse. This is the main reason the stable is
   29 % shallower.
2. **Aisle, 165 to 113 mm.** In v1 the facing stall doors needed a wide aisle to open. Now
   the left and right doors are hinged at opposite ends (see section 5), so they never
   meet, even in a narrow aisle.
3. **Stall depth, 185 to 173 mm.** The longest horse fits, plus 3 mm, and nothing more.
4. **Eave height, 142 to 124 mm.** This comes from where the ears are when a horse faces
   the outer wall, not from scaling. Over the stall door the ceiling stays high, because
   the lean-to roof rises toward the aisle.
5. **Lower central roof.** The aisle is narrower (the 45 deg tent is 26 mm lower), the roof
   step is smaller (19 to 14 mm) and the overhangs are shorter.
6. **Plinth 22 to 18 mm.** It matches the lower walls.

The figure-driven openings keep their size. The stall door is 125 mm high in both
versions, because the horses did not get smaller.

## 5. Layout change: alternating stall doors

The left stall doors are hinged at the gable end, the right stall doors at the middle post.
Seen from the aisle, every door hinges on its left. An open door therefore never faces an
open door across the aisle, so the doors open fully (90 deg) in the narrow aisle.

As a side effect, all four stall fronts are one part, and all four stall doors are one part,
each printed four times. The stable has 180 deg rotational symmetry about its centre. The
door hinges are on posts as before: on the gable-door posts front left and back right, and
on the two middle posts.

## 6. Changing the size

Everything is in `cad/config.scad`. The main dimensions are `bay_x_stall` (stall depth),
`bay_y` (stall width), `bay_x_aisle`, `z_eave_side`, `roof_step`, `stall_door_w`,
`stall_door_top`, `door_spring_z` and `door_crown_z`. The design horse (`horse_l`, `horse_w`,
`horse_h`) is also there. The validation script places this horse in every stall, facing
both ways, and checks its clearances. Change a value, rebuild, and run the validation again.

## 7. Result after modelling (checked)

Numbers measured on the exported model (`tools/validate.py`, `docs/VALIDATION.md`) and
from the slicer (`docs/PRINT_PLAN.md`):

| Item | Plan | Built and checked |
|---|---|---|
| Base footprint | 489 x 253 mm | 489 x 253 mm |
| Overall size incl. roof and door bolts | 495 x 255 x 275 mm | 497 x 268 x 276 mm (the bolt knobs on the main doors stand 7.5 mm proud at each gable) |
| Design horse in a stall, both ways round | fits | fits: 1.6 mm at each end, 30 mm at each side, 7 mm above the ears when facing the outer wall |
| Stall door passage (door open 90 deg) | about 62 mm | 62.3 x 125 mm; design horse passes with 4.3 mm at the sides and 4 mm head room |
| Main door with rider | 160 mm at the crown | passes with 4 mm under the arch (rider 155 mm, an estimate) |
| All doors, windows and bolts open at once | | no collisions |
| Side roof lift under the central eave | about 7 mm | 4-6 mm, then it slides out (checked over 60 mm) |
| Taking a horse out from above | | a typical horse (150 mm) lifts straight out with only its side roof off; the 170 mm design horse with its head at the stall front also needs the central roof unit off (the central eave covers the front 20 mm of the stall) |
| Material / time | about 2.3 kg / 85-95 h | 2.33 kg / 80 h on 26 plates (PrusaSlicer with A1-equivalent settings) |

Changes made during modelling:

* **Stall door 70 to 72 mm.** The latch stile's 2.4 mm stop bevel narrows the opening. With
  70 mm the passage was only 60 mm (2.4 mm side room for the widest horse). It is now 62 mm.
* **Neck yoke 34 x 20 to 36 x 30 mm.** The shallower yoke started above the head height of
  most figures, so a horse could not look out.

