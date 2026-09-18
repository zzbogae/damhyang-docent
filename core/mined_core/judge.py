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


# ══════════════════════════════════════════════════════════════════════════
# 축별 robust z-score 엔진 — docs/team_spec_sync_260913.md §1 확정값 이식
#
# 아래 함수들은 드라이브에서 확정된 새 판정 설계(백분위+배지 대신 축 단위 z-score)의
# **통계 계산 부분만** 구현한다. 위쪽의 rolling_percentile/make_badges/mineral_shape 와
# run.py 의 배지·에피소드·교차검증·널모델 로직은 아직 그대로 percentile 방식을 쓴다 —
# 둘을 실제로 연결하는 작업(run.py 재작성)은 범위가 커서 이번에는 하지 않기로 했다.
# 이유: (1) run.py 전체가 지표별 percentile+배지 구조에 얽혀 있어 파급 범위가 크고,
# (2) 다지표 축(화면·기록)을 지표별 z에서 축 단위 z 하나로 합치는 방법이
# team_spec_sync_260913.md 에 명시돼 있지 않다 — 팀 문서는 실제 파이프라인 지표
# (avg_steps, yt_total 등 이미 단일 값)를 전제로 τ를 확정했지, 이 저장소처럼 한 축에
# 여러 지표(예: screen = yt_watch + yt_search + ai_msg + ...)가 있을 때 어떻게 합칠지는
# 다루지 않는다. 개인 건강 판정 로직이라 이 부분을 어설프게 임의로 정해서 조용히 틀린 채로
# 넘어가는 위험을 피하려고, 아래 함수는 "지표 하나짜리 축"(steps·sleep)에 바로 쓸 수 있는
# 형태로 구현하고, 다지표 축(screen·record) 합성 방식은 팀 확인이 온 뒤 연결하기로 한다.
#
# 이 저장소의 축 코드 ↔ team_spec_sync 문서의 축 코드: steps=move, sleep=rest,
# screen=watch, record=leave (코드명만 다르고 같은 축이다 — indicators.py AXES 참고).

AXIS_TAU = {
    # 직전 52주 대비 robust z 절댓값 상위 7.5% 지점(팀 800주 캘리브레이션, 2026-09-11 확정).
    # 고정 z=2 문턱은 실패로 확인됨 — 개인 시계열은 꼬리가 두꺼워 z=2가 상위 5%보다 훨씬
    # 흔하게 나온다. 반드시 이 percentile 기반 값을 쓴다.
    "steps": 3.03,   # move
    "sleep": 2.36,   # rest
    "screen": 1.99,  # watch
    "record": 2.16,  # leave
}
AXIS_TAU_RATIO = 0.6  # 형석 조건의 "다른 축 하나가 |z| ≥ 0.6×τ"

# 건수형·꼬리가 긴 지표는 z 계산 전에 log1p 를 먼저 씌운다(§1-1). 팀 문서의 원래 지표명
# (yt_total·yt_search·notes_count·photo_count·ai_count·avg_reply_delay_min)을 이
# 저장소의 지표 id로 옮긴 것 — 이게 없으면 보기(screen) 축에 판정이 쏠린다(멘토 조언,
# 2026-09-11). steps·sleep 은 건수가 아니라 하루 평균 수준값이라 log1p 대상이 아니다.
LOG1P_INDICATORS = {"yt_watch", "yt_search", "memo_n", "photo_n", "ai_msg", "kakao_delay"}

D_SPEC = {  # 확인 등급 스펙 D 확정(§1-3)
    "sustain": 4,     # 재진입 후 이만큼 연속으로 밴드 안이면 held
    "wait_cap": 4,    # 이탈 후 이 창 안에 재진입해야 '복귀'로 인정
    "min_history": 12,  # 이력 12주 미만인 축은 항상 "기록 없음"
}


