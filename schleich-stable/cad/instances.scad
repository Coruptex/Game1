// INSTANCE REGISTRY
// Every physical part of the stable is an "instance" with a world placement.
// Instances map onto a smaller set of unique printable parts (mirror pairs
// "A"/"B"; parts identical by rotation are printed several times).

module rot180_c() { translate([XC, Y1, 0]) rotate([0, 0, 180]) translate([-XC, -Y1, 0]) children(); }

// quadrant transform: FL as modelled, FR = mirror X, BL = mirror Y, BR = rotation
module quad(q) {
    if (q == "FL") children();
    if (q == "FR") mirror_x_c() children();
    if (q == "BL") mirror_y_c() children();
    if (q == "BR") rot180_c() children();
}

// [instance, print part, colour]
instances = [
    ["floor_LF", "floor_LF", "floor"], ["floor_AF", "floor_AF", "floor"], ["floor_RF", "floor_RF", "floor"],
    ["floor_LB", "floor_LB", "floor"], ["floor_AB", "floor_AB", "floor"], ["floor_RB", "floor_RB", "floor"],
    ["post_corner_FL", "post_corner", "post"], ["post_corner_FR", "post_corner", "post"],
    ["post_corner_BL", "post_corner", "post"], ["post_corner_BR", "post_corner", "post"],
    ["post_sidemid_FL", "post_sidemid", "post"], ["post_sidemid_FR", "post_sidemid", "post"],
    ["post_jamb_FL", "post_jamb_L", "post"], ["post_jamb_BR", "post_jamb_L", "post"],
    ["post_jamb_FR", "post_jamb_R", "post"], ["post_jamb_BL", "post_jamb_R", "post"],
    ["post_mid_FL", "post_mid", "post"], ["post_mid_FR", "post_mid", "post"],
    ["side_wall_FL", "side_wall", "wall"], ["side_wall_FR", "side_wall", "wall"],
    ["side_wall_BL", "side_wall", "wall"], ["side_wall_BR", "side_wall", "wall"],
    ["gable_wing_FL", "gable_wing_A", "wall"], ["gable_wing_BR", "gable_wing_A", "wall"],
    ["gable_wing_FR", "gable_wing_B", "wall"], ["gable_wing_BL", "gable_wing_B", "wall"],
    ["partition_L", "partition", "wall"], ["partition_R", "partition", "wall"],
    ["stall_front_FL", "stall_front_A", "wall"], ["stall_front_BR", "stall_front_A", "wall"],
    ["stall_front_FR", "stall_front_B", "wall"], ["stall_front_BL", "stall_front_B", "wall"],
    ["pediment_F", "pediment", "wall"], ["pediment_B", "pediment", "wall"],
    ["main_leaf_FL", "main_leaf_A", "door"], ["main_leaf_BR", "main_leaf_A", "door"],
    ["main_leaf_FR", "main_leaf_B", "door"], ["main_leaf_BL", "main_leaf_B", "door"],
    ["bolt_bar_F", "bolt_bar", "door"], ["bolt_bar_B", "bolt_bar", "door"],
    ["stall_door_FL", "stall_door_A", "door"], ["stall_door_BR", "stall_door_A", "door"],
    ["stall_door_FR", "stall_door_B", "door"], ["stall_door_BL", "stall_door_B", "door"],
    ["casement_FL", "casement_A", "door"], ["casement_BR", "casement_A", "door"],
    ["casement_FR", "casement_B", "door"], ["casement_BL", "casement_B", "door"],
    ["roof_central_F", "roof_central", "roof"], ["roof_central_B", "roof_central", "roof"],
    ["roof_side_FL", "roof_side_A", "roof"], ["roof_side_BR", "roof_side_A", "roof"],
    ["roof_side_FR", "roof_side_B", "roof"], ["roof_side_BL", "roof_side_B", "roof"]
];

