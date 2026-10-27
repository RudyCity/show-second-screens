const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Service to manage native Windows mouse and keyboard input injection
 * via a lightweight C# daemon process.
 */
class InputService {
  constructor() {
    this.process = null;
    this.injectorPath = path.resolve(__dirname, '../../../bin/injector.exe');
    this.init();
  }

  init() {
    if (!fs.existsSync(this.injectorPath)) {
      console.warn(`[InputService] Injector binary not found at ${this.injectorPath}. Input simulation disabled until compiled.`);
      return;
    }

    try {
      this.process = spawn(this.injectorPath, [], {
        stdio: ['pipe', 'ignore', 'ignore'],
        windowsHide: true,
      });

      this.process.on('error', (err) => {
        console.error('[InputService] Failed to start injector process:', err);
        this.process = null;
      });

      this.process.on('exit', () => {
        this.process = null;
      });
    } catch (err) {
      console.error('[InputService] Exception starting injector:', err);
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
        // ignore on shutdown
      }
      this.process = null;
    }
  }
}

module.exports = { InputService };
