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
