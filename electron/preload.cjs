'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('aschenPlatform', {
  desktop: true,
  unlockAchievement: (id) => ipcRenderer.invoke('achievement', id),
  info: () => ipcRenderer.invoke('platform-info'),
  quit: () => ipcRenderer.invoke('quit'),
  isFullscreen: () => ipcRenderer.invoke('fullscreen-get'),
  setFullscreen: (on) => ipcRenderer.invoke('fullscreen-set', on)
});
