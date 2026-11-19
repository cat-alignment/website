#!/usr/bin/env python3
"""Writes assets/cms.svg, the line drawing of the CMS on the home page.

The site itself has no build step: the SVG is checked in, and this script is
only needed to change the drawing. Run it from the repository root:

    python3 tools/draw_cms.py

Coordinates are in the pixel space of the reference photograph the drawing is
traced from (1920 x 1280): "CMS Central Core 01.jpg" by Dmitry Tonkonog,
https://commons.wikimedia.org/wiki/File:CMS_Central_Core_01.jpg, CC BY-SA 3.0.
"""

INK = "#255d8a"
out = []


def f(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def pl(pts, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def sm(pts, close=False):
    """Catmull-Rom spline through pts as cubic Beziers."""
    n = len(pts)
    d = f"M{f(pts[0][0])} {f(pts[0][1])}"
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[i + 1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}"
    return d + ("Z" if close else "")


def sm_tail(pts):
    """Spline segments only (no leading M), for joining onto another path."""
    d = sm(pts)
    return d[d.index("C"):]


def at(pts, x):
    """Linear interpolation of y along a polyline sorted by x."""
    if x <= pts[0][0]:
        return pts[0][1]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0)
    return pts[-1][1]


def path(d, cls="a", fill=False):
    c = cls + (" w" if fill else "")
    out.append(f'<path class="{c}" d="{d}"/>')


def ell(cx, cy, rx, ry, cls="a", fill=False, rot=0):
    c = cls + (" w" if fill else "")
    t = f' transform="rotate({f(rot)} {f(cx)} {f(cy)})"' if rot else ""
    out.append(f'<ellipse class="{c}" cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"{t}/>')


def group(name):
    out.append(f"<!-- {name} -->")


def segs_d(segs):
    """One path for many separate segments (or polylines)."""
    return "".join("M" + " L".join(f"{f(x)} {f(y)}" for x, y in s) for s in segs)


def lantern(cx, cap_y, cap_rx, cap_ry, d2_y, d2_rx, d2_ry, cone_top, cone_top_hw, cone_base, cone_base_hw, cls, flue=None, n_mull=3, tilt=(0, 0)):
    """Glass cone lantern with two discs on top. tilt turns the cap and the lower disc (degrees)."""
    # cone
    sag = cap_ry * 0.7
    d = (f"M{f(cx - cone_base_hw)} {f(cone_base)}L{f(cx - cone_top_hw)} {f(cone_top)}"
         f"H{f(cx + cone_top_hw)}L{f(cx + cone_base_hw)} {f(cone_base)}"
         f"Q{f(cx)} {f(cone_base + 2 * sag)} {f(cx - cone_base_hw)} {f(cone_base)}Z")
    path(d, cls, fill=True)
    for i in range(1, n_mull + 1):
        t = i / (n_mull + 1)
        xt = cx - cone_top_hw + 2 * cone_top_hw * t
        xb = cx - cone_base_hw + 2 * cone_base_hw * t
        yb = cone_base + 2 * sag * (1 - (2 * t - 1) ** 2) * 0.5
        path(f"M{f(xt)} {f(cone_top)}L{f(xb)} {f(yb)}", "b")
    # lower disc
    if tilt[1]:
        out.append(f'<g transform="rotate({f(tilt[1])} {f(cx)} {f(d2_y)})">')
    th2 = d2_ry * 0.7
    path(f"M{f(cx - d2_rx)} {f(d2_y)}v{f(th2)}a{f(d2_rx)} {f(d2_ry)} 0 0 0 {f(2 * d2_rx)} 0v{f(-th2)}", cls, fill=True)
    ell(cx, d2_y, d2_rx, d2_ry, cls, fill=True)
    if tilt[1]:
        out.append("</g>")
    # neck between the discs
    nk = d2_rx * 0.8
    path(f"M{f(cx - nk)} {f(cap_y + cap_ry * 0.6)}V{f(d2_y - d2_ry * 0.6)}M{f(cx + nk)} {f(cap_y + cap_ry * 0.6)}V{f(d2_y - d2_ry * 0.6)}", "b")
    # flue, behind the cap
    if flue:
        x0, x1, y0 = flue
        path(f"M{f(x0)} {f(cap_y)}V{f(y0)}H{f(x1)}V{f(cap_y)}", "b")
    # cap
    if tilt[0]:
        out.append(f'<g transform="rotate({f(tilt[0])} {f(cx)} {f(cap_y)})">')
    th = cap_ry * 0.65
    path(f"M{f(cx - cap_rx)} {f(cap_y)}v{f(th)}a{f(cap_rx)} {f(cap_ry)} 0 0 0 {f(2 * cap_rx)} 0v{f(-th)}", cls, fill=True)
    ell(cx, cap_y, cap_rx, cap_ry, cls, fill=True)
    if tilt[0]:
        out.append("</g>")


# ---------------------------------------------------------------- curves

# Outer (upper) edge of the big curved roof, left to right.
T = [(457.8, 478), (490.3, 445.5), (529.2, 419.5), (574.7, 400), (620, 387), (653, 380.5), (694, 377.5),
     (731, 376.3), (772.5, 375.7), (810, 376.3), (850.6, 379.5), (900, 385), (956.5, 393.5), (1000, 401),
     (1046.3, 411.2), (1092.5, 422.3), (1138.8, 434.4), (1170, 443.3), (1207, 455), (1244, 466.5),
     (1281, 478.5), (1318, 490), (1336.5, 495.5), (1379, 508.5), (1416.8, 521), (1462.8, 536.5),
     (1494.3, 547.5), (1525.7, 558.5), (1557, 570), (1588.5, 582), (1620, 594.5), (1651.3, 605.5),
     (1682.7, 615), (1714.2, 622.5), (1745.7, 629), (1777, 634.6), (1808.5, 638.7), (1840, 641.8),
     (1871.3, 644), (1920, 646.5)]
# Lower edge of the roof band, left to right.
B = [(490, 621), (529.7, 562), (566, 518), (600.6, 492), (647.5, 469), (700, 455),
     (765, 448.5), (835, 450), (900, 459), (962, 469), (1024, 484), (1086, 503), (1148, 523),
     (1210, 543), (1272, 562), (1320, 578), (1362, 596), (1424, 624), (1486, 648),
     (1548, 670), (1610, 688), (1672, 702), (1712, 712), (1760, 720), (1920, 735)]
# The curl at the left end, from the lower edge round to the upper edge.
CURL = [(490, 621), (477, 628), (458, 624), (432, 614), (414, 598), (409, 578), (415.6, 549.4),
        (431.8, 513.6), (457.8, 478)]


# Depth of the roof's rounded front edge, measured in from its outer edge. It
# looks deeper towards the right, where the roof is nearer the viewer, and
# tapers away round the curl at the left end.
NOSE = [(574.7, 26), (650, 28.5), (780, 30.5), (912, 31.5), (1000, 34.5), (1046, 38), (1200, 43),
        (1400, 46.5), (1600, 50), (1920, 52)]
NOSE_CURL = [2, 6, 10, 13, 16, 18, 20, 22, 24, 25]


def nose_edge():
    """Inner edge of the rounded front, offset inwards from the outline."""
    outline = CURL[1:] + T[1:]
    depth = NOSE_CURL + [at(NOSE, x) for x, _ in T[3:]]
    pts = []
    for i, (x, y) in enumerate(outline):
        x0, y0 = outline[max(i - 1, 0)]
        x1, y1 = outline[min(i + 1, len(outline) - 1)]
        tx, ty = x1 - x0, y1 - y0
        n = (tx * tx + ty * ty) ** 0.5
        pts.append((x - ty / n * depth[i], y + tx / n * depth[i]))
    return outline, pts


def s_top(x):
    return 552 + (x - 522) * 0.031


S_BOT = [(535, 645), (570, 652), (610, 662), (660, 671), (716, 677), (783, 683), (859, 689),
         (943, 695.5), (1037, 700.5), (1137, 706), (1247, 711), (1300, 713)]


def s_bot(x):
    return at(S_BOT, x)


# ---------------------------------------------------------------- ground (generated)
#
# The paving in front of the building is generated rather than traced: slab
# joints are laid out on a plan grid and projected into the photo with the
# vanishing points of the real ground lines. All of them sit on the horizon,
# about y = 582 in the photo:
#   drain channel along the lawns        -> (-1000, 582)
#   cobble edges of the diagonal path    -> (2120, 582)
#   cobble steps in front of the doors   -> (-1478, 582), across them (1950, 582)
# The whole ground layer then fades out towards the lower left, where the path
# runs off towards the text beside the drawing.

import random

rng = random.Random(7)
defs = []
HZ = 582


def proj(O, VA, VB, a, b):
    """Plan (u, v) -> photo, for a ground grid whose u and v lines run to VA and VB.
    a and b set the size of one plan unit at the origin O (negative runs away from the VP).
    p.inv maps a photo point back to (u, v); p.span(poly) is the plan box covering poly."""
    def p(u, v):
        w = 1 + a * u + b * v
        return ((O[0] + a * u * VA[0] + b * v * VB[0]) / w, (O[1] + a * u * VA[1] + b * v * VB[1]) / w)

    def inv(pt):
        x, y = pt
        m11, m12, r1 = a * (x - VA[0]), b * (x - VB[0]), O[0] - x
        m21, m22, r2 = a * (y - VA[1]), b * (y - VB[1]), O[1] - y
        det = m11 * m22 - m12 * m21
        return ((r1 * m22 - m12 * r2) / det, (m11 * r2 - r1 * m21) / det)

    def span(poly):
        uv = [inv(q) for q in poly]
        return (min(q[0] for q in uv), max(q[0] for q in uv), min(q[1] for q in uv), max(q[1] for q in uv))
    p.inv, p.span = inv, span
    return p


def inside(poly, pt):
    x, y = pt
    c = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def clip(poly, a, b):
    """The parts of segment a-b that lie inside poly."""
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    ts = [0.0, 1.0]
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        ex, ey = x1 - x0, y1 - y0
        den = dx * ey - dy * ex
        if abs(den) < 1e-12:
            continue
        t = ((x0 - ax) * ey - (y0 - ay) * ex) / den
        s = ((x0 - ax) * dy - (y0 - ay) * dx) / den
        if 0 < t < 1 and 0 <= s <= 1:
            ts.append(t)
    ts.sort()
    res = []
    for t0, t1 in zip(ts, ts[1:]):
        tm = (t0 + t1) / 2
        if t1 - t0 > 1e-6 and inside(poly, (ax + dx * tm, ay + dy * tm)):
            res.append([(ax + dx * t0, ay + dy * t0), (ax + dx * t1, ay + dy * t1)])
    return res


def line_y(p, q, x):
    return p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0])


