(function (root) {
  'use strict';

  function overlaps(a, b) {
    if (!a || !b) return false;
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);
    const intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    const smallerArea = Math.min(a.width * a.height, b.width * b.height);
    // Avoid hiding a neighboring display because two monitors share a boundary.
    return smallerArea > 0 && intersection / smallerArea > 0.8;
  }

  function isLocalDisplay(display, host) {
    if (!display || !host) return false;
    if (display.electronDisplayId != null && host.id != null) {
      return String(display.electronDisplayId) === String(host.id);
    }
    // On some Windows capture backends screen sources lack display_id.
    // Compare physical rectangles, not Electron DIP rectangles.
    return overlaps(display.bounds, host.physicalBounds);
  }

  function availableDisplays(displays, host, enabled) {
    if (!Array.isArray(displays)) return [];
    return enabled ? displays.filter((display) => !isLocalDisplay(display, host)) : displays.slice();
  }

  function pickSingleDisplay(displays, preferredId, currentId) {
    return displays.find((display) => display.id === preferredId)
      || displays.find((display) => display.id === currentId)
      || displays.find((display) => !display.isPrimary)
      || displays[0]
      || null;
  }

  const api = { isLocalDisplay, availableDisplays, pickSingleDisplay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SmartHide = api;
})(typeof window !== 'undefined' ? window : null);
