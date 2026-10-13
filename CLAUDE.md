# Aschenmark – Hinweise für Claude Code

Echtzeit-Strategiespiel (Steam/Desktop), Vanilla JS als ES-Module, Vite, Three.js 0.160, Electron.
Alle Grafik, Musik und Effekte entstehen im Code – keine zugekauften oder fremden Assets.

## Befehle
- `npm install` – Abhängigkeiten
- `npm run dev` – Entwicklungsserver (Browser), `?debug` im Link öffnet `window.__A` (Zustand, `draw()`, `stats()` für Zeichenaufrufe, `setQuality()`), `?q=low|medium|high` setzt die Grafikstufe
- `npm test` – Simulationstests (headless, ohne DOM) und UI-Rauchtest; vor jeder Übergabe ausführen
- `npm run build` – Web-Build nach `dist/`
- `npm run artifact` – Einzeldatei `dist-single/aschenmark.html` (zum Teilen, läuft per Doppelklick)
- `npm run desktop` / `npm run dist` – Electron starten / Installer bauen (siehe `docs/BUILD_STEAM.md`)

## Aufbau
- `src/state.js` – globaler Zustand `G` (Live-Binding), `hooks`, seedbarer Zufall `simR()` (nutzt `G.rs`)
- Simulation ohne DOM: `world.js`, `sim.js`, `units.js`, `path.js` (A*), `combat.js`, `ai.js`, `events.js`, `quests.js`, `regions.js`, `save.js`
- Darstellung: `render3d.js` (Three.js, Kamera 52°, Licht, Wetter, Nebel), `models3d.js` (alle Modelle und Texturen prozedural), `post.js` (Bloom, Farbkorrektur), `render.js` (2D-Rückfall)
- UI: `ui.js` (Hauptmenü, Gefechtsaufbau, Einstellungen, Chronik, Pause, Enden), `input.js`, `camera.js`, `commands.js`, `index.html`, `src/style.css`
- Hauptmenü: dahinter läuft eine echte Partie mit `G.demo = true` (kein Nebel, keine Meldungen, kein Spielende, keine Angriffswellen), Aufbau in `main.js` (`menuScene`)
- Fraktionen: `wacht` (Grenzwacht), `asch` (Aschenhorde), `salz` (Salzbund); Gegner frei wählbar, `FAC_IDS`/`otherFac` in `factions.js`
- Teams: 0 Spieler, 1 KI, 2 neutrale Erzadern, 3 wilde Lager (`fac 'wild'`, über `facOf`/`defOf`)
- Karte 120×84 Felder, TS=32 px; Kern 80×56; Regionen grenz/wald/asch offen, trocken/sumpf/kueste hinter Pässen
- Kampagne (Weltkarte, rundenbasiert) in `src/campaign/`: `cdata.js` (Gelände, Bauten, Rollen), `cmap.js` (Voronoi-Karte aus Saat), `cstate.js` (Zustand `C` und Regeln), `cai.js` (KI-Reiche), `csave.js`, `cui.js` (Canvas-Karte, Dialoge). Tests: `tests/campaign.test.mjs`
- Handlungsbogen `cstory.js` (`C.story`, Kapitel je Fraktion, Schlund und Erwachte unter Besitzer 'wild'), Stätten `SITES` (cdata, `p.site`, `hasSite`). Erscheinungsbild in `src/theme.css` (Schriften Cinzel/Alegreya über @fontsource, lokal)
- KI-Änderungen nur mit Turnier prüfen: eine Fraktion mit Änderung gegen zwei ohne, gleiche Saaten, mindestens 90 Partien (kleinere Stichproben täuschen)
- Kampagnen-Tiefe: `ctech.js` (Forschungsbaum, Wirkungen über `cfx(f, key)`), `cdip.js` (Diplomatie, Zustand `C.dip` mit `dipOf`/`hostile`/`passable` in cstate), `cevents.js` (Ereignisse, `C.events`), Heldenzüge `HERO_TRAITS` (cdata) mit `hasTrait`. Entscheidungen des Spielers warten in `C.heroPick`, `C.events`, `C.offers`, `C.pending` und werden in cui.js nacheinander abgefragt (`afterBattle`)
- Echtzeit-Schlachten aus der Kampagne: `battle.js` (`newBattle(spec)` baut ein Gefecht ohne Basis: Heere in Reihen, Türme je Mauerstufe, Bürgerwehr, Jahreszeit; `battleTick` führt den Gegner, `finishBattle` liefert Überlebende). Mit offener Weltkarte (`cHooks.ask`) warten Schlachten mit Spielerbeteiligung in `C.pending`; `battleSpec`/`battleOutcome`/`resolvePending` in `cstate.js`. In der Schlacht gilt `G.battle` (keine Burgen, keine Vorräte, Pause bietet Rückzug)

