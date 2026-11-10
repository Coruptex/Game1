// DROP LATCH ("Fallriegel") for the stall doors. Used by the production
// stall doors and stall fronts since 10 Nov 2026 (user's choice, the T4 test
// is still open) and by the T4 test rig.
//
// A lever hangs on a peg on the aisle face of the door, near the free edge.
// Its tip has a notch that drops over a T-shaped catch on the latch stile of
// the stall front. Gravity holds the lever down; the door is locked
// positively (nothing has to flex). Closing the door pushes the lever up on
// the ramp of the catch, and the lever drops back behind the T-head. To open,
// lift the lever tip by about 4 mm and pull the door.
//
// No support needed anywhere:
//  * the peg and the T-catch grow upward from the flat-printed panels, their
//    overhangs are 45 deg chamfers;
//  * the lever is printed flat, back face down.
// The lever is captive: its hub has a keyway that lines up with the one-sided
// key on the peg only when the lever points straight up (assembly position).
//
// Frames
//  door   (stall door / test door): x = width from the hinge axis, y = height,
//         z = thickness, z = 0 stall side (bed), z = t aisle side.
//  front  (stall front / test frame): x = u along the panel, y = height,
//         z = 0 stall side (bed), z = t aisle side.
//  lever  (own frame): pivot at the origin, arm along +x, y up, z = 0 back face.

fl_lift   = trim_h + 0.4;   // lever back face above the door face (clears the trims)
fl_t      = 3.0;            // lever thickness
fl_h      = 6.0;            // arm height
fl_hub_d  = 11;             // hub diameter
fl_peg_d  = 4.0;            // pivot peg
fl_hole_d = 4.8;            // hub bore: vertical hole in a flat print, prints ~0.3 under size
fl_boss_d = 9;              // boss under the lever (lifts it above the door trims)
fl_ax     = 0.6;            // axial play of the lever on its peg
fl_stop_out = 2.2;          // rest stop: reach beyond the lever front face (+ fl_ax)
fl_key_r  = 3.6;            // reach of the one-sided key on the peg (radius)
fl_key_w  = 3.0;            // key width
fl_px_in  = 13;             // pivot: distance from the door's free edge
fl_c_in   = 4.0;            // catch shaft: distance beyond the stile edge (stile is 8 mm wide)
fl_cs_d   = 3.5;            // catch shaft diameter
fl_notch_w = fl_cs_d + 2.5; // notch in the lever tip (1.25 mm play each side: the stall front floats in its grooves)
fl_finger = 3.0;            // finger width each side of the notch
fl_lobe   = 5.0;            // T-head half length along the panel
fl_head_ax = 0.8;           // lever front face -> start of the T-head underside
fl_head_h = 4.0;            // T-head height (along z)
fl_lift_open = 4.2;         // lift at the notch needed to clear the T-head (opening)
// heights relative to the pivot (y): notch roof 0.4 above the shaft
fl_notch_top = 1.0;
fl_cs_y   = fl_notch_top - 0.4 - fl_cs_d / 2;   // shaft centre relative to the pivot

// extrude a polygon given in the (y, z) plane along x from x0 to x1
module prism_x(x0, x1, pts) { translate([x0, 0, 0]) rotate([90, 0, 90]) linear_extrude(x1 - x0) polygon(pts); }

// lever length pivot -> shaft centre, for a door whose free edge is x_edge
function fl_L(gap = latch_gap) = fl_px_in + gap + fl_c_in;

// ------------------------------------------------------------------ lever
module fl_lever2d(gap = latch_gap) {
    L = fl_L(gap);
    tip0 = L - fl_notch_w / 2 - fl_finger;
    tip1 = L + fl_notch_w / 2 + fl_finger;
    difference() {
        union() {
            circle(d = fl_hub_d, $fn = 64);
            translate([0, -fl_h / 2]) square([tip1, fl_h]);
            // grip beyond the far finger
            hull() { translate([tip1 - 1, -fl_h / 2]) square([1, fl_h]); translate([tip1 + 3.5, 0.5]) circle(d = 5, $fn = 32); }
        }
        // notch, open downward, roof 0.4 above the catch shaft
        translate([L - fl_notch_w / 2, -fl_h]) square([fl_notch_w, fl_h + fl_notch_top]);
        // bore with a one-sided keyway pointing along the arm (+x)
        circle(d = fl_hole_d, $fn = 48);
        translate([0, -(fl_key_w + 0.8) / 2]) square([fl_key_r + 0.5, fl_key_w + 0.8]);
    }
}
module fl_lever(gap = latch_gap) {
    L = fl_L(gap);
    difference() {
        union() {
            linear_extrude(fl_t) fl_lever2d(gap);
            // raised grip
            translate([L + fl_notch_w / 2 + fl_finger + 3.5, 0.5, 0]) cylinder(d = 5, h = fl_t + 1.2, $fn = 32);
        }
        // 45 deg chamfer (1.4 mm) on the back-bottom edge of the fingers: helps
        // the lever ride up the ramp of the T-head when the door closes
        prism_x(L - fl_notch_w / 2 - fl_finger - 1, L + fl_notch_w / 2 + fl_finger + 1,
                [[-fl_h / 2 - 1, -1], [-fl_h / 2 + 1.4, -1], [-fl_h / 2 + 1.4, 0], [-fl_h / 2, 1.4], [-fl_h / 2 - 1, 1.4]]);
    }
}
module fl_lever_print(gap = latch_gap) { fl_lever(gap); }

