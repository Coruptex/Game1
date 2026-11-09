// POST BLOCKS -- print aid against tipping (added 10 Nov 2026).
// Tall, slim posts (16 mm square, up to 217 mm high) can come loose on a
// bed-slinger printer (A1: the bed moves in Y). A post block prints six
// posts as one stiff group:
//
//   * a thin spine wall along Y with diamond openings (45 deg, no bridges)
//     and a flange on the bed;
//   * from the spine one fin goes into ONE wall groove of every post;
//   * the fin touches the groove bottom only at small break-off teeth
//     (0.8 x 0.6 mm at the post). Everywhere else it keeps 0.5 mm from the
//     groove bottom and 0.95 mm from the groove walls.
//
// The groove bottom is hidden later: a wall panel reaches panel_in =
// post_groove_d - 0.5 into the groove, so a tooth stub never touches it and
// the groove walls (the fit faces) stay untouched.
//
// Every post in a block is the unchanged print part (print_part()), only
// placed and rotated. Print orientation: as modelled, z = 0 on the bed.

pb_spine_t = 1.2;      // spine wall thickness
pb_fin_t   = 1.2;      // fin thickness (groove is wall_t + 2 * fit_slide_post wide)
pb_gap     = 6.0;      // spine face -> post face
pb_pitch   = 34;       // post pitch along the spine (room for knuckles + their supports)
pb_root    = 0.5;      // fin end -> groove bottom
pb_tooth   = [0.8, 0.6, 1.2, 0.8];   // tooth at the post (w, h) and at the fin (w, h)
pb_tooth_dz = 10;      // tooth spacing (z)
pb_flange  = [8, 0.6]; // spine foot: width, height
pb_debug   = "none";  // checks: "posts" / "aids" (spine + fins, no teeth) / "teeth"

// [print part, groove face used (+x/-x/+y/-y), groove start z (print frame)]
pb_short = [["post_corner", "+x", 20], ["post_sidemid", "+x", 3], ["post_corner", "+x", 20],
            ["post_corner", "+x", 20], ["post_sidemid", "+x", 3], ["post_corner", "+x", 20]];
pb_hinge = [["post_jamb_L", "-x", 20], ["post_mid", "-x", 3], ["post_jamb_R", "+x", 20],
            ["post_jamb_L", "-x", 20], ["post_mid", "-x", 3], ["post_jamb_R", "+x", 20]];

function pb_face_ang(f) = f == "+x" ? 0 : f == "+y" ? 90 : f == "-x" ? 180 : 270;

// fin + teeth for a post on the +x side of the spine (post centre at xc),
// its groove facing -x, groove from z0 upward; fin height H
module pb_fin(xc, z0, H) {
    xg = xc - PW2 + post_groove_d;          // groove bottom
    xe = xg - pb_root;                      // fin end inside the groove
    xs = xc - PW2 - 0.5;                    // fin end below the groove (0.5 mm off the face)
    t = pb_fin_t;
    // in the (x, z) plane, extruded over y = -t/2 .. t/2
    rotate([90, 0, 0]) translate([0, 0, -t / 2]) linear_extrude(t)
        polygon([[0, 0], [xs, 0], [xs, z0 + 0.5], [xe, z0 + 0.5 + (xe - xs)], [xe, H], [0, H]]);
    // break-off teeth: narrow at the post, so they break there
    if (pb_debug != "aids") for (z = [z0 + 0.5 + (xe - xs) + 3 : pb_tooth_dz : H - 2])
        hull() {
            translate([xe - 0.2, -pb_tooth[2] / 2, z - pb_tooth[3] / 2]) cube([0.2, pb_tooth[2], pb_tooth[3]]);
            translate([xg - 0.01, -pb_tooth[0] / 2, z - pb_tooth[1] / 2]) cube([0.16, pb_tooth[0], pb_tooth[1]]);
        }
}

module pb_spine(y0, y1, H, ys) {
    difference() {
        union() {
            translate([-pb_spine_t / 2, y0, 0]) cube([pb_spine_t, y1 - y0, H]);
            translate([-pb_flange[0] / 2, y0, 0]) cube([pb_flange[0], y1 - y0, pb_flange[1]]);
        }
        // diamond openings between the fins (45 deg edges print without support)
        for (i = [0 : len(ys) - 2]) {
            yc = (ys[i] + ys[i + 1]) / 2;
            a = (ys[i + 1] - ys[i]) / 2 - 4;
            for (zc = [10 + a : 2 * a + 3 : H - a - 5])
                translate([0, yc, zc]) rotate([0, 90, 0]) rotate([0, 0, 45])
                    cube([a * sqrt(2), a * sqrt(2), 10], center = true);
        }
    }
}

// six posts: entries 0..2 on the +x side, 3..5 on the -x side
module post_block(list, H) {
    xc = pb_spine_t / 2 + pb_gap + PW2;
    ys = [for (i = [0 : 2]) i * pb_pitch];
    union() {
        if (pb_debug != "posts") pb_spine(ys[0] - PW2, ys[2] + PW2, H, ys);
        for (k = [0 : 5]) let(e = list[k], side = k < 3 ? 1 : -1, y = ys[k % 3]) {
            target = side > 0 ? 180 : 0;            // groove faces the spine
            if (pb_debug == "none" || pb_debug == "posts")
                translate([side * xc, y, 0]) rotate([0, 0, target - pb_face_ang(e[1])]) print_part(e[0]);
            if (pb_debug != "posts") translate([0, y, 0]) mirror([side > 0 ? 0 : 1, 0, 0]) pb_fin(xc, e[2], H);
        }
    }
}
module posts_block_short() { post_block(pb_short, 100); }
module posts_block_hinge() { post_block(pb_hinge, 175); }
