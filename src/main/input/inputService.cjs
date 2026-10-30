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

  ghostClick(x, y, button = 'left', origX = null, origY = null) {
    this.adapter.ghostClick(x, y, button, origX, origY);
  }

  ghostDoubleClick(x, y, origX = null, origY = null) {
    this.adapter.ghostDoubleClick(x, y, origX, origY);
  }

  ghostWheel(x, y, delta, origX = null, origY = null) {
    this.adapter.ghostWheel(x, y, delta, origX, origY);
  }

  ghostDown(x, y, button = 'left', origX = null, origY = null) {
    this.adapter.ghostDown(x, y, button, origX, origY);
  }

  ghostUp(x, y, button = 'left', origX = null, origY = null) {
    this.adapter.ghostUp(x, y, button, origX, origY);
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
