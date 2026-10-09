"""Step 9: export every GLB to static/models/cyber/ and save the editable .blend."""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

def at_origin(objs):
    saved = [(o, tuple(o.location)) for o in objs]
    for o in objs:
        o.location = (0, 0, 0)
    return saved
def restore(saved):
    for o, loc in saved:
        o.location = loc

sizes = {}
def ex(name, objs, **kw):
    path, size = export_glb(name, objs, **kw)
    sizes[name + '.glb'] = size

kit = [o for o in bpy.data.collections['KIT'].objects if o.get('nd_module')]
s = at_origin(kit); ex('city-kit', kit); restore(s)

car = {o.name: o for o in bpy.data.collections['CAR'].objects}
for part in ('chassis', 'wheel', 'brake', 'reverse', 'antenna', 'thrusters'):
    o = car['hover_' + part]
    s = at_origin([o]); ex('hover-' + part, [o]); restore(s)

root = bpy.data.objects['hover_car']
s = at_origin([root]); ex('hover-car-assembled', [root], animations=True, anim_mode='NLA_TRACKS'); restore(s)

traffic = list(bpy.data.collections['TRAFFIC'].objects)
s = at_origin(traffic); ex('traffic', traffic); restore(s)

arm = bpy.data.objects['player_rig']
arm.animation_data.action = None
s = at_origin([arm]); ex('player', [arm], animations=True, skins=True, anim_mode='NLA_TRACKS'); restore(s)

npc_arm = bpy.data.objects['npc_rig']; npc = bpy.data.objects['npc_body']
s = at_origin([npc_arm])
npc.modifiers['Armature'].show_viewport = False; npc.modifiers['Armature'].show_render = False
ex('npc', [npc])
npc.modifiers['Armature'].show_viewport = True; npc.modifiers['Armature'].show_render = True
restore(s)

interior = [o for o in bpy.data.collections['INTERIOR'].objects]
s = at_origin(interior); ex('apartment-interior', interior); restore(s)

mg = [o for o in bpy.data.collections['MINIGAMES'].objects]
s = at_origin(mg); ex('minigames', mg); restore(s)

for n in ('hoverboard', 'skateboard'):
    o = bpy.data.objects[n]
    s = at_origin([o]); ex(n, [o]); restore(s)

blend = os.path.join(ROOT, 'assets/blender/neon-district.blend')
bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True, compress=True)
sizes['neon-district.blend'] = os.path.getsize(blend)
print(json.dumps(sizes, indent=1))
