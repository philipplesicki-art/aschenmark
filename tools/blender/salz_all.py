# Alle Gebäude des Salzbunds in einem Lauf. Stil: heller Kalkstein, graues Treibholz, Dächer aus umgedrehten Bootsrümpfen,
# Kupfer mit Grünspan, violettes Tuch, kühles Leuchtfeuer, Netze, Fässer, Walrippen.
# Aufruf: blender --background --python tools/blender/salz_all.py -- [Vorschau-Ordner oder -] [nur dieses Gebäude]
import bpy, bmesh, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib_bau as B

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, '..', '..', 'public', 'models')
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else None

def mats():
    m = type('M', (), {})()
    m.lime = B.brick('kalkstein', 0xc9c4b6, 0xa9a598, 0x55524a, scale=3.0, snow=.85, row_h=.24, brick_w=.5, mortar_size=.02)
    m.limeD = B.brick('kalkstein_dunkel', 0x99958a, 0x7c796f, 0x3c3a34, scale=3.4, snow=.85)
    m.drift = B.grain('treibholz', 0x6f6a62, 0x9a948a, stretch=(12, 12, 1.2), scale=5, snow=.8, bump=.6)
    m.plank = B.grain('planken', 0x5a5248, 0x837a6c, stretch=(10, 1, 1), scale=7, snow=.8, bump=.5)
    m.hull = B.grain('rumpf', 0x3e4a52, 0x5c6c76, stretch=(9, 1, 1), scale=8, snow=.8, bump=.6)
    m.copper = B.grain('kupfer', 0x3e8a78, 0x6ab49c, stretch=(2, 2, 2), scale=4, snow=.6, rough=.6, bump=.2)
    m.cloth = B.plain('tuch', 0x6a52a8, rough=.95, snow=.15)
    m.sail = B.plain('segel', 0xcfc8b4, rough=.95, snow=.3)
    m.rope = B.plain('tau', 0x8a7a5a, rough=1, snow=.3)
    m.bone = B.plain('walbein', 0xdcd8c8, rough=.7, snow=.4)
    m.iron = B.plain('eisen', 0x3c3d44, rough=.5, metallic=.7, snow=.5)
    m.salt = B.plain('salz', 0xe8ecee, rough=.6)
    m.fish = B.plain('fisch', 0x8a9aa4, rough=.5, metallic=.3)
    m.snow = B.plain('schnee', 0xd5dde8, rough=.8)
    m.light = B.glow('leuchtfeuer', 0xbfe6ff, 6)
    m.warm = B.glow('fenster', 0xffe2a8, 4)
    return m

def out(name): return os.path.join(MODELS, name + '.glb'), (os.path.join(PREV, name + '.png') if PREV else None)
def want(n): return ONLY is None or ONLY == n
def drifts(m, pts):
    for x, y, r in pts: B.mound('wehe', r, (x, y, 0), m.snow, flat=.36)
def barrel(m, x, y, r=.17, h=.42):
    B.cyl('fass', r, h, (x, y, h / 2), m.plank, seg=9); B.cyl('fassreif', r + .006, .04, (x, y, h * .7), m.iron, seg=9)
def hull(name, L, W, H, pos, mat, m, keel=True, n=10, k=7, rot=0):
    # Umgedrehter Bootsrumpf als Dach: Querschnitte entlang X, zu den Enden schmal und hochgezogen
    bm = bmesh.new(); rows = []
    for i in range(n + 1):
        t = -1 + 2 * i / n; w = max(.04, (1 - abs(t) ** 2.6)) ** .6; rise = (abs(t) ** 2.2) * H * .28
        rows.append([bm.verts.new((t * L / 2, W / 2 * w * math.sin(a), H * (.25 + .75 * w) * math.cos(a) + rise)) for a in [(-math.pi / 2 + math.pi * j / k) for j in range(k + 1)]])
    for i in range(n):
        for j in range(k): bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = B._obj(name, bm, mat, True); o.location = pos; o.rotation_euler = (0, 0, rot)
    if keel:
        kb = B.box(name + '_kiel', (L * .96, .1, .12), (pos[0], pos[1], pos[2] + H + .03), m.drift, bevel=.02, rot=(0, 0, rot))
    return o
