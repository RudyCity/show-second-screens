# Changelog

All notable changes to the **show-second-screens** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.10] - 2026-11-18

### Fixed
- **Modularized Renderer & Prevented Inline Style/Script Text Leak**:
  - Extracted inline CSS from `src/renderer/index.html` into `src/renderer/styles.css` and inline JavaScript into `src/renderer/renderer.js`, reducing `index.html` from 752 lines to 41 lines in compliance with `AGENTS.md` modularization standards (<700 lines).
  - Enforced `head, meta, link, title, style, script { display: none !important; }` and `.titlebar { flex-shrink: 0; }` + `.viewport-container { flex: 1; min-height: 0; }` so metadata, style, or script nodes can never render as visible text or collapse the video viewport.

### Added
- **Cross-Platform GitHub Actions CI & Release Workflow (`.github/workflows/release.yml`)**:
  - Automated multi-OS build and release matrix for **Ubuntu** (`AppImage`, `deb`), **macOS** (`x64`/`arm64` `dmg`, `zip`), and **Windows** (`portable` `.exe`).
  - Added `.github/FUNDING.yml` (`ko_fi: rudycity`) and updated `package.json` / `electron-builder.json` metadata for cross-platform packaging.

---

## [0.3.9] - 2026-10-31

### Added
- **In-App Direct Ko-fi Donation Modal Window**:
  - Implemented `openDonateWindow()` in `WindowManager` (`src/main/window/windowManager.cjs`) to open the Ko-fi donation page directly inside a dedicated in-app modal window anchored to Show Second Screens, eliminating the jarring switch to an external browser.
  - Sized at 490x720 (optimized for Ko-fi's donation interface) with dark terminal theme styling, custom application menu (`☕ Ko-fi` with Reload/Close, and fallback `🌐 Buka di Browser Luar`).
  - Added user-agent sanitization (removing the raw `Electron` token) so Cloudflare bot verification and payment forms (PayPal, Stripe, credit cards) render smoothly.
  - Configured `setWindowOpenHandler` to natively support payment authentication popups (e.g., PayPal checkout / 3D Secure verification).
  - Integrated with titlebar `☕ Donate` button via IPC `system:open-donate` and System Tray menu item `☕ Support via Ko-fi`.
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.9.exe`)**:
  - Rebuilt standalone portable distribution with in-app donation window.

---

## [0.3.8] - 2026-10-31

### Performance
- **Zero-Reflow Coordinate Math & Layout Thrashing Elimination**:
  - Replaced per-event `getBoundingClientRect()` layout queries inside `screenVideo.mousemove` (which previously triggered forced synchronous layouts up to 1000 times per second) with an $O(1)$ cached geometry engine (`cachedGeo`).
  - Geometry is precomputed and cached on `ResizeObserver`, window resize, and video stream metadata load, using fast multiplication with precalculated reciprocal dimensions (`invRenderWidth`, `invRenderHeight`).
- **Telemetry & Drag Event Decoupling via RAF**:
  - Decoupled telemetry DOM text updates (`coordDisplay.textContent`) from raw mousemove events into the synchronized `requestAnimationFrame` render loop, eliminating DOM write-after-read thrashing.
  - Implemented `requestAnimationFrame` batching for continuous drag events (`queueDragEvent`) to prevent IPC bus flooding and pipe congestion during fast drag-and-drop actions.
- **Hardware-Accelerated Video Compositing & GPU Pipeline**:
  - Added CSS zero-copy compositing properties (`transform: translateZ(0); will-change: transform; backface-visibility: hidden; contain: layout paint;`) to force discrete GPU layer promotion.
  - Added high-performance Chromium switches: `--enable-gpu-rasterization`, `--enable-zero-copy`, `--enable-hardware-overlays`, `--force_high_performance_gpu`, and `--disable-background-timer-throttling`.
  - Disabled spellchecker background worker threads (`spellcheck: false`) and WebSQL in BrowserWindow `webPreferences`.
- **Physical Monitor Enumeration Memoization**:
  - Added 5000ms TTL caching to `DisplayService.getWindowsPhysicalMonitors()`, eliminating repetitive synchronous child process execution during rapid display lookups.
  - Integrated automatic cache invalidation on `screen` lifecycle events (`display-added`, `display-removed`, `display-metrics-changed`).
- **Native C# Input Daemon Microsecond Acceleration**:
  - Reduced artificial `Thread.Sleep` delays across all injection paths in `src/main/input/injector.cs` (down to 2ms in `PhantomClick`, `LegacyGhostClick`, `LegacyGhostWheel`, and `FireClick`), drastically minimizing input queue latency.
  - Rebuilt high-performance native binary `bin/injector.exe`.

### Added
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.8.exe`)**:
  - Packaged ultra-low-latency portable distribution with zero-copy GPU video pipeline.

