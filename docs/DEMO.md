# Mode presentasi NgBlu

Mode demo memutar sesi rekaman: analisis kecocokan, dua pertanyaan, jawaban "gugup" lalu jawaban yang baik, Efek Kesadaran, umpan balik AI, dan ringkasan. Semuanya berjalan **tanpa mikrofon, tanpa panggilan AI, dan tanpa internet** setelah halaman termuat. Durasi sekitar 90 detik, berjalan sendiri dari awal sampai akhir.

## Cara memulai (pilih satu)

| Cara | Kapan dipakai |
|---|---|
| Buka `https://USERNAME.pythonanywhere.com/demo` | Paling andal. Buka tab ini sebelum naik panggung. |
| Tombol **Putar demo** di layar pertama | Kalau sedang di halaman utama. |
| Tekan **Shift+D** di layar persiapan | Pintasan presenter, tanpa mencari tombol. |

Opsi URL (boleh digabung, misalnya `/demo?voice=0&fx=full`):

- `voice=0`: Pak Kumis tidak bersuara (teks tetap diketik). Pakai kalau tidak ada speaker.
- `fx=off|gentle|full`: tingkat Efek Kesadaran. Default mengikuti pilihan di layar (Lembut).
- `auto=0`: tidak ada hitung mundur dan panggilan tidak dimulai sendiri. Presenter menekan tombol sendiri.

Catatan suara: Chrome hanya mengizinkan suara setelah ada klik di halaman. Kalau membuka `/demo` langsung, klik tombol **Mulai interview demo** sekali (jangan tunggu hitung mundur) supaya Pak Kumis bersuara. Kalau suara gagal, teks tetap berjalan dan demo tidak macet.

## Alur dan isyarat untuk narator

Waktu diukur tanpa suara; dengan suara Pak Kumis, tiap pertanyaan bergeser beberapa detik.

| Waktu demo | Yang tampil | Yang bisa diucapkan |
|---|---|---|
| 0:00 | Hasil analisis kecocokan 72%, daftar syarat dengan bukti dari CV | "AI membaca CV dan lowongan. Skornya dihitung kode, dan setiap bukti dicek benar-benar ada di CV." |
| 0:10 | Pak Kumis menanyakan pengalaman SQL dari CV | "Pertanyaan disusun dari kekuatan dan celah kandidat, bukan pertanyaan generik." |
| 0:12 | Transkrip langsung, garis bawah kata pengisi dan kalimat diulang | "Kata pengisi, jeda, dan keraguan dideteksi di browser, seketika, tanpa token AI." |
| 0:30 | Tepi layar meredup dan muncul pengingat napas | "Ini Efek Kesadaran: saat gugup menumpuk, layar memberi isyarat untuk menenangkan diri. Pak Kumis tidak pernah tertutup." |
| 0:55 | Banner nilai jawaban, garis merah "Beda dengan CV" (2024 vs 2026) | "AI mengecek konsistensi dengan CV dan memberi contoh kalimat yang lebih baik." |
| 0:58 | Pertanyaan kedua tentang celah Tableau atau Looker Studio, jawaban lancar | "Celah di CV jadi bahan latihan, supaya mahasiswa siap ditanya hal yang belum dimiliki." |
| 1:30 | Ringkasan: skor 62, 3 hal yang perlu dilatih, 1 kekuatan, 3 rekomendasi | "Hasil akhirnya konkret dan bisa langsung dilatih lagi." |

Setelah ringkasan, tombol **Lihat review** membuka tab Review (grafik ala chess.com) kalau juri ingin melihat detail. Tab **Detail** menampilkan rumus skor dan, di sesi asli, pemakaian token AI.

## Usulan pembagian 3 menit presentasi

1. **0:00 sampai 0:40, Problem**: mahasiswa jarang punya kesempatan latihan interview yang memberi umpan balik jujur dan spesifik.
2. **0:40 sampai 2:15, AI Solution & Demo**: putar `/demo`, narasikan sesuai tabel di atas.
3. **2:15 sampai 3:00, Impact**: siapa yang terbantu, cara AI dipakai hemat token (heuristik di browser, AI hanya untuk analisis isi), dan transparansi (badge "DEMO · rekaman", rumus skor terbuka).

## Kalau ingin demo langsung dengan AI asli

1. Klik **Contoh: cocok**, lalu **Cek kecocokan**, lalu pilih **2 (Demo)** di jumlah pertanyaan.
2. Jawab dengan mikrofon (Chrome) atau ketik. Kalau pengenalan suara gagal karena internet, aplikasi otomatis pindah ke kotak ketik.
3. Jalankan sekali sesi mode Demo yang sukses sebelum presentasi. Pertanyaannya tersimpan di `demo_cache.json` sebagai cadangan kalau API lambat.

## Integrasi CDC Cakrawala (untuk slide Impact)

- Mahasiswa bisa langsung membuka CDC Cakrawala dari langkah deskripsi posisi, lalu menempel lowongan yang ditemukan di sana.
- CDC juga bisa membuka NgBlu dengan lowongan yang sudah terisi, cukup lewat tautan: `/?source=cdc&company=...&type=kerja&jd=...`. Ini bisa dipakai sebagai tombol "Latihan interview untuk lowongan ini" di setiap halaman lowongan CDC.

## Cadangan terakhir: jalankan di laptop

Kalau situs tidak bisa dibuka sama sekali:

```bash
cd hackathongoks
pip install -r requirements.txt
MOCK_LLM=1 python app.py        # Windows PowerShell: $env:MOCK_LLM="1"; python app.py
```

Lalu buka `http://127.0.0.1:5000/demo`. Font dan semua aset ada di dalam folder, jadi tampilannya sama persis walau offline.
