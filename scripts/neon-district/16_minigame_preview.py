"""Step 16 (preview only): assemble arenas, Packet Run props and the Beat Tunnel rings
from minigames.json as linked duplicates in MG_PREVIEW. Not exported."""
import bpy, json, math
from mathutils import Vector

sc = bpy.data.scenes['Neon District']; bpy.context.window.scene = sc
M = json.load(open('/mnt/sdcard/Github/threejs-portfolio/static/models/cyber/minigames.json'))
col = bpy.data.collections.get('MG_PREVIEW')
if col:
    for o in list(col.objects):
        bpy.data.objects.remove(o, do_unlink=True)
else:
    col = bpy.data.collections.new('MG_PREVIEW'); sc.collection.children.link(col)

def dup(name, loc, rot=(0, 0, 0), s=1.0):
    src = bpy.data.objects[name]
    o = bpy.data.objects.new('pvmg_' + name, src.data); o.location = loc; o.rotation_euler = rot; o.scale = (s, s, s)
    col.objects.link(o); return o

for key, a in M['arenas'].items():
    ox, oy, oz = a['origin']
    dup(a['shell'], (ox, oy, oz))
    for name, lst in a['place'].items():
        for e in lst:
            x, y, z, r = (list(e) + [0, 0, 0, 0])[:4]
            dup(name, (ox + x, oy + y, oz + z), (0, 0, r))
ox, oy, _ = M['arenas']['triage']['origin']
for i in range(6):
    dup('mg_doc_folder' if i % 2 == 0 else 'mg_toolcall_pod', (ox, oy + 5.5 - i * 1.7, 0.92))
ox, oy, _ = M['arenas']['signal_noise']['origin']
for i, (x, y, z) in enumerate(((0, 4.2, 3.0), (-1.2, 1.8, 2.4), (0.9, 0.2, 1.9))):
    dup('mg_post_card', (ox + x, oy + y, z), (0, 0, 0.2 * (i - 1)))
ox, oy, _ = M['arenas']['ship_it']['origin']
for (x, y) in ((-3, 1), (0.5, 0), (3, 2)):
    dup('mg_task_orb', (ox + x, oy + y, 1.0))

# Packet Run: beacons, racks + intake rings, a few packets
for f in M['packetRun']['facilities']:
    dup('mg_facility_beacon', tuple(f['beacon']))
for r in M['packetRun']['racks']:
    dup('mg_rack_tower', tuple(r['roof'])); dup('mg_intake_ring', tuple(r['intakeRing']))
for f in M['packetRun']['facilities'][:4]:
    p = Vector(f['beacon']) + Vector((0, 0, 6))
    dup('mg_packet', tuple(p)); dup('mg_packet_ttl', tuple(p))
# Beat Tunnel rings oriented along the path (ring plane faces local Y)
for r in M['beatTunnel']['rings']:
    fwd = Vector(r['forward'])
    q = fwd.to_track_quat('Y', 'Z')
    o = dup('mg_beat_gate' if r['kind'] == 'gate' else 'mg_beat_ring', tuple(r['p']))
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = q
for o in bpy.data.collections['MINIGAMES'].objects:
    o.hide_set(True); o.hide_render = True
print('mg preview', len(col.objects))
