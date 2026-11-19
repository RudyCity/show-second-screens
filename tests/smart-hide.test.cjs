const test = require('node:test');
const assert = require('node:assert/strict');
const { isLocalDisplay, availableDisplays, pickSingleDisplay } = require('../src/renderer/smartHide.js');

const first = {
  id: 'screen-1', electronDisplayId: '100',
  bounds: { x: 0, y: 0, width: 2560, height: 1440 }, isPrimary: true
};
const second = {
  id: 'screen-2', electronDisplayId: '200',
  bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, isPrimary: false
};
const third = {
  id: 'screen-3', electronDisplayId: '300',
  bounds: { x: 2560, y: -180, width: 1280, height: 1024 }, isPrimary: false
};

test('Smart Hide excludes only the app-hosting display and follows monitor movement', () => {
  const displays = [first, second, third];
  assert.deepEqual(availableDisplays(displays, { id: '100' }, true).map((d) => d.id),
    ['screen-2', 'screen-3']);
  assert.deepEqual(availableDisplays(displays, { id: '200' }, true).map((d) => d.id),
    ['screen-1', 'screen-3']);
  assert.deepEqual(availableDisplays(displays, { id: '300' }, true).map((d) => d.id),
    ['screen-1', 'screen-2']);
  assert.equal(displays.length, 3, 'the source list is immutable');
});

test('Smart Hide off permits all displays, including the host', () => {
  assert.deepEqual(availableDisplays([first, second], { id: '100' }, false),
    [first, second]);
});

test('works with native physical bounds when a captured screen has no Electron ID', () => {
  const native = { id: 'legacy-0',
    bounds: { x: -1920, y: 0, width: 1920, height: 1080 } };
  const host = { id: '200', physicalBounds: {
    x: -1920, y: 0, width: 1920, height: 1080
  } };
  assert.equal(isLocalDisplay(native, host), true);
  assert.equal(isLocalDisplay(first, host), false);
  assert.equal(isLocalDisplay({ id: 'neighbor', bounds: first.bounds }, host), false);
});

test('host detection never confuses another monitor sharing an edge', () => {
  const host = { id: '100', physicalBounds: first.bounds };
  assert.equal(isLocalDisplay(first, host), true);
  assert.equal(isLocalDisplay(second, host), false);
  assert.equal(isLocalDisplay(third, host), false);
});

test('single view falls back to a safe remote monitor, restoring preference when possible', () => {
  assert.equal(pickSingleDisplay(availableDisplays([first, second], { id: '100' }, true),
    first.id, first.id).id, second.id);
  assert.equal(pickSingleDisplay(availableDisplays([first, second], { id: '200' }, true),
    first.id, second.id).id, first.id);
  assert.equal(pickSingleDisplay(availableDisplays([first, second], { id: '100' }, false),
    first.id, second.id).id, first.id);
});

test('one physical monitor has no capture while Smart Hide is enabled', () => {
  assert.deepEqual(availableDisplays([first], { id: '100' }, true), []);
  assert.equal(pickSingleDisplay([], first.id, first.id), null);
});
