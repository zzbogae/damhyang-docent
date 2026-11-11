# 이미지 생성 중계. OpenRouter 는 httpx MockTransport 로 흉내 낸다(실제 호출·비용 없음).
# 예시 값은 모두 지어낸 값이다(합성 인물 데이터만 쓴다).
import asyncio, importlib, json, sys
from pathlib import Path

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "hf-space"))
import space_image  # noqa: E402

PNG = "data:image/png;base64,iVBORw0KGgo="
SEL = {"time": "해질녘", "weather": ["비"], "place": "바다", "era": "시대 없음", "dwelling": "오두막",
       "music": "sea", "words": ["민준이랑", "부두", "컵"]}


def ok_reply(request: httpx.Request):
    return httpx.Response(200, json={
        "choices": [{"message": {"content": "", "images": [{"type": "image_url", "image_url": {"url": PNG}}]}}],
        "usage": {"cost": 0.039},
    })


@pytest.fixture
def make(monkeypatch):
    def _make(handler, key="sk-test"):
        if key:
            monkeypatch.setenv("OPENROUTER_API_KEY", key)
        else:
            monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
        space_image.reset_limits()
        space_image._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        app = FastAPI()
        app.include_router(space_image.router)
        return TestClient(app)
    yield _make
    space_image._client = None


def test_ok_returns_image_and_island(make):
    seen = {}

    def handler(request):
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return ok_reply(request)

    r = make(handler).post("/api/space/image", json=SEL)
    assert r.status_code == 200
    j = r.json()
    assert j["image"] == PNG and j["island"] == "sea" and j["cost"] == 0.039
    assert j["used"]["words"] == ["부두", "컵"]
    assert seen["auth"] == "Bearer sk-test"
    assert seen["body"]["model"] == space_image.MODEL
    assert seen["body"]["modalities"] == ["image", "text"]
    prompt = seen["body"]["messages"][0]["content"]
    # 사람 이름이 섞인 낱말은 서버에서 다시 걸러 OpenRouter 로 나가지 않는다
    assert "민준" not in prompt and "부두" in prompt


def test_no_key_503(make):
    r = make(ok_reply, key="").post("/api/space/image", json=SEL)
    assert r.status_code == 503 and r.json()["error"] == "no_key"


def test_rate_limit_429(make, monkeypatch):
    monkeypatch.setattr(space_image, "PER_MIN", 2)
    c = make(ok_reply)
    codes = [c.post("/api/space/image", json=SEL).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


def test_day_limit_429(make, monkeypatch):
    monkeypatch.setattr(space_image, "PER_DAY", 1)
    c = make(ok_reply)
    assert c.post("/api/space/image", json=SEL, headers={"x-forwarded-for": "1.1.1.1"}).status_code == 200
    assert c.post("/api/space/image", json=SEL, headers={"x-forwarded-for": "2.2.2.2"}).status_code == 429


def test_timeout_504(make, monkeypatch):
    monkeypatch.setattr(space_image, "TIMEOUT", 0.2)

    async def slow(request):
        await asyncio.sleep(2)
        return ok_reply(request)

    r = make(slow).post("/api/space/image", json=SEL)
    assert r.status_code == 504 and r.json() == {"error": "timeout", "island": "sea"}


@pytest.mark.parametrize("reply", [
    httpx.Response(500, json={"error": "upstream"}),
    httpx.Response(200, json={"choices": [{"message": {"content": "sorry"}}]}),
])
def test_upstream_failure_502(make, reply):
    r = make(lambda request: reply).post("/api/space/image", json=SEL)
    assert r.status_code == 502 and r.json()["error"] == "image_failed"


def test_bad_body(make):
    c = make(ok_reply)
    assert c.post("/api/space/image", content=b"{nope").status_code == 400
    assert c.post("/api/space/image", content=b"x" * 5000).status_code == 413


def test_server_routes_before_static(monkeypatch, tmp_path):
    # 시연판 정적 마운트(/)가 중계 주소를 가리지 않는지 실제 server.py 로 확인
    (tmp_path / "index.html").write_text("demo")
    monkeypatch.setenv("DEMO_DIR", str(tmp_path))
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    server = importlib.import_module("server")
    r = TestClient(server.app).post("/api/space/image", json=SEL)
    assert r.status_code == 503 and r.json()["error"] == "no_key"
