"""Step 5b: drive <-> fly transformation for the hero car.

Outputs
- hover-car-assembled.glb : chassis + 4 wheel-pod nodes + lights/antenna/thrusters,
  animations 'drive_to_fly' and 'fly_to_drive' (0.8 s each, pod transforms only).
- hover-car.json          : the same transformation as data (per-wheel drive/fly pose,
  timing, emissive ramps, recommended physics options) for Car.js, which places the
  wheels from physics and therefore composes the fold itself.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

FPS = 30
FR = 24                         # 0.8 s
AS = collection('CAR_ASSEMBLED')
src = {n: bpy.data.objects[n] for n in ('hover_chassis', 'hover_brake', 'hover_reverse', 'hover_antenna', 'hover_thrusters', 'hover_wheel')}

DRIVE_Z = 0.18                  # wheel centre in the chassis mesh frame at suspension rest
WHEELS = {   # name: (x, side)  side +1 = left (+Y)
    'wheel_FL': (0.72, 1), 'wheel_FR': (0.72, -1), 'wheel_BL': (-0.68, 1), 'wheel_BR': (-0.68, -1)}
DRIVE = {n: {'pos': [x, 0.74 * s, DRIVE_Z], 'rotX': 0.0} for n, (x, s) in WHEELS.items()}
FLY = {n: {'pos': [x, 0.66 * s, DRIVE_Z + 0.12], 'rotX': -s * math.pi / 2} for n, (x, s) in WHEELS.items()}

root = bpy.data.objects.new('hover_car', None); AS.objects.link(root)
root.empty_display_type = 'PLAIN_AXES'
root.location = (0, -16, 0.4)
parts = {}
for key, ob in src.items():
    if key == 'hover_wheel':
        continue
    o = bpy.data.objects.new(key.replace('hover_', ''), ob.data); AS.objects.link(o); o.parent = root
    parts[key] = o
for n, d in DRIVE.items():
    o = bpy.data.objects.new(n, src['hover_wheel'].data); AS.objects.link(o); o.parent = root
    o.rotation_mode = 'XYZ'
    o.location = d['pos']; o.rotation_euler = (d['rotX'], 0, 0)
    parts[n] = o

def clip(name, a, b):
    for n in WHEELS:
        o = parts[n]
        o.animation_data_create()
        act = bpy.data.actions.new('%s_%s' % (name, n))
        o.animation_data.action = act
        for f, pose in ((1, a[n]), (FR + 1, b[n])):
            o.location = pose['pos']; o.rotation_euler = (pose['rotX'], 0, 0)
            o.keyframe_insert('location', frame=f); o.keyframe_insert('rotation_euler', frame=f)
        # overshoot-free ease: tuck the pod in slightly before it rotates (mid key)
        mid = {k: [(a[n]['pos'][i] + b[n]['pos'][i]) / 2 for i in range(3)] for k in ('pos',)}
        o.location = mid['pos']; o.location.z += 0.05
        o.rotation_euler = ((a[n]['rotX'] + b[n]['rotX']) / 2, 0, 0)
        o.keyframe_insert('location', frame=FR // 2 + 1); o.keyframe_insert('rotation_euler', frame=FR // 2 + 1)
        tr = o.animation_data.nla_tracks.new(); tr.name = name
        tr.strips.new(name, 1, act)
        o.animation_data.action = None
clip('drive_to_fly', DRIVE, FLY)
clip('fly_to_drive', FLY, DRIVE)
for n, d in DRIVE.items():
    parts[n].location = d['pos']; parts[n].rotation_euler = (0, 0, 0)

spec = {
    'frame': 'Chassis mesh frame used by Car.js (+X forward, Z up, origin = physics chassis centre; Car.js adds chassis.offset z -0.28).',
    'durationSeconds': FR / FPS,
    'easing': 'easeInOutCubic; pods rise 0.05 m extra at the midpoint',
    'wheels': {n: {'drive': DRIVE[n], 'fly': FLY[n]} for n in WHEELS},
    'compose': 'wheel.quaternion = chassis.quaternion * Rx(lerp(drive.rotX, fly.rotX, t)) * spin(axle Y). '
               'Position: in DRIVE use the physics wheel body; in FLY use chassis.matrixWorld * fly.pos; blend by t.',
    'emissive': {'nd_thruster (wheel fan rings + hover_thrusters)': {'drive': 0.0, 'fly': 1.0, 'rampSeconds': 0.5, 'boostMultiplier': 1.6},
                 'hover_brake light bars': 'unchanged (brake input)'},
    'physicsOptions': {'note': 'Recommended Physics.js car.options for this body (was the F1 values).',
                       'chassisWidth': 1.3, 'chassisDepth': 2.35, 'chassisHeight': 0.9, 'chassisOffsetZ': 0.32,
                       'wheelFrontOffsetDepth': 0.72, 'wheelBackOffsetDepth': -0.68, 'wheelOffsetWidth': 0.74,
                       'wheelRadius': 0.25, 'wheelHeight': 0.2},
    'modes': {'drive': 'RaycastVehicle active, pods are wheels, fan glow off, tyres spin from physics.',
              'fly': 'RaycastVehicle removed, pods folded fan-down, glow on, no spin (or slow fan spin around local Y).'},
    'cockpit': {
        'reference': 'cyberpunk inspo vids/Screenshot_20261008-182511.png',
        'eye': {'meshFrame': [-0.05, 0.0, 0.92], 'bodyFrameZ': 0.64, 'pitchDeg': -6, 'fovDeg': 75, 'near': 0.05,
                'note': 'Explorer.updateCamera uses p.z + 0.85 for the car: change it to + 0.64 and x - 0.05 along the heading for this cabin.'},
        'slots': {
            'nd_dash': {'size_m': [1.0, 0.155], 'aspect': 6.45, 'canvas': [1024, 160], 'uv': '0..1, u left->right as seen by the driver, v bottom->top',
                        'content': 'Live CanvasTexture each frame: left = speed (km/h, from physics.car.speed) + AUTOPILOT/MODE; mid-left = MODE DRIVE|FLIGHT, ALT m, LANE, BOOST; '
                                   'centre = circular minimap (reuse Minimap.js projection/draw into this canvas); right = NEXT STOP arrow + distance + destination name (guided tour target or nearest project).',
                        'mock': 'textures/dash_mock.png', 'updateHz': 15},
            'nd_mirror': {'size_m': [0.13, 0.04], 'content': 'Optional low-res rear camera render target (128 x 40) on High/Ultra; static dark gradient on Medium/Low.'},
            'nd_hud': {'size_m': [0.28, 0.055], 'content': 'Additive, transparent windscreen HUD: speed + heading tick. Fades out when not in first person.'},
            'nd_glass': 'Canopy: transparent (opacity ~0.18), depthWrite false, render after opaque, double-sided OFF.'},
        'interior': 'Inward-facing tub, centred seat, tan leather door cards, bronze bezel + pillars, yoke with cyan strip, right-hand armrest.'},
    'glb': {'parts': 'hover-chassis/-wheel/-brake/-reverse/-antenna/-thrusters.glb (Car.js resource keys)',
            'assembled': 'hover-car-assembled.glb (preview, garage, tour ghost; animations drive_to_fly / fly_to_drive)'},
}
json.dump(spec, open(os.path.join(OUT, 'hover-car.json'), 'w'), indent=1)
print('assembled', [o.name for o in AS.objects])