def lantern(m, x, y, z, s=1, n=1):
    B.cyl('laternenfuss', .12 * s, .12 * s, (x, y, z + .06 * s), m.copper, seg=6); B.cyl('laterne', .16 * s, .34 * s, (x, y, z + .3 * s), m.light, seg=6)
    B.cyl('laternendach', .22 * s, .2 * s, (x, y, z + .57 * s), m.copper, seg=6, r2=.02)
def rib(m, x, y, h=1.6, lean=.35, side=1, rot=0):
    for i, (dz, dx, r) in enumerate(((0, 0, .08), (.45, .12, .065), (.85, .32, .045))):
        B.cyl('walrippe', r, h * .36, (x + math.cos(rot) * side * dx * h * .6, y + math.sin(rot) * side * dx * h * .6, (dz * h * .8) + h * .18), m.bone, seg=5, r2=r * .75, rot=(-math.sin(rot) * side * (lean + i * .3), math.cos(rot) * side * (lean + i * .3), 0))
def flag(m, x, y, z, n, h=1.4):
    B.cyl('mast', .03, h, (x, y, z + h / 2), m.drift, seg=6)
    return B.box('Fahne' + str(n), (.02, .62, .36), (x, y - .33, z + h - .22), m.cloth, bevel=0)
def net(m, x, y, z, w=1.0, h=.7, rot=0):
    for i in range(5): B.box('netzfaden', (w, .015, .015), (x, y, z + i * h / 4), m.rope, bevel=0, rot=(0, 0, rot))
    for i in range(6): B.box('netzfaden', (.015, .015, h), (x + math.cos(rot) * (i / 5 - .5) * w, y + math.sin(rot) * (i / 5 - .5) * w, z + h / 2), m.rope, bevel=0)

# ---------- Leuchtfeste: Kalksteinfeste mit hohem Leuchtturm, Rumpfdach-Halle und Kupferkuppeln (6 x 6) ----------
if want('hq'):
    B.reset(); m = mats()
    B.box('terrasse', (5.4, 5.2, .6), (0, 0, .3), m.limeD, bevel=.06)
    B.box('halle', (3.4, 2.2, 1.9), (-.7, -.7, 1.5), m.lime, bevel=.04)
    hull('hallendach', 4.2, 2.7, 1.25, (-.7, -.7, 2.45), m.hull, m)
    for x in (-1.9, -1.1, -.3, .5): B.box('hallenfenster', (.26, .04, .6), (x, -1.82, 1.6), m.warm, bevel=0); B.box('fenstersims', (.4, .1, .07), (x, -1.84, 1.26), m.limeD, bevel=.01)
    B.box('tor', (.9, .12, 1.25), (-.7, -1.84, 1.2), m.plank, bevel=.01); B.box('torbogen', (1.2, .2, 1.5), (-.7, -1.8, 1.32), m.limeD, bevel=.04); B.box('tor2', (.9, .12, 1.25), (-.7, -1.92, 1.2), m.plank, bevel=.01)
    B.box('treppe', (1.5, .8, .3), (-.7, -2.75, .15), m.limeD, bevel=.03); B.box('treppe2', (1.3, .5, .3), (-.7, -2.45, .45), m.limeD, bevel=.03)
    # Leuchtturm
    TX, TY = 1.5, .9
    B.cyl('turmsockel', 1.3, 1.2, (TX, TY, 1.2), m.limeD, seg=10, r2=1.15); B.cyl('turm', 1.05, 5.2, (TX, TY, 4.4), m.lime, seg=12, r2=.78)
    B.cyl('turmband1', 1.0, .16, (TX, TY, 3.4), m.copper, seg=12); B.cyl('turmband2', .9, .16, (TX, TY, 5.4), m.copper, seg=12)
    B.cyl('galerie', 1.15, .16, (TX, TY, 7.05), m.limeD, seg=12)
    for i in range(10): a = i * math.pi / 5; B.box('gelaender', (.06, .06, .4), (TX + math.cos(a) * 1.08, TY + math.sin(a) * 1.08, 7.3), m.copper, bevel=0)
    B.cyl('gelaenderring', 1.1, .05, (TX, TY, 7.5), m.copper, seg=12)
    B.cyl('leuchtraum', .62, .95, (TX, TY, 7.6), m.light, seg=8);
    for i in range(8): a = i * math.pi / 4; B.box('leuchtsprosse', (.06, .06, .98), (TX + math.cos(a) * .64, TY + math.sin(a) * .64, 7.6), m.copper, bevel=0)
    B.cyl('kuppel', .82, .75, (TX, TY, 8.45), m.copper, seg=10, r2=.06); B.cyl('knauf', .05, .5, (TX, TY, 9.0), m.copper, seg=6); B.empty('Feuer1', (TX, TY, 7.6), .01)
    for z, a in ((2.6, 3.6), (4.2, 4.6), (5.9, 3.9)): B.box('turmfenster', (.2, .05, .42), (TX + math.sin(a) * .98, TY - math.cos(a) * .98, z), m.warm, bevel=0, rot=(0, 0, a))
    # Ecktürmchen mit Kupferhauben, Brüstung
    for x, y in ((-2.45, -2.3), (2.45, -2.3), (-2.45, 2.3)):
        B.cyl('ecktuermchen', .5, 2.2, (x, y, 1.7), m.lime, seg=8, r2=.44); B.cyl('eckhaube', .58, .7, (x, y, 3.15), m.copper, seg=8, r2=.04); lantern(m, x, y, 3.45, .7)
    for i in range(8):
        B.box('bruestung', (.34, .16, .3), (-2.0 + i * .57, -2.5, .75), m.lime, bevel=.015)
        if i < 7: B.box('bruestung', (.16, .34, .3), (-2.6, -1.8 + i * .6, .75), m.lime, bevel=.015)
    B.box('schlot', (.4, .4, 1.0), (-1.7, -.2, 3.5), m.limeD, bevel=.03); B.empty('Rauch1', (-1.7, -.2, 4.05))
    for sx in (-1, 1): rib(m, -.7 + sx * .85, -2.3, 1.7, .3, -sx)
    barrel(m, .6, -2.2); barrel(m, .95, -2.05, .15, .36); net(m, 2.2, -1.2, .65, 1.2, .8, math.pi / 2)
    f1 = flag(m, -.7, -.7, 3.75, 1, 1.4); f2 = flag(m, -2.45, 2.3, 3.9, 2, 1.0)
    drifts(m, ((-3.0, 1.0, .6), (3.0, -1.4, .6), (.4, 2.9, .7), (-1.8, 2.9, .5), (2.9, 2.2, .5)))
    o, p = out('salz_hq'); B.finish(o, 'salz_hq', loose=(f1, f2), size=2048, preview=p)

