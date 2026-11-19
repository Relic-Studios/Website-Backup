# preview_bake.py -- draw assets/3d/venue.bin exactly as a page would: no lights, emission = baked attributes.
#   blender --background --python preview_bake.py -- [wall_gain] [rig_gain] [tag|-] [name:px,py,pz:lx,ly,lz ...]
# Reads ONLY venue.json + venue.bin (decodes positions, colours, indices, groups), so it also proves the export.
import json
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import venue_bl as B  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
wall_gain = float(argv[0]) if len(argv) > 0 else 1.0
rig_gain = float(argv[1]) if len(argv) > 1 else 0.35
tag = argv[2] if len(argv) > 2 and argv[2] != "-" else ""
views = {"preview-bake" + tag: ((0, 90, 1000), (0, 98, 0))}
for a in argv[3:]:
    nm, p, l = a.split(":")
    views[nm] = (tuple(float(v) for v in p.split(",")), tuple(float(v) for v in l.split(",")))

m = json.load(open(B.OUT_JSON))
raw = open(B.OUT_BIN, "rb").read()
nv, ni, S = m["vertexCount"], m["indexCount"], m["sections"]
qpos = np.frombuffer(raw, "<u2", nv * 3, S["position"]).reshape(-1, 3)
wall = np.frombuffer(raw, "u1", nv * 3, S["wall"]).reshape(-1, 3) / 255.0
rig = np.frombuffer(raw, "u1", nv * 3, S["rig"]).reshape(-1, 3) / 255.0
idx = np.frombuffer(raw, "<u2", ni, S["index"]).reshape(-1, 3)
KINDS = ["floor", "baked", "coat", "led", "lens", "glow"]
bmin, bmax = np.array(m["bounds"]["min"]), np.array(m["bounds"]["max"])
pos = bmin + qpos / 65535.0 * (bmax - bmin)
# normalised linear light: 1.0 = the scale value (brightest lit vertex = 0.81)
wall_n, rig_n = wall ** 2, rig ** 2

scene = B.reset_scene()
me = bpy.data.meshes.new("VenueFromBin")
me.from_pydata(np.stack([pos[:, 0], -pos[:, 2], pos[:, 1]], axis=1).__truediv__(20.0).tolist(), [], idx.tolist())
tri_mat = np.zeros(len(idx), np.int32)
for g in m["groups"]:
    a, b = g["start"] // 3, (g["start"] + g["count"]) // 3
    tri_mat[a:b] = {"floor": 3, "baked": 0, "coat": 0, "led": 1, "lens": 2, "glow": 4}[g["kind"]]
me.polygons.foreach_set("material_index", tri_mat)
col = wall_n * wall_gain + rig_n * rig_gain
ca = me.color_attributes.new("lit", "FLOAT_COLOR", "POINT")
ca.data.foreach_set("color", np.concatenate([col, np.ones((nv, 1))], axis=1).astype(np.float32).reshape(-1))
FM = m.get("floorMap")
if FM:
    uvl = me.uv_layers.new(name="MapUV")
    lp = idx.reshape(-1)
    u = (pos[lp, 0] - FM["min"][0]) / (FM["max"][0] - FM["min"][0])
    v = (pos[lp, 2] - FM["min"][1]) / (FM["max"][1] - FM["min"][1])
    uvl.data.foreach_set("uv", np.stack([u, 1.0 - v], axis=1).astype(np.float32).reshape(-1))   # image row 0 = z min
rc = me.color_attributes.new("rigonly", "FLOAT_COLOR", "POINT")
rc.data.foreach_set("color", np.concatenate([rig_n * rig_gain, np.ones((nv, 1))], axis=1).astype(np.float32).reshape(-1))
ob = bpy.data.objects.new("VenueFromBin", me)
scene.collection.objects.link(ob)


def emit_mat(name, rgb=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    if rgb is None:
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_name = "lit"
        nt.links.new(at.outputs["Color"], em.inputs["Color"])
    else:
        em.inputs["Color"].default_value = (*rgb, 1)
    # back faces draw black, like a front-side-only material: shows any wrong winding
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mix = nt.nodes.new("ShaderNodeMixShader")
    blk = nt.nodes.new("ShaderNodeEmission")
    blk.inputs["Color"].default_value = (0, 0, 0, 1)
    nt.links.new(geo.outputs["Backfacing"], mix.inputs["Fac"])
    nt.links.new(em.outputs["Emission"], mix.inputs[1])
    nt.links.new(blk.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    me.materials.append(mat)


emit_mat("baked")
emit_mat("led", (1, 1, 1))
emit_mat("lens", (1.0, 0.80, 0.58))
if FM:
    # floor: wall light from the floor map (square-root coded) plus the vertex rig light
    mat = bpy.data.materials.new("floor")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(os.path.join(os.path.dirname(B.OUT_JSON), FM["src"]))
    tex.image.colorspace_settings.name = "Non-Color"
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "MapUV"
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    sq = nt.nodes.new("ShaderNodeMath")
    sq.operation = "POWER"
    sq.inputs[1].default_value = 2.0
    nt.links.new(tex.outputs["Color"], sq.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = FM["scale"] / m["wallScale"] * wall_gain
    nt.links.new(sq.outputs["Value"], mul.inputs[0])
    at = nt.nodes.new("ShaderNodeAttribute")
    at.attribute_name = "rigonly"
    add = nt.nodes.new("ShaderNodeVectorMath")
    add.operation = "ADD"
    nt.links.new(mul.outputs["Value"], add.inputs[0])
    nt.links.new(at.outputs["Color"], add.inputs[1])
    nt.links.new(add.outputs["Vector"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    me.materials.append(mat)
else:
    emit_mat("floor")
emit_mat("glow", (0.85, 0.92, 1.0))
B.setup_cycles(scene, 24, denoise=False)
scene.cycles.max_bounces = 0
B.set_world(scene, (0, 0, 0), 0.0)
scene.view_settings.view_transform = "Standard"
for name, (p, l) in views.items():
    B.set_camera(scene, p, l, 75.0)
    B.render_png(scene, os.path.join(B.LAB, name + ".png"), 1280, 800)
print("gains: wall x%.2f rig x%.2f (on normalised light, 1.0 = scale)" % (wall_gain, rig_gain))
