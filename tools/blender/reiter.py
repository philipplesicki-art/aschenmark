# Reiter der drei Fraktionen: Pferd mit eigenem Skelett, Reiter als starre Teile im Sattel, Lanze am eigenen Knochen.
# Aufruf: blender --background --python tools/blender/reiter.py -- [Vorschauordner oder -] [nur: Teil des Namens]
# Nutzt Netz-, Back- und Ausgabewege der Figuren-Bibliothek (lib_figur.py). Vorne +X, links +Y.
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy, bmesh, importlib, lib_figur as F
from mathutils import Matrix
importlib.reload(F)
T, S, RX, RY, RXa, MATTE, METAL = F.T, F.S, F.RX, F.RY, F.RXa, F.MATTE, F.METAL

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else ''
OUT = os.path.join(HERE, '..', '..', 'public', 'models')
COAT = {'wacht': (0x4a3526, 0x21160f), 'asch': (0x1c1a1a, 0x0c0b0b), 'salz': (0x77736a, 0x3a3833)}  # Fell, Mähne

def begin(name, fac):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.fps = 24
    P = {k: F.hexc(v) for k, v in F.PAL[fac].items()}; P['coat'] = F.hexc(COAT[fac][0]); P['mane'] = F.hexc(COAT[fac][1])
    SK = [('rump', (-.75, 0, 1.25), (.3, .3), None), ('barrel', (-.2, 0, 1.22), (.34, .33), 'rump'), ('chest', (.45, 0, 1.3), (.31, .3), 'barrel'),
          ('neck1', (.75, 0, 1.6), (.19, .15), 'chest'), ('neck2', (.95, 0, 1.95), (.14, .12), 'neck1'), ('head1', (1.2, 0, 1.98), (.125, .11), 'neck2'), ('muzzle', (1.45, 0, 1.8), (.085, .08), 'head1'),
          ('tail1', (-1.05, 0, 1.3), (.07, .07), 'rump'), ('tail2', (-1.28, 0, .75), (.06, .06), 'tail1')]
    for s, sg in (('L', 1), ('R', -1)):
        SK += [('fsh' + s, (.45, .18 * sg, 1.05), (.155, .15), 'chest'), ('fkn' + s, (.48, .18 * sg, .6), (.095, .095), 'fsh' + s), ('ffe' + s, (.46, .18 * sg, .15), (.075, .075), 'fkn' + s), ('fho' + s, (.52, .18 * sg, .045), (.1, .095), 'ffe' + s),
               ('hhi' + s, (-.75, .2 * sg, 1.0), (.175, .17), 'rump'), ('hho' + s, (-.86, .2 * sg, .6), (.1, .1), 'hhi' + s), ('hfe' + s, (-.78, .2 * sg, .15), (.075, .075), 'hho' + s), ('hhf' + s, (-.72, .2 * sg, .045), (.1, .095), 'hfe' + s)]
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
    BONES = [('body', (-.75, 0, 1.25), (.45, 0, 1.3), None), ('neck', (.45, 0, 1.3), (.95, 0, 1.95), 'body'), ('head', (.95, 0, 1.95), (1.45, 0, 1.8), 'neck'), ('tail', (-1.0, 0, 1.3), (-1.28, 0, .75), 'body')]
    for s, sg in (('L', 1), ('R', -1)):
        BONES += [('fu.' + s, (.45, .18 * sg, 1.05), (.48, .18 * sg, .6), 'body'), ('fl.' + s, (.48, .18 * sg, .6), (.5, .18 * sg, .04), 'fu.' + s),
                  ('hu.' + s, (-.75, .2 * sg, 1.0), (-.86, .2 * sg, .6), 'body'), ('hl.' + s, (-.86, .2 * sg, .6), (-.74, .2 * sg, .04), 'hu.' + s)]
    BONES += [('rider', (-.05, 0, 1.55), (-.05, 0, 2.2), 'body'), ('weapon', (.15, -.3, 1.85), (.15, -.3, 2.25), 'rider')]
    F.ST.clear(); F.ST.update(name=name, fac=fac, P=P, bm=bm, scene=scene, base={'weapon': [('Y', .28)]}, kind='stoss', root='body', nosk=('weapon', 'rider'), hit=9, camk=1.45,
                              L_BONE=bm.verts.layers.int.new('bone'), L_COL=bm.loops.layers.float_color.new('Col'), BONES=BONES, BI={n: i for i, (n, *_r) in enumerate(BONES)}, anim=anims)
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        c = f.calc_center_median()
        col = 'mane' if (c.z < .13 or c.x < -1.0 or (c.x > .6 and c.x < 1.1 and c.z > 1.75 + (c.x - .6) * .5 and abs(c.y) < .07)) else 'coat'
        F.paint([f], P[col], MATTE)
    # Mähne und Stirnschopf als eigene Teile
    for i in range(6):
        t = i / 5; F.box('neck', 'mane', MATTE, T(.62 + .36 * t, 0, 1.62 + .42 * t) @ RY(-.75) @ S(.16, .05, .2))
    for sg in (1, -1): F.cone('head', 'coat', MATTE, .04, 0, .12, T(1.12, .08 * sg, 2.1), seg=5)  # Ohren

