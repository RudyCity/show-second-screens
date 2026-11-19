const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('all app-facing controls, dialogs, and startup logs use English', () => {
  const files = [
    'src/main/window/windowManager.cjs',
    'src/main/instance/singleInstanceManager.cjs',
    'src/main/tray/trayManager.cjs',
    'src/renderer/index.html',
    'src/renderer/renderer.js'
  ];
  const disallowed = [
    'Tetap di Sini', 'Pindah Layar', 'Tutup Jendela', 'Keluar Sepenuhnya',
    'Batal', 'Dukung pengembang', 'Buka di Browser Luar',
    'Instance kedua terdeteksi', 'Menghentikan proses',
    'Bagaimana Anda ingin', 'Aplikasi Show Second Screens sudah'
  ];
  for (const file of files) {
    const content = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    for (const phrase of disallowed) {
      assert.equal(content.includes(phrase), false, file + ' still contains: ' + phrase);
    }
  }
});

test('renderer exposes an English Identify Displays control', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
  assert.match(html, /id="btnIdentify"/);
  assert.match(html, /aria-label="Identify connected displays"/);
  assert.doesNotMatch(html, /id="btnMode"/);
  assert.doesNotMatch(html, /Stay Here|Move Cursor|Tetap di Sini|Pindah Layar/);
});
