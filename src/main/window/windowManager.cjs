const { BrowserWindow, screen } = require('electron');
const path = require('path');

/**
 * Window Manager for the floating target screen preview window.
 */
class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createWindow() {
    // Detect the monitor where the user's cursor currently resides
    const cursorPos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
    const { x, y, width, height } = activeDisplay.bounds;

    const winWidth = Math.min(1024, Math.round(width * 0.85));
    const winHeight = Math.min(640, Math.round(height * 0.85));
    const winX = Math.round(x + (width - winWidth) / 2);
    const winY = Math.round(y + (height - winHeight) / 2);

    this.mainWindow = new BrowserWindow({
      title: 'Show Second Screens - Target Preview & Remote',
      x: winX,
      y: winY,
      width: winWidth,
      height: winHeight,
      minWidth: 420,
      minHeight: 280,
      show: true,
      frame: true, // Native title bar & controls
      autoHideMenuBar: true,
      backgroundColor: '#090a0f',
      alwaysOnTop: true, // Floating mirror window
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
    this.mainWindow.moveTop();
    this.mainWindow.setAlwaysOnTop(true, 'screen-saver');

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
      this.mainWindow.setAlwaysOnTop(isAlwaysOnTop, 'screen-saver');
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
