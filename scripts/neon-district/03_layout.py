"""Step 3: assemble the district from the kit -> static/models/cyber/district-layout.json

Every module placement is baked into the JSON (one transform list per module), so
the runtime only has to build InstancedMesh/BatchedMesh from it. A linked-duplicate
preview of the same placements is built in the PREVIEW collection.

Coordinates are the site's world frame (Z up, metres). Existing building footprints
come from the retired manhattan.glb (manhattan-blocks.json) so career doors, NPC
routes, project zones and arcade gates keep working.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

# Footprints of the retired manhattan.glb blocks (building = without sidewalk; collision = as City.js built it).
BLOCKS = json.load(open(os.path.join(ROOT, 'scripts/neon-district/manhattan-blocks.json')))
rnd = random.Random(2026)

# Career doors from careerData.js (x, y, id).
DOORS = [(0, 10.6, 'loopp'), (-6.9, -20.1, 'zoan'), (6.9, -20.1, 'toyota'), (-13, -62.9, 'knoesis'),
         (-6.9, -43.1, 'gym'), (6.9, -43.1, 'signal'), (17.9, -48.1, 'wright'), (-9, 8.6, 'homelab'),
         (10, 10.1, 'supply'), (-17, 6.1, 'cabinet'), (-14.9, -6.1, 'agentlab'), (-28, -19.3, 'agentrelay')]
TREES = [(-6, 1), (6, 1), (-6, -11), (6, -11), (-6, -47), (6, -47), (-6, -61), (25, -40), (49, -40), (73, -40),
         (97, -40), (121, -40), (145, -40), (-22, -23), (-32, -23), (-44, -23), (-54, -23)]
PROJECT_X = [30 + 24 * i for i in range(6)]

instances = {}       # module -> list of [x, y, z, rotZ, sx, sy, sz]
beams, sign_slots, steam, lights, doors_out = [], [], [], [], []
towers, bridges, pads = [], [], []

MOD_ANCHORS = {}
for ob in bpy.data.collections['KIT'].objects:
    if ob.get('nd_lod') == 0:
        MOD_ANCHORS[ob['nd_module']] = [(ch.name.split('.')[0], Vector(ch.location), ch.rotation_euler.to_matrix() @ Vector((0, 0, -1)))
                                         for ch in ob.children]

def place(mod, x, y, z, rot=0.0, sx=1.0, sy=1.0, sz=1.0, tag=None):
    instances.setdefault(mod, []).append([round(x, 3), round(y, 3), round(z, 3), round(rot, 4), round(sx, 3), round(sy, 3), round(sz, 3)])
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot, 4, 'Z') @ Matrix.Diagonal((sx, sy, sz, 1))
    for name, loc, d in MOD_ANCHORS.get(mod, []):
        p = m @ loc
        dw = (Matrix.Rotation(rot, 3, 'Z') @ d).normalized()
        rec = {'p': [round(p.x, 2), round(p.y, 2), round(p.z, 2)]}
        if name.startswith('anchor_beam'):
            rec['dir'] = [round(dw.x, 3), round(dw.y, 3), round(dw.z, 3)]
            beams.append(rec)
        elif name.startswith('anchor_sign'):
            rec.update(rotZ=round(rot, 4), w=round(3.6 * sx, 2), h=0.8, design=rnd.randrange(24))
            sign_slots.append(rec)
        elif name == 'anchor_steam':
            steam.append(rec)
        elif name.startswith('anchor_light'):
            lights.append(dict(rec, color='#ff2a2a', blink=True))
        elif name == 'anchor_door' and tag:
            doors_out.append(dict(rec, id=tag))

def edges(x0, y0, x1, y1):
    # CCW footprint -> (start, end, rotZ, length); outward normal is to the right of travel
    pts = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    out = []
    for i in range(4):
        a, b = pts[i], pts[(i + 1) % 4]
        out.append((a, b, math.atan2(b[1] - a[1], b[0] - a[0]), math.hypot(b[0] - a[0], b[1] - a[1])))
    return out

def door_on(edge):
    (ax, ay), (bx, by), rot, L = edge
    nx, ny = math.sin(rot), -math.cos(rot)   # outward normal
    for x, y, did in DOORS:
        # project onto edge
        t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (L * L)
        px, py = ax + (bx - ax) * t, ay + (by - ay) * t
        dist = (x - px) * nx + (y - py) * ny
        if 0 <= t <= 1 and -0.5 < dist < 1.2:
            return did, t
    return None, None

def tower(tid, fp, H, style, kind, shop=True, street_faces=None, crown=True, pad=None):
    x0, y0, x1, y1 = fp
    H = max(8, 4 * round(H / 4))
    rows = int(H // 4)
    ledge_rows = {rnd.randrange(3, rows - 2)} if rows > 6 else set()   # one lit ledge ring per tower
    for ei, e in enumerate(edges(x0, y0, x1, y1)):
        (ax, ay), (bx, by), rot, L = e
        n = max(1, round(L / 4)); sx = L / (4 * n)
        did, _ = door_on(e)
        street = street_faces is None or ei in street_faces
        escape_col = rnd.randrange(n) if (style == 'resi' and not street and rnd.random() < 0.7) else None
        for i in range(n):
            t = (i + 0.5) / n
            cx, cy = ax + (bx - ax) * t, ay + (by - ay) * t
            for r in range(rows):
                z = r * 4
                if r == 0 and shop:
                    if did and i == n // 2:
                        place('storefront_door', cx, cy, z, rot, sx, tag=did)
                    else:
                        place('storefront' if street else 'wall_window', cx, cy, z, rot, sx)
                        if street and rnd.random() < 0.3:
                            ox, oy = math.sin(rot) * 0.45, -math.cos(rot) * 0.45
                            off = (rnd.choice((-1, 1)) * 1.3 * sx)
                            place('vending', cx + math.cos(rot) * off + ox, cy + math.sin(rot) * off + oy, 0, rot)
                    continue
                if style == 'office':
                    mod = 'wall_strip' if rnd.random() < 0.85 else 'wall_window'
                elif style == 'resi':
                    mod = 'wall_balcony' if rnd.random() < 0.28 else 'wall_window'
                else:
                    mod = rnd.choice(('wall_window', 'wall_window', 'wall_strip', 'wall_balcony'))
                place(mod, cx, cy, z, rot, sx)
                if r in ledge_rows and street:
                    place('ledge_spot', cx, cy, z, rot, sx)
                elif mod != 'wall_balcony' and r > 0 and rnd.random() < 0.12:
                    place('ac_cluster', cx, cy, z + 0.2, rot)
                if escape_col == i and 1 <= r < rows - 1:
                    place('fire_escape', cx, cy, z, rot, sx)
            # signs on street faces
            if street and rnd.random() < 0.55:
                zs = rnd.uniform(5, min(26, H - 4))
                place('sign_blade', cx + math.cos(rot) * 1.6 * sx, cy + math.sin(rot) * 1.6 * sx, zs, rot)
                sign_slots.append({'module': 'sign_blade', 'p': [round(cx + math.cos(rot) * 1.6 * sx, 2), round(cy + math.sin(rot) * 1.6 * sx, 2), round(zs, 2)],
                                   'rotZ': round(rot, 4), 'design': rnd.randrange(24), 'vertical': True})
        # pipes on one corner per face
        if rnd.random() < 0.35:
            place('pipe_run', ax + math.cos(rot) * 0.8, ay + math.sin(rot) * 0.8, 4, rot, 1, 1, (H - 4) / 4)
    # corners
    for (cx, cy) in ((x0, y0), (x1, y0), (x1, y1), (x0, y1)):
        place('corner_column', cx, cy, 0, 0, 1, 1, H / 4)
    # roof
    w, d = x1 - x0, y1 - y0
    place('roof_tile', (x0 + x1) / 2, (y0 + y1) / 2, H, 0, w / 4, d / 4, 1)
    for e in edges(x0, y0, x1, y1):
        (ax, ay), (bx, by), rot, L = e
        place('parapet', (ax + bx) / 2, (ay + by) / 2, H, rot, L / 4)
    if pad:
        place('rooftop_pad', (x0 + x1) / 2, (y0 + y1) / 2, H, pad.get('rot', 0))
    elif crown:
        c = rnd.random()
        cxm, cym = (x0 + x1) / 2 + rnd.uniform(-w / 5, w / 5), (y0 + y1) / 2 + rnd.uniform(-d / 5, d / 5)
        if c < 0.35:
            place('crown_tank', cxm, cym, H, rnd.uniform(0, math.tau))
        elif c < 0.7:
            place('crown_antenna', cxm, cym, H, 0)
        elif min(w, d) > 7:
            place('crown_billboard', (x0 + x1) / 2, (y0 + y1) / 2, H, rnd.choice((0, math.pi / 2, math.pi, -math.pi / 2)))
            sign_slots.append({'module': 'crown_billboard', 'p': [round((x0 + x1) / 2, 2), round((y0 + y1) / 2, 2), round(H + 4.75, 2)], 'design': rnd.randrange(24), 'screen': True})
    towers.append({'id': tid, 'kind': kind, 'footprint': [round(v, 2) for v in fp], 'height': H, 'style': style,
                   'collision': {'center': [round((x0 + x1) / 2, 2), round((y0 + y1) / 2, 2), H / 2], 'size': [round(w, 2), round(d, 2), H]}})
    return H

# ---------------------------------------------------------------- existing footprints
HEIGHTS = {}
for k in range(6, 25):
    HEIGHTS[k] = rnd.choice((44, 52, 60, 68, 76, 88))
for k in (25, 26, 27, 28):
    HEIGHTS[k] = rnd.choice((36, 44, 52))
for k in (0, 1, 2, 3, 4):
    HEIGHTS[k] = rnd.choice((28, 32, 40))
for k in (30, 31):
    HEIGHTS[k] = 32
for k in (33, 34, 35, 36):
    HEIGHTS[k] = rnd.choice((20, 24, 28))
HEIGHTS[29] = 24
HEIGHTS[5] = 24            # crossroads pad tower
for b in (12, 18, 24):     # skybridge anchors on the avenue's north wall
    HEIGHTS[b] = max(HEIGHTS[b], 44)

for k, v in BLOCKS.items():
    k = int(k)
    (bx0, by0, _), (bx1, by1, _) = v['building']
    style = 'office' if k in range(6, 25) and k % 3 == 0 else ('resi' if k % 2 else 'mixed')
    pad = {'rot': 0} if k == 5 else None
    tower('block_%02d' % k, (bx0, by0, bx1, by1), HEIGHTS.get(k, 32), style, 'existing', pad=pad)

# ---------------------------------------------------------------- infill (new, collidable)
infill_specs = []
x = 32.0
while x < 162:
    w = rnd.choice((10, 12, 14)); d = rnd.choice((12, 14, 16))
    infill_specs.append(('south', (x, -46 - d, x + w, -46), rnd.choice((52, 60, 72, 84, 96))))
    x += w + rnd.choice((3, 4, 5))
x = 26.0
while x < 162:
    w = rnd.choice((10, 12, 14)); d = rnd.choice((10, 12, 14))
    infill_specs.append(('north', (x, -3, x + w, -3 + d), rnd.choice((60, 72, 84, 100))))
    x += w + rnd.choice((3, 4, 6))
infill_specs.append(('east_cap', (174, -56, 192, -6), 112))
infill_specs.append(('west_cap', (-98, -52, -80, -10), 104))
PAD_INFILL = {}
for i, (zone, fp, H) in enumerate(infill_specs):
    pad = None
    cx = (fp[0] + fp[2]) / 2
    if zone == 'north' and fp[0] < 32 and 'intro' not in PAD_INFILL:
        H, pad = 24, {'rot': math.pi}; PAD_INFILL['intro'] = i
    elif zone == 'south' and 82 < cx < 100 and 'avenue' not in PAD_INFILL:
        H, pad = 32, {'rot': 0}; PAD_INFILL['avenue'] = i
    elif zone == 'south' and fp[0] < 40 and 'information' not in PAD_INFILL:
        H, pad = 28, {'rot': 0}; PAD_INFILL['information'] = i
    street = {0} if zone == 'north' else ({2} if zone == 'south' else None)
    # north infill faces the avenue only through gaps; give it shops on its south face (edge 0)
    style = rnd.choice(('resi', 'mixed', 'office'))
    tower('infill_%s_%02d' % (zone, i), fp, H, style, 'infill', shop=True,
          street_faces={0} if zone == 'north' else ({2} if zone == 'south' else None), pad=pad)

# ---------------------------------------------------------------- pads (from the towers with a pad)
PAD_IDS = {'block_05': 'crossroads'}
for name, i in PAD_INFILL.items():
    zone = infill_specs[i][0]
    PAD_IDS['infill_%s_%02d' % (zone, i)] = name
for t in towers:
    if t['id'] in PAD_IDS:
        c = t['collision']['center']; H = t['height']
        rot = 0 if PAD_IDS[t['id']] != 'intro' else math.pi
        cr, sr = math.cos(rot), math.sin(rot)
        lift = (c[0] + (-4.5 * cr - 2.6 * sr), c[1] + (-4.5 * sr + 2.6 * cr), H + 0.5)
        fp = t['footprint']
        street_door = [round((fp[0] + fp[2]) / 2, 2), round(fp[1] - 1.0 if PAD_IDS[t['id']] != 'intro' else fp[1] - 1.0, 2), 0]
        if PAD_IDS[t['id']] == 'avenue':
            street_door = [round((fp[0] + fp[2]) / 2, 2), round(fp[3] + 1.0, 2), 0]
        if PAD_IDS[t['id']] == 'crossroads':
            street_door = [round((fp[0] + fp[2]) / 2, 2), round(fp[3] + 1.0, 2), 0]
        pads.append({'id': PAD_IDS[t['id']], 'tower': t['id'], 'center': [c[0], c[1], H], 'deckZ': H + 0.5, 'rotZ': rot,
                     'lift': {'pad': [round(v, 2) for v in lift], 'street': street_door}})

# ---------------------------------------------------------------- skybridges
def bridge(a, b, z):
    ax, ay = a; bx, by = b
    L = math.hypot(bx - ax, by - ay); rot = math.atan2(by - ay, bx - ax)
    place('skybridge', (ax + bx) / 2, (ay + by) / 2, z, rot, L / 20)
    bridges.append({'center': [round((ax + bx) / 2, 2), round((ay + by) / 2, 2), z], 'rotZ': round(rot, 4), 'length': round(L, 2),
                    'collision': {'size': [round(L, 2), 4.2, 3.4], 'offsetZ': 1.7}})
for bx_, z in ((68, 26), (110, 34), (152, 22)):
    blk = min((t for t in towers if t['kind'] == 'existing' and abs(t['collision']['center'][0] - bx_) < 2 and t['collision']['center'][1] < -13),
              key=lambda t: abs(t['collision']['center'][0] - bx_))
    sth = min((t for t in towers if t['id'].startswith('infill_south')), key=lambda t: abs(t['collision']['center'][0] - bx_))
    xm = max(blk['footprint'][0], sth['footprint'][0]) + 0.5 * (min(blk['footprint'][2], sth['footprint'][2]) - max(blk['footprint'][0], sth['footprint'][0]))
    bridge((xm, blk['footprint'][1]), (xm, sth['footprint'][3]), z)
b25 = next(t for t in towers if t['id'] == 'block_25'); b26 = next(t for t in towers if t['id'] == 'block_26')
bridge((b25['footprint'][2], -20.4), (b26['footprint'][0], -20.4), 18)
b27 = next(t for t in towers if t['id'] == 'block_27'); b28 = next(t for t in towers if t['id'] == 'block_28')
bridge((b27['footprint'][2], -43.4), (b28['footprint'][0], -43.4), 24)

# ---------------------------------------------------------------- hero billboards (one per project, facing the avenue)
hero = []
north_row = [t for t in towers if t['kind'] == 'existing' and -16 < t['collision']['center'][1] < -7]   # all three zigzag rows
for i, px in enumerate(PROJECT_X):
    t = min(north_row, key=lambda t: abs(t['collision']['center'][0] - px))
    fp = t['footprint']
    p = [round((fp[0] + fp[2]) / 2, 2), round(fp[1], 2), 9.0]
    place('billboard_wall', p[0], p[1], p[2], 0)
    hero.append({'project': i, 'module': 'billboard_wall', 'p': p, 'rotZ': 0, 'screen': [8.0, 4.5]})
# the big name sign above the intro plaza, on the tallest of blocks 0-4
name_t = max((t for t in towers if t['id'] in ('block_01', 'block_02', 'block_03')), key=lambda t: t['height'])
fp = name_t['footprint']
place('crown_billboard', (fp[0] + fp[2]) / 2, (fp[1] + fp[3]) / 2, name_t['height'], 0)
hero.append({'id': 'name', 'module': 'crown_billboard', 'p': [round((fp[0] + fp[2]) / 2, 2), round((fp[1] + fp[3]) / 2, 2), name_t['height'] + 4.75],
             'rotZ': 0, 'design': 'name_sign', 'screen': [8.0, 4.5]})

# ---------------------------------------------------------------- street dressing
for (tx, ty) in TREES:
    place('planter_tree' if ty == -40 else 'kiosk', tx, ty, 0, 0)
for i in range(6):
    place('street_lamp', 42 + 24 * i, -21.2, 0, 0)
    place('street_lamp', 37 + 24 * i, -41.8, 0, math.pi)
for y in (-4, -16, -36, -52):
    place('street_lamp', -6.6, y, 0, math.pi / 2)
    place('street_lamp', 6.6, y, 0, -math.pi / 2)
for i in range(9):
    place('steam_vent', 34 + i * 15 + rnd.uniform(-2, 2), rnd.choice((-22.3, -39.0)), 0, 0)
for i, s in enumerate(infill_specs):
    if s[0] == 'south' and i + 1 < len(infill_specs) and infill_specs[i + 1][0] == 'south':
        gx = (s[1][2] + infill_specs[i + 1][1][0]) / 2
        place('dumpster', gx, -52 - rnd.uniform(0, 4), 0, math.pi / 2)
        place('clutter_boxes', gx + rnd.uniform(-0.4, 0.4), -48.5, 0, rnd.uniform(0, math.tau))
for i in range(10):
    place('bollard', 26 + i * 14 + 7, -40.6, 0, 0)
# launch_pad, terminal and holo_panel are placed by the runtime at existing landmark
# positions (intro spawn, InformationSection links, project boards), not baked here.

# ---------------------------------------------------------------- skyline ring (no collision)
for i in range(34):
    a = i / 34 * math.tau + rnd.uniform(-0.05, 0.05)
    cx, cy = 45 + math.cos(a) * rnd.uniform(175, 230), -28 + math.sin(a) * rnd.uniform(110, 150)
    place(rnd.choice(('skyline_a', 'skyline_b', 'skyline_c')), cx, cy, 0, rnd.uniform(0, math.tau), *(rnd.uniform(0.8, 1.3),) * 2, rnd.uniform(0.7, 1.15))

# ---------------------------------------------------------------- traffic lanes
lanes = [
    {'id': 'avenue_low', 'z': 38, 'speed': 14, 'closed': True, 'points': [[-50, -27], [165, -27], [165, -33], [-50, -33]]},
    {'id': 'cross_mid', 'z': 52, 'speed': 18, 'closed': True,
     'points': [[-4, 18], [4, 18], [4, -25], [160, -25], [160, -35], [4, -35], [4, -72], [-4, -72], [-4, -35], [-50, -35], [-50, -25], [-4, -25]]},
    {'id': 'district_high', 'z': 64, 'speed': 22, 'closed': True, 'points': [[-62, -21], [168, -21], [168, -43], [-62, -43]]},
    {'id': 'outer_ring', 'z': 86, 'speed': 26, 'closed': True, 'points': [[-80, 26], [192, 26], [192, -82], [-80, -82]]},
]

layout = {
    'version': 1, 'units': 'metres', 'up': 'z',
    'instanceFormat': ['x', 'y', 'z', 'rotZ', 'sx', 'sy', 'sz'],
    'note': 'One InstancedMesh (per material slot) per module; use kit_<module>_lod0 near and _lod1 far. Same transform for both LODs.',
    'flightBounds': {'min': [-75, -80, 1.5], 'max': [165, 25, 70], 'softCeiling': 62},
    'towers': towers, 'skybridges': bridges, 'pads': pads, 'heroBillboards': hero,
    'signSlots': sign_slots, 'beams': beams, 'steam': steam, 'beacons': lights, 'doors': doors_out,
    'lanes': lanes, 'instances': instances,
}
path = os.path.join(OUT, 'district-layout.json')
json.dump(layout, open(path, 'w'), separators=(',', ':'))
counts = {k: len(v) for k, v in instances.items()}
print('towers', len(towers), 'pads', [p['id'] for p in pads], 'bridges', len(bridges), 'beams', len(beams), 'signs', len(sign_slots))
print('instances', sum(counts.values()), counts)
print('json bytes', os.path.getsize(path))
