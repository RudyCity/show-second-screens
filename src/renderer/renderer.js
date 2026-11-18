// State
let currentDisplays = [];
let activeDisplay = null;
let currentStream = null;
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

// Cached Geometry for zero-overhead O(1) coordinate mapping
const cachedGeo = {
  valid: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  renderWidth: 0,
  renderHeight: 0,
  offsetX: 0,
  offsetY: 0,
  invRenderWidth: 0,
  invRenderHeight: 0,
};

function updateCachedGeometry() {
  if (!screenVideo || !activeDisplay) {
    cachedGeo.valid = false;
    return;
  }
  const rect = screenVideo.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) {
    cachedGeo.valid = false;
    return;
  }
  const videoW = screenVideo.videoWidth || activeDisplay.bounds.width;
  const videoH = screenVideo.videoHeight || activeDisplay.bounds.height;
  if (videoW <= 0 || videoH <= 0) {
    cachedGeo.valid = false;
    return;
  }

  const streamAspect = videoW / videoH;
  const elemAspect = rect.width / rect.height;

  let renderWidth = rect.width;
  let renderHeight = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (elemAspect > streamAspect) {
    renderWidth = rect.height * streamAspect;
    renderHeight = rect.height;
    offsetX = (rect.width - renderWidth) * 0.5;
  } else {
    renderWidth = rect.width;
    renderHeight = rect.width / streamAspect;
    offsetY = (rect.height - renderHeight) * 0.5;
  }

  cachedGeo.valid = true;
  cachedGeo.left = rect.left;
  cachedGeo.top = rect.top;
  cachedGeo.width = rect.width;
  cachedGeo.height = rect.height;
  cachedGeo.renderWidth = renderWidth;
  cachedGeo.renderHeight = renderHeight;
  cachedGeo.offsetX = offsetX;
  cachedGeo.offsetY = offsetY;
  cachedGeo.invRenderWidth = 1.0 / renderWidth;
  cachedGeo.invRenderHeight = 1.0 / renderHeight;
}

window.addEventListener('resize', updateCachedGeometry, { passive: true });
if (window.ResizeObserver) {
  const ro = new ResizeObserver(() => updateCachedGeometry());
  ro.observe(viewportContainer);
}

// High-performance Coordinate Mapping Math Engine
function calculateTargetCoordinates(e) {
  if (!activeDisplay) return null;
  if (!cachedGeo.valid) {
    updateCachedGeometry();
    if (!cachedGeo.valid) return null;
  }

  const clickX = e.clientX - cachedGeo.left;
  const clickY = e.clientY - cachedGeo.top;

  const relX = clickX - cachedGeo.offsetX;
  const relY = clickY - cachedGeo.offsetY;

  // Ignore interactions outside the rendered display content (black bars)
  if (relX < 0 || relX > cachedGeo.renderWidth || relY < 0 || relY > cachedGeo.renderHeight) {
    return null;
  }

  const u = relX * cachedGeo.invRenderWidth;
  const v = relY * cachedGeo.invRenderHeight;

  const bounds = activeDisplay.bounds;
  const targetX = Math.round(bounds.x + u * bounds.width);
  const targetY = Math.round(bounds.y + v * bounds.height);

  return { targetX, targetY, normX: u, normY: v };
}

// Interactive Input Simulation Listener on Video Preview
let isMouseDown = false;
let isDragging = false;
let mouseDownData = null;
let throttleTimeout = null;
let pendingDragPayload = null;
let dragRafScheduled = false;

function queueDragEvent(payload) {
  pendingDragPayload = payload;
  if (!dragRafScheduled) {
    dragRafScheduled = true;
    requestAnimationFrame(() => {
      dragRafScheduled = false;
      if (pendingDragPayload && isDragging) {
        window.electronAPI.sendInput(pendingDragPayload);
        pendingDragPayload = null;
      }
    });
  }
}

screenVideo.addEventListener('mousemove', (e) => {
  const coords = calculateTargetCoordinates(e);
  if (!coords) return;

  latestCoordText = `X: ${coords.targetX} Y: ${coords.targetY}`;

  // In Ghost mode: cursor stays 100% on current desktop during hover and clicks!
  if (cursorMode === 'ghost') {
    if (isMouseDown && mouseDownData) {
      const dx = e.clientX - mouseDownData.clientX;
      const dy = e.clientY - mouseDownData.clientY;
      const dist = Math.hypot(dx, dy);

      // Initiate drag only when moved beyond 5px threshold
      if (!isDragging && dist > 5) {
        isDragging = true;
        window.electronAPI.sendInput({
          type: 'dragstart',
          button: mouseDownData.button,
          x: mouseDownData.targetX,
          y: mouseDownData.targetY,
          origX: mouseDownData.screenX,
          origY: mouseDownData.screenY,
          mode: 'ghost',
        });
      }

      if (isDragging) {
        queueDragEvent({
          type: 'drag',
          button: mouseDownData.button,
          x: coords.targetX,
          y: coords.targetY,
          origX: e.screenX,
          origY: e.screenY,
          mode: 'ghost',
        });
      }
    }
    return;
  }

  // In Direct mode: warp cursor to target screen
  if (!throttleTimeout) {
    throttleTimeout = setTimeout(() => {
      throttleTimeout = null;
      window.electronAPI.sendInput({
        type: 'mousemove',
        x: coords.targetX,
        y: coords.targetY,
        mode: 'direct',
      });
    }, 16);
  }
});

