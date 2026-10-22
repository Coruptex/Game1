// ROOF -- dark grey / black.
//
// Central roof: two "tent" units (front + back, identical). Each is printed
// in its INSTALLED orientation standing on its eave edges: 45 deg slopes and
// 45 deg shingle butts need no support. Its rear end frame is a truss that
// rests on the bevelled tops of the mid aisle posts; notches in it straddle
// those posts and LOCATE the roof. Tabs on the stall-front beams enter
// pockets in the slopes.
//
// Side roofs: four lean-to panels printed flat (shingles up). Located by
// shallow tabs on the gable-wing and partition rakes.

c_t     = roof_t + tile_step;            // max slab thickness
c_row   = 9;
cy0     = Y0 - wall_t / 2 - overhang_gable;   // front edge of the front tent
cy1     = Y1;                                  // rear end (meets the other tent)
c_xe    = X1 - PW2 - overhang_c;               // eave point of the underside (left)
c_len   = (XC - c_xe) / cos(pitch_c) + 8;      // slab length along the slope
frame_t = 2.4;                                 // end-frame thickness

// one slope (left), world coordinates, unclipped
module c_slope_raw() {
    translate([c_xe, cy0, Z_c_low]) rotate([0, -pitch_c, 0]) translate([-10, 0, 0])
        difference() {
            shingle_slab(c_len + 10, cy1 - cy0, roof_t, tile_step, c_row);
            shingle_joints(c_len + 10, cy1 - cy0, c_row);
        }
}
// skylight on the left slope: opening + raised frame (local slope frame)
sky_w = 30; sky_h = 40; sky_s = 64;            // size, position along slope
module c_skylight(cut = true) {
    translate([c_xe, (cy0 + cy1) / 2, Z_c_low]) rotate([0, -pitch_c, 0])
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
module c_end_frame() {
    translate([0, cy1, 0]) rotate([90, 0, 0]) linear_extrude(frame_t) difference() {
        c_under2d(0.8);
        // notches around the mid posts (bearing on their bevelled tops)
        for (x = [X1, X2]) translate([x - PW2 - fit_socket, Z_c_low - 1]) square([post_w + 2 * fit_socket, 40]);
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
// barge board under the front edge
module c_barge() {
    translate([0, cy0 + 2.4, 0]) rotate([90, 0, 0]) linear_extrude(2.4) intersection() {
        difference() { c_under2d(0.8); translate([0, -8]) c_under2d(); }   // 8 mm deep band along the slopes
        translate([0, Z_c_low + eps]) square([1000, 300]);
    }
}
// pockets for the stall-front beam tabs
module c_tab_pockets() {
    for (x = [X1, X2]) for (u = [45, sf_u1 - 40])
        translate([x - wall_t / 2 - fit_tab, u - tab_w / 2 - fit_tab, sf_vtop - 1])
            cube([wall_t + 2 * fit_tab, tab_w + 2 * fit_tab, tab_h_c + 1.3]);
}

module c_tent_world() {          // front tent, world coordinates
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
            translate([XC, cy0, Z_c_apex + c_t / cos(pitch_c) - 1.2]) rotate([-90, 0, 0]) cylinder(d = 8, h = cy1 - cy0, $fn = 40);
            c_end_frame();
            c_barge();
        }
        c_tab_pockets();
        // rounded front eave corners (plan view)
        for (m = [0, 1]) translate([m == 0 ? 0 : 2 * XC, 0, 0]) mirror([m, 0, 0])
            // outermost eave edge is c_t*sqrt(2) beyond the underside eave point
            translate([c_xe - c_t * 1.4143, cy0, Z_c_low - 1]) linear_extrude(40) fillet_cutter2d(4);
        // keep the bed face flat
        translate([-500, -500, Z_c_low - 100]) cube([2000, 2000, 100]);
    }
}
// back tent = front tent rotated 180 deg about the building centre
module c_tent_back_world() { translate([XC, Y1, 0]) rotate([0, 0, 180]) translate([-XC, -Y1, 0]) c_tent_world(); }
module c_tent_print() { translate([-XC, -cy0, -Z_c_low]) c_tent_world(); }

// ---------------------------------------------------------- side roof
s_xe   = X0 - wall_t / 2 - overhang_eave;          // eave edge (world X)
s_x1   = X1 - PW2 - 0.5;                           // upper edge, just clear of posts
s_len  = (s_x1 - s_xe) / cos(pitch_side);
s_y0   = Y0 - wall_t / 2 - overhang_gable;
s_y1   = Y1;
s_row  = 9;
// placement of the front-left panel: local x up the slope, y = world Y, z normal
module s_place() { translate([s_xe, s_y0, z_side_roof(s_xe)]) rotate([0, -pitch_side, 0]) children(); }
module s_unplace() { rotate([0, pitch_side, 0]) translate([-s_xe, -s_y0, -z_side_roof(s_xe)]) children(); }
// world pockets for the rake tabs (gable wing at Y0, partition at Y1)
module s_tab_pockets_world() {
    slope = tan(pitch_side);
    for (yt = [Y0, Y1]) for (xt = [gw_x0 + 45, gw_x1 - 45])
        translate([xt, yt, z_side_roof(xt)]) multmatrix([[1, 0, 0, 0], [0, 1, 0, 0], [slope, 0, 1, 0], [0, 0, 0, 1]])
            translate([-tab_w / 2 - fit_tab, -wall_t / 2 - fit_tab, -2]) cube([tab_w + 2 * fit_tab, wall_t + 2 * fit_tab, 2 + tab_h_side + 0.3]);
}
module side_roof_local() {
    difference() {
        intersection() {
            shingle_slab(s_len, s_y1 - s_y0, roof_t, tile_step, s_row);
            // round the exposed eave / verge corners (child safety)
            translate([0, 0, -1]) linear_extrude(10) union() {
                translate([0, 0]) rrect(s_len, s_y1 - s_y0, 4);
                translate([s_len / 2, 0]) square([s_len / 2, s_y1 - s_y0]);
                translate([0, (s_y1 - s_y0) / 2]) square([s_len, (s_y1 - s_y0) / 2]);
            }
        }
        shingle_joints(s_len, s_y1 - s_y0, s_row);
        s_unplace() s_tab_pockets_world();
        // drip edge: soften the eave
        translate([-1, -1, -1]) rotate([0, 45, 0]) cube([1.6, 400, 1.6]);
    }
}
module side_roof_world() { s_place() side_roof_local(); }
