const test = require('node:test');
const assert = require('node:assert/strict');
const { mapPreviewPoint, gridColumns } = require('../src/renderer/gridMath.js');

const display = { bounds: { x: -1920, y: 120, width: 1920, height: 1080 } };

test('maps the video center to the correct physical monitor origin', () => {
  assert.deepEqual(mapPreviewPoint(display, { width: 1920, height: 1080 },
    { left: 100, top: 50, width: 960, height: 540 }, { x: 580, y: 320 }),
  { targetX: -960, targetY: 660 });
});

test('rejects black letterbox areas and clamps the last physical pixel', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 1000 };
  assert.equal(mapPreviewPoint(display, { width: 1920, height: 1080 }, rect, { x: 500, y: 100 }), null);
  assert.deepEqual(mapPreviewPoint(display, { width: 1920, height: 1080 }, rect, { x: 1000, y: 500 }),
    { targetX: -1, targetY: 660 });
});

test('supports monitors with non-zero origins and mixed resolutions', () => {
  const right = { bounds: { x: 2560, y: -400, width: 1280, height: 1024 } };
  assert.deepEqual(mapPreviewPoint(right, { width: 1280, height: 1024 },
    { left: 40, top: 30, width: 640, height: 512 }, { x: 40, y: 30 }),
  { targetX: 2560, targetY: -400 });
});

test('chooses a responsive column count and respects manual preferences', () => {
  assert.equal(gridColumns(4, 1200, 'auto'), 2);
  assert.equal(gridColumns(5, 1600, 'auto'), 3);
  assert.equal(gridColumns(4, 1800, '4'), 4);
  assert.equal(gridColumns(4, 450, '4'), 1);
  assert.equal(gridColumns(0, 900, 'auto'), 1);
});
