#!/usr/bin/env python3
"""Raster 1500x500 Twitter banner: left abstract motif, right typography + URL."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1500, 500
SPLIT = 760  # left visual zone (~51%)
BG = (5, 12, 7)
GREEN = (0, 255, 136)
GREEN_DIM = (90, 128, 104)
LINE = (26, 51, 32)
GREEN_SOFT = (0, 120, 72)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return load_font_preferred(size, name)


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


def draw_left_panel(img: Image.Image, rnd: random.Random) -> None:
    draw = ImageDraw.Draw(img)
    # Vertical gradient
    for y in range(H):
        t = y / max(1, H - 1)
        r = int(BG[0] + t * 8)
        g = int(BG[1] + t * 12)
        b = int(BG[2] + t * 8)
        draw.line([(0, y), (SPLIT, y)], fill=(r, g, b))

    # Soft radial discs (concentric, low-contrast)
    cx, cy = int(SPLIT * 0.40), H // 2
    for r in range(200, 0, -16):
        t = 1 - r / 200
        c = (
            int(BG[0] + t * GREEN_SOFT[0] * 0.15),
            int(BG[1] + t * GREEN_SOFT[1] * 0.12),
            int(BG[2] + t * GREEN_SOFT[2] * 0.1),
        )
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=c, width=1)

    # Grid
    step = 38
    for x in range(0, SPLIT, step):
        draw.line([(x, 0), (x, H)], fill=LINE, width=1)
    for y in range(0, H, step):
        draw.line([(0, y), (SPLIT, y)], fill=LINE, width=1)

    # Hex outline
    hx, hy = int(SPLIT * 0.36), H // 2
    rad = 112
    pts = []
    for i in range(6):
        ang = math.radians(-90 + i * 60)
        pts.append((hx + rad * math.cos(ang), hy + rad * math.sin(ang)))
    for i in range(6):
        a, b = pts[i], pts[(i + 1) % 6]
        draw.line([a, b], fill=GREEN_SOFT, width=2)

    # Scatter nodes + edges
    nodes: list[tuple[int, int]] = []
    for _ in range(40):
        nx = rnd.randint(20, SPLIT - 20)
        ny = rnd.randint(20, H - 20)
        if nx > SPLIT - 100:
            continue
        nodes.append((nx, ny))
    for nx, ny in nodes[:16]:
        rr = rnd.choice([2, 3, 4])
        draw.ellipse([nx - rr, ny - rr, nx + rr, ny + rr], fill=GREEN_SOFT)
    for _ in range(12):
        if len(nodes) < 2:
            break
        a, b = rnd.sample(nodes, 2)
        draw.line([a, b], fill=LINE, width=1)


def main() -> None:
    rnd = random.Random(42)
    img = Image.new("RGB", (W, H), BG)
    draw_left_panel(img, rnd)
    draw = ImageDraw.Draw(img)

    # Blend strip into right panel
    for x in range(SPLIT - 1, min(SPLIT + 32, W)):
        t = (x - (SPLIT - 1)) / 32.0
        r = int(BG[0] + t * 2)
        g = int(BG[1] + t * 4)
        b = int(BG[2] + t * 3)
        draw.line([(x, 0), (x, H)], fill=(r, g, b))

    draw.rectangle([SPLIT + 28, 0, W, H], fill=(6, 15, 10))

    margin_r = 46
    x_anchor = W - margin_r
    y0 = 104

    font_title = load_font_preferred(44, "Arial Black.ttf")
    font_sub = load_font_preferred(21, "Arial Narrow.ttf")
    font_url = load_font_preferred(20, "Menlo.ttc", "DejaVuSansMono.ttf", "Arial.ttf")
    font_micro = load_font_preferred(12, "Arial Narrow.ttf", "DejaVuSans.ttf")

    title = "THE THEORIST"
    sub = "AI INVESTIGATIVE INTELLIGENCE"
    url = "the-theorist.com"

    # Title depth
    for dx, dy, col in [(3, 3, (0, 40, 24)), (2, 2, (0, 55, 32)), (1, 1, (0, 70, 44))]:
        draw.text((x_anchor + dx, y0 + dy), title, font=font_title, fill=col, anchor="rm")
    draw.text((x_anchor, y0), title, font=font_title, fill=GREEN, anchor="rm")

    y1 = y0 + 56
    draw.text((x_anchor, y1), sub, font=font_sub, fill=GREEN_DIM, anchor="rm")

    y2 = y1 + 32
    draw.text((x_anchor, y2), url, font=font_url, fill=GREEN, anchor="rm")

    line_y = y2 + 38
    draw.line([(SPLIT + 72, line_y), (x_anchor, line_y)], fill=LINE, width=1)
    draw.text(
        (x_anchor, line_y + 12),
        "LIVE FEED · BOARDS · ANALYSIS REPORTS",
        font=font_micro,
        fill=(52, 72, 58),
        anchor="rm",
    )

    out = Path(__file__).resolve().parents[1] / "public" / "brand" / "twitter" / "twitter-banner-the-theorist.png"
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    print("Wrote", out, img.size)


if __name__ == "__main__":
    main()
