"""Megacity ring: Unity's Megacity-2019 city around the Neon District.

Reads the local three.js Megacity port (never modifies it) and writes
static/models/megacity/:
  ring.json          models, materials, textures per tier, bands, frame mapping
  ring-<n>.bin       placements per quality band (cumulative: a tier loads 0..n)
  models/<guid>.glb  the original meshopt glTFs that the bands use
  textures/<px>/...  textures resized per tier (ffmpeg)
  sky.hdr            the original HDR sky

The district sits in a clearing cut out of an open ground area ringed by
450 m blocks (Megacity x 905, z 1230, ground y 252). Megacity is Y-up; the
portfolio is Z-up, so every placement is rotated +90 degrees about X and
shifted so the clearing centre lands on the district centre.

Run with a Python that has numpy (Blender's works):
  python3 scripts/megacity/build_ring.py [/path/to/unity-megacity/public/assets/original]
"""
import gzip, json, os, shutil, subprocess, sys
import numpy as np

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/cmagic23/Documents/Github/unity-megacity/public/assets/original'
PILLOW_PYTHON = os.environ.get('PILLOW_PYTHON', '/usr/bin/python3')
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'static', 'models', 'megacity')

# District clearing in portfolio coordinates (covers every tower footprint plus a margin).
CLEAR = dict(x0=-105.0, x1=200.0, y0=-78.0, y1=26.0)
DISTRICT_CENTER = ((CLEAR['x0'] + CLEAR['x1']) / 2, (CLEAR['y0'] + CLEAR['y1']) / 2)
MC_CENTER = (905.0, 1230.0)        # Megacity x, z of the clearing centre
GROUND = 252.0                     # Megacity y of the street level
CLEAR_HEIGHT = 120.0               # anything lower than this inside the clearing is removed

# Cumulative bands: (max distance from the clearing) for small (<3 m), medium (<12 m), large pieces.
BANDS = [
    dict(name='mobile', small=60, medium=250, large=600),
    dict(name='desktop', small=150, medium=450, large=900),
    dict(name='ultra', small=250, medium=700, large=1300),
]
# "Less chaotic": street-facing clutter is thinned near the district so the projects read.
# Pipe runs and laundry lines span the canyons in mid-air and read as debris,
# so they are dropped everywhere; wall-mounted racks and trash only near the district.
NEAR_CLUTTER = {'Laundry_Collection': 1e9, 'Pipes': 1e9, 'Laundry_Rack': 60, 'Trash': 250}

# Wall-mounted props are only kept when they touch a host structure. The source
# export lacks some host geometry, and the props that hung on it float in the air.
PROPS = ('Pent_Roof', 'Aircondition', 'Satellite', 'Window', 'Laundry', 'Streetlight', 'Floorlight', 'Neon_Sign')
HOSTS = ('Building', 'Pagoda', 'Scaffold')
# Shacks, scaffolds, scaffold panels and roof plates belong to a wall; they
# float when their wall is missing from the export.
WALL_PROPS = ('Building_Deco', 'Scaffold', 'Building_Tile_Scaffold', 'Building_Tile_Corner_Scaffold', 'Building_Tile_Roof')
WALLS = ('Building_Tile', 'Pagoda')
NOT_WALLS = ('Building_Tile_Scaffold', 'Building_Tile_Corner_Scaffold', 'Building_Tile_Roof')
ATTACH = 3.0

def attached(lo, hi, is_host, candidates, cell=30.0):
    """For each candidate index: does its AABB come within ATTACH m of a host AABB?"""
    from collections import defaultdict
    grid = defaultdict(list)
    for h in np.where(is_host)[0]:
        a = np.floor((lo[h, :2] - ATTACH) / cell).astype(int); b = np.floor((hi[h, :2] + ATTACH) / cell).astype(int)
        for gx in range(a[0], b[0] + 1):
            for gy in range(a[1], b[1] + 1):
                grid[(gx, gy)].append(h)
    grid = {k: np.array(v) for k, v in grid.items()}
    out = np.zeros(len(candidates), dtype=bool)
    keys = np.floor((lo[candidates, :2] + hi[candidates, :2]) / 2 / cell).astype(int)
    for n, (i, key) in enumerate(zip(candidates, map(tuple, keys))):
        hosts = grid.get(key)
        if hosts is None:
            continue
        gap = np.maximum(np.maximum(lo[hosts] - hi[i], lo[i] - hi[hosts]), 0)
        out[n] = bool((np.sqrt((gap ** 2).sum(1)) <= ATTACH).any())
    return out

