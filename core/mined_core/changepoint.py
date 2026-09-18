"""PELT(평균 변화, L2 비용). ruptures 는 Pyodide 패키지 목록에 없어서 같은 방식을 짧게 직접 구현한다.

연구용으로는 ruptures.Pelt(model="l2") 와 결과를 비교하는 테스트가 tests/ 에 있다.
"""
from __future__ import annotations

import math

import numpy as np


def pelt_l2(x: np.ndarray, pen: float, min_size: int = 8) -> list[int]:
    """변화점 위치(새 구간의 첫 인덱스) 목록. x 에 결측이 없어야 한다."""
    n = len(x)
    if n < 2 * min_size:
        return []
    cs = np.concatenate([[0.0], np.cumsum(x)])
    cs2 = np.concatenate([[0.0], np.cumsum(x * x)])

    def cost(s: int, e: int) -> float:
        m = e - s
        sm = cs[e] - cs[s]
        return (cs2[e] - cs2[s]) - sm * sm / m

    F = np.full(n + 1, np.inf)
    F[0] = -pen
    last = np.zeros(n + 1, dtype=int)
    R = [0]
    for t in range(min_size, n + 1):
        cands = [s for s in R if t - s >= min_size]
        if not cands:
            R.append(t)
            continue
        vals = [F[s] + cost(s, t) + pen for s in cands]
        k = int(np.argmin(vals))
        F[t] = vals[k]
        last[t] = cands[k]
        keep = [s for s, v in zip(cands, vals) if v - pen <= F[t]]
        young = [s for s in R if t - s < min_size]
        R = keep + young + [t]
    cps = []
    t = n
    while t > 0:
        s = int(last[t])
        if s > 0:
            cps.append(s)
        t = s
    return sorted(cps)


def auto_penalty(x: np.ndarray, k: float = 3.0) -> float:
    """BIC 형 페널티 k·σ²·log n. σ 는 1차 차분의 MAD 로 추정(이상치에 덜 흔들림)."""
    if len(x) < 3:
        return math.inf
    d = np.diff(x)
    mad = np.median(np.abs(d - np.median(d)))
    sigma = 1.4826 * mad / math.sqrt(2)
    if sigma <= 1e-12:
        sigma = float(np.std(x)) or 1.0
    return k * sigma * sigma * math.log(len(x))


def changepoints_with_gaps(values: np.ndarray, kind: str, k: float = 3.0, min_size: int = 8,
                           woy: list[int] | None = None) -> list[int]:
    """결측(nan)을 빼고 이어 붙인 수열에서 PELT 를 돌린 뒤 원래 주 인덱스로 되돌린다.

    woy(주차 번호)를 주면 연 주기 성분을 먼저 뺀다(계절 변화를 시기 경계로 잡지 않게).
    """
    v = values.astype(float)
    if kind == "count":
        v = np.log1p(v)
    if woy is not None:
        v = deseasonalize(v, woy)
    idx = np.where(~np.isnan(v))[0]
    if len(idx) < 2 * min_size:
        return []
    x = v[idx]
    pen = auto_penalty(x, k)
    return [int(idx[c]) for c in pelt_l2(x, pen, min_size)]


def deseasonalize(values: np.ndarray, woy: list[int], min_years: float = 2.0) -> np.ndarray:
    """연 주기(주차별) 성분을 뺀 수열. 기록이 2년 미만이면 그대로 돌려준다.

    가운데 정렬 53주 이동 중앙값을 추세로 보고, 추세를 뺀 값의 주차별 중앙값(앞뒤 2주로 원형 평활)을 계절 성분으로 뺀다.
    결측(nan)은 그대로 둔다. 판정이 아니라 시기 경계(변화점)를 찾을 때만 쓴다.
    """
    v = values.astype(float)
    n = len(v)
    obs = ~np.isnan(v)
    if obs.sum() < 52 * min_years:
        return v
    half = 26
    trend = np.full(n, np.nan)
    for i in range(n):
        seg = v[max(0, i - half):min(n, i + half + 1)]
        seg = seg[~np.isnan(seg)]
        if len(seg) >= 20:
            trend[i] = np.median(seg)
    det = v - trend
    prof = np.full(54, np.nan)
    woy_a = np.array(woy)
    for k in range(1, 54):
        x = det[(woy_a == k) & ~np.isnan(det)]
        if len(x) >= 2:
            prof[k] = np.median(x)
    sm = np.zeros(54)
    for k in range(1, 54):
        nb = [prof[((k - 1 + d) % 53) + 1] for d in range(-2, 3)]
        nb = [x for x in nb if not np.isnan(x)]
        sm[k] = float(np.mean(nb)) if nb else 0.0
    return v - sm[woy_a]


def strong_shift(values: np.ndarray, cp: int, span: int = 26, min_effect: float = 1.5) -> float:
    """변화점 앞뒤 span 주 평균 차이를 잡음 크기(1차 차분 MAD)로 나눈 효과 크기. 앞뒤 관측이 모자라면 0."""
    x = values
    a = x[max(0, cp - span):cp]
    b = x[cp:cp + span]
    a = a[~np.isnan(a)]
    b = b[~np.isnan(b)]
    if len(a) < span // 2 or len(b) < span // 2:
        return 0.0
    xs = x[~np.isnan(x)]
    d = np.diff(xs)
    sigma = 1.4826 * np.median(np.abs(d - np.median(d))) / math.sqrt(2)
    if sigma <= 1e-12:
        return 0.0
    return float(abs(np.mean(b) - np.mean(a)) / sigma)
