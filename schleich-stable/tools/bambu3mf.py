#!/usr/bin/env python3
"""Write Bambu Studio project files (.3mf) without Bambu Studio.

The layout follows the 3MF reader/writer of Bambu Studio (src/libslic3r/
Format/bbs_3mf.cpp, PresetBundle.cpp, Plater.cpp on GitHub):

  3D/3dmodel.model            build items + objects made of components;
                              "Application" metadata = "BambuStudio-<ver>"
                              (without it Bambu Studio loads geometry only)
  3D/Objects/object_N.model   one mesh per object
  Metadata/model_settings.config   object names, filament (extruder) and
                              per-object settings, plate with its objects
  Metadata/project_settings.config printer / filament / process presets:
                              system preset names + the changed keys, listed
                              in "different_settings_to_system" (keys that
                              are not listed are reset to the system preset)
  Metadata/custom_gcode_per_layer.xml   filament change at a layer (AMS)
  Metadata/plate_1.png        thumbnail

One project = one print plate. Objects are placed in bed coordinates of the
Bambu Lab A1 (0..256 mm).
"""
import io, json, uuid, zipfile
import numpy as np

APP_VERSION = "02.00.00.00"          # file version; any Bambu Studio 2.x opens it without a version warning
PRINTER = {"name": "Bambu Lab A1 0.4 nozzle", "model": "Bambu Lab A1", "variant": "0.4"}
BED = 256.0

# AMS lite slots (filament index 1..4)
FILAMENTS = [
    {"slot": 1, "label": "Weiß", "colour": "#FFFFFF"},
    {"slot": 2, "label": "Schwarz", "colour": "#161616"},
    {"slot": 3, "label": "Hellgrau", "colour": "#A8A8A8"},
    {"slot": 4, "label": "Dunkelgrau", "colour": "#545454"},
]
FILAMENT_PRESET = "Bambu PLA Basic @BBL A1"
FILAMENT_ID = "GFA00"

# Process presets: system parent + changed keys (same values as the JSON
# presets in slicer/bambu_studio/, generated from this table)
PROCESSES = {
    "standard": {
        "name": "Stall 0.20mm Standard @BBL A1", "inherits": "0.20mm Standard @BBL A1",
        "keys": {"wall_loops": "3", "bottom_shell_layers": "4", "sparse_infill_density": "15%",
                 "enable_support": "0", "brim_type": "auto_brim", "enable_prime_tower": "0",
                 "seam_position": "aligned"}},
    "posts": {
        "name": "Stall 0.20mm Pfosten Stuetzen v2 @BBL A1", "inherits": "0.20mm Standard @BBL A1",
        "keys": {"wall_loops": "4", "sparse_infill_density": "25%",
                 "enable_support": "1", "support_type": "tree(auto)", "support_style": "tree_slim",
                 "support_threshold_angle": "30", "support_on_build_plate_only": "0", "bridge_no_support": "1",
                 "support_top_z_distance": "0.2", "support_bottom_z_distance": "0.2",
                 "support_interface_top_layers": "2", "support_interface_bottom_layers": "2",
                 "support_object_xy_distance": "0.35",
                 "brim_type": "outer_only", "brim_width": "8", "brim_object_gap": "0.1", "enable_prime_tower": "0",
                 # tall, slim parts on a moving bed (A1): gentle speeds and accelerations,
                 # roughly the printer's "silent" mode, so nothing has to be set at the printer
                 "outer_wall_speed": "120", "inner_wall_speed": "150", "sparse_infill_speed": "150",
                 "internal_solid_infill_speed": "150", "gap_infill_speed": "120", "travel_speed": "350",
                 "default_acceleration": "3000", "outer_wall_acceleration": "2000", "travel_acceleration": "4000"}},
    "central_roof": {
        "name": "Stall 0.20mm Mitteldach @BBL A1", "inherits": "0.20mm Standard @BBL A1",
        "keys": {"wall_loops": "3", "enable_support": "0", "brim_type": "outer_only", "brim_width": "5",
                 "brim_object_gap": "0.1", "enable_prime_tower": "0"}},
    "floor": {
        "name": "Stall 0.24mm Boden @BBL A1", "inherits": "0.24mm Draft @BBL A1",
        "keys": {"wall_loops": "3", "bottom_shell_layers": "4", "sparse_infill_density": "15%",
                 "enable_support": "0", "brim_type": "no_brim", "enable_prime_tower": "0"}},
}

