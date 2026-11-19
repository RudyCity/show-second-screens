'use strict';

const { BrowserWindow, screen } = require('electron');

// A visual second cursor, not a second OS mouse pointer. Mouse events always
// pass through to the underlying window, including while a drag is being drawn.
const CURSOR_WIDTH = 40;
const CURSOR_HEIGHT = 48;

function toDisplayPoint(screenApi, platform, x, y) {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return null;
  if (Math.abs(x) > 100000 || Math.abs(y) > 100000) return null;
  let point = { x, y };
  if (platform === 'win32' && typeof screenApi.screenToDipPoint === 'function') {
    point = screenApi.screenToDipPoint(point);
  }
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const displays = screenApi.getAllDisplays();
  const display = displays.find(({ bounds }) => point.x >= bounds.x
    && point.y >= bounds.y && point.x < bounds.x + bounds.width
    && point.y < bounds.y + bounds.height);
  if (!display) return null;
  return { x: Math.round(point.x), y: Math.round(point.y), display };
}

function cursorHtml() {
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>',
    '*{box-sizing:border-box}html,body{padding:0;margin:0;width:100%;height:100%;',
    'background:transparent;overflow:hidden}',
    'svg{display:block;filter:drop-shadow(0 3px 4px rgba(0,0,0,.8))}',
    '</style></head><body>',
    '<svg width="38" height="46" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg"',
    ' aria-label="Remote cursor">',
    '<path d="M3 2 L3 33 L11 25 L17 40 L23 37 L17 22 L29 22 Z"',
    ' fill="#ffffff" stroke="#050b15" stroke-width="2.6" stroke-linejoin="round"/>',
    '<circle cx="30" cy="34" r="6" fill="#22c55e" stroke="#071d10" stroke-width="2"/>',
    '</svg></body></html>'
  ].join('');
}

class DuplicateCursorManager {
  constructor(options = {}) {
    this.screen = options.screen || screen;
    this.Window = options.BrowserWindow || BrowserWindow;
    this.platform = options.platform || process.platform;
    this.window = null;
    this.wanted = false;
    this.point = null;
    this.lastX = null;
    this.lastY = null;
  }

  create() {
    if (this.window && !this.window.isDestroyed()) return true;
    let win;
    try {
      win = new this.Window({
        width: CURSOR_WIDTH,
        height: CURSOR_HEIGHT,
        show: false,
        transparent: true,
        frame: false,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        focusable: false,
        skipTaskbar: true,
        movable: false,
        resizable: false,
        fullscreenable: false,
        hasShadow: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
      });
      // Never show a window which might steal a click.
      win.setIgnoreMouseEvents(true, { forward: true });
      win.setAlwaysOnTop(true, 'screen-saver');
      this.window = win;
      win.webContents.once('did-finish-load', () => {
        if (this.window === win && !win.isDestroyed() && this.wanted && this.point) {
          this.positionWindow(this.point);
          win.showInactive();
        }
      });
      const load = win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(cursorHtml()));
      if (load && typeof load.catch === 'function') {
        load.catch((err) => {
          console.warn('[DuplicateCursor] Failed to load overlay:', err);
          if (this.window === win) this.clear();
        });
      }
      return true;
    } catch (err) {
      console.warn('[DuplicateCursor] Transparent pointer overlay unsupported:', err);
      if (win && !win.isDestroyed()) win.destroy();
      this.window = null;
      return false;
    }
  }

  positionWindow(point) {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    const x = point.x - 3;
    const y = point.y - 2;
    if (this.lastX === x && this.lastY === y) return;
    win.setPosition(x, y, false);
    this.lastX = x;
    this.lastY = y;
  }

  update(x, y) {
    const point = toDisplayPoint(this.screen, this.platform, x, y);
    if (!point) {
      this.hide();
      return false;
    }
    this.point = point;
    this.wanted = true;
    if (!this.create()) return false;
    this.positionWindow(point);
    // A fast-moving cursor can be updated before the lightweight overlay loads.
    if (!this.window.webContents.isLoading || !this.window.webContents.isLoading()) {
      if (!this.window.isVisible()) this.window.showInactive();
    }
    return true;
  }

  hide() {
    this.wanted = false;
    this.point = null;
    if (this.window && !this.window.isDestroyed()) this.window.hide();
  }

  clear() {
    this.hide();
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
    this.window = null;
    this.lastX = null;
    this.lastY = null;
  }
}

module.exports = { DuplicateCursorManager, toDisplayPoint, cursorHtml };
