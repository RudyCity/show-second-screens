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
    this.replayId = 0;
    this.pendingReplay = new Map();
    this.outputBuffer = '';
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
        stdio: ['pipe', 'pipe', 'ignore'],
        windowsHide: true,
      });

      const child = this.process;
      child.stdout.on('data', (chunk) => this.onOutput(chunk));
      child.on('error', (err) => {
        console.error('[WindowsAdapter] Failed to start injector process:', err);
        if (this.process === child) this.process = null;
        this.failPendingReplay('Native injector exited before completing the drag.');
      });

      child.on('exit', () => {
        if (this.process === child) this.process = null;
        this.failPendingReplay('Native injector closed during drag replay.');
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
      try {
        this.process.stdin.write(`${command}\n`);
        return true;
      } catch (error) {
        console.error('[WindowsAdapter] Cannot write injector command:', error);
      }
    }
    return false;
  }

  onOutput(chunk) {
    this.outputBuffer += String(chunk);
    if (this.outputBuffer.length > 32768) this.outputBuffer = '';
    let separator = this.outputBuffer.indexOf('\n');
    while (separator >= 0) {
      const line = this.outputBuffer.slice(0, separator).trim();
      this.outputBuffer = this.outputBuffer.slice(separator + 1);
      const match = /^REPLAY_RESULT ([0-9]+) (ok|failed)$/.exec(line);
      if (match) {
        const pending = this.pendingReplay.get(match[1]);
        if (pending) {
          this.pendingReplay.delete(match[1]);
          clearTimeout(pending.timer);
          pending.resolve(match[2] === 'ok'
            ? { ok: true, message: 'Native drag input replay completed. Confirm the result in the target application.' }
            : { ok: false, message: 'Windows could not inject the native drag. Check desktop permissions and target application.' });
        }
      }
      separator = this.outputBuffer.indexOf('\n');
    }
  }

  failPendingReplay(message) {
    for (const pending of this.pendingReplay.values()) {
      clearTimeout(pending.timer);
      pending.resolve({ ok: false, message });
    }
    this.pendingReplay.clear();
  }

  replayNativeDrag(points, ctrl = false, shift = false) {
    if (!Array.isArray(points) || points.length < 2 || points.length > 192
      || !points.every(p => p && Number.isSafeInteger(p.x) && Number.isSafeInteger(p.y))) {
      return Promise.resolve({ ok: false, message: 'Invalid recorded drag coordinates.' });
    }
    if (this.pendingReplay.size) {
      return Promise.resolve({ ok: false, message: 'Another native drag is still running.' });
    }
    const payload = Buffer.from(points.map(p => p.x + ',' + p.y).join(';'), 'utf8').toString('base64');
    const id = String(++this.replayId);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingReplay.delete(id);
        resolve({ ok: false, message: 'Native drag replay timed out. Check the target window.' });
      }, 12000);
      if (typeof timer.unref === 'function') timer.unref();
      this.pendingReplay.set(id, { resolve, timer });
      if (!this.send('replaydrag ' + id + ' ' + payload + ' ' + (ctrl ? '1' : '0') + ' ' + (shift ? '1' : '0'))) {
        clearTimeout(timer);
        this.pendingReplay.delete(id);
        resolve({ ok: false, message: 'Native Windows injector is unavailable.' });
      }
    });
  }

  ghostClick(x, y, button = 'left', origX = null, origY = null) {
    const origStr = origX != null && origY != null ? ` ${Math.round(origX)} ${Math.round(origY)}` : '';
    this.send(`ghostclick ${Math.round(x)} ${Math.round(y)} ${button}${origStr}`);
  }

  ghostDoubleClick(x, y, origX = null, origY = null) {
    const origStr = origX != null && origY != null ? ` ${Math.round(origX)} ${Math.round(origY)}` : '';
    this.send(`ghostdblclick ${Math.round(x)} ${Math.round(y)}${origStr}`);
  }

  ghostWheel(x, y, delta, origX = null, origY = null) {
    const origStr = origX != null && origY != null ? ` ${Math.round(origX)} ${Math.round(origY)}` : '';
    this.send(`ghostwheel ${Math.round(x)} ${Math.round(y)} ${Math.round(delta)}${origStr}`);
  }

  ghostDown(x, y, button = 'left', origX = null, origY = null) {
    const origStr = origX != null && origY != null ? ` ${Math.round(origX)} ${Math.round(origY)}` : '';
    this.send(`ghostdown ${Math.round(x)} ${Math.round(y)} ${button}${origStr}`);
  }

  ghostUp(x, y, button = 'left', origX = null, origY = null) {
    const origStr = origX != null && origY != null ? ` ${Math.round(origX)} ${Math.round(origY)}` : '';
    this.send(`ghostup ${Math.round(x)} ${Math.round(y)} ${button}${origStr}`);
  }

  ghostDrag(x, y) {
    this.send(`ghostdrag ${Math.round(x)} ${Math.round(y)}`);
  }

  // A virtual drag doesn't warp the physical mouse pointer. Windows titlebars
  // move using SetWindowPos, and Explorer file transfers require confirmation.
  virtualDragStart(x, y) {
    return this.send(`virtualdragstart ${Math.round(x)} ${Math.round(y)}`);
  }

  virtualDragMove(x, y) {
    return this.send(`virtualdragmove ${Math.round(x)} ${Math.round(y)}`);
  }

  virtualDragEnd(x, y, ctrl = false, shift = false) {
    return this.send(`virtualdragend ${Math.round(x)} ${Math.round(y)} ${ctrl ? 1 : 0} ${shift ? 1 : 0}`);
  }

  virtualDragCancel() {
    return this.send('virtualdragcancel');
  }

  dropFiles(paths, x, y, ctrl = false, shift = false) {
    if (!Array.isArray(paths) || !paths.length || paths.length > 100) return false;
    const payload = Buffer.from(paths.join('\n'), 'utf8').toString('base64');
    return this.send(`virtualfiledrop ${Math.round(x)} ${Math.round(y)} ${payload} ${ctrl ? 1 : 0} ${shift ? 1 : 0}`);
  }

  // Phantom Mode: events delivered via PostMessage to the window under the
  // target point — the OS cursor never moves at all (no flicker, no warp).
  phantomClick(x, y, button = 'left') {
    this.send(`msgclick ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  phantomDoubleClick(x, y) {
    this.send(`msgdblclick ${Math.round(x)} ${Math.round(y)}`);
  }

  phantomWheel(x, y, delta) {
    this.send(`msgwheel ${Math.round(x)} ${Math.round(y)} ${Math.round(delta)}`);
  }

  phantomDown(x, y, button = 'left') {
    this.send(`msgdown ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  phantomUp(x, y, button = 'left') {
    this.send(`msgup ${Math.round(x)} ${Math.round(y)} ${button}`);
  }

  phantomMove(x, y, button = null) {
    this.send(`msgmove ${Math.round(x)} ${Math.round(y)}${button ? ` ${button}` : ''}`);
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
    this.failPendingReplay('App closed during native drag replay.');
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
