# Natur aus Blender: Bäume (Fichten, Laubbäume, tote Bäume), Felsen und die Erzader.
# Aufruf: blender --background --python tools/blender/natur.py -- [Vorschauordner oder -] [nur: Teil des Namens]
# Bäume: wenige Dreiecke, Farbe und Schatten stecken in den Eckenfarben (das Spiel zeichnet sie zu Hunderten als Instanzen
# und legt den Schnee selbst auf). Felsen und Erzader: gebackene Textur wie die Gebäude.
import bpy, bmesh, sys, os, math, random
from mathutils import Vector, Matrix, noise
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import importlib, lib_bau as B
importlib.reload(B)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else ''
OUT = os.path.join(HERE, '..', '..', 'public', 'models')
made = []

def rgb(h): return Vector(B.lin(h)[:3])
def mixc(a, b, t): t = max(0, min(1, t)); return a * (1 - t) + b * t

# ---------- Netz mit Eckenfarben ----------
class Netz:
    def __init__(s): s.v = []; s.f = []; s.c = []; s.sm = []
    def tri(s, pts, cols, smooth=False):
        i = len(s.v); s.v += [tuple(p) for p in pts]; s.f.append(tuple(range(i, i + len(pts)))); s.c.append([tuple(c) for c in cols]); s.sm.append(smooth)
    def rohr(s, p0, p1, r0, r1, seg, c0, c1, twist=0):
        # Ast oder Stamm zwischen zwei Punkten; rundum leicht wechselnde Helligkeit
        p0, p1 = Vector(p0), Vector(p1); d = (p1 - p0).normalized(); a = d.cross(Vector((0, 0, 1)))
        if a.length < .01: a = Vector((1, 0, 0))
        a.normalize(); b = d.cross(a)
        def ring(p, r, k): return [p + (a * math.cos(twist + 6.2832 * i / seg) + b * math.sin(twist + 6.2832 * i / seg)) * r * (1 + .12 * math.sin(i * 2.3 + k)) for i in range(seg)]
        A, Bq = ring(p0, r0, 1), ring(p1, r1, 1)
        for i in range(seg):
            j = (i + 1) % seg; sh = .78 + .22 * math.sin(i * 1.7); sj = .78 + .22 * math.sin(j * 1.7)
            s.tri([A[i], A[j], Bq[j], Bq[i]], [c0 * sh, c0 * sj, c1 * sj, c1 * sh], True)
    def bauen(s, name):
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f); me.update()
        ca = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); k = 0
        for fi, p in enumerate(me.polygons):
            p.use_smooth = s.sm[fi]
            for ci in range(len(p.vertices)): ca.data[k].color = (*s.c[fi][ci], 1); k += 1
        me.color_attributes.active_color = ca
        try: me.color_attributes.render_color_index = 0
        except Exception: pass
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .95
        n = nt.nodes.new('ShaderNodeVertexColor'); n.layer_name = 'Col'; nt.links.new(n.outputs[0], b.inputs['Base Color'])
        me.materials.append(m)
        o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
        return o

def ausgabe(o, name):
    out = os.path.abspath(os.path.join(OUT, name + '.glb'))
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if PREV: B._preview(os.path.join(PREV, name + '.png'))
    kw = dict(filepath=out, export_format='GLB', export_yup=True, export_apply=True)
    try: bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', export_all_vertex_colors=True, **kw)
    except TypeError:
        try: bpy.ops.export_scene.gltf(export_vertex_color='ACTIVE', **kw)
        except TypeError: bpy.ops.export_scene.gltf(**kw)
    print('GLB:', out, os.path.getsize(out), 'Bytes,', tris, 'Dreiecke'); made.append(name)

