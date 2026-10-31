const { BrowserWindow, screen, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { IconResolver } = require('./iconResolver.cjs');

/**
 * Window Manager for the floating target screen preview window.
 * Supports Windows, macOS, and Linux window models.
 */
class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.donateWindow = null;
    this.isAlwaysOnTop = true;
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

    const isMac = process.platform === 'darwin';
    const windowIcon = IconResolver.getWindowIcon();
    const iconPath = IconResolver.getIconPath(process.platform === 'win32' ? 'ico' : 'png');

    this.mainWindow = new BrowserWindow({
      title: 'Show Second Screens - Target Preview & Remote',
      x: winX,
      y: winY,
      width: winWidth,
      height: winHeight,
      minWidth: 420,
      minHeight: 280,
      show: true,
      icon: iconPath || windowIcon,
      frame: true,
      titleBarStyle: isMac ? 'hiddenInset' : 'default',
      autoHideMenuBar: true,
      backgroundColor: '#090a0f',
      alwaysOnTop: this.isAlwaysOnTop,
      webPreferences: {
        preload: path.join(__dirname, '../../preload/index.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        spellcheck: false,
        webgl: true,
        enableWebSQL: false,
      },
    });

    if (windowIcon && typeof this.mainWindow.setIcon === 'function') {
      try {
        this.mainWindow.setIcon(windowIcon);
      } catch (e) {
        // Ignore if unsupported on platform
      }
    }

    const indexPath = path.join(__dirname, '../../renderer/index.html');
    this.mainWindow.loadFile(indexPath);

    this.mainWindow.show();
    this.mainWindow.focus();
    this.mainWindow.moveTop();
    this.mainWindow.setAlwaysOnTop(this.isAlwaysOnTop, isMac ? 'floating' : 'screen-saver');

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  centerOnActiveScreen() {
    if (!this.mainWindow) return;
    const cursorPos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
    const { x, y, width, height } = activeDisplay.bounds;
    const winBounds = this.mainWindow.getBounds();

    const newX = Math.round(x + (width - winBounds.width) / 2);
    const newY = Math.round(y + (height - winBounds.height) / 2);

    this.mainWindow.setPosition(newX, newY);
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  getWindow() {
    return this.mainWindow;
  }

  setAlwaysOnTop(isAlwaysOnTop) {
    this.isAlwaysOnTop = isAlwaysOnTop;
    if (this.mainWindow) {
      const level = process.platform === 'darwin' ? 'floating' : 'screen-saver';
      this.mainWindow.setAlwaysOnTop(isAlwaysOnTop, level);
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

  openDonateWindow() {
    if (this.donateWindow && !this.donateWindow.isDestroyed()) {
      this.donateWindow.show();
      this.donateWindow.focus();
      return;
    }

    const parent = this.mainWindow;
    const parentBounds = parent && !parent.isDestroyed() ? parent.getBounds() : { x: 100, y: 100, width: 900, height: 600 };
    const winWidth = 490;
    const winHeight = 720;
    const winX = Math.round(parentBounds.x + (parentBounds.width - winWidth) / 2);
    const winY = Math.round(parentBounds.y + (parentBounds.height - winHeight) / 2);

    const windowIcon = IconResolver.getWindowIcon();
    const iconPath = IconResolver.getIconPath(process.platform === 'win32' ? 'ico' : 'png');

    this.donateWindow = new BrowserWindow({
      title: '☕ Dukung Show Second Screens — Ko-fi (rudycity)',
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      x: Math.max(0, winX),
      y: Math.max(0, winY),
      width: winWidth,
      height: winHeight,
      minWidth: 420,
      minHeight: 520,
      show: false,
      icon: iconPath || windowIcon,
      autoHideMenuBar: false,
      backgroundColor: '#090a0f',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        spellcheck: false,
      },
    });

    if (windowIcon && typeof this.donateWindow.setIcon === 'function') {
      try {
        this.donateWindow.setIcon(windowIcon);
      } catch (e) {}
    }

    // High compatibility User-Agent: strip Electron token so Cloudflare & payment forms treat as standard Chrome
    const defaultUA = this.donateWindow.webContents.getUserAgent();
    const cleanUA = defaultUA.replace(/Electron\/[0-9\.]+\s?/, '');
    this.donateWindow.webContents.setUserAgent(cleanUA);

    // Build sleek in-app menu
    const donateMenu = Menu.buildFromTemplate([
      {
        label: '☕ Ko-fi',
        submenu: [
          { label: 'Reload Halaman', role: 'reload' },
          { type: 'separator' },
          { label: 'Tutup Jendela', click: () => { if (this.donateWindow) this.donateWindow.close(); } },
        ],
      },
      {
        label: '🌐 Buka di Browser Luar',
        click: () => {
          shell.openExternal('https://ko-fi.com/rudycity');
        },
      },
    ]);
    this.donateWindow.setMenu(donateMenu);

    // Allow payment authorization popups (PayPal, Stripe, etc.)
    this.donateWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.includes('paypal.com') || url.includes('stripe.com') || url.includes('ko-fi.com')) {
        return { action: 'allow' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    });

    this.donateWindow.loadURL('https://ko-fi.com/rudycity');

    let isShown = false;
    const showTarget = () => {
      if (isShown) return;
      isShown = true;
      if (this.donateWindow && !this.donateWindow.isDestroyed()) {
        this.donateWindow.show();
        this.donateWindow.focus();
      }
    };

    this.donateWindow.once('ready-to-show', showTarget);
    // Fallback: show within 1.2s even if external network is slow
    setTimeout(showTarget, 1200);

    this.donateWindow.on('closed', () => {
      this.donateWindow = null;
    });
  }

  close() {
    if (this.donateWindow && !this.donateWindow.isDestroyed()) {
      this.donateWindow.close();
      this.donateWindow = null;
    }
    if (this.mainWindow) this.mainWindow.close();
  }
}

module.exports = { WindowManager };
