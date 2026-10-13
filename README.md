# Aschenmark

Echtzeit-Strategiespiel im Stil von Schlacht um Mittelerde, mit eigener Fantasy-Welt. Läuft im Browser und als Desktop-App (Electron), vorbereitet für Steam.

## Inhalt

- **Drei Fraktionen:** Grenzwacht (zäh, Wachtürme, Rammbock, Heldin Elda), Aschenhorde (billig und schnell, Aschetroll, Wolfsreiter, Brandherr Kharg) und Salzbund (teure Elite von der versunkenen Küste: Harpuniere, Hirschreiter, Gezeitenschleuder mit Bogenschuss, Seherin Maren mit Brandungsschlag und Gezeitensegen, Macht Sturmflut). Alle sind spielbar, den Gegner wählst du im Gefechtsaufbau oder lässt ihn auslosen.
- **Hauptmenü:** Fortsetzen, Neues Gefecht (Fraktion, Gegner, Schwierigkeit, Aufträge), Einstellungen, Chronik (Siege, Handlungsfäden, Erfolge), Steuerung, Mitwirkende, in der Desktop-Fassung Beenden. Dahinter läuft die eigene Festung als lebende Szene. Bedienbar mit Maus, Touch und Tastatur (Pfeiltasten, Enter, Escape).
- **Helden:** Erfahrung durch Kämpfe, Stufen 1 bis 5, zwei Fähigkeiten pro Held (die zweite ab Stufe 2).
- **Mächte:** globale Fähigkeiten (Heilquelle, Feuerregen, Sturmflut) mit Machtpunkten, die mit Zeit und besiegten Feinden wachsen.
- **Taktik:** Speere schlagen Reiter, Reiter schlagen Bogenschützen, Bogenschützen schlagen Speere. Belagerung zerstört Gebäude.
- **Darstellung:** 3D mit Three.js, geneigte Kamera, Schneedünen und Bergrand, Dunst, kaltes Mondlicht mit warmem Schein aus Schmieden und Feuerkörben, fallender Schnee, Schatten. Mittelalterliche Gebäude: die Grenzwacht als nordische Steinburg mit Bergfried, Zinnen, Ecktürmen, Fachwerkhallen und Schieferdächern; die Aschenhorde als schwarze Stufenfeste mit Zacken, Häuten, Knochen und glühendem Tor. Im Code gezeichnete Texturen (Mauerwerk, Bretter, Schindeln, Putz), Schnee auf allen Oberseiten, Ruß am Sockel, freigetauter Boden um Gebäude, acht warme Punktlichter für Feuer und Fenster, Holzrauch. Alle Modelle entstehen im Code (keine Fremddateien). Ohne WebGL fällt das Spiel auf die flache 2D-Ansicht zurück.
- **Figuren und Dächer:** Gesichter mit Brauen, Bart, Haar und Narben, Rüstungen (Brustplatte, Wappenrock, Kettenschurz, Armschienen, Beinschienen), vier Helmformen und Umhänge, die im Lauf wehen. Jedes Gebäude bekommt eine feste Dachvariante (Farbe, Schneelast, Schneewehe, Gauben, Schornstein, Dachfenster, Flicken, Moos), damit Siedlungen von oben nicht gleich aussehen.
- **Grafikstufen:** Niedrig, Mittel, Hoch (Pixeldichte, Schatten, Lichtquellen, Schnee, Nachbearbeitung), wählbar in den Einstellungen oder mit `?q=low` im Link. Bildratenanzeige in den Einstellungen. Modelle werden beim Bau zu wenigen Netzen verschmolzen (rund 1.000 statt 3.900 Zeichenaufrufe in einem vollen Gefecht).
- **Nachbearbeitung:** Bloom, Farbkorrektur (kalte Schatten, warme Lichter), Schärfen, Vignette und Korn (`src/post.js`). Mit `?fx=0` im Link oder per Schalter im Pausenmenü abschaltbar.
- **Technik:** A*-Wegfindung, Kriegsnebel, Minimap, Sammelpunkte, Angriffsmarsch, Kontrollgruppen, Touch-Steuerung, prozedurale Musik und Effekte.
- **Naturereignisse:** Schneesturm und Ascheregen mit Vorzeichen, Höhepunkt und Abklingen. Sie ändern Sicht, Tempo und Erzabbau, je nach Fraktion verschieden, und färben Nebel und Schneefall um (`src/events.js`).
- **Aufträge:** Handlungsfaden je Fraktion mit eigenem Ende (zwölf Aufträge je Seite: Aufbau, Ereignisse überstehen, Gebiete erreichen, Vorposten gründen, Erz fördern; Auftrag 5 und 10 öffnen Pässe). Ziele werden aus dem Spielzustand berechnet, daher speichern und laden sie sauber (`src/quests.js`). Auf der Startseite abschaltbar.
- **Regionen und Außenposten:** Karte 120×84 Felder mit sechs Gebieten (Grenzmark, Waldmeer, Aschenfelder offen; Trockenland, Sumpfland, Küste hinter Graten). Pässe öffnen sich per Auftrag (`src/regions.js`). Ereignisse wirken nur in ihren Gebieten (Schneesturm, Ascheregen, Staubsturm, Flut, Salznebel). Jedes Gebiet hat eigenen Boden und eigene Baumarten, Schneefall gibt es nur in den kalten Gebieten. Der Vorposten (Vorposten / Glutlager) steht nahe einer Erzader, nimmt Erz an und gibt Versorgung.
- **Anzeige und Ton:** Gebiet und aktuelles Ereignis stehen in der Kopfleiste; Wetter hat einen eigenen Ton (Wind, Aschegrollen, Regen). Nach Auftrag 12 erscheint das Ende der Fraktion mit Spielzeit, Siegen und offenen Gebieten. Sieg und Niederlage haben je Fraktion eigene Texte.
- **Wilde Lager:** In den Außengebieten bewachen Streuner, Steinwerfer und Hünen (Team 3) die Erzadern. Sie greifen beide Seiten an und geben Erz und Erfahrung als Beute. Sie haben eigene Modelle (bemooste Gestalten mit Geweihmaske), um die Lager stehen Ruinen als Kulisse. Die KI räumt Lager in offenen Gebieten, wenn sie gerade nicht angreift.
- **Speichern und Laden:** Menü, Speichern; Startseite, Spielstand laden (`src/save.js`). Der Zufall der Simulation ist seedbar, gleicher Seed ergibt gleichen Verlauf.
- **Gegner-KI:** drei Stufen, baut Wirtschaft und Armee auf, gründet ab etwa 4 Minuten Vorposten an entfernten Erzadern, nutzt Held und Macht, greift in Wellen an.