screenVideo.addEventListener('mousedown', (e) => {
  e.preventDefault();
  const coords = calculateTargetCoordinates(e);
  if (!coords) return;

  const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
  isMouseDown = true;
  isDragging = false;
  mouseDownData = {
    clientX: e.clientX,
    clientY: e.clientY,
    screenX: e.screenX,
    screenY: e.screenY,
    targetX: coords.targetX,
    targetY: coords.targetY,
    button: button,
  };

  if (cursorMode === 'direct') {
    window.electronAPI.sendInput({
      type: 'mousedown',
      button: button,
      x: coords.targetX,
      y: coords.targetY,
      mode: 'direct',
    });
  }
  // Note: In Ghost mode, do NOT send mousedown or warp cursor to target screen!
  // This ensures clicks never warp the physical cursor away from the preview window.
});

screenVideo.addEventListener('mouseup', (e) => {
  e.preventDefault();
  pendingDragPayload = null;
  const coords = calculateTargetCoordinates(e);
  if (!coords) return;

  const button = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

  if (cursorMode === 'ghost') {
    if (isDragging) {
      window.electronAPI.sendInput({
        type: 'dragend',
        button: button,
        x: coords.targetX,
        y: coords.targetY,
        origX: e.screenX,
        origY: e.screenY,
        mode: 'ghost',
      });
    } else {
      // Normal clean click: single atomic injection at target coordinates,
      // instantly restoring the physical cursor to (e.screenX, e.screenY).
      window.electronAPI.sendInput({
        type: 'click',
        button: button,
        x: coords.targetX,
        y: coords.targetY,
        origX: e.screenX,
        origY: e.screenY,
        mode: 'ghost',
      });
    }
  } else {
    window.electronAPI.sendInput({
      type: 'mouseup',
      button: button,
      x: coords.targetX,
      y: coords.targetY,
      mode: 'direct',
    });
  }

  isMouseDown = false;
  isDragging = false;
  mouseDownData = null;
});

// Suppress default/redundant browser click & contextmenu events since mouseup handles them
screenVideo.addEventListener('click', (e) => {
  e.preventDefault();
});

screenVideo.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

screenVideo.addEventListener('dblclick', (e) => {
  e.preventDefault();
  const coords = calculateTargetCoordinates(e);
  if (!coords) return;

  window.electronAPI.sendInput({
    type: 'dblclick',
    x: coords.targetX,
    y: coords.targetY,
    origX: e.screenX,
    origY: e.screenY,
    mode: cursorMode,
  });
});

screenVideo.addEventListener('wheel', (e) => {
  e.preventDefault();
  const coords = calculateTargetCoordinates(e);
  if (!coords) return;

  window.electronAPI.sendInput({
    type: 'wheel',
    deltaY: e.deltaY,
    x: coords.targetX,
    y: coords.targetY,
    origX: e.screenX,
    origY: e.screenY,
    mode: cursorMode,
  });
}, { passive: false });

screenVideo.addEventListener('mouseleave', () => {
  pendingDragPayload = null;
  latestCoordText = 'X: -- Y: --';
  if (isDragging && activeDisplay && mouseDownData) {
    window.electronAPI.sendInput({
      type: 'dragend',
      button: 'left',
      x: mouseDownData.targetX,
      y: mouseDownData.targetY,
      origX: mouseDownData.screenX,
      origY: mouseDownData.screenY,
      mode: cursorMode,
    });
  }
  isMouseDown = false;
  isDragging = false;
  mouseDownData = null;
});

// Stream Setup & Display Switching
async function switchDisplay(display) {
  if (!display || !display.sourceId) return;

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

    currentStream = stream;
    screenVideo.srcObject = stream;
    screenVideo.onloadedmetadata = () => {
      screenVideo.play();
      placeholder.style.display = 'none';
      updateCachedGeometry();
    };
  } catch (err) {
    console.error('Error starting screen stream:', err);
    placeholderText.textContent = `Failed to stream ${display.name}: ${err.message}`;
  }
}

// Display Enumeration
async function loadDisplays() {
  try {
    currentDisplays = await window.electronAPI.getDisplays();
    screenSelect.innerHTML = '';

    if (!currentDisplays || currentDisplays.length === 0) {
      screenSelect.innerHTML = '<option value="">No displays found</option>';
      placeholderText.textContent = 'No active monitors detected.';
      return;
    }

    currentDisplays.forEach((disp) => {
      const opt = document.createElement('option');
      opt.value = disp.id;
      opt.textContent = `${disp.name} (${disp.bounds.width}x${disp.bounds.height})`;
      screenSelect.appendChild(opt);
    });

    // Default to secondary display if available, else primary
    const secondary = currentDisplays.find((d) => !d.isPrimary);
    const target = secondary || currentDisplays[0];
    screenSelect.value = target.id;
    switchDisplay(target);
  } catch (err) {
    console.error('Error loading displays:', err);
  }
}

screenSelect.addEventListener('change', () => {
  const selected = currentDisplays.find((d) => d.id === screenSelect.value);
  if (selected) {
    switchDisplay(selected);
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
