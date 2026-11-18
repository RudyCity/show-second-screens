# AGENTS.md — Guidelines for AI Coding Agents
# Project: Show Second Screens (Interactive Target Screen Mirror & Remote Control)

This document defines the mandatory Standard Operating Procedures (SOPs) for every AI Agent working in the **show-second-screens** repository. All rules and constraints below are binding without exception.

---

## 1. Project Mission & Core Capabilities

**show-second-screens** is a smart desktop utility designed for:
1. **Target Display Previewing**: Real-time, ultra-low-latency streaming/previewing of a target screen (secondary display, Virtual Display Driver / VDD monitor, or external display) at optimal frame rates.
2. **Interactive Remote Control**: Direct interaction over the preview window (left click, right click, double click, drag-and-drop, scroll wheel, hover, keyboard input) mapped 1:1 to physical target display coordinates.
3. **Movable & Resizable Window**: Floating (Picture-in-Picture), freely draggable, and resizable window preserving aspect ratio cleanly.

---

## 2. Strict Core Mandates

Every agent modifying or adding code must enforce the following rules:

### 2.1. Modular Code (High Cohesion, Loose Coupling)
- **Single Responsibility Principle (SRP)**: Each module, file, class, or function owns a single domain responsibility.
- Maintain strict separation between:
  - **Screen Capture Engine** (target frame capture & monitor enumeration).
  - **Coordinate Translation & Mapping Engine** (preview-to-physical monitor coordinate math).
  - **Input Injection Engine** (OS-level mouse & keyboard simulation).
  - **Window Controller** (window state, drag, resize, always-on-top, opacity, modals).
  - **UI / Renderer Layer** (separated HTML markup, CSS styles, and JS controller; no massive inline monoliths).
  - **IPC Communication Layer** (secure bridge between Main Process and Renderer).
- Avoid god objects, monolithic files, and tightly coupled code.

### 2.2. Clean Project Architecture
Keep the directory structure clean and industry-standard:

```text
show-second-screens/
├── .github/
│   ├── FUNDING.yml
│   └── workflows/
│       └── release.yml
├── .gitignore
├── AGENTS.md                 # AI agent operational rules
├── CHANGELOG.md              # SemVer release changelog
├── LICENSE                   # Apache License 2.0
├── README.md                 # Public project documentation
├── electron-builder.json     # Cross-platform packaging config
├── package.json              # Project manifest & scripts
├── assets/                   # Application icons (.ico, .png)
├── bin/                      # Compiled native binaries (injector.exe)
├── scripts/                  # Launcher & asset helper scripts
└── src/
    ├── main/                 # Electron Main Process
    │   ├── index.cjs         # Entry point & app lifecycle
    │   ├── capture/          # Screen capture & display enumeration
    │   ├── input/            # Native input injection & platform adapters
    │   ├── instance/         # Single-instance lock & conflict resolver
    │   ├── ipc/              # IPC bridge handlers
    │   ├── tray/             # System tray manager
    │   └── window/           # Window, icon & modal management
    ├── preload/              # Context-isolated preload bridge
    ├── renderer/             # Modular UI (index.html, styles.css, renderer.js)
    └── shared/               # Shared contracts, DTOs & math utilities
```

### 2.3. Max 1000 Lines Per File (Hard Limit)
- **HARD CAP OF 1,000 LINES PER FILE**: No source file may exceed 1,000 lines.
- **Refactor Warning**: Once any file reaches 700–800 lines, agents **MUST** split and modularize its logic into separate modules/helpers before adding new functionality.
- Never combine state management, business logic, styling, and markup in a single giant file.

### 2.4. Git Commit Every Completed Change
- Whenever an agent completes a feature, bug fix, or modular refactor, the agent **MUST** commit the changes to Git.
- Commit messages must follow **Conventional Commits**:
  - `feat: <new feature description>`
  - `fix: <bug fix description>`
  - `refactor: <code split / structural improvement>`
  - `perf: <performance / latency / fps optimization>`
  - `docs: <documentation update>`
  - `ci: <CI/CD workflow or build pipeline update>`
  - `chore: <configuration, dependencies, version>`
- Keep commits atomic and incremental.

### 2.5. Sync Version, CHANGELOG.md, and README.md
- **Semantic Versioning (SemVer)**:
  - Breaking/major changes -> bump Major (`1.0.0` -> `2.0.0`).
  - New functional features -> bump Minor (`0.1.0` -> `0.2.0`).
  - Bug fixes / optimizations / patches -> bump Patch (`0.1.0` -> `0.1.1`).
- **Update Version**: Sync the version number in `package.json` and related references.
- **Update `CHANGELOG.md`**: Record `Added`, `Fixed`, `Changed`, or `Removed` entries under the corresponding version and date.
- **Update `README.md`**: Update installation steps, usage instructions, shortcuts/controls, or architecture sections whenever changed.

