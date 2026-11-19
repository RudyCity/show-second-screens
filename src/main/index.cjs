const { app, screen } = require('electron');
const { WindowManager } = require('./window/windowManager.cjs');
const { DisplayService } = require('./capture/displayService.cjs');
const { DisplayIdentification } = require('./display/displayIdentification.cjs');
const { DuplicateCursorManager } = require('./display/duplicateCursorManager.cjs');
const { InputService } = require('./input/inputService.cjs');
const { TrayManager } = require('./tray/trayManager.cjs');
const { registerIpcHandlers } = require('./ipc/ipcHandlers.cjs');
const { SingleInstanceManager } = require('./instance/singleInstanceManager.cjs');

// Configure Chromium flags for maximum GPU acceleration, zero-copy video, and minimal latency
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen,single-on-top,underlay');
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// Initialize Single Instance Management & Lock
const instanceManager = new SingleInstanceManager();
const gotLock = instanceManager.requestInitialLock();

// Application Core Services (instantiated on active instance confirmation)
let windowManager = null;
let displayService = null;
let displayIdentification = null;
let duplicateCursor = null;
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
  displayIdentification = new DisplayIdentification();
  duplicateCursor = new DuplicateCursorManager();
  inputService = new InputService();
  trayManager = new TrayManager(windowManager);
  windowManager.onVisibilityChanged = () => {
    trayManager.updateContextMenu();
    const win = windowManager.getWindow();
    if (!win || !win.isVisible()) duplicateCursor.hide();
  };

  // Connect WindowManager to SingleInstanceManager for second-instance focus handling
  instanceManager.setWindowManager(windowManager);

  // Register IPC bridges and initialize system tray
  registerIpcHandlers({ displayService, displayIdentification, duplicateCursor, inputService, windowManager });
  trayManager.init();

  const win = windowManager.createWindow();
  if (win) trayManager.notifyRunning();

  // Re-enumerate sources after monitor hot-plug, removal, or resolution changes.
  let displayUpdateTimer = null;
  const notifyDisplayChange = () => {
    clearTimeout(displayUpdateTimer);
    displayUpdateTimer = setTimeout(() => {
      const target = windowManager.getWindow();
      if (target && !target.isDestroyed()) target.webContents.send('display:changed');
    }, 350);
  };
  for (const eventName of ['display-added', 'display-removed', 'display-metrics-changed']) {
    screen.on(eventName, notifyDisplayChange);
    screen.on(eventName, () => {
      displayIdentification.clear();
      duplicateCursor.clear();
    });
  }
  app.once('will-quit', () => clearTimeout(displayUpdateTimer));

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

app.on('before-quit', () => {
  if (windowManager) windowManager.prepareToQuit();
});

app.on('will-quit', () => {
  if (displayIdentification) displayIdentification.clear();
  if (duplicateCursor) duplicateCursor.clear();
  if (trayManager) {
    trayManager.destroy();
  }
  if (inputService) {
    inputService.dispose();
  }
});