def pferdezeug(fac):
    c, cone, box, ball = F.ST, F.cone, F.box, F.ball
    # Schabracke in der Fraktionsfarbe: von oben das deutlichste Erkennungszeichen
    cone('body', 'tunic', MATTE, .365, .355, .95, T(-.18, 0, 1.24) @ RY(math.pi / 2) @ S(1, 1, 1), seg=12, caps=False)
    cone('body', 'trim', MATTE, .37, .37, .05, T(-.66, 0, 1.24) @ RY(math.pi / 2), seg=12, caps=False, smooth=False)
    cone('body', 'trim', MATTE, .37, .37, .05, T(.3, 0, 1.25) @ RY(math.pi / 2), seg=12, caps=False, smooth=False)
    box('body', 'leather', MATTE, T(-.1, 0, 1.6) @ S(.55, .42, .08)); box('body', 'leather', MATTE, T(-.36, 0, 1.68) @ S(.08, .36, .14)); box('body', 'leather', MATTE, T(.16, 0, 1.67) @ S(.07, .2, .12))
    box('head', 'steel_d', METAL, T(1.3, 0, 1.99) @ RY(.62) @ S(.3, .15, .03))            # Rossstirn
    box('head', 'trim', METAL, T(1.18, 0, 2.06) @ S(.05, .05, .05))
    for sg in (1, -1): box('neck', 'leather', MATTE, T(.75, .13 * sg, 1.75) @ RY(-.6) @ S(.7, .012, .03))  # Zügel
    cone('neck', 'steel_d', METAL, .21, .25, .3, T(.56, 0, 1.4) @ RY(.75) @ S(1, .85, 1), seg=10, caps=False)  # Brustpanzer des Pferdes

