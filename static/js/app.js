"use strict";
/* app.js: antarmuka NgBlu. Logika murni (heuristik, komposur, skor) ada di analysis.js. */

const C = window.NgBluConfig;
const A = window.NgBluAnalysis;
const SEED = window.NgBluSeed;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const HARD_SLOTS = new Set([4, 5, 8]); // Validasi klaim, Celah, Situasional: kamera mendekat
const SEVERITY_COLOR = { 3: "var(--red)", 2: "var(--orange)", 1: "var(--blue)" };
// Mode presentasi lewat URL: /?demo=1 (atau /demo). Opsi: voice=0 (bisu), fx=off|gentle|full, auto=0 (tunggu klik).
const PARAMS = new URLSearchParams(location.search);
const DEMO_URL = PARAMS.get("demo") === "1";
const SPOKEN_MS_PER_WORD = 460; // perkiraan durasi ucap (~130 kata per menit) untuk jawaban yang diketik

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "style") node.setAttribute("style", v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c != null && c !== false) node.append(c);
  return node;
}

// ============================================================================ state
const S = {
  config: null, code: "", samples: null,
  step: "cv", analysis: null, plan: null, replay: false,
  settings: { mode: "normal", n_questions: 5, language: "id", voice: true, effect: "gentle", company: "", selection: "kerja" },
};

function freshSession() {
  return {
    phase: "idle", qIndex: 0, followupsUsed: 0, askedText: "",
    entries: [], blunders: [], keys: new Set(), nextId: 1, current: null,
    effect: { level: 0, belowSince: null }, shownLevel: 0, effectEvents: [], recoveries: [], scorePoints: [],
    xp: 0, answerScores: [], usage: { input_tokens: 0, output_tokens: 0, calls: 0 },
    t0Perf: null, selected: null, cardId: null, bestShown: null, rightTab: "live",
    timers: { tick: null, replay: [], breath: null, toast: null }, tickCount: 0,
    rec: null, recording: false, meter: null, micDenied: false,
  };
}
let X = freshSession(); // sesi interview aktif

const clock = () => (X.t0Perf == null ? 0 : Math.round(performance.now() - X.t0Perf));

// ============================================================================ API
async function api(path, { json, form } = {}) {
  const headers = {};
  if (S.code) headers["X-Access-Code"] = S.code;
  let body;
  if (form) body = form;
  else if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  const res = await fetch(path, { method: body ? "POST" : "GET", headers, body });
  let data = {};
  try { data = await res.json(); } catch (_) { /* bukan JSON */ }
  if (!res.ok) {
    if (data.need_code) $("#code-box").hidden = false;
    throw new Error(data.error || `Server membalas ${res.status}. Coba lagi.`);
  }
  if (data.usage) {
    X.usage.input_tokens += data.usage.input_tokens || 0;
    X.usage.output_tokens += data.usage.output_tokens || 0;
    X.usage.calls += data.usage.calls || 0;
  }
  return data;
}

// ============================================================================ Pak Kumis
let catFrame, cat;
function initCat() {
  $("#mascot-setup").append($("#cat-template").content.cloneNode(true));
  catFrame = $("#cat-frame");
  cat = $("#cat");
}
function setCat(state) { cat.setAttribute("class", `cat state-${state}`); }
function setFrame(frame) { catFrame.className = `cat-frame frame-${frame}`; }
function moveCat(slot) { $(slot).append(catFrame); }
function setSpeech(text) { $("#setup-speech").textContent = text; }

function pickVoice(lang) {
  const voices = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
  const prefix = lang === "en" ? "en" : "id";
  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
}

// Bicara: teks diketik di kotak dialog, dipercepat oleh event onboundary supaya sinkron dengan suara.
function say(text) {
  return new Promise((resolve) => {
    const out = $("#dialog-text");
    const voiceOn = S.settings.voice && "speechSynthesis" in window;
    let shown = 0, done = false, guard;
    out.textContent = "";
    out.classList.add("typing");
    setCat("speaking");
    const reveal = (n) => { shown = Math.max(shown, Math.min(text.length, n)); out.textContent = text.slice(0, shown); };
    const typer = setInterval(() => reveal(shown + 1), voiceOn ? 45 : 26);
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(typer);
      clearTimeout(guard);
      reveal(text.length);
      out.classList.remove("typing");
      setCat("idle");
      resolve();
    };
    X.finishSpeech = finish;
    if (voiceOn) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = S.settings.language === "en" ? "en-US" : "id-ID";
      const v = pickVoice(S.settings.language);
      if (v) u.voice = v;
      u.onboundary = (e) => {
        if (e.name && e.name !== "word") return;
        cat.classList.add("mouth-manual", "mouth-on");
        setTimeout(() => cat.classList.remove("mouth-on"), 140);
        const space = text.indexOf(" ", e.charIndex);
        reveal(space === -1 ? text.length : space);
      };
      u.onend = finish;
      u.onerror = (e) => {
        // Chrome menolak suara sebelum ada klik pertama (autoplay). Teks tetap diketik pelan, alur tidak macet.
        if (e && (e.error === "not-allowed" || e.error === "synthesis-unavailable")) {
          clearTimeout(guard);
          guard = setTimeout(finish, text.length * 45 + 700);
        } else finish();
      };
      speechSynthesis.speak(u);
      guard = setTimeout(finish, Math.max(6000, text.length * 110));
    } else {
      guard = setTimeout(finish, text.length * 26 + 700);
    }
  });
}
function stopSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (X.finishSpeech) X.finishSpeech();
}

// ============================================================================ persiapan
const STEPS = ["cv", "job", "match", "settings"];
const STEP_TEXT = {
  cv: "Halo! Saya Pak Kumis. Kita latihan interview bareng, yuk. Mulai dari CV kamu.",
  job: "Posisi apa yang mau kamu latih? Tempel deskripsinya, lalu saya cek kecocokannya.",
  settings: "Atur latihannya. Mode Demo hanya 2 pertanyaan, pas untuk presentasi.",
};
const PRIMARY_LABEL = { cv: "Lanjut", job: "Cek kecocokan", match: "Atur latihan", settings: "Mulai interview" };

function showStep(step) {
  S.step = step;
  $$(".step").forEach((s) => { s.hidden = s.dataset.step !== step; });
  const i = STEPS.indexOf(step);
  $("#setup-progress").style.setProperty("--p", (i + 1) / STEPS.length);
  $(".setup-top .progress").setAttribute("aria-valuenow", i + 1);
  $("#setup-back").disabled = i === 0;
  $("#setup-back").style.visibility = i === 0 ? "hidden" : "visible";
  $("#setup-primary").textContent = PRIMARY_LABEL[step];
  setError("");
  if (STEP_TEXT[step]) { setSpeech(STEP_TEXT[step]); setCat("idle"); }
  updatePrimary();
}

function setError(msg) { $("#setup-error").textContent = msg || ""; }

function stepValid() {
  if (S.step === "cv") return Boolean($("#cv-file").files[0] || $("#cv-text").value.trim());
  if (S.step === "job") return Boolean($("#job-file").files[0] || $("#job-text").value.trim());
  if (S.step === "match") return Boolean(S.analysis && S.analysis.gate.status !== "stop");
  return true;
}
function updatePrimary() { $("#setup-primary").disabled = !stepValid(); }

function setCvFile(file) {
  const drop = $("#cv-drop");
  drop.classList.toggle("has-file", Boolean(file));
  $("#cv-file-name").textContent = file ? file.name : "Pilih CV (PDF)";
  if (file) { $("#cv-text").value = ""; $("#cv-text").hidden = true; }
  updatePrimary();
}

async function loadSample(key) {
  try {
    if (!S.samples) S.samples = await api("/api/samples");
  } catch (err) { setError(err.message); return; }
  const job = S.samples.jobs[key];
  $("#cv-file").value = "";
  setCvFile(null);
  $("#cv-text").hidden = false;
  $("#cv-text").value = S.samples.cv;
  $("#job-text").value = job.text;
  $("#job-file").value = "";
  $("#job-file-name").textContent = "";
  $("#company").value = { cocok: "PT Contoh Analitika Nusantara", tidak_cocok: "PT Contoh Teknologi Finansial", kepanitiaan: "CAKREN" }[key] || "";
  const radio = document.querySelector(`input[name="selection"][value="${job.selection_type}"]`);
  if (radio) radio.checked = true;
  showStep("job");
  setSpeech(`Saya isi contoh "${job.label}". Cek dulu, lalu tekan Cek kecocokan.`);
  setCat("positive");
}

