# FireSentry Karhutla — BPBD Kota Pekanbaru

Sistem Peringatan Dini Kebakaran Hutan dan Lahan (Karhutla) — dashboard web
untuk magang di BPBD Kota Pekanbaru.

© 2026 BPBD Kota Pekanbaru — dikembangkan untuk keperluan magang, bukan
proyek open-source. Tidak dilisensikan untuk penggunaan/distribusi ulang
di luar keperluan BPBD Kota Pekanbaru tanpa izin.

## Cara menjalankan (Visual Studio Code)

1. Buka folder ini di VS Code (`File > Open Folder...`).
2. Install ekstensi **Live Server** (oleh Ritwick Dey) dari Extensions Marketplace.
3. Klik kanan pada `index.html` → **Open with Live Server**.
   (Boleh juga membuka `dashboard.html` langsung, tetapi mulai dari `index.html`
   untuk melewati alur login.)
4. Login memakai akun demo:
   - **Admin 1** (akses penuh — bisa mengakses & mengedit semua halaman)
     Username: `admin1`  Password: `admin1bpbd2026`
   - **Admin 2** (akses terbatas — akun bersama untuk semua petugas, hanya bisa
     membuka halaman Laporan untuk memasukkan/memperbarui laporan)
     Username: `admin2`  Password: `admin2bpbd2026`

Tidak perlu `npm install` — seluruh project memakai HTML/CSS/JS murni
(vanilla), dengan library eksternal dimuat via CDN (Chart.js, Leaflet).
Cukup butuh koneksi internet untuk memuat library CDN, peta OpenStreetMap,
dan (jika dikonfigurasi) data BMKG.

### Mengaktifkan data hotspot live (opsional)

Secara default `FIRMS_MAP_KEY` di `assets/js/api.js` dikosongkan (sengaja
tidak ikut di-commit ke repo publik), jadi dashboard berjalan normal dengan
data contoh. Untuk data titik panas real-time dari NASA FIRMS, daftar API key
gratis di https://firms.modaps.eosdis.nasa.gov/api/map_key/ lalu isi di baris
`FIRMS_MAP_KEY` **secara lokal saja** — jangan pernah commit key itu ke git.

### Mengaktifkan kualitas udara (PM2.5/AQI) live (opsional)

Secara default `WAQI_CONFIG.token` di `assets/js/data.js` dikosongkan, jadi
kartu PM2.5 di Dashboard memakai data contoh dan ditandai jelas ("Data
contoh — WAQI belum dikonfigurasi"). Untuk AQI real-time Pekanbaru (dari
World Air Quality Index / aqicn.org — jaringan yang skala AQI-nya sama
dengan yang ditampilkan IQAir), daftar token **gratis** (cukup email,
langsung aktif) di https://aqicn.org/data-platform/token/, lalu isi di
`WAQI_CONFIG.token` **secara lokal saja** — jangan pernah commit token itu
ke git. Setelah diisi, kartu PM2.5 akan otomatis ikut ter-refresh bersamaan
tombol "Sinkronkan Sekarang" & auto-sync BMKG/FIRMS di Monitoring/Dashboard.

## Struktur folder

```
firesentry-karhutla/
├── index.html            # Halaman login admin
├── dashboard.html         # 1. Dashboard
├── monitoring.html        # 2. Monitoring Karhutla — kini juga memuat tab Data Cuaca & Data Hotspot
├── peta.html               # 3. Peta Wilayah (Leaflet + OpenStreetMap)
├── analisis-risiko.html   # 4. Analisis Risiko — peta KRB (Kawasan Rawan Bencana)
├── peringatan.html        # 5. Peringatan
├── data-hotspot.html      # (alih arah otomatis → monitoring.html?tab=hotspot, bukan halaman aktif)
├── data-cuaca.html        # (alih arah otomatis → monitoring.html?tab=cuaca, bukan halaman aktif)
├── laporan.html           # 6. Laporan
└── assets/
    ├── css/style.css      # Design system (warna, layout, komponen)
    ├── img/krb/           # Overlay PNG peta KRB (hasil olahan raster 4 Risiko.gdb)
    └── js/
        ├── data.js         # Data contoh / fallback (struktur mengikuti sumber resmi)
        ├── api.js          # Integrasi API resmi (BMKG, NASA FIRMS, WAQI)
        ├── batas-kecamatan.js  # GeoJSON batas kecamatan (sumber: GADM)
        ├── risiko-krb.js   # Data & overlay peta KRB, diolah dari 4 Risiko.gdb
        └── components.js   # Sidebar, autentikasi, util UI bersama
```