# ---------- Fichte: Etagen aus einzelnen hängenden Zweigen statt glatter Kegel ----------
def fichte(name, seed, h=9.0, r=1.75, etagen=9, kahl=1.1, lo=0x16302a, hi=0x3a6648, licht=0x6c8c58, schief=.0):
    R = random.Random(seed); N = Netz(); bark0, bark1 = rgb(0x2a1f18), rgb(0x4a3a2c); LO, HI, LI = rgb(lo) * 1.5, rgb(hi) * 1.8, rgb(licht) * 1.8
    # Stamm in vier Stücken mit leichtem Schwung, Wurzelanläufe
    def ax(z): return Vector((schief * z * z + .08 * math.sin(z * .9 + seed), .06 * math.sin(z * 1.3 + seed * 2), z))
    zs = [-.1, h * .22, h * .5, h * .78, h * .97]
    for i in range(4): N.rohr(ax(zs[i]), ax(zs[i + 1]), .27 * (1 - zs[i] / h) + .04, .27 * (1 - zs[i + 1] / h) + .03, 6, mixc(bark0, bark1, i / 4), mixc(bark0, bark1, (i + 1) / 4))
    base = ax(0)
    for i in range(4):
        a = i * 1.57 + R.random(); t = Vector((math.cos(a), math.sin(a), 0)); q = Vector((-t.y, t.x, 0)); up = base + Vector((0, 0, .75)) + t * .15
        f0 = base + t * .62 + q * .1 - Vector((0, 0, .08)); f1 = base + t * .62 - q * .1 - Vector((0, 0, .08))
        N.tri([up, f0, f1], [bark1 * .9, bark0 * .6, bark0 * .6])
        N.tri([up, base + t * .2 + q * .24, f0], [bark1 * .8, bark0 * .7, bark0 * .6])
        N.tri([up, f1, base + t * .2 - q * .24], [bark1 * .8, bark0 * .6, bark0 * .7])
    for e in range(etagen):
        t = e / (etagen - 1); z = kahl + (h - kahl - 1.0) * t ** 1.05; rad = r * (1 - t) ** .8 + .28; c = ax(z)
        n = max(6, 12 - e + R.randint(-1, 1)); a0 = R.random() * 6.28; hell = .85 + .35 * t
        # dunkler Kern, damit man nicht durch die Etage auf den Stamm sieht
        kr = rad * .42; top = ax(z + .95 + .3 * (1 - t))
        for i in range(6):
            p0 = c + Vector((math.cos(i * 1.0472), math.sin(i * 1.0472), -.12)) * kr; p1 = c + Vector((math.cos((i + 1) * 1.0472), math.sin((i + 1) * 1.0472), -.12)) * kr
            N.tri([top, p0, p1], [LO * 1.1 * hell, LO * .7, LO * .7])
        for i in range(n):
            if R.random() < .08: continue  # hier ist ein Zweig abgebrochen
            a = a0 + 6.2832 * i / n + (R.random() - .5) * .3; L = rad * (.72 + R.random() * .42) * (1 if i % 2 else .78); w = L * (.19 + R.random() * .06); haeng = L * (.34 + R.random() * .26) + .1
            d = Vector((math.cos(a), math.sin(a), 0)); q = Vector((-d.y, d.x, 0))
            b0 = c + d * .1 + Vector((0, 0, .62 + (.28 if i % 2 == 0 else 0))); tip = c + d * L + Vector((0, 0, -haeng + .25))
            rid = c + d * L * .5 + Vector((0, 0, .5 - haeng * .28)); ml = c + d * L * .52 + q * w + Vector((0, 0, .12 - haeng * .5)); mr = c + d * L * .52 - q * w + Vector((0, 0, .12 - haeng * .5))
            g = .8 + R.random() * .4; cb = mixc(LO, HI, .25) * hell * g; cm = mixc(LO, HI, .9) * hell * g; ct = mixc(HI, LI, .45 + R.random() * .55) * hell * g; cs = mixc(LO, HI, .6) * hell * g
            N.tri([b0, ml, rid], [cb, cs, cm]); N.tri([b0, rid, mr], [cb, cm, cs * .82])
            N.tri([rid, ml, tip], [cm, cs, ct]); N.tri([rid, tip, mr], [cm, ct, cs * .82])
            N.tri([b0, mr, ml], [LO * .6, LO * .75, LO * .75]); N.tri([ml, mr, tip], [LO * .75, LO * .75, LO])
    # Wipfel
    c = ax(h - 1.1); top = ax(h + .25)
    for i in range(5):
        p0 = c + Vector((math.cos(i * 1.2566), math.sin(i * 1.2566), 0)) * .3; p1 = c + Vector((math.cos((i + 1) * 1.2566), math.sin((i + 1) * 1.2566), 0)) * .3
        N.tri([top, p0, p1], [mixc(HI, LI, .4), mixc(LO, HI, .5), mixc(LO, HI, .5)])
    return N.bauen(name)