// ------------------------------------------------- door side: boss, peg, key, stop
// placed at the pivot (px, py) on a door of thickness t (aisle face z = t)
module fl_door_hardware(px, py, t) {
    zb = t + fl_lift;                       // boss top = lever back face
    zk = zb + fl_t + fl_ax;                 // key underside starts here
    translate([px, py, 0]) {
        translate([0, 0, t - 0.7]) cylinder(d = fl_boss_d, h = fl_lift + 0.7, $fn = 48);   // from below the board grooves
        translate([0, 0, zb - 0.01]) cylinder(d = fl_peg_d, h = fl_t + fl_ax + 2.4, $fn = 32);
        // one-sided key pointing up (+y): 45 deg underside, 0.8 mm flat top
        hull() {
            translate([0, 0, zk]) linear_extrude(0.01) intersection() { circle(d = fl_peg_d, $fn = 32); translate([-fl_key_w / 2, 0]) square([fl_key_w, 5]); }
            translate([0, 0, zk + fl_key_r - fl_peg_d / 2]) linear_extrude(0.8)
                intersection() { circle(r = fl_key_r, $fn = 48); translate([-fl_key_w / 2, -fl_peg_d / 2 + 0.3]) square([fl_key_w, fl_key_r + 2]); }
        }
        // rest stop under the arm: holds the lever level when the door is open.
        // It reaches fl_stop_out beyond the lever's front face (incl. the axial
        // play), so a lever that tilts on its peg cannot slip past it (T4, user, Nov 2026)
        translate([5.5, -fl_h / 2 - 4, t - 0.7]) cube([5, 4, fl_lift + fl_t + fl_ax + fl_stop_out + 0.7]);
    }
}

// lever placed on the door at lift angle beta (deg), for checks and renders
module fl_lever_on_door(px, py, t, beta = 0, gap = latch_gap) {
    translate([px, py, t + fl_lift]) rotate([0, 0, beta]) fl_lever(gap);
}

// ------------------------------------------------- stall front side: T-catch
// shaft centre at (u, y) on a panel of thickness t (aisle face z = t);
// zl = height of the lever's front face above the bed when the door is shut
module fl_catch(u, y, t) {
    z0 = t + fl_lift + fl_t + fl_head_ax;       // T-head underside starts here
    zt = z0 + fl_head_h;                        // top of the T-head
    r  = fl_cs_d / 2;
    translate([u, y, 0]) {
        translate([0, 0, t - 0.7]) cylinder(d = fl_cs_d, h = z0 - t + 0.71, $fn = 32);
        // T-head: bar along u, as high as the shaft (nothing above the shaft
        // that could cam the lever up), underside chamfered 45 deg from the
        // shaft out to the lobe ends; the upper front edge is a 45 deg ramp
        intersection() {
            hull() {
                translate([0, 0, z0]) cylinder(d = fl_cs_d, h = 0.01, $fn = 32);
                translate([-fl_lobe, -r, z0 + fl_lobe - r]) cube([2 * fl_lobe, fl_cs_d, zt - (z0 + fl_lobe - r)]);
                translate([-r, -r, z0]) cube([fl_cs_d, fl_cs_d, zt - z0]);
            }
            // ramp: z <= zt - r - y, i.e. 45 deg from the lower front edge
            // (full height) down to the upper edge (zt - 2r)
            prism_x(-10, 10, [[-10, -10], [10, -10], [10, zt - r - 10], [-10, zt - r + 10]]);
        }
    }
}
