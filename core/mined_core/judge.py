"""주 단위 판정 v7.

- 백분위: 그 주 자신의 직전 window 주(변화점 재시작이 켜져 있으면 마지막 변화점 이후)에서 관측된 주만으로
  중간 순위 백분위를 계산한다. 같은 값은 가운데 순위를 받으므로 0이 대부분인 지표에서 0인 주가 0%나 88%로 튀지 않는다.
- 배지: 백분위가 q_badge 이하(적은 쪽) 또는 1-q_badge 이상(많은 쪽).
- 판정(candidate): 배지 2개 이상. single_extreme_candidate 를 켜면 직전 기준 전체를 넘어선 배지(extreme=2) 1개도 판정.
- 교차검증: 배지가 서로 다른 계열(파일·측정 과정) 2개 이상에서 나왔을 때.
- 사후 등급: 판정 뒤 horizon 주 안에 '평소' 주가 run 주 이어지면 recovered, 충분히 지났는데 없으면 passed,
  아직 모르면 observed. 직전 기준 전체를 넘어선 주에는 회복 서사를 붙이지 않는다(v6 규칙).
- 확인 후 열람: 두드러짐 점수(extreme=2 는 2점, extreme=1 은 1점)의 합이 2 이상.

팀의 v6 규칙과 기준값이 다르면 DEFAULT_CONFIG 만 바꾸면 된다.
"""
from __future__ import annotations

import datetime as dt

import numpy as np

from .indicators import AXIS_LABEL, BY_ID, FAMILY_LABEL, INDICATORS

DEFAULT_CONFIG = {
    "window": 52,
    "min_base": 26,
    "q_badge": 0.03,  # 합성 데이터 비교(docs/eval.md): 0.05 면 사건 없는 주의 23~35% 가 우연히 판정됨
    "q_extreme": 0.015,
    "adaptive_q": True,  # 관측 지표가 q_ref_m 개보다 많은 주는 우연 겹침 확률이 같아지도록 배지 기준을 조인다
    "q_ref_m": 11,
    "detrend": True,  # 직전 창 추세로 설명되는 배지는 떼어 낸다(배지 문장의 순위는 원래 값 기준 그대로)
    "q_trend": 0.10,
    "single_extreme_candidate": False,  # 켜면 배지 하나짜리 극단 주도 판정(우연 판정률 +15%p 안팎)
    "zero_share_down_off": 0.5,
    "gap_detection": True,
    "cp_restart": False,
    "cp_k": 3.0,
    "cp_deseason": True,  # 시기 경계를 찾기 전에 연 주기 성분을 뺀다
    "era_strong_shift": 1.5,  # 한 계열만 바뀐 변화도 앞뒤 반년 평균 차이가 잡음의 이 배수 이상이면 시기 경계
    "cp_min_size": 8,
    "episode_gap": 2,  # 판정된 주 사이가 이 주 수 이하면 한 에피소드
    "tier_horizon": 12,
    "tier_run": 4,
    "similar_exclude": 8,
    "similar_top": 3,
    "similar_min_families": 2,
    "similar_min_shared": 3,
    "null_iter": 200,  # 요약에 '우연이라면 몇 주'를 넣는 원형 이동 반복 수(0 이면 생략)
    "auto_link": True,  # 계열이 달라도 이 사람 기록에서 |ρ| ≥ link_rho 로 함께 움직이는 지표는 근거 하나로 센다
    "link_rho": 0.6,
    "link_min_weeks": 52,
    "family_merge": None,  # 예: {"yt": "screen", "photo": "screen"} 처럼 계열을 묶어 셀 때
}

