# Übrige Gebäude der Grenzwacht in einem Lauf: Werkstatt, Holzlager, Handelshaus, Vorposten.
# Aufruf: blender --background --python tools/blender/wacht_rest.py -- [Vorschau-Ordner]
# Grundfläche jeweils 4 x 4 Einheiten (Größe 2); Vorderseite nach -Y.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', '..', 'public', 'models')
PREV = argv[0] if argv else None

def mats():
    m = type('M', (), {})()
    m.stone = B.brick('stein', 0x8f9096, 0x6c6e75, 0x2c2c30, scale=3.4, snow=.9, row_h=.22, brick_w=.46)
    m.stoneD = B.brick('stein_dunkel', 0x6a6b70, 0x505157, 0x222226, scale=3.6, snow=.9)
    m.plaster = B.grain('putz', 0xb9b2a2, 0xd6cfbd, stretch=(1, 1, 1), scale=3.5, snow=.6, rough=.95, bump=.15)
    m.timber = B.grain('balken', 0x3a2a1e, 0x5a412c, stretch=(14, 14, 1.2), scale=5, snow=.85, bump=.5)
    m.plank = B.grain('bretter', 0x5c432e, 0x7d5e42, stretch=(10, 1, 1), scale=7, snow=.85, bump=.5)
    m.log = B.grain('stamm', 0x4a3524, 0x6b4e34, stretch=(1, 14, 14), scale=6, snow=.8, bump=.6)
    m.cut = B.plain('schnittholz', 0xb89868, rough=.9, snow=.3)
    m.roof = B.brick('schindeln', 0x4a6278, 0x33475a, 0x141c24, scale=5.5, snow=.85, row_h=.2, brick_w=.34, mortar_size=.02, rough=.8, wall=False)
    m.roofLow = B.brick('schindeln_flach', 0x4a6278, 0x33475a, 0x141c24, scale=5.5, snow=.42, row_h=.2, brick_w=.34, mortar_size=.02, rough=.8, wall=False)  # flache Dächer: weniger Schnee, sonst nur weiße Platten
    m.iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
    m.steel = B.plain('stahl', 0x9aa2ac, rough=.4, metallic=.8)
    m.blue = B.plain('tuch', 0x34506a, rough=.95)
    m.cloth2 = B.plain('tuch_hell', 0xb9b09a, rough=.95, snow=.3)
    m.red = B.plain('tuch_rot', 0x8a3a2a, rough=.95, snow=.3)
    m.snow = B.plain('schnee', 0xd5dde8, rough=.8)
    m.hay = B.plain('stroh', 0xa8914a, rough=1, snow=.4)
    m.warm = B.glow('fenster', 0xffb25a, 4.5)
    m.ember = B.glow('glut', 0xff7a22, 6)
    return m

def drifts(m, pts):
    for x, y, r in pts: B.mound('wehe', r, (x, y, 0), m.snow, flat=.36)
def barrel(m, x, y, r=.17, h=.42):
    B.cyl('fass', r, h, (x, y, h / 2), m.plank, seg=9); B.cyl('fassreif', r + .006, .04, (x, y, h * .7), m.iron, seg=9)
def out(name): return os.path.join(MODELS, name + '.glb'), (os.path.join(PREV, name + '.png') if PREV else None)