def reiter(fac):
    cone, box, ball = F.cone, F.box, F.ball
    ball('rider', 'tunic', MATTE, .2, T(-.05, 0, 1.95) @ S(.8, 1, 1.25))
    ball('rider', 'steel', METAL, .175, T(.02, 0, 1.98) @ S(.58, 1.06, 1.12)); box('rider', 'trim', METAL, T(.125, 0, 1.98) @ S(.014, .022, .28))
    cone('rider', 'steel_d', METAL, .24, .19, .26, T(-.05, 0, 1.7) @ S(.85, 1, 1), caps=False)           # Kettenrock
    cone('rider', 'leather', MATTE, .2, .2, .06, T(-.05, 0, 1.8) @ S(.84, 1, 1), caps=False, smooth=False)
    for sg in (1, -1):
        for i, (y, z, r) in enumerate(((.25, 2.13, .12), (.285, 2.05, .105))): ball('rider', 'steel' if i == 0 else 'steel_d', METAL, r, T(-.05, y * sg, z) @ S(1.05, .95, .62))
        box('rider', 'trouser', MATTE, T(.08, .27 * sg, 1.5) @ RY(.55) @ S(.44, .15, .16))                # Oberschenkel
        box('rider', 'steel', METAL, T(.2, .36 * sg, 1.1) @ S(.13, .13, .46)); ball('rider', 'steel_d', METAL, .085, T(.22, .35 * sg, 1.34))  # Beinschiene, Knie
        box('rider', 'steel_d', METAL, T(.26, .36 * sg, .86) @ S(.26, .12, .1))
    ball('rider', 'skin', MATTE, .12, T(-.03, 0, 2.33))
    for sg in (1, -1): box('rider', 'tunic_d', MATTE, T(.075, .045 * sg, 2.345) @ S(.02, .026, .03))
    if fac == 'asch':
        ball('rider', 'steel_d', METAL, .14, T(-.03, 0, 2.38) @ S(1.02, 1.04, .8)); box('rider', 'steel', METAL, T(.1, 0, 2.3) @ S(.02, .04, .15))
        for sg in (1, -1): cone('rider', 'cloth', MATTE, .045, 0, .28, T(-.03, .16 * sg, 2.5) @ RXa(-.75 * sg), seg=6)
    elif fac == 'salz':
        cone('rider', 'steel_d', METAL, .24, .14, .05, T(-.03, 0, 2.39)); ball('rider', 'steel', METAL, .14, T(-.03, 0, 2.4) @ S(1, 1, .72)); ball('rider', 'trim', MATTE, .045, T(-.03, 0, 2.52))
    else:
        cone('rider', 'steel', METAL, .145, .03, .25, T(-.03, 0, 2.47)); cone('rider', 'steel_d', METAL, .16, .145, .04, T(-.03, 0, 2.36), smooth=False); box('rider', 'steel_d', METAL, T(.1, 0, 2.3) @ S(.02, .035, .13))
        for i in range(3): cone('rider', 'tunic', MATTE, .03, .05, .2, T(-.08 - i * .045, 0, 2.62 + i * .01) @ RY(-.5 - i * .25) @ S(1, .5, 1), seg=6)
    # Umhang
    box('rider', 'tunic_d', MATTE, T(-.26, 0, 1.85) @ RY(-.25) @ S(.03, .42, .6))
    # Schild links
    if fac != 'asch':
        cone('rider', 'tunic' if fac == 'wacht' else 'cloth', MATTE, .27, .27, .035, T(-.02, .33, 1.92) @ RX, seg=14, smooth=False)
        cone('rider', 'steel_d', METAL, .285, .285, .045, T(-.02, .33, 1.92) @ RX, seg=14, caps=False, smooth=False); ball('rider', 'steel', METAL, .07, T(-.02, .355, 1.92) @ S(1, .6, 1))
    # Waffenarm und Lanze (bei der Aschenhorde ein Reiterspieß mit Widerhaken)
    box('rider', 'tunic', MATTE, T(.05, -.29, 1.98) @ RY(.75) @ S(.3, .11, .11)); ball('rider', 'steel_d', METAL, .065, T(.15, -.3, 1.86))
    L = 2.9
    cone('weapon', 'wood', MATTE, .024, .02, L, T(.15, -.3, 1.85 + L / 2 - .7), seg=6, smooth=False)
    cone('weapon', 'steel', METAL, .055, 0, .34, T(.15, -.3, 1.85 + L - .55) @ S(1, .4, 1), seg=4, smooth=False)
    cone('weapon', 'steel_d', METAL, .07, .03, .12, T(.15, -.3, 1.95), seg=8)   # Brechscheibe
    box('weapon', 'tunic', MATTE, T(.15, -.3 - .14, 1.85 + L - .95) @ S(.012, .28, .2))  # Wimpel

