"""Step 6: player (skinned + actions) and NPC crowd (vertex animation texture).

Faces +Y like the old createPerson() box rig; origin between the feet; 1.78 m tall.
Rigid skinning: every part is weighted 100% to one bone (cheap, no candy-wrapping).
Variant parts use the VARIANT BLOCK of the atlas, so a per-instance u offset of
variant * 64/1024 recolours jacket, pants, skin and hair at once (see manifest).
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import numpy as np

CH = collection('CHARACTERS')
FPS = 30

BONES = {  # name: (head, tail, parent)
    'root': ((0, 0, 0), (0, 0.2, 0), None),
    'hips': ((0, 0, 0.94), (0, 0, 1.06), 'root'),
    'spine': ((0, 0, 1.06), (0, 0, 1.24), 'hips'),
    'chest': ((0, 0, 1.24), (0, 0, 1.46), 'spine'),
    'head': ((0, 0, 1.48), (0, 0, 1.76), 'chest'),
    'upper_arm.L': ((0.25, 0, 1.42), (0.27, 0, 1.14), 'chest'),
    'forearm.L': ((0.27, 0, 1.14), (0.28, 0.02, 0.88), 'upper_arm.L'),
    'upper_arm.R': ((-0.25, 0, 1.42), (-0.27, 0, 1.14), 'chest'),
    'forearm.R': ((-0.27, 0, 1.14), (-0.28, 0.02, 0.88), 'upper_arm.R'),
    'thigh.L': ((0.1, 0, 0.92), (0.1, 0.01, 0.5), 'hips'),
    'shin.L': ((0.1, 0.01, 0.5), (0.1, 0, 0.1), 'thigh.L'),
    'foot.L': ((0.1, 0, 0.1), (0.1, 0.16, 0.03), 'shin.L'),
    'thigh.R': ((-0.1, 0, 0.92), (-0.1, 0.01, 0.5), 'hips'),
    'shin.R': ((-0.1, 0.01, 0.5), (-0.1, 0, 0.1), 'thigh.R'),
    'foot.R': ((-0.1, 0, 0.1), (-0.1, 0.16, 0.03), 'shin.R'),
}

def body(detail=1):
    """Returns {bone: MB}."""
    s = 8 if detail else 6
    parts = {b: MB() for b in BONES}
    P = parts
    # pelvis + belt
    P['hips'].box((0, 0, 0.95), (0.34, 0.21, 0.2), 'var_pants')
    P['hips'].box((0, 0.002, 1.04), (0.35, 0.22, 0.04), 'trim_black')
    # torso: tapered jacket (loft of 3 rings)
    def ring(z, w, d):
        return [(w * math.cos(i * math.tau / s + math.pi / s), d * math.sin(i * math.tau / s + math.pi / s), z) for i in range(s)]
    rs = [ring(1.04, 0.19, 0.12), ring(1.24, 0.2, 0.13), ring(1.44, 0.23, 0.13)]
    for a, b, bone in ((rs[0], rs[1], 'spine'), (rs[1], rs[2], 'chest')):
        for i in range(s):
            j = (i + 1) % s
            P[bone].quad(a[i], a[j], b[j], b[i], 'var_jacket')
    P['chest'].face(rs[2], 'var_jacket')
    P['chest'].box((0, 0, 1.47), (0.36, 0.18, 0.06), 'var_jacket')                    # shoulders
    P['chest'].box((0, 0.125, 1.3), (0.03, 0.02, 0.28), 'trim_black')                   # zip
    if detail:
        P['chest'].box((0.07, 0.13, 1.36), (0.08, 0.01, 0.015), 'neon_cyan')            # chest light
        P['chest'].box((0, -0.19, 1.27), (0.28, 0.12, 0.34), 'bag_olive')               # backpack
        P['chest'].box((0, -0.255, 1.3), (0.16, 0.01, 0.02), 'neon_cyan')
    # hood collar + head
    P['chest'].cyl((0, -0.03, 1.46), (0, -0.05, 1.56), 0.13, 'var_jacket', sides=s, top=0.15)
    P['head'].box((0, 0.01, 1.62), (0.22, 0.24, 0.26), 'var_skin')
    P['head'].box((0, -0.01, 1.765), (0.235, 0.26, 0.05), 'var_hair')
    P['head'].box((0, -0.12, 1.68), (0.235, 0.04, 0.18), 'var_hair')
    P['head'].box((0, 0.125, 1.65), (0.24, 0.03, 0.06), 'visor')
    if detail:
        P['head'].box((0, -0.04, 1.6), (0.27, 0.22, 0.3), 'var_jacket', skip=('py', 'nz'))  # hood shell
    # arms
    for side, sx in (('L', 1), ('R', -1)):
        P['upper_arm.' + side].cyl((0.255 * sx, 0, 1.44), (0.27 * sx, 0, 1.13), 0.065, 'var_jacket', sides=s, top=0.058)
        P['forearm.' + side].cyl((0.27 * sx, 0, 1.14), (0.28 * sx, 0.02, 0.9), 0.056, 'var_jacket', sides=s, top=0.048)
        P['forearm.' + side].box((0.28 * sx, 0.025, 0.84), (0.07, 0.08, 0.11), 'glove_black')
        if detail:
            P['forearm.' + side].cyl((0.272 * sx, 0.005, 1.0), (0.274 * sx, 0.008, 1.03), 0.058, 'neon_cyan' if side == 'L' else 'var_jacket', sides=s, caps=False)
        P['thigh.' + side].cyl((0.1 * sx, 0, 0.93), (0.1 * sx, 0.01, 0.5), 0.085, 'var_pants', sides=s, top=0.07)
        P['shin.' + side].cyl((0.1 * sx, 0.01, 0.5), (0.1 * sx, 0, 0.12), 0.068, 'var_pants', sides=s, top=0.06)
        P['foot.' + side].box((0.1 * sx, 0.04, 0.06), (0.12, 0.27, 0.12), 'boot_black')
        P['foot.' + side].box((0.1 * sx, 0.04, 0.005), (0.125, 0.275, 0.02), 'neon_cyan' if detail else 'rubber')
    return parts

def assemble(name, parts, arm):
    mb = MB()
    groups = []
    for bone, p in parts.items():
        for slot, (v, f, uv) in p.parts.items():
            dst = mb._p(slot)
            base = len(dst[0])
            dst[0].extend(v); dst[2].extend(uv)
            dst[1].extend(tuple(i + base for i in face) for face in f)
            groups.append((slot, bone, base, len(v)))
    ob = mb.build(name, CH, ao_dist=0.25, ao_samples=12)
    # vertex groups: rebuild index ranges in build order (slots concatenated in dict order)
    offsets, acc = {}, 0
    for slot, (v, f, uv) in mb.parts.items():
        offsets[slot] = acc; acc += len(v)
    for b in BONES:
        ob.vertex_groups.new(name=b)
    for slot, bone, base, n in groups:
        idx = list(range(offsets[slot] + base, offsets[slot] + base + n))
        ob.vertex_groups[bone].add(idx, 1.0, 'REPLACE')
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    ob.parent = arm
    return ob

def armature(name):
    ad = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, ad)
    CH.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for bname, (h, t, parent) in BONES.items():
        eb = ad.edit_bones.new(bname)
        eb.head, eb.tail = h, t
        eb.roll = 0
        if parent:
            eb.parent = ad.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm

# ------------------------------------------------------------------ animation
R = math.radians
def pose_fn(clip, t):
    """t in [0,1). Returns {bone: (rx, ry, rz)} local euler radians, plus root z offset."""
    s, c = math.sin(t * math.tau), math.cos(t * math.tau)
    p = {}
    if clip == 'idle':
        p['chest'] = (R(2) * s, 0, 0); p['head'] = (R(-2) * s, 0, R(6) * math.sin(t * math.tau * 0.5))
        p['upper_arm.L'] = (0, 0, R(4) + R(1) * s); p['upper_arm.R'] = (0, 0, R(-4) - R(1) * s)
        p['forearm.L'] = (R(-8), 0, 0); p['forearm.R'] = (R(-8), 0, 0)
        return p, 0.004 * s
    if clip in ('walk', 'run'):
        k = 1.0 if clip == 'walk' else 1.7
        p['thigh.L'] = (R(28) * k * s, 0, 0); p['thigh.R'] = (-R(28) * k * s, 0, 0)
        p['shin.L'] = (-R(30) * k * max(0, -c), 0, 0); p['shin.R'] = (-R(30) * k * max(0, c), 0, 0)
        p['foot.L'] = (R(10) * s, 0, 0); p['foot.R'] = (-R(10) * s, 0, 0)
        p['upper_arm.L'] = (-R(22) * k * s, 0, R(5)); p['upper_arm.R'] = (R(22) * k * s, 0, R(-5))
        p['forearm.L'] = (R(-15) * k, 0, 0); p['forearm.R'] = (R(-15) * k, 0, 0)
        p['spine'] = (R(4) * (k - 1) * 3, R(3) * s, 0); p['hips'] = (0, R(-4) * s, R(5) * s)
        return p, 0.03 * k * abs(math.sin(t * math.tau * 2)) - 0.015 * k
    if clip == 'skate':
        p['hips'] = (0, 0, R(70)); p['chest'] = (R(8), 0, R(-55)); p['head'] = (0, 0, R(-20))
        p['thigh.L'] = (R(-30), 0, R(-8)); p['thigh.R'] = (R(-30), 0, R(8))
        p['shin.L'] = (R(45), 0, 0); p['shin.R'] = (R(45), 0, 0)
        p['upper_arm.L'] = (0, 0, R(35) + R(5) * s); p['upper_arm.R'] = (0, 0, R(-35) - R(5) * s)
        return p, -0.08 + 0.015 * s
    if clip == 'wave':
        p['upper_arm.R'] = (0, 0, R(-150)); p['forearm.R'] = (0, 0, R(-20) + R(25) * s)
        p['head'] = (0, 0, R(-10)); p['chest'] = (R(2) * s, 0, 0)
        return p, 0
    if clip == 'talk':
        p['upper_arm.L'] = (R(-20) - R(10) * s, 0, R(8)); p['forearm.L'] = (R(-50) - R(15) * s, 0, 0)
        p['upper_arm.R'] = (R(-10) + R(8) * c, 0, R(-6)); p['forearm.R'] = (R(-35), 0, 0)
        p['head'] = (R(4) * c, 0, R(8) * s); p['chest'] = (R(2) * s, 0, R(3) * c)
        return p, 0
    if clip == 'enter_car':
        k = math.sin(min(t, 1) * math.pi)
        p['thigh.L'] = (R(-60) * k, 0, 0); p['thigh.R'] = (R(-60) * k, 0, 0)
        p['shin.L'] = (R(80) * k, 0, 0); p['shin.R'] = (R(80) * k, 0, 0)
        p['spine'] = (R(25) * k, 0, 0)
        return p, -0.3 * k
    return p, 0

CLIPS = {'idle': (60, True), 'walk': (24, True), 'run': (18, True), 'skate': (40, True),
         'wave': (40, True), 'talk': (60, True), 'enter_car': (20, False)}

def apply_pose(arm, clip, t):
    p, dz = pose_fn(clip, t)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = p.get(pb.name, (0, 0, 0))
        pb.location = (0, 0, 0)
    arm.pose.bones['root'].location = (0, 0, 0)
    arm.pose.bones['hips'].location = (0, dz, 0)   # hips bone Y axis = world Z

def bake_actions(arm, clips):
    arm.animation_data_create()
    for clip in clips:
        frames, loop = CLIPS[clip]
        act = bpy.data.actions.get(clip)
        if act:
            bpy.data.actions.remove(act)
        act = bpy.data.actions.new(clip)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f in range(frames + (1 if loop else 0)):
            apply_pose(arm, clip, f / frames)
            for pb in arm.pose.bones:
                pb.keyframe_insert('rotation_euler', frame=f + 1)
                if pb.name == 'hips':
                    pb.keyframe_insert('location', frame=f + 1)
        tr = arm.animation_data.nla_tracks.new(); tr.name = clip
        st = tr.strips.new(clip, 1, act)
        tr.mute = True
        arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)

# ------------------------------------------------------------------ player
arm_p = armature('player_rig')
player = assemble('player_body', body(1), arm_p)
bake_actions(arm_p, ['idle', 'walk', 'run', 'skate', 'wave', 'enter_car'])
arm_p.location = (-6, -20, 0)

# ------------------------------------------------------------------ NPC (VAT)
arm_n = armature('npc_rig')
npc = assemble('npc_body', body(0), arm_n)
arm_n.location = (-4, -20, 0)
me = npc.data
V = len(me.vertices)
uv1 = me.uv_layers.new(name='VAT')
for poly in me.polygons:
    for li in poly.loop_indices:
        vi = me.loops[li].vertex_index
        uv1.data[li].uv = ((vi + 0.5) / V, 0.5)
me.uv_layers.active_index = 0
try:
    me.uv_layers[0].active_render = True
except Exception:
    pass
rows = []
clip_rows = {}
sc = scene()
for clip in ('idle', 'walk', 'talk'):
    frames, loop = CLIPS[clip]
    clip_rows[clip] = {'row': len(rows), 'frames': frames, 'fps': FPS, 'loop': loop}
    for f in range(frames):
        apply_pose(arm_n, clip, f / frames)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = npc.evaluated_get(dg)
        m = ev.to_mesh()
        arr = np.empty(V * 3, np.float32); m.vertices.foreach_get('co', arr)
        ev.to_mesh_clear()
        rows.append(arr.reshape(V, 3))
apply_pose(arm_n, 'idle', 0)
for pb in arm_n.pose.bones:
    pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
vat = np.stack(rows)                      # F x V x 3, object space (armature at origin offset removed below)
vat -= np.array(arm_n.location, np.float32) * 0  # evaluated mesh coords are object-local already
lo, hi = vat.min(axis=(0, 1)), vat.max(axis=(0, 1))
norm = (vat - lo) / (hi - lo)
F = vat.shape[0]
img = np.ones((F, V, 4), np.float32); img[..., :3] = norm
name = 'npc_vat.png'
old = bpy.data.images.get(name)
if old:
    bpy.data.images.remove(old)
im = bpy.data.images.new(name, V, F, alpha=False)
im.colorspace_settings.name = 'Non-Color'
im.pixels.foreach_set(img.ravel())                 # row 0 = first frame (bottom row in Blender = top after PNG flip is handled below)
im.filepath_raw = os.path.join(TEX, name); im.file_format = 'PNG'; im.save()
VAT_META = {'texture': 'textures/npc_vat.png', 'vertices': V, 'frames': F, 'boundsMin': [round(float(x), 5) for x in lo],
            'boundsMax': [round(float(x), 5) for x in hi], 'clips': clip_rows,
            'lookup': 'u = TEXCOORD_1.x; v = (row + 0.5) / frames (Blender pixel row 0 is the bottom row of the PNG; three.js flipY=false => v measured from the top: use v = 1 - (row + 0.5)/frames, or load with flipY=true and use (row+0.5)/frames).',
            'decode': 'position = boundsMin + rgb * (boundsMax - boundsMin); flat shading via dFdx/dFdy.'}
import json
json.dump(VAT_META, open(os.path.join(OUT, 'npc-vat.json'), 'w'), indent=1)
print('player tris', tri_count(player), 'npc tris', tri_count(npc), 'npc verts', V, 'vat', V, 'x', F)
