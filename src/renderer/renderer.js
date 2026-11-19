// State
let currentDisplays = [];
let activeDisplay = null;
let currentStream = null;
let singleCaptureGeneration = 0;
let displayLoadGeneration = 0;
let hostDisplay = null;
let preferredSingleId = null;
let isAlwaysOnTop = true;
let cursorMode = 'ghost'; // 'ghost' = cursor stays 100% on current desktop! 'direct' = cursor moves to target display
let opacityLevels = [1.0, 0.85, 0.65];
let opacityIndex = 0;
let lastFrameTime = performance.now();
let frameCount = 0;
let fps = 0;
let latestCoordText = null;

// Elements
const titlebar = document.getElementById('titlebar');
const screenSelect = document.getElementById('screenSelect');
const screenVideo = document.getElementById('screenVideo');
const viewportContainer = document.getElementById('viewportContainer');
const placeholder = document.getElementById('placeholder');
const placeholderText = document.getElementById('placeholderText');
const fpsDisplay = document.getElementById('fpsDisplay');
const coordDisplay = document.getElementById('coordDisplay');
const btnMode = document.getElementById('btnMode');
const btnPin = document.getElementById('btnPin');
const btnOpacity = document.getElementById('btnOpacity');
const btnGrid = document.getElementById('btnGrid');
const gridColumnsSelect = document.getElementById('gridColumns');
const btnRefresh = document.getElementById('btnRefresh');
const btnSmartHide = document.getElementById('btnSmartHide');
let smartHideEnabled = localStorage.getItem('show-screen:smart-hide') !== 'off';
btnSmartHide.classList.toggle('active', smartHideEnabled);
btnSmartHide.setAttribute('aria-pressed', String(smartHideEnabled));
btnSmartHide.textContent = smartHideEnabled ? '◉ Smart Hide' : '○ Smart Hide';
const savedGridColumns = localStorage.getItem('show-screen:grid-columns') || 'auto';
const initialViewMode = localStorage.getItem('show-screen:view-mode') === 'grid' ? 'grid' : 'single';
let viewMode = 'single';
let firstDisplayLoad = true;
if (Array.from(gridColumnsSelect.options).some((o) => o.value === savedGridColumns)) {
  gridColumnsSelect.value = savedGridColumns;
}

const dragHint = document.getElementById('dragHint');
const dragController = new DragController({
  sendInput: (event) => window.electronAPI.sendInput(event),
  getMode: () => cursorMode,
  onCoordinates: (text) => { latestCoordText = text; },
  onDragState: (state) => {
    if (!dragHint) return;
    dragHint.hidden = !state.active;
    if (state.active) {
      dragHint.textContent = state.dragging
        ? 'Dragging: ' + state.source + ' → ' + state.destination + ' · Release to drop'
        : 'Hold and move to drag · Esc releases';
    }
  },
});
let singleInputCleanup = null;

const gridMode = new GridMode({
  container: document.getElementById('screenGrid'),
  preference: gridColumnsSelect.value,
  dragController,
  onFocus: (display) => {
    preferredSingleId = display.id;
    setViewMode('single');
  },
});

function stopSingleCapture() {
  singleCaptureGeneration++;
  if (singleInputCleanup) {
    singleInputCleanup();
    singleInputCleanup = null;
  }
  if (currentStream) currentStream.getTracks().forEach((track) => track.stop());
  currentStream = null;
  screenVideo.srcObject = null;
  screenVideo.onloadedmetadata = null;
  activeDisplay = null;
}

