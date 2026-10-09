"""Neon District asset helpers, shared by every build step.

Run inside Blender (5.x). Each step script does
    exec(open(LIB).read(), globals())
then builds into its own collection inside the 'Neon District' scene.

Conventions (see docs/neon-district-assets.md):
- 1 unit = 1 metre, Z up, exported with export_yup=False like the existing city.
- Every mesh uses ONE material slot 'nd_atlas' (or 'nd_glass' / 'nd_screen').
  UV0 points into the shared 1024x1024 atlas (kit_color.png + kit_mask.png).
- COLOR_0 is baked ambient occlusion (grey, 0..1).
- Faces are not shared between quads, so every face is flat shaded.
"""
import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = '/mnt/sdcard/Github/threejs-portfolio'
OUT = os.path.join(ROOT, 'static/models/cyber')
TEX = os.path.join(OUT, 'textures')
SRC_TEX = os.path.join(ROOT, 'assets/blender/neon-district-textures')
for _d in (OUT, TEX, SRC_TEX):
    os.makedirs(_d, exist_ok=True)

SCENE_NAME = 'Neon District'
ATLAS = 1024
SW = 64                    # swatch size in px
SWU = SW / ATLAS           # swatch size in uv

def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))

# ---------------------------------------------------------------------------
# Atlas layout. Origin bottom-left (Blender UV space).
# Bottom half (rows 0..7 of 64 px): solid swatches.
#   rows 0..3, cols 0..15  -> general swatches (index = row * 16 + col)
#   rows 4..7, cols 0..5   -> VARIANT BLOCK (jacket, pants, skin, hair) x 6 variants
#   rows 4..7, cols 6..15  -> more general swatches
# Top half: pattern tiles (pixel rects x, y, w, h).
# ---------------------------------------------------------------------------
# name: (hex, emissive)
SWATCHES = [
    ('concrete_dark', '#2b2f34', 0), ('concrete_mid', '#474c52', 0), ('concrete_light', '#6b7076', 0),
    ('metal_dark', '#1d2125', 0), ('metal_mid', '#3d4349', 0), ('metal_light', '#8a9096', 0),
    ('rust', '#5a3a2a', 0), ('trim_black', '#0e1013', 0), ('hazard', '#d8a21a', 0),
    ('glass_dark', '#0f1a20', 0), ('glass_teal', '#1d3a40', 0), ('hero_red', '#b5121b', 0),
    ('hero_red_dark', '#5e0a0f', 0), ('rubber', '#151515', 0), ('panel_white', '#c9ccce', 0),
    ('asphalt', '#1a1c1f', 0),
    # row 1
    ('pad_cyan', '#22e5ff', 1), ('neon_cyan', '#22e5ff', 1), ('neon_magenta', '#ff2bd6', 1),
    ('neon_acid', '#9dff3a', 1), ('neon_amber', '#ffb02e', 1), ('neon_red', '#ff2a2a', 1),
    ('thruster_blue', '#58b6ff', 1), ('lamp_warm', '#ffd27a', 1), ('screen_glow', '#7af0ff', 1),
    ('neon_white', '#ffffff', 1), ('visor', '#3ff6ff', 1), ('plant_neon', '#c26bff', 1),
    ('lamp_white', '#f2f6ff', 1), ('neon_violet', '#8a5bff', 1), ('screen_dark', '#06222a', 1),
    ('signal_green', '#3dff8a', 1),
    # row 2
    ('sidewalk', '#3a3d42', 0), ('wood', '#4a3526', 0), ('cardboard', '#8a6a44', 0),
    ('tarp_blue', '#2e4f73', 0), ('tarp_green', '#3c5a3a', 0), ('plant_purple', '#6b3fa0', 0),
    ('boot_black', '#121212', 0), ('glove_black', '#18191c', 0), ('bag_olive', '#3f4530', 0),
    ('metal_gold', '#8c6a2c', 0), ('cable_black', '#0b0b0c', 0), ('paint_teal', '#1f5a5c', 0),
    ('paint_maroon', '#4a1a22', 0), ('tile_white', '#9aa0a4', 0), ('car_grey', '#2c3036', 0),
    ('car_white', '#b8bcc0', 0),
    # row 3
    ('car_yellow', '#c9a227', 0), ('car_blue', '#1c3a6b', 0), ('seat_black', '#16171a', 0),
    ('dash_dark', '#0c0e11', 0), ('leather_tan', '#9a5a32', 0), ('leather_dark', '#2a1d17', 0),
    ('bezel_bronze', '#7a5a35', 0),
]
SWATCH = {}
for _i, (_n, _h, _e) in enumerate(SWATCHES):
    SWATCH[_n] = (_i % 16, _i // 16, _h, _e)

VARIANT_ROWS = {'jacket': 4, 'pants': 5, 'skin': 6, 'hair': 7}
VARIANTS = {
    'jacket': ['#1b1c20', '#7d1f2a', '#1f2b45', '#4b5134', '#8a7457', '#c8c8c8'],
    'pants':  ['#202226', '#2a2a30', '#1a2233', '#33362a', '#3b3127', '#55585e'],
    'skin':   ['#c99170', '#8d5a3c', '#e2b591', '#a8714f', '#5e3b26', '#d6a37f'],
    'hair':   ['#141414', '#3a2416', '#d4d4d4', '#ff2bd6', '#22e5ff', '#6b4a2b'],
}
VARIANT_BLOCK_UV = (0.0, 4 * SWU, 6 * SWU, 8 * SWU)   # u0, v0, u1, v1

TILES = {   # name: pixel rect (x, y, w, h) in the top half
    'facade_win':      (0, 768, 256, 256),
    'facade_strip':    (256, 768, 256, 256),
    'facade_balcony':  (512, 768, 256, 256),
    'storefront':      (0, 512, 256, 256),
    'storefront_door': (256, 512, 256, 256),
    'pad_top':         (512, 512, 256, 256),
    'vending':         (768, 896, 128, 128),
    'kiosk_screen':    (896, 896, 128, 128),
    'skyline_win':     (768, 768, 128, 128),
    'vent_grille':     (896, 768, 128, 128),
    'ac_front':        (768, 640, 128, 128),
    'panel_tech':      (896, 640, 128, 128),
    'car_grille':      (768, 512, 128, 128),
    'car_dash':        (896, 512, 128, 128),
}
for _n in VARIANT_ROWS:
    pass

def swatch_uv(name):
    """Inset rect of a solid swatch so filtering never bleeds."""
    if name.startswith('var_'):
        part = name[4:]
        col, row = 0, VARIANT_ROWS[part]
    else:
        col, row = SWATCH[name][0], SWATCH[name][1]
    u0 = (col + 0.3) * SWU; v0 = (row + 0.3) * SWU
    return (u0, v0, u0 + 0.4 * SWU, v0 + 0.4 * SWU)

def tile_uv(name, inset=1.0):
    x, y, w, h = TILES[name]
    return ((x + inset) / ATLAS, (y + inset) / ATLAS, (x + w - inset) / ATLAS, (y + h - inset) / ATLAS)

def region(r):
    """r: swatch/tile name, or explicit uv rect tuple."""
    if isinstance(r, tuple):
        return r
    if r in TILES:
        return tile_uv(r)
    return swatch_uv(r)

# ---------------------------------------------------------------------------
# Scene / collections / materials
# ---------------------------------------------------------------------------
def scene():
    sc = bpy.data.scenes.get(SCENE_NAME)
    if sc is None:
        sc = bpy.data.scenes.new(SCENE_NAME)
    if bpy.context.window.scene != sc:
        bpy.context.window.scene = sc
    sc.unit_settings.system = 'METRIC'
    return sc

def collection(name, parent=None, clear=True):
    sc = scene()
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        (parent or sc.collection).children.link(col)
    elif clear:
        for ob in list(col.all_objects):
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if data is not None and getattr(data, 'users', 1) == 0:
                if isinstance(data, bpy.types.Mesh):
                    bpy.data.meshes.remove(data)
                elif isinstance(data, bpy.types.Armature):
                    bpy.data.armatures.remove(data)
        for child in list(col.children):
            bpy.data.collections.remove(child)
    return col

def atlas_material(name='nd_atlas'):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    color = nodes.new('ShaderNodeTexImage'); color.location = (-700, 300)
    mask = nodes.new('ShaderNodeTexImage'); mask.location = (-700, -100)
    img_c = bpy.data.images.get('kit_color.png')
    img_m = bpy.data.images.get('kit_mask.png')
    if img_c: color.image = img_c
    if img_m:
        mask.image = img_m
        img_m.colorspace_settings.name = 'Non-Color'
    color.interpolation = 'Closest'
    mask.interpolation = 'Closest'
    ao = nodes.new('ShaderNodeVertexColor'); ao.location = (-700, 600); ao.layer_name = 'AO'
    mul = nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.location = (-350, 450)
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(color.outputs['Color'], mul.inputs[6])
    nt.links.new(ao.outputs['Color'], mul.inputs[7])
    nt.links.new(mul.outputs[2], bsdf.inputs['Base Color'])
    sep = nodes.new('ShaderNodeSeparateColor'); sep.location = (-450, -100)
    nt.links.new(mask.outputs['Color'], sep.inputs['Color'])
    # Preview: emissive = colour * (B + R*0.5) — R = window glass (half lit preview).
    mx = nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY_ADD'; mx.location = (-250, -100)
    nt.links.new(sep.outputs[0], mx.inputs[0]); mx.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs[2], mx.inputs[2])
    nt.links.new(color.outputs['Color'], bsdf.inputs['Emission Color'])
    em = nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.location = (-100, -100)
    nt.links.new(mx.outputs[0], em.inputs[0]); em.inputs[1].default_value = 6.0
    nt.links.new(em.outputs[0], bsdf.inputs['Emission Strength'])
    bsdf.inputs['Roughness'].default_value = 0.8
    return mat

