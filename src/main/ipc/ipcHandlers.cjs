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

    const { type, x, y, button, deltaY } = inputEvent;

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
  });

  // Window control channels
  ipcMain.on('window:minimize', () => windowManager.minimize());
  ipcMain.on('window:maximize', () => windowManager.maximize());
  ipcMain.on('window:close', () => windowManager.close());
  ipcMain.on('window:set-always-on-top', (event, flag) => windowManager.setAlwaysOnTop(flag));
  ipcMain.on('window:set-opacity', (event, opacity) => windowManager.setOpacity(opacity));
}

module.exports = { registerIpcHandlers };
