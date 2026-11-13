// ROOF -- dark grey / black. Three lift-off units.
//
// Central roof: ONE "tent" over the whole aisle, printed in its INSTALLED
// orientation standing on its eave edges: 45 deg slopes and 45 deg shingle
// butts need no support. A truss in the middle rests on the bevelled tops of
// the mid aisle posts; notches in it straddle those posts and LOCATE the
// roof. Tabs on the stall-front beams enter pockets in the slopes.
//
// Side roofs: one lean-to panel per side, printed flat (shingles up),
// located by shallow tabs on the gable-wing and partition rakes. Two lock
// fins near the upper edge sit 1 mm under the central roof: while the
// central roof is on, a side roof can neither lift off its tabs nor slide
// out. Lift the central roof first; then the side roofs lift straight off.

c_t     = roof_t + tile_step;            // max slab thickness
c_row   = 9;
cy0     = Y0 - wall_t / 2 - overhang_gable;   // front edge
cy1     = Y2 + wall_t / 2 + overhang_gable;   // back edge
c_xe    = X1 - PW2 - overhang_c;               // eave point of the underside (left)
c_len   = (XC - c_xe) / cos(pitch_c) + 8;      // slab length along the slope
frame_t = 2.4;                                 // end-frame thickness
ridge_d = 7;                                   // ridge roll

// one slope (left), world coordinates, unclipped
module c_slope_raw() {
    translate([c_xe, cy0, Z_c_low]) rotate([0, -pitch_c, 0]) translate([-10, 0, 0])
        difference() {
            shingle_slab(c_len + 10, cy1 - cy0, roof_t, tile_step, c_row);
            shingle_joints(c_len + 10, cy1 - cy0, c_row);
        }
}
// skylight on the left slope: opening + raised frame (local slope frame)
sky_w = 26; sky_h = 32; sky_s = 0.45 * c_len;  // size, position along slope
// one skylight per slope over each half of the aisle
module c_skylight(cut = true) {
    for (yc = [(cy0 + Y1) / 2, (Y1 + cy1) / 2])
    translate([c_xe, yc, Z_c_low]) rotate([0, -pitch_c, 0])
        translate([sky_s, 0, 0])
            if (cut) difference() {
                translate([-sky_h / 2, -sky_w / 2, -5]) cube([sky_h, sky_w, 20]);
                translate([-1.1, -sky_w / 2 - 1, -6]) cube([2.2, sky_w + 2, 22]);   // glazing bar
            }
            else translate([-sky_h / 2 - 4, -sky_w / 2 - 4, 0])
                difference() { cube([sky_h + 8, sky_w + 8, c_t + 1.6]); translate([4, 4, -1]) cube([sky_h, sky_w, 10]); }
}
// region under the roof (2D in x,z) for the end frame
module c_under2d(grow = 0) {
    // grow > 0 lifts the sloped edges into the slab so unions fuse
    polygon([[c_xe - grow, Z_c_low], [2 * XC - c_xe + grow, Z_c_low], [XC, Z_c_apex + grow * 1.414]]);
}
// truss in the middle (over the mid posts at Y1)
module c_end_frame() {
    translate([0, Y1 + frame_t / 2, 0]) rotate([90, 0, 0]) linear_extrude(frame_t) difference() {
        c_under2d(0.8);
        // notches around the mid posts (bearing on their bevelled tops)
        // 0.20 mm each side (own value: no longer tied to the floor-socket fit, which T2 set to 0.15)
        for (x = [X1, X2]) translate([x - PW2 - 0.2, Z_c_low - 1]) square([post_w + 2 * 0.2, 40]);
        // truss openings between the posts, split by a king post
        intersection() {
            offset(delta = -9) intersection() {
                c_under2d();
                translate([X1 + PW2, Z_c_low]) square([bay_x_aisle - post_w, 200]);
            }
            union() {
                translate([0, 0]) square([XC - 5, 400]);
                translate([XC + 5, 0]) square([400, 400]);
            }
        }
    }
}
// barge boards under the front and back edges, notched around the tops of
// the gable-door posts (the short gable overhang puts them above the posts)
module c_barge() {
    for (y = [cy0 + 2.4, cy1]) translate([0, y, 0]) rotate([90, 0, 0]) linear_extrude(2.4) difference() {
        intersection() {
            difference() { c_under2d(0.8); translate([0, -8]) c_under2d(); }   // 8 mm deep band along the slopes
            translate([0, Z_c_low + eps]) square([1000, 300]);
        }
        for (x = [X1, X2]) translate([x - PW2 - 0.5, Z_c_low - 1]) square([post_w + 1, 300]);
    }
}
// pockets for the stall-front beam tabs
module c_tab_pockets() {
    for (x = [X1, X2]) for (u = concat(sf_tabs, [for (t = sf_tabs) t + bay_y]))
        translate([x - wall_t / 2 - fit_tab, u - tab_w / 2 - fit_tab, sf_vtop - 1])
            cube([wall_t + 2 * fit_tab, tab_w + 2 * fit_tab, tab_h_c + 1.3]);
}