---

## [0.3.7] - 2026-10-31

### Added
- **Bright & High-Contrast Visual Brand Identity**:
  - Re-designed application logo with an ultra-bright, glowing dual-monitor aesthetic (`assets/icon.png` 512x512 and multi-resolution `assets/icon.ico` with 16, 24, 32, 48, 64, 128, 256px formats).
  - High visibility guaranteed against dark themes, Windows dark taskbar, and high-DPI displays.
- **Ko-fi Donation & Support Integration**:
  - Added sleek, responsive `☕ Donate` button in the application titlebar with smooth hover feedback opening `https://ko-fi.com/rudycity` in the user's default browser via IPC `system:open-external`.
  - Added `☕ Support via Ko-fi` menu action in the System Tray context menu.
  - Added official Ko-fi donation badge and section to `README.md`.
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.7.exe`)**:
  - Rebuilt standalone portable distribution with updated bright icons and Ko-fi support integration.

---

## [0.3.6] - 2026-10-31

### Fixed
- **System Tray Icon Not Appearing**:
  - Replaced unsupported raw SVG string buffer in `TrayManager.createTrayIcon()` (which previously produced an empty 0x0 `NativeImage`, causing an invisible tray icon) with dedicated `IconResolver` (`src/main/window/iconResolver.cjs`).
  - Added multi-path icon detection supporting development, unpacked ASAR (`app.asar.unpacked`), and packaged resources.
  - Added hardware-generated 16x16 RGBA monitor fallback buffer to ensure the system tray icon is 100% guaranteed to never be empty or invisible.
- **Window and In-App Logo Icon**:
  - Integrated `IconResolver` into `WindowManager` to dynamically apply `assets/icon.ico` and `assets/icon.png` to the Windows taskbar and titlebar.
  - Added brand logo image and favicon `<link rel="icon">` in `src/renderer/index.html` header next to the brand title.
- **Packaging Assets Unpack**:
  - Updated `electron-builder.json` to include `"assets/**/*"` in `files` and added `"assets/**/*"` to `asarUnpack`, ensuring Windows shell and taskbar APIs can load native icons directly from the physical filesystem.

---

## [0.3.5] - 2026-10-31

### Added
- **Single Instance Conflict Detection & Kill Confirmation**:
  - Implemented `SingleInstanceManager` (`src/main/instance/singleInstanceManager.cjs`) to enforce single-instance lifecycle across portable executables and normal application launches.
  - When launching the application while an existing instance is already running (e.g. background tray or frozen process), displays a native confirmation dialog:
    - *"Aplikasi Show Second Screens sudah berjalan. Apakah Anda ingin menghentikan (kill) aplikasi yang sedang berjalan dan membuka yang baru?"*
    - Buttons: `Hentikan & Buka Baru` (default) dan `Batal`.
  - When confirmed, cleanly terminates existing application processes (`Show Second Screens.exe`, `Show-Second-Screens-Portable-*.exe`, and any orphaned `injector.exe`) using process-tree termination (`taskkill /F /PID <pid> /T`), preserving the current launching process and re-acquiring the instance lock or relaunching fresh.
  - If cancelled, automatically brings the existing instance's window to focus (`win.restore()`, `win.show()`, `win.focus()`) and exits the secondary launcher.
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.5.exe`)**:
  - Bundled release with single instance detection and conflict resolution.

---

## [0.3.4] - 2026-10-30

