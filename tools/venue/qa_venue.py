# qa_venue.py -- geometry QA on the exported file: coplanar overlapping faces (z-fighting / doubled faces),
# and outward winding of every closed box-like part. Plain Python + numpy.
#   python qa_venue.py
import json
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
m = json.load(open(os.path.join(REPO, "assets", "3d", "venue.json")))
raw = open(os.path.join(REPO, "assets", "3d", "venue.bin"), "rb").read()
nv, ni, S = m["vertexCount"], m["indexCount"], m["sections"]
qpos = np.frombuffer(raw, "<u2", nv * 3, S["position"]).reshape(-1, 3)
bmin, bmax = np.array(m["bounds"]["min"]), np.array(m["bounds"]["max"])
pos = bmin + qpos / 65535.0 * (bmax - bmin)
tri = np.frombuffer(raw, "<u2", ni, S["index"]).reshape(-1, 3).astype(np.int64)

a, b, c = pos[tri[:, 0]], pos[tri[:, 1]], pos[tri[:, 2]]
if "--selftest" in sys.argv:
    # plant three faults: an exact duplicate, a reversed copy 0.02 above, and a copy 0.2 above a plinth-top triangle
    k1, k2, k3 = 100, 5000, len(tri) // 2
    up = np.array([0, 0.02, 0])
    a = np.vstack([a, a[k1], c[k2] + up, a[k3] + 10 * up])
    b = np.vstack([b, b[k1], b[k2] + up, b[k3] + 10 * up])
    c = np.vstack([c, c[k1], a[-2] * 0 + pos[tri[k2, 0]] + up, c[k3] + 10 * up])
    tri = np.vstack([tri, tri[k1], tri[k2][::-1], tri[k3]])
    print("SELFTEST: planted 1 exact duplicate, 1 reversed copy 0.02 away, 1 copy 0.2 away")
n = np.cross(b - a, c - a)
area = np.linalg.norm(n, axis=1) / 2
n = n / (2 * area)[:, None]
d = np.einsum("ij,ij->i", n, a)

# ---- coplanar overlap -------------------------------------------------------
# For every pair of triangles with (anti)parallel normals: take four points inside triangle i, measure their
# distance to the plane of triangle j, and test whether they fall inside triangle j. A hit closer than
# TOL_SAME is a doubled / z-fighting face; a hit closer than TOL_NEAR is reported as a near-coplanar pair.
TOL_SAME, TOL_NEAR = 0.05, 0.30
big = np.argmax(np.abs(n), axis=1)
sgn = np.sign(n[np.arange(len(n)), big])
nc = n * sgn[:, None]                      # canonical normal (largest component positive)
cen = (a + b + c) / 3
SAMP = np.stack([cen, cen * 0.4 + a * 0.6, cen * 0.4 + b * 0.6, cen * 0.4 + c * 0.6], axis=1)   # (T,4,3)


def bary_inside(P, A, B, C, N, eps=0.02):
    """P (k,3) vs triangles (m,...) -> (k,m) bool: projection of P along N lies strictly inside the triangle."""
    v0, v1 = B - A, C - A                                  # (m,3)
    v2 = P[:, None, :] - A[None, :, :]                      # (k,m,3)
    d00 = np.einsum("mi,mi->m", v0, v0)
    d01 = np.einsum("mi,mi->m", v0, v1)
    d11 = np.einsum("mi,mi->m", v1, v1)
    d20 = np.einsum("kmi,mi->km", v2, v0)
    d21 = np.einsum("kmi,mi->km", v2, v1)
    den = d00 * d11 - d01 * d01
    v = (d11 * d20 - d01 * d21) / den
    w = (d00 * d21 - d01 * d20) / den
    return (v > eps) & (w > eps) & (v + w < 1 - eps)


pairs = {}
for shift in (0.0, 0.5):
    key = np.floor(nc * 150 + shift).astype(np.int64)      # ~0.4 degree buckets, two staggered grids
    order = np.lexsort((key[:, 2], key[:, 1], key[:, 0]))
    ks = key[order]
    cut = np.nonzero(np.any(ks[1:] != ks[:-1], axis=1))[0] + 1
    for g in np.split(order, cut):
        if len(g) < 2:
            continue
        A, B, C, N, D0 = a[g], b[g], c[g], n[g], d[g]
        for s0 in range(0, len(g), 256):
            gi = g[s0:s0 + 256]
            for k in range(4):
                P = SAMP[gi, k]                                            # (k,3)
                dist = np.abs(P @ N.T - D0[None, :])                       # (k,m)
                cand = dist < TOL_NEAR
                cand[np.arange(len(gi)), np.arange(s0, s0 + len(gi))] = False
                if not cand.any():
                    continue
                hit = cand & bary_inside(P, A, B, C, N)
                for i, j in zip(*np.nonzero(hit)):
                    kk = (int(gi[i]), int(g[j]))
                    pairs[kk] = min(pairs.get(kk, 9.0), float(dist[i, j]))
same = {k: v for k, v in pairs.items() if v < TOL_SAME}
near = {k: v for k, v in pairs.items() if v >= TOL_SAME}
print("triangles %d" % len(tri))
print("overlapping triangle pairs in the same plane (closer than %.2f units): %d" % (TOL_SAME, len(same)))
print("overlapping triangle pairs in near-parallel planes (%.2f .. %.2f units apart): %d" % (TOL_SAME, TOL_NEAR, len(near)))
for (i, j), v in list(same.items())[:12] + list(near.items())[:12]:
    print("   tri %d at %s (n %s)  vs  tri %d at %s (n %s)  distance %.3f" % (
        i, np.round(cen[i], 1).tolist(), np.round(n[i], 2).tolist(), j, np.round(cen[j], 1).tolist(), np.round(n[j], 2).tolist(), v))
overlaps = same

# ---- winding: closed convex parts must face outward -------------------------
# connected components by shared vertex; for convex closed-ish parts every face normal points away from the centroid
parent = np.arange(nv)


def find(x):
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x


# weld by position first (hard edges are split vertices)
_, inv = np.unique(qpos, axis=0, return_inverse=True)
inv = inv.reshape(-1)
wt = inv[tri]
parent = np.arange(inv.max() + 1)
for t in wt:
    r0, r1, r2 = find(t[0]), find(t[1]), find(t[2])
    parent[r1] = r0
    parent[r2] = r0
root = np.array([find(x) for x in wt[:, 0]])
comp_ids, comp_of = np.unique(root, return_inverse=True)
ncomp = len(comp_ids)
bad_faces = 0
convex_parts = 0
for k in range(ncomp):
    sel = np.nonzero(comp_of == k)[0]
    if len(sel) > 64 or len(sel) < 4:
        continue                      # only small parts (boxes, spikes, prisms, speaker boxes, fixture heads)
    P = pos[np.unique(tri[sel])]
    sd = np.einsum("fvk,fk->fv", P[None, :, :] - a[sel][:, None, :], n[sel])   # signed distance of every vertex to every face plane
    outward = sd.max(1) <= 0.05
    inverted = (sd.min(1) >= -0.05) & ~outward
    if (outward | inverted).all():    # every face is a supporting plane: the part is convex
        convex_parts += 1
        bad_faces += int(inverted.sum())
print("position-welded connected parts: %d; convex parts checked for outward winding: %d, inward-facing faces: %d" % (ncomp, convex_parts, bad_faces))
sys.exit(1 if overlaps or bad_faces else 0)
