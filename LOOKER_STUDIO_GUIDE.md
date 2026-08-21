# Panduan Setup Dashboard Analytics — Looker Studio

## Apa Itu Looker Studio?

**Looker Studio** (sebelumnya Google Data Studio) adalah tool **gratis** dari Google untuk buat dashboard interaktif. Connect langsung ke Google Sheets — tanpa coding, tanpa install.

---

## Dashboard yang Akan Kamu Dapat

### 1. 📊 Ringkasan Umum
- Total CV masuk per hari/minggu/bulan
- Jumlah kandidat per posisi
- Skor rata-rata screening
- Pie chart: lolos interview vs tidak sesuai

### 2. 🗺️ Peta Pencari Kerja
- Peta / bar chart: domisili kandidat (kota asal)
- Bar chart: distribusi tahun pengalaman
- Pie chart: level pendidikan (SMA/S1/S2/S3)
- Word cloud: skills terbanyak

### 3. 📈 Performa Screening
- Histogram: distribusi skor (0-25, 26-50, 51-75, 76-100)
- Bar chart: rata-rata skor per kriteria
- Line chart: tren skor per waktu
- Tabel: perbandingan kandidat terbaik

### 4. 🔍 Detail Kandidat
- Filter interaktif: by kota, pendidikan, skor, rekomendasi
- Tabel detail: nama, email, skor, skill gap, pertanyaan interview

---

## Langkah-Langkah Setup

### Step 1: Buka Looker Studio

1. Buka **[lookerstudio.google.com](https://lookerstudio.google.com)**
2. Login dengan **Google Account yang sama** dengan Apps Script
3. Klik **"+ Create"** → **"Report"**

### Step 2: Connect ke Google Sheets

1. Di halaman baru, klik **"Add data"**
2. Pilih **"Google Sheets"**
3. Pilih spreadsheet **"Screening CV — [Nama Posisi]"**
4. Pilih sheet **"Analytics Data"**
5. Klik **"Add to report"**

### Step 3: Buat Halaman Dashboard

Buat 4 halaman (tabs) di Looker Studio:

#### Halaman 1: Ringkasan Umum

| Widget | Tipe | Config |
|---|---|---|
| Total Kandidat | Scorecard | Metric: Record Count |
| Skor Rata-rata | Scorecard | Metric: Skor Total, Aggregation: Average |
| Rekomendasi | Pie Chart | Dimension: Rekomendasi, Metric: Record Count |
| Tren per Hari | Time Series | Dimension: Tanggal Screening, Metric: Record Count |

#### Halaman 2: Peta Pencari Kerja

| Widget | Tipe | Config |
|---|---|---|
| Peta Domisili | Geo Map | Location: Kota Asal, Metric: Record Count |
| Distribusi Pengalaman | Bar Chart | Dimension: Tahun Pengalaman, Metric: Record Count |
| Level Pendidikan | Pie Chart | Dimension: Pendidikan Terakhir, Metric: Record Count |
| Skills Populer | Table | Dimension: Skills (split), Metric: Record Count, Sort: Descending |

#### Halaman 3: Performa Screening

| Widget | Tipe | Config |
|---|---|---|
| Distribusi Skor | Histogram | Metric: Skor Total, Buckets: 4 |
| Skor per Kriteria | Bar Chart | (dari sheet Hasil Screening) |
| Skor Tertinggi | Table | Dimension: Nama, Metric: Skor Total, Sort: Descending |

#### Halaman 4: Detail Kandidat

| Widget | Tipe | Config |
|---|---|---|
| Filter Panel | Control | Pilih: Kota, Pendidikan, Rekomendasi |
| Tabel Lengkap | Table | Semua kolom dari Analytics Data |

### Step 4: Add Filters & Controls

1. Klik **"Add a control"** → **"Drop-down list"**
2. Dimension: **Kota Asal** → untuk filter by domisili
3. Tambah lagi: **Pendidikan Terakhir**, **Rekomendasi**

### Step 5: Style & Share

1. Klik tab **"Style"** untuk ganti warna/layout
2. Klik **"Share"** → masukkan email tim rekrutmen
3. Atau **"Get report link"** → bagikan link publik

---

## Tips Dashboard yang Bagus

### Warna yang Disarankan
- ✅ Hijau: Lanjut ke interview
- 🟡 Kuning: Pertimbangkan
- 🔴 Merah: Tidak sesuai
- 🔵 Biru: Netral / info

### Layout yang Rapi
```
┌─────────────────────────────────┐
│  [Total CV]  [Skor Rata-rata]  │
│  [Lolos]     [Tidak Sesuai]    │
├─────────────────────────────────┤
│  [Pie: Rekomendasi]            │
│  [Bar: Skills Populer]         │
├─────────────────────────────────┤
│  [Tabel: Top Kandidat]         │
│  [Filter: Kota | Pendidikan]   │
└─────────────────────────────────┘
```

### Auto-Refresh
Looker Studio otomatis refresh data setiap **12 jam**. Untuk refresh manual:
- Klik **"Refresh data"** di toolbar

---

## Quick Start (5 Menit)

Kalau mau cepat:

1. Buka **lookerstudio.google.com** → **Create** → **Report**
2. Add data → **Google Sheets** → pilih spreadsheet → pilih sheet **"Analytics Data"**
3. Looker Studio otomatis buat chart dasar
4. Drag & drop untuk susun layout
5. Share link ke tim

**Selesai!** Dashboard sudah live dan bisa diakses siapapun yang punya link.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Data tidak muncul | Cek sheet "Analytics Data" sudah ada data (jalankan `checkBatchStatus` dulu) |
| Chart kosong | Refresh data di Looker Studio (klik tombol refresh) |
| Kolom salah | Pastikan header sheet sesuai (Tanggal Screening, Nama Kandidat, dst) |
| Link tidak bisa diakses | Set sharing permission di Looker Studio (View / Edit) |
