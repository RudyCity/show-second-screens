const { ipcMain, shell } = require('electron');

/**
 * Register all IPC channels between Main process and Renderer.
 */
function registerIpcHandlers({ displayService, displayIdentification, inputService, windowManager }) {
  // Display channels
  ipcMain.handle('display:get-all', async () => {
    return await displayService.getDisplays();
  });

  ipcMain.handle('window:get-host-display', () => windowManager.getHostDisplay());

  ipcMain.handle('display:identify', (event) => {
    const activeWindow = windowManager.getWindow();
    if (!activeWindow || event.sender !== activeWindow.webContents) return 0;
    return displayIdentification.identify();
  });

  // Electron's native drop paths can only be sent from the trusted main app.
  ipcMain.handle('files:drop-into-display', (event, payload) => {
    const win = windowManager.getWindow();
    if (!win || win.isDestroyed() || event.sender !== win.webContents) {
      return { ok: false, message: 'Invalid source window.' };
    }
    const paths = payload && payload.paths;
    if (!Array.isArray(paths) || paths.length < 1 || paths.length > 100
      || !paths.every((p) => typeof p === 'string' && p.length > 0 && p.length < 32768
        && !/[\r\n\0]/.test(p)
        && (p.startsWith('/') || /^[A-Za-z]:\\/.test(p) || p.startsWith('\\\\')))
      || !Number.isSafeInteger(payload.x) || !Number.isSafeInteger(payload.y)) {
      return { ok: false, message: 'Invalid file drop.' };
    }
    if (!inputService.dropFiles(paths, payload.x, payload.y, !!payload.ctrl, !!payload.shift)) {
      return { ok: false, message: 'File drop into previews currently requires Windows File Explorer.' };
    }
    return { ok: true, message: 'Confirm the destination and file transfer in the Windows dialog.' };
  });

  // Input injection channels
  ipcMain.on('input:send-event', (event, inputEvent) => {
    const active = windowManager.getWindow();
    if (!active || active.isDestroyed() || event.sender !== active.webContents) return;
    if (!inputEvent || typeof inputEvent !== 'object') return;

    const { type, x, y, button, deltaY, origX, origY, mode = 'ghost' } = inputEvent;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    // The app has one cursor mode: Ghost. Never accept direct cursor-warp
    // commands from renderer input events, even if the payload is forged.
    if (mode !== 'ghost') return;
    const ctrl = !!inputEvent.ctrlKey;
    const shift = !!inputEvent.shiftKey;
    switch (type) {
      case 'click':
        inputService.ghostClick(x, y, button || 'left', origX, origY);
        break;
      case 'dblclick':
        inputService.ghostDoubleClick(x, y, origX, origY);
        break;
      case 'wheel':
        inputService.ghostWheel(x, y, deltaY || 0, origX, origY);
        break;
      case 'dragstart':
        inputService.virtualDragStart(x, y, button || 'left', origX, origY);
        break;
      case 'drag':
        inputService.virtualDragMove(x, y);
        break;
      case 'dragend':
        inputService.virtualDragEnd(x, y, button || 'left', origX, origY, ctrl, shift);
        break;
      case 'dragcancel':
        inputService.virtualDragCancel(x, y, button || 'left', origX, origY);
        break;
    }
  });

  // Window control channels
  ipcMain.on('window:minimize', () => windowManager.minimize());
  ipcMain.on('window:maximize', () => windowManager.maximize());
  ipcMain.on('window:close', () => windowManager.close());
  ipcMain.on('window:set-always-on-top', (event, flag) => windowManager.setAlwaysOnTop(flag));
  ipcMain.on('window:set-opacity', (event, opacity) => windowManager.setOpacity(opacity));

  // External URL & System channels
  ipcMain.on('system:open-external', (event, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });

  ipcMain.on('system:open-donate', () => {
    if (windowManager && typeof windowManager.openDonateWindow === 'function') {
      windowManager.openDonateWindow();
    }
  });
}

module.exports = { registerIpcHandlers };
