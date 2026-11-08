// =====================================================================
//  TEST COUPONS -- print these BEFORE the big parts.
//  Each coupon reproduces a real mechanism at full scale with several
//  clearance variants. Engraved numbers = the parameter value tested.
//  Pick the best variant and copy its value into ../config.scad.
//
//  part = "plate_T1"  hinges + latches (printed Nov 2026, results in docs/TESTING.md)
//  part = "plate_T2"  grooves, sockets, tile interlock, roof tabs
//  part = "plate_T3a" NEW: post hinge stubs, bores 2.05 ... 2.45 (upright, supports)
//  part = "plate_T3b" NEW: door test leaves 2.15, window test (gable wing
//                     section + casement + stand), window pin clamp coupons
//  part = "plate_T4"  NEW: drop latch test rig (frame, door, lever, stand) and
//                     main door slide bolt test (loops + bolt bar)
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
include <../parts/doors.scad>
include <../lib/droplatch.scad>

part = "plate_T1"; // [plate_T1, plate_T2, plate_T3a, plate_T3b, plate_T4, hinge_post, hinge_leaf, latch_stile, latch_door, groove_post, panel_strip, socket_plate, tile_a, tile_b, tab_plate, tab_key]

bores_fixed = [1.75, 1.85, 1.95];     // T1 post side: all too tight (user test, Nov 2026)
bores_free  = [2.15, 2.30, 2.45];     // T1 door side: 2.15 best (user test, Nov 2026)
coupon_bore = 0;
bores_post_t3 = [2.05, 2.15, 2.25, 2.35, 2.45];   // T3a: upright post knuckles
bores_win_t3  = [1.85, 1.95, 2.05];              // T3b: window pin clamp
latch_e     = [0.6, 0.8, 1.0];        // barb engagement (= tongue deflection)
groove_fits = [0.15, 0.20, 0.30];     // per side
socket_fits = [0.15, 0.20, 0.30];
tile_fits   = [0.15, 0.25, 0.35];
tab_fits    = [0.15, 0.25, 0.35];

module label(s, size = 4) { text(s, size = size, halign = "center", valign = "center"); }
module engrave_top(s, t, size = 4, depth = 0.6) { translate([0, 0, t - depth]) linear_extrude(depth + 1) label(s, size); }

