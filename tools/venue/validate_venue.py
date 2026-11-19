# validate_venue.py -- re-read assets/3d/venue.json + venue.bin exactly as the page would and check them.
#   python validate_venue.py
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
JS = os.path.join(REPO, "assets", "3d", "venue.json")
BN = os.path.join(REPO, "assets", "3d", "venue.bin")

fails = []


def check(ok, msg):
    print(("  ok   " if ok else "  FAIL ") + msg)
    if not ok:
        fails.append(msg)


m = json.load(open(JS))
raw = open(BN, "rb").read()
nv, ni = m["vertexCount"], m["indexCount"]
S = m["sections"]
print("venue.json %d bytes, venue.bin %d bytes" % (os.path.getsize(JS), len(raw)))
print("keys:", list(m.keys()))
check("standIn" not in m, "no standIn flag")
check(m["version"] == 1 and m["unitsPerMetre"] == 20, "version 1, unitsPerMetre 20")

order = ["position", "wall", "rig", "uv", "index"]
sizes = {"position": nv * 6, "wall": nv * 3, "rig": nv * 3, "uv": nv * 4, "index": ni * 2}
check(list(S.keys()) == order, "sections present in contract order")
check(all(S[k] % 4 == 0 for k in order), "every section starts on a 4-byte boundary: %s" % S)
exp = 0
aligned = True
for k in order:
    exp = (exp + 3) // 4 * 4
    aligned &= S[k] == exp
    exp += sizes[k]
check(aligned, "sections are packed back to back with zero padding only")
check(len(raw) >= S["index"] + sizes["index"] and len(raw) - (S["index"] + sizes["index"]) < 4,
      "file length matches the sections (%d expected, %d on disk)" % (S["index"] + sizes["index"], len(raw)))

qpos = np.frombuffer(raw, "<u2", nv * 3, S["position"]).reshape(-1, 3)
wall = np.frombuffer(raw, "u1", nv * 3, S["wall"]).reshape(-1, 3)
rig = np.frombuffer(raw, "u1", nv * 3, S["rig"]).reshape(-1, 3)
quv = np.frombuffer(raw, "<u2", nv * 2, S["uv"]).reshape(-1, 2)
idx = np.frombuffer(raw, "<u2", ni, S["index"])
bmin, bmax = np.array(m["bounds"]["min"]), np.array(m["bounds"]["max"])
pos = bmin + qpos / 65535.0 * (bmax - bmin)
uv = quv / 65535.0
tri = idx.reshape(-1, 3)

