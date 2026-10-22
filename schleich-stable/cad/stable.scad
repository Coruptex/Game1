// =====================================================================
//  Schleich-scale horse stable -- MAIN FILE
//
//  Open in OpenSCAD and pick what to show with `part`:
//    "assembly"          whole stable (use F5 preview, colours shown)
//    <print part name>   one printable part in print orientation (F6, export STL)
//  With mode = "placed", `part` is an INSTANCE name (e.g. "stall_door_FL")
//  shown at its assembled position (used by the validation scripts).
//  All dimensions and tolerances are in config.scad.
// =====================================================================

include <config.scad>
include <lib/common.scad>
include <lib/textures.scad>
include <lib/hinges.scad>
include <lib/latch.scad>
include <parts/floor.scad>
include <parts/posts.scad>
include <parts/panels.scad>
include <parts/frames.scad>
include <parts/doors.scad>
include <parts/roof.scad>
include <instances.scad>

/* [Selection] */
part = "assembly"; // [assembly, floor_LF, floor_AF, floor_RF, floor_LB, floor_AB, floor_RB, post_corner, post_sidemid, post_jamb_L, post_jamb_R, post_mid, side_wall, gable_wing_A, gable_wing_B, partition, stall_front_A, stall_front_B, pediment, main_leaf_A, main_leaf_B, bolt_bar, stall_door_A, stall_door_B, casement_A, casement_B, roof_central, roof_side_A, roof_side_B]
mode = "print";    // [print, placed]
/* [Assembly view] */
show_roof = true;
// door and window opening angle (degrees)
door_ang = 0;      // [0:5:150]
explode = 0;       // [0:5:100]

function starts(s, p) = len(s) >= len(p) && [for (i = [0 : len(p) - 1]) s[i]] == [for (i = [0 : len(p) - 1]) p[i]];
function tail(s, n) = str_join([for (i = [n : len(s) - 1]) s[i]]);
function str_join(v, i = 0) = i >= len(v) ? "" : str(v[i], str_join(v, i + 1));

if (part == "assembly") assembly(show_roof, door_ang, explode);
else if (mode == "placed") inst(part, door_ang);
else print_part(part);
