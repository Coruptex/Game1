// WALL PANELS -- white. Printed FLAT, exterior face up (raised trims on
// top can be printed black with a filament change at Z = wall_t).
// Local frame: x = along the wall (left -> right seen from outside),
// y = up (= world Z), z = thickness (0 = interior / bed, wall_t = exterior).

tab_w = 10;           // roof locating tabs
tab_h_side = 1.6;     // under the side roofs (shallow pockets, >=0.65 mm cap above)
tab_h_c = 3.5;        // on stall-front beams, into the central roof

// Generic board panel. children: 0 outline, 1 openings, 2 raised trims,
// 3 extra solids, 4 extra cuts (all in the local frame).
module board_panel(x0, x1, y0, y1, t = wall_t, xc = undef, horiz = false, ge = groove_ext, gi = groove_int) {
    c = is_undef(xc) ? (x0 + x1) / 2 : xc;
    off = ((c - x0 + plank_w / 2) % plank_w + plank_w) % plank_w;
    difference() {
        union() {
            intersection() {
                translate([x0, y0, 0])
                    if (horiz) plank_slab_h(x1 - x0, y1 - y0, t, plank_w, ge, gi, off);
                    else plank_slab(x1 - x0, y1 - y0, t, plank_w, ge, gi, off);
                translate([0, 0, -1]) linear_extrude(t + 2) children(0);
            }
            // trims start below the groove depth so no tunnels remain under them
            translate([0, 0, t - ge - 0.1]) linear_extrude(trim_h + ge + 0.1) children(2);
            children(3);
        }
        translate([0, 0, -1]) linear_extrude(t + trim_h + 10) children(1);
        children(4);
    }
}

// rectangle tab with chamfered top, standing on a line at height y
module tab2d(xc, y, w = tab_w, h = tab_h_side) {
    c = min(0.8, h / 2);
    translate([xc - w / 2, y - 1]) polygon([[0, 0], [w, 0], [w, h + 1 - c], [w - c, h + 1], [c, h + 1], [0, h + 1 - c]]);
}
// tab standing on a sloped edge y = ys + slope*(x - xc); its top runs
// parallel to the edge, h above it, so roof pockets have uniform depth
module tab2d_on_slope(xc, ys, slope, w = tab_w, h = tab_h_side) {
    c = min(0.8, h / 2);
    yl = ys - slope * w / 2; yr = ys + slope * w / 2;
    polygon([[xc - w / 2, yl - 1.5], [xc + w / 2, yr - 1.5], [xc + w / 2, yr + h - c],
             [xc + w / 2 - c, yr + h], [xc - w / 2 + c, yl + h], [xc - w / 2, yl + h - c]]);
}

// window with round head, centred on x = xc, sill at y = ys
module win_open2d(xc, ys, w, h) { translate([xc, ys]) round_arch2d(w, h); }
module win_frame2d(xc, ys, w, h, b = 4, gap = 0) {
    translate([xc, ys]) difference() { offset(delta = gap + b) round_arch2d(w, h); offset(delta = gap) round_arch2d(w, h); }
}
module win_sill2d(xc, ys, w, g = 0) { translate([xc - w / 2 - 6 - g, ys - 5 - g]) rrect(w + 12 + 2 * g, 5, 1); }

