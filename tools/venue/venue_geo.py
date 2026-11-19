# venue_geo.py -- procedural geometry for the Relic "truss cathedral" venue.
# Pure numpy, no bpy. Everything is authored in EXPORTED space:
#   three.js axes (X right, Y up, Z toward the viewer), 20 units = 1 metre.
# Blender space is (x, -z, y) / 20 (see to_blender()).
#
# Hard edges are made by NOT sharing vertices; smooth parts (tubes) share them.
# The mesh that Blender bakes is vertex-for-vertex the mesh that is exported.
import math
import numpy as np

UNITS_PER_METRE = 20.0
KIND_ORDER = ["floor", "baked", "led", "lens"]
# parts that cast shadows / bounce light in the bake; everything else (thin truss, blocks, fixtures)
# only receives light, so members buried in each other at the joints do not bake black
SOLID_CHUNKS = {"floor", "plinth", "plinth-trim", "frame-main", "frame-side", "speakers", "grilles"}

# ----------------------------------------------------------------------------
# design constants (exported units)
# ----------------------------------------------------------------------------
ARCH_Z = [150.0, 290.0, 430.0, 570.0, 710.0, 850.0]
HALF_SPAN = 220.0          # inner clear half span (legs at x = +-220)
SPRING_Y = 250.0
APEX_Y = 520.0             # inner apex (brief: "about 500"; 520 buys a properly pointed apex)
APEX_SLOPE = math.radians(24.0)   # slope of each side at the apex, from horizontal
TRUSS_D = 24.0             # arch truss depth (inner chord -> outer chords)
TRUSS_W = 20.0             # arch truss width along the nave (between the two outer chords)
N_LEG = 8                  # bays on each leg
N_ARC = 12                 # bays on each arc
R_CHORD = 1.7
R_LACE = 1.0
R_RUNG = 0.9

MAIN = dict(x0=-110.0, x1=110.0, y0=46.0, y1=436.0, z=0.0)
SIDE_W, SIDE_H, SIDE_Y0, SIDE_Z, SIDE_X = 46.0, 300.0, 70.0, 14.0, 178.0

PL_X, PL_TOP, PL_BACK, PL_TOPFRONT, PL_FRONT = 150.0, 46.0, -30.0, 84.0, 120.0
N_STEPS = 3                # treads between the plinth top and the floor

PA_X = 135.0
PA_Z = 60.0
GABLE_Z = 2.0
LEG_BASE = 3.0            # trusses start on top of their base plates


def norm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


# ----------------------------------------------------------------------------
# primitives -> (verts (n,3), tris (m,3))
# ----------------------------------------------------------------------------
def merge(parts):
    V, T, off = [], [], 0
    for v, t in parts:
        v = np.asarray(v, float).reshape(-1, 3)
        t = np.asarray(t, np.int64).reshape(-1, 3)
        V.append(v)
        T.append(t + off)
        off += len(v)
    return np.concatenate(V), np.concatenate(T)


def poly_normal(f):
    f = np.asarray(f, float)
    n = np.zeros(3)
    for i in range(len(f)):
        a, b = f[i], f[(i + 1) % len(f)]
        n += np.cross(a, b)
    return n


def convex(faces, centre=None, shared=False):
    """Convex solid from polygon faces; each face is oriented outward from the centre.
    shared=False -> every face owns its vertices (hard edges)."""
    pts = np.array([p for f in faces for p in f], float)
    c = pts.mean(0) if centre is None else np.asarray(centre, float)
    V, T = [], []
    for f in faces:
        f = np.asarray(f, float)
        n = poly_normal(f)
        if np.dot(n, f.mean(0) - c) < 0:
            f = f[::-1]
        base = len(V)
        V.extend(f)
        for k in range(1, len(f) - 1):
            T.append((base, base + k, base + k + 1))
    V = np.array(V)
    T = np.array(T, np.int64)
    if shared:
        key = np.round(V, 5)
        uniq, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        V2 = np.zeros((len(uniq), 3))
        V2[inv] = V
        V, T = V2, inv[T]
    return V, T


def box(c, half, R=None, skip=(), shared=False):
    """Oriented box. R columns are the local axes. skip: faces to omit, e.g. ('-y',)."""
    c = np.asarray(c, float)
    h = np.asarray(half, float)
    R = np.eye(3) if R is None else np.asarray(R, float)

    def P(sx, sy, sz):
        return c + R @ (np.array([sx, sy, sz]) * h)

    F = {
        "+x": [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
        "-x": [P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)],
        "+y": [P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)],
        "-y": [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)],
        "+z": [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)],
        "-z": [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)],
    }
    return convex([F[k] for k in F if k not in skip], centre=c, shared=shared)


def prism_xy(poly, z0, z1):
    """Extrude a convex polygon given in the XY plane along z (hard edges)."""
    poly = [np.array([p[0], p[1]]) for p in poly]
    lo = [np.array([p[0], p[1], z0]) for p in poly]
    hi = [np.array([p[0], p[1], z1]) for p in poly]
    faces = [lo, hi]
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        faces.append([lo[i], lo[j], hi[j], hi[i]])
    return convex(faces)


def spike(base_c, axis, half, height):
    """Four-sided pyramid without a base face (the base is buried in a block)."""
    base_c = np.asarray(base_c, float)
    a = norm(axis)
    h = np.array([1.0, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1.0, 0])
    e1 = norm(h - np.dot(h, a) * a)
    e2 = np.cross(a, e1)
    b = [base_c + half * e1, base_c + half * e2, base_c - half * e1, base_c - half * e2]
    tip = base_c + a * height
    faces = [[b[i], b[(i + 1) % 4], tip] for i in range(4)]
    return convex(faces, centre=base_c + a * height * 0.25)


