# export_venue.py -- write assets/3d/venue.json + venue.bin + venue-floor.jpg from venue_bake.npz
# (plain Python + numpy + Pillow + scipy).
#   python export_venue.py [smooth_iterations]
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT_JSON = os.path.join(REPO, "assets", "3d", "venue.json")
OUT_BIN = os.path.join(REPO, "assets", "3d", "venue.bin")
OUT_MAP = os.path.join(REPO, "assets", "3d", "venue-floor.jpg")
KINDS = ["floor", "baked", "coat", "led", "lens", "glow"]
K = {k: i for i, k in enumerate(KINDS)}
WARM = np.array([1.0, 0.80, 0.58])
TARGET = 0.9   # encoded value of the brightest lit vertex

smooth_iters = int(sys.argv[1]) if len(sys.argv) > 1 else 1

Z = np.load(os.path.join(HERE, "venue_bake.npz"))
meta = json.load(open(os.path.join(HERE, "venue_meta.json")))
pos, tri, uv, vkind, piece = Z["pos"], Z["tri"], Z["uv"], Z["vkind"], Z["piece"]
wall, rig = Z["wall"].copy(), Z["rig"].copy()
nv, nt = len(pos), len(tri)
assert nv <= 65000 and nt <= 150000, "over the budget (uint16 indices need fewer than 65536 vertices)"


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

lit = (vkind == K["floor"]) | (vkind == K["baked"]) | (vkind == K["coat"])
led = vkind == K["led"]
lens = vkind == K["lens"]
glow = vkind == K["glow"]
wall[led | glow] = 0.0                            # light sources are not lit by the wall
# the back of the main screen's frame shows through the hairline gaps between the page's LED panels:
# keep it black, so the module seams read dark
behind = (vkind == K["coat"]) & (pos[:, 2] < -6.0) & (np.abs(pos[:, 0]) < 116.0) & (pos[:, 1] > 40.0) & (pos[:, 1] < 442.0)
wall[behind] = 0.0
rig[behind] = 0.0
wall_scale = float(wall[lit].max() / TARGET ** 2)
rig_scale = float(rig[lit].max() / TARGET ** 2)
rig[lens] = WARM * (TARGET ** 2) * rig_scale      # lens discs carry the warm practical colour at 0.9
rig[glow] = TARGET ** 2 * rig_scale


def enc(col, scale):
    return np.round(255.0 * np.sqrt(np.clip(col / scale, 0.0, 1.0))).astype(np.uint8)


# ---- floor map: denoise, put in the units of the floor's vertex bake, encode as a square root --
fm = Z["floor_map"].astype(float)
mmin, mmax = Z["map_min"], Z["map_max"]
fm = ndimage.median_filter(fm, size=3)
fm = ndimage.gaussian_filter(fm, 0.6)
fl = vkind == K["floor"]
fx = (pos[fl, 0] - mmin[0]) / (mmax[0] - mmin[0]) * fm.shape[1] - 0.5
fz = (pos[fl, 2] - mmin[1]) / (mmax[1] - mmin[1]) * fm.shape[0] - 0.5
samp = ndimage.map_coordinates(ndimage.gaussian_filter(fm, 3.0), [fz, fx], order=1, mode="nearest")
wl = wall[fl].mean(1)
sel = (samp > np.percentile(samp, 40)) & (wl > 0)
k_fit = float(np.median(wl[sel] / samp[sel]))
fm_lin = fm * k_fit
map_scale = float(np.percentile(fm_lin, 99.95) / TARGET ** 2)
img = np.round(255.0 * np.sqrt(np.clip(fm_lin / map_scale, 0, 1))).astype(np.uint8)
# image row 0 = top = the far end (z min) is fine: the page samples v = (z - min) / (max - min) with flipY off
Image.fromarray(img, "L").save(OUT_MAP, quality=90, optimize=True, progressive=True)
print("floor map fit: map x %.4g = vertex wall light (agreement p10/p50/p90 %s)" % (
    k_fit, np.round(np.percentile(wl[sel] / (samp[sel] * k_fit), [10, 50, 90]), 3).tolist()))

bmin = np.floor(pos.min(0) * 1000) / 1000
bmax = np.ceil(pos.max(0) * 1000) / 1000
qpos = np.round((pos - bmin) / (bmax - bmin) * 65535.0).astype(np.uint16)
quv = np.round(np.clip(uv, 0, 1) * 65535.0).astype(np.uint16)
idx = tri.reshape(-1).astype(np.uint16)
assert int(piece.max()) < 65535
qpiece = piece.astype(np.uint16)

blob = bytearray()
sections = {}
for name, arr in (("position", qpos), ("wall", enc(wall, wall_scale)), ("rig", enc(rig, rig_scale)),
                  ("uv", quv), ("index", idx), ("piece", qpiece)):
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
    "floorMap": {"src": os.path.basename(OUT_MAP), "min": [float(mmin[0]), float(mmin[1])], "max": [float(mmax[0]), float(mmax[1])],
                 "scale": map_scale},
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
print("wrote", OUT_MAP, os.path.getsize(OUT_MAP), "bytes")
print("verts %d tris %d pieces %d wallScale %.6f rigScale %.6f mapScale %.6f smooth_iters %d" % (
    nv, nt, int(piece.max()), wall_scale, rig_scale, map_scale, smooth_iters))
