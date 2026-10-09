"""Step 11: bake the district light volume -> textures/light_volume.png + light-volume.json

Runs WITHOUT Blender (needs numpy only); use Blender's bundled interpreter:
  /path/to/blender-5.x/5.x/python/bin/python3.13 scripts/neon-district/11_light_volume.py

A coarse 3D grid over the district stores, per cell:
  A   = sky visibility (cosine-weighted share of the upper hemisphere not blocked by
        towers or skybridges). Gives the bright-top / black-bottom canyon falloff.
  RGB = neon bounce: coloured light from signs, billboards, shopfronts, lamps,
        vending machines, kiosks, skybridge strips and pad rings, with distance
        falloff and tower occlusion.
Occluders are the tower and skybridge collision boxes from district-layout.json,
which match the real geometry closely at this resolution.
"""
import json, math, os, struct, zlib
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'static/models/cyber')
L = json.load(open(os.path.join(OUT, 'district-layout.json')))
SIGNS = json.load(open(os.path.join(OUT, 'signs-atlas.json')))['designs']
ACCENTS = ['#bce685', '#71e0f4', '#a6baff', '#f8b984', '#c9b6ff', '#f8d665']   # projectCatalog order

MIN = np.array([-120.0, -100.0, 0.0])
MAX = np.array([210.0, 40.0, 128.0])
CELL = np.array([3.0, 3.0, 4.0])
DIM = np.round((MAX - MIN) / CELL).astype(int) + 1          # sample points on cell corners
NX, NY, NZ = DIM
TILE_COLS = 8
TILE_ROWS = math.ceil(NZ / TILE_COLS)

def rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)])

# ------------------------------------------------------------------ occluders (AABBs)
boxes = []
for t in L['towers']:
    c, s = np.array(t['collision']['center']), np.array(t['collision']['size'])
    boxes.append((c - s / 2, c + s / 2))
for b in L['skybridges']:
    c = np.array(b['center'], float); r = b['rotZ']; Lb = b['length']
    dx, dy = abs(math.cos(r)) * Lb / 2 + abs(math.sin(r)) * 2.1, abs(math.sin(r)) * Lb / 2 + abs(math.cos(r)) * 2.1
    boxes.append((np.array([c[0] - dx, c[1] - dy, c[2]]), np.array([c[0] + dx, c[1] + dy, c[2] + 3.4])))
BMIN = np.array([b[0] for b in boxes]); BMAX = np.array([b[1] for b in boxes])

def occluded(origins, dirs, max_t):
    """origins (N,3), dirs (N,3) unit, max_t (N,) -> bool (N,) hit any box before max_t."""
    hit = np.zeros(len(origins), bool)
    inv = 1.0 / np.where(np.abs(dirs) < 1e-9, 1e-9, dirs)
    for lo, hi in zip(BMIN, BMAX):
        t1 = (lo - origins) * inv; t2 = (hi - origins) * inv
        tmin = np.minimum(t1, t2).max(axis=1); tmax = np.maximum(t1, t2).min(axis=1)
        hit |= (tmax >= np.maximum(tmin, 1e-3)) & (tmin < max_t)
    return hit

gx = MIN[0] + np.arange(NX) * CELL[0]
gy = MIN[1] + np.arange(NY) * CELL[1]
gz = MIN[2] + np.arange(NZ) * CELL[2] + 0.5     # lift samples off the ground
P = np.stack(np.meshgrid(gx, gy, gz, indexing='ij'), -1).reshape(-1, 3)
inside = np.zeros(len(P), bool)
for lo, hi in zip(BMIN, BMAX):
    inside |= np.all((P > lo + 0.05) & (P < hi - 0.05), axis=1)

# ------------------------------------------------------------------ sky visibility
rng = np.random.default_rng(3)
K = 40
u1, u2 = (np.arange(K) + 0.5) / K, rng.random(K)
phi = 2 * math.pi * ((np.arange(K) * 0.618034) % 1.0)
cos_t = np.sqrt(1 - u1)                              # cosine-weighted
sin_t = np.sqrt(1 - cos_t ** 2)
DIRS = np.stack([sin_t * np.cos(phi), sin_t * np.sin(phi), cos_t], 1)
sky = np.zeros(len(P))
CH = 20000
for i in range(0, len(P), CH):
    o = P[i:i + CH]
    vis = np.zeros(len(o))
    for d in DIRS:
        dd = np.broadcast_to(d, o.shape)
        vis += ~occluded(o, dd, np.full(len(o), 400.0))
    sky[i:i + CH] = vis / K
sky[inside] = 0.0

