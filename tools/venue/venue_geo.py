# venue_geo.py -- procedural geometry for the Relic "truss cathedral" venue (second build, 2026-11-18).
# Pure numpy, no bpy. Everything is authored in EXPORTED space:
#   three.js axes (X right, Y up, Z toward the viewer), 20 units = 1 metre.
# Blender space is (x, -z, y) / 20 (see to_blender()).
#
# Hard edges are made by NOT sharing vertices; smooth parts (tubes) share them.
# The mesh that Blender bakes is vertex-for-vertex the mesh that is exported.
#
# Level of detail is set by distance from the camera (which looks from +z toward the wall at z = 0):
#   near  (arches at z 710, 850 and everything beside them): 8-sided chords, 6-sided lacing,
#         conical couplers with pins at every section joint, outriggers + ballast, cable looms, chains
#   mid   (z 430, 570): 6-sided chords, 4-sided lacing, couplers without pins, two outriggers
#   far   (z 150, 290 and the wall end): 5-sided chords, 3-sided lacing, no couplers
# Every vertex carries a piece number (which truss section or unit it flies in with, js/venue.js)
# and two wear values in its texture coordinates (u: dark steel hardware, v: grille / edge).
import math
import numpy as np

UNITS_PER_METRE = 20.0
KIND_ORDER = ["floor", "baked", "coat", "led", "lens", "glow"]

# ----------------------------------------------------------------------------
# design constants (exported units)
# ----------------------------------------------------------------------------
ARCH_Z = [150.0, 290.0, 430.0, 570.0, 710.0, 850.0]
ARCH_TIER = ["far", "far", "mid", "mid", "near", "near"]
LOD = {
    "near": dict(nc=8, nl=6, cpl=True, pins=True),
    "mid": dict(nc=6, nl=4, cpl=True, pins=False),
    "far": dict(nc=5, nl=3, cpl=False, pins=False),
}
HALF_SPAN = 220.0          # inner chord of the legs at x = +-220
SPRING_Y = 250.0
APEX_Y = 520.0
APEX_SLOPE = math.radians(24.0)
TRUSS_D = 30.0             # arch truss depth (inner chord -> outer chords)
TRUSS_W = 26.0             # arch truss width along the nave
N_LEG = 8
N_ARC = 12
R_CHORD = 2.1
R_LACE = 1.15
R_RUNG = 1.0
LEG_BASE = 3.0             # trusses start on top of their base plates

MAIN = dict(x0=-110.0, x1=110.0, y0=46.0, y1=436.0, z=0.0)
SIDE_W, SIDE_H, SIDE_Y0, SIDE_Z, SIDE_X = 46.0, 300.0, 70.0, 14.0, 178.0

ST_X, ST_TOP, ST_BACK, ST_FRONT = 150.0, 46.0, -30.0, 84.0     # stage deck
STAIR_X, N_STEPS, STEP_D = 50.0, 3, 13.0                        # centre stair unit
PA_X, PA_Z = 236.0, 60.0     # outboard of the side screens, clear of the picture
TOWER_Z = -9.0             # gable towers and header, behind the screens
HEADER_Y = 490.0
BEAM_X, BEAM_Y = 200.0, 205.0   # the lighting beams (box truss) hung under the arches
FLOOR_X = 460.0


def tier_of_z(z):
    return "near" if z > 640 else ("mid" if z > 360 else "far")


