# Show Second Screens

> **Interactive Target Screen Mirror & Remote Control Window**
> Preview secondary or virtual displays in a floating, movable, and resizable window with 1:1 remote mouse interaction.

---

## Overview

**Show Second Screens** adalah aplikasi desktop modern yang memungkinkan pengguna melihat preview real-time dari layar target (secondary display / virtual display / monitor eksternal) dalam sebuah floating window. 

Tidak hanya sekadar menampilkan preview gambar, aplikasi ini menyediakan **interaksi remote langsung**: klik mouse, drag, scroll, dan kontrol selayaknya mengoperasikan layar tersebut secara langsung, dilengkapi kemampuan window yang dapat dipindah-pindah (*draggable*) dan diubah ukurannya (*resizable*).

---

## Fitur Utama

- 🖥️ **Real-time Target Screen Preview**: Menampilkan live streaming layar target dengan performa tinggi dan latensi rendah.
- 🎯 **1:1 Remote Click & Interaction**:
  - Klik Kiri, Klik Kanan, Double Click langsung pada kanvas preview.
  - Mouse Drag & Drop antar elemen di layar target.
  - Mouse Scroll Wheel (vertikal & horizontal).
  - Hover & Cursor tracking otomatis.
- 📐 **Presisi Pemetaan Koordinat (Coordinate Mapping Engine)**:
  - Mengonversi posisi piksel viewport lokal ke koordinat monitor target dengan memperhitungkan resolusi asli, scaling DPI, dan rasio aspek (letterbox offset).
- 🪟 **Movable & Resizable Floating Window**:
  - Window dapat dipindahkan ke mana saja pada layar utama via drag handle khusus.
  - Ukuran jendela dapat di-resize bebas dengan opsi mempertahankan rasio aspek atau fluid fit.
  - Mode **Always on Top** (Pin) dan kontrol transparansi (opacity).
- ⚡ **Desain Minimalis & Tactile HUD**:
  - Kontrol HUD otomatis menyembunyikan diri (*auto-hide/dim*) saat tidak digunakan agar pandangan layar tidak terhalang.
  - Telemetri status real-time: indikator FPS, latensi render, dan informasi display target.

---

## Arsitektur Modular (Skeleton Rapi)

Proyek ini dibangun menggunakan arsitektur modular yang ketat:

```text
show-second-screens/
├── AGENTS.md                 # Standar operasional wajib AI Agent
├── CHANGELOG.md              # Log riwayat perubahan versi
├── README.md                 # Dokumentasi proyek
├── package.json              # Versi & manifest dependensi
├── tsconfig.json             # Konfigurasi TypeScript
├── src/
│   ├── main/                 # Main Process (Lifecycle, Window, OS Capture, Input)
│   │   ├── index.ts          # Application entrypoint
│   │   ├── window/           # Window Manager (Draggable, Resizable, Frameless)
│   │   ├── capture/          # Screen Capture & Monitor Enumeration
│   │   ├── input/            # Native Input Injection (Mouse/Keyboard events)
│   │   └── ipc/              # IPC Communication Bridge
│   ├── preload/              # Preload Layer (Context Isolation Bridge)
│   │   └── index.ts          # Safe Exposed APIs
│   ├── renderer/             # Frontend UI (Preview Canvas, HUD, Toolbar)
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── components/   # UI Components (PreviewCanvas, Toolbar, DisplaySelector)
│   │   │   ├── hooks/        # Coordinate Mapping & Mouse Interaction Hooks
│   │   │   ├── services/     # Stream Renderer & IPC Client
│   │   │   └── styles/       # Modern Dark UI Styles
│   └── shared/               # Shared Interfaces, DTOs, dan Constants
│       ├── types/            # Tipe Display, InputEvent, WindowConfig
│       └── constants/        # Saluran IPC & default configs
```

---

## Aturan Pengembangan (Development Rules)

Seluruh kontributor dan AI Agent wajib mematuhi panduan dalam [AGENTS.md](file:///c:/Users/USER/Documents/antigravity/show-second-screens/AGENTS.md):
1. **Modular & SRP**: Setiap file dan modul hanya bertanggung jawab atas satu tugas spesifik.
2. **Maksimal 1000 Baris Per File**: Hard limit 1000 baris. Refactor modular wajib dilakukan jika file mencapai 700–800 baris.
3. **Commit Tiap Perubahan**: Setiap penambahan fitur, bugfix, atau refactor wajib langsung di-commit ke Git menggunakan Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`).
4. **Update Versi, Changelog, & Readme**: Selalu sinkronkan nomor versi, catat perubahan di `CHANGELOG.md`, dan perbarui `README.md`.
5. **PowerShell Format**: Gunakan tanda titik koma (`;`) sebagai pemisah perintah pada PowerShell.

---

## Lisensi

MIT License © 2026 USER
