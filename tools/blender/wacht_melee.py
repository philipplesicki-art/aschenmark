# Speerträger der Grenzwacht als .glb, vollständig per Skript.
# Aufruf: blender --background --python tools/blender/wacht_melee.py -- [Ausgabe.glb] [Vorschau.png]
# Maße wie im Spiel: 1 Meter = 1 Spieleinheit, vorne +X, Ursprung zwischen den Füßen, Höhe etwa 2,2.
# Aufbau: Körper als durchgehendes Netz (Skin-Modifier über ein Strichskelett, einmal geglättet), Rüstzeug als starre Teile,
# alles in EINEM Netz mit zwei Materialien (matt, Metall) und Eckenfarben. Gewichte werden hier berechnet (ohne Operatoren).
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, '..', '..', 'public', 'models', 'wacht_melee.glb')
PREVIEW = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24

# ---------- Farben (sRGB wie im Spiel), als lineare Werte in die Eckenfarben ----------
def lin(c):
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)
def hexc(h):
    return lin(((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255))
SKIN, BLUE, BLUE_D, TROUSER = hexc(0xd2a487), hexc(0x34506a), hexc(0x24394d), hexc(0x3a3d44)
LEATHER, WOOD, FUR, STEEL, STEEL_D = hexc(0x5a4334), hexc(0x7a5a3c), hexc(0xcfd3d6), hexc(0xaab0b8), hexc(0x6f7279)
MATTE, METAL = 0, 1

# ---------- Körper: Strichskelett -> Skin -> einmal Subdivision ----------
# (Name, Ort, Radius x/y, Vorgänger)
SK = [
    ('pelvis', (0, 0, 1.00), (.17, .15), None), ('waist', (0, 0, 1.22), (.15, .12), 'pelvis'), ('chest', (0, 0, 1.50), (.19, .13), 'waist'),
    ('neck', (0, 0, 1.72), (.065, .065), 'chest'), ('head1', (.01, 0, 1.82), (.105, .105), 'neck'), ('head2', (.015, 0, 1.93), (.13, .125), 'head1'), ('head3', (.01, 0, 2.03), (.085, .085), 'head2'),
]
for s, sg in (('L', 1), ('R', -1)):
    SK += [
        ('hip' + s, (0, .11 * sg, .96), (.105, .105), 'pelvis'), ('knee' + s, (.02, .12 * sg, .55), (.075, .075), 'hip' + s),
        ('ankle' + s, (0, .12 * sg, .11), (.06, .06), 'knee' + s), ('toe' + s, (.15, .12 * sg, .05), (.05, .045), 'ankle' + s),
        ('sho' + s, (0, .27 * sg, 1.58), (.08, .08), 'chest'), ('elb' + s, (0, .36 * sg, 1.28), (.06, .06), 'sho' + s),
        ('wri' + s, (.05, .38 * sg, 1.00), (.045, .045), 'elb' + s), ('hand' + s, (.07, .38 * sg, .91), (.05, .04), 'wri' + s),
    ]
idx = {n: i for i, (n, *_r) in enumerate(SK)}
me = bpy.data.meshes.new('strich')
me.from_pydata([p for _n, p, _r, _p in SK], [(idx[p], i) for i, (_n, _c, _r, p) in enumerate(SK) if p], [])
ob = bpy.data.objects.new('strich', me); scene.collection.objects.link(ob)
sk = ob.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
for i, (_n, _p, r, par) in enumerate(SK):
    v = me.skin_vertices[0].data[i]; v.radius = r; v.use_root = par is None
sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1
body = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
bpy.data.objects.remove(ob)

bm = bmesh.new(); bm.from_mesh(body)
L_BONE = bm.verts.layers.int.new('bone')       # 0 = Gewicht berechnen, sonst Knochen-Index + 1 (starr)
L_COL = bm.loops.layers.float_color.new('Col')

def paint(faces, col, mat, smooth=True, jitter=.05):
    for f in faces:
        k = 1 + (((f.index * 2654435761) >> 8 & 255) / 255 - .5) * jitter  # leichte Unruhe je Fläche
        f.material_index = mat; f.smooth = smooth
        for l in f.loops: l[L_COL] = (col[0] * k, col[1] * k, col[2] * k, 1)

bm.faces.ensure_lookup_table()
for f in bm.faces:  # Körper nach Lage einfärben
    c = f.calc_center_median(); ay = abs(c.y)
    if c.z > 1.70: col = SKIN
    elif ay > .245 and c.z < 1.52: col = SKIN if c.z < .985 else LEATHER if c.z < 1.17 else BLUE
    elif c.z > .97: col = BLUE
    elif c.z < .40: col = LEATHER
    else: col = TROUSER
    paint([f], col, MATTE)

# ---------- Skelett ----------
BONES = [('hips', (0, 0, .98), (0, 0, 1.2), None), ('spine', (0, 0, 1.2), (0, 0, 1.45), 'hips'), ('chest', (0, 0, 1.45), (0, 0, 1.7), 'spine'), ('head', (0, 0, 1.7), (0, 0, 2.05), 'chest')]
for s, sg in (('L', 1), ('R', -1)):
    BONES += [('upperarm.' + s, (0, .27 * sg, 1.58), (0, .36 * sg, 1.28), 'chest'), ('forearm.' + s, (0, .36 * sg, 1.28), (.06, .38 * sg, .93), 'upperarm.' + s),
              ('thigh.' + s, (0, .11 * sg, .96), (.02, .12 * sg, .55), 'hips'), ('shin.' + s, (.02, .12 * sg, .55), (0, .12 * sg, .08), 'thigh.' + s)]
BONES.append(('spear', (.06, -.38, .95), (.06, -.38, 1.35), 'forearm.R'))
BI = {n: i for i, (n, *_r) in enumerate(BONES)}

def part(res, bone, col, mat, smooth=False):
    vs = set(res['verts'])
    for v in vs: v[L_BONE] = BI[bone] + 1
    paint({f for v in vs for f in v.link_faces if all(w in vs for w in f.verts)}, col, mat, smooth)
T = lambda x, y, z: Matrix.Translation((x, y, z))
def S(x, y, z): return Matrix.Diagonal((x, y, z, 1))
RX = Matrix.Rotation(math.pi / 2, 4, 'X')

# ---------- Rüstzeug ----------
# Helm: Kegel mit Krempe und Nasenschutz
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=.158, radius2=.035, depth=.26, matrix=T(.015, 0, 2.07)), 'head', STEEL, METAL, True)
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=.175, radius2=.158, depth=.04, matrix=T(.015, 0, 1.955)), 'head', STEEL_D, METAL)
part(bmesh.ops.create_cube(bm, size=1, matrix=T(.155, 0, 1.885) @ S(.02, .035, .13)), 'head', STEEL_D, METAL)
# Kettenhaube im Nacken
part(bmesh.ops.create_cone(bm, cap_ends=False, segments=10, radius1=.15, radius2=.14, depth=.2, matrix=T(-.035, 0, 1.85) @ S(.8, 1, 1)), 'head', STEEL_D, METAL, True)
# Fellkragen, Schulterstücke
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=.2, radius2=.13, depth=.1, matrix=T(0, 0, 1.69) @ S(.85, 1.25, 1)), 'chest', FUR, MATTE, True)
for sg, s in ((1, 'L'), (-1, 'R')):
    part(bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=.115, matrix=T(0, .285 * sg, 1.6) @ S(1, 1, .75)), 'upperarm.' + s, STEEL, METAL, True)