def flat_material(name, hex_color, alpha=1.0, emission=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    rgb = hex_rgb(hex_color)
    lin = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
    bsdf.inputs['Base Color'].default_value = (*lin, 1)
    bsdf.inputs['Alpha'].default_value = alpha
    bsdf.inputs['Roughness'].default_value = 0.15
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*lin, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    if alpha < 1:
        try:
            mat.surface_render_method = 'BLENDED'
        except Exception:
            pass
    return mat

# ---------------------------------------------------------------------------
# Mesh builder
# ---------------------------------------------------------------------------
class MB:
    """Accumulates flat quads/tris with atlas UVs, per material slot."""
    def __init__(self):
        self.parts = {}   # slot -> (verts, faces, uvs)

    def _p(self, slot):
        return self.parts.setdefault(slot, ([], [], []))

    def face(self, pts, r, slot='nd_atlas', uvs=None):
        v, f, uv = self._p(slot)
        u0, v0, u1, v1 = region(r)
        n = len(pts)
        if uvs is None:
            if n == 4:
                uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
            elif n == 3:
                uvs = [(0, 0), (1, 0), (0.5, 1)]
            else:
                uvs = [(0.5 + 0.5 * math.cos(i * math.tau / n), 0.5 + 0.5 * math.sin(i * math.tau / n)) for i in range(n)]
        base = len(v)
        v.extend(tuple(p) for p in pts)
        f.append(tuple(range(base, base + n)))
        uv.extend((u0 + (u1 - u0) * a, v0 + (v1 - v0) * b) for a, b in uvs)

    def quad(self, a, b, c, d, r, slot='nd_atlas', uvs=None):
        self.face([a, b, c, d], r, slot, uvs)

    def box(self, center, size, r, slot='nd_atlas', faces=None, rot=0.0, skip=()):
        """faces: optional dict side->region, sides: px nx py ny pz nz."""
        cx, cy, cz = center
        sx, sy, sz = (s / 2 for s in size)
        cr, sr = math.cos(rot), math.sin(rot)
        def P(x, y, z):
            return Vector((cx + x * cr - y * sr, cy + x * sr + y * cr, cz + z))
        corners = {
            'nz': [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)],
            'pz': [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)],
            'ny': [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
            'py': [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)],
            'px': [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)],
            'nx': [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
        }
        for side, cs in corners.items():
            if side in skip:
                continue
            rr = (faces or {}).get(side, r)
            self.quad(*[P(x * sx, y * sy, z * sz) for x, y, z in cs], rr, slot)

    def cyl(self, a, b, radius, r, sides=8, top=None, slot='nd_atlas', caps=True, cap_r=None):
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        u = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < .9 else Vector((0, 1, 0))).normalized()
        w = axis.cross(u)
        rt = radius if top is None else top
        ring = lambda p, rad: [p + rad * (u * math.cos(i * math.tau / sides) + w * math.sin(i * math.tau / sides)) for i in range(sides)]
        ra, rb = ring(a, radius), ring(b, rt)
        for i in range(sides):
            j = (i + 1) % sides
            self.quad(ra[i], ra[j], rb[j], rb[i], r, slot,
                      uvs=[(i / sides, 0), ((i + 1) / sides, 0), ((i + 1) / sides, 1), (i / sides, 1)])
        if caps:
            cr = cap_r or r
            self.face(list(reversed(ra)), cr, slot)
            if rt > 0.0005:
                self.face(rb, cr, slot)

    def prism(self, pts2d, z0, z1, side_r, cap_r=None, slot='nd_atlas', top=True, bottom=True):
        """Extrude a CCW 2D polygon from z0 to z1."""
        n = len(pts2d)
        for i in range(n):
            (x0, y0), (x1, y1) = pts2d[i], pts2d[(i + 1) % n]
            self.quad((x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1), side_r, slot)
        if top:
            self.face([(x, y, z1) for x, y in pts2d], cap_r or side_r, slot)
        if bottom:
            self.face([(x, y, z0) for x, y in reversed(pts2d)], cap_r or side_r, slot)

    def tris(self):
        return sum(sum(len(f) - 2 for f in faces) for _, faces, _ in self.parts.values())

    def build(self, name, col, ao=True, ao_dist=1.2, ao_samples=20, extra_bvh=None):
        mesh = bpy.data.meshes.new(name)
        verts, faces, uvs, slots = [], [], [], []
        mats = []
        for slot, (v, f, uv) in self.parts.items():
            if not f:
                continue
            base = len(verts)
            verts.extend(v); uvs.extend(uv)
            faces.extend(tuple(i + base for i in face) for face in f)
            mats.append(slot)
            slots.extend([len(mats) - 1] * len(f))
        mesh.from_pydata(verts, [], faces)
        uvl = mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                vi = mesh.loops[li].vertex_index
                uvl.data[li].uv = uvs[vi]
        for s in mats:
            mesh.materials.append(atlas_material() if s == 'nd_atlas' else bpy.data.materials.get(s) or slot_material(s))
        for poly, s in zip(mesh.polygons, slots):
            poly.material_index = s
        mesh.update()
        ob = bpy.data.objects.new(name, mesh)
        col.objects.link(ob)
        if ao:
            bake_ao(ob, ao_dist, ao_samples, extra_bvh)
        else:
            fill_ao(ob)
        return ob

    def ico(self, center, radius, r, subdiv=1, squash=(1, 1, 1), slot='nd_atlas', alt=None, alt_ratio=0.0, seed=0):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
        rnd = random.Random(seed)
        for f in bm.faces:
            pts = [Vector((v.co.x * squash[0], v.co.y * squash[1], v.co.z * squash[2])) + Vector(center) for v in f.verts]
            self.face(pts, alt if (alt and rnd.random() < alt_ratio) else r, slot, uvs=[(0, 0), (1, 0), (0.5, 1)])
        bm.free()