def toward(pt, vp, x):
    """y at x on the line from pt to the vanishing point vp."""
    return line_y(pt, vp, x)


VA, VB = (-1000, HZ), (2120, HZ)      # plaza and path
VS, VSX = (-1478, HZ), (1950, HZ)     # cobble steps


def drain(x):
    return 872 + 0.2907 * x


def meet_drain(pt, vp):
    """Where the line from pt to vp crosses the drain."""
    k = (vp[1] - pt[1]) / (vp[0] - pt[0])
    x = (pt[1] - k * pt[0] - 872) / (0.2907 - k)
    return (x, drain(x))


# Edges of the two cobble strips that line the diagonal path (at the left edge of the photo).
S1_TOP, S1_BOT, S2_TOP, S2_BOT = (0, 1030), (0, 1046), (0, 1122), (0, 1138)
s1_end = meet_drain(S1_BOT, VB)
s2_end = meet_drain(S2_TOP, VB)

# Cobble steps: left edge of the stepped area, and the near edge of its lowest band.
STEP_TOP, STEP_BOT = (840, 869.5), (552, 968)
# Edge of the cobbled circle round the right drum, from the drum down past the frame.
CIRCLE_EDGE = [(1300, 962), (1312, 985), (1305, 1010), (1280, 1035), (1240, 1060), (1195, 1090),
               (1160, 1125), (1130, 1165)]
