"""주 단위 판정 v7.

- 백분위: 그 주 자신의 직전 window 주(변화점 재시작이 켜져 있으면 마지막 변화점 이후)에서 관측된 주만으로
  중간 순위 백분위를 계산한다. 같은 값은 가운데 순위를 받으므로 0이 대부분인 지표에서 0인 주가 0%나 88%로 튀지 않는다.
- 배지: 백분위가 q_badge 이하(적은 쪽) 또는 1-q_badge 이상(많은 쪽).
- 판정(candidate): 배지 2개 이상. single_extreme_candidate 를 켜면 직전 기준 전체를 넘어선 배지(extreme=2) 1개도 판정.
- 교차검증: 배지가 서로 다른 계열(파일·측정 과정) 2개 이상에서 나왔을 때.
- 지표(metric): mid_rank_pct(기본, 위 백분위) 또는 robust_z(팀 v6: 중앙값·MAD, MAD=0 이면 평균절대편차×1.2533).
  robust_z 에서는 축 × 방향마다 다른 문턱 tau 를 쓴다. 두 지표 모두 추세 보정 필터(pr_dt)는 같은 방식으로 건다.
- 확인 등급(grade, 팀 9/23 확정): 판정 뒤 tier_horizon 주 안에 '평소' 주로 돌아오면 그 주가 return_week,
  그 뒤 tier_run 주(hold_until 까지)가 평소 범위면 held, 그 안에서 다시 벗어나면 broken, 기록이 비거나 아직
  안 지나서 모르면 returned. 돌아오지 않은 채 창이 닫히면 not_returned, 창이 안 닫혔으면 open,
  판정 창의 기록이 tier_min_obs 비율보다 적으면 insufficient. not_returned 의 화면 문장은 팀이 쓴다.
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
    "metric": "mid_rank_pct",  # 'mid_rank_pct' | 'robust_z' — 같은 평가 도구로 두 지표를 비교하려고 뽑아 둔 스위치
    "q_dir": None,  # mid_rank_pct 의 방향별 배지 기준. 예: {"move": {"up": 0.03, "down": 0.05}, ...}. 없으면 q_badge
    "tau": None,  # robust_z 의 축 × 방향 문턱(|z|). 없으면 TEAM_V6_TAU
    "band": 1.0,  # 결(줄무늬)과 robust_z 의 '평소' 판정에 쓰는 밴드 |z| < band
    "tier_horizon": 4,  # 팀 규칙: 4주 안에 돌아오는지
    "tier_run": 4,  # 팀 규칙: 돌아온 뒤 4주가 평소 범위인지
    "tier_normal": None,  # '평소' 주 판정: 'no_badge'(배지 없음) | 'band'(|z| < band). None 이면 metric 에 맞춰 고른다
    # 판정 창(horizon) 안에서 관측된 주 비율이 이보다 낮으면 not_returned 대신 insufficient.
    # scripts/insufficient_sweep.py: 0.5 면 공백 낀 not_returned 29주 중 19주가 거짓(원래 기록에선 돌아옴), 1.0 이면 8주 중 1주
    "tier_min_obs": 1.0,
    "complex_min_axes": 3,
    # 배지(판정 근거)로 쓰지 않는 지표. 밤 기록 공백은 실기록에서 수면과 얼마나 맞는지(평가 보고서 quiet_vs_sleep)
    # 확인하기 전까지 쉼 게이지·결에만 쓴다. 확인되면 [] 로 바꾼다
    "badge_off": ["quiet"],  # 배지가 이 수 이상의 축에 걸치면 광물을 형석(복합)으로  # 판정 창(horizon) 안에서 관측된 주 비율이 이보다 낮으면 insufficient
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

# 팀 확정 광물 9종(9/23 §1-4): 축 × 방향 8종 + 교차검증 1종(형석). 난수가 아니라 같은 데이터면 같은 광물이 나온다.
MINERAL_BY_AXIS_DIR = {
    ("move", "up"): "호박", ("move", "down"): "황철석",
    ("rest", "up"): "청금석", ("rest", "down"): "월장석",
    ("watch", "up"): "자수정", ("watch", "down"): "홍옥",
    ("leave", "up"): "흑요석", ("leave", "down"): "석류석",
}
MINERAL_COMPLEX = "형석"
MINERAL_EN = {"호박": "amber", "황철석": "pyrite", "청금석": "lapis", "월장석": "moonstone", "자수정": "amethyst",
              "홍옥": "rose", "흑요석": "obsidian", "석류석": "garnet", "형석": "fluorite"}
# 팀 v6 실측 τ(800주 실기록, 9/23 §1-3). 건수형 지표는 오른쪽 꼬리가 길어 위·아래 문턱이 다르다.
TEAM_V6_TAU = {
    "move": {"up": 4.91, "down": 1.60},
    "rest": {"up": 2.21, "down": 2.99},
    "watch": {"up": 2.48, "down": 1.44},
    "leave": {"up": 2.85, "down": 1.37},
}
GRADES = ["held", "returned", "open", "insufficient", "broken", "not_returned"]
# 화면 문장(팀 확정, broken 은 10/2 NOW). None 은 팀이 문안을 정할 때까지 아무것도 붙이지 않는다는 뜻이다.
GRADE_TEXT = {
    "held": "그 뒤 {run}주는 평소 범위였습니다.",
    "returned": "돌아왔지만 그 뒤는 확인되지 않았습니다.",
    "open": "이 주 뒤는 아직 확인되지 않았습니다.",
    "insufficient": "기록이 비어 판정할 수 없습니다.",
    "broken": "돌아왔지만 다시 벗어났습니다.",
    "not_returned": None,
}
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
    rz = np.full(n, np.nan)
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
        rz[w] = robust_z(b, float(x))
        if detrend and zs[w] < 0.5:
            bt = np.log1p(b) if log else b
            xt = float(np.log1p(x)) if log else float(x)
            rb, rx = _detrended(idx_all[s:w][ok], bt, w, xt)
            pr_dt[w] = (np.sum(rb < rx) + 0.5 * np.sum(rb == rx)) / len(rb)
        else:
            pr_dt[w] = pr[w]
    return {"pr": pr, "pr_dt": pr_dt, "n_base": nb, "less": less_a, "eq": eq_a, "gr": gr_a, "zero_share": zs, "z": rz, "why": why}


def robust_z(b: np.ndarray, x: float, cap: float = 10.0) -> float:
    """팀 v6 robust z: (x - 중앙값) / (1.4826·MAD). MAD 가 0 이면 평균절대편차 × 1.2533(Iglewicz–Hoaglin).

    둘 다 0(기준 창이 전부 같은 값)이면 같은 값은 0, 다른 값은 ±cap 으로 둔다.
    """
    med = float(np.median(b))
    dev = np.abs(b - med)
    mad = float(np.median(dev))
    scale = 1.4826 * mad if mad > 0 else 1.2533 * float(np.mean(dev))
    if scale <= 0:
        return 0.0 if x == med else (cap if x > med else -cap)
    return float(np.clip((x - med) / scale, -cap, cap))


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


def thresholds(axis: str, m_obs: int, cfg: dict) -> tuple[float, float]:
    """(위, 아래) 문턱. mid_rank_pct 는 백분위 꼬리 비율 q, robust_z 는 |z| 문턱 τ 를 돌려준다.

    mid_rank_pct 의 방향별 q 는 adaptive_q 가 조인 비율(조인 q / q_badge)만큼 같이 조인다.
    """
    if cfg.get("metric", "mid_rank_pct") == "robust_z":
        t = (cfg.get("tau") or TEAM_V6_TAU)[axis]
        return float(t["up"]), float(t["down"])
    scale = adaptive_q(m_obs, cfg) / cfg["q_badge"]
    qd = (cfg.get("q_dir") or {}).get(axis)
    if not qd:
        return cfg["q_badge"] * scale, cfg["q_badge"] * scale
    return float(qd["up"]) * scale, float(qd["down"]) * scale


def make_badges(w: int, P: dict[str, dict], cfg: dict) -> list[dict]:
    out = []
    m_obs = sum(1 for ind in INDICATORS if not np.isnan(P[ind.id]["pr"][w]))
    qx = cfg["q_extreme"]
    use_z = cfg.get("metric", "mid_rank_pct") == "robust_z"
    off = set(cfg.get("badge_off") or [])
    for ind in INDICATORS:
        if ind.id in off:
            continue
        R = P[ind.id]
        p = R["pr"][w]
        if np.isnan(p):
            continue
        pd = R["pr_dt"][w]
        qd = cfg["q_trend"]
        t_up, t_down = thresholds(ind.axis, m_obs, cfg)
        if use_z:
            z = R["z"][w]
            hit_up, hit_down = z >= t_up, z <= -t_down
        else:
            hit_up, hit_down = p >= 1 - t_up, p <= t_down
        up = hit_up and pd >= 1 - qd
        down = hit_down and pd <= qd and R["zero_share"][w] < cfg["zero_share_down_off"]
        if not (up or down):
            continue
        less, eq, gr = int(R["less"][w]), int(R["eq"][w]), int(R["gr"][w])
        rank = gr + 1 if up else less + 1
        strict = (gr == 0 and eq == 0) if up else (less == 0 and eq == 0)
        extreme = 2 if strict else (1 if (p >= 1 - qx or p <= qx) else 0)
        out.append({
            "indicator": ind.id, "label": ind.label, "family": ind.family, "axis": ind.axis,
            "direction": "up" if up else "down", "pr": round(float(p), 4), "rank": rank,
            "n_base": int(R["n_base"][w]), "extreme": extreme, "z": round(float(R["z"][w]), 3),
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


def grade_sequence(obs: list[bool], normal: list[bool], horizon: int, run: int, upto: int,
                   min_obs: float = 1.0) -> tuple[str, int | None, int | None]:
    """판정 주 뒤의 주들로 확인 등급을 정한다. obs[k]·normal[k] 는 판정 주에서 k+1 주 뒤의 관측 여부·평소 여부.

    upto 주 뒤까지만 안다고 보고 계산한다. 돌려주는 것은 (등급, 돌아온 주 오프셋, 지속 창 끝 오프셋).
    - horizon 주 안에 첫 평소 주(return)가 있으면 그 뒤 run 주를 본다: 하나라도 벗어나면 broken,
      전부 평소면 held, 비었거나 아직 안 지났으면 returned.
    - 돌아오지 않았는데 horizon 이 안 지났으면 open, 지났으면 관측 주가 min_obs·horizon 보다 적을 때 insufficient,
      아니면 not_returned.
    """
    r = None
    n_obs = 0
    for k in range(1, min(upto, horizon) + 1):
        if k - 1 >= len(obs) or not obs[k - 1]:
            continue
        n_obs += 1
        if normal[k - 1]:
            r = k
            break
    if r is None:
        if upto < horizon:
            return "open", None, None
        return ("insufficient" if n_obs < min_obs * horizon else "not_returned"), None, None
    hold = r + run
    missing = False
    for k in range(r + 1, min(upto, hold) + 1):
        if k - 1 >= len(obs) or not obs[k - 1]:
            missing = True
        elif not normal[k - 1]:
            return "broken", r, hold
    if upto >= hold and not missing:
        return "held", r, hold
    return "returned", r, hold


def grade_text(grade: str | None, run: int = 4) -> str | None:
    t = GRADE_TEXT.get(grade) if grade else None
    return t.format(run=run) if t else None


def sentence_for(monday: dt.date, badges: list[dict], grade: str | None, run: int, cross: bool,
                 linked: bool = False, plain: bool = False) -> str:
    """판정 문장. plain 이면 순위(「직전 52주 중 가장」) 대신 「평소보다」로 쓴 첫 화면용 문장을 만든다(9/12 회의 5번:
    수치는 「왜 이 주인가」 안으로 접는다). 근거가 얇다는 덧붙임도 plain 에서는 뺀다."""
    head = f"{monday.year}년 {monday.month}월 {monday.day}일부터 한 주간, "
    parts = []
    for i, b in enumerate(pick_sentence_badges(badges)):
        ind = BY_ID[b["indicator"]]
        r = "평소보다" if plain else rank_phrase(b["rank"], b["n_base"])
        frag = (ind.up if b["direction"] == "up" else ind.down).format(r=r)
        parts.append(frag + "." if i == 0 else "그리고 " + frag + ".")
    s = head + " ".join(parts)
    gt = grade_text(grade, run)
    if gt:
        s += " " + gt
    if plain:
        return s
    if not cross and badges:
        fams = sorted({b["family"] for b in badges})
        if linked and len(fams) >= 2:
            names = "·".join(FAMILY_LABEL[f] for f in fams)
            s += f" {names} 기록이 함께 가리켰지만, 이 기록에서는 늘 함께 움직이는 지표라 근거 하나로 셌습니다. 근거가 얇습니다."
        else:
            fam = FAMILY_LABEL[badges[0]["family"]]
            s += f" 이 판정은 {fam} 기록 한 종류에서만 나왔습니다. 근거가 얇습니다."
    return s


def mineral_shape(badges: list[dict], complex_min_axes: int = 3) -> tuple[str | None, str | None]:
    """광물: 가장 강한 배지의 축 × 방향(8종). 배지가 complex_min_axes 개 이상의 축에 걸치면 형석(복합).

    팀 정의 GEM_COMPLEX 는 「교차검증」인데, 이 코어는 배지 2개 이상이어야 판정하므로 판정 주 대부분이
    교차검증이 된다(합성 인물 long 87주 중 83주). 그대로 따르면 형석이 95%가 되어 축 × 방향 정보가 사라지므로,
    팀 정의를 받기 전까지는 「3축 이상」을 복합으로 둔다(long 13주, 15%). 팀 규칙이 정해지면 이 함수만 바꾼다.
    모양은 방향 구성(모두 위 angular · 모두 아래 round · 섞임 diamond)."""
    if not badges:
        return None, None
    b0 = badges[0]
    n_axes = len({b["axis"] for b in badges})
    mineral = MINERAL_COMPLEX if n_axes >= complex_min_axes else MINERAL_BY_AXIS_DIR[(b0["axis"], b0["direction"])]
    dirs = {b["direction"] for b in badges}
    shape = "angular" if dirs == {"up"} else ("round" if dirs == {"down"} else "diamond")
    return mineral, shape


AXIS_GAUGE = {"move": ["steps"], "rest": ["sleep", "quiet"], "watch": ["yt_watch", "yt_search", "screen_time"],
              "leave": ["memo_n", "photo_n", "cal_n"]}


def axes_for(w: int, P: dict[str, dict]) -> dict:
    """4축 게이지. pr·z 모두 축 안 게이지 지표 값의 중앙값(z 는 결 계산에 쓴다).
    쉼 축은 수면 기록이 있으면 수면만, 없을 때만 밤 기록 공백을 쓴다(둘을 섞지 않는다)."""
    out = {}
    for ax, ids in AXIS_GAUGE.items():
        used = [i for i in ids if not np.isnan(P[i]["pr"][w])]
        if ax == "rest":
            used = used[:1]
        vals = [(P[i]["pr"][w], P[i]["n_base"][w], P[i]["z"][w]) for i in used]
        if not vals:
            out[ax] = None
            continue
        z = float(np.median([v[2] for v in vals]))
        out[ax] = {"pr": round(float(np.median([v[0] for v in vals])), 4), "n_base": int(max(v[1] for v in vals)),
                   "z": round(float(z), 3)}
        if ax == "rest" and used == ["quiet"]:
            out[ax]["via"] = "quiet"
    return out


def gyeol_for(axes: dict, band: float = 1.0) -> str | None:
    """결(줄무늬, 팀 9/15): 밴드 |z| < band 밖에 있는 축 수로 mixed(2축 이상)·coarse(1축)·regular(0축).
    광물(얼마나 드문가)과 따로 계산한다. 관측된 축이 없으면 None."""
    zs = [a["z"] for a in axes.values() if a is not None]
    if not zs:
        return None
    out_n = sum(1 for z in zs if abs(z) >= band)
    return "mixed" if out_n >= 2 else ("coarse" if out_n == 1 else "regular")


__all__ = ["DEFAULT_CONFIG", "rolling_percentile", "make_badges", "sentence_for", "mineral_shape", "axes_for",
           "gyeol_for", "grade_sequence", "grade_text", "robust_z", "rank_phrase", "AXIS_LABEL", "GRADES", "TEAM_V6_TAU"]
