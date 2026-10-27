const { app } = require('electron');
const { WindowManager } = require('./window/windowManager.cjs');
const { DisplayService } = require('./capture/displayService.cjs');
const { InputService } = require('./input/inputService.cjs');
const { TrayManager } = require('./tray/trayManager.cjs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers.cjs');

// Configure Chromium flags for optimized screen capture and reduced log noise
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Application Core Services
const windowManager = new WindowManager();
const displayService = new DisplayService();
const inputService = new InputService();
const trayManager = new TrayManager(windowManager);

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  registerIpcHandlers({ displayService, inputService, windowManager });
  trayManager.init();

  const win = windowManager.createWindow();

  if (win) {
    const bounds = win.getBounds();
    console.log(`✅ Show Second Screens is running! Window active at (${bounds.x}, ${bounds.y}) [${bounds.width}x${bounds.height}]`);
    console.log('📌 System Tray icon is active. Press Ctrl+C in this terminal to exit.');
  }

  app.on('activate', () => {
    if (!windowManager.getWindow()) {
      windowManager.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On macOS, applications stay active until explicit Cmd + Q
  if (process.platform === 'darwin') {
    return;
  }
  // On Windows and Linux, keep running in System Tray
});

app.on('will-quit', () => {
  trayManager.destroy();
  inputService.dispose();
});
