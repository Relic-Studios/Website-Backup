# venue_bl.py -- Blender-side helpers shared by the build / bake / preview scripts.
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import venue_geo as G  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
BLEND = os.path.join(HERE, "venue.blend")
BAKE_NPZ = os.path.join(HERE, "venue_bake.npz")
OUT_JSON = os.path.join(REPO, "assets", "3d", "venue.json")
OUT_BIN = os.path.join(REPO, "assets", "3d", "venue.bin")
ART = os.path.join(REPO, "assets", "images", "newidk.jpg")

# base colours used by the bake (linear). name: (rgb, roughness)
MATS = {
    "floor":   ((0.064, 0.066, 0.072), 0.32),
    "truss":   ((0.075, 0.075, 0.079), 0.45),
    "block":   ((0.055, 0.055, 0.059), 0.50),
    "plinth":  ((0.045, 0.045, 0.048), 0.55),
    "trim":    ((0.100, 0.100, 0.104), 0.40),
    "speaker": ((0.035, 0.035, 0.037), 0.60),
    "grille":  ((0.060, 0.060, 0.064), 0.45),
    "frame":   ((0.030, 0.030, 0.032), 0.50),
    "fixture": ((0.055, 0.055, 0.058), 0.45),
    "lens":    ((0.020, 0.020, 0.022), 0.15),
    "led0":    ((0.015, 0.015, 0.017), 0.30),
    "led1":    ((0.015, 0.015, 0.017), 0.30),
    "led2":    ((0.015, 0.015, 0.017), 0.30),
}
WARM = (1.0, 0.80, 0.58)


def b3(p):
    """exported (three.js) point -> Blender point in metres."""
    return Vector((p[0] / G.UNITS_PER_METRE, -p[2] / G.UNITS_PER_METRE, p[1] / G.UNITS_PER_METRE))


def bdir(d):
    return Vector((d[0], -d[2], d[1])).normalized()


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup_cycles(scene, samples, denoise=False):
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    dev = "CPU"
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                dev = kind
                break
        except Exception as exc:  # noqa: BLE001
            print("device", kind, "unavailable:", exc)
    scene.cycles.device = "GPU" if dev != "CPU" else "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = denoise
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 3
    scene.cycles.sample_clamp_indirect = 4.0
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    print("cycles device:", dev)
    return dev


def subset(D, vmask):
    """Geometry dict restricted to the vertices in vmask (chunks never share vertices). Adds 'vids'."""
    vids = np.nonzero(vmask)[0]
    remap = np.full(len(vmask), -1)
    remap[vids] = np.arange(len(vids))
    tsel = vmask[D["tri"][:, 0]]
    assert (vmask[D["tri"][tsel]].all()) and not vmask[D["tri"][~tsel]].any()
    out = dict(D)
    out.update(pos=D["pos"][vids], uv=D["uv"][vids], tri=remap[D["tri"][tsel]], smooth=D["smooth"][tsel],
               tri_mat=D["tri_mat"][tsel], vids=vids)
    return out


def make_mesh(D, name="Venue"):
    pos = G.to_blender(D["pos"])
    tri = D["tri"]
    me = bpy.data.meshes.new(name)
    me.from_pydata(pos.tolist(), [], tri.tolist())
    me.polygons.foreach_set("use_smooth", D["smooth"].astype(bool))
    me.polygons.foreach_set("material_index", D["tri_mat"].astype(np.int32))
    uvl = me.uv_layers.new(name="UVMap")
    uvl.data.foreach_set("uv", D["uv"][tri.reshape(-1)].reshape(-1).astype(np.float32))
    me.update()
    assert len(me.vertices) == len(pos) and len(me.polygons) == len(tri)
    # the mesh must stay vertex-for-vertex identical to the export arrays
    chk = np.zeros(len(tri) * 3, np.int32)
    me.loops.foreach_get("vertex_index", chk)
    assert (chk == tri.reshape(-1)).all(), "loop order changed"
    for attr in ("wall", "rig"):
        me.color_attributes.new(attr, "FLOAT_COLOR", "POINT")
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for mn in D["mat_names"]:
        me.materials.append(get_material(mn))
    return ob


def get_material(name):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    return m


def _clear(mat):
    nt = mat.node_tree
    nt.nodes.clear()
    return nt, nt.nodes.new("ShaderNodeOutputMaterial")


