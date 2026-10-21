// Knuckle hinges with a separate pin (1.75 mm filament or 2 mm steel).
//
// A hinge axis from z0 to z1 is split into n segments (n odd). Even
// segments (0, 2, ...) belong to the FIXED part (post / frame, snug bore),
// odd segments to the MOVING part (door / casement, free bore). The pin is
// inserted from the bottom: the lowest fixed knuckle has a through bore,
// the top fixed knuckle a blind bore, so the floor tile under the post
// captures the pin once the post stands in its socket.

dk_door = 7.0;      // knuckle OD for doors
dk_win  = 5.2;      // knuckle OD for casement windows

// [za, zb] of segment i, gaps trimmed symmetrically at inner boundaries
function kn_seg(z0, z1, n, i) =
    let(L = (z1 - z0) / n,
        a = z0 + i * L + (i > 0 ? hinge_gap / 2 : 0),
        b = z0 + (i + 1) * L - (i < n - 1 ? hinge_gap / 2 : 0))
    [a, b];

// ---- fixed knuckles on a part printed UPRIGHT (axis = local Z) ----
// Placed with the axis at the origin. web_dir: unit vector (2D) pointing
// from the axis to the face the knuckles are attached to; web_len: distance
// from the axis to that face.
module knuckles_fixed_z(z0, z1, n, d = dk_door, web_dir = [-1, 0], web_len = 3.5, blind_top = true) {
    difference() {
        union() for (i = [0 : 2 : n - 1]) {
            s = kn_seg(z0, z1, n, i);
            translate([0, 0, s[0]]) linear_extrude(s[1] - s[0]) hull() {
                circle(d = d, $fn = 48);
                translate(web_dir * (web_len + 0.5)) square(d * 0.9, center = true);
            }
        }
        // bore: through the whole stack except a 1.6 mm cap on top
        translate([0, 0, z0 - 1]) cylinder(d = bore_fixed, h = (z1 - z0) + 1 - (blind_top ? 1.6 : -2), $fn = 24);
    }
}
// clearance cut for the moving knuckles (used on the fixed part)
module knuckles_clear_z(z0, z1, n, d = dk_door) {
    for (i = [1 : 2 : n - 1]) {
        s = kn_seg(z0, z1, n, i);
        translate([0, 0, s[0] - hinge_gap / 2]) cylinder(d = d + 2 * swing_gap, h = s[1] - s[0] + hinge_gap, $fn = 48);
    }
}

// ---- knuckles on a part printed FLAT (axis = local Y, x = 0, z = kz(d)) ----
// moving side: odd segments, free teardrop bore. web_dir = +1/-1: side (x)
// on which the leaf body lies; web_len = distance from axis to the body.
module knuckles_moving_y(y0, y1, n, d = dk_door, web_dir = 1, web_len = 4) {
    difference() {
        union() for (i = [1 : 2 : n - 1]) {
            s = kn_seg(y0, y1, n, i);
            translate([0, s[0], 0]) {
                cyl_y_bed(d, s[1] - s[0]);
                translate([web_dir > 0 ? 0 : -web_len - 0.5, 0, 0])
                    cube([web_len + 0.5, s[1] - s[0], kz(d) + 0.6]);
            }
        }
        translate([0, (y0 + y1) / 2, kz(d)]) hole_y(bore_free, (y1 - y0) + 2);
    }
}
// fixed side on a flat part (window frames): even segments, snug bore,
// blind at the top (y1) end.
module knuckles_fixed_y(y0, y1, n, d = dk_win, web_dir = -1, web_len = 3) {
    difference() {
        union() for (i = [0 : 2 : n - 1]) {
            s = kn_seg(y0, y1, n, i);
            translate([0, s[0], 0]) {
                cyl_y_bed(d, s[1] - s[0]);
                // web sunk 0.3 mm into the panel below so the union fuses
                translate([web_dir > 0 ? 0 : -web_len - 0.5, 0, -0.3])
                    cube([web_len + 0.5, s[1] - s[0], kz(d) + 0.9]);
                translate([-d / 2 + 0.6, 0, -0.3]) cube([d - 1.2, s[1] - s[0], 0.6]);
            }
        }
        translate([0, y0 - 1, kz(d)]) rotate([-90, 0, 0])
            linear_extrude((y1 - y0) + 1 - 1.4) mirror([0, 1]) teardrop2d(bore_fixed);
    }
}
// clearance for moving knuckles inside a flat fixed part
module knuckles_clear_y(y0, y1, n, d) {
    for (i = [1 : 2 : n - 1]) {
        s = kn_seg(y0, y1, n, i);
        translate([0, s[0] - hinge_gap / 2, kz(d)]) rotate([-90, 0, 0])
            cylinder(d = d + 2 * swing_gap, h = s[1] - s[0] + hinge_gap, $fn = 48);
    }
}