# ---------- Bootshalle: lange Halle unter einem umgedrehten Rumpf, Ruderständer, Harpunen (4 x 4) ----------
if want('barracks'):
    B.reset(); m = mats()
    B.box('sockel', (3.2, 2.0, 1.1), (0, .3, .55), m.lime, bevel=.04)
    hull('dach', 4.0, 2.6, 1.5, (0, .3, 1.05), m.hull, m)
    for i in range(5): x = -1.4 + i * .7; B.box('spant', (.1, 2.2, .1), (x, .3, 1.12), m.drift, bevel=.01)
    B.box('tor', (.9, .12, .95), (0, -.72, .5), m.plank, bevel=.01); B.box('torsturz', (1.2, .16, .16), (0, -.74, 1.04), m.drift, bevel=.02)
    for x in (-1.1, 1.1): B.box('fenster', (.26, .04, .34), (x, -.71, .7), m.warm, bevel=0)
    for sx in (-1, 1): rib(m, sx * .65, -.85, 1.5, .3, -sx)
    for sx in (-1, 1): B.box('staender', (.07, .07, .85), (-1.25 + sx * .45, -1.5, .42), m.drift, bevel=.008)
    B.box('staenderholm', (1.0, .06, .06), (-1.25, -1.5, .78), m.drift, bevel=.008)
    for i in range(5): x = -1.6 + i * .18; B.cyl('harpune', .016, 1.6, (x, -1.58, .8), m.plank, seg=5, rot=(.14, 0, 0)); B.cyl('harpunenspitze', .04, .2, (x, -1.7, 1.66), m.iron, seg=4, r2=0, rot=(.14, 0, 0))
    for i in range(3): B.box('ruder', (.05, .05, 1.5), (1.0 + i * .18, -.82, .75), m.plank, bevel=0, rot=(.12, 0, 0)); B.box('ruderblatt', (.14, .03, .4), (1.0 + i * .18, -.95, 1.6), m.plank, bevel=.01, rot=(.12, 0, 0))
    barrel(m, 1.8, -1.2); lantern(m, -.75, -.78, 1.1, .7); lantern(m, .75, -.78, 1.1, .7)
    B.box('schlot', (.34, .34, .8), (.9, .5, 2.3), m.limeD, bevel=.03); B.empty('Rauch1', (.9, .5, 2.75))
    f1 = flag(m, -1.85, .3, 0, 1, 2.6)
    drifts(m, ((-1.9, 1.6, .55), (1.7, 1.7, .55), (2.0, -.2, .4)))
    o, p = out('salz_barracks'); B.finish(o, 'salz_barracks', loose=(f1,), preview=p)

