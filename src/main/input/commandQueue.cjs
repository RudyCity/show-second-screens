'use strict';

// Serialize native cursor commands so a mouse-up cannot overtake a pending
// drag move. Coalesce queued moves when input is faster than the OS helper.
class InputCommandQueue {
  constructor(onError = () => {}) {
    this.onError = onError;
    this.pending = [];
    this.running = false;
    this.closed = false;
  }

  enqueue(kind, execute) {
    if (this.closed) return;
    const last = this.pending[this.pending.length - 1];
    if (kind === 'move' && last && last.kind === 'move') {
      last.execute = execute;
    } else {
      this.pending.push({ kind, execute });
    }
    this.pump();
  }

  pump() {
    if (this.running || this.closed) return;
    const task = this.pending.shift();
    if (!task) return;
    this.running = true;
    let doneCalled = false;
    const done = (error) => {
      if (doneCalled) return;
      doneCalled = true;
      if (error) this.onError(error);
      this.running = false;
      this.pump();
    };
    try {
      task.execute(done);
    } catch (error) {
      done(error);
    }
  }

  close() {
    this.closed = true;
    this.pending.length = 0;
  }
}

module.exports = { InputCommandQueue };
