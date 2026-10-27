# Show Second Screens

> **Interactive Target Screen Mirror & Remote Control Window**
> Preview secondary or virtual displays in a floating, movable, and resizable window with 1:1 remote mouse interaction.
> Cross-platform support for **Windows**, **macOS**, and **Linux** with **System Tray** integration.

---

## Fitur Utama

- 🖥️ **Real-time Target Screen Preview**: Live streaming layar target 60 FPS dengan latensi ultra-rendah.
- 🎯 **Ghost Cursor Mode (Default)**:
  - Kursor fisik Anda **100% tetap di desktop dan jendela saat ini**. Kursor tidak ditarik keluar layar saat mengarahkan pointer ke preview.
  - Saat mengklik atau scroll, engine input melakukan eksekusi mikrodetik (<0.5ms) ke layar target dan langsung memulihkan posisi kursor kembali ke tangan Anda.
- 🔄 **Cross-Platform Input Engine**:
  - **Windows**: Menggunakan native C# Win32 SendInput engine (`bin/injector.exe`).
  - **macOS**: Menggunakan CoreGraphics / AppleScript / `cliclick` adapter.
  - **Linux**: Menggunakan `xdotool` / `ydotool` (mendukung X11 dan Wayland).
- 📌 **System Tray Integration**:
  - Ikon baki sistem (*System Tray*) di pojok taskbar/menu bar.
  - Menu konteks tray: Tampilkan/Sembunyikan jendela, Always on Top, Reset posisi ke monitor aktif, dan Keluar.
  - Klik / klik ganda pada ikon tray untuk toggle sembunyikan atau tampilkan window seketika.
- 📐 **Presisi Pemetaan Koordinat (1:1)**:
  - Konversi koordinat viewport lokal ke monitor target memperhitungkan letterbox offset, DPI scaling, dan resolusi asli.
- 🪟 **Movable & Resizable Floating Window**:
  - Otomatis terbuka di tengah monitor aktif tempat kursor Anda berada (`getDisplayNearestPoint`).
  - Mendukung resize bebas, always-on-top, dan pengaturan transparansi (opacity).

---

## Cara Menjalankan Aplikasi (Quick Start)

### 1. Prasyarat
- **Node.js** (v18+ atau v20+)
- **OS**: Windows, macOS, atau Linux (Ubuntu/Debian/Fedora/Arch)

### 2. Instalasi Dependensi
Jalankan di terminal:
```powershell
npm install
```

### 3. Kompilasi Native Input Injector (Khusus Windows, sudah terkompilasi bawaan)
```powershell
npm run build:injector
```

### 4. Menjalankan Aplikasi
```powershell
npm start
```

---

## Panduan Penggunaan di Jendela Aplikasi

1. **Memilih Layar**: Gunakan dropdown pada header atas untuk memilih monitor target yang ingin dipantau.
2. **Mode Kursor (`🎯 Tetap di Sini` vs `🚀 Pindah Layar`)**:
   - **`🎯 Tetap di Sini`** (Default): Kursor fisik Anda tidak akan berpindah ke layar kedua.
   - **`🚀 Pindah Layar`**: Kursor fisik langsung berpindah ke layar kedua saat mouse digerakkan di atas preview.
3. **Memindahkan Jendela (Draggable)**: Drag titlebar/header untuk memindahkan jendela.
4. **Mengubah Ukuran (Resizable)**: Drag sudut jendela untuk memperbesar/memperkecil preview.
5. **System Tray**:
   - Klik ikon monitor hijau di system tray untuk minimize/restore jendela.
   - Klik kanan ikon tray untuk menu cepat (Toggle Window, Always on Top, Center Window, Quit).

---

## Arsitektur Modular (Skeleton Rapi)

Proyek ini dibangun menggunakan arsitektur modular yang ketat:

```text
show-second-screens/
├── AGENTS.md                 # Standar operasional wajib AI Agent
├── CHANGELOG.md              # Log riwayat perubahan versi
├── README.md                 # Dokumentasi proyek & panduan running
├── package.json              # Versi & manifest dependensi
├── bin/
│   └── injector.exe          # Native Win32 input injection engine (Windows)
├── scripts/
│   └── start.cjs             # Clean process launcher
├── src/
│   ├── main/                 # Main Process
│   │   ├── index.cjs         # App lifecycle & bootstrapping
│   │   ├── window/           # Window Manager (Multi-monitor detection)
│   │   ├── capture/          # Screen Capture & Monitor Enumeration
│   │   ├── input/            # Cross-platform Input Service
│   │   │   ├── inputService.cjs
│   │   │   ├── injector.cs   # C# Win32 source
│   │   │   └── adapters/     # OS Adapters (Windows, macOS, Linux)
│   │   ├── tray/             # System Tray Manager & Menus
│   │   └── ipc/              # IPC Communication Bridge
│   ├── preload/              # Secure Preload Bridge
│   │   └── index.cjs
│   ├── renderer/             # Frontend UI (Canvas Preview & Controls)
│   │   └── index.html
│   └── shared/               # Shared Interfaces, DTOs, dan Constants
│       ├── types/
│       ├── constants/
│       └── utils/            # Coordinate Mapper Engine
```

---

## Lisensi

MIT License © 2026 USER
