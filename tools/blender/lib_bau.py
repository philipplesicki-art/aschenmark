# Gemeinsame Bausteine für Gebäude aus Blender: Kästen, Dächer, prozedurale Baustoffe mit Schnee,
# Einbacken von Farbe, Schatten in Ecken (AO) und Relief in EINE Textur, Ausgabe als .glb.
# Maße wie im Spiel: 1 Meter = 1 Spieleinheit; Vorderseite zeigt nach -Y (im Spiel zur Kamera), Ursprung in der Mitte der Grundfläche.
import bpy, bmesh, os, math
import numpy as np
from mathutils import Vector, Matrix

SNOW = (.80, .85, .92, 1)
PARTS = []

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    PARTS.clear()
    return bpy.context.scene

def lin(h):
    c = ((h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255)
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1,)

# ---------- Baustoffe ----------
def _base(name, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = rough
    tc = nt.nodes.new('ShaderNodeTexCoord')
    return m, nt, b, tc

def _snow(nt, color_out, amount):
    # Schnee auf allem, was nach oben zeigt, von weichem Rauschen aufgebrochen
    if amount <= 0: return color_out
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = 1.5; noise.inputs['Detail'].default_value = 4
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'MULTIPLY_ADD'; add.inputs[1].default_value = 1.0; add.inputs[2].default_value = -.5
    nt.links.new(noise.outputs[0], add.inputs[0])
    s = nt.nodes.new('ShaderNodeMath'); s.operation = 'ADD'; nt.links.new(sep.outputs[2], s.inputs[0]); nt.links.new(add.outputs[0], s.inputs[1])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = .62; mr.inputs[2].default_value = .82; mr.inputs[3].default_value = 0; mr.inputs[4].default_value = amount
    nt.links.new(s.outputs[0], mr.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs[7].default_value = SNOW
    nt.links.new(mr.outputs[0], mix.inputs[0]); nt.links.new(color_out, mix.inputs[6])
    return mix.outputs[2]

def _vary(nt, color_out, scale=1.3, strength=.35):
    # großflächige Flecken (Feuchte, Ruß), damit Flächen nicht gleichmäßig wirken
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 4
    r = nt.nodes.new('ShaderNodeMapRange'); r.inputs[1].default_value = .3; r.inputs[2].default_value = .7; r.inputs[3].default_value = 1 - strength; r.inputs[4].default_value = 1 + strength * .4
    nt.links.new(n.outputs[0], r.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs[0].default_value = 1
    nt.links.new(color_out, mix.inputs[6]); nt.links.new(r.outputs[0], mix.inputs[7])
    return mix.outputs[2]

def _bump(nt, b, height_out, strength, dist=.02):
    bp = nt.nodes.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = strength; bp.inputs['Distance'].default_value = dist
    nt.links.new(height_out, bp.inputs['Height']); nt.links.new(bp.outputs[0], b.inputs['Normal'])

def brick(name, c1, c2, mortar, scale=4.5, snow=.9, rough=.92, squash=1.0, offset=.5, row_h=.25, brick_w=.5, mortar_size=.018, wall=True):
    m, nt, b, tc = _base(name, rough)
    t = nt.nodes.new('ShaderNodeTexBrick'); t.inputs['Color1'].default_value = lin(c1); t.inputs['Color2'].default_value = lin(c2); t.inputs['Mortar'].default_value = lin(mortar)
    t.inputs['Scale'].default_value = scale; t.inputs['Mortar Size'].default_value = mortar_size; t.inputs['Brick Width'].default_value = brick_w; t.inputs['Row Height'].default_value = row_h
    t.offset = offset; t.squash = squash; t.inputs['Bias'].default_value = -.1
    if wall:  # Mauern: Lagen waagrecht, also (x + y, z) statt (x, y)
        sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sp.inputs[0])
        ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; nt.links.new(sp.outputs[0], ad.inputs[0]); nt.links.new(sp.outputs[1], ad.inputs[1])
        cb = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(ad.outputs[0], cb.inputs[0]); nt.links.new(sp.outputs[2], cb.inputs[1])
        nt.links.new(cb.outputs[0], t.inputs['Vector'])
    else: nt.links.new(tc.outputs['Object'], t.inputs['Vector'])
    col = _snow(nt, _vary(nt, t.outputs['Color']), snow)
    nt.links.new(col, b.inputs['Base Color']); _bump(nt, b, t.outputs['Fac'], -.8)
    return m

def grain(name, c1, c2, stretch=(1, 1, 12), scale=6, snow=.9, rough=.85, bump=.4):
    # Holz und Putz: gestrecktes Rauschen zwischen zwei Farben
    m, nt, b, tc = _base(name, rough)
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = stretch; nt.links.new(tc.outputs['Object'], mp.inputs[0])
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = 6; n.inputs['Roughness'].default_value = .65
    nt.links.new(mp.outputs[0], n.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = .35; ramp.color_ramp.elements[0].color = lin(c1); ramp.color_ramp.elements[1].position = .68; ramp.color_ramp.elements[1].color = lin(c2)
    nt.links.new(n.outputs[0], ramp.inputs[0])
    col = _snow(nt, _vary(nt, ramp.outputs[0], 1.1, .28), snow)
    nt.links.new(col, b.inputs['Base Color']); _bump(nt, b, n.outputs[0], bump)
    return m

def plain(name, color, rough=.8, metallic=0, snow=0):
    m, nt, b, tc = _base(name, rough); b.inputs['Metallic'].default_value = metallic
    rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = lin(color)
    nt.links.new(_snow(nt, _vary(nt, rgb.outputs[0], 3, .2), snow), b.inputs['Base Color'])
    return m

def glow(name, color, strength=4):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = lin(color); b.inputs['Emission Color'].default_value = lin(color); b.inputs['Emission Strength'].default_value = strength
    m['glut'] = True
    return m

# ---------- Körper ----------
def _obj(name, bm, mat, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); me.materials.append(mat); PARTS.append(o)
    return o

def box(name, size, pos, mat, bevel=.025, rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1, matrix=Matrix.Diagonal((*size, 1)))
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(bevel, min(size) * .3), segments=1, affect='EDGES')
    o = _obj(name, bm, mat); o.location = pos; o.rotation_euler = rot
    return o

def cyl(name, r, h, pos, mat, seg=10, r2=None, rot=(0, 0, 0), smooth=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    o = _obj(name, bm, mat, smooth); o.location = pos; o.rotation_euler = rot
    return o

def gable_roof(name, length, width, height, pos, mat, thick=.12, over=.25):
    # Satteldach, First entlang X; Dachhaut mit Stärke, Überstand an Traufe und Giebel
    L = length / 2 + over; W = width / 2 + over; k = height / (width / 2); zo = -over * k
    v = [(-L, -W, zo), (L, -W, zo), (L, 0, height), (-L, 0, height), (-L, W, zo), (L, W, zo)]
    t = thick
    v += [(x, y, z - t) for x, y, z in v]
    f = [(0, 1, 2, 3), (3, 2, 5, 4), (7, 6, 9, 8)[::-1], (8, 9, 11, 10)[::-1], (0, 3, 9, 6)[::-1], (3, 4, 10, 9)[::-1], (1, 7, 8, 2)[::-1], (2, 8, 11, 5)[::-1], (0, 6, 7, 1), (4, 5, 11, 10)]
    bm = bmesh.new(); vs = [bm.verts.new(c) for c in v]
    for q in f:
        try: bm.faces.new([vs[i] for i in q])
        except ValueError: pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _obj(name, bm, mat); o.location = pos
    return o

def gable_wall(name, width, height, pos, mat, thick=.12):
    # Giebeldreieck (in der YZ-Ebene), Spitze oben
    W = width / 2
    v = [(-thick / 2, -W, 0), (-thick / 2, W, 0), (-thick / 2, 0, height), (thick / 2, -W, 0), (thick / 2, W, 0), (thick / 2, 0, height)]
    f = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    bm = bmesh.new(); vs = [bm.verts.new(c) for c in v]
    for q in f: bm.faces.new([vs[i] for i in q])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o = _obj(name, bm, mat); o.location = pos
    return o

def mound(name, r, pos, mat, flat=.35, seg=8):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=5, radius=r, matrix=Matrix.Diagonal((1, 1, flat, 1)))
    o = _obj(name, bm, mat, True); o.location = pos
    return o

def empty(name, pos, scale=1):
    e = bpy.data.objects.new(name, None); e.location = pos; e.scale = (scale,) * 3; bpy.context.scene.collection.objects.link(e)
    return e

# ---------- Backen und Ausgabe ----------
def finish(out, name, loose=(), size=1024, ao_samples=48, preview=None):
    scene = bpy.context.scene
    keep = [o for o in PARTS if o not in loose]
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in keep: o.select_set(True)
    bpy.context.view_layer.objects.active = keep[0]; bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Abwicklung
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Backen mit Cycles (Rechner, ohne Fenster)
    scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = ao_samples; scene.render.bake.margin = 6
    def target(nm, colorspace='sRGB'):
        img = bpy.data.images.new(nm, size, size, alpha=False); img.colorspace_settings.name = colorspace
        for m in ob.data.materials:
            nt = m.node_tree; n = nt.nodes.get('BAKE') or nt.nodes.new('ShaderNodeTexImage'); n.name = 'BAKE'; n.image = img; nt.nodes.active = n
        return img
    col = target('farbe'); bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    ao = target('schatten', 'Non-Color'); bpy.ops.object.bake(type='AO')
    nrm = target('relief', 'Non-Color'); bpy.ops.object.bake(type='NORMAL')
    # Farbe mal Schatten: Fugen, Ecken und alles unter dem Dachüberstand werden dunkel
    a = np.array(col.pixels[:], dtype=np.float32).reshape(-1, 4); s = np.array(ao.pixels[:], dtype=np.float32).reshape(-1, 4)
    k = np.clip(.28 + .82 * s[:, :3], 0, 1.08); a[:, :3] *= k; col.pixels.foreach_set(a.ravel()); col.update()
    tmp = os.path.join(bpy.app.tempdir, name + '_')
    for img, suf in ((col, 'farbe.png'), (nrm, 'relief.png')):
        img.filepath_raw = tmp + suf; img.file_format = 'PNG'; img.save()
    # Ein Material mit der gebackenen Textur; leuchtende Flächen behalten ihres
    baked = bpy.data.materials.new(name + '_gebacken'); baked.use_nodes = True; nt = baked.node_tree; b = nt.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .9
    ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = col; nt.links.new(ti.outputs[0], b.inputs['Base Color'])
    tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = nrm; nm = nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(tn.outputs[0], nm.inputs['Color']); nt.links.new(nm.outputs[0], b.inputs['Normal'])
    mats = ob.data.materials; glows = [i for i, m in enumerate(mats) if m.get('glut')]
    gl = mats[glows[0]] if glows else None
    for p in ob.data.polygons: p.material_index = 1 if p.material_index in glows else 0
    mats.clear(); mats.append(baked)
    if gl: mats.append(gl)
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if preview: _preview(preview)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(out), export_format='GLB', export_yup=True, export_image_format='JPEG', export_jpeg_quality=88, export_apply=True)
    print('GLB:', os.path.abspath(out), os.path.getsize(os.path.abspath(out)), 'Bytes,', tris, 'Dreiecke')
    return ob

def _preview(path):
    scene = bpy.context.scene
    cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 60; cam = bpy.data.objects.new('cam', cam_d); scene.collection.objects.link(cam); scene.camera = cam
    sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 3.5; sun = bpy.data.objects.new('sun', sun_d); sun.rotation_euler = (.85, .1, .7); scene.collection.objects.link(sun)
    w = bpy.data.worlds.new('w'); w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.3, .36, .45, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 1.0; scene.world = w
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=14); gm = bpy.data.meshes.new('boden'); bm.to_mesh(gm); bm.free()
    g = bpy.data.objects.new('boden', gm); scene.collection.objects.link(g); gmat = bpy.data.materials.new('boden'); gmat.use_nodes = True; gmat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.62, .68, .76, 1); gm.materials.append(gmat)
    scene.render.resolution_x = 1100; scene.render.resolution_y = 800
    for eng in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
        try: scene.render.engine = eng; break
        except TypeError: pass
    for tag, pos in (('a', (5.5, -9.5, 8.5)), ('b', (-8.5, -6.5, 5.0))):
        cam.location = pos; d = Vector((0, 0, 1.6)) - cam.location; cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = path.replace('.png', '_' + tag + '.png'); bpy.ops.render.render(write_still=True)
    for o in (g, cam, sun): bpy.data.objects.remove(o)
