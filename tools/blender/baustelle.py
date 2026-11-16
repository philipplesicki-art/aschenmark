# Baustelle und Zerstörung: Baugerüst, Baustofflager, Trümmerhaufen und Ruine.
# Das Spiel streckt Gerüst und Ruine auf die Grundfläche des jeweiligen Gebäudes und färbt Trümmer und Ruine je Fraktion ein.
# Aufruf: blender --background --python baustelle.py -- <Vorschauordner oder -> [Name]
import bpy, sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, '..', '..', 'public', 'models')
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else None
PI = math.pi

def stoffe():
    return dict(
        roh=B.grain('rohholz', 0x7a6040, 0xa58a5c, stretch=(14, 14, 1.2), scale=5, snow=0, bump=.5),
        brett=B.grain('brett', 0x6d5436, 0x97794e, stretch=(12, 1, 1), scale=7, snow=0, bump=.5),
        kohle=B.grain('kohle', 0x0e0c0b, 0x2a221d, stretch=(14, 14, 1.2), scale=6, snow=0, rough=1, bump=.8),
        seil=B.plain('seil', 0x8c7a56, rough=1),
        stein=B.brick('stein', 0x8d8d8f, 0x66676b, 0x26262a, scale=3.6, snow=0, row_h=.22, brick_w=.46),
        block=B.grain('block', 0x77787c, 0x9c9c9e, stretch=(1, 1, 1), scale=4, snow=0, rough=.95, bump=.5),
        asche=B.grain('asche', 0x2e2a27, 0x57504a, stretch=(1, 1, 1), scale=5, snow=0, rough=1, bump=.7),
        eisen=B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7),
        russ=B.brick('russstein', 0x6c6b6a, 0x3f3e40, 0x161517, scale=3.6, snow=0, row_h=.22, brick_w=.46),
    )

def ende(name, size=512):
    B.finish(os.path.join(OUTDIR, name + '.glb'), name, size=size, ao_samples=24, preview=os.path.join(PREV, name + '.png') if PREV else None)

def rz(x, y, a):
    return (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a))

# ---------- Gerüst: doppelter Stangenkranz für eine Grundfläche von 4 x 4, Höhe 4 ----------
def geruest():
    B.reset(); M = stoffe(); R = random.Random(7)
    RI, RA, H = 2.12, 2.72, 4.0
    for k in range(4):
        a = k * PI / 2
        for (xs, y) in (((-RI, 0), -RI), ((-RA, 0), -RA)):
            for x in xs:
                h = H + .25 + R.random() * .5; px, py = rz(x, y, a)
                B.cyl('stange', .055, h, (px, py, h / 2), M['roh'], seg=6, r2=.04, rot=((R.random() - .5) * .04, (R.random() - .5) * .04, R.random() * 6))
        for z in (1.45, 2.95):
            for y, ln in ((-RI, 2 * RI + .3), (-RA, 2 * RA + .35)):
                px, py = rz(0, y, a)
                B.cyl('riegel', .04, ln, (px, py, z + (R.random() - .5) * .04), M['roh'], seg=5, rot=(0, PI / 2, a))
            for x in (-RI, 0, RI - .02):
                px, py = rz(x + .07, -(RI + RA) / 2, a)
                B.cyl('querholz', .035, RA - RI + .3, (px, py, z + .06), M['roh'], seg=5, rot=(PI / 2, 0, a))
                for y in (-RI, -RA):  # Seilbund an den Knoten
                    qx, qy = rz(x, y, a); B.cyl('bund', .075, .09, (qx, qy, z + .02), M['seil'], seg=6)
        # Laufbretter: unten auf zwei, oben auf zwei anderen Seiten
        for lv, z in ((0, 1.45), (1, 2.95)):
            if (k + lv) % 2 == 0 or (lv == 0 and k == 0):
                for i in range(3):
                    ln = 2 * RI - .2 - R.random() * (.9 if lv else .3); off = (R.random() - .5) * .5
                    px, py = rz(off, -RI - .12 - i * .2, a)
                    B.box('laufbrett', (ln, .18, .035), (px, py, z + .12 + i * .004), M['brett'], bevel=0, rot=(0, 0, a + (R.random() - .5) * .03))
        # Strebe schräg über die Außenseite
        s = 1 if k % 2 else -1; ln = math.hypot(RA, 2.95); px, py = rz(s * RA / 2, -RA - .05, a)
        B.cyl('strebe', .035, ln + .4, (px, py, 1.5), M['roh'], seg=5, rot=(0, s * math.atan2(RA, 2.95), a))
    # Leiter an der Vorderseite
    for sx in (-.2, .2): B.cyl('holm', .03, 3.4, (1.2 + sx, -RA - .45, 1.55), M['roh'], seg=5, rot=(-.22, 0, 0))
    for i in range(9):
        z = .25 + i * .34; B.cyl('sprosse', .022, .44, (1.2, -RA - .8 + z * .225, z), M['roh'], seg=4, rot=(0, PI / 2, 0))
    # Flaschenzug: Ausleger mit Seil und Last
    B.cyl('ausleger', .045, 1.5, (-1.2, -RA - .35, H + .1), M['roh'], seg=5, rot=(PI / 2, 0, 0))
    B.cyl('zugseil', .012, 2.3, (-1.2, -RA - 1.0, H - 1.05), M['seil'], seg=4)
    B.box('last', (.34, .26, .22), (-1.2, -RA - 1.0, H - 2.3), M['block'], bevel=.02, rot=(0, 0, .3))
    ende('geruest')