# Collision: a height map of the city's structure (4 m cells, decimetres in a
# uint16, 0 = street). The runtime turns it into one cannon Heightfield, so
# flight, driving, walking and landing all respect the towers.
COLLISION_CELL = 4.0
COLLISION_REACH = 1000.0
SOLID = ('Building', 'Pagoda', 'Scaffold')

def collision_heights(lo, hi, solid):
    x0 = CLEAR['x0'] - COLLISION_REACH; x1 = CLEAR['x1'] + COLLISION_REACH
    y0 = CLEAR['y0'] - COLLISION_REACH; y1 = CLEAR['y1'] + COLLISION_REACH
    nx = int(np.ceil((x1 - x0) / COLLISION_CELL)) + 1; ny = int(np.ceil((y1 - y0) / COLLISION_CELL)) + 1
    top = np.zeros((nx, ny), dtype=np.float32)
    for i in np.where(solid)[0]:
        if hi[i, 2] < 2.0:
            continue
        a = np.floor((lo[i, :2] - (x0, y0)) / COLLISION_CELL).astype(int)
        b = np.ceil((hi[i, :2] - (x0, y0)) / COLLISION_CELL).astype(int)
        a = np.clip(a, 0, (nx - 1, ny - 1)); b = np.clip(b, 0, (nx - 1, ny - 1))
        top[a[0]:b[0] + 1, a[1]:b[1] + 1] = np.maximum(top[a[0]:b[0] + 1, a[1]:b[1] + 1], hi[i, 2])
    # The district's own colliders own the clearing: keep it flat.
    cx0 = int(np.floor((CLEAR['x0'] - x0) / COLLISION_CELL)); cx1 = int(np.ceil((CLEAR['x1'] - x0) / COLLISION_CELL))
    cy0 = int(np.floor((CLEAR['y0'] - y0) / COLLISION_CELL)); cy1 = int(np.ceil((CLEAR['y1'] - y0) / COLLISION_CELL))
    top[cx0:cx1 + 1, cy0:cy1 + 1] = 0
    return dict(origin=[x0, y0], cell=COLLISION_CELL, nx=nx, ny=ny), np.clip(np.round(top * 10), 0, 65535).astype('<u2')

def mc_to_portfolio():
    """4x4 that maps Megacity (Y-up) world to the portfolio frame (Z-up)."""
    R = np.array([[1, 0, 0, 0], [0, 0, -1, 0], [0, 1, 0, 0], [0, 0, 0, 1]], dtype=np.float64)
    T = np.eye(4)
    T[:3, 3] = [DISTRICT_CENTER[0] - MC_CENTER[0], DISTRICT_CENTER[1] + MC_CENTER[1], -GROUND]
    return T @ R

def quat_from_matrix(m):
    """Rotation matrices (n,3,3) -> quaternions (n,4) as x, y, z, w."""
    q = np.empty((len(m), 4))
    t = m[:, 0, 0] + m[:, 1, 1] + m[:, 2, 2]
    for i in range(len(m)):
        a = m[i]
        if t[i] > 0:
            s = 0.5 / np.sqrt(t[i] + 1.0)
            q[i] = [(a[2, 1] - a[1, 2]) * s, (a[0, 2] - a[2, 0]) * s, (a[1, 0] - a[0, 1]) * s, 0.25 / s]
        elif a[0, 0] > a[1, 1] and a[0, 0] > a[2, 2]:
            s = 2.0 * np.sqrt(1.0 + a[0, 0] - a[1, 1] - a[2, 2])
            q[i] = [0.25 * s, (a[0, 1] + a[1, 0]) / s, (a[0, 2] + a[2, 0]) / s, (a[2, 1] - a[1, 2]) / s]
        elif a[1, 1] > a[2, 2]:
            s = 2.0 * np.sqrt(1.0 + a[1, 1] - a[0, 0] - a[2, 2])
            q[i] = [(a[0, 1] + a[1, 0]) / s, 0.25 * s, (a[1, 2] + a[2, 1]) / s, (a[0, 2] - a[2, 0]) / s]
        else:
            s = 2.0 * np.sqrt(1.0 + a[2, 2] - a[0, 0] - a[1, 1])
            q[i] = [(a[0, 2] + a[2, 0]) / s, (a[1, 2] + a[2, 1]) / s, 0.25 * s, (a[1, 0] - a[0, 1]) / s]
    return q / np.linalg.norm(q, axis=1, keepdims=True)

