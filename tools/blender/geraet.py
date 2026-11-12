# Belagerungsgerät der drei Fraktionen: Rammbock (Grenzwacht), Aschetroll (Aschenhorde), Gezeitenschleuder (Salzbund).
# Aufruf: blender --background --python tools/blender/geraet.py -- [Vorschauordner oder -] [nur: Teil des Namens]
# Maschinen bestehen nur aus starren Teilen an wenigen Knochen (body, arm); der Troll ist eine vergrößerte Figur.
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy, bmesh, importlib, lib_figur as F
from mathutils import Matrix
importlib.reload(F)
T, S, RX, RY, RXa, MATTE, METAL = F.T, F.S, F.RX, F.RY, F.RXa, F.MATTE, F.METAL
cone, box, ball = F.cone, F.box, F.ball

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else ''
OUT = os.path.join(HERE, '..', '..', 'public', 'models')

def machine(name, fac, pivot, base, anim, hit):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.render.fps = 24
    bm = bmesh.new()
    BONES = [('body', (0, 0, .5), (0, 0, 1.0), None), ('arm', pivot, (pivot[0], pivot[1], pivot[2] + .5), 'body')]
    F.ST.clear(); F.ST.update(name=name, fac=fac, P={k: F.hexc(v) for k, v in F.PAL[fac].items()}, bm=bm, scene=scene, base=base, kind='hieb', root='body', nosk=('body', 'arm'), hit=hit, camk=1.5,
                              L_BONE=bm.verts.layers.int.new('bone'), L_COL=bm.loops.layers.float_color.new('Col'), BONES=BONES, BI={'body': 0, 'arm': 1}, anim=anim)

def wheels(xs, y, r=.36):
    for x in xs:
        for sg in (1, -1):
            cone('body', 'wood', MATTE, r, r, .1, T(x, y * sg, r) @ RX, seg=12, smooth=False)
            cone('body', 'steel_d', METAL, r * 1.03, r * 1.03, .06, T(x, y * sg, r) @ RX, seg=12, caps=False, smooth=False)
            cone('body', 'steel', METAL, .08, .08, .14, T(x, y * sg, r) @ RX, seg=8, smooth=False)
            for a in (0, math.pi / 3, 2 * math.pi / 3): box('body', 'wood', MATTE, T(x, (y + .03) * sg, r) @ RY(a) @ S(r * 1.9, .03, .05))
        cone('body', 'wood', MATTE, .05, .05, y * 2, T(x, 0, r) @ RX, seg=6, smooth=False)

# ---------------- Rammbock: Balken mit Eisenkopf, an Ketten unter einem Schutzdach ----------------
def ram_anim(action, mix):
    action('stehen', [(1,), (33, {'arm': [('Y', .04)]}), (65,)]); action('arbeit', [(1,), (33,), (65,)])
    action('gehen', [(1, {'arm': [('Y', .06)]}, (0, 0, 0)), (7, {'arm': [('Y', -.04)], 'body': [('X', .015)]}, (0, 0, .012)), (13, {'arm': [('Y', .06)]}, (0, 0, 0)), (19, {'arm': [('Y', -.04)], 'body': [('X', -.015)]}, (0, 0, .012)), (25, {'arm': [('Y', .06)]}, (0, 0, 0))])
    action('angriff', [(1,), (8, {'arm': [('Y', -.55)]}, (-.03, 0, 0)), (12, {'arm': [('Y', .5)], 'body': [('Y', .03)]}, (.06, 0, 0)), (14, {'arm': [('Y', .3)]}, (.02, 0, 0)), (20, {'arm': [('Y', -.12)]}), (27,)])
    action('tod', [(1,), (6, {'body': [('X', .15)], 'arm': [('Y', .3)]}, (0, 0, -.05)), (14, {'body': [('X', .75), ('Y', .12)], 'arm': [('Y', .9)]}, (0, .3, -.3)), (18, {'body': [('X', .82), ('Y', .12)], 'arm': [('Y', 1.0)]}, (0, .32, -.34)), (30, {'body': [('X', .8), ('Y', .12)], 'arm': [('Y', 1.0)]}, (0, .32, -.33))])
