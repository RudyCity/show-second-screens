const { Tray, Menu, nativeImage, app } = require('electron');

/**
 * System Tray Manager for cross-platform system tray integration (Windows, macOS, Linux).
 */
class TrayManager {
  constructor(windowManager) {
    this.windowManager = windowManager;
    this.tray = null;
  }

  init() {
    const icon = this.createTrayIcon();
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
  }

  createTrayIcon() {
    // 32x32 sleek vector display icon
    const svgIcon = `
      <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="5" width="28" height="18" rx="3" fill="#12141d" stroke="#22c55e" stroke-width="2"/>
        <rect x="7" y="9" width="18" height="10" rx="1.5" fill="#22c55e" fill-opacity="0.3"/>
        <line x1="16" y1="23" x2="16" y2="28" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
        <line x1="10" y1="28" x2="22" y2="28" stroke="#22c55e" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `.trim();

    const buffer = Buffer.from(svgIcon);
    let icon = nativeImage.createFromBuffer(buffer, { width: 16, height: 16 });

    // Mark as template image for macOS dark/light mode automatic styling
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true);
    }

    return icon;
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
