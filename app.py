"""
app.py - Server Flask untuk web latihan interview AI.

Stateless: semua state sesi disimpan di browser dan dikirim ulang seperlunya,
jadi aman untuk satu worker di PythonAnywhere (akun gratis).

Jalankan lokal tanpa API key (mode tiruan):
    MOCK_LLM=1 python app.py
"""

import os
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, url_for

BASE_DIR = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

from interview_engine import FINAL_MULTIPLIER, build_summary, evaluate_turn  # noqa: E402
from llm_client import MODEL_FAST, MODEL_MAIN, LLM, is_mock  # noqa: E402
from match_analyzer import analyze, pdf_to_text  # noqa: E402
from question_planner import DEMO_CONFIG, plan_questions  # noqa: E402
from samples import SAMPLE_CV, SAMPLE_JOBS  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB per upload

ACCESS_CODE = os.getenv("ACCESS_CODE", "").strip()
SELECTION_TYPES = ("kerja", "kepanitiaan", "beasiswa")

# ---------------------------------------------------------------------------
# Identitas aplikasi. Untuk mengganti logo cukup taruh file di static/img/
# dengan nama logo.png (atau logo.svg / logo.webp / logo.jpg). Urutan di bawah
# menentukan mana yang dipakai kalau ada lebih dari satu. Tanpa file itu,
# dipakai logo sementara static/img/logo-placeholder.svg.
# ---------------------------------------------------------------------------
APP_NAME = os.getenv("APP_NAME", "NgBlu").strip() or "NgBlu"
APP_TAGLINE = "Latihan interview bareng Pak Kumis"
# Portal karier kampus (CDC). Hanya ditautkan, tidak di-scrape dan tidak login atas nama pengguna.
CDC_URL = os.getenv("CDC_URL", "https://cdc.cakrawala.ac.id/login").strip()
CDC_NAME = os.getenv("CDC_NAME", "CDC Cakrawala").strip()
LOGO_CANDIDATES = ("img/logo.png", "img/logo.svg", "img/logo.webp", "img/logo.jpg")


def logo_path() -> str:
    static_dir = Path(app.static_folder)
    for rel in LOGO_CANDIDATES:
        if (static_dir / rel).is_file():
            return rel
    return "img/logo-placeholder.svg"


@app.context_processor
def inject_brand():
    rel = logo_path()
    version = int((Path(app.static_folder) / rel).stat().st_mtime)  # cache-buster saat logo diganti
    fav = "img/favicon.png" if (Path(app.static_folder) / "img/favicon.png").is_file() else rel
    return {"brand": {"name": APP_NAME, "tagline": APP_TAGLINE, "logo": rel, "logo_v": version, "favicon": fav},
            "cdc": {"url": CDC_URL, "name": CDC_NAME}}


def to_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


