#!/usr/bin/env python3
"""Temporary generator for assets/cms.svg (line drawing of the CMS).

Coordinates are in the pixel space of the 1920 x 1280 reference photo.
Delete this file once the drawing is finished.
"""

INK = "#2a6592"
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


def lantern(cx, cap_y, cap_rx, cap_ry, d2_y, d2_rx, d2_ry, cone_top, cone_top_hw, cone_base, cone_base_hw, cls, flue=None, n_mull=3):
    """Glass cone lantern with two discs on top."""
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
    th2 = d2_ry * 0.7
    path(f"M{f(cx - d2_rx)} {f(d2_y)}v{f(th2)}a{f(d2_rx)} {f(d2_ry)} 0 0 0 {f(2 * d2_rx)} 0v{f(-th2)}", cls, fill=True)
    ell(cx, d2_y, d2_rx, d2_ry, cls, fill=True)
    # neck between the discs
    nk = d2_rx * 0.8
    path(f"M{f(cx - nk)} {f(cap_y + cap_ry * 0.6)}V{f(d2_y - d2_ry * 0.6)}M{f(cx + nk)} {f(cap_y + cap_ry * 0.6)}V{f(d2_y - d2_ry * 0.6)}", "b")
    # cap
    th = cap_ry * 0.65
    path(f"M{f(cx - cap_rx)} {f(cap_y)}v{f(th)}a{f(cap_rx)} {f(cap_ry)} 0 0 0 {f(2 * cap_rx)} 0v{f(-th)}", cls, fill=True)
    ell(cx, cap_y, cap_rx, cap_ry, cls, fill=True)
    if flue:
        x0, x1, y0 = flue
        path(f"M{f(x0)} {f(cap_y - cap_ry * 0.75)}V{f(y0)}H{f(x1)}V{f(cap_y - cap_ry * 0.75)}", "b")


# ---------------------------------------------------------------- curves

# Outer (upper) edge of the big curved roof, left to right.
T = [(457.8, 478), (490.3, 445.5), (529.2, 419.5), (574.7, 400), (620, 387), (694, 377), (772.5, 376),
     (850.6, 380.5), (900, 388), (962, 396), (1024, 410), (1086, 427), (1148, 444),
     (1210, 462), (1272, 481), (1320, 496), (1362, 511), (1424, 536), (1486, 557),
     (1548, 580), (1610, 602), (1672, 619), (1718, 629), (1772, 639), (1825, 646),
     (1878, 650.5), (1920, 652.5)]
# Lower edge of the roof band, left to right.
B = [(490, 621), (529.7, 562), (566, 518), (600.6, 492), (647.5, 469), (700, 455),
     (765, 448.5), (835, 450), (900, 459), (962, 469), (1024, 484), (1086, 503), (1148, 523),
     (1210, 543), (1272, 562), (1320, 578), (1362, 596), (1424, 624), (1486, 648),
     (1548, 670), (1610, 688), (1672, 702), (1712, 712), (1760, 720), (1920, 735)]
# The curl at the left end, from the lower edge round to the upper edge.
CURL = [(490, 621), (477, 628), (458, 624), (432, 614), (414, 598), (409, 578), (415.6, 549.4),
        (431.8, 513.6), (457.8, 478)]


def crease(x):
    """Fold between the roof's front face and its underside."""
    return at(T, x) + 0.64 * (at(B, x) - at(T, x))


def s_top(x):
    return 552 + (x - 522) * 0.031


S_BOT = [(535, 645), (570, 652), (610, 662), (660, 671), (716, 677), (783, 683), (859, 689),
         (943, 695.5), (1037, 700.5), (1137, 706), (1247, 711), (1300, 713)]


def s_bot(x):
    return at(S_BOT, x)


