const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose secure APIs from Main process to the Renderer window.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  getDisplays: () => ipcRenderer.invoke('display:get-all'),
  getHostDisplay: () => ipcRenderer.invoke('window:get-host-display'),
  identifyDisplays: () => ipcRenderer.invoke('display:identify'),
  onHostDisplayChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, host) => callback(host);
    ipcRenderer.on('window:host-display-changed', listener);
    return () => ipcRenderer.removeListener('window:host-display-changed', listener);
  },
  onDisplaysChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('display:changed', listener);
    return () => ipcRenderer.removeListener('display:changed', listener);
  },
  sendInput: (event) => ipcRenderer.send('input:send-event', event),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window:set-always-on-top', flag),
  setOpacity: (opacity) => ipcRenderer.send('window:set-opacity', opacity),
  openExternal: (url) => ipcRenderer.send('system:open-external', url),
  openDonate: () => ipcRenderer.send('system:open-donate'),
});
