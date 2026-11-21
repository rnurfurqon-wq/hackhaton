# Perubahan versi NgBlu (21 November 2026)

Versi ini menggantikan zip "Cermin + Pak Kumis". Nama folder tetap `hackathongoks`, jadi WSGI, virtualenv, dan `.env` di PythonAnywhere tidak perlu diubah. Tidak ada library baru.

## 1. Nama dan logo
- Semua teks yang terlihat pengguna kini memakai **NgBlu** (judul tab, header, deskripsi). Nama diatur di `APP_NAME` (`app.py`, bisa ditimpa lewat `.env`).
- **Slot logo:** taruh `static/img/logo.png` (atau `.svg/.webp/.jpg`), lalu Reload. Logo otomatis muncul di header persiapan, header interview, dan ikon tab. Sebelum logo asli ada, tampil logo sementara `static/img/logo-placeholder.svg`.

### Logo dan warna (update kedua)
- Logo asli NgBlu sudah terpasang: `static/img/logo.png` (tanda kucing, latar transparan) di header dan `static/img/favicon.png` sebagai ikon tab. Wordmark di header ditulis "ngblu" huruf kecil mengikuti logo.
- Palet disesuaikan dengan logo: **navy #12294F** untuk teks, judul, dan label nama Pak Kumis; **biru #3B95E0** untuk aksi utama (tombol utama, progress bar, pilihan aktif, tombol mikrofon saat menjawab).
- Hijau tetap dipakai hanya untuk arti "bagus/berhasil" (syarat terpenuhi, skor tinggi, kekuatan) dan tombol telepon hijau "mulai panggilan", supaya makna warnanya tetap jelas.
- Versi logo lengkap (kucing + tulisan) dengan latar transparan untuk slide: `logo-ngblu-transparan.png` di folder proyek.

### Integrasi ringan dengan CDC Cakrawala (update ketiga)
- Di langkah deskripsi posisi ada kartu **"Belum punya lowongan? Buka CDC Cakrawala ↗"** yang membuka https://cdc.cakrawala.ac.id/login di tab baru. Mahasiswa login di CDC sendiri, menyalin deskripsi lowongan, lalu menempelnya ke NgBlu. NgBlu tidak login, tidak menyimpan kredensial, dan tidak mengambil data dari CDC.
- **Tautan masuk dari CDC (siap dipakai kelak):** `https://USERNAME.pythonanywhere.com/?source=cdc&company=PT%20Contoh&type=kerja&jd=<deskripsi lowongan, URL-encoded>`. Deskripsi dan nama perusahaan otomatis terisi; `type` boleh `kerja`, `kepanitiaan`, atau `beasiswa`. Teks hanya diisi ke formulir dan parameter dihapus dari alamat setelah terbaca.
- Alamat CDC bisa diganti lewat `CDC_URL` di `.env` (kosongkan untuk menyembunyikan kartu).

### Login Google (update keempat)
- Tombol **Sign in with Google** di layar pertama. Token diverifikasi di server (audiens, penerbit, masa berlaku, email terverifikasi), lalu disimpan sebagai cookie sesi bertanda tangan. Tidak ada password yang disimpan.
- Aktif hanya kalau `GOOGLE_CLIENT_ID` dan `SECRET_KEY` diisi di `.env` (langkah di `DEPLOY.md`). Kalau kosong, aplikasi berjalan persis seperti sebelumnya.
- Sudah login = boleh memakai AI. Kode akses tetap bisa dipakai sebagai cadangan. `/demo` tidak pernah butuh login dan tidak memuat skrip Google.
- Opsi `ALLOWED_EMAIL_DOMAINS` untuk membatasi ke email kampus. Nama pengguna tampil di header, dengan tombol Keluar, dan Pak Kumis menyapa dengan nama depan.
- Diuji lewat `tests/test_auth.py` (verifikasi Google ditiru): token salah audiens, kedaluwarsa, email belum terverifikasi, domain tidak diizinkan, login, logout, dan kode akses.