# ---------- Lager: Bretterstapel, Steinquader, Sägebock, Fass, Stämme ----------
def lager():
    B.reset(); M = stoffe(); R = random.Random(11)
    for y in (-.4, .4): B.box('unterlage', (.1, .1, .08), (-.55, y * 1.0, .04), M['roh'], bevel=.01, rot=(0, 0, PI / 2))
    for x in (-.95, -.15): B.box('unterlage', (.09, .62, .08), (x, 0, .04), M['roh'], bevel=.01)
    n = 0
    for lage in range(4):
        for i in range(3 - (lage > 2)):
            B.box('brett', (1.35 + R.random() * .25, .17, .045), (-.55 + (R.random() - .5) * .12, -.2 + i * .2 + (R.random() - .5) * .02, .105 + lage * .05), M['brett'], bevel=.006, rot=(0, 0, (R.random() - .5) * .06)); n += 1
    # Steinquader, grob gestapelt
    for i, (x, y, z) in enumerate(((.55, .3, .13), (.9, .28, .13), (.72, .6, .13), (.7, .32, .38), (1.05, .62, .12), (.45, .7, .1))):
        s = .26 + R.random() * .1
        B.box('quader', (s + .08, s, .24 + R.random() * .04), (x, y, z), M['block'], bevel=.03, rot=((R.random() - .5) * .1, (R.random() - .5) * .1, R.random() * 1.2))
    # Sägebock mit aufgelegtem Balken
    for x in (.35, 1.0):
        for s in (-1, 1): B.box('bock', (.06, .06, .62), (x, -.55 + s * .13, .27), M['roh'], bevel=.008, rot=(s * .42, 0, 0))
    B.box('balken', (1.2, .13, .13), (.68, -.55, .58), M['roh'], bevel=.012, rot=(0, 0, .05))
    B.box('saege', (.5, .015, .1), (.5, -.55, .68), M['eisen'], bevel=0, rot=(0, .5, .05))
    # Fass und Mörteltrog
    B.cyl('fass', .17, .42, (-.2, .72, .21), M['brett'], seg=9, r2=.15)
    for z in (.1, .32): B.cyl('reifen', .178, .03, (-.2, .72, z), M['eisen'], seg=9)
    B.box('trog', (.55, .3, .14), (-.85, .7, .07), M['brett'], bevel=.01, rot=(0, 0, .2))
    B.box('moertel', (.47, .22, .03), (-.85, .7, .13), M['block'], bevel=0, rot=(0, 0, .2))
    # Rundhölzer
    for i, (y, z) in enumerate(((-1.0, .09), (-.82, .09), (-.91, .24))):
        B.cyl('stamm', .09, 1.5 + R.random() * .3, (-.4 + (R.random() - .5) * .1, y, z), M['roh'], seg=7, rot=(0, PI / 2, (R.random() - .5) * .05))
    ende('lager')

def brocken(M, R, n, rad, zmax=.5, big=.34):
    for i in range(n):
        a = R.random() * 6.28; d = rad * math.sqrt(R.random()); s = .12 + R.random() * big
        z = max(.05, zmax * math.sqrt(max(0, 1 - (d / rad) ** 2)) * (.85 + R.random() * .3) + s * .12)   # auf der Kuppe des Schutts, nicht darin
        B.box('brocken', (s * (1 + R.random() * .6), s, s * (.5 + R.random() * .5)), (d * math.cos(a), d * math.sin(a), z), M['block' if i % 3 else 'stein'], bevel=.025,
              rot=((R.random() - .5) * 1.1, (R.random() - .5) * 1.1, R.random() * 6))

