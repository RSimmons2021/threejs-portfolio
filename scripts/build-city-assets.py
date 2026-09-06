"""Run in Blender: creates an isolated scene and exports the portfolio's Z-up GLBs.

No external assets or textures. Geometry is batched by material per city block.
The editable .blend contains only this scene; the user's open scene is preserved.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'static/models/nyc')
os.makedirs(OUT, exist_ok=True)
os.makedirs(os.path.join(ROOT, 'assets/blender'), exist_ok=True)
previous = bpy.context.window.scene
scene = bpy.data.scenes.new('Portfolio / Manhattan Circuit')
bpy.context.window.scene = scene
palette = {
    'ink': '#172334', 'red': '#f44943', 'cream': '#fff0c9',
    'teal': '#62b9bc', 'blue': '#547591', 'stone': '#c7b69b',
    'brick': '#b6725d', 'gold': '#ffca62', 'glass': '#91d9e6',
    'road': '#263447', 'sidewalk': '#687688', 'green': '#648c75',
    'violet': '#9270c8', 'pink': '#e37caf'
}
mats = {}
for key, value in palette.items():
    rgb = tuple(int(value[i:i+2], 16) / 255 for i in (1, 3, 5))
    mat = bpy.data.materials.new('cel_' + key)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    linear = tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*linear, 1)
    shader.inputs['Roughness'].default_value = .72
    mats[key] = mat

batch = {}
def poly(key, verts, faces):
    v, f = batch.setdefault(key, ([], []))
    offset = len(v)
    v.extend(verts)
    f.extend(tuple(i + offset for i in face) for face in faces)

def box(key, xyz, size):
    x, y, z = xyz
    a, b, c = (s / 2 for s in size)
    poly(key, [(x+dx*a, y+dy*b, z+dz*c) for dx,dy,dz in
              [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
               (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],
         [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])

def rod(key, start, end, radius, sides=8, top=None):
    a, b = Vector(start), Vector(end)
    axis = (b-a).normalized()
    u = axis.cross(Vector((0,0,1)) if abs(axis.z) < .9 else Vector((0,1,0))).normalized()
    v = axis.cross(u)
    verts = []
    for p, r in [(a,radius),(b, radius if top is None else top)]:
        verts.extend(tuple(p+r*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides))) for i in range(sides))
    faces = [tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    poly(key, verts, faces)

def flush(label):
    objects = []
    for key,(verts,faces) in batch.items():
        mesh = bpy.data.meshes.new(label+' / '+key)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        obj = bpy.data.objects.new('cel_'+key+'_'+label, mesh)
        scene.collection.objects.link(obj)
        obj.data.materials.append(mats[key])
        objects.append(obj)
    batch.clear()
    return objects

def export(name, objects):
    for obj in scene.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,name+'.glb'), export_format='GLB',
                              use_selection=True, use_active_scene=True, export_yup=False,
                              export_materials='EXPORT')

try:
    # F1 proportions: +X forward, exposed wheels on Y, low chassis in Z.
    box('ink', (0,0,.24), (2.9,1.1,.12))
    box('red', (-.35,0,.43), (1.7,.62,.36))
    # Tapered nose from the monocoque to a narrow tip.
    poly('red',[(.1,-.31,.3),(.1,.31,.3),(.1,.31,.65),(.1,-.31,.65),
                (1.6,-.12,.27),(1.6,.12,.27),(1.6,.12,.38),(1.6,-.12,.38)],
         [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)])
    for side in [-1,1]:
        box('red',(-.42,side*.49,.4),(1.28,.36,.28))
        box('ink',(-.05,side*.495,.48),(.36,.37,.1))
        box('cream',(-.5,side*.675,.43),(.65,.015,.07))
        for axle in [-.92,.98]:
            rod('ink',(axle-.28,side*.24,.38),(axle,side*.8,.29),.027)
            rod('ink',(axle+.23,side*.25,.3),(axle,side*.8,.29),.027)
        # Front and rear aero endplates.
        box('red',(1.46,side*.88,.32),(.42,.045,.25))
        box('red',(-1.38,side*.74,.81),(.39,.045,.39))
        rod('ink',(-.46,side*.23,.55),(-.38,side*.24,.9),.035)
        rod('ink',(-.38,side*.24,.9),(.2,side*.2,.81),.035)
        rod('ink',(.2,side*.2,.81),(.35,0,.64),.035)
        box('gold',(.24,side*.42,.71),(.16,.13,.085))
    for i in range(3):
        box('ink',(1.35+i*.1,0,.23+i*.055),(.115,1.76,.045))
    for i in range(2):
        box('ink',(-1.4+i*.16,0,.9+i*.055),(.19,1.5,.055))
    box('cream',(-1.36,0,.993),(.15,1.35,.016))
    box('ink',(-1.28,0,.6),(.07,.13,.6))
    box('ink',(-.04,0,.63),(.55,.39,.08))
    rod('gold',(-.16,0,.64),(-.16,0,.88),.16,12,top=.12)
    box('ink',(-.005,0,.8),(.03,.25,.08))
    rod('red',(-.7,0,.57),(-.7,0,.96),.19,3,top=.1)
    box('cream',(.86,0,.497),(.38,.07,.015))
    # Number 23 in geometric strokes on the nose.
    for x in [.64,.78]:
        box('ink',(x,0,.52),(.045,.2,.013))
    car = flush('F1 chassis')
    export('f1-chassis',car)
    rod('ink',(0,-.18,0),(0,.18,0),.31,20)
    for y in [-.185,.185]:
        rod('gold',(0,y-.003,0),(0,y+.003,0),.251,20)
        rod('ink',(0,y-.005,0),(0,y+.005,0),.217,20)
        rod('blue',(0,y-.007,0),(0,y+.007,0),.15,12)
        rod('cream',(0,y-.009,0),(0,y+.009,0),.065,8)
    wheel = flush('F1 wheel')
    export('f1-wheel',wheel)
    box('red',(-1.51,0,.5),(.045,.17,.16))
    export('f1-brake',flush('rain light'))
    box('cream',(-1.515,0,.37),(.046,.12,.05))
    export('f1-reverse',flush('reverse light'))
    rod('ink',(-.75,0,.88),(-.77,0,1.12),.008,5)
    export('f1-antenna',flush('radio'))

    city = []
    # Skyline behind the driveable project avenue, plus the arrival district.
    buildings = [(-17,9,5,4,12),(-9,12,5,5,17),(0,14,5,5,23),
                 (10,13,5,4,13),(19,9,4,5,18),(-18,-6,5,5,10)]
    for i in range(19):
        buildings.append((26+i*7,-14+(i%3)*3,5.5,5,10+(i*7%13)))
    buildings.extend([(-10,-20,5,5,15),(10,-20,5,5,12),(-10,-43,5,5,14),
                      (10,-43,5,5,17),(-13,-54,5,5,16),(21,-48,5,5,12),
                      (-13,-66,5,5,13),(22,-65,5,5,16),(-55,-16,5,5,18),
                      (-46,-16,5,5,15),(-37,-16,5,5,20),(-28,-16,5,5,12)])
    for i,(x,y,w,d,h) in enumerate(buildings):
        # Keep the contact links' southeast camera sightline and approach clear.
        # Preserve block IDs so unrelated buildings retain their materials/details.
        if (x, y) == (22, -65):
            continue
        h *= .62
        key = ['stone','blue','teal','brick'][i%4]
        box('sidewalk',(x,y,.1),(w+1.3,d+1.3,.2))
        box(key,(x,y,h*.5),(w,d,h))
        box('ink',(x,y,h+.12),(w+.16,d+.16,.22))
        for z in range(2,int(h),2):
            box('ink',(x,y-d/2-.018,z),(w,.035,.055))
            for col in range(5):
                wx=x-w*.4+col*w*.2
                win='gold' if (col+z+i)%4==0 else 'glass'
                box(win,(wx,y-d/2-.04,z+.7),(w*.105,.03,.85))
                box(win,(x+w/2+.04,y-d*.4+col*d*.2,z+.7),(.03,d*.11,.85))
        for dx in [-w*.48,w*.48]:
            box('cream',(x+dx,y-d/2-.065,h/2),(.07,.08,h))
        if i%3==0:
            for level in range(3):
                box(key,(x,y,h+level*1.1+.55),(w*(.72-level*.15),d*(.72-level*.15),1.1))
            rod('cream',(x,y,h+3.3),(x,y,h+7),.13,8,top=.035)
        else:
            # NYC rooftop water tank, supports, conical lid, HVAC.
            for dx,dy in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]:
                rod('ink',(x+dx,y+dy,h),(x+dx,y+dy,h+1.2),.06)
            rod('brick',(x,y,h+.9),(x,y,h+2.3),.8,10)
            rod('ink',(x,y,h+2.3),(x,y,h+2.85),.9,10,top=.03)
            box('sidewalk',(x+1.7,y,h+.35),(.8,1.2,.7))
        # Doors and striped storefront awnings.
        box('ink',(x,y-d/2-.05,.85),(1.1,.07,1.7))
        for col in range(8):
            box('cream' if col%2 else 'red',(x-w*.44+col*w*.125,y-d/2-.38,1.95),(w*.125,.8,.15))
        city.extend(flush('block %02d'%i))
    # A continuous avenue, crosswalks, yellow lane markings, and lamps.
    box('road',(55,-32,.013),(228,13,.025))
    for y in [-38.5,-25.5]:
        box('sidewalk',(55,y,.07),(228,.4,.14))
    for x in range(-56,169,4):
        for y in [-31.85,-32.15]:
            box('gold',(x,y,.035),(1.9,.075,.015))
    for x in [17,41,65,89,113,137,161]:
        for y in range(-37,-26):
            box('cream',(x,y,.04),(1.9,.55,.015))
        rod('ink',(x,-23,.1),(x,-23,4.8),.065)
        rod('ink',(x,-23,4.8),(x,-25,4.8),.065)
        box('gold',(x,-25,4.73),(.5,.8,.1))
        box('ink',(x,-23,3.3),(.48,.32,1.05))
        for z,key in [(3.58,'red'),(3.3,'gold'),(3.02,'green')]:
            rod(key,(x,-23.17,z),(x,-23.19,z),.105,10)
    # Arrival paving and two pedestrian crossings.
    box('road',(0,0,.013),(28,14,.025))
    box('road',(0,-32.5,.013),(9,79,.025))
    for y in range(-24,-7,4):
        box('gold',(0,y,.04),(.09,1.8,.015))
    for x in range(-5,6):
        box('cream',(x,-7,.04),(.55,1.7,.015))
    city.extend(flush('avenue'))
    # Purple urban ginkgo canopies in slim metal planters, off the racing lanes.
    tree_positions = [(-6,1),(6,1),(-6,-11),(6,-11),(-6,-47),(6,-47),
                      (-6,-61),(25,-40),(49,-40),(73,-40),(97,-40),(121,-40),
                      (145,-40),(-22,-23),(-32,-23),(-44,-23),(-54,-23)]
    for i,(x,y) in enumerate(tree_positions):
        box('ink',(x,y,.15),(1.25,1.25,.3))
        box('glass',(x,y-.635,.22),(1.0,.02,.055))
        rod('ink',(x,y,.25),(x,y,2.15),.075)
        for j in range(3):
            angle=j*math.tau/3+i
            dx,dy=math.cos(angle)*.55,math.sin(angle)*.55
            rod('ink',(x,y,1.3),(x+dx,y+dy,2.4),.045)
            rod('violet' if j%2 else 'pink',(x+dx,y+dy,1.9),(x+dx,y+dy,2.65),.85,5,top=.42)
    city.extend(flush('cyber-grove'))
    export('manhattan',city)

    # Link-specific landmarks: objects communicate their destination directly.
    for kind in ['github','linkedin','email','portfolio']:
        if kind == 'github':
            box('ink',(0,0,1.25),(1.8,.45,1.9))
            box('teal',(0,-.24,1.35),(1.5,.035,1.4))
            for s in [-1,1]:
                rod('cream',(s*.57,-.28,1.2),(s*.34,-.28,1.45),.065)
                rod('cream',(s*.57,-.28,1.2),(s*.34,-.28,.95),.065)
            rod('cream',(-.1,-.28,.91),(.12,-.28,1.5),.045)
            for z in [.45,.57]: box('glass',(.42,-.26,z),(.5,.03,.045))
        elif kind == 'linkedin':
            box('blue',(0,0,1.25),(1.8,.4,1.8))
            box('cream',(-.51,-.24,1.15),(.2,.1,.8))
            box('cream',(-.51,-.24,1.76),(.22,.1,.22))
            box('cream',(-.09,-.24,1.15),(.19,.1,.8))
            rod('cream',(-.09,-.24,1.48),(.34,-.24,1.48),.105)
            box('cream',(.37,-.24,1.12),(.2,.1,.74))
        elif kind == 'email':
            box('ink',(0,.02,.7),(.16,.16,1.4))
            box('pink',(0,0,1.5),(1.9,.4,1.25))
            rod('cream',(-.86,-.23,2.03),(0,-.23,1.39),.048)
            rod('cream',(0,-.23,1.39),(.86,-.23,2.03),.048)
            rod('cream',(-.85,-.23,.99),(-.25,-.23,1.51),.035)
            rod('cream',(.85,-.23,.99),(.25,-.23,1.51),.035)
        else:
            box('ink',(0,0,1.25),(1.85,.4,1.8))
            box('violet',(0,-.22,1.25),(1.57,.04,1.51))
            for dx in [-.57,-.39,-.21]: box('cream',(dx,-.25,1.84),(.07,.02,.07))
            # A globe/browser mark for the portfolio destination.
            for j in range(16):
                a,b=j*math.tau/16,(j+1)*math.tau/16
                rod('cream',(.56*math.cos(a),-.27,1.22+.56*math.sin(a)),(.56*math.cos(b),-.27,1.22+.56*math.sin(b)),.027)
                rod('cream',(.25*math.cos(a),-.27,1.22+.56*math.sin(a)),(.25*math.cos(b),-.27,1.22+.56*math.sin(b)),.02)
            rod('cream',(-.54,-.27,1.22),(.54,-.27,1.22),.023)
        export('link-'+kind,flush('link '+kind))
    # Save a clean, editable scene without pulling in the user's other work.
    bpy.data.libraries.write(os.path.join(ROOT,'assets/blender/manhattan-circuit.blend'), {scene})
    print('Portfolio export complete:',[(f,os.path.getsize(os.path.join(OUT,f))) for f in os.listdir(OUT)])
finally:
    bpy.context.window.scene = previous
