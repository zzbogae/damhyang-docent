# -*- coding: utf-8 -*-
"""가져오기 규칙(docs/import_rules.md)의 파이썬 판.

web/src/import/rules.ts 와 같은 규칙이어야 한다. 한쪽을 고치면 다른 쪽도 고친다.
"""
from __future__ import annotations

import datetime as dt
import re
import unicodedata

KST = dt.timezone(dt.timedelta(hours=9))
NIGHT_HOURS = (0, 5)  # 현지 00:00~04:59
REPLY_CAP_MIN = 360

# 1인칭: 공백으로 나눈 토큰의 앞뒤에서 글자·숫자가 아닌 문자를 떼어 낸 뒤 이 패턴과 맞으면 1인칭 토큰
FIRST_PERSON_RE = re.compile(r"^(나|내|저|제)(는|도|가|를|랑|한테|에게|만)?$")
# 단정어: 부분 문자열로 찾는다
ASSERTIVE_WORDS = ["반드시", "절대", "무조건", "항상", "전혀", "당연히", "확실히", "분명히", "틀림없이", "결코"]

SLEEP_ASLEEP_VALUES = {
    "HKCategoryValueSleepAnalysisAsleep",
    "HKCategoryValueSleepAnalysisAsleepCore",
    "HKCategoryValueSleepAnalysisAsleepDeep",
    "HKCategoryValueSleepAnalysisAsleepREM",
    "HKCategoryValueSleepAnalysisAsleepUnspecified",
}

SCREENSHOT_NAME_RE = re.compile(r"(screenshot|스크린샷|screen shot)", re.IGNORECASE)


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def chars(s: str) -> int:
    return len(nfc(s))


def is_night(hour: int) -> bool:
    return NIGHT_HOURS[0] <= hour < NIGHT_HOURS[1]


def _strip_token(tok: str) -> str:
    i, j = 0, len(tok)
    while i < j and not tok[i].isalnum():
        i += 1
    while j > i and not tok[j - 1].isalnum():
        j -= 1
    return tok[i:j]


def is_first_person(text: str) -> bool:
    return any(FIRST_PERSON_RE.match(_strip_token(t)) for t in text.split())


def is_assertive(text: str) -> bool:
    return any(w in text for w in ASSERTIVE_WORDS)


def utc_to_local(t: dt.datetime) -> dt.datetime:
    """UTC(aware) → 한국 벽시계 시각(naive)."""
    return t.astimezone(KST).replace(tzinfo=None)


def local_to_utc(t: dt.datetime) -> dt.datetime:
    """한국 벽시계 시각(naive) → UTC(aware)."""
    return t.replace(tzinfo=KST).astimezone(dt.timezone.utc)
