#!/usr/bin/env python3
"""Generátor výkresu dekorativního panelu pro laserové pálení.

Plech 1500 x 1000 mm (na šířku). Motivy = otvory (uzavřené kontury).
Kontroly: můstky mezi otvory >= 8 mm, odstup od okraje >= 25 mm.
Výstup: DXF (R12, mm, vrstvy CUT + SHEET) a SVG 1:1.
"""
import math
import sys
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

W, H = 1500.0, 1000.0
MIN_BRIDGE = 8.0
EDGE_MARGIN = 25.0

placed = []  # list of (name, polygon)


def smooth(poly, r=2.0):
    """Zaoblí ostré rohy (dilate-erode)."""
    return poly.buffer(r, quad_segs=16).buffer(-r, quad_segs=16)


def add(name, geom):
    """Přidá motiv (Polygon nebo MultiPolygon -> rozpadne na části)."""
    if geom.is_empty:
        print(f"!! {name}: prázdná geometrie")
        return
    if geom.geom_type == "Polygon":
        parts = [geom]
    else:
        parts = list(geom.geoms)
    for i, p in enumerate(parts):
        nm = name if len(parts) == 1 else f"{name}.{i}"
        placed.append((nm, p))


# ---------------------------------------------------------------- tvary

def circle(cx, cy, r):
    return Point(cx, cy).buffer(r, quad_segs=32)


def leaf(cx, cy, length, width, angle_deg, vein=True):
    """List: špičatá elipsa; s žilkou = rozdělen 8mm můstkem na 2 půlky."""
    n = 48
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (t - 0.5) * length
        y = 0.5 * width * math.sin(math.pi * t)
        pts.append((x, y))
    for i in range(n, -1, -1):
        t = i / n
        x = (t - 0.5) * length
        y = -0.5 * width * math.sin(math.pi * t)
        pts.append((x, y))
    p = Polygon(pts)
    if vein and width >= 26:
        strip = box(-0.5 * length, -MIN_BRIDGE / 2, 0.20 * length, MIN_BRIDGE / 2)
        p = p.difference(strip)
        p = p.buffer(-0.01).buffer(0.01)
    p = affinity.rotate(p, angle_deg, origin=(0, 0))
    return affinity.translate(p, cx, cy)


def petal(length, width):
    """Okvětní lístek: elipsa protažená, špička u středu květu."""
    e = Point(0, 0).buffer(1.0, quad_segs=24)
    e = affinity.scale(e, length / 2, width / 2)
    return affinity.translate(e, length / 2, 0)


def daisy(cx, cy, n_petals, r_center, petal_len, petal_w, inner_gap, rot0=90):
    """Kopretina: střed + okvětní lístky (samostatné otvory, mezera >= 8)."""
    geoms = [circle(cx, cy, r_center)]
    for k in range(n_petals):
        a = rot0 + k * 360.0 / n_petals
        p = petal(petal_len, petal_w)
        p = affinity.translate(p, r_center + inner_gap, 0)
        p = affinity.rotate(p, a, origin=(0, 0))
        geoms.append(affinity.translate(p, cx, cy))
    return geoms


def tulip(cx, cy, w=70, h=85):
    """Hlava tulipánu se třemi špičkami nahoře, uzavřená kontura."""
    pts = [
        (-w / 2, 0.15 * h), (-w / 2 + 0.06 * w, -0.25 * h), (0, -0.42 * h),
        (w / 2 - 0.06 * w, -0.25 * h), (w / 2, 0.15 * h),
        (0.30 * w, 0.58 * h),          # pravá špička
        (0.17 * w, 0.18 * h),
        (0, 0.55 * h),                 # střední špička
        (-0.17 * w, 0.18 * h),
        (-0.30 * w, 0.58 * h),         # levá špička
    ]
    p = smooth(Polygon(pts), 4)
    return affinity.translate(p, cx, cy)


def stem(points, width=9.0):
    """Stonek: zakřivená drážka (buffer čáry)."""
    return LineString(points).buffer(width / 2, quad_segs=16)


def bezier(p0, p1, p2, n=24):
    out = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        out.append((x, y))
    return out


def trunk_with_branches(base, top, w_base, w_top, branches):
    """Kmen (kužel) sjednocený s větvemi (buffered čáry)."""
    bx, by = base
    tx, ty = top
    poly = Polygon([
        (bx - w_base / 2, by), (bx + w_base / 2, by),
        (tx + w_top / 2, ty), (tx - w_top / 2, ty),
    ])
    parts = [poly]
    for (a, b, w) in branches:
        parts.append(LineString(bezier(a, ((a[0] + b[0]) / 2, b[1]), b)).buffer(w / 2, quad_segs=12))
    return smooth(unary_union(parts), 3)


# ---------------------------------------------------------------- scéna

# ---- velký strom vlevo
add("strom_L_kmen", trunk_with_branches(
    base=(255, 130), top=(255, 505), w_base=30, w_top=15,
    branches=[
        ((255, 415), (168, 520), 11),
        ((255, 450), (348, 535), 11),
        ((255, 495), (215, 575), 9),
    ]))

