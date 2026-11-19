(function (root) {
  'use strict';

  // Each tile owns its capture stream and pointer state; never share a capture between monitors.
  function createTileInput(video, display, callbacks) {
    let rect = null;
    let down = null;
    let dragging = false;
    let queuedDrag = null;
    let dragScheduled = false;
    let hoverTimer = null;
    let lastHover = null;
    const refreshRect = () => { rect = video.getBoundingClientRect(); };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(refreshRect) : null;
    if (observer) observer.observe(video);
    window.addEventListener('resize', refreshRect);
    video.addEventListener('loadedmetadata', refreshRect);
    requestAnimationFrame(refreshRect);

    function coords(e) {
      if (!rect) refreshRect();
      return root.GridMath.mapPreviewPoint(display, {
        width: video.videoWidth,
        height: video.videoHeight
      }, rect, { x: e.clientX, y: e.clientY });
    }

    function send(type, pos, e, extra) {
      if (!pos) return;
      callbacks.sendInput(Object.assign({
        type: type,
        x: pos.targetX, y: pos.targetY,
        origX: e.screenX, origY: e.screenY,
        mode: down ? down.mode : callbacks.getCursorMode()
      }, extra || {}));
    }

    function release(e, pos, allowClick) {
      if (!down) return;
      const saved = down;
      const wasDragging = dragging;
      down = null;
      dragging = false;
      queuedDrag = null;
      if (saved.mode === 'ghost') {
        if (wasDragging) {
          send('dragend', pos || saved.pos, e, { button: saved.button, mode: saved.mode });
        } else if (allowClick && pos) {
          send('click', pos, e, { button: saved.button, mode: saved.mode });
        }
      } else {
        send('mouseup', pos || saved.pos, e, { button: saved.button, mode: saved.mode });
      }
    }

    function onMove(e) {
      const pos = coords(e);
      if (!pos) return;
      callbacks.onCoordinates('X: ' + pos.targetX + ' Y: ' + pos.targetY);
      if (down && down.mode === 'ghost') {
        if (!dragging && Math.hypot(e.clientX - down.clientX, e.clientY - down.clientY) > 5) {
          dragging = true;
          send('dragstart', down.pos, e, {
            button: down.button, origX: down.screenX, origY: down.screenY
          });
        }
        if (dragging) {
          queuedDrag = { pos: pos, screenX: e.screenX, screenY: e.screenY };
          if (!dragScheduled) {
            dragScheduled = true;
            requestAnimationFrame(() => {
              dragScheduled = false;
              if (!queuedDrag || !dragging || !down) return;
              const drag = queuedDrag;
              queuedDrag = null;
              send('drag', drag.pos, { screenX: drag.screenX, screenY: drag.screenY }, { button: down.button });
            });
          }
        }
      } else if (down && down.mode === 'direct') {
        queuedDrag = { pos: pos, screenX: e.screenX, screenY: e.screenY };
        if (!dragScheduled) {
          dragScheduled = true;
          requestAnimationFrame(() => {
            dragScheduled = false;
            if (!queuedDrag || !down || down.mode !== 'direct') return;
            const drag = queuedDrag;
            queuedDrag = null;
            send('drag', drag.pos, { screenX: drag.screenX, screenY: drag.screenY }, { button: down.button });
          });
        }
      } else if (callbacks.getCursorMode() === 'direct') {
        lastHover = pos;
        if (!hoverTimer) {
          hoverTimer = setTimeout(() => {
            hoverTimer = null;
            if (lastHover && !down) {
              send('mousemove', lastHover, { screenX: e.screenX, screenY: e.screenY }, { mode: 'direct' });
            }
          }, 16);
        }
      }
    }

    function onDown(e) {
      e.preventDefault();
      const pos = coords(e);
      if (!pos) return;
      if (down) release(e, pos, false);
      down = {
        pos: pos, clientX: e.clientX, clientY: e.clientY,
        screenX: e.screenX, screenY: e.screenY,
        button: e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left',
        mode: callbacks.getCursorMode()
      };
      dragging = false;
      if (down.mode === 'direct') send('mousedown', pos, e, { button: down.button });
    }

    function onUp(e) {
      e.preventDefault();
      release(e, coords(e), true);
    }
    function onDouble(e) {
      e.preventDefault();
      send('dblclick', coords(e), e);
    }
    function onWheel(e) {
      e.preventDefault();
      send('wheel', coords(e), e, { deltaY: e.deltaY });
    }
    function onLeave(e) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
      lastHover = null;
      callbacks.onCoordinates('X: -- Y: --');
      release(e, null, false);
    }
    function onContext(e) { e.preventDefault(); }

    video.addEventListener('mousemove', onMove);
    video.addEventListener('mousedown', onDown);
    video.addEventListener('mouseup', onUp);
    video.addEventListener('dblclick', onDouble);
    video.addEventListener('wheel', onWheel, { passive: false });
    video.addEventListener('mouseleave', onLeave);
    video.addEventListener('contextmenu', onContext);
    return () => {
      release({ screenX: down ? down.screenX : 0, screenY: down ? down.screenY : 0 }, null, false);
      clearTimeout(hoverTimer);
      queuedDrag = null;
      if (observer) observer.disconnect();
      window.removeEventListener('resize', refreshRect);
      video.removeEventListener('loadedmetadata', refreshRect);
      video.removeEventListener('mousemove', onMove);
      video.removeEventListener('mousedown', onDown);
      video.removeEventListener('mouseup', onUp);
      video.removeEventListener('dblclick', onDouble);
      video.removeEventListener('wheel', onWheel);
      video.removeEventListener('mouseleave', onLeave);
      video.removeEventListener('contextmenu', onContext);
    };
  }

  class GridMode {
    constructor(options) {
      this.container = options.container;
      this.sendInput = options.sendInput;
      this.getCursorMode = options.getCursorMode;
      this.onCoordinates = options.onCoordinates;
      this.onFocus = options.onFocus;
      this.preference = options.preference || 'auto';
      this.tiles = [];
      this.active = false;
      this.generation = 0;
      this.resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.updateColumns()) : null;
      if (this.resizeObserver) this.resizeObserver.observe(this.container);
      window.addEventListener('resize', () => this.updateColumns());
    }

    setColumns(preference) {
      this.preference = preference;
      this.updateColumns();
    }

    updateColumns() {
      if (!this.active) return;
      const count = this.tiles.length;
      this.container.style.setProperty('--grid-columns',
        root.GridMath.gridColumns(count, this.container.clientWidth, this.preference));
    }

    stop() {
      this.generation++;
      this.active = false;
      for (const tile of this.tiles) {
        if (tile.releaseInput) tile.releaseInput();
        if (tile.stream) tile.stream.getTracks().forEach((track) => track.stop());
        tile.video.srcObject = null;
      }
      this.tiles = [];
      this.container.replaceChildren();
      this.container.hidden = true;
    }

    start(displays) {
      this.stop();
      this.active = true;
      this.container.hidden = false;
      const generation = this.generation;
      const available = (displays || []).filter((d) => d.sourceId && d.bounds);
      if (!available.length) {
        const message = document.createElement('p');
        message.className = 'grid-empty';
        message.textContent = 'No capture-ready displays found. Connect a monitor and select Refresh.';
        this.container.appendChild(message);
        this.updateColumns();
        return;
      }

      available.forEach((display) => this.addTile(display, generation));
      this.updateColumns();
    }

    async addTile(display, generation) {
      const tile = document.createElement('section');
      tile.className = 'grid-tile';
      tile.setAttribute('aria-label', display.name);
      const header = document.createElement('div');
      header.className = 'grid-tile-header';
      const label = document.createElement('span');
      label.className = 'grid-tile-name';
      label.title = display.name;
      label.textContent = display.name;
      const resolution = document.createElement('span');
      resolution.className = 'grid-resolution';
      resolution.textContent = display.bounds.width + '×' + display.bounds.height;
      const focus = document.createElement('button');
      focus.type = 'button';
      focus.className = 'grid-focus btn';
      focus.textContent = 'Focus';
      focus.title = 'Show this monitor in single-screen mode';
      focus.addEventListener('click', () => this.onFocus(display));
      header.append(label, resolution, focus);
      const stage = document.createElement('div');
      stage.className = 'grid-tile-stage';
      const video = document.createElement('video');
      video.className = 'grid-video';
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      const status = document.createElement('div');
      status.className = 'grid-tile-status';
      status.textContent = 'Connecting…';
      stage.append(video, status);
      tile.append(header, stage);
      this.container.appendChild(tile);

      const entry = { video: video, stream: null, releaseInput: null };
      this.tiles.push(entry);
      this.updateColumns();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: display.sourceId,
              minWidth: display.bounds.width,
              maxWidth: display.bounds.width,
              minHeight: display.bounds.height,
              maxHeight: display.bounds.height,
              minFrameRate: 15,
              maxFrameRate: 60
            },
            optional: [{ cursor: 'never' }]
          }
        });

        // A previously requested capture must never resurrect after mode changes.
        if (!this.active || this.generation !== generation) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        entry.stream = stream;
        video.srcObject = stream;
        entry.releaseInput = createTileInput(video, display, this);
        video.addEventListener('loadedmetadata', () => {
          if (this.generation !== generation) return;
          video.play().catch((error) => { status.textContent = 'Playback unavailable: ' + error.message; });
        }, { once: true });
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            if (this.generation === generation) {
              status.textContent = 'Disconnected — use Refresh';
              status.hidden = false;
            }
          }, { once: true });
        });
        status.hidden = true;
      } catch (error) {
        if (this.generation !== generation) return;
        status.textContent = 'Capture failed: ' + error.message;
        status.hidden = false;
      }
    }
  }

  root.GridMode = GridMode;
})(window);