---

## 3. Technical Specification: Screen Preview & Remote Control

### 3.1. Display Enumeration & Capture
- Detect all physical and virtual displays (including Virtual Display Driver / VDD monitors) connected to the OS (`screen.getAllDisplays()` + native Win32 `EnumDisplayMonitors`).
- Allow the user to pick the target monitor to preview and control.
- Optimize capture stream latency and bandwidth (60 FPS Desktop Media Capture with hardware-accelerated zero-copy compositing).

### 3.2. Coordinate Mapping Formula
To ensure preview clicks land accurately on the target physical display:

1. Obtain target monitor physical resolution $W_{target}$, $H_{target}$ and virtual desktop origin $(X_{target}, Y_{target})$.
2. Obtain actual rendered preview viewport dimensions $W_{canvas}$, $H_{canvas}$.
3. Compute letterbox/pillarbox scale and offsets when aspect ratios differ:
   $$\text{Scale} = \min\left(\frac{W_{canvas}}{W_{target}}, \frac{H_{canvas}}{H_{target}}\right)$$
   $$\text{RenderWidth} = W_{target} \times \text{Scale}, \quad \text{RenderHeight} = H_{target} \times \text{Scale}$$
   $$\text{OffsetX} = \frac{W_{canvas} - \text{RenderWidth}}{2}, \quad \text{OffsetY} = \frac{H_{canvas} - \text{RenderHeight}}{2}$$
4. Compute normalized local cursor coordinates $(x_{local}, y_{local})$:
   $$u = \frac{x_{local} - \text{OffsetX}}{\text{RenderWidth}}, \quad v = \frac{y_{local} - \text{OffsetY}}{\text{RenderHeight}}$$
   *(Ignore events when $u < 0$, $u > 1$, $v < 0$, or $v > 1$)*
5. Project to physical target monitor coordinates:
   $$X_{target\_coord} = X_{target} + (u \times W_{target})$$
   $$Y_{target\_coord} = Y_{target} + (v \times H_{target})$$
6. Dispatch $(X_{target\_coord}, Y_{target\_coord})$ to the **Input Injection Service** via IPC.

### 3.3. Remote Input Simulation
- Support full interaction:
  - Mouse Move (throttled / RAF-batched to avoid IPC saturation).
  - Mouse Down, Mouse Up, Click, Double Click.
  - Right Click (Target context menus).
  - Mouse Drag (button-down hold across coordinates).
  - Mouse Wheel / Scroll.
  - Optional/toggleable Keyboard Event forwarding when focused.

### 3.4. Window Behavior (Draggable & Resizable)
- Support frameless or sleek custom headerbar with `-webkit-app-region: drag` on the header and `-webkit-app-region: no-drag` on interactive controls and the preview viewport.
- Support **Always on Top** pinning, opacity levels, and minimize/maximize/tray hide.

---

## 4. Development Best Practices

1. **PowerShell Compatibility**:
   - Always use semicolons (`;`) instead of `&&` when chaining PowerShell commands (e.g. `npm run build; npm test`).
2. **Resource Cleanup**:
   - Always dispose screen capture streams, timers, child processes, and IPC listeners on window close or display switch to prevent memory leaks.
3. **Type Safety**:
   - Enforce strict typing where TypeScript is used (`"strict": true`) and avoid untyped `any` without documented justification.
4. **Error Handling**:
   - Handle dynamic display disconnection or DPI/resolution changes cleanly (`display-added`, `display-removed`, `display-metrics-changed`).

---

## 5. UI/UX Quality & Frontend Design Standards

All UI/UX elements must maintain modern visual quality:
- **Design Theme**: Modern Dark Terminal / Sleek Minimalist UI with crisp contrast and clean typography.
- **Tactile Feedback**: Responsive controls with live status telemetry (FPS, target coordinates, display resolution).
- **Non-Obtrusive HUD**: Compact overlay controls that auto-dim when idle so they do not obstruct the mirrored screen.
- Free of generic AI visual slop (no gratuitous purple gradients, heavy borders, or distracting animations).

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `antislop.md` (core) and then the skill for the task:
- UI / visual: `C:\Users\USER\.gemini\config\skills\antislop-ui\SKILL.md`
- Copy & text: `C:\Users\USER\.gemini\config\skills\antislop-copywriting\SKILL.md`
- People: `C:\Users\USER\.gemini\config\skills\antislop-human\SKILL.md`
- Mobile / responsive: `C:\Users\USER\.gemini\config\skills\antislop-layoutmobile\SKILL.md`
- Code comments: `C:\Users\USER\.gemini\config\skills\antislop-code\SKILL.md`
Before starting, ask the user when antislop applies: during the work, or after it is done.
<!-- antislop:end -->
