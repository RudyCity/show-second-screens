const { Tray, Menu, app, shell } = require('electron');
const { IconResolver } = require('../window/iconResolver.cjs');

/**
 * System Tray Manager for cross-platform system tray integration (Windows, macOS, Linux).
 */
class TrayManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.tray = null;
  }

  init() {
    try {
      const icon = IconResolver.getTrayIcon();
      this.tray = new Tray(icon);
      this.tray.setToolTip('Show Second Screens - Target Preview & Remote');

      this.updateContextMenu();

      // Toggle window on left click (Windows / Linux)
      this.tray.on('click', () => {
        this.toggleWindow();
      });

      // Toggle on double-click
      this.tray.on('double-click', () => {
        this.toggleWindow();
      });
    } catch (err) {
      console.error('[TrayManager] Error initializing system tray:', err);
    }
  }

  toggleWindow() {
    const win = this.windowManager.getWindow();
    if (!win) {
      this.windowManager.createWindow();
      this.updateContextMenu();
      return;
    }

    if (win.isVisible() && !win.isMinimized() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
      if (win.isMinimized()) win.restore();
    }
    this.updateContextMenu();
  }

  updateContextMenu() {
    if (!this.tray) return;

    const win = this.windowManager.getWindow();
    const isVisible = win ? win.isVisible() && !win.isMinimized() : false;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Second Screens',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: isVisible ? 'Hide Window' : 'Show Window',
        click: () => this.toggleWindow(),
      },
      {
        label: 'Always On Top',
        type: 'checkbox',
        checked: this.windowManager.isAlwaysOnTop,
        click: (item) => {
          this.windowManager.setAlwaysOnTop(item.checked);
        },
      },
      {
        label: 'Center Window on Active Screen',
        click: () => {
          this.windowManager.centerOnActiveScreen();
        },
      },
      { type: 'separator' },
      {
        label: '☕ Support via Ko-fi',
        click: () => {
          if (this.windowManager && typeof this.windowManager.openDonateWindow === 'function') {
            this.windowManager.openDonateWindow();
          } else {
            shell.openExternal('https://ko-fi.com/rudycity');
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