def slot_material(s):
    if s == 'nd_glass':
        return flat_material('nd_glass', '#9fe8ff', alpha=0.25)
    if s == 'nd_screen':
        return flat_material('nd_screen', '#0b2a33', emission=2.0)
    if s == 'nd_thruster':
        return flat_material('nd_thruster', '#58b6ff', emission=4.0)
    if s == 'nd_dash':
        return flat_material('nd_dash', '#05080b', emission=1.5)
    if s == 'nd_mirror':
        return flat_material('nd_mirror', '#1a2630', emission=0.8)
    if s == 'nd_hud':
        return flat_material('nd_hud', '#7af0ff', alpha=0.15, emission=1.0)
    if s == 'nd_sign':
        return flat_material('nd_sign', '#ff2bd6', emission=3.0)
    if s == 'nd_window':
        return flat_material('nd_window', '#1a2a3a', emission=1.0)
    if s == 'nd_belt':
        return flat_material('nd_belt', '#1b1e22')
    return atlas_material()

# ---------------------------------------------------------------------------
# Ambient occlusion -> COLOR_0 ('AO', corner domain)
# ---------------------------------------------------------------------------
_HEMI = None
def _hemi(n):
    global _HEMI
    if _HEMI is None or len(_HEMI) != n:
        rnd = random.Random(7)
        pts = []
        while len(pts) < n:
            v = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
            if 0.05 < v.length <= 1:
                pts.append(v.normalized())
        _HEMI = pts
    return _HEMI

