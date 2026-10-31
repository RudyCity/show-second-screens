const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose secure APIs from Main process to the Renderer window.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('display:get-all'),
  sendInput: (event) => ipcRenderer.send('input:send-event', event),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
  setOpacity: (opacity) => ipcRenderer.send('window:set-opacity', opacity),
  openExternal: (url) => ipcRenderer.send('system:open-external', url),
  openDonate: () => ipcRenderer.send('system:open-donate'),
});
