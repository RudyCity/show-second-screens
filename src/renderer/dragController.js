(function (root) {
  'use strict';

  // One ghost-pointer gesture spans all preview tiles. On Windows, a visual
  // duplicate cursor follows the gesture; native replay starts only on release.
  class DragController {
    constructor(options) {
      this.sendInput = options.sendInput;
      this.getMode = () => 'ghost';
      this.onCoordinates = options.onCoordinates || (() => {});
      this.onDragState = options.onDragState || (() => {});
      this.onPointer = options.onPointer || (() => {});
      this.replayDrag = typeof options.replayDrag === 'function' ? options.replayDrag : null;
      this.onReplayResult = options.onReplayResult || (() => {});
      this.onReplayStart = options.onReplayStart || (() => {});
      this.mapPoint = options.mapPoint || root.GridMath.mapPreviewPoint;
      this.surfaces = new Map();
      this.session = null;
      this.pendingDrag = null;
      this.dragScheduled = false;
      this.hoverTimer = null;
      this.lastHover = null;
      this.releaseTimer = null;
      this.disposed = false;

      this.onMove = (event) => this.move(event);
      this.onUp = (event) => this.finish(event, false);
      this.onPointerDown = (event) => {
        if (!event.target || !this.surfaces.has(event.target)) return;
        if (typeof event.target.setPointerCapture === 'function' && event.pointerId !== undefined) {
          try { event.target.setPointerCapture(event.pointerId); } catch (_) { /* Unsupported capture. */ }
        }
      };
      this.onPointerCancel = () => this.cancel();
      this.onBlur = () => {
        this.cancel();
        this.onPointer(null);
      };
      this.onKey = (event) => {
        if (event.key === 'Escape' && this.session) {
          event.preventDefault();
          this.cancel();
        }
      };
      this.onVisibility = () => {
        if (typeof document !== 'undefined' && document.hidden) this.cancel();
      };
      root.addEventListener('mousemove', this.onMove, true);
      root.addEventListener('mouseup', this.onUp, true);
      root.addEventListener('pointerdown', this.onPointerDown, true);
      root.addEventListener('pointercancel', this.onPointerCancel, true);
      root.addEventListener('blur', this.onBlur);
      root.addEventListener('keydown', this.onKey, true);
      root.addEventListener('beforeunload', this.onBlur);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.onVisibility);
      }
    }

    locate(event, onlyVideo = null) {
      if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return null;
      for (const [video, display] of this.surfaces) {
        if (onlyVideo && video !== onlyVideo) continue;
        const bounds = video.getBoundingClientRect();
        const pos = this.mapPoint(display, {
          width: video.videoWidth, height: video.videoHeight
        }, bounds, { x: event.clientX, y: event.clientY });
        if (pos) return { video, pos };
      }
      return null;
    }

    send(type, point, event, mode, extra = {}) {
      if (!point) return;
      this.sendInput(Object.assign({
        type,
        x: point.pos.targetX, y: point.pos.targetY,
        origX: event && Number.isFinite(event.screenX) ? event.screenX : 0,
        origY: event && Number.isFinite(event.screenY) ? event.screenY : 0,
        mode
      }, extra));
    }

    addSurface(video, display) {
      if (this.disposed) throw new Error('DragController is disposed');
      this.surfaces.set(video, display);
      const onDown = (event) => this.start(video, event);
      const onWheel = (event) => {
        const point = this.locate(event, video);
        if (!point) return;
        event.preventDefault();
        this.send('wheel', point, event, this.getMode(), { deltaY: event.deltaY });
      };
      const onDouble = (event) => {
        const point = this.locate(event, video);
        if (!point) return;
        event.preventDefault();
        this.send('dblclick', point, event, this.getMode());
      };
      const preventNative = (event) => event.preventDefault();
      video.addEventListener('mousedown', onDown);
      video.addEventListener('dblclick', onDouble);
      video.addEventListener('wheel', onWheel, { passive: false });
      video.addEventListener('contextmenu', preventNative);
      video.addEventListener('dragstart', preventNative);
      return () => {
        if (this.session && (this.session.source === video || this.session.last.video === video)) {
          this.cancel();
        }
        this.surfaces.delete(video);
        video.removeEventListener('mousedown', onDown);
        video.removeEventListener('dblclick', onDouble);
        video.removeEventListener('wheel', onWheel);
        video.removeEventListener('contextmenu', preventNative);
        video.removeEventListener('dragstart', preventNative);
      };
    }

    armWatchdog() {
      clearTimeout(this.releaseTimer);
      this.releaseTimer = setTimeout(() => this.cancel(), 30000);
    }

    start(video, event) {
      if (event.button !== 0 && event.button !== 1 && event.button !== 2) return;
      const point = this.locate(event, video);
      if (!point) return;
      event.preventDefault();
      if (this.session) this.cancel();
      const mode = this.getMode();
      const button = event.button === 2 ? 'right' : event.button === 1 ? 'middle' : 'left';
      this.session = {
        source: video, start: point, last: point,
        clientX: event.clientX, clientY: event.clientY,
        screenX: event.screenX, screenY: event.screenY,
        button, mode: 'ghost', dragging: false,
        path: [{ x: point.pos.targetX, y: point.pos.targetY }]
      };
      this.pendingDrag = null;
      this.armWatchdog();
      this.onPointer(point.pos);
      this.onDragState({
        active: true, dragging: false,
        source: this.surfaces.get(video)?.name || 'Display',
        destination: this.surfaces.get(video)?.name || 'Display',
        mode
      });
    }

    move(event) {
      const point = this.locate(event);
      const session = this.session;
      if (point) this.onPointer(point.pos);
      else if (!session) this.onPointer(null);
      if (session && typeof event.buttons === 'number') {
        const mask = session.button === 'right' ? 2 : session.button === 'middle' ? 4 : 1;
        if ((event.buttons & mask) === 0) {
          this.cancel();
          return;
        }
      }
      if (session) this.armWatchdog();
      if (!session) {
        if (!point) return;
        this.onCoordinates('X: ' + point.pos.targetX + ' Y: ' + point.pos.targetY);
        return;
      }

      if (point) {
        const crossed = session.last.video !== point.video;
        session.last = point;
        this.onCoordinates('X: ' + point.pos.targetX + ' Y: ' + point.pos.targetY);
        if (crossed) {
          this.onDragState({
            active: true, dragging: session.dragging,
            source: this.surfaces.get(session.source)?.name || 'Display',
            destination: this.surfaces.get(point.video)?.name || 'Display',
            mode: session.mode
          });
        }
      }
      if (!session.dragging && session.button === 'left' &&
          Math.hypot(event.clientX - session.clientX, event.clientY - session.clientY) > 5) {
        session.dragging = true;
        this.onDragState({
          active: true, dragging: true,
          source: this.surfaces.get(session.source)?.name || 'Display',
          destination: this.surfaces.get(session.last.video)?.name || 'Display',
          mode: session.mode
        });
        if (!this.replayDrag) {
          this.send('dragstart', session.start, {
            screenX: session.screenX, screenY: session.screenY
          }, session.mode, { button: session.button });
        }
      }
      if (session.dragging && point) {
        if (this.replayDrag) {
          this.recordPoint(session, point);
          return;
        }
        this.pendingDrag = { point, event: { screenX: event.screenX, screenY: event.screenY } };
        if (!this.dragScheduled) {
          this.dragScheduled = true;
          requestAnimationFrame(() => {
            this.dragScheduled = false;
            this.flushDrag();
          });
        }
      }
    }

    recordPoint(session, point, force = false) {
      const next = { x: point.pos.targetX, y: point.pos.targetY };
      const path = session.path;
      const previous = path[path.length - 1];
      if (!force && Math.hypot(next.x - previous.x, next.y - previous.y) < 4) return;
      if (path.length >= 190) {
        // Keep the start, drop alternate intermediary samples, preserve the end.
        session.path = [path[0], ...path.slice(2).filter((_, index) => index % 2 === 0)];
      }
      session.path.push(next);
    }

    flushDrag() {
      if (!this.pendingDrag || !this.session || !this.session.dragging) {
        this.pendingDrag = null;
        return;
      }
      const pending = this.pendingDrag;
      this.pendingDrag = null;
      this.send('drag', pending.point, pending.event, this.session.mode,
        { button: this.session.button });
    }

    finish(event, cancelled) {
      const session = this.session;
      if (!session) return;
      const at = cancelled ? null : this.locate(event);
      if (at) session.last = at;
      if (this.replayDrag && session.dragging && at) {
        this.recordPoint(session, at, true);
      } else if (!this.replayDrag) {
        this.flushDrag();
      }
      this.session = null;
      this.pendingDrag = null;
      clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
      this.lastHover = null;
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
      const origin = {
        screenX: Number.isFinite(session.screenX) ? session.screenX : 0,
        screenY: Number.isFinite(session.screenY) ? session.screenY : 0
      };
      const finalEvent = event && Number.isFinite(event.screenX) ? event : origin;
      this.onPointer(null);
      if (session.dragging) {
        if (this.replayDrag) {
          if (!cancelled && at && session.path.length >= 2) {
            const payload = {
              points: session.path,
              ctrl: !!finalEvent.ctrlKey,
              shift: !!finalEvent.shiftKey
            };
            Promise.resolve().then(() => {
              this.onReplayStart();
              return this.replayDrag(payload);
            }).then((result) => this.onReplayResult(result))
              .catch((error) => this.onReplayResult({
                ok: false, message: 'Native drag replay failed: ' + error.message
              }));
          }
        } else {
          this.send(cancelled ? 'dragcancel' : 'dragend', session.last, finalEvent, 'ghost',
            { button: session.button, ctrlKey: !!finalEvent.ctrlKey, shiftKey: !!finalEvent.shiftKey });
        }
      } else if (!cancelled && at && at.video === session.source) {
        this.send('click', at, finalEvent, 'ghost', { button: session.button });
      }
      this.onCoordinates('X: -- Y: --');
      this.onDragState({ active: false });
    }

    cancel() { this.finish(null, true); }

    dispose() {
      if (this.disposed) return;
      this.cancel();
      this.onPointer(null);
      this.disposed = true;
      clearTimeout(this.hoverTimer);
      clearTimeout(this.releaseTimer);
      root.removeEventListener('mousemove', this.onMove, true);
      root.removeEventListener('mouseup', this.onUp, true);
      root.removeEventListener('pointerdown', this.onPointerDown, true);
      root.removeEventListener('pointercancel', this.onPointerCancel, true);
      root.removeEventListener('blur', this.onBlur);
      root.removeEventListener('keydown', this.onKey, true);
      root.removeEventListener('beforeunload', this.onBlur);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', this.onVisibility);
      }
      this.surfaces.clear();
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { DragController };
  if (root) root.DragController = DragController;
})(typeof window !== 'undefined' ? window : null);
