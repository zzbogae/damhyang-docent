# -*- coding: utf-8 -*-
"""
이동 기준선 (Rolling Baseline)

v3까지의 문제:
  ⑨ 전체 기ꄄ을 하나의 기준선으로 삼으면, 플랫폼 사용 습관의 변화를
     상태 변화로 오독한다.
     실측: 유튜브 검색이 2014년 주당 0.4회 → 2025년 주당 60.5회 (150배)
     → 2025년의 모든 주가 "상위권"으로 판정됨

해결:
  각 주의 백분위를 **직전 N주**만을 기준으로 계산한다.
  · 미래를 보지 않으므로 재생 모드와 동일한 조건
  · 습관이 서서히 변해도 기준선이 따라 움직임
  · "작년의 나 대비 지금의 나"를 비교하게 됨
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
from datetime import date
from .analyzer_v3 import (week_to_index, week_date_range, _percentile_rank,
                          classify_shape, build_sentence)

DEFAULT_WINDOW = 52          # 직전 52주(1년)를 기준선으로
MIN_WINDOW = 20              # 최소 이만큼은 쌓여야 판정 시작


def compute_rolling_percentiles(merged: dict, features, window=DEFAULT_WINDOW,
                                 min_window=MIN_WINDOW) -> dict:
    """
    각 주를 '직전 window주'와만 비교해 백분위를 낸다.
    반환: {week: {feature: percentile or None}}
    """
    keys = sorted(merged.keys())
    idx_of = {k: week_to_index(k) for k in keys}

    out = {}
    for i, wk in enumerate(keys):
        cur_idx = idx_of[wk]
        # 직전 window주 안에 있는 주들만 기준선으로
        hist = [keys[j] for j in range(i)
                if cur_idx - idx_of[keys[j]] <= window]

        if len(hist) < min_window:
            out[wk] = {f: None for f, _ in features}
            continue

        p_row = {}
        for f, direction in features:
            v = merged[wk].get(f)
            if v is None:
                p_row[f] = None
                continue
            pool = sorted(merged[h][f] for h in hist
                          if merged[h].get(f) is not None)
            if len(pool) < 8:
                p_row[f] = None
                continue
            p = _percentile_rank(v, pool)
            if direction == 'low':
                p = 100 - p
            p_row[f] = p
        out[wk] = p_row
    return out


def deviation(p_row) -> float:
    vals = [v - 50 for v in p_row.values() if v is not None]
    return sum(vals) / len(vals) if vals else 0.0


def peak(p_row):
    best, name = 0.0, None
    for f, v in p_row.items():
        if v is not None and v > best:
            best, name = v, f
    return best, name


def notable(p_row, th=85.0) -> int:
    return sum(1 for v in p_row.values() if v is not None and v >= th)


def find_candidates_rolling(
    p_weekly: dict,
    weekly_raw: dict,
    *,
    min_deviation: float = 15.0,
    min_notable: int = 2,
    p_extreme: float = 97.0,
    exclude_recent_weeks: int = 2,
    recovery_min_gap: int = 4,
    recovery_sustain: int = 4,
    recovery_window: int = 16,
    recovery_calm: float = 10.0,
) -> list[dict]:
    weeks = sorted(p_weekly.keys())
    # 기준선이 없어 판정 불가한 주 제외
    valid = [w for w in weeks if any(v is not None for v in p_weekly[w].values())]
    if not valid:
        return []

    idx_of = {w: week_to_index(w) for w in valid}
    by_idx = {idx_of[w]: w for w in valid}
    last_idx = idx_of[valid[-1]]
    devs = {w: deviation(p_weekly[w]) for w in valid}

    out = []
    for wk in valid:
        i = idx_of[wk]
        p_row = p_weekly[wk]
        d = devs[wk]
        nc = notable(p_row)
        pp, pf = peak(p_row)
        shape = classify_shape(p_row)

        if not ((d >= min_deviation and nc >= min_notable) or pp >= p_extreme):
            continue

        base = dict(week=wk, date_range=week_date_range(wk),
                    deviation=round(d, 1), notable=nc,
                    peak_pct=round(pp, 1), peak_feature=pf, shape=shape,
                    p_row=p_row, raw=weekly_raw.get(wk, {}))

        if shape == 'expansion':
            out.append({**base, 'tier': 'observed', 'recovered_at': None,
                        'reason': '평소보다 길게 쓴 주 — 위축이 아니라 기록·성찰일 수 있음'})
            continue

        if last_idx - i < exclude_recent_weeks:
            continue

        rec = None
        for s in range(i + recovery_min_gap, min(i + recovery_window, last_idx) + 1):
            if s + recovery_sustain - 1 > last_idx:
                break
            ok, seen = True, 0
            for k in range(s, s + recovery_sustain):
                w2 = by_idx.get(k)
                if w2 is None:
                    continue
                seen += 1
                if devs[w2] > recovery_calm:
                    ok = False
                    break
            if ok and seen >= 2:
                rec = by_idx.get(s)
                break

        if rec:
            out.append({**base, 'tier': 'recovered', 'recovered_at': rec, 'reason': None})
        else:
            out.append({**base, 'tier': 'passed', 'recovered_at': None,
                        'reason': '지표가 충분히 오래 안정되지 않음 — 회복을 단정하지 않음'})

    out.sort(key=lambda c: -c['deviation'])
    return out
