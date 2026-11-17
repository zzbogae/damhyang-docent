# 11/28 전시 맥 전용: 나의 공간 섬 그림 생성(/api/space/image)만 띄우는 작은 서버.
# - hf-space/space_image.py 를 그대로 쓴다(상한·20초 타임아웃·사전 단어 필터·기록 안 함 동일).
# - 시연판(vite preview 4173)이 SPACE_API_URL=http://127.0.0.1:8791 로 이 서버에 넘긴다.
# - 키는 환경변수 OPENROUTER_API_KEY 에만 있다(start_1128.sh 가 ~/Downloads/mined-secrets/.env 에서 읽음).
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "hf-space"))
from fastapi import FastAPI  # noqa: E402
from space_image import router, MODEL, TIMEOUT, PER_MIN, PER_DAY  # noqa: E402

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(router)


@app.get("/api/space/health")
def health():
    # 키 값은 내보내지 않고 있는지만 알려 준다
    return {"ok": True, "key": bool(os.environ.get("OPENROUTER_API_KEY")), "model": MODEL,
            "timeout": TIMEOUT, "per_min": PER_MIN, "per_day": PER_DAY}
