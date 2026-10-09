"""Step 7: neon sign atlas -> textures/signs_color.png (+ signs_halo.png) + signs-atlas.json

Rendered orthographically from a throwaway scene (1 unit = 100 px). All shop names are
invented; no real brands. CJK glyphs come from Noto Sans CJK (OFL) and are baked into
the texture, so no CJK font ships to the browser.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json
import numpy as np

FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
PX = 1024
NEON = {'magenta': '#ff2bd6', 'cyan': '#22e5ff', 'acid': '#9dff3a', 'amber': '#ffb02e', 'red': '#ff2a2a',
        'violet': '#a77bff', 'white': '#f2f6ff', 'blue': '#58b6ff'}

designs = []
def add(kind, rect, text, color, sub=None, frame=None, vertical=False):
    designs.append({'id': len(designs), 'kind': kind, 'px': rect, 'text': text, 'sub': sub, 'color': color,
                    'frame': frame or color, 'vertical': vertical})

# blades: 10 x (96 x 256) along the top
for i, (t, c) in enumerate([('拉麺', 'magenta'), ('薬局', 'acid'), ('ホテル', 'cyan'), ('電脳', 'violet'), ('酒場', 'amber'),
                            ('義体', 'red'), ('修理', 'amber'), ('夜市', 'magenta'), ('占い', 'violet'), ('カラオケ', 'cyan')]):
    add('blade', (i * 100 + 12, 768, 88, 256), t, c, vertical=True)
# boxes: 8 x (248 x 88)
for i, (t, sub, c) in enumerate([('NOODLES', '24H · 拉麺', 'amber'), ('CAPSULE HOTEL', 'カプセル', 'cyan'), ('IMPLANTS', '義体クリニック', 'magenta'),
                                 ('PHARMACY +', '薬', 'acid'), ('NIGHT MARKET', '夜市', 'amber'), ('REPAIR / PARTS', '修理', 'blue'),
                                 ('BAR · OPEN', '酒', 'red'), ('DATA CAFE', '電脳喫茶', 'violet')]):
    add('box', ((i % 4) * 256 + 4, 668 - (i // 4) * 96, 248, 88), t, c, sub=sub)
# ads: 8 x (248 x 140)
for i, (t, sub, c, f) in enumerate([('NEURAL LINK', 'THINK FASTER', 'cyan', 'magenta'), ('SYNTH NOODLE', '本物の味', 'amber', 'red'),
                                    ('LANE 3 ↑', 'FLY SAFE', 'acid', 'acid'), ('AIRSPACE', 'RESTRICTED', 'red', 'red'),
                                    ('HYDRO 水', 'CLEAN WATER', 'blue', 'cyan'), ('VOLT BAR', 'OPEN LATE', 'magenta', 'violet'),
                                    ('ORBIT AIR', 'SKY TAXI 24H', 'cyan', 'blue'), ('KAIJU ARCADE', 'ゲーム', 'violet', 'magenta')]):
    add('ad', ((i % 4) * 256 + 4, 420 - (i // 4) * 148, 248, 140), t, c, sub=sub, frame=f)
# name sign (8 : 4.5) bottom-left
add('name', (4, 4, 504, 268), 'RICHARD SIMMONS', 'cyan', sub='AI ENGINEER', frame='magenta')
# two extra ads bottom-right
for i, (t, sub, c, f) in enumerate([('NEON DISTRICT', 'WELCOME', 'magenta', 'cyan'), ('SEE THE WORK', 'PROJECT AVE →', 'amber', 'amber')]):
    add('ad', (516 + i * 254, 132, 248, 140), t, c, sub=sub, frame=f)

# ------------------------------------------------------------------ render scene
prev_scene = bpy.context.window.scene
rs = bpy.data.scenes.get('SIGN_RENDER') or bpy.data.scenes.new('SIGN_RENDER')
for o in list(rs.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.window.scene = rs
rs.render.engine = 'BLENDER_EEVEE'
rs.render.resolution_x = rs.render.resolution_y = PX
rs.render.resolution_percentage = 100
rs.render.film_transparent = False
rs.eevee.taa_render_samples = 16
rs.view_settings.view_transform = 'Standard'
rs.display_settings.display_device = 'sRGB'
w = bpy.data.worlds.get('SIGN_BLACK') or bpy.data.worlds.new('SIGN_BLACK'); w.use_nodes = True
next(n for n in w.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (0, 0, 0, 1)
rs.world = w
cam = bpy.data.objects.new('sign_cam', bpy.data.cameras.new('sign_cam')); rs.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = PX / 100
cam.location = (PX / 200, PX / 200, 10); rs.camera = cam

font = bpy.data.fonts.load(FONT, check_existing=True)
def emit(name, hex_c, strength=1.0):
    m = bpy.data.materials.get('sg_' + name)
    if m:
        return m
    m = bpy.data.materials.new('sg_' + name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    rgb = hex_rgb(hex_c); lin = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
    e.inputs[0].default_value = (*lin, 1); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0])
    return m

def plane(x, y, w, h, z, mat):
    me = bpy.data.meshes.new('sg_plane')
    me.from_pydata([(x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z)], [], [(0, 1, 2, 3)])
    me.materials.append(mat)
    ob = bpy.data.objects.new('sg_plane', me); rs.collection.objects.link(ob)
    return ob

def text(body, x, y, w, h, mat, size=1.0):
    cu = bpy.data.curves.new('sg_text', 'FONT'); cu.body = body; cu.font = font
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.size = size
    cu.space_line = 0.95
    ob = bpy.data.objects.new('sg_text', cu); rs.collection.objects.link(ob)
    cu.materials.append(mat)
    ob.location = (x + w / 2, y + h / 2, 0.2)
    bpy.context.view_layer.update()
    dx, dy = ob.dimensions.x, ob.dimensions.y
    s = min(w / max(dx, 1e-3), h / max(dy, 1e-3))
    ob.scale = (s, s, 1)
    return ob

for d in designs:
    x, y, w, h = (v / 100 for v in d['px'])
    col = NEON[d['color']]; fr = NEON[d['frame']]
    plane(x, y, w, h, 0, emit('back', '#07080b'))
    t = 0.04 if d['kind'] in ('blade', 'box') else 0.05
    for (px, py, pw, ph) in ((x + 0.04, y + 0.04, w - 0.08, t), (x + 0.04, y + h - 0.04 - t, w - 0.08, t),
                             (x + 0.04, y + 0.04, t, h - 0.08), (x + w - 0.04 - t, y + 0.04, t, h - 0.08)):
        plane(px, py, pw, ph, 0.1, emit(d['frame'], fr))
    pad = 0.14
    if d['vertical']:
        text('\n'.join(d['text']), x + pad, y + pad, w - 2 * pad, h - 2 * pad, emit(d['color'], col))
    elif d['sub']:
        split = 0.62 if d['kind'] != 'name' else 0.58
        text(d['text'], x + pad, y + h * (1 - split), w - 2 * pad, h * split - pad, emit(d['color'], col))
        if d['kind'] == 'name':
            text(d['sub'], x + w * 0.22, y + pad * 1.5, w * 0.56, h * 0.22, emit(d['frame'] + '_sub', NEON[d['frame']], 0.85))
        else:
            text(d['sub'], x + pad * 1.6, y + pad, w - 3.2 * pad, h * (1 - split) - pad * 0.6, emit(d['frame'] + '_sub', NEON[d['frame']], 0.85))
    else:
        text(d['text'], x + pad, y + pad, w - 2 * pad, h - 2 * pad, emit(d['color'], col))

path = os.path.join(TEX, 'signs_color.png')
rs.render.filepath = path
rs.render.image_settings.file_format = 'PNG'
rs.render.image_settings.color_mode = 'RGB'
bpy.ops.render.render(write_still=True, scene=rs.name)

# halo: blurred copy for the Low tier (no bloom); additive in the shader
img = bpy.data.images.load(path, check_existing=False)
a = np.array(img.pixels[:], np.float32).reshape(PX, PX, 4)[..., :3]
bpy.data.images.remove(img)
def blur(a, r):
    k = np.exp(-0.5 * (np.arange(-3 * r, 3 * r + 1) / r) ** 2); k /= k.sum()
    for ax in (0, 1):
        a = np.apply_along_axis(lambda v: np.convolve(v, k, mode='same'), ax, a)
    return a
small = a[::4, ::4]
h = np.clip(blur(small, 3) * 1.6, 0, 1)
hi = np.repeat(np.repeat(h, 4, 0), 4, 1)
him = bpy.data.images.new('signs_halo.png', PX, PX, alpha=False)
rgba = np.ones((PX, PX, 4), np.float32); rgba[..., :3] = hi
him.pixels.foreach_set(rgba.ravel()); him.filepath_raw = os.path.join(TEX, 'signs_halo.png'); him.file_format = 'PNG'; him.save()
bpy.data.images.remove(him)

meta = []
for d in designs:
    x, y, w, h = d['px']
    meta.append({'id': d['id'], 'kind': d['kind'], 'text': d['text'], 'sub': d['sub'], 'color': NEON[d['color']],
                 'uv': [round(x / PX, 5), round(y / PX, 5), round((x + w) / PX, 5), round((y + h) / PX, 5)],
                 'aspect': round(w / h, 4)})
json.dump({'texture': 'textures/signs_color.png', 'halo': 'textures/signs_halo.png',
           'uvNote': 'uv = [u0, v0, u1, v1] with v up from the bottom (three.js TextureLoader default flipY = true).',
           'designs': meta}, open(os.path.join(OUT, 'signs-atlas.json'), 'w'), indent=1)
bpy.context.window.scene = prev_scene
print('signs', len(designs), os.path.getsize(path))
