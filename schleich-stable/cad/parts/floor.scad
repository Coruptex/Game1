// FLOOR TILES (6) -- grey. Built in world coordinates, exported at origin.
// Tile grid: columns L | A (aisle) | R split at X1, X2; rows F | B split at Y1.
// Neighbouring tiles lock together with sliding fingers at the bottom
// (vertical AND horizontal lock, no hardware). Posts stand in sockets that
// straddle the tile joints, so once the posts are in, the joints are pinned.

ext_out  = 10.5;                 // floor/plinth beyond the outer post lines
tile_gap = 0.15;                 // clearance per side at tile-to-tile joints
finger_w = 20;
finger_l = 10;
finger_h = 3.0;

function tile_rect(id) =
    let(c = id[0], r = id[1],
        xa = c == "L" ? X0 - ext_out : c == "A" ? X1 : X2,
        xb = c == "L" ? X1 : c == "A" ? X2 : X3 + ext_out,
        ya = r == "F" ? Y0 - ext_out : Y1,
        yb = r == "F" ? Y1 : Y2 + ext_out)
    [xa, ya, xb, yb];

// all post positions [x, y]
post_xy = [for (x = [X0, X1, X2, X3]) for (y = [Y0, Y1, Y2]) [x, y]];

// Internal joints: [axis ("x" = joint line x=const), line, from, to, low id, high id]
tile_joints = [
    ["x", X1, Y0 - ext_out, Y1, "LF", "AF"],
    ["x", X1, Y1, Y2 + ext_out, "LB", "AB"],
    ["x", X2, Y0 - ext_out, Y1, "AF", "RF"],
    ["x", X2, Y1, Y2 + ext_out, "AB", "RB"],
    ["y", Y1, X0 - ext_out, X1, "LF", "LB"],
    ["y", Y1, X1, X2, "AF", "AB"],
    ["y", Y1, X2, X3 + ext_out, "RF", "RB"]
];
// finger centres along a joint, between the two posts that bound it
function joint_posts(j) =
    j[0] == "x" ? [j[2] < Y0 ? Y0 : j[2], j[3] > Y2 ? Y2 : j[3]]
                : [j[2] < X0 ? X0 : j[2], j[3] > X3 ? X3 : j[3]];
// about one finger per 32 mm of joint between the posts (at least 2)
function finger_centres(j) =
    let(p = joint_posts(j), lo = p[0] + PW2 + 3, hi = p[1] - PW2 - 3,
        n = max(2, round((hi - lo) / 32)), s = (hi - lo) / n)
    [for (k = [0 : n - 1]) lo + s * (k + 0.5)];

// one finger as a world-space box. owner_low: owned by the tile on the low
// side of the joint (it then protrudes into the high side). grow > 0 gives
// the matching notch (with clearance) instead.
module finger_box(j, c, owner_low, grow = 0) {
    w = finger_w + 2 * grow; l = finger_l + grow; h = finger_h + (grow > 0 ? 0.25 : 0);
    r = grow > 0 ? 0 : 1;          // fingers root 1 mm inside their tile
    a = owner_low ? j[1] - r : j[1] - l;
    z0 = grow > 0 ? -1 : 0;        // notches open through the bottom
    if (j[0] == "x") translate([a, c - w / 2, z0]) cube([l + r, w, h - z0]);
    else             translate([c - w / 2, a, z0]) cube([w, l + r, h - z0]);
}

// grooves in the floor for interior panels (stall fronts, partitions)
// Stall fronts: the door end of each groove stops PW2 + 8 short of the post
// centre, so the stall-door hinge pin stands on solid floor. Door ends
// alternate (left doors at the gables, right doors at the middle posts).
sf_groove_spans = [[X1, Y0 + PW2 + 8, Y1], [X1, Y1 + PW2 + 8, Y2],
                   [X2, Y0, Y1 - PW2 - 8], [X2, Y1, Y2 - PW2 - 8]];
module floor_grooves() {
    zb = floor_top - floor_groove_d;
    for (g = sf_groove_spans) translate([g[0] - groove_w / 2, g[1], zb]) cube([groove_w, g[2] - g[1], 10]);
    for (xr = [[X0, X1], [X2, X3]]) translate([xr[0], Y1 - groove_w / 2, zb]) cube([xr[1] - xr[0], groove_w, 10]);
}

// exterior plinth: segments between posts along the outer walls
// returns 2D footprint (world) of the plinth band
module plinth2d() {
    o = ext_out; i = plinth_w / 2;
    // left / right walls
    for (xw = [[X0, -1], [X3, 1]]) {
        x = xw[0]; s = xw[1];
        translate([s < 0 ? x - o : x - i, Y0 - o]) square([o + i, Y2 - Y0 + 2 * o]);
    }
    // front / back walls: only the stall bays (door opening in the aisle)
    for (yw = [[Y0, -1], [Y2, 1]]) for (xr = [[X0 - o, X1 + 2], [X2 - 2, X3 + o]]) {
        y = yw[0]; s = yw[1];
        translate([xr[0], s < 0 ? y - o : y - i]) square([xr[1] - xr[0], o + i]);
    }
}

