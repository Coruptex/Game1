// =====================================================================
//  Schleich-scale horse stable -- CENTRAL CONFIGURATION
//  All dimensions in millimetres. Every part file includes this file.
//
//  World frame (assembly):  X = width (left -> right, seen from the
//  front), Y = depth (front gable at Y=0 -> back gable), Z = up,
//  Z = 0 is the table surface.
//
//  The building is a timber-frame grid: posts stand on the post lines
//  X0..X3 / Y0..Y2, panels slide down into grooves in the posts.
//
//  COMPACT VERSION: the grid, heights and openings are derived from the
//  horse figures (see docs/DIMENSION_PLAN.md), not scaled from the big
//  version. Sections, fits, hinges and latch are unchanged.
// =====================================================================

/* [Design horse (fit checks in tools/validate.py)] */
// Longest / widest / tallest Schleich figure considered (mm)
horse_l = 170;
horse_w = 53;
horse_h = 120;
// Mounted rider, top of helmet above the floor (estimate, no published value)
rider_h = 155;

/* [Fits and tolerances] */
// Clearance per side for panels sliding into post / floor grooves
fit_slide  = 0.20;
// Clearance per side for roof tabs in roof pockets
fit_tab    = 0.25;
// Clearance per side for posts in floor sockets
fit_socket = 0.20;
// Clearance per side for floor-tile interlock fingers
fit_tile   = 0.25;
// Axial gap between hinge knuckles
hinge_gap  = 0.50;
// Radial gap between a door knuckle and the post / frame beside it
swing_gap  = 0.60;

/* [Hinge pins] */
// Pin diameter: 1.75 = a piece of filament, 2.0 = steel rod / nail
pin_d      = 1.75;
// Bore in the part that HOLDS the pin (post / frame side, snug)
bore_fixed = 1.85;
// Bore in the part that ROTATES on the pin (door side, free)
bore_free  = 2.30;

/* [Grid: post centre lines] */
// Post centre-to-centre: exterior wall -> aisle line (stall depth;
// clear depth = bay_x_stall - wall_t >= horse_l + 3)
bay_x_stall = 176;
// Post centre-to-centre across the aisle
bay_x_aisle = 116;
// Post centre-to-centre along the aisle (stall width; clear = bay_y - wall_t)
bay_y       = 116;

/* [Section sizes] */
// Square post section
post_w      = 16;
// Wall / partition / stall-front panel thickness
wall_t      = 2.8;
// Depth of the vertical grooves in posts
post_groove_d = 5.0;
// Floor tile thickness (top of floor above the table)
floor_top   = 8;
// Stone plinth height above the floor
plinth_h    = 18;
// Plinth width (centred on the wall line)
plinth_w    = 9;
// Depth of the groove in the plinth / floor that holds panel bottoms
base_groove_d  = 4.0;
floor_groove_d = 3.0;

/* [Heights and roof] */
// Underside of side roof above the exterior wall line (Z, world).
// Rule: a horse facing the outer wall has its ears ~45 mm from the wall;
// the roof there must clear horse_h + 10.
z_eave_side = 124;
// Side (lean-to) roof pitch, degrees
pitch_side  = 20;
// Vertical step between side-roof top and central roof seat
// (the side roof lifts about roof_step - overhang_c - 2 mm, then slides out)
roof_step   = 14;
// Central roof pitch, degrees (45 = the central roof prints without support)
pitch_c     = 45;
// Roof base thickness (perpendicular to the roof plane)
roof_t      = 2.4;
// Extra thickness of the shingle rows
tile_step   = 1.2;
// Roof overhang beyond walls (eaves and gables)
overhang_eave  = 12;     // side roofs, beyond the exterior walls
overhang_c     = 9;      // central roof, beyond the aisle posts (horizontal)
overhang_gable = 10;

/* [Openings] */
// Main entrance: arch spring height and crown height (Z, world).
// Crown 160 mm above the floor: a mounted rider (about 145-160 mm) passes.
door_spring_z = 140;
door_crown_z  = 168;
// Stall door clear opening (along the stall front) and top edge (Z).
// Width: about 62 mm passage with the door open (horse_w + 2 x 4.5,
// measured past the latch stile's stop bevel); top: horse_h + 5 above
// the 3 mm sill.
stall_door_w  = 72;
stall_door_top = 136;
// Neck yoke (head opening) at the top of the stall door; its bottom is at
// about 97 mm above the floor, so a horse with its head up can look out
yoke_w = 36;
yoke_d = 30;
// Gable-wing window (casement) clear opening
win_w = 44;
win_h = 60;
win_sill_z = 70;      // above table
// Side-wall barred window
swin_w = 36;
swin_h = 48;
swin_sill_z = 60;

/* [Texture] */
plank_w     = 10;     // board width
groove_ext  = 0.55;   // V-groove depth, exterior face
groove_int  = 0.40;   // V-groove depth, interior face
trim_h      = 1.4;    // raised trim height (window/door frames, arch band)

/* [Hidden] */
$fn = 40;
eps = 0.01;

// ----- derived grid -----
X0 = 0;
X1 = bay_x_stall;
X2 = X1 + bay_x_aisle;
X3 = X2 + bay_x_stall;
XC = (X1 + X2) / 2;
Y0 = 0;
Y1 = bay_y;
Y2 = 2 * bay_y;
PW2 = post_w / 2;

// ----- derived heights -----
Z_plinth   = floor_top + plinth_h;                      // top of plinth
Z_side_top = z_eave_side + bay_x_stall * tan(pitch_side); // side roof underside at X1
Z_c_eave   = Z_side_top + roof_step;                    // central roof seat (post tops)
// central roof underside passes through the outer faces of the aisle posts
// at Z_c_eave and rises to the apex; the eaves hang lower by overhang_c
c_half     = bay_x_aisle / 2 + PW2;
Z_c_low    = Z_c_eave - overhang_c * tan(pitch_c);   // lowest roof edge (print bed of the central roof)
Z_c_apex   = Z_c_eave + c_half * tan(pitch_c);

// side roof underside height at world X (left side, X0..X1)
function z_side_roof(x) = z_eave_side + (x - X0) * tan(pitch_side);
// central roof underside height at world X
function z_c_roof(x) = Z_c_apex - abs(x - XC) * tan(pitch_c);

groove_w = wall_t + 2 * fit_slide;   // width of every panel groove
// how far a panel edge reaches into a post groove
panel_in = post_groove_d - 0.5;

// Printer (Bambu Lab A1) usable volume, minus brim / handling margin
bed_x = 256; bed_y = 256; bed_z = 256;
bed_margin = 6;
