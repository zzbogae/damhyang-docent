# 서버 쪽 단어 필터. 화면 테스트(webapp/web/tests/spaceWords.test.ts)와 같은 예시 파일을 쓴다. 예시는 모두 지어낸 값이다.
import json, sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "hf-space"))
from space_words import KEYWORDS, MAX_WORDS, filter_words, match_word  # noqa: E402

CASES = json.loads((ROOT / "webapp/web/src/space/wordFilter.cases.json").read_text(encoding="utf-8"))


def test_dictionary_active_only():
    assert len(KEYWORDS) == 124
    assert len({k["id"] for k in KEYWORDS}) == 124


@pytest.mark.parametrize("raw,word", CASES["match"])
def test_match(raw, word):
    assert match_word(raw)["word"] == word


@pytest.mark.parametrize("raw", CASES["drop"])
def test_drop(raw):
    assert match_word(raw) is None


def test_list():
    kept = filter_words(CASES["list"]["in"])
    assert [k["word"] for k in kept] == CASES["list"]["kept"]
    assert len(kept) <= MAX_WORDS


def test_bad_input():
    assert filter_words("바다") == []
    assert filter_words([1, None, {"a": 1}, "바다"]) == [match_word("바다")]