foliage_L = [
    ("c", 255, 660, 40), ("c", 165, 610, 32), ("c", 345, 615, 33),
    ("c", 205, 720, 28), ("c", 310, 715, 27), ("c", 120, 545, 24),
    ("c", 390, 555, 24), ("c", 255, 775, 22),
    ("l", 140, 693, 62, 30, 35), ("l", 375, 688, 62, 30, 145),
    ("l", 95, 620, 55, 26, 100), ("l", 415, 625, 55, 26, 80),
    ("l", 78, 488, 50, 24, 55), ("l", 303, 568, 50, 24, 120),
]
for i, f in enumerate(foliage_L):
    if f[0] == "c":
        add(f"strom_L_koruna_{i}", circle(f[1], f[2], f[3]))
    else:
        add(f"strom_L_list_{i}", leaf(f[1], f[2], f[3], f[4], f[5], vein=False))

# ---- střední strom vpravo
add("strom_P_kmen", trunk_with_branches(
    base=(1268, 135), top=(1268, 440), w_base=24, w_top=13,
    branches=[
        ((1268, 360), (1195, 455), 10),
        ((1268, 395), (1342, 470), 10),
    ]))

foliage_P = [
    ("c", 1268, 570, 34), ("c", 1192, 525, 27), ("c", 1345, 528, 27),
    ("c", 1225, 640, 24), ("c", 1315, 638, 23), ("c", 1268, 700, 19),
    ("l", 1135, 585, 55, 26, 120), ("l", 1400, 588, 55, 26, 60),
    ("l", 1180, 690, 50, 24, 140), ("l", 1358, 692, 50, 24, 40),
]
for i, f in enumerate(foliage_P):
    if f[0] == "c":
        add(f"strom_P_koruna_{i}", circle(f[1], f[2], f[3]))
    else:
        add(f"strom_P_list_{i}", leaf(f[1], f[2], f[3], f[4], f[5], vein=False))

# ---- květina 1: velká kopretina
for i, g in enumerate(daisy(575, 520, 6, 22, 62, 30, 12)):
    add(f"kopretina1_{i}", g)
add("kopretina1_stonek", stem(bezier((572, 408), (548, 300), (560, 175)), 9))
add("kopretina1_list1", leaf(505, 320, 78, 36, 155))
add("kopretina1_list2", leaf(628, 268, 72, 34, 30))

# ---- květina 2: tulipán
add("tulipan1_hlava", tulip(742, 600, 74, 92))
add("tulipan1_stonek", stem(bezier((742, 545), (758, 360), (748, 175)), 9))
add("tulipan1_list", leaf(690, 300, 84, 38, 125))

# ---- květina 3: menší kopretina (5 lístků)
for i, g in enumerate(daisy(905, 470, 5, 18, 52, 26, 11, rot0=90)):
    add(f"kopretina2_{i}", g)
add("kopretina2_stonek", stem(bezier((908, 412), (925, 300), (912, 170)), 9))
add("kopretina2_list1", leaf(965, 300, 70, 32, 35))

# ---- květina 4: tulipán menší
add("tulipan2_hlava", tulip(1058, 545, 62, 78))
add("tulipan2_stonek", stem(bezier((1058, 495), (1042, 330), (1052, 172)), 9))
add("tulipan2_list", leaf(1108, 300, 72, 34, 50))

# ---- poletující listy a drobné akcenty
add("let_list1", leaf(480, 720, 68, 32, 25))
add("let_list2", leaf(870, 700, 64, 30, 160))
add("let_list3", leaf(1015, 760, 60, 28, 15))
add("let_list4", leaf(660, 790, 58, 28, 140))
add("let_list5", leaf(560, 880, 52, 26, 20))
add("let_list6", leaf(940, 870, 52, 26, 155))
add("bod1", circle(770, 730, 10))
add("bod2", circle(620, 660, 8))
add("bod3", circle(990, 640, 8))
add("bod4", circle(840, 800, 8))
add("bod5", circle(710, 880, 7))

# ---- trsy trávy
def grass(cx, cy, h=55, lean=14, w=7.0):
    blades = []
    for dx, l in ((-16, -lean), (0, 3), (16, lean)):
        blades.append(LineString(bezier((cx + dx, cy), (cx + dx + l * 0.4, cy + h * 0.6),
                                        (cx + dx + l, cy + h))).buffer(w / 2, quad_segs=10))
    return unary_union(blades)

add("trava1", grass(430, 150))
add("trava2", grass(820, 145))
add("trava3", grass(1155, 150))

