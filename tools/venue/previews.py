# previews.py -- Cycles previews of the venue with newidk.jpg on the screens (path traced, not the bake).
#   blender --background --python previews.py -- [samples] [diffuse_gain] [rig_gain] [only]
# The LED picture is drawn at its own brightness to the camera; the light it throws on the room is
# multiplied by diffuse_gain (the page applies the same kind of gain to the baked "wall" attribute).
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import venue_bl as B  # noqa: E402
import venue_geo as G  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
samples = int(argv[0]) if len(argv) > 0 else 384
dif_gain = float(argv[1]) if len(argv) > 1 else 40.0
rig_gain = float(argv[2]) if len(argv) > 2 else 1.6
only = argv[3] if len(argv) > 3 else ""

scene = B.reset_scene()
D = G.assemble(G.build())
ob = B.make_mesh(D)
B.setup_cycles(scene, samples, denoise=True)
scene.cycles.sample_clamp_indirect = 8.0
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"

B.materials_lit(led_emit=1.0, led_image=B.ART, led_gain=(1.0, 1.6, dif_gain), lens_emit=6.0, beauty=True)
B.set_world_night(scene, gain=rig_gain, light_only=True)
B.make_rig_lights(D["fixtures"], gain=rig_gain)

img = bpy.data.images.load(B.ART, check_existing=True)
px = np.array(img.pixels[:]).reshape(-1, 4)[:, :3]
lin = np.where(px <= 0.04045, px / 12.92, ((px + 0.055) / 1.055) ** 2.4)
print("picture mean linear rgb", np.round(lin.mean(0), 4), "-> light on the room x%.0f, rig x%.1f" % (dif_gain, rig_gain))

views = {
    "preview-far": ((0, 150, 900), (0, 235, 0)),
    "preview-mid": ((-60, 120, 560), (0, 235, 0)),
    "preview-near": ((40, 95, 300), (0, 240, 0)),
}
for name, (p, l) in views.items():
    if only and only not in name:
        continue
    B.set_camera(scene, p, l, 75.0)
    B.render_png(scene, os.path.join(B.HERE, name + ".png"))
