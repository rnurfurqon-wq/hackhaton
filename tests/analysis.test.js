// Jalankan: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../static/js/analysis.js");
const C = require("../static/js/config.js");

// Kata sintetis: satu kata tiap `step` ms; `gaps` menyisipkan hening sebelum indeks tertentu.
function words(text, { start = 0, step = 400, gaps = {} } = {}) {
  let t = start;
  return text.split(/\s+/).map((w, i) => {
    if (gaps[i]) t += gaps[i];
    const word = { text: w, t, segStart: i === 0 || Boolean(gaps[i]) };
    t += step;
    return word;
  });
}
const blunder = (type, t) => ({ type, t, weight: C.weights[type], category: C.typeCategory[type] });

test("kata pengisi: tunggal, frasa, dan 'jadi' hanya di awal segmen", () => {
  const w = words("eee jadi saya pikir apa ya jadi begini", { gaps: { 6: 4000 } });
  const found = A.detectFillers(w, "id").map((f) => [f.start, f.end]);
  // eee(0), 'jadi'(1) bukan awal segmen, 'apa ya'(4-5), 'jadi'(6) awal segmen
  assert.deepEqual(found, [[0, 0], [4, 5], [6, 6]]);
});

test("kalimat diulang: n-gram 1 sampai 3 kata", () => {
  const found = A.detectRestarts(words("saya saya membuat jadi saya jadi saya data")).map((f) => [f.start, f.end]);
  assert.deepEqual(found, [[0, 1], [3, 6]]);
});

test("ragu bertumpuk: 3 kata ragu dalam 15 kata", () => {
  const found = A.detectHedging(words("mungkin saya sepertinya agak bingung"), "id");
  assert.equal(found.length, 1);
  assert.deepEqual([found[0].start, found[0].end], [0, 3]);
  const spread = A.detectHedging(words(`mungkin ${"kata ".repeat(20)} sepertinya agak`), "id");
  assert.equal(spread.length, 0);
});

test("kecepatan: di atas 180 kata per menit dalam 10 detik, dengan jeda pendinginan", () => {
  const fast = words("a ".repeat(60).trim(), { step: 250 }); // 240 kpm
  const slow = words("a ".repeat(60).trim(), { step: 400 }); // 150 kpm
  assert.equal(A.detectRateSpikes(fast).length, 1);
  assert.equal(A.detectRateSpikes(slow).length, 0);
});

test("jeda panjang: sebelum kata pertama dan di tengah jawaban", () => {
  const w = words("halo saya dimas", { start: 3500, gaps: { 2: 3200 } });
  const found = A.detectGapPauses(w, 0);
  assert.deepEqual(found.map((p) => p.keyIdx), [0, 2]);
});

test("Composure Load meluruh linear dalam 45 detik", () => {
  const b = [blunder("long_pause", 0)]; // bobot 2
  assert.equal(A.composureLoad(b, 0), 2);
  assert.equal(A.composureLoad(b, 22500), 1);
  assert.equal(A.composureLoad(b, 45000), 0);
});

test("level efek: naik langsung, turun setelah 8 detik di bawah ambang", () => {
  let s = { level: 0, belowSince: null };
  s = A.nextEffectState(s, 6.5, 0);
  assert.equal(s.level, 2);
  s = A.nextEffectState(s, 2, 1000);
  assert.equal(s.level, 2, "belum 8 detik, tetap level 2");
  s = A.nextEffectState(s, 2, 5000);
  assert.equal(s.level, 2);
  s = A.nextEffectState(s, 2, 9000);
  assert.equal(s.level, 0, "8 detik di bawah ambang, turun ke target");
  s = A.nextEffectState({ level: 2, belowSince: null }, 4, 0);
  s = A.nextEffectState(s, 7, 3000);
  assert.equal(s.level, 2);
  assert.equal(s.belowSince, null, "naik lagi ke ambang, hitungan turun direset");
});

test("mode efek: Off, Lembut maksimal level 2, Penuh", () => {
  assert.equal(A.applyMode(3, "off"), 0);
  assert.equal(A.applyMode(3, "gentle"), 2);
  assert.equal(A.applyMode(3, "full"), 3);
});

test("skor langsung: 100 tanpa blunder, turun lalu pulih seiring waktu paruh 60 detik", () => {
  assert.equal(A.liveScore([], 0), 100);
  const b = [blunder("cv_contradiction", 0)]; // 3 x 4 = 12
  assert.equal(A.liveScore(b, 0), 88);
  assert.equal(A.liveScore(b, 60000), 94);
});

test("skor akhir: 100 - (bobot per menit x pengali 3), menit minimal 0,5", () => {
  assert.equal(C.score.finalMultiplier, 3, "pengali harus sama dengan FINAL_MULTIPLIER di interview_engine.py");
  const b = [...Array(4)].map(() => blunder("filler", 0)).concat(blunder("cv_contradiction", 0)); // bobot 7
  assert.equal(A.finalScore(b, 60000), 79);
  assert.equal(A.finalScore(b, 10000), 58, "10 detik dihitung 0,5 menit");
  assert.equal(A.finalScore([], 60000), 100);
});

test("event list: dikelompokkan per pertanyaan dan tipe", () => {
  const b = [
    { id: 1, q: 1, type: "filler", category: "Fluency", t: 1000, severity: 1 },
    { id: 2, q: 1, type: "filler", category: "Fluency", t: 3000, severity: 1 },
    { id: 3, q: 2, type: "filler", category: "Fluency", t: 9000, severity: 1 },
  ];
  const rows = A.groupEvents(b);
  assert.deepEqual(rows.map((r) => [r.q, r.count]), [[1, 2], [2, 1]]);
  assert.equal(A.formatClock(65000), "01:05");
});