# ------------------------------------------------------------------ sun visibility (art-directed afternoon sun)
SUN_AZ, SUN_EL = math.radians(-110), math.radians(36)
SUN = np.array([math.cos(SUN_EL) * math.cos(SUN_AZ), math.cos(SUN_EL) * math.sin(SUN_AZ), math.sin(SUN_EL)])
# 8 jittered directions inside a ~2.5 deg cone give a soft penumbra at this cell size
up_ref = np.array([0.0, 0.0, 1.0])
t1 = np.cross(SUN, up_ref); t1 /= np.linalg.norm(t1); t2 = np.cross(SUN, t1)
SUN_DIRS = [SUN] + [SUN + 0.045 * (math.cos(a) * t1 + math.sin(a) * t2) for a in np.linspace(0, math.tau, 7, endpoint=False)]
SUN_DIRS = [d / np.linalg.norm(d) for d in SUN_DIRS]
sun = np.zeros(len(P))
for i in range(0, len(P), CH):
    o = P[i:i + CH]
    vis = np.zeros(len(o))
    for d in SUN_DIRS:
        vis += ~occluded(o, np.broadcast_to(d, o.shape), np.full(len(o), 500.0))
    sun[i:i + CH] = vis / len(SUN_DIRS)
sun[inside] = 0.0

# ------------------------------------------------------------------ neon bounce
lights = []   # (pos, colour, intensity, radius)
def light(p, colour, k, r):
    lights.append((np.array(p, float), rgb(colour) if isinstance(colour, str) else colour, k, r))
for s in L['signSlots']:
    col = SIGNS[s.get('design', 0) % len(SIGNS)]['color']
    p = np.array(s['p'], float); rz = s.get('rotZ', 0.0)
    out = np.array([math.sin(rz), -math.cos(rz), 0.0])
    if s.get('module') == 'sign_blade':
        light(p + out * 0.9 + [0, 0, 1.6], col, 1.0, 14)
    elif s.get('module') == 'crown_billboard':
        light(p + [0, 0, 0], col, 1.4, 22)
    else:
        light(p + out * 0.6, col, 0.7, 10)
for h in L['heroBillboards']:
    col = ACCENTS[h['project']] if 'project' in h else '#22e5ff'
    light(np.array(h['p']) + [0, -1.5, 2.2], col, 2.2, 30)
def inst(mod):
    return L['instances'].get(mod, [])
for x, y, z, r, *_ in inst('storefront'):
    out = np.array([math.sin(r), -math.cos(r), 0.0])
    light(np.array([x, y, 0.4]) + out * 0.8, '#ffb02e', 0.45, 7)
for x, y, z, r, *_ in inst('storefront_door'):
    out = np.array([math.sin(r), -math.cos(r), 0.0])
    light(np.array([x, y, 1.5]) + out * 1.0, '#ffcf8a', 1.0, 10)
    light(np.array([x, y, 2.6]) + out * 0.4, '#22e5ff', 0.5, 8)
for b in L['beams']:
    p = np.array(b['p']); d = np.array(b['dir'])
    light(p + d * 2.5, '#cfdcff', 0.12, 7)       # downlights: local pools only, neon stays dominant
for x, y, z, r, *_ in inst('vending'):
    out = np.array([math.sin(r), -math.cos(r), 0.0])
    light(np.array([x, y, 1.0]) + out * 0.6, '#7af0ff', 0.35, 5)
for x, y, z, *_ in inst('kiosk'):
    light([x, y, 2.0], '#ff2bd6', 0.5, 8)
for x, y, z, *_ in inst('planter_tree'):
    light([x, y, 3.0], '#c26bff', 0.35, 7)
for b in L['skybridges']:
    c = np.array(b['center'], float); r = b['rotZ']
    for t in (-0.35, 0, 0.35):
        light(c + [math.cos(r) * b['length'] * t, math.sin(r) * b['length'] * t, -0.6], '#22e5ff', 0.8, 12)
for p in L['pads']:
    light(np.array(p['center']) + [0, 0, 1.0], '#22e5ff', 0.6, 12)

bounce = np.zeros((len(P), 3))
idx = np.arange(len(P)).reshape(NX, NY, NZ)
for pos, colour, k, rad in lights:
    lo = np.maximum(((pos - rad - MIN) / CELL).astype(int), 0)
    hi = np.minimum(((pos + rad - MIN) / CELL).astype(int) + 2, DIM)
    ids = idx[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]].ravel()
    if not len(ids):
        continue
    v = pos - P[ids]
    dist = np.linalg.norm(v, axis=1)
    near = (dist < rad) & ~inside[ids]
    ids, v, dist = ids[near], v[near], dist[near]
    if not len(ids):
        continue
    vis = ~occluded(P[ids], v / np.maximum(dist[:, None], 1e-6), np.maximum(dist - 0.8, 0.0))
    fall = k * (1 - dist / rad) ** 2 / (1 + (dist / 4.0) ** 2)
    bounce[ids[vis]] += fall[vis, None] * colour

