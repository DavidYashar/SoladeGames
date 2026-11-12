"""Trace the plate PNG into layered polygons for Blender.

    python art/trace_plate.py

Reads the transparent PNG, splits it into colour regions (cream casing, dark frame,
amber face and the metal screws), traces each region's outline, simplifies it and
writes JSON in metres with the origin at the centre of the silhouette.

Also writes a debug PNG so the classification can be eyeballed.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

import sys

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# usage: trace_plate.py [image] [output-stem] [long-side-metres]
NAME = sys.argv[1] if len(sys.argv) > 1 else "plate"
STEM = sys.argv[2] if len(sys.argv) > 2 else "plate_contours"
SRC = HERE / "reference" / f"{NAME}.png"
LONG_SIDE_M = float(sys.argv[3]) if len(sys.argv) > 3 else 0.115


def classify(rgb: np.ndarray, alpha: np.ndarray) -> dict[str, np.ndarray]:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    solid = alpha > 128

    cream = solid & (mx > 185) & (sat < 45)
    dark = solid & (mx < 80)
    metal = solid & ~cream & ~dark & (sat < 55) & (mx >= 80) & (mx <= 200)
    # The body is whatever is left, so the pipeline is not tied to one colour.
    face = solid & ~cream & ~dark & ~metal

    return {"face": face, "cream": cream, "dark": dark, "metal": metal}


def largest_component(mask: np.ndarray) -> np.ndarray:
    """Flood fill from the biggest seed, keeping only that component."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    best: list[tuple[int, int]] = []

    ys, xs = np.where(mask)
    for y0, x0 in zip(ys[:: max(1, len(ys) // 40)], xs[:: max(1, len(xs) // 40)]):
        if seen[y0, x0]:
            continue
        stack = [(y0, x0)]
        seen[y0, x0] = True
        comp = []
        while stack:
            y, x = stack.pop()
            comp.append((y, x))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        if len(comp) > len(best):
            best = comp

    out = np.zeros_like(mask, dtype=bool)
    for y, x in best:
        out[y, x] = True
    return out


def trace(mask: np.ndarray) -> list[tuple[float, float]]:
    """Outer boundary, one point per angular bin.

    The mask's edge is a ring a couple of pixels thick; taking the farthest edge pixel
    in each angular bin keeps the outside of that ring and throws away the inside,
    which is what produced spikes at the corners.
    """
    shifted = [np.roll(np.roll(mask, dy, 0), dx, 1) for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1))]
    eroded = mask.copy()
    for s in shifted:
        eroded &= s
    boundary = mask & ~eroded

    ys, xs = np.where(boundary)
    if len(ys) == 0:
        return []
    cy, cx = ys.mean(), xs.mean()

    bins = 720
    best: dict[int, tuple[float, float, float]] = {}
    for y, x in zip(ys, xs):
        dx, dy = x - cx, y - cy
        radius = math.hypot(dx, dy)
        angle = math.atan2(dy, dx)
        b = int((angle + math.pi) / (2 * math.pi) * bins) % bins
        if b not in best or radius > best[b][2]:
            best[b] = (float(x), float(y), radius)

    return [(best[b][0], best[b][1]) for b in sorted(best)]


def smooth_loop(points, passes: int = 3, window: int = 5):
    """Circular moving average, to take the staircase out of a pixel trace."""
    pts = list(points)
    if len(pts) < window:
        return pts
    half = window // 2
    for _ in range(passes):
        nxt = []
        for i in range(len(pts)):
            xs = [pts[(i + k) % len(pts)][0] for k in range(-half, half + 1)]
            ys = [pts[(i + k) % len(pts)][1] for k in range(-half, half + 1)]
            nxt.append((sum(xs) / window, sum(ys) / window))
        pts = nxt
    return pts


def rdp(points: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    if len(points) < 3:
        return points
    start, end = np.array(points[0]), np.array(points[-1])
    line = end - start
    length = np.linalg.norm(line) or 1.0
    normal = np.array([-line[1], line[0]]) / length

    dists = [abs(np.dot(np.array(p) - start, normal)) for p in points[1:-1]]
    if not dists:
        return [points[0], points[-1]]
    idx = int(np.argmax(dists))
    if dists[idx] > eps:
        left = rdp(points[: idx + 2], eps)
        right = rdp(points[idx + 1 :], eps)
        return left[:-1] + right
    return [points[0], points[-1]]


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    data = np.array(img)
    rgb = data[:, :, :3]
    alpha = data[:, :, 3]
    h, w = alpha.shape

    classes = classify(rgb, alpha)

    debug = np.zeros((h, w, 4), dtype=np.uint8)
    palette = {
        "cream": (240, 235, 220, 255),
        "dark": (40, 40, 45, 255),
        "face": (200, 60, 60, 255),
        "metal": (150, 160, 170, 255),
    }
    for name, mask in classes.items():
        debug[mask] = palette[name]
    Image.fromarray(debug, "RGBA").save(OUT / f"{STEM}_classes.png")

    for name, mask in classes.items():
        print(f"{name:6s} pixels: {int(mask.sum())}")

    face_px = rgb[classes["face"]]
    face_colour = "#%02x%02x%02x" % tuple(int(v) for v in face_px.mean(axis=0)) if len(face_px) else "#c81f1f"
    print("face colour:", face_colour)

    # metres per pixel, centred on the silhouette
    ys, xs = np.where(alpha > 128)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    span = max(x1 - x0, y1 - y0)
    scale = LONG_SIDE_M / span
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2

    def to_model(p: tuple[int, int]) -> tuple[float, float]:
        return ((p[1] - cx) * scale, -(p[0] - cy) * scale)

    # The regions nest: cream contains dark contains amber contains the screws.
    # Fill from the inside out so each layer's boundary is its outer edge only.
    metal = classes["metal"]
    face_filled = classes["face"] | metal
    dark_filled = classes["dark"] | face_filled
    cream_filled = classes["cream"] | dark_filled

    result = {}
    for name, mask in (
        ("cream", cream_filled),
        ("dark", dark_filled),
        ("face", face_filled),
    ):
        comp = largest_component(mask)
        contour = trace(comp)
        simplified = rdp(smooth_loop(contour, passes=8, window=11), 0.6)
        result[name] = [to_model((int(round(y)), int(round(x)))) for x, y in simplified]
        print(f"{name:6s} outline points: {len(result[name])}")

    # Screws: the two metal blobs, taken as separate connected components.
    ys_m, xs_m = np.where(metal)
    screws = []
    if len(ys_m):
        seen = np.zeros_like(metal, dtype=bool)
        comps = []
        for y0, x0 in zip(ys_m, xs_m):
            if seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            pts = []
            while stack:
                y, x = stack.pop()
                pts.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < metal.shape[0] and 0 <= nx < metal.shape[1] \
                           and metal[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
            if len(pts) > 320:
                py = sum(p[0] for p in pts) / len(pts)
                px = sum(p[1] for p in pts) / len(pts)
                comps.append((len(pts), px, py))
        # The screws are two similar mid-sized blobs; the plate's inner edge also
        # classifies as metal and is much larger, so filter by size.
        comps = [c for c in comps if 300 < c[0] < 1000]
        comps.sort(reverse=True)
        for _, px, py in comps[:2]:
            screws.append(to_model((int(py), int(px))))  # to_model takes (y, x)
    result["screws"] = screws
    result["faceColor"] = face_colour
    print("screws:", [tuple(round(v, 4) for v in s) for s in screws])

    (OUT / f"{STEM}.json").write_text(json.dumps(result), encoding="utf-8")
    print("wrote", OUT / f"{STEM}.json")


main()
