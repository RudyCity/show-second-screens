# Show Second Screens 🖥️✨

> **Interactive Target Screen Mirror & Remote Control Window**
> Real-time 60 FPS streaming and 1:1 remote interaction for secondary, external, or virtual displays inside a floating, movable, and resizable Picture-in-Picture window with **Ghost Cursor Mode** and **System Tray** support.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green.svg)](#5--cross-platform-input-architecture)
[![Electron: v33+](https://img.shields.io/badge/Electron-v33+-47848F.svg)](https://www.electronjs.org/)
[![Version: 0.7.0](https://img.shields.io/badge/Version-0.7.0-22c55e.svg)](CHANGELOG.md)
[![CI & Release](https://github.com/RudyCity/show-second-screens/actions/workflows/release.yml/badge.svg)](https://github.com/RudyCity/show-second-screens/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/RudyCity/show-second-screens?color=22c55e)](https://github.com/RudyCity/show-second-screens/releases/latest)
[![Donate: Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Creator-FF5E5B?logo=ko-fi&logoColor=white)](https://ko-fi.com/rudycity)

---

## 🌟 Why Show Second Screens?

Working across multiple monitors or virtual displays (*Virtual Display Driver / VDD*) on a single desk often slows you down:
- You constantly turn your head or drag your cursor far across screens.
- Software virtual displays have no physical panel you can glance at directly.
- Most screen-mirroring tools are passive (*view-only*) and do not let you click or control what you see.

**Show Second Screens** solves this by placing a floating, resizable **Picture-in-Picture** window on your main screen that streams your target display at 60 FPS with full **1:1 remote interaction** — click, double-click, right-click, scroll, and drag items on the target display directly from the preview window without leaving your primary workspace.

---

## 🚀 Key Features

### 1. 🎯 Ghost Cursor Injection Mode (Default)
- **Native Windows input**: Win32 `SendInput` handles remote clicks, scroll, and drag. Clicks briefly move the OS pointer and restore it. During a real drag, the OS cursor follows the dragged item and returns only after release.
- **Cursor Stays in Your Hand**: Hovering over the preview window never pulls your physical mouse cursor onto the target display.
- **Direct Mode Option**: Toggle the toolbar button from `🎯 Stay Here` (Ghost Mode) to `🚀 Move Cursor` (Direct Mode) whenever you intentionally want your physical cursor to move to the target screen.

### 2. 🕶️ Smart Hide — No More Self-Preview (v0.5.0 source)
- **On by default.** Automatically stops capturing whichever monitor currently contains the Show Second Screens window, without turning off the physical monitor.
- Move the application window from Screen 1 to Screen 2: Screen 1 resumes previewing and Screen 2 is automatically excluded. The same behavior applies in Grid Mode and Single Mode.
- When only one monitor is available, Smart Hide pauses capture and explains why. Turn it off with the **◉ Smart Hide** toolbar button if you intentionally want to capture the local screen.
- A persisted on/off preference and native move/resize detection make Smart Hide predictable across restarts and displays with different resolutions or negative desktop coordinates.

### 3. 🗂️ Multi-Monitor Grid Mode (v0.4.0 source)
- Switch between **Single** and **Grid** in the titlebar to display every capture-ready physical or virtual monitor simultaneously.
- Choose responsive **Auto / 2 / 3 / 4 columns**. Every tile has an independent video stream and mouse hit area; select **Focus** to switch to single-screen control.
- Ghost Cursor and Direct Mode mouse input remain available per tile, with accurate physical coordinates across negative monitor origins and letterboxed previews.
- Refresh or hot-plug a monitor to rebuild the grid; switching modes stops unused capture streams. The selected view and column preference are retained.
- Grid and Smart Hide are included in published releases starting with v0.5.0.

### 4. 🖱️ Cross-Monitor Drag & Drop (v0.6.0)
- In **Grid Mode**, drag from one monitor preview to another: keep holding the left button while moving across tiles and release over the destination preview. Physical target coordinates follow the destination monitor.
- In **Single Mode**, drag continues when the pointer temporarily leaves the preview video; drop at the last valid target point when released outside the preview.
- A compact overlay shows the drag origin and current target. **Esc**, lost focus, monitor refresh, switching modes, and closing the app safely release any held virtual button.
- Drag movement is coalesced per animation frame; native macOS and Linux X11 helpers serialize button-down, move, and button-up commands to avoid reordering.
- **Platform limits:** Windows uses the native injector; macOS drag requires `cliclick` plus Accessibility permission; Linux drag uses `xdotool` on X11. Wayland support depends on compositor permissions and is not guaranteed. Physical multi-monitor drag has not been verified on every OS configuration.

### 5. 🖥️ Ultra-Low-Latency 60 FPS Streaming
- Hardware-accelerated screen capture via WebRTC Desktop Media Capture with a zero-copy GPU video compositing pipeline.
- Letterbox-aware coordinate mapping preserves display alignment across monitor sizes, negative origins, and mixed-DPI configurations.

### 5. 📌 System Tray Integration
- Always-visible dynamic tray icon in the Windows Taskbar, macOS Menu Bar, and Linux AppIndicator.
- **Quick Context Menu**:
  - `Show Window` / `Hide Window`
  - `Always On Top` (Toggle)
  - `Center Window on Active Screen` (Brings the preview window back to the center of the monitor where your cursor is)
  - `☕ Support via Ko-fi` (Opens the in-app Ko-fi support modal)
  - `Quit`
- Click or double-click the tray icon to toggle preview window visibility instantly.
- The full application interface, close confirmation, secondary-instance warning, and support-window menu now use English.
- The titlebar X, Alt+F4, and in-app Close button prompt **Tutup Jendela (Tetap di Tray)**, **Keluar Sepenuhnya**, or **Batal**. Closing just the window keeps the process and tray icon running and can be restored through the tray. The tray's **Quit** command (and OS-wide Quit) exits directly without a second prompt.
- On startup, a single system notification confirms that the app is running in the tray and explains how to reopen or quit it. Windows uses a tray notification; macOS/Linux use native notifications where supported. System notification settings may suppress the alert.

### 6. 🔢 Identify Displays (v0.7.0)
- Click **▣ Identify** next to **Refresh** to show large, numbered display badges directly on every connected physical or virtual monitor for five seconds.
- The displayed numbers match the **Display 1 / Display 2 / ...** names in the monitor selector and Grid Mode, including mixed-DPI and monitors with negative desktop coordinates. The badge identifies the primary display too.
- Badges do not take focus or intercept clicks, and disappear automatically. Repeated clicks restart the five-second countdown; monitor changes or quitting clear all badges.
- If a window manager does not support click-through overlays (some Wayland environments), identification is skipped rather than blocking input.

### 7. 🪟 Smart Multi-Monitor Window Positioning
- Automatically detects the monitor under your cursor at startup (`screen.getDisplayNearestPoint`) and **opens maximized on that monitor by default**. Use the native Restore button to return to the centered floating size; minimize/hide and reopen preserve window state.
- Supports **Always-on-Top** (*Pin*) and cyclic window transparency (**Opacity: 100% / 85% / 65%**).

### 8. 🔄 Cross-Platform Input Architecture
- **Windows**: Native Win32 C# daemon (`bin/injector.exe`) using Per-Monitor V2 DPI awareness, `SendInput`, `SetCursorPos`, and `EnumDisplayMonitors`.
- **macOS**: CoreGraphics / AppleScript / `cliclick` adapter with `hiddenInset` titlebar styling.
- **Linux**: `xdotool` (X11) and `ydotool` (Wayland) adapter with automatic cursor position restoration.

### 9. 🛡️ Single Instance & Smart Kill Confirmation
- Prevents duplicate background or portable processes from colliding.
- Prompts with an interactive dialog when another running instance is detected, letting you cleanly terminate existing processes (`Show Second Screens.exe`, portable wrappers, and `injector.exe`) via process-tree cleanup or bring the active window to focus.

---

## 🧩 Enabling a Virtual Display (VDD)

If you only have **one physical monitor** (for example, on a laptop or single-monitor desktop) and want to create a virtual second screen to mirror and control inside **Show Second Screens**:

### Windows 10 / 11 — Virtual Display Driver (VDD)
We recommend the open-source [**Virtual Display Driver (VDD)**](https://github.com/VirtualDrivers/Virtual-Display-Driver):

1. **Install VDD** via Winget (or download the installer from the [VDD GitHub Releases](https://github.com/VirtualDrivers/Virtual-Display-Driver/releases)):
   ```powershell
   winget install --id=VirtualDrivers.Virtual-Display-Driver -e
   ```
2. **Enable & Extend the Virtual Monitor**:
   - Open **Windows Settings → System → Display** (or press `Win + P` and select **Extend**).
   - Ensure the new virtual display is set to **Extend these displays** (not *Duplicate*) and choose your preferred resolution/refresh rate (e.g., `1920x1080 @ 60Hz`).
   - Optionally use the bundled *Virtual Driver Control* companion app or `vdd_settings.xml` to toggle the virtual monitor on/off or add multiple virtual screens.
3. **Select It in Show Second Screens**:
   - Launch **Show Second Screens** and pick `Screen 2` (your virtual display) from the dropdown selector in the titlebar. You can now view and interact with your virtual display inside a floating window on your main screen!

### macOS & Linux Alternatives
- **macOS**: Use a virtual display utility such as [BetterDisplay](https://github.com/waydabber/BetterDisplay) or an HDMI/USB-C dummy plug, then set the display to *Extended*.
- **Ubuntu / Linux**: Create a virtual output using `xrandr` (`--addmode` on a disconnected output or `xserver-xorg-video-dummy`) or a physical dummy plug, then extend your desktop.

---

## 📦 Download & Quick Start

### Option A: Download Pre-Built Binaries (Windows, macOS, Ubuntu)
Download the latest published builds directly from [**GitHub Releases**](https://github.com/RudyCity/show-second-screens/releases/latest) without installing Node.js:
- **Windows (`x64` Portable)**: `Show-Second-Screens-Portable-0.7.0.exe` (double-click to run immediately, no installation required).
- **macOS (`arm64` & `x64`)**: `Show-Second-Screens-macOS-0.7.0-<arch>.dmg` or `.zip`.
- **Ubuntu / Linux (`x64`)**: `Show-Second-Screens-Linux-0.7.0-x86_64.AppImage` or `Show-Second-Screens-Linux-0.7.0-amd64.deb`.

---

### Option B: Run & Build from Source

#### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18, v20, or v22+)
- **Windows**: Windows 10 / 11 (`csc.exe` C# compiler is built into `.NET Framework`).
- **macOS**: macOS Monterey / Ventura / Sonoma / Sequoia (required: `brew install cliclick` for drag-and-drop and enable Accessibility permissions).
- **Linux**: Ubuntu / Debian / Fedora / Arch (install `sudo apt install xdotool` for X11 drag-and-drop; Wayland input control varies).

#### 2. Clone the Repository
```bash
git clone https://github.com/RudyCity/show-second-screens.git
cd show-second-screens
```

#### 3. Install Dependencies
```bash
npm install
```

#### 4. Compile the Windows Input Injector (Optional)
A precompiled `bin/injector.exe` is included. If you modify `src/main/input/injector.cs`:
```powershell
npm run build:injector
```

#### 5. Run in Development Mode
```bash
npm start
```

#### 6. Build Cross-Platform Packages
Cross-platform release builds for **Ubuntu, macOS, and Windows** run automatically via GitHub Actions ([`.github/workflows/release.yml`](.github/workflows/release.yml)) on every `v*` tag push or manual dispatch. To build locally per platform:
```powershell
# Windows Portable (.exe) — aliases: npm run build:portable / npm run dist
npm run build:win

# macOS (.dmg & .zip for x64 + arm64, run on macOS)
npm run build:mac

# Ubuntu / Linux (.AppImage & .deb, run on Linux)
npm run build:linux
```
Output artifacts are placed in `dist/`.

---

## 🎮 Controls & Usage

| Control / Action | Description |
|---|---|
| **Display Dropdown** | Select the physical or virtual monitor (e.g., VDD screen) to mirror and control. Selecting a display in Grid Mode focuses it. |
| **`◉ Smart Hide`** | Automatically pauses capture of the display containing the app window; toggle off to preview that display intentionally. |
| **`▦ Grid` / `▣ Single`** | Toggle a multi-monitor overview with live interactive tiles versus the focused preview. |
| **Grid Columns** | Choose Auto, 2, 3, or 4 columns; narrow windows automatically reduce the count to keep previews usable. |
| **Focus (per tile)** | Open a monitor tile in full-window single-screen mode. |
| **Refresh** | Re-detect available monitors without restarting the app. |
| **Telemetry Badges (`FPS`, `X/Y`)** | Live stream frame rate and mapped target display coordinates. |
| **`🎯 Tetap di Sini` / `🚀 Pindah Layar`** | Toggle cursor mode between **Ghost Mode** (cursor stays on main screen) and **Direct Mode** (cursor moves to target screen). |
| **`📌 Always On Top`** | Pin or unpin the preview window above all other windows. |
| **`🌓 100%`** | Cycle window opacity (`100%` $\to$ `85%` $\to$ `65%`). |
| **`☕ Donate`** | Open the in-app Ko-fi support modal window. |
| **Left Click** | Click elements on the target monitor. |
| **Right Click** | Open context menus on the target monitor. |
| **Double Click** | Open files, folders, or shortcuts on the target monitor. |
| **Drag & Drop** | Hold the left button on a preview and move; in Grid Mode continue into a different tile to drop on that monitor. A small overlay shows the destination. Esc safely releases a held button. |
| **Scroll Wheel** | Scroll vertically on the target monitor. |
| **System Tray Icon** | Left-click to show/hide window; right-click for quick controls. |

---

## 🏗️ Modular Architecture

The project strictly follows the Single Responsibility Principle (SRP) and the 1,000-line-per-file cap defined in [AGENTS.md](AGENTS.md):

```text
show-second-screens/
├── .github/
│   ├── FUNDING.yml           # GitHub Sponsor configuration (Ko-fi)
│   └── workflows/
│       └── release.yml       # GitHub Actions CI & Release (Ubuntu, macOS, Windows)
├── .editorconfig             # Code formatting & indentation rules
├── .gitignore                # Build & log ignore patterns
├── AGENTS.md                 # AI Coding Agent operational guidelines
├── CHANGELOG.md              # SemVer release history
├── LICENSE                   # Apache License 2.0
├── README.md                 # Project documentation
├── electron-builder.json     # Cross-platform packaging configuration
├── package.json              # Project manifest & scripts
├── assets/
│   ├── icon.ico              # Multi-resolution Windows app icon
│   └── icon.png              # High-resolution app & tray icon
├── bin/
│   └── injector.exe          # Compiled Win32 C# SendInput/monitor daemon
├── scripts/
│   ├── generate-icon.ps1     # App icon asset generator script
│   └── start.cjs             # Launcher filtering benign WebRTC stderr noise
├── src/
│   ├── main/                 # Electron Main Process & OS Bridges
│   │   ├── index.cjs         # Application entrypoint & lifecycle
│   │   ├── capture/          # Display enumeration & physical monitor matching
│   │   │   └── displayService.cjs
│   │   ├── input/            # Cross-platform input injection engine
│   │   │   ├── inputService.cjs
│   │   │   ├── injector.cs   # Win32 C# SendInput & PostMessage injector source
│   │   │   └── adapters/     # Platform adapters (Windows, macOS, Linux)
│   │   │       ├── baseAdapter.cjs
│   │   │       ├── windowsAdapter.cjs
│   │   │       ├── macAdapter.cjs
│   │   │       └── linuxAdapter.cjs
│   │   ├── instance/         # Single-instance lock & process conflict handler
│   │   │   └── singleInstanceManager.cjs
│   │   ├── ipc/              # IPC channel handlers
│   │   │   └── ipcHandlers.cjs
│   │   ├── tray/             # Cross-platform System Tray manager
│   │   │   └── trayManager.cjs
│   │   └── window/           # Window, Icon & Ko-fi Modal manager
│   │       ├── iconResolver.cjs
│   │       └── windowManager.cjs
│   ├── preload/              # Context-isolated preload bridge
│   │   └── index.cjs
│   ├── renderer/             # Modular UI (Viewport, Styles & Controller)
│   │   ├── index.html
│   │   ├── renderer.js
│   │   ├── gridMode.js
│   │   ├── smartHide.js
│   │   ├── gridMath.js
│   │   ├── grid.css
│   │   └── styles.css
│   └── shared/               # Shared types, constants & coordinate math utilities
│       ├── constants/index.ts
│       ├── types/index.ts
│       └── utils/coordinateMapper.ts
```

---

## 📐 Coordinate Mapping Formula

To map preview clicks accurately onto the target physical display:

1. **Letterbox / Pillarbox Aspect Ratio**:
   $$\text{Scale} = \min\left(\frac{W_{canvas}}{W_{target}}, \frac{H_{canvas}}{H_{target}}\right)$$
   $$\text{RenderWidth} = W_{target} \times \text{Scale}, \quad \text{RenderHeight} = H_{target} \times \text{Scale}$$
   $$\text{OffsetX} = \frac{W_{canvas} - \text{RenderWidth}}{2}, \quad \text{OffsetY} = \frac{H_{canvas} - \text{RenderHeight}}{2}$$

2. **Normalized Local Cursor Position $(x_{local}, y_{local})$**:
   $$u = \frac{x_{local} - \text{OffsetX}}{\text{RenderWidth}}, \quad v = \frac{y_{local} - \text{OffsetY}}{\text{RenderHeight}}$$

3. **Projection to Physical Target Monitor Coordinates**:
   $$X_{target} = X_{origin} + (u \times W_{target})$$
   $$Y_{target} = Y_{origin} + (v \times H_{target})$$

---

## 🤝 Contributing & AI Agent Guidelines

Contributors and AI Coding Agents must follow the engineering standards in [AGENTS.md](AGENTS.md):
- **Modular & High Cohesion**: Keep responsibilities cleanly separated; avoid god objects.
- **Max 1,000 Lines Per File**: Refactor into sub-modules once any file reaches 700–800 lines.
- **Conventional Commits**: Use `feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `ci:`, `chore:`.
- **SemVer Sync**: Keep `package.json`, `CHANGELOG.md`, and `README.md` synchronized for every release.

---

## ☕ Support the Creator

If **Show Second Screens** improves your multi-monitor or virtual display workflow, consider buying me a coffee on **Ko-fi**:

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/rudycity)

👉 **[https://ko-fi.com/rudycity](https://ko-fi.com/rudycity)**

Every bit of support helps keep improvements and cross-platform builds going! ❤️

---

## 📄 License

This project is licensed under the **Apache License, Version 2.0**. See [LICENSE](LICENSE) for full terms.

Copyright © 2026 **RudyCity**. Licensed under the [Apache License, Version 2.0](LICENSE).