def _principled(nt, rgb, rough, metallic=0.0):
    p = nt.nodes.new("ShaderNodeBsdfPrincipled")
    p.inputs["Base Color"].default_value = (*rgb, 1.0)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metallic
    return p


def materials_lit(led_emit=0.0, lens_emit=0.0, led_image=None, led_gain=(1.0, 1.0, 1.0), beauty=False):
    """Physically lit materials.
    led_emit: emission strength of the LED faces (white unless led_image is given).
    led_gain: (camera, glossy, diffuse) multipliers on the LED emission (preview only).
    beauty: glossier floor / metal for the camera renders."""
    img = bpy.data.images.load(led_image, check_existing=True) if led_image else None
    for name, (rgb, rough) in MATS.items():
        mat = get_material(name)
        nt, out = _clear(mat)
        if name.startswith("led"):
            if led_emit <= 0.0:
                p = _principled(nt, rgb, rough)
                nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])
                continue
            em = nt.nodes.new("ShaderNodeEmission")
            if img is not None:
                tex = nt.nodes.new("ShaderNodeTexImage")
                tex.image = img
                tex.extension = "EXTEND"
                uv = nt.nodes.new("ShaderNodeUVMap")
                uv.uv_map = "UVMap"
                mp = nt.nodes.new("ShaderNodeMapping")
                ai = img.size[0] / img.size[1]
                idx = int(name[3])
                asp = (220.0 / 390.0) if idx == 0 else (46.0 / 300.0)
                sx, sy = (1.0, ai / asp) if asp > ai else (asp / ai, 1.0)   # "cover" crop
                mp.inputs["Scale"].default_value = (sx, sy, 1.0)
                mp.inputs["Location"].default_value = (0.5 * (1 - sx), 0.5 * (1 - sy), 0.0)
                nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
                nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
                nt.links.new(tex.outputs["Color"], em.inputs["Color"])
            else:
                em.inputs["Color"].default_value = (1, 1, 1, 1)
            cam_g, glo_g, dif_g = led_gain
            if (cam_g, glo_g, dif_g) == (1.0, 1.0, 1.0):
                em.inputs["Strength"].default_value = led_emit
            else:
                lp = nt.nodes.new("ShaderNodeLightPath")
                m1 = nt.nodes.new("ShaderNodeMixRGB")   # camera vs diffuse
                m1.inputs["Color1"].default_value = (dif_g,) * 3 + (1,)
                m1.inputs["Color2"].default_value = (cam_g,) * 3 + (1,)
                nt.links.new(lp.outputs["Is Camera Ray"], m1.inputs["Fac"])
                m2 = nt.nodes.new("ShaderNodeMixRGB")
                m2.inputs["Color2"].default_value = (glo_g,) * 3 + (1,)
                nt.links.new(lp.outputs["Is Glossy Ray"], m2.inputs["Fac"])
                nt.links.new(m1.outputs["Color"], m2.inputs["Color1"])
                mul = nt.nodes.new("ShaderNodeMath")
                mul.operation = "MULTIPLY"
                mul.inputs[1].default_value = led_emit
                nt.links.new(m2.outputs["Color"], mul.inputs[0])
                nt.links.new(mul.outputs["Value"], em.inputs["Strength"])
            mat.cycles.emission_sampling = "FRONT"
            nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
        elif name == "lens" and lens_emit > 0.0:
            em = nt.nodes.new("ShaderNodeEmission")
            em.inputs["Color"].default_value = (*WARM, 1)
            em.inputs["Strength"].default_value = lens_emit
            nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
        else:
            r = rough
            if beauty and name == "floor":
                r = 0.16
            p = _principled(nt, rgb, r)
            nt.links.new(p.outputs["BSDF"], out.inputs["Surface"])


def set_world(scene, rgb, strength=1.0):
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*rgb, 1.0)
    bg.inputs["Strength"].default_value = strength