def bake_ao(ob, dist=1.2, samples=20, extra=None, floor=0.25):
    me = ob.data
    bvh = BVHTree.FromPolygons([v.co for v in me.vertices], [p.vertices for p in me.polygons], epsilon=0.0)
    dirs = _hemi(samples)
    attr = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = attr
    try:
        me.color_attributes.render_color_index = list(me.color_attributes).index(attr)
    except Exception:
        pass
    for poly in me.polygons:
        nrm = poly.normal
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            # pull sample point slightly toward the face centre to avoid self-hits at edges
            p = co.lerp(poly.center, 0.04) + nrm * 0.01
            occ = 0.0; tot = 0.0
            for d in dirs:
                cosw = d.dot(nrm)
                if cosw <= 0:
                    d = -d; cosw = -cosw
                hit = bvh.ray_cast(p, d, dist)
                if hit[0] is None and extra is not None:
                    hit = extra.ray_cast(ob.matrix_world @ p, ob.matrix_world.to_3x3() @ d, dist)
                if hit[0] is not None:
                    occ += cosw * (1.0 - hit[3] / dist)
                tot += cosw
            a = 1.0 - (occ / tot if tot else 0)
            a = floor + (1 - floor) * max(0.0, min(1.0, a))
            attr.data[li].color = (a, a, a, 1.0)

