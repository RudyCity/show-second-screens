# AGENTS.md — Guidelines for AI Coding Agents
# Project: Show Second Screens (Interactive Target Screen Mirror & Remote Control)

Dokumen ini adalah panduan operasional wajib (Standard Operating Procedures) untuk setiap AI Agent yang bekerja pada repositori **show-second-screens**. Semua instruksi dan batasan di bawah ini bersifat mengikat dan wajib dipatuhi tanpa pengecualian.

---

## 1. Project Mission & Core Capabilities

**show-second-screens** adalah aplikasi desktop window cerdas yang dirancang untuk:
1. **Target Display Previewing**: Menampilkan streaming/preview real-time dari layar target (secondary display, virtual display, atau specific monitor) dengan latensi ultra-rendah dan frame rate optimal.
2. **Interactive Remote Control**: Memungkinkan interaksi langsung di atas jendela preview (klik kiri, klik kanan, double click, drag-and-drop, scroll wheel, hover, keyboard input) yang dipetakan secara akurat 1:1 ke koordinat layar target asli.
3. **Movable & Resizable Window**: Jendela preview bersifat mengambang (floating / picture-in-picture), dapat dipindahkan bebas (draggable), dan dapat diubah ukurannya (resizable) dengan tetap mempertahankan rasio aspek layar atau mode fluid.

---

## 2. Strict Core Mandates (Aturan Mutlak)

Setiap agen yang memodifikasi atau menambahkan kode wajib menjalankan aturan-aturan berikut:

### 2.1. Koding Selalu Modular (High Cohesion, Loose Coupling)
- **Single Responsibility Principle (SRP)**: Setiap modul, file, kelas, atau fungsi hanya bertanggung jawab atas satu domain tugas spesifik.
- Pisahkan secara tegas:
  - **Screen Capture Engine** (tugas: mengambil frame layar target).
  - **Coordinate Translation & Mapping Engine** (tugas: menghitung konversi koordinat preview ke monitor fisik).
  - **Input Injection Engine** (tugas: mensimulasikan mouse & keyboard event di OS level).
  - **Window Controller** (tugas: mengelola state window, drag, resize, always-on-top, opacity).
  - **UI / Renderer Layer** (tugas: menampilkan canvas preview, toolbar kontrol, telemetry FPS/latency).
  - **IPC Communication Layer** (tugas: jembatan komunikasi aman antara Main Process dan Renderer).
- Hindari god objects, monolithic files, dan tightly-coupled code.

### 2.2. Skeleton Rapi (Organized Project Architecture)
Struktur direktori wajib terorganisir rapi dan berstandar industri:

```text
show-second-screens/
├── .gitignore
├── AGENTS.md                 # Aturan utama dan instruksi agen
├── CHANGELOG.md              # Riwayat perubahan per versi
├── README.md                 # Dokumentasi publik proyek
├── package.json              # Manifest proyek dan dependensi
├── tsconfig.json             # Konfigurasi strict TypeScript
├── src/
│   ├── main/                 # Main Process (Node / Electron / Native OS)
│   │   ├── index.ts          # Entry point & app lifecycle (< 1000 baris)
│   │   ├── window/           # Window creation, frameless drag, resize manager
│   │   ├── capture/          # Screen capture services & display enumeration
│   │   ├── input/            # Native mouse/keyboard simulation & injection
│   │   └── ipc/              # IPC bridge handlers & contracts
│   ├── preload/              # Preload scripts (Context Isolation & Secure Bridge)
│   │   └── index.ts          # API exposure ke renderer
│   ├── renderer/             # Frontend UI (Preview Canvas & Control HUD)
│   │   ├── index.html
│   │   ├── src/
│   │   │   ├── main.tsx      # Renderer bootstrap
│   │   │   ├── components/   # UI modular (Canvas, Toolbar, DisplaySelector)
│   │   │   ├── hooks/        # Coordinate mapping, mouse event listener hooks
│   │   │   ├── services/     # WebRTC/Canvas stream rendering & IPC clients
│   │   │   └── styles/       # CSS / Tailwind styles
│   └── shared/               # Shared contracts, DTOs, dan constants
│       ├── types/            # Interface Display, InputEvent, WindowConfig
│       └── constants/        # Action channels, default settings
└── tests/                    # Unit & E2E tests
```