# ---------------------------------------------------------------- far building (right)
group("building behind, right")
path("M1594 395L1897 384M1610 399V412M1889 388V404M1610 412L1889 404", "b")
path("M1452 415L1337 444L1559 438L1920 428M1889 404L1920 403", "b")
path("M1372 448L1559 442L1920 432M1372 468L1559 463L1920 460", "b")
far_head = [(1372, 448), (1559, 442), (1920, 432)]
far_sill = [(1372, 468), (1559, 463), (1920, 460)]
for x in (1427, 1466, 1518, 1622, 1688, 1760, 1830, 1895):
    path(f"M{x} {f(at(far_head, x))}V{f(at(far_sill, x))}", "b")
path("M1433 481L1720 480L1920 479M1458 500L1720 499L1920 498", "b")
path("M1700 508H1920M1724 534H1920M1760 508V534M1830 508V534M1895 508V534", "b")

group("far lantern")
path("M1452 393H1578V415H1452Z", "b", fill=True)
path("M1436.5 390L1481 381.5H1549L1596 389L1594 392.5L1516 396.5L1438 393.5Z", "b", fill=True)
lantern(1516, 334.5, 33, 4.5, 344.5, 27, 3.5, 348, 23, 381, 34.5, "b", flue=(1507, 1526, 321), n_mull=3)

group("middle lantern")
path("M1018 357H1173V394H1018Z", "b", fill=True)
path("M1018 378H1173M1055 357V378M1097 357V378M1136 357V378", "b")
path("M1002 351L1062.5 340.5H1137.5L1193 352.5L1191.5 356L1098 350L1004 354.5Z", "b", fill=True)
path("M1002 351L1098 346.5L1193 352.5", "b")
lantern(1100, 283.5, 40, 5.5, 296.5, 33, 4, 300.5, 22, 340.3, 37.5, "b", flue=None, n_mull=3)

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
path("M0 453L149 441L266 429L192 455L232.5 477L448 472.5M266 429L489 441M0 472.5L92 475.6L232.5 477", "a")
path("M0 478L92 481L232 482.5L446 478", "b")

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
path("M0 366L184 333L274 327.7M254 335L256 339L625 362L655 366L507.4 331.6", "a")
path("M0 371.5L184 339M258 344L620 367", "b")

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
lantern(392, 166, 64, 9.5, 189, 53, 7.5, 197, 39, 249, 61.5, "a", flue=(377, 412, 140), n_mull=5)

# ---------------------------------------------------------------- terrace on the left
group("terrace railing")
path("M0 730L159 718L245 712L327 706.6L366 704M0 749.5L327 728.4L366 726", "b")
path("M67 725V781M161 718V771M245 712V762M325 706.6V753", "b")
path("M0 781L366 748", "a")

# ---------------------------------------------------------------- grass roof, steps, railing
group("grass roof and steps")
grass = [(1203, 440), (1312, 466), (1418, 484), (1486, 494), (1560, 503), (1623, 511), (1678, 525), (1720, 539), (1769, 564), (1814, 641)]
path(sm(grass) + "L1814 700L1203 700Z", "b", fill=True)
path("M1857 572L1920 620", "b")
steps = [(1203, 434)]
for i in range(16):
    x, y = 1203 + 28 * i, 434 + 11.2 * i
    steps += [(x + 28, y), (x + 28, y + 11.2)]
path(pl(steps) + "L1651 700L1203 700Z", "b", fill=True)

group("roof railing")
rail_a = [(667, 361), (800, 363), (900, 361.5), (1002, 355.8), (1098.5, 352.7)]
rail_b = [(1048.9, 327.3), (1160.5, 350.9), (1241, 369.5), (1320, 392.4), (1362, 408.6), (1424, 430),
          (1517, 473.7), (1610, 514), (1697, 546), (1772, 569), (1836, 577), (1920, 578)]
rail_m = [(1080, 375.7), (1200, 405), (1300, 439.6), (1424, 483), (1517, 523), (1622.6, 565),
          (1702.7, 598), (1793, 619.7), (1919, 626)]
path("M616 382L667 361" + sm_tail(rail_a), "b")
path(sm(rail_b), "b")
path(sm(rail_m), "b")
for x in (804, 865, 931, 1003):
    path(f"M{x} {f(at(rail_a, x))}V{f(at(T, x))}", "b")
