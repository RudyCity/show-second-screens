const test = require('node:test');
const assert = require('node:assert/strict');
const Settings = require('../src/renderer/captureSettings.js');

const monitor = {
  sourceId: 'screen:2:0',
  bounds: { x: -1920, y: 80, width: 1920, height: 1080 }
};

test('FPS target defaults to 60 and accepts only supported presets', () => {
  assert.deepEqual(Settings.FPS_OPTIONS, [15, 24, 30, 60]);
  assert.equal(Settings.normalizeFps(null), 60);
  assert.equal(Settings.normalizeFps('15'), 15);
  assert.equal(Settings.normalizeFps('24'), 24);
  assert.equal(Settings.normalizeFps(30), 30);
  assert.equal(Settings.normalizeFps('60'), 60);
  assert.equal(Settings.normalizeFps('120'), 60);
  assert.equal(Settings.normalizeFps('0'), 60);
  assert.equal(Settings.normalizeFps('bad-value'), 60);
  assert.equal(Settings.STORAGE_KEY, 'show-screen:target-fps');
});

test('capture constraints use the selected FPS without modifying native resolution', () => {
  for (const fps of Settings.FPS_OPTIONS) {
    const constraints = Settings.desktopVideoConstraints(monitor, String(fps));
    assert.equal(constraints.mandatory.chromeMediaSource, 'desktop');
    assert.equal(constraints.mandatory.chromeMediaSourceId, monitor.sourceId);
    assert.equal(constraints.mandatory.maxFrameRate, fps);
    assert.equal(constraints.mandatory.minFrameRate, Math.min(15, fps));
    assert.equal(constraints.mandatory.minWidth, 1920);
    assert.equal(constraints.mandatory.maxHeight, 1080);
    assert.deepEqual(constraints.optional, [{ cursor: 'never' }]);
  }
});

test('displayed-video FPS counter uses decoded video frames, not UI RAF calls', () => {
  const video = {
    srcObject: { id: 'stream' },
    getVideoPlaybackQuality: () => ({ totalVideoFrames: 245 })
  };
  assert.equal(Settings.decodedVideoFrames(video), 245);
  assert.equal(Settings.decodedVideoFrames({ srcObject: null }), null);
  assert.equal(Settings.decodedVideoFrames({
    srcObject: {}, webkitDecodedFrameCount: 100
  }), 100);
  assert.equal(Settings.measuredFps({ frames: 245, at: 1000 }, 275, 2000), 30);
  assert.equal(Settings.measuredFps({ frames: 275, at: 2000 }, 323, 3000), 48);
  assert.equal(Settings.measuredFps({ frames: 100, at: 1000 }, 90, 2000), null);
  assert.equal(Settings.measuredFps(null, 90, 2000), null);
  assert.equal(Settings.measuredFps({ frames: 100, at: 1000 }, 120, 1000), null);
});
