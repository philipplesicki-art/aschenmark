# Grenzburg: Bergfried, Ringmauer mit vier runden Ecktürmen, Torhaus an der Vorderseite, Halle im Hof.
# Grundfläche im Spiel 6 x 6 Einheiten (Größe 3), Höhe etwa 9.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, '..', '..', 'public', 'models', 'wacht_hq.glb')
PREVIEW = argv[1] if len(argv) > 1 else None
B.reset()

stone = B.brick('stein', 0x8f9096, 0x6c6e75, 0x2c2c30, scale=3.0, snow=.9, row_h=.22, brick_w=.46)
stoneD = B.brick('stein_dunkel', 0x6a6b70, 0x505157, 0x222226, scale=3.4, snow=.9)
stoneL = B.brick('stein_hell', 0xa3a4a8, 0x84868c, 0x323236, scale=2.6, snow=.9, row_h=.26)
timber = B.grain('balken', 0x3a2a1e, 0x5a412c, stretch=(14, 14, 1.2), scale=5, snow=.85, bump=.5)
plank = B.grain('bretter', 0x5c432e, 0x7d5e42, stretch=(10, 1, 1), scale=7, snow=.85, bump=.5)
plaster = B.grain('putz', 0xb9b2a2, 0xd6cfbd, stretch=(1, 1, 1), scale=3.5, snow=.6, rough=.95, bump=.15)
roof = B.brick('schindeln', 0x4a6278, 0x33475a, 0x141c24, scale=5.5, snow=.85, row_h=.2, brick_w=.34, mortar_size=.02, rough=.8, wall=False)
iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
blue = B.plain('tuch', 0x34506a, rough=.95)
snow = B.plain('schnee', 0xd5dde8, rough=.8)
yard = B.grain('hof', 0x4a443c, 0x6a6258, stretch=(1, 1, 1), scale=4, snow=.75, rough=1, bump=.3)
warm = B.glow('fenster', 0xffb25a, 4.5)

def crenels_box(cx, cy, z, sx, sy, mat, n=4, w=.3, h=.32, t=.2):
    # Zinnen rings um ein Rechteck
    for i in range(n):
        fx = -sx / 2 + (i + .5) * sx / n
        for s in (-1, 1): B.box('zinne', (w, t, h), (cx + fx, cy + s * (sy / 2 - t / 2), z + h / 2), mat, bevel=.015)
        fy = -sy / 2 + (i + .5) * sy / n
        for s in (-1, 1): B.box('zinne', (t, w, h), (cx + s * (sx / 2 - t / 2), cy + fy, z + h / 2), mat, bevel=.015)

def crenels_ring(cx, cy, z, r, mat, n=8, w=.26, h=.3, t=.16):
    for i in range(n):
        a = i * 2 * math.pi / n
        B.box('zinne', (w, t, h), (cx + math.cos(a) * r, cy + math.sin(a) * r, z + h / 2), mat, bevel=.012, rot=(0, 0, a + math.pi / 2))

W = 2.45   # halbe Seitenlänge der Ringmauer
WH = 2.3   # Mauerhöhe
B.box('hofboden', (2 * W, 2 * W, .08), (0, 0, .04), yard, bevel=0)
# Ringmauer mit Wehrgang und Zinnen (vorn mit Lücke für das Torhaus)
for sx in (-1, 1):
    B.box('mauer', (.5, 2 * W, WH), (sx * W, 0, WH / 2), stone, bevel=.03)
    for i in range(7): B.box('zinne', (.5, .3, .3), (sx * W, -W + .5 + i * .7, WH + .15), stone, bevel=.015)
    B.box('wehrgang', (.36, 2 * W - .5, .08), (sx * (W - .42), 0, WH - .32), plank, bevel=.01)
B.box('mauer', (2 * W, .5, WH), (0, W, WH / 2), stone, bevel=.03)
for i in range(7): B.box('zinne', (.3, .5, .3), (-W + .5 + i * .7, W, WH + .15), stone, bevel=.015)
for sx in (-1, 1):
    B.box('mauer', (1.55, .5, WH), (sx * 1.68, -W, WH / 2), stone, bevel=.03)
    for i in range(2): B.box('zinne', (.3, .5, .3), (sx * (1.3 + i * .7), -W, WH + .15), stone, bevel=.015)