# ---------------------------------------------------------------------------
# Pengaman: kode akses opsional, supaya link publik tidak menghabiskan saldo API
# ---------------------------------------------------------------------------
def require_access(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if ACCESS_CODE and request.headers.get("X-Access-Code", "") != ACCESS_CODE:
            return jsonify({"error": "Kode akses salah atau belum diisi.", "need_code": True}), 401
        return fn(*args, **kwargs)
    return wrapper


def error(message: str, status: int = 400):
    return jsonify({"error": message}), status


def read_document(file_field: str, text_field: str) -> str:
    """Ambil isi dokumen dari upload PDF atau dari teks yang ditempel."""
    f = request.files.get(file_field)
    if f and f.filename:
        if not f.filename.lower().endswith(".pdf"):
            raise ValueError("File harus berformat PDF.")
        return pdf_to_text(f.read())
    return request.form.get(text_field, "")


# ---------------------------------------------------------------------------
# Halaman dan info
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return render_template("index.html")


@app.get("/demo")
def demo():
    """Pintasan mode presentasi: /demo sama dengan /?demo=1 (parameter lain ikut diteruskan)."""
    args = {k: v for k, v in request.args.items() if k in ("voice", "fx", "auto")}
    return redirect(url_for("index", demo=1, **args))


@app.get("/api/config")
def config():
    return jsonify({
        "need_code": bool(ACCESS_CODE),
        "mock": is_mock(),
        "models": {"main": MODEL_MAIN, "fast": MODEL_FAST},
        "demo": {"slots": DEMO_CONFIG["slots"], "max_followups": DEMO_CONFIG["max_followups"]},
        "score": {"final_multiplier": FINAL_MULTIPLIER},
        "app_name": APP_NAME,
    })


@app.get("/api/samples")
def samples():
    return jsonify({"cv": SAMPLE_CV, "jobs": SAMPLE_JOBS})


# ---------------------------------------------------------------------------
# Tahap 1: analisis kecocokan
# ---------------------------------------------------------------------------
@app.post("/api/analyze")
@require_access
def api_analyze():
    selection_type = request.form.get("selection_type", "kerja")
    company = request.form.get("company", "").strip()[:80]
    if selection_type not in SELECTION_TYPES:
        selection_type = "kerja"
    try:
        cv_text = read_document("cv_file", "cv_text")
        job_text = read_document("job_file", "job_text")
    except Exception as exc:
        return error(f"Dokumen tidak bisa dibaca: {exc}")

    llm = LLM()
    try:
        result = analyze(cv_text, job_text, selection_type, llm, company=company)
    except Exception as exc:
        app.logger.exception("analyze gagal")
        return error(f"Analisis AI gagal. Coba lagi sebentar. ({type(exc).__name__})", 502)
    result["usage"] = llm.usage
    return jsonify(result)


# ---------------------------------------------------------------------------
# Tahap 2: rencana pertanyaan
# ---------------------------------------------------------------------------
@app.post("/api/plan")
@require_access
def api_plan():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error("Format permintaan tidak valid.")
    analysis, settings = body.get("analysis") or {}, body.get("settings") or {}
    if not isinstance(analysis, dict) or not isinstance(settings, dict):
        return error("Format permintaan tidak valid.")
    if not analysis.get("requirements") and analysis.get("gate", {}).get("status") == "stop":
        return error("Analisis belum lolos. Perbaiki input terlebih dahulu.")

    settings = {
        "mode": "demo" if settings.get("mode") == "demo" else "normal",
        "n_questions": settings.get("n_questions") if settings.get("n_questions") in (5, 7, 10) else 5,
        "selection_type": analysis.get("selection_type", "kerja"),
        "language": settings.get("language") if settings.get("language") in ("id", "en") else "id",
        "company": str(settings.get("company") or analysis.get("company") or "")[:80],
    }
    llm = LLM()
    result = plan_questions(analysis, analysis.get("candidate") or {}, settings, llm.as_planner_fn())
    result["usage"] = llm.usage
    return jsonify(result)


# ---------------------------------------------------------------------------
# Tahap 3: analisis satu jawaban
# ---------------------------------------------------------------------------
@app.post("/api/turn")
@require_access
def api_turn():
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error("Format permintaan tidak valid.")
    question = body.get("question") or {}
    if not isinstance(question, dict):
        return error("Pertanyaan tidak ditemukan.")
    if not question.get("question"):
        return error("Pertanyaan tidak ditemukan.")
    words = body.get("words")
    if not isinstance(words, list):
        return error("Format jawaban tidak valid.")
    llm = LLM()
    result = evaluate_turn(
        question=question,
        words=words,
        candidate=body.get("candidate") or {},
        followups_used=max(0, to_int(body.get("followups_used"), 0)),
        max_followups=max(0, min(to_int(body.get("max_followups"), 1), 2)),
        language=body.get("language") if body.get("language") in ("id", "en") else "id",
        llm=llm,
    )
    result["usage"] = llm.usage
    return jsonify(result)


# ---------------------------------------------------------------------------
# Tahap 4: ringkasan sesi
# ---------------------------------------------------------------------------
@app.post("/api/report")
@require_access
def api_report():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return error("Format permintaan tidak valid.")
    llm = LLM()
    try:
        summary = build_summary(payload, llm)
    except ValueError as exc:
        return error(str(exc))
    except Exception as exc:
        app.logger.exception("summary gagal")
        return error(f"Ringkasan AI gagal dibuat. Coba lagi. ({type(exc).__name__})", 502)
    summary["usage"] = llm.usage
    return jsonify(summary)


@app.errorhandler(413)
def too_large(_):
    return error("File terlalu besar. Maksimal 5 MB.", 413)


if __name__ == "__main__":
    app.run(debug=True, port=int(os.getenv("PORT", 5000)))