MINERAL_BY_AXIS = {"steps": "호박", "sleep": "청금석", "screen": "자수정", "record": "흑요석"}
ORDINAL = ["", "", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"]


def _detrended(b_idx: np.ndarray, b: np.ndarray, w: int, x: float) -> tuple[np.ndarray, float]:
    """직전 창 안에서 선형 추세를 빼고, 그 추세를 w 주까지 늘린 값과 x 의 차이를 돌려준다.

    OLS 로 한 번 맞춘 뒤 잔차가 2σ 를 넘는 주(판정된 주 같은 이상치)를 빼고 다시 맞춘다.
    과거 주만 쓰므로 인과적이다. 추세가 없으면 원래 롤링 백분위와 거의 같다.
    """
    t = b_idx.astype(float)
    A = np.column_stack([np.ones_like(t), t])
    coef, *_ = np.linalg.lstsq(A, b, rcond=None)
    r = b - A @ coef
    s = np.std(r)
    if s > 0:
        keep = np.abs(r) <= 2 * s
        if keep.sum() >= 8:
            coef, *_ = np.linalg.lstsq(A[keep], b[keep], rcond=None)
    fit_b = A @ coef
    fit_w = coef[0] + coef[1] * w
    return b - fit_b, x - fit_w


def rolling_percentile(v: np.ndarray, window: int, min_base: int, cps: list[int] | None = None,
                       detrend: bool = False, log: bool = False):
    n = len(v)
    pr = np.full(n, np.nan)
    pr_dt = np.full(n, np.nan)
    nb = np.zeros(n, dtype=int)
    less_a = np.zeros(n, dtype=int)
    eq_a = np.zeros(n, dtype=int)
    gr_a = np.zeros(n, dtype=int)
    zs = np.zeros(n)
    why: list[str | None] = [None] * n
    cps_sorted = sorted(cps or [])
    j = 0
    cur = 0
    idx_all = np.arange(n)
    for w in range(n):
        while j < len(cps_sorted) and cps_sorted[j] <= w:
            cur = cps_sorted[j]
            j += 1
        x = v[w]
        s = max(0, w - window)
        if cps_sorted:
            s = max(s, cur)
        seg = v[s:w]
        ok = ~np.isnan(seg)
        b = seg[ok]
        nb[w] = len(b)
        if np.isnan(x):
            why[w] = "missing"
            continue
        if len(b) < min_base:
            why[w] = "baseline_short"
            continue
        less = int(np.sum(b < x))
        eq = int(np.sum(b == x))
        gr = len(b) - less - eq
        pr[w] = (less + 0.5 * eq) / len(b)
        less_a[w], eq_a[w], gr_a[w] = less, eq, gr
        zs[w] = float(np.mean(b == 0))
        if detrend and zs[w] < 0.5:
            bt = np.log1p(b) if log else b
            xt = float(np.log1p(x)) if log else float(x)
            rb, rx = _detrended(idx_all[s:w][ok], bt, w, xt)
            pr_dt[w] = (np.sum(rb < rx) + 0.5 * np.sum(rb == rx)) / len(rb)
        else:
            pr_dt[w] = pr[w]
    return {"pr": pr, "pr_dt": pr_dt, "n_base": nb, "less": less_a, "eq": eq_a, "gr": gr_a, "zero_share": zs, "why": why}


def rank_phrase(rank: int, n: int) -> str:
    if rank == 1:
        return f"직전 {n}주 중 가장"
    if rank <= 10:
        return f"직전 {n}주 중 {ORDINAL[rank]} 번째로"
    return f"직전 {n}주 중 {rank}번째로"


def _p_two_or_more(m: int, p: float) -> float:
    """지표 m 개가 서로 독립이고 각각 확률 p 로 배지를 받을 때, 배지가 2개 이상 나올 확률."""
    return 1 - (1 - p) ** m - m * p * (1 - p) ** (m - 1)


def adaptive_q(m_obs: int, cfg: dict) -> float:
    """관측된 지표가 기준(q_ref_m 개)보다 많으면, 우연히 배지 2개가 겹칠 확률이 기준과 같아지도록 배지 기준을 조인다.

    지표가 기준보다 적으면 q_badge 를 그대로 쓴다(느슨하게 풀지 않음). 지표끼리 독립이라고 가정한 근사다.
    """
    q0 = cfg["q_badge"]
    ref = int(cfg.get("q_ref_m", 11))
    if not cfg.get("adaptive_q", True) or m_obs <= ref:
        return q0
    target = _p_two_or_more(ref, 2 * q0)
    lo, hi = 1e-4, 2 * q0
    for _ in range(40):
        mid = (lo + hi) / 2
        if _p_two_or_more(m_obs, mid) > target:
            hi = mid
        else:
            lo = mid
    return max(0.005, lo / 2)


def make_badges(w: int, P: dict[str, dict], cfg: dict) -> list[dict]:
    out = []
    m_obs = sum(1 for ind in INDICATORS if not np.isnan(P[ind.id]["pr"][w]))
    q, qx = adaptive_q(m_obs, cfg), cfg["q_extreme"]
    for ind in INDICATORS:
        R = P[ind.id]
        p = R["pr"][w]
        if np.isnan(p):
            continue
        pd = R["pr_dt"][w]
        qd = cfg["q_trend"]
        up = p >= 1 - q and pd >= 1 - qd
        down = p <= q and pd <= qd and R["zero_share"][w] < cfg["zero_share_down_off"]
        if not (up or down):
            continue
        less, eq, gr = int(R["less"][w]), int(R["eq"][w]), int(R["gr"][w])
        rank = gr + 1 if up else less + 1
        strict = (gr == 0 and eq == 0) if up else (less == 0 and eq == 0)
        extreme = 2 if strict else (1 if (p >= 1 - qx or p <= qx) else 0)
        out.append({
            "indicator": ind.id, "label": ind.label, "family": ind.family, "axis": ind.axis,
            "direction": "up" if up else "down", "pr": round(float(p), 4), "rank": rank,
            "n_base": int(R["n_base"][w]), "extreme": extreme,
        })
    out.sort(key=lambda b: (-b["extreme"], -abs(b["pr"] - 0.5)))
    return out


def pick_sentence_badges(badges: list[dict]) -> list[dict]:
    if not badges:
        return []
    first = badges[0]
    other = next((b for b in badges[1:] if b["family"] != first["family"]), None)
    if other is None and len(badges) > 1:
        other = badges[1]
    return [first] + ([other] if other else [])


def sentence_for(monday: dt.date, badges: list[dict], tier: str | None, after: int | None, cross: bool,
                 linked: bool = False) -> str:
    head = f"{monday.year}년 {monday.month}월 {monday.day}일부터 한 주간, "
    parts = []
    for i, b in enumerate(pick_sentence_badges(badges)):
        ind = BY_ID[b["indicator"]]
        frag = (ind.up if b["direction"] == "up" else ind.down).format(r=rank_phrase(b["rank"], b["n_base"]))
        parts.append(frag + "." if i == 0 else "그리고 " + frag + ".")
    s = head + " ".join(parts)
    if tier == "recovered" and after:
        s += f" 약 {after}주 뒤부터 평소의 흐름이 이어졌습니다."
    elif tier == "passed":
        s += " 그 뒤로 평소의 흐름이 충분히 오래 이어졌는지는 확인되지 않았습니다."
    if not cross and badges:
        fams = sorted({b["family"] for b in badges})
        if linked and len(fams) >= 2:
            names = "·".join(FAMILY_LABEL[f] for f in fams)
            s += f" {names} 기록이 함께 가리켰지만, 이 기록에서는 늘 함께 움직이는 지표라 근거 하나로 셌습니다. 근거가 얇습니다."
        else:
            fam = FAMILY_LABEL[badges[0]["family"]]
            s += f" 이 판정은 {fam} 기록 한 종류에서만 나왔습니다. 근거가 얇습니다."
    return s


def mineral_shape(badges: list[dict]) -> tuple[str | None, str | None]:
    """광물·모양 규칙(자리표시). 팀 규칙으로 바꿀 것: 가장 강한 배지의 축 → 광물, 방향 구성 → 모양."""
    if not badges:
        return None, None
    mineral = MINERAL_BY_AXIS[badges[0]["axis"]]
    dirs = {b["direction"] for b in badges}
    shape = "angular" if dirs == {"up"} else ("round" if dirs == {"down"} else "diamond")
    return mineral, shape


def axes_for(w: int, P: dict[str, dict]) -> dict:
    groups = {"steps": ["steps"], "sleep": ["sleep"], "screen": ["yt_watch", "yt_search"],
              "record": ["memo_n", "photo_n", "cal_n"]}
    out = {}
    for ax, ids in groups.items():
        vals = [(P[i]["pr"][w], P[i]["n_base"][w]) for i in ids if not np.isnan(P[i]["pr"][w])]
        if not vals:
            out[ax] = None
            continue
        out[ax] = {"pr": round(float(np.median([v for v, _ in vals])), 4), "n_base": int(max(n for _, n in vals))}
    return out


__all__ = ["DEFAULT_CONFIG", "rolling_percentile", "make_badges", "sentence_for", "mineral_shape", "axes_for",
           "rank_phrase", "AXIS_LABEL"]