async function analyze() {
  const form = new FormData();
  const cvFile = $("#cv-file").files[0];
  const jobFile = $("#job-file").files[0];
  if (cvFile) form.append("cv_file", cvFile); else form.append("cv_text", $("#cv-text").value.trim());
  if (jobFile) form.append("job_file", jobFile); else form.append("job_text", $("#job-text").value.trim());
  form.append("selection_type", document.querySelector('input[name="selection"]:checked').value);
  form.append("company", $("#company").value.trim());

  const btn = $("#setup-primary");
  btn.disabled = true;
  btn.textContent = "Membaca dokumen...";
  setCat("thinking");
  setSpeech("Sebentar, saya baca dulu CV dan deskripsi posisinya.");
  try {
    const a = await api("/api/analyze", { form });
    if (a.gate.status === "stop") {
      setCat("skeptical");
      setSpeech(a.gate.message);
      setError(a.gate.message);
      return;
    }
    S.analysis = a;
    renderMatch(a);
    showStep("match");
  } catch (err) {
    setCat("concerned");
    setSpeech("Ada kendala saat membaca dokumen.");
    setError(err.message);
  } finally {
    btn.textContent = PRIMARY_LABEL[S.step];
    updatePrimary();
  }
}

const STATUS_TAG = { "terpenuhi": "ok", "sebagian": "mid", "tidak ada": "bad" };
function meterClass(score) { return score >= 70 ? "" : score >= 40 ? "mid" : "low"; }

function renderMatch(a) {
  $("#an-title").textContent = `Kecocokan untuk ${a.role}`;
  const meter = $("#an-meter");
  meter.className = meterClass(a.score);
  meter.style.transform = "scaleX(0)";
  requestAnimationFrame(() => requestAnimationFrame(() => { meter.style.transform = `scaleX(${a.score / 100})`; }));
  const label = { cocok: "cukup cocok", sebagian: "cocok sebagian", jauh: "masih jauh" }[a.category];
  $("#an-score").textContent = `${a.score}%, ${label}. ${a.score_explained}`;
  $("#an-gate").hidden = !a.gate.message;
  $("#an-gate").textContent = a.gate.message || "";
  $("#an-reqs").replaceChildren(...a.requirements.map((r) => el("li", {},
    el("div", { class: "req-head" },
      el("span", {}, el("strong", { text: r.item }), el("span", { class: "req-type", text: `  ${r.type}` })),
      el("span", { class: `tag ${STATUS_TAG[r.status]}`, text: r.status })),
    r.evidence ? el("p", { class: "evidence", text: `Bukti di CV: "${r.evidence}"` }) : null)));
  $("#language").value = a.language && a.language.job === "en" ? "en" : "id";
  if (a.category === "jauh") {
    setCat("concerned");
    setSpeech("Bidangmu cukup jauh dari posisi ini. Tidak apa-apa, kita latih cara menjelaskan transferable skill.");
  } else if (a.category === "sebagian") {
    setCat("idle");
    setSpeech(`Cocok sebagian (${a.score}%). Celah di daftar ini akan saya tanyakan, jadi siapkan jawabannya.`);
  } else {
    setCat("positive");
    setSpeech(`Skor kecocokanmu ${a.score}%. Saya akan bertanya soal kekuatan dan celah di daftar ini.`);
  }
}

function readSettings() {
  const nq = document.querySelector('input[name="nq"]:checked').value;
  S.settings.mode = nq === "demo" ? "demo" : "normal";
  S.settings.n_questions = nq === "demo" ? 5 : Number(nq);
  S.settings.language = $("#language").value;
  S.settings.voice = $("#voice").checked;
  S.settings.effect = document.querySelector('input[name="fx"]:checked').value;
  S.settings.company = (S.analysis && S.analysis.company) || $("#company").value.trim();
}

async function planAndStart() {
  readSettings();
  const btn = $("#setup-primary");
  btn.disabled = true;
  btn.textContent = "Menyusun pertanyaan...";
  setCat("thinking");
  setSpeech("Saya susun dulu pertanyaannya dari CV dan posisimu.");
  try {
    S.plan = await api("/api/plan", { json: { analysis: S.analysis, settings: S.settings } });
    S.replay = false;
    await showExplainer();
    startInterview();
  } catch (err) {
    setCat("concerned");
    setSpeech("Pertanyaannya belum berhasil disusun.");
    setError(err.message);
  } finally {
    btn.textContent = PRIMARY_LABEL[S.step];
    updatePrimary();
  }
}

async function startReplay() {
  if (S.demoIntro) return;
  S.replay = true;
  S.analysis = SEED.analysis;
  S.plan = { questions: SEED.questions };
  S.settings.mode = "demo";
  S.settings.language = "id";
  S.settings.company = SEED.company;
  S.settings.voice = PARAMS.has("voice") ? PARAMS.get("voice") !== "0" : $("#voice").checked;
  const fx = PARAMS.get("fx");
  S.settings.effect = ["off", "gentle", "full"].includes(fx) ? fx : document.querySelector('input[name="fx"]:checked').value;

  $("#mock-note").hidden = true; // tidak relevan untuk sesi rekaman
  // Babak 1: hasil analisis kecocokan (dari rekaman, tanpa AI) supaya penonton melihat personalisasinya.
  renderMatch(SEED.analysis);
  showStep("match");
  setSpeech(`Ini contoh hasil analisis: kecocokan ${SEED.analysis.score}%. Saya akan menanyakan kekuatan SQL dan celah Tableau atau Looker Studio.`);
  const go = await demoCountdown(PARAMS.get("auto") === "0" ? 0 : 8);
  if (!go) { S.replay = false; S.analysis = null; $("#mock-note").hidden = !(S.config && S.config.mock); return; }

  // Babak 2: interview rekaman. Tanpa modal penjelasan supaya waktu presentasi tidak terbuang.
  startInterview();
  if (PARAMS.get("auto") !== "0") {
    X.timers.replay.push(setTimeout(() => { if (X.phase === "ready") onMic(); }, 1500));
  }
}

// Tombol utama menjadi hitung mundur. Resolve true = lanjut, false = dibatalkan (tombol kembali).
function demoCountdown(secs) {
  return new Promise((resolve) => {
    const btn = $("#setup-primary");
    let left = secs, iv = null;
    const label = () => { btn.textContent = left > 0 ? `Mulai interview demo (${left})` : "Mulai interview demo"; };
    btn.disabled = false;
    label();
    if (secs > 0) iv = setInterval(() => { left -= 1; if (left <= 0) done(true); else label(); }, 1000);
    function done(go) {
      clearInterval(iv);
      S.demoIntro = null;
      btn.textContent = PRIMARY_LABEL[S.step];
      resolve(go);
    }
    S.demoIntro = done;
  });
}

async function onPrimary() {
  if (S.demoIntro) { S.demoIntro(true); return; }
  if (!stepValid()) return;
  if (S.step === "cv") showStep("job");
  else if (S.step === "job") await analyze();
  else if (S.step === "match") showStep("settings");
  else if (S.step === "settings") await planAndStart();
}

// Tes mikrofon di langkah atur latihan
async function micTest() {
  const note = $("#mic-test-note");
  note.textContent = "Mendengarkan selama 4 detik...";
  let peak = 0;
  try {
    await startMeter($("#mic-test-level"), (lvl) => { peak = Math.max(peak, lvl); });
  } catch (_) {
    note.textContent = "Mikrofon tidak bisa diakses. Izinkan mikrofon di pengaturan browser.";
    return;
  }
  await wait(4000);
  stopMeter();
  note.textContent = peak > 0.04 ? "Mikrofon terdengar jelas." : "Suara belum terdeteksi. Cek mikrofon atau izinnya.";
}

// ============================================================================ modal
function showExplainer() {
  return new Promise((resolve) => {
    let seen = false;
    try { seen = localStorage.getItem("ngblu_fx_seen") === "1"; } catch (_) { /* penyimpanan tidak tersedia */ }
    if (seen || S.settings.effect === "off") { resolve(); return; }
    const modal = $("#explainer");
    const bar = $("#explainer-progress");
    modal.hidden = false;
    $("#explainer-ok").focus();
    const started = performance.now();
    const iv = setInterval(() => {
      const p = Math.min(1, (performance.now() - started) / 10000);
      bar.style.setProperty("--p", p);
      if (p >= 1) close();
    }, 200);
    function close() {
      clearInterval(iv);
      modal.hidden = true;
      try { localStorage.setItem("ngblu_fx_seen", "1"); } catch (_) { /* abaikan */ }
      $("#explainer-ok").removeEventListener("click", close);
      resolve();
    }
    $("#explainer-ok").addEventListener("click", close);
  });
}

