# Test coupons: print these first

The stable needs about 80 printing hours, so check the fits before committing to it.
Two small plates reproduce every risky mechanism at **full scale**, each with several
clearance variants. The value engraved on each variant is the parameter it tests.

| Plate | File | Est. time | Contents |
|---|---|---|---|
| T1 | `3mf/T1_test_hinges_latches.3mf` (`stl/tests/plate_T1.stl`) | ~3 h | 3 hinge post stubs, 3 hinge leaves, 3 latch pairs |
| T2 | `3mf/T2_test_fits.3mf` (`stl/tests/plate_T2.stl`) | ~1.5 h | groove post + wall strip, socket plate, tile interlock, roof-tab plate + key |

Print them with the same filament and settings you will use for the stable.
Source: `cad/tests/coupons.scad`. Change the variant lists at its top to test other values.

None of these coupons has been printed yet. The clearances are calculated starting points.

## T1-a Hinge: post side (`bore_fixed`)
Post stubs engraved **1.75 / 1.85 / 1.95** (bore in mm). Push a straight piece of 1.75 mm
filament up from below.
* **Good:** it goes in with light force and stays put when the stub is turned upside down.
* Too tight (you cannot push it in): use the next larger value.
* Too loose (it falls out): use the next smaller value.
* Set `bore_fixed` in `config.scad`.

## T1-b Hinge: door side (`bore_free`)
Leaves engraved **2.15 / 2.3 / 2.45**. Fit a leaf between the knuckles of the post stub you
chose and push the pin through.
* **Good:** the leaf swings 0 to 90 deg under its own weight or with a fingertip, without
  noticeable wobble.
* It binds: use a larger value. It wobbles a lot: use a smaller one.
* Also check that the knuckle gaps (0.5 mm) do not rub. If they do, increase `hinge_gap`.
* Set `bore_free`.

## T1-c Click latch (`latch_engage`)
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