def norm(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def perp(a, hint=None):
    a = norm(a)
    h = np.asarray(hint, float) if hint is not None else (np.array([1.0, 0, 0]) if abs(a[0]) < 0.9 else np.array([0, 1.0, 0]))
    h = h - np.dot(h, a) * a
    if np.linalg.norm(h) < 1e-6:
        h = np.array([0, 0, 1.0]) - a[2] * a
    return norm(h)


# ----------------------------------------------------------------------------
# primitives -> (verts (n,3), tris (m,3))
# ----------------------------------------------------------------------------
def merge(parts):
    parts = [p for p in parts if p is not None and len(p[1])]
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
        n += np.cross(f[i], f[(i + 1) % len(f)])
    return n


def convex(faces, centre=None):
    """Convex solid from polygon faces, each oriented outward from the centre; every face owns its vertices."""
    pts = np.array([p for f in faces for p in f], float)
    c = pts.mean(0) if centre is None else np.asarray(centre, float)
    V, T = [], []
    for f in faces:
        f = np.asarray(f, float)
        if np.dot(poly_normal(f), f.mean(0) - c) < 0:
            f = f[::-1]
        base = len(V)
        V.extend(f)
        for k in range(1, len(f) - 1):
            T.append((base, base + k, base + k + 1))
    return np.array(V), np.array(T, np.int64)


def box(c, half, R=None, skip=()):
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
    return convex([F[k] for k in F if k not in skip], centre=c)


def bar(p0, p1, w, h=None, up=(0, 1.0, 0)):
    """Rectangular bar from p0 to p1 (hard edges), w across, h along 'up'."""
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    a = p1 - p0
    L = np.linalg.norm(a)
    a = a / L
    ev = perp(a, up)
    eu = np.cross(ev, a)
    R = np.stack([eu, ev, a], axis=1)
    return box((p0 + p1) / 2, (w / 2, (h or w) / 2, L / 2), R)


def patch(o, eu, ev, us, vs, expect, diag=None):
    """Planar grid. Vertex (i,j) = o + us[i]*eu + vs[j]*ev. Normal = eu x ev (checked against expect)."""
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


def tube_rings(pts, r, n=4, hint=None, phase=0.0, radii=None, phases=None):
    """Rings (N, n, 3) of a tube through a polyline. Rings sit in the mitre plane at bends.
    hint: vector (or per-node vectors) fixing the ring's first axis; None = bend-plane normal (zigzags)."""
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
    rr = np.full(N, float(r)) if radii is None else np.asarray(radii, float)
    ph = np.full(N, float(phase)) if phases is None else np.asarray(phases, float)
    V = np.zeros((N, n, 3))
    for k in range(n):
        ang = ph + 2.0 * math.pi * k / n
        V[:, k, :] = pts + rr[:, None] * (np.cos(ang)[:, None] * e1 + np.sin(ang)[:, None] * mit[:, None] * e2)
    return V


def rings_mesh(V, caps=(False, False)):
    N, n, _ = V.shape
    T = []
    for i in range(N - 1):
        for k in range(n):
            a, b = i * n + k, i * n + (k + 1) % n
            c, dd = (i + 1) * n + (k + 1) % n, (i + 1) * n + k
            T += [(a, b, c), (a, c, dd)]
    W = V.reshape(-1, 3)
    extra = []
    for end, flip in ((0, True), (N - 1, False)):
        if not caps[0 if end == 0 else 1]:
            continue
        # caps own their vertices (hard edge against the side)
        base = len(W) + sum(len(e) for e in extra)
        ring = V[end]
        extra.append(np.vstack([ring.mean(0)[None], ring]))
        for k in range(n):
            a, b = base + 1 + k, base + 1 + (k + 1) % n
            T.append((base, b, a) if flip else (base, a, b))
    if extra:
        W = np.vstack([W] + extra)
    return W, np.array(T, np.int64)


def polytube(pts, r, n=4, hint=None, phase=0.0, caps=(False, False)):
    return rings_mesh(tube_rings(pts, r, n, hint, phase), caps)


def lathe(c, axis, prof, n, hint=None, phase=0.0, caps=(False, False)):
    """Surface of revolution about axis through c. prof: [(t, r), ...] along the axis."""
    a = norm(axis)
    c = np.asarray(c, float)
    e1 = perp(a, hint)
    e2 = np.cross(a, e1)
    V = np.zeros((len(prof), n, 3))
    for i, (t, r) in enumerate(prof):
        for k in range(n):
            ang = phase + 2 * math.pi * k / n
            V[i, k] = c + a * t + r * (math.cos(ang) * e1 + math.sin(ang) * e2)
    return rings_mesh(V, caps)


def zigzag(A, B):
    """Interleave A0,B0,A1,B1,...,A_N (len(A) = len(B)+1)."""
    out = []
    for i in range(len(B)):
        out.append(A[i])
        out.append(B[i])
    out.append(A[-1])
    return np.array(out)


def coupler(p, tang, rc, n, pins, hint=None):
    """Conical coupler around a chord at p: a double cone with a flat collar; near ones get a pin."""
    k = 1.42
    prof = [(-3.6, rc * 1.0), (-1.5, rc * k), (1.5, rc * k), (3.6, rc * 1.0)]
    parts = [lathe(p, tang, prof, n, hint=hint, phase=math.pi / n)]
    if pins:
        e = perp(tang, hint)
        parts.append(polytube([p - e * rc * 2.0, p + e * rc * 2.0], 0.42, 4, hint=tang))
    return merge(parts)


def chain(p_top, p_bot, r=0.55, link=2.3):
    """A hanging chain: alternating fat and thin rings turned 45 degrees, so it reads as links."""
    p_top, p_bot = np.asarray(p_top, float), np.asarray(p_bot, float)
    L = np.linalg.norm(p_bot - p_top)
    N = max(3, int(L / (link * 0.5)) + 1)
    pts = p_top + np.linspace(0, 1, N)[:, None] * (p_bot - p_top)
    radii = np.where(np.arange(N) % 2 == 0, r, r * 0.45)
    phases = np.where(np.arange(N) % 4 < 2, 0.0, math.pi / 4)
    return rings_mesh(tube_rings(pts, r, 4, hint=[1.0, 0, 0], radii=radii, phases=phases))


def wire(p_top, p_bot, r=0.32):
    return polytube([p_top, p_bot], r, 3, hint=[1.0, 0, 0])


def hoist(p_top, length=12.0, r=4.2):
    """Chain hoist motor body hanging from p_top: a hook block, the round motor and its gearbox."""
    p_top = np.asarray(p_top, float)
    y = np.array([0, 1.0, 0])
    body = lathe(p_top - y * (3 + length / 2), y, [(-length / 2, r * 0.8), (-length / 2 + 1.2, r), (length / 2 - 1.2, r), (length / 2, r * 0.8)],
                 8, caps=(True, True))
    hook = box(p_top - y * 1.5, (1.0, 1.8, 1.0))
    gear = box(p_top - y * (3 + length / 2) + np.array([r + 1.2, 0, 0]), (1.4, length * 0.32, r * 0.7))
    return merge([body, hook, gear]), p_top - y * (3 + length)


# ----------------------------------------------------------------------------
# trusses
# ----------------------------------------------------------------------------
def straight_truss(p0, p1, up, corners, nb, lod, rc=R_CHORD, rl=R_LACE, cuts=None, end_cpl=False):
    """Straight truss from p0 to p1 with chords at 'corners' [(u, v)] in the frame (eu, ev = up).
    Returns a list of sections: dict(truss=mesh, steel=mesh|None, a=, b=, mid=point)."""
    nc, nl = lod["nc"], lod["nl"]
    p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
    d = p1 - p0
    a_ = norm(d)
    ev = perp(a_, up)
    eu = np.cross(ev, a_)
    t = np.arange(nb + 1) / nb
    cuts = cuts or [0, nb]
    C = [p0 + t[:, None] * d + u * eu + v * ev for (u, v) in corners]
    rings = [tube_rings(c, rc, nc, hint=ev, phase=math.pi / nc) for c in C]
    m = len(corners)
    out = []
    for si in range(len(cuts) - 1):
        a, b = cuts[si], cuts[si + 1]
        parts = [rings_mesh(R[a:b + 1]) for R in rings]
        for f in range(m if m > 2 else 1):
            ca, cb = C[f], C[(f + 1) % m]
            zz = np.array([(ca if (i + f) % 2 == 0 else cb)[i] for i in range(a, b + 1)])
            if len(zz) >= 3:
                parts.append(polytube(zz, rl, nl))
            else:
                parts.append(polytube(zz, rl, nl, hint=ev))
        steel = []
        if lod["cpl"]:
            ks = [b] if b != nb else []
            if end_cpl:
                ks = sorted(set(ks + [a, b]))
            for k in ks:
                for c in C:
                    steel.append(coupler(c[k], a_, rc, nc, lod["pins"], hint=ev))
        out.append(dict(truss=merge(parts), steel=merge(steel) if steel else None, a=a, b=b,
                        mid=p0 + d * (a + b) / (2 * nb)))
    return out


def box_corners(w, h):
    return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]


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


def arch_y_at_x(x):
    """Height of the inner chord of the arc (right half) where it passes x."""
    R, C, phiS, phiA = arch_params()
    lo, hi = phiS, phiA
    for _ in range(60):
        mid = (lo + hi) / 2
        if arch_point(mid)[0][0] > x:
            lo = mid
        else:
            hi = mid
    return arch_point(lo)[0][1]


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
    n1, n2 = np.array([1.0, 0.0]), np.array([math.cos(phiS), math.sin(phiS)])
    A[N_LEG] = (A[N_LEG][0], (n1 + n2) / (1 + np.dot(n1, n2)))
    A[-1] = (A[-1][0], np.array([0.0, 1.0 / math.sin(phiA)]))
    return A, M


NH = N_LEG + N_ARC
ARCH_CUTS = [0, 4, 8, 12, 16, NH + 4, NH + 8, NH + 12, NH + 16, 2 * NH]
KINKS = [N_LEG, NH, 2 * NH - N_LEG]