// ============================================================================ interview: mulai
function startInterview() {
  stopEverything();
  X = freshSession();
  // Token analisis CV dan penyusunan pertanyaan ikut dihitung di laporan pemakaian AI.
  if (!S.replay) {
    for (const u of [S.analysis && S.analysis.usage, S.plan && S.plan.usage]) {
      if (!u) continue;
      X.usage.input_tokens += u.input_tokens || 0;
      X.usage.output_tokens += u.output_tokens || 0;
      X.usage.calls += u.calls || 0;
    }
  }
  $("#demo-badge").hidden = !S.replay;
  document.body.dataset.screen = "interview";
  $("#screen-setup").hidden = true;
  $("#screen-interview").hidden = false;
  moveCat("#cat-slot");
  setFrame("wide");
  setCat("idle");
  const company = S.settings.company;
  $("#nametag").textContent = `Pak Kumis, HR Lead ${company || "tim rekrutmen"}`;
  const day = new Date().toLocaleDateString("id-ID", { weekday: "long" });
  $("#scene-caption").textContent = `${day[0].toUpperCase()}${day.slice(1)}, 09.58. Ruang interview ${company || "kantor"}.`;
  $("#dialog-text").textContent = S.replay
    ? (PARAMS.get("auto") === "0"
      ? "Mode demo: tekan tombol hijau, lalu duduk santai dan perhatikan."
      : "Mode demo: panggilan dimulai sebentar lagi. Duduk santai dan perhatikan.")
    : "Siap? Tekan tombol hijau untuk memulai panggilan.";
  $("#fx-mode").value = S.settings.effect;
  document.body.dataset.fxmode = S.settings.effect;
  document.body.dataset.fx = "0";
  $("#banner").hidden = true;
  $("#fx-toast").hidden = true;
  $("#breath").hidden = true;
  $("#type-box").hidden = true;
  closeCard();
  X.phase = "ready";
  setMic("start", true);
  $("#btn-mic").classList.add("ready");
  setStatus("Tekan tombol hijau untuk memulai panggilan.");
  setRightTab("live");
  setXp(0);
  renderAll();
  X.timers.tick = setInterval(tick, 250);
}

function setMic(state, enabled) {
  const btn = $("#btn-mic");
  btn.dataset.state = state;
  btn.disabled = !enabled;
  btn.setAttribute("aria-label", { start: "Mulai panggilan", answer: "Mulai menjawab", recording: "Selesai menjawab" }[state]);
}
function setStatus(text) { $("#mic-status-text").textContent = text; }
function currentQuestion() { return S.plan.questions[X.qIndex]; }

async function onMic() {
  $("#btn-mic").classList.remove("ready");
  if (X.phase === "ready") await askQuestion();
  else if (X.phase === "await-answer") startAnswer();
  else if (X.phase === "recording") await endAnswer();
}

// ============================================================================ interview: bertanya
async function askQuestion({ followupText = null } = {}) {
  const q = currentQuestion();
  X.phase = "asking";
  setMic("answer", false);
  $("#btn-repeat").disabled = true;
  $("#btn-skip").disabled = true;
  const text = followupText || q.question;
  X.askedText = text;
  X.entries.push({ kind: "q", q: q.no, text, t: clock(), followup: Boolean(followupText) });
  renderTranscript();
  renderDots();
  setFrame(HARD_SLOTS.has(q.slot) && !followupText ? "close" : "wide");
  setStatus(followupText ? "Pertanyaan lanjutan..." : "Pak Kumis sedang bertanya...");
  await say(text);
  if (X.t0Perf == null) X.t0Perf = performance.now(); // t0 = akhir audio pertanyaan pertama
  if (X.phase !== "asking") return;
  X.phase = "await-answer";
  setFrame("mid");
  setMic("answer", true);
  $("#btn-mic").classList.add("ready");
  $("#btn-repeat").disabled = false;
  $("#btn-skip").disabled = false;
  setStatus(SR ? "Tekan mikrofon untuk menjawab." : "Ketik jawabanmu di bawah.");
  if (!SR && !S.replay) startAnswer();
  if (S.replay) X.timers.replay.push(setTimeout(() => { if (X.phase === "await-answer") { $("#btn-mic").classList.remove("ready"); startAnswer(); } }, 900));
}

async function repeatQuestion() {
  if (X.phase !== "await-answer") return;
  X.phase = "asking";
  setMic("answer", false);
  await say(X.askedText);
  if (X.phase !== "asking") return;
  X.phase = "await-answer";
  setMic("answer", true);
}

// ============================================================================ interview: menjawab
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function startAnswer() {
  if (X.phase !== "await-answer") return;
  const q = currentQuestion();
  X.entries.push({ kind: "a", q: q.no, words: [], interim: "", interimFirst: null, startT: clock(), endT: null, lastActivity: null, result: null, skipped: false });
  X.current = X.entries.length - 1;
  X.phase = "recording";
  setMic("recording", true);
  $("#btn-repeat").disabled = true;
  $("#live-dot").hidden = false;
  setCat(X.shownLevel >= 2 ? "concerned" : "listening");
  setFrame("mid");
  setStatus("Mendengarkan... tekan lagi kalau sudah selesai.");
  renderTranscript();
  if (S.replay) { feedReplay(X.entries[X.current]); return; }
  if (!SR || X.micDenied) {
    showTypeBox(SR ? "Mikrofon tidak tersedia. Ketik jawabanmu." : "Browser ini belum mendukung input suara. Ketik jawabanmu, atau gunakan Chrome.");
    return;
  }
  startRecognition(X.entries[X.current]);
  startMeter($("#mic-level")).catch(() => { /* indikator level opsional */ });
}

function startRecognition(entry) {
  X.recording = true;
  const startInstance = () => {
    const rec = new SR();
    const segs = {};
    rec.lang = S.settings.language === "en" ? "en-US" : "id-ID";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      const now = clock();
      entry.lastActivity = now;
      let interim = "";
      let first = null;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const seg = segs[i] || (segs[i] = { first: now, done: false });
        if (r.isFinal) {
          if (!seg.done) { seg.done = true; ingestSegment(entry, r[0].transcript, seg.first, now); }
        } else {
          interim += `${r[0].transcript} `;
          first = first == null ? seg.first : Math.min(first, seg.first);
        }
      }
      entry.interim = interim.trim();
      entry.interimFirst = first;
      renderTranscript();
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        X.micDenied = true;
        stopRecognition();
        stopMeter();
        showTypeBox("Akses mikrofon ditolak. Ketik jawabanmu, atau izinkan mikrofon di pengaturan browser.");
      } else if (e.error === "network" || e.error === "audio-capture") {
        // Pengenalan suara Chrome butuh internet. Jangan berulang tanpa akhir: setelah 2 kali gagal, pindah ke ketik.
        X.sttFailures = (X.sttFailures || 0) + 1;
        if (X.sttFailures >= 2) {
          X.micDenied = true;
          stopRecognition();
          stopMeter();
          showTypeBox(e.error === "network"
            ? "Pengenalan suara butuh internet yang stabil. Ketik jawabanmu dulu, ya."
            : "Mikrofon tidak terdeteksi. Ketik jawabanmu, atau cek kabel atau izin mikrofon.");
        }
      }
    };
    // Chrome menghentikan pengenalan saat hening; mulai lagi selama masih menjawab.
    rec.onend = () => {
      if (!X.recording || X.rec !== rec) return;
      if (entry.interim) {
        ingestSegment(entry, entry.interim, entry.interimFirst ?? clock(), clock());
        entry.interim = "";
      }
      try { startInstance(); } catch (_) { /* sudah berjalan */ }
    };
    X.rec = rec;
    rec.start();
  };
  startInstance();
}

function stopRecognition() {
  X.recording = false;
  const rec = X.rec;
  X.rec = null;
  if (rec) { try { rec.stop(); } catch (_) { /* sudah berhenti */ } }
}

function showTypeBox(message) {
  $("#type-box").hidden = false;
  $("#type-note").textContent = message;
  $("#type-answer").value = "";
  $("#type-answer").focus();
}