# flush volumes (mm3) from -> to, filaments 1..4 (white, black, light grey, dark grey)
FLUSH = [[0, 180, 140, 180],
         [650, 0, 500, 250],
         [350, 180, 0, 180],
         [550, 180, 350, 0]]


def preset_json(proc):
    """user preset file for Bambu Studio's File > Import > Import Configs"""
    d = {"type": "process", "from": "User", "is_custom_defined": "0", "version": "1.9.0.0",
         "name": proc["name"], "inherits": proc["inherits"], "print_settings_id": proc["name"]}
    d.update(proc["keys"])
    return d


def project_settings(proc_key):
    proc = PROCESSES[proc_key]
    n = len(FILAMENTS)
    cfg = {
        "name": "project_settings", "from": "project", "version": APP_VERSION,
        "printer_technology": "FFF",
        "printer_model": PRINTER["model"], "printer_variant": PRINTER["variant"],
        "printer_settings_id": PRINTER["name"],
        "print_settings_id": proc["name"],
        "filament_settings_id": [FILAMENT_PRESET] * n,
        "filament_ids": [FILAMENT_ID] * n,
        "filament_type": ["PLA"] * n,
        "filament_colour": [f["colour"] for f in FILAMENTS],
        "filament_map": ["1"] * n,
        "inherits_group": [proc["inherits"]] + [""] * n + [""],
        "different_settings_to_system": [";".join(proc["keys"].keys())] + [""] * n + [""],
        "curr_bed_type": "Textured PEI Plate",
        "flush_volumes_matrix": [str(v) for row in FLUSH for v in row],
        "flush_volumes_vector": ["140"] * (2 * n),
        "flush_multiplier": ["1"],
    }
    cfg.update(proc["keys"])
    return cfg


def _mesh_xml(obj_id, uid, verts, faces):
    out = io.StringIO()
    out.write(f'  <object id="{obj_id}" p:UUID="{uid}" type="model">\n   <mesh>\n    <vertices>\n')
    for x, y, z in verts:
        out.write(f'     <vertex x="{x:.6g}" y="{y:.6g}" z="{z:.6g}"/>\n')
    out.write('    </vertices>\n    <triangles>\n')
    for a, b, c in faces:
        out.write(f'     <triangle v1="{a}" v2="{b}" v3="{c}"/>\n')
    out.write('    </triangles>\n   </mesh>\n  </object>\n')
    return out.getvalue()


def _hex(i, suffix):
    return f"{i:08x}{suffix}"


def thumbnail_png(objects, size=512):
    """simple shaded top view of the plate (painter's algorithm)"""
    from PIL import Image, ImageDraw
    s = size / BED
    img = Image.new("RGBA", (size, size), (124, 128, 134, 255))
    dr = ImageDraw.Draw(img)
    for gx in range(0, 257, 32):
        dr.line([(gx * s, 0), (gx * s, size)], fill=(110, 114, 120, 255))
        dr.line([(0, gx * s), (size, gx * s)], fill=(110, 114, 120, 255))
    tris = []
    for o in objects:
        m = o["mesh"]
        col = np.array(tuple(int(FILAMENTS[o["extruder"] - 1]["colour"][i:i + 2], 16) for i in (1, 3, 5)), float)
        col = np.maximum(col, 28)
        n = m.face_normals
        up = n[:, 2] > 0.05
        light = 0.55 + 0.45 * np.clip(n @ np.array([-0.35, 0.45, 0.82]), 0, 1)
        for f, l in zip(m.faces[up], light[up]):
            p = m.vertices[f]
            tris.append((p[:, 2].max(), [(x * s, (BED - y) * s) for x, y, _ in p], tuple(int(c) for c in col * l) + (255,)))
    for _, pts, c in sorted(tris, key=lambda t: t[0]):
        dr.polygon(pts, fill=c)
    buf = io.BytesIO(); img.save(buf, "PNG")
    small = img.resize((128, 128)); b2 = io.BytesIO(); small.save(b2, "PNG")
    return buf.getvalue(), b2.getvalue()


