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

console.log('[MAIN] Starting Electron process...');

app.whenReady().then(() => {
  console.log('[MAIN] app.whenReady fired!');
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(true);
  });

  registerIpcHandlers({ displayService, inputService, windowManager });
  console.log('[MAIN] Creating window...');
  const win = windowManager.createWindow();
  console.log('[MAIN] Window created successfully with ID:', win ? win.id : 'null');

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