def build_arch(z0, lod):
    """One arch as truss sections (left leg low, left leg high, ..., crown, ..., right leg low).
    Returns list of dict(truss, steel, a, b, side)."""
    nc, nl = lod["nc"], lod["nl"]
    A, M = arch_nodes()

    def mir(pn):
        p, n = pn
        return np.array([-p[0], p[1]]), np.array([-n[0], n[1]])

    fullA = [mir(a) for a in A] + [A[j] for j in range(NH - 1, -1, -1)]
    fullM = [mir(m) for m in M] + [M[j] for j in range(NH - 1, -1, -1)]

    def p3(p, n, dn, dz):
        return np.array([p[0] + dn * n[0], p[1] + dn * n[1], z0 + dz])

    hw = TRUSS_W / 2
    An = np.array([p3(p, n, 0, 0) for p, n in fullA])
    Bn = np.array([p3(p, n, TRUSS_D, +hw) for p, n in fullM])
    Cn = np.array([p3(p, n, TRUSS_D, -hw) for p, n in fullM])
    keys = sorted(set(ARCH_CUTS + KINKS))

    def outer(dz):
        s, pts = [], []
        for k in range(2 * NH + 1):
            if k in keys:
                s.append(float(k))
                pts.append(p3(*fullA[k], TRUSS_D, dz))
            if k < 2 * NH:
                s.append(k + 0.5)
                pts.append(p3(*fullM[k], TRUSS_D, dz))
        return np.array(s), np.array(pts)

    sB, PB = outer(+hw)
    sC, PC = outer(-hw)
    hint = [0, 0, 1.0]
    RA = tube_rings(An, R_CHORD, nc, hint=hint, phase=math.pi / nc)
    RB = tube_rings(PB, R_CHORD, nc, hint=hint, phase=math.pi / nc)
    RC = tube_rings(PC, R_CHORD, nc, hint=hint, phase=math.pi / nc)
    sections = []
    for si in range(len(ARCH_CUTS) - 1):
        a, b = ARCH_CUTS[si], ARCH_CUTS[si + 1]
        ib = np.nonzero((sB >= a) & (sB <= b))[0]
        parts = [rings_mesh(RA[a:b + 1]), rings_mesh(RB[ib[0]:ib[-1] + 1]), rings_mesh(RC[ib[0]:ib[-1] + 1]),
                 polytube(zigzag(An[a:b + 1], Bn[a:b]), R_LACE, nl),
                 polytube(zigzag(An[a:b + 1], Cn[a:b]), R_LACE, nl)]
        for i in range(a, b):
            parts.append(polytube([Bn[i], Cn[i]], R_RUNG, nl, hint=An[i + 1] - An[i]))
        steel = []
        if lod["cpl"]:
            # couplers at the joints, carried by the section nearer the floor
            ks = [b] if b <= NH else ([a] if a >= NH else [])
            ks = [k for k in ks if 0 < k < 2 * NH]
            for k in ks:
                tng = norm(An[min(k + 1, 2 * NH)] - An[max(k - 1, 0)])
                for P in (An[k], p3(*fullA[k], TRUSS_D, +hw), p3(*fullA[k], TRUSS_D, -hw)):
                    steel.append(coupler(P, tng, R_CHORD, nc, lod["pins"], hint=hint))
        side = -1 if b <= NH and a < 16 else (1 if a >= NH + 4 else 0)
        sections.append(dict(truss=merge(parts), steel=merge(steel) if steel else None, a=a, b=b, side=side))
    return sections


# ----------------------------------------------------------------------------
# moving head (black, hanging)
# ----------------------------------------------------------------------------
def moving_head(attach, aim):
    """Hanging moving head under a truss. attach: point under the bottom chord, aim: unit beam dir.
    Returns (body, steel clamp, lens part, lens centre, aim)."""
    attach = np.asarray(attach, float)
    u = np.array([0, 1.0, 0])
    a = norm(aim)
    t = np.cross(u, a)
    if np.linalg.norm(t) < 1e-3:
        t = np.array([1.0, 0, 0])
    t = norm(t)
    f = np.cross(t, u)
    R = np.stack([t, u, f], axis=1)
    clamp = box(attach - u * 1.8, (1.6, 3.2, 2.6))
    body = [
        lathe(attach - u * 3.2, -u, [(0, 6.6), (3.6, 6.6), (4.4, 6.0)], 10, caps=(True, True)),     # base
        box(attach - u * 8.6, (8.6, 1.2, 2.6), R),                                                       # yoke top
        box(attach - u * 15.2 + t * 7.4, (0.9, 6.2, 2.4), R),                                            # yoke arms
        box(attach - u * 15.2 - t * 7.4, (0.9, 6.2, 2.4), R),
    ]
    pivot = attach - u * 17.0
    body.append(polytube([pivot - t * 7.0, pivot + t * 7.0], 1.4, 6, hint=a))                           # tilt axle
    head = lathe(pivot, a, [(-8.0, 3.2), (-6.4, 4.8), (4.8, 5.2), (6.5, 5.2)], 10, caps=(True, False))
    body.append(head)
    lens_c = pivot + a * 6.5
    # bezel: ring from the barrel's lip in to the lens
    e1 = perp(a)
    e2 = np.cross(a, e1)
    ring = lambda c, r: np.array([c + r * (math.cos(2 * math.pi * k / 10) * e1 + math.sin(2 * math.pi * k / 10) * e2) for k in range(10)])
    outer, inner = ring(lens_c, 5.2), ring(lens_c + a * 0.01, 4.0)
    Vb = np.concatenate([outer, inner])
    Tb = []
    for k in range(10):
        o0, o1, i0, i1 = k, (k + 1) % 10, 10 + k, 10 + (k + 1) % 10
        Tb += [(o0, o1, i1), (o0, i1, i0)]
    Tb = np.array(Tb, np.int64)
    tri = Vb[Tb]
    if (np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]) @ a < 0).any():
        Tb = Tb[:, ::-1]
    body.append((Vb, Tb))
    lens_v = np.vstack([(lens_c - a * 0.6)[None], ring(lens_c - a * 0.6, 4.0)])
    lens_t = np.array([(0, 1 + k, 1 + (k + 1) % 10) for k in range(10)], np.int64)
    tri = lens_v[lens_t]
    if (np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]) @ a < 0).any():
        lens_t = lens_t[:, ::-1]
    return merge(body), clamp, (lens_v, lens_t), lens_v.mean(0), a


# ----------------------------------------------------------------------------
# the venue
# ----------------------------------------------------------------------------
class Chunk:
    def __init__(self, name, v, t, mat, kind, smooth, uv, screen, piece, solid):
        self.name, self.v, self.t = name, np.asarray(v, float), np.asarray(t, np.int64)
        self.mat, self.kind, self.smooth, self.uv, self.screen = mat, kind, smooth, uv, screen
        self.piece, self.solid = piece, solid


