# Alle Fußtruppen der drei Fraktionen aus der Figuren-Bibliothek (lib_figur.py).
# Aufruf: blender --background --python tools/blender/figuren.py -- [Vorschauordner oder -] [nur: Teil des Namens]
# Reiter und Belagerungsgerät brauchen ein eigenes Skelett und kommen weiter aus dem Code des Spiels.
# Stil: düsteres Mittelalter. Rüstung aus vielen überlappenden Teilen, gedeckte Farben, die Fraktionsfarbe als Akzent,
# Schmutz, Kratzer und Schatten als gebackene Textur.
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import importlib, lib_figur as F
importlib.reload(F)

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREV = argv[0] if argv and argv[0] != '-' else None
ONLY = argv[1] if len(argv) > 1 else ''
OUT = os.path.join(HERE, '..', '..', 'public', 'models')

def schwer(helm, wappen=True):  # volle Plattenrüstung
    helm(); F.halsberge(); F.kettenrock(); F.rock(); F.kuerass(); F.schulterplatten(); F.beintaschen(); F.armschienen(); F.beinschienen(); F.taschen()
    if wappen: F.wappenrock()
def mittel(helm):  # Wams, Kettenrock, einzelne Platten
    helm(); F.kettenrock(); F.rock(); F.steppwams(); F.gurte(); F.schulterplatten('steel_d', 'steel'); F.armschienen(); F.beinschienen('steel_d'); F.taschen()
def leicht(kopf):  # Wams und Leder
    kopf(); F.rock(); F.steppwams(); F.gurte(); F.armschienen(leder=True); F.stiefelstulpen(); F.taschen()

# ---------------- Grenzwacht: Kegelhelm und Schaller, Rundschild, tiefes Blau auf Stahl ----------------
def wacht_melee(): mittel(F.helm_kegel); F.kragen(); F.umhang(); F.schild_rund(); F.speer()
def wacht_ranged(): leicht(lambda: F.kapuze('tunic_d')); F.koecher(); F.umhang('tunic_d'); F.bogen()
def wacht_worker(): F.kapuze('cloth'); F.rock('cloth'); F.gurte(); F.stiefelstulpen(); F.taschen(); F.rucksack(); F.hacke()
def wacht_hero(): schwer(lambda: F.helm_schaller('tunic')); F.kragen(); F.umhang('tunic'); F.schild_rund('tunic'); F.schwert(.95)
def wacht_elite(): schwer(F.helm_topf); F.umhang(); F.schild_turm(); F.speer(2.0)
def wacht_support(): F.kapuze('cloth'); F.rock('cloth', lang=True); F.kragen(); F.gurte(); F.taschen(); F.stab(banner='tunic')

# ---------------- Aschenhorde: Hörnerhelm, Stacheln, Blutrot auf Schwarzeisen, kein Schild ----------------
def asch_melee(): mittel(F.helm_horn); F.schultern('steel_d', spikes=True); F.schwert(.85, 'steel_d')
def asch_ranged(): leicht(lambda: F.kapuze('tunic_d')); F.koecher(); F.bogen()
def asch_worker(): F.rock('cloth'); F.gurte(); F.stiefelstulpen(); F.rucksack(); F.hacke()
def asch_hero(): schwer(lambda: F.helm_horn(big=True)); F.kragen('fur'); F.schultern('steel', spikes=True); F.umhang('tunic'); F.axt(doppel=True)
def asch_elite(): schwer(lambda: F.helm_horn(big=True), wappen=False); F.schultern('steel_d', spikes=True); F.axt()
def asch_support(): F.kapuze('tunic_d'); F.rock('tunic_d', lang=True); F.kragen('fur'); F.gurte(); F.taschen(); F.stab(orb='trim')

# ---------------- Salzbund: Eisenhut mit Krempe, Ölmantel, Grünspan und Leinen ----------------
def salz_melee(): mittel(F.helm_krempe); F.kragen('cloth'); F.umhang('cloth'); F.schild_rund('cloth'); F.speer(2.5)
def salz_ranged(): leicht(F.helm_krempe); F.koecher(); F.umhang('tunic_d'); F.bogen()
def salz_worker(): F.kapuze('cloth'); F.rock('cloth'); F.gurte(); F.stiefelstulpen(); F.taschen(); F.rucksack('wood'); F.hacke()
def salz_hero(): schwer(lambda: F.helm_krempe(plume='trim')); F.kragen('fur'); F.umhang('cloth'); F.schwert(1.0)
def salz_elite(): schwer(lambda: F.helm_krempe(plume='tunic')); F.umhang('tunic_d'); F.schild_turm('cloth'); F.speer(2.3)
def salz_support(): F.kapuze('cloth'); F.rock('cloth', lang=True); F.kragen('fur'); F.gurte(); F.taschen(); F.stab(orb='steel')

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