# ---------- Laubbaum: Stamm mit Ästen, Krone aus kantigen Ballen ----------
def ballen(N, pos, r, sq, lo, hi, R, haeng=0, sub=1):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1); off = Vector((R.random() * 9, R.random() * 9, R.random() * 9))
    for v in bm.verts:
        n = v.co.normalized(); k = 1 + .55 * noise.noise(n * 2.1 + off)
        v.co = Vector((n.x * r * k, n.y * r * k, n.z * r * sq * k - haeng * r * max(0, 1 - abs(n.z) * 1.4) * (.6 + .4 * math.sin(math.atan2(n.y, n.x) * 5 + off.x))))
    bm.normal_update()
    for f in bm.faces:
        fn = f.normal; cols = []
        for v in f.verts:
            up = .5 + .5 * v.co.normalized().z; s = .5 + .5 * fn.z
            cols.append(mixc(lo, hi, up * .5 + s * .7 - .2 + .3 * noise.noise(v.co * 2 + off)) * (.35 + .65 * up))
        N.tri([Vector(pos) + v.co for v in f.verts], cols)
    bm.free()
def laub(name, seed, lo, hi, h=6.2, breit=2.3, sq=.62, haeng=0, schirm=False, rinde=(0x2c231c, 0x54463a)):
    R = random.Random(seed); N = Netz(); b0, b1 = rgb(rinde[0]), rgb(rinde[1]); LO, HI = rgb(lo), rgb(hi)
    gab = h * (.62 if schirm else .42); kn = Vector((.15 * math.sin(seed), .12 * math.cos(seed * 1.7), gab)); mid0 = kn * .5 + Vector((.12, 0, 0))
    N.rohr((0, 0, -.1), mid0, .34, .26, 7, b0 * .7, b0); N.rohr(mid0, kn, .26, .2, 7, b0, b1)
    n = 4 if schirm else 5; a0 = R.random() * 6.28; ends = []
    for i in range(n):
        a = a0 + 6.2832 * i / n + (R.random() - .5) * .5; L = breit * (.55 + R.random() * .3); e = kn + Vector((math.cos(a) * L, math.sin(a) * L, (h - gab) * ((.45 if schirm else .5) + R.random() * .2)))
        mid = kn + (e - kn) * .5 + Vector((0, 0, .25)); N.rohr(kn, mid, .15, .1, 5, b1, b1 * .9, i); N.rohr(mid, e, .1, .05, 5, b1 * .9, b0, i); ends.append(e)
    top = kn + Vector((0, 0, (h - gab) * (.55 if schirm else .8))); N.rohr(kn, top, .16, .06, 5, b1, b0)
    for e in ends:
        rr = breit * (.36 + R.random() * .12); ballen(N, e + Vector((0, 0, .15)), rr, sq * (.6 if schirm else 1), LO, HI, R, haeng, 2)
        for k in range(3):  # kleine Büschel rund um jeden Astballen
            a = R.random() * 6.28; ballen(N, e + Vector((math.cos(a) * rr * .8, math.sin(a) * rr * .8, (R.random() - .35) * rr * sq)), rr * (.45 + R.random() * .2), sq * (.7 if schirm else 1), LO * (.8 + R.random() * .3), HI * (.8 + R.random() * .3), R, haeng)
    ballen(N, top + Vector((0, 0, .1)), breit * (.55 if schirm else .5), sq * (.55 if schirm else 1.05), LO, HI, R, haeng, 2)
    if not schirm: ballen(N, kn + Vector((R.random() - .5, R.random() - .5, (h - gab) * .42)), breit * .5, sq, LO * .8, HI * .85, R, haeng)
    return N.bauen(name)