# Ecktürme mit Kegeldach
for sx in (-1, 1):
    for sy in (-1, 1):
        x, y = sx * W, sy * W; front = sy < 0; h = 3.9 if front else 3.4
        B.cyl('turmsockel', .92, .6, (x, y, .3), stoneD, seg=12, r2=.82)
        B.cyl('turm', .8, h, (x, y, h / 2 + .3), stone, seg=12, r2=.74)
        B.cyl('turmkranz', .92, .22, (x, y, h + .32), stoneD, seg=12)
        crenels_ring(x, y, h + .43, .82, stone, n=8)
        B.cyl('turmdach', 1.0, 1.5, (x, y, h + 1.25), roof, seg=12, r2=.04)
        B.cyl('knauf', .05, .3, (x, y, h + 2.1), iron, seg=6)
        a = math.atan2(-sy, -sx)
        for z in (1.5, 2.7): B.box('scharte', (.08, .06, .38), (x + math.cos(a + math.pi) * .78, y + math.sin(a + math.pi) * .78, z), warm, bevel=0, rot=(0, 0, a + math.pi / 2))
# Torhaus
B.box('torhaus', (1.9, 1.0, 3.3), (0, -W, 1.65), stoneL, bevel=.04)
B.box('torkranz', (2.1, 1.2, .2), (0, -W, 3.38), stoneD, bevel=.03)
crenels_box(0, -W, 3.48, 2.1, 1.2, stoneL, n=4, w=.28)
B.box('torbogen', (1.05, .2, 1.5), (0, -W - .46, .75), stoneD, bevel=.04)
B.box('tor', (.82, .12, 1.3), (0, -W - .5, .65), plank, bevel=.01)
for z in (.35, .95): B.box('torband', (.84, .03, .07), (0, -W - .57, z), iron, bevel=.005)
for x in (-.55, .55): B.box('torfenster', (.2, .04, .34), (x, -W - .5, 2.4), warm, bevel=0)
B.box('wappen', (.42, .05, .5), (0, -W - .52, 2.45), blue, bevel=.01)
for sx in (-1, 1):
    B.cyl('feuerschale', .13, .1, (sx * .85, -W - .7, .78), iron, seg=8, r2=.09); B.cyl('schalenfuss', .03, .75, (sx * .85, -W - .7, .38), iron, seg=5)
    B.empty('Feuer' + ('1' if sx < 0 else '2'), (sx * .85, -W - .7, .9), .5)
B.box('bruecke', (1.2, .9, .1), (0, -W - .95, .06), plank, bevel=.015)
# Bergfried: hoher viereckiger Turm im hinteren Hof
KX, KY, KS, KH = .55, .75, 2.1, 6.4
B.box('bergfried_sockel', (KS + .3, KS + .3, .9), (KX, KY, .45), stoneD, bevel=.05)
B.box('bergfried', (KS, KS, KH), (KX, KY, KH / 2), stoneL, bevel=.04)
B.box('bergfried_kranz', (KS + .34, KS + .34, .24), (KX, KY, KH + .05), stoneD, bevel=.03)
crenels_box(KX, KY, KH + .17, KS + .34, KS + .34, stoneL, n=4, w=.3, h=.34)
B.box('wachstube', (1.3, 1.3, .8), (KX, KY, KH + .55), plaster, bevel=.02)
for sx in (-1, 1):
    for sy in (-1, 1): B.box('stubenpfosten', (.12, .12, .82), (KX + sx * .65, KY + sy * .65, KH + .56), timber, bevel=.012)
B.cyl('bergfried_dach', 1.25, 1.5, (KX, KY, KH + 1.7), roof, seg=4, r2=.03, rot=(0, 0, math.pi / 4), smooth=False)
B.cyl('knauf', .06, .4, (KX, KY, KH + 2.6), iron, seg=6)
for z in (2.2, 3.6, 5.0):
    B.box('fenster', (.26, .04, .42), (KX - .4, KY - KS / 2 - .02, z), warm, bevel=0); B.box('fenster', (.26, .04, .42), (KX + .4, KY - KS / 2 - .02, z + .5), warm, bevel=0)
    B.box('fenster', (.04, .26, .42), (KX - KS / 2 - .02, KY + .2, z + .3), warm, bevel=0)
