// DOORS -- black. All printed FLAT, show face up, hinge axis along local Y.
// Every door is modelled with its hinge AXIS at the local origin (x = 0,
// z = kz(dk)) and its body toward +x ("A" = left-hand) or -x ("B" =
// mirrored, right-hand). *_print() modules move them onto the bed.

// ================================================================ main door
md_y0 = floor_top + 2.5;                           // leaf bottom
md_w  = XC - 0.75 - md_ax[0];                      // axis -> free edge
md_R  = arch_R(bay_x_aisle - post_w, door_crown_z - door_spring_z);
function arch_y(X) = door_crown_z - md_R + sqrt(max(0, md_R * md_R - (X - XC) * (X - XC)));
function md_top(x) = arch_y(md_ax[0] + x) + 4;     // leaf overlaps the pediment by 4
md_bar_z = 92;                                     // slide-bolt height (world Z)
bolt_s = 6;                                        // bolt bar section
// slide bolt (world X, locked): one loop on the left leaf, one long loop on
// the right leaf; the knob stops the bar at the right loop. Unlocking slides
// the bar right by bolt_travel so it clears the left leaf; the knob then
// still stays clear of the hinge knuckles.
loop_L = [XC - 6, 10];                             // [centre, length]
loop_R = [XC + 11, 18];
bolt_x0 = XC - 11.5;                               // bar left end, locked
bolt_x1 = loop_R[0] + loop_R[1] / 2 + 0.5;         // bar right end = knob face
bolt_knob = 5;
bolt_travel = 13;

module md_outline2d(inset = 0) { offset(r = 1.2) offset(delta = -1.2) md_outline2d_raw(inset); }
module md_outline2d_raw(inset = 0) {
    n = 16;
    pts = concat([[dk_door / 2 + swing_gap + inset, md_y0 + inset], [md_w - inset, md_y0 + inset]],
                 [for (i = [0 : n]) let(x = md_w - inset - i * (md_w - dk_door / 2 - swing_gap - 2 * inset) / n)
                     [x, md_top(x) - inset]]);
    polygon(pts);
}
module md_window2d() {
    x0 = 0.2 * md_w; x1 = md_w - 7; y0 = md_bar_z + 8;
    difference() {
        intersection() {
            md_outline2d(10);
            translate([x0, y0]) square([x1 - x0, 200]);
        }
        translate([(x0 + x1) / 2 - 1.2, 0]) square([2.4, 300]);         // muntins
        translate([0, (y0 + md_top((x0 + x1) / 2) - 10) / 2 - 1.2]) square([200, 2.4]);
    }
}
module md_trims2d() {
    difference() {
        union() {
            difference() { md_outline2d(); md_outline2d(7); }          // frame
            translate([5, 24]) square([md_w - 5, 8]);                  // Z-brace rails
            translate([5, 86]) square([md_w - 5, 8]);
            hull() { translate([10, 32]) square([7, 1]); translate([md_w - 15, 85]) square([7, 1]); }
            // strap hinges at the moving knuckles
            for (i = [1 : 2 : md_n - 1]) let(s = kn_seg(md_z[0], md_z[1], md_n, i))
                hull() { translate([3, (s[0] + s[1]) / 2 - 4]) square([2, 8]); translate([0.62 * md_w, (s[0] + s[1]) / 2 - 1.5]) circle(d = 3, $fn = 16); }
        }
        md_window2d();
    }
}
// slide-bolt loop (tunnel along x) on the exterior face, centred at x
// tunnel floor sits trim_h + 0.6 above the leaf face so the bar clears the trims
module bolt_loop(x, len) {
    h = bolt_s + 0.6; f = trim_h + 0.6;
    translate([x - len / 2, md_bar_z - h / 2 - 2.5, md_t - 0.3]) difference() {
        cube([len, h + 5, f + h + 2]);
        translate([-1, 2.5, f]) cube([len + 2, h, h]);
    }
}
module main_leaf_axis(right = false) {
    lp = right ? loop_R : loop_L;
    module body() {
        board_panel(0, md_w + 1, md_y0, 200, md_t, xc = md_w / 2) {
            md_outline2d();
            md_window2d();
            md_trims2d();
            knuckles_moving_y(md_z[0], md_z[1], md_n, dk_door, 1, dk_door / 2 + swing_gap);
            union() {}
        }
    }
    if (right) mirror([1, 0, 0]) union() { body(); bolt_loop((2 * XC - md_ax[0]) - lp[0], lp[1]); }
    else union() { body(); bolt_loop(lp[0] - md_ax[0], lp[1]); }
}
// world placement (closed = 0 deg, opening outward = positive angle)
module main_leaf_world(right = false, ang = 0) {
    ax = right ? 2 * XC - md_ax[0] : md_ax[0];
    translate([ax, md_ax[1], 0]) rotate([0, 0, right ? ang : -ang]) translate([0, kz(dk_door), 0])
        rotate([90, 0, 0]) main_leaf_axis(right);
}
module main_leaf_print(right = false) { translate([right ? md_w : 0, 0, 0]) main_leaf_axis(right); }