def robust_z(v: np.ndarray, window: int = 52, min_history: int = 12, log1p: bool = False):
    """직전 window 주 대비 median·MAD 기반 robust z (team_spec_sync §1-1, §1-5).

    - `log1p=True`면 값·기준 양쪽에 log1p를 먼저 씌운다(건수형 지표의 두꺼운 꼬리 보정).
    - 기준 주가 `min_history`보다 적으면 "기록 없음"(NaN, reason="baseline_short").
    - 표준 스케일링 상수 1.4826(MAD→σ, 정규분포 가정 하의 관례적 보정값)을 쓴다. 이 값은
      team_spec_sync 문서에 직접 적혀 있지 않지만, 문서가 명시한 대체 상수 1.2533
      (평균절대편차→σ 보정값)과 같은 종류의 보정이라 표준값을 그대로 썼다.
    - MAD==0 이면 **평균절대편차(mean absolute deviation) × 1.2533**으로 대체(§1-5 확정).
      그것도 0이면 "기록 없음"(reason="no_spread") — 억지로 큰 수를 만들지 않는다.

    반환: (z: np.ndarray, reason: list[str|None])  # reason: 'missing'|'baseline_short'|'no_spread'|None
    """
    n = len(v)
    z = np.full(n, np.nan)
    reason: list[str | None] = [None] * n
    x = np.log1p(v) if log1p else v.astype(float)
    for w in range(n):
        cur = x[w]
        if np.isnan(cur):
            reason[w] = "missing"
            continue
        s = max(0, w - window)
        base = x[s:w]
        base = base[~np.isnan(base)]
        if len(base) < min_history:
            reason[w] = "baseline_short"
            continue
        med = float(np.median(base))
        mad = float(np.median(np.abs(base - med)))
        if mad > 0:
            sigma = 1.4826 * mad
        else:
            meanad = float(np.mean(np.abs(base - med)))
            sigma = 1.2533 * meanad if meanad > 0 else 0.0
        if sigma == 0:
            reason[w] = "no_spread"
            continue
        z[w] = (cur - med) / sigma
    return z, reason


def axis_extreme(z: float, axis: str, ratio: float = 1.0) -> bool:
    """그 축의 |z| 가 τ(또는 ratio 배)를 넘는지. NaN이면 항상 False."""
    if z is None or np.isnan(z):
        return False
    return abs(z) >= AXIS_TAU[axis] * ratio


def hyeongseok_condition(axis_z: dict[str, float], axis_families: dict[str, set]) -> dict:
    """형석(교차검증) 계단식 조건 (team_spec_sync §1-2).

        최대 축의 |z| ≥ τ
        AND 다른 축 하나가 |z| ≥ 0.6 × τ
        AND 그 두 축을 채운 계열이 서로 다른 출처 2종 이상

    ⚠ 문서에 "0.6×τ"의 τ가 최대 축 것인지 그 다른 축 자신 것인지 명시가 없다(축마다
    τ가 1.99~3.03로 다르다). 두 절이 "그 축의 |z| ≥ (계수)×그 축의 τ" 형태로 병렬 구조인
    점에 근거해 **그 다른 축 자신의 τ**로 구현했다 — 반대로 읽으면 어느 축이 최대냐에 따라
    같은 축 쌍의 판정이 뒤바뀌는 비대칭이 생겨서다. **팀 확인 필요.**

    `axis_z`: {축: 그 주 z} (결측 축은 키를 빼거나 NaN으로). `record`(남기기)처럼 지표가
    여러 개인 축은 호출하기 전에 이미 하나의 축 z로 합쳐져 있어야 한다(위 큰 주석 참고 —
    이 합성 방법은 아직 팀 확인 전이라 여기서 정하지 않음). `axis_families`: {축: 그 축을
    채운 지표들의 family 집합}(indicators.py의 family) — 교차검증엔 "다른 출처"가 필요하므로.
    캘린더(`cal_events`)는 처음부터 이 dict에 넣지 않는다(§1-2: 형석 판단에서 제외).

    반환: {"holds": bool, "max_axis", "second_axis", "reason"}
    """
    valid = {a: z for a, z in axis_z.items() if z is not None and not np.isnan(z)}
    if not valid:
        return {"holds": False, "max_axis": None, "second_axis": None, "reason": "no_data"}
    max_axis = max(valid, key=lambda a: abs(valid[a]))
    if not axis_extreme(valid[max_axis], max_axis):
        return {"holds": False, "max_axis": max_axis, "second_axis": None, "reason": "max_axis_below_tau"}
    # "다른 축 하나가 |z| ≥ 0.6×τ" — 두 절이 "그 축의 |z| ≥ (계수)×그 축의 τ" 형태로
    # 병렬 구조라, 0.6배는 '최대 축'의 τ가 아니라 **그 다른 축 자신의 τ**에 곱한다
    # (그렇지 않으면 τ가 축마다 달라서(1.99~3.03) 어느 축이 최대냐에 따라 같은 축 쌍의
    # 판정이 뒤바뀌는 비대칭이 생긴다).
    candidates = sorted((a for a in valid if a != max_axis and axis_extreme(valid[a], a, AXIS_TAU_RATIO)),
                        key=lambda a: -abs(valid[a]))
    if not candidates:
        return {"holds": False, "max_axis": max_axis, "second_axis": None, "reason": "no_second_axis"}
    fams_max = axis_families.get(max_axis, set())
    for a in candidates:
        if len(fams_max | axis_families.get(a, set())) >= 2:
            return {"holds": True, "max_axis": max_axis, "second_axis": a, "reason": "ok"}
    return {"holds": False, "max_axis": max_axis, "second_axis": candidates[0], "reason": "same_source_only"}


