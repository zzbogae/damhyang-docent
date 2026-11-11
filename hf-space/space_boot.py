# Space 전용 시동: 원본(app.py·app_mined.py·app_exhibit.py·lifebot/*)은 고치지 않는다.
# 허깅페이스 무료 CPU에는 Ollama가 없으므로, 기억 검색 임베딩만 sentence-transformers BAAI/bge-m3(CPU)로 바꿔 끼운다.
# (같은 bge-m3라 data_demo/chroma 인덱스를 그대로 쓴다.) 답 생성은 OpenRouter(전시 모드)가 맡는다.
import os, runpy, sys

os.environ.setdefault("LIFEBOT_DATA_DIR", "data_demo")
os.environ.setdefault("LIFEBOT_BACKEND", "openrouter")
os.environ.setdefault("LIFEBOT_OR_FALLBACK", "none")

if os.environ.get("LIFEBOT_DATA_DIR") != "data_demo":
    sys.exit("Space는 합성 인물 data_demo로만 실행합니다")

from sentence_transformers import SentenceTransformer  # noqa: E402

_model = SentenceTransformer(os.environ.get("LIFEBOT_EMBED_MODEL", "BAAI/bge-m3"), device="cpu")


def embed(texts, *args, **kwargs):
    single = isinstance(texts, str)
    vecs = _model.encode([texts] if single else list(texts), normalize_embeddings=True).tolist()
    return vecs[0] if single else vecs


import lifebot.index as _index  # noqa: E402

_index.embed = embed
runpy.run_path("app_exhibit.py", run_name="__main__")