step_bot_end = (1195, toward(STEP_BOT, VS, 1195))

# Pebbles left of the left drum (round the benches there) and in a thin strip
# along the drum's foot: the same cobbled ground as round the right drum, only
# in shade in the photo. Bounded by the terrace wall, the drum and the slabs.
GRAVEL_EDGE = [(300, 826), (420, 812), (480, 814), (530, 813), (600, 808), (646.5, 833)]
GRAVEL = ([(-10, 782), (365.6, 748), (365.6, 781), (412.5, 796), (480, 801), (530, 800), (600, 794)]
          + GRAVEL_EDGE[::-1] + [(150, 852), (-10, 828)])
PLAZA = ([(-10, 828), (150, 852)] + GRAVEL_EDGE[:-1] + [
          (646.5, 833), (701, 845), (761, 857), (831, 868), STEP_TOP, STEP_BOT, step_bot_end]
         + CIRCLE_EDGE[-2:] + [(1150, drain(1150)), s2_end, (-10, toward(S2_TOP, VB, -10)),
                                (-10, toward(S1_BOT, VB, -10)), s1_end, (-10, drain(-10))])
STEPS = ([STEP_TOP, (910, 877), (997, 890), (1107, 892), (1226, 894), (1240, 935)]
         + CIRCLE_EDGE[:-2] + [STEP_BOT])
CIRCLE = ([(1226, 894), (1240, 935)] + CIRCLE_EDGE + [(1920, 1165), (1920, 956), (1668, 952), (1668, 894)])

out.append('<g mask="url(#ground)">')
group("ground: plaza and path paving")
# Sandstone slabs of mixed lengths, laid in courses that run with the path
# (the long joints in the photo do too). One plan unit is one course wide; a
# few of the short joints are left out so it reads as drawn, not ruled.
P = proj(s1_end, VA, VB, -0.0205, 0.0157)
u0, u1, v0, v1 = P.span(PLAZA)
joints, courses = [], []
for u in range(int(u0) - 1, int(u1) + 2):
    courses += clip(PLAZA, P(u, v0 - 1), P(u, v1 + 1))
    v = v0 - rng.random() * 3
    while v < v1:
        if rng.random() > 0.15:
            joints += clip(PLAZA, P(u, v), P(u + 1, v))
        v += rng.choice((1.5, 2, 2, 2.5, 3))
