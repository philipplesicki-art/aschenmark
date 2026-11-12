# Figuren-Bibliothek: ein gemeinsamer Körper mit Skelett, Rüstzeug als starre Teile, Bewegungsabläufe je Waffe.
# Jede Einheit entsteht aus begin() -> Rüstzeug (helm, rock, schild, waffe ...) -> finish().
# Maße wie im Spiel: 1 Meter = 1 Spieleinheit, vorne +X, links +Y, Ursprung zwischen den Füßen, Höhe etwa 2,2.
# Drehsinn der Posen: Drehung um Y, positiv = ein hängendes Glied schwingt nach hinten, ein aufrechtes Teil kippt nach vorn.
import bpy, bmesh, os, math
from mathutils import Vector, Matrix, Quaternion

MATTE, METAL = 0, 1
def lin(c): return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c)
def hexc(h): return lin(((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255))
T = lambda x, y, z: Matrix.Translation((x, y, z))
def S(x, y, z): return Matrix.Diagonal((x, y, z, 1))
RX = Matrix.Rotation(math.pi / 2, 4, 'X')
def RY(a): return Matrix.Rotation(a, 4, 'Y')
def RXa(a): return Matrix.Rotation(a, 4, 'X')

# Farbsätze der Fraktionen (sRGB). Kräftiger als früher: die Figuren sollen aus der Schrägsicht sofort zuzuordnen sein.
PAL = {
    'wacht': dict(skin=0xb98f76, tunic=0x27425f, tunic_d=0x18293d, trouser=0x2b2d33, leather=0x3d2c22, wood=0x5a4230, fur=0x9a968c, steel=0x6c7279, steel_d=0x3a3e44, trim=0x8a6a2e, cloth=0x8d8672),
    'asch': dict(skin=0x8f7a70, tunic=0x6a1c14, tunic_d=0x3a100c, trouser=0x1f1c1b, leather=0x2a201c, wood=0x3a2c24, fur=0x2c2725, steel=0x3e3c42, steel_d=0x1f1e23, trim=0xa4521f, cloth=0x6a6058),
    'salz': dict(skin=0xb08c74, tunic=0x275f5a, tunic_d=0x163c39, trouser=0x33343a, leather=0x4a3e32, wood=0x6a563c, fur=0xb8b3a4, steel=0x737c7e, steel_d=0x424c4e, trim=0x9a8f72, cloth=0xa9a392),
}
HAND_R, HAND_L = (.06, -.38, .95), (.07, .38, .93)
ST = {}

def begin(name, fac, bulk=1.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.fps = 24
    P = {k: hexc(v) for k, v in PAL[fac].items()}
    b = bulk
    # Strichskelett -> Skin -> einmal Subdivision. Hände und Füße etwas kräftiger: liest sich aus der Ferne besser.
    SK = [('pelvis', (0, 0, 1.00), (.17 * b, .15 * b), None), ('waist', (0, 0, 1.22), (.15 * b, .12 * b), 'pelvis'), ('chest', (0, 0, 1.50), (.19 * b, .13 * b), 'waist'),
          ('neck', (0, 0, 1.72), (.065, .065), 'chest'), ('head1', (.01, 0, 1.82), (.105, .105), 'neck'), ('head2', (.015, 0, 1.93), (.13, .125), 'head1'), ('head3', (.01, 0, 2.03), (.085, .085), 'head2')]
    for s, sg in (('L', 1), ('R', -1)):
        SK += [('hip' + s, (0, .11 * sg, .96), (.105 * b, .105 * b), 'pelvis'), ('knee' + s, (.02, .12 * sg, .55), (.078 * b, .078 * b), 'hip' + s),
               ('ankle' + s, (0, .12 * sg, .11), (.068, .068), 'knee' + s), ('toe' + s, (.16, .12 * sg, .055), (.06, .05), 'ankle' + s),
               ('sho' + s, (0, .27 * sg, 1.58), (.085 * b, .085 * b), 'chest'), ('elb' + s, (0, .36 * sg, 1.28), (.064 * b, .064 * b), 'sho' + s),
               ('wri' + s, (.05, .38 * sg, 1.00), (.05, .05), 'elb' + s), ('hand' + s, (.07, .38 * sg, .91), (.06, .048), 'wri' + s)]
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
    ST.clear(); ST.update(name=name, fac=fac, P=P, bm=bm, scene=scene, base={}, kind='hieb',
                          L_BONE=bm.verts.layers.int.new('bone'), L_COL=bm.loops.layers.float_color.new('Col'))
    BONES = [('hips', (0, 0, .98), (0, 0, 1.2), None), ('spine', (0, 0, 1.2), (0, 0, 1.45), 'hips'), ('chest', (0, 0, 1.45), (0, 0, 1.7), 'spine'), ('head', (0, 0, 1.7), (0, 0, 2.05), 'chest')]
    for s, sg in (('L', 1), ('R', -1)):
        BONES += [('upperarm.' + s, (0, .27 * sg, 1.58), (0, .36 * sg, 1.28), 'chest'), ('forearm.' + s, (0, .36 * sg, 1.28), (.06, .38 * sg, .93), 'upperarm.' + s),
                  ('thigh.' + s, (0, .11 * sg, .96), (.02, .12 * sg, .55), 'hips'), ('shin.' + s, (.02, .12 * sg, .55), (0, .12 * sg, .08), 'thigh.' + s)]
    BONES.append(('weapon', (.06, -.38, .95), (.06, -.38, 1.35), 'forearm.R'))
    ST['BONES'] = BONES; ST['BI'] = {n: i for i, (n, *_r) in enumerate(BONES)}
    bm.faces.ensure_lookup_table()
    for f in bm.faces:  # Körper nach Lage einfärben
        c = f.calc_center_median(); ay = abs(c.y)
        if c.z > 1.70: col = 'skin'
        elif ay > .245 and c.z < 1.52: col = 'skin' if c.z < .985 else 'leather' if c.z < 1.17 else 'tunic'
        elif c.z > .97: col = 'tunic'
        elif c.z < .40: col = 'leather'
        else: col = 'trouser'
        paint([f], P[col], MATTE)
    for sg in (1, -1):  # Augen: zwei dunkle Punkte, damit das Gesicht eine Richtung hat
        box('head', 'tunic_d', MATTE, T(.138, .047 * sg, 1.945) @ S(.02, .028, .034))

def paint(faces, col, mat, smooth=True, jitter=.05):
    L_COL = ST['L_COL']
    for f in faces:
        k = 1 + (((f.index * 2654435761) >> 8 & 255) / 255 - .5) * jitter
        f.material_index = mat; f.smooth = smooth
        for l in f.loops: l[L_COL] = (col[0] * k, col[1] * k, col[2] * k, 1)

def part(res, bone, col, mat=MATTE, smooth=False):
    vs = set(res['verts'])
    for v in vs: v[ST['L_BONE']] = ST['BI'][bone] + 1
    paint({f for v in vs for f in v.link_faces if all(w in vs for w in f.verts)}, ST['P'][col], mat, smooth)

def cone(bone, col, mat, r1, r2, depth, m, seg=12, caps=True, smooth=True):
    part(bmesh.ops.create_cone(ST['bm'], cap_ends=caps, segments=seg, radius1=r1, radius2=r2, depth=depth, matrix=m), bone, col, mat, smooth)
def box(bone, col, mat, m):
    part(bmesh.ops.create_cube(ST['bm'], size=1, matrix=m), bone, col, mat)
def ball(bone, col, mat, r, m, smooth=True):
    part(bmesh.ops.create_uvsphere(ST['bm'], u_segments=8, v_segments=5, radius=r, matrix=m), bone, col, mat, smooth)

# ---------- Kopfbedeckungen ----------
def helm_kegel(plume=None):  # Grenzwacht: Kegelhelm mit Krempe, Nasenschutz, Kettenhaube
    cone('head', 'steel', METAL, .158, .035, .26, T(.015, 0, 2.07))
    cone('head', 'steel_d', METAL, .175, .158, .04, T(.015, 0, 1.955), smooth=False)
    box('head', 'steel_d', METAL, T(.155, 0, 1.885) @ S(.02, .035, .13))
    cone('head', 'steel_d', METAL, .15, .14, .2, T(-.035, 0, 1.85) @ S(.8, 1, 1), seg=10, caps=False)
    if plume: cone('head', plume, MATTE, .035, .075, .34, T(-.06, 0, 2.3) @ RY(-.5) @ S(1, .5, 1), seg=6)
def helm_horn(big=False):  # Aschenhorde: Schädelkappe mit Hörnern und Gesichtsplatte
    ball('head', 'steel_d', METAL, .152, T(.012, 0, 1.985) @ S(1.02, 1.04, .8))
    box('head', 'steel', METAL, T(.152, 0, 1.9) @ S(.02, .04, .16))  # Nasenschutz
    k = 1.35 if big else 1
    for sg in (1, -1):
        cone('head', 'cloth', MATTE, .045 * k, .0, .26 * k, T(0, .17 * sg, 2.1) @ RXa(-.75 * sg), seg=6)
def helm_krempe(plume=None):  # Salzbund: Eisenhut mit breiter Krempe
    cone('head', 'steel_d', METAL, .255, .15, .05, T(.012, 0, 1.99))
    ball('head', 'steel', METAL, .15, T(.012, 0, 2.0) @ S(1, 1, .72))
    if plume: ball('head', plume, MATTE, .05, T(.012, 0, 2.13))
def kapuze(col='cloth'):  # Kapuze: lässt das Gesicht frei
    ball('head', col, MATTE, .16, T(-.045, 0, 1.955) @ S(1, 1.03, 1.06))
    cone('chest', col, MATTE, .21, .13, .1, T(-.01, 0, 1.69) @ S(.9, 1.2, 1), seg=10)
def helm_topf():  # Elite: geschlossener Topfhelm mit Sehschlitz
    cone('head', 'steel', METAL, .158, .15, .3, T(.012, 0, 1.94), smooth=True)
    cone('head', 'steel_d', METAL, .15, .06, .05, T(.012, 0, 2.115))
    box('head', 'tunic_d', MATTE, T(.158, 0, 1.96) @ S(.02, .2, .028))
    box('head', 'trim', METAL, T(.16, 0, 1.94) @ S(.012, .03, .26))

# ---------- Rumpf ----------
def kragen(col='fur'):
    cone('chest', col, MATTE, .2, .13, .1, T(0, 0, 1.69) @ S(.85, 1.25, 1), seg=10)
def schultern(col='steel', spikes=False):
    for sg, s in ((1, 'L'), (-1, 'R')):
        ball('upperarm.' + s, col, METAL if col.startswith('steel') else MATTE, .118, T(0, .285 * sg, 1.6) @ S(1, 1, .75))
        if spikes: cone('upperarm.' + s, 'steel', METAL, .035, 0, .16, T(0, .33 * sg, 1.7) @ RXa(-.5 * sg), seg=5)
def rock(col='tunic', lang=False):  # Waffenrock mit Gürtel; lang = Robe bis zu den Knöcheln
    if lang: cone('hips', col, MATTE, .31, .19, .82, T(0, 0, .68) @ S(.85, 1, 1), caps=False)
    else: cone('hips', col, MATTE, .27, .185, .36, T(0, 0, .9) @ S(.82, 1, 1), caps=False)
    cone('hips', 'leather', MATTE, .2, .2, .07, T(0, 0, 1.09) @ S(.84, 1, 1), caps=False, smooth=False)
    box('hips', 'trim', METAL, T(.165, 0, 1.09) @ S(.02, .07, .08))
def brustplatte(col='steel_d'):
    ball('chest', col, METAL, .17, T(.06, 0, 1.45) @ S(.55, 1.05, 1.15))
def wappen(col='trim'):  # Wappenschild auf der Brust
    box('chest', col, MATTE, T(.165, 0, 1.47) @ S(.012, .12, .15))
def umhang(col='tunic_d'):
    bm = ST['bm']
    g = bmesh.ops.create_grid(bm, x_segments=3, y_segments=5, size=.5, matrix=T(-.175, 0, 1.17) @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ S(1.02, .46, 1))
    for v in g['verts']:
        t = (1.68 - v.co.z) / 1.0; v.co.x -= .1 * t * t; v.co.y *= 1 + .25 * t
        v[ST['L_BONE']] = ST['BI']['chest' if v.co.z > 1.2 else 'hips'] + 1
    paint({f for v in g['verts'] for f in v.link_faces}, ST['P'][col], MATTE, True)
def rucksack(col='leather'):
    box('chest', col, MATTE, T(-.2, 0, 1.4) @ S(.16, .3, .34))
    cone('chest', 'cloth', MATTE, .07, .07, .34, T(-.2, 0, 1.6) @ RX, seg=8)
def koecher():
    cone('chest', 'leather', MATTE, .055, .045, .5, T(-.19, -.1, 1.45) @ RXa(.35), seg=8)
    for dx in (-.02, .02): box('chest', 'cloth', MATTE, T(-.19 + dx, -.19, 1.73) @ S(.012, .012, .1))

# ---------- Geschichtete Rüstung: viele überlappende Teile statt einer glatten Fläche ----------
def halsberge():
    cone('chest', 'steel_d', METAL, .175, .115, .1, T(.005, 0, 1.7) @ S(.9, 1.15, 1), seg=10)
    cone('chest', 'trim', METAL, .18, .18, .018, T(.005, 0, 1.655) @ S(.9, 1.15, 1), seg=10, caps=False, smooth=False)
def schulterplatten(col='steel', rand='trim'):  # drei Platten je Schulter, nach unten kleiner, mit Randleiste
    for sg, s_ in ((1, 'L'), (-1, 'R')):
        for i, (y, z, r) in enumerate(((.3, 1.64, .135), (.335, 1.555, .118), (.355, 1.47, .1))):
            ball('upperarm.' + s_, col if i != 1 else 'steel_d', METAL, r, T(0, y * sg, z) @ S(1.05, .95, .62))
            cone('upperarm.' + s_, rand, METAL, r * 1.04, r * 1.04, .014, T(0, y * sg, z - r * .3) @ S(1.05, .95, 1), seg=10, caps=False, smooth=False)
def kuerass(col='steel'):  # Brust- und Rückenplatte mit Grat, darunter Bauchreifen
    ball('chest', col, METAL, .175, T(.055, 0, 1.46) @ S(.6, 1.08, 1.15))
    ball('chest', 'steel_d', METAL, .17, T(-.05, 0, 1.46) @ S(.55, 1.05, 1.12))
    box('chest', 'trim', METAL, T(.158, 0, 1.47) @ S(.014, .022, .3))
    for z, r in ((1.27, .2), (1.2, .205), (1.14, .21)):
        cone('spine', 'steel_d' if z != 1.2 else col, METAL, r, r * .96, .075, T(0, 0, z) @ S(.82, 1, 1), seg=12, caps=False)
    for sg in (1, -1):  # Riemen und Schnallen an den Seiten
        box('chest', 'leather', MATTE, T(0, .19 * sg, 1.42) @ S(.2, .02, .035)); box('chest', 'trim', METAL, T(.06, .2 * sg, 1.42) @ S(.03, .012, .045))
def beintaschen(col='steel'):  # hängende Platten rund um die Hüfte
    for a in (-.75, -.25, .25, .75, 2.0, -2.0, 3.14):
        x, y = .21 * math.cos(a) * .84, .21 * math.sin(a)
        box('hips', col if abs(a) < 1 else 'steel_d', METAL, T(x, y, .93) @ Matrix.Rotation(a, 4, 'Z') @ RY(-.16) @ S(.022, .13, .26))
        box('hips', 'trim', METAL, T(x * 1.02, y * 1.02, .81) @ Matrix.Rotation(a, 4, 'Z') @ S(.026, .135, .02))
def kettenrock():
    cone('hips', 'steel_d', METAL, .255, .19, .3, T(0, 0, .93) @ S(.83, 1, 1), caps=False)
def armschienen(col='steel', leder=False):
    for sg, s_ in ((1, 'L'), (-1, 'R')):
        cone('forearm.' + s_, 'leather' if leder else col, MATTE if leder else METAL, .06, .072, .22, T(.025, .37 * sg, 1.14) @ RY(-.17), seg=8, caps=False)
        if not leder: cone('forearm.' + s_, 'trim', METAL, .075, .075, .016, T(.01, .365 * sg, 1.24), seg=8, caps=False, smooth=False)
        ball('forearm.' + s_, 'leather' if leder else 'steel_d', MATTE if leder else METAL, .064, T(.068, .38 * sg, .925) @ S(1, .85, 1.1))
def beinschienen(col='steel'):
    for sg, s_ in ((1, 'L'), (-1, 'R')):
        cone('shin.' + s_, col, METAL, .078, .092, .36, T(.012, .12 * sg, .33), seg=8, caps=False)
        ball('shin.' + s_, 'steel_d', METAL, .082, T(.05, .12 * sg, .55) @ S(.8, 1, 1))
        box('shin.' + s_, 'trim', METAL, T(.085, .12 * sg, .33) @ S(.012, .02, .3))
        box('shin.' + s_, 'steel_d', METAL, T(.1, .12 * sg, .065) @ S(.24, .13, .08))
def stiefelstulpen():
    for sg, s_ in ((1, 'L'), (-1, 'R')):
        cone('shin.' + s_, 'leather', MATTE, .082, .092, .07, T(.015, .12 * sg, .43), seg=8, caps=False, smooth=False)
        box('shin.' + s_, 'trim', METAL, T(.09, .12 * sg, .25) @ S(.012, .03, .03))
def taschen():  # Gürteltaschen, Dolch, Schnalle
    box('hips', 'leather', MATTE, T(.06, .2, 1.02) @ S(.1, .06, .12)); box('hips', 'trim', METAL, T(.06, .235, 1.04) @ S(.03, .01, .03))
    box('hips', 'leather', MATTE, T(-.1, -.19, 1.0) @ S(.09, .05, .1))
    cone('hips', 'leather', MATTE, .022, .012, .3, T(.1, -.2, .95) @ RY(.35), seg=6)
    box('hips', 'trim', METAL, T(.13, -.2, 1.1) @ S(.03, .06, .02))
def wappenrock(col='tunic', zeichen='trim'):  # Stoffbahn über der Rüstung, vorn und hinten, mit Zeichen
    box('hips', col, MATTE, T(.205, 0, .97) @ S(.014, .2, .62)); box('hips', col, MATTE, T(-.2, 0, .97) @ S(.014, .2, .58))
    box('hips', zeichen, MATTE, T(.214, 0, 1.0) @ S(.008, .09, .13)); box('hips', zeichen, MATTE, T(.214, 0, .69) @ S(.008, .2, .025))
def gurte():  # gekreuzte Lederriemen über dem Rumpf
    for sg in (1, -1):
        box('chest', 'leather', MATTE, T(.14, 0, 1.43) @ RXa(.6 * sg) @ S(.02, .04, .5))
        box('chest', 'leather', MATTE, T(-.135, 0, 1.43) @ RXa(.6 * sg) @ S(.02, .04, .5))
    box('chest', 'trim', METAL, T(.155, 0, 1.43) @ S(.014, .05, .05))
def steppwams():  # gesteppte Nähte auf dem Wams
    for z in (1.3, 1.42, 1.54):
        r = .192 if z < 1.5 else .2
        cone('chest' if z > 1.35 else 'spine', 'tunic_d', MATTE, r, r, .012, T(0, 0, z) @ S(.72, 1, 1), seg=12, caps=False, smooth=False)
def helm_schaller(plume=None):  # tief gezogener Helm mit Sehschlitz, Nackenschirm und Kamm
    ball('head', 'steel', METAL, .162, T(.012, 0, 1.99) @ S(1.08, 1.02, .86))
    cone('head', 'steel_d', METAL, .17, .15, .1, T(.02, 0, 1.9) @ S(1.08, 1.02, 1), seg=12, caps=False)
    box('head', 'tunic_d', MATTE, T(.172, 0, 1.935) @ S(.03, .2, .022))
    box('head', 'steel_d', METAL, T(-.14, 0, 1.9) @ RY(.5) @ S(.16, .22, .02))
    box('head', 'trim', METAL, T(.01, 0, 2.115) @ S(.26, .02, .04))
    cone('head', 'trim', METAL, .176, .176, .016, T(.02, 0, 1.955) @ S(1.08, 1.02, 1), seg=12, caps=False, smooth=False)
    if plume:
        for i in range(4): cone('head', plume, MATTE, .03, .05, .22, T(-.03 - i * .045, 0, 2.2 + i * .012) @ RY(-.5 - i * .25) @ S(1, .5, 1), seg=6)

# ---------- Schilde (am linken Unterarm) ----------
def _shield_base():
    ST['base'].update({'upperarm.L': [('Y', -.25), ('Z', -.2)], 'forearm.L': [('Y', -1.0)]})
def schild_rund(col='tunic'):
    cone('forearm.L', col, MATTE, .33, .33, .035, T(.04, .455, 1.12) @ RX, seg=16, smooth=False)
    cone('forearm.L', 'steel_d', METAL, .345, .345, .045, T(.04, .455, 1.12) @ RX, seg=16, caps=False, smooth=False)
    ball('forearm.L', 'steel', METAL, .085, T(.04, .48, 1.12) @ S(1, .6, 1))
    box('forearm.L', 'trim', MATTE, T(.04, .476, 1.12) @ S(.05, .012, .6))
    _shield_base()
def schild_turm(col='tunic'):  # hoher Schild der Elite
    box('forearm.L', col, MATTE, T(.04, .46, 1.1) @ S(.5, .04, .95))
    box('forearm.L', 'steel_d', METAL, T(.04, .47, 1.1) @ S(.54, .025, .08))
    box('forearm.L', 'steel_d', METAL, T(.04, .47, 1.1) @ S(.07, .025, .99))
    ball('forearm.L', 'trim', METAL, .07, T(.04, .49, 1.1) @ S(1, .6, 1))
    _shield_base()

# ---------- Waffen (am Knochen weapon, in der rechten Hand, im Ruhezustand aufrecht) ----------
def _w(kind, base): ST['kind'] = kind; ST['base'].update(base)
def speer(lang=2.25):
    x, y, z = HAND_R
    cone('weapon', 'wood', MATTE, .02, .02, lang, T(x, y, z + .25), seg=6, smooth=False)
    cone('weapon', 'steel', METAL, .05, .0, .3, T(x, y, z + .25 + lang / 2 + .14) @ S(1, .35, 1), seg=4, smooth=False)
    cone('weapon', 'steel_d', METAL, .03, .03, .07, T(x, y, z + .25 + lang / 2 - .03), seg=6, smooth=False)
    _w('stoss', {'forearm.R': [('Y', -1.15)], 'upperarm.R': [('Y', .12)], 'weapon': [('Y', 1.03)]})
def schwert(lang=.8, col='steel'):
    x, y, z = HAND_R
    cone('weapon', 'leather', MATTE, .022, .022, .16, T(x, y, z), seg=6, smooth=False)
    ball('weapon', 'trim', METAL, .035, T(x, y, z - .1))
    box('weapon', 'trim', METAL, T(x, y, z + .09) @ S(.2, .035, .035))
    box('weapon', col, METAL, T(x, y, z + .1 + lang / 2) @ S(.06, .014, lang))
    cone('weapon', col, METAL, .042, 0, .1, T(x, y, z + .15 + lang) @ S(1, .25, 1), seg=4, smooth=False)
    _w('hieb', {'forearm.R': [('Y', -.6)], 'weapon': [('Y', 1.25)]})
def axt(doppel=False):
    x, y, z = HAND_R
    cone('weapon', 'wood', MATTE, .022, .022, 1.0, T(x, y, z + .32), seg=6, smooth=False)
    for sg in ((1, -1) if doppel else (1,)):
        box('weapon', 'steel', METAL, T(x + .1 * sg, y, z + .72) @ S(.16, .025, .22))
        box('weapon', 'steel_d', METAL, T(x + .19 * sg, y, z + .72) @ S(.03, .02, .3))
    _w('hieb', {'forearm.R': [('Y', -.35)], 'weapon': [('Y', 1.25)]})
def hacke():
    x, y, z = HAND_R
    cone('weapon', 'wood', MATTE, .022, .022, .95, T(x, y, z + .3), seg=6, smooth=False)
    box('weapon', 'steel_d', METAL, T(x, y, z + .76) @ S(.46, .04, .05))
    cone('weapon', 'steel', METAL, .03, 0, .14, T(x + .29, y, z + .74) @ RY(math.pi / 2) @ S(1, .6, 1), seg=4, smooth=False)
    _w('hieb', {'forearm.R': [('Y', -1.6)], 'upperarm.R': [('Y', .1)], 'weapon': [('Y', .9)]})
def stab(orb='trim', banner=None):
    x, y, z = HAND_R
    cone('weapon', 'wood', MATTE, .022, .022, 2.1, T(x, y, z + .3), seg=6, smooth=False)
    if banner:
        box('weapon', 'wood', MATTE, T(x, y, z + 1.3) @ S(.03, .5, .03))
        box('weapon', banner, MATTE, T(x, y, z + .98) @ S(.012, .44, .6))
    else: ball('weapon', orb, METAL, .075, T(x, y, z + 1.42))
    _w('hieb', {'forearm.R': [('Y', -1.15)], 'upperarm.R': [('Y', .12)], 'weapon': [('Y', 1.03)]})
def bogen():  # liegt im Ruhezustand waagrecht an der linken Hand; beim Zielen (Arm nach vorn) steht er senkrecht
    hx, hy, hz = HAND_L; n = 8; pts = []
    for i in range(n + 1):
        t = -1 + 2 * i / n; pts.append((hx + .56 * t, hy + .03, hz - .15 * (1 - t * t)))
    for a, b in zip(pts, pts[1:]):
        dx, dz = b[0] - a[0], b[2] - a[2]; ln = math.hypot(dx, dz)
        box('forearm.L', 'wood', MATTE, T((a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2) @ RY(-math.atan2(dz, dx)) @ S(ln * 1.05, .022, .03))
    box('forearm.L', 'cloth', MATTE, T(hx, hy + .03, hz) @ S(1.12, .006, .006))
    ST['kind'] = 'schuss'; ST['base'].update({'forearm.L': [('Y', -.45)], 'upperarm.L': [('Y', -.1)], 'forearm.R': [('Y', -.25)]})

# ---------- Abnutzung als Textur ----------
def _worn(nm, metal):
    # Grundfarbe aus den Eckenfarben, dann: Flecken, Schmutz von unten her, im Metall Kratzer und Rost. Dazu Relief und wechselnde Rauheit.
    m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; N = nt.nodes; L = nt.links; b = N['Principled BSDF']
    vc = N.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    geo = N.new('ShaderNodeNewGeometry'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(geo.outputs['Position'], sep.inputs[0])
    def noise(scale, detail=4, rough=.6, stretch=None):
        n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
        if stretch:
            mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = stretch; L.new(geo.outputs['Position'], mp.inputs['Vector']); L.new(mp.outputs[0], n.inputs['Vector'])
        else: L.new(geo.outputs['Position'], n.inputs['Vector'])
        return n.outputs['Fac']
    def ramp(src, lo, hi):
        r = N.new('ShaderNodeMapRange'); r.inputs['From Min'].default_value = lo; r.inputs['From Max'].default_value = hi; r.clamp = True; L.new(src, r.inputs['Value']); return r.outputs['Result']
    def mixc(fac, a, bcol, mode='MIX'):
        x = N.new('ShaderNodeMix'); x.data_type = 'RGBA'; x.blend_type = mode
        if isinstance(fac, float): x.inputs['Factor'].default_value = fac
        else: L.new(fac, x.inputs['Factor'])
        L.new(a, x.inputs['A'])
        if isinstance(bcol, tuple): x.inputs['B'].default_value = bcol
        else: L.new(bcol, x.inputs['B'])
        return x.outputs['Result']
    def mul(a, k):
        x = N.new('ShaderNodeMath'); x.operation = 'MULTIPLY'; L.new(a, x.inputs[0])
        if isinstance(k, float): x.inputs[1].default_value = k
        else: L.new(k, x.inputs[1])
        return x.outputs[0]
    col = vc.outputs['Color']
    blotch = ramp(noise(9, 5, .65), .3, .7)                                   # große Flecken: heller und dunkler
    col = mixc(mul(blotch, .7), col, (.02, .018, .016, 1), 'MULTIPLY')
    fine = ramp(noise(70 if not metal else 120, 2, .5), .35, .75)             # feine Körnung: Gewebe oder Hammerschlag
    col = mixc(mul(fine, .3), col, (.5, .48, .45, 1), 'OVERLAY')
    low = N.new('ShaderNodeMapRange'); low.inputs['From Min'].default_value = .95; low.inputs['From Max'].default_value = .05; low.clamp = True; L.new(sep.outputs['Z'], low.inputs['Value'])
    mud = mul(low.outputs['Result'], ramp(noise(14, 4, .7), .35, .65))       # Schmutz: unten stark, nach oben auslaufend
    col = mixc(mul(mud, .8), col, (.07, .055, .04, 1))
    rgh = ramp(noise(30, 3, .6), 0, 1)
    if metal:
        scr = ramp(noise(26, 2, .5, stretch=(1.5, 1.5, 60)), .62, .74)        # Kratzer: lang gezogene helle Striche
        col = mixc(mul(scr, .28), col, (.6, .61, .63, 1))
        rust = ramp(noise(11, 5, .75), .58, .72)                             # Rostnester
        col = mixc(mul(rust, .75), col, (.2, .09, .04, 1))
        mt = N.new('ShaderNodeMapRange'); mt.inputs['From Min'].default_value = 0; mt.inputs['From Max'].default_value = 1; mt.inputs['To Min'].default_value = .38; mt.inputs['To Max'].default_value = .72; L.new(rgh, mt.inputs['Value'])
        L.new(mt.outputs['Result'], b.inputs['Roughness'])
    else:
        mt = N.new('ShaderNodeMapRange'); mt.inputs['To Min'].default_value = .78; mt.inputs['To Max'].default_value = .98; L.new(rgh, mt.inputs['Value'])
        L.new(mt.outputs['Result'], b.inputs['Roughness'])
    L.new(col, b.inputs['Base Color'])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .5 if metal else .35; bump.inputs['Distance'].default_value = .012
    L.new(noise(55 if metal else 90, 3, .6), bump.inputs['Height']); L.new(bump.outputs[0], b.inputs['Normal'])
    b.inputs['Metallic'].default_value = 0   # beim Backen der Farbe aus; das fertige Material setzt den Wert
    return m

def _bake(obj, name, size=512):
    import numpy as np
    scene = ST['scene']; me = obj.data
    me.materials.clear(); me.materials.append(_worn('matt_roh', False)); me.materials.append(_worn('metall_roh', True))
    for o in scene.objects: o.select_set(False)
    obj.select_set(True); bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 24; scene.render.bake.margin = 4
    def target(nm, cs='sRGB'):
        img = bpy.data.images.new(nm, size, size, alpha=False); img.colorspace_settings.name = cs
        for m in me.materials:
            nt = m.node_tree; n = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE'; n.image = img; nt.nodes.active = n
        return img
    col = target('farbe'); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    ao = target('schatten', 'Non-Color'); bpy.ops.object.bake(type='AO')
    nrm = target('relief', 'Non-Color'); bpy.ops.object.bake(type='NORMAL')
    rgh = target('rauheit', 'Non-Color'); bpy.ops.object.bake(type='ROUGHNESS')
    a = np.array(col.pixels[:], dtype=np.float32).reshape(-1, 4); s_ = np.array(ao.pixels[:], dtype=np.float32).reshape(-1, 4)
    a[:, :3] *= np.clip(.22 + .9 * s_[:, :3] ** 1.4, 0, 1.06); col.pixels.foreach_set(a.ravel()); col.update()   # Schatten in Fugen und unter Platten
    tmp = os.path.join(bpy.app.tempdir, name + '_')
    for img, suf in ((col, 'farbe.png'), (nrm, 'relief.png'), (rgh, 'rauheit.png')):
        img.filepath_raw = tmp + suf; img.file_format = 'PNG'; img.save()
    def baked(nm, metallic):
        m = bpy.data.materials.new(nm); m.use_nodes = True; m.use_backface_culling = False; nt = m.node_tree; b = nt.nodes['Principled BSDF']
        ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = col; nt.links.new(ti.outputs[0], b.inputs['Base Color'])
        tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm; nm_ = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs[0], nm_.inputs['Color']); nt.links.new(nm_.outputs[0], b.inputs['Normal'])
        tr = nt.nodes.new('ShaderNodeTexImage'); tr.image = rgh; nt.links.new(tr.outputs[0], b.inputs['Roughness'])
        b.inputs['Metallic'].default_value = metallic
        return m
    me.materials.clear(); me.materials.append(baked(name + '_matt', 0)); me.materials.append(baked(name + '_metall', .8))

# ---------- Fertigstellen: Netz, Skelett, Gewichte, Bewegungen, Ausgabe ----------
def finish(out, preview=None):
    bm, scene, BONES, name = ST['bm'], ST['scene'], ST['BONES'], ST['name']
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces])
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    mesh = bpy.data.meshes.new(name); bm.verts.ensure_lookup_table()
    rigid = [v[ST['L_BONE']] for v in bm.verts]; coords = [v.co.copy() for v in bm.verts]
    bm.to_mesh(mesh); bm.free()
    def material(nm, metallic, rough):
        m = bpy.data.materials.new(nm); m.use_nodes = True; m.use_backface_culling = False
        b = m.node_tree.nodes['Principled BSDF']; a = m.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
        m.node_tree.links.new(a.outputs['Color'], b.inputs['Base Color']); b.inputs['Metallic'].default_value = metallic; b.inputs['Roughness'].default_value = rough
        return m
    mesh.materials.append(material('matt', 0, .85)); mesh.materials.append(material('metall', .85, .42))
    obj = bpy.data.objects.new(name, mesh); scene.collection.objects.link(obj)
    if ST.get('bake', True): _bake(obj, name)
    arm_d = bpy.data.armatures.new('skelett'); arm = bpy.data.objects.new('skelett', arm_d); scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    for n, h, t, p in BONES:
        b = arm_d.edit_bones.new(n); b.head = h; b.tail = t
        if p: b.parent = arm_d.edit_bones[p]
    bpy.ops.object.mode_set(mode='OBJECT')
    def seg_dist(p, a, b):
        ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
    segs = [(n, Vector(h), Vector(t)) for n, h, t, _p in BONES if n not in ST.get('nosk', ('weapon',))]
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

    arm.animation_data_create()
    for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
    REST = {b.name: b.matrix_local.to_3x3() for b in arm_d.bones}
    AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}
    BASE = ST['base']; ROOT = ST.get('root', 'hips')
    def q(bone, *rots):
        o = Quaternion()
        for ax, ang in rots: o = Quaternion(REST[bone].inverted() @ AX[ax], ang) @ o
        return o
    def pose(frame, rots=None, hips=(0, 0, 0)):
        rots = rots or {}
        for pb in arm.pose.bones:
            r = BASE.get(pb.name, []) + rots.get(pb.name, []) if pb.name not in (rots.get('_replace') or ()) else rots.get(pb.name, [])
            pb.rotation_quaternion = q(pb.name, *r); pb.keyframe_insert('rotation_quaternion', frame=frame)
        hb = arm.pose.bones[ROOT]; hb.location = REST[ROOT].inverted() @ Vector(hips); hb.keyframe_insert('location', frame=frame)
    def action(nm, keys):
        act = bpy.data.actions.new(nm); arm.animation_data.action = act
        for k in keys: pose(*k)
        for fc in ([c for l in act.layers for s in l.strips for cb in s.channelbags for c in cb.fcurves] if hasattr(act, 'layers') else act.fcurves):
            for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
        tr = arm.animation_data.nla_tracks.new(); tr.name = nm; tr.strips.new(nm, 1, act)
        arm.animation_data.action = None
    def mix(*ds):
        o = {}
        for d in ds:
            for k, v in d.items(): o[k] = tuple(set(o.get(k, ())) | set(v)) if k == '_replace' else v
        return o
    # Waffenarm: Oberarm, Unterarm und die Neigung der Waffe im Raum (0 = senkrecht, positiv = nach vorn gekippt)
    def warm(ua, fa, tilt): return {'_replace': ('upperarm.R', 'forearm.R', 'weapon'), 'upperarm.R': [('Y', ua)], 'forearm.R': [('Y', fa)], 'weapon': [('Y', tilt - ua - fa)]}
    def torso(lean, twist): return {'spine': [('Y', lean), ('Z', twist)], 'chest': [('Z', twist * .8)], 'head': [('Z', -twist * .9), ('Y', -lean * .5)]}
    def legs(lunge): return {'thigh.L': [('Y', -lunge)], 'shin.L': [('Y', lunge * .9)], 'thigh.R': [('Y', lunge * .5)], 'shin.R': [('Y', lunge * .25)]}
    def step(a, lift_l, lift_r, sway=1):  # a > 0: linkes Bein vorn; Arme und Rumpf schwingen gegen
        return {'thigh.L': [('Y', -a)], 'thigh.R': [('Y', a)], 'shin.L': [('Y', lift_l)], 'shin.R': [('Y', lift_r)],
                'upperarm.L': [('Y', a * .38 * sway)], 'upperarm.R': [('Y', -a * .22 * sway)], 'spine': [('Z', -a * .14), ('Y', .06)], 'chest': [('Z', -a * .12)], 'head': [('Z', a * .2)]}

    haction = action if not ST.get('anim') else (lambda *a_, **k_: None)   # eigenes Skelett: eigene Bewegungen statt der menschlichen
    if ST.get('anim'): ST['anim'](action, mix)
    # Stehen: Gewicht wandert von einem Bein aufs andere, der Kopf sieht sich um
    haction('stehen', [(1,), (17, mix(torso(.03, .05), {'upperarm.L': [('Y', .04)], 'thigh.L': [('Y', -.03)]}), (0, .012, -.01)),
                      (33, mix(torso(.015, -.02), {'head': [('Z', .35)]}), (0, -.008, -.004)), (49, mix(torso(.03, -.06), {'thigh.R': [('Y', -.03)]}), (0, -.014, -.01)), (65,)])
    # Gehen: acht Stützpunkte, Auf und Ab der Hüfte, Fuß rollt ab
    haction('gehen', [(1, step(.55, .1, .3), (0, 0, -.035)), (4, step(.3, .05, .7), (0, .012, -.01)), (7, step(0, .1, .95), (0, .016, .02)), (10, step(-.3, .2, .45), (0, .008, -.005)),
                     (13, step(-.55, .3, .1), (0, 0, -.035)), (16, step(-.3, .7, .05), (0, -.012, -.01)), (19, step(0, .95, .1), (0, -.016, .02)), (22, step(.3, .45, .2), (0, -.008, -.005)), (25, step(.55, .1, .3), (0, 0, -.035))])
    kind = ST['kind']
    if kind == 'stoss':  # ausholen, zustoßen mit Ausfallschritt, nachfedern, zurück
        atk = [(1,), (5, mix(warm(.85, -1.55, 1.57), torso(-.1, -.35), legs(-.08)), (-.07, 0, -.01)), (8, mix(warm(-.6, -.9, 1.57), torso(.18, .1), legs(.3)), (.08, 0, -.04)),
               (10, mix(warm(-1.2, -.2, 1.6), torso(.3, .34), legs(.55)), (.18, 0, -.08)), (13, mix(warm(-1.1, -.3, 1.55), torso(.26, .3), legs(.5)), (.16, 0, -.07)), (18, mix(warm(.2, -1.2, 1.2), torso(.05, 0), legs(.12)), (.03, 0, -.02)), (23,)]
    elif kind == 'schuss':  # seitlich stellen, Bogen heben, ausziehen, lösen, nachhalten
        def aim(draw, tw=-.55): return {'_replace': ('upperarm.L', 'forearm.L', 'upperarm.R', 'forearm.R'), 'upperarm.L': [('Y', -1.5)], 'forearm.L': [('Y', -.05)], 'upperarm.R': [('Y', -1.3)], 'forearm.R': [('Y', draw)],
                                    'spine': [('Z', tw * .6)], 'chest': [('Z', tw * .5)], 'head': [('Z', -tw * 1.0)], 'thigh.L': [('Y', -.12)], 'thigh.R': [('Y', .1)]}
        atk = [(1,), (5, aim(-.5, -.3), (0, 0, -.01)), (10, aim(-1.5), (-.02, 0, -.02)), (14, aim(-2.0), (-.03, 0, -.02)), (15, aim(-.6), (.01, 0, -.02)), (19, aim(-.5), (0, 0, -.015)), (26,)]
    else:  # Hieb: über die Schulter ausholen, mit dem ganzen Körper durchziehen
        atk = [(1,), (5, mix(warm(-.5, -1.9, -.9), torso(-.14, -.4), legs(-.08)), (-.07, 0, 0)), (8, mix(warm(-2.3, -.6, -.5), torso(-.16, -.3), legs(.05)), (-.03, 0, .02)),
               (11, mix(warm(-1.05, -.35, 1.85), torso(.34, .36), legs(.5)), (.17, 0, -.09)), (14, mix(warm(-.8, -.3, 2.05), torso(.36, .4), legs(.5)), (.17, 0, -.1)), (19, mix(warm(-.2, -.9, 1.3), torso(.1, .1), legs(.15)), (.04, 0, -.03)), (24,)]
    haction('angriff', atk)
    haction('arbeit', [(1,), (7, mix(warm(-2.3, -.6, -.5), torso(-.14, -.2)), (-.02, 0, .02)), (11, mix(warm(-.9, -.4, 1.9), torso(.4, .2), legs(.25)), (.08, 0, -.1)), (14, mix(warm(-.8, -.4, 2.0), torso(.4, .2), legs(.25)), (.08, 0, -.1)), (21,)])
    def fall(a, dz, tw=0): return ({'hips': [('Y', a), ('Z', tw)], 'head': [('Y', a * .2)], 'upperarm.L': [('Y', -a * .7)], 'upperarm.R': [('Y', -a * .4)], 'thigh.L': [('Y', -a * .3)], 'shin.R': [('Y', a * .5)], 'shin.L': [('Y', a * .2)]}, (a * .25, 0, dz))
    haction('tod', [(1,), (4, mix(torso(-.25, .2), {'head': [('Y', -.3)]}), (-.08, 0, -.02)), (10, *fall(.5, -.14, .15)), (17, *fall(1.42, -.7, .25)), (20, *fall(1.56, -.82, .25)), (23, *fall(1.5, -.79, .25)), (30, *fall(1.52, -.8, .25))])
    for pb in arm.pose.bones: pb.rotation_quaternion = q(pb.name, *BASE.get(pb.name, [])); pb.location = (0, 0, 0)

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_animation_mode='NLA_TRACKS', export_yup=True, export_skins=True,
                              export_vertex_color='NONE', export_image_format='JPEG', export_jpeg_quality=88, export_anim_single_armature=True, export_force_sampling=True, export_optimize_animation_size=True)
    print('GLB:', os.path.abspath(out), os.path.getsize(os.path.abspath(out)), 'Bytes,', len(mesh.polygons), 'Dreiecke')
    if preview:  # zwei Ansichten: Grundhaltung von vorn, Angriff von der Seite
        cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 70; cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
        sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 4; sun = bpy.data.objects.new('sun', sun_d); sun.rotation_euler = (.9, .2, .6); scene.collection.objects.link(sun)
        world = bpy.data.worlds.new('w'); world.use_nodes = True; world.node_tree.nodes['Background'].inputs[0].default_value = (.32, .36, .42, 1); world.node_tree.nodes['Background'].inputs[1].default_value = 1.2; scene.world = world
        scene.render.resolution_x = 520; scene.render.resolution_y = 640
        for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT', 'BLENDER_WORKBENCH'):
            try: scene.render.engine = eng; break
            except TypeError: pass
        tracks = {t.name: t for t in arm.animation_data.nla_tracks}
        hit = ST.get('hit') or (14 if kind == 'schuss' else 11 if kind == 'hieb' else 10)
        for tag, anim, frame, cx, cy in (('a', 'stehen', 1, 5.4, -3.6), ('b', 'angriff', hit, 2.5, -6.2), ('c', 'gehen', 4, 5.8, -2.4)):
            for t in tracks.values(): t.mute = t.name != anim
            scene.frame_set(frame)
            k_ = ST.get('camk', 1); cam.location = (cx * k_, cy * k_, 2.0 * k_); d = Vector((.2, 0, 1.2 * k_)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = preview.replace('.png', '_' + tag + '.png'); bpy.ops.render.render(write_still=True)