function setViewMode(mode) {
  const eligible = SmartHide.availableDisplays(currentDisplays, hostDisplay, smartHideEnabled);
  if (mode === 'grid') {
    stopSingleCapture();
    viewMode = 'grid';
    viewportContainer.classList.add('grid-active');
    const excluded = currentDisplays.length > eligible.length;
    gridMode.start(eligible, excluded
      ? 'Smart Hide is active. Move this window to another monitor or turn Smart Hide off.'
      : undefined);
  } else {
    gridMode.stop();
    viewMode = 'single';
    viewportContainer.classList.remove('grid-active');
    const target = SmartHide.pickSingleDisplay(eligible, preferredSingleId, screenSelect.value);
    if (target) {
      screenSelect.value = target.id;
      // A monitor can keep the same ID after a resolution or source change.
      const staleCapture = !activeDisplay || activeDisplay.id !== target.id
        || activeDisplay.sourceId !== target.sourceId
        || activeDisplay.bounds.width !== target.bounds.width
        || activeDisplay.bounds.height !== target.bounds.height
        || !currentStream;
      if (staleCapture) switchDisplay(target);
    } else {
      stopSingleCapture();
      placeholder.style.display = 'flex';
      placeholderText.textContent = smartHideEnabled && currentDisplays.length
        ? 'Smart Hide: the local screen is paused. Move the app to another monitor or turn Smart Hide off.'
        : 'No available monitors to capture.';
    }
  }
  btnGrid.classList.toggle('active', viewMode === 'grid');
  btnGrid.setAttribute('aria-pressed', String(viewMode === 'grid'));
  btnGrid.textContent = viewMode === 'grid' ? '▣ Single' : '▦ Grid';
  gridColumnsSelect.hidden = viewMode !== 'grid';
  localStorage.setItem('show-screen:view-mode', viewMode);
}

function applyHostDisplay(host) {
  if (!host || !host.id) return;
  if (hostDisplay && hostDisplay.id === host.id) return;
  hostDisplay = host;
  if (smartHideEnabled && !firstDisplayLoad && currentDisplays.length) {
    setViewMode(viewMode);
  }
}

btnSmartHide.addEventListener('click', () => {
  smartHideEnabled = !smartHideEnabled;
  localStorage.setItem('show-screen:smart-hide', smartHideEnabled ? 'on' : 'off');
  btnSmartHide.classList.toggle('active', smartHideEnabled);
  btnSmartHide.setAttribute('aria-pressed', String(smartHideEnabled));
  btnSmartHide.textContent = smartHideEnabled ? '◉ Smart Hide' : '○ Smart Hide';
  setViewMode(viewMode);
});

if (typeof window.electronAPI.onHostDisplayChanged === 'function') {
  window.electronAPI.onHostDisplayChanged(applyHostDisplay);
}

btnGrid.addEventListener('click', () => {
  setViewMode(viewMode === 'grid' ? 'single' : 'grid');
});
gridColumnsSelect.addEventListener('change', () => {
  localStorage.setItem('show-screen:grid-columns', gridColumnsSelect.value);
  gridMode.setColumns(gridColumnsSelect.value);
});
btnRefresh.addEventListener('click', () => loadDisplays());
if (typeof window.electronAPI.onDisplaysChanged === 'function') {
  window.electronAPI.onDisplaysChanged(() => loadDisplays());
}
window.addEventListener('beforeunload', () => {
  gridMode.stop();
  stopSingleCapture();
  dragController.dispose();
});

// Titlebar Auto-dim on idle mouse
let dimTimeout;
function resetDimTimer() {
  titlebar.classList.remove('dimmed');
  clearTimeout(dimTimeout);
  dimTimeout = setTimeout(() => {
    titlebar.classList.add('dimmed');
  }, 3500);
}
window.addEventListener('mousemove', resetDimTimer);
resetDimTimer();

// Mode Toggle (Ghost Cursor vs Direct Warp)
btnMode.addEventListener('click', () => {
  cursorMode = cursorMode === 'ghost' ? 'direct' : 'ghost';
  btnMode.textContent = cursorMode === 'ghost' ? '🎯 Tetap di Sini' : '🚀 Pindah Layar';
  btnMode.classList.toggle('active', cursorMode === 'ghost');
});

// Window Controls
btnPin.addEventListener('click', () => {
  isAlwaysOnTop = !isAlwaysOnTop;
  window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
  btnPin.classList.toggle('active', isAlwaysOnTop);
});

btnOpacity.addEventListener('click', () => {
  opacityIndex = (opacityIndex + 1) % opacityLevels.length;
  const op = opacityLevels[opacityIndex];
  window.electronAPI.setOpacity(op);
  btnOpacity.textContent = `🌓 ${Math.round(op * 100)}%`;
});

const btnDonate = document.getElementById('btnDonate');
if (btnDonate) {
  btnDonate.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.electronAPI && typeof window.electronAPI.openDonate === 'function') {
      window.electronAPI.openDonate();
    } else if (window.electronAPI && typeof window.electronAPI.openExternal === 'function') {
      window.electronAPI.openExternal('https://ko-fi.com/rudycity');
    }
  });
}