path(segs_d(courses), "g")
path(segs_d(joints), "g")

group("ground: drain channel along the lawns")
for dy in (0, 5):
    path(segs_d([[(-10, drain(-10) + dy), (s1_end[0] - 22, drain(s1_end[0] - 22) + dy)],
                 [(s2_end[0] + 26, drain(s2_end[0] + 26) + dy), (1150, drain(1150) + dy)]]), "c")

group("ground: cobble strips beside the path")
cob = []
for top, bot in ((S1_TOP, S1_BOT), (S2_TOP, S2_BOT)):
    for t in (0.28, 0.72):
        st = (-10, top[1] + (bot[1] - top[1]) * t)
        cob.append([st, meet_drain(st, VB)])
path(segs_d(cob), "k")

group("ground: cobble steps")
# Six bands of cobbles, one slab deep apart, receding towards the doors. The
# depth unit is set so the far band lands on the one in the photo, which runs
# through (815, 882).
BAND = 0.15


def far_band_w():
    (ox, oy), k = STEP_BOT, (882 - VS[1]) / (815 - VS[0])
    # p(0, v) = (O + w VSX) / (1 + w) lying on the line VS-(815, 882)
    return (oy - VS[1] - k * (ox - VS[0])) / (k * (VSX[0] - VS[0]) - (VSX[1] - VS[1]))


S = proj(STEP_BOT, VS, VSX, -0.019, far_band_w() / (5 + BAND))
su0, su1, _, _ = S.span(STEPS)
bands, joints = [], []
for k in range(6):
    v = BAND + k
    for dv in (-0.12, 0.12):
        bands += clip(STEPS, S(su0 - 1, v + dv), S(su1 + 1, v + dv))
    if k < 5:
        u = su0 - rng.random() * 2
        while u < su1:
            joints += clip(STEPS, S(u, v + 0.25), S(u, v + 0.75))
            u += rng.choice((1.5, 2, 2.5, 3))
path(segs_d(bands), "k")
path(segs_d(joints), "g")

group("ground: cobbled circle round the benches")
defs.append('<clipPath id="circle"><path d="' + pl(CIRCLE, True) + '"/></clipPath>')
rings = "".join(f'<ellipse class="k" cx="1560" cy="1135" rx="{r}" ry="{f(r * 0.31)}"/>' for r in range(40, 760, 21))
out.append(f'<g clip-path="url(#circle)">{rings}</g>')
path("M1897 956L1918 1125M1908 956L1929 1125", "c")

group("ground: bollards")
for x, top, bot, r in ((298, 888, 968, 10), (1007, 1072, 1185, 12)):
    path(f"M{x - r} {bot}V{top + r}A{r} {r} 0 0 1 {x + r} {top + r}V{bot}A{r} {r * 0.35} 0 0 1 {x - r} {bot}Z", "c", fill=True)
    path(f"M{x - r} {top + r + 6}h{2 * r}M{x - r} {top + r + 11}h{2 * r}", "c")
out.append("</g>")

# Outside the ground mask, which fades to nothing over here: the pebbles are as
# plain in front of the left of the building as round the right drum.
group("ground: pebbles round the benches on the left")
defs.append('<clipPath id="gravel"><path d="' + pl(GRAVEL, True) + '"/></clipPath>')
# Opacity and ring spacing match how the right drum's pebbles read through the mask.
rings = "".join(f'<ellipse class="k" cx="160" cy="806" rx="{r}" ry="{f(r * 0.31)}"/>' for r in range(30, 720, 19))
out.append(f'<g clip-path="url(#gravel)" opacity="0.6">{rings}</g>')

# ---------------------------------------------------------------- far building (right)
group("building behind, right")
# raised storey at the far right
path("M1592.8 391.4L1897 380.4M1608.5 395.5L1890 385.5M1608.5 395.5V408.7M1889 385.5V403.5", "b")
# main roof: hip up from its left tip, then along the foot of the raised storey, and the eave
path("M1321 440.5L1451.4 417.5M1577 407L1608.5 408.7L1741.7 406.2L1920 403", "b")
path(pl([(1321, 440.5), (1430, 436), (1522, 433.5), (1742, 428.2), (1920, 424)]), "b")
far_head = [(1340, 447.5), (1500, 441.5), (1742, 438.5), (1920, 438)]
far_sill = [(1340, 468), (1500, 463), (1742, 460.5), (1920, 460)]
path(pl(far_head) + "M" + pl(far_sill)[1:], "b")
for x in (1388, 1427, 1466, 1510, 1542, 1594, 1632, 1687, 1742, 1800, 1858):
    path(f"M{x} {f(at(far_head, x))}V{f(at(far_sill, x))}", "c")
