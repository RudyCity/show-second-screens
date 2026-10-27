# Changelog

All notable changes to the **show-second-screens** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