# ------------------------------------------------------------------ fill inside-box cells from neighbours (avoids dark seams when sampling at walls)
A = sky.reshape(NX, NY, NZ); B = bounce.reshape(NX, NY, NZ, 3); M = inside.reshape(NX, NY, NZ).copy()
SV = sun.reshape(NX, NY, NZ)
for _ in range(4):
    if not M.any():
        break
    acc_a = np.zeros_like(A); acc_b = np.zeros_like(B); acc_s = np.zeros_like(A); cnt = np.zeros_like(A)
    for ax in range(3):
        for sh in (-1, 1):
            ok = ~np.roll(M, sh, ax)
            acc_a += np.where(ok, np.roll(A, sh, ax), 0); acc_b += np.where(ok[..., None], np.roll(B, sh, ax), 0)
            acc_s += np.where(ok, np.roll(SV, sh, ax), 0); cnt += ok
    fill = M & (cnt > 0)
    A[fill] = acc_a[fill] / cnt[fill]; B[fill] = acc_b[fill] / cnt[fill][:, None]; SV[fill] = acc_s[fill] / cnt[fill]
    M &= ~fill

bmax = float(np.percentile(B.max(axis=3)[~inside.reshape(NX, NY, NZ)], 99.5))
enc_b = np.clip(B / bmax, 0, 1) ** 0.5                     # sqrt for low-end precision
enc_a = np.clip(A, 0, 1)

# ------------------------------------------------------------------ write slice atlas (row 0 = bottom, like Blender / three flipY=true)
W, H = NX * TILE_COLS, NY * TILE_ROWS
img = np.zeros((H, W, 4), np.uint8)
for z in range(NZ):
    c, r = z % TILE_COLS, z // TILE_COLS
    tile = np.concatenate([enc_b[:, :, z], enc_a[:, :, z, None]], -1)   # (NX, NY, 4)
    img[r * NY:(r + 1) * NY, c * NX:(c + 1) * NX] = (tile.transpose(1, 0, 2) * 255 + 0.5).astype(np.uint8)

def write_png(path, arr):
    h, w, ch = arr.shape
    raw = b''.join(b'\x00' + arr[h - 1 - y].tobytes() for y in range(h))   # PNG is top-down
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(png)

path = os.path.join(OUT, 'textures/light_volume.png')
write_png(path, img)
sun_img = np.zeros((H, W, 4), np.uint8)
for z in range(NZ):
    c, r = z % TILE_COLS, z // TILE_COLS
    v = (np.clip(SV[:, :, z], 0, 1).T * 255 + 0.5).astype(np.uint8)
    sun_img[r * NY:(r + 1) * NY, c * NX:(c + 1) * NX, 0] = v
    sun_img[r * NY:(r + 1) * NY, c * NX:(c + 1) * NX, 1] = v
    sun_img[r * NY:(r + 1) * NY, c * NX:(c + 1) * NX, 2] = v
    sun_img[r * NY:(r + 1) * NY, c * NX:(c + 1) * NX, 3] = 255
write_png(os.path.join(OUT, 'textures/light_sun.png'), sun_img)
meta = {
    'texture': 'textures/light_volume.png',
    'grid': {'min': MIN.tolist(), 'max': (MIN + (DIM - 1) * CELL).tolist(), 'cell': CELL.tolist(), 'dims': DIM.tolist(),
             'sampleZOffset': 0.5, 'tiles': [TILE_COLS, TILE_ROWS]},
    'encoding': {'a': 'sky visibility 0..1 (linear)', 'rgb': 'neon bounce, sqrt-encoded: bounce = rgb^2 * bounceScale', 'bounceScale': round(bmax, 4)},
    'sampling': ('Load with THREE.TextureLoader (flipY = true), LinearFilter, no mipmaps, NoColorSpace. '
                 'g = (worldPos - min) / cell  (grid coordinates; z uses worldPos.z - sampleZOffset). '
                 'For slice s = floor(g.z) and s + 1: tile (s % tiles[0], floor(s / tiles[0])); '
                 'uv = ((tileX * dims.x + clamp(g.x, 0, dims.x - 1) + 0.5) / (dims.x * tiles[0]), (tileY * dims.y + clamp(g.y, 0, dims.y - 1) + 0.5) / (dims.y * tiles[1])); '
                 'mix the two samples by fract(g.z). Outside the grid: sky = 1, bounce = 0.'),
    'shading': ('lit = albedo * ao * (skyColour * mix(0.08, 1.0, sky) + bounce * neonIntensity) + emissive; '
                'skyColour and neonIntensity come from the DayNightCycle palette (plan 7.2).'),
    'sun': {'texture': 'textures/light_sun.png', 'direction': [round(float(v), 5) for v in SUN],
            'note': 'Sun visibility (R) for the art-directed afternoon sun, same slice atlas/UVs as the light volume. direction points toward the sun.'},
    'lights': len(lights), 'cells': int(NX * NY * NZ),
}
json.dump(meta, open(os.path.join(OUT, 'light-volume.json'), 'w'), indent=1)
print('dims', DIM.tolist(), 'atlas', W, 'x', H, 'lights', len(lights), 'bounce99.5', round(bmax, 3),
      'sky mean street', round(float(A[:, :, 0][~inside.reshape(NX, NY, NZ)[:, :, 0]].mean()), 3), 'png', os.path.getsize(path))