# ---- kopečky dole: dvě zvlněné drážky; přeruší se kolem všech motivů
#      (můstek >= 10 mm) a segmentují se, aby panel zůstal tuhý
def hills(y0, amp, x_from, x_to, seg_gaps, width=9.0, phase=0.0):
    pts = []
    n = 240
    for i in range(n + 1):
        x = x_from + (x_to - x_from) * i / n
        y = y0 + amp * math.sin(2 * math.pi * (x / 700.0) + phase)
        pts.append((x, y))
    line = LineString(pts).buffer(width / 2, quad_segs=12)
    cutters = [box(gx - 12.5, y0 - amp - 25, gx + 12.5, y0 + amp + 25)
               for gx in seg_gaps]
    cutters += [p.buffer(MIN_BRIDGE + 2) for _, p in placed]
    line = line.difference(unary_union(cutters))
    # zahodí drobné úlomky mezi překážkami
    parts = [g for g in (line.geoms if line.geom_type == "MultiPolygon" else [line])
             if g.area >= 60 * width]
    return unary_union(parts)


add("kopec_predni", hills(105, 18, 60, 1440, [420, 780, 1120], width=10, phase=0.4))
add("kopec_zadni", hills(162, 14, 200, 1300, [600, 980], width=8.5, phase=2.6))


# ---------------------------------------------------------------- kontroly
def validate():
    ok = True
    sheet = box(0, 0, W, H)
    inner = box(EDGE_MARGIN, EDGE_MARGIN, W - EDGE_MARGIN, H - EDGE_MARGIN)
    for name, p in placed:
        if not inner.contains(p):
            print(f"!! {name}: blíž než {EDGE_MARGIN} mm od okraje "
                  f"(bounds {tuple(round(v,1) for v in p.bounds)})")
            ok = False
        if p.area < 30:
            print(f"!! {name}: podezřele malá plocha {p.area:.1f} mm2")
            ok = False
    for i in range(len(placed)):
        for j in range(i + 1, len(placed)):
            n1, p1 = placed[i]
            n2, p2 = placed[j]
            d = p1.distance(p2)
            if d < MIN_BRIDGE - 1e-6:
                print(f"!! můstek {d:.1f} mm mezi {n1} a {n2}")
                ok = False
    return ok


# ---------------------------------------------------------------- výstupy
def export_svg(path):
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" '
        f'viewBox="0 0 {W} {H}">',
        f'  <!-- Plech {W:g} x {H:g} mm, jednotky = mm, 1:1. '
        f'Vrstva CUT = pálené kontury. -->',
        f'  <g id="SHEET" fill="none" stroke="#0000ff" stroke-width="1">',
        f'    <rect x="0" y="0" width="{W}" height="{H}"/>',
        '  </g>',
        '  <g id="CUT" fill="none" stroke="#ff0000" stroke-width="1">',
    ]
    for name, p in placed:
        for ring in [p.exterior] + list(p.interiors):
            pts = " ".join(f"{x:.2f},{H - y:.2f}" for x, y in ring.coords)
            lines.append(f'    <polygon points="{pts}"/>')
    lines.append("  </g>")
    lines.append("</svg>")
    with open(path, "w") as f:
        f.write("\n".join(lines))


def export_dxf(path):
    import ezdxf
    doc = ezdxf.new("R12", setup=False)  # R12 = max. kompatibilita s CAM
    doc.layers.add("CUT", color=1)     # červená
    doc.layers.add("SHEET", color=5)   # modrá
    msp = doc.modelspace()
    msp.add_polyline2d([(0, 0), (W, 0), (W, H), (0, H)], close=True,
                       dxfattribs={"layer": "SHEET"})
    msp.add_text("PLECH 1500 x 1000 mm, JEDNOTKY = mm, MERITKO 1:1",
                 dxfattribs={"layer": "SHEET", "height": 20,
                             "insert": (10, -35)})
    for name, p in placed:
        for ring in [p.exterior] + list(p.interiors):
            msp.add_polyline2d(list(ring.coords), close=True,
                               dxfattribs={"layer": "CUT"})
    doc.saveas(path)


def export_png(path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as MplPoly, Rectangle
    fig, ax = plt.subplots(figsize=(15, 10), dpi=110)
    ax.add_patch(Rectangle((0, 0), W, H, facecolor="#c8c9cc", edgecolor="#333",
                           linewidth=1.5))
    for name, p in placed:
        ax.add_patch(MplPoly(list(p.exterior.coords), closed=True,
                             facecolor="white", edgecolor="#b00", linewidth=0.6))
        for r in p.interiors:
            ax.add_patch(MplPoly(list(r.coords), closed=True,
                                 facecolor="#c8c9cc", edgecolor="#b00", linewidth=0.6))
    ax.set_xlim(-30, W + 30)
    ax.set_ylim(-30, H + 30)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight", facecolor="white")


if __name__ == "__main__":
    # zjednodušení kontur (tolerance 0.15 mm) kvůli velikosti souborů
    placed = [(n, p.simplify(0.15)) for n, p in placed]
    ok = validate()
    total_cut = sum(sum(LineString(r.coords).length for r in [p.exterior] + list(p.interiors))
                    for _, p in placed)
    print(f"motivů: {len(placed)}, délka řezu: {total_cut/1000:.1f} m")
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    export_svg(f"{out}/panel_kytky_1500x1000.svg")
    export_dxf(f"{out}/panel_kytky_1500x1000.dxf")
    export_png(f"{out}/nahled.png")
    print("OK" if ok else "S CHYBAMI — viz výše")