# lower roof and the wall under it
path("M1425 478L1920 477M1494 496L1920 496", "b")
path("M1700 507H1920M1730 531H1920M1746 507V531M1808 507V531M1826 507V531M1890 507V531", "c")

group("far lantern")
path("M1453 390.5V417.5L1530 413.4L1577 407V389L1530 388Z", "b", fill=True)
path("M1530 388V413.4M1453 405L1530 402L1577 403.5", "b")
path("M1435.7 386.7L1482 379.5H1549.5L1596.6 384.2L1595 387.2L1530 386.7L1437.5 389.9Z", "b", fill=True)
path("M1435.7 386.7L1530 383.5L1596.6 384.2", "b")
lantern(1516, 334, 33.5, 3.6, 344.6, 27.5, 3, 348.4, 20.5, 377, 33.3, "b", flue=(1506, 1527.4, 319.5), n_mull=3)

group("middle pavilion")
# main roof below the lantern storey: near hip, far hip, then the eave (drawn
# once each — a single out-and-back path used to double itself here).
path("M1100 385.5L1104.6 404.8", "b")
path("M1173 391L1214.4 398.9L1281 412.8L1350.4 419", "b")
path("M1104.6 404.8L1170 405.4L1214.4 408L1281 414.6L1350.4 419", "b")
# fascia, closed off at the far corner so the hip and eave don't end in a spike
path("M1108 409L1170 410L1350.4 423V419", "c")
path("M1018.5 390L1006 394.5", "b")
# lantern storey
path("M1019.4 356L1018.5 390L1100 385.5L1173 391L1174 357L1100 353.5Z", "b", fill=True)
path("M1100 353.5V385.5M1019.4 374L1100 370L1174 377", "b")
for x in (1040, 1060, 1080):
    t = (x - 1019.4) / 80.6
    path(f"M{x} {f(356 - 2.5 * t)}V{f(374 - 4 * t)}", "c")
for x in (1118.5, 1137, 1155.5):
    t = (x - 1100) / 74
    path(f"M{x} {f(353.5 + 3.5 * t)}V{f(370 + 7 * t)}", "c")
# lantern roof
path("M1000.5 349L1058 340.5H1136L1193.7 348L1192.5 351.5L1099.5 355L1002 352.5Z", "b", fill=True)
path("M1000.5 349L1099.5 351.5L1193.7 348", "b")
lantern(1097, 282, 40.7, 4.7, 296.8, 34, 3.2, 300.2, 25, 337, 39.4, "b", flue=None, n_mull=3)

# ---------------------------------------------------------------- left pavilion
group("left pavilion: brick storeys")
path("M139 556V735M225 556V728", "b")
path("M0 585.5H139M0 599H139M0 624.5H139M0 640H139M0 692H139M0 712H139", "b")
path("M30 560H135V585.5M30 560V585.5M30 601H135V624.5M30 601V624.5M41 642H135V692M41 642V692", "b")
path("M225 587H412M225 601H412M225 624.5H412M225 640H412M225 699H366M225 712H366", "b")
path("M241 560H405V587M241 560V587M260 603H405V624.5M260 603V624.5M252 642H397V692M252 642V692", "b")
path("M0 541H420M0 556H416", "a")

group("left pavilion: glazed storey under the canopy")
path("M0 494H432", "a")
for x in (30, 65, 100, 136.7, 209.4, 283.6, 351.6, 412.5):
    path(f"M{f(x)} 494V541", "b")

group("left pavilion: canopy roof")
# Ridge of the canopy, the near eave, and the underside — drawn as separate
# strokes so they do not spike through each other at the hip.
path("M0 453L149 441L266 429L489 441", "a")
# The near bay is a cross gable: its ridge runs forward to an apex, and the
# gable's two rakes come down to the fascia on either side.
path("M266 429L192 454", "a")
path("M97 475.6L192 454L229 477L448 472.5", "a")
path("M0 472.5L92 475.6L232.5 477L446 478", "b")
path("M0 478L92 481L232 482.5L446 478", "c")

group("left pavilion: top storey")
head_l = [(45, 380), (223, 358)]
sill_l = [(45, 419), (223, 404.5)]
head_f = [(223, 358), (622, 377)]
sill_f = [(223, 404.5), (500, 418), (560, 421)]
path("M45 380L223 358L622 377M45 419L223 404.5L500 418L560 421M45 380V448M223 358V432", "a")
for x in (110.6, 142, 163.75, 201):
    path(f"M{f(x)} {f(at(head_l, x))}V{f(at(sill_l, x))}", "b")
