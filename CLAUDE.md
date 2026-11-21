# AGENTS.md: NgBlu (versi Flask, CAKREN HACKSPACE)

Nama aplikasi: **NgBlu** (dulu "Cermin"). Nama diatur di `APP_NAME` (`app.py`, bisa ditimpa lewat `.env`). Logo: taruh `static/img/logo.png` (atau `.svg/.webp/.jpg`), otomatis dipakai; tanpa itu tampil `static/img/logo-placeholder.svg`.

## Produk dalam satu paragraf
NgBlu melatih mahasiswa menghadapi interview bersama pewawancara animasi bernama **Pak Kumis** (kucing tabby abu-abu berjas navy dengan ID card HRD). Masukan: CV (PDF atau teks), deskripsi posisi, nama perusahaan. Layar interview punya tiga panel: KIRI transkrip langsung dengan garis bawah ala Grammarly, TENGAH Pak Kumis dengan kotak dialog, KANAN grafik skor dan daftar temuan ala chess.com. Fitur khas: **Efek Kesadaran**, yaitu vignette, blur, dan redup di panel samping saat blunder menumpuk, supaya mahasiswa sadar sedang gugup. Gaya visual terang dan ramah ala Duolingo.

Ini adaptasi dari "Cermin Agent Pack" (Next.js) ke stack yang sudah berjalan. Pemetaan lengkapnya ada di `docs/ADAPTASI.md`.

## Aturan keras (dari pack, tetap berlaku)
- Jangan simpan audio mentah. Jangan simpan atau mencatat teks CV maupun transkrip. Server tetap stateless.
- Transkrip adalah catatan apa adanya. Umpan balik tidak pernah mengubah kata yang diucapkan.
- Jangan pernah menilai aksen atau pelafalan.
- Efek Kesadaran tidak boleh menutupi Pak Kumis atau kotak dialog, wajib menghormati `prefers-reduced-motion`, tidak boleh berkedip di atas 3 Hz, dan punya pilihan Mati / Lembut / Penuh.
- Setiap flag dari AI divalidasi di server (indeks kata ada, kategori dan tipe cocok). Flag yang tidak valid dibuang diam-diam (`interview_engine.validate_flags`).

## Stack
Flask (Python 3.10+) di PythonAnywhere, Claude API (`claude-sonnet-5-5` untuk analisis dan ringkasan, `claude-haiku-5-5` untuk analisis per jawaban), `pypdf` untuk teks PDF, Web Speech API (STT) dan `speechSynthesis` (TTS) di browser, JavaScript biasa tanpa build step, SVG dan CSS untuk animasi.

## Susunan file
```
app.py                  endpoint Flask: /, /demo, /api/config, /api/samples, /api/analyze, /api/plan, /api/turn, /api/report; nama dan logo aplikasi
llm_client.py           panggilan Claude, structured outputs, retry JSON, pencatat token, mode tiruan (MOCK_LLM=1)
match_analyzer.py       baca PDF, analisis kecocokan, skor dan gerbang negative case dihitung kode
question_planner.py     rencana pertanyaan berbasis slot, validasi, pertanyaan cadangan, mode demo
interview_engine.py     analisis per jawaban (flag berindeks kata), ringkasan sesi, rumus skor akhir
samples.py              CV dan lowongan contoh
templates/index.html    layar persiapan, layar interview tiga panel, modal
templates/cat.svg       Pak Kumis, berlapis, 7 state
static/js/config.js     SEMUA ambang batas, bobot, label, dan teks (jangan ditulis langsung di logika)
static/js/analysis.js   fungsi murni: heuristik, Composure Load, histeresis, skor (bisa diuji di Node)
static/js/seed.js       sesi rekaman ~90 detik + hasil analisis kecocokan untuk mode demo offline
static/fonts/           Fredoka dan Nunito di-host sendiri (tidak bergantung Google Fonts)
static/img/             logo (logo.png menimpa logo-placeholder.svg)
docs/DEMO.md            panduan mode presentasi dan naskah 3 menit
static/js/app.js        antarmuka dan alur
static/css/style.css    token warna, komponen, efek, animasi
tests/analysis.test.js  unit test heuristik, komposur, skor
```

## Perintah
```bash
pip install -r requirements.txt
MOCK_LLM=1 python app.py          # http://127.0.0.1:5000 tanpa API key
node --test tests/analysis.test.js
python check_setup.py             # cek API key dan model sebelum deploy
```

## Definition of done
1. `node --check` lolos untuk semua file JS dan Python bisa di-import.
2. Unit test lolos; logika murni baru wajib punya test di `tests/`.
3. Jalur demo lolos: mode replay offline berjalan sampai ringkasan tanpa error di console.
4. Bobot dan kategori di `static/js/config.js` sama dengan `WEIGHTS` dan `TYPE_CATEGORY` di `interview_engine.py`. Pengali skor akhir HANYA diubah di `FINAL_MULTIPLIER` (`interview_engine.py`, saat ini 3); browser membacanya dari `/api/config`, angka di `config.js` hanya cadangan offline dan dicek oleh unit test.
5. Tidak ada rahasia di file statis; API key hanya di `.env` server.

## Aturan gaya
- Semua waktu dalam milidetik bilangan bulat sejak `t0` (akhir audio pertanyaan pertama).
- Animasi hanya `transform` dan `opacity` (kecuali blur efek kesadaran), kurva dari `--ease-out` dan `--ease-in-out`.
- Teks antarmuka memakai "kamu"; pertanyaan dari Pak Kumis memakai "Anda".
