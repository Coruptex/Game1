// Extra poses for the assembly manual (tools/manual_render.py): stall doors
// without the lever (it is fitted later), lever in its mounting position.
include <stable.scad>
which = "none";
q = "FL";
module door_frame() translate([sd_ax[0], sd_ax[1], 0]) multmatrix([[0, 0, 1, -kz(dk_door)], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) children();
if (which == "sd_closed") stall_quad(q) stall_door_world(0, false);
if (which == "sd_open") stall_quad(q) stall_door_world(90, false);
if (which == "lever_up") door_frame() translate([0, 0, 14]) fl_lever_on_door(sd_lever_px, sd_lever_py, sd_t, 90);
if (which == "lever_down") door_frame() fl_lever_on_door(sd_lever_px, sd_lever_py, sd_t, 0);
if (which == "dims") echo(str("DIMS ", sd_ax[0], " ", sd_ax[1], " ", sd_lever_px, " ", sd_lever_py, " ", sd_t, " ", kz(dk_door)));
