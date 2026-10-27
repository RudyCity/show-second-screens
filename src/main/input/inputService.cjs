const { WindowsAdapter } = require('./adapters/windowsAdapter.cjs');
const { MacAdapter } = require('./adapters/macAdapter.cjs');
const { LinuxAdapter } = require('./adapters/linuxAdapter.cjs');
const { BaseAdapter } = require('./adapters/baseAdapter.cjs');

/**
 * Cross-platform Input Service managing OS-level input simulation
 * across Windows, macOS, and Linux.
 */
class InputService {
  constructor() {
    this.adapter = this.createAdapter();
  }

  createAdapter() {
    switch (process.platform) {
      case 'win32':
        return new WindowsAdapter();
      case 'darwin':
        return new MacAdapter();
      case 'linux':
        return new LinuxAdapter();
      default:
        console.warn(`[InputService] Unsupported platform '${process.platform}', falling back to BaseAdapter.`);
        return new BaseAdapter();
    }
  }

  ghostClick(x, y, button = 'left') {
    this.adapter.ghostClick(x, y, button);
  }

  ghostDoubleClick(x, y) {
    this.adapter.ghostDoubleClick(x, y);
  }

  ghostWheel(x, y, delta) {
    this.adapter.ghostWheel(x, y, delta);
  }

  ghostDown(x, y, button = 'left') {
    this.adapter.ghostDown(x, y, button);
  }

  ghostUp(x, y, button = 'left') {
    this.adapter.ghostUp(x, y, button);
  }

  ghostDrag(x, y) {
    this.adapter.ghostDrag(x, y);
  }

  move(x, y) {
    this.adapter.move(x, y);
  }

  mouseDown(button = 'left') {
    this.adapter.mouseDown(button);
  }

  mouseUp(button = 'left') {
    this.adapter.mouseUp(button);
  }

  click(button = 'left') {
    this.adapter.click(button);
  }

  doubleClick() {
    this.adapter.doubleClick();
  }

  wheel(delta) {
    this.adapter.wheel(delta);
  }

  dispose() {
    if (this.adapter && typeof this.adapter.dispose === 'function') {
      this.adapter.dispose();
    }
  }
}

module.exports = { InputService };
