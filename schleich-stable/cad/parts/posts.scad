// POSTS (12) -- black. Printed UPRIGHT: grooves and hinge bores are
// in-layer features (round, accurate, strong rings).
// Four base types are modelled in the front-left quadrant; all others are
// mirrored copies (see post_world()).
//
//  corner    (X0,Y0)  grooves +X (gable wing), +Y (side wall)
//  sidemid   (X0,Y1)  grooves -Y, +Y (side walls), +X (partition)
//  jamb      (X1,Y0)  groove -X (gable wing), +X upper (pediment),
//                     +Y lower sill + upper (stall front);
//                     knuckles +X (main door leaf), +Y (stall door)
//  mid       (X1,Y1)  grooves -Y, +Y (stall fronts), -X (partition),
//                     +X upper (truss)

post_bot = 2;                       // posts rest on the socket floor
post_chamfer = 1.2;
z_ext_post_top = z_side_roof(X0 - PW2) - 0.6;   // flat top below side roof

// ---- hinge axes (world, closed position) ----
// main door: leaf exterior face at Y0 - md_face_off, axis on that face
md_t        = 3.2;                  // main door leaf thickness
md_face_off = 6.0;
md_ax = [X1 + PW2 + dk_door / 2 + swing_gap, Y0 - md_face_off + md_t - kz(dk_door)];
md_z  = [12, door_spring_z - 4];    // knuckle stack
md_n  = 7;
// stall door: leaf in the stall-front plane, stall face = print bed
sd_t  = wall_t;
sd_ax = [X1 - sd_t / 2 + kz(dk_door), Y0 + PW2 + dk_door / 2 + swing_gap];
sd_z  = [13, stall_door_top - 4];
sd_n  = 5;
sill_top = floor_top + 3;           // top of the stall-front sill

// post body with a 1 mm lead-in chamfer at the foot (socket entry)
module post_body(x, y, z0, z1) {
    c = 1.0;
    translate([x, y, z0]) union() {
        linear_extrude(c + eps, scale = post_w / (post_w - 2 * c))
            square(post_w - 2 * c, center = true);
        translate([0, 0, c]) linear_extrude(z1 - z0 - c)
            translate([-PW2, -PW2]) crect(post_w, post_w, post_chamfer);
    }
}
// groove cutter on a face ("+x","-x","+y","-y") of the post at (x,y)
module post_groove(x, y, face, z0, z1) {
    d = post_groove_d; w = groove_w;
    if (face == "+x") translate([x + PW2 - d, y - w / 2, z0]) cube([d + 1, w, z1 - z0]);
    if (face == "-x") translate([x - PW2 - 1, y - w / 2, z0]) cube([d + 1, w, z1 - z0]);
    if (face == "+y") translate([x - w / 2, y + PW2 - d, z0]) cube([w, d + 1, z1 - z0]);
    if (face == "-y") translate([x - w / 2, y - PW2 - 1, z0]) cube([w, d + 1, z1 - z0]);
}

module post_corner_world() {
    x = X0; y = Y0; zt = z_ext_post_top;
    difference() {
        post_body(x, y, post_bot, zt);
        post_groove(x, y, "+x", Z_plinth - base_groove_d, zt + 1);
        post_groove(x, y, "+y", Z_plinth - base_groove_d, zt + 1);
    }
}
module post_sidemid_world() {
    x = X0; y = Y1; zt = z_ext_post_top;
    difference() {
        post_body(x, y, post_bot, zt);
        post_groove(x, y, "-y", Z_plinth - base_groove_d, zt + 1);
        post_groove(x, y, "+y", Z_plinth - base_groove_d, zt + 1);
        post_groove(x, y, "+x", floor_top - floor_groove_d, zt + 1);
    }
}
// cut everything above the central roof underside (aisle posts, left side)
module cut_above_c_roof(x) {
    translate([x - PW2, -1000, Z_c_eave]) rotate([0, -pitch_c, 0]) translate([-50, 0, -0.3]) cube([200, 2000, 200]);
}
zt_aisle = Z_c_eave + post_w * tan(pitch_c) + 1;      // raw height before bevel

module post_jamb_world() {
    x = X1; y = Y0; zt = zt_aisle;
    union() {
        difference() {
            post_body(x, y, post_bot, zt);
            post_groove(x, y, "-x", Z_plinth - base_groove_d, zt + 1);
            post_groove(x, y, "+x", door_spring_z - 2, zt + 1);
            post_groove(x, y, "+y", post_bot - 1, sill_top + 0.5);
            post_groove(x, y, "+y", sd_z[1] + 1, zt + 1);
            cut_above_c_roof(x);
        }
        // main door knuckles on the +X face
        translate([md_ax[0], md_ax[1], 0])
            knuckles_fixed_z(md_z[0], md_z[1], md_n, dk_door, [-1, 0], md_ax[0] - (x + PW2));
        // stall door knuckles on the +Y face
        translate([sd_ax[0], sd_ax[1], 0])
            knuckles_fixed_z(sd_z[0], sd_z[1], sd_n, dk_door, [0, -1], sd_ax[1] - (y + PW2));
    }
}
module post_mid_world() {
    x = X1; y = Y1; zt = zt_aisle;
    difference() {
        post_body(x, y, post_bot, zt);
        post_groove(x, y, "-y", floor_top - floor_groove_d, zt + 1);
        post_groove(x, y, "+y", floor_top - floor_groove_d, zt + 1);
        post_groove(x, y, "-x", floor_top - floor_groove_d, zt + 1);
        cut_above_c_roof(x);
    }
}

// mirror helpers about the building centre lines
module mirror_x_c() { translate([XC, 0, 0]) mirror([1, 0, 0]) translate([-XC, 0, 0]) children(); }
module mirror_y_c() { translate([0, Y1, 0]) mirror([0, 1, 0]) translate([0, -Y1, 0]) children(); }

// name: <type>_<quadrant>, quadrant in FL, FR, BL, BR
module post_world(name) {
    t = post_type(name); q = post_quad(name);
    module base() {
        if (t == "corner") post_corner_world();
        if (t == "sidemid") post_sidemid_world();
        if (t == "jamb") post_jamb_world();
        if (t == "mid") post_mid_world();
    }
    if (q == "FL") base();
    if (q == "FR") mirror_x_c() base();
    if (q == "BL") mirror_y_c() base();
    if (q == "BR") mirror_x_c() mirror_y_c() base();
}
function post_type(n) = n[0] == "c" ? "corner" : n[0] == "s" ? "sidemid" : n[0] == "j" ? "jamb" : "mid";
function post_quad(n) = str(n[len(n) - 2], n[len(n) - 1]);
function post_pos(name) =
    let(t = post_type(name), q = post_quad(name),
        bx = (t == "corner" || t == "sidemid") ? X0 : X1,
        by = (t == "corner" || t == "jamb") ? Y0 : Y1,
        x = q[1] == "R" ? 2 * XC - bx : bx,
        y = q[0] == "B" ? 2 * Y1 - by : by)
    [x, y];

// print orientation: upright, footprint centred on the origin, on the bed
module post_print(name) {
    p = post_pos(name);
    translate([-p[0], -p[1], -post_bot]) post_world(name);
}
