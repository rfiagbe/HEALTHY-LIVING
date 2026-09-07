"""Render the PWA icons with Pillow so the repo carries no hand-made binary assets.

Run:  python tools/make_icons.py
"""
import math
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons")
BG = (15, 81, 50, 255)
HEART = (167, 232, 195, 255)
PULSE = (246, 247, 245, 255)


def heart_outline(cx, cy, w, h, steps=200):
    """The standard parametric heart curve, scaled into a w x h box centred on (cx, cy)."""
    pts = []
    for i in range(steps + 1):
        t = 2 * math.pi * i / steps
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        pts.append((cx + x * w / 32, cy - y * h / 32))
    return pts


def build(size, supersample=4):
    s = size * supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.1875), fill=BG)
    d.line(heart_outline(s * 0.5, s * 0.45, s * 0.66, s * 0.66),
           fill=HEART, width=max(1, int(s * 0.05)), joint="curve")
    pulse = [(0.19, 0.60), (0.33, 0.60), (0.40, 0.47), (0.50, 0.72),
             (0.58, 0.53), (0.65, 0.60), (0.81, 0.60)]
    d.line([(s * x, s * y) for x, y in pulse],
           fill=PULSE, width=max(1, int(s * 0.048)), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for px in (192, 512):
        path = os.path.join(OUT, f"icon-{px}.png")
        build(px).save(path)
        print("wrote", path)
