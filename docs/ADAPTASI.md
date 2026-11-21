# Adaptasi Cermin Agent Pack ke Ruang Interview (Flask)

Pack aslinya merancang Cermin untuk hackathon 24 sampai 48 jam dengan Next.js, Vercel, Supabase, dan Deepgram. Hackathon CAKREN HACKSPACE hanya 5 jam, dan aplikasi Flask sudah berjalan di PythonAnywhere dengan Claude API yang teruji. Karena itu fitur intinya dipertahankan, sedangkan infrastrukturnya disesuaikan.

## Keputusan stack

| Pack | Di sini | Alasan |
|---|---|---|
| Next.js 15 + Vercel | Flask + PythonAnywhere | Sudah live dan teruji |
| Deepgram streaming | Web Speech API (fallback yang disebut pack) | Tanpa API key tambahan. Waktu per kata diperkirakan dari waktu event, minimal 200 ms per kata |
| ElevenLabs / OpenAI TTS | `speechSynthesis` browser (fallback di pack) | Gratis. Teks dialog dan mulut Pak Kumis disinkronkan lewat event `onboundary` |
| Supabase | Tanpa database | Server stateless; CV dan transkrip tidak pernah disimpan |
| Zod | JSON Schema (structured outputs Claude) + validasi Python | Setara, tanpa build step |
| Recharts | SVG buatan sendiri | Titik bisa diklik, tanpa library |
| Vitest | `node --test` | Tanpa instalasi tambahan |
| Ms. Alina | Pak Kumis | Maskot pilihan tim |
| Tema gelap | Terang ala Duolingo | Permintaan terbaru; vignette merah tetap jelas di latar terang |

## Yang sudah dibangun (sesuai PRD_SPEC)
- Tiga panel 28 / 44 / 28; di bawah 1100 px berubah menjadi tab dengan panel tengah selalu terlihat.
- Taksonomi blunder lengkap dengan bobot PRD: pengisi, jeda panjang, kalimat diulang, terlalu cepat, ragu bertumpuk, berputar-putar (heuristik); belum menjawab, klaim tanpa bukti, beda dengan CV (AI, berindeks kata).
- Composure Load 45 detik dengan peluruhan linear, level 3 / 6 / 10, naik langsung, turun setelah 8 detik, kilatan hijau saat pulih, toast sesuai penyebab, lingkaran napas di level 3, pilihan Mati / Lembut / Penuh, penjelasan 10 detik di sesi pertama, `prefers-reduced-motion`.
- Skor langsung (waktu paruh 60 detik) dan skor akhir sesuai rumus PRD.
- Kiri: garis bawah warna kategori, sorotan pink untuk severity 3, kartu saran (Yang terjadi, Kenapa penting, Coba ini, Mengerti / Abaikan, sebelumnya / berikutnya), bar kategori, kartu "Lain kali".
- Tengah: 7 state (diam, mendengarkan, bicara, berpikir, positif, skeptis, khawatir), bingkai kamera lebar / sedang / dekat, kotak dialog dengan name tag dan caption adegan, tombol hijau bulat, indikator level mikrofon, Ulangi dan Lewati, titik progres.
- Kanan: grafik skor dengan titik severity dan playhead, kartu blunder (Sebelumnya / Contoh / Berikutnya), daftar event termasuk perubahan level efek, kotak statistik, tab Langsung / Review / Detail.
- Ringkasan: skor akhir, 3 kelemahan, 1 kekuatan, 3 rekomendasi.
- Klik titik grafik atau baris event menggulir transkrip ke bagian itu (stretch nomor 1 di build plan).
- Replay offline 90 detik tanpa mikrofon dan jaringan (acceptance nomor 8).
- Tambahan dari versi sebelumnya: analisis kecocokan CV dengan gerbang negative case, pertanyaan lanjutan adaptif (stretch nomor 3), kode akses, gamifikasi XP, dan banner umpan balik.

## Penyimpangan yang disengaja
- **Akhir jawaban otomatis setelah 6 detik hening**, bukan 4 detik. Dengan 4 detik, jeda 4 detik di acceptance nomor 3 akan langsung mengakhiri jawaban, padahal jeda itu justru harus tercatat sebagai blunder. Ubah di `config.js` (`autoEndSilenceMs`).
- **"Satu kalimat" untuk ragu bertumpuk diganti jendela 15 kata**, karena transkrip suara bahasa Indonesia jarang bertanda baca.
- **"jadi" hanya dihitung sebagai kata pengisi di awal segmen ucapan**, supaya "menjadi bendahara" atau "jadi saya..." di tengah kalimat tidak ikut ditandai.
- **Mulut Pak Kumis digerakkan per kata (event boundary)**, bukan amplitudo audio, karena `speechSynthesis` tidak memberi akses ke amplitudo.

## Belum dibangun
- Tombol Retry per pertanyaan dan kerangka jawaban terbaik dari LLM (PROMPTS nomor 5). Tombol "Contoh" saat ini menampilkan saran per temuan.
- Mark for review pada teks yang diseleksi, tab History, kalibrasi kecepatan per pengguna.
- Webhook n8n dan halaman berbagi untuk konselor CDC.

## Catatan rumus skor akhir
Rumus PRD `100 - (total bobot / menit bicara) x 6` cukup keras untuk sesi pendek: 13 poin temuan dalam 1 menit menghasilkan skor 24. Ringkasan menampilkan alasannya ("13 poin temuan dalam 61 detik bicara") di bawah skor. Kalau terasa terlalu keras, turunkan `finalMultiplier` di `static/js/config.js` dan nilai `6` di `interview_engine.final_score` secara bersamaan.
