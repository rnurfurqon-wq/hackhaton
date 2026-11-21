# Uji login Google (tanpa jaringan, verifikasi Google ditiru). Jalankan dari folder proyek: python tests/test_auth.py
import os, sys, importlib, time
sys.path.insert(0, os.getcwd())
os.environ.update(MOCK_LLM="1", SESSION_COOKIE_SECURE="0")
def load(**env):
    for k in ("GOOGLE_CLIENT_ID","ACCESS_CODE","ALLOWED_EMAIL_DOMAINS"): os.environ.pop(k, None)
    os.environ.update(env)
    import app; importlib.reload(app); return app
turn = {"question": {"question": "Q?"}, "words": ["halo"]}
# 1. login mati: seperti dulu
a = load(); c = a.app.test_client()
assert c.get("/api/config").json["google_client_id"] is None
assert c.post("/api/turn", json=turn).status_code == 200
assert c.post("/api/auth/google", json={"credential": "x"}).status_code == 404
# 2. login aktif
a = load(GOOGLE_CLIENT_ID="cid.apps.googleusercontent.com", ACCESS_CODE="kode", ALLOWED_EMAIL_DOMAINS="cakrawala.ac.id")
c = a.app.test_client()
r = c.post("/api/turn", json=turn); assert r.status_code == 401 and r.json["need_login"], r.json
assert c.post("/api/turn", json=turn, headers={"X-Access-Code": "kode"}).status_code == 200  # kode juri tetap jalan
good = {"aud": "cid.apps.googleusercontent.com", "iss": "https://accounts.google.com", "exp": str(int(time.time())+600),
        "email_verified": "true", "email": "rizal@cakrawala.ac.id", "name": "Rizal N", "given_name": "Rizal", "picture": ""}
a.urllib.request.urlopen = None
def fake(info):
    import io, json
    class R(io.BytesIO):
        def __enter__(s): return s
        def __exit__(s,*a): pass
    a.urllib.request.urlopen = lambda url, timeout=10: R(json.dumps(info).encode())
fake({**good, "aud": "lain"}); assert c.post("/api/auth/google", json={"credential": "t"}).status_code == 401
fake({**good, "exp": "1"}); assert c.post("/api/auth/google", json={"credential": "t"}).status_code == 401
fake({**good, "email_verified": "false"}); assert c.post("/api/auth/google", json={"credential": "t"}).status_code == 401
fake({**good, "email": "x@gmail.com"}); assert c.post("/api/auth/google", json={"credential": "t"}).status_code == 403
fake(good); r = c.post("/api/auth/google", json={"credential": "t"}); assert r.status_code == 200 and r.json["user"]["given_name"] == "Rizal"
assert c.get("/api/config").json["user"]["email"] == "rizal@cakrawala.ac.id"
assert c.post("/api/turn", json=turn).status_code == 200
assert c.post("/api/auth/logout").status_code == 200
assert c.post("/api/turn", json=turn).status_code == 401
assert c.get("/demo").status_code == 302 and c.get("/").status_code == 200
print("auth tests OK")
