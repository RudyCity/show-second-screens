const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function makeHandlers() {
  const registered = new Map();
  const electron = {
    ipcMain: {
      handle: (name, callback) => registered.set(name, callback),
      on: (name, callback) => registered.set(name, callback)
    },
    shell: { openExternal() {} }
  };
  const original = Module._load;
  const target = require.resolve('../src/main/ipc/ipcHandlers.cjs');
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return electron;
    return original.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[target];
    return { registered, register: require(target).registerIpcHandlers };
  } finally {
    Module._load = original;
    delete require.cache[target];
  }
}

function harness() {
  const { registered, register } = makeHandlers();
  const webContents = { id: 1 };
  const commands = [];
  const service = {};
  for (const method of [
    'ghostClick', 'ghostDoubleClick', 'ghostWheel', 'virtualDragStart',
    'virtualDragMove', 'virtualDragEnd', 'virtualDragCancel'
  ]) service[method] = (...args) => { commands.push({ method, args }); };
  service.dropFiles = (...args) => { commands.push({ method: 'dropFiles', args }); return true; };
  register({
    displayService: { getDisplays: async () => [] },
    displayIdentification: { identify() {} },
    inputService: service,
    windowManager: {
      getWindow: () => ({ webContents, isDestroyed: () => false }),
      getHostDisplay: () => null
    }
  });
  return { registered, commands, webContents, service };
}

test('the IPC input route never moves the physical cursor in Direct Mode', () => {
  const h = harness();
  const onInput = h.registered.get('input:send-event');
  onInput({ sender: h.webContents }, { type: 'mousemove', x: 40, y: 50, mode: 'direct' });
  onInput({ sender: h.webContents }, { type: 'mousedown', x: 40, y: 50, mode: 'direct' });
  onInput({ sender: h.webContents }, { type: 'click', x: 40, y: 50, mode: 'direct' });
  assert.deepEqual(h.commands, []);
  onInput({ sender: h.webContents }, { type: 'click', x: 40, y: 50, mode: 'ghost' });
  assert.deepEqual(h.commands.map(c => c.method), ['ghostClick']);
});

test('window and file drag use virtual native routes; cancellation never commits a transfer', () => {
  const h = harness();
  const send = h.registered.get('input:send-event');
  for (const payload of [
    { type: 'dragstart', x: 100, y: 200, mode: 'ghost' },
    { type: 'drag', x: -900, y: 270, mode: 'ghost' },
    { type: 'dragcancel', x: -900, y: 270, mode: 'ghost' },
    { type: 'dragstart', x: 100, y: 200, mode: 'ghost' },
    { type: 'dragend', x: -900, y: 270, mode: 'ghost', ctrlKey: true, shiftKey: false }
  ]) send({ sender: h.webContents }, payload);
  assert.deepEqual(h.commands.map(c => c.method), [
    'virtualDragStart', 'virtualDragMove', 'virtualDragCancel',
    'virtualDragStart', 'virtualDragEnd'
  ]);
  assert.equal(h.commands[4].args.at(-2), true);
  assert.equal(h.commands[4].args.at(-1), false);
});

test('file drops only accept a trusted window and validated native paths and coordinates', () => {
  const h = harness();
  const drop = h.registered.get('files:drop-into-display');
  const valid = {
    paths: ['C:\\Users\\Example\\test.txt'],
    x: -1100, y: 650, ctrl: false, shift: true
  };
  assert.equal(drop({ sender: {} }, valid).ok, false);
  assert.equal(drop({ sender: h.webContents }, { ...valid, paths: ['relative.txt'] }).ok, false);
  assert.equal(drop({ sender: h.webContents }, { ...valid, paths: ['C:\\safe\\a.txt\nC:\\safe\\b.txt'] }).ok, false);
  assert.equal(drop({ sender: h.webContents }, { ...valid, x: NaN }).ok, false);
  assert.equal(h.commands.length, 0);
  const result = drop({ sender: h.webContents }, valid);
  assert.equal(result.ok, true);
  assert.match(result.message, /Confirm/);
  assert.deepEqual(h.commands.map(c => c.method), ['dropFiles']);
  assert.deepEqual(h.commands[0].args, [valid.paths, -1100, 650, false, true]);
});

test('input events from unrelated windows and invalid coordinates are discarded', () => {
  const h = harness();
  const input = h.registered.get('input:send-event');
  input({ sender: {} }, { type: 'click', x: 1, y: 2, mode: 'ghost' });
  input({ sender: h.webContents }, { type: 'click', x: Infinity, y: 2, mode: 'ghost' });
  assert.equal(h.commands.length, 0);
});