function q_of(n) = str(n[len(n) - 2], n[len(n) - 1]);
function has(n, p) = starts(n, p);

// world geometry of one instance. ang = door / window opening angle
module inst(n, ang = 0) {
    q = q_of(n);
    if (has(n, "floor_")) floor_tile_world(tail(n, 6));
    else if (has(n, "post_")) post_world(tail(n, 5));
    else if (has(n, "side_wall_")) quad(q) side_wall_place() side_wall_local();
    else if (has(n, "gable_wing_")) quad(q) gable_wing_place() gable_wing_local();
    else if (n == "partition_L") partition_place() partition_local();
    else if (n == "partition_R") rot180_c() partition_place() partition_local();
    else if (has(n, "stall_front_")) quad(q) stall_front_place() stall_front_local();
    else if (n == "pediment_F") pediment_place() pediment_local();
    else if (n == "pediment_B") rot180_c() pediment_place() pediment_local();
    else if (n == "main_leaf_FL") main_leaf_world(false, ang);
    else if (n == "main_leaf_FR") main_leaf_world(true, ang);
    else if (n == "main_leaf_BR") rot180_c() main_leaf_world(false, ang);
    else if (n == "main_leaf_BL") rot180_c() main_leaf_world(true, ang);
    else if (n == "bolt_bar_F") bolt_bar_world(ang > 0);
    else if (n == "bolt_bar_B") rot180_c() bolt_bar_world(ang > 0);
    else if (has(n, "stall_door_")) quad(q) stall_door_world(ang);
    else if (has(n, "casement_")) quad(q) casement_world(ang);
    else if (n == "roof_central_F") c_tent_world();
    else if (n == "roof_central_B") c_tent_back_world();
    else if (has(n, "roof_side_")) quad(q) side_roof_world();
}

// unique printable parts, in print orientation
module print_part(p) {
    if (has(p, "floor_")) floor_tile(tail(p, 6));
    else if (p == "post_corner") post_print("corner_FL");
    else if (p == "post_sidemid") post_print("sidemid_FL");
    else if (p == "post_jamb_L") post_print("jamb_FL");
    else if (p == "post_jamb_R") post_print("jamb_FR");
    else if (p == "post_mid") post_print("mid_FL");
    else if (p == "side_wall") side_wall_local();
    else if (p == "gable_wing_A") gable_wing_local();
    else if (p == "gable_wing_B") mirror([1, 0, 0]) gable_wing_local();
    else if (p == "partition") partition_local();
    else if (p == "stall_front_A") stall_front_local();
    else if (p == "stall_front_B") mirror([1, 0, 0]) stall_front_local();
    else if (p == "pediment") pediment_local();
    else if (p == "main_leaf_A") main_leaf_print(false);
    else if (p == "main_leaf_B") main_leaf_print(true);
    else if (p == "bolt_bar") bolt_bar_print();
    else if (p == "stall_door_A") stall_door_print(false);
    else if (p == "stall_door_B") stall_door_print(true);
    else if (p == "casement_A") casement_print(false);
    else if (p == "casement_B") casement_print(true);
    else if (p == "roof_central") c_tent_print();
    else if (p == "roof_side_A") side_roof_local();
    else if (p == "roof_side_B") mirror([1, 0, 0]) side_roof_local();
}

// ---------------------------------------------------------- assembly
colours = [["floor", "#a7a39b"], ["post", "#26262a"], ["wall", "#f3f1ea"], ["door", "#2e2e33"], ["roof", "#45474c"]];
function col(c) = colours[search([c], colours)[0]][1];

module assembly(roof = true, ang = 0, explode = 0) {
    for (i = instances) {
        n = i[0];
        show = roof || !has(n, "roof_");
        dz = explode * (has(n, "floor_") ? 0 : has(n, "post_") ? 0.3 : has(n, "roof_") ? 2.2 : 1);
        if (show) color(col(i[2])) translate([0, 0, dz]) inst(n, ang);
    }
}
