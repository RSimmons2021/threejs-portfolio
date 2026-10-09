"""Step 1: paint the shared 1024x1024 atlas (kit_color.png, kit_mask.png).

kit_color.png  sRGB base colour.
kit_mask.png   linear: R = window glass (lit at night by the shader),
                       G = per-window id 0..1 (decides which windows are lit),
                       B = always-emissive (neon, lamps, screens).
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import numpy as np

N = ATLAS
rng = np.random.default_rng(42)
col = np.zeros((N, N, 3), np.float32)
msk = np.zeros((N, N, 3), np.float32)

def c(h):
    return np.array(hex_rgb(h), np.float32)

def rect(x, y, w, h, color=None, m=None):
    if color is not None:
        col[y:y + h, x:x + w] = color
    if m is not None:
        msk[y:y + h, x:x + w] = m

def noise(x, y, w, h, amt=0.05, scale=1):
    n = rng.normal(0, amt, (h // scale + 1, w // scale + 1)).astype(np.float32)
    n = np.kron(n, np.ones((scale, scale), np.float32))[:h, :w]
    col[y:y + h, x:x + w] *= (1 + n)[..., None]

def streaks(x, y, w, h, count=14, amt=0.25):
    for _ in range(count):
        sx = x + int(rng.integers(0, w)); sw = int(rng.integers(2, 7))
        top = y + h - int(rng.integers(0, h // 3)); length = int(rng.integers(h // 4, h))
        y0 = max(y, top - length)
        grad = np.linspace(1 - amt, 1, top - y0, dtype=np.float32)[:, None, None]
        col[y0:top, sx:sx + sw] *= grad

# --- swatches ---------------------------------------------------------------
for name, (cx, cy, h, e) in SWATCH.items():
    rect(cx * SW, cy * SW, SW, SW, c(h), (0, 0, 1 if e else 0))
for part, row in VARIANT_ROWS.items():
    for i, h in enumerate(VARIANTS[part]):
        rect(i * SW, row * SW, SW, SW, c(h), (0, 0, 0))
# visor/hair neon variants stay non-emissive; emissive comes from 'visor' swatch.

window_id = [0]
def window(x, y, w, h, glass='#0f1a20', frame='#14171a', fw=4):
    rect(x - fw, y - fw, w + 2 * fw, h + 2 * fw, c(frame))
    g = c(glass)
    grad = np.linspace(0.75, 1.15, h, dtype=np.float32)[:, None, None]
    col[y:y + h, x:x + w] = g * grad
    window_id[0] += 1
    rid = rng.random()
    msk[y:y + h, x:x + w] = (1, rid, 0)
    # blinds / curtains on some windows
    if rng.random() < 0.35:
        cut = int(h * rng.uniform(0.3, 0.8))
        col[y + h - cut:y + h, x:x + w] *= 0.6

# --- facade_win: concrete with 3x3 windows --------------------------------
x0, y0 = TILES['facade_win'][:2]
rect(x0, y0, 256, 256, c('#474c52')); noise(x0, y0, 256, 256, 0.06, 4); streaks(x0, y0, 256, 256)
for r in range(3):
    rect(x0, y0 + r * 85 + 2, 256, 6, c('#33373c'))           # floor slab line
    for k in range(3):
        window(x0 + 18 + k * 82, y0 + r * 85 + 22, 56, 50)
    rect(x0, y0 + r * 85 + 16, 256, 4, c('#5d6268'))           # sills

# --- facade_strip: office ribbon windows ----------------------------------
x0, y0 = TILES['facade_strip'][:2]
rect(x0, y0, 256, 256, c('#3d4349')); noise(x0, y0, 256, 256, 0.04, 8)
for r in range(4):
    yy = y0 + r * 64 + 18
    for k in range(4):
        window(x0 + 6 + k * 62, yy, 56, 30, glass='#1d3a40', frame='#23282d', fw=3)
    rect(x0, yy - 10, 256, 5, c('#2b2f34'))
streaks(x0, y0, 256, 256, 8, 0.2)

# --- facade_balcony: recessed back wall with door + window -----------------
x0, y0 = TILES['facade_balcony'][:2]
rect(x0, y0, 256, 256, c('#5a5f66')); noise(x0, y0, 256, 256, 0.07, 4); streaks(x0, y0, 256, 256, 10, 0.3)
window(x0 + 30, y0 + 12, 70, 170, glass='#14222a')          # balcony door
window(x0 + 130, y0 + 90, 96, 92)                            # window
rect(x0 + 140, y0 + 20, 70, 40, c('#2a2d31'))                # AC unit
rect(x0 + 148, y0 + 26, 54, 28, c('#3a3e43'))

# --- storefront: roller shutter + sign band --------------------------------
x0, y0 = TILES['storefront'][:2]
rect(x0, y0, 256, 256, c('#2b2f34'))
rect(x0 + 16, y0, 224, 180, c('#4a5056'))
for k in range(0, 180, 8):
    rect(x0 + 16, y0 + k, 224, 3, c('#33383d'))
noise(x0 + 16, y0, 224, 180, 0.08, 2)
rect(x0 + 16, y0, 224, 18, c('#ffd27a') * 0.8, (0, 0, 1))      # light leaking under shutter
rect(x0, y0 + 190, 256, 56, c('#0e1013'))                     # sign band (signs go here)
rect(x0, y0 + 186, 256, 4, c('#ff2bd6'), (0, 0, 1))           # neon line
rect(x0, y0, 16, 186, c('#3d4349')); rect(x0 + 240, y0, 16, 186, c('#3d4349'))

# --- storefront_door: glass door, lit interior, neon frame -----------------
x0, y0 = TILES['storefront_door'][:2]
rect(x0, y0, 256, 256, c('#2b2f34')); noise(x0, y0, 256, 256, 0.05, 4)
rect(x0 + 40, y0, 176, 196, c('#22e5ff'), (0, 0, 1))         # neon frame
rect(x0 + 48, y0, 160, 188, c('#1b1410'))
grad = np.linspace(1.0, 0.55, 188, dtype=np.float32)[:, None, None]
col[y0:y0 + 188, x0 + 48:x0 + 208] = c('#ffcf8a') * grad       # warm interior (always lit)
msk[y0:y0 + 188, x0 + 48:x0 + 208] = (0, 0, 1)
rect(x0 + 126, y0, 4, 188, c('#0e1013'), (0, 0, 0))           # door split
rect(x0 + 48, y0 + 92, 160, 3, c('#0e1013'), (0, 0, 0))
rect(x0, y0 + 206, 256, 40, c('#0e1013'))                     # sign band

# --- pad_top: landing pad --------------------------------------------------
x0, y0 = TILES['pad_top'][:2]
rect(x0, y0, 256, 256, c('#1a1c1f')); noise(x0, y0, 256, 256, 0.1, 2)
yy, xx = np.mgrid[0:256, 0:256]
d = np.hypot(xx - 127.5, yy - 127.5)
ring = (d > 96) & (d < 104)
col[y0:y0 + 256, x0:x0 + 256][ring] = c('#22e5ff'); msk[y0:y0 + 256, x0:x0 + 256][ring] = (0, 0, 1)
hz = ((abs(xx - 127.5) < 46) & (abs(yy - 127.5) < 52)) & ((abs(xx - 127.5) > 30) | (abs(yy - 127.5) < 8))
col[y0:y0 + 256, x0:x0 + 256][hz] = c('#d8a21a')
edge = (xx < 6) | (xx > 249) | (yy < 6) | (yy > 249)
stripes = edge & (((xx + yy) // 12) % 2 == 0)
col[y0:y0 + 256, x0:x0 + 256][stripes] = c('#d8a21a')

# --- small tiles -----------------------------------------------------------
x0, y0 = TILES['vending'][:2]
rect(x0, y0, 128, 128, c('#1d2125'))
rect(x0 + 10, y0 + 30, 80, 88, c('#7af0ff') * 0.5, (0, 0, 1))
for r in range(4):
    for k in range(3):
        hue = ['#ff2bd6', '#ffb02e', '#9dff3a', '#ff2a2a'][(r + k) % 4]
        rect(x0 + 16 + k * 25, y0 + 36 + r * 21, 16, 14, c(hue), (0, 0, 1))
rect(x0 + 98, y0 + 60, 20, 30, c('#3d4349')); rect(x0 + 10, y0 + 8, 80, 14, c('#0e1013'))

x0, y0 = TILES['kiosk_screen'][:2]
g = np.linspace(0.25, 1.0, 128, dtype=np.float32)[:, None, None]
col[y0:y0 + 128, x0:x0 + 128] = c('#22e5ff') * g
msk[y0:y0 + 128, x0:x0 + 128] = (0, 0, 1)
for r in range(10, 120, 9):
    w = int(rng.integers(30, 100))
    rect(x0 + 10, y0 + r, w, 3, c('#e8fdff'), (0, 0, 1))
col[y0:y0 + 128:3, x0:x0 + 128] *= 0.7

x0, y0 = TILES['skyline_win'][:2]
rect(x0, y0, 128, 128, c('#1f2327'))
for r in range(0, 128, 10):
    for k in range(0, 128, 8):
        if rng.random() < 0.9:
            rect(x0 + k + 2, y0 + r + 3, 4, 5, c('#0c1418'), (1, rng.random(), 0))

x0, y0 = TILES['vent_grille'][:2]
rect(x0, y0, 128, 128, c('#2b2f34'))
for k in range(6, 122, 8):
    rect(x0 + 6, y0 + k, 116, 4, c('#0e1013'))

x0, y0 = TILES['ac_front'][:2]
rect(x0, y0, 128, 128, c('#4f5459')); noise(x0, y0, 128, 128, 0.06, 2)
yy, xx = np.mgrid[0:128, 0:128]; d = np.hypot(xx - 64, yy - 64)
fan = d < 50
col[y0:y0 + 128, x0:x0 + 128][fan] = c('#1d2125')
for k in range(0, 128, 6):
    sel = fan & (abs(yy - k) < 1)
    col[y0:y0 + 128, x0:x0 + 128][sel] = c('#3d4349')

x0, y0 = TILES['panel_tech'][:2]
rect(x0, y0, 128, 128, c('#3d4349')); noise(x0, y0, 128, 128, 0.05, 4)
for _ in range(12):
    px, py = int(rng.integers(0, 110)), int(rng.integers(0, 110))
    pw, ph = int(rng.integers(8, 40)), int(rng.integers(4, 24))
    rect(x0 + px, y0 + py, pw, ph, c('#2b2f34'))
rect(x0 + 100, y0 + 10, 6, 6, c('#3dff8a'), (0, 0, 1))
rect(x0 + 110, y0 + 10, 6, 6, c('#ff2a2a'), (0, 0, 1))

x0, y0 = TILES['car_grille'][:2]
rect(x0, y0, 128, 128, c('#0e1013'))
for k in range(8, 120, 10):
    rect(x0 + 6, y0 + k, 116, 5, c('#5e0a0f'))

x0, y0 = TILES['car_dash'][:2]
rect(x0, y0, 128, 128, c('#0c0e11'))
rect(x0 + 8, y0 + 50, 52, 40, c('#22e5ff') * 0.8, (0, 0, 1))
rect(x0 + 68, y0 + 50, 52, 40, c('#ff2bd6') * 0.7, (0, 0, 1))
rect(x0 + 8, y0 + 20, 112, 10, c('#ffb02e') * 0.8, (0, 0, 1))

col = np.clip(col, 0, 1)

def save(arr, name, colorspace):
    img = bpy.data.images.get(name)
    if img is None or tuple(img.size) != (N, N):
        if img:
            bpy.data.images.remove(img)
        img = bpy.data.images.new(name, N, N, alpha=False)
    img.colorspace_settings.name = colorspace
    rgba = np.ones((N, N, 4), np.float32); rgba[..., :3] = arr
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = os.path.join(TEX, name)
    img.file_format = 'PNG'
    img.save()
    return img

save(col, 'kit_color.png', 'sRGB')
save(msk, 'kit_mask.png', 'Non-Color')
atlas_material()   # created once; images are updated in place so every model keeps its material
print('atlas ok', os.path.getsize(os.path.join(TEX, 'kit_color.png')), os.path.getsize(os.path.join(TEX, 'kit_mask.png')))
