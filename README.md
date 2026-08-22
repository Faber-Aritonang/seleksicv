# 📊 Screening CV Otomatis

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Google Apps Script](https://img.shields.io/badge/Google%20Apps%20Script-orange.svg)](https://script.google.com/)
[![Claude API](https://img.shields.io/badge/Claude%20API-purple.svg)](https://console.anthropic.com/)

> Sistem otomasi rekrutmen yang mengambil CV dari **Gmail** maupun **form lamaran web**, mengekstrak teks via OCR, menilai semua kandidat sekaligus lewat Claude Message Batches API, dan menghasilkan ranking + skill gap analysis + pertanyaan interview yang disesuaikan per kandidat.

**Stack:** Google Apps Script, Gmail, Google Drive, Google Sheets, Claude API — semua gratis kecuali token Claude (dan itu pun 50% lebih hemat karena pakai Batch API).

---

## 🚀 Live Demo

**Klik di bawah untuk melihat dashboard langsung:**

[![Live Demo](https://img.shields.io/badge/LIVE%20DEMO-Click%20Here-brightgreen?style=for-the-badge&logo=google&logoColor=white)](https://faber-aritonang.github.io/seleksicv/)

| Tab | Deskripsi |
|---|---|
| 📊 **Ringkasan Umum** | Dashboard utama — total kandidat, skor rata-rata, rekomendasi, kota asal, pendidikan, skills, pengalaman |
| 🗺️ **Peta Pencari Kerja** | Data lengkap kandidat — nama, email, kota, pendidikan, pengalaman, skills |
| 📈 **Performa Screening** | Hasil screening — skor, kekuatan, kekhawatiran, rekomendasi, skill gap, pertanyaan interview |

> ✅ **Real-time** — Data di-update langsung dari Google Sheets setiap kali ada screening baru.

---

## 📸 Preview Dashboard

Berikut adalah tampilan dashboard screening CV yang dihasilkan otomatis:

![Dashboard Ringkasan](docs/images/dashboard-ringkasan.png)

**Fitur dashboard:**
- Total Kandidat, Skor Rata-rata, Skor Tertinggi/Terendah
- Pie Chart Rekomendasi (Lanjut / Pertimbangkan / Tidak Sesuai)
- Bar Chart Distribusi Kota Asal
- Pie Chart Tingkat Pendidikan
- Bar Chart Top 10 Skills
- Bar Chart Distribusi Tahun Pengalaman

> 📸 **Screenshot:** Jalankan `generateDashboard()` di Apps Script, lalu ambil screenshot dari tab "Dashboard" di Google Sheets.

> 🌐 **Live:** [Lihat Dashboard Live](https://faber-aritonang.github.io/seleksicv/)

---

## ⚡ Fitur Utama

| Fitur | Deskripsi |
|---|---|
| 📧 **Gmail Intake** | Ambil email CV dari Gmail berlabel "CV-Masuk" otomatis |
| 🔍 **OCR Otomatis** | Ekstrak teks dari PDF via Google Drive OCR |
| 🤖 **Claude Batch API** | Kirim semua CV sekaligus untuk dinilai AI (50% lebih hemat) |
| 📊 **Ranking Kandidat** | Hasil screening terurut skor tertinggi ke terendah |
| 🔎 **Skill Gap Analysis** | Analisis keahlian vs kriteria per kandidat |
| 💬 **Pertanyaan Interview** | 3-5 pertanyaan spesifik per kandidat |
| 🚫 **Anti-Bias** | Prompt instruksikan AI abaikan nama/usia/gender/agama |
| ⏰ **Trigger Otomatis** | Harian jam 7 pagi + cek batch tiap 30 menit |
| 📈 **Dashboard Live** | Real-time dashboard via GitHub Pages |
| 📱 **Telegram Notif** | Notifikasi otomatis saat screening selesai (opsional) |
| 🌐 **Landing Page Lamaran** | Halaman web profesional untuk kandidat melamar |

---

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ALUR SCREENING CV                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📧 EMAIL (Gmail berlabel "CV-Masuk")                              │
│           ↓                                                         │
│  📥 intakeFromGmail() — ambil PDF, simpan ke Drive                  │
│           ↓                                                         │
│  🌐 FORM LAMARAN (lamaran.html → FormHandler.gs)                   │
│           ↓                                                         │
│  📋 intakeFromForm() — baca "Lamaran Masuk" → tulis ke "Kandidat"  │
│           ↓                                                         │
│  📤 buildAndSubmitBatch() — kirim SEMUA sebagai 1 batch             │
│           ↓                                                         │
│  🔍 extractPdfText() — OCR teks dari PDF                            │
│           ↓                                                         │
│  🤖 Claude Message Batches API (async, <24 jam)                     │
│           ↓                                                         │
│  ⏰ checkBatchStatus() — cek tiap 30 menit                          │
│           ↓                                                         │
│  📊 retrieveBatchResults() — tulis ranking ke Sheet                  │
│           ↓                                                         │
│  🌐 Dashboard Live — tampilkan ke publik via GitHub Pages           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Dua Pintu Masuk CV

| Sumber | Fungsi | Sheet Tujuan | Keterangan |
|---|---|---|---|
| 📧 Gmail (label `CV-Masuk`) | `intakeFromGmail()` | `Kandidat` | CV dari email attachments |
| 🌐 Landing Page (form lamaran) | `intakeFromForm()` | `Lamaran Masuk` → `Kandidat` | CV dari form upload web |

---

## BAGIAN A — Setup Gmail (Pintu Masuk CV)

### A1. Buat Label Gmail
1. Buka Gmail > Settings (ikon gerigi) > **Labels** > **Create new label**.
2. Buat 2 label: `CV-Masuk` dan `CV-Diproses` (nama harus persis, case-sensitive).

### A2. (Disarankan) Buat Filter Otomatis
Supaya email lamaran otomatis ke-label tanpa kamu tandai manual satu-satu:
1. Gmail > Settings > **Filters and Blocked Addresses** > **Create a new filter**.
2. Isi kriteria, misalnya:
   - To: `rekrutmen@perusahaanmu.com` (kalau ada alamat khusus)
   - Atau Subject contains: `lamaran` OR `application` OR nama posisi yang lagi dibuka
   - Has attachment: centang
3. Klik **Create filter**, pilih **Apply label: CV-Masuk**.

Kalau belum ada alamat khusus rekrutmen, ini saat yang tepat untuk buat satu (bisa alias Gmail biasa), supaya semua lamaran terpusat dan mudah difilter.

### A3. Kalau Sudah Ada Email Lamaran Lama
Cukup select email-email itu di Gmail, klik label, terapkan `CV-Masuk` manual — sistem akan proses saat pertama kali `intakeFromGmail` dijalankan.

---

## BAGIAN B — Setup Apps Script

### B1. Buat Google Sheet Baru
Buat spreadsheet baru, kasih nama misalnya "Screening CV — [Nama Posisi]".

### B2. Pasang Kode
Extensions > Apps Script > hapus kode default > paste isi `Code.gs`.

### B3. Aktifkan Drive API (Advanced Service) — WAJIB untuk OCR
1. Di Apps Script, klik ikon **+** di sebelah "Services" (sidebar kiri).
2. Cari **Drive API**, klik **Add**.
3. Ini yang memungkinkan sistem membaca teks dari PDF (lewat OCR bawaan Google).

### B4. Isi Script Properties
Project Settings ⚙️ > Script Properties, tambahkan:
- `CLAUDE_API_KEY` — dapat dari console.anthropic.com
- `TELEGRAM_BOT_TOKEN` (opsional, untuk notifikasi saat batch selesai)
- `TELEGRAM_CHAT_ID` (opsional)

**Jangan pernah paste API key di chat ini** — cukup isi di Script Properties dan konfirmasi "sudah diisi".

### B5. Isi Kriteria Penilaian
1. Jalankan fungsi `testSetup` sekali (dropdown > Run) — ini otomatis membuat sheet "Kriteria Penilaian" (kosong).
2. Buka sheet itu di spreadsheet, isi baris-baris kriteria, contoh:

| Kriteria | Bobot (%) | Deskripsi |
|---|---|---|
| Pengalaman relevan | 30 | Minimal 3 tahun di bidang data analytics |
| Keahlian teknis | 25 | Menguasai SQL, Python, tools BI |
| Pendidikan | 15 | Minimal S1 bidang terkait |
| Pencapaian terukur | 20 | Ada angka/hasil konkret, bukan cuma deskripsi tugas |
| Kesesuaian budaya | 10 | Indikasi leadership/kerja tim dari pengalaman organisasi |

**Ganti kriteria ini sesuai kebutuhan tiap lowongan** — tinggal edit sheet, tidak perlu ubah kode.

⚠️ **Pastikan total bobot = 100%** — kode akan log peringatan kalau total tidak tepat.

### B6. Tes Alur End-to-End (Manual Dulu)
Jalankan berurutan, satu-satu, dari dropdown:
1. `testSetup` → pastikan semua centang hijau (API key ✅, label ✅, Drive API ✅, kriteria ✅).
2. `intakeFromGmail` → cek sheet "Kandidat" terisi dari email berlabel CV-Masuk.
3. `buildAndSubmitBatch` → cek di Logger (View > Executions) muncul "Batch berhasil dikirim".
4. Tunggu beberapa menit, lalu jalankan `checkBatchStatus` manual → kalau belum `ended`, tunggu lagi. Begitu selesai, cek sheet "Hasil Screening" terisi, terurut dari skor tertinggi.

### B7. Pasang Trigger Otomatis
Jalankan `setupTriggers` sekali. Ini memasang:
- `runIntakeAndSubmit` (gabungan intake + submit) → tiap hari jam 7 pagi
- `checkBatchStatus` → tiap 30 menit (supaya begitu batch selesai, hasilnya langsung ketulis ke Sheet tanpa kamu perlu cek manual)

---

## Cara Baca Hasil

Sheet **"Hasil Screening"** berisi (sudah terurut skor tertinggi ke terendah):

| Kolom | Penjelasan |
|---|---|
| Nama Kandidat | Nama pengirim email |
| Email | Alamat email pengirim |
| Skor Total | 0–100, gabungan semua kriteria sesuai bobot |
| Kekuatan | Ringkasan kualitatif keunggulan kandidat |
| Kekhawatiran | Area yang perlu digali lebih lanjut |
| Rekomendasi | "Lanjut ke interview" / "Pertimbangkan" / "Tidak sesuai" |
| Detail Skor per Kriteria | JSON — buka kalau butuh telusuri alasan skor per kriteria |
| **Skill Gap** | Per kriteria: status "Terpenuhi / Sebagian / Gap" + catatan. Ini terstruktur per kriteria, jadi kelihatan persis kriteria mana yang belum terbukti di CV. |
| **Pertanyaan Interview** | 3–5 pertanyaan bernomor, disesuaikan spesifik untuk kandidat itu — fokus menggali gap atau klaim di CV yang belum ada bukti konkret. Rekruter tinggal pakai langsung. |
| Drive File ID | ID file PDF di Drive, untuk referensi |

### Skill Gap — Cara Membaca
Contoh isi kolom Skill Gap:
```
[Terpenuhi] Pengalaman relevan: 4 tahun di bidang data analytics di perusahaan terkait
[Sebagian] Keahlian teknis: Menguasai SQL dan Python, tapi tidak ada bukti penggunaan tools BI
[Gap] Pencapaian terukur: Tidak ada angka konkret yang mendeskripsikan dampak kerja
```
- **Terpenuhi** = bukti kuat ada di CV
- **Sebagian** = ada indikasi tapi tidak lengkap atau tidak eksplisit
- **Gap** = tidak ada bukti sama sekali di CV

### Pertanyaan Interview — Cara Membaca
Contoh isi kolom Pertanyaan Interview:
```
1. Bisa jelaskan具体项目 di mana kamu menggunakan Python untuk otomasi? Berapa lama pengerjaannya dan apa hasilnya?
2. Kamu menyebut "tools BI" di CV — tools spesifik mana yang pernah kamu pakai, dan dalam konteks apa?
3. Apa pencapaian terbesar kamu di role sebelumnya yang bisa diukur dengan angka?
```
Pertanyaan ini sudah disesuaikan — rekruter tidak perlu menyusun dari nol.

---

**Penting:** Sistem ini untuk **mempersempit** ratusan CV jadi shortlist, **bukan** pengganti keputusan akhir rekruter. Tetap review manual kandidat di ranking teratas sebelum lanjut ke tahap interview.

---

## 📋 Sheet yang Aktif

| Sheet | Fungsi | Siapa yang Edit |
|---|---|---|
| **Kriteria Penilaian** | Rubrik penilaian (kriteria + bobot + deskripsi) | Rekruter — edit sesuai kebutuhan lowongan |
| **Lamaran Masuk** | Data dari form landing page (nama, email, posisi, CV) | Otomatis diisi oleh `FormHandler.gs` |
| **Kandidat** | Metadata CV yang masuk + status proses (gabungan dari Gmail & form) | Otomatis diisi oleh `intakeFromGmail()` & `intakeFromForm()` |
| **Hasil Screening** | Ranking kandidat + skill gap + pertanyaan interview | Otomatis diisi oleh sistem |
| **Dashboard** | Auto-generated charts (pie, bar, metrics) | Otomatis di-generate oleh `generateDashboard()` |
| **Analytics Data** | Data terstruktur untuk analisis (kota, pengalaman, skills) | Otomatis diisi oleh sistem |

## ⏰ Trigger yang Jalan

| Trigger | Jadwal | Fungsi |
|---|---|---|
| `runIntakeAndSubmit` | Tiap hari jam 7 pagi | Ambil email baru + data form + submit batch ke Claude |
| `checkBatchStatus` | Tiap 30 menit | Cek apakah batch selesai, kalau ya ambil hasilnya |

---

## 🚀 Quick Start (5 Menit)

1. **Buat Google Sheet** baru → **Extensions > Apps Script**
2. **Paste** isi `Code.gs` → **Ctrl+S**
3. **Aktifkan Drive API** (Services > Drive API > Add)
4. **Isi Script Properties**: `CLAUDE_API_KEY`
5. **Jalankan** `testSetup` → pastikan semua ✅
6. **Isi sheet** "Kriteria Penilaian" (total bobot = 100%)
7. **Pasang trigger**: jalankan `setupTriggers`
8. **Kirim email CV** ke diri sendiri → label **CV-Masuk**
9. **Tunggu** jam 7 pagi (atau jalankan `runIntakeAndSubmit` manual)
10. **Cek** sheet "Hasil Screening" + "Dashboard" 🎉

> 💡 **Form Lamaran:** Untuk mengaktifkan intake via form web, tambahkan `FormHandler.gs` dan deploy sebagai Web App (lihat bagian "Landing Page Lamaran"). Data form akan otomatis terbaca oleh `intakeFromForm()`.

---

## 🌐 Landing Page Lamaran + Integrasi Screening

Sertakan **`lamaran.html`** untuk halaman lamaran profesional yang **terkoneksi langsung ke pipeline screening**.

### Alur Form → Screening

```
Kandidat isi form di lamaran.html
        ↓
FormHandler.gs menerima POST
        ↓
  ├─ Simpan CV ke Drive folder "CV Kandidat" ✅
  └─ Catat metadata ke sheet "Lamaran Masuk" ✅
        ↓
Trigger harian: runIntakeAndSubmit()
        ↓
  intakeFromForm() baca "Lamaran Masuk"
        ↓
  Tulis ke sheet "Kandidat" (format screening) ✅
        ↓
  buildAndSubmitBatch() → OCR → Claude screening ✅
        ↓
  Hasil ke "Hasil Screening" + "Analytics Data" + "Dashboard" 🎉
```

### Fitur Landing Page:
- 🎨 Desain modern & responsive (mobile-friendly)
- 📋 Form lamaran (nama, email, telepon, posisi, upload CV)
- 🎯 Pilihan posisi dengan card interaktif
- 📱 File upload dengan validasi PDF (maks 5MB)
- ✅ Success modal setelah kirim
- 🔗 Integrasi otomatis dengan screening pipeline

### Cara Deploy:

1. **Copy `lamaran.html`** ke GitHub Pages:
   ```bash
   cp lamaran.html docs/
   git add docs/lamaran.html
   git commit -m "feat: tambah landing page lamaran"
   git push
   ```

2. **Deploy `FormHandler.gs`** ke Apps Script:
   - Buka Google Sheet → Extensions → Apps Script
   - Buat file baru: `FormHandler.gs`
   - Paste isi `FormHandler.gs`
   - Deploy → New Deployment → Web App → Deploy
   - Copy URL yang dihasilkan

3. **Update `lamaran.html`** → ganti `FORM_SUBMIT_URL`:
   ```javascript
   const FORM_SUBMIT_URL = 'https://script.google.com/macros/s/xxx/exec';
   ```

4. **Push ke GitHub** → Landing page langsung live!

> 💡 **Tidak perlu konfigurasi tambahan** — `intakeFromForm()` akan otomatis membaca data dari sheet `Lamaran Masuk` setiap kali trigger `runIntakeAndSubmit()` berjalan (jam 7 pagi).

### Demo Landing Page:

🔗 [Lihat Landing Page](https://faber-aritonang.github.io/seleksicv/lamaran.html)

---

---

## Panduan GitHub Pages

### Aktifkan GitHub Pages

1. Buka repository: https://github.com/Faber-Aritonang/seleksicv
2. Klik tab **"Settings"**
3. Scroll ke section **"Pages"** (sidebar kiri)
4. Source: pilih **"Deploy from a branch"**
5. Branch: pilih **"main"**
6. Folder: pilih **"/ (root)"**
7. Klik **Save**
8. Tunggu 1-2 menit → dashboard live di: https://faber-aritonang.github.io/seleksicv/

### Publish Google Sheet ke Web

Agar dashboard tampil di GitHub Pages, Google Sheet harus dipublish:

1. Buka Google Sheet → tab **"Dashboard"**
2. Klik **File → Share → Publish to web**
3. Pilih tab **"Dashboard"**
4. Klik **Publish** → konfirmasi
5. Copy URL yang dihasilkan
6. Edit file **`index.html`** → ganti value `DASHBOARD_SHEET_URL`:

```javascript
const DASHBOARD_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX.../pubhtml?gid=0';
```

7. Push ke GitHub:
```bash
git add index.html
git commit -m "feat: aktifkan live dashboard"
git push
```

### Cara Kerja

```
GitHub Pages (index.html)
       ↓
Embed Google Sheets (iframe)
       ↓
Google Sheet "Dashboard" (publish to web)
       ↓
Data real-time dari Code.gs
```

---

## Troubleshooting

| Masalah | Kemungkinan Penyebab | Solusi |
|---|---|---|
| `intakeFromGmail` tidak menemukan email | Label `CV-Masuk` belum ada / belum diterapkan ke email manapun | Buat label + filter di Gmail (lihat BAGIAN A) |
| OCR gagal / teks CV kosong | Drive API (advanced service) belum diaktifkan | Aktifkan di Apps Script > Services > Drive API > Add |
| Batch gagal submit | `CLAUDE_API_KEY` salah / kriteria penilaian kosong | Cek Script Properties + isi sheet kriteria |
| `checkBatchStatus` selalu bilang belum selesai | Normal kalau baru beberapa menit | Batch bisa sampai <24 jam, biasanya lebih cepat untuk jumlah kandidat kecil |
| Hasil skor aneh/tidak masuk akal | Deskripsi kriteria terlalu umum | Edit sheet "Kriteria Penilaian" — deskripsi yang lebih spesifik menghasilkan penilaian yang lebih tajam |
| Status kandidat terjdi "Menunggu Batch" terus | Batch submit gagal tapi status sudah terlanjur diupdate | Kode sudah di-fix: status akan di-rollback ke "Baru" kalau batch gagal submit |
| Form lamaran tidak masuk ke screening | `FORM_SUBMIT_URL` belum diisi di `lamaran.html` | Ganti placeholder dengan URL Web App yang sudah di-deploy |
| Data form duplikat di Kandidat | `intakeFromForm()` sudah punya anti-duplikat (cek Drive File ID) | Tidak perlu khawatir, aman dijalankan berkali-kali |

## 🛡️ Prinsip Etis yang Sudah Ditanam di Prompt

Prompt penilaian secara eksplisit menginstruksikan Claude untuk **mengabaikan nama, usia, gender, foto, status pernikahan, agama** — hanya menilai berdasarkan kualifikasi kerja. Ini mengurangi risiko bias, tapi tetap disarankan sesekali audit manual: bandingkan beberapa hasil skor dengan penilaian rekruter manusia untuk memastikan konsisten.

---

## 🔗 Link Penting

| Link | Deskripsi |
|---|---|
| 🌐 **[Live Demo](https://faber-aritonang.github.io/seleksicv/)** | Dashboard screening CV live |
| 📂 **[GitHub Repository](https://github.com/Faber-Aritonang/seleksicv)** | Source code lengkap |
| 📄 **[MIT License](LICENSE)** | Open source, bebas dipakai |
| 🤖 **[Claude API](https://console.anthropic.com/)** | Dapatkan API key |
| 📊 **[Google Sheets](https://sheets.google.com)** | Dashboard & data screening |

---

## 📝 Changelog

| Versi | Tanggal | Deskripsi |
|---|---|---|
| **v1.0** | 2026-08-21 | Initial release — Gmail intake + Claude Batch API |
| **v1.1** | 2026-08-22 | Tambahan dashboard analytics untuk Looker Studio |
| **v1.2** | 2026-08-22 | Auto-generate dashboard charts di Google Sheets |
| **v1.3** | 2026-08-22 | Fix bug kritis & chart positioning |
| **v1.4** | 2026-08-22 | Live dashboard via GitHub Pages |
| **v1.5** | 2026-08-22 | Landing page lamaran profesional (PT Angin Senyap) |
| **v1.6** | 2026-08-22 | Integrasi form lamaran → pipeline screening via `intakeFromForm()` |

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Faber-Aritonang">Faber Aritonang</a>
  <br>
  Powered by <a href="https://www.anthropic.com/">Claude AI</a> & <a href="https://script.google.com/">Google Apps Script</a>
</p>

---

## 📸 Menambahkan Screenshot Dashboard

Untuk menambahkan screenshot dashboard ke repository:

1. **Jalankan `generateDashboard()`** di Apps Script
2. **Buka Google Sheet** → tab "Dashboard"
3. **Ambil screenshot** (PrtSc / Snipping Tool / Cmd+Shift+4)
4. **Simpan** ke folder `docs/images/` dengan nama:
   - `dashboard-ringkasan.png`
   - `dashboard-pencari-kerja.png`
   - `dashboard-performa.png`
5. **Push ke GitHub:**
   ```bash
   git add docs/images/
   git commit -m "docs: tambah screenshot dashboard"
   git push
   ```

Screenshot akan otomatis muncul di README.md bagian "Dashboard Preview".