def set_world_night(scene, gain=1.0, horizon=(0.030, 0.040, 0.062), zenith=(0.008, 0.011, 0.018), ground=(0.004, 0.005, 0.008),
                    light_only=False):
    """Night sky for the rig bake: a cool glow at the horizon fading to a darker zenith, so upright truss
    faces get more ambient than the floor does."""
    w = scene.world or bpy.data.worlds.new("World")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = gain
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    up = nt.nodes.new("ShaderNodeMapRange")
    up.interpolation_type = "SMOOTHSTEP"
    up.inputs["From Min"].default_value = 0.0
    up.inputs["From Max"].default_value = 0.75
    nt.links.new(sep.outputs["Z"], up.inputs["Value"])
    sky = nt.nodes.new("ShaderNodeMixRGB")
    sky.inputs["Color1"].default_value = (*horizon, 1)
    sky.inputs["Color2"].default_value = (*zenith, 1)
    nt.links.new(up.outputs["Result"], sky.inputs["Fac"])
    below = nt.nodes.new("ShaderNodeMapRange")
    below.inputs["From Min"].default_value = -0.12
    below.inputs["From Max"].default_value = 0.0
    nt.links.new(sep.outputs["Z"], below.inputs["Value"])
    grd = nt.nodes.new("ShaderNodeMixRGB")
    grd.inputs["Color1"].default_value = (*ground, 1)
    nt.links.new(below.outputs["Result"], grd.inputs["Fac"])
    nt.links.new(sky.outputs["Color"], grd.inputs["Color2"])
    nt.links.new(grd.outputs["Color"], bg.inputs["Color"])
    if light_only:
        # previews: the sky lights the scene but the camera and mirror reflections see near-black
        # (on the page the sky is the starfield)
        lp = nt.nodes.new("ShaderNodeLightPath")
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
        nt.links.new(lp.outputs["Is Glossy Ray"], mx.inputs[1])
        st = nt.nodes.new("ShaderNodeMapRange")
        st.inputs["To Min"].default_value = gain
        st.inputs["To Max"].default_value = 0.05 * gain
        nt.links.new(mx.outputs["Value"], st.inputs["Value"])
        nt.links.new(st.outputs["Result"], bg.inputs["Strength"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def make_rig_lights(fixtures, gain=1.0, spot_w=260.0, halo_w=16.0, sun_a=0.16, sun_b=0.08):
    """The fill rig: at each fixture a warm spot down its aim (a soft pool) and a soft warm halo that
    touches the truss around it; plus two faint cool low-angle suns as rim. Returns the objects."""
    col = bpy.data.collections.get("Rig") or bpy.data.collections.new("Rig")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    obs = []
    for i, fx in enumerate(fixtures):
        d = np.array(fx["dir"])
        ld = bpy.data.lights.new("fx%02d" % i, "SPOT")
        ld.energy = spot_w * gain
        ld.color = WARM
        ld.spot_size = math.radians(56)
        ld.spot_blend = 0.9
        ld.shadow_soft_size = 0.25
        ob = bpy.data.objects.new("fx%02d" % i, ld)
        ob.location = b3(np.array(fx["pos"]) + d * 1.0)
        ob.rotation_euler = bdir(d).to_track_quat("-Z", "Y").to_euler()
        col.objects.link(ob)
        obs.append(ob)
        hd = bpy.data.lights.new("halo%02d" % i, "POINT")
        hd.energy = halo_w * gain
        hd.color = WARM
        hd.shadow_soft_size = 0.6           # 12 units: nothing nearer than that gets hotter than the chord
        ho = bpy.data.objects.new("halo%02d" % i, hd)
        ho.location = b3(np.array(fx["pos"]) - d * 6.5)
        col.objects.link(ho)
        obs.append(ho)
    # exported-space directions the light travels along
    for name, d, s in (("moon", (0.55, -0.38, -0.74), sun_a), ("rim", (-0.70, -0.30, 0.65), sun_b)):
        ld = bpy.data.lights.new(name, "SUN")
        ld.energy = s * gain
        ld.color = (0.62, 0.74, 1.0)
        ld.angle = math.radians(25)
        ob = bpy.data.objects.new(name, ld)
        ob.rotation_euler = bdir(d).to_track_quat("-Z", "Y").to_euler()
        col.objects.link(ob)
        obs.append(ob)
    return obs


def set_camera(scene, pos, look, vfov_deg=75.0, name="Cam"):
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        scene.collection.objects.link(cam)
    cam.data.sensor_fit = "VERTICAL"
    cam.data.sensor_height = 24.0
    cam.data.lens = 12.0 / math.tan(math.radians(vfov_deg) / 2)
    cam.data.clip_start = 0.05
    cam.data.clip_end = 500.0
    p, l = b3(pos), b3(look)
    cam.location = p
    cam.rotation_euler = (l - p).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def render_png(scene, path, w=1280, h=720):
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)