def write_project(path, plate_name, objects, proc_key, color_changes=(), title="", description=""):
    """objects: [{"name", "mesh" (trimesh in bed coordinates), "extruder" (1..4),
    "settings": {key: value} per-object overrides (optional)}]
    color_changes: [(print_z, filament index)] -> filament change at that layer"""
    with_settings = []
    main_objs, build_items, rels, files = [], [], [], {}
    plate_instances = []
    for k, o in enumerate(objects):
        m = o["mesh"]
        b = m.bounds
        c = np.array([(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, b[0][2]])
        verts = m.vertices - c                                # object frame: centred, bottom at z = 0
        backup = k + 1
        vol_id, obj_id = 2 * k + 1, 2 * k + 2
        sub = f"3D/Objects/object_{backup}.model"
        files[sub] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                      '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
                      'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
                      'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n'
                      ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n <resources>\n'
                      + _mesh_xml(vol_id, _hex(backup << 16, "-81cb-4c03-9d28-80fed5dfa1dc"), verts, m.faces)
                      + ' </resources>\n <build/>\n</model>\n')
        rels.append(sub)
        main_objs.append(f'  <object id="{obj_id}" p:UUID="{_hex(backup, "-61cb-4c03-9d28-80fed5dfa1dc")}" type="model">\n'
                         f'   <components>\n    <component p:path="/{sub}" objectid="{vol_id}" '
                         f'p:UUID="{_hex(backup << 16, "-b206-40ff-9872-83e8017abed1")}" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>\n'
                         '   </components>\n  </object>\n')
        build_items.append(f'  <item objectid="{obj_id}" p:UUID="{_hex(obj_id, "-b1ec-4553-aec9-835e5b724bb4")}" '
                           f'transform="1 0 0 0 1 0 0 0 1 {c[0]:.6g} {c[1]:.6g} {c[2]:.6g}" printable="1"/>\n')
        with_settings.append((obj_id, vol_id, o, len(m.faces)))
        plate_instances.append((obj_id, 100 + k))
    date = "2026-11-08"
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" '
             'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" '
             'xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">\n'
             f' <metadata name="Application">BambuStudio-{APP_VERSION}</metadata>\n'
             ' <metadata name="BambuStudio:3mfVersion">1</metadata>\n'
             f' <metadata name="CreationDate">{date}</metadata>\n'
             f' <metadata name="Description">{_esc(description)}</metadata>\n'
             ' <metadata name="Designer"></metadata>\n'
             f' <metadata name="ModificationDate">{date}</metadata>\n'
             f' <metadata name="Title">{_esc(title or plate_name)}</metadata>\n'
             ' <resources>\n' + "".join(main_objs) + ' </resources>\n'
             f' <build p:UUID="2c7c17d8-22b5-4d84-8835-1976022ea369">\n' + "".join(build_items) + ' </build>\n</model>\n')
    files["3D/3dmodel.model"] = model
    files["3D/_rels/3dmodel.model.rels"] = (
        '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
        + "".join(f' <Relationship Target="/{r}" Id="rel-{i + 1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n'
                  for i, r in enumerate(rels)) + '</Relationships>')
    # model settings
    ms = ['<?xml version="1.0" encoding="UTF-8"?>\n<config>\n']
    for obj_id, vol_id, o, nf in with_settings:
        ms.append(f'  <object id="{obj_id}">\n')
        ms.append(f'    <metadata key="name" value="{_esc(o["name"])}"/>\n')
        ms.append(f'    <metadata key="extruder" value="{o["extruder"]}"/>\n')
        for k2, v in (o.get("settings") or {}).items():
            ms.append(f'    <metadata key="{k2}" value="{_esc(str(v))}"/>\n')
        ms.append(f'    <metadata face_count="{nf}"/>\n')
        ms.append(f'    <part id="{vol_id}" subtype="normal_part">\n')
        ms.append(f'      <metadata key="name" value="{_esc(o["name"])}"/>\n')
        ms.append('      <metadata key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n')
        ms.append(f'      <metadata key="source_file" value="{_esc(o["name"])}.stl"/>\n')
        ms.append('      <metadata key="source_object_id" value="0"/>\n      <metadata key="source_volume_id" value="0"/>\n')
        ms.append(f'      <mesh_stat face_count="{nf}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>\n')
        ms.append('    </part>\n  </object>\n')
    ms.append('  <plate>\n    <metadata key="plater_id" value="1"/>\n')
    ms.append(f'    <metadata key="plater_name" value="{_esc(plate_name)}"/>\n')
    ms.append('    <metadata key="locked" value="false"/>\n')
    ms.append('    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n')
    for obj_id, ident in plate_instances:
        ms.append(f'    <model_instance>\n      <metadata key="object_id" value="{obj_id}"/>\n'
                  f'      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="{ident}"/>\n    </model_instance>\n')
    ms.append('  </plate>\n</config>\n')
    files["Metadata/model_settings.config"] = "".join(ms)
    files["Metadata/project_settings.config"] = json.dumps(project_settings(proc_key), indent=4, ensure_ascii=False)
    if color_changes:
        cg = ['<?xml version="1.0" encoding="utf-8"?>\n<custom_gcodes_per_layer>\n<plate>\n<plate_info id="1"/>\n']
        for z, ext in color_changes:
            cg.append(f'<layer top_z="{z:g}" type="2" extruder="{ext}" color="{FILAMENTS[ext - 1]["colour"]}" extra="" gcode="tool_change"/>\n')
        cg.append('<mode value="MultiAsSingle"/>\n</plate>\n</custom_gcodes_per_layer>\n')
        files["Metadata/custom_gcode_per_layer.xml"] = "".join(cg)
    png, png_small = thumbnail_png(objects)
    files["[Content_Types].xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                                    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n'
                                    ' <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n'
                                    ' <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n'
                                    ' <Default Extension="png" ContentType="image/png"/>\n'
                                    ' <Default Extension="gcode" ContentType="text/x.gcode"/>\n</Types>')
    files["_rels/.rels"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
                            ' <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n'
                            ' <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>\n'
                            ' <Relationship Target="/Metadata/plate_1.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-middle"/>\n'
                            ' <Relationship Target="/Metadata/plate_1_small.png" Id="rel-5" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>\n'
                            '</Relationships>')
    order = ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model", "3D/_rels/3dmodel.model.rels"] + rels + \
            ["Metadata/model_settings.config", "Metadata/project_settings.config"] + \
            (["Metadata/custom_gcode_per_layer.xml"] if color_changes else [])
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for n in order:
            z.writestr(n, files[n])
        z.writestr("Metadata/plate_1.png", png, compress_type=zipfile.ZIP_STORED)
        z.writestr("Metadata/plate_1_small.png", png_small, compress_type=zipfile.ZIP_STORED)
    return path


