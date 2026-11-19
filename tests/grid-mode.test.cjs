const test = require('node:test');
const assert = require('node:assert/strict');
const { mapPreviewPoint, gridColumns } = require('../src/renderer/gridMath.js');

const display = { bounds: { x: -1920, y: 120, width: 1920, height: 1080 } };

test('maps the video center to the correct physical monitor origin', () => {
  assert.deepEqual(mapPreviewPoint(display, { width: 1920, height: 1080 },
    { left: 100, top: 50, width: 960, height: 540 }, { x: 580, y: 320 }),
  { targetX: -960, targetY: 660 });
});

test('rejects black letterbox areas and clamps the last physical pixel', () => {
  const rect = { left: 0, top: 0, width: 1000, height: 1000 };
  assert.equal(mapPreviewPoint(display, { width: 1920, height: 1080 }, rect, { x: 500, y: 100 }), null);
  assert.deepEqual(mapPreviewPoint(display, { width: 1920, height: 1080 }, rect, { x: 1000, y: 500 }),
    { targetX: -1, targetY: 660 });
});

test('supports monitors with non-zero origins and mixed resolutions', () => {
  const right = { bounds: { x: 2560, y: -400, width: 1280, height: 1024 } };
  assert.deepEqual(mapPreviewPoint(right, { width: 1280, height: 1024 },
    { left: 40, top: 30, width: 640, height: 512 }, { x: 40, y: 30 }),
  { targetX: 2560, targetY: -400 });
});

test('chooses a responsive column count and respects manual preferences', () => {
  assert.equal(gridColumns(4, 1200, 'auto'), 2);
  assert.equal(gridColumns(5, 1600, 'auto'), 3);
  assert.equal(gridColumns(4, 1800, '4'), 4);
  assert.equal(gridColumns(4, 450, '4'), 1);
  assert.equal(gridColumns(0, 900, 'auto'), 1);
});


const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.clientWidth = 1200;
    this.hidden = false;
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    this.style = { setProperty: (key, value) => { this.columns = { key, value }; } };
  }
  append(...items) { this.children.push(...items); }
  appendChild(item) { this.children.push(item); }
  replaceChildren(...items) { this.children = [...items]; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(key, callback) { this.listeners.set(key, callback); }
  removeEventListener(key) { this.listeners.delete(key); }
  getBoundingClientRect() { return this.rect || { left: 0, top: 0, width: 960, height: 540 }; }
  play() { return Promise.resolve(); }
  emit(key, e) { if (this.listeners.has(key)) this.listeners.get(key)(e); }
}

function createHarness(getUserMedia) {
  const root = {
    GridMath: require('../src/renderer/gridMath.js'),
    handlers: new Map(),
    addEventListener(event, callback) {
      const listeners = this.handlers.get(event) || [];
      listeners.push(callback);
      this.handlers.set(event, listeners);
    },
    removeEventListener(event, callback) {
      this.handlers.set(event, (this.handlers.get(event) || []).filter((listener) => listener !== callback));
    },
    emit(event, data) {
      for (const listener of this.handlers.get(event) || []) listener(data);
    }
  };
  const context = {
    window: root,
    document: {
      createElement: (tag) => new MockElement(tag),
      addEventListener() {}, removeEventListener() {}, hidden: false
    },
    navigator: { mediaDevices: { getUserMedia } },
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame(callback) { callback(); },
    setTimeout, clearTimeout
  };
  const dragSource = fs.readFileSync(path.join(__dirname, '../src/renderer/dragController.js'), 'utf8');
  vm.runInNewContext(dragSource, context);
  const gridSource = fs.readFileSync(path.join(__dirname, '../src/renderer/gridMode.js'), 'utf8');
  vm.runInNewContext(gridSource, context);
  class ConnectedGridMode extends root.GridMode {
    constructor(options) {
      const dragController = new root.DragController({
        sendInput: options.sendInput,
        getMode: options.getCursorMode,
        onCoordinates: options.onCoordinates,
      });
      super({ ...options, dragController });
      this.dragController = dragController;
    }
  }
  return { GridMode: ConnectedGridMode, root, container: new MockElement('div') };
}

function mockStream() {
  let stopped = 0;
  const track = { stop() { stopped++; }, addEventListener() {} };
  return {
    getTracks: () => [track], getVideoTracks: () => [track],
    get stopped() { return stopped; }
  };
}