def grade_d(band_ok: list[bool | None], sustain: int = 4, wait_cap: int = 4) -> str:
    """확인 등급 스펙 D (team_spec_sync §1-3, 화면 문구는 gyeol/axes.py GRADE_TEXT 정본).

    `band_ok`: 이탈 다음 주부터(0번 인덱스) 관찰된 주들이 '평소 범위'(밴드) 안인지.
    True=밴드 안, False=밴드 밖(다시 이탈), None=그 주 기록 없음(결측 — 확인 불가).
    길이는 최소 `wait_cap`, 지속 확인까지 보려면 `wait_cap + sustain - 1` 이상 필요.

    - 관찰 구간 전체가 결측(None)이면 `insufficient`("기록이 비어 말할 수 없습니다").
    - `wait_cap` 주 안에서 처음 True 가 나온 주부터 `sustain` 주 연속이 **전부 확인된 True**
      면 `held`("그 뒤 4주는 평소 범위였습니다").
    - 복귀(True)는 확인됐지만 지속 구간에 False 나 None(아직 관찰 전 포함)이 섞이면
      `returned`("돌아왔지만 그 뒤는 확인되지 않았습니다") — "복귀 확신"과 "지속 확신"을
      분리해서, 지속이 아직 확인 안 됐다고 복귀 자체를 취소하지 않는다.
    - `wait_cap` 안에 True 가 전혀 없으면(전부 False, 또는 False·None 섞임) `open`
      ("이 주 뒤는 아직 확인되지 않았습니다") — "복귀 안 했다"고 단정하지 않고, 아직 확인된
      것이 없다고만 말한다(원칙: 확인되지 않은 것을 확인되었다고 말하지 않는다).
    """
    window = band_ok[:wait_cap]
    if all(b is None for b in window):
        return "insufficient"
    return_idx = next((i for i, b in enumerate(window) if b is True), None)
    if return_idx is None:
        return "open"
    sustain_slice = band_ok[return_idx:return_idx + sustain]
    if len(sustain_slice) == sustain and all(b is True for b in sustain_slice):
        return "held"
    return "returned"


__all__ = ["DEFAULT_CONFIG", "rolling_percentile", "make_badges", "sentence_for", "mineral_shape", "axes_for",
           "rank_phrase", "AXIS_LABEL",
           "AXIS_TAU", "AXIS_TAU_RATIO", "LOG1P_INDICATORS", "D_SPEC",
           "robust_z", "axis_extreme", "hyeongseok_condition", "grade_d"]
