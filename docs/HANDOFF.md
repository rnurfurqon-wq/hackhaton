# Handoff: Cermin (Ruang Interview) untuk CAKREN HACKSPACE

## Cara memakai dokumen ini
1. Buka chat baru di akun Claude yang lain.
2. Upload file-file ini:
   - `hackathongoks.zip` (kode lengkap versi terbaru)
   - `HANDOFF.md` (dokumen ini)
   - Opsional: guidebook lomba (PDF), `cermin-agent-pack.zip`, dan 3 gambar referensi Pak Kumis
3. Salin **Prompt pembuka** di bagian paling bawah, tempel sebagai pesan pertama.

---

## Konteks proyek
- **Lomba:** CAKREN HACKSPACE, kompetisi AI dari Divisi Ristek Universitas Cakrawala. Sprint 5 jam (09.15 sampai 14.15 WIB). Studi kasus baru diumumkan pukul 09.00 hari-H.
- **Pengumpulan sebelum 14.15:** slide PDF maksimal 3 halaman memakai template panitia (Problem, AI Solution & Demo, Impact), link prototipe publik, dan video layar 60 sampai 90 detik. Presentasi 3 menit, tanya jawab 2 menit.
- **Rubrik:** Kesesuaian masalah 35%, Prototipe berfungsi 30%, Proses belajar & pemanfaatan AI 25% (termasuk efisiensi token dan transparansi kontribusi AI), Presentasi 10%.
- **Ide:** web latihan interview AI untuk mahasiswa (kerja/magang, kepanitiaan, beasiswa). Diadaptasi dari "Cermin Agent Pack" (PRD aslinya Next.js) ke Flask yang sudah berjalan.

## Status saat ini
- **Deploy:** PythonAnywhere akun gratis, username `hrdonline`, alamat `https://hrdonline.pythonanywhere.com`. Virtualenv `/home/hrdonline/.virtualenvs/ruang-interview` (Python 3.10). Akses ke `api.anthropic.com` sudah dicek tembus (curl menghasilkan 405).
- **API:** Claude Console milik sendiri (bukan token panitia). `check_setup.py` sudah lolos: `claude-sonnet-5-5` dan `claude-haiku-5-5` merespons. API key ada di `.env` server dan **tidak** ada di zip.
- **Versi yang sudah live dan teruji:** versi "Ruang Interview" sebelumnya.
- **Versi di zip ini (Cermin + Pak Kumis baru) belum di-deploy.** Cara update: upload zip ke Files, lalu jalankan `cd ~ && unzip -o hackathongoks.zip`, klik Reload di tab Web, dan buka situs dengan Ctrl+Shift+R.
- **Kode akses** aplikasi diatur lewat `ACCESS_CODE` di `.env` server.

## Arsitektur singkat
Lihat `AGENTS.md` dan `docs/ADAPTASI.md` di dalam zip untuk detail.
- **Backend Flask (stateless):** `/api/analyze` (kecocokan CV dan lowongan, skor dihitung kode), `/api/plan` (pertanyaan berbasis slot), `/api/turn` (analisis per jawaban dengan flag berindeks kata, plus keputusan follow-up), `/api/report` (ringkasan sesi).
- **Semua panggilan AI** memakai structured outputs, dengan fallback tanpa skema dan satu kali retry JSON. `MOCK_LLM=1` untuk uji tanpa biaya.
- **Frontend tanpa build step:**
  - `static/js/config.js`: semua ambang batas dan bobot
  - `static/js/analysis.js`: heuristik, Composure Load, skor (punya 11 unit test, `node --test tests/analysis.test.js`)
  - `static/js/app.js`: antarmuka dan alur
  - `static/js/seed.js`: replay offline 90 detik
- **Speech:** Web Speech API untuk STT, `speechSynthesis` untuk TTS. Ada kotak ketik sebagai cadangan.
- **Tampilan:** terang dan ramah ala Duolingo. Tiga panel: transkrip ala Grammarly, Pak Kumis, statistik ala chess.com. Efek Kesadaran dengan pilihan Mati / Lembut / Penuh.
- **Pak Kumis:** SVG berlapis (`templates/cat.svg`), kucing tabby abu-abu berjas navy dengan ID card "HRD". Tujuh state: idle, speaking, listening, thinking, skeptical, concerned, positive.

## Keputusan yang sudah diambil
- Tetap Flask dan PythonAnywhere (tidak pindah ke Next.js atau Vercel).
- Akhir jawaban otomatis setelah 6 detik hening (PRD 4 detik), supaya jeda 4 detik tetap tercatat sebagai blunder.
- "jadi" hanya dihitung sebagai kata pengisi di awal segmen. Ragu bertumpuk memakai jendela 15 kata.
- UI memakai sapaan "kamu"; pertanyaan dari Pak Kumis memakai "Anda".

## Yang masih terbuka
1. **Pengali skor akhir:** rumus PRD `100 - (total bobot / menit) x 6` terasa keras (replay memberi skor 24 padahal rata-rata nilai isi jawaban 74). Belum diputuskan apakah tetap 6 atau diturunkan, misalnya ke 3. Kalau diubah, ubah di dua tempat: `finalMultiplier` di `config.js` dan angka `6` di `interview_engine.final_score`.
2. **Belum teruji:** mikrofon sungguhan di Chrome, respons Claude asli untuk format `/api/turn` dan `/api/report` yang baru, dan pemuatan font Fredoka/Nunito.
3. **Belum dibangun:** tombol Retry per pertanyaan, Mark for review, tab History, webhook n8n.
4. **Persiapan lomba:** slide 3 halaman, naskah demo 3 menit, video 60 sampai 90 detik, dan bukti masalah kampus untuk kriteria 35%.
5. **Token panitia:** key berawalan `tk-gw-` adalah gateway milik panitia, dan base URL-nya belum diketahui. Saat ini tidak dipakai. Kalau gateway itu kompatibel Anthropic, cukup tambah `ANTHROPIC_BASE_URL` di `.env`.

## Preferensi kerja
- Jawab dalam Bahasa Indonesia.
- Langkah demi langkah dan terverifikasi. Uji dulu sebelum menyerahkan.
- Jangan pernah meminta atau menampilkan API key di chat.

---

## Prompt pembuka (salin ke chat baru)

```
Halo, saya melanjutkan proyek dari akun Claude lain. Saya lampirkan hackathongoks.zip (kode terbaru) dan HANDOFF.md (konteks lengkap).

Tolong:
1. Baca HANDOFF.md, lalu lihat isi zip (terutama AGENTS.md dan docs/ADAPTASI.md). Jangan ekstrak dan ubah apa pun dulu.
2. Ringkas dalam beberapa kalimat pemahamanmu tentang status proyek, termasuk hal yang masih terbuka.
3. Setelah itu tunggu instruksi saya berikutnya.

Konteks singkat: ini web latihan interview AI "Cermin" untuk lomba CAKREN HACKSPACE (sprint 5 jam). Stack Flask di PythonAnywhere (hrdonline.pythonanywhere.com) dengan Claude API, maskot kucing "Pak Kumis", UI ramah ala Duolingo. Versi di zip belum di-deploy. Saya ingin dibantu dalam Bahasa Indonesia, langkah demi langkah, dan setiap perubahan diuji dulu sebelum diserahkan. Jangan pernah meminta API key saya di chat.
```
