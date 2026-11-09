"""Генерує іконки PWA: жовтий медіатор з нотою на темному тлі."""
import sys
from PIL import Image, ImageDraw

BG = (15, 16, 18, 255)
AMBER = (245, 184, 65, 255)
DARK = (15, 16, 18, 255)

def pick(size, scale, rounded_bg):
    S = size * 4  # supersampling
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded_bg:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BG)
    else:
        d.rectangle([0, 0, S, S], fill=BG)
    c = S / 2
    w = S * 0.62 * scale
    top = c - w * 0.52
    # медіатор: еліпс, нижня половина звужується до заокругленого кінчика
    import math
    a, b = w * 0.5, w * 0.56
    cy = top + b * 0.95
    pts = []
    for i in range(720):
        t = 2 * math.pi * i / 720
        x, y = a * math.sin(t), -b * math.cos(t)
        if y > 0:
            x *= 1 - 0.72 * (y / b) ** 1.15
        pts.append((c + x, cy + y))
    d.polygon(pts, fill=AMBER)
    # нота
    n = w * 0.36
    nx, ny = c - n * 0.12, top + w * 0.16
    d.rectangle([nx + n * 0.28, ny, nx + n * 0.38, ny + n * 1.05], fill=DARK)
    d.polygon([(nx + n * 0.38, ny), (nx + n * 0.75, ny + n * 0.18), (nx + n * 0.75, ny + n * 0.36), (nx + n * 0.38, ny + n * 0.2)], fill=DARK)
    d.ellipse([nx - n * 0.12, ny + n * 0.82, nx + n * 0.4, ny + n * 1.18], fill=DARK)
    return img.resize((size, size), Image.LANCZOS)

out = sys.argv[1]
pick(192, 1.0, True).save(f'{out}/icon-192.png')
pick(512, 1.0, True).save(f'{out}/icon-512.png')
pick(512, 0.78, False).save(f'{out}/icon-maskable-512.png')
pick(180, 0.9, False).save(f'{out}/apple-touch-icon.png')
