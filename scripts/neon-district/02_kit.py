"""Step 2: city kit modules -> static/models/cyber/city-kit.glb

Facade modules: 4 m wide x 4 m tall, wall plane at y = 0, outward normal -Y,
pivot bottom-centre. Detail protrudes toward -Y. Props: pivot at ground centre.
Each module exports as kit_<name>_lod0 (+ kit_<name>_lod1 where useful).
Anchors are child empties: anchor_beam_* (light cone, points along local -Z),
anchor_sign_* (sign quad centre, faces -Y), anchor_door / anchor_lift (interaction
point on the street side), anchor_steam (points +Z), anchor_light_* (point light).
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

KIT = collection('KIT')
MODULES = {}
META = {}

def module(name, footprint=None, collision=None, notes=''):
    def deco(fn):
        MODULES[name] = fn
        META[name] = {'footprint': footprint, 'collision': collision or [], 'notes': notes}
        return fn
    return deco

def rail(mb, a, b, height=1.05, step=0.25, r='metal_dark'):
    a, b = Vector(a), Vector(b)
    mb.cyl(a + Vector((0, 0, height)), b + Vector((0, 0, height)), 0.03, r, sides=6)
    n = max(1, int((b - a).length / step))
    for i in range(n + 1):
        p = a.lerp(b, i / n)
        mb.box((p.x, p.y, p.z + height / 2), (0.025, 0.025, height), r)

# --------------------------------------------------------------------------- facades
@module('wall_window', footprint=[4, 0.25, 4])
def _(lod):
    mb = MB()
    mb.quad((-2, 0, 0), (2, 0, 0), (2, 0, 4), (-2, 0, 4), 'facade_win')
    if lod == 0:
        for r in range(3):
            z = r * 4 / 3 + 0.27
            mb.box((0, -0.08, z), (4, 0.16, 0.06), 'concrete_light', skip=('py',))
            mb.box((0, -0.05, r * 4 / 3 + 0.06), (4, 0.1, 0.12), 'concrete_dark', skip=('py',))
        for x in (-1.96, 1.96):
            mb.box((x, -0.12, 2), (0.08, 0.24, 4), 'concrete_dark', skip=('py',))
    return mb

@module('wall_strip', footprint=[4, 0.3, 4])
def _(lod):
    mb = MB()
    mb.quad((-2, 0, 0), (2, 0, 0), (2, 0, 4), (-2, 0, 4), 'facade_strip')
    if lod == 0:
        for r in range(4):
            z = (r * 64 + 18 + 30) / 256 * 4 + 0.05
            mb.box((0, -0.15, z), (4, 0.3, 0.04), 'metal_dark', skip=('py',))
        for k in range(5):
            mb.box((-2 + k, -0.09, 2), (0.05, 0.18, 4), 'metal_mid', skip=('py',))
    return mb

@module('wall_balcony', footprint=[4, 1.2, 4])
def _(lod):
    mb = MB()
    if lod == 1:
        mb.quad((-2, 0, 0), (2, 0, 0), (2, 0, 4), (-2, 0, 4), 'facade_balcony')
        mb.box((0, -0.3, 0.1), (4, 0.6, 0.2), 'concrete_dark', skip=('py',))
        return mb
    d = 0.9
    mb.quad((-2, d, 0.15), (2, d, 0.15), (2, d, 3.85), (-2, d, 3.85), 'facade_balcony')
    for x, s in ((-2, 1), (2, -1)):
        pts = [(x, 0, 0.15), (x, d, 0.15), (x, d, 3.85), (x, 0, 3.85)]
        mb.quad(*(pts if s > 0 else list(reversed(pts))), 'concrete_mid')
    mb.box((0, d / 2 - 0.35, 0.075), (4, d + 0.7, 0.15), 'concrete_dark')
    mb.box((0, d / 2 - 0.15, 3.925), (4, d + 0.3, 0.15), 'concrete_dark')
    rail(mb, (-1.95, -0.62, 0.15), (1.95, -0.62, 0.15), 1.05, 0.5)
    mb.cyl((-1.8, 0.6, 2.4), (1.8, 0.6, 2.4), 0.01, 'cable_black', sides=4, caps=False)   # washing line
    for i, cl in enumerate(('var_jacket', 'tarp_blue', 'panel_white')):
        mb.box((-1.2 + i * 0.9, 0.6, 2.05), (0.5, 0.02, 0.7), cl)
    mb.box((1.4, 0.4, 0.45), (0.5, 0.5, 0.6), 'concrete_mid')                         # planter
    mb.ico((1.4, 0.4, 0.95), 0.35, 'plant_purple', 1, (1, 1, 0.8), seed=3)
    mb.box((0, d - 0.02, 3.7), (3.6, 0.04, 0.05), 'neon_magenta')                       # strip light
    return mb

@module('storefront', footprint=[4, 1.2, 4], notes='Sign band behind anchor_sign_0 (3.6 x 0.8).')
def _(lod):
    mb = MB()
    mb.quad((-2, 0, 0), (2, 0, 0), (2, 0, 4), (-2, 0, 4), 'storefront')
    if lod == 0:
        # awning
        mb.quad((-1.9, -1.1, 2.75), (1.9, -1.1, 2.75), (1.9, 0, 2.95), (-1.9, 0, 2.95), 'metal_dark')
        mb.quad((-1.9, 0, 2.9), (1.9, 0, 2.9), (1.9, -1.1, 2.7), (-1.9, -1.1, 2.7), 'metal_mid')
        mb.box((0, -1.1, 2.72), (3.8, 0.05, 0.06), 'neon_cyan')
        for x in (-1.9, 1.9):
            mb.cyl((x, -1.05, 2.75), (x, -0.02, 3.3), 0.02, 'metal_dark', sides=4)
        mb.box((0, -0.06, 3.38), (3.7, 0.12, 0.9), 'trim_black', skip=('py',))
        mb.box((1.55, -0.25, 1.2), (0.6, 0.5, 0.9), 'cardboard')
        mb.box((1.45, -0.2, 1.8), (0.45, 0.4, 0.3), 'cardboard')
    return mb

@module('storefront_door', footprint=[4, 0.8, 4], notes='Career door variant. anchor_door is the walk-up point.')
def _(lod):
    mb = MB()
    mb.quad((-2, 0, 0), (2, 0, 0), (2, 0, 4), (-2, 0, 4), 'storefront_door')
    if lod == 0:
        u = lambda px: px / 256 * 4 - 2
        for x in (u(40) + 0.03, u(216) - 0.03):
            mb.box((x, -0.05, 1.53), (0.07, 0.1, 3.06), 'neon_cyan', skip=('py',))
        mb.box((0, -0.05, 3.06), (u(216) - u(40), 0.1, 0.07), 'neon_cyan', skip=('py',))
        mb.box((0, -0.4, 0.05), (3.0, 0.8, 0.1), 'concrete_light', skip=('py',))            # step
        mb.box((0, -0.45, 3.4), (3.2, 0.9, 0.08), 'metal_dark', skip=('py',))                 # canopy
        mb.box((0, -0.88, 3.36), (3.2, 0.04, 0.04), 'lamp_white')
    return mb

@module('corner_column', footprint=[0.6, 0.6, 4], notes='Pivot is the column centre; place on tower corners.')
def _(lod):
    mb = MB()
    mb.box((0, 0, 2), (0.6, 0.6, 4), 'concrete_mid', skip=('pz', 'nz'))
    if lod == 0:
        for z in (4 / 3, 8 / 3):
            mb.box((0, 0, z), (0.66, 0.66, 0.1), 'concrete_dark', skip=('pz', 'nz'))
    return mb

@module('ledge_spot', footprint=[4, 1.0, 0.35], notes='Setback ledge with two downlights; anchor_beam_* point down.')
def _(lod):
    mb = MB()
    mb.box((0, -0.5, 0.175), (4, 1.0, 0.35), 'concrete_dark')
    if lod == 0:
        mb.box((0, -1.0, 0.25), (4, 0.03, 0.04), 'neon_white')
        for x in (-1.2, 1.2):
            mb.cyl((x, -0.7, 0), (x, -0.7, -0.22), 0.12, 'metal_dark', sides=8, top=0.16)
            mb.face([(x + 0.14 * math.cos(i * math.tau / 8), -0.7 + 0.14 * math.sin(i * math.tau / 8), -0.225) for i in reversed(range(8))], 'lamp_white')
    return mb

# --------------------------------------------------------------------------- roof / crowns
@module('roof_tile', footprint=[4, 4, 0.6], notes='Flat roof tile, top at z = 0. Tile across tower tops.')
def _(lod):
    mb = MB()
    mb.quad((-2, -2, 0), (2, -2, 0), (2, 2, 0), (-2, 2, 0), 'concrete_dark')
    if lod == 0:
        mb.box((0.8, 0.6, 0.3), (1.0, 0.8, 0.6), 'metal_mid', faces={'ny': 'vent_grille', 'pz': 'metal_dark'})
        mb.box((-1.0, -0.9, 0.12), (1.2, 0.9, 0.24), 'glass_teal', faces={'pz': 'glass_dark'})
    return mb

@module('parapet', footprint=[4, 0.3, 0.9], notes='Roof edge, wall plane y = 0 like facades.')
def _(lod):
    mb = MB()
    mb.box((0, 0.15, 0.45), (4, 0.3, 0.9), 'concrete_mid', skip=('nz',))
    if lod == 0:
        mb.box((0, -0.02, 0.86), (4.0, 0.34, 0.08), 'concrete_light')   # coping
    return mb

@module('crown_tank', footprint=[3, 3, 5])
def _(lod):
    mb = MB()
    for x in (-0.8, 0.8):
        for y in (-0.8, 0.8):
            mb.box((x, y, 0.75), (0.12, 0.12, 1.5), 'metal_dark', skip=('pz', 'nz'))
    mb.box((0, 0, 1.5), (2.0, 2.0, 0.12), 'metal_dark')
    mb.cyl((0, 0, 1.56), (0, 0, 3.6), 1.1, 'wood', sides=12 if lod == 0 else 6, cap_r='wood')
    mb.cyl((0, 0, 3.6), (0, 0, 4.4), 1.15, 'metal_dark', sides=12 if lod == 0 else 6, top=0.05)
    if lod == 0:
        for z in (2.1, 3.0):
            mb.cyl((0, 0, z), (0, 0, z + 0.06), 1.13, 'metal_dark', sides=12, caps=False)
        mb.cyl((0.9, 0.6, 0), (0.9, 0.6, 1.8), 0.08, 'metal_mid', sides=6)
    return mb

@module('crown_antenna', footprint=[1.5, 1.5, 12], notes='anchor_light_0 = red aircraft beacon (blink it).')
def _(lod):
    mb = MB()
    h = 11.5
    for x, y in ((-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)):
        mb.cyl((x, y, 0), (x * 0.25, y * 0.25, h), 0.05, 'metal_mid', sides=4 if lod else 6)
    if lod == 0:
        for k in range(1, 6):
            z = k * h / 6; s = 0.5 * (1 - 0.75 * z / h)
            sq = [(-s, -s), (s, -s), (s, s), (-s, s)]
            for i in range(4):
                (x0, y0), (x1, y1) = sq[i], sq[(i + 1) % 4]
                mb.cyl((x0, y0, z), (x1, y1, z), 0.025, 'metal_mid', sides=4, caps=False)
        mb.cyl((0.35, 0, 6.5), (0.75, 0, 6.8), 0.45, 'panel_white', sides=10, top=0.05)    # dish
    mb.box((0, 0, h + 0.15), (0.25, 0.25, 0.3), 'neon_red')
    return mb

@module('crown_billboard', footprint=[8.4, 2, 7], notes="Screen = slot 'nd_screen' (uv 0..1). Map a project/ad texture.")
def _(lod):
    mb = MB()
    for x in (-3, 3):
        mb.box((x, 0.6, 1.25), (0.2, 0.2, 2.5), 'metal_dark', skip=('pz', 'nz'))
        mb.cyl((x, 0.6, 0.2), (x, 1.6, 0), 0.06, 'metal_dark', sides=4)
    mb.box((0, 0.25, 4.75), (8.4, 0.3, 4.9), 'metal_dark', skip=('ny',))
    mb.quad((-4.2, 0.1, 2.3), (4.2, 0.1, 2.3), (4.2, 0.1, 7.2), (-4.2, 0.1, 7.2), 'trim_black')
    mb.quad((-4.0, 0.08, 2.5), (4.0, 0.08, 2.5), (4.0, 0.08, 7.0), (-4.0, 0.08, 7.0), (0, 0, 1, 1), slot='nd_screen')
    if lod == 0:
        mb.box((0, -0.2, 2.3), (8.4, 0.6, 0.12), 'metal_mid')
        for x in (-3, 0, 3):
            mb.box((x, -0.55, 2.42), (0.3, 0.2, 0.12), 'lamp_white')
    return mb

@module('billboard_wall', footprint=[8.4, 0.5, 4.9], notes="Wall-mounted hero billboard. Screen slot 'nd_screen' uv 0..1 (16:9 at 8 x 4.5).")
def _(lod):
    mb = MB()
    mb.box((0, -0.15, 2.45), (8.4, 0.3, 4.9), 'metal_dark', skip=('py',))
    mb.quad((-4.0, -0.31, 0.2), (4.0, -0.31, 0.2), (4.0, -0.31, 4.7), (-4.0, -0.31, 4.7), (0, 0, 1, 1), slot='nd_screen')
    if lod == 0:
        for z in (0.12, 4.78):
            mb.box((0, -0.33, z), (8.2, 0.04, 0.05), 'neon_white')
        for x in (-4.12, 4.12):
            mb.box((x, -0.33, 2.45), (0.05, 0.04, 4.7), 'neon_white')
    return mb

# --------------------------------------------------------------------------- greebles
@module('ac_cluster', footprint=[3, 0.8, 2.2])
def _(lod):
    mb = MB()
    for i, (x, z) in enumerate(((-1.0, 0.4), (0.1, 0.5), (0.9, 1.4))):
        mb.box((x, -0.35, z), (0.85, 0.5, 0.6), 'metal_mid', faces={'ny': 'ac_front'}, skip=('py',))
        mb.box((x, -0.35, z - 0.33), (0.9, 0.55, 0.05), 'metal_dark', skip=('py',))
        mb.cyl((x + 0.3, -0.12, z - 0.3), (x + 0.3, -0.12, 0), 0.03, 'metal_mid', sides=5)
    return mb

@module('pipe_run', footprint=[1, 0.4, 4], notes='Tileable vertically.')
def _(lod):
    mb = MB()
    mb.cyl((-0.25, -0.15, 0), (-0.25, -0.15, 4), 0.08, 'metal_mid', sides=6, caps=False)
    mb.cyl((0.1, -0.2, 0), (0.1, -0.2, 4), 0.13, 'rust', sides=8, caps=False)
    for z in (0.6, 2.0, 3.4):
        mb.box((-0.08, -0.12, z), (0.6, 0.24, 0.06), 'metal_dark', skip=('py',))
    mb.box((0.35, -0.12, 1.3), (0.3, 0.24, 0.4), 'metal_dark', faces={'ny': 'panel_tech'}, skip=('py',))
    return mb

@module('fire_escape', footprint=[4, 1.3, 4], notes='Stacks every 4 m.')
def _(lod):
    mb = MB()
    mb.box((0, -0.6, 0.05), (4, 1.2, 0.06), 'metal_dark', faces={'pz': 'vent_grille', 'nz': 'vent_grille'})
    rail(mb, (-2, -1.18, 0.08), (2, -1.18, 0.08), 0.95, 0.4)
    rail(mb, (-2, -1.18, 0.08), (-2, -0.02, 0.08), 0.95, 0.4)
    rail(mb, (2, -1.18, 0.08), (2, -0.02, 0.08), 0.95, 0.4)
    steps = 12
    for i in range(steps):
        t = i / steps
        mb.box((-1.4 + 2.8 * t, -0.62, 0.3 + 3.7 * t), (0.26, 0.85, 0.04), 'metal_dark')
    for y in (-1.05, -0.2):
        mb.cyl((-1.5, y, 0.1), (1.5, y, 4.0), 0.03, 'metal_dark', sides=4)
    return mb

@module('scaffold', footprint=[4, 1.4, 4])
def _(lod):
    mb = MB()
    for x in (-2, 0, 2):
        for y in (-0.2, -1.3):
            mb.cyl((x, y, 0), (x, y, 4), 0.035, 'metal_mid', sides=5, caps=False)
    for z in (0.05, 2, 3.95):
        for y in (-0.2, -1.3):
            mb.cyl((-2, y, z), (2, y, z), 0.03, 'metal_mid', sides=5, caps=False)
    mb.cyl((-2, -1.3, 0.05), (2, -1.3, 3.95), 0.03, 'metal_mid', sides=5, caps=False)
    mb.box((0, -0.75, 2.04), (4, 1.0, 0.05), 'wood')
    mb.quad((-2, -1.36, 0.6), (0.6, -1.36, 0.4), (0.6, -1.36, 3.9), (-2, -1.36, 3.9), 'tarp_green')
    return mb

@module('neon_tube', footprint=[1, 0.1, 0.1], notes="1 m tube along X, colour from 'neon_white' -> tint per instance.")
def _(lod):
    mb = MB()
    mb.cyl((-0.5, -0.06, 0), (0.5, -0.06, 0), 0.025, 'neon_white', sides=6)
    for x in (-0.4, 0.4):
        mb.box((x, -0.03, 0), (0.03, 0.06, 0.03), 'trim_black', skip=('py',))
    return mb

@module('sign_blade', footprint=[0.9, 0.2, 3.2], notes="Vertical blade sign. Both faces slot 'nd_sign' (uv 0..1 -> remap to signs atlas rect). Mounts on a facade, sticks out along -Y.")
def _(lod):
    mb = MB()
    mb.box((0, -0.55, 1.6), (0.12, 0.9, 3.2), 'metal_dark', skip=('px', 'nx'))
    mb.quad((0.061, -1.0, 0.05), (0.061, -0.1, 0.05), (0.061, -0.1, 3.15), (0.061, -1.0, 3.15), (0, 0, 1, 1), slot='nd_sign')
    mb.quad((-0.061, -0.1, 0.05), (-0.061, -1.0, 0.05), (-0.061, -1.0, 3.15), (-0.061, -0.1, 3.15), (0, 0, 1, 1), slot='nd_sign')
    for z in (0.4, 2.8):
        mb.box((0, -0.05, z), (0.06, 0.1, 0.06), 'metal_dark')
    return mb

@module('sign_box', footprint=[3, 0.3, 1], notes="Horizontal lightbox. Front face slot 'nd_sign' (uv 0..1).")
def _(lod):
    mb = MB()
    mb.box((0, -0.15, 0.5), (3, 0.3, 1), 'metal_dark', skip=('ny', 'py'))
    mb.quad((-1.5, -0.3, 0), (1.5, -0.3, 0), (1.5, -0.3, 1), (-1.5, -0.3, 1), (0, 0, 1, 1), slot='nd_sign')
    return mb

# --------------------------------------------------------------------------- structures
@module('skybridge', footprint=[20, 4, 3.4], collision=[{'center': [0, 0, 1.7], 'size': [20, 4.2, 3.4]}],
        notes='20 m span along X, floor at z = 0, pivot at span centre.')
def _(lod):
    mb = MB()
    if lod == 1:
        mb.box((0, 0, 1.7), (20, 4, 3.4), 'glass_teal', faces={'pz': 'metal_dark', 'nz': 'concrete_dark'}, skip=('px', 'nx'))
        mb.box((0, 0, -0.05), (20, 0.3, 0.06), 'neon_cyan')
        return mb
    mb.box((0, 0, 0.0), (20, 4, 0.4), 'concrete_dark', faces={'pz': 'metal_mid'}, skip=('px', 'nx'))
    mb.box((0, 0, 3.25), (20, 4, 0.3), 'metal_dark', skip=('px', 'nx'))
    for s in (-1, 1):
        y = s * 1.98
        pts = [(-10, y, 0.2), (10, y, 0.2), (10, y, 3.1), (-10, y, 3.1)]
        mb.quad(*(pts if s < 0 else list(reversed(pts))), (0, 0, 1, 1), slot='nd_glass')
    for k in range(9):
        x = -10 + k * 2.5
        mb.box((x, 0, 1.7), (0.2, 4.2, 3.4), 'metal_mid', skip=('px', 'nx') if k in (0, 8) else ())
    mb.box((0, 0, -0.21), (19.5, 0.25, 0.04), 'neon_cyan')
    for s in (-1, 1):
        mb.box((0, s * 2.12, 3.0), (19.5, 0.04, 0.05), 'neon_magenta')
    return mb

@module('rooftop_pad', footprint=[12, 12, 3.5],
        collision=[{'center': [0, 0, 0.25], 'size': [12, 12, 0.5]},
                   {'center': [0, 5.95, 1.0], 'size': [12, 0.1, 1.1]},
                   {'center': [5.95, 0, 1.0], 'size': [0.1, 12, 1.1]},
                   {'center': [-5.95, 0, 1.0], 'size': [0.1, 12, 1.1]},
                   {'center': [-4.5, 4.5, 2.0], 'size': [2.4, 2.4, 3.0]}],
        notes='Pad top at z = 0.5. Open edge is -Y (landing approach). anchor_lift = lift booth door (walk-up point).')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.25), (12, 12, 0.5), 'concrete_dark', faces={'pz': 'pad_top'})
    if lod == 0:
        rail(mb, (-6, 5.95, 0.5), (6, 5.95, 0.5), 1.05, 0.5)
        rail(mb, (5.95, -6, 0.5), (5.95, 6, 0.5), 1.05, 0.5)
        rail(mb, (-5.95, -6, 0.5), (-5.95, 3.2, 0.5), 1.05, 0.5)
        for x in (-5.8, 0, 5.8):
            mb.box((x, -5.9, 0.56), (0.3, 0.12, 0.12), 'lamp_white')
        for y in (-3, 0, 3):
            mb.box((5.9, y, 0.56), (0.12, 0.3, 0.12), 'lamp_white')
    # lift booth
    mb.box((-4.5, 4.5, 2.0), (2.4, 2.4, 3.0), 'metal_mid', faces={'ny': (*tile_uv('storefront_door')[:2], tile_uv('storefront_door')[2], tile_uv('storefront_door')[1] + (tile_uv('storefront_door')[3] - tile_uv('storefront_door')[1]) * 0.8), 'pz': 'metal_dark'}, skip=('nz',))
    mb.box((-4.5, 3.28, 3.3), (2.4, 0.06, 0.4), 'neon_cyan')
    return mb

@module('launch_pad', footprint=[10, 10, 0.3], notes='Spawn pad. Disc top uses the pad tile.')
def _(lod):
    mb = MB()
    n = 24
    ring = [(5 * math.cos(i * math.tau / n), 5 * math.sin(i * math.tau / n)) for i in range(n)]
    mb.prism(ring, 0, 0.12, 'concrete_dark', top=False, bottom=False)
    mb.face([(x, y, 0.12) for x, y in ring], 'pad_top')
    if lod == 0:
        for i in range(12):
            a = i * math.tau / 12
            mb.box((5.2 * math.cos(a), 5.2 * math.sin(a), 0.12), (0.25, 0.25, 0.24), 'neon_cyan', rot=a)
    return mb

# --------------------------------------------------------------------------- street props
@module('street_lamp', footprint=[0.4, 1.8, 6.4], collision=[{'center': [0, 0, 3], 'size': [0.25, 0.25, 6]}],
        notes='Arm reaches toward -Y (the road). anchor_beam_0 at the head.')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.15), (0.4, 0.4, 0.3), 'metal_dark')
    mb.cyl((0, 0, 0.3), (0, 0, 6.0), 0.07, 'metal_dark', sides=6 if lod == 0 else 4, top=0.05)
    mb.cyl((0, 0, 5.9), (0, -1.5, 6.2), 0.045, 'metal_dark', sides=6, caps=False)
    mb.box((0, -1.6, 6.18), (0.35, 0.7, 0.14), 'metal_dark', faces={'nz': 'lamp_white'})
    if lod == 0:
        mb.box((0, 0.05, 2.5), (0.12, 0.12, 1.2), 'neon_cyan')
    return mb

@module('vending', footprint=[0.9, 0.75, 1.95], collision=[{'center': [0, 0, 0.975], 'size': [0.9, 0.75, 1.95]}],
        notes='Front faces -Y.')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.975), (0.9, 0.75, 1.95), 'metal_dark', faces={'ny': 'vending'})
    mb.box((0, -0.38, 1.98), (0.9, 0.03, 0.06), 'screen_glow')
    return mb

@module('bollard', footprint=[0.3, 0.3, 0.9], collision=[{'center': [0, 0, 0.45], 'size': [0.26, 0.26, 0.9]}])
def _(lod):
    mb = MB()
    mb.cyl((0, 0, 0), (0, 0, 0.9), 0.12, 'metal_dark', sides=8 if lod == 0 else 6)
    mb.cyl((0, 0, 0.7), (0, 0, 0.78), 0.125, 'neon_cyan', sides=8, caps=False)
    return mb

@module('steam_vent', footprint=[1.2, 0.8, 0.1], notes='anchor_steam points up: spawn the steam sprite there.')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.04), (1.2, 0.8, 0.08), 'metal_dark', faces={'pz': 'vent_grille'})
    return mb

@module('kiosk', footprint=[1.2, 1.2, 2.6], collision=[{'center': [0, 0, 1.3], 'size': [1.24, 1.24, 2.6]}],
        notes='Holo kiosk; replaces the old street trees at TREE_POSITIONS.')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.15), (1.2, 1.2, 0.3), 'concrete_mid')
    mb.box((0, 0, 1.3), (0.4, 0.4, 2.0), 'metal_dark')
    for s in (-1, 1):
        y = s * 0.24
        pts = [(-0.5, y, 1.1), (0.5, y, 1.1), (0.5, y + s * 0.15, 2.2), (-0.5, y + s * 0.15, 2.2)]
        mb.quad(*(pts if s < 0 else [pts[1], pts[0], pts[3], pts[2]]), 'kiosk_screen')
        back = [(0.5, y - s * 0.02, 1.1), (-0.5, y - s * 0.02, 1.1), (-0.5, y + s * 0.13, 2.2), (0.5, y + s * 0.13, 2.2)]
        mb.quad(*(back if s < 0 else [back[1], back[0], back[3], back[2]]), 'metal_dark')
    mb.cyl((0, 0, 2.3), (0, 0, 2.38), 0.5, 'neon_magenta', sides=12)
    return mb

@module('planter_tree', footprint=[1.4, 1.4, 4.2], collision=[{'center': [0, 0, 1.3], 'size': [1.24, 1.24, 2.6]}],
        notes='Neon ginkgo in a concrete planter (alternative to kiosk at tree positions).')
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.3), (1.4, 1.4, 0.6), 'concrete_mid', faces={'pz': 'rust'})
    mb.cyl((0, 0, 0.6), (0, 0, 2.6), 0.12, 'wood', sides=6, top=0.07)
    blobs = ((0, 0, 3.0, 0.9), (0.5, 0.3, 2.7, 0.6), (-0.45, -0.2, 2.75, 0.65), (0.1, -0.4, 3.5, 0.55))
    for i, (x, y, z, rr) in enumerate(blobs if lod == 0 else blobs[:1]):
        mb.ico((x, y, z), rr, 'plant_purple', 1, (1, 1, 0.75), alt='plant_neon', alt_ratio=0.25, seed=i)
    return mb

@module('clutter_boxes', footprint=[1.6, 1.0, 1.0])
def _(lod):
    mb = MB()
    mb.box((-0.4, 0, 0.25), (0.6, 0.5, 0.5), 'cardboard', rot=0.2)
    mb.box((0.25, 0.1, 0.2), (0.5, 0.45, 0.4), 'cardboard', rot=-0.3)
    mb.box((-0.3, 0.05, 0.62), (0.4, 0.35, 0.25), 'cardboard', rot=0.5)
    for i, (x, y) in enumerate(((0.6, -0.2), (0.75, 0.25))):
        mb.ico((x, y, 0.25), 0.28, 'trim_black', 1, (1, 1, 0.9), seed=10 + i)
    return mb

@module('dumpster', footprint=[1.8, 1.1, 1.3], collision=[{'center': [0, 0, 0.65], 'size': [1.8, 1.1, 1.3]}])
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.6), (1.8, 1.1, 1.0), 'paint_teal')
    mb.quad((-0.9, -0.55, 1.1), (0.9, -0.55, 1.1), (0.9, 0.55, 1.3), (-0.9, 0.55, 1.3), 'metal_dark')
    for x in (-0.7, 0.7):
        mb.cyl((x, -0.4, 0), (x, -0.4, 0.1), 0.08, 'rubber', sides=6)
    return mb

@module('holo_panel', footprint=[5, 1.2, 3.2], notes="Project board replacement. Screen slot 'nd_screen' uv 0..1 (16:9). Faces -Y, tilted back 15 deg.")
def _(lod):
    mb = MB()
    mb.box((0, 0, 0.15), (5.0, 0.8, 0.3), 'metal_dark', faces={'pz': 'concrete_dark'})
    mb.box((0, -0.41, 0.2), (4.9, 0.03, 0.05), 'neon_white')
    t = math.radians(15)
    p = lambda x, h: (x, 0.1 + h * math.sin(t), 0.35 + h * math.cos(t))
    for x in (-2.35, 2.35):
        mb.cyl((x, 0.1, 0.3), p(x, 2.75), 0.05, 'metal_mid', sides=6)
    mb.quad(p(-2.3, 0.1), p(2.3, 0.1), p(2.3, 2.69), p(-2.3, 2.69), (0, 0, 1, 1), slot='nd_screen')
    a, b, c, d = p(2.3, 0.1), p(-2.3, 0.1), p(-2.3, 2.69), p(2.3, 2.69)
    mb.quad(*[(x, y + 0.02, z) for x, y, z in (a, b, c, d)], 'metal_dark')
    return mb

@module('terminal', footprint=[1.4, 0.9, 1.4], collision=[{'center': [0, 0, 0.6], 'size': [1.4, 0.9, 1.2]}],
        notes="Comms terminal for contact links. Screen slot 'nd_screen' uv 0..1. Faces -Y.")
def _(lod):
    mb = MB()
    mb.box((0, 0.05, 0.5), (1.4, 0.8, 1.0), 'metal_dark', faces={'ny': 'panel_tech'})
    mb.quad((-0.7, -0.35, 1.0), (0.7, -0.35, 1.0), (0.7, 0.45, 1.35), (-0.7, 0.45, 1.35), 'metal_mid')
    mb.quad((-0.6, -0.32, 1.03), (0.6, -0.32, 1.03), (0.6, 0.38, 1.34), (-0.6, 0.38, 1.34), (0, 0, 1, 1), slot='nd_screen')
    for x in (-0.72, 0.72):
        mb.box((x, 0.05, 0.6), (0.03, 0.82, 1.1), 'neon_cyan')
    return mb

# --------------------------------------------------------------------------- skyline
def skyline(mb, w, d, h, seed):
    rnd = random.Random(seed)
    z = 0
    tiers = [(w, d, h * 0.62), (w * 0.78, d * 0.78, h * 0.25), (w * 0.5, d * 0.55, h * 0.13)]
    for tw, td, th in tiers:
        hw, hd = tw / 2, td / 2
        ring = [(-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd)]
        for i in range(4):
            (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % 4]
            length = math.hypot(x1 - x0, y1 - y0)
            nx, nz = max(1, round(length / 8)), max(1, round(th / 8))
            for a in range(nx):
                for b in range(nz):
                    p0 = (x0 + (x1 - x0) * a / nx, y0 + (y1 - y0) * a / nx)
                    p1 = (x0 + (x1 - x0) * (a + 1) / nx, y0 + (y1 - y0) * (a + 1) / nx)
                    z0, z1 = z + th * b / nz, z + th * (b + 1) / nz
                    mb.quad((*p0, z0), (*p1, z0), (*p1, z1), (*p0, z1), 'skyline_win')
        mb.face([(x, y, z + th) for x, y in ring], 'concrete_dark')
        z += th
    mb.cyl((0, 0, z), (0, 0, z + h * 0.12), 0.3, 'metal_mid', sides=4, top=0.05)
    mb.box((0, 0, z + h * 0.12 + 0.3), (0.6, 0.6, 0.6), 'neon_red')
    for k in range(rnd.randint(2, 4)):
        mb.box((rnd.uniform(-w / 3, w / 3), -d / 2 - 0.05, rnd.uniform(h * 0.2, h * 0.55)), (rnd.uniform(3, 7), 0.1, rnd.uniform(1, 3)),
               rnd.choice(['neon_magenta', 'neon_cyan', 'neon_amber', 'neon_violet']))

for i, (w, d, h) in enumerate(((18, 18, 120), (24, 16, 170), (14, 14, 220))):
    def _sky(lod, w=w, d=d, h=h, i=i):
        mb = MB(); skyline(mb, w, d, h, i); return mb
    name = 'skyline_' + 'abc'[i]
    MODULES[name] = _sky
    META[name] = {'footprint': [w, d, h], 'collision': [], 'notes': 'Out-of-bounds silhouette ring; no collision. LOD0 only.'}

# --------------------------------------------------------------------------- anchors
ANCHORS = {
    'storefront': [('anchor_sign_0', (0, -0.13, 3.38), (math.pi / 2, 0, 0))],
    'storefront_door': [('anchor_door', (0, -1.0, 0), (0, 0, 0)), ('anchor_sign_0', (0, -0.05, 3.7), (math.pi / 2, 0, 0))],
    'ledge_spot': [('anchor_beam_0', (-1.2, -0.7, -0.23), (0, 0, 0)), ('anchor_beam_1', (1.2, -0.7, -0.23), (0, 0, 0))],
    'crown_antenna': [('anchor_light_0', (0, 0, 11.8), (0, 0, 0))],
    'crown_billboard': [('anchor_beam_0', (0, -0.55, 2.5), (math.pi, 0, 0))],
    'rooftop_pad': [('anchor_lift', (-4.5, 2.6, 0.5), (0, 0, 0))],
    'street_lamp': [('anchor_beam_0', (0, -1.6, 6.1), (0, 0, 0))],
    'steam_vent': [('anchor_steam', (0, 0, 0.1), (math.pi, 0, 0))],
    'launch_pad': [('anchor_spawn', (0, 0, 0.12), (0, 0, 0))],
}
LOD1 = {'wall_window', 'wall_strip', 'wall_balcony', 'storefront', 'storefront_door', 'corner_column',
        'ledge_spot', 'roof_tile', 'parapet', 'crown_tank', 'crown_antenna', 'crown_billboard',
        'billboard_wall', 'skybridge', 'rooftop_pad', 'street_lamp', 'bollard', 'planter_tree', 'launch_pad'}
NO_AO = {'skyline_a', 'skyline_b', 'skyline_c'}

built = []
x_cursor = 0.0
report = {}
for name, fn in MODULES.items():
    fp = META[name]['footprint'] or [4, 4, 4]
    for lod in (0, 1):
        if lod == 1 and name not in LOD1:
            continue
        mb = fn(lod)
        ob = mb.build('kit_%s_lod%d' % (name, lod), KIT, ao=(name not in NO_AO and lod == 0),
                      ao_dist=1.0 if fp[2] < 6 else 1.6, ao_samples=16)
        if lod == 1 and name not in NO_AO:
            # LOD1 reuses a softened constant AO so distant modules stay consistent.
            fill_ao(ob, 0.85)
        ob['nd_module'] = name
        ob['nd_lod'] = lod
        ob['nd_preview'] = (x_cursor, lod * 14.0, 0.0)
        ob.location = ob['nd_preview']
        if lod == 0:
            for an, loc, rot in ANCHORS.get(name, []):
                e = anchor(an, ob, loc, rot)
        report['kit_%s_lod%d' % (name, lod)] = tri_count(ob)
        built.append(ob)
    x_cursor += max(fp[0], 4) + 3

print('modules', len(MODULES), 'objects', len(built), 'tris total', sum(report.values()))
print({k: v for k, v in report.items() if k.endswith('lod0')})
json.dump({'meta': META, 'tris': report}, open(os.path.join(OUT, 'city-kit.json'), 'w'), indent=1)   # footprints, collision boxes, notes per module
