# Aschenmark auf Steam bringen

Diese Schritte brauchen deinen Rechner und ein Steamworks-Konto. Nichts davon wurde hier gebaut oder hochgeladen.

## 1. Desktop-Pakete bauen

```bash
npm install
npm run dist
```

electron-builder schreibt nach `release/`. Ein Paket pro Betriebssystem baust du am besten auf diesem System (Windows-Build auf Windows, macOS-Build auf einem Mac). Für Steam genügt der entpackte Ordner (`win-unpacked`, `linux-unpacked`, die `.app`).

## 2. Steamworks einrichten

1. Im Steamworks-Partnerbereich App anlegen (kostet einmalig eine Gebühr pro App) und die **App-ID** notieren.
2. Depots für Windows, macOS und Linux anlegen und je einem Betriebssystem zuordnen.
3. Start-Optionen eintragen: Windows `Aschenmark.exe`, Linux `aschenmark`, macOS `Aschenmark.app`.
4. Store-Seite, Kapselbilder und Screenshots erstellen, Review durch Valve abwarten.

## 3. Steam-Anbindung testen

Die Desktop-Hülle lädt `steamworks.js`, falls vorhanden, und gibt Erfolge weiter.

1. Steam-Client starten und anmelden.
2. Im Projektordner `steam_appid.txt` mit deiner App-ID anlegen (zum Testen geht `480`, die öffentliche Test-App von Valve). Die Hülle sucht die Datei neben der exe und im Arbeitsordner; die Umgebungsvariable `STEAM_APP_ID` hat Vorrang. Ohne Angabe nimmt nur die Entwicklungsversion 480, die fertige Version startet dann ohne Steam.
3. `STEAM_APP_ID=<id> npm run desktop`
4. Mit Steam ist das Overlay (Umschalt+Tab) eingeschaltet. Eine zweite Instanz holt nur das offene Fenster nach vorne.

Ohne Steam läuft das Spiel normal weiter, es werden nur keine Erfolge gemeldet.

## 4. Erfolge anlegen

Im Steamworks-Bereich unter Erfolge diese API-Namen genau so eintragen (siehe `src/platform.js`):

| API-Name | Auslöser |
| --- | --- |
| `WIN_FIRST` | erstes gewonnenes Gefecht |
| `WIN_HARD` | Sieg auf Schwer |
| `WIN_BOTH` | Sieg mit zwei Fraktionen |
| `WIN_ALL` | Sieg mit allen drei Fraktionen |
| `CHAIN_DONE` | einen Handlungsfaden abgeschlossen |
| `HERO_MAX` | Held erreicht Stufe 5 |
| `POWER_USED` | erste Macht eingesetzt |

## 5. Hochladen

```bash
steamcmd +login <konto> +run_app_build app_build.vdf +quit
```

Die `app_build.vdf` und `depot_build_*.vdf` verweisen auf die Ordner in `release/`. Vorlagen findest du in der Steamworks-Dokumentation unter "Uploading to Steam".

## Hinweise

- `steamworks.js` ist ein natives Modul. `asarUnpack` in `package.json` sorgt dafür, dass es außerhalb des Archivs liegt. Prüfe nach dem ersten Build, dass die Hülle `steam: true` meldet.
- Die Schriften kommen von Google Fonts, also aus dem Netz. Für Offline-Spiel die Schriftdateien in `public/` ablegen und in `index.html` lokal einbinden.
- Alle Inhalte sind eigene Erfindungen. Vor dem Veröffentlichen Namen und Grafik erneut auf Ähnlichkeit mit geschützten Werken prüfen.
