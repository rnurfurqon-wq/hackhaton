/* analysis.js: fungsi murni tanpa DOM, supaya bisa diuji dengan Node (tests/analysis.test.js).
   Satuan waktu: milidetik sejak t0 (akhir audio pertanyaan pertama).
   Kata: { text, t, segStart } dengan segStart = true untuk kata pertama sebuah segmen ucapan. */
(function (root, factory) {
  const config = (typeof module !== "undefined" && module.exports) ? require("./config.js") : root.NgBluConfig;
  const api = factory(config);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NgBluAnalysis = api;
})(typeof self !== "undefined" ? self : this, function (C) {
  "use strict";

  function norm(text) {
    return String(text || "").toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, "");
  }

  function matchPhrase(words, i, phrase) {
    for (let j = 0; j < phrase.length; j++) {
      if (!words[i + j] || norm(words[i + j].text) !== phrase[j]) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- heuristik
  function detectFillers(words, lang) {
    const singles = new Set(C.fillers[lang] || C.fillers.id);
    const phrases = C.fillerPhrases[lang] || [];
    const starters = new Set(C.fillersAtSegmentStart[lang] || []);
    const out = [];
    for (let i = 0; i < words.length; i++) {
      const phrase = phrases.find((p) => matchPhrase(words, i, p));
      if (phrase) {
        out.push({ type: "filler", start: i, end: i + phrase.length - 1 });
        i += phrase.length - 1;
        continue;
      }
      const n = norm(words[i].text);
      if (!n) continue;
      if (singles.has(n) || (starters.has(n) && words[i].segStart)) out.push({ type: "filler", start: i, end: i });
    }
    return out;
  }

  function detectRestarts(words) {
    const out = [];
    for (let i = 0; i < words.length; i++) {
      for (let n = 3; n >= 1; n--) {
        if (i + 2 * n > words.length) continue;
        let same = true;
        for (let j = 0; j < n; j++) {
          const a = norm(words[i + j].text);
          if (!a || a !== norm(words[i + n + j].text)) { same = false; break; }
        }
        if (same) {
          out.push({ type: "restart", start: i, end: i + 2 * n - 1 });
          i += 2 * n - 1;
          break;
        }
      }
    }
    return out;
  }

  function hedgePositions(words, lang) {
    const singles = new Set(C.hedges[lang] || C.hedges.id);
    const phrases = C.hedgePhrases[lang] || [];
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const phrase = phrases.find((p) => matchPhrase(words, i, p));
      if (phrase) { pos.push({ start: i, end: i + phrase.length - 1 }); i += phrase.length - 1; continue; }
      if (singles.has(norm(words[i].text))) pos.push({ start: i, end: i });
    }
    return pos;
  }

  function detectHedging(words, lang) {
    const T = C.thresholds;
    const pos = hedgePositions(words, lang);
    const out = [];
    let k = 0;
    while (k + T.hedgeCount - 1 < pos.length) {
      const first = pos[k], last = pos[k + T.hedgeCount - 1];
      if (last.start - first.start < T.hedgeWindowWords) {
        out.push({ type: "hedging", start: first.start, end: last.end });
        k += T.hedgeCount;
      } else {
        k += 1;
      }
    }
    return out;
  }

  function detectRateSpikes(words) {
    const T = C.thresholds;
    const limit = T.rateWpm * (T.rateWindowMs / 60000); // jumlah kata maksimal dalam jendela
    const out = [];
    let j = 0;
    let lastFlagT = -Infinity;
    for (let i = 0; i < words.length; i++) {
      while (words[i].t - words[j].t > T.rateWindowMs) j++;
      if (i - j + 1 > limit && words[i].t - lastFlagT >= T.rateCooldownMs) {
        out.push({ type: "rate_spike", start: j, end: i });
        lastFlagT = words[i].t;
      }
    }
    return out;
  }

  // Jeda panjang dari jarak waktu antarkata. keyIdx = indeks kata SETELAH jeda,
  // dipakai juga oleh deteksi jeda langsung (saat hening) supaya tidak tercatat dua kali.
  function detectGapPauses(words, turnStartT) {
    const T = C.thresholds;
    const out = [];
    if (!words.length) return out;
    if (words[0].t - turnStartT > T.longPauseMs) {
      out.push({ type: "long_pause", start: 0, end: 0, keyIdx: 0, gapMs: words[0].t - turnStartT });
    }
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].t - words[i - 1].t;
      if (gap > T.longPauseMs) out.push({ type: "long_pause", start: i - 1, end: i, keyIdx: i, gapMs: gap });
    }
    return out;
  }

  function detectAll(words, lang, turnStartT) {
    return [
      ...detectFillers(words, lang),
      ...detectRestarts(words),
      ...detectHedging(words, lang),
      ...detectRateSpikes(words),
      ...detectGapPauses(words, turnStartT),
    ];
  }

  // ---------------------------------------------------------------- komposur
  function composureLoad(blunders, now) {
    const W = C.composure.windowMs;
    let load = 0;
    for (const b of blunders) {
      const age = now - b.t;
      if (age >= 0 && age < W) load += b.weight * (1 - age / W);
    }
    return load;
  }

  function levelForLoad(load) {
    const [l1, l2, l3] = C.composure.levels;
    if (load >= l3) return 3;
    if (load >= l2) return 2;
    if (load >= l1) return 1;
    return 0;
  }

  // Naik langsung; turun hanya setelah beban bertahan di bawah ambang level saat ini selama 8 detik.
  function nextEffectState(state, load, now) {
    const target = levelForLoad(load);
    if (target > state.level) return { level: target, belowSince: null };
    if (target === state.level) return { level: state.level, belowSince: null };
    const belowSince = state.belowSince == null ? now : state.belowSince;
    if (now - belowSince >= C.composure.deescalateMs) return { level: target, belowSince: null };
    return { level: state.level, belowSince };
  }

  function applyMode(level, mode) {
    if (mode === "off") return 0;
    if (mode === "gentle") return Math.min(level, 2);
    return level;
  }

  function dominantCause(blunders, now) {
    const W = C.composure.windowMs;
    const load = {};
    for (const b of blunders) {
      const age = now - b.t;
      if (age >= 0 && age < W) load[b.type] = (load[b.type] || 0) + b.weight * (1 - age / W);
    }
    let best = null;
    for (const [type, value] of Object.entries(load)) if (!best || value > load[best]) best = type;
    return best;
  }

  // ---------------------------------------------------------------- skor
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function liveScore(blunders, now) {
    const S = C.score;
    let sum = 0;
    for (const b of blunders) {
      const age = now - b.t;
      if (age >= 0) sum += b.weight * Math.pow(0.5, age / S.halfLifeMs);
    }
    return 100 - clamp(sum * S.liveMultiplier, 0, 100);
  }

  function finalScore(blunders, msSpoken) {
    const S = C.score;
    const total = blunders.reduce((acc, b) => acc + b.weight, 0);
    const minutes = Math.max(msSpoken / 60000, S.minMinutes);
    return Math.round(100 - clamp((total / minutes) * S.finalMultiplier, 0, 100));
  }

  function categoryScores(blunders, msSpoken) {
    const out = {};
    for (const cat of C.categories) {
      out[cat] = finalScore(blunders.filter((b) => b.category === cat), msSpoken);
    }
    return out;
  }

  // ---------------------------------------------------------------- statistik
  function tiles(answers, blunders) {
    let words = 0, ms = 0;
    const gaps = [];
    for (const a of answers) {
      words += a.words.length;
      if (a.endT != null && a.startT != null) ms += Math.max(0, a.endT - a.startT);
      for (let i = 1; i < a.words.length; i++) {
        const g = a.words[i].t - a.words[i - 1].t;
        if (g > 700) gaps.push(g);
      }
    }
    const minutes = ms / 60000;
    const fillers = blunders.filter((b) => b.type === "filler").length;
    return {
      fillerPerMin: minutes > 0.05 ? fillers / minutes : 0,
      avgPauseS: gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length / 1000 : 0,
      wpm: minutes > 0.05 ? words / minutes : 0,
      perAnswer: answers.length ? blunders.length / answers.length : 0,
      msSpoken: ms,
    };
  }

  function groupEvents(blunders) {
    const groups = new Map();
    for (const b of blunders) {
      const key = `${b.q}:${b.type}`;
      const g = groups.get(key);
      if (g) { g.count += 1; g.ids.push(b.id); }
      else groups.set(key, { key, type: b.type, category: b.category, q: b.q, t: b.t, count: 1, ids: [b.id], severity: b.severity });
    }
    return [...groups.values()].sort((a, b) => a.t - b.t);
  }

  function formatClock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function xpForScore(score) {
    if (score == null) return 5;
    return Math.round(clamp(score, 0, 100) / 100 * C.xp.perAnswerMax);
  }

  return {
    norm, detectFillers, detectRestarts, detectHedging, detectRateSpikes, detectGapPauses, detectAll,
    composureLoad, levelForLoad, nextEffectState, applyMode, dominantCause,
    liveScore, finalScore, categoryScores, tiles, groupEvents, formatClock, xpForScore,
  };
});
