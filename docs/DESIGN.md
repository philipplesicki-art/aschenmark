# Aschenmark – Spielentwurf und Fahrplan

Lebendes Dokument. Was gebaut ist, steht im Code und in `CLAUDE.md`; hier stehen die Absichten und die offenen Etappen.

## Leitidee

Ein kaltes, knappes Land. Wer wächst, muss sich entscheiden: Erz oder Holz, Heer oder Ausbau, früh angreifen oder Technik vorziehen.
Jede Fraktion spielt sich anders (nicht nur andere Zahlen), jede Entscheidung kostet etwas.

## Etappe 1: Wirtschaft und Technik (gebaut)

- **Zwei Rohstoffe:** Erz (Truppen, Technik) und **Holz** (Bauwerke, Belagerung, Technik). Holz wird gefällt: Bäume sind echte Vorräte
  (30–50 Holz je Baum), verschwinden beim Fällen und öffnen so neue Wege. Wald an Rändern von Kartengebieten und Pässen bleibt stehen.
- **Holzlager** (Holzlager / Köhlerei / Treibholzhof): billige Abgabestelle am Wald. Ohne sie sind die Wege zur Festung zu weit.
- **Burgstufen 1 bis 3:** Ausbau der Hauptburg kostet Erz und Holz und braucht Zeit. Stufe 2 schaltet Reiter, Werkstatt (Belagerung), Markt
  und die zweite Technikstufe frei; Stufe 3 die dritte Technikstufe und schnellere Machtpunkte. Mehr Leben und Versorgung je Stufe.
- **Forschung:** Wirtschaft (Tragkraft, Abbau, Holzfällen), Militär (Waffen, Rüstung, Belagerung), Bauten (Befestigung), Held (Erfahrung),
  Handel und je Fraktion eine eigene Technik (Schildwall-Drill, Brutstätten, Gezeitenkunde).
- **Markt** (Handelshaus / Plünderbasar / Hafenmarkt): Erz und Holz tauschen, Kurs verbessert sich durch Handelstechnik.
- **KI:** fällt Holz, baut Holzlager, baut die Burg aus, forscht, tauscht. Schwierigkeit steuert Zeitpunkte und Umfang.

## Etappe 2: Vorräte und Winter (gebaut)

Vorräte als dritter Rohstoff (Burg und Höfe ernten, Truppen essen), Jahr aus Tauzeit, Frühfrost, Hartfrost, Tauwetter.
Im Hartfrost kaum Ernte und doppelter Verbrauch; leeres Lager heißt Hunger. Erntetechnik, Vorratslager, Handel mit Vorräten.

## Etappe 3: Mehr Truppen (gebaut)

Unterstützer ab Stufe 2 (heilen, stärken, bremsen), Elite ab Stufe 3 (Fernkampfschutz, Kampfrausch, Dornenpanzer).

## Kampagne „Orsa“: Weltkarte plus Schlachten (in Arbeit, vom User gewählt)

Lange Partien wie Civilization: ein Reich über viele Stunden aufbauen. Rundenbasiert auf der Weltkarte, Schlachten wahlweise
als Echtzeit-Gefecht (die bestehende Partie) oder automatisch berechnet.

- **Karte:** rund 30 Provinzen in Orsa, erzeugt aus einem Startwert. Norden kalt (Grenzmark, Waldmeer, Aschenfelder), Osten
  trocken, Süden Sumpf und Küste. Jede Provinz hat Gelände, Siedlungsstufe, Gebäude, Ertrag und Besitzer.
- **Runde = Jahreszeit:** vier Runden je Jahr. Im Hartfrost wenig Ernte, mehr Verbrauch, langsamere Heere (wie im Gefecht).
- **Reich:** Erz, Holz, Vorräte als Schatzkammer. Provinzen erzeugen, Heere und Gebäude kosten.
- **Gebäude je Provinz:** Hof, Mine, Sägewerk, Kaserne (Rekrutierung), Mauer (Verteidigung), Markt; Stufen 1 bis 3.
- **Heere:** Truppen nach Art (dieselben Rollen wie im Gefecht) mit Held als Heerführer, ziehen von Provinz zu Provinz.
- **Schlachten:** berechnet aus Stärke, Gelände, Mauern, Technik und Held, oder im Echtzeit-Gefecht mit genau diesen Truppen.
- **Forschung:** reichsweit über Runden; die Stufen gelten in jeder Schlacht (Waffen, Rüstung usw. wie im Gefecht).
- **KI-Reiche:** bauen, rekrutieren, greifen die schwächste Nachbarprovinz an, verteidigen ihre Hauptstadt.
- **Sieg:** alle Hauptstädte erobern oder 75 Prozent der Provinzen halten.
- **Bremsen gegen Schneeballreiche (Kampagnen sollen Stunden dauern):** Unruhe nach jeder Eroberung (3 Runden plus Siedlungsstufe,
  Ertrag auf ein Viertel, Bürgerwehr halb; ein eigenes Heer von mindestens 3 Trupps beruhigt doppelt so schnell, ohne Heer droht
  mit 15 Prozent je Runde ein Aufstand: die Provinz wird wieder neutral). Verwaltung: ab 6 Provinzen kostet jede weitere 3,5 Prozent
  Ertrag des ganzen Reiches. Hauptstädte haben eine Burg (Verteidigung mal 1,25) und doppelte Bürgerwehr.