for x in (266, 288.7, 322.6, 381.2, 437.8, 488.6, 504, 541.5):
    path(f"M{f(x)} {f(at(head_f, x))}V{f(at(sill_f, x))}", "b")

group("left pavilion: main roof")
path("M0 366L184 333L274 327.7M254 335L256 339L600 361.5L695 369.3L507.4 331.6", "a")
path("M0 371.5L184 339M258 344L600 366L672 372", "b")

group("left pavilion: clerestory")
path("M274 277V327.7M351 256V318M507.4 281V331.6", "a")
path("M274 303.4L351 292.5L507.4 305.4M274 310L351 299.5L507.4 313.2", "b")
path("M274 327.7L351 318L507.4 331.6", "a")
for x, y0, y1 in ((300, 270, 299.7), (325, 263, 296.2), (383, 261, 295), (422, 267.3, 298.4), (446, 271, 300.3), (483, 277, 303.4)):
    path(f"M{x} {f(y0)}V{f(y1)}", "b")
for x, y0, y1 in ((300, 306.5, 324.4), (325, 303, 321.3), (383, 302.3, 320.8), (423, 305.8, 324.3), (461, 309, 327.6)):
    path(f"M{x} {f(y0)}V{f(y1)}", "b")

group("left pavilion: lantern roof")
path("M239 262.5L323 247.5L331 247M454 251.5L530 268.5L541.5 276", "a")
path("M239 262.5L354 248.4L530 268.5M244.5 268L354 253.5L539.6 279L541.5 276", "a")
path("M274 277L351 256L507.4 281", "b")

group("left pavilion: lantern")
lantern(391.5, 167, 64.5, 9.5, 190, 53, 7.5, 197, 39, 249, 61.5, "a", flue=(375, 413.5, 135), n_mull=5, tilt=(3.5, 1.5))

# ---------------------------------------------------------------- terrace on the left
group("terrace railing")
path("M0 730L159 718L245 712L327 706.6L366 704M0 749.5L327 728.4L366 726", "b")
path("M67 725V781M161 718V771M245 712V762M325 706.6V753", "b")
path("M0 781L366 748", "a")

# ---------------------------------------------------------------- grass roof, steps, railing


def under(x0, x1):
    """Path back along the roof edge from x1 to x0, just inside the roof so the roof hides it."""
    xs = [x1] + [x for x, _ in reversed(T) if x0 < x < x1] + [x0]
    return "".join(f"L{f(x)} {f(at(T, x) + 4)}" for x in xs)


group("grass roof")
grass = [(1316, 462), (1351, 467), (1407, 477.7), (1431, 484), (1494, 495), (1535, 500), (1592, 507.5),
         (1620, 519), (1660, 530), (1700, 540), (1724, 547.5), (1762, 562), (1796, 584), (1808, 606), (1815, 634)]
path(sm(grass) + under(1316, 1815) + "Z", "b", fill=True)

group("stone steps")
STEP_X, STEP_Y, STEP_DX, STEP_DY = 1261.6, 442, 28.3, 11.3
steps = [(1199.6, 447), (1199.6, 438.7)]
for k in range(17):
    x, y = STEP_X + STEP_DX * k, STEP_Y + STEP_DY * k
    steps += [(x, y), (x, y + STEP_DY - 1.6)]
path(pl(steps) + under(1199.6, steps[-1][0]) + "Z", "b", fill=True)

group("stepped slabs along the top of the roof")
slabs = [(815, 376), (900, 380.5), (956.5, 385.7), (956.5, 389.3), (1009, 392), (1009, 396.4), (1043.5, 398.3),
         (1043.5, 403), (1076.8, 404.4), (1076.8, 411), (1113.8, 412.5), (1113.8, 421.8), (1149, 423.3),
         (1149, 433.8), (1185, 435.3), (1185, 446)]
path(pl(slabs) + under(815, 1185) + "Z", "c", fill=True)

group("roof railing")
# Top rail along the ridge, and the handrail that runs down beside the steps.
rail_a = [(665, 375.4), (753.4, 367.5), (803.6, 364.5), (863.3, 360), (911.7, 356.6), (1000.5, 352.2), (1098.5, 349.8)]
rail_b = [(1050.2, 324.4), (1076.9, 329.7), (1120, 337), (1157.6, 345.5), (1189.5, 352), (1221.7, 359),
          (1242.4, 365.2), (1278.5, 377.1), (1332.6, 395.3), (1363.4, 406.3), (1423, 429.9), (1450.3, 440.3),
          (1516.2, 469.8), (1620, 514), (1704, 544.2), (1791.2, 564.8), (1879.2, 573.6), (1920, 574.3)]