# ---------- Werft: Helling mit halbfertigem Rumpf (Spanten), Kran und Schleuder im Bau (4 x 4) ----------
if want('workshop'):
    B.reset(); m = mats()
    B.box('helling', (3.6, 1.6, .16), (0, .5, .12), m.plank, bevel=.01, rot=(0, .05, 0))
    B.box('kiel', (3.3, .14, .16), (0, .5, .32), m.drift, bevel=.02)
    for i in range(8):
        x = -1.4 + i * .4; w = 1 - abs(i - 3.5) / 4.6
        for sy in (-1, 1): B.cyl('spant', .045, 1.2 * w + .3, (x, .5 + sy * .42 * w, .32 + (.6 * w + .15) * .78), m.drift, seg=5, r2=.03, rot=(-sy * .55, 0, 0))
    for sy in (-1, 1): B.box('bordwand', (2.2, .04, .26), (-.1, .5 + sy * .62, .7), m.hull, bevel=.01, rot=(-sy * .5, 0, 0))
    for x in (-1.7, 1.7):
        for sy in (-1, 1): B.box('stuetze', (.09, .09, 1.0), (x * .8, .5 + sy * .95, .5), m.drift, bevel=.01, rot=(sy * .35, 0, 0))
    # Kran
    B.box('kranmast', (.16, .16, 2.9), (-1.6, -1.0, 1.45), m.drift, bevel=.02); B.box('kranarm', (1.9, .12, .12), (-.8, -1.0, 2.8), m.drift, bevel=.015, rot=(0, -.2, 0))
    B.box('kranstrebe', (.09, .09, 1.3), (-1.25, -1.0, 2.25), m.drift, bevel=.01, rot=(0, .9, 0)); B.cyl('kranseil', .015, 1.3, (0, -1.0, 2.3), m.rope, seg=4); B.box('kranlast', (.4, .4, .3), (0, -1.0, 1.5), m.plank, bevel=.02)
    # Gezeitenschleuder im Bau, Werkbank, Teerkessel
    B.box('schleuderrahmen', (1.1, .7, .14), (1.25, -1.2, .3), m.drift, bevel=.02)
    for sy in (-1, 1): B.box('schleuderbock', (.1, .1, 1.0), (1.25, -1.2 + sy * .3, .8), m.drift, bevel=.01); B.cyl('schleuderrad', .2, .06, (1.25 + sy * .4, -1.2 - .4, .2), m.plank, seg=9, rot=(math.pi / 2, 0, 0))
    B.box('wurfarm', (1.6, .08, .08), (1.1, -1.2, 1.25), m.plank, bevel=.01, rot=(0, -.5, 0))
    B.cyl('teerkessel', .26, .3, (-.3, -1.5, .32), m.iron, seg=8, r2=.2); B.cyl('teerglut', .2, .04, (-.3, -1.5, .08), m.warm, seg=6); B.empty('Rauch1', (-.3, -1.5, .7)); B.empty('Feuer1', (-.3, -1.5, .12), .35)
    for i in range(5): B.box('planke', (1.5, .18, .04), (.3, 1.75, .05 + i * .05), m.plank, bevel=.005, rot=(0, 0, .04 * i))
    barrel(m, 1.9, .2); net(m, -1.9, .6, .2, 1.0, .9, math.pi / 2); lantern(m, -1.6, -1.0, 2.9, .7)
    drifts(m, ((-1.9, 1.9, .5), (1.9, 1.8, .5), (2.0, -.5, .35)))
    o, p = out('salz_workshop'); B.finish(o, 'salz_workshop', preview=p)

