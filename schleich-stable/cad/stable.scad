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
part = "assembly"; // [assembly, floor_LF, floor_AF, floor_RF, floor_LB, floor_AB, floor_RB, post_corner, post_sidemid, post_jamb_L, post_jamb_R, post_mid, side_wall, gable_wing_A, gable_wing_B, partition, stall_front, pediment, main_leaf_A, main_leaf_B, bolt_bar, stall_door, casement_A, casement_B, roof_central, roof_side_A, roof_side_B]
mode = "print";    // [print, placed]
/* [Assembly view] */
show_roof = true;
// door and window opening angle (degrees)
door_ang = 0;      // [0:5:150]
explode = 0;       // [0:5:100]

function starts(s, p) = len(s) >= len(p) && [for (i = [0 : len(p) - 1]) s[i]] == [for (i = [0 : len(p) - 1]) p[i]];
function tail(s, n) = str_join([for (i = [n : len(s) - 1]) s[i]]);
function str_join(v, i = 0) = i >= len(v) ? "" : str(v[i], str_join(v, i + 1));

// key dimensions for the Python tools (validation, renders): part = "dims"
module echo_dims() {
    d = [["XC", XC], ["YC", Y1], ["X1", X1], ["X2", X2], ["X3", X3], ["Y1", Y1], ["Y2", Y2],
         ["bay_x_stall", bay_x_stall], ["bay_x_aisle", bay_x_aisle], ["bay_y", bay_y],
         ["post_w", post_w], ["wall_t", wall_t], ["floor_top", floor_top], ["ext_out", ext_out],
         ["z_eave_side", z_eave_side], ["pitch_side", pitch_side], ["Z_side_top", Z_side_top],
         ["Z_c_eave", Z_c_eave], ["Z_c_apex", Z_c_apex], ["sill_top", sill_top],
         ["stall_door_w", stall_door_w], ["stall_door_top", stall_door_top],
         ["door_spring_z", door_spring_z], ["door_crown_z", door_crown_z],
         ["horse_l", horse_l], ["horse_w", horse_w], ["horse_h", horse_h], ["rider_h", rider_h],
         ["sd_ax_x", sd_ax[0]], ["sd_ax_y", sd_ax[1]], ["sf_ud", sf_ud], ["stop_bevel", stop_bevel], ["md_ax_x", md_ax[0]]];
    for (e = d) echo(str("DIM ", e[0], "=", e[1]));
}
if (part == "dims") echo_dims();
else if (part == "assembly") assembly(show_roof, door_ang, explode);
else if (mode == "placed") inst(part, door_ang);
else print_part(part);
