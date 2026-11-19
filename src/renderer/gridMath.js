(function (root) {
  'use strict';

  function mapPreviewPoint(display, videoSize, rect, point) {
    if (!display || !display.bounds || !rect || rect.width <= 0 || rect.height <= 0) return null;
    const bounds = display.bounds;
    const width = videoSize.width || bounds.width;
    const height = videoSize.height || bounds.height;
    if (width <= 0 || height <= 0 || bounds.width <= 0 || bounds.height <= 0) return null;

    const scale = Math.min(rect.width / width, rect.height / height);
    const renderWidth = width * scale;
    const renderHeight = height * scale;
    const x = point.x - rect.left - (rect.width - renderWidth) / 2;
    const y = point.y - rect.top - (rect.height - renderHeight) / 2;
    if (x < 0 || y < 0 || x > renderWidth || y > renderHeight) return null;

    return {
      targetX: Math.min(bounds.x + bounds.width - 1, Math.max(bounds.x, Math.round(bounds.x + x / renderWidth * bounds.width))),
      targetY: Math.min(bounds.y + bounds.height - 1, Math.max(bounds.y, Math.round(bounds.y + y / renderHeight * bounds.height)))
    };
  }

  function gridColumns(count, width, preference) {
    if (!count) return 1;
    const canFit = Math.max(1, Math.floor((width + 12) / 300));
    const requested = preference === 'auto' ? Math.ceil(Math.sqrt(count)) : Number(preference);
    return Math.min(count, canFit, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1));
  }

  const api = { mapPreviewPoint, gridColumns };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GridMath = api;
})(typeof window !== 'undefined' ? window : null);
