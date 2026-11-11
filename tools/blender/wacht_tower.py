# Wachturm der Grenzwacht: runder Steinturm mit hölzernem Wehrgang, Zinnenkranz und Kegeldach.
# Grundfläche im Spiel 2 x 2 Einheiten (Größe 1), Höhe etwa 7.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, '..', '..', 'public', 'models', 'wacht_tower.glb')
PREVIEW = argv[1] if len(argv) > 1 else None
B.reset()

stone = B.brick('stein', 0x8f9096, 0x6c6e75, 0x2c2c30, scale=3.4, snow=.9, row_h=.22, brick_w=.46)
stoneD = B.brick('stein_dunkel', 0x6a6b70, 0x505157, 0x222226, scale=3.8, snow=.9)
timber = B.grain('balken', 0x3a2a1e, 0x5a412c, stretch=(14, 14, 1.2), scale=5, snow=.85, bump=.5)
plank = B.grain('bretter', 0x5c432e, 0x7d5e42, stretch=(10, 10, 1), scale=7, snow=.85, bump=.5)
roof = B.brick('schindeln', 0x4a6278, 0x33475a, 0x141c24, scale=6, snow=.85, row_h=.2, brick_w=.34, mortar_size=.02, rough=.8, wall=False)
iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
blue = B.plain('tuch', 0x34506a, rough=.95)
snow = B.plain('schnee', 0xd5dde8, rough=.8)
warm = B.glow('fenster', 0xffb25a, 4.5)

# Sockel (leicht ausgestellt), Schaft, Gesims
B.cyl('sockel', .95, .7, (0, 0, .35), stoneD, seg=14, r2=.84)
B.cyl('schaft', .8, 4.3, (0, 0, 2.6), stone, seg=14, r2=.72)
B.cyl('gesims', .86, .14, (0, 0, 4.72), stoneD, seg=14)
# Hölzerner Wehrgang auf Kragbalken
for i in range(8):
    a = i * math.pi / 4
    B.box('kragbalken', (.7, .1, .12), (math.cos(a) * .85, math.sin(a) * .85, 4.55), timber, bevel=.01, rot=(0, .35, a))
B.cyl('plattform', 1.18, .12, (0, 0, 4.85), plank, seg=14)
B.cyl('brustwehr', 1.16, .5, (0, 0, 5.15), plank, seg=14, r2=1.2)
B.cyl('brustwehr_innen', 1.02, .52, (0, 0, 5.16), stoneD, seg=14)
for i in range(7):
    a = i * 2 * math.pi / 7 + .2
    B.box('zinne', (.34, .1, .26), (math.cos(a) * 1.18, math.sin(a) * 1.18, 5.52), plank, bevel=.01, rot=(0, 0, a + math.pi / 2))
# Turmstube und Kegeldach
B.cyl('stube', .78, .9, (0, 0, 5.35), stone, seg=12)
for i in range(6):
    a = i * math.pi / 3
    B.box('dachstuetze', (.09, .09, .95), (math.cos(a) * .95, math.sin(a) * .95, 5.4), timber, bevel=.01)
B.cyl('dach', 1.4, 1.7, (0, 0, 6.72), roof, seg=14, r2=.05)
B.cyl('dachknauf', .06, .35, (0, 0, 7.7), iron, seg=6)
# Tür, Schießscharten und Fenster
B.box('tuerrahmen', (.6, .16, .95), (0, -.82, .5), stoneD, bevel=.03)
B.box('tuer', (.44, .1, .8), (0, -.87, .42), plank, bevel=.01)
B.box('tuerband', (.46, .03, .05), (0, -.93, .55), iron, bevel=.005)
for z, a in ((1.9, 0), (3.2, 2.2), (2.5, 4.2), (3.9, 5.4)):
    x, y = math.sin(a) * .79, -math.cos(a) * .79
    B.box('scharte', (.09, .06, .42), (x, y, z), warm, bevel=0, rot=(0, 0, a))
    B.box('schartenrahmen', (.2, .08, .08), (x * 1.01, y * 1.01, z + .26), stoneD, bevel=.01, rot=(0, 0, a))
for i in range(4):
    a = i * math.pi / 2 + .4
    B.box('stubenfenster', (.22, .05, .3), (math.sin(a) * .79, -math.cos(a) * .79, 5.45), warm, bevel=0, rot=(0, 0, a))
# Fass, Kiste, Schneewehen
B.cyl('fass', .17, .42, (.95, -.55, .21), plank, seg=9); B.cyl('fassreif', .176, .04, (.95, -.55, .3), iron, seg=9)
B.box('kiste', (.36, .32, .28), (-.85, -.62, .14), plank, bevel=.015, rot=(0, 0, .3))
for x, y, r in ((.7, .75, .45), (-.8, .5, .5), (.1, 1.0, .4)): B.mound('wehe', r, (x, y, 0), snow, flat=.36)
B.cyl('mast', .028, 1.3, (0, 0, 8.2), timber, seg=6)
fahne = B.box('Fahne1', (.02, .62, .36), (0, -.34, 8.6), blue, bevel=0)

B.finish(OUT, 'wacht_tower', loose=(fahne,), preview=PREVIEW)
