(function (root) {
  'use strict';

  // One drag session spans all preview tiles. Coordinates always belong to the
  // destination monitor, while a single OS mouse button remains held.
  class DragController {
    constructor(options) {
      this.sendInput = options.sendInput;
      this.getMode = options.getMode;
      this.onCoordinates = options.onCoordinates || (() => {});
      this.onDragState = options.onDragState || (() => {});
      this.mapPoint = options.mapPoint || root.GridMath.mapPreviewPoint;
      this.surfaces = new Map();
      this.session = null;
      this.pendingDrag = null;
      this.dragScheduled = false;
      this.hoverTimer = null;
      this.lastHover = null;
      this.disposed = false;

      this.onMove = (event) => this.move(event);
      this.onUp = (event) => this.finish(event, false);
      this.onBlur = () => this.cancel();
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
        button, mode, dragging: mode === 'direct'
      };
      this.pendingDrag = null;
      this.onDragState({
        active: true, dragging: false,
        source: this.surfaces.get(video)?.name || 'Display',
        destination: this.surfaces.get(video)?.name || 'Display',
        mode
      });
      if (mode === 'direct') this.send('mousedown', point, event, mode, { button });
    }

    move(event) {
      const point = this.locate(event);
      const session = this.session;
      if (!session) {
        if (!point) return;
        this.onCoordinates('X: ' + point.pos.targetX + ' Y: ' + point.pos.targetY);
        if (this.getMode() !== 'direct') return;
        this.lastHover = { point, screenX: event.screenX, screenY: event.screenY };
        if (!this.hoverTimer) {
          this.hoverTimer = setTimeout(() => {
            this.hoverTimer = null;
            if (this.session || !this.lastHover) return;
            const hover = this.lastHover;
            this.lastHover = null;
            this.send('mousemove', hover.point, hover, 'direct');
          }, 16);
        }
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
        this.send('dragstart', session.start, {
          screenX: session.screenX, screenY: session.screenY
        }, session.mode, { button: session.button });
      }
      if (session.dragging && point) {
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
      this.flushDrag();
      this.session = null;
      this.pendingDrag = null;
      this.lastHover = null;
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
      const origin = {
        screenX: Number.isFinite(session.screenX) ? session.screenX : 0,
        screenY: Number.isFinite(session.screenY) ? session.screenY : 0
      };
      const finalEvent = event && Number.isFinite(event.screenX) ? event : origin;
      if (session.mode === 'direct') {
        this.send('mouseup', session.last, finalEvent, 'direct', { button: session.button });
      } else if (session.dragging) {
        this.send('dragend', session.last, finalEvent, 'ghost', { button: session.button });
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
      this.disposed = true;
      clearTimeout(this.hoverTimer);
      root.removeEventListener('mousemove', this.onMove, true);
      root.removeEventListener('mouseup', this.onUp, true);
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