# ---------- Trümmerhaufen: Schutt, Mauerbrocken und verkohlte Balken ----------
def truemmer():
    B.reset(); M = stoffe(); R = random.Random(23)
    B.mound('schutt', .95, (0, 0, 0), M['asche'], flat=.3, seg=9)
    B.mound('schutt', .55, (.6, -.35, 0), M['asche'], flat=.3, seg=7)
    brocken(M, R, 30, 1.0, .27, .3)
    for i in range(5):
        a = R.random() * 6.28; ln = .9 + R.random() * .9
        B.box('balken', (ln, .11, .12), (.3 * math.cos(a), .3 * math.sin(a), .34 + R.random() * .15), M['kohle'], bevel=.015, rot=(R.random() * .3, (R.random() - .5) * 1.1, a))
    for i in range(4):
        a = R.random() * 6.28
        B.box('brett', (.5 + R.random() * .3, .16, .03), (.7 * math.cos(a), .7 * math.sin(a), .1), M['brett'], bevel=0, rot=((R.random() - .5) * .5, (R.random() - .5) * .5, R.random() * 6))
    ende('truemmer')

# ---------- Ruine: Mauerstümpfe um eine Grundfläche von 4 x 4, eingestürzte Balken, Schuttkegel ----------
def ruine():
    B.reset(); M = stoffe(); R = random.Random(41)
    W = 1.8
    for k in range(4):
        a = k * PI / 2
        x = -W
        while x < W - .2:
            ln = .5 + R.random() * .7; ln = min(ln, W - x)
            h = .2 + R.random() * R.random() * .9
            if abs(x) > W - .8 or abs(x + ln) > W - .3: h += .25 + R.random() * .6   # an den Ecken steht mehr
            if k == 0 and abs(x + ln / 2) < .7: h = .12                               # Lücke, wo das Tor war
            px, py = rz(x + ln / 2, -W, a); tilt = (R.random() - .5) * .12
            B.box('mauer', (ln + .02, .34, h), (px, py, h / 2), M['russ'], bevel=.02, rot=(tilt * math.cos(a), tilt * math.sin(a), a))
            # ausgebrochene Krone: zwei, drei Stufen aus immer kürzeren Resten
            l2, x2, z2 = ln, x, h
            for st in range(3 if h > .5 else 1):
                l3 = l2 * (.4 + R.random() * .35); x2 = x2 + R.random() * (l2 - l3); l2 = l3; h3 = .1 + R.random() * .2
                qx, qy = rz(x2 + l2 / 2, -W + (R.random() - .5) * .04, a)
                B.box('mauer', (l2, .31 - st * .03, h3), (qx, qy, z2 + h3 / 2 - .01), M['russ'], bevel=.025, rot=(0, 0, a + (R.random() - .5) * .08)); z2 += h3 - .01
            x += ln
    B.mound('schutt', 1.7, (0, 0, 0), M['asche'], flat=.3, seg=11)
    B.mound('schutt', .9, (-1.3, -1.7, 0), M['asche'], flat=.22, seg=8)
    B.mound('schutt', .8, (1.7, .9, 0), M['asche'], flat=.22, seg=8)
    brocken(M, R, 46, 1.75, .5, .4)
    brocken(M, R, 16, 2.6, .0, .3)
    # stehende, angekohlte Ständer
    for (x, y, h, t) in ((-1.5, 1.5, 2.3, .12), (1.45, 1.4, 1.5, -.2), (.3, 1.6, 1.9, .08), (-1.55, -.2, 1.1, .25)):
        B.box('staender', (.15, .15, h), (x, y, h / 2), M['kohle'], bevel=.02, rot=(t * .6, t, R.random()))
    # eingestürztes Gebälk
    for i in range(9):
        a = R.random() * 6.28; ln = 1.5 + R.random() * 1.6; d = R.random() * .9
        B.box('gebaelk', (ln, .13, .14), (d * math.cos(a * 1.7), d * math.sin(a * 1.7), .35 + R.random() * .55), M['kohle'], bevel=.018, rot=((R.random() - .5) * .4, (R.random() - .5) * .9, a))
    B.box('sparren', (2.4, .12, .13), (-.6, 1.0, 1.0), M['kohle'], bevel=.018, rot=(0, -.62, .5))
    B.box('sparren', (2.0, .12, .13), (.9, .9, .75), M['kohle'], bevel=.018, rot=(0, .55, 2.4))
    for i in range(7):
        a = R.random() * 6.28; d = .8 + R.random() * 1.6
        B.box('brett', (.5 + R.random() * .5, .17, .03), (d * math.cos(a), d * math.sin(a), .12 + R.random() * .1), M['brett'], bevel=0, rot=((R.random() - .5) * .5, (R.random() - .5) * .5, R.random() * 6))
    B.empty('Rauch1', (.2, .2, .7)); B.empty('Rauch2', (-.9, .8, .5))
    ende('ruine', 1024)

for nm, fn in (('geruest', geruest), ('lager', lager), ('truemmer', truemmer), ('ruine', ruine)):
    if ONLY and ONLY != nm: continue
    fn()
