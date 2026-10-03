"""참가자 평가 보고서: 숫자만 담기고 날짜가 섞이면 멈추는지, 사건 형식을 제대로 읽는지."""
import json

import pytest

from mined_core import field_eval
from mined_core.field_eval import field_report, find_dates, normalize_events

from .fixtures import make_daily

EV = [("2021-03-08", 7, "hard"), ("2022-09-12", 7, "trip"), ("2023-05-15", 7, "hard")]


def test_normalize_events():
    got = normalize_events([
        {"start": "2021-03-08", "end": "2021-03-14", "kind": "hard", "note": "아팠음"},
        {"start": "2022-01-03", "kind": "change"},
        {"start": "2022-02-01", "end": "2022-01-01", "kind": "good"},  # 끝이 앞서면 7일로 본다
        {"start": "2022-13", "kind": "hard"},  # 날짜 형식이 아님
        {"start": "2022-03-01", "kind": "party"},  # 알 수 없는 종류
    ])
    assert got == [
        {"start": "2021-03-08", "end": "2021-03-14", "type": "hard", "persistent": False},
        {"start": "2022-01-03", "days": 1, "type": "change", "persistent": True},
        {"start": "2022-02-01", "days": 7, "type": "good", "persistent": False},
    ]


def test_report_has_numbers_only():
    rows, meta = make_daily(years=4, seed=5, events=EV)
    events = [{"start": s, "end": None, "kind": "hard" if k == "hard" else "good", "note": "메모는 보고서에 안 들어감"} for s, _, k in EV]
    events.append({"start": "2022-01-03", "kind": "change"})
    rep = field_report(rows, meta, events, {"quick": True})
    s = json.dumps(rep, ensure_ascii=False)
    assert rep["schema"] == "mined.fieldeval/1"
    assert "메모" not in s and not find_dates(rep)
    assert rep["events"] == {"n": 4, "by_kind": {"hard": 2, "good": 1, "change": 1}, "dropped": 0}
    assert rep["anchors"]["n_events"] == 3 and rep["anchors"]["event_recall_pm1"] >= 2 / 3
    assert rep["persistent_boundaries"]["n"] == 1
    assert set(rep["holdout"]) <= {"health", "memo", "photo", "yt", "cal"}
    assert "configs" not in rep  # quick


def test_date_leak_stops_report(monkeypatch):
    rows, meta = make_daily(years=2, seed=1)
    meta["channels"]["memo"]["sources"] = ["keep-2021-03-08"]
    with pytest.raises(ValueError, match="날짜"):
        field_report(rows, meta, [], {"quick": True})


def test_find_dates_keys_and_weeks():
    assert find_dates({"a": {"2021-W07": 1}}) == ["/a/2021-W07(key)"]
    assert find_dates({"b": ["x", "2020-01-06"]}) == ["/b[1]"]
    assert find_dates({"c": "2026-09"}) == []
