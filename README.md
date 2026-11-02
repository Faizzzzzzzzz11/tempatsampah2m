# TrashRoute — Dashboard Pengelola & Optimasi Rute Cerdas IoT

Sistem Pengelolaan & Optimasi Rute Pengangkutan Sampah Cerdas IoT Wilayah Kapanewon Godean Sleman DIY berbasis Algoritma TSP Manhattan, Held-Karp DP, Multi-Trip, dan Perutean Jalan Nyata OSRM.

## Cara Menjalankan Aplikasi di Komputer Lokal

### 1. Prasyarat
- Pastikan komputer Anda telah terinstal **Node.js** (versi 18, 20, atau 22). Anda dapat mengeceknya dengan menjalankan `node -v` di terminal.

### 2. Instalasi Dependensi
Buka terminal (Command Prompt / PowerShell / Terminal) di dalam folder proyek ini, lalu jalankan:
```bash
npm install
```

### 3. Menjalankan Mode Development (Live Preview)
Setelah instalasi selesai, jalankan perintah:
```bash
npm run dev
```

Buka peramban (browser) Anda dan akses alamat:
```
http://localhost:3000
```

### 4. Menjalankan Versi Produksi (Build & Preview)
Jika ingin menguji hasil kompilasi/build produksi:
```bash
npm run build
npm run preview
```
Akses URL lokal yang ditampilkan pada terminal (biasanya `http://localhost:4173` atau `http://localhost:3000`).

---

## Fitur Utama
- **Dashboard Pengelola & Pemantauan IoT**: Real-time status sensor tong sampah dan sinkronisasi MQTT live broker.
- **Optimasi Multi-Trip TSP**: Perhitungan rute cerdas (Held-Karp) dan perutean jalan nyata OSRM di koridor Kapanewon Godean.
- **Simulasi Animasi Truk**: Pelacakan pergerakan truk pengangkut beserta indikator muatan dinamis.
- **Kotak Masuk Aduan Warga**: Terintegrasi langsung dengan portal pelaporan warga secara real-time.
- **Theme Switcher Global**: Beralih antara mode terang (Light Mode) dan mode gelap kontras tinggi (High-Contrast Dark Mode) dengan ubin peta malam CartoDB Dark Matter yang dirancang khusus untuk kenyamanan ruang kendali minim cahaya.
