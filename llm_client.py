"""
llm_client.py
Satu pintu untuk semua panggilan ke Claude API.

- Dua tingkat model: "main" (analisis & laporan) dan "fast" (keputusan per jawaban).
- Setiap panggilan mencatat pemakaian token, supaya bisa ditampilkan di laporan
  (poin rubrik: efektivitas pemanfaatan token).
- MOCK_LLM=1 -> tidak memanggil API sama sekali, mengembalikan jawaban tiruan.
  Berguna untuk menguji tampilan dan alur tanpa API key dan tanpa biaya.
"""

import json
import logging
import os
import re

log = logging.getLogger("ruang_interview")

MODEL_MAIN = os.getenv("CLAUDE_MODEL_MAIN", "claude-sonnet-5-5")
MODEL_FAST = os.getenv("CLAUDE_MODEL_FAST", "claude-haiku-5-5")


def is_mock() -> bool:
    return os.getenv("MOCK_LLM", "0") == "1"


class LLM:
    """Dibuat baru untuk setiap request HTTP, jadi catatan token-nya per request."""

    _client = None  # klien Anthropic dipakai bersama antar request

    def __init__(self):
        self.usage = {"input_tokens": 0, "output_tokens": 0, "calls": 0}

    @classmethod
    def _get_client(cls):
        if cls._client is None:
            import anthropic
            key = os.getenv("ANTHROPIC_API_KEY")
            if not key:
                raise RuntimeError("ANTHROPIC_API_KEY belum diisi di file .env")
            cls._client = anthropic.Anthropic(api_key=key, timeout=60.0, max_retries=2)
        return cls._client

    # Skema yang pernah ditolak API (dicatat per skema), agar tidak dicoba berulang.
    _rejected_schemas: set = set()

    def call(self, system: str, user: str, tier: str = "main", max_tokens: int = 1500,
             schema: dict | None = None) -> str:
        self.usage["calls"] += 1
        if is_mock():
            text = _mock_response(system, user)
            self.usage["input_tokens"] += (len(system) + len(user)) // 4
            self.usage["output_tokens"] += len(text) // 4
            return text

        import anthropic
        kwargs = {
            "model": MODEL_FAST if tier == "fast" else MODEL_MAIN,
            "max_tokens": max_tokens,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        # Structured outputs: memaksa Claude mengembalikan JSON valid sesuai skema.
        if schema is not None and id(schema) not in LLM._rejected_schemas:
            kwargs["output_config"] = {"format": {"type": "json_schema", "schema": schema}}

        client = self._get_client()
        try:
            resp = client.messages.create(**kwargs)
        except anthropic.BadRequestError as exc:
            if "output_config" not in kwargs:
                raise
            # Skema ditolak (misalnya model belum mendukung): ulangi tanpa skema.
            log.warning("Structured output ditolak, lanjut tanpa skema: %s", exc)
            LLM._rejected_schemas.add(id(schema))
            kwargs.pop("output_config")
            resp = client.messages.create(**kwargs)

        self.usage["input_tokens"] += resp.usage.input_tokens
        self.usage["output_tokens"] += resp.usage.output_tokens
        if resp.stop_reason == "max_tokens":
            log.warning("Jawaban AI terpotong di max_tokens=%s (model %s)", max_tokens, kwargs["model"])
        return "".join(block.text for block in resp.content if block.type == "text")

    def call_json(self, system: str, user: str, tier: str = "main", max_tokens: int = 1500,
                  schema: dict | None = None) -> dict:
        """Panggil AI dan kembalikan dict. Jika JSON rusak, coba sekali lagi dengan batas lebih besar."""
        text = self.call(system, user, tier, max_tokens, schema)
        try:
            return parse_json(text)
        except (ValueError, json.JSONDecodeError) as exc:
            log.warning("JSON AI tidak valid (%s). Awal jawaban: %r", exc, text[:300])
            retry_user = user + "\n\nPENTING: keluarkan HANYA satu objek JSON yang valid dan lengkap."
            text = self.call(system, retry_user, tier, max_tokens * 2, schema)
            return parse_json(text)

    def as_planner_fn(self):
        """Bentuk call_llm(system, user) yang dipakai question_planner.py."""
        from question_planner import PLAN_SCHEMA
        return lambda system, user: self.call(system, user, tier="main", max_tokens=2000, schema=PLAN_SCHEMA)


def parse_json(text: str) -> dict:
    """Ambil objek JSON dari jawaban model, walau dibungkus ``` atau ada teks lain."""
    clean = re.sub(r"```(?:json)?", "", text).strip()
    start, end = clean.find("{"), clean.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Jawaban AI tidak berisi JSON")
    return json.loads(clean[start:end + 1])


# ---------------------------------------------------------------------------
# Jawaban tiruan untuk MOCK_LLM=1. Setiap prompt diberi penanda [[TASK:...]].
# ---------------------------------------------------------------------------
def _mock_response(system: str, user: str) -> str:
    if "[[TASK:analyze]]" in system:
        mismatch = "Golang" in user or "Backend" in user
        reqs = (
            [
                {"item": "Golang", "type": "wajib", "status": "tidak ada", "evidence": None},
                {"item": "Pengalaman backend 3 tahun", "type": "wajib", "status": "tidak ada", "evidence": None},
                {"item": "Desain REST API", "type": "wajib", "status": "tidak ada", "evidence": None},
                {"item": "SQL", "type": "nilai plus", "status": "terpenuhi",
                 "evidence": "Menyusun query SQL untuk rekap keuangan himpunan"},
            ]
            if mismatch else
            [
                {"item": "SQL", "type": "wajib", "status": "terpenuhi",
                 "evidence": "Menyusun query SQL untuk rekap keuangan himpunan"},
                {"item": "Python", "type": "wajib", "status": "terpenuhi",
                 "evidence": "Membuat skrip Python untuk membersihkan data survei"},
                {"item": "Tableau atau Looker Studio", "type": "wajib", "status": "tidak ada", "evidence": None},
                {"item": "Statistik dasar", "type": "nilai plus", "status": "sebagian",
                 "evidence": "Mahasiswa Data Science semester 1"},
                {"item": "Komunikasi hasil analisis", "type": "wajib", "status": "terpenuhi",
                 "evidence": "Mempresentasikan laporan keuangan di rapat pleno himpunan"},
            ]
        )
        return json.dumps({
            "valid": {"is_cv": True, "is_job_posting": True, "job_info_sufficient": True, "reason": ""},
            "role": "Backend Engineer (Golang)" if mismatch else "Data Analyst Intern",
            "language": {"cv": "id", "job": "id"},
            "candidate": {
                "ringkasan": "Mahasiswa Data Science semester 1 dengan pengalaman mengolah data organisasi.",
                "pendidikan": "S1 Data Science, Universitas Cakrawala",
                "pengalaman": ["Bendahara himpunan", "Proyek dashboard keuangan himpunan"],
                "skill": ["SQL", "Python", "Excel"],
                "riwayat": [
                    {"peran": "Bendahara", "organisasi": "Himpunan Mahasiswa Data Science", "periode": "2026 - sekarang"},
                    {"peran": "Staf Acara", "organisasi": "Cross The World Gathering", "periode": "2026"},
                ],
            },
            "level": {"lowongan": "menengah" if mismatch else "magang", "kandidat": "mahasiswa",
                      "sesuai": not mismatch},
            "requirements": reqs,
        })

    if "[[TASK:plan]]" in system:
        # Pertanyaan tiruan memakai template cadangan yang sama dengan produksi, supaya
        # demo dengan MOCK_LLM=1 tetap terdengar wajar (bukan "[Tiruan] ...").
        from question_planner import fallback_question
        rencana = re.search(r"<rencana>\s*(\[.*?\])\s*</rencana>", user, re.S)
        role = re.search(r'"role": "([^"]*)"', user)
        items = json.loads(rencana.group(1)) if rencana else []
        return json.dumps({"questions": [
            {"no": it["no"], "slot": it["slot"],
             "question": fallback_question(it, role.group(1) if role else ""),
             "purpose": it["tujuan"][:60]}
            for it in items
        ]})

    if "[[TASK:turn]]" in system:
        followups_used = int(re.search(r"followups_used:\s*(\d+)", user).group(1))
        words = re.findall(r"\[(\d+)\](\S+)", re.search(r"<jawaban>(.*?)</jawaban>", user, re.S).group(1))
        tokens = [w.lower().strip(".,") for _, w in words]
        flags = []
        if "2024" in tokens:
            i = tokens.index("2024")
            flags.append({"category": "Consistency", "type": "cv_contradiction", "severity": 3,
                          "start_word": max(0, i - 2), "end_word": i,
                          "explanation": "Kamu menyebut tahun 2024, padahal CV menulis 2026 sampai sekarang.",
                          "suggestion": "Sebut periode sesuai CV: sejak 2026 saya menjadi bendahara."})
        if "banyak" in tokens:
            i = tokens.index("banyak")
            flags.append({"category": "Evidence", "type": "vague_claim", "severity": 2,
                          "start_word": i, "end_word": min(len(tokens) - 1, i + 2),
                          "explanation": "Klaim ini belum didukung contoh atau angka.",
                          "suggestion": "Tambahkan satu contoh nyata dan hasilnya dalam angka."})
        short = len(tokens) < 25
        score = 45 if short else (62 if flags else 84)
        return json.dumps({
            "flags": flags, "answer_score": score,
            "strength": "Kamu menyebut hasil yang terukur." if not short else "Kamu langsung menjawab inti pertanyaan.",
            "next_time": ["Buka dengan kalimat inti, baru beri contoh", "Sebut satu angka hasil"],
            "decision": "follow_up" if short and followups_used == 0 else "next",
            "follow_up_question": "Bisa beri satu contoh konkret beserta hasilnya?" if short and followups_used == 0 else "",
            "note": "Jawaban singkat." if short else "Jawaban cukup jelas.",
        })

    if "[[TASK:report]]" in system:
        return json.dumps({
            "top_weaknesses": [
                {"category": "Fluency", "evidence": "Beberapa kata pengisi muncul di awal jawaban.",
                 "tip": "Diam satu detik sebelum mulai, lalu buka dengan kalimat inti."},
                {"category": "Consistency", "evidence": "Tahun menjabat berbeda dengan yang tertulis di CV.",
                 "tip": "Hafalkan periode setiap peran di CV sebelum interview."},
                {"category": "Composure", "evidence": "Ada jeda panjang dan kata ragu berturut-turut.",
                 "tip": "Ganti 'mungkin' dengan 'saya akan' saat menjelaskan rencana."},
            ],
            "strength": "Jawaban kedua konkret: ada rencana waktu, alat, dan proyek latihan.",
            "recommendations": ["Latih pembuka 2 kalimat untuk tiap pengalaman di CV",
                                "Siapkan satu angka hasil untuk setiap cerita",
                                "Rekam satu sesi lagi dengan mode efek Penuh"],
        })

    return "{}"
