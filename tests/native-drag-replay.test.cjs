const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const commands = [];
  class FakeChild extends EventEmitter {
    constructor() {
      super();
      this.stdout = new EventEmitter();
      this.stdin = {
        writable: true,
        write: (command) => { commands.push(command.trim()); return true; }
      };
    }
    kill() { this.emit('exit', 0); }
  }
  const child = new FakeChild();
  const source = fs.readFileSync(path.join(__dirname, '../src/main/input/adapters/windowsAdapter.cjs'), 'utf8');
  const module = { exports: {} };
  const requireFake = (name) => {
    if (name === 'child_process') return { spawn: () => child };
    if (name === 'fs') return { existsSync: () => true };
    if (name === 'path') return path;
    if (name === './baseAdapter.cjs') return { BaseAdapter: class {} };
    throw new Error('Unexpected import: ' + name);
  };
  vm.runInNewContext(source, {
    module, require: requireFake, process,
    __dirname: path.join(__dirname, '../src/main/input/adapters'),
    Buffer, console, Promise, setTimeout, clearTimeout
  });
  const adapter = new module.exports.WindowsAdapter();
  return { adapter, commands, child };
}

test('recorded native drag is sent as one serialized command and acknowledged', async () => {
  const h = harness();
  const path = [{ x: -400, y: 120 }, { x: 180, y: 500 }, { x: 1200, y: 900 }];
  const pending = h.adapter.replayNativeDrag(path, true, false);
  assert.equal(h.commands.length, 1);
  const pieces = h.commands[0].split(' ');
  assert.equal(pieces[0], 'replaydrag');
  assert.equal(Buffer.from(pieces[2], 'base64').toString('utf8'), '-400,120;180,500;1200,900');
  assert.deepEqual(pieces.slice(3), ['1', '0']);
  assert.equal((await h.adapter.replayNativeDrag(path)).ok, false, 'parallel replay rejected');
  h.child.stdout.emit('data', Buffer.from('REPLAY_RESULT ' + pieces[1] + ' ok\n'));
  const outcome = await pending;
  assert.equal(outcome.ok, true);
  assert.match(outcome.message, /Confirm the result/);
  h.adapter.dispose();
});

test('native helper error acknowledgment returns failure, not success', async () => {
  const h = harness();
  const pending = h.adapter.replayNativeDrag([{ x: 5, y: 10 }, { x: 120, y: 300 }]);
  const id = h.commands[0].split(' ')[1];
  h.child.stdout.emit('data', Buffer.from('REPLAY_RESULT ' + id + ' failed\n'));
  const result = await pending;
  assert.equal(result.ok, false);
  h.adapter.dispose();
});

test('injector process exit rejects an outstanding drag promptly', async () => {
  const h = harness();
  const pending = h.adapter.replayNativeDrag([{ x: 10, y: 10 }, { x: 90, y: 90 }]);
  h.child.emit('exit', 1);
  const result = await pending;
  assert.equal(result.ok, false);
  h.adapter.dispose();
});

test('Windows build includes native drag replay and restores the OS pointer', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.match(pkg.scripts['build:injector'], /nativeDragReplay\.cs/);
  const nativeSource = fs.readFileSync(path.join(__dirname, '../src/main/input/nativeDragReplay.cs'), 'utf8');
  assert.match(nativeSource, /MOUSEEVENTF_ABSOLUTE \| MOUSEEVENTF_VIRTUALDESK/);
  assert.match(nativeSource, /MOUSEEVENTF_LEFTDOWN/);
  assert.match(nativeSource, /MOUSEEVENTF_LEFTUP/);
  assert.match(nativeSource, /finally[\s\S]*MoveTo\(origin/);
  assert.match(nativeSource, /GetSystemMetrics\(SM_XVIRTUALSCREEN\)/);
});
