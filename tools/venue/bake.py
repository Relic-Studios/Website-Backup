# bake.py -- build the venue mesh and bake its light with Cycles.
#   blender --background --python bake.py -- [samples] [map_samples]
# Writes venue.blend, venue_bake.npz (geometry + linear baked colours + the floor light map) and
# venue_meta.json next to this file.
#
# Two vertex attributes are baked, "wall" (only the LED wall lights the room: its faces emit white,
# plus a small disc light at its hot centre, which gives the light crisp, motivated shadows) and
# "rig" (night sky, the fixtures' warm pools, a faint cool rim, the stage's edge light).
#
# The mesh is baked as three objects that together are vertex-for-vertex the exported mesh:
#   floor  the deck floor
#   solid  stage, screen frames, speakers, plates, ballast, ramps, LED faces
#   thin   truss, couplers, chains, fixtures
# Floor and solid are baked with everything casting shadows. Thin parts are baked with the thin
# parts invisible (they only receive), so tube ends buried in each other at the joints do not bake black.
#
# The floor's wall light is baked a second time into an image (the floor map): a vertex grid cannot
# hold the lattice's shadows, a 1024 x 1280 map can.
import json
import os
import sys
import time

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import venue_bl as B  # noqa: E402
import venue_geo as G  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
samples = int(argv[0]) if argv else 4096
map_samples = int(argv[1]) if len(argv) > 1 else 3072
KEY_W = 520.0                      # the wall's hot centre (W); the wall's own emission is strength 1
MAP_RES = (1024, 1280)             # floor map texels across x, along z
MAP_MIN = (-G.FLOOR_X, -60.0)      # (x, z) of the map's first texel corner
MAP_MAX = (G.FLOOR_X, 960.0)

scene = B.reset_scene()
D = G.assemble(G.build())
nv = len(D["pos"])
is_floor = D["vkind"] == G.KIND_ORDER.index("floor")
Df = B.subset(D, is_floor)
Ds = B.subset(D, D["vsolid"] & ~is_floor)
Dt = B.subset(D, ~D["vsolid"])
ob_floor, ob_solid, ob_thin = B.make_mesh(Df, "VenueFloor"), B.make_mesh(Ds, "VenueSolid"), B.make_mesh(Dt, "VenueThin")
parts = ((ob_floor, Df["vids"]), (ob_solid, Ds["vids"]), (ob_thin, Dt["vids"]))
dev = B.setup_cycles(scene, samples)
FLAGS = ("visible_shadow", "visible_diffuse", "visible_glossy", "visible_transmission")


def thin_visible(on):
    for flag in FLAGS:
        setattr(ob_thin, flag, on)


bake = scene.render.bake
bake.target = "VERTEX_COLORS"
bake.use_pass_direct = True
bake.use_pass_indirect = True
bake.use_pass_diffuse = True
bake.use_pass_glossy = True
bake.use_pass_transmission = False
bake.use_pass_emit = False
bake.use_clear = True


def bake_into(attr, seed):
    out = np.zeros((nv, 3))
    t0 = time.time()
    scene.cycles.seed = seed
    scene.cycles.samples = samples
    bake.target = "VERTEX_COLORS"
    for ob, vids in parts:
        thin_visible(ob is not ob_thin)
        me = ob.data
        for o in scene.objects:
            o.select_set(o is ob)
        bpy.context.view_layer.objects.active = ob
        me.color_attributes.active_color = me.color_attributes[attr]
        res = bpy.ops.object.bake(type="COMBINED")
        assert res == {"FINISHED"}, res
        arr = np.zeros(len(me.vertices) * 4, np.float32)
        me.color_attributes[attr].data.foreach_get("color", arr)
        out[vids] = arr.reshape(-1, 4)[:, :3]
    thin_visible(True)
    print("baked %s seed %d in %.1fs  max %.5f mean %.6f" % (attr, seed, time.time() - t0, out.max(), out.mean()))
    return out


def two_seed(attr):
    a = bake_into(attr, 11)
    b = bake_into(attr, 23)
    avg = (a + b) * 0.5
    lum = avg.mean(1)
    m = lum > 2e-3 * lum.max()
    rel = np.abs(a.mean(1) - b.mean(1))[m] / lum[m]
    print("%s seed-to-seed difference on lit verts: median %.2f%%  p95 %.2f%%  p99 %.2f%%" % (
        attr, 100 * np.median(rel), 100 * np.percentile(rel, 95), 100 * np.percentile(rel, 99)))
    return avg