def _esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def check_project(path):
    """structural self-check: well-formed XML, ids consistent, settings parse"""
    import xml.etree.ElementTree as ET
    z = zipfile.ZipFile(path)
    names = set(z.namelist())
    issues = []
    for need in ("[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model", "Metadata/model_settings.config",
                 "Metadata/project_settings.config", "Metadata/plate_1.png"):
        if need not in names:
            issues.append("missing " + need)
    ns = {"m": "http://schemas.microsoft.com/3dmanufacturing/core/2015/02",
          "p": "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"}
    root = ET.fromstring(z.read("3D/3dmodel.model"))
    app = [e.text for e in root.findall("m:metadata", ns) if e.get("name") == "Application"]
    if not app or not app[0].startswith("BambuStudio-"):
        issues.append("Application metadata missing")
    objs = {o.get("id"): o for o in root.find("m:resources", ns).findall("m:object", ns)}
    for it in root.find("m:build", ns).findall("m:item", ns):
        if it.get("objectid") not in objs:
            issues.append("build item without object " + it.get("objectid"))
    sub_ids = {}
    for o in objs.values():
        for c in o.find("m:components", ns).findall("m:component", ns):
            p = c.get("{%s}path" % ns["p"]).lstrip("/")
            if p not in names:
                issues.append("component file missing " + p)
                continue
            sr = ET.fromstring(z.read(p))
            ids = [so.get("id") for so in sr.find("m:resources", ns).findall("m:object", ns)]
            if c.get("objectid") not in ids:
                issues.append(f"component {c.get('objectid')} not in {p}")
            sub_ids[o.get("id")] = c.get("objectid")
    msr = ET.fromstring(z.read("Metadata/model_settings.config"))
    for o in msr.findall("object"):
        if o.get("id") not in objs:
            issues.append("settings for unknown object " + o.get("id"))
        part = o.find("part")
        if part is None or part.get("id") != sub_ids.get(o.get("id")):
            issues.append("part id mismatch for object " + o.get("id"))
    for mi in msr.find("plate").findall("model_instance"):
        oid = [m.get("value") for m in mi.findall("metadata") if m.get("key") == "object_id"][0]
        if oid not in objs:
            issues.append("plate instance of unknown object " + oid)
    cfg = json.loads(z.read("Metadata/project_settings.config"))
    n = len(cfg["filament_colour"])
    for k in ("filament_settings_id", "filament_ids", "filament_type", "filament_map"):
        if len(cfg[k]) != n:
            issues.append(f"{k} has {len(cfg[k])} entries, expected {n}")
    if len(cfg["inherits_group"]) != n + 2 or len(cfg["different_settings_to_system"]) != n + 2:
        issues.append("inherits_group / different_settings_to_system length")
    listed = set(cfg["different_settings_to_system"][0].split(";"))
    proc_keys = [k for k in cfg if k not in ("name", "from", "version", "printer_technology", "printer_model", "printer_variant",
                                              "printer_settings_id", "print_settings_id", "filament_settings_id", "filament_ids",
                                              "filament_type", "filament_colour", "filament_map", "inherits_group",
                                              "different_settings_to_system", "curr_bed_type", "flush_volumes_matrix",
                                              "flush_volumes_vector", "flush_multiplier")]
    for k in proc_keys:
        if k not in listed:
            issues.append(f"process key {k} not listed in different_settings_to_system (would be reset)")
    if len(cfg["flush_volumes_matrix"]) != n * n:
        issues.append("flush matrix size")
    if "Metadata/custom_gcode_per_layer.xml" in names:
        ET.fromstring(z.read("Metadata/custom_gcode_per_layer.xml"))
    return issues


