# Kaserne der Grenzwacht: Steinsockel, Fachwerk-Obergeschoss, Schindeldach, Anbau, Waffenständer.
# Aufruf: blender --background --python tools/blender/wacht_barracks.py -- [Ausgabe.glb] [Vorschau.png]
# Grundfläche im Spiel 4 x 4 Einheiten (Größe 2); die Vorderseite mit dem Tor zeigt nach -Y.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = argv[0] if argv else os.path.join(HERE, '..', '..', 'public', 'models', 'wacht_barracks.glb')
PREVIEW = argv[1] if len(argv) > 1 else None
B.reset()

stone = B.brick('stein', 0x8f9096, 0x6c6e75, 0x2c2c30, scale=3.2, snow=.9, row_h=.22, brick_w=.46)
stoneD = B.brick('stein_dunkel', 0x6a6b70, 0x505157, 0x222226, scale=3.6, snow=.9)
plaster = B.grain('putz', 0xb9b2a2, 0xd6cfbd, stretch=(1, 1, 1), scale=3.5, snow=.6, rough=.95, bump=.15)
timber = B.grain('balken', 0x3a2a1e, 0x5a412c, stretch=(14, 14, 1.2), scale=5, snow=.85, bump=.5)
plank = B.grain('bretter', 0x5c432e, 0x7d5e42, stretch=(10, 1, 1), scale=7, snow=.85, bump=.5)
roof = B.brick('schindeln', 0x4a6278, 0x33475a, 0x141c24, scale=5.5, snow=.9, row_h=.2, brick_w=.34, mortar_size=.02, rough=.8, wall=False)
iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
steel = B.plain('stahl', 0x9aa2ac, rough=.4, metallic=.8)
blue = B.plain('tuch', 0x34506a, rough=.95)
snow = B.plain('schnee', 0xd5dde8, rough=.8)
hay = B.plain('stroh', 0xa8914a, rough=1, snow=.4)
warm = B.glow('fenster', 0xffb25a, 4.5)

X, Y = 3.3, 2.7  # Baukörper (Länge entlang X, Tiefe entlang Y)
# Sockel und Sockelgesims
B.box('sockel', (X, Y, 1.15), (0, 0, .575), stone, bevel=.03)
B.box('gesims', (X + .12, Y + .12, .1), (0, 0, 1.17), stoneD, bevel=.02)
for sx in (-1, 1):
    for sy in (-1, 1): B.box('eckstein', (.34, .34, 1.2), (sx * (X / 2 - .1), sy * (Y / 2 - .1), .6), stoneD, bevel=.03)
# Obergeschoss: Putz mit Fachwerk
B.box('putz', (X + .1, Y + .1, 1.1), (0, 0, 1.75), plaster, bevel=.01)
h0, h1 = 1.22, 2.3
for sx in (-1, 1):
    for sy in (-1, 1): B.box('pfosten', (.16, .16, 1.12), (sx * (X / 2 + .03), sy * (Y / 2 + .03), 1.76), timber, bevel=.015)
for sy in (-1, 1):
    for z in (h0 + .04, h1): B.box('riegel', (X + .22, .13, .13), (0, sy * (Y / 2 + .05), z), timber, bevel=.015)
    for x in (-.85, 0, .85): B.box('stiel', (.12, .12, 1.0), (x, sy * (Y / 2 + .05), 1.76), timber, bevel=.012)
    for x, a in ((-1.27, .62), (1.27, -.62)): B.box('strebe', (.1, .1, 1.2), (x, sy * (Y / 2 + .055), 1.76), timber, bevel=.01, rot=(0, a, 0))
for sx in (-1, 1):
    for z in (h0 + .04, h1): B.box('riegel', (.13, Y + .22, .13), (sx * (X / 2 + .05), 0, z), timber, bevel=.015)
    B.box('stiel', (.12, .12, 1.0), (sx * (X / 2 + .05), 0, 1.76), timber, bevel=.012)
    for y, a in ((-.7, -.6), (.7, .6)): B.box('strebe', (.1, .1, 1.15), (sx * (X / 2 + .055), y, 1.76), timber, bevel=.01, rot=(a, 0, 0))
