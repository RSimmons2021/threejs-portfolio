"""Step 15: card / icon atlas for the mini-games -> textures/minigame_atlas.png + minigame-atlas.json

Everything maps onto 'nd_card' surfaces (uv 0..1 remapped per instance to a rect).
All post text, handles and document names are invented; app icons are original glyphs
for the user's own apps (FocusFi, Lucid). No real logos (stores are written as text).
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

PX = 1024
FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
prev = bpy.context.window.scene
rs = bpy.data.scenes.get('MG_ATLAS') or bpy.data.scenes.new('MG_ATLAS')
for o in list(rs.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.window.scene = rs
rs.render.engine = 'BLENDER_EEVEE'; rs.render.resolution_x = rs.render.resolution_y = PX; rs.render.resolution_percentage = 100
rs.view_settings.view_transform = 'Standard'; rs.world = bpy.data.worlds.get('SIGN_BLACK'); rs.eevee.taa_render_samples = 16
cam = bpy.data.objects.new('mg_cam', bpy.data.cameras.new('mg_cam')); rs.collection.objects.link(cam)
cam.data.type = 'ORTHO'; cam.data.ortho_scale = PX / 100; cam.location = (PX / 200, PX / 200, 10); rs.camera = cam
font = bpy.data.fonts.load(FONT, check_existing=True)
MATS = {}
def emit(h, s=1.0):
    k = (h, s)
    if k in MATS:
        return MATS[k]
    m = bpy.data.materials.new('mga'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    rgb = hex_rgb(h); e.inputs[0].default_value = (*[c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb], 1)
    e.inputs[1].default_value = s; nt.links.new(e.outputs[0], o.inputs[0]); MATS[k] = m; return m
def rect(x, y, w, h, c, z=0.0):
    x, y, w, h = (v / 100 for v in (x, y, w, h))
    me = bpy.data.meshes.new('r'); me.from_pydata([(x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z)], [], [(0, 1, 2, 3)])
    me.materials.append(emit(c)); o = bpy.data.objects.new('r', me); rs.collection.objects.link(o)
def poly(pts, c, z=0.05):
    me = bpy.data.meshes.new('p'); me.from_pydata([(x / 100, y / 100, z) for x, y in pts], [], [tuple(range(len(pts)))])
    me.materials.append(emit(c)); o = bpy.data.objects.new('p', me); rs.collection.objects.link(o)
def disc(cx, cy, r, c, z=0.05, n=32):
    poly([(cx + r * math.cos(i * math.tau / n), cy + r * math.sin(i * math.tau / n)) for i in range(n)], c, z)
def arc(cx, cy, r, a0, a1, w, c, z=0.1, n=16):
    for i in range(n):
        t0, t1 = a0 + (a1 - a0) * i / n, a0 + (a1 - a0) * (i + 1) / n
        p0 = (cx + r * math.cos(t0), cy + r * math.sin(t0)); p1 = (cx + r * math.cos(t1), cy + r * math.sin(t1))
        q0 = (cx + (r - w) * math.cos(t0), cy + (r - w) * math.sin(t0)); q1 = (cx + (r - w) * math.cos(t1), cy + (r - w) * math.sin(t1))
        poly([p0, p1, q1, q0], c, z)
def text(t, x, y, w, h, c, align='LEFT', z=0.2, s=1.0):
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = t; cu.font = font; cu.align_x = align; cu.align_y = 'CENTER'
    cu.materials.append(emit(c, s)); o = bpy.data.objects.new('t', cu); rs.collection.objects.link(o)
    o.location = ((x + (w / 2 if align == 'CENTER' else 0)) / 100, (y + h / 2) / 100, z)
    bpy.context.view_layer.update()
    k = min((w / 100) / max(o.dimensions.x, 1e-3), (h / 100) / max(o.dimensions.y, 1e-3))
    o.scale = (k, k, 1)
def face(cx, cy, r, mood, col):
    disc(cx, cy, r, col, 0.06)
    disc(cx - r * 0.35, cy + r * 0.25, r * 0.12, '#07080b', 0.08); disc(cx + r * 0.35, cy + r * 0.25, r * 0.12, '#07080b', 0.08)
    if mood == 'pos':
        arc(cx, cy - r * 0.05, r * 0.55, math.pi * 1.15, math.pi * 1.85, r * 0.12, '#07080b')
    elif mood == 'neg':
        arc(cx, cy - r * 0.75, r * 0.5, math.pi * 0.2, math.pi * 0.8, r * 0.12, '#07080b')
    else:
        rect(cx - r * 0.4, cy - r * 0.4, r * 0.8, r * 0.12, '#07080b', 0.08)

rects = []
def reg(kind, x, y, w, h, **kw):
    rects.append(dict(kind=kind, uv=[round(x / PX, 5), round(y / PX, 5), round((x + w) / PX, 5), round((y + h) / PX, 5)], **kw))

# ---------------------------------------------------------------- 20 social posts (SIGNAL / NOISE)
POSTS = [  # text, truth, face shown, handle
    ('Fixed the crash. Love this update.', 'positive', 'pos', '@kai.dev'), ('Best study streak ever. 41 days!', 'positive', 'pos', '@mina_reads'),
    ('My track came back in 2 minutes!!', 'positive', 'pos', '@nightowl'), ('This app actually helps me sleep', 'positive', 'pos', '@sleepy.sam'),
    ('Pomodoro + flashcards = A on my exam', 'positive', 'pos', '@jules.k'),
    ('Crashed during my exam prep', 'negative', 'neg', '@tyler_04'), ('Charged twice. Support???', 'negative', 'neg', '@ana.b'),
    ('Waited 6 minutes for one song', 'negative', 'neg', '@drift'), ('Stuck in a login loop again', 'negative', 'neg', '@ozzy'),
    ('Ads everywhere now. Uninstalling.', 'negative', 'neg', '@rae'),
    ('Is there a dark mode?', 'neutral', 'neu', '@lo.fi'), ('Updated to v2.3 this morning', 'neutral', 'neu', '@benji'),
    ('Using it on Android now', 'neutral', 'neu', '@marco.p'), ('How does spaced repetition work?', 'neutral', 'neu', '@curious.cat'),
    ('Switched from paper notes', 'neutral', 'neu', '@dee'),
    ('Love waiting 6 min for a track :)', 'negative', 'pos', '@sarcastic.sue'), ('Great, another login screen.', 'negative', 'pos', '@grumpy.gus'),
    ('Wow, crashed again. Amazing.', 'negative', 'pos', '@meh'), ('Nothing says calm like a paywall', 'negative', 'pos', '@zen.zero'),
    ('So relaxing when it buffers', 'negative', 'pos', '@static'),
]
CW, CH = 200, 124
for i, (t, truth, mood, handle) in enumerate(POSTS):
    x, y = 4 + (i % 5) * 204, 1020 - CH - (i // 5) * 128
    rect(x, y, CW, CH, '#0b1218'); rect(x, y + CH - 4, CW, 4, '#22e5ff', 0.01)
    face(x + 26, y + CH - 30, 17, mood, '#ffd27a')
    text(handle, x + 50, y + CH - 40, 140, 18, '#8a96a0')
    words = t.split(); half = (len(words) + 1) // 2
    text(' '.join(words[:half]), x + 10, y + 42, CW - 20, 22, '#f2f6ff')
    text(' '.join(words[half:]), x + 10, y + 14, CW - 20, 22, '#f2f6ff')
    reg('post', x, y, CW, CH, id='post_%02d' % i, text=t, truth=truth, sarcastic=(mood == 'pos' and truth == 'negative'), handle=handle)

# ---------------------------------------------------------------- 6 legal documents (HANDOFF)
DOCS = [('CONTRACT', 'HIGH', '#ff2a2a'), ('MEDICAL RECORD', 'HIGH', '#ff2a2a'), ('COURT FILING', 'HIGH', '#ff2a2a'),
        ('INVOICE', 'LOW', '#3dff8a'), ('INTAKE FORM', 'LOW', '#3dff8a'), ('ID SCAN', 'MED', '#ffb02e')]
for i, (name, stakes, col) in enumerate(DOCS):
    x, y = 4 + i * 170, 400
    rect(x, y, 164, 100, '#e8e0cc'); rect(x, y + 82, 164, 18, col, 0.01)
    text(name, x + 8, y + 40, 148, 26, '#1b1e22', 'CENTER')
    text('STAKES ' + stakes, x + 8, y + 10, 148, 18, '#4a4d55', 'CENTER')
    for k in range(3):
        rect(x + 14, y + 72 - k * 0 - 0, 1, 1, '#e8e0cc')
    reg('doc', x, y, 164, 100, id='doc_' + name.lower().replace(' ', '_'), label=name, stakes=stakes)

# ---------------------------------------------------------------- 8 tool calls (CONTAINMENT)
TOOLS = [('read_file', 'LOW'), ('web_search', 'LOW'), ('send_email', 'MED'), ('write_db', 'MED'),
         ('fetch_url', 'LOW'), ('run_shell', 'HIGH'), ('delete_records', 'HIGH'), ('transfer_funds', 'HIGH')]
for i, (name, risk) in enumerate(TOOLS):
    x, y = 4 + i * 127, 268
    col = {'LOW': '#22e5ff', 'MED': '#ffb02e', 'HIGH': '#ff2a2a'}[risk]
    rect(x, y, 122, 122, '#0b1218'); rect(x + 4, y + 4, 114, 6, col, 0.01)
    text('{ }', x + 10, y + 62, 102, 40, col, 'CENTER')
    text(name + '()', x + 6, y + 26, 110, 20, '#f2f6ff', 'CENTER')
    reg('tool', x, y, 122, 122, id='tool_' + name, label=name, risk=risk)

# ---------------------------------------------------------------- app screens (SHIP IT phones), aspect 0.47
for i, (name, col, glyph) in enumerate((('FOCUSFI', '#9dff3a', 'target'), ('LUCID', '#a77bff', 'moon'))):
    x, y = 4 + i * 124, 4
    rect(x, y, 120, 256, '#0b1218')
    cx, cy = x + 60, y + 150
    if glyph == 'target':
        for r, c in ((40, col), (30, '#0b1218'), (20, col), (10, '#0b1218'), (5, col)):
            disc(cx, cy, r, c, 0.05 + (40 - r) * 0.001)
    else:
        disc(cx, cy, 36, col, 0.05); disc(cx + 14, cy + 10, 30, '#0b1218', 0.06)
        for k in range(5):
            rect(cx - 30 + k * 13, cy - 52, 7, 10 + (k % 3) * 8, '#22e5ff', 0.07)
    text(name, x + 6, y + 70, 108, 26, '#f2f6ff', 'CENTER')
    text('iOS · ANDROID', x + 10, y + 36, 100, 14, '#8a96a0', 'CENTER')
    reg('app', x, y, 120, 256, id='app_' + name.lower(), label=name)

# ---------------------------------------------------------------- stamps, plates, labels, numbers (right-hand block)
STAMPS = [('SHIPPED', '#3dff8a'), ('REJECTED', '#ff2a2a'), ('ESCALATED', '#ffb02e'), ('AUTO-FILED', '#22e5ff'),
          ('BREACH', '#ff2a2a'), ('CONTAINED', '#3dff8a'), ('PERFECT', '#ff2bd6'), ('MISS', '#8a96a0')]
for i, (t, c) in enumerate(STAMPS):
    x, y = 256 + (i % 4) * 192, 196 - (i // 4) * 62
    rect(x, y, 186, 56, c); rect(x + 4, y + 4, 178, 48, '#07080b', 0.01)
    text(t, x + 10, y + 12, 166, 32, c, 'CENTER')
    reg('stamp', x, y, 186, 56, id='stamp_' + t.lower().replace('-', '_'), label=t)
PLATES = [('CODE', '#22e5ff'), ('BUILD iOS', '#f2f6ff'), ('BUILD ANDROID', '#9dff3a'), ('PAYMENTS', '#ffb02e'), ('APP REVIEW', '#ff2bd6')]
for i, (t, c) in enumerate(PLATES):
    x, y = 256 + i * 152, 72
    rect(x, y, 146, 56, '#0b1218'); rect(x, y, 146, 5, c, 0.01)
    text(t, x + 8, y + 14, 130, 28, c, 'CENTER')
    reg('plate', x, y, 146, 56, id='plate_' + t.lower().replace(' ', '_'), label=t)
BINS = [('POSITIVE', '#3dff8a'), ('NEUTRAL', '#ffb02e'), ('NEGATIVE', '#ff2a2a')]
for i, (t, c) in enumerate(BINS):
    x, y = 256 + i * 112, 8
    rect(x, y, 108, 56, '#0b1218'); text(t, x + 6, y + 14, 96, 28, c, 'CENTER')
    reg('bin', x, y, 108, 56, id='bin_' + t.lower(), label=t)
for i in range(10):                     # PACKET RUN plant beacons 1-7 and racks A-C
    lab = str(i + 1) if i < 7 else 'ABC'[i - 7]
    x, y = 594 + i * 43, 8
    rect(x, y, 40, 56, '#0b1218'); rect(x, y + 51, 40, 5, '#ffb02e' if i < 7 else '#22e5ff', 0.01)
    text(lab, x + 4, y + 8, 32, 38, '#f2f6ff', 'CENTER')
    reg('label', x, y, 40, 56, id=('plant_' if i < 7 else 'rack_') + lab.lower(), label=('PLANT ' if i < 7 else 'RACK ') + lab)

rs.render.filepath = os.path.join(TEX, 'minigame_atlas.png'); rs.render.image_settings.file_format = 'PNG'; rs.render.image_settings.color_mode = 'RGB'
bpy.ops.render.render(write_still=True, scene=rs.name)
bpy.context.window.scene = prev
for m in list(bpy.data.materials):
    if m.name.startswith('mga') and m.users == 0:
        bpy.data.materials.remove(m)
json.dump({'texture': 'textures/minigame_atlas.png', 'uvNote': 'uv = [u0, v0, u1, v1], v from the bottom (TextureLoader flipY = true).',
           'rects': rects}, open(os.path.join(OUT, 'minigame-atlas.json'), 'w'), indent=1)
print('rects', len(rects), os.path.getsize(os.path.join(TEX, 'minigame_atlas.png')))