def fill_ao(ob, value=1.0):
    me = ob.data
    attr = me.color_attributes.get('AO') or me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER')
    me.color_attributes.active_color = attr
    for d in attr.data:
        d.color = (value, value, value, 1.0)

# ---------------------------------------------------------------------------
# Empties used as anchors (exported as glTF nodes)
# ---------------------------------------------------------------------------
def anchor(name, parent, loc, rot=(0, 0, 0), size=0.3, kind='ARROWS'):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = kind
    e.empty_display_size = size
    e.location = loc
    e.rotation_euler = rot
    for c in parent.users_collection:
        c.objects.link(e)
    e.parent = parent
    return e

# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------
def export_glb(name, objects, draco=False, animations=False, skins=False, out=OUT, anim_mode='ACTIONS'):
    sc = scene()
    for ob in sc.objects:
        ob.select_set(False)
    sel = []
    def add(o):
        if o not in sel:
            sel.append(o)
            for ch in o.children:
                add(ch)
    for o in objects:
        add(o)
    for o in sel:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = sel[0]
    path = os.path.join(out, name + '.glb')
    kwargs = dict(filepath=path, export_format='GLB', use_selection=True, use_active_scene=True,
                  export_yup=False, export_materials='EXPORT', export_image_format='NONE',
                  export_animations=animations, export_skins=skins, export_apply=True,
                  export_extras=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    if 'export_vertex_color' in props:
        kwargs['export_vertex_color'] = 'ACTIVE'
    if 'export_all_vertex_colors' in props:
        kwargs['export_all_vertex_colors'] = False
    if 'export_active_vertex_color_when_no_material' in props:
        kwargs['export_active_vertex_color_when_no_material'] = True
    if draco:
        kwargs.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
                      export_draco_position_quantization=14, export_draco_texcoord_quantization=12,
                      export_draco_color_quantization=8)
    if animations:
        for k, v in (('export_animation_mode', anim_mode), ('export_force_sampling', True),
                     ('export_frame_step', 1), ('export_optimize_animation_size', True)):
            if k in props:
                kwargs[k] = v
    bpy.ops.export_scene.gltf(**kwargs)
    for o in sel:
        o.select_set(False)
    return path, os.path.getsize(path)

def tri_count(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)
