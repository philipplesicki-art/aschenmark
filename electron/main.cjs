'use strict';
// Desktop-Hülle für Aschenmark. Startet das Spiel aus dist/ (oder den Vite-Server im Entwicklungsmodus)
// und reicht Steam-Erfolge über steamworks.js weiter, falls das Paket und der Steam-Client vorhanden sind.
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// App-ID: Umgebungsvariable, sonst steam_appid.txt neben der exe oder im Arbeitsordner.
// Ohne Angabe nimmt die Entwicklungsversion 480 (die öffentliche Test-App von Valve), die fertige Version nichts.
function steamAppId() {
  if (process.env.STEAM_APP_ID) return Number(process.env.STEAM_APP_ID);
  for (const dir of [path.dirname(process.execPath), process.cwd()]) {
    try { const n = Number(fs.readFileSync(path.join(dir, 'steam_appid.txt'), 'utf8').trim()); if (n) return n; } catch (_) {}
  }
  return app.isPackaged ? undefined : 480;
}

let steam = null;
try {
  const sw = require('steamworks.js');
  steam = sw.init(steamAppId());
  if (sw.electronEnableSteamOverlay) sw.electronEnableSteamOverlay();
} catch (_) { /* ohne Steam weiterspielen */ }

// Nur eine Instanz: ein zweiter Start holt das vorhandene Fenster nach vorne.
const firstInstance = app.requestSingleInstanceLock();
if (!firstInstance) app.quit();
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#0b0f13', title: 'Aschenmark', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // Links öffnen keine neuen Fenster in der Hülle.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const dev = process.env.VITE_DEV_SERVER_URL;
  if (dev) win.loadURL(dev); else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('achievement', (_e, id) => {
  try { if (steam && typeof id === 'string') steam.achievement.activate(id); } catch (_) {}
  return !!steam;
});
ipcMain.handle('platform-info', () => {
  let name = null; try { name = steam ? steam.localplayer.getName() : null; } catch (_) {}
  return { steam: !!steam, name };
});
ipcMain.handle('quit', () => { app.quit(); });
ipcMain.handle('fullscreen-get', () => !!(win && win.isFullScreen()));
ipcMain.handle('fullscreen-set', (_e, on) => { if (win) win.setFullScreen(!!on); return !!(win && win.isFullScreen()); });

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
if (firstInstance) app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