for x, y1 in ((1076.8, 407), (1157.4, 428), (1241, 438), (1279.6, 441), (1331, 475), (1362, 490), (1422, 515),
              (1447, 528), (1514, 557), (1532.6, 566), (1610, 596), (1619.5, 600), (1703, 622), (1791.5, 638), (1878, 646)):
    path(f"M{f(x)} {f(at(rail_b, x))}V{f(y1)}", "b")

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
cr = [(x, crease(x)) for x in range(640, 1921, 40)]
path(sm([(497, 596), (520, 548), (552, 505), (592, 470)] + cr), "c")
for x in range(668, 1900, 62):
    x1 = x + 14
    path(f"M{x} {f(at(T, x))}Q{x + 12} {f((at(T, x) + crease(x1)) / 2)} {x1} {f(crease(x1))}", "c")

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
ground = [(646.5, 833), (701, 845), (761, 857), (831, 868), (910, 879), (997, 892), (1107, 878), (1226, 872)]
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
while x < 575:
    path(f"M{x} {f(at(d_top, x))}V{f(at(d_bot, x))}", "c")
    x += 12
path("M389 668V790", "b")

# ---------------------------------------------------------------- right drum
group("right drum")
r_base = [(1222, 923), (1251, 945), (1295, 960.5), (1357, 976), (1402, 986), (1500, 993), (1597, 985), (1631, 975), (1668, 964)]
path("M1222 733V923" + sm_tail(r_base) + "V746Z", "a", fill=True)
ell(1446, 737, 226, 30, "a", fill=True, rot=1.7)
out.append('<path class="a" transform="rotate(1.7 1446 737)" d="M1220 737v9a226 30 0 0 0 452 0v-9"/>')
path("M1321 766V964M1402 772V986M1631 760V975", "b")
g_top = [(1403.7, 814), (1500, 818), (1597.3, 817)]
g_bot = [(1403.7, 987.7), (1500, 992), (1597.3, 984.6)]
path(sm(g_top) + "L1631 810M" + sm(g_bot)[1:] + "L1631 974M1597.3 817V984.6M1597 872L1631 868M1597 928L1631 923", "b")
x = 1421
while x < 1590:
    path(f"M{x} {f(at(g_top, x))}V{f(at(g_bot, x))}", "c")
    x += 18
path("M1603.5 817L1637.6 812.8L1650 862.4L1616 869.9Z", "b", fill=True)

# ---------------------------------------------------------------- ground
group("ground")
path("M1668 950L1920 954", "a")
path("M600 796L646.5 833", "b")
for a, b in (((559.7, 966.7), (1100, 1098.3)), ((621.7, 946.3), (1110, 1058.8)), ((674.4, 928.3), (1120, 1025.2)),
             ((724, 912), (1130, 993.9)), ((767.5, 897), (1140, 967.2)), ((814, 884.9), (1150, 935.2))):
    path(pl([a, b]), "c")
path("M440 1001L820 1122", "b")

# ---------------------------------------------------------------- write
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 120 1920 1000" width="1920" height="1000">
  <!-- The Centre for Mathematical Sciences, Cambridge, seen from in front and to the right. -->
  <style>
    .a, .b, .c {{ fill: none; stroke: {INK}; stroke-linecap: round; stroke-linejoin: round; }}
    .a {{ stroke-width: 4; }}
    .b {{ stroke-width: 2.8; }}
    .c {{ stroke-width: 2; }}
    .w {{ fill: #fff; }}
  </style>
  <defs>
    <linearGradient id="sides" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#000"/>
      <stop offset="0.09" stop-color="#fff"/>
      <stop offset="0.93" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <linearGradient id="foot" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0.86" stop-color="#000" stop-opacity="0"/>
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
open("assets/cms.svg", "w").write(svg)
print(len(svg), "bytes,", len(out), "elements")