# ---------- Werkstatt: offene Halle mit Esse, Amboss und halbfertigem Rammbock ----------
B.reset(); m = mats()
B.box('boden', (3.4, 2.6, .12), (0, .3, .06), m.plank, bevel=.01)
B.box('rueckwand', (3.4, .3, 1.9), (0, 1.5, .95), m.stone, bevel=.03)
B.box('seitenwand', (.3, 1.5, 1.9), (-1.55, .85, .95), m.stone, bevel=.03)
for x, y in ((-1.55, -.85), (1.55, -.85), (1.55, 1.4), (0, -.85)): B.box('pfosten', (.2, .2, 1.95), (x, y, .97), m.timber, bevel=.02)
B.box('pfette', (3.5, .18, .18), (0, -.85, 1.98), m.timber, bevel=.02)
for x in (-1.55, 0, 1.55): B.box('sparren', (.14, 2.7, .14), (x, .3, 2.5), m.timber, bevel=.015, rot=(.42, 0, 0))
B.box('pultdach', (3.9, 3.1, .1), (0, .3, 2.64), m.roofLow, bevel=.01, rot=(.42, 0, 0))
B.box('rueckwand_oben', (3.4, .3, 1.3), (0, 1.5, 2.5), m.stone, bevel=.03)
# Esse mit Schlot und Glut
B.box('esse', (.95, .8, .75), (-.95, 1.0, .37), m.stoneD, bevel=.03); B.box('glut', (.6, .45, .06), (-.95, .95, .76), m.ember, bevel=0)
B.box('rauchfang', (.8, .7, .8), (-.95, 1.05, 1.6), m.stoneD, bevel=.04); B.box('schlot', (.4, .4, 1.6), (-.95, 1.15, 2.7), m.stoneD, bevel=.03)
B.empty('Rauch1', (-.95, 1.15, 3.55)); B.empty('Feuer1', (-.95, .95, .85), .45)
B.cyl('blasebalg', .22, .5, (-.2, 1.1, .5), m.plank, seg=8, rot=(0, math.pi / 2, 0)); B.box('amboss', (.36, .16, .14), (-.5, .2, .62), m.iron, bevel=.02); B.cyl('ambossklotz', .16, .5, (-.5, .2, .3), m.log, seg=8)
B.box('werkbank', (1.1, .45, .08), (.95, 1.15, .7), m.plank, bevel=.01)
for sx in (-1, 1): B.box('bankbein', (.08, .4, .66), (.95 + sx * .46, 1.15, .36), m.timber, bevel=.008)
B.box('werkzeugbrett', (1.0, .05, .5), (.95, 1.33, 1.3), m.plank, bevel=.008)
for i in range(4): B.box('werkzeug', (.05, .03, .3), (.6 + i * .22, 1.3, 1.3), m.steel, bevel=0, rot=(0, .2 * (i - 1.5), 0))
# Halbfertiger Rammbock vor der Halle
B.cyl('rammbalken', .16, 2.2, (.5, -1.35, .62), m.log, seg=8, rot=(0, math.pi / 2, 0)); B.cyl('rammkopf', .2, .3, (1.7, -1.35, .62), m.iron, seg=8, rot=(0, math.pi / 2, 0))
for x in (-.3, 1.2):
    for sy in (-1, 1): B.box('rammgestell', (.1, .1, 1.1), (x, -1.35 + sy * .4, .5), m.timber, bevel=.01, rot=(sy * .35, 0, 0))
    B.cyl('rammrad', .24, .08, (x, -1.82, .24), m.timber, seg=10, rot=(math.pi / 2, 0, 0)); B.cyl('rammrad', .24, .08, (x, -.88, .24), m.timber, seg=10, rot=(math.pi / 2, 0, 0))
for i in range(5): B.box('brett', (1.6, .2, .05), (-1.2, -1.7 + i * .04, .05 + i * .055), m.cut, bevel=.005, rot=(0, 0, .05 * i))
barrel(m, 1.75, .3); barrel(m, 1.4, -.1, .15, .36)
drifts(m, ((-1.9, 1.7, .6), (1.3, 1.95, .6), (-2.0, -.4, .45), (2.0, -1.0, .4)))
o, p = out('wacht_workshop'); B.finish(o, 'wacht_workshop', preview=p)

# ---------- Holzlager: offener Schuppen, Stammstapel, Sägebock, Hackklotz ----------
B.reset(); m = mats()
for x in (-1.4, 1.4):
    for y in (.2, 1.6): B.box('pfosten', (.18, .18, 1.7 if y > 1 else 2.45), (x, y, .85 if y > 1 else 1.22), m.timber, bevel=.02)
