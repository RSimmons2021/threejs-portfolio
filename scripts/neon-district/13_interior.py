"""Step 13: cyberpunk capsule apartment interior -> apartment-interior.glb (+ window view)

Same frame and station positions as Interiors.js (ROOM_ORIGIN-relative, Z up):
walls x +-4.6, back wall y +3.6, front wall y -3.5 with a 1.6 m door at x = 0, height 3.3.
Stations: bed (3.2, 1.6), home-lab desk (-2.2, 1.9), door (0, -2.9).
Objects: apt_shell (walls/floor/ceiling, replaces the beige slabs Interiors.js builds),
apt_furniture, apt_screens (slot nd_screen), apt_window (slot nd_window = city view),
apt_posters (slot nd_sign -> signs atlas). Name tokens 'screen'/'warm' kept for Interiors.js.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
INT = collection('INTERIOR')
H = 3.3

# ---------------------------------------------------------------- shell (inward facing)
mb = MB()
mb.quad((-4.6, -3.5, 0), (4.6, -3.5, 0), (4.6, 3.6, 0), (-4.6, 3.6, 0), 'concrete_dark')                     # floor
mb.quad((-4.6, 3.6, H), (4.6, 3.6, H), (4.6, -3.5, H), (-4.6, -3.5, H), 'metal_dark')                         # ceiling (faces down)
# back wall with a window opening x -0.6..3.6, z 0.9..2.6
for (x0, x1, z0, z1) in ((-4.6, -0.6, 0, H), (3.6, 4.6, 0, H), (-0.6, 3.6, 0, 0.9), (-0.6, 3.6, 2.6, H)):
    mb.quad((x0, 3.6, z0), (x1, 3.6, z0), (x1, 3.6, z1), (x0, 3.6, z1), 'leather_dark')        # faces -Y (into the room)
for x, s in ((-4.6, 1), (4.6, -1)):
    pts = [(x, -3.5, 0), (x, 3.6, 0), (x, 3.6, H), (x, -3.5, H)]
    mb.quad(*(pts if s > 0 else list(reversed(pts))), 'metal_dark')
for (x0, x1, z0, z1) in ((-4.6, -0.8, 0, H), (0.8, 4.6, 0, H), (-0.8, 0.8, 2.35, H)):
    mb.quad((x1, -3.5, z0), (x0, -3.5, z0), (x0, -3.5, z1), (x1, -3.5, z1), 'metal_dark')        # faces +Y
# wall paneling ribs + skirting light + ceiling light strips
for x in (-4.0, -2.0, 0.0, 2.0, 4.0):
    mb.box((x, -3.47, H / 2), (0.06, 0.04, H), 'metal_mid')
for s in (-1, 1):
    mb.box((s * 4.57, 0.05, 0.06), (0.03, 7.0, 0.04), 'neon_violet')
mb.box((0, 0.05, H - 0.02), (0.06, 6.8, 0.03), 'lamp_warm')
mb.box((-2.6, 0.05, H - 0.02), (0.06, 6.8, 0.03), 'neon_cyan')
# door (closed, inside face) and frame
mb.box((0, -3.44, 1.17), (1.6, 0.06, 2.34), 'paint_maroon')
mb.box((0, -3.4, 2.4), (1.9, 0.06, 0.1), 'neon_cyan')
mb.box((0.58, -3.39, 1.12), (0.1, 0.06, 0.1), 'lamp_warm')
# window frame + mullions
mb.box((1.5, 3.55, 0.88), (4.3, 0.12, 0.06), 'metal_light')
mb.box((1.5, 3.55, 2.62), (4.3, 0.12, 0.06), 'metal_light')
for x in (-0.6, 1.5, 3.6):
    mb.box((x, 3.55, 1.75), (0.06, 0.12, 1.76), 'metal_light')
shell = mb.build('apt_shell', INT, ao_dist=0.8, ao_samples=12)

# ---------------------------------------------------------------- furniture
mb = MB()
# capsule bed at (3.2, 1.6)
bx, by = 3.4, 1.7
mb.box((bx, by, 0.25), (2.1, 1.6, 0.5), 'metal_dark')
mb.box((bx, by, 0.6), (2.0, 1.5, 0.2), 'panel_white', faces={'pz': 'tile_white'})
mb.box((bx + 0.75, by, 0.78), (0.4, 1.2, 0.14), 'cardboard')                        # pillow
mb.box((bx - 0.3, by, 0.73), (1.3, 1.52, 0.06), 'tarp_blue')                         # blanket
mb.box((bx, by + 0.85, 1.4), (2.2, 0.1, 2.8), 'metal_mid')                          # capsule back
mb.box((bx, by, 2.75), (2.2, 1.8, 0.1), 'metal_mid')                                # capsule roof
mb.box((bx, by - 0.86, 2.68), (2.2, 0.04, 0.05), 'neon_magenta')                    # LED edge (warm token below)
mb.box((bx + 1.08, by, 1.4), (0.04, 1.8, 2.8), 'metal_dark')
mb.box((bx, by + 0.78, 2.1), (1.8, 0.2, 0.05), 'wood')                              # shelf
for i in range(5):
    mb.box((bx - 0.7 + i * 0.32, by + 0.78, 2.22), (0.06, 0.18, 0.2), ['var_jacket', 'cardboard', 'car_blue', 'paint_teal', 'hazard'][i])
# home-lab desk at (-2.2, 1.9): desk, chair, rack, synth, studio monitors, mic
dx, dy = -2.3, 2.6
mb.box((dx, dy, 0.74), (2.4, 0.8, 0.05), 'wood')
for x in (-1.1, 1.1):
    mb.box((dx + x, dy, 0.37), (0.06, 0.7, 0.74), 'metal_dark')
mb.box((dx, dy - 0.15, 0.78), (0.8, 0.25, 0.03), 'trim_black')                       # keyboard
mb.box((dx + 0.8, dy - 0.1, 0.8), (0.7, 0.28, 0.06), 'metal_dark', faces={'pz': 'panel_tech'})   # synth / MIDI
for k in range(12):
    mb.box((dx + 0.5 + k * 0.05, dy - 0.18, 0.835), (0.035, 0.1, 0.01), 'panel_white')
for x in (-1.0, 1.0):                                                               # studio monitors
    mb.box((dx + x, dy + 0.15, 0.98), (0.22, 0.25, 0.42), 'trim_black')
    mb.cyl((dx + x, dy + 0.02, 0.92), (dx + x, dy + 0.0, 0.92), 0.08, 'metal_mid', sides=10)
mb.cyl((dx - 0.6, dy - 0.1, 0.77), (dx - 0.6, dy - 0.1, 1.15), 0.01, 'metal_dark', sides=4)      # mic arm
mb.cyl((dx - 0.6, dy - 0.15, 1.15), (dx - 0.6, dy - 0.25, 1.22), 0.035, 'metal_light', sides=8)
mb.box((dx - 1.65, dy + 0.05, 0.6), (0.5, 0.6, 1.2), 'metal_dark', faces={'ny': 'panel_tech'})  # rack
for z in (0.3, 0.55, 0.8, 1.05):
    mb.box((dx - 1.65, dy - 0.26, z), (0.4, 0.01, 0.03), 'signal_green')
cx_, cy_ = dx, dy - 0.9                                                             # chair
mb.box((cx_, cy_, 0.47), (0.5, 0.5, 0.08), 'seat_black')
mb.box((cx_, cy_ - 0.24, 0.85), (0.48, 0.07, 0.7), 'seat_black')
mb.cyl((cx_, cy_, 0.05), (cx_, cy_, 0.45), 0.04, 'metal_dark', sides=6)
mb.cyl((cx_, cy_, 0.05), (cx_, cy_, 0.06), 0.3, 'metal_dark', sides=5)
# kitchenette front-left
mb.box((-3.9, -1.4, 0.45), (1.2, 2.4, 0.9), 'metal_mid', faces={'pz': 'metal_light'})
mb.box((-4.2, -2.9, 0.95), (0.7, 0.7, 1.9), 'panel_white')                          # fridge
mb.box((-3.85, -2.9, 1.7), (0.02, 0.5, 0.04), 'neon_cyan')
for i in range(3):
    mb.cyl((-3.8, -1.0 + i * 0.2, 0.9), (-3.8, -1.0 + i * 0.2, 1.02), 0.045, 'hazard' if i % 2 else 'panel_white', sides=8)   # noodle cups
mb.box((-4.45, -1.4, 1.75), (0.25, 2.2, 0.06), 'wood')
# couch + rug + plants + AC unit + vinyl
mb.box((1.6, -2.1, 0.22), (2.2, 0.9, 0.44), 'leather_tan')
mb.box((1.6, -2.5, 0.65), (2.2, 0.2, 0.5), 'leather_tan')
for x in (0.55, 2.65):
    mb.box((x, -2.1, 0.5), (0.2, 0.9, 0.35), 'leather_dark')
n = 20; rug = [(0.6 + 1.3 * math.cos(i * math.tau / n), -0.5 + 0.9 * math.sin(i * math.tau / n), 0.012) for i in range(n)]
mb.face(rug, 'paint_teal')
for (x, y) in ((-0.9, 3.2), (4.2, -3.1)):
    mb.cyl((x, y, 0), (x, y, 0.45), 0.2, 'concrete_mid', sides=8, top=0.17)
    mb.ico((x, y, 0.85), 0.38, 'plant_purple', 1, (1, 1, 1.2), alt='plant_neon', alt_ratio=0.2, seed=int(x * 10))
mb.box((-3.9, 3.45, 2.85), (0.9, 0.25, 0.3), 'panel_white', faces={'ny': 'ac_front'})
mb.box((4.45, 0.0, 1.0), (0.25, 1.2, 1.0), 'wood')
for k in range(18):
    mb.box((4.42, -0.55 + k * 0.065, 1.2), (0.2, 0.012, 0.3), ['trim_black', 'paint_maroon', 'car_blue'][k % 3])
furniture = mb.build('apt_furniture_warm', INT, ao_dist=0.6, ao_samples=12)

# ---------------------------------------------------------------- screens (3 monitors), window, posters
mb = MB()
for i, (x, a) in enumerate(((-0.62, 0.35), (0.0, 0.0), (0.62, -0.35))):
    cx, cy = dx + x, dy + 0.18 + abs(x) * -0.15
    ca, sa = math.cos(a), math.sin(a)
    P = lambda u, z: (cx + u * ca, cy + u * sa, z)
    mb.quad(P(-0.29, 0.92), P(0.29, 0.92), P(0.29, 1.27), P(-0.29, 1.27), (0, 0, 1, 1), slot='nd_screen')
screens = mb.build('apt_screens', INT, ao=False)
mb = MB()
for i, (x, a) in enumerate(((-0.62, 0.35), (0.0, 0.0), (0.62, -0.35))):
    cx, cy = dx + x, dy + 0.2 + abs(x) * -0.15
    mb.box((cx, cy + 0.02, 1.1), (0.62, 0.03, 0.4), 'trim_black', rot=a)
    mb.cyl((cx, cy + 0.06, 0.77), (cx, cy + 0.06, 0.92), 0.02, 'metal_dark', sides=4)
monitor_backs = mb.build('apt_monitors', INT, ao=False)
mb = MB()
mb.quad((-0.6, 3.62, 0.9), (3.6, 3.62, 0.9), (3.6, 3.62, 2.6), (-0.6, 3.62, 2.6), (0, 0, 1, 1), slot='nd_window')   # faces -Y (into room)
window = mb.build('apt_window', INT, ao=False)
mb = MB()
for (x, z, w, h) in ((-4.55, 1.8, 0.9, 1.3), (-4.55, 1.8, 0.0, 0.0)):
    pass
mb.quad((-4.57, -0.4, 1.3), (-4.57, 0.6, 1.3), (-4.57, 0.6, 2.6), (-4.57, -0.4, 2.6), (0, 0, 1, 1), slot='nd_sign')    # faces +X
mb.quad((4.57, 3.0, 1.4), (4.57, 2.0, 1.4), (4.57, 2.0, 2.0), (4.57, 3.0, 2.0), (0, 0, 1, 1), slot='nd_sign')       # faces -X
posters = mb.build('apt_posters', INT, ao=False)
for m in ('nd_window',):
    if not bpy.data.materials.get(m):
        flat_material(m, '#1a2a3a', emission=1.0)
for o in INT.objects:
    o.location = (0, -260, 0)
print({o.name: tri_count(o) for o in INT.objects})