def patch(o, eu, ev, us, vs, expect, diag=None):
    """Planar grid. Vertex (i,j) = o + us[i]*eu + vs[j]*ev. Normal = eu x ev (checked against expect).
    diag(i,j) -> True flips the quad diagonal."""
    o, eu, ev = np.asarray(o, float), np.asarray(eu, float), np.asarray(ev, float)
    assert np.dot(np.cross(eu, ev), np.asarray(expect, float)) > 0, "patch normal is flipped"
    us, vs = np.asarray(us, float), np.asarray(vs, float)
    nu, nv = len(us), len(vs)
    V = (o[None, None, :] + us[:, None, None] * eu[None, None, :] + vs[None, :, None] * ev[None, None, :]).reshape(-1, 3)
    T = []
    for i in range(nu - 1):
        for j in range(nv - 1):
            a, b, c, d = i * nv + j, (i + 1) * nv + j, (i + 1) * nv + j + 1, i * nv + j + 1
            if diag is not None and diag(i, j):
                T += [(a, b, d), (b, c, d)]
            else:
                T += [(a, b, c), (a, c, d)]
    return V, np.array(T, np.int64)


def polytube(pts, r, n=4, hint=None, phase=0.0, caps=(False, False)):
    """Tube through a polyline with shared rings (smooth). Rings sit in the mitre plane at bends.
    hint: vector (or per-node vectors) fixing the ring's first axis; None = use the bend-plane
    normal (for zigzag lacing)."""
    pts = np.asarray(pts, float)
    N = len(pts)
    d = pts[1:] - pts[:-1]
    d = d / np.linalg.norm(d, axis=1)[:, None]
    tang = np.zeros((N, 3))
    mit = np.ones(N)
    tang[0], tang[-1] = d[0], d[-1]
    for i in range(1, N - 1):
        s = d[i - 1] + d[i]
        ls = np.linalg.norm(s)
        tang[i] = s / ls
        mit[i] = min(1.0 / max(ls / 2.0, 1e-6), 2.2)
    e1 = np.zeros((N, 3))
    if hint is not None:
        H = np.broadcast_to(np.asarray(hint, float), (N, 3))
        for i in range(N):
            h = H[i] - np.dot(H[i], tang[i]) * tang[i]
            e1[i] = h / np.linalg.norm(h)
    else:
        assert N >= 3, "zigzag mode needs 3+ points"
        prev = None
        for i in range(1, N - 1):
            c = np.cross(d[i - 1], d[i])
            lc = np.linalg.norm(c)
            if lc < 1e-6:
                assert prev is not None
                c = prev.copy()
            else:
                c = c / lc
            if prev is not None and np.dot(c, prev) < 0:
                c = -c
            e1[i] = c
            prev = c
        for i, j in ((0, 1), (N - 1, N - 2)):
            h = e1[j] - np.dot(e1[j], tang[i]) * tang[i]
            e1[i] = h / np.linalg.norm(h)
    e2 = np.cross(tang, e1)
    V = np.zeros((N, n, 3))
    for k in range(n):
        ang = phase + 2.0 * math.pi * k / n
        V[:, k, :] = pts + r * (math.cos(ang) * e1 + math.sin(ang) * mit[:, None] * e2)
    V = V.reshape(-1, 3)
    T = []
    for i in range(N - 1):
        for k in range(n):
            a, b = i * n + k, i * n + (k + 1) % n
            c, dd = (i + 1) * n + (k + 1) % n, (i + 1) * n + k
            T += [(a, b, c), (a, c, dd)]
    if caps[0]:
        for k in range(1, n - 1):
            T.append((0, k + 1, k))
    if caps[1]:
        o = (N - 1) * n
        for k in range(1, n - 1):
            T.append((o, o + k, o + k + 1))
    T = np.array(T, np.int64)
    # self check: side faces must point away from the path
    tri = V[T[: (N - 1) * n * 2]]
    nrm = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    seg = np.repeat(np.arange(N - 1), n * 2)
    mid = (pts[seg] + pts[seg + 1]) * 0.5
    assert (np.einsum("ij,ij->i", nrm, tri.mean(1) - mid) > 0).all(), "tube winding"
    return V, T


def zigzag(A, B):
    """Interleave A0,B0,A1,B1,...,A_N (len(A) = len(B)+1)."""
    out = []
    for i in range(len(B)):
        out.append(A[i])
        out.append(B[i])
    out.append(A[-1])
    return np.array(out)


def tri_truss(A, B, C, Bchord, Cchord, chord_hint, rc=R_CHORD, rl=R_LACE, rr=R_RUNG):
    """Triangular Warren truss. A: N+1 nodes of the single chord. B, C: N mid-bay nodes of the
    two other chords. Bchord/Cchord: full polylines of those chords (may hold extra points)."""
    A, B, C = np.asarray(A, float), np.asarray(B, float), np.asarray(C, float)
    parts = [
        polytube(A, rc, 4, hint=chord_hint),
        polytube(Bchord, rc, 4, hint=chord_hint),
        polytube(Cchord, rc, 4, hint=chord_hint),
        polytube(zigzag(A, B), rl, 3),
        polytube(zigzag(A, C), rl, 3),
    ]
    for i in range(len(B)):
        parts.append(polytube([B[i], C[i]], rr, 3, hint=A[i + 1] - A[i]))
    return merge(parts)