### 2.3. Max 1000 Lines Per File (Hard Limit)
- **BATAS MAKSIMAL 1000 BARIS PER FILE**: Tidak ada file kode yang boleh melebihi 1000 baris.
- **Peringatan Refactor**: Jika sebuah file sudah mencapai 700–800 baris, agen **WAJIB** segera memecah (modularisasi) logika file tersebut menjadi sub-modul atau helper terpisah sebelum menambahkan fungsionalitas baru.
- Jangan pernah menyatukan state management, logic, dan styling/markup dalam satu file raksasa.

### 2.4. Selalu Git Commit Setiap Perubahan
- Setiap kali agen menyelesaikan sebuah fitur, perbaikan bug, atau refactor modular, agen **WAJIB** melakukan commit ke Git repository.
- Format commit wajib menggunakan **Conventional Commits**:
  - `feat: <deskripsi fitur baru>`
  - `fix: <deskripsi perbaikan bug>`
  - `refactor: <deskripsi pemecahan kode / perbaikan struktur>`
  - `perf: <deskripsi optimasi performa/latency/fps>`
  - `docs: <update dokumentasi>`
  - `chore: <konfigurasi, dependensi, versi>`
- Jangan menumpuk banyak pekerjaan tanpa commit. Commit dilakukan secara bertahap dan atomik.

### 2.5. Update Versi, CHANGELOG.md, dan README.md
- **Semantic Versioning (SemVer)**:
  - Perubahan breaking/major -> naikkan versi Major (`1.0.0` -> `2.0.0`).
  - Fitur baru fungsional -> naikkan versi Minor (`0.1.0` -> `0.2.0`).
  - Bug fix / optimasi / patch -> naikkan versi Patch (`0.1.0` -> `0.1.1`).
- **Update Versi**: Sinkronkan nomor versi di `package.json` dan referensi terkait.
- **Update `CHANGELOG.md`**: Wajib mencatat apa yang ditambah (`Added`), diperbaiki (`Fixed`), diubah (`Changed`), atau dihapus (`Removed`) di bawah versi terkait beserta tanggal.
- **Update `README.md`**: Perbarui jika ada perubahan instruksi instalasi, cara menjalankan aplikasi, konfigurasi tombol/shortcut, atau arsitektur baru.

---

## 3. Spesifikasi Teknis: Screen Preview & Remote Control

### 3.1. Display Enumeration & Capture
- Sistem harus mampu mendeteksi semua monitor fisik/virtual yang terhubung ke sistem operasi (`screen.getAllDisplays()`).
- Pengguna dapat memilih monitor target yang ingin dipantau.
- Capture stream harus mengoptimalkan latensi dan bandwidth (dukungan Desktop Duplication / Media Stream Capture 60 FPS).

### 3.2. Formula Pemetaan Koordinat (Coordinate Mapping Engine)
Untuk memastikan klik pada jendela preview tepat sasaran pada layar target:

1. Dapatkan resolusi fisik monitor target: $W_{target}$, $H_{target}$, dan koordinat posisi monitor di virtual desktop: $(X_{target}, Y_{target})$.
2. Dapatkan ukuran aktual elemen canvas/viewport preview di jendela lokal: $W_{canvas}$, $H_{canvas}$.
3. Hitung offset letterbox jika rasio aspek jendela tidak identik dengan monitor target:
   $$\text{Scale} = \min\left(\frac{W_{canvas}}{W_{target}}, \frac{H_{canvas}}{H_{target}}\right)$$
   $$\text{RenderWidth} = W_{target} \times \text{Scale}, \quad \text{RenderHeight} = H_{target} \times \text{Scale}$$
   $$\text{OffsetX} = \frac{W_{canvas} - \text{RenderWidth}}{2}, \quad \text{OffsetY} = \frac{H_{canvas} - \text{RenderHeight}}{2}$$
