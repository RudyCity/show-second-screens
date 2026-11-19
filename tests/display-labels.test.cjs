const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

function withService(fakeElectron) {
  const target = require.resolve('../src/main/capture/displayService.cjs');
  const identification = require.resolve('../src/main/display/displayIdentification.cjs');
  const originalLoad = Module._load;
  Module._load = function (name, parent, isMain) {
    if (name === 'electron') return fakeElectron;
    return originalLoad.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[target];
    delete require.cache[identification];
    return new (require(target).DisplayService)();
  } finally {
    Module._load = originalLoad;
    delete require.cache[target];
    delete require.cache[identification];
  }
}

test('display labels match native order even when desktop capture sources are reversed', async () => {
  const native = [
    { id: 101, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 202, bounds: { x: -1600, y: 0, width: 1600, height: 900 }, scaleFactor: 1.5 }
  ];
  const fake = {
    BrowserWindow: class {},
    screen: {
      getAllDisplays: () => native,
      getPrimaryDisplay: () => native[0],
      on() {},
      dipToScreenRect: (_win, bounds) => bounds
    },
    desktopCapturer: {
      getSources: async () => [
        { id: 'screen:2:0', name: 'Screen 2', display_id: '202' },
        { id: 'screen:1:0', name: 'Screen 1', display_id: '101' }
      ]
    }
  };
  const service = withService(fake);
  // The fallback is also used on Windows if the physical helper is absent.
  service.getWindowsPhysicalMonitors = () => null;
  const list = await service.getDisplays();
  assert.deepEqual(list.map(d => d.displayNumber), [1, 2]);
  assert.deepEqual(list.map(d => d.name), ['Display 1 (Primary)', 'Display 2']);
  assert.deepEqual(list.map(d => d.electronDisplayId), ['101', '202']);
  assert.deepEqual(list.map(d => d.sourceId), ['screen:1:0', 'screen:2:0']);
});

test('Windows physical monitor enumeration uses matching Electron IDs for label numbers', async () => {
  if (process.platform !== 'win32') return;
  const native = [
    { id: 101, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 202, bounds: { x: -1600, y: 0, width: 1600, height: 900 }, scaleFactor: 1 }
  ];
  const fake = {
    BrowserWindow: class {},
    screen: {
      getAllDisplays: () => native,
      getPrimaryDisplay: () => native[0],
      on() {},
      dipToScreenRect: (_win, bounds) => bounds
    },
    desktopCapturer: {
      getSources: async () => [
        { id: 'screen:2:0', name: 'Screen 2', display_id: '202' },
        { id: 'screen:1:0', name: 'Screen 1', display_id: '101' }
      ]
    }
  };
  const service = withService(fake);
  service.getWindowsPhysicalMonitors = () => [
    { device: '\\\\.\\DISPLAY1', left: 0, top: 0, width: 1920, height: 1080, isPrimary: true },
    { device: '\\\\.\\DISPLAY2', left: -1600, top: 0, width: 1600, height: 900, isPrimary: false }
  ];
  const list = await service.getDisplays();
  assert.deepEqual(list.map(d => d.displayNumber), [2, 1]);
  assert.deepEqual(list.map(d => d.name), ['Display 2', 'Display 1 (Primary)']);
  assert.deepEqual(list.map(d => d.electronDisplayId), ['202', '101']);
  assert.deepEqual(list.map(d => d.bounds.x), [-1600, 0]);
});
