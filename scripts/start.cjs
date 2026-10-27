const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const appPath = path.resolve(__dirname, '..');

console.log('🚀 Starting Show Second Screens...');

// Launch Electron with filtered stderr stream to block WebRTC internal noise
const child = spawn(electron, [appPath], {
  stdio: ['inherit', 'inherit', 'pipe'],
});

child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  // Filter out repeated benign WebRTC cursor and desktop thread warnings
  if (
    text.includes('mouse_cursor_monitor_win.cc') ||
    text.includes('desktop.cc(66)') ||
    text.includes('SetThreadDesktop')
  ) {
    return;
  }
  process.stderr.write(text);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
