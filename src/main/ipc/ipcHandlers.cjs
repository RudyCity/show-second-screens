const { ipcMain } = require('electron');

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
      switch (type) {
        case 'click':
          inputService.ghostClick(x, y, button || 'left', origX, origY);
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'dblclick':
          inputService.ghostDoubleClick(x, y, origX, origY);
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'wheel':
          inputService.ghostWheel(x, y, deltaY || 0, origX, origY);
          break;
        case 'dragstart':
        case 'mousedown':
          inputService.ghostDown(x, y, button || 'left', origX, origY);
          break;
        case 'dragend':
        case 'mouseup':
          inputService.ghostUp(x, y, button || 'left', origX, origY);
          if (windowManager) {
            const win = windowManager.getWindow();
            if (win && !win.isDestroyed()) win.focus();
          }
          break;
        case 'drag':
          inputService.ghostDrag(x, y);
          break;
        // In ghost mode, mousemove hover does NOT warp OS cursor
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
}

module.exports = { registerIpcHandlers };
