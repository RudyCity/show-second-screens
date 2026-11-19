const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

function harness({ failPassthrough = false } = {}) {
  const windows = [];
  const displays = [
    { id: 10, bounds: { x: 0, y: 0, width: 1200, height: 900 } },
    { id: 20, bounds: { x: 1200, y: -100, width: 1000, height: 800 } }
  ];
  const screen = {
    getAllDisplays: () => displays,
    screenToDipPoint: ({ x, y }) => ({ x: x / 2, y: y / 2 })
  };
  class FakeWindow {
    constructor(options) {
      this.options = options;
      this.destroyed = false;
      this.visible = false;
      this.webContents = new EventEmitter();
      this.webContents.isLoading = () => true;
      windows.push(this);
    }
    setIgnoreMouseEvents(value, options) {
      if (failPassthrough) throw new Error('Not supported');
      this.ignoreMouse = value;
      this.ignoreOptions = options;
    }
    setAlwaysOnTop(value, level) { this.level = { value, level }; }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    destroy() { this.destroyed = true; }
    setPosition(x, y) { this.position = { x, y }; }
  }
  const target = require.resolve('../src/main/display/duplicateCursorManager.cjs');
  const original = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return { BrowserWindow: FakeWindow, screen };
    return original.call(this, name, parent, isMain);
  };
  let cls;
  try {
    delete require.cache[target];
    cls = require(target);
  } finally {
    Module._load = original;
    delete require.cache[target];
  }
  const manager = new cls.DuplicateCursorManager({ BrowserWindow: FakeWindow, screen, platform: 'win32' });
  return { manager, windows, displays, screen, cls };
}

test('pointer on a mixed-DPI destination is mapped to the correct monitor', () => {
  const { manager, windows } = harness();
  assert.equal(manager.update(2600, 300), true);
  assert.equal(windows.length, 1);
  assert.deepEqual(windows[0].position, { x: 1297, y: 148 });
  assert.equal(windows[0].options.focusable, false);
  assert.equal(windows[0].options.transparent, true);
  assert.equal(windows[0].options.skipTaskbar, true);
  assert.equal(windows[0].ignoreMouse, true);
  assert.deepEqual(windows[0].level, { value: true, level: 'screen-saver' });
  assert.equal(windows[0].visible, false);
  windows[0].webContents.emit('did-finish-load');
  assert.equal(windows[0].visible, true);
  assert.match(decodeURIComponent(windows[0].url.split(',')[1]), /Remote cursor/);
  assert.match(decodeURIComponent(windows[0].url.split(',')[1]), /#22c55e/);
});

test('reuses a single click-through cursor window and hides on exit/cleanup', () => {
  const { manager, windows } = harness();
  manager.update(2600, 300);
  windows[0].webContents.emit('did-finish-load');
  manager.update(2800, 350);
  assert.equal(windows.length, 1);
  assert.deepEqual(windows[0].position, { x: 1397, y: 173 });
  manager.hide();
  assert.equal(windows[0].visible, false);
  assert.equal(manager.wanted, false);
  manager.clear();
  assert.equal(windows[0].destroyed, true);
  assert.equal(manager.window, null);
});

test('invalid and offscreen points cannot create overlays', () => {
  const { manager, windows, cls, screen } = harness();
  assert.equal(manager.update(Infinity, 0), false);
  assert.equal(manager.update(1000000, 0), false);
  assert.equal(manager.update(9000, 9000), false);
  assert.equal(windows.length, 0);
  assert.equal(cls.toDisplayPoint(screen, 'win32', NaN, 10), null);
});

test('pass-through failure destroys overlay instead of blocking target clicks', () => {
  const { manager, windows } = harness({ failPassthrough: true });
  const oldWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(manager.update(2600, 300), false);
    assert.equal(windows.length, 1);
    assert.equal(windows[0].destroyed, true);
  } finally { console.warn = oldWarn; }
});