def ladder_truss(A, B, Bchord, chord_hint, rc=R_CHORD, rl=R_LACE):
    """Flat Warren ladder: chord A (N+1 nodes), chord B (N mid-bay nodes), one zigzag."""
    A, B = np.asarray(A, float), np.asarray(B, float)
    return merge([
        polytube(A, rc, 4, hint=chord_hint),
        polytube(Bchord, rc, 4, hint=chord_hint),
        polytube(zigzag(A, B), rl, 3),
    ])


def straight_nodes(p0, p1, nb, off):
    """Nodes of one chord of a straight truss: (N+1 bay nodes, N mid nodes)."""
    p0, p1, off = np.asarray(p0, float), np.asarray(p1, float), np.asarray(off, float)
    f = np.arange(nb + 1) / nb
    fm = (np.arange(nb) + 0.5) / nb
    return p0 + f[:, None] * (p1 - p0) + off, p0 + fm[:, None] * (p1 - p0) + off


# ----------------------------------------------------------------------------
# arch profile
# ----------------------------------------------------------------------------
def arch_params():
    d = np.array([HALF_SPAN, SPRING_Y - APEX_Y])
    phiA = math.pi / 2 - APEX_SLOPE
    u = np.array([math.cos(phiA), math.sin(phiA)])
    R = -np.dot(d, d) / (2 * np.dot(d, u))
    C = np.array([0.0, APEX_Y]) - R * u
    phiS = math.atan2(SPRING_Y - C[1], HALF_SPAN - C[0])
    return R, C, phiS, phiA


def arch_point(phi):
    R, C, phiS, phiA = arch_params()
    n = np.array([math.cos(phi), math.sin(phi)])
    return C + R * n, n


def arch_nodes():
    """Right half, base -> apex. Returns A nodes (pos, mitred normal) and mid-bay nodes."""
    R, C, phiS, phiA = arch_params()
    A, M = [], []
    for j in range(N_LEG + 1):
        A.append((np.array([HALF_SPAN, LEG_BASE + (SPRING_Y - LEG_BASE) * j / N_LEG]), np.array([1.0, 0.0])))
    for j in range(N_LEG):
        M.append((np.array([HALF_SPAN, LEG_BASE + (SPRING_Y - LEG_BASE) * (j + 0.5) / N_LEG]), np.array([1.0, 0.0])))
    for j in range(1, N_ARC + 1):
        A.append(arch_point(phiS + (phiA - phiS) * j / N_ARC))
    for j in range(N_ARC):
        M.append(arch_point(phiS + (phiA - phiS) * (j + 0.5) / N_ARC))
    # mitred normals at the springing kink and at the apex
    n1, n2 = np.array([1.0, 0.0]), np.array([math.cos(phiS), math.sin(phiS)])
    A[N_LEG] = (A[N_LEG][0], (n1 + n2) / (1 + np.dot(n1, n2)))
    A[-1] = (A[-1][0], np.array([0.0, 1.0 / math.sin(phiA)]))
    return A, M


def build_arch(z0):
    A, M = arch_nodes()
    NH = N_LEG + N_ARC

    def mir(pn):
        p, n = pn
        return np.array([-p[0], p[1]]), np.array([-n[0], n[1]])

    fullA = [mir(a) for a in A] + [A[j] for j in range(NH - 1, -1, -1)]
    fullM = [mir(m) for m in M] + [M[j] for j in range(NH - 1, -1, -1)]

    def p3(p, n, dn, dz):
        return np.array([p[0] + dn * n[0], p[1] + dn * n[1], z0 + dz])

    An = np.array([p3(p, n, 0, 0) for p, n in fullA])
    hw = TRUSS_W / 2
    Bn = np.array([p3(p, n, TRUSS_D, +hw) for p, n in fullM])
    Cn = np.array([p3(p, n, TRUSS_D, -hw) for p, n in fullM])

    def chord(dz):
        pts = []
        pts.append(p3(*fullA[0], TRUSS_D, dz))
        for k, (p, n) in enumerate(fullM):
            pts.append(p3(p, n, TRUSS_D, dz))
            # extra chord points at the kinks (springing left/right) and at the apex
            if k in (N_LEG - 1, NH - 1, 2 * NH - N_LEG - 1):
                q = fullA[k + 1]
                pts.append(p3(q[0], q[1], TRUSS_D, dz))
        pts.append(p3(*fullA[-1], TRUSS_D, dz))
        return np.array(pts)

    return tri_truss(An, Bn, Cn, chord(+hw), chord(-hw), chord_hint=[0, 0, 1.0])


