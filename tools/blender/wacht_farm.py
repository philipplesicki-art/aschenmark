# Hof der Grenzwacht: niedriges Langhaus mit Strohdach, Vorratsschober, Pferch, Heuhaufen und verschneites Feld.
# Grundfläche im Spiel 4 x 4 Einheiten (Größe 2).
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, '..', '..', 'public', 'models', 'wacht_farm.glb')
PREVIEW = argv[1] if len(argv) > 1 else None
B.reset()

stone = B.brick('stein', 0x8f9096, 0x6c6e75, 0x2c2c30, scale=3.6, snow=.9, row_h=.22, brick_w=.46)
plaster = B.grain('putz', 0xb9b2a2, 0xd6cfbd, stretch=(1, 1, 1), scale=3.5, snow=.6, rough=.95, bump=.15)
timber = B.grain('balken', 0x3a2a1e, 0x5a412c, stretch=(14, 14, 1.2), scale=5, snow=.85, bump=.5)
plank = B.grain('bretter', 0x5c432e, 0x7d5e42, stretch=(10, 1, 1), scale=7, snow=.85, bump=.5)
thatch = B.grain('stroh', 0x6e5c34, 0x9a8248, stretch=(1.2, 12, 12), scale=9, snow=.8, rough=1, bump=.7)
hay = B.grain('heu', 0xa8914a, 0xc9b068, stretch=(3, 3, 3), scale=8, snow=.75, rough=1, bump=.6)
earth = B.grain('acker', 0x3a3028, 0x54463a, stretch=(1, 8, 1), scale=5, snow=.8, rough=1, bump=.6)
iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
snow = B.plain('schnee', 0xd5dde8, rough=.8)
warm = B.glow('fenster', 0xffb25a, 4.5)

# Langhaus: Steinsockel, Putzwand mit Balken, tief gezogenes Strohdach
HX, HY = 2.3, 1.5
P = (-.55, .7, 0)
B.box('sockel', (HX, HY, .45), (P[0], P[1], .225), stone, bevel=.03)
B.box('wand', (HX - .04, HY - .04, .75), (P[0], P[1], .8), plaster, bevel=.01)
for sx in (-1, 1):
    for sy in (-1, 1): B.box('pfosten', (.13, .13, .8), (P[0] + sx * (HX / 2 - .02), P[1] + sy * (HY / 2 - .02), .82), timber, bevel=.012)
    B.gable_wall('giebel', HY, .95, (P[0] + sx * (HX / 2 - .05), P[1], 1.17), plaster, thick=.08)
    B.box('giebelstiel', (.1, .1, .8), (P[0] + sx * (HX / 2), P[1], 1.55), timber, bevel=.01)
for sy in (-1, 1): B.box('riegel', (HX + .1, .11, .11), (P[0], P[1] + sy * (HY / 2), 1.17), timber, bevel=.012)
B.gable_roof('dach', HX, HY, .95, (P[0], P[1], 1.2), thatch, thick=.2, over=.3)
B.box('firstholz', (HX + .5, .16, .12), (P[0], P[1], 2.2), timber, bevel=.02)
B.box('schlot', (.34, .34, .9), (P[0] + .6, P[1] + .3, 2.0), stone, bevel=.03); B.empty('Rauch1', (P[0] + .6, P[1] + .3, 2.5))
B.box('tuer', (.5, .08, .72), (P[0] - .3, P[1] - HY / 2 - .03, .62), plank, bevel=.01)
B.box('tuersturz', (.66, .1, .1), (P[0] - .3, P[1] - HY / 2 - .04, 1.02), timber, bevel=.01)
for x in (.45, -.95):
    B.box('fenster', (.26, .03, .26), (P[0] + x, P[1] - HY / 2 - .015, .85), warm, bevel=0)
    B.box('fensterbank', (.36, .07, .05), (P[0] + x, P[1] - HY / 2 - .03, .7), timber, bevel=.008)
B.box('fenster', (.03, .24, .24), (P[0] - HX / 2 - .015, P[1], .85), warm, bevel=0)
# Vorratsschober auf Stelzen
S = (1.25, 1.05, 0)
for sx in (-1, 1):
    for sy in (-1, 1): B.box('stelze', (.11, .11, .55), (S[0] + sx * .42, S[1] + sy * .42, .275), timber, bevel=.01)
B.box('schober', (1.05, 1.05, .8), (S[0], S[1], .95), plank, bevel=.02)
B.gable_roof('schoberdach', 1.05, 1.05, .6, (S[0], S[1], 1.36), thatch, thick=.16, over=.2)
B.box('leiter', (.3, .05, .7), (S[0] - .1, S[1] - .62, .32), timber, bevel=.008, rot=(-.5, 0, 0))
# Pferch mit Zaun, Trog, Heuhaufen
Z0, Z1, ZY0, ZY1 = -1.85, -.1, -1.85, -.55
def fence(x0, y0, x1, y1):
    n = max(2, round(math.hypot(x1 - x0, y1 - y0) / .55)); a = math.atan2(y1 - y0, x1 - x0); L = math.hypot(x1 - x0, y1 - y0)
    for i in range(n + 1): B.box('zaunpfahl', (.07, .07, .52), (x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, .26), timber, bevel=.008)
    for z in (.2, .4): B.box('zaunlatte', (L, .035, .06), ((x0 + x1) / 2, (y0 + y1) / 2, z), plank, bevel=.006, rot=(0, 0, a))
fence(Z0, ZY0, Z1, ZY0); fence(Z0, ZY1, Z0, ZY0); fence(Z1, ZY0, Z1, ZY1 - .4); fence(Z0, ZY1, Z1 - .7, ZY1)
B.box('trog', (.7, .24, .2), (-1.0, -1.6, .1), plank, bevel=.02)
B.mound('heuhaufen', .42, (-1.4, -1.0, 0), hay, flat=.85, seg=9); B.mound('heuhaufen', .3, (-.55, -1.25, 0), hay, flat=.8, seg=8)
B.cyl('heugabel', .015, .9, (-1.15, -.82, .45), timber, seg=5, rot=(.25, .1, 0))
# Verschneites Feld mit Furchen, Karren, Fässer
for i in range(6): B.box('furche', (1.7, .16, .1), (1.05, -1.9 + i * .26, .04), earth, bevel=.03)
B.box('karren', (.8, .46, .1), (.35, -.25, .34), plank, bevel=.015)
for sx in (-1, 1): B.box('karrenwand', (.8, .04, .2), (.35, -.25 + sx * .23, .46), plank, bevel=.008)
for sy in (-1, 1): B.cyl('rad', .2, .05, (.45, -.25 + sy * .28, .2), timber, seg=10, rot=(math.pi / 2, 0, 0))
B.box('deichsel', (.7, .05, .05), (-.3, -.25, .26), timber, bevel=.008, rot=(0, .2, 0))
B.cyl('fass', .16, .4, (1.9, .2, .2), plank, seg=9); B.cyl('fassreif', .166, .04, (1.9, .2, .28), iron, seg=9)
B.mound('sack', .16, (1.6, .25, .08), hay, flat=.9, seg=7)
for x, y, r in ((-1.6, 1.6, .5), (.3, 1.65, .55), (1.9, 1.8, .4), (-1.95, .2, .4)): B.mound('wehe', r, (x, y, 0), snow, flat=.36)

B.finish(OUT, 'wacht_farm', preview=PREVIEW)
