const { screen, desktopCapturer } = require('electron');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getDisplayLabels } = require('../display/displayIdentification.cjs');

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

  /**
   * Correlate desktopCapturer screen sources with Win32 physical monitors
   * via Electron Display IDs and DIP-to-physical geometry matching.
   */
  correlateWindowsDisplays(sources, electronDisplays, physicalMonitors, displayLabels, dipToScreenRectFn, dipToScreenPointFn) {
    const usedPhysIndices = new Set();
    const usedDisplayIds = new Set();

    const getExpectedPhysicalRect = (disp) => {
      if (typeof dipToScreenRectFn === 'function') {
        try {
          return dipToScreenRectFn(null, disp.bounds);
        } catch {
          // Fallback to scaleFactor multiplication below
        }
      }
      const scale = disp.scaleFactor || 1;
      return {
        x: Math.round(disp.bounds.x * scale),
        y: Math.round(disp.bounds.y * scale),
        width: Math.round(disp.bounds.width * scale),
        height: Math.round(disp.bounds.height * scale),
      };
    };

    const getExpectedPhysicalCenter = (disp, fallbackRect) => {
      const dipCenter = {
        x: Math.round(disp.bounds.x + disp.bounds.width * 0.5),
        y: Math.round(disp.bounds.y + disp.bounds.height * 0.5),
      };
      if (typeof dipToScreenPointFn === 'function') {
        try {
          return dipToScreenPointFn(dipCenter);
        } catch {
          // Fallback to center of physical rect
        }
      }
      return {
        x: Math.round(fallbackRect.x + fallbackRect.width * 0.5),
        y: Math.round(fallbackRect.y + fallbackRect.height * 0.5),
      };
    };

    const findBestPhysicalIndex = (disp) => {
      const expectedRect = getExpectedPhysicalRect(disp);
      const expectedCenter = getExpectedPhysicalCenter(disp, expectedRect);

      let bestIdx = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < physicalMonitors.length; i++) {
        if (usedPhysIndices.has(i)) continue;
        const m = physicalMonitors[i];
        const mRight = m.right != null ? m.right : m.left + m.width;
        const mBottom = m.bottom != null ? m.bottom : m.top + m.height;

        const containsCenter =
          expectedCenter.x >= m.left &&
          expectedCenter.x < mRight &&
          expectedCenter.y >= m.top &&
          expectedCenter.y < mBottom;

        const overlapX = Math.max(0, Math.min(expectedRect.x + expectedRect.width, mRight) - Math.max(expectedRect.x, m.left));
        const overlapY = Math.max(0, Math.min(expectedRect.y + expectedRect.height, mBottom) - Math.max(expectedRect.y, m.top));
        const overlapArea = overlapX * overlapY;

        const mCenterX = m.left + m.width * 0.5;
        const mCenterY = m.top + m.height * 0.5;
        const centerDist = Math.abs(expectedCenter.x - mCenterX) + Math.abs(expectedCenter.y - mCenterY);
        const sizeDiff = Math.abs(expectedRect.width - m.width) + Math.abs(expectedRect.height - m.height);

        const score = (containsCenter ? 1e12 : 0) + overlapArea - centerDist * 100 - sizeDiff * 100;
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }

      return bestIdx;
    };

    // First pass: resolve exact source.display_id -> Electron Display -> Physical Monitor
    const resolved = sources.map((source) => {
      if (!source.display_id) return null;
      const disp = electronDisplays.find((d) => String(d.id) === String(source.display_id));
      if (!disp) return null;
      usedDisplayIds.add(String(disp.id));
      const physIdx = findBestPhysicalIndex(disp);
      if (physIdx >= 0) {
        usedPhysIndices.add(physIdx);
      }
      return { source, disp, physIdx };
    });

    // Second pass: resolve any remaining sources without reusing physical monitors
    return sources.map((source, index) => {
      let entry = resolved[index];
      if (!entry) {
        let disp = electronDisplays.find((d) => !usedDisplayIds.has(String(d.id))) || null;
        let physIdx = disp ? findBestPhysicalIndex(disp) : -1;

        if (physIdx < 0) {
          const numMatch = (source.name || '').match(/\d+/);
          const screenNum = numMatch ? parseInt(numMatch[0], 10) : (index + 1);
          physIdx = physicalMonitors.findIndex((m, idx) => {
            if (usedPhysIndices.has(idx)) return false;
            const devMatch = (m.device || '').match(/DISPLAY(\d+)$/i);
            return devMatch && parseInt(devMatch[1], 10) === screenNum;
          });
        }
        if (physIdx < 0) {
          physIdx = physicalMonitors.findIndex((_, idx) => !usedPhysIndices.has(idx));
        }
        if (physIdx >= 0) {
          usedPhysIndices.add(physIdx);
        }

        const phys = physIdx >= 0 ? physicalMonitors[physIdx] : physicalMonitors[0];
        if (!disp) {
          disp = electronDisplays.find((d) => {
            if (usedDisplayIds.has(String(d.id))) return false;
            const physical = getExpectedPhysicalRect(d);
            return Math.abs(physical.x - phys.left) <= 2
              && Math.abs(physical.y - phys.top) <= 2
              && Math.abs(physical.width - phys.width) <= 2
              && Math.abs(physical.height - phys.height) <= 2;
          }) || null;
        }
        if (disp) {
          usedDisplayIds.add(String(disp.id));
        }
        entry = { source, disp, physIdx };
      }

      const phys = entry.physIdx >= 0 ? physicalMonitors[entry.physIdx] : physicalMonitors[0];
      const matchedElectron = entry.disp;
      const matchedLabel = displayLabels.find((label) => matchedElectron && label.id === String(matchedElectron.id));
      const displayNumber = matchedLabel ? matchedLabel.number : index + 1;
      const isPrimary = matchedLabel ? matchedLabel.primary : Boolean(phys.isPrimary || (phys.left === 0 && phys.top === 0));

      return {
        id: String(index),
        electronDisplayId: matchedElectron ? String(matchedElectron.id) : null,
        name: `Display ${displayNumber}${isPrimary ? ' (Primary)' : ''}`,
        displayNumber,
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

  async getDisplays() {
    const electronDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const displayLabels = getDisplayLabels(electronDisplays, primaryDisplay.id);
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
      const dipToRect = typeof screen.dipToScreenRect === 'function'
        ? screen.dipToScreenRect.bind(screen)
        : null;
      const dipToPoint = typeof screen.dipToScreenPoint === 'function'
        ? screen.dipToScreenPoint.bind(screen)
        : null;
      return this.correlateWindowsDisplays(
        sources,
        electronDisplays,
        physicalMonitors,
        displayLabels,
        dipToRect,
        dipToPoint
      );
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
        electronDisplayId: String(disp.id),
        name: `Display ${index + 1}${disp.id === primaryDisplay.id ? ' (Primary)' : ''}`,
        displayNumber: index + 1,
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