# ---------- Räucherei: Räucherhaus mit Schlot, Fischgestelle, Salzpfannen, Boot (4 x 4) ----------
if want('farm'):
    B.reset(); m = mats()
    B.box('haus', (1.8, 1.5, 1.0), (-.8, .8, .5), m.lime, bevel=.04)
    hull('dach', 2.5, 1.9, .95, (-.8, .8, .98), m.hull, m)
    B.box('schlot', (.4, .4, 1.3), (-1.2, 1.0, 1.9), m.limeD, bevel=.03); B.empty('Rauch1', (-1.2, 1.0, 2.6)); B.empty('Rauch2', (-.5, .8, 2.0))
    B.box('tuer', (.5, .08, .72), (-.6, .03, .4), m.plank, bevel=.01); B.box('fenster', (.24, .03, .24), (-1.25, .03, .6), m.warm, bevel=0)
    for k, (gx, gy) in enumerate(((.9, 1.2), (1.1, .2))):  # Fischgestelle
        for sx in (-1, 1): B.box('gestellpfosten', (.07, .07, 1.3), (gx + sx * .6, gy, .65), m.drift, bevel=.008)
        for z in (.75, 1.2):
            B.box('gestellholm', (1.3, .05, .05), (gx, gy, z), m.drift, bevel=.006)
            for i in range(6): B.box('fisch', (.06, .03, .26), (gx - .5 + i * .2, gy, z - .16), m.fish, bevel=.01)
    for i, (x, y) in enumerate(((-1.4, -1.0), (-.6, -1.3), (.2, -1.0))):  # Salzpfannen
        B.box('pfanne', (.7, .5, .08), (x, y, .1), m.iron, bevel=.015); B.box('salz', (.6, .4, .05), (x, y, .15), m.salt, bevel=.01)
    for i in range(3): B.mound('salzhaufen', .2, (.9 + i * .35, -1.6, .02), m.salt, flat=.8, seg=7)
    hb = hull('boot', 1.5, .6, .3, (1.5, -.7, .3), m.plank, m, keel=False, n=8, k=5, rot=.5); hb.rotation_euler = (math.pi, 0, .5)
    barrel(m, -1.9, -.2); barrel(m, -1.75, .15, .15, .36); net(m, 1.95, .7, .2, 1.0, .8, math.pi / 2)
    drifts(m, ((-1.9, 1.8, .5), (.3, 1.95, .5), (1.95, 1.7, .4)))
    o, p = out('salz_farm'); B.finish(o, 'salz_farm', preview=p)

# ---------- Leuchtturm: schlanker Kalksteinturm mit Kupferhaube und kühlem Licht (2 x 2) ----------
if want('tower'):
    B.reset(); m = mats()
    B.cyl('sockel', 1.0, .7, (0, 0, .35), m.limeD, seg=10, r2=.9)
    B.cyl('schaft', .78, 4.6, (0, 0, 3.0), m.lime, seg=12, r2=.58)
    for z in (2.0, 3.8): B.cyl('band', .76 - (z - 2) * .04, .14, (0, 0, z), m.copper, seg=12)
    B.cyl('galerie', .95, .14, (0, 0, 5.35), m.limeD, seg=12)
    for i in range(8): a = i * math.pi / 4; B.box('gelaender', (.05, .05, .36), (math.cos(a) * .88, math.sin(a) * .88, 5.6), m.copper, bevel=0)
    B.cyl('gelaenderring', .9, .05, (0, 0, 5.78), m.copper, seg=12)
    B.cyl('leuchtraum', .5, .8, (0, 0, 5.82), m.light, seg=8)
    for i in range(8): a = i * math.pi / 4; B.box('sprosse', (.05, .05, .82), (math.cos(a) * .52, math.sin(a) * .52, 5.82), m.copper, bevel=0)
    B.cyl('haube', .68, .7, (0, 0, 6.57), m.copper, seg=10, r2=.05); B.cyl('knauf', .04, .4, (0, 0, 7.1), m.copper, seg=6)
    B.box('tuer', (.44, .1, .8), (0, -.92, .42), m.plank, bevel=.01); B.box('tuerrahmen', (.6, .14, .95), (0, -.88, .5), m.limeD, bevel=.03)
    for z, a in ((1.9, .3), (3.1, 2.4), (4.2, 4.4)): B.box('fenster', (.16, .05, .36), (math.sin(a) * .7, -math.cos(a) * .7, z), m.warm, bevel=0, rot=(0, 0, a))
    barrel(m, .9, -.6); B.cyl('tauhaufen', .22, .12, (-.85, -.6, .06), m.rope, seg=9)
    drifts(m, ((.7, .8, .45), (-.8, .6, .5)))
    o, p = out('salz_tower'); B.finish(o, 'salz_tower', preview=p)

