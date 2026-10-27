# Changelog

All notable changes to the **show-second-screens** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
