# Screening CV Otomatis — Panduan Deployment

Sistem otomasi rekrutmen yang mengambil CV dari Gmail, mengekstrak teks via OCR, menilai semua kandidat sekaligus lewat Claude Message Batches API, dan menghasilkan ranking + skill gap analysis + pertanyaan interview yang disesuaikan per kandidat.

**Stack:** Google Apps Script, Gmail, Google Drive, Google Sheets, Claude API — semua gratis kecuali token Claude (dan itu pun 50% lebih hemat karena pakai Batch API).

---

## Dashboard Preview

Berikut adalah tampilan dashboard screening CV yang dihasilkan otomatis:

### 📊 Dashboard Ringkasan

![Dashboard Ringkasan](docs/images/dashboard-ringkasan.png)

**Fitur dashboard:**
- Total Kandidat, Skor Rata-rata, Skor Tertinggi/Terendah
- Pie Chart Rekomendasi (Lanjut / Pertimbangkan / Tidak Sesuai)
- Bar Chart Distribusi Kota Asal
- Pie Chart Tingkat Pendidikan
- Bar Chart Top 10 Skills
- Bar Chart Distribusi Tahun Pengalaman

> 📸 **Screenshot:** Jalankan `generateDashboard()` di Apps Script, lalu ambil screenshot dari tab "Dashboard" di Google Sheets.

### 🌐 Live Dashboard

Dashboard juga bisa diakses secara **live** melalui GitHub Pages:

🔗 **Live URL:** https://faber-aritonang.github.io/seleksicv/

Untuk mengaktifkan live dashboard, lihat [Panduan GitHub Pages](#panduan-github-pages) di bawah.

---

## Arsitektur
```
Email lamaran masuk (Gmail, berlabel "CV-Masuk")
              ↓
     intakeFromGmail() — ambil lampiran PDF, simpan ke Drive, catat ke Sheet
              ↓
     buildAndSubmitBatch() — OCR tiap PDF, susun prompt penilaian,
                              kirim SEMUA sekaligus sebagai 1 batch
              ↓
     Claude Message Batches API (diproses async, <24 jam, 50% lebih hemat)
              ↓
     checkBatchStatus() — jalan tiap 30 menit, cek apakah sudah selesai
              ↓
     retrieveBatchResults() — ambil hasil, urutkan skor, tulis ke Sheet
              ↓
     Sheet "Hasil Screening" — ranking kandidat siap direview manual
```

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

## Sheet yang Aktif

| Sheet | Fungsi | Siapa yang Edit |
|---|---|---|
| Kriteria Penilaian | Rubrik penilaian (kriteria + bobot + deskripsi) | Rekruter — edit sesuai kebutuhan lowongan |
| Kandidat | Metadata CV yang masuk + status proses | Otomatis diisi oleh sistem |
| Hasil Screening | Ranking kandidat + skill gap + pertanyaan interview | Otomatis diisi oleh sistem |

## Trigger yang Jalan

| Trigger | Jadwal | Fungsi |
|---|---|---|
| `runIntakeAndSubmit` | Tiap hari jam 7 pagi | Ambil email baru + submit batch ke Claude |
| `checkBatchStatus` | Tiap 30 menit | Cek apakah batch selesai, kalau ya ambil hasilnya |

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

## Prinsip Etis yang Sudah Ditanam di Prompt

Prompt penilaian secara eksplisit menginstruksikan Claude untuk **mengabaikan nama, usia, gender, foto, status pernikahan, agama** — hanya menilai berdasarkan kualifikasi kerja. Ini mengurangi risiko bias, tapi tetap disarankan sesekali audit manual: bandingkan beberapa hasil skor dengan penilaian rekruter manusia untuk memastikan konsisten.

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