// ---- C1 hinge: post stub (printed upright), same knuckles as the jamb post
hp_h = 92; hp_z = [6, 86]; hp_n = 5;
module hinge_post(bore = bore_post) {
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
            translate([-1, 15 + i * 30 - finger_w / 2 - g, -1]) cube([finger_l + g + 1, finger_w + 2 * g, finger_h + finger_zgap + 1]);
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


// ---- T3b window test: section of gable_wing_A around the casement (printed
// flat like the wall), the production casement and a stand
win_crop = [[gw_hinge_x - 12, win_sill_z - 18], [gw_win_xc + win_w / 2 + 20, win_sill_z + win_h + 10]];
module window_section() {
    translate([-win_crop[0][0], -win_crop[0][1], 0]) intersection() {
        gable_wing_local();
        translate([win_crop[0][0], win_crop[0][1], -5]) cube([win_crop[1][0] - win_crop[0][0], win_crop[1][1] - win_crop[0][1], 30]);
    }
}
// stand with a groove like the plinth groove, holds a test panel upright
module test_stand(L = 100) {
    w = wall_t + 2 * fit_slide;
    difference() {
        translate([0, 0, 0]) cube([L, 18, 10]);
        translate([-1, 9 - w / 2, 10 - base_groove_d]) cube([L + 2, w, base_groove_d + 1]);
        translate([L / 2, 3.5, 0]) engrave_top("Fuss", 10, 3.5, 0.5);
    }
}
// window pin clamp: one knuckle like the top window knuckle, bore b, open both ends
module win_pin_coupon(b) {
    difference() {
        union() {
            cube([16, 14, wall_t]);
            translate([8, 4, wall_t]) knuckles_fixed_y(0, 6, 1, dk_win, -1, 3, cs_lift, b, b);
        }
        translate([8, 4 + 3, wall_t + cs_lift + kz(dk_win)]) hole_y(b, 20);
        translate([8, 1.6, 0]) engrave_top(str(b), wall_t, 2.6, 0.5);
    }
}

// ---- T4 drop latch test rig: a short stall door on a flat frame with the
// real door knuckles, stop bevel, lever, peg and T-catch
rig_w  = 42;            // hinge axis -> free edge of the test door
rig_y  = [9, 61];       // test door bottom / top
rig_hz = [12, 58];      // hinge knuckle stack
rig_n  = 5;
rig_py = 36;            // lever pivot height
rig_px = rig_w - fl_px_in;
rig_us = rig_w + latch_gap;   // latch stile edge (u) of the frame
module rig_frame() {
    sw = dk_door / 2 + swing_gap + 0.5;       // hinge-side stile edge: clear of the door knuckles
    intersection() {
        union() {
            linear_extrude(wall_t) difference() {
                translate([-18, 0]) square([rig_us + 16 + 18, 70]);
                translate([-sw, rig_y[0] - 1]) square([rig_us + sw, rig_y[1] - rig_y[0] + 2]);
            }
            // fixed knuckles of the test hinge (flat, like a window frame), pin dropped in from the top
            knuckles_fixed_y(rig_hz[0], rig_hz[1], rig_n, dk_door, -1, sw, 0, bore_free, bore_free);
            // stop bevel along the latch stile edge (as on the stall front)
            translate([rig_us, rig_y[0] - 1, 0]) rotate([-90, 0, 0]) linear_extrude(rig_y[1] - rig_y[0] + 2)
                mirror([0, 1]) polygon([[0.3, 0], [-stop_bevel, 0], [0.3, stop_bevel + 0.3]]);
            fl_catch(rig_us + fl_c_in, rig_py + fl_cs_y, wall_t);
        }
        translate([-50, -1, 0]) cube([300, 300, 100]);
    }
    translate([rig_us + 8, 64.5, 0]) engrave_top("T4", wall_t, 4, 0.5);
}
module rig_door() {
    t = sd_t;
    difference() {
        union() {
            translate([dk_door / 2 + swing_gap, rig_y[0], 0]) cube([rig_w - dk_door / 2 - swing_gap, rig_y[1] - rig_y[0], t]);
            // raised frame like the stall door trims (the lever must clear them)
            translate([0, 0, t - 0.1]) linear_extrude(trim_h + 0.1) difference() {
                translate([dk_door / 2 + swing_gap, rig_y[0]]) square([rig_w - dk_door / 2 - swing_gap, rig_y[1] - rig_y[0]]);
                translate([10, rig_y[0] + 6]) square([rig_w - 18, rig_y[1] - rig_y[0] - 12]);
            }
            knuckles_moving_y(rig_hz[0], rig_hz[1], rig_n, dk_door, 1, dk_door / 2 + swing_gap);
            fl_door_hardware(rig_px, rig_py, t);
        }
        // free-edge chamfer on the stall side (bears on the stop bevel)
        translate([rig_w, rig_y[0] - 1, 0]) rotate([-90, 0, 0]) linear_extrude(rig_y[1] - rig_y[0] + 2)
            mirror([0, 1]) polygon([[0.5, -0.5], [-(stop_bevel - latch_gap + 0.4) - 0.5, -0.5], [0.5, stop_bevel - latch_gap + 0.4 + 0.5]]);
        translate([18, rig_y[0] + 3, 0]) engrave_top("T4", t + trim_h, 3.5, 0.5);
    }
}
// main door slide bolt test: both bolt loops at their real spacing on a
// piece of door leaf; the bolt bar itself is the production part
module bolt_test_plate() {
    L = 64;
    translate([0, -(md_bar_z - 13), 0]) union() {
        translate([0, md_bar_z - 13, 0]) difference() {
            cube([L, 26, md_t]);
            translate([L - 8, 4, 0]) engrave_top("T4", md_t, 3.5, 0.5);
        }
        bolt_loop(16, loop_L[1]);
        bolt_loop(16 + (loop_R[0] - loop_L[0]), loop_R[1]);
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

module plate_T3a() {
    for (i = [0 : 4]) translate([48 + i * 40, 128, 0]) hinge_post(bores_post_t3[i]);
}
module plate_T3b() {
    for (i = [0 : 1]) translate([8 + i * 52, 8, 0]) hinge_leaf(bore_free);
    translate([118, 8, 0]) window_section();
    translate([40, 112, 0]) rotate([0, 0, 90]) casement_print(false);
    translate([118, 108, 0]) test_stand(100);
    for (i = [0 : 2]) translate([8 + i * 22, 190, 0]) win_pin_coupon(bores_win_t3[i]);
}
module plate_T4() {
    translate([26, 8, 0]) rig_frame();
    translate([116, 8, 0]) rig_door();
    translate([182, 20, 0]) fl_lever_print();
    translate([20, 92, 0]) test_stand(100);
    translate([20, 124, 0]) bolt_test_plate();
    translate([100, 128, 0]) bolt_bar_print();
}

if (part == "plate_T1") plate_T1();
if (part == "plate_T2") plate_T2();
if (part == "plate_T3a") plate_T3a();
if (part == "plate_T3b") plate_T3b();
if (part == "plate_T4") plate_T4();
if (part == "window_section") window_section();
if (part == "rig_frame") rig_frame();
if (part == "rig_door") rig_door();
if (part == "fl_lever") fl_lever_print();
if (part == "bolt_test_plate") bolt_test_plate();
// coupon_bore > 0 overrides the bore of single coupons (export of the T3 variants)
if (part == "hinge_post") hinge_post(coupon_bore > 0 ? coupon_bore : bore_post);
if (part == "hinge_leaf") hinge_leaf(coupon_bore > 0 ? coupon_bore : bore_free);
if (part == "win_pin_coupon") win_pin_coupon(coupon_bore > 0 ? coupon_bore : bore_win_hold);
if (part == "test_stand") test_stand(100);
if (part == "latch_stile") latch_stile();
if (part == "latch_door") latch_door();
if (part == "groove_post") groove_post();
if (part == "panel_strip") panel_strip();
if (part == "socket_plate") socket_plate();
if (part == "tile_a") tile_a();
if (part == "tile_b") tile_b();
if (part == "tab_plate") tab_plate();
if (part == "tab_key") tab_key();