# ----------------------------------------------------------------------------
# moving head
# ----------------------------------------------------------------------------
def moving_head(attach, up, aim):
    """Hanging moving head. attach: point on the truss, up: toward the truss, aim: unit beam dir.
    Returns (body parts, lens part, lens centre)."""
    attach = np.asarray(attach, float)
    u, a = norm(up), norm(aim)
    t = np.cross(u, a)
    if np.linalg.norm(t) < 1e-3:
        t = np.cross(u, [0, 0, 1.0])
    t = norm(t)
    f = np.cross(t, u)
    R = np.stack([t, u, f], axis=1)
    body = [
        box(attach - u * 2.25, (6.5, 2.25, 4.5), R, shared=True),
        box(attach - u * 5.0, (7.9, 1.5, 2.6), R, shared=True),   # sunk into the base and past the arms: no coplanar faces
        box(attach - u * 12.0 + t * 6.7, (0.9, 6.0, 2.3), R, shared=True),
        box(attach - u * 12.0 - t * 6.7, (0.9, 6.0, 2.3), R, shared=True),
    ]
    pivot = attach - u * 15.5
    hy = np.cross(a, t)  # t x hy = a

    def ring(c, r):
        return np.array([c + r * (math.cos(math.radians(45 * k + 22.5)) * t + math.sin(math.radians(45 * k + 22.5)) * hy)
                         for k in range(8)])

    tail, back, front = ring(pivot - a * 8.5, 3.0), ring(pivot - a * 5.0, 5.0), ring(pivot + a * 6.5, 5.0)
    V = np.concatenate([tail, back, front])
    T = []
    for k in range(1, 7):
        T.append((0, k + 1, k))  # tail cap, faces -a
    for r0 in (0, 8):
        for k in range(8):
            a0, b0 = r0 + k, r0 + (k + 1) % 8
            c0, d0 = r0 + 8 + (k + 1) % 8, r0 + 8 + k
            T += [(a0, b0, c0), (a0, c0, d0)]
    body.append((V, np.array(T, np.int64)))
    lens_c = pivot + a * 6.5
    outer, inner = ring(lens_c, 5.0), ring(lens_c, 4.1)
    Vb = np.concatenate([outer, inner])
    Tb = []
    for k in range(8):
        o0, o1, i0, i1 = k, (k + 1) % 8, 8 + k, 8 + (k + 1) % 8
        Tb += [(o0, o1, i1), (o0, i1, i0)]
    body.append((Vb, np.array(Tb, np.int64)))
    lens_v = ring(lens_c, 4.1)
    lens_t = np.array([(0, k, k + 1) for k in range(1, 7)], np.int64)
    # checks: bezel and lens face +a, body shell faces outward
    for VV, TT in ((Vb, np.array(Tb)), (lens_v, lens_t)):
        tri = VV[TT]
        assert (np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]) @ a > 0).all(), "lens winding"
    tri = V[np.array(T)]
    nr = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    assert (np.einsum("ij,ij->i", nr, tri.mean(1) - pivot) > 0).all(), "head winding"
    return merge(body), (lens_v, lens_t), lens_c, a


# ----------------------------------------------------------------------------
# the venue
# ----------------------------------------------------------------------------
class Chunk:
    def __init__(self, name, v, t, mat, kind, smooth, uv, screen):
        self.name, self.v, self.t = name, np.asarray(v, float), np.asarray(t, np.int64)
        self.mat, self.kind, self.smooth, self.uv, self.screen = mat, kind, smooth, uv, screen


class Venue:
    def __init__(self):
        self.chunks = []
        self.fixtures = []
        self.screens = []

    def add(self, name, vt, mat, kind="baked", smooth=False, uv=None, screen=None):
        v, t = vt
        assert len(t) and t.min() >= 0 and t.max() < len(v), name
        self.chunks.append(Chunk(name, v, t, mat, kind, smooth, uv, screen))


