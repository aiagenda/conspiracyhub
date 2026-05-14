#!/usr/bin/env python3
"""
1500×500 Twitter/X header — OSINT / investigation board aesthetic.

Layout (non-negotiable for X):
  • LEFT  (x < ART_X1): dot-map, graph edges, HUD panels, radar — busy “ops” art.
  • RIGHT (x >= BRAND_X0): typography only — THE THEORIST, tagline, domain + micro line.

X profile photo overlaps the banner’s bottom-left; we keep that art corner slightly sparse.
Regenerate:  python3 scripts/render_twitter_banner.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1500, 500
# Art column: [0, ART_X1). Brand column: [BRAND_X0, W). Small gutter blends the two.
ART_X1 = 928
BRAND_X0 = 952
# X avatar sits on bottom-left of banner — keep this corner visually quiet.
AVATAR_CX, AVATAR_CY = 6, H - 10
AVATAR_RX, AVATAR_RY = 360, 300

BG = (4, 8, 6)
BG_DEEP = (2, 5, 4)
GREEN = (0, 255, 136)
GREEN_HI = (120, 255, 190)
GREEN_DIM = (72, 110, 86)
GREEN_FAINT = (38, 62, 48)
GREEN_SOFT = (0, 120, 72)
GRID = (18, 36, 26)
LINE_NET = (32, 70, 48)
PANEL_BG = (6, 14, 10)
PANEL_BORDER = (0, 90, 58)


def load_font_preferred(size: int, *names: str) -> ImageFont.FreeTypeFont:
    roots = [
        Path("/System/Library/Fonts/Supplemental"),
        Path("/System/Library/Fonts"),
        Path("/Library/Fonts"),
        Path("/usr/share/fonts/truetype/dejavu"),
    ]
    for name in names:
        for root in roots:
            p = root / name
            if not p.is_file():
                continue
            try:
                if p.suffix.lower() == ".ttc":
                    return ImageFont.truetype(str(p), size, index=0)
                return ImageFont.truetype(str(p), size)
            except OSError:
                continue
    return ImageFont.load_default()


def land_density(x: float, y: float, art_w: float, h: float) -> float:
    """Pseudo-continents in the left panel (normalized coords)."""
    nx, ny = x / art_w, y / h
    amer = math.exp(-(((nx - 0.20) / 0.11) ** 2 + ((ny - 0.48) / 0.36) ** 2) * 2.8)
    euaf = math.exp(-(((nx - 0.46) / 0.09) ** 2 + ((ny - 0.44) / 0.40) ** 2) * 2.6) * 0.92
    asia = math.exp(-(((nx - 0.70) / 0.13) ** 2 + ((ny - 0.36) / 0.30) ** 2) * 2.9) * 0.95
    aus = math.exp(-(((nx - 0.78) / 0.07) ** 2 + ((ny - 0.72) / 0.14) ** 2) * 3.5) * 0.55
    return min(1.0, (amer + euaf + asia + aus) * 1.15)


def draw_art_column(img: Image.Image, rnd: random.Random) -> None:
    draw = ImageDraw.Draw(img)
    aw = float(ART_X1)
    # Base vertical gradient
    for y in range(H):
        t = y / max(1, H - 1)
        r = int(BG[0] + t * 10)
        g = int(BG[1] + t * 14)
        b = int(BG[2] + t * 10)
        draw.line([(0, y), (ART_X1 - 1, y)], fill=(r, g, b))

    # Fine grid
    for x in range(0, ART_X1, 24):
        draw.line([(x, 0), (x, H)], fill=GRID, width=1)
    for y in range(0, H, 24):
        draw.line([(0, y), (ART_X1 - 1, y)], fill=GRID, width=1)

    # Scanlines (subtle)
    for y in range(0, H, 3):
        draw.line([(0, y), (ART_X1 - 1, y)], fill=(0, 0, 0), width=1)

    # Dot-map + graph nodes
    nodes: list[tuple[int, int]] = []
    step = 5
    for x in range(32, ART_X1 - 40, step):
        for y in range(36, H - 36, step):
            if x < 340 and y > H - 300:
                continue
            d = land_density(float(x), float(y), aw, float(H))
            if rnd.random() < d * 0.92:
                jitter = rnd.randint(-1, 1)
                px, py = x + jitter, y + jitter
                br = rnd.choice([1, 1, 1, 2])
                gcol = GREEN_FAINT if rnd.random() < 0.35 else GREEN_SOFT
                draw.ellipse([px - br, py - br, px + br, py + br], fill=gcol)
                if rnd.random() < 0.12 and len(nodes) < 220:
                    nodes.append((px, py))

    # Extra random nodes for denser graph
    for _ in range(90):
        x = rnd.randint(40, ART_X1 - 50)
        y = rnd.randint(40, H - 50)
        if x < 320 and y > H - 280:
            continue
        nodes.append((x, y))

    # Network edges (prefer short hops)
    for _ in range(140):
        if len(nodes) < 2:
            break
        a, b = rnd.sample(nodes, 2)
        dist = math.hypot(a[0] - b[0], a[1] - b[1])
        if dist > 120 or dist < 8:
            continue
        alpha = rnd.choice([LINE_NET, GRID, GREEN_FAINT])
        draw.line([a, b], fill=alpha, width=1)
    # Node highlights
    for px, py in rnd.sample(nodes, min(45, len(nodes))):
        draw.ellipse([px - 2, py - 2, px + 2, py + 2], outline=GREEN_SOFT, width=1)

    # ── Radar (top-right of art zone) ──
    rcx, rcy = ART_X1 - 88, 82
    for ri, ro in [(72, 74), (54, 56), (36, 38), (18, 20)]:
        draw.ellipse([rcx - ro, rcy - ro, rcx + ro, rcy + ro], outline=GREEN_FAINT, width=1)
    for ang in range(-60, 35, 8):
        rad = math.radians(ang - 90)
        draw.line(
            [(rcx, rcy), (rcx + 68 * math.cos(rad), rcy + 68 * math.sin(rad))],
            fill=GREEN_DIM,
            width=1,
        )
    draw.pieslice([rcx - 74, rcy - 74, rcx + 74, rcy + 74], -120, -35, fill=(0, 40, 28))

    font_mono = load_font_preferred(10, "Menlo.ttc", "DejaVuSansMono.ttf", "Courier New.ttf")
    font_mono11 = load_font_preferred(11, "Menlo.ttc", "DejaVuSansMono.ttf", "Courier New.ttf")
    font_hud = load_font_preferred(9, "Menlo.ttc", "DejaVuSansMono.ttf")

    def panel(x0: int, y0: int, x1: int, y1: int, title: str, body_lines: list[str]) -> None:
        draw.rectangle([x0, y0, x1, y1], fill=PANEL_BG, outline=PANEL_BORDER, width=1)
        draw.line([x0, y0 + 18, x1, y0 + 18], fill=PANEL_BORDER, width=1)
        draw.text((x0 + 6, y0 + 3), title, font=font_hud, fill=GREEN_HI)
        yy = y0 + 22
        for ln in body_lines:
            draw.text((x0 + 6, yy), ln[:52], font=font_mono, fill=GREEN_DIM)
            yy += 12

    # ENTITY LINK ANALYSIS
    panel(
        18,
        14,
        268,
        118,
        "ENTITY LINK ANALYSIS",
        [
            "NODES: 18,732",
            "EDGES: 92,104",
            "DENSITY: 0.013%",
            "HUB SCORE: 0.84",
        ],
    )

    # GEOLOC HEATMAP
    gx0, gy0, gx1, gy1 = ART_X1 - 278, 12, ART_X1 - 22, 108
    panel(
        gx0,
        gy0,
        gx1,
        gy1,
        "GEOLOC HEATMAP",
        [
            "LAT: 40.7128 N",
            "LON: 74.0060 W",
            "RADIUS: 120km",
            "CONF: B+",
        ],
    )
    # Mini map inset in geoloc panel
    mx0, my0 = gx1 - 58, gy0 + 58
    for i in range(6):
        for j in range(4):
            if rnd.random() < 0.55:
                draw.rectangle(
                    [mx0 + i * 8, my0 + j * 8, mx0 + i * 8 + 6, my0 + j * 8 + 6],
                    fill=GREEN_FAINT,
                )

    # DATA SOURCES
    sources = [
        ("Social Media", 0.82),
        ("Public Records", 0.64),
        ("News Archives", 0.71),
        ("FOIA / Leaks", 0.45),
        ("Satellite", 0.38),
    ]
    sx0, sy0, sx1, sy1 = 14, 128, 268, 312
    draw.rectangle([sx0, sy0, sx1, sy1], fill=PANEL_BG, outline=PANEL_BORDER, width=1)
    draw.line([sx0, sy0 + 18, sx1, sy0 + 18], fill=PANEL_BORDER, width=1)
    draw.text((sx0 + 6, sy0 + 3), "DATA SOURCES", font=font_hud, fill=GREEN_HI)
    yy = sy0 + 24
    for label, frac in sources:
        draw.text((sx0 + 6, yy), label.upper()[:18], font=font_mono, fill=GREEN_DIM)
        bar_x0, bar_y0 = sx0 + 8, yy + 11
        bar_x1 = sx1 - 10
        draw.rectangle([bar_x0, bar_y0, bar_x1, bar_y0 + 4], outline=GRID, width=1)
        bw = int((bar_x1 - bar_x0 - 2) * frac)
        draw.rectangle([bar_x0 + 1, bar_y0 + 1, bar_x0 + 1 + bw, bar_y0 + 3], fill=GREEN_SOFT)
        yy += 32

    # ACTIVITY TIMELINE
    panel(
        286,
        318,
        568,
        482,
        "ACTIVITY TIMELINE",
        [
            "RANGE: 2018-01-01 .. 2024-05-20",
            "EVENTS: 278,531",
            "SPIKE: 2022-Q3 (+14%)",
            "STATUS: CORRELATING",
        ],
    )
    # Sparkline in timeline panel
    lx0, ly0, lx1, ly1 = 296, 430, 558, 468
    draw.rectangle([lx0, ly0, lx1, ly1], outline=GRID, width=1)
    pts: list[tuple[int, int]] = []
    for i in range(28):
        vx = lx0 + 8 + i * ((lx1 - lx0 - 16) // 27)
        vy = ly1 - 6 - int(22 * (0.35 + 0.65 * abs(math.sin(i * 0.45 + 1.2))))
        pts.append((vx, vy))
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=GREEN, width=1)

    # Terminal strip (mid-left, above avatar quiet zone)
    tx, ty = 300, H - 86
    cmds = ["> analyze()", "> correlate()", "> visualize()", "> export() // theorist"]
    for i, c in enumerate(cmds):
        draw.text((tx, ty + i * 14), c, font=font_mono11, fill=GREEN_DIM if i < 3 else GREEN_SOFT)

    # Corner vignette under future avatar
    for i in range(10, 0, -1):
        t = i / 10.0
        ax = int(AVATAR_RX * (0.5 + 0.5 * t))
        ay = int(AVATAR_RY * (0.5 + 0.5 * t))
        shade = (
            int(BG_DEEP[0] + t * 6),
            int(BG_DEEP[1] + t * 10),
            int(BG_DEEP[2] + t * 8),
        )
        draw.ellipse(
            [AVATAR_CX - ax, AVATAR_CY - ay, AVATAR_CX + ax, AVATAR_CY + ay],
            fill=shade,
        )


def draw_brand_column(draw: ImageDraw.ImageDraw) -> None:
    """Typography in the right column only (never overlaps art)."""
    margin_r = 48
    x_anchor = W - margin_r
    y0 = 86

    font_title = load_font_preferred(46, "Arial Black.ttf")
    font_sub = load_font_preferred(20, "Arial Narrow.ttf", "Arial.ttf")
    font_url = load_font_preferred(20, "Menlo.ttc", "DejaVuSansMono.ttf", "Arial.ttf")
    font_micro = load_font_preferred(11, "Arial Narrow.ttf", "DejaVuSans.ttf")

    title = "THE THEORIST"
    sub = "AI INVESTIGATIVE INTELLIGENCE"
    url = "the-theorist.com"

    for dx, dy, col in [(4, 4, (0, 28, 18)), (2, 2, (0, 48, 28)), (1, 1, (0, 62, 38))]:
        draw.text((x_anchor + dx, y0 + dy), title, font=font_title, fill=col, anchor="rm")
    draw.text((x_anchor, y0), title, font=font_title, fill=GREEN, anchor="rm")

    y1 = y0 + 56
    draw.text((x_anchor, y1), sub, font=font_sub, fill=GREEN_DIM, anchor="rm")

    y2 = y1 + 30
    draw.text((x_anchor, y2), url, font=font_url, fill=GREEN_HI, anchor="rm")

    line_y = y2 + 34
    line_x0 = max(BRAND_X0 + 36, int(x_anchor - 420))
    draw.line([(line_x0, line_y), (x_anchor, line_y)], fill=PANEL_BORDER, width=1)
    draw.text(
        (x_anchor, line_y + 10),
        "LIVE FEED · ORACLE BOARDS · /BLOG REPORTS",
        font=font_micro,
        fill=(48, 72, 56),
        anchor="rm",
    )


def main() -> None:
    rnd = random.Random(42)
    img = Image.new("RGB", (W, H), BG)
    draw_art_column(img, rnd)
    draw = ImageDraw.Draw(img)

    # Soft blend from art into brand column
    blend_w = BRAND_X0 - (ART_X1 - 2)
    for i, x in enumerate(range(ART_X1 - 2, BRAND_X0)):
        t = i / max(1, blend_w - 1) if blend_w > 1 else 1.0
        r = int(BG[0] + t * 4)
        g = int(BG[1] + t * 8)
        b = int(BG[2] + t * 6)
        draw.line([(x, 0), (x, H)], fill=(r, g, b))

    draw.rectangle([BRAND_X0, 0, W, H], fill=(4, 12, 8))
    # Subtle vertical rhythm in brand column (readable, not noisy)
    for x in range(BRAND_X0 + 24, W, 52):
        draw.line([(x, 0), (x, H)], fill=(6, 16, 11), width=1)
    draw.line([(BRAND_X0, 0), (BRAND_X0, H)], fill=(0, 72, 48), width=1)
    draw.line([(BRAND_X0 + 1, 0), (BRAND_X0 + 1, H)], fill=(0, 40, 28), width=1)

    draw_brand_column(draw)

    out = Path(__file__).resolve().parents[1] / "public" / "brand" / "twitter" / "twitter-banner-the-theorist.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out, img.size)


if __name__ == "__main__":
    main()