4. Hitung posisi relatif kursor lokal $(x_{local}, y_{local})$:
   $$u = \frac{x_{local} - \text{OffsetX}}{\text{RenderWidth}}, \quad v = \frac{y_{local} - \text{OffsetY}}{\text{RenderHeight}}$$
   *(Abaikan event jika $u < 0$, $u > 1$, $v < 0$, atau $v > 1$)*
5. Proyeksikan ke koordinat fisik monitor target:
   $$X_{target\_coord} = X_{target} + (u \times W_{target})$$
   $$Y_{target\_coord} = Y_{target} + (v \times H_{target})$$
6. Kirim koordinat target $(X_{target\_coord}, Y_{target\_coord})$ ke **Input Injection Service** via IPC untuk dieksekusi secara instan.

### 3.3. Remote Input Simulation
- Mendukung interaksi lengkap:
  - Mouse Move (dengan throttle cerdas untuk kelancaran tanpa membani IPC bus).
  - Mouse Down, Mouse Up, Click, Double Click.
  - Right Click (Context Menu pada layar target).
  - Mouse Drag (menahan tombol mouse sambil menggeser koordinat).
  - Mouse Wheel / Scroll (vertikal & horizontal).
  - Forwarding Keyboard Events (opsional/toggleable saat preview window fokus).

### 3.4. Window Behavior (Draggable & Resizable)
- Window preview dapat dibuat **frameless** atau dengan custom sleek header.
- Menyediakan handle drag khusus (CSS `-webkit-app-region: drag` pada titlebar/overlay kontrol) agar window dapat dipindah-pindahkan tanpa mengganggu klik pada area preview interaktif.
- Area preview canvas menggunakan `-webkit-app-region: no-drag` untuk menerima event mouse interaktif.
- Mendukung mode **Always on Top** (Pin window di atas window lain), pengaturan transparansi (opacity), dan minimize/maximize.

---

## 4. Best Practices Pengembangan

1. **PowerShell Compatibility**:
   - Selalu gunakan tanda titik koma (`;`) sebagai pemisah perintah, **BUKAN** `&&` (contoh: `npm run build; npm test`).
2. **Resource Cleanup**:
   - Selalu bersihkan (dispose) screen capture stream, timer interval, dan IPC listeners saat window ditutup atau monitor target berganti. Hindari memory leak.
3. **Type Safety**:
   - Semua kode wajib menggunakan TypeScript strict mode (`"strict": true`). Dilarang menggunakan tipe `any` tanpa alasan yang terdokumentasi jelas.
4. **Error Handling**:
   - Tangani skenario ketika monitor target dicabut atau resolusi layar berubah secara dinamis (`display-metrics-changed`).

---

## 5. UI/UX Quality & Frontend Design Standards

Semua tampilan visual dan UI/UX pada proyek ini wajib mematuhi standar desain modern:
- **Tema Desain**: Modern Dark Terminal / Sleek Minimalist UI dengan aksen kontras yang tajam dan tipografi bersih.
- **Tactile Feedback**: Kontrol tombol yang responsif dengan status indikator aktif (FPS, latensi ms, resolusi target display).
- **Non-Obtrusive HUD**: Kontrol overlay (pilih layar, toggle click-through, close, pin) harus ramping, elegan, dan otomatis redup (auto-hide/dim) saat kursor tidak aktif agar tidak menutupi konten preview.
- Bebas dari AI-slop visual (tanpa gradien ungu generik, tanpa border tebal tidak beralasan, tanpa animasi berlebihan yang mengganggu performa).

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