## Sumber data resmi & cara menghubungkannya

| Data | Sumber Resmi | Status di project ini |
|---|---|---|
| Cuaca (suhu, kelembapan, prakiraan) | BMKG — Data Prakiraan Cuaca Terbuka. Portal: https://data.bmkg.go.id/prakiraan-cuaca/ · Endpoint API: `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}` · Contoh uji coba: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=31.71.03.1001 | **Sudah terhubung** di `data-cuaca.html`. Set kode wilayah (`adm4`) pada `EWS_CONFIG.bmkgAdm4` (`assets/js/data.js`) sesuai kelurahan yang dipantau. Cari kode kelurahan Pekanbaru di https://kodewilayah.id atau https://disdukcapil.pekanbaru.go.id (rujukan Permendagri No. 58 Tahun 2021). Kode contoh saat ini: `14.71.02.1004`. |
| Titik panas (hotspot) | **Pantau Titik Panas (Hotspot) Mandiri — BMKG Stamet SSK II Pekanbaru**: https://stamet-riau.bmkg.go.id/index.php?menu=cuaca&submenu=hotspot | Situs BMKG ini berupa halaman dinamis tanpa API terbuka, sehingga tidak bisa ditarik otomatis (fetch) dari browser. Ditampilkan sebagai **tautan resmi langsung** di `data-hotspot.html` (tombol "Buka Pantau Hotspot Mandiri BMKG"). Tabel di halaman yang sama adalah arsip internal BPBD (data contoh — ganti dengan pencatatan aktual petugas). |
| Kualitas udara (PM2.5/AQI) | **World Air Quality Index — WAQI/aqicn.org** (`https://api.waqi.info/feed/pekanbaru/?token={token}`), jaringan monitoring gabungan (stasiun resmi + sensor tervalidasi) yang skala AQI-nya SAMA dengan yang ditampilkan IQAir (AQI+ US). Dok: https://aqicn.org/json-api/doc/ | **Sudah terhubung** di kartu PM2.5 Dashboard. Isi token gratis pada `WAQI_CONFIG.token` (`assets/js/data.js`) — lihat bagian "Mengaktifkan kualitas udara (PM2.5/AQI) live" di atas. Tanpa token, memakai data contoh yang ditandai jelas di kartu. |
| Peta dasar | OpenStreetMap (openstreetmap.org) | Sudah terhubung (gratis, tanpa API key) via Leaflet. |
| Batas wilayah Kota Pekanbaru | Indikatif (digambar manual di `peta.html`) | Untuk batas administratif presisi (resmi Kemendagri/BIG), unduh GeoJSON dari https://github.com/Alf-Anas/batas-administrasi-indonesia lalu muat dengan `L.geoJSON()` menggantikan poligon `batasPekanbaru` di `peta.html`. |

## Riwayat Revisi

