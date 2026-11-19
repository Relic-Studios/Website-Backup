# look.py -- quick look renders of the raw geometry (no bake). Usage:
#   blender --background --python look.py -- [samples]
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import venue_bl as B  # noqa: E402
import venue_geo as G  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
samples = int(argv[0]) if argv else 96

scene = B.reset_scene()
D = G.assemble(G.build())
ob = B.make_mesh(D)
B.setup_cycles(scene, samples, denoise=True)
scene.view_settings.view_transform = "Standard"

# 1) clay: grey overcast so the modelling can be judged
B.materials_lit()
for m in bpy.data.materials:
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Base Color"].default_value = (0.55, 0.55, 0.57, 1)
            n.inputs["Roughness"].default_value = 0.6
B.set_world(scene, (0.8, 0.85, 1.0), 0.9)
views = {
    "look-clay-34": ((620, 520, 1250), (0, 200, 380), 50),
    "look-clay-front": ((0, 260, 1250), (0, 260, 0), 50),
    "look-clay-stage": ((150, 150, 330), (40, 230, 0), 60),
    "look-clay-under": ((-120, 60, 520), (60, 420, 380), 75),
}
for name, (pos, look, fov) in views.items():
    B.set_camera(scene, pos, look, fov)
    B.render_png(scene, os.path.join(B.HERE, name + ".png"))