# ---------- Toter Baum: verdrehter Stamm, abgebrochene Äste, verkohlt ----------
def tot(name, seed, h=4.2):
    R = random.Random(seed); N = Netz(); c0, c1, asche = rgb(0x15110f), rgb(0x2e2623), rgb(0x5a5450)
    p = Vector((0, 0, -.1)); pts = [p]
    for i in range(4): p = p + Vector(((R.random() - .5) * .5, (R.random() - .5) * .5, h / 4)); pts.append(p)
    for i in range(4):
        N.rohr(pts[i], pts[i + 1], .26 - i * .05, .21 - i * .05, 6, mixc(c0, c1, i / 4), mixc(c0, asche if i == 3 else c1, (i + 1) / 4))
    t = pts[4]  # Bruchspitze
    for i in range(3):
        a = i * 2.1 + seed
        N.tri([t + Vector((math.cos(a) * .06, math.sin(a) * .06, 0)), t + Vector((math.cos(a + 2.1) * .06, math.sin(a + 2.1) * .06, 0)), t + Vector((math.cos(a + 1) * .03, math.sin(a + 1) * .03, .3 + R.random() * .3))], [c1, c1, asche])
    for i in range(6):
        k = 1 + i * .5; j = min(3, int(k)); base = pts[j] + (pts[j + 1] - pts[j]) * min(1, k - j)
        a = i * 2.4 + R.random(); L = (1.5 - i * .14) * (.7 + R.random() * .5); d = Vector((math.cos(a), math.sin(a), .35 + R.random() * .5)).normalized()
        e1 = base + d * L * .55; e2 = e1 + (d + Vector((R.random() - .5, R.random() - .5, .25 + R.random() * .4))).normalized() * L * .5
        N.rohr(base, e1, .11, .07, 5, c1, c0, i); N.rohr(e1, e2, .07, .015, 4, c0, mixc(c0, asche, .5), i)
        if R.random() < .6:
            e3 = e1 + Vector((R.random() - .5, R.random() - .5, R.random() * .3 - .05)).normalized() * L * .4; N.rohr(e1, e3, .035, .01, 3, c0, c1, i)
    for i in range(4):  # Wurzeln
        a = i * 1.57 + R.random(); d = Vector((math.cos(a), math.sin(a), 0)); N.rohr(Vector((0, 0, .45)) + d * .12, d * .7 - Vector((0, 0, .1)), .1, .04, 4, c1, c0, i)
    return N.bauen(name)