module c_tent_world() {          // world coordinates
    difference() {
        union() {
            for (m = [0, 1]) intersection() {
                translate([m == 0 ? 0 : 2 * XC, 0, 0]) mirror([m, 0, 0]) difference() {
                    union() { c_slope_raw(); c_skylight(false); }
                    c_skylight(true);
                }
                translate(m == 0 ? [-500, -500, Z_c_low] : [XC, -500, Z_c_low]) cube([500 + (m == 0 ? XC : 0), 1000, 500]);
            }
            // ridge roll
            translate([XC, cy0, Z_c_apex + c_t / cos(pitch_c) - 1.2]) rotate([-90, 0, 0]) cylinder(d = ridge_d, h = cy1 - cy0, $fn = 40);
            c_end_frame();
            c_barge();
        }
        c_tab_pockets();
        // rounded eave corners (plan view), front and back
        for (my = [0, 1]) translate([0, my == 0 ? 0 : cy0 + cy1, 0]) mirror([0, my, 0])
        for (m = [0, 1]) translate([m == 0 ? 0 : 2 * XC, 0, 0]) mirror([m, 0, 0])
            // outermost eave edge is c_t*sqrt(2) beyond the underside eave point
            translate([c_xe - c_t * 1.4143, cy0, Z_c_low - 1]) linear_extrude(40) fillet_cutter2d(4);
        // keep the bed face flat
        translate([-500, -500, Z_c_low - 100]) cube([2000, 2000, 100]);
    }
}
module c_tent_print() { translate([-XC, -cy0, -Z_c_low]) c_tent_world(); }

// ---------------------------------------------------------- side roof
s_xe   = X0 - wall_t / 2 - overhang_eave;          // eave edge (world X)
s_x1   = X1 - PW2 - 0.5;                           // upper edge, just clear of posts
s_len  = (s_x1 - s_xe) / cos(pitch_side);
s_y0   = Y0 - wall_t / 2 - overhang_gable;
s_y1   = Y2 + wall_t / 2 + overhang_gable;
// lock fins: blades under the central eave, lock_gap below its underside.
// Reinforced 13 Nov 2026 (user: "they break off quickly"): 4 mm instead of
// 2.4 mm thick, flared feet on both sides, 36 mm long with 45 deg ends. The
// outer face (the one that locks) stays where it was.
lock_gap = 1.0;
lock_x   = c_xe + 3;                 // centre of the OLD 2.4 mm blade (outer face = lock_x - 1.2)
lock_t   = 4.0;                      // blade thickness, grows inward from the outer face
lock_len = 36;                       // length at the foot (ends chamfered 45 deg)
lock_foot_out = 4.0;                 // outer foot: reach along the roof, flares from 3 mm below the top
lock_foot_in  = [1.2, 3.0];          // inner foot: reach, height (steep: the side roof prints 20 deg tilted,
                                     // this face then leans about 42 deg -> no support)
