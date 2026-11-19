const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function loadWindowManager(electron) {
  const target = require.resolve('../src/main/window/windowManager.cjs');
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electron;
    if (request === './iconResolver.cjs') return {
      IconResolver: { getWindowIcon: () => null, getIconPath: () => null }
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[target];
    return require(target).WindowManager;
  } finally {
    Module._load = originalLoad;
    delete require.cache[target];
  }
}

test('main window opens maximized before being shown and can restore to floating size', () => {
  const events = [];
  const display = { id: 12, bounds: { x: 1920, y: 0, width: 2560, height: 1440 } };
  class MockWindow {
    constructor(options) {
      events.push('constructed');
      this.options = options;
      this.webContents = { send() {} };
      this.maximized = false;
    }
    loadFile() { events.push('loadFile'); }
    maximize() { this.maximized = true; events.push('maximize'); }
    unmaximize() { this.maximized = false; events.push('unmaximize'); }
    isMaximized() { return this.maximized; }
    on() {}
    show() { events.push('show'); }
    focus() { events.push('focus'); }
    moveTop() {}
    setAlwaysOnTop() {}
    isDestroyed() { return false; }
    getBounds() { return { x: 1920, y: 0, width: 2560, height: 1440 }; }
  }
  const electron = {
    BrowserWindow: MockWindow,
    screen: {
      getCursorScreenPoint: () => ({ x: 2000, y: 50 }),
      getDisplayNearestPoint: () => display,
      getDisplayMatching: () => display
    },
    Menu: {}, shell: {}
  };
  const WindowManager = loadWindowManager(electron);
  const manager = new WindowManager();
  const win = manager.createWindow();
  assert.equal(win.options.show, false);
  assert.equal(win.options.x, 2688);
  assert.equal(win.options.y, 400);
  assert.ok(events.indexOf('maximize') > events.indexOf('constructed'));
  assert.ok(events.indexOf('maximize') < events.indexOf('show'));
  assert.equal(win.isMaximized(), true);
  manager.maximize();
  assert.equal(win.isMaximized(), false);
  manager.maximize();
  assert.equal(win.isMaximized(), true);
});
