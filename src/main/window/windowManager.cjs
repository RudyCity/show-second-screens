const { BrowserWindow } = require('electron');
const path = require('path');

/**
 * Window Manager for the floating target screen preview window.
 */
class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      title: 'Show Second Screens - Target Preview & Remote',
      width: 1024,
      height: 640,
      minWidth: 420,
      minHeight: 280,
      show: true, // Show immediately!
      frame: true, // Native title bar & borders
      autoHideMenuBar: true,
      backgroundColor: '#090a0f',
      alwaysOnTop: true, // Floating mirror window
      center: true, // Center on screen
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
    });

    const indexPath = path.join(__dirname, '../../renderer/index.html');
    this.mainWindow.loadFile(indexPath);

    this.mainWindow.show();
    this.mainWindow.focus();

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getWindow() {
    return this.mainWindow;
  }

  setAlwaysOnTop(isAlwaysOnTop) {
    if (this.mainWindow) {
      this.mainWindow.setAlwaysOnTop(isAlwaysOnTop);
    }
  }

  setOpacity(opacity) {
    if (this.mainWindow) {
      const clamped = Math.max(0.2, Math.min(1.0, opacity));
      this.mainWindow.setOpacity(clamped);
    }
  }

  minimize() {
    if (this.mainWindow) this.mainWindow.minimize();
  }

  maximize() {
    if (this.mainWindow) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
      } else {
        this.mainWindow.maximize();
      }
    }
  }

  close() {
    if (this.mainWindow) this.mainWindow.close();
  }
}

module.exports = { WindowManager };
