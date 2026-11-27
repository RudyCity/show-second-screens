const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

function loadDisplayService(fakeElectron) {
  const target = require.resolve('../src/main/capture/displayService.cjs');
  const identification = require.resolve('../src/main/display/displayIdentification.cjs');
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return fakeElectron;
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[target];
    delete require.cache[identification];
    return new (require(target).DisplayService)();
  } finally {
    Module._load = origLoad;
    delete require.cache[target];
    delete require.cache[identification];
  }
}

test('Windows 4-monitor correlation maps Screen 3 & 4 accurately despite non-sequential DISPLAY names and mixed DPI', async () => {
  const native = [
    { id: 101, bounds: { x: 0, y: 0, width: 1707, height: 960 }, scaleFactor: 1.5 },
    { id: 102, bounds: { x: 1707, y: 0, width: 1920, height: 1080 }, scaleFactor: 1.0 },
    { id: 103, bounds: { x: 3627, y: 0, width: 1536, height: 864 }, scaleFactor: 1.25 },
    { id: 104, bounds: { x: -1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1.0 },
  ];
  const physByDisplayId = {
    101: { x: 0, y: 0, width: 2560, height: 1440 },
    102: { x: 2560, y: 0, width: 1920, height: 1080 },
    103: { x: 4480, y: 0, width: 1920, height: 1080 },
    104: { x: -1920, y: 0, width: 1920, height: 1080 },
  };
  const fakeElectron = {
    BrowserWindow: class {},
    screen: {
      getAllDisplays: () => native,
      getPrimaryDisplay: () => native[0],
      on() {},
      dipToScreenRect: (_w, rect) => {
        const match = native.find((d) => d.bounds.x === rect.x && d.bounds.y === rect.y);
        return physByDisplayId[match.id];
      },
      dipToScreenPoint: (pt) => {
        const match = native.find((d) => pt.x >= d.bounds.x && pt.x < d.bounds.x + d.bounds.width);
        const p = physByDisplayId[match.id];
        return { x: p.x + Math.round(p.width / 2), y: p.y + Math.round(p.height / 2) };
      },
    },
    desktopCapturer: {
      getSources: async () => [
        { id: 'screen:0:0', name: 'Screen 1', display_id: '101' },
        { id: 'screen:1:0', name: 'Screen 2', display_id: '102' },
        { id: 'screen:2:0', name: 'Screen 3', display_id: '103' },
        { id: 'screen:3:0', name: 'Screen 4', display_id: '104' },
      ],
    },
  };

  const ds = loadDisplayService(fakeElectron);
  ds.getWindowsPhysicalMonitors = () => [
    { index: 0, device: '\\\\.\\DISPLAY16', left: -1920, top: 0, right: 0, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
    { index: 1, device: '\\\\.\\DISPLAY2', left: 2560, top: 0, right: 4480, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
    { index: 2, device: '\\\\.\\DISPLAY15', left: 4480, top: 0, right: 6400, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
    { index: 3, device: '\\\\.\\DISPLAY10', left: 0, top: 0, right: 2560, bottom: 1440, width: 2560, height: 1440, isPrimary: true },
  ];

  const list = await ds.getDisplays();
  assert.deepEqual(list.map((d) => d.bounds), [
    { x: 0, y: 0, width: 2560, height: 1440 },
    { x: 2560, y: 0, width: 1920, height: 1080 },
    { x: 4480, y: 0, width: 1920, height: 1080 },
    { x: -1920, y: 0, width: 1920, height: 1080 },
  ]);
  assert.deepEqual(list.map((d) => d.displayNumber), [1, 2, 3, 4]);
  assert.deepEqual(list.map((d) => d.electronDisplayId), ['101', '102', '103', '104']);
});

test('Windows 4-monitor fallback without display_id never duplicates physical monitors', async () => {
  const native = [
    { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 3, bounds: { x: 3840, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
    { id: 4, bounds: { x: 5760, y: 0, width: 1920, height: 1080 }, scaleFactor: 1 },
  ];
  const fakeElectron = {
    BrowserWindow: class {},
    screen: {
      getAllDisplays: () => native,
      getPrimaryDisplay: () => native[0],
      on() {},
      dipToScreenRect: (_w, rect) => rect,
    },
    desktopCapturer: {
      getSources: async () => [
        { id: 'screen:0:0', name: 'Screen 1', display_id: '' },
        { id: 'screen:1:0', name: 'Screen 2', display_id: '' },
        { id: 'screen:2:0', name: 'Screen 3', display_id: '' },
        { id: 'screen:3:0', name: 'Screen 4', display_id: '' },
      ],
    },
  };

  const ds = loadDisplayService(fakeElectron);
  ds.getWindowsPhysicalMonitors = () => [
    { index: 0, device: '\\\\.\\DISPLAY1', left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080, isPrimary: true },
    { index: 1, device: '\\\\.\\DISPLAY2', left: 1920, top: 0, right: 3840, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
    { index: 2, device: '\\\\.\\DISPLAY10', left: 3840, top: 0, right: 5760, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
    { index: 3, device: '\\\\.\\DISPLAY11', left: 5760, top: 0, right: 7680, bottom: 1080, width: 1920, height: 1080, isPrimary: false },
  ];

  const list = await ds.getDisplays();
  const uniqueBounds = new Set(list.map((d) => JSON.stringify(d.bounds)));
  assert.equal(uniqueBounds.size, 4);
});

test('injector.cs uses MoveCursorExact with mixed-DPI retry and VIRTUALDESK fallback', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/main/input/injector.cs'), 'utf8');
  assert.match(src, /MoveCursorExact\(int tx, int ty\)/);
  assert.match(src, /MOUSEEVENTF_MOVE \| MOUSEEVENTF_ABSOLUTE \| MOUSEEVENTF_VIRTUALDESK/);
  assert.match(src, /GetCursorPos\(out cur\)/);
});
