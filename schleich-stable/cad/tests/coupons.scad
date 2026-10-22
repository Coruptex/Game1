// =====================================================================
//  TEST COUPONS -- print these BEFORE the big parts.
//  Each coupon reproduces a real mechanism at full scale with several
//  clearance variants. Engraved numbers = the parameter value tested.
//  Pick the best variant and copy its value into ../config.scad.
//
//  part = "plate_T1"  hinges + latches (about 2 h)
//  part = "plate_T2"  grooves, sockets, tile interlock, roof tabs (about 1.5 h)
//  or any single coupon name below.
// =====================================================================
include <../config.scad>
include <../lib/common.scad>
include <../lib/textures.scad>
include <../lib/hinges.scad>
include <../lib/latch.scad>
// part files only define modules/constants (finger, tab, bevel sizes ...)
include <../parts/floor.scad>
include <../parts/posts.scad>
include <../parts/panels.scad>
include <../parts/frames.scad>

part = "plate_T1"; // [plate_T1, plate_T2, hinge_post, hinge_leaf, latch_stile, latch_door, groove_post, panel_strip, socket_plate, tile_a, tile_b, tab_plate, tab_key]

bores_fixed = [1.75, 1.85, 1.95];     // post side (pin must be snug)
bores_free  = [2.15, 2.30, 2.45];     // door side (must turn freely)
latch_e     = [0.6, 0.8, 1.0];        // barb engagement (= tongue deflection)
groove_fits = [0.15, 0.20, 0.30];     // per side
socket_fits = [0.15, 0.20, 0.30];
tile_fits   = [0.15, 0.25, 0.35];
tab_fits    = [0.15, 0.25, 0.35];

module label(s, size = 4) { text(s, size = size, halign = "center", valign = "center"); }
module engrave_top(s, t, size = 4, depth = 0.6) { translate([0, 0, t - depth]) linear_extrude(depth + 1) label(s, size); }

// ---- C1 hinge: post stub (printed upright), same knuckles as the jamb post
hp_h = 92; hp_z = [6, 86]; hp_n = 5;
module hinge_post(bore = bore_fixed) {
    ax = PW2 + dk_door / 2 + swing_gap;
    difference() {
        union() {
            translate([-PW2, -PW2, 0]) linear_extrude(hp_h) crect(post_w, post_w, post_chamfer);
            translate([ax, 0, 0]) knuckles_fixed_z(hp_z[0], hp_z[1], hp_n, dk_door, [-1, 0], ax - PW2, true, bore);
        }
        // engraved value on the back face
        translate([-PW2 + 0.6, 0, hp_h / 2]) rotate([0, -90, 0]) rotate([0, 0, 90]) linear_extrude(2) label(str(bore), 3.5);
    }
}
// ---- C1 hinge: leaf (printed flat), same knuckles as the doors
module hinge_leaf(bore = bore_free) {
    difference() {
        union() {
            translate([dk_door / 2 + swing_gap, 0, 0]) cube([40, hp_h, 3.2]);
            knuckles_moving_y(hp_z[0], hp_z[1], hp_n, dk_door, 1, dk_door / 2 + swing_gap, bore);
        }
        translate([dk_door / 2 + swing_gap + 22, hp_h / 2, 0]) rotate([0, 0, 90]) engrave_top(str(bore), 3.2, 5);
    }
}

// ---- C2 click latch: stile segment + door segment (both flat)
lt_h = 52; lt_y0 = 14;
module latch_stile(e = latch_engage) {
    difference() {
        union() {
            cube([20, lt_h, wall_t]);
            // stop bevel below and above the latch zone (as on the stall front)
            for (r = [[2, lt_y0 - 2], [lt_y0 + latch_len + 3, lt_h - 2]])
                translate([0, r[0], 0]) rotate([-90, 0, 0]) linear_extrude(r[1] - r[0])
                    mirror([0, 1]) polygon([[0.3, 0], [-stop_bevel, 0], [0.3, stop_bevel + 0.3]]);
        }
        latch_notch_cut(0, lt_y0, wall_t, e);
        translate([12, lt_h / 2, 0]) rotate([0, 0, 90]) engrave_top(str(e), wall_t, 5);
    }
}
module latch_door(e = latch_engage) {
    w = 30;
    difference() {
        union() {
            difference() {
                cube([w, lt_h, wall_t]);
                translate([0, 0, -1]) linear_extrude(wall_t + 2) latch_tongue_cut2d(w, lt_y0);
            }
            latch_barb(w, lt_y0, wall_t, e);
        }
        // free-edge chamfer outside the latch zone (bears on the stop bevel)
        for (r = [[-1, lt_y0 - 1], [lt_y0 + latch_len + 2, lt_h + 1]])
            translate([w, r[0], 0]) rotate([-90, 0, 0]) linear_extrude(r[1] - r[0])
                mirror([0, 1]) polygon([[0.5, -0.5], [-(stop_bevel - latch_gap + 0.4) - 0.5, -0.5], [0.5, stop_bevel - latch_gap + 0.4 + 0.5]]);
        translate([11, lt_h / 2, 0]) rotate([0, 0, 90]) engrave_top(str(e), wall_t, 5);
    }
}

