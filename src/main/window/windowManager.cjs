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
      width: 960,
      height: 580,
      minWidth: 360,
      minHeight: 220,
      frame: false, // Frameless for custom sleek header with draggable controls
      transparent: false,
      backgroundColor: '#090a0f',
      alwaysOnTop: true, // Floating on top by default
      skipTaskbar: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false, // Keep 60fps rendering even if window is in background
      },
    });

    const indexPath = path.join(__dirname, '../../renderer/index.html');
    this.mainWindow.loadFile(indexPath);

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
      this.mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'floating');
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