# Waffenrock (Schoß) und Gürtel
part(bmesh.ops.create_cone(bm, cap_ends=False, segments=12, radius1=.27, radius2=.185, depth=.36, matrix=T(0, 0, .9) @ S(.82, 1, 1)), 'hips', BLUE, MATTE, True)
part(bmesh.ops.create_cone(bm, cap_ends=False, segments=12, radius1=.2, radius2=.2, depth=.07, matrix=T(0, 0, 1.09) @ S(.84, 1, 1)), 'hips', LEATHER, MATTE)
part(bmesh.ops.create_cube(bm, size=1, matrix=T(.165, 0, 1.09) @ S(.02, .07, .08)), 'hips', STEEL, METAL)
# Brustplatte vorn
part(bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=.17, matrix=T(.06, 0, 1.45) @ S(.55, 1.05, 1.15)), 'chest', STEEL_D, METAL, True)
# Umhang: Fläche hinter dem Rücken, oben an der Brust, unten an der Hüfte geführt
g = bmesh.ops.create_grid(bm, x_segments=3, y_segments=5, size=.5, matrix=T(-.175, 0, 1.17) @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ S(1.02, .46, 1))
for v in g['verts']:
    t = (1.68 - v.co.z) / 1.0; v.co.x -= .1 * t * t; v.co.y *= 1 + .25 * t  # nach unten weiter und ausgestellt
    v[L_BONE] = BI['chest' if v.co.z > 1.2 else 'hips'] + 1