// ---- C3 panel grooves: post stub (upright) with 3 groove widths
gp_h = 40;
module groove_post() {
    faces = [[1, 0], [0, 1], [-1, 0]];
    difference() {
        translate([-PW2, -PW2, 0]) linear_extrude(gp_h) crect(post_w, post_w, post_chamfer);
        for (i = [0 : 2]) {
            w = wall_t + 2 * groove_fits[i];
            rotate([0, 0, atan2(faces[i][1], faces[i][0])])
                translate([PW2 - post_groove_d, -w / 2, -1]) cube([post_groove_d + 1, w, gp_h + 2]);
        }
        // value marks on the plain face (-Y): engraved text, top to bottom = +X, +Y, -X
        for (i = [0 : 2]) translate([0, -PW2 + 0.6, gp_h - 8 - i * 12]) rotate([90, 0, 0]) linear_extrude(2)
            label(str(round(groove_fits[i] * 100)), 3.5);
    }
}
module panel_strip() {          // a piece of wall at the real thickness, with boards
    plank_slab(20, gp_h + 10, wall_t);
}

// ---- C4 floor sockets: plate with 3 sockets, the groove post is the plug
module socket_plate() {
    difference() {
        cube([66, 26, floor_top]);
        for (i = [0 : 2]) {
            s = post_w + 2 * socket_fits[i];
            translate([11 + i * 22 - s / 2, 13 - s / 2, 2]) cube([s, s, 20]);
        }
        for (i = [0 : 2]) translate([11 + i * 22, 2.5, 0]) engrave_top(str(round(socket_fits[i] * 100)), floor_top, 2.5, 0.5);
    }
}

// ---- C5 floor-tile interlock: A has one finger, B three notches
module tile_a() {
    difference() {
        union() {
            cube([30, 40, floor_top]);
            translate([30 - 1, 20 - finger_w / 2, 0]) cube([finger_l + 1, finger_w, finger_h]);   // finger
        }
        translate([14, 20, 0]) rotate([0, 0, 90]) engrave_top("A", floor_top, 6);
    }
}
module tile_b() {
    L = 3 * 30;
    difference() {
        cube([24, L, floor_top]);
        for (i = [0 : 2]) {
            g = tile_fits[i];
            translate([-1, 15 + i * 30 - finger_w / 2 - g, -1]) cube([finger_l + g + 1, finger_w + 2 * g, finger_h + 0.25 + 1]);
            translate([17, 15 + i * 30, 0]) rotate([0, 0, 90]) engrave_top(str(round(g * 100)), floor_top, 4);
        }
    }
}

// ---- C6 roof tabs: plate with 3 pockets (printed flat like the side roofs) + key
module tab_plate() {
    t = roof_t + tile_step;
    difference() {
        cube([70, 30, t]);
        for (i = [0 : 2]) {
            f = tab_fits[i];
            translate([12 + i * 23 - tab_w / 2 - f, 15 - wall_t / 2 - f, -1]) cube([tab_w + 2 * f, wall_t + 2 * f, 1 + tab_h_side + 0.3]);
            translate([12 + i * 23, 25, 0]) engrave_top(str(round(f * 100)), t, 3.5, 0.5);
        }
    }
}
module tab_key() {              // wall edge with one tab, printed flat
    difference() {
        union() {
            cube([40, 14, wall_t]);
            translate([15, 14 - 1, 0]) linear_extrude(wall_t) polygon([[0, 0], [tab_w, 0], [tab_w, 1 + tab_h_side - 0.6], [tab_w - 0.6, 1 + tab_h_side], [0.6, 1 + tab_h_side], [0, 1 + tab_h_side - 0.6]]);
        }
    }
}

// ---- plates -------------------------------------------------------------
module plate_T1() {
    for (i = [0 : 2]) translate([20, 20 + i * 32, 0]) hinge_post(bores_fixed[i]);
    for (i = [0 : 2]) translate([50 + i * 50, 10, 0]) hinge_leaf(bores_free[i]);
    for (i = [0 : 2]) {
        translate([10 + i * 65, 120, 0]) latch_door(latch_e[i]);
        translate([10 + i * 65 + 30 + latch_gap + 3, 120, 0]) latch_stile(latch_e[i]);
    }
}
module plate_T2() {
    translate([20, 20, 0]) groove_post();
    translate([45, 8, 0]) panel_strip();
    translate([80, 8, 0]) socket_plate();
    translate([80, 45, 0]) tile_a();
    translate([150, 40, 0]) tile_b();
    translate([10, 150, 0]) tab_plate();
    translate([10, 195, 0]) tab_key();
}

if (part == "plate_T1") plate_T1();
if (part == "plate_T2") plate_T2();
if (part == "hinge_post") hinge_post();
if (part == "hinge_leaf") hinge_leaf();
if (part == "latch_stile") latch_stile();
if (part == "latch_door") latch_door();
if (part == "groove_post") groove_post();
if (part == "panel_strip") panel_strip();
if (part == "socket_plate") socket_plate();
if (part == "tile_a") tile_a();
if (part == "tile_b") tile_b();
if (part == "tab_plate") tab_plate();
if (part == "tab_key") tab_key();