// slide-bolt bar (loose part, about 37 mm -- keep away from small children)
module bolt_bar_print() {
    c = 0.8;
    translate([0, 0, 0]) linear_extrude(bolt_s) crect(bolt_x1 - bolt_x0, bolt_s, c);
    translate([bolt_x1 - bolt_x0 - 0.5, -2, 0]) linear_extrude(bolt_s + 4) crect(bolt_knob + 0.5, bolt_s + 4, 1.2);
}
// ang > 0: bolt unlocked (slid right) and riding on the opened right leaf
module bolt_bar_world(ang = 0) {
    ax = [2 * XC - md_ax[0], md_ax[1]];
    translate([ax[0], ax[1], 0]) rotate([0, 0, ang]) translate([-ax[0], -ax[1], 0])
    // centred in the loop tunnels: 0.3 mm clearance each side
    translate([bolt_x0 + (ang > 0 ? bolt_travel : 0), Y0 - md_face_off - trim_h - 0.6 - bolt_s, md_bar_z - bolt_s / 2])
        rotate([90, 0, 0]) translate([0, 0, -bolt_s]) bolt_bar_print();
}

// =============================================================== stall door
sd_w  = (sf_ud - latch_gap) - sd_ax[1];            // axis -> free edge
sd_y0 = sill_top + 1;
sd_y1 = stall_door_top - 1;
module sd_outline2d() { offset(r = 1.2) offset(delta = -1.2) sd_outline2d_raw(); }
module sd_outline2d_raw() {
    xm = (dk_door / 2 + swing_gap + sd_w) / 2;
    difference() {
        translate([dk_door / 2 + swing_gap, sd_y0]) square([sd_w - dk_door / 2 - swing_gap, sd_y1 - sd_y0]);
        translate([xm, sd_y1 - yoke_d + yoke_w / 2]) union() { circle(d = yoke_w, $fn = 64); translate([-yoke_w / 2, 0]) square([yoke_w, 50]); }
    }
}
module sd_openings2d() {
    xm = (dk_door / 2 + swing_gap + sd_w) / 2;
    difference() {
        intersection() {
            translate([11, 80]) square([sd_w - 19, sd_y1 - 7 - 80]);
            for (x = [11 : 10.5 : sd_w - 8]) translate([x + 3, 0]) square([7.5, 300]);
        }
        translate([xm, sd_y1 - yoke_d + yoke_w / 2]) union() { circle(d = yoke_w + 10, $fn = 64); translate([-yoke_w / 2 - 5, 0]) square([yoke_w + 10, 50]); }
    }
}
module sd_trims2d() {
    difference() {
        sd_outline2d();
        sd_openings2d();
        translate([11, sd_y0 + 6]) square([sd_w - 19, 76 - sd_y0 - 6]);   // boards stay white
        translate([sd_w - latch_w - latch_slot - 1, latch_y0 - 1]) square([10, latch_len + 3]);
    }
}
module stall_door_axis(right = false) {
    module d() {
        board_panel(0, sd_w + 1, sd_y0, sd_y1, sd_t, xc = sd_w / 2) {
            sd_outline2d();
            union() { sd_openings2d(); latch_tongue_cut2d(sd_w, latch_y0); }
            sd_trims2d();
            union() {
                knuckles_moving_y(sd_z[0], sd_z[1], sd_n, dk_door, 1, dk_door / 2 + swing_gap);
                latch_barb(sd_w, latch_y0, sd_t);
            }
            // 4: free-edge chamfer on the stall side (bears on the stop bevel)
            for (r = [[sd_y0 - 1, latch_y0 - 1], [latch_y0 + latch_len + 2, sd_y1 + 1]])
                translate([sd_w, r[0], 0]) rotate([-90, 0, 0]) linear_extrude(r[1] - r[0])
                    mirror([0, 1]) polygon([[0.5, -0.5], [-(stop_bevel - latch_gap + 0.4) - 0.5, -0.5], [0.5, stop_bevel - latch_gap + 0.4 + 0.5]]);
        }
    }
    if (right) mirror([1, 0, 0]) d(); else d();
}
// world placement of the front-left stall door; ang > 0 opens into the aisle
module stall_door_world(ang = 0) {
    translate([sd_ax[0], sd_ax[1], 0]) rotate([0, 0, -ang])
        multmatrix([[0, 0, 1, -kz(dk_door)], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) stall_door_axis();
}
module stall_door_print(right = false) { translate([right ? sd_w + 1 : 0, 0, 0]) stall_door_axis(right); }

// ================================================================ casement
cs_t = 2.4;
cs_seg = [win_sill_z + 4, win_sill_z + win_h - win_w / 2 - 2];   // = gable wing hinge
module cs_outline2d() {          // in local x (axis at 0), y = world Z
    translate([-gw_hinge_x, 0]) intersection() {
        offset(delta = 2.5) win_open2d(gw_win_xc, win_sill_z, win_w, win_h);
        translate([gw_hinge_x + dk_win / 2 + swing_gap, 0]) square([200, 300]);
    }
}
module casement_axis(right = false) {
    module c() {
        difference() {
            union() {
                linear_extrude(cs_t) cs_outline2d();
                knuckles_moving_y(cs_seg[0], cs_seg[1], 3, dk_win, 1, dk_win / 2 + swing_gap);
            }
            // four panes
            translate([0, 0, -1]) linear_extrude(cs_t + 2) difference() {
                offset(delta = -4) cs_outline2d();
                translate([-gw_hinge_x + gw_win_xc - 1.1, 0]) square([2.2, 300]);
                translate([0, win_sill_z + win_h / 2 - 1.1]) square([300, 2.2]);
            }
        }
    }
    if (right) mirror([1, 0, 0]) c(); else c();
}
module casement_world(ang = 0) {          // front-left wing window
    translate([gw_hinge_x, Y0 - wall_t / 2 - cs_lift - kz(dk_win), 0]) rotate([0, 0, -ang])
        translate([0, kz(dk_win), 0]) rotate([90, 0, 0]) casement_axis();
}
module casement_print(right = false) { translate([right ? 60 : 0, 0, 0]) casement_axis(right); }