## 2. Mode presentasi
- Buka **`/demo`**, tekan tombol **Putar demo**, atau tekan **Shift+D**. Demo menampilkan hasil analisis kecocokan, lalu interview rekaman dua pertanyaan sampai ringkasan, sekitar 90 detik, berjalan sendiri.
- Tanpa mikrofon, tanpa panggilan AI, tanpa internet setelah halaman termuat. Badge **DEMO · rekaman** tampil supaya transparan bagi juri.
- Opsi URL: `voice=0` (bisu), `fx=off|gentle|full`, `auto=0` (presenter menekan sendiri). Panduan dan naskah ada di `docs/DEMO.md`.

## 3. Skor akhir
- Pengali skor akhir diturunkan dari 6 ke **3** (keputusan Rizal). Replay demo kini memberi skor 62 (sebelumnya 24).
- Angkanya kini hanya diatur di satu tempat: `FINAL_MULTIPLIER` di `interview_engine.py`. Browser membacanya dari `/api/config`, dan rumus di tab Detail ikut menyesuaikan.

## 4. Bug yang diperbaiki
| Masalah | Perbaikan |
|---|---|
| Kalau internet lemah, pengenalan suara Chrome gagal berulang dan pengguna terjebak di "Mendengarkan" tanpa teks | Setelah 2 kali error jaringan atau mikrofon, otomatis pindah ke kotak ketik dengan pesan yang jelas |
| Jawaban yang diketik dinilai sebagai ucapan: ketik cepat dianggap "Terlalu cepat", skor jatuh ke 0, statistik "1 detik bicara" | Jawaban ketik diberi waktu ucap perkiraan (~130 kata per menit); kecepatan dan jeda tidak dinilai untuk ketikan |
| Laporan pemakaian token tidak menghitung analisis CV dan penyusunan pertanyaan (poin rubrik efisiensi token) | Token kedua tahap itu kini ikut dijumlahkan di tab Detail |
| Font Fredoka/Nunito bergantung Google Fonts (belum teruji, rawan gagal di Wi-Fi lomba) | Font di-host sendiri di `static/fonts/` |
| Kalau Chrome menolak suara sebelum ada klik, teks pertanyaan langsung muncul utuh | Teks tetap diketik pelan; alur tidak terganggu |
| Timer otomatis mode replay tidak ikut dibersihkan saat keluar, bisa memajukan sesi berikutnya | Timer dicatat dan dibersihkan saat sesi dihentikan |
| Setelah replay, data contoh tertinggal di state dan catatan "Mode tiruan" ikut tampil di demo | State direset saat kembali ke persiapan; catatan disembunyikan selama demo |
| Input tidak valid ke `/api/turn`, `/api/plan`, `/api/report` (misalnya `followups_used: "abc"`) memicu error 500 | Divalidasi dan dibalas 400 atau nilai bawaan |
| `MOCK_LLM=1` menghasilkan pertanyaan "[Tiruan] Pertanyaan untuk slot ..." | Mode tiruan memakai pertanyaan cadangan yang wajar, dan tidak lagi menimpa `demo_cache.json` |

## 5. Yang sudah diuji
- `node --test tests/analysis.test.js`: 11 dari 11 lolos (test skor akhir diperbarui untuk pengali 3).
- `node --check` semua file JS dan import semua modul Python: lolos.
- Dengan `MOCK_LLM=1` di Chromium: alur lengkap (contoh cocok, analisis, 5 pertanyaan dengan jawaban ketik dan pertanyaan lanjutan, ringkasan, review, detail) dan mode demo dari `/demo`, tombol, dan Shift+D. Nol error di console.

## 6. Yang belum bisa diuji dari sini
- Mikrofon sungguhan dan suara Pak Kumis di Chrome laptop presentasi.
- Respons Claude asli untuk `/api/turn` dan `/api/report` (butuh API key di server). Jalankan `python check_setup.py` lalu satu sesi mode Demo setelah deploy.
