"""결측 세 종류 마스크: observed(관측된 0 포함) / structural_missing / partial.

개수 채널은 활동 범위 안에서 기록이 0인 주가 이어지는 구간(0 연속)을 본다.
계획서 초안은 "평소 0 연속 길이의 99백분위"를 기준으로 적었지만, 99백분위는 긴 공백 자체에
끌려가서(공백 하나가 곧 최댓값이 된다) 공백을 못 찾는다. 그래서 0 연속 길이 분포의
Tukey 먼 울타리(Q3 + 3·IQR)와 채널별 최솟값 중 큰 값을 기준으로 쓴다.
"""
from __future__ import annotations

import datetime as dt
import math

from .indicators import CHANNEL_COUNT_FIELDS, FAMILIES
from .weeks import parse_date

# 이 길이(주)보다 짧은 0 연속은 언제나 관측된 0으로 본다
MIN_GAP_WEEKS = {"memo": 8, "photo": 6, "yt": 4, "cal": 12, "kakao": 4, "sns": 8, "ai": 6}
HEALTH_MIN_DAYS = 4
PARTIAL_MIN_DAYS = 5  # 범위 경계 주에서 이 날 수보다 적게 들어가면 부분 관측


def _quantile(xs: list[int], q: float) -> float:
    s = sorted(xs)
    if not s:
        return 0.0
    pos = (len(s) - 1) * q
    lo = math.floor(pos)
    hi = math.ceil(pos)
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def gap_threshold(runs: list[int], ch: str) -> int:
    base = MIN_GAP_WEEKS.get(ch, 6)
    if len(runs) < 8:
        return base
    q1, q3 = _quantile(runs, 0.25), _quantile(runs, 0.75)
    fence = q3 + 3 * (q3 - q1)
    return max(base, int(math.ceil(fence)))


def coverage_masks(mondays: list[dt.date], weeks: list[dict], meta: dict, gap_detection: bool = True) -> tuple[dict[str, list[str]], dict]:
    n = len(weeks)
    masks: dict[str, list[str]] = {}
    info: dict[str, dict] = {}
    explicit = (meta or {}).get("gaps", {}) or {}
    for ch in FAMILIES:
        in_range = [w.get(f"{ch}_in_range_days", 0) for w in weeks]
        m = ["structural_missing"] * n
        if ch == "health":
            for i, w in enumerate(weeks):
                days = max(w.get("steps_days", 0), w.get("sleep_days", 0))
                if in_range[i] == 0:
                    continue
                m[i] = "observed" if days >= HEALTH_MIN_DAYS else ("partial" if days > 0 else "structural_missing")
            masks[ch] = m
            info[ch] = {"observed_weeks": m.count("observed")}
            continue
        fields = CHANNEL_COUNT_FIELDS[ch]
        totals = [sum(w.get(f, 0) for f in fields) for w in weeks]
        for i in range(n):
            if in_range[i] == 0:
                continue
            m[i] = "observed" if in_range[i] >= PARTIAL_MIN_DAYS else "partial"
        # 활동 범위 안의 0 연속
        runs: list[tuple[int, int]] = []
        i = 0
        while i < n:
            if m[i] == "observed" and totals[i] == 0:
                j = i
                while j < n and m[j] == "observed" and totals[j] == 0:
                    j += 1
                runs.append((i, j))
                i = j
            else:
                i += 1
        thr = gap_threshold([b - a for a, b in runs], ch) if gap_detection else 10**9
        n_gap = 0
        for a, b in runs:
            if b - a > thr:
                for k in range(a, b):
                    m[k] = "structural_missing"
                n_gap += 1
        # 사용자가 알려 준 공백
        for a_s, b_s in explicit.get(ch, []) or []:
            a_d, b_d = parse_date(a_s), parse_date(b_s)
            for k, mon in enumerate(mondays):
                if mon <= b_d and mon + dt.timedelta(days=6) >= a_d:
                    m[k] = "structural_missing"
        masks[ch] = m
        info[ch] = {"gap_threshold_weeks": thr, "gaps": n_gap, "observed_weeks": m.count("observed")}
    return masks, info