# One mid-rail under the ridge, ending where the ridge rail ends. Stair mid-rails
# are omitted: at this scale they cut through the step outline and read as noise.
path(sm([(866, 375.2), (900, 372.8), (1001.5, 368.3), (1076.8, 369.2), (1098.5, 369.6)]), "c")
# posts: ridge posts stand on the roof or its slabs; stair posts stop on the step ends
for x in (706.9, 753, 803.6, 864.9, 929.8, 1001.5):
    foot = at(T, x) if x < 815 else at(slabs, x)
    path(f"M{f(x)} {f(at(rail_a, x))}V{f(foot)}", "c")
# Stair posts stand on the tread (or landing) directly below them, so they
# never pass through the step outline; past the last step they stand on the roof.
for x in (1241.8, 1279.5, 1332.7, 1362.7, 1422, 1447, 1514.7, 1609.9, 1702.2, 1792.2, 1880.1):
    path(f"M{f(x)} {f(at(rail_b, x))}V{f(min(at(steps, x), at(T, x)) if x < steps[-1][0] else at(T, x))}", "c")
# The handrail's top end crosses in front of the middle lantern; these two posts
# hold it up there, and without them the rail reads as a stray stroke.
for x, foot in ((1076.9, 404), (1157.6, 424)):
    path(f"M{f(x)} {f(at(rail_b, x))}V{foot}", "c")
path(sm(rail_a), "b")
path(sm(rail_b), "b")

# ---------------------------------------------------------------- glazing under the roof (drawn before the roof so the roof hides the tops)
group("glazing under the roof")
for x in (600.6, 647.5, 700, 762, 832.6, 911.5, 1000.6, 1094, 1198):
    path(f"M{f(x)} {f(at(B, x) - 20)}V{f(s_top(x))}", "b")
for x in (1419, 1535, 1653, 1768, 1819, 1886):
    path(f"M{x} {f(at(B, x) - 20)}V{f(950 if x > 1670 else 740)}", "b")
path("M1668 802L1920 858M1668 836L1920 899", "b")

# ---------------------------------------------------------------- the curved roof
group("curved roof")
roof = sm(T) + "L1920 735" + sm_tail(list(reversed(B))) + sm_tail(CURL) + "Z"
path(roof, "a", fill=True)
outline, inner = nose_edge()
path(sm(inner), "c")
# joints across the rounded front: round the curl, then along the top
for i in (3, 5, 7, 9, 10, 11):
    path(pl([outline[i], inner[i]]), "c")
top_inner = [q for q in inner if q[0] > 600]
for x in range(668, 1900, 62):
    x1 = x + 12
    y1 = at(top_inner, x1)
    path(f"M{x} {f(at(T, x))}Q{x + 11} {f((at(T, x) + y1) / 2)} {x1} {f(y1)}", "c")

# ---------------------------------------------------------------- screens
group("screens")


path(f"M520 {f(s_top(520) - 1)}L1300 {f(s_top(1300) - 1)}M520 {f(s_top(520) + 7)}L1300 {f(s_top(1300) + 7)}", "b")
for x0, x1 in ((522, 549), (553, 585), (589, 630), (633, 682.6), (690.5, 742.8), (750.6, 815.5), (823, 895),
               (903, 983.7), (991, 1083), (1088, 1187), (1196.5, 1297.5)):
    path(pl([(x0, s_top(x0) + 7), (x1, s_top(x1) + 7), (x1, s_bot(x1)), (x0, s_bot(x0))], True), "a", fill=True)

# ---------------------------------------------------------------- entrance front
group("entrance front")
beam_t = [(560, 662), (980, 707), (1226, 727)]
beam_b = [(560, 675), (980, 721), (1226, 741)]
# The glazing meets the paving almost level across the doors (it used to kink up here).
ground = [(646.5, 833), (701, 845), (761, 857), (831, 868), (910, 877), (997, 890), (1107, 892), (1226, 894)]
path(pl(beam_t) + "M" + pl(beam_b)[1:], "a")
path(pl(ground), "a")
for x in (646.5, 701, 761, 831, 910, 997, 1107):
    path(f"M{f(x)} {f(at(beam_b, x))}V{f(at(ground, x))}", "b")

# ---------------------------------------------------------------- left drum
group("left drum")
path("M365.6 653V781" + sm_tail([(365.6, 781), (412.5, 796), (480, 801), (530, 800), (600, 794)]) + "V653Z", "a", fill=True)
ell(483, 653, 117.4, 15, "a", fill=True)
path("M365.6 653v9a117.4 15 0 0 0 234.8 0v-9", "a")
d_top = [(414, 690), (497, 697), (580, 692)]
d_bot = [(414, 794), (497, 800), (580, 795)]
path(sm(d_top) + "M" + sm(d_bot)[1:] + "M414 690V794M580 692V795", "b")
x = 426
while x < 530:
    path(f"M{x} {f(at(d_top, x))}V{f(at(d_bot, x))}", "c")
    x += 12