def main():
    scene = json.load(open(os.path.join(SRC, 'scene.json')))
    models = json.load(open(os.path.join(SRC, 'models.json')))
    textures = json.load(open(os.path.join(SRC, 'textures.json')))
    bounds = np.array([m['bounds'] for m in models], dtype=np.float64)
    size = np.max(bounds[:, 3:] - bounds[:, :3], axis=1)
    names = [m['name'] for m in models]

    mats, ids = [], []
    for section in scene['sections']:
        raw = open(os.path.join(SRC, section['url'].replace('assets/original/', '')), 'rb').read()
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        ids.append(np.frombuffer(raw, dtype=np.uint32).reshape(-1, 17)[:, 0].copy())
        # Three.js column-major 4x4 -> row-major numpy.
        mats.append(np.frombuffer(raw, dtype=np.float32).reshape(-1, 17)[:, 1:].reshape(-1, 4, 4).transpose(0, 2, 1).astype(np.float64))
    ids = np.concatenate(ids); M = np.concatenate(mats)
    F = mc_to_portfolio()[None] @ M                       # final placement in portfolio frame

    # World-space AABB of each placement (portfolio frame).
    b = bounds[ids]; c = (b[:, :3] + b[:, 3:]) / 2; h = (b[:, 3:] - b[:, :3]) / 2
    R = F[:, :3, :3]
    centre = np.einsum('irc,ic->ir', R, c) + F[:, :3, 3]
    ext = np.einsum('irc,ic->ir', np.abs(R), h)
    lo, hi = centre - ext, centre + ext

    inside = (hi[:, 0] > CLEAR['x0']) & (lo[:, 0] < CLEAR['x1']) & (hi[:, 1] > CLEAR['y0']) & (lo[:, 1] < CLEAR['y1']) & (lo[:, 2] < CLEAR_HEIGHT)
    dx = np.maximum(np.maximum(CLEAR['x0'] - centre[:, 0], centre[:, 0] - CLEAR['x1']), 0)
    dy = np.maximum(np.maximum(CLEAR['y0'] - centre[:, 1], centre[:, 1] - CLEAR['y1']), 0)
    dist = np.hypot(dx, dy)
    sz = size[ids]
    keep = ~inside
    for prefix, radius in NEAR_CLUTTER.items():
        clutter = np.array([n.startswith(prefix) for n in names])[ids]
        keep &= ~(clutter & (dist < radius))

    # Drop floating pieces (only those that could make it into a band are tested):
    # shacks and scaffolds first, then the props that hang on whatever remains.
    near_enough = dist < max(max(b['small'], b['medium'], b['large']) for b in BANDS)
    wall_prop = np.array([n.startswith(WALL_PROPS) for n in names])[ids]
    wall = np.array([n.startswith(WALLS) and not n.startswith(NOT_WALLS) for n in names])[ids]
    test = np.where(keep & wall_prop & near_enough)[0]
    ok = attached(lo, hi, wall & keep & near_enough, test)
    keep[test[~ok]] = False
    print(f'floating shacks/scaffolds dropped: {int((~ok).sum())} of {len(test)}')
    prop = np.array([n.startswith(PROPS) for n in names])[ids]
    host = np.array([n.startswith(HOSTS) for n in names])[ids]
    test = np.where(keep & prop & near_enough)[0]
    ok = attached(lo, hi, host & keep & near_enough, test)
    keep[test[~ok]] = False
    print(f'floating props dropped: {int((~ok).sum())} of {len(test)}')

    band = np.full(len(ids), -1)
    for n in reversed(range(len(BANDS))):
        r = BANDS[n]
        inband = ((sz < 3) & (dist < r['small'])) | ((sz >= 3) & (sz < 12) & (dist < r['medium'])) | ((sz >= 12) & (dist < r['large']))
        band[inband & keep] = n

    os.makedirs(os.path.join(OUT, 'models'), exist_ok=True)
    # Large structure only (>= 12 m): every tier draws it inside its explore range,
    # so nothing invisible blocks the way on a phone.
    solid = (band >= 0) & (sz >= 12) & np.array([n.startswith(SOLID) for n in names])[ids]
    collision, heights = collision_heights(lo, hi, solid)
    heights.tofile(os.path.join(OUT, 'collision.bin'))
    collision['url'] = 'collision.bin'
    print(f"collision {collision['nx']}x{collision['ny']} cells, max {heights.max() / 10:.0f} m")
    used_models = sorted(set(ids[band >= 0].tolist()))
    remap = {old: new for new, old in enumerate(used_models)}

    # Placements: u16 model, u16 flags, f32 x y z, i16 quaternion x4, f16 scale x3 (30 bytes, packed).
    rows = np.dtype([('model', '<u2'), ('flags', '<u2'), ('p', '<f4', 3), ('q', '<i2', 4), ('s', '<f2', 3)])
    band_info = []
    for n in range(len(BANDS)):
        sel = np.where(band == n)[0]
        # Sort by model so the runtime fills instanced meshes in long runs.
        sel = sel[np.argsort(ids[sel], kind='stable')]
        out = np.zeros(len(sel), dtype=rows)
        out['model'] = [remap[i] for i in ids[sel]]
        Fs = F[sel]
        scale = np.linalg.norm(Fs[:, :3, :3], axis=1)        # column norms
        # ~10% of Unity placements are mirrored (negative determinant). Keep the
        # mirror as a negative X scale so the stored rotation stays proper.
        mirrored = np.linalg.det(Fs[:, :3, :3]) < 0
        scale[mirrored, 0] *= -1
        rot = Fs[:, :3, :3] / scale[:, None, :]
        out['p'] = Fs[:, :3, 3]
        out['q'] = np.round(quat_from_matrix(rot) * 32767).astype(np.int16)
        out['s'] = scale
        path = os.path.join(OUT, f'ring-{n}.bin')
        out.tofile(path)
        band_info.append(dict(name=BANDS[n]['name'], url=f'ring-{n}.bin', count=int(len(sel)), bytes=os.path.getsize(path),
                              models=sorted(set(remap[i] for i in ids[sel].tolist()))))
        print(f"band {n} {BANDS[n]['name']}: {len(sel)} placements ({int(mirrored.sum())} mirrored), {os.path.getsize(path) / 1e6:.1f} MB")

    # Models used by any band (original meshopt glTF, unchanged).
    model_out = []
    for old in used_models:
        m = models[old]
        name = os.path.basename(m['url'])
        shutil.copyfile(os.path.join(SRC, name), os.path.join(OUT, 'models', name))
        model_out.append(dict(name=m['name'], url=f'models/{name}', bounds=m['bounds'], size=float(size[old])))

    # Materials referenced by those models, with HDRP channels resolved to texture roles.
    needed_materials = set()
    for old in used_models:
        needed_materials.update(models[old]['materials'].values())
    materials = {}
    needed_textures = set()
    for guid in needed_materials:
        src = scene['materials'].get(guid)
        if not src:
            continue
        tex = src['textures']
        roles = {}
        for role, keys in (('map', ('_BaseColorMap', '_MainTex')), ('normal', ('_NormalMap', '_BumpMap')),
                           ('orm', ('_MaskMap',)), ('emissive', ('_EmissiveColorMap', '_EmissionMap'))):
            for key in keys:
                if key in tex and textures.get(tex[key]['guid'], {}).get(role):
                    roles[role] = dict(id=tex[key]['guid'], scale=[tex[key]['scale']['x'], tex[key]['scale']['y']],
                                       offset=[tex[key]['offset']['x'], tex[key]['offset']['y']])
                    needed_textures.add((tex[key]['guid'], role))
                    break
        materials[guid] = dict(name=src['name'], floats=src['floats'], colors=src['colors'], textures=roles)

    # Textures per tier: 512 for phones, 1024 for desktop and ultra (the 2048 px
    # originals would double the download for a barely visible gain).
    tex_out = {}
    for guid, role in sorted(needed_textures):
        rel = textures[guid][role]
        src = os.path.join(SRC, rel.replace('assets/original/', ''))
        ext = os.path.splitext(src)[1]
        tex_out.setdefault(guid, {})[role] = {}
        for px in (512, 1024):
            dst_rel = f'textures/{px}/{guid}-{role}{ext}'
            dst = os.path.join(OUT, dst_rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if not os.path.exists(dst):
                # Pillow decodes the alpha WebP base maps that ffmpeg rejects.
                subprocess.run([PILLOW_PYTHON, os.path.join(os.path.dirname(__file__), 'resize_texture.py'), src, dst, str(px)], check=True)
            tex_out[guid][role][str(px)] = dst_rel

    shutil.copyfile(os.path.join(SRC, 'sky.hdr'), os.path.join(OUT, 'sky.hdr'))
    licence = os.path.join(SRC, 'LICENCE.md')
    if os.path.exists(licence):
        shutil.copyfile(licence, os.path.join(OUT, 'LICENCE.md'))

    manifest = dict(
        source=dict(repository=scene.get('repository'), commit=scene.get('commit')),
        frame=dict(note='portfolio = T * Rx(+90) * megacity', clearing=CLEAR, megacityCenter=MC_CENTER, ground=GROUND,
                   matrix=mc_to_portfolio().tolist()),
        bands=band_info, models=model_out, materials=materials, textures=tex_out, sky='sky.hdr', collision=collision)
    json.dump(manifest, open(os.path.join(OUT, 'ring.json'), 'w'), separators=(',', ':'))
    print('models', len(model_out), 'materials', len(materials), 'textures', len(tex_out))

if __name__ == '__main__':
    main()