def bake_floor_map():
    """Wall light on the floor into an image: everything casts, the floor mesh is swapped for a quad
    carrying the map's texture coordinates (u along x, v along z)."""
    x0, z0 = MAP_MIN
    x1, z1 = MAP_MAX
    P = np.array([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], float)
    me = bpy.data.meshes.new("FloorMapQuad")
    me.from_pydata(G.to_blender(P).tolist(), [], [[0, 3, 2, 1]])
    uvl = me.uv_layers.new(name="UVMap")
    uv = np.array([[0, 0], [0, 1], [1, 1], [1, 0]], np.float32)   # loop order 0, 3, 2, 1
    uvl.data.foreach_set("uv", uv.reshape(-1))
    me.update()
    n = me.polygons[0].normal
    assert n.z > 0.99, "floor quad faces down"
    ob = bpy.data.objects.new("FloorMapQuad", me)
    scene.collection.objects.link(ob)
    img = bpy.data.images.new("floormap", MAP_RES[0], MAP_RES[1], alpha=False, float_buffer=True)
    mat = bpy.data.materials.new("floormap")
    mat.use_nodes = True
    nt = mat.node_tree
    p = nt.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    p.inputs["Roughness"].default_value = 1.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    nt.nodes.active = tex
    me.materials.append(mat)
    ob_floor.hide_render = True
    thin_visible(True)
    for o in scene.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    bake.target = "IMAGE_TEXTURES"
    bake.margin = 4
    bake.use_pass_color = False
    scene.cycles.samples = map_samples
    scene.cycles.seed = 5
    t0 = time.time()
    res = bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})
    assert res == {"FINISHED"}, res
    px = np.array(img.pixels[:], np.float32).reshape(MAP_RES[1], MAP_RES[0], 4)[:, :, :3].mean(2)
    print("baked floor map %dx%d at %d samples in %.1fs  max %.4f mean %.5f" % (MAP_RES[0], MAP_RES[1], map_samples, time.time() - t0, px.max(), px.mean()))
    ob_floor.hide_render = False
    bpy.data.objects.remove(ob)
    bake.target = "VERTEX_COLORS"
    bake.use_pass_color = True
    return px          # rows along z (row 0 at z0), columns along x


# ---- bake 1: wall (only the LED faces emit, white; plus the key at its centre) -------------
B.materials_lit(led_emit=1.0)
B.set_world(scene, (0, 0, 0), 0.0)
key = B.make_key_light(KEY_W)
wall = two_seed("wall")
floor_map = bake_floor_map()
bpy.data.objects.remove(key)

# ---- bake 2: rig (LEDs off; night ambient + warm practicals + faint cool rim + edge light) --
B.materials_lit(led_emit=0.0, glow_emit=6.0)
B.set_world_night(scene)
lights = B.make_rig_lights(D["fixtures"])
rig = two_seed("rig")

np.savez(B.BAKE_NPZ, pos=D["pos"], tri=D["tri"], uv=D["uv"], vkind=D["vkind"], tri_mat=D["tri_mat"], piece=D["piece"],
         wall=wall, rig=rig, samples=samples, floor_map=floor_map, map_min=np.array(MAP_MIN), map_max=np.array(MAP_MAX))
with open(os.path.join(B.HERE, "venue_meta.json"), "w") as f:
    json.dump(dict(groups=D["groups"], screens=D["screens"], fixtures=D["fixtures"], mat_names=D["mat_names"],
                   samples=samples, map_samples=map_samples, key_w=KEY_W, key=B.KEY, device=dev), f, indent=1)

for ob, _ in parts:
    bpy.data.objects.remove(ob)
ob = B.make_mesh(D, "Venue")
for attr, arr in (("wall", wall), ("rig", rig)):
    rgba = np.concatenate([arr, np.ones((nv, 1))], axis=1).astype(np.float32)
    ob.data.color_attributes[attr].data.foreach_set("color", rgba.reshape(-1))
ob.data.update()
bpy.ops.wm.save_as_mainfile(filepath=B.BLEND)
print("saved", B.BLEND, B.BAKE_NPZ)
