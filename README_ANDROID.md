# Panduan Build APK TrashRoute di Android Studio

Proyek ini telah dikonfigurasi menggunakan **Capacitor** resmi sehingga direktori native Android (`/android`) sudah siap dibuka dan di-build langsung menjadi APK di **Android Studio**.

---

## 📁 Struktur Folder Proyek
- `android/` : Proyek native Android (Gradle, AndroidManifest, Java/Kotlin Activity).
- `capacitor.config.ts` : Konfigurasi Capacitor (App ID: `com.trashroute.godean`, Name: `TrashRoute`).
- `public/manifest.json` : Web App Manifest untuk konfigurasi standalone Android.
- `dist/` : Hasil build web production yang otomatis disinkronkan ke aset native Android.

---

## 🚀 Langkah-Langkah Membuat APK di Android Studio

### 1. Buka Proyek di Android Studio
1. Buka aplikasi **Android Studio**.
2. Pilih menu **File** → **Open...**
3. Arahkan ke folder **`android`** yang ada di dalam repositori ini:
   ```
   path/ke/proyek/android
   ```
4. Klik **OK** dan tunggu Android Studio menyelesaikan sinkronisasi Gradle (*Gradle Sync*).

---

### 2. Build APK (Debug / Release)
Ada dua cara mudah untuk menghasilkan file `.apk`:

#### Opsi A: Lewat Menu Android Studio (GUI)
1. Di bilah menu atas Android Studio, klik **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**.
2. Tunggu proses kompilasi Gradle selesai (biasanya 1–3 menit pada build pertama).
3. Setelah selesai, akan muncul notifikasi di pojok kanan bawah:
   > *"APK(s) generated successfully for 1 module"*
4. Klik tautan **locate** pada notifikasi tersebut. File `app-debug.apk` akan berada di folder:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```
5. File APK ini siap dikirim ke smartphone Android dan diinstal langsung!

#### Opsi B: Lewat Terminal / Command Prompt
Jalankan perintah berikut di dalam folder `android`:
```bash
# Windows
gradlew assembleDebug

# macOS / Linux
./gradlew assembleDebug
```
File APK akan otomatis terbuat di `app/build/outputs/apk/debug/app-debug.apk`.

---

### 3. Mengupdate Aplikasi Jika Ada Perubahan Kode Web
Jika Anda mengedit kode React/TypeScript di kemudian hari:
Jalankan perintah berikut di root folder proyek:
```bash
npm run cap:sync
```
Perintah ini akan otomatis menjalankan `vite build` dan menyalin seluruh aset terbaru ke folder aset Android. Setelah itu, cukup tekan tombol **Run ▶** atau **Build APK** di Android Studio!

---

## ⚙️ Informasi Paket Android
- **Package Name / Application ID**: `com.trashroute.godean`
- **Target SDK**: Android 14+ (API 34)
- **Minimum SDK**: Android 5.1+ (API 22)
- **Izin Jaringan**: `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `usesCleartextTraffic=true` (untuk kelancaran OSRM & sinkronisasi IoT MQTT).
