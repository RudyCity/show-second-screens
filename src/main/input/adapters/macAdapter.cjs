const { exec } = require('child_process');
const { BaseAdapter } = require('./baseAdapter.cjs');

/**
 * macOS Input Adapter using CoreGraphics via AppleScript / cliclick.
 */
class MacAdapter extends BaseAdapter {
  constructor() {
    super();
    this.hasCliclick = null;
    this.checkCliclick();
  }

  checkCliclick() {
    exec('which cliclick', (err) => {
      this.hasCliclick = !err;
    });
  }

  runCommand(cmd) {
    exec(cmd, (err) => {
      if (err) {
        // Silently catch permission or execution errors
      }
    });
  }

  ghostClick(x, y, button = 'left') {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (this.hasCliclick) {
      const btn = button === 'right' ? 'rc' : 'c';
      // cliclick: save position, click, restore
      this.runCommand(`POS=$(cliclick p) ; cliclick ${btn}:${rx},${ry} m:$POS`);
    } else {
      // Fallback via osascript
      const script = `
        tell application "System Events"
          click at {${rx}, ${ry}}
        end tell
      `;
      this.runCommand(`osascript -e '${script.replace(/\n/g, ' ')}'`);
    }
  }

  ghostDoubleClick(x, y) {
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (this.hasCliclick) {
      this.runCommand(`POS=$(cliclick p) ; cliclick dc:${rx},${ry} m:$POS`);
    } else {
      const script = `
        tell application "System Events"
          click at {${rx}, ${ry}}
          click at {${rx}, ${ry}}
        end tell
      `;
      this.runCommand(`osascript -e '${script.replace(/\n/g, ' ')}'`);
    }
  }

  ghostWheel(x, y, delta) {
    if (this.hasCliclick) {
      const direction = delta > 0 ? 'down' : 'up';
      const steps = Math.min(10, Math.max(1, Math.abs(Math.round(delta / 30))));
      this.runCommand(`cliclick kd:ctrl ; cliclick ${direction}:${steps} ; cliclick ku:ctrl`);
    }
  }

  move(x, y) {
    if (this.hasCliclick) {
      this.runCommand(`cliclick m:${Math.round(x)},${Math.round(y)}`);
    }
  }

  click(button = 'left') {
    if (this.hasCliclick) {
      const btn = button === 'right' ? 'rc:.' : 'c:.';
      this.runCommand(`cliclick ${btn}`);
    }
  }
}

module.exports = { MacAdapter };
