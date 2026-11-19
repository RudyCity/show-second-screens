const { exec } = require('child_process');
const { BaseAdapter } = require('./baseAdapter.cjs');
const { InputCommandQueue } = require('../commandQueue.cjs');

/**
 * Linux X11 drag injection via xdotool. Wayland compositors can forbid
 * synthetic input; do not claim drag support without compositor permission.
 */
class LinuxAdapter extends BaseAdapter {
  constructor() {
    super();
    this.tool = null;
    this.ghostOrigin = null;
    this.ghostDragging = false;
    this.queue = new InputCommandQueue((error) => {
      console.warn('[LinuxAdapter] Native input command failed:', error.message);
    });
    this.checkTool();
  }

  checkTool() {
    exec('which xdotool', (error) => {
      if (!error) {
        this.tool = 'xdotool';
      } else {
        exec('which ydotool', (ydotoolError) => {
          if (!ydotoolError) this.tool = 'ydotool';
        });
      }
    });
  }

  command(cmd, kind = 'action') {
    this.queue.enqueue(kind, (done) => exec(cmd, (error) => done(error)));
  }

  buttonNumber(button) {
    return button === 'right' ? 3 : button === 'middle' ? 2 : 1;
  }

  ghostClick(x, y, button = 'left') {
    const rx = Math.round(x), ry = Math.round(y);
    const num = this.buttonNumber(button);
    if (this.tool === 'xdotool') {
      this.command(`eval "$(xdotool getmouselocation --shell)"; xdotool mousemove ${rx} ${ry} click ${num} mousemove "$X" "$Y"`);
    } else if (this.tool === 'ydotool') {
      this.command(`ydotool mousemove --absolute ${rx} ${ry}; ydotool click 0xC${num}`);
    }
  }

  ghostDoubleClick(x, y) {
    if (this.tool !== 'xdotool') return;
    this.command(`eval "$(xdotool getmouselocation --shell)"; xdotool mousemove ${Math.round(x)} ${Math.round(y)} click --repeat 2 --delay 80 1 mousemove "$X" "$Y"`);
  }

  ghostWheel(x, y, delta) {
    if (this.tool !== 'xdotool') return;
    const button = delta > 0 ? 5 : 4;
    this.command(`eval "$(xdotool getmouselocation --shell)"; xdotool mousemove ${Math.round(x)} ${Math.round(y)} click ${button} mousemove "$X" "$Y"`);
  }

  ghostDown(x, y, button = 'left') {
    if (this.tool !== 'xdotool') return;
    const rx = Math.round(x), ry = Math.round(y);
    const btn = this.buttonNumber(button);
    this.queue.enqueue('down', (done) => {
      exec('xdotool getmouselocation --shell', (error, stdout) => {
        if (error) return done(error);
        const mx = String(stdout).match(/^X=(-?\d+)$/m);
        const my = String(stdout).match(/^Y=(-?\d+)$/m);
        this.ghostOrigin = mx && my ? { x: Number(mx[1]), y: Number(my[1]) } : null;
        exec(`xdotool mousemove ${rx} ${ry} mousedown ${btn}`, (downError) => {
          this.ghostDragging = !downError;
          done(downError);
        });
      });
    });
  }

  ghostDrag(x, y) {
    if (this.tool !== 'xdotool') return;
    const rx = Math.round(x), ry = Math.round(y);
    this.queue.enqueue('move', (done) => {
      if (!this.ghostDragging) return done();
      exec(`xdotool mousemove ${rx} ${ry}`, (error) => done(error));
    });
  }

  ghostUp(x, y, button = 'left') {
    if (this.tool !== 'xdotool') return;
    const rx = Math.round(x), ry = Math.round(y);
    const btn = this.buttonNumber(button);
    this.queue.enqueue('up', (done) => {
      if (!this.ghostDragging) return done();
      const origin = this.ghostOrigin;
      let cmd = `xdotool mousemove ${rx} ${ry} mouseup ${btn}`;
      if (origin) cmd += ` mousemove ${origin.x} ${origin.y}`;
      exec(cmd, (error) => {
        this.ghostDragging = false;
        this.ghostOrigin = null;
        done(error);
      });
    });
  }

  move(x, y) {
    if (this.tool === 'xdotool') this.command(`xdotool mousemove ${Math.round(x)} ${Math.round(y)}`, 'move');
  }

  mouseDown(button = 'left') {
    if (this.tool === 'xdotool') this.command(`xdotool mousedown ${this.buttonNumber(button)}`);
  }

  mouseUp(button = 'left') {
    if (this.tool === 'xdotool') this.command(`xdotool mouseup ${this.buttonNumber(button)}`);
  }

  click(button = 'left') {
    if (this.tool === 'xdotool') this.command(`xdotool click ${this.buttonNumber(button)}`);
  }

  wheel(delta) {
    if (this.tool === 'xdotool') this.command(`xdotool click ${delta > 0 ? 5 : 4}`);
  }
}

module.exports = { LinuxAdapter };
