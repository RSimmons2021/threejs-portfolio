"""Step 4 (optional): linked-duplicate preview of district-layout.json + night render setup.

Not exported. Used to judge the look and to make reference screenshots.
"""
import bpy, json, math
from mathutils import Vector

sc = bpy.data.scenes['Neon District']
prev = bpy.data.collections.get('PREVIEW')
if prev is None:
    prev = bpy.data.collections.new('PREVIEW'); sc.collection.children.link(prev)
for o in list(prev.objects):
    bpy.data.objects.remove(o, do_unlink=True)
src = {o['nd_module']: o for o in bpy.data.collections['KIT'].objects if o.get('nd_lod') == 0}
L = json.load(open('/mnt/sdcard/Github/threejs-portfolio/static/models/cyber/district-layout.json'))
for mod, lst in L['instances'].items():
    for (x, y, z, r, sx, sy, sz) in lst:
        o = bpy.data.objects.new('pv_' + mod, src[mod].data)
        o.location = (x, y, z); o.rotation_euler = (0, 0, r); o.scale = (sx, sy, sz)
        prev.objects.link(o)
me = bpy.data.meshes.new('pv_ground')
me.from_pydata([(-140, -130, 0), (240, -130, 0), (240, 80, 0), (-140, 80, 0)], [], [(0, 1, 2, 3)])
g = bpy.data.objects.new('pv_ground', me); prev.objects.link(g)
gm = bpy.data.materials.get('pv_ground') or bpy.data.materials.new('pv_ground'); gm.use_nodes = True
b = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
b.inputs['Base Color'].default_value = (0.012, 0.013, 0.016, 1); b.inputs['Roughness'].default_value = 0.25
me.materials.append(gm)
for o in bpy.data.collections['KIT'].all_objects:
    o.hide_set(True); o.hide_render = True

def shot(cam_loc, target, lens=22, name='ND Cam'):
    cam = bpy.data.objects.get(name)
    if not cam:
        cam = bpy.data.objects.new(name, bpy.data.cameras.new(name)); sc.collection.objects.link(cam)
    cam.data.lens = lens; cam.data.clip_end = 900
    cam.location = cam_loc
    cam.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
print('preview objects', len(prev.objects))
