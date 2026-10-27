const { screen, desktopCapturer } = require('electron');

/**
 * Service to enumerate all physical and virtual displays,
 * matching them with desktopCapturer screen sources.
 */
class DisplayService {
  constructor() {
    this.displays = [];
  }

  async getDisplays() {
    const electronDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Fetch screen capture sources
    let sources = [];
    try {
      sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 0, height: 0 }, // Skip heavy thumbnail capture to avoid SetThreadDesktop conflicts
        fetchWindowIcons: false,
      });
    } catch (err) {
      console.error('[DisplayService] Error getting desktopCapturer sources:', err);
    }

    // Correlate Electron screens with DesktopCapturer sources
    return electronDisplays.map((disp, index) => {
      // Find matching source by screen id or fallback by index
      const matchedSource =
        sources.find((s) => s.display_id === String(disp.id)) ||
        sources[index] ||
        sources[0];

      return {
        id: String(disp.id),
        name: `Display ${index + 1}${disp.id === primaryDisplay.id ? ' (Primary)' : ''}`,
        sourceId: matchedSource ? matchedSource.id : '',
        thumbnail: matchedSource && matchedSource.thumbnail ? matchedSource.thumbnail.toDataURL() : null,
        bounds: disp.bounds, // { x, y, width, height }
        scaleFactor: disp.scaleFactor,
        isPrimary: disp.id === primaryDisplay.id,
      };
    });
  }
}

module.exports = { DisplayService };
