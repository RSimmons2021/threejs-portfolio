"""Step 12 (preview only): shade the Blender preview with the baked light volume, the
same maths the runtime CyberMaterial uses (light-volume.json -> 'shading'), so the
before/after renders show exactly what the volume adds.

Adds a node group ND_LightVolume (Sky, Bounce) and an 'LV' toggle inside nd_atlas:
  LV = 0 -> original Eevee-lit preview material
  LV = 1 -> albedo * ao * (skyColour * mix(0.08, 1, sky) + bounce * neon) + emissive
Call set_lighting(lv, night) before rendering.
"""
import bpy, json, os

ROOT = '/mnt/sdcard/Github/threejs-portfolio'
META = json.load(open(os.path.join(ROOT, 'static/models/cyber/light-volume.json')))
G = META['grid']; NX, NY, NZ = G['dims']; TC, TR = G['tiles']
img = bpy.data.images.load(os.path.join(ROOT, 'static/models/cyber/textures/light_volume.png'), check_existing=True)
img.reload()
img.colorspace_settings.name = 'Non-Color'
img.alpha_mode = 'CHANNEL_PACKED'

def group():
    ng = bpy.data.node_groups.get('ND_LightVolume')
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new('ND_LightVolume', 'ShaderNodeTree')
    ng.interface.new_socket('Sky', in_out='OUTPUT', socket_type='NodeSocketFloat')
    ng.interface.new_socket('Bounce', in_out='OUTPUT', socket_type='NodeSocketColor')
    N = ng.nodes; Lk = ng.links.new
    out = N.new('NodeGroupOutput')
    geo = N.new('ShaderNodeNewGeometry')
    def vm(op, a, b=None):
        n = N.new('ShaderNodeVectorMath'); n.operation = op
        Lk(a, n.inputs[0]) if not isinstance(a, tuple) else setattr(n.inputs[0], 'default_value', a)
        if b is not None:
            Lk(b, n.inputs[1]) if not isinstance(b, tuple) else setattr(n.inputs[1], 'default_value', b)
        return n.outputs[0]
    def m(op, a, b=None, clamp=False):
        n = N.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                Lk(v, n.inputs[i])
        return n.outputs[0]
    origin = (G['min'][0], G['min'][1], G['min'][2] + G['sampleZOffset'])
    g = vm('DIVIDE', vm('SUBTRACT', geo.outputs['Position'], origin), tuple(G['cell']))
    sep = N.new('ShaderNodeSeparateXYZ'); Lk(g, sep.inputs[0])
    gx = m('MINIMUM', m('MAXIMUM', sep.outputs[0], 0.0), NX - 1)
    gy = m('MINIMUM', m('MAXIMUM', sep.outputs[1], 0.0), NY - 1)
    gz = m('MINIMUM', m('MAXIMUM', sep.outputs[2], 0.0), NZ - 1.001)
    s0 = m('FLOOR', gz); f = m('SUBTRACT', gz, s0); s1 = m('MINIMUM', m('ADD', s0, 1.0), NZ - 1)
    def sample(s):
        tx = m('FLOORED_MODULO', s, TC); ty = m('FLOOR', m('DIVIDE', s, TC))
        u = m('DIVIDE', m('ADD', m('ADD', m('MULTIPLY', tx, NX), gx), 0.5), NX * TC)
        v = m('DIVIDE', m('ADD', m('ADD', m('MULTIPLY', ty, NY), gy), 0.5), NY * TR)
        cmb = N.new('ShaderNodeCombineXYZ'); Lk(u, cmb.inputs[0]); Lk(v, cmb.inputs[1])
        t = N.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; t.extension = 'EXTEND'
        Lk(cmb.outputs[0], t.inputs[0])
        return t
    a, b = sample(s0), sample(s1)
    mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; Lk(f, mixc.inputs[0]); Lk(a.outputs['Color'], mixc.inputs[6]); Lk(b.outputs['Color'], mixc.inputs[7])
    mixa = N.new('ShaderNodeMix'); mixa.data_type = 'FLOAT'; Lk(f, mixa.inputs[0]); Lk(a.outputs['Alpha'], mixa.inputs[2]); Lk(b.outputs['Alpha'], mixa.inputs[3])
    sq = vm('MULTIPLY', mixc.outputs[2], mixc.outputs[2])
    bounce = vm('SCALE', sq); bounce.node.inputs['Scale'].default_value = META['encoding']['bounceScale']
    Lk(mixa.outputs[0], out.inputs['Sky']); Lk(bounce, out.inputs['Bounce'])
    return ng

