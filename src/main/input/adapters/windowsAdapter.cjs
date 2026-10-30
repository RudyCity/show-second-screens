const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { BaseAdapter } = require('./baseAdapter.cjs');

/**
 * Windows Input Adapter using high-speed native C# Win32 SendInput daemon.
 */
class WindowsAdapter extends BaseAdapter {
  constructor() {
    super();
    this.process = null;
    this.injectorPath = this.resolveInjectorPath();
    this.init();
  }

  resolveInjectorPath() {
    const candidates = [];
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'bin', 'injector.exe'));
      candidates.push(path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'injector.exe'));
    }
    candidates.push(path.resolve(__dirname, '../../../../bin/injector.exe'));
    candidates.push(path.resolve(process.cwd(), 'bin/injector.exe'));

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return candidates[0] || path.resolve(__dirname, '../../../../bin/injector.exe');
  }

  init() {
    if (!fs.existsSync(this.injectorPath)) {
      console.warn(`[WindowsAdapter] Injector binary not found at ${this.injectorPath}. Run 'npm run build:injector' to compile.`);
      return;
    }

    try {
      this.process = spawn(this.injectorPath, [], {
        stdio: ['pipe', 'ignore', 'ignore'],
        windowsHide: true,
      });

      this.process.on('error', (err) => {
        console.error('[WindowsAdapter] Failed to start injector process:', err);
        this.process = null;
      });

      this.process.on('exit', () => {
        this.process = null;
      });
    } catch (err) {
      console.error('[WindowsAdapter] Exception starting injector:', err);
      this.process = null;
    }
  }

  send(command) {
    if (!this.process || !this.process.stdin.writable) {
      this.init();
    }
    if (this.process && this.process.stdin.writable) {
      this.process.stdin.write(`${command}\n`);
    }
  }

  ghostClick(x, y, button = 'left') {
    this.send(`ghostclick ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  ghostDoubleClick(x, y) {
    this.send(`ghostdblclick ${Math.round(x)} ${Math.round(y)}`);
  }

  ghostWheel(x, y, delta) {
    this.send(`ghostwheel ${Math.round(x)} ${Math.round(y)} ${Math.round(delta)}`);
  }

  ghostDown(x, y, button = 'left') {
    this.send(`ghostdown ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  ghostUp(x, y, button = 'left') {
    this.send(`ghostup ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  ghostDrag(x, y) {
    this.send(`ghostdrag ${Math.round(x)} ${Math.round(y)}`);
  }

  move(x, y) {
    this.send(`move ${Math.round(x)} ${Math.round(y)}`);
  }

  mouseDown(button = 'left') {
    this.send(`mousedown ${button}`);
  }

  mouseUp(button = 'left') {
    this.send(`mouseup ${button}`);
  }

  click(button = 'left') {
    this.send(`click ${button}`);
  }

  doubleClick() {
    this.send('dblclick');
  }

  wheel(delta) {
    this.send(`wheel ${Math.round(delta)}`);
  }

  dispose() {
    if (this.process) {
      try {
        this.process.stdin.write('exit\n');
        this.process.kill();
      } catch {
        // ignore on exit
      }
      this.process = null;
    }
  }
}

module.exports = { WindowsAdapter };