# ---------- Fels: Brocken mit glatt abgespaltenen Flächen, Textur mit Schichtung, Rissen und Flechten ----------
def felsmat(name, c1, c2, flechte=0x444a30, erz=None):
    m, nt, b, tc = B._base(name, .93)
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, 4.5); mp.inputs['Rotation'].default_value = (.22, .1, 0); nt.links.new(tc.outputs['Object'], mp.inputs[0])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = 2.4; n.inputs['Detail'].default_value = 8; n.inputs['Roughness'].default_value = .7; nt.links.new(mp.outputs[0], n.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = .34; ramp.color_ramp.elements[0].color = B.lin(c1); ramp.color_ramp.elements[1].position = .7; ramp.color_ramp.elements[1].color = B.lin(c2)
    nt.links.new(n.outputs[0], ramp.inputs[0])
    # Risse: dunkle Linien entlang der Zellgrenzen
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.feature = 'DISTANCE_TO_EDGE'; vo.inputs['Scale'].default_value = .9
    wn = nt.nodes.new('ShaderNodeTexNoise'); wn.inputs['Scale'].default_value = 1.6; wn.inputs['Detail'].default_value = 3; nt.links.new(tc.outputs['Object'], wn.inputs['Vector'])
    ws = nt.nodes.new('ShaderNodeVectorMath'); ws.operation = 'SCALE'; ws.inputs['Scale'].default_value = 1.4; nt.links.new(wn.outputs['Color'], ws.inputs[0])
    wa = nt.nodes.new('ShaderNodeVectorMath'); wa.operation = 'ADD'; nt.links.new(tc.outputs['Object'], wa.inputs[0]); nt.links.new(ws.outputs[0], wa.inputs[1]); nt.links.new(wa.outputs[0], vo.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs[1].default_value = 0; cr.inputs[2].default_value = .03; cr.inputs[3].default_value = .4; cr.inputs[4].default_value = 1; nt.links.new(vo.outputs['Distance'], cr.inputs[0])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1; nt.links.new(ramp.outputs[0], mx.inputs[6]); nt.links.new(cr.outputs[0], mx.inputs[7])
    col = B._vary(nt, mx.outputs[2], 1.0, .3)
    if flechte is not None:  # Flechten und Moos auf dem, was nach oben zeigt
        geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
        fn = nt.nodes.new('ShaderNodeTexNoise'); fn.inputs['Scale'].default_value = 3.2; fn.inputs['Detail'].default_value = 5; nt.links.new(tc.outputs['Object'], fn.inputs['Vector'])
        ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; nt.links.new(sep.outputs[2], ad.inputs[0]); nt.links.new(fn.outputs[0], ad.inputs[1])
        fr = nt.nodes.new('ShaderNodeMapRange'); fr.inputs[1].default_value = 1.12; fr.inputs[2].default_value = 1.4; fr.inputs[3].default_value = 0; fr.inputs[4].default_value = .5; nt.links.new(ad.outputs[0], fr.inputs[0])
        fm = nt.nodes.new('ShaderNodeMix'); fm.data_type = 'RGBA'; fm.inputs[7].default_value = B.lin(flechte); nt.links.new(fr.outputs[0], fm.inputs[0]); nt.links.new(col, fm.inputs[6]); col = fm.outputs[2]
    if erz is not None:  # Erzadern: schmale helle Bänder quer durch den Stein
        wv = nt.nodes.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = .5; wv.inputs['Distortion'].default_value = 11; wv.inputs['Detail Scale'].default_value = 1.6; wv.inputs['Detail'].default_value = 3; nt.links.new(tc.outputs['Object'], wv.inputs['Vector'])
        er = nt.nodes.new('ShaderNodeMapRange'); er.inputs[1].default_value = .94; er.inputs[2].default_value = .985; er.inputs[3].default_value = 0; er.inputs[4].default_value = 1; nt.links.new(wv.outputs[0], er.inputs[0])
        en = nt.nodes.new('ShaderNodeTexNoise'); en.inputs['Scale'].default_value = 1.1; nt.links.new(tc.outputs['Object'], en.inputs['Vector'])  # Adern nur stellenweise
        ek = nt.nodes.new('ShaderNodeMapRange'); ek.inputs[1].default_value = .45; ek.inputs[2].default_value = .6; nt.links.new(en.outputs[0], ek.inputs[0])
        eq = nt.nodes.new('ShaderNodeMath'); eq.operation = 'MULTIPLY'; nt.links.new(er.outputs[0], eq.inputs[0]); nt.links.new(ek.outputs[0], eq.inputs[1])
        em = nt.nodes.new('ShaderNodeMix'); em.data_type = 'RGBA'; em.inputs[7].default_value = B.lin(erz); nt.links.new(eq.outputs[0], em.inputs[0]); nt.links.new(col, em.inputs[6]); col = em.outputs[2]
    nt.links.new(col, b.inputs['Base Color'])
    # Relief: Schichtung plus Risse
    hm = nt.nodes.new('ShaderNodeMath'); hm.operation = 'MULTIPLY'; nt.links.new(n.outputs[0], hm.inputs[0]); nt.links.new(cr.outputs[0], hm.inputs[1])
    B._bump(nt, b, hm.outputs[0], .9, .05)
    return m
def brocken(name, mat, pos, r, seed, scale=(1, 1, 1), rot=(0, 0, 0), sub=3, cuts=7):
    R = random.Random(seed); bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1); off = Vector((seed * 3.1, seed * 1.7, seed * .9))
    for v in bm.verts: n = v.co.normalized(); v.co = n * (1 + .3 * noise.noise(n * 1.1 + off) + .06 * noise.noise(n * 3.7 + off))
    for i in range(cuts):  # Spaltflächen
        n = Vector((R.random() - .5, R.random() - .5, (R.random() - .35) * .9)).normalized(); d = .5 + R.random() * .32
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=n * d, plane_no=n, clear_outer=True)
        bmesh.ops.holes_fill(bm, edges=bm.edges[:], sides=0)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, -.3), plane_no=(0, 0, -1), clear_outer=True)  # unten offen: steckt im Boden
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = B._obj(name, bm, mat); o.scale = (r * scale[0], r * scale[1], r * scale[2]); o.rotation_euler = rot; o.location = (pos[0], pos[1], pos[2] + r * scale[2] * .22)
    return o