### Added
- **Phantom PostMessage Injection Engine**:
  - Implemented window-targeted message injection (`msgclick`, `msgdblclick`, `msgrclick`, `msgwheel`, `msgdown`, `msgup`, `msgmove`) via Win32 `PostMessage` (`WM_LBUTTONDOWN`, `WM_LBUTTONUP`, `WM_RBUTTONDOWN`, `WM_MOUSEMOVE`, `WM_MOUSEWHEEL`).
  - Resolves target window hierarchy using `WindowFromPoint` and `ChildWindowFromPointEx` with physical coordinate conversion to client space (`ScreenToClient`).
  - True zero cursor movement: eliminates cursor warping/flicker completely while interacting through the preview window.
  - Automatic fallback to legacy ghost hardware injection on UIPI restriction or inaccessible window handle.
  - Full drag-and-drop support with active button state tracking.
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.4.exe`)**:
  - Rebuilt standalone portable distribution bundle featuring the updated injector daemon.

---

## [0.3.3] - 2026-10-30

### Fixed
- **Physical Multi-Monitor Ground Truth Geometry**:
  - Replaced Electron's DPI-virtualized DIP monitor bounds with true physical desktop coordinates queried directly via Win32 `EnumDisplayMonitors` / `GetMonitorInfo` in `DisplayService`.
  - Correlated Chromium `desktopCapturer` video sources with exact physical display rectangles, fixing large multi-monitor click misalignments caused by mixed DPI scaling (e.g. 150% primary monitor with 100% secondary monitors).
  - Configured native resolution media stream constraints in `getUserMedia` matching physical display dimensions.
  - Added `getmonitors` query command to `injector.cs` and realistic 10ms mouse button depression time to guarantee OS event pump registration.

---

## [0.3.2] - 2026-10-30

### Removed
- **Removed Artificial Cursor Ring Marker (`cursorMarker`)**:
  - Completely removed the green/yellow circular ring indicator overlay from CSS, DOM, and event listeners to keep the viewport clean, professional, and free of visual clutter.

### Fixed
- **Pixel-Perfect 1:1 Target Coordinate Precision**:
  - Implemented exact letterboxing and pillarboxing aspect ratio offset calculations in `calculateTargetCoordinates()` based on intrinsic video stream dimensions (`videoWidth`, `videoHeight`) vs viewport element aspect ratio.
  - Clicks and interactions occurring in empty letterbox margins are cleanly rejected.
  - Enabled Per-Monitor V2 DPI Awareness (`SetProcessDpiAwarenessContext(-4)`) in `injector.cs`, eliminating Windows OS coordinate virtualization and ensuring clicks hit exact physical pixel coordinates on secondary and scaled displays.

---

## [0.3.1] - 2026-10-30

### Fixed
- **Cursor Never Enters Target Screen on Click (Ghost Cursor Perfected)**:
  - Eliminated premature `mousedown` warping that previously teleported the physical cursor to the target display during regular clicks.
  - Implemented Drag-Threshold Detection (5px) in `src/renderer/index.html`: clicks and double-clicks are dispatched atomically without ever triggering mouse down holds or drag moves on the target display.
  - Passed exact local screen origin (`screenX`, `screenY`) to `ghostclick`, `ghostdblclick`, `ghostwheel`, and drag routines to guarantee 100% accurate cursor restoration without depending on OS cursor state during window activation.
  - Added double-restoration and micro-delays in `injector.cs` to defeat Windows asynchronous window activation cursor pull.
  - Maintained Electron window focus post-click so the local preview window retains keyboard and mouse focus seamlessly.

---

## [0.3.0] - 2026-10-30

### Added
- **Standalone Portable Executable (`dist/Show-Second-Screens-Portable-0.3.0.exe`)**:
  - Full single-file Windows x64 portable executable that runs immediately without installation or administrative setup wizards.
  - Zero-footprint sandbox execution with embedded Chromium and Electron runtimes.
- **Packaged Native Binary Resolution** (`src/main/input/adapters/windowsAdapter.cjs`):
  - Added multi-tier injector path resolution supporting `process.resourcesPath`, `app.asar.unpacked`, and development relative paths to ensure `injector.exe` runs flawlessly inside packaged portable bundles.
- **Custom High-Resolution Application Icon**:
  - Generated sleek dark terminal & neon green app icons (`build/icon.ico` and `build/icon.png`) via `scripts/generate-icon.ps1`.
  - Configured icon embedding in `electron-builder.json` and dynamically bound to `BrowserWindow`.
- **Packaging Scripts & Tooling**:
  - Added `electron-builder` configuration (`electron-builder.json`) configured for Windows `portable` target with `extraResources` and `asarUnpack`.
  - Added `npm run build:portable` and `npm run dist` scripts with automatic `prebuild:portable` hook.

---

## [0.2.0] - 2026-10-27

### Added
- **System Tray Integration** (`src/main/tray/trayManager.cjs`):
  - Dynamic vector tray icon with support for Windows, macOS (template image), and Linux.
  - Interactive context menu with Quick Show/Hide toggle, Always-on-Top checkbox, Center Window on Active Screen, and Quit options.
  - Single click and double click tray handlers to toggle preview window visibility.
- **Cross-Platform Input Architecture** (`src/main/input/adapters/`):
  - `WindowsAdapter`: Native Win32 C# `SendInput` with Ghost Cursor microsecond restoration.
  - `MacAdapter`: Native macOS CoreGraphics / AppleScript / `cliclick` integration.
  - `LinuxAdapter`: `xdotool` / `ydotool` supporting X11 and Wayland environments.
  - Dynamic polymorphic adapter selection based on runtime `process.platform`.
- **macOS Window Support**: Added `titleBarStyle: 'hiddenInset'` and traffic light alignment.

### Changed
- Relicensed project from MIT to **Apache License 2.0** (`LICENSE`, `package.json`, `README.md`).

## [0.1.6] - 2026-10-27

### Added
- **Ghost Cursor Mode (Default)**: Keeps the physical mouse cursor 100% on the user's current desktop. Hovering over the preview window no longer warps the cursor across monitors.
- **Microsecond Cursor Restoration**: Clicking, double-clicking, right-clicking, dragging, or scrolling executes instantly at the target monitor's coordinates and immediately restores the cursor back to the user's hand without visible disruption.
- Added toolbar toggle button (`🎯 Tetap di Sini` vs `🚀 Pindah Layar`) giving the user full control to switch between Ghost Mode and Direct Warp Mode.

## [0.1.5] - 2026-10-27

### Fixed
- Fixed window positioning on multi-monitor setups: automatically detects the active display nearest to the user's cursor (`screen.getDisplayNearestPoint`) and centers the window directly in the user's view instead of behind background windows on secondary screens.
- Enhanced `scripts/start.cjs` with immediate terminal startup feedback (`Starting Show Second Screens...`) while filtering out repeating WebRTC C++ warnings.
- Added topmost z-index level (`screen-saver`) and explicit focus/bring-to-top calls.

## [0.1.4] - 2026-10-27

### Fixed
- Completely silenced terminal stderr spam from Chromium WebRTC capture (`mouse_cursor_monitor_win: 5` and `desktop.cc: 170`) by introducing `scripts/start.cjs` with ignored stderr while preserving standard output and app stability.
- Cleaned up development debug logs and finalized production window configuration.

## [0.1.3] - 2026-10-27

### Fixed
- Fixed window visibility issue where the Electron window remained hidden or occluded:
  - Enabled native window framing (`frame: true`) with native title bar, taskbar icon, and standard OS minimize/maximize controls.
  - Set `show: true` directly on creation, eliminating the blocking `ready-to-show` delay during WebRTC media stream initialization.
  - Reverted `npm start` script directly to `electron .` without intermediate child process spawning.
  - Added media permission request auto-approvals in Electron's default session.

## [0.1.2] - 2026-10-27

### Fixed
- Added intelligent stream launcher (`src/main/launcher.cjs`) for `npm start` that filters out repeated internal WebRTC desktop thread (`SetThreadDesktop: 170`) and cursor access (`mouse_cursor_monitor_win: 5`) warnings from the terminal while preserving all actual errors and application logs.

## [0.1.1] - 2026-10-27

### Fixed
- Fixed noisy Chromium WebRTC desktop capturer logs (`desktop.cc(66) SetThreadDesktop: 170` and `mouse_cursor_monitor_win.cc(104) Error = 5`):
  - Configured `thumbnailSize: { width: 0, height: 0 }` during display enumeration to avoid redundant desktop screenshot capture loops.
  - Added `{ cursor: 'never' }` optional constraint in `getUserMedia` stream since cursors are rendered seamlessly by the app.
  - Set Chromium log-level switch (`log-level: 3`) to suppress non-fatal internal WebRTC notices.

## [0.1.0] - 2026-10-27

### Added
- Complete functional Electron application for real-time target display mirroring and interactive remote control.
- Native Win32 input injection engine in C# (`src/main/input/injector.cs` -> `bin/injector.exe`) supporting ultra-low latency mouse moves, clicks, double clicks, right clicks, and scroll wheel events.
- Modular Main Process architecture:
  - `DisplayService`: Display enumeration matching `screen.getAllDisplays()` and `desktopCapturer`.
  - `InputService`: Daemon process manager communicating over stdin with `bin/injector.exe`.
  - `WindowManager`: Frameless, draggable, resizable floating window with always-on-top and opacity controls.
  - `IpcHandlers`: Clean IPC contract bridge.
- Secure Preload script exposing `window.electronAPI`.
- Interactive Renderer Viewport:
  - Sleek modern dark UI with auto-dimming header.
  - 60 FPS video stream mirror using `navigator.mediaDevices.getUserMedia`.
  - 1:1 mathematical coordinate translation mapping viewport clicks to physical monitor pixels.
  - Real-time telemetry (FPS counter, target display coordinates).
- Created comprehensive `AGENTS.md`, `README.md`, `.gitignore`, and shared contracts.