paint({f for v in g['verts'] for f in v.link_faces}, BLUE_D, MATTE, True)
# Rundschild am linken Unterarm: Holz, Stahlrand, Buckel
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.33, radius2=.33, depth=.035, matrix=T(.04, .455, 1.12) @ RX), 'forearm.L', BLUE, MATTE)
part(bmesh.ops.create_cone(bm, cap_ends=False, segments=16, radius1=.345, radius2=.345, depth=.045, matrix=T(.04, .455, 1.12) @ RX), 'forearm.L', STEEL_D, METAL)
part(bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=.085, matrix=T(.04, .48, 1.12) @ S(1, .6, 1)), 'forearm.L', STEEL, METAL, True)
part(bmesh.ops.create_cube(bm, size=1, matrix=T(.04, .476, 1.12) @ S(.05, .012, .6)), 'forearm.L', FUR, MATTE)
# Speer: Schaft und Blatt, am eigenen Knochen (damit er im Stoß nach vorn kippen kann)
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=.02, radius2=.02, depth=2.25, matrix=T(.06, -.38, 1.2)), 'spear', WOOD, MATTE)
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=.05, radius2=.0, depth=.3, matrix=T(.06, -.38, 2.47) @ S(1, .35, 1)), 'spear', STEEL, METAL)
part(bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=.03, radius2=.03, depth=.07, matrix=T(.06, -.38, 2.3)), 'spear', STEEL_D, METAL)

bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces])
bmesh.ops.triangulate(bm, faces=bm.faces[:])
mesh = bpy.data.meshes.new('wacht_melee'); bm.verts.ensure_lookup_table()
rigid = [v[L_BONE] for v in bm.verts]; coords = [v.co.copy() for v in bm.verts]
bm.to_mesh(mesh); bm.free()

def material(name, metallic, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = False
    b = m.node_tree.nodes['Principled BSDF']; a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
    m.node_tree.links.new(a.outputs['Color'], b.inputs['Base Color']); b.inputs['Metallic'].default_value = metallic; b.inputs['Roughness'].default_value = rough
    return m
mesh.materials.append(material('matt', 0, .85)); mesh.materials.append(material('metall', .85, .42))
obj = bpy.data.objects.new('wacht_melee', mesh); scene.collection.objects.link(obj)

# ---------- Armatur ----------
arm_d = bpy.data.armatures.new('skelett'); arm = bpy.data.objects.new('skelett', arm_d); scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for n, h, t, p in BONES:
    b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
    if p: b.parent = arm_d.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

# Gewichte: starre Teile ganz an ihren Knochen, Körper nach Abstand zu den zwei nächsten Knochen (Seiten getrennt)
def seg_dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
segs = [(n, Vector(h), Vector(t)) for n, h, t, _p in BONES if n != 'spear']
groups = {n: obj.vertex_groups.new(name=n) for n, *_r in BONES}
for i, co in enumerate(coords):
    if rigid[i]: groups[BONES[rigid[i] - 1][0]].add([i], 1, 'REPLACE'); continue
    ws = []
    for n, a, b in segs:
        if (n.endswith('.L') and co.y < -.01) or (n.endswith('.R') and co.y > .01): continue
        ws.append((1 / (seg_dist(co, a, b) + .03) ** 4, n))
    ws.sort(reverse=True); ws = ws[:2]; tot = sum(w for w, _n in ws)
    for w, n in ws:
        if w / tot > .04: groups[n].add([i], w / tot, 'REPLACE')
obj.parent = arm; md = obj.modifiers.new('armatur', 'ARMATURE'); md.object = arm

# ---------- Animationen ----------
arm.animation_data_create()
for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
REST = {b.name: b.matrix_local.to_3x3() for b in arm_d.bones}
AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}
def q(bone, *rots):  # Drehungen um Weltachsen (im Ruhezustand), nacheinander
    out = Quaternion()
    for ax, ang in rots: out = Quaternion(REST[bone].inverted() @ AX[ax], ang) @ out
    return out
# Grundhaltung: Speerarm angewinkelt, Speer aufrecht; Schildarm angewinkelt vor dem Körper
BASE = {'forearm.R': [('Y', -1.15)], 'upperarm.R': [('Y', .12)], 'spear': [('Y', 1.03)], 'upperarm.L': [('Y', -.25), ('Z', -.2)], 'forearm.L': [('Y', -1.0)]}
def pose(frame, rots=None, hips=(0, 0, 0)):
    rots = rots or {}
    for pb in arm.pose.bones:
        r = BASE.get(pb.name, []) + rots.get(pb.name, []) if pb.name not in (rots.get('_replace') or ()) else rots.get(pb.name, [])
        pb.rotation_quaternion = q(pb.name, *r); pb.keyframe_insert('rotation_quaternion', frame=frame)
    hb = arm.pose.bones['hips']; hb.location = REST['hips'].inverted() @ Vector(hips); hb.keyframe_insert('location', frame=frame)