def reload_meshes(path):
    """read the objects back from a project file: [(name, vertices in bed
    coordinates, faces)] -- independent of the writer, for checks"""
    import xml.etree.ElementTree as ET
    ns = {"m": "http://schemas.microsoft.com/3dmanufacturing/core/2015/02",
          "p": "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"}
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read("3D/3dmodel.model"))
    objs = {o.get("id"): o for o in root.find("m:resources", ns).findall("m:object", ns)}
    names = {}
    msr = ET.fromstring(z.read("Metadata/model_settings.config"))
    for o in msr.findall("object"):
        names[o.get("id")] = [m.get("value") for m in o.findall("metadata") if m.get("key") == "name"][0]
    out = []
    for it in root.find("m:build", ns).findall("m:item", ns):
        t = [float(v) for v in it.get("transform").split()]
        M = np.array([[t[0], t[3], t[6], t[9]], [t[1], t[4], t[7], t[10]], [t[2], t[5], t[8], t[11]], [0, 0, 0, 1]])
        comp = objs[it.get("objectid")].find("m:components", ns).find("m:component", ns)
        sub = ET.fromstring(z.read(comp.get("{%s}path" % ns["p"]).lstrip("/")))
        so = [o for o in sub.find("m:resources", ns).findall("m:object", ns) if o.get("id") == comp.get("objectid")][0]
        mesh = so.find("m:mesh", ns)
        v = np.array([[float(e.get(k)) for k in "xyz"] for e in mesh.find("m:vertices", ns)])
        f = np.array([[int(e.get(k)) for k in ("v1", "v2", "v3")] for e in mesh.find("m:triangles", ns)])
        v = (M @ np.c_[v, np.ones(len(v))].T).T[:, :3]
        out.append((names[it.get("objectid")], v, f))
    return out
