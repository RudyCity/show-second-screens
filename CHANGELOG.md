# Changelog

All notable changes to the **show-second-screens** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