## Starten

```bash
npm install
npm run dev        # Browser, mit Neuladen
npm test           # Simulationstest und Oberflächen-Rauchtest ohne Browser
npm run build      # Produktionsbuild nach dist/
npm run desktop    # baut und startet die Electron-Hülle
npm run dist       # Desktop-Pakete nach release/ (electron-builder)
npm run artifact   # alles in eine einzelne HTML-Datei: dist-single/aschenmark.html
```

## Steuerung

| Eingabe | Aktion |
| --- | --- |
| Linksklick, Rahmen ziehen | auswählen |
| Rechtsklick | bewegen, angreifen, Erz abbauen, bauen, Sammelpunkt setzen |
| A, dann Klick | Angriffsmarsch |
| S | Halt |
| Escape | Pausenmenü, im Menü einen Schritt zurück |
| Q, X | Heldenfähigkeiten |
| R | Macht, dann Zielgebiet wählen |
| E, Punkt | Heer wählen, untätigen Arbeiter wählen |
| Strg+1 bis 5, 1 bis 5 | Gruppen speichern und rufen (doppelt: Kamera) |
| Leertaste | Kamera auf die Auswahl |
| F11 | Vollbild (Desktop-Hülle) |
| Touch | Tippen wählt und befiehlt, Wischen verschiebt, zwei Finger zoomen, Bauplatz und Ziele zweimal tippen |

