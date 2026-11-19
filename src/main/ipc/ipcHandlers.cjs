const { ipcMain, shell } = require('electron');

/**
 * Register all IPC channels between Main process and Renderer.
 */
function registerIpcHandlers({ displayService, inputService, windowManager }) {
  // Display channels
  ipcMain.handle('display:get-all', async () => {
    return await displayService.getDisplays();
  });

  ipcMain.handle('window:get-host-display', () => windowManager.getHostDisplay());

  // Input injection channels
  ipcMain.on('input:send-event', (event, inputEvent) => {
    if (!inputEvent || typeof inputEvent !== 'object') return;

    const { type, x, y, button, deltaY, origX, origY, mode = 'ghost' } = inputEvent;

    if (mode === 'ghost') {
      // Ghost mode: uses OS hardware SendInput at target coordinates and
      // immediately restores the physical cursor back to the user's position.
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
        case 'mousedown':
          inputService.ghostDown(x, y, button || 'left', origX, origY);
          break;
        case 'drag':
          inputService.ghostDrag(x, y);
          break;
        case 'dragend':
        case 'mouseup':
          inputService.ghostUp(x, y, button || 'left', origX, origY);
          break;
      }
    } else {
      switch (type) {
        case 'mousemove':
          inputService.move(x, y);
          break;
        case 'dragstart':
        case 'mousedown':
          inputService.move(x, y);
          inputService.mouseDown(button || 'left');
          break;
        case 'drag':
          inputService.move(x, y);
          break;
        case 'dragend':
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
          inputService.move(x, y);
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
