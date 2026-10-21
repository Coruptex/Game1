// Click latch for stall doors -- no loose parts, no small pins.
//
// The door's free stile carries a cantilever tongue (cut free by an L-slot,
// flexing IN the print plane, i.e. along the layer lines -> tough). A 45 deg
// barb on the tongue snaps into a matching recess in the edge of the fixed
// latch stile. Strain at full deflection ~0.5 % (PLA yields at ~3 %), so the
// latch survives many cycles. Opening force ~2 N (estimate).
//
// Door frame: x = width (free edge at x_edge, stile on the -x side),
// y = height, z = thickness, z = 0 is the bed / stall side, the door closes
// moving in -z (from the aisle side).

latch_len    = 22;    // free length of the tongue
latch_w      = 1.8;   // tongue width (bending direction)
latch_slot   = 1.0;   // slot that frees the tongue
latch_engage = 0.8;   // barb overlap with the stile (deflection)
latch_gap    = 1.0;   // door edge to stile edge gap
latch_barb_l = 8;     // barb length along y

// 2D cut freeing the tongue: tongue = [x_edge-latch_w, x_edge] x [y0, y0+len]
module latch_tongue_cut2d(x_edge, y0) {
    xs = x_edge - latch_w - latch_slot;
    translate([xs, y0]) square([latch_slot, latch_len + latch_slot]);
    translate([xs, y0 + latch_len]) square([latch_w + latch_slot + 1, latch_slot]);
}

// Barb on the outer face of the tongue tip; protrudes gap + engage, 45 deg
module latch_barb(x_edge, y0, t) {
    p = latch_gap + latch_engage;
    yb = y0 + latch_len - latch_barb_l - 1.5;
    translate([x_edge - 0.4, yb, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
        linear_extrude(latch_barb_l)
            polygon([[0, 0], [p + 0.4, 0], [0.4 + latch_gap, latch_engage], [0, latch_engage + 0.6]]);
}

// Cutter that shapes the edge of the fixed stile (edge face at x = x_e,
// stile material on the +x side). Creates: recess (z 0..0.8, 45 deg),
// crest (z 0.8..1.6) and an entry chamfer (z 1.6..t). Same y0 as the door.
module latch_notch_cut(x_e, y0, t) {
    e = latch_engage;
    yb = y0 + latch_len - latch_barb_l - 1.5;
    translate([x_e, yb - 1.5, 0]) rotate([90, 0, 0]) mirror([0, 0, 1])
        linear_extrude(latch_barb_l + 3)
            polygon([[-1, -1], [e + 0.15, -1], [e + 0.15, 0], [0.05, e + 0.1],
                     [0, 1.6], [0, 1.6], [e, t + eps], [e, t + 1], [-1, t + 1]]);
}
