# Mine D 공개 시연판 + 민디 챗봇 중계 (허깅페이스 Space 전용)
# - 정적 시연판(VITE_DEMO_SNAPSHOT=1 빌드)을 / 에 서빙
# - /api/lifebot/* 를 같은 컨테이너 안의 전시 모드 챗봇(app_exhibit.py, Gradio 127.0.0.1:7860)으로 넘긴다
#   (webapp/web/src/mindi/lifebot-plugin.ts 와 같은 규칙. 같은 출처라 CORS가 필요 없다)
# - 요청 본문·답은 기록하지 않는다. 합성 인물 「민」 데이터(data_demo)만 쓴다.
# - 공개 주소이므로 IP당 분당 횟수, 하루 전체 횟수, 글자 수에 상한을 둔다(유료 키 보호).
import json, os, time
from collections import defaultdict, deque
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE = os.environ.get("LIFEBOT_URL", "http://127.0.0.1:7860").rstrip("/")
STATIC = Path(os.environ.get("DEMO_DIR", "/app/demo"))
PER_MIN = int(os.environ.get("RATE_PER_MIN", "12"))      # IP 하나당 1분
PER_DAY = int(os.environ.get("RATE_PER_DAY", "4000"))    # 전체 하루 (1턴 약 $0.0015 → 하루 최대 약 $6)
MAX_MSG = 600
MAX_TURNS = 30

ARGS = {
    "chat": ["message", "history", "focus", "style"],
    "greeting": ["style"],
    "island": ["history", "style"],
    "islands_words": [],
    "styles": [],
}
COSTLY = {"chat", "greeting", "island"}

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
client = httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=5.0))
hits: dict[str, deque] = defaultdict(deque)
day = {"date": "", "n": 0}


def limited(ip: str) -> bool:
    now = time.time()
    q = hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    today = time.strftime("%Y-%m-%d")
    if day["date"] != today:
        day.update(date=today, n=0)
    if len(q) >= PER_MIN or day["n"] >= PER_DAY:
        return True
    q.append(now)
    day["n"] += 1
    return False


async def call_gradio(name: str, data: list):
    r = await client.post(f"{BASE}/gradio_api/call/{name}", json={"data": data})
    r.raise_for_status()
    event_id = r.json()["event_id"]
    s = await client.get(f"{BASE}/gradio_api/call/{name}/{event_id}")
    event = ""
    for line in s.text.split("\n"):
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:") and event == "complete":
            return json.loads(line[5:])[0]
        elif line.startswith("data:") and event == "error":
            raise RuntimeError("lifebot_error")
    raise RuntimeError("no_complete")


@app.get("/api/lifebot/health")
async def health():
    try:
        r = await client.get(f"{BASE}/gradio_api/info", timeout=5.0)
        return JSONResponse({"ok": r.is_success}, status_code=200 if r.is_success else 503)
    except Exception:
        return JSONResponse({"ok": False}, status_code=503)


@app.post("/api/lifebot/{name}")
async def relay(name: str, request: Request):
    if name not in ARGS:
        return JSONResponse({"error": "unknown"}, status_code=404)
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    if name in COSTLY and limited(ip):
        return JSONResponse({"error": "busy"}, status_code=429)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    if isinstance(body.get("message"), str):
        body["message"] = body["message"][:MAX_MSG]
    if isinstance(body.get("history"), list):
        body["history"] = [
            {"role": t.get("role"), "content": str(t.get("content", ""))[:MAX_MSG * 2]}
            for t in body["history"][-MAX_TURNS:] if isinstance(t, dict)
        ]
    try:
        out = await call_gradio(name, [body.get(k) for k in ARGS[name]])
        return {"data": out}
    except Exception:
        return JSONResponse({"error": "lifebot_failed"}, status_code=502)


@app.get("/api/lifebot/{rest:path}")
async def nope(rest: str):
    return JSONResponse({"error": "unknown"}, status_code=404)


# 시연판: 없는 경로는 index.html (해시 라우팅이어도 안전)
app.mount("/", StaticFiles(directory=STATIC, html=True), name="demo")
