# Modelle aus Blender

Hier liegen Modelle als `.glb`. Das Spiel lädt nur, was in `index.json` steht; alles andere baut der Code wie bisher.
So lässt sich Modell für Modell umstellen.

```json
{ "wacht:melee": "wacht_melee.glb", "wacht:barracks": "wacht_barracks.glb" }
```

Schlüssel: `Fraktion:Typ`. Fraktionen `wacht`, `asch`, `salz`, `wild`. Einheiten `worker`, `melee`, `ranged`, `cav`, `siege`, `hero`
(wild: `melee`, `ranged`, `brute`). Gebäude `hq`, `barracks`, `workshop`, `farm`, `outpost`, `tower`.

## Regeln für den Export

- Maßstab: 1 Blender-Meter = 1 Spieleinheit = 16 Weltpixel. Ein Mensch ist etwa 2,2 hoch, ein Gebäude der Größe 2 ist 4 × 4 breit, die Burg 6 × 6.
- Vorne ist +X (in Blender +X), oben +Y im Spiel (Blender +Z; der glTF-Export dreht das selbst).
- Ursprung: Einheiten zwischen den Füßen, Gebäude in der Mitte der Grundfläche auf Bodenhöhe.
- Animationen (Aktionen) heißen `stehen`, `gehen`, `angriff`, `arbeit`, `tod`. Fehlt eine, wird `stehen` gespielt.
- Gebäude: leere Objekte `Rauch…` werden Rauchquellen, `Feuer…` Flammen (Größe über die Skalierung), Teile `Fahne…` wehen.
- Sparsam bleiben: eine Einheit möglichst ein Netz mit wenigen Materialien (Texturatlas), unter etwa 4.000 Dreiecken; Gebäude unter 20.000.
- Texturen als PNG/JPG in der .glb einbetten, Normal-Maps im glTF-Format (OpenGL, +Y).

Die Skripte, die diese Modelle erzeugen, liegen unter `tools/blender/` (Plan in `CLAUDE.md`).
