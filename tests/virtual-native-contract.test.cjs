const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Windows native virtual drag implementation does not warp the physical pointer', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/main/input/virtualDrag.cs'), 'utf8');
  assert.match(source, /SetWindowPos/);
  assert.match(source, /HTCAPTION/);
  assert.match(source, /TryGetExplorer/);
  assert.match(source, /Confirm file transfer/);
  assert.doesNotMatch(source, /\bSetCursorPos\s*\(/);
  assert.doesNotMatch(source, /\bSendInput\s*\(/);
  assert.match(source, /File\.Copy\(src, dst, false\)/);
  assert.match(source, /MB_YESNO \| MB_ICONQUESTION/);
});

test('the Windows build includes both native helper source files', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  assert.match(pkg.scripts['build:injector'], /injector\.cs.*virtualDrag\.cs/);
});

test('no direct-mode click or drag IPC route is exposed by the desktop UI', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  const ipc = fs.readFileSync(path.join(__dirname, '../src/main/ipc/ipcHandlers.cjs'), 'utf8');
  assert.doesNotMatch(html, /btnMode|Move Cursor|Stay Here/);
  assert.match(ipc, /if \(mode !== 'ghost'\) return/);
});
