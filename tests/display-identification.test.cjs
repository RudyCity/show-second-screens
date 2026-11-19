const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

function loadIdentification(electron) {
  const target = require.resolve('../src/main/display/displayIdentification.cjs');
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return electron;
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[target];
    return require(target);
  } finally {
    Module._load = originalLoad;
    delete require.cache[target];
  }
}

function harness({ ignoreMouseFailure = false } = {}) {
  const timers = [];
  const windows = [];
  let displays = [
    { id: 101, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 202, bounds: { x: -1600, y: 120, width: 1600, height: 900 } },
  ];
  class FakeOverlay {
    constructor(options) {
      this.options = options;
      this.webContents = new EventEmitter();
      this.destroyed = false;
      this.visible = false;
      this.url = '';
      windows.push(this);
    }
    setIgnoreMouseEvents(ignore, options) {
      this.ignoreMouse = ignore;
      this.ignoreOptions = options;
      if (ignoreMouseFailure) throw new Error('Mouse passthrough is unavailable');
    }
    setAlwaysOnTop(enabled, level) { this.topmost = { enabled, level }; }
    loadURL(url) { this.url = url; return Promise.resolve(); }
    showInactive() { this.visible = true; }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; }
  }
  const electron = {
    BrowserWindow: FakeOverlay,
    screen: {
      getAllDisplays() { return displays; },
      getPrimaryDisplay() { return displays[0]; }
    }
  };
  const api = loadIdentification(electron);
  const manager = new api.DisplayIdentification({
    screen: electron.screen, BrowserWindow: FakeOverlay,
    setTimeout: (handler, ms) => {
      const t = { handler, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimeout: (timer) => { timer.cleared = true; }
  });
  return { api, manager, windows, timers, setDisplays(next) { displays = next; } };
}

test('display labels follow native display numbering even with negative coordinates', () => {
  const { api } = harness();
  const displays = [
    { id: 202, bounds: { x: -1600, y: 120, width: 1600, height: 900 } },
    { id: 101, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
  ];
  const labels = api.getDisplayLabels(displays, 101);
  assert.deepEqual(labels.map(x => ({ id: x.id, number: x.number, primary: x.primary })), [
    { id: '202', number: 1, primary: false },
    { id: '101', number: 2, primary: true }
  ]);
  assert.match(api.buildIdentifyHtml(2, true), /PRIMARY DISPLAY/);
  assert.match(api.buildIdentifyHtml(2, true), /class="number">2</);
});

test('Identify displays creates one click-through, non-focusable badge per screen', () => {
  const { api, manager, windows, timers } = harness();
  assert.equal(manager.identify(), 2);
  assert.equal(windows.length, 2);
  assert.equal(timers[0].ms, api.IDENTIFY_DURATION_MS);
  assert.equal(windows[0].options.x, 830);
  assert.equal(windows[0].options.y, 446);
  assert.equal(windows[1].options.x, -930);
  assert.equal(windows[1].options.y, 476);
  assert.equal(windows[0].options.focusable, false);
  assert.equal(windows[0].options.skipTaskbar, true);
  assert.equal(windows[0].options.transparent, true);
  assert.equal(windows[0].options.webPreferences.nodeIntegration, false);
  assert.equal(windows[0].ignoreMouse, true);
  assert.deepEqual(windows[0].topmost, { enabled: true, level: 'screen-saver' });
  assert.equal(windows[1].ignoreMouse, true);
  assert.equal(windows[0].visible, false);
  windows[0].webContents.emit('did-finish-load');
  windows[1].webContents.emit('did-finish-load');
  assert.equal(windows[0].visible, true);
  assert.equal(windows[1].visible, true);
  const html0 = decodeURIComponent(windows[0].url.split(',')[1]);
  const html1 = decodeURIComponent(windows[1].url.split(',')[1]);
  assert.match(html0, /class="number">1</);
  assert.match(html0, /PRIMARY DISPLAY/);
  assert.match(html1, /class="number">2</);
  assert.match(html1, /CONNECTED DISPLAY/);
  timers[0].handler();
  assert.equal(windows[0].destroyed, true);
  assert.equal(windows[1].destroyed, true);
  assert.equal(manager.overlays.length, 0);
});

test('repeated Identify replaces labels and cancels the previous expiry timer', () => {
  const { manager, windows, timers, setDisplays } = harness();
  manager.identify();
  setDisplays([{ id: 101, bounds: { x: 0, y: 0, width: 1280, height: 720 } }]);
  assert.equal(manager.identify(), 1);
  assert.equal(timers[0].cleared, true);
  assert.equal(windows[0].destroyed, true);
  assert.equal(windows[1].destroyed, true);
  assert.equal(windows[2].options.x, 510);
  manager.clear();
  assert.equal(timers[1].cleared, true);
  assert.equal(windows[2].destroyed, true);
});

test('unsupported mouse passthrough fails closed rather than blocking a monitor', () => {
  const { manager, windows, timers } = harness({ ignoreMouseFailure: true });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(manager.identify(), 0);
    assert.equal(windows.length, 2);
    assert.equal(windows.every((w) => w.destroyed), true);
    assert.equal(windows.every((w) => !w.visible), true);
    assert.equal(timers.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test('empty and tiny displays do not leave orphaned labels or timers', () => {
  const { manager, windows, timers, setDisplays } = harness();
  setDisplays([{ id: 1, bounds: { x: 0, y: 0, width: 30, height: 30 } }]);
  assert.equal(manager.identify(), 0);
  setDisplays([]);
  assert.equal(manager.identify(), 0);
  assert.equal(windows.length, 0);
  assert.equal(timers.length, 0);
});
