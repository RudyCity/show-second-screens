const { app } = require('electron');
const { WindowManager } = require('./window/windowManager.cjs');
const { DisplayService } = require('./capture/displayService.cjs');
const { InputService } = require('./input/inputService.cjs');
const { TrayManager } = require('./tray/trayManager.cjs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers.cjs');
const { SingleInstanceManager } = require('./instance/singleInstanceManager.cjs');

// Configure Chromium flags for optimized screen capture and reduced log noise
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Initialize Single Instance Management & Lock
const instanceManager = new SingleInstanceManager();
const gotLock = instanceManager.requestInitialLock();

// Application Core Services (instantiated on active instance confirmation)
let windowManager = null;
let displayService = null;
let inputService = null;
let trayManager = null;

app.whenReady().then(async () => {
  // If another instance is running, prompt user to confirm killing the existing instance
  if (!gotLock) {
    const canProceed = await instanceManager.handleLockConflict();
    if (!canProceed) {
      return;
    }
  }

  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  // Instantiate application services
  windowManager = new WindowManager();
  displayService = new DisplayService();
  inputService = new InputService();
  trayManager = new TrayManager(windowManager);

  // Connect WindowManager to SingleInstanceManager for second-instance focus handling
  instanceManager.setWindowManager(windowManager);

  // Register IPC bridges and initialize system tray
  registerIpcHandlers({ displayService, inputService, windowManager });
  trayManager.init();

  const win = windowManager.createWindow();

  if (win) {
    const bounds = win.getBounds();
    console.log(`✅ Show Second Screens is running! Window active at (${bounds.x}, ${bounds.y}) [${bounds.width}x${bounds.height}]`);
    console.log('📌 System Tray icon is active. Press Ctrl+C in this terminal to exit.');
  }

  app.on('activate', () => {
    if (windowManager && !windowManager.getWindow()) {
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
  if (trayManager) {
    trayManager.destroy();
  }
  if (inputService) {
    inputService.dispose();
  }
});