B.box('rueckwand', (2.9, .1, 1.3), (0, 1.62, .75), m.plank, bevel=.01)
B.box('dach', (3.4, 2.2, .1), (0, .9, 2.12), m.roofLow, bevel=.01, rot=(-.42, 0, 0))
for x in (-1.4, 0, 1.4): B.box('sparren', (.12, 2.0, .12), (x, .9, 2.0), m.timber, bevel=.012, rot=(-.42, 0, 0))
def stack(cx, cy, n, r, L, rot_z=0):
    k = 0
    for row in range(n):
        for i in range(n - row):
            x = (i - (n - row - 1) / 2) * r * 2.02; z = r + row * r * 1.75
            dx, dy = (x, 0) if rot_z == 0 else (0, x)
            B.cyl('stamm', r, L, (cx + dx, cy + dy, z), m.log, seg=8, rot=(math.pi / 2, 0, rot_z))
            ex, ey = (0, -L / 2 - .005) if rot_z == 0 else (-L / 2 - .005, 0)
            B.cyl('schnitt', r * .92, .012, (cx + dx + ex, cy + dy + ey, z), m.cut, seg=8, rot=(math.pi / 2, 0, rot_z)); k += 1
stack(-.6, .95, 4, .15, 1.3); stack(.75, .95, 3, .15, 1.3)
stack(-1.1, -1.1, 3, .17, 1.9, math.pi / 2)
for sx in (-1, 1):  # Sägebock mit Stamm
    for sy in (-1, 1): B.box('bock', (.07, .07, .8), (.85 + sx * .45, -1.15 + sy * .2, .36), m.timber, bevel=.008, rot=(-sy * .45, 0, 0))