// ---------------------------------------------------------------- side wall
// Left-front instance: lies at X = X0, from Y0 to Y1, exterior toward -X.
sw_L  = bay_y - post_w + 2 * panel_in;           // panel length
sw_y0 = Z_plinth - base_groove_d + 0.2;          // bottom (in plinth groove)
sw_y1 = z_eave_side - 0.6;                       // top (under side roof)
module side_wall_local() {
    L = sw_L; xc = L / 2;
    board_panel(0, L, sw_y0, sw_y1) {
        square([L, sw_y1]);                                         // 0 outline (clipped below by y0)
        difference() {                                              // 1 openings
            win_open2d(xc, swin_sill_z, swin_w, swin_h);
            for (k = [-1, 0, 1]) translate([xc + k * swin_w / 4 - 1.2, 0]) square([2.4, 300]); // bars
        }
        union() {                                                   // 2 trims
            win_frame2d(xc, swin_sill_z, swin_w, swin_h, 4);
            win_sill2d(xc, swin_sill_z, swin_w);
        }
        union() {}                                                  // 3
        union() {}                                                  // 4
    }
}
// placement of the left-front instance (proper rotation): local x -> -Y
module side_wall_place() {
    translate([X0 + wall_t / 2, Y1 - PW2 + panel_in, 0]) multmatrix([[0, 0, -1, 0], [-1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) children();
}

// --------------------------------------------------------------- gable wing
// Front-left instance: lies at Y = Y0, from X0 to X1, exterior toward -Y.
// local x = world X (so outlines use world X directly).
gw_x0 = X0 + PW2 - panel_in;
gw_x1 = X1 - PW2 + panel_in;
gw_y0 = Z_plinth - base_groove_d + 0.2;
gw_win_xc = (X0 + X1) / 2;
// casement hinge on the corner side (left) of the window
gw_hinge_x = gw_win_xc - win_w / 2 - 4;
// side-roof locating tabs on the rakes of gable wings and partitions
rake_tabs = [gw_x0 + 45, gw_x1 - 45];
cs_lift = 0.6;                   // casement axis lift above the wall face
module gable_wing_outline2d() {
    slope = tan(pitch_side);
    union() {
        polygon([[gw_x0, 0], [gw_x1, 0], [gw_x1, z_side_roof(gw_x1)], [gw_x0, z_side_roof(gw_x0)]]);
        for (xc = rake_tabs) tab2d_on_slope(xc, z_side_roof(xc), slope);
    }
}
module gable_wing_local() {
    board_panel(gw_x0, gw_x1, gw_y0, Z_c_apex) {
        intersection() { gable_wing_outline2d(); translate([gw_x0 - 1, gw_y0]) square([400, 400]); }
        win_open2d(gw_win_xc, win_sill_z, win_w, win_h);
        difference() {
            union() {
                win_frame2d(gw_win_xc, win_sill_z, win_w, win_h, 4, 3.2);
                win_sill2d(gw_win_xc, win_sill_z, win_w, 3.2);
            }
            // keep the hinge strip free for the knuckles
            translate([gw_hinge_x - 4, win_sill_z + 2]) square([8, win_h - 10]);
        }
        // 3: fixed knuckles of the casement hinge (axis along local y)
        translate([gw_hinge_x, 0, wall_t])
            knuckles_fixed_y(win_sill_z + 4, win_sill_z + win_h - win_w / 2 - 2, 3, dk_win, -1, 3, cs_lift);
        union() {}
    }
}
module gable_wing_place() { translate([0, Y0 + wall_t / 2, 0]) panel_to_world() children(); }

// ---------------------------------------------------------------- partition
// Left instance: at Y = Y1 from X0 to X1 (interior; "exterior" = front face).
pt_y0 = floor_top - floor_groove_d + 0.2;
pt_bars = [72, 114];          // bar zone (world Z), at horse-head height
module partition_local() {
    x0 = gw_x0; x1 = gw_x1; slope = tan(pitch_side);
    board_panel(x0, x1, pt_y0, Z_c_apex, horiz = true) {
        union() {
            polygon([[x0, 0], [x1, 0], [x1, z_side_roof(x1)], [x0, z_side_roof(x0)]]);
            for (xc = rake_tabs) tab2d_on_slope(xc, z_side_roof(xc), slope);
        }
        // bar window: openings between vertical bars
        intersection() {
            translate([x0 + 14, pt_bars[0]]) square([x1 - x0 - 28, pt_bars[1] - pt_bars[0]]);
            for (x = [x0 + 14 : 11 : x1 - 14]) translate([x + 3, 0]) square([8, 400]);
        }
        // trims: top & bottom rails of the bar window
        for (y = [pt_bars[0] - 6, pt_bars[1]]) translate([x0 + 8, y]) square([x1 - x0 - 16, 6]);
        union() {}
        union() {}
    }
}
module partition_place() { translate([0, Y1 + wall_t / 2, 0]) panel_to_world() children(); }
