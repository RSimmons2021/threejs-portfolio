"""Step 8: hoverboard (replaces Explorer.createBoard). Long axis +Y, pivot on the ground,
same footprint as the old board (0.44 x 1.35). Under-pads use slot nd_thruster."""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
HB = collection('HOVERBOARD')
mb = MB()
# deck with kicktails: loft along Y
prof = [(-0.675, 0.24), (-0.6, 0.17), (-0.45, 0.14), (0.45, 0.14), (0.6, 0.17), (0.675, 0.24)]
for (y0, z0), (y1, z1) in zip(prof, prof[1:]):
    w0 = 0.2 if abs(y0) > 0.6 else 0.22
    w1 = 0.2 if abs(y1) > 0.6 else 0.22
    t = 0.035
    mb.quad((-w0, y0, z0 + t), (w0, y0, z0 + t), (w1, y1, z1 + t), (-w1, y1, z1 + t), 'trim_black')        # grip top
    mb.quad((w0, y0, z0), (-w0, y0, z0), (-w1, y1, z1), (w1, y1, z1), 'hero_red')                           # underside
    mb.quad((w0, y0, z0), (w1, y1, z1), (w1, y1, z1 + t), (w0, y0, z0 + t), 'neon_cyan')                   # glowing rails
    mb.quad((-w1, y1, z1), (-w0, y0, z0), (-w0, y0, z0 + t), (-w1, y1, z1 + t), 'neon_cyan')
mb.quad((-0.2, -0.675, 0.24), (0.2, -0.675, 0.24), (0.2, -0.675, 0.275), (-0.2, -0.675, 0.275), 'hero_red')
mb.quad((0.2, 0.675, 0.24), (-0.2, 0.675, 0.24), (-0.2, 0.675, 0.275), (0.2, 0.675, 0.275), 'hero_red')
for y in (0.46, -0.46):
    mb.box((0, y, 0.1), (0.3, 0.22, 0.08), 'metal_dark', skip=('pz',))
    pad = [(0.13 * math.cos(i * math.tau / 10), y + 0.09 * math.sin(i * math.tau / 10), 0.058) for i in range(10)]
    mb.face(list(reversed(pad)), 'thruster_blue', slot='nd_thruster')
board = mb.build('hoverboard', HB, ao_dist=0.2, ao_samples=12)
board.location = (-8, -16, 0)
print('hoverboard tris', tri_count(board))

# ------------------------------------------------------------------ skateboard (wheeled, the default board)
# Same deck as the hoverboard, real trucks and four wheels. Wheel hubs glow (neon_cyan) and the
# wheels are separate objects so the runtime can spin them (axle along X, wheel radius 0.045).
mb = MB()
for (y0, z0), (y1, z1) in zip(prof, prof[1:]):
    w0 = 0.2 if abs(y0) > 0.6 else 0.22
    w1 = 0.2 if abs(y1) > 0.6 else 0.22
    t = 0.03
    dz = -0.035
    mb.quad((-w0, y0, z0 + t + dz), (w0, y0, z0 + t + dz), (w1, y1, z1 + t + dz), (-w1, y1, z1 + t + dz), 'trim_black')
    mb.quad((w0, y0, z0 + dz), (-w0, y0, z0 + dz), (-w1, y1, z1 + dz), (w1, y1, z1 + dz), 'hero_red')
    mb.quad((w0, y0, z0 + dz), (w1, y1, z1 + dz), (w1, y1, z1 + t + dz), (w0, y0, z0 + t + dz), 'hero_red_dark')
    mb.quad((-w1, y1, z1 + dz), (-w0, y0, z0 + dz), (-w0, y0, z0 + t + dz), (-w1, y1, z1 + t + dz), 'hero_red_dark')
mb.box((0, 0, 0.138), (0.05, 0.7, 0.004), 'neon_magenta')                   # grip-tape stripe
for y in (0.46, -0.46):
    mb.box((0, y, 0.09), (0.12, 0.08, 0.03), 'metal_light')                 # baseplate
    mb.box((0, y, 0.065), (0.06, 0.05, 0.04), 'metal_mid')                  # hanger
    mb.cyl((-0.17, y, 0.045), (0.17, y, 0.045), 0.012, 'metal_light', sides=6)   # axle
skate = mb.build('skateboard', HB, ao_dist=0.15, ao_samples=12)
skate.location = (-10, -16, 0)
mb = MB()
mb.cyl((-0.025, 0, 0), (0.025, 0, 0), 0.045, 'panel_white', sides=10, caps=False)
for s in (-1, 1):
    ring = [(s * 0.025, 0.045 * math.cos(i * math.tau / 10), 0.045 * math.sin(i * math.tau / 10)) for i in range(10)]
    mb.face(ring if s > 0 else list(reversed(ring)), 'neon_cyan')
wheel = mb.build('skateboard_wheel', HB, ao=False)
wheel.location = (-10, -16, 0.045)
for i, (x, y) in enumerate(((0.19, 0.46), (-0.19, 0.46), (0.19, -0.46), (-0.19, -0.46))):
    o = bpy.data.objects.new('skateboard_wheel_%d' % i, wheel.data); HB.objects.link(o)
    o.parent = skate; o.location = (x, y, 0.045)
wheel.hide_set(True)
print('skateboard tris', tri_count(skate) + 4 * tri_count(wheel))