Revisi hasil konsultasi pembimbing (per 03 Sep 2026):
1. **Data Hotspot** — sumber diganti mengacu ke *Pantau Titik Panas (Hotspot) Mandiri* BMKG Stamet Riau (tautan resmi + real-time), bukan lagi SIPONGI+/FIRMS sebagai rujukan utama.
2. **Monitoring Karhutla** — data kini bisa diunduh langsung sebagai CSV (tombol "Download Data").
3. **Peta Wilayah** — ditambahkan garis batas wilayah Kota Pekanbaru (dashed) sebagai pembeda area pemantauan.
4. **Peringatan** — fitur input peringatan manual dihapus.
5. **Peringatan** — data kini dihasilkan otomatis dari data Monitoring Karhutla (fungsi `generatePeringatanDariMonitoring()` di `data.js`), bukan daftar statis.
6. **Riwayat Kejadian** — admin/petugas kini bisa menambahkan kejadian baru langsung dari halaman ini (form "Tambah Kejadian Karhutla"), tersimpan di `localStorage`.
7. **Laporan** — form laporan kini menyertakan data Monitoring, Cuaca, Hotspot, dan Riwayat Kejadian (checkbox pilihan), dengan fitur rentang tanggal (Tanggal Mulai/Selesai) yang otomatis memfilter data hotspot & kejadian saat laporan dicetak.
8. **Keterhubungan otomatis Monitoring → Peringatan/Peta/Dashboard** — halaman Monitoring kini punya tombol **"✏️ Update"** per kecamatan (ubah suhu/kelembapan/titik panas). Tingkat risiko dihitung ulang otomatis oleh sistem (`ewsHitungRisiko()`, bukan dipilih manual), disimpan sebagai satu sumber data bersama (`ewsGetWilayahRisikoGabungan()` di `assets/js/data.js`), lalu otomatis dipakai ulang oleh halaman Peringatan, Peta, dan Dashboard — jadi begitu data Monitoring diperbarui, ketiga halaman itu langsung menampilkan hasil terbaru tanpa perlu input ulang.
9. **Peringatan dini bisa ditutup** — tiap peringatan aktif punya tombol **"✔ Tutup Peringatan"**; setelah ditutup langsung pindah ke tabel Riwayat Peringatan Sebelumnya (tersimpan di `localStorage`), dan otomatis muncul lagi sebagai aktif kalau kondisi datanya berubah lagi.
10. **Sinkronisasi data real-time (BMKG + FIRMS)** — halaman Monitoring sekarang benar-benar menarik data **langsung dari sumber resmi**, bukan lagi murni data contoh:
    - **Suhu & kelembapan**: diambil langsung dari BMKG (`api.bmkg.go.id`) per kelurahan wakil tiap kecamatan (lihat `KECAMATAN_ADM4` di `assets/js/data.js`), memakai titik data paling dekat dengan waktu sekarang.
    - **Titik panas**: diambil dari NASA FIRMS (data satelit VIIRS/MODIS real-time — sumber yang sama dipakai SIPONGI), lalu tiap titik dikelompokkan ke kecamatan terdekat secara otomatis. **Perlu API key gratis** — isi `FIRMS_MAP_KEY` di `assets/js/api.js` (daftar di https://firms.modaps.eosdis.nasa.gov/api/map_key/). Sebelum diisi, titik panas tetap memakai nilai yang tersimpan sebelumnya.
    - Sinkronisasi berjalan **otomatis setiap halaman Monitoring dibuka** (kalau belum pernah sync atau sudah lewat 12 jam), dan bisa dipicu manual lewat tombol **"🔄 Sinkronkan Sekarang"**.
    - **Kenapa baru 1 kecamatan yang presisi**: BMKG cuma punya endpoint sampai level kelurahan, bukan kecamatan — jadi tiap kecamatan perlu 1 kode kelurahan wakil. Baru "Pekanbaru Kota" yang saya verifikasi manual (`14.71.02.1004`). Kecamatan lain untuk sementara memakai kode itu juga sebagai wakil (supaya tetap dapat data BMKG asli, bukan dummy), dengan penyesuaian angka mengikuti selisih data contoh awal supaya variasi antar kecamatan tetap masuk akal. **Lengkapi `KECAMATAN_ADM4`** di `data.js` dengan kode kelurahan asli tiap kecamatan (cari di https://kodewilayah.id) untuk hasil yang presisi.
    - **Soal "update tiap hari otomatis"**: karena ini website statis tanpa server, sinkron hanya jalan saat ada yang membuka halaman (device siapa pun yang membuka browser akan memicu sync terbaru). Untuk auto-update di background 24/7 tanpa perlu dibuka sama sekali, dibutuhkan server terjadwal (misalnya cron job/serverless function yang menulis ke sebuah database) — di luar cakupan website statis HTML/CSS/JS ini.
11. **Peta Wilayah — batas kecamatan dilengkapi** — ditambahkan batas indikatif untuk **Binawidya**, **Tuah Madani**, dan **Marpoyan** (menyusul batas kecamatan induknya yang sudah ada), supaya semua wilayah yang muncul di daftar Monitoring kini juga tergambar di Peta. Catatan: "Marpoyan" bukan nama kecamatan resmi (nama resminya Kecamatan Marpoyan Damai; "Marpoyan" sendiri adalah nama kelurahan di dalamnya) — lihat detail pada properti `catatan` tiap wilayah di `assets/js/batas-kecamatan.js`.
12. **Data Hotspot — arsip kini ikut tersinkron otomatis dari NASA FIRMS** — sebelumnya tabel "Arsip Data Titik Panas" di `data-hotspot.html` selalu memakai data contoh statis (`DATA_HOTSPOT`) sehingga tanggalnya tidak pernah berubah. Sekarang halaman ini memakai fungsi sinkron yang **sama persis** dengan Monitoring (`ewsSinkronMonitoringRealtime()` di `assets/js/api.js`) — begitu `FIRMS_MAP_KEY` diisi, setiap titik panas dari NASA FIRMS (bukan cuma jumlahnya seperti di Monitoring, tapi detail per titik: koordinat, jam, satelit, confidence) otomatis disimpan sebagai arsip 14 hari terakhir (`ewsGetArsipHotspot()`), dan tabel akan menampilkan data itu — bukan lagi data contoh. Halaman ini juga punya tombol "Sinkronkan Sekarang" + auto-sync tiap dibuka (aturan 12 jam, sama seperti Monitoring). **Tetap perlu diingat**: karena situs ini statis tanpa server, "update setiap hari" di sini berarti "otomatis segar setiap kali ada yang membuka halamannya" — bukan pembaruan latar belakang 24/7. Untuk itu (mis. supaya arsip tetap ter-update walau tidak ada yang buka situsnya), dibutuhkan server terjadwal (cron job/serverless function) yang memanggil endpoint FIRMS lalu menyimpan hasilnya ke database — di luar cakupan website statis HTML/CSS/JS ini (sama seperti catatan pada poin 10 di atas).
13. **Data Cuaca & Data Hotspot digabung ke dalam Monitoring Karhutla** — kedua halaman itu sudah **bukan lagi menu terpisah**. Isinya sekarang menjadi dua tab tambahan di dalam `monitoring.html` (🌦️ **Data Cuaca** dan 📈 **Data Hotspot**, di samping tab 🔥 **Monitoring per Kecamatan**), dengan SATU kartu "Sinkronisasi Data Real-time" di bagian atas yang memperbarui ketiga tab sekaligus (suhu/kelembapan BMKG, prakiraan 3 hari BMKG, dan arsip titik panas NASA FIRMS) — jadi datanya selalu konsisten dan tidak perlu sinkron dua kali di dua halaman berbeda. Tab aktif tersimpan di URL (`monitoring.html?tab=cuaca` / `?tab=hotspot`) sehingga bisa ditautkan langsung. File `data-cuaca.html` dan `data-hotspot.html` masih ada tetapi hanya berisi alih-arah (redirect) otomatis ke tab terkait, supaya tautan/bookmark lama tidak rusak.
14. **Halaman Riwayat Kejadian dihapus** — `riwayat.html` beserta tautannya di sidebar (`assets/js/components.js`) sudah dihapus sepenuhnya sesuai permintaan. Fungsi data terkait (`RIWAYAT_KEJADIAN`, `ewsSemuaRiwayat()`, dst.) di `assets/js/data.js` **tidak dihapus** karena masih dipakai oleh bagian "4. Riwayat Kejadian Karhutla" pada `laporan.html` (opsi checkbox "Riwayat Kejadian" saat membuat laporan) — hanya saja kini tidak ada lagi halaman UI untuk menambah/mengubah data tersebut secara manual. Beri tahu jika bagian ini di `laporan.html` juga ingin dihapus/diganti.
15. **Perbaikan: Peringatan "macet" di Rendah** — ditemukan penyebabnya: `ewsGetWilayahRisikoGabungan()` (di `data.js`) langsung memakai isi `data/status-notifikasi-terakhir.json` (hasil cek GitHub Actions) tanpa memvalidasi bentuknya dulu. Karena file itu masih format lama (string polos, bukan objek detail) dan/atau GitHub Actions memang **belum pernah jalan** (repo belum di-push ke GitHub, jadi workflow-nya belum aktif), kecamatan yang "menang" lewat sumber otomatis ini jadi punya `risiko: undefined` — dan kecamatan dengan `risiko: undefined` **hilang begitu saja** dari pengelompokan Tinggi/Sedang/Rendah di `generatePeringatanDariMonitoring()`, sehingga peringatan Tinggi/Sedang yang sebenarnya ada tidak muncul lagi dan halaman Peringatan terlihat "stuck" di Rendah (atau kosong). Perbaikan: ditambahkan `ewsEntriOtomatisValid()` yang memvalidasi entri otomatis sebelum dipakai (kalau tidak valid/belum ada, dianggap tidak ada — bukan menimpa dengan `undefined`); file `data/status-notifikasi-terakhir.json` juga dirapikan ke format baru (nilai `null` + `_meta.diperbaruiPada: null`) yang jujur menyatakan "belum pernah dijalankan", bukan berpura-pura sudah pernah dicek dan hasilnya semua Rendah.
16. **Auto-sinkronisasi saat login / masuk Dashboard** — sebelumnya, sinkronisasi BMKG+FIRMS HANYA otomatis jalan kalau ada yang membuka halaman Monitoring Karhutla; Dashboard dan Peringatan hanya membaca data yang kebetulan sudah tersimpan. Ditambahkan fungsi bersama `ewsAutoSyncMonitoringJikaPerlu()` (di `api.js`, aturan sama seperti Monitoring: jalan kalau belum pernah sync atau sudah lewat 12 jam) yang sekarang juga dipanggil dari `dashboard.html` (begitu masuk Dashboard setelah login) dan `peringatan.html` (begitu halaman Peringatan dibuka) — jadi begitu petugas login dan masuk Dashboard, data Monitoring otomatis ikut disegarkan, dan halaman Peringatan otomatis menyesuaikan tanpa perlu membuka Monitoring secara manual lebih dulu. Karena memakai kunci waktu sinkron yang sama (`ews_karhutla_sync_terakhir`), ketiga halaman ini tidak saling memanggil BMKG/FIRMS berulang — cukup satu kali per 12 jam per browser, dari halaman manapun yang pertama kali dibuka.
18. **Perbaikan: Peringatan tidak lagi "stuck" di Rendah walau sempat Sedang/Tinggi** — akar masalahnya BUKAN logika perhitungan risiko (itu sudah benar sejak poin 15), tapi file `.github/workflows/cek-status-karhutla.yml` yang **belum pernah ada** di repo, padahal `scripts/cek-status-karhutla.mjs` dan komentar-komentar di `data.js`/`notifikasi.js` sudah mengasumsikannya berjalan tiap 3 jam. Akibatnya cek otomatis (GitHub Actions) memang **tidak pernah jalan sama sekali** — bukan gagal — dan satu-satunya sumber data adalah sinkron langsung dari browser (per-device, hanya jalan saat halaman dibuka). Kalau kondisi sempat naik ke Sedang di satu momen tapi tidak ada yang membuka halaman & klik "Tutup Peringatan" saat itu juga, begitu ada yang membuka halaman lagi di lain waktu dan kondisi terkini sudah kembali Rendah, momen Sedang tadi hilang tak berbekas (tidak pernah ternotifikasi maupun tercatat). Dua perbaikan: (a) menambahkan file workflow tersebut (jadwal cron tiap 3 jam + `workflow_dispatch` untuk uji manual) — **perlu diaktifkan di GitHub**: push repo, isi 3 secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `FIRMS_MAP_KEY`) di Settings → Secrets and variables → Actions, dan set "Workflow permissions" ke "Read and write permissions" supaya hasil cek bisa di-commit balik; (b) `scripts/cek-status-karhutla.mjs` sekarang mencatat setiap momen naik ke Sedang/Tinggi ke `_meta.riwayatEskalasi` (maks 50 entri, tersimpan terus walau kondisi kemudian turun lagi), dan `assets/js/data.js` (`ewsGetRiwayatEskalasiOtomatis()`) menggabungkannya ke tabel Riwayat Peringatan di `peringatan.html` — jadi histori naik-turun status tetap terlihat walau tidak sempat ditutup manual saat aktif.
19. **Kartu PM2.5/AQI Dashboard dihubungkan ke data real-time (WAQI)** — sebelumnya kartu PM2.5 memakai satu angka contoh yang **tidak pernah berubah** (`DASHBOARD_SUMMARY.pm25 = 86`), sehingga terlihat jauh berbeda dari angka yang ditampilkan IQAir untuk Pekanbaru pada hari yang sama (mis. AQI 230 vs kartu yang menunjukkan 86). Ditambahkan integrasi ke **World Air Quality Index (WAQI/aqicn.org)** — jaringan monitoring yang skala AQI-nya (AQI+ US) **sama persis** dengan yang dipakai IQAir, sehingga angkanya akan selalu dekat dengan yang tampil di iqair.com tanpa perlu scraping (yang memang tidak bisa dilakukan langsung dari browser karena CORS & melanggar ToS). Detail: `WAQI_CONFIG` + `fetchWaqiPekanbaru()`/`ewsSinkronKualitasUdara()` di `assets/js/data.js` & `assets/js/api.js`, ikut disinkronkan otomatis bersamaan BMKG/FIRMS (`ewsSinkronMonitoringRealtime()`) setiap tombol "Sinkronkan Sekarang" ditekan atau auto-sync 12 jam berjalan. Kartu di Dashboard sekarang juga menampilkan **kategori kualitas udara** (Baik/Sedang/Tidak Sehat/dst., mengikuti breakpoint AQI EPA — sama seperti label yang dipakai IQAir) dan jam pengukuran terakhir, bukan cuma satu angka statis. **Perlu token gratis** — lihat bagian "Mengaktifkan kualitas udara (PM2.5/AQI) live" di atas; sebelum diisi, kartu tetap tampil dengan data contoh namun **ditandai jelas** ("Data contoh — WAQI belum dikonfigurasi") supaya tidak disalahartikan sebagai data real-time.

## Login/Autentikasi

Autentikasi pada versi ini berjalan **di sisi klien** (localStorage) khusus
untuk keperluan demo/tugas magang — cocok untuk dijalankan tanpa server
backend. Untuk penggunaan produksi di lingkungan BPBD sesungguhnya,
disarankan mengganti `index.html` + `assets/js/components.js` (fungsi
`ewsRequireAuth`, `ewsLogout`) agar terhubung ke backend/API otentikasi resmi
instansi (mis. session/JWT + database pengguna).

## Mengganti logo

Logo pada sidebar dan halaman login diambil dari file `assets/img/logo-bpbd.png`
(logo resmi BPBD Kota Pekanbaru). Untuk mengganti dengan versi lain:

1. Timpa (replace) file `assets/img/logo-bpbd.png` dengan file baru — gunakan
   nama file yang sama agar tidak perlu mengubah kode apa pun.
2. Jika ingin memakai nama/format file berbeda (mis. `.svg`), ganti juga nama
   file pada atribut `src` di `assets/js/components.js` (bagian `renderSidebar`)
   dan `index.html` (bagian `login-brand`).
3. Simpan — logo baru otomatis tampil di seluruh halaman (sidebar & login)
   tanpa perlu perubahan lain.

## Kustomisasi data

Seluruh data tampilan (statistik dashboard, daftar wilayah, hotspot, riwayat
kejadian, laporan, peringatan) berada di satu file: `assets/js/data.js`.
Ganti isinya dengan data aktual BPBD Kota Pekanbaru kapan saja tanpa perlu
mengubah halaman HTML.

## GitHub Actions + Telegram (sudah disiapkan)

Workflow `.github/workflows/cek-status-karhutla.yml` menjalankan pengecekan setiap 30 menit dan dapat dijalankan manual dari tab **Actions**. Data sensitif tidak disimpan di source code.

Buat Repository Secrets berikut di **Settings → Secrets and variables → Actions → Secrets**:

- `TELEGRAM_BOT_TOKEN` — token dari BotFather.
- `TELEGRAM_CHAT_ID` — ID grup/channel tujuan bot.
- `FIRMS_MAP_KEY` — NASA FIRMS MAP_KEY.
- `FIRESENTRY_BASE_URL` — opsional. Jika diisi, contoh `https://USERNAME.github.io/NAMA-REPO`; jika kosong, workflow otomatis membentuk URL GitHub Pages dari `GITHUB_REPOSITORY`.

Pesan Telegram eskalasi memakai format:

```text
🟠 PERINGATAN DINI KARHUTLA
Status: SEDANG
Kecamatan: ...
Kelurahan: ...
Suhu: ...°C | Kelembapan: ...%
Titik panas: ...
Waktu: ...

latitude & longitude: ...

🔗 Lihat peta kejadian
```

Koordinat berasal dari titik FIRMS yang terdeteksi untuk kecamatan terkait; bila tidak ada hotspot, sistem memakai titik acuan kecamatan. Link peta membuka `peta.html` pada koordinat tersebut.


## Test Telegram dari GitHub Actions

Buka **Actions → FireSentry - Cek Status Karhutla → Run workflow**. Pada `mode`, pilih **test-telegram**. Test menggunakan data BMKG dan NASA FIRMS hasil run saat itu, tetapi pesan diberi label **SIMULASI** sehingga tidak disalahartikan sebagai peringatan operasional. Mode `normal` dipakai untuk pengecekan biasa/terjadwal.

### Validasi NASA FIRMS

Workflow mencatat jumlah deteksi per sensor (`VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`), jumlah setelah deduplikasi, dan contoh koordinat pada log Actions. Data terakhir disimpan di `data/hotspot-live.json`. Pemetaan hotspot ke kecamatan menggunakan poligon `assets/js/batas-kecamatan.js` bila tersedia, lalu fallback ke titik acuan kecamatan.
