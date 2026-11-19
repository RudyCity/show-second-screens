const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function getIpcHandlers() {
  const handlers = new Map();
  const ipcMain = {
    handle(name, fn) { handlers.set(name, fn); },
    on(name, fn) { handlers.set(name, fn); }
  };
  const target = require.resolve('../src/main/ipc/ipcHandlers.cjs');
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return { ipcMain, shell: { openExternal() {} } };
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[target];
    return { register: require(target).registerIpcHandlers, handlers };
  } finally {
    Module._load = originalLoad;
    delete require.cache[target];
  }
}

test('only the main app window can request display overlays', () => {
  const { register, handlers } = getIpcHandlers();
  const webContents = { id: 777 };
  let calls = 0;
  register({
    displayService: { getDisplays: async () => [] },
    displayIdentification: { identify() { calls++; return 3; } },
    inputService: {},
    windowManager: { getWindow: () => ({ webContents }), getHostDisplay: () => null }
  });
  const identify = handlers.get('display:identify');
  assert.equal(typeof identify, 'function');
  assert.equal(identify({ sender: {} }), 0);
  assert.equal(calls, 0);
  assert.equal(identify({ sender: webContents }), 3);
  assert.equal(calls, 1);
});

test('display identify IPC is denied when the main window does not exist', () => {
  const { register, handlers } = getIpcHandlers();
  let calls = 0;
  register({
    displayService: {},
    displayIdentification: { identify() { calls++; return 1; } },
    inputService: {},
    windowManager: { getWindow: () => null, getHostDisplay: () => null }
  });
  assert.equal(handlers.get('display:identify')({ sender: {} }), 0);
  assert.equal(calls, 0);
});
