const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Module = require('node:module');

function loadTrayManager(electron) {
  const target = require.resolve('../src/main/tray/trayManager.cjs');
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electron;
    if (request === '../window/iconResolver.cjs') return {
      IconResolver: { getTrayIcon: () => 'test-icon' }
    };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[target];
    return require(target).TrayManager;
  } finally {
    Module._load = originalLoad;
    delete require.cache[target];
  }
}

function harness(notificationsSupported = true) {
  const balloons = [];
  const notifications = [];
  const actions = [];
  class MockTray extends EventEmitter {
    setToolTip() {}
    setContextMenu() {}
    displayBalloon(options) { balloons.push(options); }
    destroy() { actions.push('destroy-tray'); }
  }
  class MockNotification extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      notifications.push(this);
    }
    static isSupported() { return notificationsSupported; }
    show() { actions.push('show-notification'); }
    close() { actions.push('close-notification'); }
  }
  const win = {
    isDestroyed: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    isFocused: () => true,
    show: () => actions.push('show-window'),
    focus: () => actions.push('focus-window')
  };
  const windowManager = {
    isAlwaysOnTop: true,
    getWindow: () => win,
    createWindow: () => actions.push('create-window'),
    centerOnActiveScreen() {},
    setAlwaysOnTop() {}
  };
  const electron = {
    Tray: MockTray,
    Notification: MockNotification,
    Menu: { buildFromTemplate: x => x },
    app: { quit() {} },
    shell: {}
  };
  const TrayManager = loadTrayManager(electron);
  const manager = new TrayManager(windowManager);
  return { manager, balloons, notifications, actions };
}

test('startup message is sent once after tray setup and can reopen window', () => {
  const { manager, balloons, notifications, actions } = harness();
  assert.equal(manager.notifyRunning(), false, 'not sent before a tray exists');
  manager.init();
  assert.equal(manager.notifyRunning(), true);
  assert.equal(manager.notifyRunning(), false, 'not repeated after first startup');
  if (process.platform === 'win32') {
    assert.equal(balloons.length, 1);
    assert.match(balloons[0].content, /system tray/);
    manager.tray.emit('balloon-click');
  } else {
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].options.body, /system tray/);
    notifications[0].emit('click');
  }
  assert.deepEqual(actions.filter(x => x === 'show-window'), ['show-window']);
  manager.destroy();
});

test('startup notification gracefully skips unsupported native desktop notifications', () => {
  if (process.platform === 'win32') return;
  const { manager, notifications } = harness(false);
  manager.init();
  assert.equal(manager.notifyRunning(), false);
  assert.equal(notifications.length, 0);
  manager.destroy();
});