for a in range(4): B.box('stubenfenster', (.3, .04, .3) if a % 2 == 0 else (.04, .3, .3), (KX + (0, .66, 0, -.66)[a], KY + (-.66, 0, .66, 0)[a], KH + .6), warm, bevel=0)
# Halle im Hof (Fachwerk auf Steinsockel), Schlot mit Rauch
HXc, HYc = -1.15, -.55
B.box('halle_sockel', (1.7, 2.2, .9), (HXc, HYc, .45), stone, bevel=.03)
B.box('halle_putz', (1.74, 2.24, .8), (HXc, HYc, 1.3), plaster, bevel=.01)
for sx in (-1, 1):
    for sy in (-1, 0, 1): B.box('halle_pfosten', (.12, .12, .82), (HXc + sx * .87, HYc + sy * 1.1, 1.3), timber, bevel=.012)
for sy in (-1, 1): B.gable_wall('halle_giebel', 1.74, 1.0, (HXc, HYc + sy * 1.1, 1.7), plaster, thick=.1).rotation_euler = (0, 0, math.pi / 2)
hr = B.gable_roof('halle_dach', 2.2, 1.74, 1.0, (HXc, HYc, 1.72), roof, thick=.1, over=.22); hr.rotation_euler = (0, 0, math.pi / 2)
B.box('halle_schlot', (.36, .36, 1.2), (HXc - .35, HYc + .5, 2.5), stoneD, bevel=.03); B.empty('Rauch1', (HXc - .35, HYc + .5, 3.15))
for y in (-.6, .1, .8): B.box('halle_fenster', (.04, .26, .32), (HXc + .89, HYc + y, 1.32), warm, bevel=0)
# Hof: Brunnen, Fässer, Kisten, Holzstapel, Schneewehen
B.cyl('brunnen', .32, .4, (1.3, -1.3, .2), stoneD, seg=10); B.cyl('brunnenwasser', .24, .05, (1.3, -1.3, .38), iron, seg=10)
for sx in (-1, 1): B.box('brunnenpfosten', (.07, .07, .8), (1.3 + sx * .3, -1.3, .6), timber, bevel=.008)
B.box('brunnendach', (.9, .5, .06), (1.3, -1.3, 1.02), roof, bevel=.01, rot=(.3, 0, 0))
B.cyl('fass', .18, .44, (.4, -1.75, .22), plank, seg=9); B.cyl('fass', .18, .44, (.78, -1.85, .22), plank, seg=9)
B.box('kiste', (.4, .36, .3), (1.85, -.3, .15), plank, bevel=.015, rot=(0, 0, .3)); B.box('kiste', (.34, .3, .26), (1.8, -.32, .43), plank, bevel=.015, rot=(0, 0, -.2))
for i in range(4): B.cyl('scheit', .07, .8, (1.95, .6 + i * .15, .08 + (i % 2) * .13), timber, seg=6, rot=(0, math.pi / 2, 0))
for x, y, r in ((-W - .6, 1.2, .6), (W + .7, -.6, .65), (-1.0, W + .55, .7), (1.4, W + .5, .55), (-W - .5, -1.6, .5), (2.0, -W - .7, .5), (-1.9, -W - .6, .5), (-.3, -1.9, .4)):
    B.mound('wehe', r, (x, y, 0), snow, flat=.36)
# Fahnen (wehen im Spiel)
B.cyl('mast', .035, 1.6, (KX, KY, KH + 3.4), timber, seg=6)
f1 = B.box('Fahne1', (.02, .9, .5), (KX, KY - .48, KH + 3.9), blue, bevel=0)
B.cyl('mast', .03, 1.1, (-.6, -W, 4.3), timber, seg=6)
f2 = B.box('Fahne2', (.02, .6, .36), (-.6, -W - .33, 4.62), blue, bevel=0)

B.finish(OUT, 'wacht_hq', loose=(f1, f2), size=2048, preview=PREVIEW)
