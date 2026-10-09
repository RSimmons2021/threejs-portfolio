"""Step 5: hero hover car (6 parts) + 3 traffic vehicles.

Car frame matches Car.js: +X forward, Z up, origin = chassis body centre
(Car.js applies chassis.offset z -0.28 to the mesh). Wheel pods are modelled at
the origin with their axle along Y; Car.js positions them at the physics wheels.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())

CAR = collection('CAR')
TRAFFIC = collection('TRAFFIC')

def section(x, w, zb, zt, c):
    """Rounded-rect cross section at station x, CCW seen from +X (8 points)."""
    h = w / 2
    c = min(c, h * 0.45, (zt - zb) * 0.45)
    return [Vector(p) for p in ((x, -h + c, zb), (x, h - c, zb), (x, h, zb + c), (x, h, zt - c),
                                (x, h - c, zt), (x, -h + c, zt), (x, -h, zt - c), (x, -h, zb + c))]

def loft(mb, stations, regions, cap_back=None, cap_front=None):
    """stations: list of sections ordered rear->front. regions(i_seg, k_edge) -> region/slot tuple."""
    for i in range(len(stations) - 1):
        a, b = stations[i], stations[i + 1]
        for k in range(8):
            j = (k + 1) % 8
            r = regions(i, k)
            slot = 'nd_atlas'
            if isinstance(r, tuple) and len(r) == 2:
                r, slot = r
            mb.quad(a[k], a[j], b[j], b[k], r, slot)
    if cap_back:
        mb.face(list(stations[0]), cap_back)
    if cap_front:
        mb.face(list(reversed(stations[-1])), cap_front)

# ------------------------------------------------------------------ hero chassis
# Lower body is red; the cabin is an open glass bubble with thin bronze pillars (see
# 'cyberpunk inspo vids/Screenshot_20261008-182511.png'). Single centred driver seat so the
# existing first-person camera (car centre line) sits in it. Eye: mesh frame (-0.05, 0, 0.92).
ST = [(-1.15, 1.16, 0.24, 0.92, 0.16), (-1.06, 1.26, 0.18, 1.00, 0.2), (-0.55, 1.30, 0.15, 1.04, 0.22),
      (0.10, 1.30, 0.15, 1.04, 0.22), (0.62, 1.24, 0.17, 0.95, 0.2), (1.02, 1.08, 0.22, 0.62, 0.16),
      (1.22, 0.84, 0.28, 0.44, 0.1)]
stations = [section(*s) for s in ST]
def chassis_regions(i, k):
    if k in (3, 4, 5) and i in (2, 3, 4):
        return ((0, 0, 1, 1), 'nd_glass')                 # bubble canopy + windscreen
    if k in (0, 1, 7):
        return 'hero_red_dark'
    return 'hero_red'
mb = MB()
loft(mb, stations, chassis_regions, cap_front='hero_red')
mb.face(list(stations[0]), 'car_grille')
for s in (-1, 1):
    for k in range(5):
        mb.box((-0.85 + k * 0.32, s * 0.655, 0.36), (0.16, 0.03, 0.18), 'trim_black')
    mb.box((0.0, s * 0.66, 0.6), (1.7, 0.02, 0.04), 'neon_red')          # side light line
mb.box((1.215, 0, 0.38), (0.03, 0.62, 0.05), 'lamp_white')              # nose light
# bronze pillars: two curved A-pillars along the canopy's upper corners + a rear hoop
def lift(p, k=1.025):
    return Vector((p.x, p.y * k, 0.6 + (p.z - 0.6) * k))
for idx in (4, 5):
    pts = [lift(stations[i][idx]) for i in (2, 3, 4, 5)]
    for a, b in zip(pts, pts[1:]):
        mb.cyl(a, b, 0.022, 'bezel_bronze', sides=6)
hoop = [lift(stations[2][k]) for k in (2, 3, 4, 5, 6, 7)]
for a, b in zip(hoop, hoop[1:]):
    mb.cyl(a, b, 0.026, 'bezel_bronze', sides=6)
# ---- cabin (all inward-facing surfaces so first person sees a closed cockpit)
X0, X1, Y, Z0, ZB = -0.55, 0.66, 0.6, 0.30, 0.62
mb.face([(X0, -Y, Z0), (X0, Y, Z0), (X1, Y, Z0), (X1, -Y, Z0)], 'leather_dark')                    # floor
mb.face([(X0, Y, Z0), (X0, -Y, Z0), (X0, -Y, 0.98), (X0, Y, 0.98)], 'leather_dark')                # rear bulkhead
mb.face([(X0, -Y, Z0), (X1, -Y, Z0), (X1, -Y, ZB), (X0, -Y, ZB)], 'leather_tan')                   # right door card
mb.face([(X1, Y, Z0), (X0, Y, Z0), (X0, Y, ZB), (X1, Y, ZB)], 'leather_tan')                       # left door card
for s in (-1, 1):
    mb.box((0.05, s * 0.6, ZB), (1.2, 0.08, 0.04), 'bezel_bronze')                                 # sill trim
    mb.box((0.05, s * 0.575, 0.47), (1.0, 0.02, 0.012), 'lamp_white')                              # ambient strip
# seat (centred) with tan bolsters
mb.box((-0.25, 0, 0.42), (0.46, 0.46, 0.13), 'leather_dark')
mb.box((-0.47, 0, 0.72), (0.1, 0.46, 0.5), 'leather_dark')
for s in (-1, 1):
    mb.box((-0.25, s * 0.25, 0.47), (0.44, 0.06, 0.12), 'leather_tan')
    mb.box((-0.46, s * 0.25, 0.72), (0.12, 0.06, 0.46), 'leather_tan')
# centre armrest / console on the right
mb.box((-0.08, -0.36, 0.48), (0.6, 0.16, 0.16), 'seat_black')
mb.box((-0.08, -0.36, 0.565), (0.6, 0.17, 0.02), 'leather_tan')
# dashboard + bronze bezel + wide display (slot nd_dash, uv 0..1, ~6.5 : 1).
# From the eye the display spans about -18..-30 deg: inside a 75 deg first-person FOV.
mb.box((0.66, 0, 0.6), (0.2, 1.2, 0.22), 'leather_dark')
mb.box((0.66, 0, 0.712), (0.21, 1.21, 0.012), 'metal_dark')
mb.box((0.567, 0, 0.637), (0.025, 1.08, 0.2), 'bezel_bronze')
mb.quad((0.553, 0.5, 0.56), (0.553, -0.5, 0.56), (0.553, -0.5, 0.715), (0.553, 0.5, 0.715), (0, 0, 1, 1), slot='nd_dash')
# yoke: rounded grip with a cyan light strip on a short column
mb.cyl((0.555, 0, 0.6), (0.33, 0, 0.62), 0.025, 'metal_dark', sides=6)
mb.box((0.31, 0, 0.62), (0.06, 0.34, 0.1), 'seat_black')
mb.box((0.31, 0, 0.672), (0.03, 0.07, 0.008), 'neon_cyan')
for s in (-1, 1):
    mb.box((0.31, s * 0.18, 0.62), (0.06, 0.04, 0.08), 'seat_black')
# rear-view mirror screen (slot nd_mirror) hanging from the canopy, windscreen HUD (slot nd_hud, additive)
mb.box((0.5, 0, 0.96), (0.02, 0.14, 0.05), 'trim_black')
mb.quad((0.489, 0.065, 0.94), (0.489, -0.065, 0.94), (0.489, -0.065, 0.98), (0.489, 0.065, 0.98), (0, 0, 1, 1), slot='nd_mirror')
mb.cyl((0.5, 0, 0.985), (0.44, 0, 1.03), 0.008, 'metal_dark', sides=4)
mb.quad((0.7, 0.14, 0.8), (0.7, -0.14, 0.8), (0.72, -0.14, 0.855), (0.72, 0.14, 0.855), (0, 0, 1, 1), slot='nd_hud')
chassis = mb.build('hover_chassis', CAR, ao_dist=0.5, ao_samples=16)

# ------------------------------------------------------------------ light bars (brake) / reverse / antenna / thrusters
mb = MB()
for z in (0.80, 0.70):
    mb.box((-1.16, 0, z), (0.03, 1.0, 0.035), 'neon_red')
mb.box((-1.16, 0, 0.75), (0.02, 1.06, 0.12), 'trim_black', skip=('nx',))
brake = mb.build('hover_brake', CAR, ao=False)
mb = MB()
for s in (-1, 1):
    mb.box((-1.165, s * 0.42, 0.52), (0.025, 0.16, 0.04), 'lamp_white')
reverse = mb.build('hover_reverse', CAR, ao=False)
mb = MB()
mb.prism([(-0.95, -0.02), (-0.7, -0.02), (-0.7, 0.02), (-0.95, 0.02)], 1.0, 1.0, 'hero_red_dark', top=False, bottom=False)
fin = [(-1.0, 1.0), (-0.72, 1.0), (-0.86, 1.22), (-0.98, 1.22)]
for y, flip in ((0.02, False), (-0.02, True)):
    pts = [(x, y, z) for x, z in fin]
    mb.face(list(reversed(pts)) if flip else pts, 'hero_red_dark')
mb.box((-0.92, 0, 1.24), (0.08, 0.06, 0.04), 'neon_red')
antenna = mb.build('hover_antenna', CAR, ao=False)
mb = MB()
for x, y in ((0.62, 0.38), (0.62, -0.38), (-0.72, 0.38), (-0.72, -0.38), (-0.05, 0)):
    r = 0.13 if (x, y) != (-0.05, 0) else 0.18
    mb.cyl((x, y, 0.16), (x, y, 0.13), r * 1.15, 'metal_dark', sides=10, caps=False)
    ring = [(x + r * math.cos(i * math.tau / 10), y + r * math.sin(i * math.tau / 10), 0.13) for i in range(10)]
    mb.face(list(reversed(ring)), 'thruster_blue', slot='nd_thruster')
thrusters = mb.build('hover_thrusters', CAR, ao=False)

# ------------------------------------------------------------------ wheel pod (axle along Y, origin = axle centre)
mb = MB()
R, Wd = 0.25, 0.2
mb.cyl((0, -Wd / 2, 0), (0, Wd / 2, 0), R, 'rubber', sides=16, caps=False)
mb.cyl((0, -Wd / 2, 0), (0, -Wd / 2 - 0.01, 0), R * 0.98, 'rubber', sides=16, top=R * 0.82, caps=False)
mb.cyl((0, Wd / 2, 0), (0, Wd / 2 + 0.01, 0), R * 0.98, 'rubber', sides=16, top=R * 0.82, caps=False)
for s in (-1, 1):
    y = s * (Wd / 2 + 0.012)
    ring_o = [Vector((R * 0.82 * math.cos(i * math.tau / 16), y, R * 0.82 * math.sin(i * math.tau / 16))) for i in range(16)]
    ring_g = [Vector((R * 0.62 * math.cos(i * math.tau / 16), y, R * 0.62 * math.sin(i * math.tau / 16))) for i in range(16)]
    ring_h = [Vector((R * 0.22 * math.cos(i * math.tau / 16), y, R * 0.22 * math.sin(i * math.tau / 16))) for i in range(16)]
    for i in range(16):
        j = (i + 1) % 16
        quads = ((ring_o[i], ring_o[j], ring_g[j], ring_g[i], 'metal_mid', 'nd_atlas'),
                 (ring_g[i], ring_g[j], ring_h[j], ring_h[i], 'thruster_blue', 'nd_thruster'))
        for a, b, c, d, r, slot in quads:
            mb.quad(*((a, b, c, d) if s > 0 else (d, c, b, a)), r, slot)
    hub = ring_h if s > 0 else list(reversed(ring_h))
    mb.face(hub, 'metal_light')
    # fan blades over the glow ring
    for k in range(6):
        a = k * math.tau / 6
        p = Vector((math.cos(a), 0, math.sin(a)))
        mb.box(tuple(p * R * 0.42 + Vector((0, y + s * 0.004, 0))), (0.03, 0.006, R * 0.42), 'metal_dark', rot=0)
wheel = mb.build('hover_wheel', CAR, ao=False)

# ------------------------------------------------------------------ traffic (visual only, tiny lights)
def traffic(name, L, W, H, body, roof, seed):
    mb = MB()
    st = [section(-L / 2, W * 0.9, 0.0, H * 0.85, 0.08), section(-L / 2 + 0.15, W, 0.0, H, 0.1),
          section(L / 2 - 0.35, W, 0.0, H * 0.95, 0.1), section(L / 2, W * 0.8, 0.05, H * 0.55, 0.06)]
    loft(mb, st, lambda i, k: roof if k == 4 else ('glass_dark' if k in (3, 5) and i == 1 else body), cap_back='car_grille', cap_front=body)
    for s in (-1, 1):
        mb.box((L / 2 + 0.01, s * W * 0.28, H * 0.35), (0.02, W * 0.22, 0.05), 'lamp_white')
        mb.box((-L / 2 - 0.01, s * W * 0.3, H * 0.6), (0.02, W * 0.25, 0.05), 'neon_red')
    mb.box((0, 0, -0.04), (L * 0.6, W * 0.5, 0.05), 'thruster_blue')   # traffic is always flying: keep in atlas
    ob = mb.build('traffic_' + name, TRAFFIC, ao=False)
    fill_ao(ob, 0.9)
    return ob
t1 = traffic('cab', 2.3, 1.2, 0.9, 'car_yellow', 'trim_black', 1)
t2 = traffic('van', 3.4, 1.5, 1.5, 'car_white', 'car_grey', 2)
t3 = traffic('pod', 1.8, 1.1, 0.8, 'car_blue', 'car_grey', 3)

def extra(name, build):
    mb = MB(); build(mb)
    ob = mb.build('traffic_' + name, TRAFFIC, ao=False); fill_ao(ob, 0.9)
    return ob
def _bus(mb):   # long double-deck hover bus with a lit window band
    L, W, H = 7.0, 2.0, 2.2
    st = [section(-L / 2, W * 0.92, 0.0, H * 0.9, 0.18), section(-L / 2 + 0.3, W, 0.0, H, 0.22),
          section(L / 2 - 0.6, W, 0.0, H, 0.22), section(L / 2, W * 0.86, 0.1, H * 0.7, 0.16)]
    loft(mb, st, lambda i, k: 'car_white' if k in (4,) else ('car_grey' if k in (0, 1, 7) else 'paint_teal'), cap_back='car_grille', cap_front='glass_dark')
    for s in (-1, 1):
        mb.box((0, s * (W / 2 + 0.01), H * 0.62), (L * 0.82, 0.02, 0.38), 'lamp_warm')
        mb.box((0, s * (W / 2 + 0.01), H * 0.3), (L * 0.82, 0.02, 0.05), 'neon_cyan')
        mb.box((L / 2 + 0.01, s * W * 0.32, H * 0.3), (0.02, 0.3, 0.06), 'lamp_white')
        mb.box((-L / 2 - 0.01, s * W * 0.34, H * 0.55), (0.02, 0.36, 0.06), 'neon_red')
    for x in (-L / 3, L / 3):
        mb.box((x, 0, -0.05), (1.2, 1.0, 0.08), 'thruster_blue')
def _police(mb):  # cruiser with a red/blue light bar
    L, W, H = 2.5, 1.25, 0.85
    st = [section(-L / 2, W * 0.9, 0.0, H * 0.8, 0.08), section(-L / 2 + 0.2, W, 0.0, H, 0.12),
          section(L / 2 - 0.5, W, 0.0, H * 0.9, 0.12), section(L / 2, W * 0.7, 0.08, H * 0.5, 0.06)]
    loft(mb, st, lambda i, k: 'panel_white' if k == 4 else ('glass_dark' if k in (3, 5) and i == 1 else 'trim_black'), cap_back='car_grille', cap_front='trim_black')
    mb.box((0, 0.22, H + 0.05), (0.3, 0.38, 0.08), 'neon_red')
    mb.box((0, -0.22, H + 0.05), (0.3, 0.38, 0.08), 'thruster_blue')
    for s in (-1, 1):
        mb.box((L / 2 + 0.01, s * W * 0.28, H * 0.35), (0.02, W * 0.22, 0.05), 'lamp_white')
        mb.box((-L / 2 - 0.01, s * W * 0.3, H * 0.6), (0.02, W * 0.25, 0.05), 'neon_red')
        mb.box((0, s * (W / 2 + 0.005), H * 0.45), (L * 0.7, 0.01, 0.05), 'neon_cyan')
    mb.box((0, 0, -0.04), (L * 0.6, W * 0.5, 0.05), 'thruster_blue')
def _hauler(mb):  # heavy cargo lifter: cab + slung container, like the big dark craft in the reference
    L, W, H = 9.0, 3.0, 2.6
    mb.box((L / 2 - 1.2, 0, 1.8), (2.4, W, 1.8), 'metal_dark', faces={'px': 'glass_dark'})
    mb.box((-0.9, 0, 1.3), (L - 2.4, W * 0.95, H), 'rust', faces={'pz': 'metal_dark', 'nx': 'car_grille'})
    for x in (-3.4, -0.9, 1.6):
        mb.box((x, 0, H + 0.75), (0.6, W + 0.4, 0.3), 'metal_mid')
        for s in (-1, 1):
            mb.cyl((x, s * (W / 2 + 0.35), H + 0.6), (x, s * (W / 2 + 0.35), H + 0.95), 0.45, 'metal_dark', sides=10)
            mb.face([(x + 0.4 * math.cos(i * math.tau / 10), s * (W / 2 + 0.35) + 0.4 * math.sin(i * math.tau / 10), H + 0.59) for i in reversed(range(10))], 'thruster_blue')
    mb.box((L / 2 + 0.01, 0, 1.6), (0.02, 2.0, 0.08), 'lamp_white')
    for s in (-1, 1):
        mb.box((-L / 2 + 0.3, s * (W / 2 + 0.01), 2.2), (0.3, 0.02, 0.3), 'neon_amber')
        mb.box((0, s * (W / 2 + 0.01), 0.3), (L * 0.6, 0.02, 0.06), 'neon_amber')
    mb.box((-L / 2 - 0.62, 0, 2.0), (0.02, 1.4, 0.08), 'neon_red')
t4 = extra('bus', _bus)
t5 = extra('police', _police)
t6 = extra('hauler', _hauler)

for i, o in enumerate((chassis, brake, reverse, antenna, thrusters, wheel)):
    o['nd_preview'] = (0, -12, 0)
    o.location = (0, -12, 0)
wheel.location = (0.72, -12 + 0.74, 0.18)
for i, o in enumerate((t1, t2, t3, t4, t5, t6)):
    o.location = (6 + i * 6, -12, 0.3)
print({o.name: tri_count(o) for o in list(CAR.objects) + list(TRAFFIC.objects)})
