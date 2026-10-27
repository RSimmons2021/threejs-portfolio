"""Resize one texture for a quality tier (needs Pillow with WebP; run by build_ring.py).
usage: resize_texture.py <src> <dst> <max px>"""
import sys
from PIL import Image
src, dst, px = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src)
if max(im.size) > px:
    im = im.resize((min(px, im.width), min(px, im.height)), Image.LANCZOS)
if dst.endswith('.webp'):
    im.save(dst, 'WEBP', quality=82, method=4)
else:
    im.convert('RGB').save(dst, 'JPEG', quality=86, optimize=True)