// groove on top of the plinth for wall panels
module plinth_grooves() {
    zb = Z_plinth - base_groove_d;
    for (x = [X0, X3]) translate([x - groove_w / 2, Y0 - 20, zb]) cube([groove_w, Y2 - Y0 + 40, 10]);
    for (y = [Y0, Y2]) for (xr = [[X0, X1], [X2, X3]])
        translate([xr[0], y - groove_w / 2, zb]) cube([xr[1] - xr[0], groove_w, 10]);
}

// stone texture on the outward faces of the plinth (world), 0.6 mm deep
module plinth_stones() {
    d = 0.6; h = Z_plinth; o = ext_out;
    L = Y2 - Y0 + 2 * o;
    translate([X0 - o - (1 - d), Y0 - o, 0]) rotate([90, 0, 90]) linear_extrude(1) stone_mortar2d(L, h, seed = 5);
    translate([X3 + o - d, Y0 - o, 0])       rotate([90, 0, 90]) linear_extrude(1) stone_mortar2d(L, h, seed = 3);
    for (xr = [[X0 - o, X1 + 2], [X2 - 2, X3 + o]]) {
        translate([xr[0], Y0 - o + d, 0])       rotate([90, 0, 0]) linear_extrude(1) stone_mortar2d(xr[1] - xr[0], h, seed = 13);
        translate([xr[0], Y2 + o + (1 - d), 0]) rotate([90, 0, 0]) linear_extrude(1) stone_mortar2d(xr[1] - xr[0], h, seed = 11);
    }
}

// tile rectangle shrunk by tile_gap on edges shared with another tile
function tile_body(id) =
    let(r = tile_rect(id), g = tile_gap)
    [r[0] + (r[0] > X0 ? g : 0), r[1] + (r[1] > Y0 ? g : 0),
     r[2] - (r[2] < X3 ? g : 0), r[3] - (r[3] < Y2 ? g : 0)];
// whole base footprint with rounded outer corners (child safety)
module base_footprint2d() {
    translate([X0 - ext_out, Y0 - ext_out]) rrect(X3 - X0 + 2 * ext_out, Y2 - Y0 + 2 * ext_out, 4);
}
module floor_tile_world(id) {
    r = tile_body(id);
    xa = r[0]; ya = r[1]; xb = r[2]; yb = r[3];
    aisle = id[0] == "A";
    intersection() {
    translate([0, 0, -1]) linear_extrude(Z_plinth + 2) offset(delta = finger_l + 1) base_footprint2d();
    difference() {
        union() {
            // slab
            translate([xa, ya, 0]) cube([xb - xa, yb - ya, floor_top]);
            // plinth (exterior tiles)
            linear_extrude(Z_plinth) intersection() {
                translate([xa, ya]) square([xb - xa, yb - ya]);
                plinth2d();
            }
            // own fingers
            for (j = tile_joints) if (j[4] == id || j[5] == id) {
                cs = finger_centres(j);
                for (k = [0 : len(cs) - 1]) {
                    owner_low = (k % 2 == 0);
                    if ((owner_low && j[4] == id) || (!owner_low && j[5] == id))
                        finger_box(j, cs[k], owner_low);
                }
            }
        }
        // notches for the neighbour's fingers
        for (j = tile_joints) if (j[4] == id || j[5] == id) {
            cs = finger_centres(j);
            for (k = [0 : len(cs) - 1]) {
                owner_low = (k % 2 == 0);
                if ((owner_low && j[5] == id) || (!owner_low && j[4] == id))
                    finger_box(j, cs[k], owner_low, fit_tile);
            }
        }
        // post sockets
        for (p = post_xy) translate([p[0] - PW2 - fit_socket, p[1] - PW2 - fit_socket, 2])
            cube([post_w + 2 * fit_socket, post_w + 2 * fit_socket, 100]);
        floor_grooves();
        plinth_grooves();
        plinth_stones();
        // floor texture (inside the plinth)
        translate([0, 0, floor_top - (aisle ? 0.6 : 0.4)]) linear_extrude(1)
            difference() {
                translate([xa, ya]) if (aisle) cobble_mortar2d(xb - xa, yb - ya, [xa, ya]);
                                    else mat_grid2d(xb - xa, yb - ya, [xa, ya]);
                offset(delta = 0.8) plinth2d();
            }
        // soften outer top edges of the plinth
        plinth_edge_chamfer();
        // rounded outer corners
        translate([0, 0, -1]) linear_extrude(Z_plinth + 2) difference() {
            offset(delta = 50) base_footprint2d();
            base_footprint2d();
        }
    }
    }
}

module plinth_edge_chamfer() {
    c = 1.2;
    for (x = [X0 - ext_out, X3 + ext_out]) translate([x, Y0 - 50, Z_plinth]) rotate([0, 45, 0]) cube([c * 1.414, Y2 + 100, c * 1.414], center = true);
    for (y = [Y0 - ext_out, Y2 + ext_out]) translate([X0 - 50, y, Z_plinth]) rotate([45, 0, 0]) cube([X3 + 100, c * 1.414, c * 1.414], center = true);
}

// exported part: tile moved so its slab corner sits at the origin
module floor_tile(id) {
    r = tile_rect(id);
    translate([-r[0], -r[1], 0]) floor_tile_world(id);
}
