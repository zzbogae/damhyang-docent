# 나의 공간 이미지 생성 중계(11/12 멘토진): POST /api/space/image
# - 브라우저는 선택 여섯 가지와 사전 단어만 보낸다. 프롬프트는 서버가 space_prompt.build_prompt 로 조립하고,
#   관객 원문은 OpenRouter 로 나가지 않는다(단어는 서버에서 사전으로 한 번 더 거른다).
# - 모델이 주는 PNG(1344×768, 약 2MB)는 JPEG 로 바꿔 보낸다(약 0.2MB). 바꾸기에 실패하면 원본을 그대로 보낸다.
# - OpenRouter 키는 서버 환경변수 OPENROUTER_API_KEY(Space Secret)에만 둔다. 화면 코드에는 넣지 않는다.
# - 전체 SPACE_IMAGE_TIMEOUT 초(기본 20)가 넘으면 504 로 끊고, 화면은 예시 영상으로 돌아간다.
# - 유료 호출이라 IP당 1분 횟수와 하루 전체 횟수에 상한을 둔다. 요청 본문·프롬프트·이미지는 기록하지 않는다.
import asyncio, base64, io, json, os, time
from collections import defaultdict, deque

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from space_prompt import build_prompt

OPENROUTER_URL = os.environ.get("OPENROUTER_URL", "https://openrouter.ai/api/v1/chat/completions")
MODEL = os.environ.get("SPACE_IMAGE_MODEL", "google/gemini-2.5-flash-image")
TIMEOUT = float(os.environ.get("SPACE_IMAGE_TIMEOUT", "20"))
PER_MIN = int(os.environ.get("SPACE_IMAGE_PER_MIN", "3"))     # IP 하나당 1분
PER_DAY = int(os.environ.get("SPACE_IMAGE_PER_DAY", "300"))   # 전체 하루 (1장 약 $0.04 → 하루 최대 약 $12)
MAX_BODY = 4000
JPEG_QUALITY = int(os.environ.get("SPACE_IMAGE_JPEG_QUALITY", "85"))

router = APIRouter()
_hits: dict[str, deque] = defaultdict(deque)
_day = {"date": "", "n": 0}
_client: httpx.AsyncClient | None = None


def reset_limits():
    """테스트용: 상한 계수를 비운다"""
    _hits.clear()
    _day.update(date="", n=0)


def _limited(ip: str) -> bool:
    now = time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    today = time.strftime("%Y-%m-%d")
    if _day["date"] != today:
        _day.update(date=today, n=0)
    if len(q) >= PER_MIN or _day["n"] >= PER_DAY:
        return True
    q.append(now)
    _day["n"] += 1
    return False


def to_jpeg(data_url: str) -> str:
    """data:image/...;base64 를 JPEG data URL 로 바꾼다. 실패하면(Pillow 없음·깨진 이미지) 원본을 돌려준다"""
    try:
        from PIL import Image
        head, b64 = data_url.split(",", 1)
        if head.startswith("data:image/jpeg"):
            return data_url
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        if img.mode != "RGB":
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        return data_url


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(TIMEOUT + 5, connect=5.0))
    return _client


async def _generate(prompt: str, key: str) -> dict:
    r = await _http().post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {key}", "X-Title": "Mine D my space"},
        json={
            "model": MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": ["image", "text"],
            "image_config": {"aspect_ratio": "16:9"},
            "usage": {"include": True},
        },
    )
    r.raise_for_status()
    j = r.json()
    msg = (j.get("choices") or [{}])[0].get("message") or {}
    images = msg.get("images") or []
    url = ((images[0] if images else {}).get("image_url") or {}).get("url", "")
    if not url.startswith("data:image/"):
        raise RuntimeError("no_image")
    return {"image": await asyncio.to_thread(to_jpeg, url), "cost": (j.get("usage") or {}).get("cost")}


@router.post("/api/space/image")
async def space_image(request: Request):
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        return JSONResponse({"error": "no_key"}, status_code=503)
    raw = await request.body()
    if len(raw) > MAX_BODY:
        return JSONResponse({"error": "too_large"}, status_code=413)
    try:
        sel = json.loads(raw or b"{}")
    except Exception:
        return JSONResponse({"error": "bad_json"}, status_code=400)
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()
    if _limited(ip):
        return JSONResponse({"error": "busy"}, status_code=429)
    built = build_prompt(sel)
    t0 = time.monotonic()
    try:
        out = await asyncio.wait_for(_generate(built["prompt"], key), timeout=TIMEOUT)
    except asyncio.TimeoutError:
        return JSONResponse({"error": "timeout", "island": built["island"]}, status_code=504)
    except Exception:
        return JSONResponse({"error": "image_failed", "island": built["island"]}, status_code=502)
    return {
        "image": out["image"],
        "island": built["island"],
        "used": built["used"],
        "ms": int((time.monotonic() - t0) * 1000),
        "cost": out["cost"],
    }