B.cyl('saegestamm', .13, 1.5, (.85, -1.15, .68), m.log, seg=8, rot=(0, math.pi / 2, 0))
B.box('saege', (.9, .02, .14), (.85, -1.15, .95), m.steel, bevel=0, rot=(0, .25, .5))
B.cyl('hackklotz', .24, .36, (1.75, -.2, .18), m.log, seg=9); B.box('axtstiel', (.04, .04, .6), (1.75, -.15, .6), m.timber, bevel=0, rot=(.5, 0, 0)); B.box('axtblatt', (.05, .16, .2), (1.75, -.25, .42), m.steel, bevel=.01)
for i in range(7): B.box('scheit', (.34, .09, .09), (1.5 + (i % 3) * .14, .45 + (i % 2) * .12, .05 + (i // 3) * .1), m.cut, bevel=.01, rot=(0, 0, .5 * i))
B.box('schlitten', (1.0, .5, .08), (-1.6, .1, .2), m.plank, bevel=.01);
for sy in (-1, 1): B.box('kufe', (1.2, .05, .1), (-1.6, .1 + sy * .22, .08), m.timber, bevel=.01)
drifts(m, ((-1.9, 1.7, .55), (1.6, 1.9, .6), (2.0, -1.6, .45), (-.2, -1.9, .4)))
o, p = out('wacht_lumber'); B.finish(o, 'wacht_lumber', preview=p)

# ---------- Handelshaus: Steinhaus mit Laubengang, Marktstände mit Tuchdächern, Waage, Karren ----------
B.reset(); m = mats()
X, Y = 2.6, 1.7; P = (0, .9)
B.box('sockel', (X, Y, 1.2), (P[0], P[1], .6), m.stone, bevel=.03)
B.box('putz', (X + .08, Y + .08, 1.0), (P[0], P[1], 1.7), m.plaster, bevel=.01)
for sx in (-1, 0, 1):
    for sy in (-1, 1): B.box('pfosten', (.14, .14, 1.02), (P[0] + sx * (X / 2 + .02), P[1] + sy * (Y / 2 + .02), 1.7), m.timber, bevel=.012)
for sy in (-1, 1):
    for z in (1.22, 2.2): B.box('riegel', (X + .2, .12, .12), (P[0], P[1] + sy * (Y / 2 + .04), z), m.timber, bevel=.012)
for sx in (-1, 1): B.gable_wall('giebel', Y + .08, 1.05, (P[0] + sx * X / 2, P[1], 2.22), m.plaster, thick=.1)
B.gable_roof('dach', X, Y + .08, 1.05, (P[0], P[1], 2.25), m.roof, thick=.11, over=.3)
B.box('schlot', (.4, .4, 1.3), (.8, 1.25, 3.0), m.stoneD, bevel=.03); B.empty('Rauch1', (.8, 1.25, 3.7))
B.box('tor', (.7, .1, .95), (0, P[1] - Y / 2 - .04, .5), m.plank, bevel=.01)
for x in (-.85, .85, -.3, .3): B.box('fenster', (.26, .03, .34), (x, P[1] - Y / 2 - .05, 1.72), m.warm, bevel=0)
B.box('ladenschild', (.5, .04, .34), (1.0, P[1] - Y / 2 - .3, 1.5), m.blue, bevel=.01); B.box('schildarm', (.06, .5, .06), (1.0, P[1] - Y / 2 - .2, 1.72), m.iron, bevel=0)
# Marktstände
def stall(cx, cy, cloth, w=1.2):
    for sx in (-1, 1):
        B.box('standpfosten', (.07, .07, 1.25), (cx + sx * w / 2, cy - .3, .62), m.timber, bevel=.008); B.box('standpfosten', (.07, .07, 1.5), (cx + sx * w / 2, cy + .3, .75), m.timber, bevel=.008)
    B.box('tresen', (w, .6, .08), (cx, cy, .55), m.plank, bevel=.01); B.box('standdach', (w + .25, .95, .04), (cx, cy, 1.42), cloth, bevel=0, rot=(-.38, 0, 0))
    for i in range(3): B.box('ware', (.2, .2, .16), (cx - w / 3 + i * w / 3, cy, .67), (m.hay, m.cut, m.red)[i], bevel=.03)
stall(-1.2, -1.0, m.blue); stall(.35, -1.25, m.cloth2);
B.box('waagebalken', (.6, .03, .03), (1.55, -.9, 1.0), m.iron, bevel=0); B.cyl('waagstaender', .03, 1.0, (1.55, -.9, .5), m.iron, seg=6)
for sx in (-1, 1): B.cyl('waagschale', .13, .03, (1.55 + sx * .28, -.9, .78), m.steel, seg=8)
B.box('karren', (.85, .5, .1), (1.6, -1.7, .36), m.plank, bevel=.015)
for sy in (-1, 1): B.cyl('rad', .22, .05, (1.7, -1.7 + sy * .3, .22), m.timber, seg=10, rot=(math.pi / 2, 0, 0))
for i in range(3): B.mound('sack', .15, (1.35 + i * .22, -1.7, .5), m.cloth2, flat=.85, seg=7)
barrel(m, -1.9, -.2); barrel(m, -1.6, .05, .15, .36); B.box('kiste', (.4, .36, .3), (-.5, -.15, .15), m.plank, bevel=.015, rot=(0, 0, .2))
drifts(m, ((-1.7, 1.75, .55), (1.5, 1.95, .6), (2.05, .2, .4), (-2.0, -1.8, .4)))
o, p = out('wacht_market'); B.finish(o, 'wacht_market', preview=p)

# ---------- Vorposten: Palisade mit Wachturm aus Holz, Lagerhaus, Signalfeuer ----------
B.reset(); m = mats()
R = 1.75
for i in range(26):
    a = i * 2 * math.pi / 26
    if abs(a - math.pi * 1.5) < .33: continue  # Tor nach vorn
    h = 1.25 + .12 * math.sin(i * 2.3)
    B.cyl('pfahl', .11, h, (math.cos(a) * R, math.sin(a) * R, h / 2), m.log, seg=6); B.cyl('pfahlspitze', .11, .22, (math.cos(a) * R, math.sin(a) * R, h + .11), m.log, seg=6, r2=.01)
for sx in (-1, 1): B.box('torpfosten', (.16, .16, 1.7), (sx * .55, -R + .05, .85), m.timber, bevel=.015)
B.box('torbalken', (1.3, .14, .14), (0, -R + .05, 1.65), m.timber, bevel=.015)
# Lagerhaus
B.box('lager_sockel', (1.6, 1.2, .4), (-.45, .55, .2), m.stone, bevel=.03); B.box('lager', (1.55, 1.15, .75), (-.45, .55, .77), m.plank, bevel=.02)
for sx in (-1, 1): B.gable_wall('lager_giebel', 1.15, .7, (-.45 + sx * .77, .55, 1.14), m.plank, thick=.08)
B.gable_roof('lager_dach', 1.55, 1.15, .7, (-.45, .55, 1.17), m.roof, thick=.1, over=.22)
B.box('lager_tor', (.5, .08, .6), (-.45, -.06, .7), m.timber, bevel=.01); B.box('lager_fenster', (.22, .03, .22), (.05, -.06, .9), m.warm, bevel=0)
# Wachturm aus Holz
TX, TY = .95, .5
for sx in (-1, 1):
    for sy in (-1, 1): B.box('turmbein', (.13, .13, 3.0), (TX + sx * .4, TY + sy * .4, 1.5), m.timber, bevel=.012, rot=(sy * .06, -sx * .06, 0))
for z in (1.0, 2.0):
    for sx in (-1, 1): B.box('turmstrebe', (.07, 1.0, .07), (TX + sx * .42, TY, z), m.timber, bevel=.008, rot=(.7 * sx, 0, 0))
    for sy in (-1, 1): B.box('turmstrebe', (1.0, .07, .07), (TX, TY + sy * .42, z), m.timber, bevel=.008, rot=(0, .7 * sy, 0))
B.box('turmplattform', (1.3, 1.3, .1), (TX, TY, 3.0), m.plank, bevel=.01)
for sx in (-1, 1): B.box('turmgelaender', (.06, 1.3, .45), (TX + sx * .62, TY, 3.3), m.plank, bevel=.008); B.box('turmgelaender', (1.3, .06, .45), (TX, TY + sx * .62, 3.3), m.plank, bevel=.008)
for sx in (-1, 1):
    for sy in (-1, 1): B.box('dachpfosten', (.08, .08, .9), (TX + sx * .55, TY + sy * .55, 3.5), m.timber, bevel=.008)
B.cyl('turmdach', 1.1, .8, (TX, TY, 4.35), m.roof, seg=4, r2=.03, rot=(0, 0, math.pi / 4), smooth=False)
B.box('leiter', (.3, .05, 3.1), (TX, TY - .75, 1.5), m.timber, bevel=.008, rot=(-.12, 0, 0))
# Signalfeuer, Erzkarren, Fässer
B.cyl('feuerschale', .2, .14, (-.2, -.85, .6), m.iron, seg=8, r2=.14);
for i in range(3): B.box('schalenbein', (.04, .04, .6), (-.2 + math.cos(i * 2.1) * .14, -.85 + math.sin(i * 2.1) * .14, .3), m.iron, bevel=0)
B.empty('Feuer1', (-.2, -.85, .75), .6)
B.box('erzkarren', (.7, .45, .28), (.7, -.8, .4), m.plank, bevel=.015); B.mound('erz', .26, (.7, -.8, .52), m.stoneD, flat=.6, seg=7)
for sy in (-1, 1): B.cyl('rad', .18, .05, (.7, -.8 + sy * .27, .18), m.timber, seg=10, rot=(math.pi / 2, 0, 0))
barrel(m, -1.1, -.6); barrel(m, -1.3, -.25, .15, .36)
B.cyl('mast', .03, 1.2, (TX, TY, 5.3), m.timber, seg=6)
fahne = B.box('Fahne1', (.02, .6, .34), (TX, TY - .33, 5.65), m.blue, bevel=0)
drifts(m, ((-2.1, .9, .5), (2.1, 1.0, .5), (1.2, 2.05, .5), (-1.3, 2.0, .5), (2.0, -1.2, .4)))
o, p = out('wacht_outpost'); B.finish(o, 'wacht_outpost', loose=(fahne,), preview=p)
