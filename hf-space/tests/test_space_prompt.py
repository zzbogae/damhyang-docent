# 서버 쪽 프롬프트 틀. 예시 값은 모두 지어낸 값이다(합성 인물 데이터만 쓴다).
import re, sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "hf-space"))
from space_prompt import DWELLING, ERA, ISLANDS, PLACE, TIME, WEATHER, build_prompt, pick_island  # noqa: E402

MAKE = (ROOT / "webapp/web/src/ui/IslandMake.tsx").read_text(encoding="utf-8")
TOUR = (ROOT / "webapp/web/src/ui/SpaceTour.tsx").read_text(encoding="utf-8")


def step_options(key: str) -> list[str]:
    line = next(l for l in MAKE.splitlines() if f"key: '{key}'" in l)
    return re.findall(r"'([^']+)'", line.split("options:")[1])


@pytest.mark.parametrize("key,table", [("time", TIME), ("weather", WEATHER), ("place", PLACE), ("era", ERA), ("dwelling", DWELLING)])
def test_allowlist_matches_screen(key, table):
    # 화면 보기를 바꾸면 이 표도 같이 바꿔야 한다
    assert step_options(key) == list(table)


def test_islands_match_tour():
    assert re.findall(r"key: '(\w+)', label", TOUR) == list(ISLANDS)


@pytest.mark.parametrize("sel,island", [
    ({"island": "onsen", "music": "sea"}, "onsen"),
    ({"music": "jungle", "place": "바다"}, "jungle"),
    ({"weather": ["겨울", "눈"], "place": "산"}, "onsen"),
    ({"place": "도시"}, "music"),
    ({"place": "산"}, "sky"),
    ({"island": "moon"}, "sea"),
    ({}, "sea"),
])
def test_pick_island(sel, island):
    assert pick_island(sel) == island


def test_full_selection():
    out = build_prompt({
        "island": "sea", "time": "해질녘", "weather": ["여름", "햇살"], "place": "바다",
        "era": "시대 없음", "dwelling": "오두막", "music": "sea", "words": ["부두", "책", "등대"],
    })
    assert out["island"] == "sea"
    assert out["used"] == {"time": "해질녘", "weather": ["여름", "햇살"], "place": "바다", "era": "시대 없음", "dwelling": "오두막", "words": ["부두", "책", "등대"]}
    p = out["prompt"]
    assert "first-person" in p and "warm golden-orange" in p and "small wooden cabin" in p and "부두" in p
    assert "No text" in p


def test_free_text_goes_through_dictionary():
    # 직접 쓰기: 사전에 있으면 대표어로, 이름·실제 장소는 버린다
    out = build_prompt({"place": "구름 위", "dwelling": "지수네 할머니 집", "time": "오후 3시 반", "words": ["민준이랑", "제주 애월", "창가에"]})
    assert out["used"]["place"] == "하늘"
    assert "dwelling" not in out["used"] and "time" not in out["used"]
    for bad in ("지수", "민준", "애월", "제주", "오후 3시"):
        assert bad not in out["prompt"]


def test_weather_capped_and_bad_types():
    out = build_prompt({"weather": ["비", "눈", "안개"], "time": ["밤", "아침"], "words": "바다", "era": 1970})
    assert out["used"]["weather"] == ["비", "눈"]
    assert out["used"]["time"] == "밤"
    assert out["used"]["words"] == [] and "era" not in out["used"]
    assert build_prompt(None)["island"] == "sea"


def test_words_capped_at_five():
    out = build_prompt({"words": ["바다", "산", "하늘", "정글", "숲", "호수", "강"]})
    assert len(out["used"]["words"]) == 5


def test_style_asks_full_bleed():
    # 「cinematic」·「16:9 composition」이 위아래 검은 띠를 불렀다. 꽉 찬 화면을 명시한다
    prompt = build_prompt({"place": "바다"})["prompt"]
    assert "no black bars" in prompt and "no letterbox" in prompt
    assert "cinematic" not in prompt.lower()