def wire(mat, albedo_socket_fn, emissive_fn):
    """Insert LV path into a material. albedo_socket_fn(nt) -> socket of albedo*ao; emissive_fn(nt) -> socket or None."""
    nt = mat.node_tree; N = nt.nodes; Lk = nt.links.new
    for n in [n for n in N if n.label.startswith('LV_')]:
        N.remove(n)
    outn = next(n for n in N if n.type == 'OUTPUT_MATERIAL')
    bsdf = next(n for n in N if n.type == 'BSDF_PRINCIPLED')
    def lab(n, l):
        n.label = 'LV_' + l; return n
    grp = lab(N.new('ShaderNodeGroup'), 'group'); grp.node_tree = bpy.data.node_groups['ND_LightVolume']
    sky_col = lab(N.new('ShaderNodeRGB'), 'skycol')
    neon = lab(N.new('ShaderNodeValue'), 'neon')
    toggle = lab(N.new('ShaderNodeValue'), 'toggle')
    skym = lab(N.new('ShaderNodeMapRange'), 'skymap'); skym.inputs['To Min'].default_value = 0.08
    Lk(grp.outputs['Sky'], skym.inputs['Value'])
    t1 = lab(N.new('ShaderNodeVectorMath'), 't1'); t1.operation = 'SCALE'; Lk(sky_col.outputs[0], t1.inputs[0]); Lk(skym.outputs[0], t1.inputs['Scale'])
    t2 = lab(N.new('ShaderNodeVectorMath'), 't2'); t2.operation = 'SCALE'; Lk(grp.outputs['Bounce'], t2.inputs[0]); Lk(neon.outputs[0], t2.inputs['Scale'])
    light = lab(N.new('ShaderNodeVectorMath'), 'light'); light.operation = 'ADD'; Lk(t1.outputs[0], light.inputs[0]); Lk(t2.outputs[0], light.inputs[1])
    lit = lab(N.new('ShaderNodeVectorMath'), 'lit'); lit.operation = 'MULTIPLY'; Lk(albedo_socket_fn(nt), lit.inputs[0]); Lk(light.outputs[0], lit.inputs[1])
    final = lit.outputs[0]
    e = emissive_fn(nt)
    if e is not None:
        add = lab(N.new('ShaderNodeVectorMath'), 'emit'); add.operation = 'ADD'; Lk(lit.outputs[0], add.inputs[0]); Lk(e, add.inputs[1]); final = add.outputs[0]
    em = lab(N.new('ShaderNodeEmission'), 'emission'); Lk(final, em.inputs['Color'])
    ms = lab(N.new('ShaderNodeMixShader'), 'mix'); Lk(toggle.outputs[0], ms.inputs[0]); Lk(bsdf.outputs[0], ms.inputs[1]); Lk(em.outputs[0], ms.inputs[2])
    Lk(ms.outputs[0], outn.inputs['Surface'])

group()
atlas = bpy.data.materials['nd_atlas']
# preview windows: the runtime lights only uLitFraction of them; keep the preview glow low
next(n for n in atlas.node_tree.nodes if n.type == 'MATH' and n.operation == 'MULTIPLY_ADD').inputs[1].default_value = 0.12
def atlas_albedo(nt):
    mul = next(n for n in nt.nodes if n.type == 'MIX' and n.blend_type == 'MULTIPLY' and not n.label)
    return mul.outputs[2]
def atlas_emissive(nt):
    nodes = nt.nodes
    tex = next(n for n in nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name == 'kit_color.png')
    em_strength = next(n for n in nodes if n.type == 'MATH' and n.operation == 'MULTIPLY' and not n.label)
    sc = nt.nodes.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'; sc.label = 'LV_emscale'
    nt.links.new(tex.outputs['Color'], sc.inputs[0]); nt.links.new(em_strength.outputs[0], sc.inputs['Scale'])
    return sc.outputs[0]
wire(atlas, atlas_albedo, atlas_emissive)
ground = bpy.data.materials.get('pv_ground')
if ground:
    def g_alb(nt):
        rgb = nt.nodes.new('ShaderNodeRGB'); rgb.label = 'LV_albedo'; rgb.outputs[0].default_value = (0.03, 0.032, 0.036, 1)
        return rgb.outputs[0]
    wire(ground, g_alb, lambda nt: None)

def set_lighting(lv, night):
    for mat in (atlas, ground):
        if not mat:
            continue
        N = mat.node_tree.nodes
        get = lambda l: next(n for n in N if n.label == 'LV_' + l)
        get('toggle').outputs[0].default_value = 1.0 if lv else 0.0
        get('skycol').outputs[0].default_value = (0.06, 0.07, 0.11, 1) if night else (1.1, 1.17, 1.22, 1)
        get('neon').outputs[0].default_value = 3.0 if night else 0.6
print('light volume preview wired', NX, NY, NZ)