## Regeln
- Simulation deterministisch halten: in der Sim nur `simR()`, nie `Math.random()`; neue Zustandsfelder müssen in `save.js` mitgespeichert werden
- Simulation darf kein DOM/Three.js importieren (Tests laufen in Node)
- Modelle werden nach dem Bau verschmolzen (`bake` in `models3d.js`): Teile an derselben Gruppe je Material zu einem Netz, einfarbige Materialien über Eckenfarben. Was die Darstellung einzeln bewegt, muss in `userData.j` (Gelenke), `flags`, `pools`, `gears`, `lamp` oder als Umhang (`isCape`) stehen, sonst wird es mit verschmolzen. Der UI-Test prüft eine Obergrenze an Zeichenaufrufen je Modell
- Figuren: `human()` in `models3d.js` mit realistischen Maßen (`BODY`: Hüfte 0.95, Schultern 0.76/±0.31, Kopf auf ~1/7 skaliert). Rumpf und Röcke als `lathe`-Profile, Gliedmaßen als Kapseln. Anbauteile (Schilde, Köcher, Säcke) relativ zu diesen Maßen setzen
- Oberflächen: Normal-Maps werden aus den gezeichneten Texturen erzeugt (`normalOf`, Tiefe in `NSTR`). Einfarbige Teile bekommen über das gemeinsame Eckenfarben-Material Gewebe- bzw. Metallstruktur, Tiere eigene Fell-/Hauttexturen (`surf(..., 'fur')`). Leuchtende Fenster (`L.warm`) erhalten beim Bau automatisch Rahmen (`frameWindows`). Der Wetter-Shader legt Schnee, Ruß und senkrechte Schmutzspuren
- Licht: Umgebungskarte aus einem gemalten Nachthimmel (`skyEnvironment`), Umgebungsverdeckung (GTAO, nur Stufe Hoch, `post.js`), Schattenausschnitt folgt der Kamera
- Dächer: Grundmaterial über `rs()` bzw. `hallRoof`/`hullRoof`, dann bekommt jedes Gebäude aus seiner Kennung eine feste Variante (Farbe, Schnee, Gauben, Schornstein, Flicken)
- Texte im Spiel auf Deutsch
- Stil: düster und kalt (Frostpunk-Stimmung), Bauten und Figuren mittelalterlich-episch (Mittelerde/Game-of-Thrones-Anmutung), aber eigene Entwürfe ohne geschützte Namen, Figuren oder Designs

## Nächster Schritt: Blender-Pilot (vom User beschlossen am 13.10.2026)
Ziel: realistischere Figuren und Gebäude als Blender-Modelle (.glb), per Python-Skript erzeugt, nicht von Hand.
- Blender portabel nach `tools\blender` (ZIP von blender.org, keine Installation), Steuerung über `blender --background --python skript.py`
- Pilot: ein Speerträger der Grenzwacht (durchgehendes, geglättetes Netz über Skelett/Skin-Modifier, Skelett mit Lauf- und Angriffsanimation) und eine Kaserne (Fasen, Bruchkanten, Details per Normal-Map vom hochaufgelösten auf das Spielmodell gebacken)
- Skripte unter `tools/blender/` im Projekt ablegen, Ausgabe nach `public/models/*.glb`
- Einbindung: `models3d.js` lädt ein vorhandenes .glb (GLTFLoader) und fällt sonst auf die Code-Modelle zurück; Animationen über AnimationMixer statt der Gelenk-Animation in `render3d.js`
- Stil und Projektregeln bleiben: eigene Entwürfe, keine fremden Assets, Zeichenaufrufe im Blick (Test in `tests/ui.test.mjs`)
- Danach Vergleichsbilder alt/neu und die Leistung auf der Heim-Grafikkarte messen, erst dann entscheiden, ob alle Modelle umgestellt werden

## Offene Punkte
- Leistung auf der Zielhardware messen: Einstellungen, Bildrate anzeigen. Gemessen auf Intel-Grafik (integriert): Niedrig ~14 ms, Hoch ~27 ms pro Bild bei 70 Einheiten
- Steam: eigene App-ID, Erfolge im Partnerbereich anlegen (Liste in docs/BUILD_STEAM.md), Store-Seite
- Schriften für Offline-Betrieb lokal einbinden (derzeit Google Fonts, mit Ersatzschriften)
- Handlungsfaden Teil 2 (die Enden deuten ihn an)
