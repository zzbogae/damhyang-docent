"""테스트용 소형 합성 일 단위 표. 큰 합성 인물·원천 파일은 synth/ 에 따로 있다."""
from __future__ import annotations

import datetime as dt

import numpy as np


def make_daily(years: int = 4, seed: int = 7, start: str = "2020-01-06", events: list[tuple[str, int, str]] | None = None,
               channels: tuple[str, ...] = ("health", "memo", "photo", "yt", "cal"), gap: tuple[str, str, str] | None = None):
    """events: (시작일, 일수, 종류) 종류는 hard/trip/busy. gap: (채널, 시작, 끝) 동안 그 채널 기록 없음."""
    rng = np.random.default_rng(seed)
    d0 = dt.date.fromisoformat(start)
    ndays = 365 * years
    ev_days: dict[dt.date, str] = {}
    for s, k, kind in events or []:
        a = dt.date.fromisoformat(s)
        for i in range(k):
            ev_days[a + dt.timedelta(days=i)] = kind
    rows = []
    for i in range(ndays):
        d = d0 + dt.timedelta(days=i)
        season = 1 - 0.18 * np.cos(2 * np.pi * (d.timetuple().tm_yday - 15) / 365)
        kind = ev_days.get(d)
        row: dict = {"date": d.isoformat()}
        if "health" in channels:
            steps = rng.normal(7000, 1400) * season
            sleep = rng.normal(410, 35)
            if kind == "hard":
                steps *= 0.55
                sleep -= 70
            if kind == "trip":
                steps *= 1.7
            row["steps"] = int(max(300, steps))
            row["sleep_min"] = int(max(120, sleep))
        if "memo" in channels:
            lam = 0.35 + (0.9 if kind == "hard" else 0) - (0.2 if kind == "trip" else 0)
            n = int(rng.poisson(max(lam, 0.02)))
            if n:
                row["memo_n"] = n
                row["memo_chars"] = int(sum(rng.integers(20, 120 if kind != "hard" else 300) for _ in range(n)))
                night = int(rng.binomial(n, 0.6 if kind == "hard" else 0.03))
                if night:
                    row["memo_night_n"] = night
        if "photo" in channels:
            lam = 2.0 * (6 if kind == "trip" else 1) * (0.3 if kind == "busy" else 1)
            n = int(rng.poisson(lam))
            if n:
                row["photo_n"] = n
                night = int(rng.binomial(n, 0.04))
                if night:
                    row["photo_night_n"] = night
        if "yt" in channels:
            growth = 0.5 + 6 * (i / ndays)
            lam = growth * (2.2 if kind == "hard" else 1)
            n = int(rng.poisson(lam))
            if n:
                row["yt_watch_n"] = n
                night = int(rng.binomial(n, 0.45 if kind == "hard" else 0.08))
                if night:
                    row["yt_watch_night_n"] = night
            s = int(rng.poisson(0.8))
            if s:
                row["yt_search_n"] = s
        if "cal" in channels:
            n = int(rng.poisson(0.5 * (4 if kind == "busy" else 1)))
            if n:
                row["cal_n"] = n
        if gap and gap[1] <= row["date"] <= gap[2]:
            ch = gap[0]
            for k in list(row):
                if k != "date" and (k.startswith(ch) or (ch == "health" and k in ("steps", "sleep_min"))):
                    del row[k]
        rows.append(row)
    meta = {"tz": "Asia/Seoul", "night_hours": [0, 5], "channels": {}}
    for ch in channels:
        meta["channels"][ch] = {"first": rows[0]["date"], "last": rows[-1]["date"], "sources": ["test"], "records": 0}
    return rows, meta