def wacht_siege():
    machine('wacht_siege', 'wacht', (0, 0, 2.0), {}, ram_anim, 12)
    wheels((-.85, .85), .62)
    for sg in (1, -1):
        box('body', 'wood', MATTE, T(0, .5 * sg, .62) @ S(2.5, .14, .16))                         # Längsbalken
        for x in (-1.0, 0, 1.0):
            box('body', 'wood', MATTE, T(x, .5 * sg, 1.3) @ S(.12, .12, 1.3))                      # Pfosten
            box('body', 'wood', MATTE, T(x, .27 * sg, 1.98) @ RXa(.72 * sg) @ S(.1, .1, .78))      # Sparren
        box('body', 'leather', MATTE, T(0, .3 * sg, 2.0) @ RXa(.72 * sg) @ S(2.6, .05, .86))       # Dachhaut aus Häuten
        box('body', 'tunic', MATTE, T(.6, .31 * sg, 2.02) @ RXa(.72 * sg) @ S(.5, .06, .8)); box('body', 'tunic_d', MATTE, T(-.7, .31 * sg, 2.02) @ RXa(.72 * sg) @ S(.6, .06, .8))
        box('body', 'steel_d', METAL, T(1.25, .5 * sg, 1.2) @ S(.06, .2, 1.0))                     # Frontschild
    box('body', 'wood', MATTE, T(0, 0, 2.3) @ S(2.7, .12, .12))                                   # First
    for x in (-1.0, 1.0): box('body', 'wood', MATTE, T(x, 0, .62) @ S(.14, 1.0, .14))
    box('body', 'tunic', MATTE, T(1.3, 0, 1.55) @ S(.03, .5, .5)); box('body', 'trim', MATTE, T(1.32, 0, 1.55) @ S(.02, .18, .22))  # Banner vorn
    # Balken an Ketten (hängt am Knochen arm, Drehpunkt am First)
    cone('arm', 'wood', MATTE, .15, .17, 2.9, T(.15, 0, 1.05) @ RY(math.pi / 2), seg=9)
    cone('arm', 'steel_d', METAL, .21, .12, .42, T(1.75, 0, 1.05) @ RY(math.pi / 2), seg=9); ball('arm', 'steel', METAL, .14, T(1.98, 0, 1.05))
    for x in (-.9, -.2, .6, 1.3): cone('arm', 'steel_d', METAL, .18, .18, .07, T(x, 0, 1.05) @ RY(math.pi / 2), seg=9, caps=False, smooth=False)
    for x in (-.7, .9):
        for sg in (1, -1): box('arm', 'steel_d', METAL, T(x, .09 * sg, 1.6) @ RXa(-.1 * sg) @ S(.03, .03, 1.0))

# ---------------- Gezeitenschleuder: Wurfarm mit Gegengewicht auf fahrbarem Gestell ----------------
def sling_anim(action, mix):
    action('stehen', [(1,), (33, {'arm': [('Y', .03)]}), (65,)]); action('arbeit', [(1,), (33,), (65,)])
    action('gehen', [(1, {'arm': [('Y', .03)]}, (0, 0, 0)), (7, {'body': [('X', .012)]}, (0, 0, .012)), (13, {'arm': [('Y', .03)]}, (0, 0, 0)), (19, {'body': [('X', -.012)]}, (0, 0, .012)), (25, {'arm': [('Y', .03)]}, (0, 0, 0))])
    action('angriff', [(1,), (4, {'arm': [('Y', -.12)]}), (9, {'arm': [('Y', 2.0)], 'body': [('Y', .05)]}, (.04, 0, .02)), (12, {'arm': [('Y', 1.75)]}), (16, {'arm': [('Y', 1.9)]}), (40, {'arm': [('Y', .2)]}), (48,)])
    action('tod', [(1,), (6, {'arm': [('Y', 1.2)], 'body': [('X', .1)]}, (0, 0, -.05)), (15, {'arm': [('Y', 2.2)], 'body': [('X', .7), ('Y', -.1)]}, (0, .3, -.32)), (19, {'arm': [('Y', 2.3)], 'body': [('X', .76), ('Y', -.1)]}, (0, .32, -.36)), (30, {'arm': [('Y', 2.3)], 'body': [('X', .75), ('Y', -.1)]}, (0, .32, -.35))])
