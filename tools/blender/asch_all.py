# Alle Gebäude der Aschenhorde in einem Lauf. Stil: dunkler Basalt, verkohlte Balken, Fellzelte, Knochen, Stacheln, Glut.
# Aufruf: blender --background --python tools/blender/asch_all.py -- [Vorschau-Ordner] [nur dieses Gebäude]
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', '..', 'public', 'models')
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else None
SQ = math.pi / 4
B.SNOW_HEX = 0xb4b6bc  # Schnee der Aschenfelder: grau von Ruß

def mats():
    m = type('M', (), {})()
    m.basalt = B.brick('basalt', 0x504b4c, 0x3a3637, 0x161415, scale=2.8, snow=.5, row_h=.3, brick_w=.6, mortar_size=.025)
    m.basaltD = B.brick('basalt_dunkel', 0x383435, 0x282526, 0x0e0d0d, scale=3.2, snow=.5)
    m.char = B.grain('kohlholz', 0x241c1a, 0x3e322c, stretch=(14, 14, 1.2), scale=5, snow=.5, bump=.6)
    m.plank = B.grain('bohlen', 0x3c2c24, 0x58423a, stretch=(10, 1, 1), scale=7, snow=.5, bump=.5)
    m.hide = B.grain('fell', 0x5a3a2c, 0x7e5644, stretch=(2, 2, 2), scale=5, snow=.45, rough=1, bump=.5)
    m.hideD = B.grain('fell_dunkel', 0x3c2a22, 0x54392e, stretch=(2, 2, 2), scale=5, snow=.45, rough=1, bump=.5)
    m.bone = B.plain('knochen', 0xd9d3c0, rough=.7, snow=.3)
    m.iron = B.plain('eisen', 0x2c2c31, rough=.55, metallic=.7, snow=.4)
    m.red = B.plain('tuch', 0x8e2b18, rough=.95, snow=.15)
    m.ash = B.grain('asche', 0x2a2625, 0x4a4442, stretch=(1, 1, 1), scale=4, snow=.25, rough=1, bump=.4)
    m.snow = B.plain('schnee', 0xb9bcc2, rough=.85)
    m.ember = B.glow('glut', 0xff7a22, 6)
    m.emberD = B.glow('glut_dunkel', 0xd04a14, 3)
    return m

def out(name): return os.path.join(MODELS, name + '.glb'), (os.path.join(PREV, name + '.png') if PREV else None)
def spike(m, x, y, z, h=.6, r=.09, rot=(0, 0, 0), mat=None): B.cyl('stachel', r, h, (x, y, z + h / 2), mat or m.iron, seg=5, r2=.005, rot=rot)
def tusk(m, x, y, z, s=1, side=1):  # gebogener Hauer aus drei Stücken
    for i, (dz, dx, r) in enumerate(((0, 0, .11), (.34, .08, .085), (.62, .22, .055))):
        B.cyl('hauer', r * s, .4 * s, (x + side * dx * s, y, z + (dz + .2) * s), m.bone, seg=6, r2=r * s * .7, rot=(0, side * (.15 + i * .3), 0))
def skull(m, x, y, z, s=1):
    B.mound('schaedel', .13 * s, (x, y, z), m.bone, flat=.9, seg=7); B.box('kiefer', (.12 * s, .1 * s, .08 * s), (x, y - .06 * s, z - .1 * s), m.bone, bevel=.01)
def brazier(m, x, y, n, h=.8, r=.2):
    B.cyl('schale', r, .14, (x, y, h), m.iron, seg=8, r2=r * .65)
    for i in range(3): B.box('schalenbein', (.04, .04, h), (x + math.cos(i * 2.1) * r * .7, y + math.sin(i * 2.1) * r * .7, h / 2), m.iron, bevel=0)
    B.box('glut', (r * 1.2, r * 1.2, .04), (x, y, h + .06), m.ember, bevel=0, rot=(0, 0, .5)); B.empty('Feuer' + str(n), (x, y, h + .15), r * 2.6)
