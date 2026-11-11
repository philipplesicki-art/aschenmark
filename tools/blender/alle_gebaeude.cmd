@echo off
rem Baut alle Gebaeude neu (ohne Fenster). Aufruf aus dem Projektordner.
set BL="C:\Program Files\Blender Foundation\Blender 5.3\blender.exe"
for %%S in (wacht_hq wacht_barracks wacht_tower wacht_farm wacht_rest asch_all salz_all) do %BL% --background --python tools\blender\%%S.py