lock_y   = [(Y0 + Y1) / 2, (Y1 + Y2) / 2];   // middle of each stall
s_row  = 9;
// placement of the front-left panel: local x up the slope, y = world Y, z normal
module s_place() { translate([s_xe, s_y0, z_side_roof(s_xe)]) rotate([0, -pitch_side, 0]) children(); }
module s_unplace() { rotate([0, pitch_side, 0]) translate([-s_xe, -s_y0, -z_side_roof(s_xe)]) children(); }
// world pockets for the rake tabs (gable wings at Y0 and Y2, partition at Y1)
module s_tab_pockets_world() {
    slope = tan(pitch_side);
    for (yt = [Y0, Y1, Y2]) for (xt = rake_tabs)
        translate([xt, yt, z_side_roof(xt)]) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [slope, 0, 1, 0], [0, 0, 0, 1]])
            translate([-tab_w / 2 - fit_tab, -wall_t / 2 - fit_tab, -2]) cube([tab_w + 2 * fit_tab, wall_t + 2 * fit_tab, 2 + tab_h_side + 0.3]);
}
// lock fins in world coordinates: vertical blades standing in the side
// roof, top edge parallel to the central roof's underside
module s_lock_fins_world() {
    xa = lock_x - 1.2;                       // outer (locking) face, unchanged
    xb = xa + lock_t;                        // inner face
    xo = xa - lock_foot_out;                 // outer foot end
    xi = xb + lock_foot_in[0];               // inner foot end
    zb = function(x) z_side_roof(x) + 1.0;   // foot line, 1 mm inside the roof slab
    zt = function(x) z_c_roof(x) - lock_gap; // top line, parallel to the central roof
    h  = zt(xb) - zb(xb);
    for (yc = lock_y) intersection() {
        translate([0, yc + lock_len / 2, 0]) rotate([90, 0, 0]) linear_extrude(lock_len)
            polygon([[xo, zb(xo)], [xi, zb(xi)], [xb, zb(xb) + lock_foot_in[1]], [xb, zt(xb)],
                     [xa, zt(xa)], [xa, zt(xa) - 3]]);
        // 45 deg ends: full length at the foot, shorter at the top
        translate([xo - 1, 0, 0]) rotate([90, 0, 90]) linear_extrude(xi - xo + 2)
            polygon([[yc - lock_len / 2, zb(xo) - 2], [yc + lock_len / 2, zb(xo) - 2],
                     [yc + lock_len / 2, zb(xb) + 2], [yc + lock_len / 2 - (h - 1), zb(xb) + h + 1],
                     [yc - lock_len / 2 + (h - 1), zb(xb) + h + 1], [yc - lock_len / 2, zb(xb) + 2]]);
    }
}
module side_roof_local() {
    difference() {
        union() {
            // shingle joints only in the slab: they must not notch the lock-fin feet
            difference() {
                intersection() {
                    shingle_slab(s_len, s_y1 - s_y0, roof_t, tile_step, s_row);
                    // round the exposed eave corners, front and back (child safety)
                    translate([0, 0, -1]) linear_extrude(10) union() {
                        rrect(s_len, s_y1 - s_y0, 4);
                        translate([s_len / 2, 0]) square([s_len / 2, s_y1 - s_y0]);
                    }
                }
                shingle_joints(s_len, s_y1 - s_y0, s_row);
            }
            s_unplace() s_lock_fins_world();
        }
        s_unplace() s_tab_pockets_world();
        // drip edge: soften the eave
        translate([-1, -1, -1]) rotate([0, 45, 0]) cube([1.6, 400, 1.6]);
    }
}
module side_roof_world() { s_place() side_roof_local(); }
