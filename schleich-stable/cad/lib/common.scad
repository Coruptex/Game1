// Common helpers. 2D-first: build outlines in 2D (fast, exact), extrude
// once, keep the number of 3D booleans small (important for the CGAL
// kernel of OpenSCAD 2021.01; newer versions with Manifold are fast anyway).

// ---------- 2D primitives ----------
module rrect(w, h, r) {            // rounded rectangle, corner at origin
    r2 = min(r, w / 2 - eps, h / 2 - eps);
    if (r2 <= 0) square([w, h]);
    else translate([r2, r2]) offset(r = r2) square([w - 2 * r2, h - 2 * r2]);
}

module crect(w, h, c) {            // chamfered rectangle, corner at origin
    polygon([[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]]);
}

// Segmental arch opening: centred on x=0, bottom at y=0, straight sides
// up to y=h_spring, circular segment up to y=h_crown.
function arch_R(w, rise) = (w * w / 4 + rise * rise) / (2 * rise);
module arch2d(w, h_spring, h_crown) {
    rise = h_crown - h_spring;
    R = arch_R(w, rise);
    union() {
        translate([-w / 2, 0]) square([w, h_spring + eps]);
        intersection() {
            translate([0, h_crown - R]) circle(r = R, $fn = 160);
            translate([-w / 2, h_spring]) square([w, rise + eps]);
        }
    }
}
// round-headed arch (semicircle on top)
module round_arch2d(w, h) {
    union() {
        translate([-w / 2, 0]) square([w, h - w / 2 + eps]);
        translate([0, h - w / 2]) circle(d = w, $fn = 96);
    }
}

// 2D cutter that rounds a convex 90 deg corner at the origin (material in +x,+y)
// with radius r. Explicit arc vertices: no tangent circle/square slivers.
module fillet_cutter2d(r, fn = 24) {
    polygon(concat([[-1, -1], [r, -1], [r, 0]],
                   [for (i = [0 : fn]) let(a = 270 - 90 * i / fn) [r + r * cos(a), r + r * sin(a)]],
                   [[0, r], [-1, r]]));
}
// band of width b around a 2D shape (outside)
module outline_band(b) { difference() { offset(delta = b) children(); children(); } }

// ---------- holes that print well ----------
// Horizontal hole along local Y with a teardrop section (tip toward +Z),
// for parts printed flat. d = nominal diameter.
module teardrop2d(d) {
    union() {
        circle(d = d, $fn = 32);
        rotate(45) square(d / 2);          // 45 deg roof, prints without sag
    }
}
module hole_y(d, l) {                      // centred on origin, along Y
    // rotate([-90,0,0]) maps 2D -Y to world +Z, so mirror the tip to -Y first
    rotate([-90, 0, 0]) translate([0, 0, -l / 2]) linear_extrude(l) mirror([0, 1]) teardrop2d(d);
}
module hole_x(d, l) { rotate([0, 0, -90]) hole_y(d, l); }

// Axis height for a horizontal cylinder of diameter d lying on the bed with
// a 0.3 mm flat (so the first layer has a usable footprint).
function kz(d) = d / 2 - 0.3;
// Horizontal cylinder along Y (from y=0 to y=l), axis at x=0, z=kz(d),
// clipped at the bed (z >= 0).
module cyl_y_bed(d, l) {
    intersection() {
        translate([0, 0, kz(d)]) rotate([-90, 0, 0]) cylinder(d = d, h = l, $fn = 48);
        translate([-d, -1, 0]) cube([2 * d, l + 2, d]);
    }
}

// ---------- extrusions with an edge chamfer ----------
// Linear extrude with a 45 deg chamfer (two-step) on the top edge.
module extrude_chamfer_top(h, c) {
    union() {
        linear_extrude(h - c + eps) children();
        translate([0, 0, h - c]) linear_extrude(c) offset(delta = -c / 2) children();
    }
}

// ---------- misc ----------
module mirror_copy(v) { children(); mirror(v) children(); }

// Placement for panels modelled flat: local X -> world X, local Y -> world Z,
// local Z (thickness, exterior/top face) -> world -Y.
module panel_to_world() { rotate([90, 0, 0]) children(); }
