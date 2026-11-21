"""
app.py - Server Flask untuk web latihan interview AI.

Stateless: semua state sesi disimpan di browser dan dikirim ulang seperlunya,
jadi aman untuk satu worker di PythonAnywhere (akun gratis).

Jalankan lokal tanpa API key (mode tiruan):
    MOCK_LLM=1 python app.py
"""

import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from functools import wraps
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request, session, url_for

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

# ---------------------------------------------------------------------------
# Login Google (opsional). Aktif hanya kalau GOOGLE_CLIENT_ID diisi di .env.
# Kosong = aplikasi berjalan seperti sebelumnya. Mode /demo tidak pernah butuh login.
# ---------------------------------------------------------------------------
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
# Contoh: "cakrawala.ac.id,student.cakrawala.ac.id". Kosong = semua akun Google boleh.
ALLOWED_EMAIL_DOMAINS = {d.strip().lower().lstrip("@") for d in os.getenv("ALLOWED_EMAIL_DOMAINS", "").split(",") if d.strip()}
GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v3/tokeninfo"
GOOGLE_ISSUERS = ("accounts.google.com", "https://accounts.google.com")

app.secret_key = os.getenv("SECRET_KEY", "").strip() or secrets.token_hex(32)  # tanpa SECRET_KEY, login hilang saat Reload
app.config.update(SESSION_COOKIE_SAMESITE="Lax", SESSION_COOKIE_HTTPONLY=True,
                  SESSION_COOKIE_SECURE=os.getenv("SESSION_COOKIE_SECURE", "1") == "1",
                  PERMANENT_SESSION_LIFETIME=7 * 24 * 3600)
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
def current_user() -> dict | None:
    user = session.get("user")
    return user if GOOGLE_CLIENT_ID and isinstance(user, dict) else None


def require_access(fn):
    """Akses API AI: lolos kalau sudah login Google ATAU kode akses benar (yang mana pun yang aktif)."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if current_user():
            return fn(*args, **kwargs)
        code_ok = bool(ACCESS_CODE) and request.headers.get("X-Access-Code", "") == ACCESS_CODE
        if GOOGLE_CLIENT_ID and not code_ok:
            return jsonify({"error": "Masuk dengan akun Google dulu untuk memakai AI.", "need_login": True}), 401
        if ACCESS_CODE and not code_ok and not GOOGLE_CLIENT_ID:
            return jsonify({"error": "Kode akses salah atau belum diisi.", "need_code": True}), 401
        return fn(*args, **kwargs)
    return wrapper


def verify_google_token(credential: str) -> dict:
    """Verifikasi ID token Google lewat endpoint tokeninfo resmi (tanpa library tambahan).
    Melempar ValueError dengan pesan ramah kalau token tidak sah."""
    url = GOOGLE_TOKENINFO_URL + "?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError:
        raise ValueError("Token Google tidak sah atau sudah kedaluwarsa. Coba masuk lagi.")
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("Token Google bukan untuk aplikasi ini.")
    if info.get("iss") not in GOOGLE_ISSUERS:
        raise ValueError("Penerbit token tidak dikenal.")
    if int(info.get("exp", 0)) < time.time():
        raise ValueError("Sesi Google sudah kedaluwarsa. Coba masuk lagi.")
    if str(info.get("email_verified")).lower() != "true":
        raise ValueError("Email Google belum terverifikasi.")
    return info


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
        "need_code": bool(ACCESS_CODE) and not GOOGLE_CLIENT_ID,
        "google_client_id": GOOGLE_CLIENT_ID or None,
        "user": current_user(),
        "mock": is_mock(),
        "models": {"main": MODEL_MAIN, "fast": MODEL_FAST},
        "demo": {"slots": DEMO_CONFIG["slots"], "max_followups": DEMO_CONFIG["max_followups"]},
        "score": {"final_multiplier": FINAL_MULTIPLIER},
        "app_name": APP_NAME,
    })


@app.post("/api/auth/google")
def auth_google():
    if not GOOGLE_CLIENT_ID:
        return error("Login Google belum diaktifkan.", 404)
    body = request.get_json(silent=True) or {}
    credential = body.get("credential") if isinstance(body, dict) else None
    if not isinstance(credential, str) or not credential or len(credential) > 4096:
        return error("Data login tidak valid.")
    try:
        info = verify_google_token(credential)
    except ValueError as exc:
        return error(str(exc), 401)
    except Exception:
        app.logger.exception("verifikasi Google gagal")
        return error("Tidak bisa menghubungi Google untuk verifikasi. Coba lagi sebentar.", 502)
    email = str(info.get("email", "")).lower()
    if ALLOWED_EMAIL_DOMAINS and email.rsplit("@", 1)[-1] not in ALLOWED_EMAIL_DOMAINS:
        return error("Akun ini tidak diizinkan. Gunakan email kampus.", 403)
    session.clear()
    session.permanent = True
    session["user"] = {"name": str(info.get("name") or email.split("@")[0])[:80],
                       "given_name": str(info.get("given_name") or "")[:40],
                       "email": email[:120], "picture": str(info.get("picture") or "")[:300]}
    return jsonify({"user": session["user"]})


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify({"ok": True})


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
