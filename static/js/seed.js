/* seed.js: sesi rekaman sekitar 90 detik untuk mode demo/replay offline (tanpa mikrofon, AI, dan jaringan).
   Data analisis kecocokan di bawah sama dengan hasil CV contoh vs lowongan "Data Analyst Intern (cocok)".
   Dibuat dengan skrip agar indeks kata di flag AI selalu tepat. */
(function (root) {
  root.NgBluSeed = {
    "company": "PT Contoh Analitika Nusantara",
    "analysis": {
      "role": "Data Analyst Intern",
      "company": "PT Contoh Analitika Nusantara",
      "category": "cocok",
      "score": 72,
      "score_explained": "3 dari 4 syarat wajib terpenuhi. Syarat wajib berbobot 2, nilai plus berbobot 1.",
      "gate": { "status": "go", "message": "" },
      "level": { "lowongan": "magang", "kandidat": "mahasiswa", "sesuai": true },
      "requirements": [
        { "item": "SQL", "type": "wajib", "status": "terpenuhi", "evidence": "Menyusun query SQL untuk rekap keuangan himpunan", "evidence_verified": true },
        { "item": "Python", "type": "wajib", "status": "terpenuhi", "evidence": "Membuat skrip Python untuk membersihkan data survei", "evidence_verified": true },
        { "item": "Tableau atau Looker Studio", "type": "wajib", "status": "tidak ada", "evidence": null, "evidence_verified": false },
        { "item": "Statistik dasar", "type": "nilai plus", "status": "sebagian", "evidence": "Mahasiswa Data Science semester 1", "evidence_verified": true },
        { "item": "Komunikasi hasil analisis", "type": "wajib", "status": "terpenuhi", "evidence": "Mempresentasikan laporan keuangan di rapat pleno himpunan", "evidence_verified": true }
      ],
      "selection_type": "kerja",
      "language": {
        "cv": "id",
        "job": "id"
      },
      "candidate": {
        "ringkasan": "Mahasiswa Data Science semester 1 dengan pengalaman mengolah data organisasi.",
        "pendidikan": "S1 Data Science, Universitas Cakrawala",
        "pengalaman": [
          "Bendahara himpunan",
          "Proyek dashboard keuangan himpunan"
        ],
        "skill": [
          "SQL",
          "Python",
          "Excel"
        ],
        "riwayat": [
          {
            "peran": "Bendahara",
            "organisasi": "Himpunan Mahasiswa Data Science",
            "periode": "2026 - sekarang"
          }
        ]
      }
    },
    "questions": [
      {
        "no": 1,
        "slot": 3,
        "slot_name": "Kekuatan utama",
        "question": "Di CV Anda tertulis menyusun query SQL untuk rekap keuangan himpunan. Ceritakan prosesnya dan hasilnya.",
        "purpose": "Kedalaman pengalaman SQL",
        "source": "CV: Menyusun query SQL untuk rekap keuangan himpunan"
      },
      {
        "no": 2,
        "slot": 5,
        "slot_name": "Celah",
        "question": "Posisi ini mewajibkan Tableau atau Looker Studio, yang belum ada di CV Anda. Bagaimana Anda akan mengejarnya?",
        "purpose": "Sikap dan rencana terhadap celah",
        "source": "Syarat wajib: Tableau atau Looker Studio"
      }
    ],
    "answers": [
      {
        "segments": [
          {
            "at": 1200,
            "dur": 4200,
            "text": "eee jadi saya saya bendahara himpunan sejak tahun 2024"
          },
          {
            "at": 6000,
            "dur": 3600,
            "text": "emm waktu itu laporan keuangan sering telat gitu"
          },
          {
            "at": 14100,
            "dur": 4400,
            "text": "eee mungkin sepertinya saya agak bingung jelasinnya"
          },
          {
            "at": 20600,
            "dur": 9200,
            "text": "Saya lalu membuat query SQL yang menggabungkan data transaksi bulanan sehingga rekap yang tadinya dua hari selesai dalam tiga jam"
          },
          {
            "at": 31200,
            "dur": 6200,
            "text": "Hasilnya laporan bisa dipresentasikan tepat waktu di rapat pleno setiap bulan"
          }
        ],
        "endAfterMs": 39600,
        "result": {
          "flags": [
            {
              "category": "Consistency",
              "type": "cv_contradiction",
              "severity": 3,
              "start_word": 6,
              "end_word": 8,
              "explanation": "Kamu menyebut menjadi bendahara sejak 2024, padahal CV menulis 2026 sampai sekarang.",
              "suggestion": "Sebut periode sesuai CV: \"Sejak 2026 saya menjadi bendahara himpunan.\""
            },
            {
              "category": "Evidence",
              "type": "vague_claim",
              "severity": 2,
              "start_word": 12,
              "end_word": 15,
              "explanation": "Masalahnya belum jelas: seberapa sering dan seberapa telat.",
              "suggestion": "Beri angka: \"Laporan biasanya telat tiga sampai lima hari setiap bulan.\""
            }
          ],
          "answer_score": 61,
          "strength": "Ada hasil terukur: rekap dari dua hari menjadi tiga jam.",
          "next_time": [
            "Buka dengan peran dan tahun yang sesuai CV",
            "Diam sejenak sebelum mulai agar tidak diawali eee"
          ],
          "decision": "next",
          "follow_up_question": "",
          "note": ""
        }
      },
      {
        "segments": [
          {
            "at": 900,
            "dur": 6000,
            "text": "Saya akan belajar Looker Studio lewat kursus resminya selama dua minggu pertama"
          },
          {
            "at": 7500,
            "dur": 6400,
            "text": "lalu memindahkan dashboard keuangan himpunan dari Google Sheets ke Looker Studio sebagai latihan"
          },
          {
            "at": 14500,
            "dur": 5000,
            "text": "dan meminta masukan dari pengurus inti supaya tampilannya mudah dibaca"
          }
        ],
        "endAfterMs": 21800,
        "result": {
          "flags": [],
          "answer_score": 86,
          "strength": "Rencana belajarnya konkret: ada waktu, alat, dan proyek latihan.",
          "next_time": [
            "Tambahkan target terukur, misalnya dashboard jadi di minggu ketiga"
          ],
          "decision": "next",
          "follow_up_question": "",
          "note": ""
        }
      }
    ],
    "summary": {
      "top_weaknesses": [
        {
          "category": "Fluency",
          "evidence": "Jawaban pertama dibuka dengan eee, jadi, dan saya saya.",
          "tip": "Diam satu detik sebelum mulai, lalu buka dengan kalimat inti."
        },
        {
          "category": "Consistency",
          "evidence": "Tahun menjadi bendahara (2024) berbeda dengan CV (2026).",
          "tip": "Hafalkan periode setiap peran di CV sebelum interview."
        },
        {
          "category": "Composure",
          "evidence": "Jeda 4 detik disusul tiga kata ragu dalam satu kalimat.",
          "tip": "Ganti 'mungkin' dengan 'saya akan' saat menjelaskan sesuatu."
        }
      ],
      "strength": "Jawaban kedua konkret: ada rencana waktu, alat, dan proyek latihan.",
      "recommendations": [
        "Latih pembuka dua kalimat untuk setiap pengalaman di CV",
        "Siapkan satu angka hasil untuk setiap cerita",
        "Ulangi latihan dengan mode efek Penuh untuk melatih ketenangan"
      ]
    }
  };
})(typeof self !== "undefined" ? self : this);