class Venue:
    def __init__(self):
        self.chunks = []
        self.fixtures = []
        self.screens = []
        self.npieces = 0

    def new_piece(self):
        self.npieces += 1
        return self.npieces

    def add(self, name, vt, mat, kind="baked", smooth=False, uv=None, screen=None, piece=0, wear=(0.0, 0.0), solid=False):
        if vt is None:
            return
        v, t = vt
        assert len(t) and t.min() >= 0 and t.max() < len(v), name
        if uv is None:
            uv = np.broadcast_to(np.asarray(wear, float), (len(v), 2)).copy()
        self.chunks.append(Chunk(name, v, t, mat, kind, smooth, uv, screen, piece, solid))


# wear values carried in the texture coordinates of non-screen vertices (js/venue.js reads them)
W_TRUSS = (0.0, 0.0)
W_STEEL = (1.0, 0.0)      # couplers, pins, plates: darker steel
W_PLATE = (0.7, 0.0)
W_CHAIN = (0.85, 0.0)
W_GRILLE = (0.0, 1.0)     # speaker grille: perforated
W_EDGE = (0.0, 0.5)       # nosings, rails: worn bright edge


def build():
    V = Venue()

    # ---- floor grid -------------------------------------------------------
    xh = np.concatenate([np.linspace(0, 150, 13), np.linspace(150, 260, 10)[1:], np.linspace(260, FLOOR_X, 8)[1:]])
    xs = np.concatenate([-xh[:0:-1], xh])
    zs = np.concatenate([
        [-60.0, -45.0], np.linspace(-30, 84, 11), [96.0, 108.0, 120.0],
        120 + 7.0 * np.arange(1, 31), 330 + 10.0 * np.arange(1, 29), 610 + 14.0 * np.arange(1, 26)])
    assert abs(zs[-1] - 960) < 1e-6 and abs(xs[0] + FLOOR_X) < 1e-6
    xmid = len(xs) // 2
    fv, ft = patch((0, 0, 0), (0, 0, 1), (1, 0, 0), zs, xs, (0, 1, 0), diag=lambda i, j: j >= xmid)
    cen = fv[ft].mean(1)
    hidden = (np.abs(cen[:, 0]) < ST_X) & (cen[:, 2] > ST_BACK) & (cen[:, 2] < ST_FRONT)
    ft = ft[~hidden]
    used = np.unique(ft)
    remap = np.full(len(fv), -1)
    remap[used] = np.arange(len(used))
    V.add("floor", (fv[used], remap[ft]), "floor", kind="floor", solid=True)
    V.floor_grid = (len(xs) - 1, len(zs) - 1)

    # ---- LED screens ------------------------------------------------------
    def led(name, x0, x1, y0, y1, z, idx):
        v, t = patch((0, 0, z), (1, 0, 0), (0, 1, 0), [x0, x1], [y0, y1], (0, 0, 1))
        uv = np.stack([(v[:, 0] - x0) / (x1 - x0), (v[:, 1] - y0) / (y1 - y0)], axis=1)
        V.add("led-" + name, (v, t), "led%d" % idx, kind="led", uv=uv, screen=idx, solid=True)
        V.screens.append(dict(name=name, min=[x0, y0, z], max=[x1, y1, z]))

    led("main", MAIN["x0"], MAIN["x1"], MAIN["y0"], MAIN["y1"], MAIN["z"], 0)
    led("left", -SIDE_X - SIDE_W / 2, -SIDE_X + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 1)
    led("right", SIDE_X - SIDE_W / 2, SIDE_X + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 2)

    # ---- screen frames, bumpers, hoists ------------------------------------
    def frame(x0, x1, y0, y1, z, bar_, lip, depth, bottom):
        X0, X1, Y1 = x0 - bar_, x1 + bar_, y1 + bar_
        Y0 = y0 - bar_ if bottom else y0
        zf, zb = z + lip, z - depth
        P = [patch((0, 0, zb), (0, 1, 0), (1, 0, 0), [Y0, Y1], [X0, X1], (0, 0, -1)),
             patch((X1, 0, 0), (0, 1, 0), (0, 0, 1), [Y0, Y1], [zb, zf], (1, 0, 0)),
             patch((X0, 0, 0), (0, 0, 1), (0, 1, 0), [zb, zf], [Y0, Y1], (-1, 0, 0)),
             patch((0, Y1, 0), (0, 0, 1), (1, 0, 0), [zb, zf], [X0, X1], (0, 1, 0)),
             patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x1, X1], [Y0, Y1], (0, 0, 1)),
             patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [X0, x0], [Y0, Y1], (0, 0, 1)),
             patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x0, x1], [y1, Y1], (0, 0, 1)),
             patch((x1, 0, 0), (0, 0, 1), (0, 1, 0), [z, zf], [y0, y1], (-1, 0, 0)),
             patch((x0, 0, 0), (0, 1, 0), (0, 0, 1), [y0, y1], [z, zf], (1, 0, 0)),
             patch((0, y1, 0), (1, 0, 0), (0, 0, 1), [x0, x1], [z, zf], (0, -1, 0))]
        if bottom:
            P += [patch((0, Y0, 0), (1, 0, 0), (0, 0, 1), [X0, X1], [zb, zf], (0, -1, 0)),
                  patch((0, 0, zf), (1, 0, 0), (0, 1, 0), [x0, x1], [Y0, y0], (0, 0, 1)),
                  patch((0, y0, 0), (0, 0, 1), (1, 0, 0), [z, zf], [x0, x1], (0, 1, 0))]
        return merge(P)

    pw = V.new_piece()
    V.add("frame-main", frame(MAIN["x0"], MAIN["x1"], MAIN["y0"], MAIN["y1"], MAIN["z"], 5.0, 1.5, 8.0, False), "coat", "coat", piece=pw, solid=True)
    # rigging bumper on top of the wall: a flying bar with pick-up ears, four chains up to hoists on the header
    bump = [box((0, 445.0, -2.5), (121.0, 3.5, 4.5))]
    ears = []
    for ex in (-100.0, -40.0, 40.0, 100.0):
        ears.append(box((ex, 449.5, 0.0), (1.2, 1.5, 2.2)))
    V.add("bumper", merge(bump), "coat", "coat", piece=pw, solid=True)
    V.add("bumper-ears", merge(ears), "steel", wear=W_STEEL, piece=pw)
    hb = HEADER_Y - 12.0 - 2.1          # under the header's bottom chords
    for ex in (-100.0, -40.0, 40.0, 100.0):
        mot, bot = hoist((ex, hb, 0.0), 11.0, 3.8)
        ph = V.new_piece()
        V.add("wall-hoist", mot, "coat", "coat", piece=ph)
        V.add("wall-chain", chain((ex, bot[1], 0.0), (ex, 451.0, 0.0)), "steel", wear=W_CHAIN, piece=pw, smooth=True)
        # slack chain hanging from the motor beside the load chain
        V.add("wall-chain", chain((ex - 5.6, bot[1] + 4, 0.0), (ex - 5.6, bot[1] - 14, 0.0)), "steel",
              wear=W_CHAIN, piece=ph, smooth=True)
    for sx in (-1, 1):
        cx = sx * SIDE_X
        ps = V.new_piece()
        V.add("frame-side", frame(cx - SIDE_W / 2, cx + SIDE_W / 2, SIDE_Y0, SIDE_Y0 + SIDE_H, SIDE_Z, 2.5, 1.2, 6.0, True), "coat", "coat",
              piece=ps, solid=True)
        # clamps tying the side screen back to its tower
        cl = [bar((cx + dx, yy, SIDE_Z - 5.5), (cx + dx, yy, TOWER_Z + 12.0 + 1.2), 1.6) for dx in (-9.0, 9.0) for yy in (110.0, 330.0)]
        V.add("side-clamps", merge(cl), "steel", wear=W_STEEL, piece=ps)

    # ---- stage: deck, fascia, centre stair, white edge light ---------------
    pst = V.new_piece()
    xs24 = np.linspace(-ST_X, ST_X, 25)
    P, Pn = [], []
    lip_z = ST_FRONT
    P.append(patch((0, ST_TOP, 0), (0, 0, 1), (1, 0, 0), [ST_BACK, -8.0, 1.5], np.linspace(-ST_X, ST_X, 13), (0, 1, 0)))
    P.append(patch((0, ST_TOP, 0), (0, 0, 1), (1, 0, 0), [1.5, 6, 12, 20, 30, 42, 56, 70, lip_z - 2.5], xs24, (0, 1, 0)))
    # sides and back
    for sx in (-1, 1):
        if sx > 0:
            P.append(patch((ST_X, 0, 0), (0, 1, 0), (0, 0, 1), [0, ST_TOP], [ST_BACK, 0, 40, lip_z], (1, 0, 0)))
        else:
            P.append(patch((-ST_X, 0, 0), (0, 0, 1), (0, 1, 0), [ST_BACK, 0, 40, lip_z], [0, ST_TOP], (-1, 0, 0)))
    P.append(patch((0, 0, ST_BACK), (0, 1, 0), (1, 0, 0), [0, ST_TOP], np.linspace(-ST_X, ST_X, 5), (0, 0, -1)))
    # fascia: a recessed backing with skirt panels in front of it (the seams read dark)
    P.append(patch((0, 0, lip_z - 0.8), (1, 0, 0), (0, 1, 0), np.linspace(-ST_X, ST_X, 7), [0, 43.0], (0, 0, 1)))
    fas = []
    edges = [STAIR_X, 100.0, ST_X]
    for sx in (-1, 1):
        for a, b in zip(edges[:-1], edges[1:]):
            x0, x1 = sorted((sx * (a + 0.6), sx * (b - 0.6)))
            fas.append(box(((x0 + x1) / 2, 21.25, lip_z - 0.4), ((x1 - x0) / 2, 21.25, 0.4), skip=("-z", "-y")))
    V.add("stage", merge(P), "coat", "coat", piece=pst, solid=True)
    V.add("fascia", merge(fas), "coat", "coat", piece=pst, solid=True)
    # aluminium nosing along the lip and the treads
    Pn.append(box((0, 44.8, lip_z - 1.25), (ST_X, 1.5, 1.25), skip=("-z",)))
    rh = ST_TOP / (N_STEPS + 1)
    stair = []
    for k in range(1, N_STEPS + 1):
        z0, z1 = lip_z + (k - 1) * STEP_D, lip_z + k * STEP_D
        top = ST_TOP - k * rh
        stair.append(box((0, top / 2, (z0 + z1) / 2), (STAIR_X, top / 2, (z1 - z0) / 2), skip=("-y", "-z")))
        Pn.append(box((0, top + 0.3, z1 - 0.7), (STAIR_X + 0.4, 0.3, 0.9), skip=("-y",)))
    # handrails: posts and a rail each side of the stair
    rail = []
    zr0, zr1 = lip_z - 4.0, lip_z + N_STEPS * STEP_D - 3.0
    for sx in (-1, 1):
        x = sx * (STAIR_X - 2.0)
        for zz, yb in ((zr0, ST_TOP), (zr1, ST_TOP - N_STEPS * rh)):
            rail.append(polytube([(x, yb, zz), (x, yb + 20.0, zz)], 0.7, 5, hint=[1.0, 0, 0]))
        rail.append(polytube([(x, ST_TOP + 20.0, zr0), (x, ST_TOP - N_STEPS * rh + 20.0, zr1)], 0.75, 5, hint=[1.0, 0, 0]))
    V.add("stair", merge(stair), "coat", "coat", piece=pst, solid=True)
    V.add("nosing", merge(Pn), "trim", wear=W_EDGE, piece=pst, solid=True)
    V.add("handrail", merge(rail), "truss", piece=pst, smooth=True)
    # the edge light: an LED channel standing proud of the lip's nosing
    glow = box((0, 45.2, lip_z + 0.35), (ST_X - 1.0, 0.45, 0.35), skip=("-z",))
    V.add("edge-light", glow, "glow", kind="glow", piece=pst)

    # ---- arches with clustered piers ---------------------------------------
    pier_heads = []
    for ai, z0 in enumerate(ARCH_Z):
        tier = ARCH_TIER[ai]
        lod = LOD[tier]
        secs = build_arch(z0, lod)
        leg_piece = {}
        for s in secs:
            pid = V.new_piece()
            if s["a"] == 0:
                leg_piece[-1] = pid
            if s["b"] == 2 * NH:
                leg_piece[1] = pid
            V.add("arch-%s" % tier, s["truss"], "truss", smooth=True, piece=pid)
            V.add("arch-cpl", s["steel"], "steel", wear=W_STEEL, smooth=True, piece=pid)
        for sx in (-1, 1):
            base_piece = leg_piece[sx]
            xa = sx * HALF_SPAN
            xo = sx * (HALF_SPAN + TRUSS_D)
            # the two shafts that cluster with the leg (front and back along the nave)
            for sz in (-1, 1):
                zc = z0 + sz * 28.0
                cx = sx * (HALF_SPAN + 15.0)
                corners = [(-8.0, -sz * 5.0), (8.0, -sz * 5.0), (0.0, sz * 9.0)]
                top = SPRING_Y - 12.0
                shaft = straight_truss((cx, LEG_BASE, zc), (cx, top, zc), (0, 0, 1.0), corners, 9, lod,
                                       rc=R_CHORD * 0.9, rl=R_LACE, cuts=[0, 4, 9])
                for s in shaft:
                    pid = V.new_piece()
                    V.add("shaft-%s" % tier, s["truss"], "truss", smooth=True, piece=pid)
                    V.add("shaft-cpl", s["steel"], "steel", wear=W_STEEL, smooth=True, piece=pid)
                    if s["b"] == 9:
                        # head plate and ties back to the leg
                        head = box((cx, top + 1.8, zc + sz * 1.5), (12.0, 1.8, 12.5))
                        V.add("shaft-head", head, "steel", wear=W_PLATE, piece=pid)
                        ties = []
                        for yy in (70.0, 150.0, top - 8.0):
                            ties.append(polytube([(cx - sx * 8.0 * sx * sx, yy, zc - sz * 5.0), (xa, yy, z0)], 0.95, lod["nl"],
                                                 hint=[0, 1.0, 0]))
                            ties.append(polytube([(cx + sx * 8.0, yy, zc - sz * 5.0), (xo, yy, z0 + sz * TRUSS_W / 2)], 0.95, lod["nl"],
                                                 hint=[0, 1.0, 0]))
                        V.add("shaft-ties", merge(ties), "truss", smooth=True, piece=pid)
            # base plate under the cluster
            bx = sx * (HALF_SPAN + 15.0)
            V.add("base-plate", box((bx, 1.5, z0), (31.0, 1.5, 42.0), skip=("-y",)), "steel", wear=W_PLATE, piece=base_piece, solid=True)
            # bolts on the plate (near only)
            if tier == "near":
                bolts = [box((bx + dx, 3.5, z0 + dz), (1.0, 0.5, 1.0), skip=("-y",)) for dx in (-27.0, 27.0) for dz in (-38.0, 0.0, 38.0)]
                V.add("base-bolts", merge(bolts), "steel", wear=W_STEEL, piece=base_piece)
            # outriggers: braces from the leg down to screw-jack pads; outer pads carry ballast
            if tier in ("near", "mid"):
                braces, pads, ballast = [], [], []
                dirs = [(1, 1), (1, -1), (-1, 1), (-1, -1)] if tier == "near" else [(1, 1), (1, -1)]
                for ox, oz in dirs:
                    outward = ox > 0
                    px = bx + sx * ox * 58.0
                    pz = z0 + oz * 58.0
                    # the brace starts at a clamp on the shaft chord it hangs from (the shaft's
                    # third corner is at z0 +/- 37) and is a round tube, like the rest of the rig
                    top_p = np.array([bx, 44.0, z0 + oz * 37.0])
                    foot = np.array([px, 7.5, pz])
                    braces.append(polytube([top_p, foot], 1.35, 6, hint=[0, 1.0, 0], caps=(True, True)))
                    braces.append(polytube([(bx, 41.5, z0 + oz * 37.0), (bx, 46.5, z0 + oz * 37.0)], R_CHORD * 0.9 + 0.9, 8,
                                           hint=[1.0, 0, 0], caps=(True, True)))
                    pads.append(box((px, 1.0, pz), (6.0, 1.0, 6.0), skip=("-y",)))
                    pads.append(polytube([(px, 2.0, pz), (px, 7.5, pz)], 1.1, 6, hint=[1.0, 0, 0], caps=(False, True)))
                    if outward:
                        # ballast: three steel weights stacked on a wide pad beside the jack
                        for k, (hx, hz) in enumerate(((9.0, 7.0), (8.0, 6.2), (7.0, 5.4))):
                            ballast.append(box((px + sx * 16.0, 1.45 + 2.95 * k, pz), (hx, 1.45, hz), skip=("-y",)))
                V.add("outrigger", merge(braces), "steel", wear=W_PLATE, piece=base_piece)
                V.add("outrigger-pad", merge(pads), "steel", wear=W_STEEL, piece=base_piece, solid=True)
                if ballast:
                    V.add("ballast", merge(ballast), "coat", "coat", piece=base_piece, solid=True)
            pier_heads.append((sx, z0, base_piece))

    # ---- lighting beams: box truss hung under the arches --------------------
    beam_secs = {}
    z_a, z_b = ARCH_Z[0] - 30.0, ARCH_Z[-1] + 30.0
    cuts_z = [z_a, 330.0, 500.0, 640.0, 780.0, z_b]
    hook_y = arch_y_at_x(BEAM_X) - R_CHORD
    for sx in (-1, 1):
        for zi in range(len(cuts_z) - 1):
            za, zb = cuts_z[zi], cuts_z[zi + 1]
            tier = tier_of_z((za + zb) / 2)
            nb = max(2, int(round((zb - za) / 20.0)))
            sec = straight_truss((sx * BEAM_X, BEAM_Y, za), (sx * BEAM_X, BEAM_Y, zb), (0, 1.0, 0), box_corners(20.0, 20.0), nb,
                                 LOD[tier], rc=R_CHORD * 0.85, rl=R_LACE * 0.95, end_cpl=(zi == 0))
            pid = V.new_piece()
            beam_secs[(sx, zi)] = pid
            V.add("beam-%s" % tier, sec[0]["truss"], "truss", smooth=True, piece=pid)
            V.add("beam-cpl", sec[0]["steel"], "steel", wear=W_STEEL, smooth=True, piece=pid)

    def beam_piece(sx, z):
        for zi in range(len(cuts_z) - 1):
            if cuts_z[zi] <= z <= cuts_z[zi + 1]:
                return beam_secs[(sx, zi)]
        return beam_secs[(sx, 0)]

    for z0 in ARCH_Z:
        tier = tier_of_z(z0)
        for sx in (-1, 1):
            x = sx * BEAM_X
            pid = beam_piece(sx, z0)
            top_beam = BEAM_Y + 10.0 + R_CHORD
            if tier == "near":
                # chain hoist: motor hung from the arch, load chain down to a round sling on the beam
                mot, bot = hoist((x, hook_y, z0), 12.0, 4.0)
                V.add("beam-hoist", mot, "coat", "coat", piece=pid)
                V.add("beam-chain", chain(bot, (x, top_beam + 2.0, z0)), "steel", wear=W_CHAIN, piece=pid, smooth=True)
                V.add("beam-chain", chain((x - 6.0, bot[1] + 3.0, z0), (x - 6.0, bot[1] - 22.0, z0)), "steel", wear=W_CHAIN,
                      piece=pid, smooth=True)
                V.add("beam-sling", box((x, top_beam + 1.0, z0), (11.0, 1.0, 1.4)), "steel", wear=W_STEEL, piece=pid)
            else:
                V.add("beam-wire", merge([wire((x - 4.0, hook_y, z0), (x - 4.0, top_beam, z0)), wire((x + 4.0, hook_y, z0), (x + 4.0, top_beam, z0))]),
                      "steel", wear=W_CHAIN, piece=pid, smooth=True)

    # (no moving heads: the owner had the lights removed, 2026-11-18)

    # ---- ridge along the crowns --------------------------------------------
    R_, C_, phiS, phiA = arch_params()
    y_out = APEX_Y + TRUSS_D / math.sin(phiA)
    ridge_y = y_out + R_CHORD + 9.0
    rcuts = [ARCH_Z[0], 430.0, 640.0, ARCH_Z[-1]]
    for zi in range(len(rcuts) - 1):
        sec = straight_truss((0, ridge_y, rcuts[zi]), (0, ridge_y, rcuts[zi + 1]), (0, 1.0, 0), box_corners(18.0, 18.0),
                             max(2, int(round((rcuts[zi + 1] - rcuts[zi]) / 22.0))), LOD["far"], rc=R_CHORD * 0.8, rl=R_LACE)
        V.add("ridge", sec[0]["truss"], "truss", smooth=True, piece=V.new_piece())

    # ---- gable towers, header, PA cantilevers -------------------------------
    for sx in (-1, 1):
        x = sx * SIDE_X
        sec = straight_truss((x, LEG_BASE, TOWER_Z), (x, HEADER_Y - 12.0, TOWER_Z), (0, 0, 1.0), box_corners(24.0, 24.0), 19, LOD["far"],
                             rc=R_CHORD * 0.9, cuts=[0, 6, 12, 19])
        first = None
        for s in sec:
            pid = V.new_piece()
            first = first or pid
            V.add("tower", s["truss"], "truss", smooth=True, piece=pid)
        V.add("tower-base", box((x, 1.5, TOWER_Z), (18.0, 1.5, 18.0), skip=("-y",)), "steel", wear=W_PLATE, piece=first, solid=True)
        V.add("tower-sleeve", box((x, HEADER_Y, TOWER_Z), (15.0, 14.0, 15.0)), "coat", "coat", piece=pid)
    sec = straight_truss((-PA_X - 14.0, HEADER_Y, TOWER_Z), (PA_X + 14.0, HEADER_Y, TOWER_Z), (0, 1.0, 0), box_corners(22.0, 22.0), 22,
                         LOD["far"], rc=R_CHORD * 0.9, cuts=[0, 11, 22])
    for s in sec:
        V.add("header", s["truss"], "truss", smooth=True, piece=V.new_piece())
    pa_parts = {}
    for sx in (-1, 1):
        x = sx * PA_X
        sec = straight_truss((x, HEADER_Y - 2.0, TOWER_Z + 11.0), (x, HEADER_Y - 2.0, PA_Z + 18.0), (0, 1.0, 0), box_corners(14.0, 14.0), 4,
                             LOD["far"], rc=R_CHORD * 0.75, rl=R_LACE * 0.9)
        pid = V.new_piece()
        pa_parts[sx] = pid
        V.add("pa-arm", sec[0]["truss"], "truss", smooth=True, piece=pid)

    # ---- line arrays: eight cabinets each, splayed, with grilles and rigging --
    BW, BH, BD, BHB = 32.0, 19.5, 24.0, 13.5
    tilts = [2, 4, 7, 11, 16, 22, 29, 37]
    top_y = 300.0
    for sx in (-1, 1):
        xc = sx * PA_X
        pid = V.new_piece()
        body_p, grille_p, plate_p = [], [], []
        # fly bar and its wires up to the arm
        body_p.append(box((xc, top_y + 4.0, PA_Z), (BW / 2 + 1.0, 2.0, 14.0)))
        for zz in (PA_Z - 10.0, PA_Z + 10.0):
            plate_p.append(wire((xc, top_y + 6.0, zz), (xc, HEADER_Y - 9.0 - R_CHORD, zz), 0.35))
            plate_p.append(box((xc, top_y + 6.6, zz), (1.0, 1.0, 1.0)))
        F = np.array([top_y, PA_Z + BD / 2])
        for th in tilts:
            a = math.radians(th)
            up = np.array([math.cos(a), math.sin(a)])
            fw = np.array([-math.sin(a), math.cos(a)])
            F2 = F - BH * up
            ft, fb = F - 0.5 * up, F2 + 0.5 * up
            bt = F - BD * fw - (BH - BHB) / 2 * up - 0.5 * up
            bb = F2 - BD * fw + (BH - BHB) / 2 * up + 0.5 * up

            def q(p, x, inset=0.0):
                p = np.asarray(p) - inset * fw
                return np.array([x, p[0], p[1]])

            xl, xr = xc - BW / 2, xc + BW / 2
            c8 = dict(ftl=q(ft, xl), ftr=q(ft, xr), fbl=q(fb, xl), fbr=q(fb, xr), btl=q(bt, xl), btr=q(bt, xr), bbl=q(bb, xl), bbr=q(bb, xr))
            cen = np.mean(list(c8.values()), axis=0)
            body_p.append(convex([[c8["ftl"], c8["ftr"], c8["btr"], c8["btl"]], [c8["fbl"], c8["fbr"], c8["bbr"], c8["bbl"]],
                                  [c8["btl"], c8["btr"], c8["bbr"], c8["bbl"]], [c8["ftl"], c8["fbl"], c8["bbl"], c8["btl"]],
                                  [c8["ftr"], c8["fbr"], c8["bbr"], c8["btr"]]], centre=cen))
            # front: a frame round a recessed grille
            m = 1.3
            ft_i, fb_i = ft - m * up, fb + m * up
            o = [q(ft, xl), q(ft, xr), q(fb, xr), q(fb, xl)]
            i = [q(ft_i, xl + m), q(ft_i, xr - m), q(fb_i, xr - m), q(fb_i, xl + m)]
            ir = [q(ft_i, xl + m, 0.7), q(ft_i, xr - m, 0.7), q(fb_i, xr - m, 0.7), q(fb_i, xl + m, 0.7)]
            fwd = np.array([0, fw[0], fw[1]])
            for k in range(4):
                quad = [o[k], o[(k + 1) % 4], i[(k + 1) % 4], i[k]]
                body_p.append(convex([quad], centre=np.mean(quad, 0) - fwd))
                wall_q = [i[k], i[(k + 1) % 4], ir[(k + 1) % 4], ir[k]]
                inner_c = np.mean(ir, 0) + 0.35 * fwd
                body_p.append(convex([wall_q], centre=2 * np.mean(wall_q, 0) - inner_c))
            grille_p.append(convex([ir], centre=np.mean(ir, 0) - fwd))
            # rigging plates on both sides, near the back corners
            for xs_ in (xl - 0.3, xr + 0.3):
                plate_p.append(box(np.array([xs_, (bt[0] + bb[0]) / 2, (bt[1] + bb[1]) / 2]) + np.array([0, 0, 2.0]),
                                   (0.5, BHB * 0.48, 2.2)))
            F = F2
        V.add("speakers", merge(body_p), "coat", "coat", piece=pid, solid=True)
        V.add("grilles", merge(grille_p), "coat", "coat", piece=pid, wear=W_GRILLE, solid=True)
        V.add("pa-rigging", merge(plate_p), "steel", wear=W_STEEL, piece=pid)

    # ---- cable looms down the near legs and cable ramps on the floor ---------
    # (asymmetric on purpose: a stagehand ran more cable on the left)
    runs = [(-1, 850.0), (-1, 710.0), (1, 850.0)]
    ramp_x = {-1: -(HALF_SPAN + TRUSS_D + 26.0), 1: HALF_SPAN + TRUSS_D + 26.0}
    ramp_span = {-1: (690.0, 960.0), 1: (840.0, 960.0)}
    for sx, z0 in runs:
        pid = [p for (s, z, p) in pier_heads if s == sx and z == z0][0]
        za_r, zb_r = ramp_span[sx]
        ramp_in = {sx: min(max(z0 + (40.0 if sx < 0 else -10.0), za_r + 12.0), zb_r - 12.0)}
        xo = sx * (HALF_SPAN + TRUSS_D + 3.2)
        zl = z0 + TRUSS_W / 2 + 2.6 if sx < 0 else z0 - TRUSS_W / 2 - 2.6
        rx = ramp_x[sx]
        loom = [(xo, SPRING_Y - 16.0, zl), (xo, 40.0, zl), (xo + sx * 3.0, 14.0, zl), (xo + sx * 14.0, 4.8, zl + 6.0 * (1 if sx < 0 else -1)),
                (rx, 1.6, ramp_in[sx])]
        # the loom ends under its cable ramp (it used to stop short of the right-hand ramp and read
        # as a brace with no foot); its end is capped
        V.add("loom", polytube(loom, 1.5, 6, hint=[0, 0, 1.0], caps=(True, True)), "coat", "coat", piece=pid, smooth=True)
        ties = [polytube([(xo, yy - 0.8, zl), (xo, yy + 0.8, zl)], 2.05, 6, hint=[0, 0, 1.0]) for yy in (60.0, 120.0, 180.0)]
        V.add("loom-ties", merge(ties), "coat", "coat", piece=pid, smooth=True)
    for sx, (za, zb) in ramp_span.items():
        rx = ramp_x[sx]
        pr = V.new_piece()
        ramps = []
        z = za
        while z < zb - 1.0:
            z1 = min(z + 39.0, zb)
            caps = ([[(rx - 9, 0, z), (rx - 4, 3.4, z), (rx + 4, 3.4, z), (rx + 9, 0, z)]] if z <= za + 0.5 else []) +                    ([[(rx - 9, 0, z1), (rx - 4, 3.4, z1), (rx + 4, 3.4, z1), (rx + 9, 0, z1)]] if z1 >= zb - 0.5 else [])
            ramps.append(convex(caps + [
                                 [(rx - 9, 0, z), (rx - 4, 3.4, z), (rx - 4, 3.4, z1), (rx - 9, 0, z1)],
                                 [(rx + 9, 0, z), (rx + 4, 3.4, z), (rx + 4, 3.4, z1), (rx + 9, 0, z1)],
                                 [(rx - 4, 3.4, z), (rx + 4, 3.4, z), (rx + 4, 3.4, z1), (rx - 4, 3.4, z1)]], centre=(rx, 0.8, (z + z1) / 2)))
            z = z1   # butted segments with no inner end caps: a gap read as a crack in the clay render
        V.add("cable-ramp", merge(ramps), "coat", "coat", piece=pr, solid=True)
    return V