def anims(action, mix):
    def trot(ph):  # Trab: diagonale Beinpaare schwingen gemeinsam
        d = {}
        for nm, off in (('fu.L', 0), ('hu.R', 0), ('fu.R', math.pi), ('hu.L', math.pi)):
            a = ph + off; low = nm.replace('u.', 'l.')
            d[nm] = [('Y', .55 * math.sin(a))]; d[low] = [('Y', max(0, math.cos(a)) * 1.0)]
        d['neck'] = [('Y', .06 * math.sin(ph * 2))]; d['head'] = [('Y', -.05 * math.sin(ph * 2))]; d['tail'] = [('Y', -.25 + .1 * math.sin(ph * 2))]; d['rider'] = [('Y', .04 * math.sin(ph * 2 + 1))]
        return d
    action('stehen', [(1,), (20, {'neck': [('Y', .1)], 'head': [('Y', .12)], 'tail': [('X', .25)]}, (0, 0, -.008)), (40, {'neck': [('Y', -.04)], 'tail': [('X', -.22)], 'fu.L': [('Y', -.25)], 'fl.L': [('Y', .5)]}), (52, {'tail': [('X', .1)]}), (65,)])
    action('arbeit', [(1,), (33, {'neck': [('Y', .1)]}), (65,)])
    action('gehen', [(1 + i * 2, trot(i * math.pi / 4), (0, 0, .03 * abs(math.sin(i * math.pi / 4)) - .015)) for i in range(9)])
    drive = {'weapon': [('Y', 1.25)], 'rider': [('Y', .28)], 'neck': [('Y', .18)], 'head': [('Y', -.1)], 'fu.L': [('Y', -.55)], 'fl.L': [('Y', 1.0)], 'fu.R': [('Y', -.3)], 'fl.R': [('Y', .6)], 'hu.L': [('Y', .3)], 'hu.R': [('Y', .3)], '_replace': ()}
    action('angriff', [(1,), (5, {'weapon': [('Y', .75)], 'rider': [('Y', -.12)], 'neck': [('Y', -.1)]}, (-.06, 0, 0)), (9, drive, (.28, 0, -.04)), (12, drive, (.3, 0, -.04)), (17, {'weapon': [('Y', .6)], 'rider': [('Y', .1)]}, (.1, 0, -.01)), (23,)])
    fold = {'fu.L': [('Y', -.6)], 'fl.L': [('Y', 1.3)], 'fu.R': [('Y', -.4)], 'fl.R': [('Y', 1.1)], 'hu.L': [('Y', .5)], 'hl.L': [('Y', .9)], 'hu.R': [('Y', .3)], 'hl.R': [('Y', .7)], 'neck': [('Y', -.35)], 'tail': [('Y', -.5)], 'weapon': [('Y', 1.1)], 'rider': [('X', .5)]}
    def roll(a, extra): d = dict(extra); d['body'] = [('X', a)]; return d
    action('tod', [(1,), (5, roll(-.12, {'neck': [('Y', -.4)], 'fu.L': [('Y', -.7)], 'fl.L': [('Y', 1.2)]}), (0, 0, .06)), (11, roll(.6, fold), (0, .2, -.3)), (17, roll(1.45, fold), (0, .42, -.88)), (20, roll(1.52, fold), (0, .44, -.92)), (30, roll(1.5, fold), (0, .43, -.9))])

made = []
for fac in ('wacht', 'asch', 'salz'):
    name = fac + '_cav'
    if ONLY and ONLY not in name: continue
    begin(name, fac); pferdezeug(fac); reiter(fac)
    F.finish(os.path.join(OUT, name + '.glb'), os.path.join(PREV, name + '.png') if PREV else None)
    made.append(name)
print('FERTIG', len(made), ' '.join(made))
