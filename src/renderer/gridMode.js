(function (root) {
  'use strict';

  // Each tile owns its stream, while DragController owns cross-tile mouse state.
  class GridMode {
    constructor(options) {
      this.container = options.container;
      this.dragController = options.dragController;
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

    start(displays, emptyMessage) {
      this.stop();
      this.active = true;
      this.container.hidden = false;
      const generation = this.generation;
      const available = (displays || []).filter((d) => d.sourceId && d.bounds);
      if (!available.length) {
        const message = document.createElement('p');
        message.className = 'grid-empty';
        message.textContent = emptyMessage || 'No capture-ready displays found. Connect a monitor and select Refresh.';
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
        entry.releaseInput = this.dragController.addSurface(video, display);
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