def assemble(V):
    """Concatenate chunks in export order. Returns a dict of arrays + group ranges."""
    order = []
    for kind in KIND_ORDER:
        cs = [c for c in V.chunks if c.kind == kind]
        if kind == "led":
            cs.sort(key=lambda c: c.screen)
        order += cs
    pos, tri, uv, smooth, tri_mat, vkind, vsolid, piece = [], [], [], [], [], [], [], []
    groups, off = [], 0
    mat_names = []
    for c in order:
        if c.mat not in mat_names:
            mat_names.append(c.mat)
        pos.append(c.v)
        tri.append(c.t + off)
        uv.append(c.uv)
        tri_mat.append(np.full(len(c.t), mat_names.index(c.mat)))
        smooth.append(np.full(len(c.t), c.smooth))
        vkind.append(np.full(len(c.v), KIND_ORDER.index(c.kind)))
        vsolid.append(np.full(len(c.v), c.solid or c.kind in ("led", "floor")))
        piece.append(np.full(len(c.v), c.piece))
        off += len(c.v)
    start, cur = 0, None
    for c in order:
        key = (c.kind, c.screen)
        n = len(c.t) * 3
        if cur is not None and cur["key"] == key:
            cur["count"] += n
        else:
            cur = dict(key=key, kind=c.kind, screen=c.screen, start=start, count=n)
            groups.append(cur)
        start += n
    names = {"floor": "floor", "baked": "structure", "coat": "black", "lens": "lenses", "glow": "edge-light"}
    out_groups = []
    for g in groups:
        d = dict(name=names[g["kind"]] if g["kind"] != "led" else "led-" + V.screens[g["screen"]]["name"],
                 kind=g["kind"], start=g["start"], count=g["count"])
        if g["kind"] == "led":
            d["screen"] = g["screen"]
        out_groups.append(d)
    return dict(
        pos=np.concatenate(pos), tri=np.concatenate(tri), uv=np.concatenate(uv),
        tri_mat=np.concatenate(tri_mat), smooth=np.concatenate(smooth),
        vkind=np.concatenate(vkind), vsolid=np.concatenate(vsolid), piece=np.concatenate(piece),
        mat_names=mat_names, groups=out_groups, screens=V.screens, fixtures=V.fixtures)


def to_blender(p):
    p = np.asarray(p, float)
    return np.stack([p[:, 0], -p[:, 2], p[:, 1]], axis=1) / UNITS_PER_METRE


if __name__ == "__main__":
    V = build()
    by = {}
    for c in V.chunks:
        k = c.name.split("-")[0] if not c.name.startswith(("arch-", "shaft-", "beam-")) else c.name
        a = by.setdefault(c.name, [0, 0])
        a[0] += len(c.v)
        a[1] += len(c.t)
    tv = tt = 0
    for k, (nv, nt) in sorted(by.items(), key=lambda kv: -kv[1][0]):
        print("%-16s verts=%6d tris=%6d" % (k, nv, nt))
        tv += nv
        tt += nt
    print("TOTAL verts=%d tris=%d pieces=%d  (budget 65000 verts)" % (tv, tt, V.npieces))
    D = assemble(V)
    assert D["pos"][:, 1].min() >= 0.0, "geometry under the floor"
    print("bounds", D["pos"].min(0), D["pos"].max(0))
    print("groups", D["groups"])
    print("fixtures", len(D["fixtures"]), "floor grid", V.floor_grid)
