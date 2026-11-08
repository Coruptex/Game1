# Test coupons: print these first

The stable needs about 88 printing hours, so check the fits before committing to it. The test
plates reproduce every risky mechanism at **full scale**, each with several clearance
variants. The value engraved on each variant is the parameter it tests. Step-by-step
instructions in German: [TESTANLEITUNG.md](TESTANLEITUNG.md).

| Plate | Bambu Studio project | Contents | Status |
|---|---|---|---|
| T1 | (printed) | 3 hinge post stubs 1.75/1.85/1.95, 3 hinge leaves 2.15/2.30/2.45, 3 click-latch pairs | **printed Nov 2026:** leaf 2.15 best (larger too loose) -> `bore_free = 2.15`; all three post stubs too tight |
| T2 | `bambu/TEST/TEST_T2_Boden_Passungen.3mf` | socket plate, tile interlock (floor settings, 0.24 mm layers) | open (only if not printed yet) |
| T3a | `bambu/TEST/TEST_T3a_Pfosten_Scharnier.3mf` | 5 post stubs 2.05/2.15/2.25/2.35/2.45 (upright, tree supports, same preset as the posts), groove post | open |
| T3b | `bambu/TEST/TEST_T3b_Tuer_Fenster.3mf` | 2 door leaves 2.15, gable-wing window section + production casement + stand, window pin clamps 1.85/1.95/2.05, wall strip, roof-tab plate + key | open |
| T4 | `bambu/TEST/TEST_T4_Verschluss.3mf` | drop-latch test rig (frame, door, lever, stand), main-door bolt loops + bolt bar | open |

Every project carries the same printer, filament and process settings as the production plates
of the same part type. Source: `cad/tests/coupons.scad` (single coupons are exported by
`tools/build.py`, arranged by `tools/plates.py`).

Fit parameters and the coupons that set them:

| Parameter (`config.scad`) | Print orientation | Coupon |
|---|---|---|
| `bore_post` | upright (posts) | T3a post stubs; T3a + T3b leaf assembled |
| `bore_free` | flat (doors, casements) | T1 (confirmed 2.15) |
| `bore_win_hold`, `bore_win_free` | flat (gable-wing window frame) | T3b pin clamps, window section |
| drop latch (`cad/lib/droplatch.scad`) | flat | T4 rig |
| main-door bolt loops | flat | T4 bolt plate |
| `fit_slide` | upright post, flat panel | T3a groove post + T3b wall strip |
| `fit_socket` | flat floor, upright post | T2 socket plate + T3a groove post |
| `fit_tile` | flat floor (0.24 mm) | T2 tiles |
| `fit_tab` | flat | T3b tab plate + key |

The sections below describe the original T1/T2 coupons, which are reused in T2/T3.

## T1-a Hinge: post side (now `bore_post`, tested again in T3a)
Post stubs engraved **1.75 / 1.85 / 1.95** (bore in mm). Push a straight piece of 1.75 mm
filament up from below.
* **Good:** it goes in with light force and stays put when the stub is turned upside down.
* Too tight (you cannot push it in): use the next larger value.
* Too loose (it falls out): use the next smaller value.
* Set `bore_post` in `config.scad`.

## T1-b Hinge: door side (`bore_free`)
Leaves engraved **2.15 / 2.3 / 2.45**. Fit a leaf between the knuckles of the post stub you
chose and push the pin through.
* **Good:** the leaf swings 0 to 90 deg under its own weight or with a fingertip, without
  noticeable wobble.
* It binds: use a larger value. It wobbles a lot: use a smaller one.
* Also check that the knuckle gaps (0.8 mm) do not rub. If they do, increase `hinge_gap`.
* Set `bore_free`.

## T1-c Click latch (`latch_engage`) -- to be replaced by the drop latch (T4, see VERSCHLUSS.md)
Pairs engraved **0.6 / 0.8 / 1.0** (barb overlap in mm). Lay the stile piece flat on the
table, engraved face up. Hold the door piece, also engraved face up, with its tongue edge
facing the stile's notched edge, 1 mm apart, and about 3 mm above the table. Push it straight
down onto the table. That is the motion of a closing stall door.
* **Good:** a clear click; it stays put when you shake it gently and opens with a light pull.
* No click or no hold: use a larger value.
* Very stiff, or the tongue turns white (overstrained): use a smaller value. PETG doors
  tolerate more.
* Set `latch_engage` (used by both the stall fronts and the stall doors).

## T2-a Panel grooves (`fit_slide`)
The post stub has three grooves, engraved **15 / 20 / 30** (clearance per side, in 1/100 mm).
Slide the wall strip into each one.
* **Good:** it slides in by hand with slight friction and does not rattle.
* Set `fit_slide` (affects every post, plinth and floor groove).

## T2-b Post sockets (`fit_socket`)
The socket plate has holes engraved **15 / 20 / 30**. Use the groove post stub as the plug,
bottom end first (it has the same 1 mm lead-in chamfer as the real posts).
* **Good:** it goes in by hand, stands upright without wobbling and pulls out by hand.
* Set `fit_socket`.

## T2-c Floor-tile fingers (`fit_tile`)
Tile **A** has one finger. Tile **B** has three notches, engraved **15 / 25 / 35**. Lay both
flat and slide A sideways into each notch.
* **Good:** it slides in without force. When joined, the tiles cannot be lifted apart
  vertically and do not rock.
* Set `fit_tile`.

## T2-d Roof tabs (`fit_tab`)
The plate has three pockets underneath, engraved **15 / 25 / 35**. Put the tab key into each.
* **Good:** it drops in without force, with only a slight sideways play.
* Set `fit_tab` (affects both central and side roof units).

## After changing values
Re-export with `python3 tools/build.py` and `python3 tools/plates.py`. Then run
`python3 tools/build.py --placed --swing` and `python3 tools/validate.py` to confirm
nothing collides.
