/* config.js: semua ambang batas, bobot, dan teks ada di sini, tidak ditulis langsung di logika.
   Bobot dan kategori HARUS sama dengan WEIGHTS dan TYPE_CATEGORY di interview_engine.py. */
(function (root) {
  "use strict";

  const NgBluConfig = {
    weights: {
      filler: 1, long_pause: 2, restart: 1, rate_spike: 2, hedging: 1,
      rambling: 2, off_topic: 3, vague_claim: 2, cv_contradiction: 3,
    },
    typeCategory: {
      filler: "Fluency", long_pause: "Fluency", restart: "Fluency",
      rate_spike: "Composure", hedging: "Composure",
      rambling: "Clarity", off_topic: "Clarity",
      vague_claim: "Evidence", cv_contradiction: "Consistency",
    },
    categories: ["Fluency", "Clarity", "Evidence", "Consistency", "Composure"],
    categoryLabels: {
      Fluency: "Kelancaran", Clarity: "Kejelasan", Evidence: "Bukti",
      Consistency: "Konsistensi", Composure: "Ketenangan",
    },
    labels: {
      filler: "Kata pengisi", long_pause: "Jeda panjang", restart: "Kalimat diulang",
      rate_spike: "Terlalu cepat", hedging: "Terlalu ragu", rambling: "Berputar-putar",
      off_topic: "Belum menjawab", vague_claim: "Klaim tanpa bukti", cv_contradiction: "Beda dengan CV",
    },
    // "Kenapa penting" di kartu saran
    why: {
      filler: "Kata pengisi yang sering membuat kamu terdengar belum siap.",
      long_pause: "Jeda panjang di tengah jawaban terdengar seperti kehilangan arah.",
      restart: "Mengulang awal kalimat memecah alur cerita.",
      rate_spike: "Bicara terlalu cepat membuat poin penting terlewat oleh pewawancara.",
      hedging: "Terlalu banyak kata ragu membuat klaimmu terdengar tidak yakin.",
      rambling: "Jawaban yang terlalu panjang mengubur poin utamanya.",
      off_topic: "Pewawancara menilai apakah pertanyaannya benar-benar terjawab.",
      vague_claim: "Klaim tanpa contoh sulit dipercaya dan mudah dilupakan.",
      cv_contradiction: "Fakta yang berbeda dengan CV menimbulkan keraguan soal kejujuran.",
    },
    // Saran bawaan untuk temuan heuristik
    tips: {
      filler: "Ganti kata pengisi dengan diam sejenak. Jeda satu detik terdengar lebih yakin.",
      long_pause: "Kalau butuh waktu berpikir, katakan: 'Izin saya pikirkan sebentar.'",
      restart: "Susun kalimat pertama di kepala dulu, baru ucapkan sekali.",
      rate_spike: "Turunkan kecepatan dan beri jeda setelah setiap poin.",
      hedging: "Ganti 'mungkin' atau 'sepertinya' dengan 'saya akan' atau 'saya yakin'.",
      rambling: "Pakai pola: poin utama, satu contoh, hasilnya. Lalu berhenti.",
    },
    fillers: {
      id: ["eee", "ee", "eh", "em", "emm", "emmm", "hmm", "hm", "anu", "gitu"],
      en: ["um", "uh", "umm", "uhh", "er", "erm", "like"],
    },
    fillerPhrases: { id: [["apa", "ya"], ["apa", "namanya"]], en: [["you", "know"]] },
    fillersAtSegmentStart: { id: ["jadi"], en: ["so"] }, // hanya dihitung di awal kalimat
    hedges: {
      id: ["mungkin", "sepertinya", "kayaknya", "kira-kira", "agak", "sebenarnya", "semoga", "barangkali"],
      en: ["maybe", "probably", "perhaps"],
    },
    hedgePhrases: {
      id: [["saya", "rasa"], ["saya", "pikir"], ["kurang", "lebih"]],
      en: [["i", "think"], ["i", "guess"], ["kind", "of"], ["sort", "of"], ["i", "believe"]],
    },
    thresholds: {
      longPauseMs: 3000,        // jeda di tengah jawaban atau sebelum kata pertama
      rateWindowMs: 10000,      // jendela untuk menghitung kecepatan
      rateWpm: 180,             // di atas ini dianggap terlalu cepat
      rateCooldownMs: 10000,
      hedgeWindowWords: 15,     // pengganti "satu kalimat" karena transkrip suara jarang bertanda baca
      hedgeCount: 3,
      ramblingMs: 120000,
      autoEndSilenceMs: 6000,   // PRD: 4 detik; dinaikkan agar jeda 4 detik masih tercatat sebagai blunder
    },
    composure: { windowMs: 45000, levels: [3, 6, 10], deescalateMs: 8000 },
    score: { halfLifeMs: 60000, liveMultiplier: 4, finalMultiplier: 3, minMinutes: 0.5 },
    toasts: {
      filler: "Kata pengisi mulai sering. Tarik napas, lalu lanjut pelan-pelan.",
      long_pause: "Jeda panjang mulai menumpuk. Tarik napas, lalu jawab.",
      restart: "Tenang, susun kalimatnya dulu sebelum bicara.",
      rate_spike: "Kamu mulai terlalu cepat. Pelan-pelan saja.",
      hedging: "Coba lebih yakin. Kurangi 'mungkin'.",
      default: "Tarik napas sebentar, lalu lanjutkan.",
      level3: "Ambil jeda. Bernapas mengikuti lingkaran, lalu lanjutkan.",
    },
    xp: { perAnswerMax: 20 },
  };

  if (typeof module !== "undefined" && module.exports) module.exports = NgBluConfig;
  else root.NgBluConfig = NgBluConfig;
})(typeof self !== "undefined" ? self : this);
