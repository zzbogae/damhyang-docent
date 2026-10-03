# -*- coding: utf-8 -*-
"""
회복 판정 로직 v3 — 백분위(percentile) 기반

v2.1까지의 문제:
  ⑧ z-score가 이 데이터에 부적합
     - night_ratio: 88%의 주가 정확히 0 (zero-inflated)
     - avg_length: 평균 65 / 중앙값 32 (심한 우편향)
     → 표준편차가 작아져서, 값이 조금만 있어도 z=6.5 같은 값이 나옴
     → 통계적 유의성이 아니라 분포 왜곡의 산물

v3의 해결:
  z-score 대신 **백분위 순위**를 쓴다.
    - 분포 가정이 필요 없음 (zero-inflated·skewed 모두 대응)
    - 사용자에게 그대로 설명 가능: "지난 1년 중 상위 3%"
    - 0~100으로 유계라 임계값 설정이 직관적

유지되는 원칙:
  회복을 확신할 수 없으면 회복이라고 말하지 않는다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
from datetime import date

FEATURES = [
    ('avg_steps', 'low'),
    ('avg_sleep', 'low'),
    ('night_ratio', 'high'),
    ('first_person_ratio', 'high'),
    ('absolute_ratio', 'high'),
    ('avg_reply_delay_min', 'high'),
    ('avg_length', 'low'),
]

WITHDRAWAL_FEATURES = ['night_ratio', 'avg_reply_delay_min', 'avg_length',
                        'avg_steps', 'avg_sleep']

# 임계값 (백분위 기준)
P_NOTABLE = 85.0        # 이 이상이면 '평소와 다름'
P_EXTREME = 97.0        # 이 이상이면 단일 지표만으로도 유의미
P_CALM = 65.0           # 이 이하로 유지되면 '평소의 흐름'


def week_to_index(week_key: str) -> int:
    y, w = week_key.split('-W')
    return date.fromisocalendar(int(y), int(w), 1).toordinal() // 7


def week_date_range(week_key: str) -> tuple[date, date]:
    y, w = week_key.split('-W')
    return (date.fromisocalendar(int(y), int(w), 1),
            date.fromisocalendar(int(y), int(w), 7))


# ---------- 백분위 ----------

def _percentile_rank(value, sorted_vals) -> float:
    """
    동점(tie)은 중간 순위로 처리 (zero-inflated 데이터에서 중요).
    반환: 0~100
    """
    n = len(sorted_vals)
    if n == 0:
        return 50.0
    below = sum(1 for v in sorted_vals if v < value)
    equal = sum(1 for v in sorted_vals if v == value)
    return (below + 0.5 * equal) / n * 100


def compute_percentiles(merged: dict, features=None) -> dict:
    feats = features or FEATURES
    pools = {f: sorted(row[f] for row in merged.values()
                       if row.get(f) is not None)
             for f, _ in feats}

    out = {}
    for wk, row in merged.items():
        p_row = {}
        for f, direction in feats:
            v = row.get(f)
            if v is None:
                p_row[f] = None
                continue
            p = _percentile_rank(v, pools[f])
            if direction == 'low':
                p = 100 - p     # 낮을수록 이상치인 지표는 뒤집음
            p_row[f] = p
        out[wk] = p_row
    return out


def deviation_score(p_row: dict) -> float:
    """
    백분위를 '평소로부터의 이탈' 점수로 변환.
    50(중앙)에서 얼마나 위로 벗어났는가의 평균. 0~50 범위.
    """
    vals = [v - 50 for v in p_row.values() if v is not None]
    return sum(vals) / len(vals) if vals else 0.0


def peak_percentile(p_row: dict) -> tuple[float, str | None]:
    best, name = 0.0, None
    for f, v in p_row.items():
        if v is not None and v > best:
            best, name = v, f
    return best, name


def notable_count(p_row: dict) -> int:
    return sum(1 for v in p_row.values() if v is not None and v >= P_NOTABLE)


def classify_shape(p_row: dict) -> str:
    length_p = p_row.get('avg_length')       # 높을수록 '짧아짐'
    fp_p = p_row.get('first_person_ratio')

    long_form = length_p is not None and length_p <= 20      # 매우 김
    short_form = length_p is not None and length_p >= 80     # 매우 짧음
    high_fp = fp_p is not None and fp_p >= 80

    if long_form:
        return 'expansion'
    if short_form:
        return 'withdrawal'
    if high_fp:
        return 'mixed'
    return 'mixed'


def withdrawal_score(p_row: dict) -> float:
    vals = [p_row[f] - 50 for f in WITHDRAWAL_FEATURES
            if f in p_row and p_row[f] is not None]
    return sum(vals) / len(vals) if vals else 0.0


# ---------- 후보 탐지 ----------

def find_candidates(
    p_weekly: dict,
    weekly_raw: dict,
    *,
    min_deviation: float = 12.0,        # 평균 이탈 (0~50)
    min_notable: int = 2,               # 상위 15%에 든 지표 개수
    baseline_warmup_weeks: int = 8,
    exclude_recent_weeks: int = 2,
    recovery_min_gap_weeks: int = 4,
    recovery_sustain_weeks: int = 4,
    recovery_search_window: int = 16,
) -> list[dict]:
    weeks = sorted(p_weekly.keys())
    if not weeks:
        return []

    idx_of = {wk: week_to_index(wk) for wk in weeks}
    by_idx = {idx_of[wk]: wk for wk in weeks}
    first_idx, last_idx = idx_of[weeks[0]], idx_of[weeks[-1]]
    devs = {wk: deviation_score(p_weekly[wk]) for wk in weeks}

    out = []
    for wk in weeks:
        i = idx_of[wk]
        p_row = p_weekly[wk]
        dev = devs[wk]
        nc = notable_count(p_row)
        pp, pf = peak_percentile(p_row)
        shape = classify_shape(p_row)

        qualified = (dev >= min_deviation and nc >= min_notable) or (pp >= P_EXTREME)
        if not qualified:
            continue

        base = dict(week=wk, date_range=week_date_range(wk),
                    deviation=round(dev, 1), notable=nc,
                    peak_pct=round(pp, 1), peak_feature=pf, shape=shape,
                    withdrawal=round(withdrawal_score(p_row), 1),
                    p_row=p_row, raw=weekly_raw.get(wk, {}))

        # 규칙 A: 기준선 형성 구간
        if i - first_idx < baseline_warmup_weeks:
            out.append({**base, 'tier': 'observed', 'recovered_at': None,
                        'reason': '데이터 시작 구간 — 비교할 이전 기록이 없음'})
            continue

        # 규칙 B: 확장(성찰) 모양은 위축 서사를 붙이지 않음
        if shape == 'expansion':
            out.append({**base, 'tier': 'observed', 'recovered_at': None,
                        'reason': '평소보다 길게 쓴 주 — 위축이 아니라 기록·성찰일 수 있음'})
            continue

        if last_idx - i < exclude_recent_weeks:
            continue

        rec = _find_sustained_recovery(i, by_idx, devs,
                                        recovery_min_gap_weeks,
                                        recovery_sustain_weeks,
                                        recovery_search_window, last_idx)
        if rec:
            out.append({**base, 'tier': 'recovered', 'recovered_at': rec, 'reason': None})
        else:
            out.append({**base, 'tier': 'passed', 'recovered_at': None,
                        'reason': '그 뒤가 평소 범위였는지는 아직 확인되지 않았습니다'})

    out.sort(key=lambda c: -c['deviation'])
    return out


def _find_sustained_recovery(i, by_idx, devs, min_gap, sustain, window, last_idx):
    """min_gap주 이후부터 sustain주 연속으로 평소 수준(이탈 낮음)을 유지하는 지점"""
    calm_threshold = P_CALM - 50    # deviation 기준으로 환산
    for start in range(i + min_gap, min(i + window, last_idx) + 1):
        if start + sustain - 1 > last_idx:
            return None
        ok, observed = True, 0
        for k in range(start, start + sustain):
            wk = by_idx.get(k)
            if wk is None:
                continue
            observed += 1
            if devs[wk] > calm_threshold:
                ok = False
                break
        if ok and observed >= max(2, sustain // 2):
            return by_idx.get(start)
    return None


# ---------- 문장 생성 ----------

def _fmt(f: str, pct: float, raw: dict) -> str | None:
    if f == 'night_ratio':
        return "새벽 시간대에 남긴 말이 평소보다 많았습니다"
    if f == 'first_person_ratio':
        return "'나'로 시작하는 말이 평소보다 많았습니다"
    if f == 'absolute_ratio':
        return "'항상', '전혀' 같은 단정적인 표현이 평소보다 많았습니다"
    if f == 'avg_reply_delay_min':
        return "답장까지 걸린 시간이 평소보다 길었습니다"
    if f == 'avg_length':
        # direction='low'로 뒤집혀 있으므로 pct가 높다 = 짧게 말했다
        return "평소보다 짧게 말했습니다"
    if f == 'avg_steps':
        return "걸음수가 평소보다 적었습니다"
    if f == 'avg_sleep':
        return "수면 시간이 평소와 달랐습니다"
    return None


def build_sentence(cand: dict, with_percentile: bool = False) -> str:
    p_row, raw = cand['p_row'], cand['raw']
    start, _ = cand['date_range']

    # 백분위는 '이상치 방향'으로 정규화되어 있음 (p가 클수록 이상치).
    # 반대 방향(p가 낮음 = 평소보다 오히려 좋음)은 서술하지 않는다.
    ranked = sorted([(f, p) for f, p in p_row.items() if p is not None],
                    key=lambda x: -x[1])

    facts = []
    for f, p in ranked:
        if len(facts) >= 2:
            break
        if p < 80:        # 상위 20% 안에 든 지표만 서술
            break
        s = _fmt(f, p, raw)
        if s:
            if with_percentile:
                s += f" (상위 {100 - p:.0f}%)"
            facts.append(s)

    period = f"{start.year}년 {start.month}월 {start.day}일부터 한 주간"
    if not facts:
        return f"{period}, 평소와 다른 흐름이 있었습니다."

    body = f"{period}, " + " 그리고 ".join(facts) + "."

    if cand['tier'] == 'recovered' and cand['recovered_at']:
        rs, _ = week_date_range(cand['recovered_at'])
        gap = (rs - start).days // 7
        body += f" 그리고 약 {gap}주 뒤부터 평소의 흐름이 이어졌습니다."

    return body