def salz_siege():
    machine('salz_siege', 'salz', (.1, 0, 1.75), {'arm': [('Y', -1.15)]}, sling_anim, 9)
    wheels((-.9, .9), .6, .32)
    for sg in (1, -1):
        box('body', 'wood', MATTE, T(0, .46 * sg, .55) @ S(2.6, .14, .16))
        box('body', 'wood', MATTE, T(.1, .46 * sg, 1.2) @ S(.14, .12, 1.25))                       # Ständer
        box('body', 'wood', MATTE, T(-.42, .46 * sg, 1.05) @ RY(-.5) @ S(.1, .1, 1.3)); box('body', 'wood', MATTE, T(.62, .46 * sg, 1.05) @ RY(.5) @ S(.1, .1, 1.3))  # Streben
        box('body', 'steel_d', METAL, T(.1, .46 * sg, 1.75) @ S(.2, .14, .16)); box('body', 'tunic', MATTE, T(.1, .54 * sg, 1.2) @ S(.3, .02, .5))
    for x in (-1.1, 0, 1.1): box('body', 'wood', MATTE, T(x, 0, .55) @ S(.14, .92, .14))
    cone('body', 'steel', METAL, .05, .05, 1.05, T(.1, 0, 1.75) @ RX, seg=8, smooth=False)          # Achse
    box('body', 'cloth', MATTE, T(-.75, 0, .7) @ S(.5, .5, .28)); ball('body', 'cloth', MATTE, .16, T(-.75, .1, .92)); ball('body', 'cloth', MATTE, .14, T(-.6, -.12, .9))  # Vorrat an Eisbrocken
    # Wurfarm am Knochen arm: im Ruhezustand senkrecht nach oben modelliert, die Grundhaltung legt ihn nach hinten
    box('arm', 'wood', MATTE, T(.1, 0, 2.55) @ S(.12, .12, 2.5))
    for z in (2.0, 2.9, 3.6): cone('arm', 'steel_d', METAL, .1, .1, .06, T(.1, 0, z), seg=6, caps=False, smooth=False)
    box('arm', 'leather', MATTE, T(.1, 0, 3.85) @ S(.36, .4, .06)); ball('arm', 'cloth', MATTE, .17, T(.1, 0, 3.98))   # Schale mit Eisbrocken
    box('arm', 'steel_d', METAL, T(.1, 0, 1.25) @ S(.5, .42, .5)); box('arm', 'trim', METAL, T(.1, 0, 1.25) @ S(.52, .1, .52))  # Gegengewicht

# ---------------- Aschetroll: eine Figur in anderthalbfacher Größe mit Keule ----------------
def asch_siege():
    pal = dict(F.PAL['asch']); F.PAL['asch'] = dict(pal, skin=0x5a544f, tunic=0x3a2a22, trouser=0x2a2420)
    F.begin('asch_siege', 'asch', 1.6); F.PAL['asch'] = pal
    F.ST['scale'] = 1.5
    F.helm_horn(big=True); F.kragen('fur'); F.schultern('steel_d', spikes=True); F.rock('tunic_d'); F.gurte(); F.armschienen(leder=True); F.stiefelstulpen(); F.taschen()
    for i in range(5): cone('chest', 'cloth', MATTE, .03, 0, .16, T(-.2, -.12 + i * .06, 1.55 + (i % 2) * .08) @ RY(-1.2), seg=5)   # Knochenkamm am Rücken
    F.keule()

made = []
for name, fn in (('wacht_siege', wacht_siege), ('asch_siege', asch_siege), ('salz_siege', salz_siege)):
    if ONLY and ONLY not in name: continue
    fn()
    F.finish(os.path.join(OUT, name + '.glb'), os.path.join(PREV, name + '.png') if PREV else None)
    made.append(name)
print('FERTIG', len(made), ' '.join(made))
