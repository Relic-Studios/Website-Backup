# export_venue.py -- write assets/3d/venue.json + venue.bin from venue_bake.npz (plain Python + numpy).
#   python export_venue.py [smooth_iterations]
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_JSON = os.path.join(REPO, "assets", "3d", "venue.json")
OUT_BIN = os.path.join(REPO, "assets", "3d", "venue.bin")
KIND_FLOOR, KIND_BAKED, KIND_LED, KIND_LENS = 0, 1, 2, 3
WARM = np.array([1.0, 0.80, 0.58])
TARGET = 0.9   # encoded value of the brightest lit vertex

smooth_iters = int(sys.argv[1]) if len(sys.argv) > 1 else 1

Z = np.load(os.path.join(HERE, "venue_bake.npz"))
meta = json.load(open(os.path.join(HERE, "venue_meta.json")))
pos, tri, uv, vkind = Z["pos"], Z["tri"], Z["uv"], Z["vkind"]
wall, rig = Z["wall"].copy(), Z["rig"].copy()
nv, nt = len(pos), len(tri)
assert nv <= 30000 and nt <= 45000 and nv <= 65535


def smooth(col, iters, lam=0.5):
    """Blur a little across mesh edges (shared vertices only, so hard edges and separate parts keep their contrast)."""
    e = np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]])
    e = np.unique(np.sort(e, axis=1), axis=0)
    i = np.concatenate([e[:, 0], e[:, 1]])
    j = np.concatenate([e[:, 1], e[:, 0]])
    deg = np.bincount(i, minlength=nv).astype(float)
    for _ in range(iters):
        acc = np.zeros_like(col)
        np.add.at(acc, i, col[j])
        avg = np.where(deg[:, None] > 0, acc / np.maximum(deg, 1)[:, None], col)
        col = (1 - lam) * col + lam * avg
    return col


if smooth_iters > 0:
    wall = smooth(wall, smooth_iters)
    rig = smooth(rig, smooth_iters)

lit = (vkind == KIND_FLOOR) | (vkind == KIND_BAKED)
led = vkind == KIND_LED
lens = vkind == KIND_LENS
wall[led] = 0.0                                   # the screens are the light, not lit by it
wall_scale = float(wall[lit].max() / TARGET ** 2)
rig_scale = float(rig[lit].max() / TARGET ** 2)
rig[lens] = WARM * (TARGET ** 2) * rig_scale      # lens discs carry the warm practical colour at 0.9


def enc(col, scale):
    return np.round(255.0 * np.sqrt(np.clip(col / scale, 0.0, 1.0))).astype(np.uint8)


bmin = np.floor(pos.min(0) * 1000) / 1000
bmax = np.ceil(pos.max(0) * 1000) / 1000
qpos = np.round((pos - bmin) / (bmax - bmin) * 65535.0).astype(np.uint16)
quv = np.round(np.clip(uv, 0, 1) * 65535.0).astype(np.uint16)
idx = tri.reshape(-1).astype(np.uint16)

blob = bytearray()
sections = {}
for name, arr in (("position", qpos), ("wall", enc(wall, wall_scale)), ("rig", enc(rig, rig_scale)),
                  ("uv", quv), ("index", idx)):
    while len(blob) % 4:
        blob.append(0)
    sections[name] = len(blob)
    blob += arr.astype(arr.dtype.newbyteorder("<")).tobytes()

doc = {
    "version": 1,
    "unitsPerMetre": 20,
    "vertexCount": int(nv),
    "indexCount": int(nt * 3),
    "bounds": {"min": [float(v) for v in bmin], "max": [float(v) for v in bmax]},
    "sections": sections,
    "wallScale": wall_scale,
    "rigScale": rig_scale,
    "groups": meta["groups"],
    "screens": meta["screens"],
    "fixtures": [{"pos": [round(v, 3) for v in f["pos"]], "dir": [round(v, 5) for v in f["dir"]]} for f in meta["fixtures"]],
}
os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
with open(OUT_BIN, "wb") as f:
    f.write(bytes(blob))
with open(OUT_JSON, "w") as f:
    json.dump(doc, f, indent=1)
print("wrote", OUT_JSON, os.path.getsize(OUT_JSON), "bytes")
print("wrote", OUT_BIN, os.path.getsize(OUT_BIN), "bytes")
print("verts %d tris %d wallScale %.6f rigScale %.6f smooth_iters %d" % (nv, nt, wall_scale, rig_scale, smooth_iters))