FELS = [  # je Form: Liste von (x, y, Radius, Streckung, Drehung)
    [(0, 0, 1.0, (1.1, .9, 1.0), (0, .1, .3)), (.75, .35, .5, (1, 1, .8), (0, 0, 1)), (-.6, -.55, .32, (1, 1, .7), (0, 0, 2))],                                   # gedrungener Block
    [(0, 0, .8, (.75, .7, 1.75), (.12, .1, .5)), (.55, -.3, .55, (.8, .7, 1.2), (-.2, .15, 2)), (-.5, .4, .3, (1, 1, .7), (0, 0, 3))],                              # aufragender Zahn
    [(0, 0, 1.05, (1.35, .85, .55), (0, .12, .2)), (.2, .25, .7, (1.2, .8, .5), (.1, -.25, .9)), (-.9, -.3, .3, (1, 1, .8), (0, 0, 4)), (.95, -.5, .24, (1, 1, .8), (0, 0, 5))],  # flache Platten
    [(-.35, 0, .78, (.9, .9, 1.15), (0, .2, 0)), (.5, .1, .7, (.85, .9, .95), (.15, -.2, 1.4)), (.05, -.6, .4, (1, 1, .8), (0, 0, 2.2)), (.1, .7, .28, (1, 1, .7), (0, 0, 3.3))]  # Gruppe
]

# ================= Ausgabe =================
def will(name): return not ONLY or ONLY in name

BAEUME = [
    ('baum_fichte1', lambda n: fichte(n, 11)),
    ('baum_fichte2', lambda n: fichte(n, 23, h=7.6, r=2.0, etagen=8, kahl=.8, hi=0x436c46)),
    ('baum_fichte3', lambda n: fichte(n, 37, h=9.8, r=1.45, etagen=9, kahl=2.6, lo=0x152c2a, hi=0x356050, schief=.0012)),
    ('baum_tot1', lambda n: tot(n, 5)),
    ('baum_tot2', lambda n: tot(n, 9, h=3.3)),
    ('baum_sumpf1', lambda n: laub(n, 3, 0x1b3220, 0x4c6e34, h=6.0, breit=2.4, sq=.7, haeng=.55, rinde=(0x1f1c17, 0x3e3a2c))),
    ('baum_sumpf2', lambda n: laub(n, 8, 0x1e3524, 0x587a3a, h=5.0, breit=2.0, sq=.75, haeng=.7, rinde=(0x1f1c17, 0x3e3a2c))),
    ('baum_kueste1', lambda n: laub(n, 4, 0x24402f, 0x5f8a5a, h=6.4, breit=2.3, sq=.66)),
    ('baum_kueste2', lambda n: fichte(n, 41, h=7.2, r=1.6, etagen=6, kahl=2.4, lo=0x1c3229, hi=0x4a7460, licht=0x7c9a80, schief=.004)),
    ('baum_trocken1', lambda n: laub(n, 6, 0x33381c, 0x6a6c36, h=5.6, breit=2.5, sq=.5, schirm=True, rinde=(0x3a2c1e, 0x6e5a40))),
    ('baum_trocken2', lambda n: laub(n, 12, 0x393a1c, 0x747038, h=4.6, breit=2.0, sq=.5, schirm=True, rinde=(0x3a2c1e, 0x6e5a40))),
]
for name, fn in BAEUME:
    if not will(name): continue
    B.reset(); ausgabe(fn(name), name)

