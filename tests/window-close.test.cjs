const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
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

function harness() {
  const pendingDialogs = [];
  const actions = [];
  const display = { id: 10, bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
  class MockWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.visible = false;
      this.destroyed = false;
      this.webContents = { send() {} };
    }
    loadFile() {}
    maximize() {}
    isDestroyed() { return this.destroyed; }
    isVisible() { return this.visible; }
    getBounds() { return display.bounds; }
    show() { this.visible = true; this.emit('show'); }
    hide() { this.visible = false; this.emit('hide'); }
    focus() {}
    moveTop() {}
    setAlwaysOnTop() {}
    close() {
      const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      this.emit('close', event);
      if (!event.defaultPrevented) {
        this.destroyed = true;
        this.emit('closed');
      }
      return !event.defaultPrevented;
    }
  }
  const electron = {
    BrowserWindow: MockWindow,
    screen: {
      getCursorScreenPoint: () => ({ x: 40, y: 40 }),
      getDisplayNearestPoint: () => display,
      getDisplayMatching: () => display
    },
    Menu: {}, shell: {},
    dialog: {
      showMessageBox(win, options) {
        return new Promise((resolve) => pendingDialogs.push({ win, options, resolve }));
      }
    },
    app: {
      quit() {
        actions.push('quit');
        manager.prepareToQuit(); // Mirrors app.on('before-quit') in main/index.cjs
        manager.getWindow()?.close();
      }
    }
  };
  const WindowManager = loadWindowManager(electron);
  const manager = new WindowManager();
  manager.onVisibilityChanged = () => actions.push('visibility-changed');
  const win = manager.createWindow();
  return { manager, win, pendingDialogs, actions };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('closing the preview opens a modal and Hide to Tray preserves the window and process', async () => {
  const { manager, win, pendingDialogs, actions } = harness();
  const initialUpdates = actions.filter((action) => action === 'visibility-changed').length;
  manager.close(); // Also exercises the in-app IPC close path.
  assert.equal(pendingDialogs.length, 1);
  assert.equal(win.isDestroyed(), false);
  assert.deepEqual(pendingDialogs[0].options.buttons, [
    'Close Window (Keep in Tray)', 'Quit Completely', 'Cancel'
  ]);
  assert.equal(pendingDialogs[0].options.defaultId, 0);
  assert.equal(pendingDialogs[0].options.cancelId, 2);
  assert.equal(pendingDialogs[0].win, win);
  pendingDialogs[0].resolve({ response: 0 });
  await flush();
  assert.equal(win.isVisible(), false);
  assert.equal(manager.getWindow(), win, 'window is retained for reopening from tray');
  assert.equal(actions.includes('quit'), false);
  assert.ok(actions.filter((action) => action === 'visibility-changed').length > initialUpdates);
  win.show();
  assert.equal(win.isVisible(), true);
});

test('Cancel and closing the native dialog leave the window open', async () => {
  const { win, pendingDialogs, actions } = harness();
  win.close();
  pendingDialogs[0].resolve({ response: 2 });
  await flush();
  assert.equal(win.isVisible(), true);
  assert.equal(win.isDestroyed(), false);
  assert.equal(actions.includes('quit'), false);
});

test('Quit Completely shuts down without opening another close prompt', async () => {
  const { manager, win, pendingDialogs, actions } = harness();
  manager.close();
  pendingDialogs[0].resolve({ response: 1 });
  await flush();
  assert.deepEqual(actions.filter((action) => action === 'quit'), ['quit']);
  assert.equal(pendingDialogs.length, 1);
  assert.equal(win.isDestroyed(), true);
  assert.equal(manager.getWindow(), null);
});

test('rapid repeated close requests only show one dialog', async () => {
  const { manager, win, pendingDialogs } = harness();
  win.close();
  manager.close();
  win.close();
  assert.equal(pendingDialogs.length, 1);
  pendingDialogs[0].resolve({ response: 2 });
  await flush();
  win.close();
  assert.equal(pendingDialogs.length, 2, 'new close gesture after dismissal can ask again');
  pendingDialogs[1].resolve({ response: 0 });
  await flush();
});

test('explicit OS or tray Quit bypasses the modal', () => {
  const { manager, win, pendingDialogs } = harness();
  manager.prepareToQuit();
  win.close();
  assert.equal(pendingDialogs.length, 0);
  assert.equal(win.isDestroyed(), true);
});

test('a close dialog resolving after OS quit cannot hide or reopen the window', async () => {
  const { manager, win, pendingDialogs } = harness();
  win.close();
  manager.prepareToQuit();
  win.close();
  pendingDialogs[0].resolve({ response: 0 });
  await flush();
  assert.equal(win.isDestroyed(), true);
  assert.equal(manager.getWindow(), null);
});
