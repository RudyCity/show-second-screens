const { exec } = require('child_process');
const { BaseAdapter } = require('./baseAdapter.cjs');

/**
 * Linux Input Adapter using xdotool / ydotool (X11 and Wayland).
 */
class LinuxAdapter extends BaseAdapter {
  constructor() {
    super();
    this.tool = 'xdotool';
    this.checkTool();
  }

  checkTool() {
    exec('which xdotool', (err) => {
      if (!err) {
        this.tool = 'xdotool';
      } else {
        exec('which ydotool', (err2) => {
          if (!err2) this.tool = 'ydotool';
        });
      }
    });
  }

  run(cmd) {
    exec(cmd, () => {});
  }

  ghostClick(x, y, button = 'left') {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const btnNum = button === 'right' ? 3 : button === 'middle' ? 2 : 1;

    if (this.tool === 'xdotool') {
      // Save pos -> move & click -> restore pos
      this.run(`eval $(xdotool getmouselocation --shell) ; xdotool mousemove ${rx} ${ry} click ${btnNum} mousemove $X $Y`);
    } else {
      this.run(`ydotool mousemove ${rx} ${ry} ; ydotool click 0xC${btnNum}`);
    }
  }

  ghostDoubleClick(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (this.tool === 'xdotool') {
      this.run(`eval $(xdotool getmouselocation --shell) ; xdotool mousemove ${rx} ${ry} click --repeat 2 1 mousemove $X $Y`);
    }
  }

  ghostWheel(x, y, delta) {
    const btnNum = delta > 0 ? 5 : 4; // 4 = scroll up, 5 = scroll down in X11
    if (this.tool === 'xdotool') {
      const rx = Math.round(x);
      const ry = Math.round(y);
      this.run(`eval $(xdotool getmouselocation --shell) ; xdotool mousemove ${rx} ${ry} click ${btnNum} mousemove $X $Y`);
    }
  }

  move(x, y) {
    if (this.tool === 'xdotool') {
      this.run(`xdotool mousemove ${Math.round(x)} ${Math.round(y)}`);
    }
  }

  click(button = 'left') {
    const btnNum = button === 'right' ? 3 : 1;
    if (this.tool === 'xdotool') {
      this.run(`xdotool click ${btnNum}`);
    }
  }
}

module.exports = { LinuxAdapter };
