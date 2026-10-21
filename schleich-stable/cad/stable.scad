// =====================================================================
//  Schleich-scale horse stable -- main file
//
//  Open this file in OpenSCAD. Choose a part with the `part` variable
//  (Customizer drop-down or -D on the command line). All dimensions and
//  tolerances live in config.scad.
//
//  part = "assembly"  shows the whole stable (preview with F5).
//  mode = "print"     exports a part in its print orientation;
//  mode = "placed"    exports it at its assembled position (validation).
// =====================================================================

include <config.scad>
include <lib/common.scad>
include <lib/textures.scad>
include <lib/hinges.scad>
include <lib/latch.scad>
include <parts/floor.scad>
include <parts/posts.scad>
include <parts/panels.scad>

/* [Selection] */
part = "floor_LF"; // [assembly, floor_LF, floor_AF, floor_RF, floor_LB, floor_AB, floor_RB, post_corner_FL, post_sidemid_FL, post_jamb_FL, post_jamb_FR, post_mid_FL, post_mid_FR]
mode = "print";    // [print, placed]

function starts(s, p) = len(s) >= len(p) && [for (i = [0 : len(p) - 1]) s[i]] == [for (i = [0 : len(p) - 1]) p[i]];
function tail(s, n) = str_join([for (i = [n : len(s) - 1]) s[i]]);
function str_join(v, i = 0) = i >= len(v) ? "" : str(v[i], str_join(v, i + 1));

module show_part(name, m = mode) {
    if (starts(name, "floor_")) {
        id = tail(name, 6);
        if (m == "placed") floor_tile_world(id); else floor_tile(id);
    }
    if (name == "side_wall") { if (m == "placed") side_wall_place() side_wall_local(); else side_wall_local(); }
    if (name == "gable_wing") { if (m == "placed") gable_wing_place() gable_wing_local(); else gable_wing_local(); }
    if (name == "partition") { if (m == "placed") partition_place() partition_local(); else partition_local(); }
    if (starts(name, "post_")) {
        pn = tail(name, 5);
        if (m == "placed") post_world(pn); else post_print(pn);
    }
}

if (part != "assembly") show_part(part);