- **Fraktionszüge auf der Karte:** Der Salzbund handelt zu besseren Kursen (plus 15 Punkte) und wirbt mit weniger Erz und mehr Vorräten an.
- **Schwierigkeit:** Leicht, Normal, Schwer (Vorgabe), Unerbittlich (KI-Ertrag mal 1,5, greift schon bei Gleichstand an).
  Weltgröße 30, 48 (Vorgabe) oder 72 Provinzen. Gemessen ohne Spieler (KI gegen KI, Normal): Median 114, 164 bzw. 171 Runden,
  Siege über 30 Partien ausgeglichen (etwa 11/8/11).

Etappen: K1 Kartenspiel mit berechneten Schlachten (fertig), K2 Echtzeit-Schlachten aus der Kampagne (fertig), K3 Forschungsbaum, Helden mit
Werdegang, Diplomatie, Ereignisse (fertig), K4 Handlungsfäden der Kampagne (offen).

**K3 Tiefe:**
- **Forschungsbaum** (`ctech.js`): 26 Forschungen in vier Zeitaltern mit Voraussetzungen. Kosten je Zeitalter, Dauer aus
  Forschungspunkten (5/8/12/18) geteilt durch die Forschungsrate (1 plus 0,25 je Gelehrtenhaus-Stufe, höchstens plus 1,5; Akademien
  plus 0,25). Wirkungen: Gebäudeerträge, Verwaltung, Heerstraßen (halbe Züge im eigenen Land), Mauern, Durchbruch, Garnisonen,
  Tross, Exerzierplätze, Heerbann, Heldenepos. Waffen, Rüstung usw. gelten als Gefechtsstufen auch in Echtzeit-Schlachten.
- **Belagerung:** Hauptstädte und Provinzen mit wirksamen Mauern müssen eine Runde eingeschlossen werden, bevor gestürmt wird.
  Belagerungsgerät, Sturmböcke, der Zug Belagerer und mindestens zwei eigene Belagerungstrupps übergehen je eine Mauerstufe.
- **Werdegang des Helden:** bei jedem Aufstieg einer von drei Zügen (Feldherr, Belagerer, Marschall, Wächter, Landvogt, Kämpe,
  Zahlmeister). Heldenlieder beschleunigen, Heldenepos hebt die Höchststufe von 5 auf 8.
- **Diplomatie** (`cdip.js`): Frieden, Krieg, Waffenstillstand (6 Runden), Beistandsbündnis. Zu Beginn Frieden mit 8 Runden
  Waffenstillstand. Im Frieden ist das Land des anderen gesperrt. Die KI erklärt Krieg bei Überlegenheit (Schwelle je Schwierigkeit),
  meidet Gegner, die schon im Krieg stehen, und fürchtet die Führungsmacht. Kriegsmüdigkeit, Tribut und Zweifrontenkrieg machen
  Frieden möglich. Haltungen: Erinnerungen (Wortbruch, Geschenke, Kriegserklärungen) plus Lage; auf Schwer und Unerbittlich
  ist die KI dem Spieler gegenüber misstrauischer.
- **Ereignisse** (`cevents.js`): je Runde und Reich 14 Prozent; Ernte, Mehltau, Erzader, Seuche, Räuber, Gelehrter, Söldner,
  Mittwinterfest, Flüchtlinge, Zweikampf, Händlerzug, meist mit einer Entscheidung.
- Gemessen ohne Spieler (Normal, 48 Provinzen): Median etwa 94 Runden, je Partie etwa 4 Kriege und 2 Friedensschlüsse.

**K2 Echtzeit-Schlachten:** Jeder Angriff mit Beteiligung des Spielers (auch Überfälle der KI) fragt: Schlacht schlagen oder
automatisch berechnen. Die Schlacht nutzt genau die Truppen des Heeres samt Held (Stufe aus der Kampagne) und die Forschung
beider Reiche. Der Verteidiger einer Siedlung bekommt Bürgerwehr (2 je Siedlungsstufe, höchstens 8) und 2 Türme je Mauerstufe.
Die Jahreszeit der Runde gilt auch auf dem Schlachtfeld. Große Heere werden zusammengefasst (höchstens 48 Figuren je Seite,
jede Figur steht dann für mehrere Krieger). Wer am Ende steht, kehrt auf die Karte zurück; ein Rückzug kostet ein Fünftel der
Überlebenden. Fällt der Held, ist er drei Runden verwundet.

## Fahrplan

2. **Vorräte und Winter:** dritte Ressource Nahrung (Höfe erzeugen, Truppen essen), Jahreszeiten-Zyklus mit hartem Winter, Wärmefeuer,
   Hunger. Die Texte der Aufträge sprechen schon von Vorräten.
3. **Mehr Truppen:** je Fraktion zwei weitere Einheiten (Unterstützung/Heiler, Elite), Fähigkeiten auf Einheiten, Gegenstände für Helden
   aus wilden Lagern, neutrale Händler mit Söldnern.
4. **Karte und Ereignisse:** Heiligtümer und Ruinen mit Belohnung, mehr Naturereignisse, Zufallskarten, Bündnis- und 2-gegen-2-Partien.
5. **Handlung:** Kampagne mit Missionen, Teil 2 der Handlungsfäden, Zwischentexte.
6. **Grafik:** Blender-Modelle (siehe `public/models/README.md`), danach Animationen und Effekte.

## Regeln für neue Inhalte

- Zahlen in `factions.js` und `tech.js`, Verhalten in `units.js`/`combat.js`, nichts davon darf DOM oder Three.js kennen.
- Jede neue Mechanik: Test in `tests/sim.test.mjs`, KI-Unterstützung in `ai.js`, danach `npm run balance`.
- Siegquoten im KI-Turnier sollen zwischen 40 und 60 Prozent liegen.
