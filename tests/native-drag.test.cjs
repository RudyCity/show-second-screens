const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { InputCommandQueue } = require('../src/main/input/commandQueue.cjs');

test('the native command queue prevents mouse-up overtaking drag and coalesces moves', () => {
  const dispatched = [];
  let releaseDown;
  const queue = new InputCommandQueue();
  queue.enqueue('down', (done) => { dispatched.push('down'); releaseDown = done; });
  queue.enqueue('move', (done) => { dispatched.push('obsolete'); done(); });
  queue.enqueue('move', (done) => { dispatched.push('latest'); done(); });
  queue.enqueue('up', (done) => { dispatched.push('up'); done(); });
  assert.deepEqual(dispatched, ['down']);
  releaseDown();
  assert.deepEqual(dispatched, ['down', 'latest', 'up']);
  assert.equal(queue.running, false);
});

function mockAdapter(filename, exportName, positionCommand, positionOutput) {
  const calls = [];
  const exec = (command, callback) => {
    calls.push(command);
    queueMicrotask(() => callback(null, command === positionCommand ? positionOutput : ''));
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../src/main/input/adapters', filename), 'utf8');
  const requireMock = (name) => {
    if (name === 'child_process') return { exec };
    if (name === './baseAdapter.cjs') return { BaseAdapter: class {} };
    if (name === '../commandQueue.cjs') return { InputCommandQueue };
    throw new Error('Unexpected module: ' + name);
  };
  vm.runInNewContext(source, { module, require: requireMock, console });
  return { instance: new module.exports[exportName](), calls };
}

test('macOS cliclick drag serializes down, coalesced movement, up and cursor restoration', async () => {
  const { instance, calls } = mockAdapter('macAdapter.cjs', 'MacAdapter', 'cliclick p', '12,34');
  await new Promise((resolve) => setImmediate(resolve));
  instance.ghostDown(100, 200);
  instance.ghostDrag(120, 220);
  instance.ghostDrag(400, 500);
  instance.ghostUp(400, 500);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    'which cliclick', 'cliclick p', 'cliclick dd:100,200',
    'cliclick dm:400,500', 'cliclick du:400,500', 'cliclick m:12,34'
  ]);
  assert.equal(instance.ghostDragging, false);
});

test('Linux X11 drag serializes OS button hold, move, drop and physical cursor restore', async () => {
  const { instance, calls } = mockAdapter(
    'linuxAdapter.cjs', 'LinuxAdapter', 'xdotool getmouselocation --shell', 'X=-30\nY=42\n'
  );
  await new Promise((resolve) => setImmediate(resolve));
  instance.ghostDown(100, 200, 'left');
  instance.ghostDrag(110, 210);
  instance.ghostDrag(500, 600);
  instance.ghostUp(500, 600, 'left');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    'which xdotool', 'xdotool getmouselocation --shell',
    'xdotool mousemove 100 200 mousedown 1',
    'xdotool mousemove 500 600',
    'xdotool mousemove 500 600 mouseup 1 mousemove -30 42'
  ]);
  assert.equal(instance.ghostDragging, false);
});
