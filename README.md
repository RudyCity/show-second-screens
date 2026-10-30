# Show Second Screens 🖥️✨

> **Interactive Target Screen Mirror & Remote Control Window**
> Real-time streaming and 1:1 remote interaction for secondary, external, or virtual displays inside a floating, movable, and resizable window with **Ghost Cursor Mode** and **System Tray** support.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-green.svg)](#cross-platform-architecture)
[![Electron: v33+](https://img.shields.io/badge/Electron-v33+-47848F.svg)](https://www.electronjs.org/)
[![Version: 0.3.0](https://img.shields.io/badge/Version-0.3.0-emerald.svg)](CHANGELOG.md)

---

## 🌟 Mengapa Show Second Screens?

Ketika bekerja dengan banyak monitor atau layar virtual (*Virtual Display Driver / VDD*), memantau layar samping sering kali merepotkan:
- Anda harus sering memalingkan leher atau memindahkan kursor mouse jauh melintasi beberapa monitor.
- Layar virtual sering kali tidak memiliki output fisik yang dapat dilihat secara langsung.
- Kebanyakan aplikasi mirror hanya menampilkan gambar pasif (hanya *view-only*), tanpa kemampuan klik dan kendali langsung.

**Show Second Screens** menyelesaikan masalah ini dengan menghadirkan jendela mengambang (*Picture-in-Picture*) yang menampilkan streaming 60 FPS dari layar target lengkap dengan **interaksi remote 1:1**: Anda dapat mengklik, mengetik, scroll, dan drag file pada layar target langsung dari jendela preview tanpa meninggalkan desktop utama Anda!

---

## 🚀 Fitur Utama

### 1. 🎯 Ghost Cursor Mode (Default)
- **Kursor Fisik Tetap di Tangan Anda**: Kursor mouse Anda tidak akan ditarik paksa keluar jendela menuju layar target saat mengarahkan mouse (*hover*).
- **Restorasi Mikrodetik (<0.5ms)**: Saat melakukan klik, double-click, klik kanan, drag, atau scroll wheel, engine input mengeksekusi aksi di layar target dan seketika mengembalikan (*restore*) kursor ke posisi tangan Anda di jendela lokal.
- **Opsi Mode Direct**: Tombol `🎯 Tetap di Sini` pada toolbar dapat di-toggle menjadi `🚀 Pindah Layar` jika Anda sengaja ingin memindahkan kursor fisik ke layar target.

### 2. 🖥️ Streaming Layar 60 FPS Latensi Ultra-Rendah
- Menangkap layar target secara *hardware-accelerated* menggunakan Desktop Media Capture WebRTC.
- Auto-letterbox calculation: Rasio aspek layar target selalu dipertahankan dengan presisi tinggi.

### 3. 📌 Integrasi System Tray (Baki Sistem)
- Ikon dinamis di pojok Taskbar Windows, macOS Menu Bar, dan Linux AppIndicator.
- **Menu Konteks Cepat**:
  - `Show Window` / `Hide Window`
  - `Always On Top` (Toggle)
  - `Center Window on Active Screen` (Mengembalikan posisi jendela tepat ke tengah monitor aktif)
  - `Quit`
- Klik atau double-click pada ikon tray untuk menyembunyikan/menampilkan jendela preview secara instan.

### 4. 🪟 Smart Multi-Monitor Window Positioning
- Jendela aplikasi otomatis mendeteksi posisi kursor Anda saat dibuka (`screen.getDisplayNearestPoint`) dan menempatkan jendela tepat di tengah monitor aktif, bukan tersembunyi di belakang monitor lain.
- Mendukung mode **Always-on-Top** (*Pin*) dan pengaturan transparansi (*Opacity: 100% / 85% / 65%*).

### 5. 🔄 Arsitektur Input Lintas Platform
- **Windows**: Menggunakan native Win32 C# daemon (`bin/injector.exe`) dengan `SendInput` & `SetCursorPos`.
- **macOS**: Menggunakan CoreGraphics / AppleScript / `cliclick` adapter dengan window styling `hiddenInset`.
- **Linux**: Menggunakan `xdotool` (X11) dan `ydotool` (Wayland) dengan pemulihan lokasi kursor otomatis.

---

## 📦 Panduan Instalasi & Menjalankan (Quick Start)

### 1. Prasyarat Sistem
- [Node.js](https://nodejs.org/) (versi 18, 20, atau 22+)
- **Windows**: Windows 10 / 11 (C# compiler `csc.exe` sudah terpasang bawaan di `.NET Framework`).
- **macOS**: macOS Monterey / Ventura / Sonoma / Sequoia (opsional: `brew install cliclick` untuk performa input maksimal).
- **Linux**: Ubuntu / Debian / Fedora / Arch (opsional: `sudo apt install xdotool` untuk simulasi mouse).

### 2. Clone Repositori
```bash
git clone https://github.com/RudyCity/show-second-screens.git
cd show-second-screens
```

### 3. Instalasi Dependensi
```bash
npm install
```

### 4. Kompilasi Input Injector (Khusus Windows, sudah terkompilasi bawaan)
Jika Anda memodifikasi kode C# di `src/main/input/injector.cs`:
```powershell
npm run build:injector
```

### 5. Menjalankan Aplikasi (Mode Development)
```bash
npm start
```

### 6. Membuat Executable Portable Windows (.exe)
Untuk membuat file executable mandiri (*single-file portable*) yang dapat langsung dijalankan tanpa instalasi:
```powershell
npm run build:portable
```
File executable portable akan otomatis dibuat di folder `dist/`:
- `dist/Show-Second-Screens-Portable-0.3.0.exe` (langsung double-click untuk menjalankan).

---

## 🎮 Cara Penggunaan di Jendela Aplikasi

| Tombol / Aksi | Fungsi |
|---|---|
| **Pilih Layar (Dropdown)** | Memilih monitor fisik atau virtual yang ingin dipantau. |
| **`🎯 Tetap di Sini`** | Toggle mode kursor: **Tetap di Sini (Ghost Mode)** vs **Pindah Layar (Direct Mode)**. |
| **`📌 Always On Top`** | Mengunci jendela preview agar selalu mengambang di atas jendela aplikasi lain. |
| **`🌓 100%`** | Mengubah tingkat transparansi jendela (100% $\to$ 85% $\to$ 65%). |
| **Klik Kiri Preview** | Mengklik elemen pada monitor target. |
| **Klik Kanan Preview** | Membuka menu konteks (*Context Menu*) pada monitor target. |
| **Double Click** | Membuka file, shortcut, atau folder di monitor target. |
| **Drag & Drop** | Menahan klik kiri sambil menggeser mouse untuk memindahkan objek di layar target. |
| **Scroll Wheel** | Menggulir layar target ke atas atau ke bawah. |
| **Ikon System Tray** | Klik kiri untuk sembunyikan/tampilkan jendela; klik kanan untuk menu opsi cepat. |

---

## 🏗️ Struktur Arsitektur Modular

Struktur direktori mematuhi Single Responsibility Principle (SRP) dan batasan maksimal 1000 baris per file sesuai panduan [AGENTS.md](AGENTS.md):

```text
show-second-screens/
├── .editorconfig             # Standar indentasi dan formatting berkas
├── .gitignore                # Aturan ignore berkas build & log
├── AGENTS.md                 # Standar operasional wajib AI Coding Agent
├── CHANGELOG.md              # Riwayat perubahan per versi (SemVer)
├── LICENSE                   # Lisensi MIT
├── README.md                 # Dokumentasi publik proyek
├── package.json              # Manifest dependensi & scripts
├── bin/
│   └── injector.exe          # Binary Win32 C# SendInput daemon (Windows)
├── scripts/
│   └── start.cjs             # Process launcher dengan filter WebRTC noise
├── src/
│   ├── main/                 # Main Process (Electron Lifecycle & OS Bridges)
│   │   ├── index.cjs         # App entrypoint & bootstrap
│   │   ├── capture/          # Monitor enumeration & capture service
│   │   │   └── displayService.cjs
│   │   ├── input/            # Cross-platform input injection engine
│   │   │   ├── inputService.cjs
│   │   │   ├── injector.cs   # Source code C# Win32 injector
│   │   │   └── adapters/     # Adapters per platform (Windows, macOS, Linux)
│   │   │       ├── baseAdapter.cjs
│   │   │       ├── windowsAdapter.cjs
│   │   │       ├── macAdapter.cjs
│   │   │       └── linuxAdapter.cjs
│   │   ├── ipc/              # IPC Channel Handlers
│   │   │   └── ipcHandlers.cjs
│   │   ├── tray/             # System Tray Manager (Windows, macOS, Linux)
│   │   │   └── trayManager.cjs
│   │   └── window/           # Window Manager (Draggable, Resizable, Topmost)
│   │       └── windowManager.cjs
│   ├── preload/              # Secure Preload Layer (Context Isolation)
│   │   └── index.cjs
│   ├── renderer/             # Frontend UI (Preview Viewport & Control Toolbar)
│   │   └── index.html
│   └── shared/               # Shared Types, DTOs, dan Math Utilities
│       ├── constants/index.ts
│       ├── types/index.ts
│       └── utils/coordinateMapper.ts
```

---

## 📐 Formula Pemetaan Koordinat

Untuk memastikan klik pada kanvas preview tepat sasaran pada monitor fisik target:

1. **Rasio Aspek Letterbox**:
   $$\text{Scale} = \min\left(\frac{W_{canvas}}{W_{target}}, \frac{H_{canvas}}{H_{target}}\right)$$
   $$\text{RenderWidth} = W_{target} \times \text{Scale}, \quad \text{RenderHeight} = H_{target} \times \text{Scale}$$
   $$\text{OffsetX} = \frac{W_{canvas} - \text{RenderWidth}}{2}, \quad \text{OffsetY} = \frac{H_{canvas} - \text{RenderHeight}}{2}$$

2. **Normalisasi Posisi Kursor Lokal $(x_{local}, y_{local})$**:
   $$u = \frac{x_{local} - \text{OffsetX}}{\text{RenderWidth}}, \quad v = \frac{y_{local} - \text{OffsetY}}{\text{RenderHeight}}$$

3. **Proyeksi ke Koordinat Fisik Monitor Target**:
   $$X_{target} = X_{origin} + (u \times W_{target})$$
   $$Y_{target} = Y_{origin} + (v \times H_{target})$$

---

## 🤝 Panduan Kontribusi & Aturan AI Agent

Proyek ini memiliki panduan operasional ketat untuk pengembang dan AI Coding Agent di [AGENTS.md](AGENTS.md):
- **Modular & High Cohesion**: Dilarang membuat god-object atau menyatukan logika yang tidak sejenis.
- **Maksimal 1000 Baris Per File**: Setiap berkas kode wajib di bawah 1000 baris. Lakukan refaktor saat mencapai 700–800 baris.
- **Git Commit Tiap Perubahan**: Gunakan format [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`).
- **SemVer**: Perbarui nomor versi di `package.json`, catat di `CHANGELOG.md`, dan sinkronkan `README.md`.

---

## 📄 Lisensi

Didistribusikan di bawah Lisensi Apache 2.0. Lihat berkas [LICENSE](LICENSE) untuk informasi lebih lanjut.

Copyright © 2026 **RudyCity**. All rights reserved.