function sendTyped() {
  if (X.phase !== "recording") return;
  const text = $("#type-answer").value.trim();
  if (!text) { $("#type-note").textContent = "Tulis jawabanmu dulu."; return; }
  const entry = X.entries[X.current];
  // Jawaban ketik diberi waktu ucap perkiraan (~130 kata per menit), bukan lama mengetik,
  // supaya kecepatan bicara dan jeda tidak dinilai dari kecepatan mengetik.
  entry.typed = true;
  const n = text.split(/\s+/).filter(Boolean).length;
  const start = entry.words.length ? entry.words[entry.words.length - 1].t + 400 : entry.startT;
  ingestSegment(entry, text, start, start + Math.max(1, n - 1) * SPOKEN_MS_PER_WORD);
  endAnswer();
}

// Kata dari satu segmen ucapan diberi waktu merata dari awal sampai akhir segmen.
function ingestSegment(entry, text, tStart, tEnd) {
  const tokens = String(text).trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return;
  const prevT = entry.words.length ? entry.words[entry.words.length - 1].t : entry.startT;
  tEnd = Math.max(tEnd, prevT + 50);
  tStart = Math.min(tStart, tEnd - tokens.length * 200); // minimal 200 ms per kata
  tStart = Math.max(tStart, prevT + 1);
  if (tEnd < tStart) tEnd = tStart;
  const n = tokens.length;
  tokens.forEach((w, k) => {
    entry.words.push({ text: w, t: Math.round(n === 1 ? tStart : tStart + ((tEnd - tStart) * k) / (n - 1)), segStart: k === 0 });
  });
  runHeuristics(X.entries.indexOf(entry));
}

function runHeuristics(entryIdx) {
  const entry = X.entries[entryIdx];
  for (const f of A.detectAll(entry.words, S.settings.language, entry.startT)) {
    if (entry.typed && (f.type === "rate_spike" || f.type === "long_pause")) continue; // tidak relevan untuk ketikan
    const keyIdx = f.type === "long_pause" ? f.keyIdx : f.start;
    const key = `${entryIdx}:${f.type}:${keyIdx}`;
    if (X.keys.has(key)) continue;
    const t = f.type === "long_pause" ? entry.words[f.keyIdx].t : entry.words[f.end].t;
    addBlunder({ type: f.type, entry: entryIdx, start: f.start, end: f.end, t, gapMs: f.gapMs, source: "heuristic" }, key);
  }
  renderAll();
}

function whatHappened(b, entry) {
  const words = entry.words.slice(b.start, b.end + 1).map((w) => w.text).join(" ");
  switch (b.type) {
    case "filler": return `Kamu mengucapkan "${words}".`;
    case "restart": return `Bagian "${words}" terulang.`;
    case "hedging": return `Ada tiga kata ragu berdekatan: "${words}".`;
    case "rate_spike": return `Lebih dari ${C.thresholds.rateWpm} kata per menit dalam 10 detik terakhir.`;
    case "long_pause": return `Hening sekitar ${Math.max(3, Math.round((b.gapMs || 3000) / 1000))} detik.`;
    case "rambling": return "Jawaban berjalan lebih dari 2 menit.";
    default: return "";
  }
}

function addBlunder(b, key) {
  X.keys.add(key);
  const entry = X.entries[b.entry];
  const full = {
    id: X.nextId++, key, type: b.type, category: C.typeCategory[b.type], weight: C.weights[b.type],
    severity: b.severity || C.weights[b.type], q: entry.q, entry: b.entry, start: b.start, end: b.end, t: b.t,
    gapMs: b.gapMs, label: C.labels[b.type], source: b.source, ack: false, dismissed: false,
    suggestion: b.suggestion || C.tips[b.type] || "",
  };
  full.what = b.explanation || whatHappened(full, entry);
  X.blunders.push(full);
  effectTick();
}

// ============================================================================ detak (250 ms)
function tick() {
  X.tickCount += 1;
  if (X.phase === "recording") {
    const entry = X.entries[X.current];
    const now = clock();
    const silent = now - (entry.lastActivity ?? entry.startT);
    // Jeda panjang terdeteksi saat hening masih berlangsung
    if (silent > C.thresholds.longPauseMs && $("#type-box").hidden) { // tidak dihitung saat mengetik
      const idx = entry.words.length;
      const key = `${X.current}:long_pause:${idx}`;
      if (!X.keys.has(key)) {
        addBlunder({ type: "long_pause", entry: X.current, start: Math.max(0, idx - 1), end: Math.max(0, idx - 1), t: now, gapMs: silent, source: "heuristic" }, key);
        renderAll();
      }
    }
    if (!S.replay && X.recording && entry.words.length && silent > C.thresholds.autoEndSilenceMs) endAnswer();
    const secs = Math.floor((now - entry.startT) / 1000);
    $("#rec-timer").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  }
  if (X.tickCount % 4 === 0 && X.t0Perf != null && X.phase !== "summary") {
    effectTick();
    X.scorePoints.push({ t: clock(), s: A.liveScore(X.blunders, clock()) });
    renderRight();
  }
}

// ============================================================================ efek kesadaran
function effectTick() {
  if (X.t0Perf == null || X.phase === "summary" || X.phase === "idle") return;
  const now = clock();
  const load = A.composureLoad(X.blunders, now);
  X.effect = A.nextEffectState(X.effect, load, now);
  setShownLevel(A.applyMode(X.effect.level, S.settings.effect), now);
}

function setShownLevel(level, now) {
  const prev = X.shownLevel;
  if (level === prev) return;
  X.shownLevel = level;
  document.body.classList.toggle("fx-falling", level < prev);
  document.body.dataset.fx = String(level);
  X.effectEvents.push({ t: now, level, prev });

  if (level === 1 && prev === 0) pulseOnce($("#graph-card"), "pulse-once");
  const toast = $("#fx-toast");
  if (level >= 2) {
    const cause = A.dominantCause(X.blunders, now);
    toast.textContent = level === 3 ? C.toasts.level3 : (C.toasts[cause] || C.toasts.default);
    toast.hidden = false;
  } else {
    toast.hidden = true;
  }
  setBreathing(level === 3);
  if (level === 0 && prev > 0) {
    X.recoveries.push({ t: now });
    pulseOnce($("#fx-recover"), "flash");
  }
  if (X.phase === "recording") setCat(level >= 2 ? "concerned" : "listening");
  renderRight();
}

function pulseOnce(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth; // mulai ulang animasi
  node.classList.add(cls);
  node.addEventListener("animationend", () => node.classList.remove(cls), { once: true });
}

function setBreathing(on) {
  const box = $("#breath");
  clearInterval(X.timers.breath);
  box.hidden = !on;
  if (!on) return;
  const text = $("#breath-text");
  if (reduceMotion.matches) { text.textContent = "Tarik 4 detik, buang 4 detik"; return; }
  let inhale = true;
  text.textContent = "Tarik napas";
  X.timers.breath = setInterval(() => { inhale = !inhale; text.textContent = inhale ? "Tarik napas" : "Buang napas"; }, 4000);
}

// ============================================================================ interview: selesai menjawab
async function endAnswer() {
  if (X.phase !== "recording") return;
  X.phase = "analyzing";
  stopRecognition();
  stopMeter();
  clearReplayTimers();
  $("#type-box").hidden = true;
  $("#live-dot").hidden = true;
  const idx = X.current;
  const entry = X.entries[idx];
  const now = clock();
  if (entry.interim) {
    ingestSegment(entry, entry.interim, entry.interimFirst ?? now, now);
    entry.interim = "";
  }
  entry.endT = entry.typed && entry.words.length ? entry.words[entry.words.length - 1].t + SPOKEN_MS_PER_WORD : now;
  if (entry.endT - entry.startT > C.thresholds.ramblingMs && entry.words.length) {
    addBlunder({ type: "rambling", entry: idx, start: 0, end: entry.words.length - 1, t: now, source: "heuristic" }, `${idx}:rambling:0`);
  }
  setMic("answer", false);
  $("#btn-repeat").disabled = true;
  $("#btn-skip").disabled = true;
  setCat("thinking");
  setFrame("wide");
  setStatus("Pak Kumis sedang menilai jawabanmu...");
  renderAll();

  let result;
  if (!entry.words.length) {
    result = { flags: [], answer_score: null, strength: "", next_time: ["Coba jawab dengan suara atau ketik jawabanmu."], decision: "next" };
  } else if (S.replay) {
    await wait(1200);
    result = SEED.answers[X.qIndex].result;
  } else {
    try {
      result = await api("/api/turn", {
        json: {
          question: currentQuestion(), words: entry.words.map((w) => w.text),
          candidate: S.analysis.candidate, followups_used: X.followupsUsed, max_followups: 1,
          language: S.settings.language,
        },
      });
    } catch (err) {
      result = { error: err.message, flags: [], answer_score: null, strength: "", next_time: [], decision: "next" };
    }
  }
  if (X.phase !== "analyzing") return;
  applyResult(idx, result);
}