def tent(m, x, y, r, h, mat, seg=8, flap=-math.pi / 2):
    B.cyl('zelt', r, h, (x, y, h / 2), mat, seg=seg, r2=r * .12, smooth=False)
    for i in range(seg // 2): a = i * 4 * math.pi / seg + .3; B.cyl('zeltstange', .025, h * 1.25, (x + math.cos(a) * r * .5, y + math.sin(a) * r * .5, h * .62), m.char, seg=4, rot=(math.sin(a) * .5, -math.cos(a) * .5, 0))
    B.box('zelteingang', (r * .5, .06, h * .45), (x + math.cos(flap) * r * .82, y + math.sin(flap) * r * .82, h * .22), m.basaltD, bevel=0, rot=(.35, 0, flap + math.pi / 2))
def drifts(m, pts):
    for x, y, r in pts: B.mound('wehe', r, (x, y, 0), m.snow, flat=.3)
def banner(m, x, y, z, n, h=1.6):
    B.cyl('mast', .035, h, (x, y, z + h / 2), m.char, seg=5); spike(m, x, y, z + h, .25, .05, mat=m.bone)
    return B.box('Fahne' + str(n), (.02, .5, .7), (x, y - .27, z + h - .4), m.red, bevel=0)
def want(n): return ONLY is None or ONLY == n

# ---------- Aschenfeste: gestufter Basaltklotz mit glühendem Schlot, Stachelkranz und Hauertor (6 x 6) ----------
if want('hq'):
    B.reset(); m = mats()
    B.cyl('stufe1', 3.9, 2.2, (0, 0, 1.1), m.basalt, seg=4, r2=3.3, rot=(0, 0, SQ), smooth=False)
    B.cyl('stufe2', 2.9, 1.9, (0, .2, 3.1), m.basaltD, seg=4, r2=2.35, rot=(0, 0, SQ), smooth=False)
    B.cyl('stufe3', 1.9, 1.6, (0, .3, 4.8), m.basalt, seg=4, r2=1.5, rot=(0, 0, SQ), smooth=False)
    B.cyl('schlot', 1.0, 2.6, (0, .3, 6.9), m.basaltD, seg=8, r2=.72); B.cyl('schlotkranz', .86, .25, (0, .3, 8.25), m.iron, seg=8)
    B.cyl('schlotglut', .6, .05, (0, .3, 8.36), m.ember, seg=8); B.empty('Rauch1', (0, .3, 8.6)); B.empty('Feuer1', (0, .3, 8.45), 1.3)
    for i in range(8): a = i * math.pi / 4; spike(m, math.cos(a) * .9, .3 + math.sin(a) * .9, 8.2, .7, .1, rot=(math.sin(a) * .5, -math.cos(a) * .5, 0))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * 2.45, sy * 2.45
            B.cyl('eckturm', .7, 3.6, (x, y, 1.8), m.basaltD, seg=6, r2=.5, smooth=False); B.cyl('eckkranz', .62, .2, (x, y, 3.65), m.iron, seg=6)
            for i in range(6): a = i * math.pi / 3; spike(m, x + math.cos(a) * .5, y + math.sin(a) * .5, 3.7, .75, .09, rot=(math.sin(a) * .4, -math.cos(a) * .4, 0))
            B.cyl('eckglut', .3, .04, (x, y, 3.78), m.emberD, seg=6)
            B.box('eckscharte', (.1, .06, .5), (x, y - sy * 0 - .62 if sy < 0 else y + .62, 2.2), m.ember, bevel=0)
    for i in range(9):  # Stachelkranz der ersten Stufe
        for s in (-1, 1):
            spike(m, -2.0 + i * .5, s * 2.42, 2.2, .5, .07); spike(m, s * 2.42, -2.0 + i * .5, 2.2, .5, .07)
    # Tor mit Hauern, Glutadern in der Fassade
    B.box('torrahmen', (1.6, .5, 1.9), (0, -2.75, .95), m.basaltD, bevel=.05); B.box('tor', (1.1, .12, 1.5), (0, -3.02, .75), m.plank, bevel=.01)
    for z in (.4, 1.1): B.box('torband', (1.12, .04, .1), (0, -3.09, z), m.iron, bevel=0)
    for sx in (-1, 1): tusk(m, sx * .95, -3.0, .9, 1.6, -sx); brazier(m, sx * 1.6, -3.3, 2 if sx < 0 else 3)
    skull(m, 0, -3.05, 2.1, 1.6)
    for x, z, w, a in ((-1.7, 1.3, .9, .5), (1.5, 1.6, 1.1, -.4), (-.9, 3.3, .8, .3), (1.0, 3.0, .7, -.6), (0, 4.7, .9, .2)):
        B.box('glutader', (w, .05, .07), (x, -2.62 - (z > 2.2) * -.45 if z < 2.2 else -2.0 + (z > 4) * .55, z), m.ember, bevel=0, rot=(0, a, 0))
    for sx in (-1, 1): B.box('seitenglut', (.06, .9, .5), (sx * 2.72, 0, 1.2), m.emberD, bevel=0)
    f1 = banner(m, -1.3, -2.3, 2.2, 1); f2 = banner(m, 1.3, -2.3, 2.2, 2)
    drifts(m, ((-3.2, 2.6, .7), (3.3, 1.5, .6), (-3.1, -1.5, .5), (2.9, -2.9, .5), (0, 3.4, .7)))
    o, p = out('asch_hq'); B.finish(o, 'asch_hq', loose=(f1, f2), size=2048, preview=p)

# ---------- Kriegshalle: Langhaus aus Basalt mit Felldach, Rippenbögen und Schädelgiebel (4 x 4) ----------
if want('barracks'):
    B.reset(); m = mats()
    X, Y = 3.2, 2.2
    B.box('sockel', (X, Y, 1.0), (0, .2, .5), m.basalt, bevel=.04)
    for sx in (-1, 1): B.gable_wall('giebel', Y, 1.5, (sx * X / 2, .2, 1.0), m.plank, thick=.14)
    B.gable_roof('dach', X, Y, 1.5, (0, .2, 1.03), m.hide, thick=.14, over=.28)
    for i in range(5):  # Rippenbögen über dem Dach
        x = -1.4 + i * .7
        for sy in (-1, 1): B.cyl('rippe', .055, 1.95, (x, .2 + sy * .72, 1.72), m.bone, seg=5, r2=.03, rot=(sy * .95, 0, 0))
    B.box('first', (X + .8, .14, .14), (0, .2, 2.6), m.char, bevel=.02)
    for sx in (-1, 1): spike(m, sx * (X / 2 + .4), .2, 2.55, .6, .08, rot=(0, sx * .7, 0), mat=m.bone); skull(m, sx * (X / 2 + .1), .2, 2.15, 1.3)
    B.box('tor', (.9, .12, 1.0), (0, -.93, .5), m.plank, bevel=.01); B.box('torsturz', (1.2, .18, .18), (0, -.95, 1.08), m.char, bevel=.02)
    for sx in (-1, 1): tusk(m, sx * .72, -.98, .5, 1.0, -sx)
    for x in (-1.1, 1.1): B.box('scharte', (.12, .05, .4), (x, -.92, .62), m.ember, bevel=0)
    B.box('rauchloch', (.5, .4, .1), (.6, .2, 2.5), m.basaltD, bevel=.02); B.empty('Rauch1', (.6, .2, 2.7))
    # Übungsplatz: Pfähle mit Schilden, Waffenständer, Feuer
    for i, x in enumerate((-1.4, -.9)):
        B.cyl('pfahl', .07, 1.1, (x, -1.6, .55), m.char, seg=6); B.cyl('schild', .2, .05, (x, -1.68, .8), m.red if i else m.hideD, seg=8, rot=(math.pi / 2, 0, 0)); spike(m, x, -1.74, .76, .14, .05, rot=(-math.pi / 2, 0, 0))
    for sx in (-1, 1): B.box('staender', (.07, .07, .8), (1.2 + sx * .4, -1.55, .4), m.char, bevel=.008)
    B.box('staenderholm', (.9, .06, .06), (1.2, -1.55, .72), m.char, bevel=.008)
    for i in range(4): B.box('klinge', (.05, .02, .75), (.9 + i * .2, -1.62, .5), m.iron, bevel=0, rot=(.15, 0, 0))
    brazier(m, 0, -1.7, 1, .6, .22)
    f1 = banner(m, -1.75, -.7, 0, 1, 2.2)
    drifts(m, ((-1.9, 1.4, .55), (1.7, 1.6, .55), (2.0, -.4, .4)))
    o, p = out('asch_barracks'); B.finish(o, 'asch_barracks', loose=(f1,), preview=p)

# ---------- Schmiedegrube: eingelassene Glutgrube, Amboss, Ketten, Trollkäfig (4 x 4) ----------
if want('workshop'):
    B.reset(); m = mats()
    B.cyl('grubenrand', 1.5, .5, (-.3, .3, .25), m.basalt, seg=10); B.cyl('grube', 1.2, .1, (-.3, .3, .48), m.ash, seg=10); B.cyl('glutbett', .8, .06, (-.3, .3, .55), m.ember, seg=9)
    B.empty('Feuer1', (-.3, .3, .7), 1.2); B.empty('Rauch1', (-.3, .3, 1.6))
    for i in range(4):  # vier schräge Träger tragen einen Kessel über der Grube
        a = i * math.pi / 2 + SQ; B.box('traeger', (.16, .16, 2.9), (-.3 + math.cos(a) * .95, .3 + math.sin(a) * .95, 1.3), m.char, bevel=.02, rot=(math.sin(a) * .55, -math.cos(a) * .55, 0))
    B.cyl('kessel', .5, .5, (-.3, .3, 2.15), m.iron, seg=9, r2=.36); B.cyl('kesselglut', .4, .04, (-.3, .3, 2.42), m.emberD, seg=9)
    for i in range(3): a = i * 2.1; B.cyl('kette', .02, .7, (-.3 + math.cos(a) * .3, .3 + math.sin(a) * .3, 2.7), m.iron, seg=4)
    B.box('amboss', (.5, .22, .2), (1.3, -.6, .75), m.iron, bevel=.03); B.cyl('ambossklotz', .22, .65, (1.3, -.6, .32), m.char, seg=8)
    B.box('hammerstiel', (.05, .05, .7), (1.5, -.9, .45), m.char, bevel=0, rot=(.4, .3, 0)); B.box('hammerkopf', (.2, .14, .14), (1.56, -1.05, .78), m.iron, bevel=.02)
    for sx in (-1, 1):  # Käfig für den Troll
        for sy in (-1, 1): B.box('kaefigpfosten', (.12, .12, 1.6), (1.35 + sx * .55, 1.05 + sy * .55, .8), m.iron, bevel=.01)
    for i in range(5):
        for s in (-1, 1): B.box('gitter', (.04, .04, 1.4), (1.35 + s * .55, .6 + i * .22, .8), m.iron, bevel=0); B.box('gitter', (.04, .04, 1.4), (.9 + i * .22, 1.05 + s * .55, .8), m.iron, bevel=0)
    B.box('kaefigdach', (1.3, 1.3, .1), (1.35, 1.05, 1.62), m.plank, bevel=.01)
    for i in range(5): B.mound('schlacke', .22 + .05 * (i % 3), (-1.6 + (i % 2) * .35, -1.3 + i * .18, .05), m.basaltD, flat=.7, seg=6)
    B.box('erzkiste', (.6, .45, .4), (-1.5, 1.4, .2), m.plank, bevel=.02); B.mound('erz', .26, (-1.5, 1.4, .42), m.basaltD, flat=.6, seg=6)
    for x, y in ((-1.9, .2), (.9, -1.7)): spike(m, x, y, 0, 1.1, .1, mat=m.char); skull(m, x, y, 1.15)
    drifts(m, ((-2.0, 1.9, .5), (2.0, 1.9, .5), (2.0, -1.7, .4)))
    o, p = out('asch_workshop'); B.finish(o, 'asch_workshop', preview=p)

# ---------- Pferch: Fellzelte um einen Tierpferch mit Knochenzaun (4 x 4) ----------
if want('farm'):
    B.reset(); m = mats()
    tent(m, -.95, .85, .95, 1.7, m.hide); tent(m, .75, 1.1, .7, 1.3, m.hideD)
    for i in range(16):
        a = i * 2 * math.pi / 16
        if abs(a - math.pi * 1.5) < .3: continue
        x, y = .3 + math.cos(a) * 1.15, -.95 + math.sin(a) * .85
        B.cyl('zaunknochen', .045, .7, (x, y, .35), m.bone, seg=5, r2=.03, rot=(math.sin(a) * .2, -math.cos(a) * .2, 0))
    for z in (.25, .5): B.cyl('zaunseil', 1.02, .03, (.3, -.95, z), m.hideD, seg=16).scale = (1.12, .83, 1)
    for x, y in ((0, -.9), (.6, -1.1), (.5, -.6)): B.mound('tier', .22, (x, y, .16), m.hideD, flat=.75, seg=7); B.mound('tierkopf', .1, (x + .22, y - .05, .24), m.hideD, flat=.9, seg=6)
    B.box('trog', (.6, .2, .16), (-.1, -1.35, .08), m.plank, bevel=.02)
    # Trockengestell mit Fleisch, Feuerstelle
    for sx in (-1, 1): B.box('gestellpfosten', (.07, .07, 1.2), (1.7, .1 + sx * .5, .6), m.char, bevel=.008)
    B.box('gestellholm', (.06, 1.1, .06), (1.7, .1, 1.15), m.char, bevel=.008)
    for i in range(4): B.box('fleisch', (.05, .14, .34), (1.7, -.25 + i * .22, .92), m.red, bevel=.02)
    B.cyl('feuerstelle', .3, .1, (-.2, -.05, .05), m.basaltD, seg=8); B.cyl('glut', .2, .04, (-.2, -.05, .11), m.ember, seg=7); B.empty('Feuer1', (-.2, -.05, .2), .5); B.empty('Rauch1', (-.95, .85, 1.85))
    spike(m, -1.85, -1.3, 0, 1.2, .08, mat=m.char); skull(m, -1.85, -1.3, 1.25)
    drifts(m, ((-1.9, 1.8, .5), (1.8, 1.9, .5), (1.95, -1.6, .4), (-1.7, -.3, .4)))
    o, p = out('asch_farm'); B.finish(o, 'asch_farm', preview=p)

# ---------- Glutturm: schiefer Basaltturm mit Stachelkrone und Feuerkorb (2 x 2) ----------
if want('tower'):
    B.reset(); m = mats()
    B.cyl('sockel', 1.0, .8, (0, 0, .4), m.basaltD, seg=7, r2=.85, smooth=False)
    B.cyl('schaft', .82, 4.0, (0, 0, 2.6), m.basalt, seg=7, r2=.6, smooth=False)
    B.cyl('kranz', .95, .3, (0, 0, 4.7), m.iron, seg=7, smooth=False)
    for i in range(7):
        a = i * 2 * math.pi / 7
        spike(m, math.cos(a) * .85, math.sin(a) * .85, 4.75, 1.0, .11, rot=(math.sin(a) * .55, -math.cos(a) * .55, 0))
        B.box('strebe', (.1, .1, 1.2), (math.cos(a) * .88, math.sin(a) * .88, 4.1), m.char, bevel=.01, rot=(math.sin(a) * -.5, math.cos(a) * .5, 0))
    B.cyl('feuerkorb', .6, .4, (0, 0, 5.05), m.iron, seg=7, r2=.45); B.cyl('glut', .5, .05, (0, 0, 5.27), m.ember, seg=7); B.empty('Feuer1', (0, 0, 5.4), 1.1); B.empty('Rauch1', (0, 0, 6.0))
    for z, a in ((1.6, 0), (2.8, 2.1), (3.6, 4.2), (2.2, 5.3)): B.box('scharte', (.12, .06, .45), (math.sin(a) * .74, -math.cos(a) * .74, z), m.ember, bevel=0, rot=(0, 0, a))
    B.box('tor', (.5, .1, .85), (0, -.9, .45), m.plank, bevel=.01); skull(m, 0, -.95, 1.1, 1.2)
    for i in range(5): a = i * 1.3 + .4; spike(m, math.cos(a) * 1.1, math.sin(a) * 1.1, 0, .55, .08, rot=(math.sin(a) * -.6, math.cos(a) * .6, 0), mat=m.char)
    f1 = banner(m, .5, -.5, 4.8, 1, 1.5)
    drifts(m, ((.8, .9, .45), (-.9, .5, .45)))
    o, p = out('asch_tower'); B.finish(o, 'asch_tower', loose=(f1,), preview=p)

# ---------- Köhlerei: rauchender Kohlenmeiler, Stammstapel, Schlitten (4 x 4) ----------
if want('lumber'):
    B.reset(); m = mats()
    B.mound('meiler', 1.25, (-.5, .6, 0), m.ash, flat=.95, seg=10); B.cyl('meilerloch', .2, .1, (-.5, .6, 1.18), m.ember, seg=7); B.empty('Rauch1', (-.5, .6, 1.35)); B.empty('Feuer1', (-.5, .6, 1.2), .4)
    for i in range(7): a = i * .9; B.box('meilerglut', (.3, .05, .05), (-.5 + math.cos(a) * 1.05, .6 + math.sin(a) * 1.05, .35 + (i % 3) * .2), m.emberD, bevel=0, rot=(0, .3, a + 1.57))
    for i in range(9): a = i * .7; B.cyl('meilerholz', .07, 1.1, (-.5 + math.cos(a) * 1.2, .6 + math.sin(a) * 1.2, .5), m.char, seg=5, rot=(math.sin(a) * .5, -math.cos(a) * .5, 0))
    for row in range(3):
        for i in range(3 - row): B.cyl('stamm', .16, 1.6, (1.25 + (i - (2 - row) / 2) * .33, .8, .16 + row * .28), m.plank, seg=7, rot=(math.pi / 2, 0, 0))
    for sx in (-1, 1): B.box('stapelpfahl', (.08, .08, .9), (1.25 + sx * .55, .8, .45), m.char, bevel=.008)
    for i in range(6): B.box('kohlesack', (.3, .26, .34), (-1.6 + (i % 3) * .32, -1.2 - (i // 3) * .3, .17), m.basaltD, bevel=.06)
    B.box('schlitten', (1.1, .55, .08), (.9, -1.2, .2), m.plank, bevel=.01)
    for sy in (-1, 1): B.box('kufe', (1.3, .05, .1), (.9, -1.2 + sy * .24, .08), m.char, bevel=.01)
    for i in range(3): B.cyl('ladung', .13, .9, (.9, -1.35 + i * .15, .36), m.plank, seg=6, rot=(0, math.pi / 2, 0))
    B.cyl('hackklotz', .24, .34, (1.8, -.2, .17), m.char, seg=8); B.box('axt', (.05, .2, .22), (1.8, -.25, .45), m.iron, bevel=.01)
    spike(m, -1.9, 1.7, 0, 1.2, .08, mat=m.char); skull(m, -1.9, 1.7, 1.25)
    drifts(m, ((1.9, 1.8, .5), (-1.9, -.2, .4), (.2, -1.9, .4)))
    o, p = out('asch_lumber'); B.finish(o, 'asch_lumber', preview=p)

# ---------- Plünderbasar: Beutezelte mit roten Tüchern, Kistenstapel, Sklavenpfahl (4 x 4) ----------
if want('market'):
    B.reset(); m = mats()
    tent(m, -.2, .9, 1.2, 2.0, m.red, seg=8); tent(m, 1.4, .5, .65, 1.2, m.hide, seg=6)
    for i, (x, y) in enumerate(((-1.5, -.9), (-.3, -1.2), (.9, -1.0))):
        for sx in (-1, 1): B.box('standpfosten', (.07, .07, 1.2), (x + sx * .45, y, .6), m.char, bevel=.008)
        B.box('standtuch', (1.1, .8, .04), (x, y, 1.2), m.red if i % 2 == 0 else m.hideD, bevel=0, rot=(-.3, 0, 0)); B.box('tresen', (1.0, .45, .08), (x, y - .1, .5), m.plank, bevel=.01)
        for k in range(3): B.box('beute', (.2, .18, .16), (x - .3 + k * .3, y - .1, .62), (m.bone, m.iron, m.hide)[k], bevel=.03)
    for i in range(5): B.box('kiste', (.42, .38, .32), (1.7 - (i % 2) * .1, -1.6 + (i // 2) * .42, .16 + (i % 2) * .33), m.plank, bevel=.02, rot=(0, 0, .2 * i))
    for i in range(3): B.cyl('fass', .17, .42, (-1.9, .4 + i * .4, .21), m.plank, seg=8)
    brazier(m, .35, -.2, 1, .7, .2); B.empty('Rauch1', (-.2, .9, 2.2))
    for x, y in ((-1.9, -1.7), (1.95, 1.6)): spike(m, x, y, 0, 1.3, .08, mat=m.char); skull(m, x, y, 1.35, 1.2)
    f1 = banner(m, -.2, .9, 1.9, 1, 1.2)
    drifts(m, ((-1.8, 1.9, .5), (.9, 1.95, .45), (2.0, -.4, .35)))
    o, p = out('asch_market'); B.finish(o, 'asch_market', loose=(f1,), preview=p)

# ---------- Glutlager: Stachelpalisade um ein Lagerzelt mit Signalfeuer (4 x 4) ----------
if want('outpost'):
    B.reset(); m = mats()
    R = 1.75
    for i in range(22):
        a = i * 2 * math.pi / 22
        if abs(a - math.pi * 1.5) < .34: continue
        h = 1.3 + .2 * math.sin(i * 1.7)
        B.cyl('pfahl', .12, h, (math.cos(a) * R, math.sin(a) * R, h / 2), m.char, seg=5, r2=.02, rot=(math.sin(a) * -.18, math.cos(a) * .18, 0))
    for sx in (-1, 1): tusk(m, sx * .6, -R, 0, 1.7, -sx)
    tent(m, -.4, .5, 1.0, 1.8, m.hide)
    B.cyl('feuersockel', .5, 1.6, (.9, .2, .8), m.basalt, seg=6, r2=.38, smooth=False); B.cyl('feuerschale', .5, .2, (.9, .2, 1.7), m.iron, seg=6, r2=.35)
    B.cyl('glut', .4, .05, (.9, .2, 1.82), m.ember, seg=6); B.empty('Feuer1', (.9, .2, 1.95), 1.0); B.empty('Rauch1', (.9, .2, 2.5))
    B.box('erzkarren', (.7, .45, .28), (.5, -.9, .4), m.plank, bevel=.015); B.mound('erz', .26, (.5, -.9, .52), m.basaltD, flat=.6, seg=6)
    for sy in (-1, 1): B.cyl('rad', .18, .05, (.5, -.9 + sy * .27, .18), m.char, seg=8, rot=(math.pi / 2, 0, 0))
    for i in range(3): B.box('kiste', (.36, .32, .28), (-1.0 + i * .1, -.9 + i * .05, .14 + i * .28), m.plank, bevel=.02, rot=(0, 0, .3 * i))
    f1 = banner(m, -.4, .5, 1.7, 1, 1.3)
    drifts(m, ((-2.1, 1.0, .5), (2.1, .9, .5), (.5, 2.1, .5), (2.0, -1.3, .4)))
    o, p = out('asch_outpost'); B.finish(o, 'asch_outpost', loose=(f1,), preview=p)
