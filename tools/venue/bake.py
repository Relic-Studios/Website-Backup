# bake.py -- build the venue mesh and bake the two vertex-light attributes with Cycles.
#   blender --background --python bake.py -- [samples]
# Writes venue.blend and venue_bake.npz (geometry + linear baked colours) next to this file.
#
# The mesh is baked as two objects that together are vertex-for-vertex the exported mesh:
#   solid  floor, plinth, screen frames, speakers, LED faces: cast shadows and bounce light
#   thin   truss, blocks, spikes, fixtures: receive light only (invisible to shadow / bounce rays),
#          so tube ends buried in each other at the joints are not baked black.
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
samples = int(argv[0]) if argv else 8192

scene = B.reset_scene()
D = G.assemble(G.build())
nv = len(D["pos"])
Ds, Dt = B.subset(D, D["vsolid"]), B.subset(D, ~D["vsolid"])
ob_solid, ob_thin = B.make_mesh(Ds, "VenueSolid"), B.make_mesh(Dt, "VenueThin")
for flag in ("visible_shadow", "visible_diffuse", "visible_glossy", "visible_transmission"):
    setattr(ob_thin, flag, False)
parts = ((ob_solid, Ds["vids"]), (ob_thin, Dt["vids"]))
dev = B.setup_cycles(scene, samples)

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
    for ob, vids in parts:
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
    print("baked %s seed %d in %.1fs  max %.5f mean %.6f" % (attr, seed, time.time() - t0, out.max(), out.mean()))
    return out


def two_seed(attr):
    a = bake_into(attr, 11)
    b = bake_into(attr, 23)
    avg = (a + b) * 0.5
    lum = avg.mean(1)
    m = lum > 2e-3 * lum.max()
    rel = np.abs(a.mean(1) - b.mean(1))[m] / lum[m]
    print("%s seed-to-seed difference on lit verts: median %.2f%%  p95 %.2f%%  p99 %.2f%% (the exported average of both is about half that)" % (
        attr, 100 * np.median(rel), 100 * np.percentile(rel, 95), 100 * np.percentile(rel, 99)))
    return avg


# ---- bake 1: wall (only the LED faces emit, white, same strength) -------------
B.materials_lit(led_emit=1.0)
B.set_world(scene, (0, 0, 0), 0.0)
wall = two_seed("wall")

# ---- bake 2: rig (LEDs off; night ambient + warm practicals + faint cool rim) --
B.materials_lit(led_emit=0.0)
B.set_world_night(scene)
lights = B.make_rig_lights(D["fixtures"])
rig = two_seed("rig")

np.savez(B.BAKE_NPZ, pos=D["pos"], tri=D["tri"], uv=D["uv"], vkind=D["vkind"], tri_mat=D["tri_mat"],
         wall=wall, rig=rig, samples=samples)
with open(os.path.join(B.HERE, "venue_meta.json"), "w") as f:
    json.dump(dict(groups=D["groups"], screens=D["screens"], fixtures=D["fixtures"], mat_names=D["mat_names"],
                   samples=samples, device=dev), f, indent=1)

# the .blend keeps one whole mesh carrying the two baked attributes (2-seed averages), plus the rig lights
for ob, _ in parts:
    bpy.data.objects.remove(ob)
ob = B.make_mesh(D, "Venue")
for attr, arr in (("wall", wall), ("rig", rig)):
    rgba = np.concatenate([arr, np.ones((nv, 1))], axis=1).astype(np.float32)
    ob.data.color_attributes[attr].data.foreach_set("color", rgba.reshape(-1))
ob.data.update()
bpy.ops.wm.save_as_mainfile(filepath=B.BLEND)
print("saved", B.BLEND, B.BAKE_NPZ)