function applyResult(idx, result) {
  const entry = X.entries[idx];
  entry.result = result;
  for (const f of result.flags || []) {
    if (!(f.start_word >= 0 && f.end_word < entry.words.length && f.start_word <= f.end_word)) continue;
    const key = `${idx}:${f.type}:${f.start_word}`;
    if (X.keys.has(key)) continue;
    addBlunder({
      type: f.type, entry: idx, start: f.start_word, end: f.end_word, t: entry.words[f.start_word].t,
      severity: f.severity, explanation: f.explanation, suggestion: f.suggestion, source: "ai",
    }, key);
  }
  if ((result.flags || []).length) {
    X.scorePoints = X.scorePoints.map((p) => ({ t: p.t, s: A.liveScore(X.blunders, p.t) }));
  }
  const gain = result.error ? 0 : A.xpForScore(result.answer_score);
  if (result.answer_score != null) X.answerScores.push(result.answer_score);
  setXp(X.xp + gain);
  const skeptic = (result.flags || []).some((f) => f.type === "cv_contradiction" || f.type === "vague_claim");
  setCat(skeptic ? "skeptical" : (result.answer_score >= 75 ? "positive" : "idle"));
  renderAll();
  showBanner(result, gain);
}

function setXp(value) {
  X.xp = value;
  $("#xp-value").textContent = value;
  if (value > 0 && !reduceMotion.matches) pulseOnce($("#xp-pill"), "bump");
}

function showBanner(result, gain) {
  const banner = $("#banner");
  const score = result.answer_score;
  let variant = "", title = "Mantap!";
  if (result.error) { variant = "error"; title = "Jawaban tercatat, penilaian AI gagal"; }
  else if (score == null) { variant = "mid"; title = "Jawaban tercatat"; }
  else if (score < 50) { variant = "low"; title = "Ayo perbaiki"; }
  else if (score < 75) { variant = "mid"; title = "Lumayan!"; }
  banner.className = `banner ${variant}`;
  $("#banner-title").textContent = title;
  $("#banner-xp").textContent = gain ? `+${gain} XP` : "";
  $("#banner-strength").textContent = result.error ? result.error : (result.strength || "");
  $("#banner-list").replaceChildren(...(result.next_time || []).slice(0, 2).map((t) => el("li", { text: t })));
  const isLast = X.qIndex >= S.plan.questions.length - 1;
  const follow = result.decision === "follow_up" && result.follow_up_question && X.followupsUsed < 1;
  $("#banner-btn").textContent = follow ? "Jawab pertanyaan lanjutan" : (isLast ? "Lihat hasil" : "Lanjut");
  banner.hidden = false;
  X.phase = "banner";
  setStatus("");
  $("#banner-btn").focus({ preventScroll: true });
  if (S.replay) X.timers.replay.push(setTimeout(() => { if (X.phase === "banner") bannerContinue(); }, 3200));
}

async function bannerContinue() {
  if (X.phase !== "banner") return;
  const banner = $("#banner");
  X.phase = "between";
  banner.classList.add("leaving");
  await wait(reduceMotion.matches ? 0 : 200);
  banner.hidden = true;
  banner.classList.remove("leaving");
  const entry = X.entries[X.current];
  const r = entry && entry.result;
  if (r && r.decision === "follow_up" && r.follow_up_question && X.followupsUsed < 1) {
    X.followupsUsed += 1;
    await askQuestion({ followupText: r.follow_up_question });
  } else {
    await nextQuestion();
  }
}

async function nextQuestion() {
  X.qIndex += 1;
  X.followupsUsed = 0;
  renderDots();
  if (X.qIndex < S.plan.questions.length) await askQuestion();
  else await finishSession();
}

async function skipQuestion() {
  if (X.phase === "recording") {
    stopRecognition();
    stopMeter();
    clearReplayTimers();
    $("#type-box").hidden = true;
    $("#live-dot").hidden = true;
    const entry = X.entries[X.current];
    entry.skipped = true;
    entry.endT = clock();
  } else if (X.phase === "await-answer") {
    X.entries.push({ kind: "a", q: currentQuestion().no, words: [], interim: "", startT: clock(), endT: clock(), skipped: true });
  } else return;
  X.phase = "between";
  stopSpeech();
  renderTranscript();
  await nextQuestion();
}

// ============================================================================ replay offline
function clearReplayTimers() { X.timers.replay.forEach((id) => clearTimeout(id)); X.timers.replay = []; }

function feedReplay(entry) {
  const data = SEED.answers[X.qIndex];
  const base = entry.startT;
  const later = (ms, fn) => X.timers.replay.push(setTimeout(fn, ms));
  for (const seg of data.segments) {
    const tokens = seg.text.split(/\s+/);
    later(seg.at, () => {
      const steps = Math.max(1, Math.round(seg.dur / 250));
      let k = 0;
      const iv = setInterval(() => {
        k += 1;
        entry.lastActivity = clock();
        entry.interim = tokens.slice(0, Math.ceil((tokens.length * Math.min(k, steps)) / steps)).join(" ");
        entry.interimFirst = base + seg.at;
        renderTranscript();
        if (k >= steps - 1) clearInterval(iv);
      }, 250);
      X.timers.replay.push(iv);
    });
    later(seg.at + seg.dur + 30, () => {
      entry.interim = "";
      ingestSegment(entry, seg.text, base + seg.at, base + seg.at + seg.dur);
      entry.lastActivity = clock();
      renderTranscript();
    });
  }
  later(data.endAfterMs, () => endAnswer());
}

// ============================================================================ ringkasan
async function finishSession() {
  if (X.phase === "summary") return;
  const wasRecording = X.phase === "recording";
  X.phase = "summary";
  stopRecognition();
  stopMeter();
  clearReplayTimers();
  stopSpeech();
  if (wasRecording) {
    const entry = X.entries[X.current];
    entry.endT = entry.endT ?? clock();
  }
  $("#banner").hidden = true;
  $("#type-box").hidden = true;
  $("#live-dot").hidden = true;
  setBreathing(false);
  $("#fx-toast").hidden = true;
  document.body.dataset.fx = "0";
  setMic("start", false);
  setCat("positive");
  setFrame("wide");
  setStatus("Latihan selesai.");
  renderAll();

  const answers = X.entries.filter((e) => e.kind === "a" && !e.skipped);
  const stats = A.tiles(answers, X.blunders);
  const localScore = A.finalScore(X.blunders, stats.msSpoken);
  const modal = $("#summary");
  modal.hidden = false;
  $("#summary-error").textContent = "";
  $("#sum-body").hidden = true;
  $("#sum-xp").textContent = X.xp;
  $("#sum-avg").textContent = "Menyusun ringkasan...";
  setRing(0, false);

  if (!answers.length) {
    $("#sum-avg").textContent = "Belum ada jawaban yang bisa dinilai.";
    return;
  }
  let data;
  if (S.replay) {
    await wait(600);
    data = { ...SEED.summary, final_score: localScore, avg_answer_score: avg(X.answerScores) };
  } else {
    try {
      data = await api("/api/report", {
        json: {
          role: S.analysis.role, company: S.settings.company, language: S.settings.language,
          blunders: X.blunders.map((b) => ({ type: b.type, label: b.label, explanation: b.what, q: b.q })),
          ms_spoken: stats.msSpoken, answer_scores: X.answerScores,
        },
      });
    } catch (err) {
      $("#summary-error").textContent = `${err.message} Skor di bawah dihitung langsung di browser.`;
      data = { final_score: localScore, avg_answer_score: avg(X.answerScores), top_weaknesses: [], strength: "", recommendations: [] };
    }
  }
  renderSummary(data);
}

const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