# A door at the right end of the window, with two hopper lights above it.
path(f"M536 {f(at(d_top, 536))}V{f(at(d_bot, 536))}", "b")
path("M536 727L580 725.5M536 760L580 758.5", "c")
path("M389 668V790", "b")

# ---------------------------------------------------------------- right drum
group("right drum")
r_base = [(1222, 923), (1251, 945), (1295, 960.5), (1357, 976), (1402, 986), (1500, 993), (1597, 985), (1631, 975), (1668, 964)]
path("M1222 733V923" + sm_tail(r_base) + "V746Z", "a", fill=True)
ell(1446, 737, 226, 30, "a", fill=True, rot=1.7)
out.append('<path class="a" transform="rotate(1.7 1446 737)" d="M1220 737v9a226 30 0 0 0 452 0v-9"/>')
path("M1321 766V964M1402 772V986M1631 760V975", "b")
# Head and sill as polylines so the mullions (which use linear at()) meet them flush.
g_top = [(1403.7, 814), (1450, 816.5), (1500, 818), (1550, 817.8), (1597.3, 817)]
g_bot = [(1403.7, 987.7), (1450, 990.5), (1500, 992), (1550, 988.5), (1597.3, 984.6)]
path(pl(g_top) + "M" + pl(g_bot)[1:], "b")
path("M1597.3 817V984.6M1403.7 814V987.7", "b")
# Transoms between the right mullion and the far post.
path("M1597.3 872L1631 868M1597.3 928L1631 923", "c")
# Top rail continues to the far post above the open light.
path("M1597.3 817L1631 810", "b")
x = 1421
while x < 1590:
    path(f"M{x} {f(at(g_top, x))}V{f(at(g_bot, x))}", "c")
    x += 18

# ---------------------------------------------------------------- ground
group("ground")
path("M1668 950L1920 954", "a")
path("M600 796L646.5 833", "b")
# The paving itself is generated at the top of the file, under everything else.

# ---------------------------------------------------------------- write
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 120 1920 1000" width="1920" height="1000">
  <!-- The Centre for Mathematical Sciences, Cambridge, seen from in front and to the right.
       Traced by hand from the photograph "CMS Central Core 01.jpg" by Dmitry Tonkonog,
       https://commons.wikimedia.org/wiki/File:CMS_Central_Core_01.jpg, licensed CC BY-SA 3.0.
       As a derivative of that photograph this drawing is under the same licence. -->
  <style>
    .a, .b, .c, .g {{ fill: none; stroke: {INK}; stroke-linecap: round; stroke-linejoin: round; }}
    .a {{ stroke-width: 4.6; }}
    .b {{ stroke-width: 3.2; }}
    .c {{ stroke-width: 2.3; }}
    .g {{ stroke-width: 1.9; }}
    .k {{ fill: none; stroke: {INK}; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 0 7; }}
    .w {{ fill: #fff; }}
  </style>
  <defs>
    {(chr(10) + "    ").join(defs)}
    <!-- The ground is strongest in front of the doors and fades out towards the
         lower left, where the path heads off towards the text. -->
    <radialGradient id="near" gradientUnits="userSpaceOnUse" cx="1180" cy="880" r="1150"
                    gradientTransform="translate(1180 880) scale(1 0.34) translate(-1180 -880)">
      <stop offset="0" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="0.3" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="0.62" stop-color="#fff" stop-opacity="0.45"/>
      <stop offset="0.85" stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="ground" maskUnits="userSpaceOnUse" x="0" y="120" width="1920" height="1000">
      <rect x="0" y="120" width="1920" height="1000" fill="url(#near)"/>
    </mask>
    <linearGradient id="sides" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000"/>
      <stop offset="0.09" stop-color="#fff"/>
      <stop offset="0.93" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="foot" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0.93" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="fade" maskUnits="userSpaceOnUse" x="0" y="120" width="1920" height="1000">
      <rect x="0" y="120" width="1920" height="1000" fill="url(#sides)"/>
      <rect x="0" y="120" width="1920" height="1000" fill="url(#foot)"/>
    </mask>
  </defs>
  <g mask="url(#fade)">
    {chr(10).join("    " + o if i else o for i, o in enumerate(out))}
  </g>
</svg>
'''
# The page loads assets/cms.svg?v=...; bump that query in index.html after
# regenerating so browsers don't keep showing a cached drawing.
open("assets/cms.svg", "w").write(svg)
print(len(svg), "bytes,", len(out), "elements")