// All single-preview and grid-preview pointer input is managed by DragController.
// Stream Setup & Display Switching
async function switchDisplay(display) {
  if (!display || !display.sourceId) return;
  const captureGeneration = ++singleCaptureGeneration;

  if (singleInputCleanup) {
    singleInputCleanup();
    singleInputCleanup = null;
  }
  activeDisplay = display;
  placeholder.style.display = 'flex';
  placeholderText.textContent = `Connecting to ${display.name}...`;

  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    currentStream = null;
  }

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
          minFrameRate: 30,
          maxFrameRate: 60,
        },
        optional: [
          { cursor: 'never' },
        ],
      },
    });

    if (captureGeneration !== singleCaptureGeneration || viewMode === 'grid') {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    currentStream = stream;
    screenVideo.srcObject = stream;
    singleInputCleanup = dragController.addSurface(screenVideo, display);
    screenVideo.onloadedmetadata = () => {
      screenVideo.play().catch((error) => console.error('Video playback failed:', error));
      placeholder.style.display = 'none';
    };
  } catch (err) {
    console.error('Error starting screen stream:', err);
    if (captureGeneration === singleCaptureGeneration && viewMode !== 'grid') {
      placeholderText.textContent = `Failed to stream ${display.name}: ${err.message}`;
    }
  }
}

// Display Enumeration (also called after monitor hot-plug events)
async function loadDisplays() {
  const requestId = ++displayLoadGeneration;
  const selectedId = screenSelect.value;
  try {
    const displays = await window.electronAPI.getDisplays();
    const host = await window.electronAPI.getHostDisplay();
    if (requestId !== displayLoadGeneration) return;
    hostDisplay = host || hostDisplay;
    currentDisplays = displays || [];
    screenSelect.replaceChildren();

    if (!currentDisplays.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No displays found';
      screenSelect.appendChild(opt);
      stopSingleCapture();
      placeholder.style.display = 'flex';
      placeholderText.textContent = 'No active monitors detected.';
      if (viewMode === 'grid') gridMode.start([]);
      firstDisplayLoad = false;
      return;
    }

    currentDisplays.forEach((disp) => {
      const opt = document.createElement('option');
      opt.value = disp.id;
      opt.textContent = disp.name + ' (' + disp.bounds.width + 'x' + disp.bounds.height + ')';
      screenSelect.appendChild(opt);
    });

    const secondary = currentDisplays.find((d) => !d.isPrimary);
    const target = currentDisplays.find((d) => d.id === preferredSingleId)
      || currentDisplays.find((d) => d.id === selectedId) || secondary || currentDisplays[0];
    if (!preferredSingleId || !currentDisplays.some((d) => d.id === preferredSingleId)) {
      preferredSingleId = target.id;
    }
    screenSelect.value = target.id;
    const desiredMode = firstDisplayLoad ? initialViewMode : viewMode;
    firstDisplayLoad = false;
    setViewMode(desiredMode);
  } catch (err) {
    if (requestId !== displayLoadGeneration) return;
    console.error('Error loading displays:', err);
    if (viewMode !== 'grid') {
      placeholder.style.display = 'flex';
      placeholderText.textContent = 'Failed to detect monitors: ' + err.message;
    }
  }
}

screenSelect.addEventListener('change', () => {
  const selected = currentDisplays.find((d) => d.id === screenSelect.value);
  if (selected) {
    preferredSingleId = selected.id;
    setViewMode('single');
  }
});

// FPS & Coords Telemetry Counter (RAF-decoupled)
function updateTelemetry() {
  frameCount++;
  const now = performance.now();
  const elapsed = now - lastFrameTime;
  if (elapsed >= 1000) {
    fps = Math.round((frameCount * 1000) / elapsed);
    fpsDisplay.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFrameTime = now;
  }
  if (latestCoordText && coordDisplay.textContent !== latestCoordText) {
    coordDisplay.textContent = latestCoordText;
  }
  requestAnimationFrame(updateTelemetry);
}
requestAnimationFrame(updateTelemetry);

// Initial load
loadDisplays();