def build(buttresses=True):
    V = Venue()

    # ---- floor grid -------------------------------------------------------
    xh = np.concatenate([np.linspace(0, 150, 13), np.linspace(150, 240, 8)[1:], np.linspace(240, 330, 6)[1:]])
    xs = np.concatenate([-xh[:0:-1], xh])
    zs = np.concatenate([
        [-60.0, -45.0], np.linspace(-30, 120, 13),
        120 + 7.0 * np.arange(1, 31), 330 + 10.0 * np.arange(1, 29), 610 + 14.0 * np.arange(1, 26)])
    assert abs(zs[-1] - 960) < 1e-6 and abs(xs[0] + 330) < 1e-6
    xmid = len(xs) // 2
    fv, ft = patch((0, 0, 0), (0, 0, 1), (1, 0, 0), zs, xs, (0, 1, 0), diag=lambda i, j: j >= xmid)
    cen = fv[ft].mean(1)
    hidden = (np.abs(cen[:, 0]) < PL_X) & (cen[:, 2] > PL_BACK) & (cen[:, 2] < PL_FRONT)
    ft = ft[~hidden]
    used = np.unique(ft)
    remap = np.full(len(fv), -1)
    remap[used] = np.arange(len(used))
    V.add("floor", (fv[used], remap[ft]), "floor", kind="floor")
    floor_grid = (len(xs) - 1, len(zs) - 1)

    # ---- LED screens ------------------------------------------------------
    def led(name, x0, x1, y0, y1, z, idx):
        v, t = patch((0, 0, z), (1, 0, 0), (0, 1, 0), [x0, x1], [y0, y1], (0, 0, 1))
        uv = np.stack([(v[:, 0] - x0) / (x1 - x0), (v[:, 1] - y0) / (y1 - y0)], axis=1)
        V.add("led-" + name, (v, t), "led%d" % idx, kind="led", uv=uv, screen=idx)
        V.screens.append(dict(name=name, min=[x0, y0, z], max=[x1, y1, z]))

    led("main", MAIN["x0"], MAIN["x1"], MAIN["y0"], MAIN["y1"], MAIN["z"], 0)
    led("left", -SIDE_X - SIDE_W / 2, -SIDE_X + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 1)
    led("right", SIDE_X - SIDE_W / 2, SIDE_X + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 2)

    # ---- frames / back boxes ---------------------------------------------
    def frame(x0, x1, y0, y1, z, bar, lip, depth, bottom):
        """Border around an LED rectangle: front bars, a lip down to the LED plane, sides and back."""
        X0, X1, Y1 = x0 - bar, x1 + bar, y1 + bar
        Y0 = y0 - bar if bottom else y0
        zf, zb = z + lip, z - depth
        P = []
        P.append(patch((0, 0, zb), (0, 1, 0), (1, 0, 0), [Y0, Y1], [X0, X1], (0, 0, -1)))           # back
        P.append(patch((X1, 0, 0), (0, 1, 0), (0, 0, 1), [Y0, Y1], [zb, zf], (1, 0, 0)))            # right side
        P.append(patch((X0, 0, 0), (0, 0, 1), (0, 1, 0), [zb, zf], [Y0, Y1], (-1, 0, 0)))           # left side
        P.append(patch((0, Y1, 0), (0, 0, 1), (1, 0, 0), [zb, zf], [X0, X1], (0, 1, 0)))            # top
        P.append(patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x1, X1], [Y0, Y1], (0, 0, 1)))            # front right bar
        P.append(patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [X0, x0], [Y0, Y1], (0, 0, 1)))            # front left bar
        P.append(patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x0, x1], [y1, Y1], (0, 0, 1)))            # front top bar
        P.append(patch((x1, 0, 0), (0, 0, 1), (0, 1, 0), [z, zf], [y0, y1], (-1, 0, 0)))            # lip right
        P.append(patch((x0, 0, 0), (0, 1, 0), (0, 0, 1), [y0, y1], [z, zf], (1, 0, 0)))             # lip left
        P.append(patch((0, y1, 0), (1, 0, 0), (0, 0, 1), [x0, x1], [z, zf], (0, -1, 0)))            # lip top
        if bottom:
            P.append(patch((0, Y0, 0), (1, 0, 0), (0, 0, 1), [X0, X1], [zb, zf], (0, -1, 0)))       # underside
            P.append(patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x0, x1], [Y0, y0], (0, 0, 1)))        # front bottom bar
            P.append(patch((0, y0, 0), (0, 0, 1), (1, 0, 0), [z, zf], [x0, x1], (0, 1, 0)))         # lip bottom
        return merge(P)

    V.add("frame-main", frame(MAIN["x0"], MAIN["x1"], MAIN["y0"], MAIN["y1"], MAIN["z"], 4.0, 1.5, 8.0, False), "frame")
    for sx in (-1, 1):
        cx = sx * SIDE_X
        V.add("frame-side", frame(cx - SIDE_W / 2, cx + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 2.5, 1.2, 6.0, True), "frame")

    # ---- plinth -----------------------------------------------------------
    xs12 = np.linspace(-PL_X, PL_X, 13)
    xs24 = np.linspace(-PL_X, PL_X, 25)
    nose = 1.2
    riser_h = PL_TOP / (N_STEPS + 1)
    step_d = (PL_FRONT - PL_TOPFRONT) / N_STEPS
    P, Ptrim = [], []
    # top: a hidden strip under/behind the wall, then the lit front field (separate vertices on purpose)
    P.append(patch((0, PL_TOP, 0), (0, 0, 1), (1, 0, 0), [PL_BACK, -8.0, 1.5], xs12, (0, 1, 0)))
    P.append(patch((0, PL_TOP, 0), (0, 0, 1), (1, 0, 0), [1.5, 6, 12, 20, 30, 42, 56, 70, PL_TOPFRONT - nose], xs24, (0, 1, 0)))
    Ptrim.append(patch((0, PL_TOP, 0), (0, 0, 1), (1, 0, 0), [PL_TOPFRONT - nose, PL_TOPFRONT], xs12, (0, 1, 0)))
    for k in range(N_STEPS + 1):
        zr = PL_TOPFRONT + k * step_d
        ytop = PL_TOP - k * riser_h
        ybot = ytop - riser_h
        Ptrim.append(patch((0, 0, zr), (1, 0, 0), (0, 1, 0), xs12, [ytop - nose, ytop], (0, 0, 1)))   # riser nosing
        P.append(patch((0, 0, zr), (1, 0, 0), (0, 1, 0), xs12, [ybot, ytop - nose], (0, 0, 1)))       # riser
        if k < N_STEPS:
            P.append(patch((0, ybot, 0), (0, 0, 1), (1, 0, 0), [zr, zr + step_d - nose], xs12, (0, 1, 0)))        # tread
            Ptrim.append(patch((0, ybot, 0), (0, 0, 1), (1, 0, 0), [zr + step_d - nose, zr + step_d], xs12, (0, 1, 0)))
    for sx in (-1, 1):
        segs = [(PL_BACK, 1.5, PL_TOP), (1.5, 42.0, PL_TOP), (42.0, PL_TOPFRONT, PL_TOP)]
        for k in range(N_STEPS):
            segs.append((PL_TOPFRONT + k * step_d, PL_TOPFRONT + (k + 1) * step_d, PL_TOP - (k + 1) * riser_h))
        for za, zb, yt in segs:
            if sx > 0:
                P.append(patch((PL_X, 0, 0), (0, 1, 0), (0, 0, 1), [0, yt], [za, zb], (1, 0, 0)))
            else:
                P.append(patch((-PL_X, 0, 0), (0, 0, 1), (0, 1, 0), [za, zb], [0, yt], (-1, 0, 0)))
    P.append(patch((0, 0, PL_BACK), (0, 1, 0), (1, 0, 0), [0, PL_TOP], np.linspace(-PL_X, PL_X, 5), (0, 0, -1)))
    V.add("plinth", merge(P), "plinth")
    V.add("plinth-trim", merge(Ptrim), "trim")

    # ---- arches, capitals, pendants, finials, base plates -----------------
    R, C, phiS, phiA = arch_params()
    arch_parts, blocks, spikes = [], [], []
    y_out_apex = APEX_Y + TRUSS_D / math.sin(phiA)
    for z0 in ARCH_Z:
        arch_parts.append(build_arch(z0))
        for sx in (-1, 1):
            cx, cy, hw_, hh_, ch = sx * (HALF_SPAN + TRUSS_D / 2), SPRING_Y + 2, 14.5, 11.0, 5.0
            blocks.append(prism_xy([(cx - hw_ + ch, cy - hh_), (cx + hw_ - ch, cy - hh_), (cx + hw_, cy - hh_ + ch),
                                    (cx + hw_, cy + hh_ - ch), (cx + hw_ - ch, cy + hh_), (cx - hw_ + ch, cy + hh_),
                                    (cx - hw_, cy + hh_ - ch), (cx - hw_, cy - hh_ + ch)], z0 - 11.5, z0 + 11.5))
            blocks.append(box((sx * (HALF_SPAN + TRUSS_D / 2), 1.5, z0), (22, 1.5, 19), skip=("-y",)))
            spikes.append(spike((sx * (HALF_SPAN + TRUSS_D), SPRING_Y + 10, z0), (0, 1, 0), 4.0, 38))
        # pendant boss: a rhombus that keeps the inner outline pointed
        blocks.append(prism_xy([(0, APEX_Y - 12), (15, APEX_Y + 14), (0, y_out_apex + 10), (-15, APEX_Y + 14)], z0 - 13, z0 + 13))
        spikes.append(spike((0, y_out_apex + 2, z0), (0, 1, 0), 5.0, 62))
    V.add("arches", merge(arch_parts), "truss", smooth=True)

    # ---- ridge and purlins -------------------------------------------------
    ridge_y = APEX_Y + 6
    z_a, z_b = 10.0, ARCH_Z[-1]
    nb = int(round((z_b - z_a) / 28.0))
    A, _ = straight_nodes((0, ridge_y, z_a), (0, ridge_y, z_b), nb, (0, 0, 0))
    Bf, Bm = straight_nodes((0, ridge_y, z_a), (0, ridge_y, z_b), nb, (10, 20, 0))
    Cf, Cm = straight_nodes((0, ridge_y, z_a), (0, ridge_y, z_b), nb, (-10, 20, 0))
    truss_parts = [tri_truss(A, Bm, Cm, np.vstack([Bf[:1], Bm, Bf[-1:]]), np.vstack([Cf[:1], Cm, Cf[-1:]]), chord_hint=[0, 1.0, 0])]
    for sx in (-1, 1):
        z_a, z_b = ARCH_Z[0], ARCH_Z[-1]
        nb = int(round((z_b - z_a) / 28.0))
        xc = sx * (HALF_SPAN + TRUSS_D / 2)
        A, _ = straight_nodes((xc, SPRING_Y - 9, z_a), (xc, SPRING_Y - 9, z_b), nb, (0, 0, 0))
        Bf, Bm = straight_nodes((xc, SPRING_Y - 9, z_a), (xc, SPRING_Y - 9, z_b), nb, (-sx * 10, 22, 0))
        Cf, Cm = straight_nodes((xc, SPRING_Y - 9, z_a), (xc, SPRING_Y - 9, z_b), nb, (sx * 10, 22, 0))
        truss_parts.append(tri_truss(A, Bm, Cm, np.vstack([Bf[:1], Bm, Bf[-1:]]), np.vstack([Cf[:1], Cm, Cf[-1:]]), chord_hint=[0, 1.0, 0]))
    V.add("ridge-purlins", merge(truss_parts), "truss", smooth=True)

    # ---- gable frame behind the screens (towers + rafters) ----------------
    gz = GABLE_Z
    g_parts = []
    tower_top = 400.0
    gable_c = np.array([0.0, 534.0])
    for sx in (-1, 1):
        nb = 15
        A, _ = straight_nodes((sx * (SIDE_X - 10), LEG_BASE, gz), (sx * (SIDE_X - 10), tower_top, gz), nb, (0, 0, 0))
        Bf, Bm = straight_nodes((sx * (SIDE_X + 10), LEG_BASE, gz), (sx * (SIDE_X + 10), tower_top, gz), nb, (0, 0, 0))
        g_parts.append(ladder_truss(A, Bm, np.vstack([Bf[:1], Bm, Bf[-1:]]), chord_hint=[0, 0, 1.0]))
        p0 = np.array([sx * SIDE_X, tower_top + 14, gz])
        p1 = np.array([gable_c[0], gable_c[1], gz])
        dr = norm(p1 - p0)
        m = np.array([-dr[1], dr[0], 0.0]) * (-sx)  # in-plane, pointing up and outward
        nb = 8
        A, _ = straight_nodes(p0, p1, nb, -9 * m)
        Bf, Bm = straight_nodes(p0, p1, nb, 9 * m)
        g_parts.append(ladder_truss(A, Bm, np.vstack([Bf[:1], Bm, Bf[-1:]]), chord_hint=[0, 0, 1.0]))
        blocks.append(box((sx * SIDE_X, tower_top + 12, gz), (16, 14, 8)))
        blocks.append(box((sx * SIDE_X, 1.5, gz), (20, 1.5, 14), skip=("-y",)))
        spikes.append(spike((sx * SIDE_X, tower_top + 24, gz), (0, 1, 0), 4.5, 40))
    blocks.append(box((0, gable_c[1] + 2, gz), (14, 20, 10)))
    spikes.append(spike((0, gable_c[1] + 20, gz), (0, 1, 0), 6.0, 84))
    V.add("gable", merge(g_parts), "truss", smooth=True)

    # ---- flying buttresses: pier + pinnacle + arc flyer up to the springing ----
    if buttresses:
        b_parts = []
        pier_x, pier_top, pier_base = 312.0, 140.0, 5.0
        head = np.array([HALF_SPAN + TRUSS_D + 2, SPRING_Y - 6])
        dy = head[1] - pier_top
        cxb = (pier_x ** 2 - head[0] ** 2 - dy ** 2) / (2 * (pier_x - head[0]))   # arc centre x (tangent vertical at pier top)
        rb = pier_x - cxb
        th1 = math.atan2(dy, head[0] - cxb)
        NP, NA, HB = 5, 5, 7.0

        def bpt(f):
            """f in [0, NP+NA]: centreline point and outward normal (right-hand side)."""
            if f <= NP:
                return np.array([pier_x, pier_base + (pier_top - pier_base) * f / NP]), np.array([1.0, 0.0])
            th = th1 * (f - NP) / NA
            n = np.array([math.cos(th), math.sin(th)])
            return np.array([cxb, pier_top]) + rb * n, n

        for z0 in ARCH_Z:
            for sx in (-1, 1):
                def p3(f, off):
                    p, n = bpt(f)
                    q = p + off * n
                    return np.array([sx * q[0], q[1], z0])
                A = np.array([p3(i, -HB) for i in range(NP + NA + 1)])
                Bm = np.array([p3(i + 0.5, HB) for i in range(NP + NA)])
                Bc = np.vstack([[p3(0, HB)], Bm[:NP], [p3(NP, HB)], Bm[NP:], [p3(NP + NA, HB)]])
                b_parts.append(ladder_truss(A, Bm, Bc, chord_hint=[0, 0, 1.0], rc=R_CHORD * 0.9, rl=R_LACE * 0.9))
                blocks.append(box((sx * pier_x, 2.5, z0), (15, 2.5, 13), skip=("-y",)))
                blocks.append(box((sx * (pier_x + HB), pier_top + 3, z0), (4.5, 4.5, 4.5)))
                spikes.append(spike((sx * (pier_x + HB), pier_top + 7, z0), (0, 1, 0), 3.6, 52))
        V.add("buttresses", merge(b_parts), "truss", smooth=True)

    # ---- PA: arms, drops, bumpers, line arrays ----------------------------
    sp_parts, gr_parts, rig_parts = [], [], []
    BW, BH, BD, BHB = 32.0, 19.5, 24.0, 13.5     # box width, front height, depth, back height
    tilts = [2, 4, 7, 11, 16, 22, 29, 37]
    for sx in (-1, 1):
        xc = sx * PA_X
        raft_y = (tower_top + 14) + (SIDE_X - PA_X) * (gable_c[1] - tower_top - 14) / SIDE_X
        arm_y = raft_y - 3
        blocks.append(box((xc, arm_y, 37.0), (2.6, 3.6, 40.0)))
        blocks.append(box((xc, raft_y, gz), (5.0, 13.0, 4.5)))
        for zz in (PA_Z - 10, PA_Z + 10):
            rig_parts.append(polytube([(xc, arm_y - 3.6, zz), (xc, 306.0, zz)], 0.9, 3, hint=[1.0, 0, 0]))
            blocks.append(box((xc, arm_y - 26.0, zz), (1.9, 5.0, 1.9)))
        blocks.append(box((xc, 303.5, PA_Z), (BW / 2 + 1, 2.0, 15.0)))
        F = np.array([300.0, PA_Z + BD / 2])  # (y, z) of the top front edge
        for th in tilts:
            a = math.radians(th)
            up = np.array([math.cos(a), math.sin(a)])       # (y, z) along the front face
            fw = np.array([-math.sin(a), math.cos(a)])      # (y, z) front normal
            F2 = F - BH * up
            ft, fb = F - 0.45 * up, F2 + 0.45 * up
            bt = F - BD * fw - (BH - BHB) / 2 * up - 0.45 * up
            bb = F2 - BD * fw + (BH - BHB) / 2 * up + 0.45 * up

            def q(p, x):
                return np.array([x, p[0], p[1]])

            xl, xr = xc - BW / 2, xc + BW / 2
            c8 = dict(ftl=q(ft, xl), ftr=q(ft, xr), fbl=q(fb, xl), fbr=q(fb, xr),
                      btl=q(bt, xl), btr=q(bt, xr), bbl=q(bb, xl), bbr=q(bb, xr))
            cen = np.mean(list(c8.values()), axis=0)
            faces = [
                [c8["ftl"], c8["ftr"], c8["btr"], c8["btl"]],   # top
                [c8["fbl"], c8["fbr"], c8["bbr"], c8["bbl"]],   # bottom
                [c8["btl"], c8["btr"], c8["bbr"], c8["bbl"]],   # back
                [c8["ftl"], c8["fbl"], c8["bbl"], c8["btl"]],   # left
                [c8["ftr"], c8["fbr"], c8["bbr"], c8["btr"]],   # right
            ]
            sp_parts.append(convex(faces, centre=cen))
            gr_parts.append(convex([[c8["ftl"], c8["ftr"], c8["fbr"], c8["fbl"]]], centre=cen))
            F = F2
    V.add("speakers", merge(sp_parts), "speaker")
    V.add("grilles", merge(gr_parts), "grille")
    V.add("pa-drops", merge(rig_parts), "truss", smooth=True)

    # ---- moving heads ------------------------------------------------------
    fx_body, fx_lens = [], []
    phi_fx = phiS + (phiA - phiS) * 5.5 / N_ARC
    p2, n2 = arch_point(phi_fx)
    for z0 in ARCH_Z:
        for sx in (-1, 1):
            n3 = np.array([sx * n2[0], n2[1], 0.0])
            attach = np.array([sx * p2[0], p2[1], z0]) - n3 * (R_CHORD * 0.6)
            pivot = attach - n3 * 15.5
            target = np.array([-sx * 60.0, 0.0, z0 + 40.0])
            body, lens, lc, a = moving_head(attach, n3, target - pivot)
            fx_body.append(body)
            fx_lens.append(lens)
            V.fixtures.append(dict(pos=lc.tolist(), dir=a.tolist()))
    for sx in (-1, 1):
        attach = np.array([sx * (HALF_SPAN + TRUSS_D / 2), SPRING_Y - 9 - R_CHORD * 0.6, 220.0])
        pivot = attach - np.array([0, 15.5, 0])
        target = np.array([-sx * 50.0, 60.0, 40.0])
        body, lens, lc, a = moving_head(attach, (0, 1, 0), target - pivot)
        fx_body.append(body)
        fx_lens.append(lens)
        V.fixtures.append(dict(pos=lc.tolist(), dir=a.tolist()))
    V.add("fixtures", merge(fx_body), "fixture", smooth=True)
    V.add("lenses", merge(fx_lens), "lens", kind="lens")

    V.add("blocks", merge(blocks), "block")
    V.add("spikes", merge(spikes), "block")
    V.floor_grid = floor_grid
    return V


