const { exec } = require('child_process');
const { BaseAdapter } = require('./baseAdapter.cjs');
const { InputCommandQueue } = require('../commandQueue.cjs');

/**
 * macOS input through cliclick. Drag gestures require the optional cliclick
 * executable and macOS Accessibility permission for input injection.
 */
class MacAdapter extends BaseAdapter {
  constructor() {
    super();
    this.hasCliclick = false;
    this.ghostOrigin = null;
    this.ghostDragging = false;
    this.directDragging = false;
    this.queue = new InputCommandQueue((error) => {
      console.warn('[MacAdapter] Native input command failed:', error.message);
    });
    exec('which cliclick', (error) => { this.hasCliclick = !error; });
  }

  command(cmd, kind = 'action') {
    this.queue.enqueue(kind, (done) => exec(cmd, (error) => done(error)));
  }

  ghostClick(x, y, button = 'left') {
    const point = `${Math.round(x)},${Math.round(y)}`;
    if (this.hasCliclick) {
      const action = button === 'right' ? 'rc' : 'c';
      this.command(`POS=$(cliclick p); cliclick ${action}:${point} m:$POS`);
    } else if (button === 'left') {
      this.command(`osascript -e 'tell application "System Events" to click at {${Math.round(x)}, ${Math.round(y)}}'`);
    }
  }

  ghostDoubleClick(x, y) {
    if (!this.hasCliclick) return;
    this.command(`POS=$(cliclick p); cliclick dc:${Math.round(x)},${Math.round(y)} m:$POS`);
  }

  ghostWheel(x, y, delta) {
    if (!this.hasCliclick) return;
    const direction = delta > 0 ? 'down' : 'up';
    const steps = Math.min(10, Math.max(1, Math.abs(Math.round(delta / 30))));
    this.command(`POS=$(cliclick p); cliclick m:${Math.round(x)},${Math.round(y)} ${direction}:${steps} m:$POS`);
  }

  ghostDown(x, y, button = 'left') {
    if (!this.hasCliclick || button !== 'left') return;
    const target = `${Math.round(x)},${Math.round(y)}`;
    this.queue.enqueue('down', (done) => {
      exec('cliclick p', (error, stdout) => {
        if (error) return done(error);
        const match = String(stdout).trim().match(/^(-?\d+),(-?\d+)$/);
        this.ghostOrigin = match ? `${match[1]},${match[2]}` : null;
        exec(`cliclick dd:${target}`, (downError) => {
          this.ghostDragging = !downError;
          done(downError);
        });
      });
    });
  }

  ghostDrag(x, y) {
    if (!this.hasCliclick) return;
    const point = `${Math.round(x)},${Math.round(y)}`;
    this.queue.enqueue('move', (done) => {
      if (!this.ghostDragging) return done();
      exec(`cliclick dm:${point}`, (error) => done(error));
    });
  }

  ghostUp(x, y) {
    if (!this.hasCliclick) return;
    const point = `${Math.round(x)},${Math.round(y)}`;
    this.queue.enqueue('up', (done) => {
      if (!this.ghostDragging) return done();
      const origin = this.ghostOrigin;
      exec(`cliclick du:${point}`, (error) => {
        this.ghostDragging = false;
        this.ghostOrigin = null;
        if (!origin) return done(error);
        exec(`cliclick m:${origin}`, (restoreError) => done(error || restoreError));
      });
    });
  }

  move(x, y) {
    if (!this.hasCliclick) return;
    const point = `${Math.round(x)},${Math.round(y)}`;
    this.queue.enqueue('move', (done) => {
      const action = this.directDragging ? 'dm' : 'm';
      exec(`cliclick ${action}:${point}`, (error) => done(error));
    });
  }

  mouseDown(button = 'left') {
    if (!this.hasCliclick || button !== 'left') return;
    this.queue.enqueue('down', (done) => {
      exec('cliclick dd:.', (error) => {
        this.directDragging = !error;
        done(error);
      });
    });
  }

  mouseUp(button = 'left') {
    if (!this.hasCliclick || button !== 'left') return;
    this.queue.enqueue('up', (done) => {
      if (!this.directDragging) return done();
      exec('cliclick du:.', (error) => {
        this.directDragging = false;
        done(error);
      });
    });
  }

  click(button = 'left') {
    if (!this.hasCliclick) return;
    this.command(`cliclick ${button === 'right' ? 'rc' : 'c'}:.`);
  }
}

module.exports = { MacAdapter };