## Aufbau

```
src/
  config.js     Konstanten, Schwierigkeit, Gegenspiel-Faktoren, Kartenlayout
  factions.js   Zahlen, Namen, Fähigkeiten und Mächte beider Fraktionen
  state.js      gemeinsamer Zustand und hooks (Simulation kennt kein DOM)
  world.js      Entitäten, Wald, Versorgung, neue Partie
  path.js       A*-Wegfindung und Bewegung
  combat.js     Schaden, Tod, Erfahrung, Fähigkeiten, Mächte, Projektile
  units.js      Befehlsabarbeitung, Wirtschaft, Ausbildung
  ai.js         Gegner-KI
  sim.js        Simulationsschritt, Kriegsnebel
  events.js     Naturereignisse (Phasen, Wirkung auf Sicht, Tempo, Abbau)
  save.js       Spielstand speichern und laden
  regions.js    Regionen, Grate und Pässe
  quests.js     Aufträge (Ketten, Ziele, Fortschritt)
  commands.js   Auswahl, Befehle, Bauen, Befehlsknöpfe
  render3d.js   3D-Darstellung (Kamera, Gelände, Licht, Effekte, Auswahlringe, Minimap)
  models3d.js   Prozedurale Modelle aller Einheiten, Gebäude, Bäume, Erzadern
  render.js     flache 2D-Darstellung als Ersatz ohne WebGL
  audio.js      Effekte und generative Musik
  ui.js         Kopfleiste, Info, Menüs
  input.js      Maus, Touch, Tastatur
  camera.js     Kamera
  settings.js   Lautstärke und Fortschritt (localStorage)
  platform.js   Steam-Erfolge, Beenden und Vollbild über die Desktop-Hülle
electron/       Desktop-Hülle (main.cjs, preload.cjs)
tests/          sim.test.mjs, ui.test.mjs
docs/           BUILD_STEAM.md
```

Neue Einheiten oder Fraktionen beginnen in `src/factions.js`. Die Simulation importiert nichts aus Darstellung oder Ton, deshalb laufen die Tests ohne Browser.

## Weiterbauen mit Claude Code

1. Claude Code installieren und im Projektordner starten: `cd aschenmark && claude`
2. Beschreibe auf Deutsch, was als Nächstes kommen soll, zum Beispiel "baue ein Missionssystem mit Siegbedingungen" oder "füge eine Schmiedestufe für Speerträger hinzu".
3. Nach jeder Änderung `npm test` laufen lassen. Die Simulationstests fangen die meisten Fehler ohne Browser ab.
4. Zum Ausprobieren `npm run dev`.

Hilfreich für Claude: Neue Einheiten stehen in `src/factions.js`, Verhalten in `src/units.js` und `src/combat.js`. Die Welt und Geschichte stehen im Dokument "Aschenmark - Welt und Geschichte".

## Darstellung anpassen

- Stimmung (Licht, Dunst, Farben): `attach3d` in `src/render3d.js` (Hemisphären- und Sonnenlicht, `FogExp2`, Belichtung) und `paintGround` für die Bodenfarben.
- Neue Optik für eine Einheit oder ein Gebäude: `src/models3d.js`, je Fraktion eine Funktion. Maßstab: 1 Einheit sind 16 Weltpixel, +X ist vorne.
- Zum Prüfen von außen: Link mit `?debug` macht `window.__A` verfügbar (Spielzustand, Schritte, Projektion).
- Später gekaufte oder gebaute Modelle (glTF) lassen sich an derselben Stelle einhängen, ohne die Simulation anzufassen.

## Rechtliches

Alle Namen, Figuren und Werte sind eigene Erfindungen. Das Spiel verwendet keine geschützten Figuren, Orte oder Marken aus Herr der Ringe oder Schlacht um Mittelerde. Das sollte beim Ausbau so bleiben, besonders vor einer Veröffentlichung auf Steam.
