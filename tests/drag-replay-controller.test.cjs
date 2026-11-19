const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const GridMath = require('../src/renderer/gridMath.js');

function harness() {
  const handlers = new Map();
  const root = {
    GridMath,
    addEventListener(type, cb) { handlers.set(type, cb); },
    removeEventListener(type) { handlers.delete(type); },
    emit(type, data) { const h = handlers.get(type); if (h) h(data); }
  };
  const overlays = [];
  const sent = [];
  const replayed = [];
  const replayStarts = [];
  const results = [];
  const context = {
    window: root,
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame(callback) { callback(); },
    setTimeout, clearTimeout, Promise, Math,
    console
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/dragController.js'), 'utf8');
  vm.runInNewContext(source, context);
  class Video {
    constructor(left) {
      this.videoWidth = 1920;
      this.videoHeight = 1080;
      this.rect = { left, top: 0, width: 960, height: 540 };
      this.handlers = new Map();
    }
    getBoundingClientRect() { return this.rect; }
    addEventListener(type, cb) { this.handlers.set(type, cb); }
    removeEventListener(type) { this.handlers.delete(type); }
    emit(type, data) { const cb = this.handlers.get(type); if (cb) cb(data); }
  }
  const controller = new root.DragController({
    sendInput: (event) => sent.push(event),
    getMode: () => 'direct', // UI cannot switch the backend from Ghost.
    replayDrag: async (payload) => {
      replayed.push(payload);
      return { ok: true, message: 'Native drag input replay completed.' };
    },
    onReplayResult: (result) => results.push(result),
    onReplayStart: () => replayStarts.push(true),
    onPointer: (point) => overlays.push(point ? { ...point } : null)
  });
  const left = new Video(0);
  const right = new Video(960);
  controller.addSurface(left, {
    id: 'A', name: 'Display 1', bounds: { x: 0, y: 0, width: 1920, height: 1080 }
  });
  controller.addSurface(right, {
    id: 'B', name: 'Display 2', bounds: { x: 1920, y: 0, width: 1920, height: 1080 }
  });
  return { root, controller, left, right, overlays, sent, replayed, replayStarts, results };
}

function pointer(x, y = 270) {
  return {
    clientX: x, clientY: y, screenX: x + 40, screenY: y + 50,
    button: 0, buttons: 1, preventDefault() {}
  };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('duplicate cursor follows remote coordinates, while native drag starts after host release', async () => {
  const h = harness();
  h.left.emit('mousedown', pointer(200));
  h.root.emit('mousemove', pointer(320));
  h.root.emit('mousemove', pointer(1400));
  assert.equal(h.replayed.length, 0);
  assert.deepEqual(h.sent, [], 'no OS cursor warp while previewing the drag');
  assert.equal(h.overlays.at(-1).targetX, 2800);
  h.root.emit('mouseup', pointer(1500));
  await tick();
  assert.equal(h.replayed.length, 1);
  assert.equal(h.replayStarts.length, 1);
  assert.equal(h.replayed[0].points[0].x, 400);
  assert.equal(h.replayed[0].points.at(-1).x, 3000);
  assert.equal(h.replayed[0].ctrl, false);
  assert.equal(h.overlays.at(-1), null);
  assert.equal(h.results[0].ok, true);
  h.controller.dispose();
});

test('Escape and window blur discard recorded drag without native replay', async () => {
  const h = harness();
  h.left.emit('mousedown', pointer(200));
  h.root.emit('mousemove', pointer(350));
  h.root.emit('keydown', { key: 'Escape', preventDefault() {} });
  h.root.emit('mouseup', pointer(350));
  await tick();
  assert.equal(h.replayed.length, 0);
  assert.equal(h.replayStarts.length, 0);
  assert.equal(h.overlays.at(-1), null);
  h.left.emit('mousedown', pointer(200));
  h.root.emit('mousemove', pointer(380));
  h.root.emit('blur');
  await tick();
  assert.equal(h.replayed.length, 0);
  h.controller.dispose();
});

test('ordinary click still emits Ghost input, without a native replay', async () => {
  const h = harness();
  h.left.emit('mousedown', pointer(200));
  h.root.emit('mouseup', pointer(200));
  await tick();
  assert.equal(h.replayed.length, 0);
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].type, 'click');
  assert.equal(h.sent[0].mode, 'ghost');
  h.controller.dispose();
});

test('a long gesture compresses samples to an IPC-bounded path', async () => {
  const h = harness();
  h.left.emit('mousedown', pointer(180));
  for (let n = 0; n < 500; n++) h.root.emit('mousemove', pointer(200 + n));
  h.root.emit('mouseup', pointer(800));
  await tick();
  assert.equal(h.replayed.length, 1);
  assert.ok(h.replayed[0].points.length <= 192);
  assert.equal(h.replayed[0].points.at(-1).x, 1600);
  h.controller.dispose();
});

test('host pointer leaves the preview and hides the duplicate until returning', () => {
  const h = harness();
  h.root.emit('mousemove', pointer(100));
  assert.ok(h.overlays.at(-1));
  h.root.emit('mousemove', pointer(2400));
  assert.equal(h.overlays.at(-1), null);
  h.controller.dispose();
});