# Giebel und Dach
RH = 1.25
for sx in (-1, 1):
    B.gable_wall('giebel', Y + .1, RH, (sx * (X / 2), 0, 2.33), plaster, thick=.1)
    B.box('giebelstiel', (.12, .12, RH - .15), (sx * (X / 2 + .05), 0, 2.33 + (RH - .15) / 2), timber, bevel=.012)
    B.box('kehlbalken', (.12, Y * .55, .11), (sx * (X / 2 + .05), 0, 2.85), timber, bevel=.012)
B.gable_roof('dach', X, Y + .1, RH, (0, 0, 2.36), roof, thick=.11, over=.32)
B.box('first', (X + .7, .14, .12), (0, 0, 2.36 + RH + .03), timber, bevel=.02)
for sx in (-1, 1):  # Windbretter am Giebel
    for sy, a in ((-1, 1), (1, -1)):
        ang = math.atan2(RH, (Y + .1) / 2) * a
        B.box('windbrett', (.07, 1.95, .16), (sx * (X / 2 + .33), sy * .72, 2.36 + RH / 2 - .1), timber, bevel=.01, rot=(ang, 0, 0))
# Schornstein mit Rauch
B.box('schlot', (.46, .46, 1.5), (-.95, .55, 3.1), stoneD, bevel=.03)
B.box('schlotkranz', (.58, .58, .12), (-.95, .55, 3.86), stone, bevel=.02)
B.empty('Rauch1', (-.95, .55, 3.95))
# Tor an der Vorderseite, Stufe, Vordach
B.box('torbogen', (1.0, .14, 1.05), (0, -Y / 2 - .02, .52), stoneD, bevel=.03)
B.box('tor', (.78, .1, .92), (0, -Y / 2 - .07, .46), plank, bevel=.01)
for z in (.25, .68): B.box('torband', (.8, .03, .06), (0, -Y / 2 - .13, z), iron, bevel=.005)
B.box('stufe', (1.3, .5, .1), (0, -Y / 2 - .28, .05), stone, bevel=.02)
B.box('vordach', (1.5, .62, .07), (0, -Y / 2 - .32, 1.3), roof, bevel=.01, rot=(.32, 0, 0))
for sx in (-1, 1): B.box('vordachstrebe', (.07, .07, .62), (sx * .68, -Y / 2 - .2, 1.05), timber, bevel=.008, rot=(-.75, 0, 0))
# Fenster mit Rahmen und Läden (leuchten)
def window(x, y, z, face):
    if face == 'y':
        s = -1 if y < 0 else 1
        B.box('fenster', (.3, .03, .36), (x, y + s * .012, z), warm, bevel=0)
        B.box('rahmen', (.4, .06, .06), (x, y + s * .02, z + .2), timber, bevel=.008); B.box('rahmen', (.4, .06, .06), (x, y + s * .02, z - .2), timber, bevel=.008)
        B.box('kreuz', (.03, .05, .36), (x, y + s * .025, z), timber, bevel=0)
        for sx in (-1, 1): B.box('laden', (.14, .04, .4), (x + sx * .25, y + s * .03, z), plank, bevel=.006)
    else:
        s = -1 if x < 0 else 1
        B.box('fenster', (.03, .3, .36), (x + s * .012, y, z), warm, bevel=0)
        B.box('rahmen', (.06, .4, .06), (x + s * .02, y, z + .2), timber, bevel=.008); B.box('rahmen', (.06, .4, .06), (x + s * .02, y, z - .2), timber, bevel=.008)
        B.box('kreuz', (.05, .03, .36), (x + s * .025, y, z), timber, bevel=0)