def assemble(V):
    """Concatenate chunks in export order. Returns a dict of arrays + group ranges."""
    order = []
    for kind in KIND_ORDER:
        cs = [c for c in V.chunks if c.kind == kind]
        if kind == "led":
            cs.sort(key=lambda c: c.screen)
        order += cs
    pos, tri, uv, mats, smooth, tri_mat, tri_chunk, vkind, vsolid = [], [], [], [], [], [], [], [], []
    groups, off = [], 0
    mat_names = []
    for ci, c in enumerate(order):
        if c.mat not in mat_names:
            mat_names.append(c.mat)
        pos.append(c.v)
        tri.append(c.t + off)
        uv.append(c.uv if c.uv is not None else np.zeros((len(c.v), 2)))
        tri_mat.append(np.full(len(c.t), mat_names.index(c.mat)))
        tri_chunk.append(np.full(len(c.t), ci))
        smooth.append(np.full(len(c.t), c.smooth))
        vkind.append(np.full(len(c.v), KIND_ORDER.index(c.kind)))
        vsolid.append(np.full(len(c.v), c.name in SOLID_CHUNKS or c.kind == "led"))
        off += len(c.v)
    # groups: contiguous index ranges per kind (one per screen for led)
    start = 0
    cur = None
    for c in order:
        key = (c.kind, c.screen)
        n = len(c.t) * 3
        if cur is not None and cur["key"] == key:
            cur["count"] += n
        else:
            cur = dict(key=key, kind=c.kind, screen=c.screen, start=start, count=n)
            groups.append(cur)
        start += n
    names = {"floor": "floor", "baked": "structure", "lens": "lenses"}
    out_groups = []
    for g in groups:
        d = dict(name=names.get(g["kind"], "led-" + V.screens[g["screen"]]["name"] if g["kind"] == "led" else g["kind"]),
                 kind=g["kind"], start=g["start"], count=g["count"])
        if g["kind"] == "led":
            d["screen"] = g["screen"]
        out_groups.append(d)
    return dict(
        pos=np.concatenate(pos), tri=np.concatenate(tri), uv=np.concatenate(uv),
        tri_mat=np.concatenate(tri_mat), tri_chunk=np.concatenate(tri_chunk), smooth=np.concatenate(smooth),
        vkind=np.concatenate(vkind), vsolid=np.concatenate(vsolid), mat_names=mat_names, groups=out_groups,
        chunk_names=[c.name for c in order], screens=V.screens, fixtures=V.fixtures)


def to_blender(p):
    p = np.asarray(p, float)
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1) / UNITS_PER_METRE


if __name__ == "__main__":
    V = build()
    tv = tt = 0
    for c in V.chunks:
        print("%-14s %-8s kind=%-5s verts=%6d tris=%6d" % (c.name, c.mat, c.kind, len(c.v), len(c.t)))
        tv += len(c.v)
        tt += len(c.t)
    print("TOTAL verts=%d tris=%d  (budget 30000 / 45000)" % (tv, tt))
    R, C, phiS, phiA = arch_params()
    print("arch: R=%.1f centre=(%.1f, %.1f) springing kink=%.1f deg, apex slope=%.1f deg" % (
        R, C[0], C[1], math.degrees(phiS), 90 - math.degrees(phiA)))
    D = assemble(V)
    assert D["pos"][:, 1].min() >= 0.0, "geometry under the floor"
    print("bounds", D["pos"].min(0), D["pos"].max(0))
    print("groups", D["groups"])
    print("fixtures", len(D["fixtures"]), "floor grid", V.floor_grid)