print("\ncounts")
print("  vertices %d (budget 30000)   indices %d   triangles %d (budget 45000)" % (nv, ni, ni // 3))
check(nv <= 30000 and ni // 3 <= 45000 and ni % 3 == 0, "inside the vertex / triangle budget")
check(int(idx.max()) < nv, "every index < vertexCount (max index %d)" % idx.max())
check(len(np.unique(idx)) == nv, "every vertex is referenced")
print("  bounds min %s max %s" % (m["bounds"]["min"], m["bounds"]["max"]))
print("  decoded position min %s max %s" % (np.round(pos.min(0), 3).tolist(), np.round(pos.max(0), 3).tolist()))
check(qpos.min(0).tolist() == [0, 0, 0] and qpos.max(0).tolist() == [65535] * 3, "quantised positions span the whole bounding box")

print("\ngroups")
cover = np.zeros(ni, np.int32)
kinds = []
for g in m["groups"]:
    cover[g["start"]:g["start"] + g["count"]] += 1
    kinds.append(g["kind"])
    extra = " screen=%d" % g["screen"] if "screen" in g else ""
    gi = idx[g["start"]:g["start"] + g["count"]]
    print("  %-10s kind=%-5s start=%6d count=%6d (%5d tris, %5d verts)%s" % (
        g["name"], g["kind"], g["start"], g["count"], g["count"] // 3, len(np.unique(gi)), extra))
check((cover == 1).all(), "groups cover every index exactly once")
check(all(g["start"] % 3 == 0 and g["count"] % 3 == 0 for g in m["groups"]), "group ranges fall on triangle boundaries")
check(set(kinds) == {"floor", "baked", "led", "lens"}, "kinds are floor / baked / led / lens")
check([k for i, k in enumerate(kinds) if i == 0 or kinds[i - 1] != k] == ["floor", "baked", "led", "lens"], "each kind is contiguous")
check(sorted(g["screen"] for g in m["groups"] if g["kind"] == "led") == [0, 1, 2], "one led group per screen 0,1,2")

# geometry sanity
a, b, c = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
nrm = np.cross(b - a, c - a)
area = np.linalg.norm(nrm, axis=1) / 2
check((area > 1e-4).all(), "no degenerate triangles (smallest area %.4f units^2)" % area.min())
key = np.sort(qpos[tri].reshape(-1, 3, 3).astype(np.int64) @ np.array([1, 65536, 65536 ** 2]), axis=1)
check(len(np.unique(key, axis=0)) == len(key), "no doubled faces (triangles with the same three positions)")
vkind = np.full(nv, -1)
for g in m["groups"]:
    gi = np.unique(idx[g["start"]:g["start"] + g["count"]])
    check((vkind[gi] == -1).all(), "group %s shares no vertices with earlier groups" % g["name"])
    vkind[gi] = {"floor": 0, "baked": 1, "led": 2, "lens": 3}[g["kind"]]
gf = next(g for g in m["groups"] if g["kind"] == "floor")
ft = np.arange(gf["start"] // 3, (gf["start"] + gf["count"]) // 3)
fv = np.unique(tri[ft])
check(np.abs(pos[fv, 1]).max() < 1e-6, "floor is flat at y = 0")
check((nrm[ft, 1] > 0).all(), "floor triangles are counter-clockwise seen from above (+Y)")
check(abs(pos[fv, 0].min() + 330) < 0.02 and abs(pos[fv, 0].max() - 330) < 0.02 and abs(pos[fv, 2].min() + 60) < 0.02
      and abs(pos[fv, 2].max() - 960) < 0.02, "floor spans x -330..330, z -60..960")
xs, zs = np.unique(np.round(pos[fv, 0], 2)), np.unique(np.round(pos[fv, 2], 2))
print("  floor grid: %d x %d quads" % (len(xs) - 1, len(zs) - 1))
check(pos[:, 1].min() >= 0, "nothing below the floor")

print("\nscreens")
for g in m["groups"]:
    if g["kind"] != "led":
        continue
    s = m["screens"][g["screen"]]
    gt = tri[g["start"] // 3:(g["start"] + g["count"]) // 3]
    gv = np.unique(gt)
    p, t = pos[gv], uv[gv]
    print("  %d %-5s min %s max %s | decoded min %s max %s | uv u %.4f..%.4f v %.4f..%.4f" % (
        g["screen"], s["name"], s["min"], s["max"], np.round(p.min(0), 2).tolist(), np.round(p.max(0), 2).tolist(),
        t[:, 0].min(), t[:, 0].max(), t[:, 1].min(), t[:, 1].max()))
    check(np.abs(p.min(0) - s["min"]).max() < 0.02 and np.abs(p.max(0) - s["max"]).max() < 0.02, "screen %d rectangle matches meta.screens" % g["screen"])
    check(t.min() == 0.0 and t.max() == 1.0, "screen %d UVs span 0..1" % g["screen"])
    pu = (p[:, 0] - s["min"][0]) / (s["max"][0] - s["min"][0])
    pv = (p[:, 1] - s["min"][1]) / (s["max"][1] - s["min"][1])
    check(np.abs(pu - t[:, 0]).max() < 1e-3 and np.abs(pv - t[:, 1]).max() < 1e-3, "screen %d: uv (0,0) bottom-left, (1,1) top-right seen from +Z" % g["screen"])
    n = np.cross(pos[gt[:, 1]] - pos[gt[:, 0]], pos[gt[:, 2]] - pos[gt[:, 0]])
    check((n[:, 2] > 0).all() and np.abs(n[:, :2]).max() < 1e-3 * np.abs(n[:, 2]).min(), "screen %d is flat and faces +Z (counter-clockwise)" % g["screen"])
check(np.abs(uv[vkind != 2]).max() == 0, "uv is zero outside the LED faces")
M = m["screens"]
check(M[0]["min"] == [-110, 46, 0] and M[0]["max"] == [110, 436, 0], "main screen is 220 x 390 at z = 0, bottom y = 46")
check(M[1]["max"][0] - M[1]["min"][0] == 46 and M[1]["max"][1] - M[1]["min"][1] == 300 and M[1]["min"][1] == 70 and M[1]["min"][2] == 14
      and (M[1]["min"][0] + M[1]["max"][0]) / 2 == -178 and (M[2]["min"][0] + M[2]["max"][0]) / 2 == 178, "side strips 46 x 300 at x = -178 / +178, bottom y = 70, z = 14")

print("\ncolour sections (stored bytes 0..255, and decoded linear = (b/255)^2 * scale)")
print("  wallScale %.6f  rigScale %.6f" % (m["wallScale"], m["rigScale"]))
names = ["floor", "baked", "led", "lens"]
for nm, arr, sc in (("wall", wall, m["wallScale"]), ("rig", rig, m["rigScale"])):
    lin = (arr / 255.0) ** 2 * sc
    print("  %-4s all   : bytes min %3d mean %6.2f max %3d | linear min %.5f mean %.5f max %.5f" % (
        nm, arr.min(), arr.mean(), arr.max(), lin.min(), lin.mean(), lin.max()))
    for k in range(4):
        sel = vkind == k
        print("  %-4s %-6s: bytes min %3d mean %6.2f max %3d | rgb mean %s" % (
            nm, names[k], arr[sel].min(), arr[sel].mean(), arr[sel].max(), np.round(arr[sel].mean(0), 1).tolist()))
    lit = (vkind == 0) | (vkind == 1)
    top = arr[lit].max() / 255.0
    check(0.88 <= top <= 0.92, "%s: brightest lit vertex encodes to %.3f (target about 0.9)" % (nm, top))
    front = lit & (pos[:, 2] > 20)      # behind the screen plane nothing can be lit by the wall
    blk = arr.max(1) == 0
    print("  %-4s pure black lit vertices: %d of %d in front of the screens (z > 20), %d of %d behind them" % (
        nm, (blk & front).sum(), front.sum(), (blk & lit & ~front).sum(), (lit & ~front).sum()))
    # speckle = an isolated wrong vertex: black while every mesh neighbour is clearly lit, or far brighter than all of them.
    # (Black vertices that share their darkness with a neighbour are real: tube sides that face away from the light,
    #  upward faces above the wall, the inner corner at the foot of each step.)
    e = np.unique(np.sort(np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]]), axis=1), axis=0)
    ii, jj = np.concatenate([e[:, 0], e[:, 1]]), np.concatenate([e[:, 1], e[:, 0]])
    lum = arr.astype(float).max(1)
    deg = np.maximum(np.bincount(ii, minlength=nv), 1)
    acc = np.bincount(ii, weights=lum[jj], minlength=nv) / deg
    nmin = np.full(nv, 255.0)
    np.minimum.at(nmin, ii, lum[jj])
    nmax = np.zeros(nv)
    np.maximum.at(nmax, ii, lum[jj])
    dark_speck = lit & blk & (nmin > 16)
    hot_speck = lit & (lum > 2.5 * nmax + 24)
    check(dark_speck.sum() <= 0.0005 * lit.sum(), "%s: isolated black vertices (all neighbours above 16/255): %d of %d" % (nm, dark_speck.sum(), lit.sum()))
    check(hot_speck.sum() == 0, "%s: isolated hot vertices (fireflies): %d" % (nm, hot_speck.sum()))
    fl = vkind == 0
    dev = np.abs(lum[fl] - acc[fl])
    print("  %-4s floor smoothness: |vertex - neighbour mean| median %.2f, p99 %.2f, max %.2f (bytes)" % (
        nm, np.median(dev), np.percentile(dev, 99), dev.max()))

print("\nfixtures")
fx = m["fixtures"]
d = np.array([f["dir"] for f in fx])
p = np.array([f["pos"] for f in fx])
print("  %d fixtures; pos min %s max %s" % (len(fx), p.min(0).tolist(), p.max(0).tolist()))
check(np.abs(np.linalg.norm(d, axis=1) - 1).max() < 1e-3, "aim directions are unit length")
gl = next(g for g in m["groups"] if g["kind"] == "lens")
lt = tri[gl["start"] // 3:(gl["start"] + gl["count"]) // 3]
lc = pos[lt].reshape(len(fx), -1, 3).mean(1)
ln = np.cross(pos[lt[:, 1]] - pos[lt[:, 0]], pos[lt[:, 2]] - pos[lt[:, 0]]).reshape(len(fx), -1, 3).sum(1)
ln /= np.linalg.norm(ln, axis=1)[:, None]
check(np.linalg.norm(lc - p, axis=1).max() < 1.0, "each lens disc sits at its fixture pos (max offset %.2f)" % np.linalg.norm(lc - p, axis=1).max())
check((np.einsum("ij,ij->i", ln, d) > 0.999).all(), "each lens disc faces its fixture dir")

print("\n%s" % ("ALL CHECKS PASSED" if not fails else "%d CHECK(S) FAILED: %s" % (len(fails), fails)))
sys.exit(1 if fails else 0)
