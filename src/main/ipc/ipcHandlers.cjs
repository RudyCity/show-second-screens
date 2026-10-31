const { ipcMain, shell } = require('electron');

/**
 * Register all IPC channels between Main process and Renderer.
 */
function registerIpcHandlers({ displayService, inputService, windowManager }) {
  // Display channels
  ipcMain.handle('display:get-all', async () => {
    return await displayService.getDisplays();
  });

  // Input injection channels
  ipcMain.on('input:send-event', (event, inputEvent) => {
    if (!inputEvent || typeof inputEvent !== 'object') return;

    const { type, x, y, button, deltaY, origX, origY, mode = 'ghost' } = inputEvent;

    if (mode === 'ghost') {
      // Phantom mode: injection via PostMessage directly to the window under
      // the target point. The physical cursor NEVER moves (no SetCursorPos
      // round-trip, no flicker) — it stays exactly where the user left it.
      switch (type) {
        case 'click':
          inputService.phantomClick(x, y, button || 'left');
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'dblclick':
          inputService.phantomDoubleClick(x, y);
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'wheel':
          inputService.phantomWheel(x, y, deltaY || 0);
          break;
        case 'dragstart':
        case 'mousedown':
          inputService.phantomDown(x, y, button || 'left');
          break;
        case 'dragend':
        case 'mouseup':
          inputService.phantomUp(x, y, button || 'left');
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'drag':
          inputService.phantomMove(x, y, button || 'left');
          break;
        // In phantom mode, mousemove hover does NOT warp OS cursor
      }
    } else {
      switch (type) {
        case 'mousemove':
          inputService.move(x, y);
          break;
        case 'mousedown':
          inputService.move(x, y);
          inputService.mouseDown(button || 'left');
          break;
        case 'mouseup':
          inputService.move(x, y);
          inputService.mouseUp(button || 'left');
          break;
        case 'click':
          inputService.move(x, y);
          inputService.click(button || 'left');
          break;
        case 'dblclick':
          inputService.move(x, y);
          inputService.doubleClick();
          break;
        case 'wheel':
          inputService.wheel(deltaY || 0);
          break;
      }
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