def action(name, keys):
    act = bpy.data.actions.new(name); arm.animation_data.action = act
    for k in keys: pose(*k)
    for fc in ([c for l in act.layers for s in l.strips for cb in s.channelbags for c in cb.fcurves] if hasattr(act, 'layers') else act.fcurves):
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, act)
    arm.animation_data.action = None

def step(a, lift_l, lift_r):  # a > 0: linkes Bein vorn
    return {'thigh.L': [('Y', -a)], 'thigh.R': [('Y', a)], 'shin.L': [('Y', lift_l)], 'shin.R': [('Y', lift_r)],
            'upperarm.L': [('Y', a * .35)], 'upperarm.R': [('Y', -a * .2)], 'spine': [('Z', -a * .12), ('Y', .05)], 'chest': [('Z', -a * .1)]}
action('stehen', [(1,), (25, {'chest': [('Y', .035)], 'spine': [('Y', .02)], 'head': [('Y', -.03)], 'upperarm.L': [('Y', .03)]}, (0, 0, -.008)), (49,)])
action('gehen', [(1, step(.5, .12, .25), (0, 0, -.03)), (7, step(0, .1, .85), (0, 0, .015)), (13, step(-.5, .25, .12), (0, 0, -.03)), (19, step(0, .85, .1), (0, 0, .015)), (25, step(.5, .12, .25), (0, 0, -.03))])
def thrust(ua, fa, lean, twist, lunge):
    return {'_replace': ('upperarm.R', 'forearm.R', 'spear'), 'upperarm.R': [('Y', ua)], 'forearm.R': [('Y', fa)], 'spear': [('Y', math.pi / 2 - ua - fa)],
            'spine': [('Y', lean), ('Z', twist)], 'chest': [('Z', twist)], 'thigh.L': [('Y', -lunge)], 'shin.L': [('Y', lunge * .9)], 'thigh.R': [('Y', lunge * .5)]}
action('angriff', [(1,), (6, thrust(.75, -1.5, -.08, -.3, .1), (-.05, 0, 0)), (10, thrust(-1.15, -.25, .28, .3, .5), (.16, 0, -.07)), (13, thrust(-1.15, -.25, .28, .3, .5), (.16, 0, -.07)), (21,)])
action('arbeit', [(1,), (9, thrust(.75, -1.5, -.08, -.3, .1), (-.05, 0, 0)), (15, thrust(-1.15, -.25, .28, .3, .5), (.16, 0, -.07)), (25,)])
fall = lambda a, dz, extra=None: ({'hips': [('Y', a)], 'head': [('Y', a * .15)], 'upperarm.L': [('Y', -a * .5)], 'thigh.L': [('Y', -a * .25)], 'shin.R': [('Y', a * .4)], **(extra or {})}, (a * .25, 0, dz))
action('tod', [(1,), (8, *fall(.35, -.08)), (18, *fall(1.45, -.72)), (22, *fall(1.52, -.8)), (30, *fall(1.52, -.8))])
for pb in arm.pose.bones: pb.rotation_quaternion = q(pb.name, *BASE.get(pb.name, [])); pb.location = (0, 0, 0)

# ---------- Ausgabe ----------
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_animation_mode='NLA_TRACKS', export_yup=True, export_skins=True,
                          export_vertex_color='MATERIAL', export_anim_single_armature=True, export_force_sampling=True, export_optimize_animation_size=True)
print('GLB:', os.path.abspath(OUT), os.path.getsize(os.path.abspath(OUT)), 'Bytes,', len(mesh.polygons), 'Dreiecke')

if PREVIEW:  # Vorschaubild: vier Ansichten (Grundhaltung, Schritt, Stoß, von hinten)
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70; cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 4; sun = bpy.data.objects.new('sun', sun_d); sun.rotation_euler = (.9, .2, .6); scene.collection.objects.link(sun)
    world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs[0].default_value = (.32, .36, .42, 1); world.node_tree.nodes['Background'].inputs[1].default_value = 1.2; scene.world = world
    scene.render.resolution_x = 700; scene.render.resolution_y = 900
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
        try: scene.render.engine = eng; break
        except TypeError: pass
    tracks = {t.name: t for t in arm.animation_data.nla_tracks}
    shots = [('a', 'stehen', 1, 5.2, -4.2), ('b', 'gehen', 1, 6.5, -1.0), ('c', 'angriff', 10, 6.5, -2.2), ('d', 'stehen', 1, -5.0, 4.0)]
    for tag, anim, frame, cx, cy in shots:
        for t in tracks.values(): t.mute = t.name != anim
        scene.frame_set(frame)
        cam.location = (cx, cy, 2.1); d = Vector((.15, 0, 1.15)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = PREVIEW.replace('.png', '_' + tag + '.png'); bpy.ops.render.render(write_still=True)
    print('Vorschau:', PREVIEW)