for i, form in enumerate(FELS):
    name = 'fels' + str(i + 1)
    if not will(name): continue
    B.reset(); mat = felsmat('fels', 0x44464b, 0x7d7f84)
    for j, (x, y, r, sc, rot) in enumerate(form): brocken('brocken', mat, (x, y, 0), r, i * 10 + j + 1, sc, rot, sub=3 if r > .45 else 2, cuts=11 if r > .45 else 6)
    B.finish(os.path.join(OUT, name + '.glb'), name, size=512, ao_samples=24, preview=os.path.join(PREV, name + '.png') if PREV else None); made.append(name)

if will('kiesel'):  # kleiner Brocken für den Bodenbewuchs: wenige Dreiecke, weil er zu Tausenden herumliegt
    B.reset(); mat = felsmat('fels', 0x4a4c50, 0x85878b)
    brocken('brocken', mat, (0, 0, 0), .5, 91, (1.1, .9, .8), (0, .1, .4), sub=2, cuts=7); brocken('brocken', mat, (.42, .2, 0), .2, 92, (1, 1, .8), (0, 0, 1), sub=1, cuts=3)
    B.finish(os.path.join(OUT, 'kiesel.glb'), 'kiesel', size=256, ao_samples=24, preview=os.path.join(PREV, 'kiesel.png') if PREV else None); made.append('kiesel')

if will('erzader'):
    B.reset(); mat = felsmat('erzfels', 0x34343a, 0x66676c, flechte=None, erz=0xb88a2c); gold = B.glow('erz', 0xd8a436, 2.2); R = random.Random(11)
    for j, (x, y, r, sc, rot) in enumerate([(0, 0, 1.2, (1, .95, 1.05), (0, .1, .2)), (1.0, -.5, .8, (.9, .9, 1), (.1, 0, 1.3)), (-1.0, -.45, .75, (.9, 1, .9), (0, .15, 2.1)), (.35, 1.0, .8, (1, .9, 1.2), (-.1, 0, 3)), (-.65, .8, .55, (1, 1, .9), (0, 0, 4)), (1.35, .5, .42, (1, 1, .8), (0, 0, 5))]):
        brocken('brocken', mat, (x, y, 0), r, 50 + j, sc, rot, sub=3 if r > .5 else 2, cuts=11 if r > .5 else 6)
    for i in range(16):  # Kristalle: sechseckige Säulen mit Spitze, büschelweise aus den Fugen
        a = R.random() * 6.28; d = .35 + R.random() * 1.15; h = .3 + R.random() * .85; w = .06 + R.random() * .08
        M = Matrix.Translation((math.cos(a) * d, math.sin(a) * d, .3 + R.random() * .65)) @ Matrix.Rotation((R.random() - .5) * 1.1, 4, 'X') @ Matrix.Rotation((R.random() - .5) * 1.1, 4, 'Y')
        o = B.cyl('kristall', w * 1.15, h, (0, 0, 0), gold, seg=6, r2=w, smooth=False); o.matrix_world = M @ Matrix.Translation((0, 0, h / 2))
        o = B.cyl('spitze', w, w * 2.4, (0, 0, 0), gold, seg=6, r2=0, smooth=False); o.matrix_world = M @ Matrix.Translation((0, 0, h + w * 1.2))
    B.finish(os.path.join(OUT, 'erzader.glb'), 'erzader', size=512, ao_samples=24, preview=os.path.join(PREV, 'erzader.png') if PREV else None); made.append('erzader')
print('FERTIG', len(made), ' '.join(made))
