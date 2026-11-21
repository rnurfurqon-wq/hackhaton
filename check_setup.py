"""
check_setup.py - Cek kesiapan sebelum membuka aplikasi web.
Jalankan dari folder proyek:  python check_setup.py
"""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import os  # noqa: E402

from llm_client import MODEL_FAST, MODEL_MAIN, LLM, is_mock  # noqa: E402

print("1. File .env terbaca     :", "ya" if os.getenv("ANTHROPIC_API_KEY") else "TIDAK (ANTHROPIC_API_KEY kosong)")
print("2. Mode tiruan           :", "AKTIF (API tidak dipanggil)" if is_mock() else "mati")
print("3. Kode akses            :", "aktif" if os.getenv("ACCESS_CODE") else "tidak dipakai")

if not is_mock():
    for tier, model in (("main", MODEL_MAIN), ("fast", MODEL_FAST)):
        llm = LLM()
        try:
            out = llm.call("Jawab hanya dengan kata: siap", "Tes", tier=tier, max_tokens=10)
            print(f"4. Model {tier:<4} {model:<22}: OK, jawaban '{out.strip()}', {llm.usage['input_tokens']} token masuk")
        except Exception as exc:
            print(f"4. Model {tier:<4} {model:<22}: GAGAL -> {type(exc).__name__}: {exc}")
