# 나의 공간 이미지 생성(11/12 멘토진): 섬 키워드 사전에 있는 단어만 프롬프트에 넣는다(서버 쪽 두 번째 거름).
# 화면(webapp/web/src/space/wordFilter.ts)과 같은 사전 파일·같은 규칙이다. 규칙을 바꾸면 두 곳을 같이 고친다.
# 사전에 없는 단어(이름·실제 장소·감정어 등)는 버리고, 버린 단어는 기록하지 않는다.
import json, os, unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
_DEFAULT = HERE / "islandKeywords.json"
if not _DEFAULT.exists():  # 저장소 안에서 돌릴 때(로컬 시험·테스트)
    _DEFAULT = HERE.parent / "webapp" / "web" / "src" / "space" / "islandKeywords.json"
DICT_PATH = Path(os.environ.get("SPACE_WORDS", _DEFAULT))

MAX_WORDS = 5
MAX_LEN = 24
PARTICLES = ["에서는", "에서", "으로", "에게", "까지", "부터", "처럼", "은", "는", "이", "가", "을", "를", "에", "의", "도", "로", "와", "과", "랑"]

KEYWORDS: list[dict] = json.loads(DICT_PATH.read_text(encoding="utf-8"))["words"]


def norm(s) -> str:
    return " ".join(unicodedata.normalize("NFC", str(s or "")).split()).lower()


INDEX: dict[str, dict] = {}
for e in KEYWORDS:
    if e.get("teen_exclude"):  # 전시 관람객 나이를 모르므로 청소년 제외 단어는 쓰지 않는다
        continue
    for t in [e["word"], *e["syn"]]:
        INDEX[norm(t)] = e
        INDEX[norm(t).replace(" ", "")] = e


def _lookup(t: str):
    k = norm(t)
    if not k:
        return None
    hit = INDEX.get(k) or INDEX.get(k.replace(" ", ""))
    if hit:
        return hit
    for p in PARTICLES:
        if len(k) > len(p) and k.endswith(p) and k[: -len(p)] in INDEX:
            return INDEX[k[: -len(p)]]
    return None


def match_word(raw) -> dict | None:
    """단어 하나 → 사전 항목(없으면 None). 통째로 먼저, 안 되면 띄어쓰기로 나눈 첫 일치"""
    k = norm(raw)
    if not k or len(k) > MAX_LEN:
        return None
    hit = _lookup(k)
    if hit:
        return hit
    return next((h for h in map(_lookup, k.split(" ")) if h), None)


def filter_words(words, max_words: int = MAX_WORDS) -> list[dict]:
    """단어 목록 → 사전 대표어 항목만(중복 없이, 최대 max_words개)"""
    kept: list[dict] = []
    if not isinstance(words, list):
        return kept
    for w in words[:40]:
        if not isinstance(w, str):
            continue
        e = match_word(w)
        if e and all(x["id"] != e["id"] for x in kept) and len(kept) < max_words:
            kept.append(e)
    return kept
