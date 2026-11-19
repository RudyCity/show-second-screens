const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function harness() {
  const handlers = new Map();
  const fakeElectron = {
    ipcMain: {
      handle: (name, fn) => handlers.set(name, fn),
      on: (name, fn) => handlers.set(name, fn)
    },
    shell: { openExternal() {} }
  };
  const target = require.resolve('../src/main/ipc/ipcHandlers.cjs');
  const original = Module._load;
  Module._load = function (name, parent, main) {
    if (name === 'electron') return fakeElectron;
    return original.call(this, name, parent, main);
  };
  let register;
  try {
    delete require.cache[target];
    register = require(target).registerIpcHandlers;
  } finally {
    Module._load = original;
    delete require.cache[target];
  }
  const webContents = { id: 1 };
  const positions = [];
  const replayed = [];
  let hidden = 0;
  const duplicateCursor = {
    update(x, y) { positions.push([x, y]); },
    hide() { hidden++; }
  };
  register({
    displayService: {
      async getDisplays() {
        return [
          { bounds: { x: -1920, y: 0, width: 1920, height: 1080 } },
          { bounds: { x: 0, y: 0, width: 1920, height: 1080 } }
        ];
      }
    },
    displayIdentification: { identify() {} },
    duplicateCursor,
    inputService: {
      async replayNativeDrag(points, ctrl, shift) {
        replayed.push({ points, ctrl, shift });
        return { ok: true, message: 'Native input was dispatched.' };
      }
    },
    windowManager: {
      getWindow() { return { webContents, isDestroyed: () => false }; },
      getHostDisplay() { return null; }
    }
  });
  return { handlers, webContents, positions, replayed, getHidden: () => hidden };
}

test('duplicate cursor motion is authorized and coordinate-validated', () => {
  const h = harness();
  const move = h.handlers.get('cursor:move');
  const hide = h.handlers.get('cursor:hide');
  move({ sender: {} }, { x: 50, y: 70 });
  move({ sender: h.webContents }, { x: NaN, y: 50 });
  move({ sender: h.webContents }, { x: 50, y: 70 });
  assert.deepEqual(h.positions, [[50, 70]]);
  hide({ sender: {} });
  assert.equal(h.getHidden(), 0);
  hide({ sender: h.webContents });
  assert.equal(h.getHidden(), 1);
});

test('native replay rejects untrusted senders and paths outside monitor bounds', async () => {
  const h = harness();
  const replay = h.handlers.get('input:replay-native-drag');
  const valid = { points: [{ x: 400, y: 220 }, { x: -600, y: 700 }], ctrl: true };
  assert.equal((await replay({ sender: {} }, valid)).ok, false);
  assert.equal((await replay({ sender: h.webContents }, { ...valid, points: [{}] })).ok, false);
  assert.equal((await replay({ sender: h.webContents }, {
    ...valid, points: [{ x: 10, y: 20 }, { x: 40000, y: 200 }]
  })).ok, false);
  assert.equal(h.replayed.length, 0);
  assert.equal(h.getHidden(), 0);
  const done = await replay({ sender: h.webContents }, valid);
  assert.equal(done.ok, true);
  assert.equal(h.getHidden(), 1);
  assert.equal(h.replayed.length, 1);
  assert.equal(h.replayed[0].ctrl, true);
  assert.equal(h.replayed[0].shift, false);
});
