"""Step 10: dashboard display design mock (textures/dash_mock.png, 1024 x 176).

NOT the runtime texture: the dash ('nd_dash' slot, uv 0..1) is a live CanvasTexture drawn
by the game every frame (speed, mode, altitude, minimap, next stop). This PNG is the layout
target, after the reference 'cyberpunk inspo vids/Screenshot_20261008-182511.png'.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
W, H = 1024, 176
prev = bpy.context.window.scene
rs = bpy.data.scenes.get('DASH_RENDER') or bpy.data.scenes.new('DASH_RENDER')
for o in list(rs.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.window.scene = rs
rs.render.engine = 'BLENDER_EEVEE'; rs.render.resolution_x, rs.render.resolution_y = W, H
rs.render.resolution_percentage = 100; rs.view_settings.view_transform = 'Standard'
rs.world = bpy.data.worlds.get('SIGN_BLACK')
cam = bpy.data.objects.new('dash_cam', bpy.data.cameras.new('dash_cam')); rs.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = W / 100; cam.location = (W / 200, H / 200, 10); rs.camera = cam
font = bpy.data.fonts.load('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', check_existing=True)
mono = bpy.data.fonts.load('/usr/share/fonts/truetype/noto/NotoSansMono-Light.ttf', check_existing=True) if os.path.exists('/usr/share/fonts/truetype/noto/NotoSansMono-Light.ttf') else font

def emit(hex_c, s=1.0):
    m = bpy.data.materials.new('dm'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    rgb = hex_rgb(hex_c); e.inputs[0].default_value = (*[c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb], 1)
    e.inputs[1].default_value = s; nt.links.new(e.outputs[0], o.inputs[0]); return m
def rect(x, y, w, h, c, z=0):
    me = bpy.data.meshes.new('r'); me.from_pydata([(x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z)], [], [(0, 1, 2, 3)])
    me.materials.append(emit(c)); o = bpy.data.objects.new('r', me); rs.collection.objects.link(o)
def disc(cx, cy, r, c, z=0.05, ring=None):
    n = 40; vs = [(cx + r * math.cos(i * math.tau / n), cy + r * math.sin(i * math.tau / n), z) for i in range(n)]
    me = bpy.data.meshes.new('d'); me.from_pydata(vs, [], [tuple(range(n))]); me.materials.append(emit(c))
    o = bpy.data.objects.new('d', me); rs.collection.objects.link(o)
def text(t, x, y, size, c, f=None, align='LEFT'):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = t; cu.font = f or font; cu.size = size; cu.align_x = align
    cu.materials.append(emit(c)); o = bpy.data.objects.new('t', cu); o.location = (x, y, 0.2); rs.collection.objects.link(o)
P = 0.01  # px -> units
rect(0, 0, W * P, H * P, '#05080b')
rect(0.06, 0.06, W * P - 0.12, 0.03, '#7a5a35'); rect(0.06, H * P - 0.09, W * P - 0.12, 0.03, '#7a5a35')
text('AUTOPILOT', 0.4, 1.3, 0.2, '#8a96a0', mono)
text('ASSISTED', 0.4, 1.02, 0.28, '#ffb02e')
text('101', 0.36, 0.2, 1.05, '#f2f6ff')
text('km/h', 1.72, 0.26, 0.2, '#8a96a0', mono)
text('MODE  FLIGHT', 2.6, 1.3, 0.17, '#22e5ff', mono)
text('ALT  34 m', 2.6, 1.02, 0.17, '#f2f6ff', mono)
text('LANE  3', 2.6, 0.74, 0.17, '#f2f6ff', mono)
text('BOOST 75%', 2.6, 0.46, 0.17, '#ff2bd6', mono)
# minimap (the live game reuses Minimap.js drawing here)
disc(5.12, 0.88, 0.74, '#0b1a22'); disc(5.12, 0.88, 0.7, '#05080b', z=0.06)
rect(4.5, 0.82, 1.24, 0.1, '#1f5a5c', 0.07); rect(5.07, 0.2, 0.1, 1.36, '#1f5a5c', 0.07)
rect(5.5, 0.45, 0.08, 0.5, '#1f5a5c', 0.07)
disc(5.65, 1.2, 0.06, '#ff2bd6', z=0.08); disc(4.7, 0.6, 0.05, '#ffb02e', z=0.08)
text('▲', 5.12, 0.8, 0.22, '#22e5ff', align='CENTER')
text('NEXT STOP', 7.0, 1.3, 0.14, '#8a96a0', mono)
rect(7.12, 0.4, 0.09, 0.62, '#f2f6ff', 0.1); rect(7.12, 0.93, 0.36, 0.09, '#f2f6ff', 0.1)
me = bpy.data.meshes.new('arw'); me.from_pydata([(7.46, 0.83, 0.1), (7.62, 0.975, 0.1), (7.46, 1.12, 0.1)], [], [(0, 1, 2)]); me.materials.append(emit('#f2f6ff'))
o = bpy.data.objects.new('arw', me); rs.collection.objects.link(o)
text('120 m', 7.8, 0.98, 0.3, '#f2f6ff')
text('PROJECT AVE · AGENT LAB', 7.8, 0.7, 0.15, '#8a96a0', mono)
text('3 cars within 100 m', 7.8, 0.46, 0.13, '#8a96a0', mono)
rs.render.filepath = os.path.join(TEX, 'dash_mock.png'); rs.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True, scene=rs.name)
bpy.context.window.scene = prev
for m in list(bpy.data.materials):
    if m.name.startswith('dm') and m.users == 0:
        bpy.data.materials.remove(m)
print('dash mock', os.path.getsize(rs.render.filepath))
