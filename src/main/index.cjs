const { app } = require('electron');
const { WindowManager } = require('./window/windowManager.cjs');
const { DisplayService } = require('./capture/displayService.cjs');
const { InputService } = require('./input/inputService.cjs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers.cjs');

// Configure Chromium flags to suppress non-fatal WebRTC capture logs
app.commandLine.appendSwitch('log-level', '3'); // Suppress non-fatal INFO/WARNING/ERROR logs from Chromium WebRTC
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Application Services
const windowManager = new WindowManager();
const displayService = new DisplayService();
const inputService = new InputService();

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  registerIpcHandlers({ displayService, inputService, windowManager });
  const win = windowManager.createWindow();

  if (win) {
    const bounds = win.getBounds();
    console.log(`✅ Show Second Screens is running! Window active at (${bounds.x}, ${bounds.y}) [${bounds.width}x${bounds.height}]`);
    console.log('💡 Press Ctrl+C in this terminal to exit.');
  }

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
