const { BrowserWindow, screen } = require('electron');

const IDENTIFY_DURATION_MS = 5000;

/**
 * Number displays by Electron's native display enumeration so the selector
 * and the actual on-monitor badges always share the same numbering.
 */
function getDisplayLabels(displays, primaryId) {
  return (displays || []).map((display, index) => ({
    id: String(display.id),
    number: index + 1,
    primary: String(display.id) === String(primaryId),
    bounds: display.bounds
  }));
}

function buildIdentifyHtml(number, primary) {
  // Only server-derived numeric values and a boolean enter this document.
  const safeNumber = Number.isSafeInteger(number) && number > 0 ? number : 1;
  const subtitle = primary ? 'PRIMARY DISPLAY' : 'CONNECTED DISPLAY';
  return [
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<style>',
    '*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent}',
    'body{display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;',
    'color:#f8fafc;-webkit-user-select:none;user-select:none}',
    '.badge{min-width:165px;max-width:100%;padding:14px 24px;text-align:center;',
    'border-radius:20px;border:1px solid rgba(255,255,255,.28);',
    'background:rgba(12,18,29,.96);box-shadow:0 12px 32px rgba(0,0,0,.55)}',
    '.eyebrow{font-size:12px;font-weight:700;letter-spacing:.22em;color:#86efac}',
    '.number{font-size:92px;line-height:1;font-weight:800;font-variant-numeric:tabular-nums}',
    '.foot{font-size:11px;font-weight:650;letter-spacing:.08em;color:#cbd5e1}',
    '</style></head><body><div class="badge" role="status">',
    '<div class="eyebrow">DISPLAY</div><div class="number">', String(safeNumber),
    '</div><div class="foot">', subtitle, '</div></div></body></html>'
  ].join('');
}

/**
 * Creates temporary, click-through labels centered on every native display.
 * Native Electron DIP bounds avoid physical-pixel offset errors on scaled Macs
 * and Windows desktops. Labels never activate or steal keyboard focus.
 */
class DisplayIdentification {
  constructor(options = {}) {
    this.screen = options.screen || screen;
    this.BrowserWindow = options.BrowserWindow || BrowserWindow;
    this.setTimeout = options.setTimeout || setTimeout;
    this.clearTimeout = options.clearTimeout || clearTimeout;
    this.overlays = [];
    this.timer = null;
  }

  identify() {
    this.clear();
    const displays = this.screen.getAllDisplays();
    const primary = this.screen.getPrimaryDisplay();
    const labels = getDisplayLabels(displays, primary && primary.id);

    for (const label of labels) {
      const bounds = label.bounds;
      if (!bounds || bounds.width < 80 || bounds.height < 80) continue;
      const width = Math.min(260, bounds.width);
      const height = Math.min(188, bounds.height);
      let overlay = null;
      try {
        overlay = new this.BrowserWindow({
          x: Math.round(bounds.x + (bounds.width - width) / 2),
          y: Math.round(bounds.y + (bounds.height - height) / 2),
          width, height,
          frame: false,
          transparent: true,
          backgroundColor: '#00000000',
          alwaysOnTop: true,
          focusable: false,
          skipTaskbar: true,
          resizable: false,
          movable: false,
          fullscreenable: false,
          hasShadow: false,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
          }
        });

        // If click-through is unsupported (e.g. restricted Wayland), do not
        // display a label that could intercept any screen or mouse input.
        overlay.setIgnoreMouseEvents(true, { forward: true });
        overlay.webContents.once('did-finish-load', () => {
          if (!overlay.isDestroyed()) overlay.showInactive();
        });
        const html = buildIdentifyHtml(label.number, label.primary);
        const loading = overlay.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        if (loading && typeof loading.catch === 'function') {
          loading.catch((error) => {
            console.warn('[DisplayIdentification] Unable to load display badge:', error);
            if (!overlay.isDestroyed()) overlay.destroy();
          });
        }
        this.overlays.push(overlay);
      } catch (error) {
        console.warn('[DisplayIdentification] Unable to create display badge:', error);
        if (overlay && !overlay.isDestroyed()) overlay.destroy();
      }
    }

    if (this.overlays.length) {
      this.timer = this.setTimeout(() => this.clear(), IDENTIFY_DURATION_MS);
      if (this.timer && typeof this.timer.unref === 'function') this.timer.unref();
    }
    return this.overlays.length;
  }

  clear() {
    if (this.timer !== null) {
      this.clearTimeout(this.timer);
      this.timer = null;
    }
    for (const overlay of this.overlays) {
      if (!overlay.isDestroyed()) overlay.destroy();
    }
    this.overlays = [];
  }
}

module.exports = { DisplayIdentification, getDisplayLabels, buildIdentifyHtml, IDENTIFY_DURATION_MS };
