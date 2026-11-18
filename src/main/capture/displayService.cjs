const { screen, desktopCapturer } = require('electron');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Service to enumerate all physical and virtual displays,
 * matching them with desktopCapturer screen sources.
 */
class DisplayService {
  constructor() {
    this.displays = [];
    this.cachedPhysicalMonitors = null;
    this.lastPhysicalQuery = 0;

    // Invalidate cached monitor geometry when display setup changes
    if (screen && typeof screen.on === 'function') {
      screen.on('display-added', () => { this.cachedPhysicalMonitors = null; });
      screen.on('display-removed', () => { this.cachedPhysicalMonitors = null; });
      screen.on('display-metrics-changed', () => { this.cachedPhysicalMonitors = null; });
    }
  }

  getWindowsPhysicalMonitors() {
    if (process.platform !== 'win32') return null;

    const now = Date.now();
    if (this.cachedPhysicalMonitors && now - this.lastPhysicalQuery < 5000) {
      return this.cachedPhysicalMonitors;
    }

    try {
      const candidates = [];
      if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, 'bin', 'injector.exe'));
        candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'injector.exe'));
      }
      candidates.push(path.resolve(__dirname, '../../../bin/injector.exe'));
      candidates.push(path.resolve(process.cwd(), 'bin/injector.exe'));

      const binPath = candidates.find((p) => fs.existsSync(p));
      if (!binPath) return null;

      const stdout = execFileSync(binPath, ['getmonitors'], { encoding: 'utf8', windowsHide: true });
      this.cachedPhysicalMonitors = JSON.parse(stdout.trim());
      this.lastPhysicalQuery = now;
      return this.cachedPhysicalMonitors;
    } catch (err) {
      console.error('[DisplayService] Error getting physical monitors:', err);
      return null;
    }
  }

  async getDisplays() {
    const electronDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const physicalMonitors = this.getWindowsPhysicalMonitors();

    // Fetch screen capture sources
    let sources = [];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      });
    } catch (err) {
      console.error('[DisplayService] Error getting desktopCapturer sources:', err);
    }

    // On Windows, correlate sources with physical monitors for exact pixel targeting
    if (physicalMonitors && physicalMonitors.length > 0 && sources.length > 0) {
      return sources.map((source, index) => {
        const numMatch = source.name.match(/\d+/);
        const screenNum = numMatch ? parseInt(numMatch[0], 10) : (index + 1);

        const phys =
          physicalMonitors.find((m) => {
            const devMatch = (m.device || '').match(/DISPLAY(\d+)$/i);
            return devMatch && parseInt(devMatch[1], 10) === screenNum;
          }) ||
          physicalMonitors[index] ||
          physicalMonitors[0];

        const isPrimary = phys.isPrimary || (phys.left === 0 && phys.top === 0);

        return {
          id: String(index),
          name: `${source.name}${isPrimary ? ' (Primary)' : ''}`,
          sourceId: source.id,
          bounds: {
            x: phys.left,
            y: phys.top,
            width: phys.width,
            height: phys.height,
          },
          scaleFactor: 1.0,
          isPrimary: isPrimary,
          displayIndex: index,
        };
      });
    }

    // Cross-platform fallback for macOS/Linux
    return electronDisplays.map((disp, index) => {
      const matchedSource =
        sources.find((s) => s.display_id === String(disp.id)) ||
        sources[index] ||
        sources[0];

      const bounds =
        process.platform === 'win32' && typeof screen.dipToScreenRect === 'function'
          ? screen.dipToScreenRect(null, disp.bounds)
          : disp.bounds;

      return {
        id: String(disp.id),
        name: `Display ${index + 1}${disp.id === primaryDisplay.id ? ' (Primary)' : ''}`,
        sourceId: matchedSource ? matchedSource.id : '',
        bounds,
        scaleFactor: disp.scaleFactor,
        isPrimary: disp.id === primaryDisplay.id,
        displayIndex: index,
      };
    });
  }
}

module.exports = { DisplayService };
