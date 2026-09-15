"""일 단위 표를 ISO 주(월요일 시작) 단위로 묶는다."""
from __future__ import annotations

import datetime as dt

from .indicators import DAILY_SUM_FIELDS, FIELD_CHANNEL, FAMILIES


def parse_date(s: str) -> dt.date:
    return dt.date.fromisoformat(s[:10])


def monday(d: dt.date) -> dt.date:
    return d - dt.timedelta(days=d.weekday())


def iso_key(d: dt.date) -> str:
    y, w, _ = d.isocalendar()
    return f"{y}-W{w:02d}"


def channel_ranges(daily: list[dict], meta: dict) -> dict[str, tuple[dt.date, dt.date]]:
    """채널별 활동 범위. 메타에 있으면 메타를, 없으면 기록이 있는 날짜에서 계산한다."""
    seen: dict[str, list[dt.date]] = {}
    for row in daily:
        d = parse_date(row["date"])
        for f, ch in FIELD_CHANNEL.items():
            val = row.get(f)
            if val is None:
                continue
            if ch == "health" or val > 0:
                seen.setdefault(ch, []).append(d)
    out: dict[str, tuple[dt.date, dt.date]] = {}
    chmeta = (meta or {}).get("channels", {}) or {}
    for ch in FAMILIES:
        m = chmeta.get(ch)
        if m and m.get("first") and m.get("last"):
            out[ch] = (parse_date(m["first"]), parse_date(m["last"]))
        elif ch in seen:
            out[ch] = (min(seen[ch]), max(seen[ch]))
    return out


def build_weeks(daily: list[dict], meta: dict) -> tuple[list[dt.date], list[dict], dict]:
    """주 목록(월요일 날짜), 주별 합계 dict, 채널 범위를 돌려준다.

    주별 dict 에는 DAILY_SUM_FIELDS 의 합과 steps_days·sleep_days(키가 있던 날 수),
    채널별 in_range_days(그 주에 채널 활동 범위에 들어간 날 수)가 들어간다.
    """
    ranges = channel_ranges(daily, meta)
    if not ranges:
        return [], [], ranges
    start = monday(min(r[0] for r in ranges.values()))
    end = monday(max(r[1] for r in ranges.values()))
    n = (end - start).days // 7 + 1
    mondays = [start + dt.timedelta(days=7 * i) for i in range(n)]
    weeks = [dict() for _ in range(n)]
    for row in daily:
        d = parse_date(row["date"])
        i = (d - start).days // 7
        if i < 0 or i >= n:
            continue
        w = weeks[i]
        for f in DAILY_SUM_FIELDS:
            v = row.get(f)
            if v is None:
                continue
            w[f] = w.get(f, 0) + v
        if row.get("steps") is not None:
            w["steps_days"] = w.get("steps_days", 0) + 1
        if row.get("sleep_min") is not None:
            w["sleep_days"] = w.get("sleep_days", 0) + 1
    for i, m in enumerate(mondays):
        for ch, (a, b) in ranges.items():
            lo = max(a, m)
            hi = min(b, m + dt.timedelta(days=6))
            weeks[i][f"{ch}_in_range_days"] = max(0, (hi - lo).days + 1)
    return mondays, weeks, ranges