# ---------- Treibholzhof: Stapel aus gebleichtem Treibholz, Trockengerüst, Schlitten (4 x 4) ----------
if want('lumber'):
    B.reset(); m = mats()
    for x in (-1.3, 1.3):
        for y in (.3, 1.6): B.box('pfosten', (.16, .16, 2.3 if y < 1 else 1.6), (x, y, 1.15 if y < 1 else .8), m.drift, bevel=.02)
    B.box('segeldach', (3.2, 2.0, .05), (0, .95, 2.0), m.sail, bevel=0, rot=(-.48, 0, 0))
    for x in (-1.3, 0, 1.3): B.box('sparren', (.1, 1.9, .1), (x, .95, 1.93), m.drift, bevel=.01, rot=(-.48, 0, 0))
    for row in range(3):
        for i in range(4 - row): B.cyl('treibholz', .13 + .03 * ((i + row) % 2), 1.4, ((i - (3 - row) / 2) * .34, 1.0, .15 + row * .27), m.drift, seg=7, rot=(math.pi / 2, 0, .06 * (i - 1)))
    for i in range(4): B.cyl('stamm', .16, 1.9, (-1.2, -1.2 + (i % 2) * .34, .16 + (i // 2) * .3), m.plank, seg=7, rot=(0, math.pi / 2, 0))
    B.cyl('wurzelstock', .35, .5, (1.4, -1.0, .25), m.drift, seg=7, r2=.2)
    for i in range(5): a = i * 1.26; B.cyl('wurzel', .05, .6, (1.4 + math.cos(a) * .35, -1.0 + math.sin(a) * .35, .2), m.drift, seg=4, r2=.01, rot=(math.sin(a) * 1.1, -math.cos(a) * 1.1, 0))
    B.cyl('hackklotz', .24, .34, (.3, -.6, .17), m.plank, seg=8); B.box('axt', (.05, .2, .22), (.3, -.65, .45), m.iron, bevel=.01)
    B.box('schlitten', (1.0, .5, .08), (.4, -1.65, .2), m.plank, bevel=.01)
    for sy in (-1, 1): B.box('kufe', (1.2, .05, .1), (.4, -1.65 + sy * .22, .08), m.drift, bevel=.01)
    lantern(m, -1.3, .3, 2.3, .7); net(m, 1.9, .9, .2, 1.2, .9, math.pi / 2)
    drifts(m, ((-1.9, 1.8, .5), (1.8, 1.95, .5), (1.95, -1.7, .4)))
    o, p = out('salz_lumber'); B.finish(o, 'salz_lumber', preview=p)

# ---------- Hafenmarkt: Kontor aus Kalkstein, Stände unter Segeln, Waage, Salzfässer (4 x 4) ----------
if want('market'):
    B.reset(); m = mats()
    B.box('kontor', (2.4, 1.5, 1.6), (0, 1.0, .8), m.lime, bevel=.04)
    hull('dach', 3.1, 2.0, 1.0, (0, 1.0, 1.58), m.hull, m)
    B.box('tor', (.6, .1, .9), (0, .22, .48), m.plank, bevel=.01)
    for x in (-.8, .8): B.box('fenster', (.26, .04, .4), (x, .23, .95), m.warm, bevel=0)
    B.box('schild', (.5, .04, .34), (1.0, -.05, 1.3), m.cloth, bevel=.01); B.box('schildarm', (.05, .4, .05), (1.0, .05, 1.5), m.copper, bevel=0)
    def stall(cx, cy, cloth, w=1.2):
        for sx in (-1, 1):
            B.box('standpfosten', (.07, .07, 1.25), (cx + sx * w / 2, cy - .3, .62), m.drift, bevel=.008); B.box('standpfosten', (.07, .07, 1.5), (cx + sx * w / 2, cy + .3, .75), m.drift, bevel=.008)
        B.box('tresen', (w, .6, .08), (cx, cy, .55), m.plank, bevel=.01); B.box('standsegel', (w + .25, .95, .04), (cx, cy, 1.42), cloth, bevel=0, rot=(-.38, 0, 0))
        for i in range(3): B.box('ware', (.2, .2, .14), (cx - w / 3 + i * w / 3, cy, .66), (m.salt, m.fish, m.copper)[i], bevel=.03)
    stall(-1.2, -1.0, m.cloth); stall(.35, -1.3, m.sail)
    B.box('waagebalken', (.6, .03, .03), (1.6, -.8, 1.0), m.copper, bevel=0); B.cyl('waagstaender', .03, 1.0, (1.6, -.8, .5), m.copper, seg=6)
    for sx in (-1, 1): B.cyl('waagschale', .13, .03, (1.6 + sx * .28, -.8, .78), m.copper, seg=8)
    for i in range(4): barrel(m, 1.5 + (i % 2) * .38, -1.6 + (i // 2) * .38)
    B.mound('salzhaufen', .3, (-1.9, -.1, .02), m.salt, flat=.8, seg=7); lantern(m, -1.25, .15, 0, 1.0); B.cyl('laternenpfahl', .04, 1.0, (-1.25, .15, .5), m.copper, seg=5)
    B.box('schlot', (.34, .34, .8), (-.7, 1.2, 2.4), m.limeD, bevel=.03); B.empty('Rauch1', (-.7, 1.2, 2.85))
    f1 = flag(m, 1.35, 1.0, 1.6, 1, 1.5)
    drifts(m, ((-1.8, 1.95, .5), (1.6, 2.0, .5), (2.05, .2, .35)))
    o, p = out('salz_market'); B.finish(o, 'salz_market', loose=(f1,), preview=p)

# ---------- Salzlager: ummauerter Hof mit Speicher, Salzberg und Leuchtfeuer (4 x 4) ----------
if want('outpost'):
    B.reset(); m = mats()
    for sx in (-1, 1): B.box('mauer', (.3, 3.4, 1.0), (sx * 1.7, 0, .5), m.lime, bevel=.03)
    B.box('mauer', (3.4, .3, 1.0), (0, 1.7, .5), m.lime, bevel=.03)
    for sx in (-1, 1): B.box('mauer', (1.1, .3, 1.0), (sx * 1.15, -1.7, .5), m.lime, bevel=.03); B.box('torpfeiler', (.36, .36, 1.4), (sx * .6, -1.7, .7), m.limeD, bevel=.03); lantern(m, sx * .6, -1.7, 1.4, .7)
    B.box('speicher', (1.5, 1.1, 1.0), (-.6, .7, .5), m.lime, bevel=.03); hull('speicherdach', 2.0, 1.45, .8, (-.6, .7, .98), m.hull, m)
    B.box('speichertor', (.5, .08, .7), (-.6, .13, .38), m.plank, bevel=.01)
    B.cyl('feuerturm', .42, 2.6, (.95, .9, 1.3), m.lime, seg=8, r2=.34); B.cyl('feuergalerie', .5, .1, (.95, .9, 2.65), m.limeD, seg=8)
    B.cyl('feuer', .3, .5, (.95, .9, 2.95), m.light, seg=6); B.cyl('feuerhaube', .42, .45, (.95, .9, 3.42), m.copper, seg=8, r2=.03); B.empty('Feuer1', (.95, .9, 2.95), .01)
    B.mound('salzberg', .6, (.7, -.6, 0), m.salt, flat=.75, seg=8); B.box('schaufel', (.05, .05, .8), (.3, -.9, .4), m.drift, bevel=0, rot=(.3, .3, 0))
    for i in range(3): barrel(m, -1.1 + i * .36, -.9)
    B.box('erzkarren', (.7, .45, .28), (-.5, -.3, .4), m.plank, bevel=.015)
    for sy in (-1, 1): B.cyl('rad', .18, .05, (-.5, -.3 + sy * .27, .18), m.drift, seg=8, rot=(math.pi / 2, 0, 0))
    f1 = flag(m, .95, .9, 3.6, 1, 1.0)
    drifts(m, ((-2.1, 1.0, .5), (2.1, .9, .5), (.5, 2.15, .5), (2.05, -1.3, .4)))
    o, p = out('salz_outpost'); B.finish(o, 'salz_outpost', loose=(f1,), preview=p)