test('grid captures each monitor independently, maps clicks, focuses a tile and cleans up', async () => {
  const streams = [mockStream(), mockStream()];
  const captures = [];
  const { GridMode, root, container } = createHarness(async (constraints) => {
    captures.push(constraints.video.mandatory.chromeMediaSourceId);
    return streams[captures.length - 1];
  });
  const inputEvents = [];
  const focused = [];
  const grid = new GridMode({
    container, preference: 'auto',
    sendInput: (event) => inputEvents.push(event),
    getCursorMode: () => 'ghost',
    onCoordinates() {},
    onFocus: (display) => focused.push(display.id),
  });
  const displays = [
    { id: 'A', name: 'Monitor A', sourceId: 'screen:1:0',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 'B', name: 'Monitor B', sourceId: 'screen:2:0',
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }
  ];
  grid.start(displays);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(captures, ['screen:1:0', 'screen:2:0']);
  assert.equal(container.children.length, 2);
  assert.equal(grid.tiles.length, 2);
  const firstVideo = grid.tiles[0].video;
  const pointer = { clientX: 480, clientY: 270, screenX: 500,
    screenY: 300, button: 0, preventDefault() {} };
  firstVideo.emit('mousedown', pointer);
  root.emit('mouseup', pointer);
  assert.equal(inputEvents.length, 1);
  assert.equal(inputEvents[0].type, 'click');
  assert.equal(inputEvents[0].x, 960);
  assert.equal(inputEvents[0].y, 540);
  const focusButton = container.children[1].children[0].children[2];
  focusButton.emit('click');
  assert.deepEqual(focused, ['B']);
  grid.stop();
  assert.equal(streams[0].stopped, 1);
  assert.equal(streams[1].stopped, 1);
  assert.equal(container.children.length, 0);
  assert.equal(container.hidden, true);
});

test('a late grid capture is discarded after switching back to single mode', async () => {
  let resolveCapture;
  const stream = mockStream();
  const { GridMode, container } = createHarness(() => new Promise((resolve) => {
    resolveCapture = resolve;
  }));
  const grid = new GridMode({
    container, preference: '2', sendInput() {}, getCursorMode: () => 'ghost',
    onCoordinates() {}, onFocus() {}
  });
  grid.start([{ id: 'late', name: 'Late display', sourceId: 'screen:2:0',
    bounds: { x: 0, y: 0, width: 1280, height: 720 } }]);
  grid.stop();
  resolveCapture(stream);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stream.stopped, 1);
  assert.equal(grid.tiles.length, 0);
});

function pointerAt(x, y = 270) {
  return { clientX: x, clientY: y, screenX: x + 20, screenY: y + 20,
    button: 0, preventDefault() {} };
}

async function twoTileDragHarness(mode = 'ghost') {
  const events = [];
  const { GridMode, root, container } = createHarness(async () => mockStream());
  const grid = new GridMode({
    container, preference: '2',
    sendInput: (event) => events.push(event),
    getCursorMode: () => mode,
    onCoordinates() {}, onFocus() {}
  });
  grid.start([
    { id: 'A', name: 'Monitor A', sourceId: 'screen:1:0',
      bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
    { id: 'B', name: 'Monitor B', sourceId: 'screen:2:0',
      bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  const first = grid.tiles[0].video;
  const second = grid.tiles[1].video;
  first.rect = { left: 0, top: 0, width: 960, height: 540 };
  second.rect = { left: 960, top: 0, width: 960, height: 540 };
  return { grid, root, events, first, second };
}

test('Ghost drag crosses monitor tiles and drops on the actual destination monitor', async () => {
  const { grid, root, events, first } = await twoTileDragHarness('ghost');
  first.emit('mousedown', pointerAt(480));
  root.emit('mousemove', pointerAt(520));
  root.emit('mousemove', pointerAt(1440));
  root.emit('mouseup', pointerAt(1440));
  assert.deepEqual(events.map((event) => event.type), ['dragstart', 'drag', 'drag', 'dragend']);
  assert.equal(events[0].x, 960);
  assert.equal(events[2].x, -960);
  assert.equal(events[3].x, -960);
  assert.equal(events[3].mode, 'ghost');
  grid.stop();
});

test('Ghost-only drag moves across tiles without direct mouse commands', async () => {
  const { grid, root, events, first } = await twoTileDragHarness('direct');
  first.emit('mousedown', pointerAt(480));
  root.emit('mousemove', pointerAt(1440));
  root.emit('mouseup', pointerAt(1440));
  assert.deepEqual(events.map((event) => event.type), ['dragstart', 'drag', 'dragend']);
  assert.equal(events[2].x, -960);
  assert.equal(events[2].mode, 'ghost');
  grid.stop();
});

test('Leaving a tile does not drop early; losing focus releases an active drag', async () => {
  const { grid, root, events, first } = await twoTileDragHarness('ghost');
  first.emit('mousedown', pointerAt(480));
  root.emit('mousemove', pointerAt(530));
  first.emit('mouseleave', pointerAt(980));
  assert.deepEqual(events.map((event) => event.type), ['dragstart', 'drag']);
  root.emit('blur', {});
  assert.equal(events.at(-1).type, 'dragcancel');
  root.emit('mouseup', pointerAt(1440));
  assert.equal(events.filter((event) => event.type === 'dragend').length, 0);
  grid.stop();
});

test('A cancelled click outside a tile never fires, while teardown releases held direct input', async () => {
  const { grid, root, events, first } = await twoTileDragHarness('ghost');
  first.emit('mousedown', pointerAt(480));
  root.emit('mouseup', pointerAt(2100));
  assert.equal(events.length, 0);
  grid.stop();

  const cancelled = await twoTileDragHarness('ghost');
  cancelled.first.emit('mousedown', pointerAt(480));
  cancelled.root.emit('mousemove', pointerAt(530));
  cancelled.grid.stop();
  assert.deepEqual(cancelled.events.map((event) => event.type), ['dragstart', 'drag', 'dragcancel']);
});
