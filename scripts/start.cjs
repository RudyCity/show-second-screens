const { spawn } = require('child_process');
const electron = require('electron');
const path = require('path');

const appPath = path.resolve(__dirname, '..');

// Launch Electron with ignored stderr to completely silence Chromium WebRTC C++ noise
const child = spawn(electron, [appPath], {
  stdio: ['inherit', 'inherit', 'ignore'],
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
