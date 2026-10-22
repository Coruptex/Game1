// STALL FRONTS (4, one part) and PEDIMENTS (2).
// Stall front: printed flat, AISLE face up (raised frame/bars can be black
// via a filament change at Z = wall_t, boards stay white).
// Local frame (front-left instance): x = world Y, y = world Z,
// z = 0 stall side ... wall_t aisle side. Seen from the aisle the door is
// always on the left (hinge end), so the four fronts are rotated copies.

sf_u0 = Y0 + PW2 - panel_in;          // panel start (in jamb post groove)
sf_u1 = Y1 - PW2 + panel_in;          // panel end (in mid post groove)
sf_uh = Y0 + PW2;                     // jamb post face (door hinge side)
sf_ud = sf_uh + stall_door_w;         // latch stile, door-side edge
sf_us = sf_uh + 8.5;                  // sill start (beyond the lowest hinge knuckle)
sf_ul = sf_ud + 8;                    // latch stile, far edge
sf_um = Y1 - PW2;                     // mid post face
sf_v0 = floor_top - floor_groove_d + 0.2;
sf_vl = stall_door_top + 6;           // top of lintel
sf_vtop = z_c_roof(X1 - wall_t / 2) - 0.3;   // beam top (under central roof)
sf_vb  = sf_vtop - 12;                // beam bottom
sf_bars = [78, 128];                  // bar zone of the fixed section (world Z)
latch_y0 = 56;                        // tongue root height (world Z)
stop_bevel = 2.4;
// roof-beam tabs, symmetric about the stall centre so that the rotated
// copies hit the same pockets in the central roof
sf_tabs = [sf_u0 + 25, sf_u1 - 25];
// n openings of width ow, separated by bars of width bw, centred in [a, b]
module bar_openings2d(a, b, y0, y1, ow = 4.5, bw = 3) {
    n = max(1, floor((b - a + bw) / (ow + bw)));
    u0 = (a + b) / 2 - (n * ow + (n - 1) * bw) / 2;
    for (i = [0 : n - 1]) translate([u0 + i * (ow + bw), y0]) square([ow, y1 - y0]);
}

module sf_outline2d() {
    difference() {
        union() {
            translate([sf_us, sf_v0]) square([sf_ud - sf_us, sill_top - sf_v0]);  // sill: clear of hinge knuckles + pin
            translate([sf_ud, sf_v0]) square([sf_u1 - sf_ud, stall_door_top - sf_v0]);  // stile + fixed part
            translate([sf_u0, stall_door_top]) square([sf_u1 - sf_u0, sf_vtop - stall_door_top]);
            for (u = sf_tabs) tab2d(u, sf_vtop, tab_w, tab_h_c);
        }
    }
}
module sf_openings2d() {
    // bars in the fixed section (beside the latch stile)
    bar_openings2d(sf_ud + 6, sf_um - 4, sf_bars[0], sf_bars[1]);
    // upper gallery: two openings with 45 deg knee braces at the outer corners
    for (r = [[sf_uh + 7, (sf_ud + sf_ul) / 2 - 4, 0], [(sf_ud + sf_ul) / 2 + 4, sf_um - 7, 1]]) {
        a = r[0]; b = r[1]; y0 = sf_vl + 6; y1 = sf_vb;
        k = min(18, 0.45 * (b - a));
        polygon(r[2] == 0
            ? [[a, y0], [b, y0], [b, y1], [a + k, y1], [a, y1 - k]]
            : [[a, y0], [b, y0], [b, y1 - k], [b - k, y1], [a, y1]]);
    }
}
// keep panel edges that slide into post grooves at plain wall thickness
module no_trim_in_grooves2d(a, b) {
    translate([a - 50 + 0.3, -1]) square([50, 500]);
    translate([b - 0.3, -1]) square([50, 500]);
    translate([-1, -1]) square([500, floor_top + 0.5 + 1]);     // floor groove
}
// boards area (recessed = not raised) of the fixed section
module sf_boards2d() { translate([sf_ul + 2, sf_v0 + 4]) square([sf_um - sf_ul - 6, sf_bars[0] - 6 - sf_v0 - 4]); }

module stall_front_local() {
    board_panel(sf_u0, sf_u1, sf_v0, sf_vtop + tab_h_c + 2) {
        sf_outline2d();
        sf_openings2d();
        difference() { sf_outline2d(); sf_openings2d(); sf_boards2d();      // 2 trims
                       translate([sf_u0 - 1, sf_vtop - 0.5]) square([300, 20]);
                       no_trim_in_grooves2d(sf_uh, sf_um);
                       translate([sf_ud - 1, 0]) square([3.5, 400]); }  // latch path stays flat
        // 3: stop bevel on the latch stile edge (outside the latch zone)
        for (r = [[sill_top + 2, latch_y0 - 2], [latch_y0 + latch_len + 3, stall_door_top - 2]])
            translate([sf_ud, r[0], 0]) rotate([-90, 0, 0]) linear_extrude(r[1] - r[0])
                mirror([0, 1]) polygon([[0.3, 0], [-stop_bevel, 0], [0.3, stop_bevel + 0.3]]);
        // 4: latch recess in the stile edge
        latch_notch_cut(sf_ud, latch_y0, wall_t);
    }
}
// front-left placement: local x -> world Y, local z -> world +X (aisle side)
module stall_front_place() {
    translate([X1 - wall_t / 2, 0, 0]) multmatrix([[0, 0, 1, 0], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) children();
}

// -------------------------------------------------------------- pediment
// Front instance at Y0 between the jamb posts; local x = world X.
pd_x0 = X1 + PW2 - panel_in;
pd_x1 = X2 - PW2 + panel_in;
pd_v0 = door_spring_z - 2 + 0.2;
gable_win_z = Z_c_apex - 44;
gable_win_d = 26;
module door_arch2d(grow = 0) { translate([XC, 0]) offset(delta = grow) arch2d(bay_x_aisle - post_w, door_spring_z, door_crown_z); }
module pd_outline2d() {
    polygon([[pd_x0, pd_v0], [pd_x1, pd_v0], [pd_x1, z_c_roof(pd_x1) - 0.3],
             [XC, Z_c_apex - 0.3], [pd_x0, z_c_roof(pd_x0) - 0.3]]);
}
module pediment_local() {
    board_panel(pd_x0, pd_x1, pd_v0, Z_c_apex, xc = XC) {
        pd_outline2d();
        union() {
            door_arch2d();
            translate([XC, gable_win_z]) difference() {
                circle(d = gable_win_d, $fn = 64);
                square([gable_win_d, 2.4], center = true); square([2.4, gable_win_d], center = true);
            }
        }
        intersection() {
            pd_outline2d();
            translate([X1 + PW2 + 0.3, 0]) square([bay_x_aisle - post_w - 0.6, 400]);
            union() {
                difference() { door_arch2d(11); door_arch2d(4); translate([0, -500]) square([1000, 500 + door_spring_z - 1]); }
                translate([XC, gable_win_z]) difference() { circle(d = gable_win_d + 8, $fn = 64); circle(d = gable_win_d, $fn = 64); }
                translate([XC - 22, door_crown_z + 15]) rrect(44, 11, 2);     // name plate
            }
        }
        union() {}
        union() {}
    }
}
module pediment_place() { translate([0, Y0 + wall_t / 2, 0]) panel_to_world() children(); }
