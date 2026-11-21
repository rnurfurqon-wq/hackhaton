# NgBlu: panduan deploy ke PythonAnywhere

Panduan ini berurutan. Kerjakan satu langkah, pastikan hasilnya sesuai, baru lanjut.

## Isi proyek

| File | Fungsi |
|---|---|
| `app.py` | Server Flask, semua endpoint API |
| `llm_client.py` | Panggilan ke Claude API, structured outputs, pencatat token, mode tiruan |
| `match_analyzer.py` | Baca PDF, analisis kecocokan, skor, gerbang negative case |
| `question_planner.py` | Rencana pertanyaan (slot, validasi, cadangan, mode demo) |
| `interview_engine.py` | Analisis per jawaban dengan flag berindeks kata, ringkasan sesi, skor akhir |
| `samples.py` | CV dan lowongan contoh untuk tombol "Contoh" |
| `templates/` | Halaman utama dan Pak Kumis (`cat.svg`) |
| `static/css/style.css` | Tampilan ala Duolingo dan Efek Kesadaran |
| `static/js/` | `config.js` (ambang dan bobot), `analysis.js` (heuristik dan skor), `seed.js` (sesi rekaman mode demo), `app.js` (antarmuka) |
| `static/fonts/` | Font Fredoka dan Nunito (di-host sendiri) |
| `static/img/` | Logo. Taruh `logo.png` di sini untuk mengganti logo sementara |
| `tests/analysis.test.js` | Unit test heuristik, komposur, skor (`node --test tests/analysis.test.js`) |
| `check_setup.py` | Cek API key dan model sebelum membuka web |
| `wsgi_pythonanywhere.py` | Isi file WSGI untuk PythonAnywhere |
| `AGENTS.md`, `CLAUDE.md`, `docs/` | Panduan untuk coding agent, pemetaan dari Cermin Agent Pack, dan `docs/DEMO.md` (mode presentasi) |

## Sudah pernah deploy? Cara memperbarui

Tidak ada library baru, jadi `pip install` dan `.env` tidak perlu diubah. Nama folder tetap `hackathongoks`, jadi file WSGI dan pengaturan Static files juga tidak berubah.

1. Upload zip yang baru (misalnya `ngblu-hackathongoks.zip`) ke folder home di tab **Files**.
2. Di Bash console:
   ```bash
   cd ~
   unzip -o ngblu-hackathongoks.zip
   ```
   Isinya folder `hackathongoks/`, jadi file lama tertimpa dan `.env` tetap aman (tidak ada di zip).
3. Klik **Reload** di tab **Web**, lalu buka situsnya dengan **Ctrl+Shift+R** supaya CSS dan JS lama tidak tersimpan di cache browser.
4. Cek cepat: buka `https://USERNAME.pythonanywhere.com/demo`. Demo harus berjalan sendiri sampai layar "Latihan selesai!".

## Mengganti logo

1. Siapkan logo, idealnya PNG persegi dengan latar transparan (minimal 128 x 128 px). Logo lebar juga bisa, tingginya otomatis 32 px.
2. Upload ke `~/hackathongoks/static/img/` dengan nama persis **`logo.png`** (boleh juga `logo.svg`, `logo.webp`, atau `logo.jpg`).
3. Klik **Reload** di tab Web. Logo otomatis dipakai di header dan sebagai ikon tab browser. Tidak ada kode yang perlu diubah.

Nama aplikasi diatur di `APP_NAME` (default `NgBlu`). Kalau perlu diganti, tambahkan `APP_NAME=NamaBaru` di `.env`, lalu Reload.

Kalau belum pernah deploy, ikuti langkah 0 sampai 8 di bawah.

---

## Langkah 0. Siapkan API key di Claude Console

1. Buat API key baru di Claude Console.
2. Atur batas pemakaian (spend limit) di Console, supaya biaya tidak melewati anggaran tim.
3. Simpan key di tempat aman. Jangan kirim lewat chat, jangan tulis di kode.

## Langkah 1. Push kode ke GitHub

Di laptop, dari folder hasil ekstrak zip:

```bash
cd hackathongoks
git init
git add .
git status            # PASTIKAN .env TIDAK ada di daftar
git commit -m "Ruang Interview: versi awal"
git branch -M main
git remote add origin https://github.com/vankaaism/hackathongoks.git
git push -u origin main
```

Repo ini publik. File `.gitignore` sudah mencegah `.env` ikut ter-push, tapi tetap cek `git status` sebelum setiap push.

## Langkah 2. Ambil kode di PythonAnywhere

Buka tab **Consoles**, pilih **Bash**, lalu:

```bash
git clone https://github.com/vankaaism/hackathongoks.git
cd hackathongoks
```

## Langkah 3. Cek akses ke Claude API

