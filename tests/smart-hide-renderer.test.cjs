const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SmartHide = require('../src/renderer/smartHide.js');

const first = {
  id: 'first', electronDisplayId: '100', sourceId: 'screen:1:0',
  name: 'Screen 1', isPrimary: true,
  bounds: { x: 0, y: 0, width: 1920, height: 1080 }
};
const second = {
  id: 'second', electronDisplayId: '200', sourceId: 'screen:2:0',
  name: 'Screen 2', isPrimary: false,
  bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
};

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.style = {};
    this.options = [];
    this.children = [];
    this.value = '';
    this.classList = { toggle() {}, remove() {}, add() {} };
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  removeEventListener(name) { this.listeners.delete(name); }
  emit(name, supplied) {
    const callback = this.listeners.get(name);
    if (callback) return callback(supplied || { preventDefault() {} });
  }
  setAttribute() {}
  appendChild(item) { this.children.push(item); }
  replaceChildren(...items) { this.children = items; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  play() { return Promise.resolve(); }
}

async function renderWith(host, displays, initialSettings = {}) {
  const names = [
    'titlebar', 'screenSelect', 'screenVideo', 'viewportContainer',
    'placeholder', 'placeholderText', 'fpsDisplay', 'coordDisplay',
    'btnMode', 'btnPin', 'btnOpacity', 'btnGrid', 'gridColumns',
    'btnRefresh', 'btnIdentify', 'btnSmartHide', 'screenGrid', 'btnDonate', 'dragHint', 'fpsSelect'
  ];
  const elements = Object.fromEntries(names.map((name) => [name, new FakeElement()]));
  elements.gridColumns.options = ['auto', '2', '3', '4'].map((value) => ({ value }));
  elements.gridColumns.value = 'auto';
  elements.fpsSelect.options = ['15', '24', '30', '60'].map(value => ({ value }));

  const storage = new Map(Object.entries(initialSettings));
  const captures = [];
  const gridViews = [];
  const gridRates = [];
  const dropRequests = [];
  const identifyCalls = [];
  let onHostMoved;
  let currentHost = host;
  const gridMode = class {
    constructor(options) { this.fps = options.fps; this.tiles = []; }
    start(visible) {
      gridViews.push(visible.map((d) => d.id));
      gridRates.push(this.fps);
    }
    stop() {}
    setFps(value) { this.fps = value; }
    setColumns() {}
  };
  const context = {
    window: {
      addEventListener() {},
      ResizeObserver: class { observe() {} },
      electronAPI: {
        getDisplays: async () => displays,
        getHostDisplay: async () => currentHost,
        identifyDisplays: async () => { identifyCalls.push(true); return displays.length; },
        onDisplaysChanged() {},
        onHostDisplayChanged: (callback) => { onHostMoved = callback; },
        sendInput() {},
        setAlwaysOnTop() {}, setOpacity() {}, openDonate() {},
        getDroppedFilePath(file) { return file.path; },
        async dropFilesIntoDisplay(payload) {
          dropRequests.push(payload);
          return { ok: true, message: 'Confirm the destination in Windows.' };
        }
      }
    },
    document: {
      getElementById: (name) => elements[name],
      createElement: () => new FakeElement()
    },
    navigator: {
      mediaDevices: {
        getUserMedia: async (options) => {
          let stopped = 0;
          const stream = {
            getTracks: () => [{ stop() { stopped++; } }],
            get stopped() { return stopped; }
          };
          captures.push({
            source: options.video.mandatory.chromeMediaSourceId,
            fps: options.video.mandatory.maxFrameRate,
            stream
          });
          return stream;
        }
      }
    },
    localStorage: {
      getItem: (name) => storage.get(name) || null,
      setItem: (name, value) => storage.set(name, value)
    },
    performance: { now: () => 0 },
    ResizeObserver: class { observe() {} },
    GridMode: gridMode,
    // Smart Hide tests mock input; drag integration is tested independently.
    DragController: class {
      addSurface() { return () => {}; }
      locate() { return { pos: { targetX: -900, targetY: 550 } }; }
      dispose() {}
    },
    SmartHide,
    CaptureSettings: require('../src/renderer/captureSettings.js'),
    requestAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    console: { log() {}, error() {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));

  return {
    elements, captures, gridViews, gridRates, storage, identifyCalls, dropRequests,
    moveTo(newHost) { currentHost = newHost; onHostMoved(newHost); }
  };
}

test('Smart Hide switches active single-screen capture as the window changes monitors', async () => {
  const ui = await renderWith({ id: '100' }, [first, second]);
  assert.equal(ui.captures.length, 1);
  assert.equal(ui.captures[0].source, 'screen:2:0');
  ui.moveTo({ id: '200' });
  // getUserMedia resolves asynchronously. Allow its continuation to attach
  // the new stream before making assertions about the next monitor switch.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.captures[0].stream.stopped, 1);
  assert.equal(ui.captures[1].source, 'screen:1:0');
  ui.moveTo({ id: '100' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.captures[1].stream.stopped, 1);
  assert.equal(ui.captures[2].source, 'screen:2:0');
});

test('Grid Mode removes local tile after moving and restores all tiles when disabled', async () => {
  const ui = await renderWith({ id: '100' }, [first, second]);
  ui.elements.btnGrid.emit('click');
  assert.deepEqual(ui.gridViews.at(-1), ['second']);
  ui.moveTo({ id: '200' });
  assert.deepEqual(ui.gridViews.at(-1), ['first']);
  ui.elements.btnSmartHide.emit('click');
  assert.equal(ui.storage.get('show-screen:smart-hide'), 'off');
  assert.deepEqual(ui.gridViews.at(-1), ['first', 'second']);
});

test('a single-monitor setup pauses local capture until Smart Hide is turned off', async () => {
  const ui = await renderWith({ id: '100' }, [first]);
  assert.equal(ui.captures.length, 0);
  assert.match(ui.elements.placeholderText.textContent, /Smart Hide/i);
  ui.elements.btnSmartHide.emit('click');
  await Promise.resolve();
  assert.equal(ui.captures[0].source, 'screen:1:0');
});

test('Identify button requests a native label for each screen', async () => {
  const ui = await renderWith({ id: '100' }, [first, second]);
  ui.elements.btnIdentify.emit('click');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.identifyCalls.length, 1);
  assert.equal(ui.elements.btnIdentify.disabled, false);
  assert.match(ui.elements.btnIdentify.title, /2 displays/);
});

test('dropping native files from the host onto the preview requests a confirmed transfer', async () => {
  const ui = await renderWith({ id: '100' }, [first, second]);
  let prevented = 0;
  const event = {
    clientX: 320, clientY: 200, ctrlKey: false, shiftKey: true,
    dataTransfer: {
      types: ['Files'],
      files: [{ path: 'C:\\Users\\Public\\Documents\\example.txt' }],
      dropEffect: ''
    },
    preventDefault() { prevented++; }
  };
  ui.elements.viewportContainer.emit('dragover', event);
  assert.equal(event.dataTransfer.dropEffect, 'move');
  await ui.elements.viewportContainer.emit('drop', event);
  assert.equal(prevented, 2);
  assert.equal(ui.dropRequests.length, 1);
  assert.equal(ui.dropRequests[0].paths.length, 1);
  assert.equal(ui.dropRequests[0].x, -900);
  assert.equal(ui.dropRequests[0].y, 550);
  assert.equal(ui.dropRequests[0].shift, true);
  assert.match(ui.elements.dragHint.textContent, /Confirm the destination/);
});

test('FPS setting persists and restarts only the selected single-screen capture', async () => {
  const ui = await renderWith({ id: '100' }, [first, second]);
  assert.equal(ui.elements.fpsSelect.value, '60');
  assert.equal(ui.captures[0].fps, 60);
  assert.equal(ui.elements.fpsDisplay.textContent, 'FPS: -- / 60');

  ui.elements.fpsSelect.value = '24';
  ui.elements.fpsSelect.emit('change');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.storage.get('show-screen:target-fps'), '24');
  assert.equal(ui.captures[0].stream.stopped, 1);
  assert.equal(ui.captures[1].source, 'screen:2:0');
  assert.equal(ui.captures[1].fps, 24);
  assert.equal(ui.elements.fpsDisplay.textContent, 'FPS: -- / 24');

  // No unnecessary restart if the same valid value is selected again.
  ui.elements.fpsSelect.emit('change');
  assert.equal(ui.captures.length, 2);
});

test('saved FPS is restored at startup and updated in Grid Mode for all tiles', async () => {
  const ui = await renderWith({ id: '100' }, [first, second], {
    'show-screen:target-fps': '30'
  });
  assert.equal(ui.elements.fpsSelect.value, '30');
  assert.equal(ui.captures[0].fps, 30);
  ui.elements.btnGrid.emit('click');
  assert.equal(ui.gridRates.at(-1), 30);
  ui.elements.fpsSelect.value = '15';
  ui.elements.fpsSelect.emit('change');
  assert.equal(ui.storage.get('show-screen:target-fps'), '15');
  assert.equal(ui.gridRates.at(-1), 15);
  assert.deepEqual(ui.gridViews.at(-1), ['second']);
});
