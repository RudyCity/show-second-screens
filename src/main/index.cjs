const { app } = require('electron');
const { WindowManager } = require('./window/windowManager.cjs');
const { DisplayService } = require('./capture/displayService.cjs');
const { InputService } = require('./input/inputService.cjs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers.cjs');

// Application Services
const windowManager = new WindowManager();
const displayService = new DisplayService();
const inputService = new InputService();

app.whenReady().then(() => {
  registerIpcHandlers({ displayService, inputService, windowManager });
  windowManager.createWindow();

  app.on('activate', () => {
    if (!windowManager.getWindow()) {
      windowManager.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  inputService.dispose();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  inputService.dispose();
});
