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
// =====================================================================

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
// Post centre-to-centre: exterior wall -> aisle line
bay_x_stall = 188;
// Post centre-to-centre across the aisle
bay_x_aisle = 168;
// Post centre-to-centre along the aisle (one stall)
bay_y       = 168;

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
plinth_h    = 22;
// Plinth width (centred on the wall line)
plinth_w    = 9;
// Depth of the groove in the plinth / floor that holds panel bottoms
base_groove_d  = 4.0;
floor_groove_d = 3.0;

/* [Heights and roof] */
// Underside of side roof above the exterior wall line
z_eave_side = 142;
// Side (lean-to) roof pitch, degrees
pitch_side  = 20;
// Vertical step between side-roof top and central roof seat
roof_step   = 13.6;
// Central roof pitch, degrees (45 = the central roof prints without support)
pitch_c     = 45;
// Roof base thickness (perpendicular to the roof plane)
roof_t      = 2.4;
// Extra thickness of the shingle rows
tile_step   = 1.2;
// Roof overhang beyond walls (eaves and gables)
overhang_eave  = 15;
overhang_gable = 12;

/* [Openings] */
// Main entrance: arch spring height and crown height (Z, world)
door_spring_z = 160;
door_crown_z  = 190;
// Stall door clear opening (along the stall front) and top edge (Z)
stall_door_w  = 74;
stall_door_top = 136;
// Gable-wing window (casement) clear opening
win_w = 46;
win_h = 64;
win_sill_z = 72;      // above table
// Side-wall barred window
swin_w = 44;
swin_h = 58;
swin_sill_z = 66;

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
// central roof underside rises from the outer face of the aisle posts
c_half     = bay_x_aisle / 2 + PW2;
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
