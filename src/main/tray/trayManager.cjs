const { Tray, Menu, app, shell, Notification } = require('electron');
const { IconResolver } = require('../window/iconResolver.cjs');

/**
 * System Tray Manager for cross-platform system tray integration (Windows, macOS, Linux).
 */
class TrayManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.tray = null;
    this.startupNotificationSent = false;
    this.startupNotification = null;
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

      // Windows tray balloon clicks should always reveal the app, never hide it.
      this.tray.on('balloon-click', () => this.showWindow());
    } catch (err) {
      console.error('[TrayManager] Error initializing system tray:', err);
    }
  }

  /**
   * Inform the user that the app remains accessible from the system tray.
   * Invoked once after the first main window has been created.
   */
  notifyRunning() {
    if (!this.tray || this.startupNotificationSent) return false;

    const title = 'Show Second Screens is running';
    const content = 'The app is also running in the system tray. Right-click the tray icon to show the window or quit.';

    try {
      if (process.platform === 'win32' && typeof this.tray.displayBalloon === 'function') {
        this.tray.displayBalloon({ title, content, iconType: 'info', noSound: true });
        this.startupNotificationSent = true;
        return true;
      }

      if (Notification && Notification.isSupported()) {
        const notification = new Notification({ title, body: content, silent: true });
        notification.on('click', () => this.showWindow());
        notification.once('close', () => {
          if (this.startupNotification === notification) this.startupNotification = null;
        });
        this.startupNotification = notification;
        notification.show();
        this.startupNotificationSent = true;
        return true;
      }
    } catch (error) {
      console.warn('[TrayManager] Could not display startup notification:', error);
    }

    return false;
  }

  showWindow() {
    const win = this.windowManager.getWindow();
    if (!win || win.isDestroyed()) {
      this.windowManager.createWindow();
    } else {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
    this.updateContextMenu();
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
    if (this.startupNotification) {
      this.startupNotification.close();
      this.startupNotification = null;
    }
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
