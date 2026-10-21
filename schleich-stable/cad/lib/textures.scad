// Surface textures, all generated from 2D profiles / patterns so that each
// textured part needs only one or two 3D booleans.

// ---------- vertical boards ----------
// Slab X:[0,w] Y:[0,h] Z:[0,t]. V-grooves run along Y on the top face
// (Z=t, exterior) at x = off + k*pw and on the bottom face (Z=0) offset by
// half a board so the two groove sets never thin the same spot.
module plank_profile2d(w, t, pw = plank_w, ge = groove_ext, gi = groove_int, off = 0) {
    difference() {
        square([w, t]);
        if (ge > 0) for (x = [off + pw : pw : w - 1])
            polygon([[x - ge, t + eps], [x + ge, t + eps], [x, t - ge]]);
        if (gi > 0) for (x = [off + pw / 2 : pw : w - 1])
            polygon([[x - gi, -eps], [x + gi, -eps], [x, gi]]);
    }
}
module plank_slab(w, h, t, pw = plank_w, ge = groove_ext, gi = groove_int, off = 0) {
    translate([0, h, 0]) rotate([90, 0, 0]) linear_extrude(h)
        plank_profile2d(w, t, pw, ge, gi, off);
}
// horizontal boards (grooves along X)
module plank_slab_h(w, h, t, pw = plank_w, ge = groove_ext, gi = groove_int, off = 0) {
    translate([w, 0, 0]) rotate([0, 0, 90]) plank_slab(h, w, t, pw, ge, gi, off);
}

// ---------- cobbles (aisle floor) ----------
// Mortar network for a running-bond paver pattern, in WORLD coordinates
// (pass the tile's world origin as org so neighbouring tiles line up).
module cobble_mortar2d(w, h, org = [0, 0], cw = 11, ch = 7.4, g = 1.1) {
    difference() {
        square([w, h]);
        i0 = floor(org[0] / cw) - 1;
        j0 = floor(org[1] / ch) - 1;
        for (j = [j0 : j0 + ceil(h / ch) + 2])
            for (i = [i0 : i0 + ceil(w / cw) + 2])
                translate([i * cw + (abs(j) % 2) * cw / 2 - org[0] + g / 2,
                           j * ch - org[1] + g / 2])
                    square([cw - g, ch - g]);
    }
}

// ---------- rubber stall-mat grid ----------
module mat_grid2d(w, h, org = [0, 0], s = 22, g = 0.9) {
    intersection() {
        square([w, h]);
        union() {
            for (x = [floor(org[0] / s) * s - org[0] : s : w + s]) translate([x - g / 2, -1]) square([g, h + 2]);
            for (y = [floor(org[1] / s) * s - org[1] : s : h + s]) translate([-1, y - g / 2]) square([w + 2, g]);
        }
    }
}

// ---------- ashlar stones (plinth faces) ----------
// Mortar lines for a coursed stone pattern on a w x h face.
module stone_mortar2d(w, h, course = 7.4, g = 0.9, seed = 7, org = 0) {
    n = ceil(h / course);
    intersection() {
        square([w, h]);
        union() {
            for (r = [1 : n - 1]) translate([-1, r * course - g / 2]) square([w + 2, g]);
            for (r = [0 : n - 1]) {
                L = rands(9, 17, 40, seed + r * 13);
                for (k = [0 : 39]) {
                    x = (r % 2) * 6 - org % 30 + (k == 0 ? 0 : sum_to(L, k - 1));
                    if (x > -g && x < w + g)
                        translate([x - g / 2, r * course]) square([g, course]);
                }
            }
        }
    }
}
function sum_to(v, i) = i < 0 ? 0 : v[i] + sum_to(v, i - 1);

// ---------- shingles (roof) ----------
// Roof panel modelled flat: local X runs up the slope from the eave (x=0),
// Y along the eave, Z = thickness. Rows of shingles step up at each butt.
module shingle_profile2d(len, t = roof_t, step = tile_step, row = 9) {
    n = ceil(len / row);
    pts = concat(
        [[0, 0], [len, 0]],
        [for (k = [n - 1 : -1 : 0]) each [
            [min(len, (k + 1) * row) - 0.01, t],
            [k * row + 0.01, t + step]
        ]]
    );
    polygon(pts);
}
module shingle_slab(len, wid, t = roof_t, step = tile_step, row = 9) {
    translate([0, wid, 0]) rotate([90, 0, 0]) linear_extrude(wid) shingle_profile2d(len, t, step, row);
}
// vertical joints between shingles (staggered every row), cut from z0 up
module shingle_joints(len, wid, row = 9, sw = 12, g = 0.9, z0 = roof_t - 0.3, org = 0) {
    translate([0, 0, z0]) linear_extrude(tile_step + 2) intersection() {
        square([len, wid]);
        union() for (k = [0 : ceil(len / row)])
            for (y = [-(org % sw) + (k % 2) * sw / 2 - sw : sw : wid + sw])
                translate([k * row + 0.8, y - g / 2]) square([row - 0.8, g]);
    }
}
