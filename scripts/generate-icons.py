"""生成 PWA 图标（192 / 512 PNG）。

用法：python3 scripts/generate-icons.py
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 512
CREAM = (242, 228, 198)
TOP = (11, 30, 54)
BOTTOM = (43, 94, 143)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def cubic(p0, p1, p2, p3, steps=120):
    points = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t * t * p2[0] + t**3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t * t * p2[1] + t**3 * p3[1]
        points.append((int(x), int(y)))
    return points


def build():
    gradient = Image.new("RGB", (SIZE, SIZE), TOP)
    draw = ImageDraw.Draw(gradient)
    for y in range(SIZE):
        draw.line([(0, y), (SIZE, y)], fill=lerp(TOP, BOTTOM, y / (SIZE - 1)))

    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=112, fill=255)

    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    base.paste(gradient, (0, 0), mask)

    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    arc = cubic((96, 372), (180, 300), (250, 420), (300, 340)) + cubic(
        (300, 340), (350, 260), (380, 200), (424, 168)
    )
    od.line(arc, fill=CREAM + (135,), width=10, joint="curve")

    cx, cy, outer, inner = 256, 248, 96, 34
    star = []
    for i in range(8):
        angle = math.radians(-90 + i * 45)
        radius = outer if i % 2 == 0 else inner
        star.append((int(cx + radius * math.cos(angle)), int(cy + radius * math.sin(angle))))
    od.polygon(star, fill=CREAM + (255,))

    od.ellipse([96 - 15, 372 - 15, 96 + 15, 372 + 15], fill=CREAM + (255,))
    od.ellipse([424 - 15, 168 - 15, 424 + 15, 168 + 15], fill=CREAM + (255,))

    return Image.alpha_composite(base, overlay)


def main():
    out = Path("public/icons")
    out.mkdir(parents=True, exist_ok=True)
    icon = build()
    icon.save(out / "icon-512.png")
    icon.resize((192, 192), Image.LANCZOS).save(out / "icon-192.png")
    print("icons written to", out.resolve())


if __name__ == "__main__":
    main()