for x in (-.42, .42, -1.27, 1.27): window(x, -Y / 2 - .06, 1.78, 'y')
for x in (-.42, .42): window(x, Y / 2 + .06, 1.78, 'y')
for sx in (-1, 1): window(sx * (X / 2 + .06), -.35, 1.78, 'x'); window(sx * (X / 2 + .06), .35, 1.78, 'x')
for sx in (-1, 1): B.box('fenster', (.03, .22, .28), (sx * (X / 2 + .06), 0, 3.15), warm, bevel=0)
# Anbau (Rüstkammer) an der rechten Seite mit Pultdach
B.box('anbau', (.9, 1.7, 1.25), (X / 2 + .45, .35, .625), plank, bevel=.02)
B.box('anbaudach', (1.15, 2.0, .08), (X / 2 + .5, .35, 1.42), roof, bevel=.01, rot=(0, .3, 0))
for y in (-.45, 1.15): B.box('anbaupfosten', (.1, .1, 1.3), (X / 2 + .9, y, .65), timber, bevel=.01)
# Waffenständer mit Speeren, Schilde an der Wand, Fass, Strohballen, Übungspuppe
RX0, RY0 = -1.05, -Y / 2 - .55
for sx in (-1, 1): B.box('staender', (.07, .07, .75), (RX0 + sx * .45, RY0, .375), timber, bevel=.008)
for z in (.3, .68): B.box('staenderholm', (1.0, .06, .06), (RX0, RY0, z), timber, bevel=.008)
for i in range(5):
    x = RX0 - .36 + i * .18
    B.cyl('speer', .016, 1.55, (x, RY0 - .1, .78), plank, seg=5, rot=(.14, 0, 0)); B.cyl('speerspitze', .035, .16, (x, RY0 - .22, 1.62), steel, seg=4, r2=0, rot=(.14, 0, 0))
for i, x in enumerate((.95, 1.32)):
    B.cyl('schild', .2, .04, (x, -Y / 2 - .09, .62), blue, seg=12, rot=(math.pi / 2, 0, 0)); B.cyl('schildbuckel', .055, .05, (x, -Y / 2 - .12, .62), steel, seg=8, rot=(math.pi / 2, 0, 0))
B.cyl('fass', .2, .5, (1.75, -Y / 2 - .45, .25), plank, seg=10)
for z in (.12, .38): B.cyl('fassreif', .207, .04, (1.75, -Y / 2 - .45, z), iron, seg=10)
B.box('strohballen', (.6, .4, .36), (-1.75, -Y / 2 - .2, .18), hay, bevel=.04, rot=(0, 0, .25))
B.cyl('puppe_pfahl', .05, 1.15, (-1.95, -Y / 2 - 1.0, .57), timber, seg=6); B.box('puppe_arm', (.75, .07, .07), (-1.95, -Y / 2 - 1.0, .92), timber, bevel=.008)
B.box('puppe_rumpf', (.3, .22, .42), (-1.95, -Y / 2 - 1.0, .72), hay, bevel=.05); B.cyl('puppe_kopf', .12, .2, (-1.95, -Y / 2 - 1.0, 1.24), hay, seg=8)
# Fahnenmast am Giebel (Fahne bleibt ein eigenes Teil und weht im Spiel)
B.cyl('mast', .03, 1.5, (X / 2 + .22, -.9, 3.2), timber, seg=6)
fahne = B.box('Fahne1', (.02, .7, .42), (X / 2 + .22, -1.28, 3.68), blue, bevel=0)
# Schneewehen am Sockel
for x, y, r in ((-1.2, Y / 2 + .25, .55), (.9, Y / 2 + .3, .7), (-X / 2 - .3, .2, .5), (X / 2 + 1.1, -.5, .45), (.2, Y / 2 + .2, .45), (-X / 2 - .25, -.9, .4)):
    B.mound('wehe', r, (x, y, .0), snow, flat=.38)

B.finish(OUT, 'wacht_barracks', loose=(fahne,), preview=PREVIEW)