Akun gratis PythonAnywhere hanya bisa mengakses situs yang ada di whitelist.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://api.anthropic.com/v1/messages
```

- **Keluar angka** (misalnya 401 atau 405): aman, lanjut ke langkah 4.
- **Keluar error `403 from proxy`**: domain belum diizinkan untuk akun gratis. Pilihannya upgrade akun PythonAnywhere, atau deploy di Render atau Railway.

## Langkah 4. Buat virtualenv dan pasang library

```bash
mkvirtualenv --python=python3.10 ruang-interview
pip install -r requirements.txt
```

Boleh pakai Python 3.10 atau lebih baru yang tersedia di akun Anda. Catat versinya, karena dipakai lagi di langkah 7.

## Langkah 5. Isi file .env

```bash
cp .env.example .env
nano .env
```

Isi `ANTHROPIC_API_KEY` dengan key dari langkah 0. Isi juga `ACCESS_CODE` dengan kode bebas (misalnya `kucing2026`) supaya orang lain tidak bisa memakai saldo API lewat link publik. Simpan dengan `Ctrl+O`, `Enter`, lalu keluar dengan `Ctrl+X`.

## Langkah 6. Cek key dan model

```bash
python check_setup.py
```

Hasil yang diharapkan: kedua baris model berstatus **OK**.

- `AuthenticationError`: key salah atau belum tersalin lengkap.
- `NotFoundError` pada model: nama model di `.env` tidak tersedia di akun Anda. Lihat daftar model di Claude Console, lalu ubah `CLAUDE_MODEL_MAIN` atau `CLAUDE_MODEL_FAST`.

## Langkah 7. Buat web app

Buka tab **Web**:

1. Klik **Add a new web app**, lalu pilih **Manual configuration** (bukan "Flask").
2. Pilih versi Python yang sama dengan langkah 4.
3. Di bagian **Virtualenv**, isi: `/home/USERNAME/.virtualenvs/ruang-interview`
4. Klik link **WSGI configuration file**, hapus seluruh isinya, lalu tempel isi `wsgi_pythonanywhere.py`. Ganti `USERNAME` dengan username Anda. Simpan.
5. Di bagian **Static files**, tambahkan URL `/static/` dengan directory `/home/USERNAME/hackathongoks/static`.
6. Klik tombol hijau **Reload**.

## Langkah 8. Coba aplikasinya

1. Buka `https://USERNAME.pythonanywhere.com` di **Chrome** (input suara paling andal di Chrome).
2. Isi kode akses jika diminta.
3. Klik **Contoh: cocok**, lalu **Cek kecocokan**.
4. Pilih jumlah pertanyaan **2 (Demo)**, mulai interview, lalu izinkan mikrofon saat browser bertanya.
5. Coba juga **Putar demo** di langkah pertama, atau buka `/demo`: sesi rekaman sekitar 90 detik tanpa mikrofon, tanpa AI, dan tanpa jaringan. Panduan lengkapnya ada di `docs/DEMO.md`.

## Memperbarui kode

Setelah push perubahan dari laptop:

```bash
cd ~/hackathongoks
git pull
```

Lalu klik **Reload** di tab Web.

---

## Kalau ada masalah

| Gejala | Penyebab dan solusi |
|---|---|
| Halaman "Something went wrong" | Buka **Error log** di tab Web, baris paling bawah menunjukkan penyebabnya |
| "Analisis AI gagal" di aplikasi | Jalankan `python check_setup.py` untuk cek key dan model |
| "Kode akses salah" | Samakan isi kotak kode akses dengan `ACCESS_CODE` di `.env`, lalu Reload |
| Tombol rekam tidak aktif | Browser tidak mendukung Web Speech API. Pakai Chrome, atau ketik jawaban |
| Mikrofon tidak diminta izinnya | Pastikan membuka alamat `https://`, lalu cek izin mikrofon di pengaturan situs |
| Analisis dan laporan terasa lambat | Normal 5 sampai 20 detik untuk model utama. Animasi berpikir Pak Kumis menutupi jeda ini |
| Web app mati setelah beberapa bulan | Akun gratis perlu klik **Run until 3 months from today** di tab Web |

## Uji di laptop tanpa API key

```bash
pip install -r requirements.txt
MOCK_LLM=1 python app.py
```

Buka `http://127.0.0.1:5000`. Semua jawaban AI berupa contoh tetap, jadi tampilan dan alur bisa dicek tanpa biaya. Di Windows PowerShell, jalankan `$env:MOCK_LLM="1"; python app.py`.

## Checklist hari-H

- [ ] Sekitar pukul 13.30, jalankan satu sesi **mode demo** sampai sukses. Hasilnya tersimpan sebagai cadangan otomatis kalau API lambat saat presentasi.
- [ ] Kalau jaringan di panggung bermasalah, pakai **mode demo** (`/demo`, tombol **Putar demo**, atau Shift+D) untuk menunjukkan analisis kecocokan, transkrip, Efek Kesadaran, dan grafik. Lihat `docs/DEMO.md`.
- [ ] Buka tab `/demo` sebelum naik panggung, supaya halaman sudah termuat walau Wi-Fi putus.
- [ ] Rekam video layar 60 sampai 90 detik dengan skenario yang sama.
- [ ] Siapkan kode akses untuk juri yang ingin mencoba.
- [ ] Cantumkan di slide: aplikasi memakai Claude API (Sonnet untuk analisis dan laporan, Haiku untuk keputusan per jawaban), dan bagian mana yang dihitung kode.
