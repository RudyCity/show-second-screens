(function (root) {
  'use strict';

  // User-selected capture rate is an upper bound, not a guarantee that the
  // desktop capturer or display can deliver that number of unique frames.
  const FPS_OPTIONS = Object.freeze([15, 24, 30, 60]);
  const DEFAULT_FPS = 60;
  const STORAGE_KEY = 'show-screen:target-fps';

  function normalizeFps(value) {
    const fps = Number(value);
    return FPS_OPTIONS.includes(fps) ? fps : DEFAULT_FPS;
  }

  function desktopVideoConstraints(display, selectedFps) {
    const fps = normalizeFps(selectedFps);
    return {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: display.sourceId,
        minWidth: display.bounds.width,
        maxWidth: display.bounds.width,
        minHeight: display.bounds.height,
        maxHeight: display.bounds.height,
        minFrameRate: Math.min(15, fps),
        maxFrameRate: fps
      },
      optional: [{ cursor: 'never' }]
    };
  }

  function decodedVideoFrames(video) {
    if (!video || !video.srcObject) return null;
    try {
      const quality = typeof video.getVideoPlaybackQuality === 'function'
        ? video.getVideoPlaybackQuality() : null;
      const count = quality && quality.totalVideoFrames;
      if (Number.isFinite(count)) return count;
      if (Number.isFinite(video.webkitDecodedFrameCount)) return video.webkitDecodedFrameCount;
    } catch (_) {
      // Some system capture engines do not expose decoded frame counters.
    }
    return null;
  }

  function measuredFps(previous, currentFrameCount, now) {
    if (!previous || !Number.isFinite(currentFrameCount)
      || currentFrameCount < previous.frames || now <= previous.at) return null;
    return Math.max(0, Math.round((currentFrameCount - previous.frames) * 1000 / (now - previous.at)));
  }

  const api = { FPS_OPTIONS, DEFAULT_FPS, STORAGE_KEY, normalizeFps,
    desktopVideoConstraints, decodedVideoFrames, measuredFps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CaptureSettings = api;
})(typeof window !== 'undefined' ? window : null);
