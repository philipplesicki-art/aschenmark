# Alle Fußtruppen der drei Fraktionen aus der Figuren-Bibliothek (lib_figur.py).
# Aufruf: blender --background --python tools/blender/figuren.py -- [Vorschauordner oder -] [nur: Teil des Namens]
# Reiter und Belagerungsgerät brauchen ein eigenes Skelett und kommen weiter aus dem Code des Spiels.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import importlib, lib_figur as F
importlib.reload(F)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else ''
OUT = os.path.join(HERE, '..', '..', 'public', 'models')

# ---------------- Grenzwacht: Kegelhelm, Rundschild, Blau und Stahl, Fellkragen ----------------
def wacht_melee():
    F.helm_kegel(); F.kragen(); F.schultern(); F.rock(); F.brustplatte(); F.umhang(); F.schild_rund(); F.speer()
def wacht_ranged():
    F.kapuze('tunic_d'); F.rock(); F.koecher(); F.umhang('tunic_d'); F.bogen()
def wacht_worker():
    F.kapuze('cloth'); F.rock('cloth'); F.rucksack(); F.hacke()
def wacht_hero():
    F.helm_kegel(plume='trim'); F.kragen(); F.schultern('trim'); F.rock(); F.brustplatte('steel'); F.wappen(); F.umhang('tunic'); F.schild_rund('trim'); F.schwert(.95)
def wacht_elite():
    F.helm_topf(); F.schultern(); F.rock(); F.brustplatte('steel'); F.wappen(); F.umhang(); F.schild_turm(); F.speer(2.0)
def wacht_support():
    F.kapuze('cloth'); F.rock('cloth', lang=True); F.kragen(); F.stab(banner='tunic')

# ---------------- Aschenhorde: Hörnerhelm, Stacheln, Rot und Schwarzeisen, kein Schild ----------------
def asch_melee():
    F.helm_horn(); F.schultern('steel_d', spikes=True); F.rock(); F.schwert(.85, 'steel_d')
def asch_ranged():
    F.kapuze('tunic_d'); F.rock('tunic_d'); F.koecher(); F.bogen()
def asch_worker():
    F.rock('cloth'); F.rucksack(); F.hacke()
def asch_hero():
    F.helm_horn(big=True); F.kragen('fur'); F.schultern('steel', spikes=True); F.rock(); F.brustplatte(); F.umhang('tunic'); F.axt(doppel=True)
def asch_elite():
    F.helm_horn(big=True); F.schultern('steel_d', spikes=True); F.rock('tunic_d'); F.brustplatte(); F.axt()
def asch_support():
    F.kapuze('tunic_d'); F.rock('tunic_d', lang=True); F.kragen('fur'); F.stab(orb='trim')

# ---------------- Salzbund: Eisenhut mit Krempe, Ölmantel, Türkis und Leinen ----------------
def salz_melee():
    F.helm_krempe(); F.kragen('cloth'); F.rock(); F.umhang('cloth'); F.schild_rund('cloth'); F.speer(2.5)
def salz_ranged():
    F.helm_krempe(); F.rock(); F.koecher(); F.umhang('tunic_d'); F.bogen()
def salz_worker():
    F.kapuze('cloth'); F.rock('cloth'); F.rucksack('wood'); F.hacke()
def salz_hero():
    F.helm_krempe(plume='trim'); F.kragen('fur'); F.schultern('trim'); F.rock(); F.brustplatte('steel'); F.wappen(); F.umhang('cloth'); F.schwert(1.0)
def salz_elite():
    F.helm_krempe(plume='tunic'); F.schultern(); F.rock(); F.brustplatte('steel'); F.umhang('tunic_d'); F.schild_turm('cloth'); F.speer(2.3)
def salz_support():
    F.kapuze('cloth'); F.rock('cloth', lang=True); F.kragen('fur'); F.stab(orb='steel')

BULK = {'hero': 1.12, 'elite': 1.1, 'worker': .95, 'support': .95}
made = []
for fac in ('wacht', 'asch', 'salz'):
    for role in ('melee', 'ranged', 'worker', 'hero', 'elite', 'support'):
        name = fac + '_' + role
        if ONLY and ONLY not in name: continue
        F.begin(name, fac, BULK.get(role, 1.0))
        globals()[name]()
        F.finish(os.path.join(OUT, name + '.glb'), os.path.join(PREV, name + '.png') if PREV else None)
        made.append(name)
print('FERTIG', len(made), ' '.join(made))
