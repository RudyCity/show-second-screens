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
  emit(name) {
    const callback = this.listeners.get(name);
    if (callback) callback({ preventDefault() {} });
  }
  setAttribute() {}
  appendChild(item) { this.children.push(item); }
  replaceChildren(...items) { this.children = items; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; }
  play() { return Promise.resolve(); }
}

async function renderWith(host, displays) {
  const names = [
    'titlebar', 'screenSelect', 'screenVideo', 'viewportContainer',
    'placeholder', 'placeholderText', 'fpsDisplay', 'coordDisplay',
    'btnMode', 'btnPin', 'btnOpacity', 'btnGrid', 'gridColumns',
    'btnRefresh', 'btnSmartHide', 'screenGrid', 'btnDonate'
  ];
  const elements = Object.fromEntries(names.map((name) => [name, new FakeElement()]));
  elements.gridColumns.options = ['auto', '2', '3', '4'].map((value) => ({ value }));
  elements.gridColumns.value = 'auto';

  const storage = new Map();
  const captures = [];
  const gridViews = [];
  let onHostMoved;
  let currentHost = host;
  const gridMode = class {
    start(visible) { gridViews.push(visible.map((d) => d.id)); }
    stop() {}
    setColumns() {}
  };
  const context = {
    window: {
      addEventListener() {},
      ResizeObserver: class { observe() {} },
      electronAPI: {
        getDisplays: async () => displays,
        getHostDisplay: async () => currentHost,
        onDisplaysChanged() {},
        onHostDisplayChanged: (callback) => { onHostMoved = callback; },
        sendInput() {},
        setAlwaysOnTop() {}, setOpacity() {}, openDonate() {}
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
          captures.push({ source: options.video.mandatory.chromeMediaSourceId, stream });
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
    SmartHide,
    requestAnimationFrame() {},
    setTimeout: () => 1,
    clearTimeout() {},
    console: { log() {}, error() {} },
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');
  vm.runInNewContext(source, context);
  await new Promise((resolve) => setImmediate(resolve));

  return {
    elements, captures, gridViews, storage,
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