function setRing(score, animate) {
  const fg = $("#ring-fg");
  const full = 326.7;
  fg.style.transition = animate && !reduceMotion.matches ? "" : "none";
  fg.style.strokeDashoffset = String(full * (1 - score / 100));
  fg.style.stroke = score >= 70 ? "var(--green)" : score >= 40 ? "var(--amber)" : "var(--orange)";
  const out = $("#ring-value");
  if (!animate || reduceMotion.matches) { out.textContent = score; return; }
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / 900);
    out.textContent = Math.round(score * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderSummary(data) {
  requestAnimationFrame(() => setRing(data.final_score ?? 0, true));
  const answers = X.entries.filter((e) => e.kind === "a" && !e.skipped);
  const secs = Math.round(A.tiles(answers, X.blunders).msSpoken / 1000);
  const weight = X.blunders.reduce((s, b) => s + b.weight, 0);
  const spoken = secs < 60 ? `${secs} detik` : `${(secs / 60).toFixed(1).replace(".", ",")} menit`;
  const floor = secs < C.score.minMinutes * 60 ? ` (dihitung minimal ${C.score.minMinutes * 60} detik)` : "";
  $("#sum-avg").textContent = [
    `${weight} poin temuan dalam ${spoken} bicara${floor}.`,
    data.avg_answer_score != null ? `Rata-rata nilai isi jawaban: ${data.avg_answer_score}.` : "",
  ].join(" ");
  $("#sum-weak").replaceChildren(...(data.top_weaknesses || []).map((w) => el("li", {},
    el("span", { class: "dot", style: `--dc: var(--c-${w.category})` }),
    el("div", {},
      el("p", { class: "weak-cat", text: C.categoryLabels[w.category] || w.category }),
      el("p", { text: w.evidence }),
      w.tip ? el("p", { class: "weak-tip", text: w.tip }) : null))));
  $("#sum-strength").textContent = data.strength || "";
  $(".strength-card").hidden = !data.strength;
  $("#sum-recs").replaceChildren(...(data.recommendations || []).map((r) => el("li", {}, el("span", { text: r }))));
  $("#sum-body").hidden = !(data.top_weaknesses || []).length && !data.strength;
  confetti();
}

function confetti() {
  const box = $("#confetti");
  box.replaceChildren();
  if (reduceMotion.matches) return;
  const colors = ["var(--green)", "var(--blue)", "var(--amber)", "var(--violet)", "var(--orange)", "var(--teal)"];
  for (let i = 0; i < 22; i++) {
    const angle = (Math.PI * 2 * i) / 22;
    const dist = 120 + Math.random() * 120;
    box.append(el("i", {
      style: `--cc:${colors[i % colors.length]};--x:${Math.cos(angle) * dist}px;--y:${Math.sin(angle) * dist - 60}px;--r:${Math.round(Math.random() * 540)}deg;--d:${Math.round(Math.random() * 120)}ms`,
    }));
  }
}

function closeSummary() { $("#summary").hidden = true; }

function backToSetup(step) {
  stopEverything();
  if (S.replay) { S.replay = false; S.analysis = null; S.plan = null; }
  $("#mock-note").hidden = !(S.config && S.config.mock);
  X.phase = "idle";
  document.body.dataset.fx = "0";
  document.body.dataset.screen = "setup";
  $("#screen-interview").hidden = true;
  $("#screen-setup").hidden = false;
  moveCat("#mascot-setup");
  setFrame("wide");
  showStep(step);
}

function stopEverything() {
  clearInterval(X.timers.tick);
  clearInterval(X.timers.breath);
  clearReplayTimers();
  stopRecognition();
  stopMeter();
  stopSpeech();
}

// ============================================================================ mikrofon (indikator level)
async function startMeter(bar, onLevel) {
  stopMeter();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  const meter = { stream, ctx, bar, raf: null };
  const loop = () => {
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    const rms = Math.sqrt(sum / data.length);
    bar.style.transform = `scaleX(${Math.min(1, rms * 4)})`;
    if (onLevel) onLevel(rms);
    meter.raf = requestAnimationFrame(loop);
  };
  X.meter = meter;
  loop();
}
function stopMeter() {
  const m = X.meter;
  if (!m) return;
  cancelAnimationFrame(m.raf);
  m.stream.getTracks().forEach((t) => t.stop());
  m.ctx.close().catch(() => {});
  m.bar.style.transform = "scaleX(0)";
  X.meter = null;
}

// ============================================================================ render: kiri
const visible = () => X.blunders.filter((b) => !b.dismissed);

function renderAll() {
  renderTranscript();
  renderCatbar();
  renderRight();
  renderDots();
}

function renderTranscript() {
  const box = $("#transcript");
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  if (!X.entries.length) {
    box.replaceChildren(el("p", { class: "empty", text: "Transkrip muncul di sini saat kamu menjawab." }));
    return;
  }
  box.replaceChildren(...X.entries.map((e, i) => (e.kind === "q" ? renderQ(e) : renderA(e, i))));
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

function renderQ(e) {
  return el("div", { class: "turn turn-q" },
    el("div", { class: "turn-meta" }, el("span", { text: e.followup ? "Pak Kumis (lanjutan)" : "Pak Kumis" }), el("span", { text: A.formatClock(e.t) })),
    el("div", { class: "turn-text", text: e.text }));
}

function renderA(e, idx) {
  const wrap = el("div", { class: "turn turn-a" },
    el("div", { class: "turn-meta" }, el("span", { text: "Kamu" }), el("span", { text: A.formatClock(e.startT) })));
  const text = el("div", { class: "turn-text" });
  if (e.skipped && !e.words.length) text.append(el("span", { class: "turn-empty", text: "Pertanyaan dilewati." }));
  const flags = visible().filter((b) => b.entry === idx);
  const top = new Array(e.words.length).fill(null);
  for (const b of flags) {
    for (let i = b.start; i <= Math.min(b.end, e.words.length - 1); i++) {
      if (!top[i] || b.severity > top[i].severity || (b.severity === top[i].severity && b.t > top[i].t)) top[i] = b;
    }
  }
  e.words.forEach((w, i) => {
    const b = top[i];
    const joined = i < e.words.length - 1 && b && top[i + 1] === b;
    if (b) {
      text.append(el("span", {
        class: `u${b.severity === 3 ? " sev3" : ""}${b.ack ? " ack" : ""}${X.selected === b.id ? " focus-b" : ""}`,
        style: `--uc: var(--c-${b.category})`, "data-b": b.id, tabindex: "0", role: "button",
        "aria-label": `${b.label}: ${w.text}`, text: w.text + (joined ? " " : ""),
      }));
      if (!joined) text.append(" ");
    } else {
      text.append(`${w.text} `);
    }
  });
  if (e.interim) text.append(el("span", { class: "interim", text: e.interim }));
  wrap.append(text);
  if (e.result && !e.result.error && (e.result.strength || (e.result.next_time || []).length)) {
    wrap.append(el("div", { class: "next-card" },
      e.result.strength ? el("p", { class: "ok", text: `Sudah bagus: ${e.result.strength}` }) : null,
      (e.result.next_time || []).length ? el("p", { text: "Lain kali" }) : null,
      el("ul", {}, ...(e.result.next_time || []).slice(0, 2).map((t) => el("li", { text: t })))));
  }
  return wrap;
}

function sortedVisible() { return visible().sort((a, b) => a.t - b.t || a.id - b.id); }

function openCard(id) {
  const b = X.blunders.find((x) => x.id === id);
  if (!b) return;
  X.cardId = id;
  X.selected = id;
  const list = sortedVisible();
  const pos = list.findIndex((x) => x.id === id);
  const entry = X.entries[b.entry];
  const quote = entry.words.slice(b.start, b.end + 1).map((w) => w.text).join(" ");
  const card = $("#sugg-card");
  card.replaceChildren(
    el("div", { class: "sugg-head" },
      el("span", { class: "sugg-title" }, el("span", { class: "dot", style: `--dc: var(--c-${b.category})` }), `${b.label}`,
        el("span", { class: "muted small", text: C.categoryLabels[b.category] })),
      el("span", { class: "sugg-nav" },
        el("button", { type: "button", "aria-label": "Temuan sebelumnya", "data-nav": "-1", disabled: pos <= 0, text: "‹" }),
        el("button", { type: "button", "aria-label": "Temuan berikutnya", "data-nav": "1", disabled: pos >= list.length - 1, text: "›" }))),
    quote ? el("p", { class: "quote" }, el("s", { text: quote })) : null,
    el("p", {}, el("span", { class: "sugg-label", text: "Yang terjadi: " }), b.what),
    el("p", {}, el("span", { class: "sugg-label", text: "Kenapa penting: " }), C.why[b.type]),
    b.suggestion ? el("p", {}, el("span", { class: "sugg-label", text: "Coba ini: " }), el("span", { class: "fix", text: b.suggestion })) : null,
    el("div", { class: "sugg-actions" },
      el("button", { type: "button", class: "btn btn-primary", "data-act": "ack", text: "Mengerti" }),
      el("button", { type: "button", class: "btn", "data-act": "dismiss", text: "Abaikan" })));
  card.hidden = false;
  renderTranscript();
  renderRight();
}

function closeCard() { $("#sugg-card").hidden = true; X.cardId = null; }

function onCardClick(e) {
  const nav = e.target.closest("[data-nav]");
  const act = e.target.closest("[data-act]");
  const b = X.blunders.find((x) => x.id === X.cardId);
  if (!b) return;
  if (nav) {
    const list = sortedVisible();
    const pos = list.findIndex((x) => x.id === b.id) + Number(nav.dataset.nav);
    if (list[pos]) { openCard(list[pos].id); scrollToBlunder(list[pos].id); }
  } else if (act) {
    if (act.dataset.act === "ack") b.ack = true;
    else b.dismissed = true;
    closeCard();
    renderAll();
  }
}

function renderCatbar() {
  const counts = Object.fromEntries(C.categories.map((c) => [c, 0]));
  for (const b of visible()) counts[b.category] += 1;
  $("#catbar").replaceChildren(...C.categories.map((c) => {
    const n = counts[c];
    return el("div", { class: "cat-cell", title: `${C.categoryLabels[c]}: ${n} temuan` },
      el("div", { class: "cat-name", text: C.categoryLabels[c] }),
      el("div", { class: "cat-count" }, el("span", { class: "dot", style: `--dc: var(--c-${c})` }), String(n)),
      el("div", { class: `strip${n >= 3 ? " bad" : n >= 1 ? " mid" : ""}` }));
  }));
}

// ============================================================================ render: tengah
function renderDots() {
  const total = S.plan ? S.plan.questions.length : 0;
  $("#q-dots").replaceChildren(...Array.from({ length: total }, (_, i) =>
    el("span", { class: i < X.qIndex || X.phase === "summary" ? "done" : i === X.qIndex ? "now" : "" })));
  const p = total ? Math.min(X.qIndex, total) / total : 0;
  $("#iv-progress").style.setProperty("--p", X.phase === "summary" ? 1 : p);
}

// ============================================================================ render: kanan
function setRightTab(tab) {
  X.rightTab = tab;
  $$(".tabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  $$("[data-tabpanel]").forEach((p) => { p.hidden = p.dataset.tabpanel !== tab; });
  if (tab === "review" && !X.selected) {
    const first = sortedVisible()[0];
    if (first) X.selected = first.id;
  }
  renderRight();
}

function renderRight() {
  const last = X.scorePoints[X.scorePoints.length - 1];
  $("#live-score").textContent = last ? Math.round(last.s) : 100;
  if (X.rightTab === "live") { renderGraph($("#graph")); renderTiles(); renderEvents(); }
  else if (X.rightTab === "review") { renderGraph($("#graph-review")); renderReview(); }
  else renderDetails();
}

function scoreAt(t) {
  let s = 100;
  for (const p of X.scorePoints) { if (p.t <= t) s = p.s; else break; }
  return s;
}

function renderGraph(box) {
  const W = Math.max(200, box.clientWidth || 280);
  const H = 120, pad = 8;
  const active = X.phase !== "summary" && X.t0Perf != null;
  const lastT = X.scorePoints.length ? X.scorePoints[X.scorePoints.length - 1].t : 0;
  const tMax = Math.max(60000, active ? clock() : lastT, lastT);
  const x = (t) => pad + ((W - 2 * pad) * t) / tMax;
  const y = (s) => pad + (H - 2 * pad) * (1 - s / 100);
  const pts = X.scorePoints.length ? X.scorePoints : [{ t: 0, s: 100 }];
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.s).toFixed(1)}`).join(" ");
  const area = `M${x(pts[0].t).toFixed(1)},${H - pad} ${line.replace(/^M/, "L")} L${x(pts[pts.length - 1].t).toFixed(1)},${H - pad} Z`;
  const dots = visible().map((b) =>
    `<circle class="gdot${X.selected === b.id ? " selected" : ""}" data-b="${b.id}" cx="${x(b.t).toFixed(1)}" cy="${y(scoreAt(b.t)).toFixed(1)}" r="5.5" fill="${SEVERITY_COLOR[b.severity]}"><title>${b.label} ${A.formatClock(b.t)}</title></circle>`).join("");
  const greens = X.recoveries.map((r) => `<circle class="gdot" cx="${x(r.t).toFixed(1)}" cy="${y(scoreAt(r.t)).toFixed(1)}" r="5.5" fill="var(--green)"><title>Kembali tenang ${A.formatClock(r.t)}</title></circle>`).join("");
  const sel = X.blunders.find((b) => b.id === X.selected);
  const headT = sel ? sel.t : (active ? clock() : null);
  const head = headT != null ? `<line class="playhead" x1="${x(headT).toFixed(1)}" x2="${x(headT).toFixed(1)}" y1="${pad}" y2="${H - pad}"/>` : "";
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Grafik skor sepanjang sesi">
    <line class="mid-line" x1="${pad}" x2="${W - pad}" y1="${y(50)}" y2="${y(50)}"/>
    <path class="area" d="${area}"/><path class="line" d="${line}"/>${head}${greens}${dots}</svg>`;
}

function liveAnswers() {
  return X.entries.filter((e) => e.kind === "a" && !e.skipped).map((e) => (e.endT == null ? { ...e, endT: clock() } : e));
}

function renderTiles() {
  const answers = liveAnswers();
  const t = A.tiles(answers, visible());
  const tile = (v, l) => el("div", { class: "tile" }, el("div", { class: "tile-value", text: v }), el("div", { class: "tile-label", text: l }));
  $("#tiles").replaceChildren(
    tile(t.fillerPerMin.toFixed(1), "kata pengisi per menit"),
    tile(`${t.avgPauseS.toFixed(1)} dtk`, "rata-rata jeda"),
    tile(String(Math.round(t.wpm)), "kata per menit"),
    tile(t.perAnswer.toFixed(1), "temuan per jawaban"));
}

function renderEvents() {
  const rows = A.groupEvents(visible()).map((g) => ({ ...g, kind: "b" }));
  for (const e of X.effectEvents) rows.push({ kind: "fx", t: e.t, level: e.level, prev: e.prev });
  rows.sort((a, b) => a.t - b.t);
  const list = $("#events");
  if (!rows.length) { list.replaceChildren(el("li", { class: "empty", text: "Belum ada temuan. Mantap!" })); return; }
  list.replaceChildren(...rows.map((r) => {
    if (r.kind === "fx") {
      const label = r.level === 0 ? "Kembali tenang" : `Efek ketenangan level ${r.level}`;
      return el("li", {}, el("button", { type: "button", tabindex: "-1" },
        el("span", { class: "ev-time", text: A.formatClock(r.t) }),
        el("span", { class: "dot", style: `--dc: ${r.level === 0 ? "var(--green)" : "var(--teal)"}` }),
        el("span", { class: "ev-effect", text: label }), el("span")));
    }
    return el("li", {}, el("button", { type: "button", "data-b": r.ids[0] },
      el("span", { class: "ev-time", text: A.formatClock(r.t) }),
      el("span", { class: "dot", style: `--dc: var(--c-${r.category})` }),
      el("span", { text: `${C.labels[r.type]}${r.count > 1 ? ` ×${r.count}` : ""}` }),
      el("span", { class: "ev-q", text: `(P${r.q})` })));
  }));
}

function renderReview() {
  const box = $("#review-card");
  const list = sortedVisible();
  if (!list.length) { box.replaceChildren(el("p", { class: "empty", text: "Belum ada temuan untuk direview." })); return; }
  let pos = list.findIndex((b) => b.id === X.selected);
  if (pos < 0) { pos = 0; X.selected = list[0].id; }
  const b = list[pos];
  const entry = X.entries[b.entry];
  const quote = entry.words.slice(b.start, b.end + 1).map((w) => w.text).join(" ");
  const showBest = X.bestShown === b.id;
  box.replaceChildren(el("div", { class: "review" },
    el("div", { class: "review-head" },
      el("span", { class: "review-title" }, el("span", { class: "dot", style: `--dc: ${SEVERITY_COLOR[b.severity]}` }), b.label),
      el("span", { class: "impact", text: `-${b.weight * C.score.liveMultiplier} poin` })),
    el("p", { class: "muted small", text: `${A.formatClock(b.t)} di pertanyaan ${b.q}, ${C.categoryLabels[b.category]}` }),
    quote ? el("p", { class: "quote" }, el("s", { text: quote })) : null,
    el("p", { text: b.what }),
    showBest ? el("div", { class: "best", text: b.suggestion || "Belum ada contoh untuk temuan ini." }) : null,
    el("div", { class: "review-actions" },
      el("button", { type: "button", class: "btn", "data-rev": "prev", disabled: pos === 0, text: "Sebelumnya" }),
      el("button", { type: "button", class: "btn btn-blue", "data-rev": "best", text: "Contoh" }),
      el("button", { type: "button", class: "btn btn-primary", "data-rev": "next", disabled: pos === list.length - 1, text: "Berikutnya" })),
    el("p", { class: "review-pos", text: `${pos + 1} dari ${list.length} temuan` })));
}

function onReviewClick(e) {
  const btn = e.target.closest("[data-rev]");
  if (!btn) return;
  const list = sortedVisible();
  const pos = list.findIndex((b) => b.id === X.selected);
  if (btn.dataset.rev === "best") { X.bestShown = X.bestShown === X.selected ? null : X.selected; renderReview(); return; }
  const next = list[pos + (btn.dataset.rev === "next" ? 1 : -1)];
  if (next) selectBlunder(next.id);
}

function renderDetails() {
  const answers = X.entries.filter((e) => e.kind === "a" && !e.skipped);
  const stats = A.tiles(answers, X.blunders);
  const scores = A.categoryScores(X.blunders, stats.msSpoken);
  const counts = Object.fromEntries(C.categories.map((c) => [c, X.blunders.filter((b) => b.category === c).length]));
  $("#details").replaceChildren(
    ...C.categories.map((c) => el("div", { class: "detail-row" },
      el("div", { class: "req-head" },
        el("span", {}, el("span", { class: "dot", style: `--dc: var(--c-${c})` }), ` ${C.categoryLabels[c]}`),
        el("span", { text: `${scores[c]} / 100` })),
      el("div", { class: "meter" }, el("span", { class: meterClass(scores[c]), style: `transform: scaleX(${scores[c] / 100})` })),
      el("p", { class: "muted small", text: `${counts[c]} temuan` }))),
    el("div", { class: "formula" },
      el("p", { text: "Skor langsung = 100 - (jumlah bobot x peluruhan) x 4, waktu paruh 60 detik." }),
      el("p", { text: `Skor akhir = 100 - (total bobot / menit bicara) x ${C.score.finalMultiplier}.` }),
      el("p", { text: "Bobot: pengisi 1, jeda 2, ulang 1, cepat 2, ragu 1, berputar 2, belum menjawab 3, tanpa bukti 2, beda dengan CV 3." }),
      el("p", { class: "muted", text: S.replay ? "Mode demo: sesi rekaman, tanpa panggilan AI." : `Pemakaian AI sesi ini (termasuk analisis CV): ${X.usage.calls} panggilan, ${X.usage.input_tokens.toLocaleString("id-ID")} token masuk, ${X.usage.output_tokens.toLocaleString("id-ID")} token keluar.` })));
}

function scrollToBlunder(id) {
  const span = document.querySelector(`#transcript [data-b="${id}"]`);
  if (span) span.scrollIntoView({ block: "center", behavior: reduceMotion.matches ? "auto" : "smooth" });
}

function selectBlunder(id, { switchTab = false } = {}) {
  X.selected = id;
  X.bestShown = null;
  if (switchTab && X.rightTab !== "review") setRightTab("review");
  renderTranscript();
  renderRight();
  scrollToBlunder(id);
}

// ============================================================================ event
function bind() {
  $("#setup-primary").addEventListener("click", onPrimary);
  $("#setup-back").addEventListener("click", () => {
    if (S.demoIntro) { S.demoIntro(false); showStep("cv"); return; }
    const i = STEPS.indexOf(S.step);
    if (i > 0) showStep(STEPS[S.step === "settings" && !S.analysis ? 1 : i - 1]);
  });
  $$("[data-sample]").forEach((b) => b.addEventListener("click", () => loadSample(b.dataset.sample)));
  $("#btn-replay").addEventListener("click", startReplay);
  $("#cv-paste-toggle").addEventListener("click", () => { $("#cv-text").hidden = false; $("#cv-text").focus(); });
  $("#cv-file").addEventListener("change", () => setCvFile($("#cv-file").files[0]));
  const drop = $("#cv-drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") { $("#cv-file").files = e.dataTransfer.files; setCvFile(file); }
    else setError("File harus berformat PDF.");
  });
  $("#job-file").addEventListener("change", () => {
    const f = $("#job-file").files[0];
    $("#job-file-name").textContent = f ? f.name : "";
    if (f) $("#job-text").value = "";
    updatePrimary();
  });
  ["#cv-text", "#job-text"].forEach((s) => $(s).addEventListener("input", updatePrimary));
  $("#btn-mic-test").addEventListener("click", micTest);
  $("#access-code").addEventListener("input", (e) => {
    S.code = e.target.value.trim();
    try { localStorage.setItem("ngblu_code", S.code); } catch (_) { /* abaikan */ }
  });

  $("#btn-mic").addEventListener("click", onMic);
  $("#btn-repeat").addEventListener("click", repeatQuestion);
  $("#btn-skip").addEventListener("click", skipQuestion);
  $("#banner-btn").addEventListener("click", bannerContinue);
  $("#type-send").addEventListener("click", sendTyped);
  $("#fx-mode").addEventListener("change", (e) => {
    S.settings.effect = e.target.value;
    document.body.dataset.fxmode = e.target.value;
    effectTick();
  });
  $("#btn-exit").addEventListener("click", () => {
    if (X.phase === "summary") { backToSetup(S.replay ? "cv" : "settings"); return; }
    $("#confirm-exit").hidden = false;
    $("#exit-cancel").focus();
  });
  $("#exit-cancel").addEventListener("click", () => { $("#confirm-exit").hidden = true; });
  $("#exit-summary").addEventListener("click", () => {
    $("#confirm-exit").hidden = true;
    const answered = X.entries.some((e) => e.kind === "a" && e.words && e.words.length);
    if (answered) finishSession();
    else backToSetup(S.replay ? "cv" : "settings");
  });
  $("#sum-review").addEventListener("click", () => {
    closeSummary();
    document.body.dataset.sidetab = "right";
    $$(".side-tabs [data-sidetab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sidetab === "right")));
    setRightTab("review");
    if (X.selected) scrollToBlunder(X.selected);
  });
  $("#sum-again").addEventListener("click", () => { closeSummary(); backToSetup(S.replay ? "cv" : "settings"); });

  $("#transcript").addEventListener("click", (e) => {
    const span = e.target.closest("[data-b]");
    if (span) openCard(Number(span.dataset.b));
  });
  $("#transcript").addEventListener("keydown", (e) => {
    const span = e.target.closest("[data-b]");
    if (span && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openCard(Number(span.dataset.b)); }
  });
  $("#sugg-card").addEventListener("click", onCardClick);
  $("#review-card").addEventListener("click", onReviewClick);
  ["#graph", "#graph-review"].forEach((s) => $(s).addEventListener("click", (e) => {
    const dot = e.target.closest("[data-b]");
    if (dot) selectBlunder(Number(dot.dataset.b), { switchTab: true });
  }));
  $("#events").addEventListener("click", (e) => {
    const row = e.target.closest("[data-b]");
    if (row) selectBlunder(Number(row.dataset.b), { switchTab: true });
  });
  $$(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => setRightTab(b.dataset.tab)));
  $$(".side-tabs [data-sidetab]").forEach((b) => b.addEventListener("click", () => {
    document.body.dataset.sidetab = b.dataset.sidetab;
    $$(".side-tabs [data-sidetab]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderRight();
  }));
  document.addEventListener("keydown", (e) => {
    // Pintasan presenter: Shift+D di layar persiapan langsung memutar demo.
    if (e.key === "D" && e.shiftKey && document.body.dataset.screen === "setup" && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      e.preventDefault();
      startReplay();
      return;
    }
    if (e.key !== "Escape") return;
    if (!$("#sugg-card").hidden) closeCard();
    else if (!$("#confirm-exit").hidden) $("#confirm-exit").hidden = true;
  });
  window.addEventListener("resize", () => { if (document.body.dataset.screen === "interview") renderRight(); });
}

async function init() {
  initCat();
  bind();
  try { S.code = localStorage.getItem("ngblu_code") || ""; } catch (_) { S.code = ""; }
  $("#access-code").value = S.code;
  showStep("cv");
  try {
    S.config = await api("/api/config");
    $("#mock-note").hidden = !S.config.mock;
    $("#code-box").hidden = !S.config.need_code;
    const m = S.config.score && Number(S.config.score.final_multiplier);
    if (m > 0) C.score.finalMultiplier = m; // satu sumber kebenaran: FINAL_MULTIPLIER di server
  } catch (_) { /* tetap jalan; mode demo tidak butuh server */ }
  if (DEMO_URL) startReplay();
}

init();
