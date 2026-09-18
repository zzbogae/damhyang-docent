"""정답 없이 품질을 주장하는 대리 검증(2-5). 합성 인물처럼 정답 사건이 있는 데이터에서는 재현율도 잰다.

- holdout: 채널 하나를 빼고 판정한 주에서, 뺀 채널도 평소 범위를 벗어난 비율 ÷ 무작위 주에서의 비율
- injection: 실제 일 단위 표의 무작위 주에 인위적 변화를 넣고 찾아내는 비율(변화 크기별)
- window: 26·52·104주 창 판정 결과의 자카드 계수
- missing: 결측 가정을 바꿔도 판정이 유지되는 주의 비율
- anchors: 미리 적어 둔 사건 앞뒤 2주에 판정이 무작위보다 몰리는지
"""
from __future__ import annotations

import copy
import datetime as dt

import numpy as np

from .indicators import FAMILIES, FIELD_CHANNEL, INDICATORS
from .run import run
from .weeks import monday, parse_date


def _cand(result: dict) -> set[str]:
    return {w["week"] for w in result["weeks"] if w["candidate"]}


def _judged(result: dict) -> list[str]:
    return [w["week"] for w in result["weeks"] if any(v["pr"] is not None for v in w["ind"].values())]


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if (a | b) else 1.0


def drop_channel(daily: list[dict], meta: dict, ch: str):
    d2 = [{k: v for k, v in r.items() if k == "date" or FIELD_CHANNEL.get(k) != ch} for r in daily]
    m2 = copy.deepcopy(meta)
    (m2.get("channels") or {}).pop(ch, None)
    (m2.get("gaps") or {}).pop(ch, None)
    return d2, m2


def holdout(daily: list[dict], meta: dict, cfg: dict | None = None, q_hit: float = 0.10, n_boot: int = 1000,
            seed: int = 0, full: dict | None = None) -> dict:
    full = full or run(daily, meta, cfg)
    idx = {w["week"]: k for k, w in enumerate(full["weeks"])}
    rng = np.random.default_rng(seed)
    out = {}
    for ch in FAMILIES:
        inds = [i.id for i in INDICATORS if i.family == ch]

        def hit(wk: dict) -> bool | None:
            prs = [wk["ind"][i]["pr"] for i in inds if wk["ind"][i]["pr"] is not None]
            if not prs:
                return None
            return any(p <= q_hit or p >= 1 - q_hit for p in prs)

        base_hits = [h for h in (hit(w) for w in full["weeks"]) if h is not None]
        if len(base_hits) < 30:
            continue
        d2, m2 = drop_channel(daily, meta, ch)
        minus = run(d2, m2, cfg)
        C = [w["week"] for w in minus["weeks"] if w["candidate"]]
        hs = [h for h in (hit(full["weeks"][idx[k]]) for k in C if k in idx) if h is not None]
        if len(hs) < 5:
            out[ch] = {"n_candidates_without": len(C), "n_scored": len(hs)}
            continue
        base = float(np.mean(base_hits))
        rate = float(np.mean(hs))
        boots = [np.mean(rng.choice(hs, len(hs), replace=True)) / base for _ in range(n_boot)]
        out[ch] = {
            "n_candidates_without": len(C), "n_scored": len(hs),
            "hit_rate": round(rate, 3), "base_rate": round(base, 3),
            "lift": round(rate / base, 3) if base > 0 else None,
            "lift_ci95": [round(float(np.percentile(boots, 2.5)), 3), round(float(np.percentile(boots, 97.5)), 3)],
        }
    return out


PATTERNS = {
    # 힘든 주: 걸음↓ 수면↓ 새벽 시청↑ 새벽 메모↑
    "hard": lambda r, m: {
        **r,
        **({"steps": int(r["steps"] * (1 - m))} if "steps" in r else {}),
        **({"sleep_min": int(max(60, r["sleep_min"] - 150 * m))} if "sleep_min" in r else {}),
        **({"yt_watch_night_n": min(r.get("yt_watch_n", 0), r.get("yt_watch_night_n", 0) + round(r.get("yt_watch_n", 0) * m))}
           if r.get("yt_watch_n") else {}),
        **({"memo_night_n": min(r.get("memo_n", 0), r.get("memo_night_n", 0) + round(r.get("memo_n", 0) * m))}
           if r.get("memo_n") else {}),
    },
    # 걸음만 줄어듦(한 채널)
    "steps": lambda r, m: {**r, **({"steps": int(r["steps"] * (1 - m))} if "steps" in r else {})},
}


def injection(daily: list[dict], meta: dict, cfg: dict | None = None, magnitudes=(0.1, 0.2, 0.3, 0.5),
              pattern: str = "hard", per_run: int = 8, runs: int = 3, seed: int = 0, spacing: int = 20,
              avoid: set[str] | None = None, base: dict | None = None) -> dict:
    base = base or run(daily, meta, cfg)
    fn = PATTERNS[pattern]
    need = {"hard": ["steps", "sleep", "yt_night"], "steps": ["steps"]}[pattern]
    eligible = [k for k, w in enumerate(base["weeks"])
                if all(w["ind"][i]["pr"] is not None for i in need) and not w["candidate"]
                and (not avoid or w["week"] not in avoid)]
    rng = np.random.default_rng(seed)
    by_week = {w["week"]: k for k, w in enumerate(base["weeks"])}
    rows_by_date = {r["date"]: i for i, r in enumerate(daily)}
    out = {}
    for m in magnitudes:
        cand_hits, badge_hits, total = 0, 0, 0
        for _ in range(runs):
            picks: list[int] = []
            for k in rng.permutation(eligible):
                if all(abs(int(k) - p) >= spacing for p in picks):
                    picks.append(int(k))
                if len(picks) >= per_run:
                    break
            d2 = list(daily)
            for k in picks:
                mon = parse_date(base["weeks"][k]["date_start"])
                for off in range(7):
                    ds = (mon + dt.timedelta(days=off)).isoformat()
                    if ds in rows_by_date:
                        i = rows_by_date[ds]
                        d2[i] = fn(daily[i], m)
            res = run(d2, meta, cfg)
            for k in picks:
                wk = res["weeks"][k]
                total += 1
                cand_hits += int(wk["candidate"])
                badge_hits += int(any(b["indicator"] in need for b in wk["badges"]))
        out[str(m)] = {"n": total, "candidate_recall": round(cand_hits / total, 3) if total else None,
                       "badge_recall": round(badge_hits / total, 3) if total else None}
    return out


def window_sensitivity(daily: list[dict], meta: dict, cfg: dict | None = None, windows=(26, 52, 104),
                       base: dict | None = None) -> dict:
    """base: 기본 창(52주)으로 이미 판정한 결과가 있으면 그 주는 다시 판정하지 않는다."""
    cfg = cfg or {}
    sets = {}
    for W in windows:
        if W == 52 and base is not None and "window" not in cfg and "min_base" not in cfg:
            sets[W] = _cand(base)
        else:
            sets[W] = _cand(run(daily, meta, {**cfg, "window": W, "min_base": min(26, W // 2)}))
    ref = sets[52]
    return {str(W): {"n": len(s), "jaccard_vs_52": round(jaccard(s, ref), 3)} for W, s in sets.items()}


def missing_sensitivity(daily: list[dict], meta: dict, cfg: dict | None = None, base: dict | None = None) -> dict:
    base = base or run(daily, meta, cfg)
    C0 = _cand(base)
    gap_weeks = {ch: {w["date_start"] for w in base["weeks"] if w["coverage"][ch] == "structural_missing"} for ch in FAMILIES}
    rows = {r["date"]: dict(r) for r in daily}
    ranges = {ch: (parse_date(v["first"]), parse_date(v["last"])) for ch, v in (meta.get("channels") or {}).items()}

    def variant(fill: str):
        d2 = {k: dict(v) for k, v in rows.items()}
        for ch in ["memo", "photo", "yt", "cal", "kakao", "sns", "ai"]:
            if ch not in ranges:
                continue
            fields = [f for f, c in FIELD_CHANNEL.items() if c == ch]
            med = {f: float(np.median([r.get(f, 0) for r in rows.values()])) for f in fields}
            a, b = ranges[ch]
            for ws in gap_weeks[ch]:
                mon = parse_date(ws)
                for off in range(7):
                    d = mon + dt.timedelta(days=off)
                    if d < a or d > b:
                        continue
                    r = d2.setdefault(d.isoformat(), {"date": d.isoformat()})
                    for f in fields:
                        r[f] = 0 if fill == "low" else round(med[f])
        m2 = copy.deepcopy(meta)
        m2["gaps"] = {}
        cfg2 = {**(cfg or {})}
        return _cand(run(sorted(d2.values(), key=lambda r: r["date"]), m2, {**cfg2, "gap_detection": False}))

    low = variant("low")
    med = variant("median")
    return {
        "n_candidates": len(C0),
        "added_if_missing_is_low": len(low - C0),
        "added_if_missing_is_usual": len(med - C0),
        "kept_if_missing_is_low": round(len(C0 & low) / len(C0), 3) if C0 else None,
        "kept_if_missing_is_usual": round(len(C0 & med) / len(C0), 3) if C0 else None,
        "kept_both": round(len(C0 & low & med) / len(C0), 3) if C0 else None,
    }


def event_weeks(events: list[dict]) -> list[set[str]]:
    """사건마다 걸친 주(월요일 날짜) 집합. start+days 또는 start+end 형식. 영구 변화(end 없음)는 시작 주만."""
    out = []
    for e in events:
        a = parse_date(e["start"])
        if "days" in e:
            days = int(e["days"])
        elif e.get("end"):
            days = (parse_date(e["end"]) - a).days + 1
        else:
            days = 1
        ws = {monday(a + dt.timedelta(days=i)).isoformat() for i in range(days)}
        out.append(ws)
    return out


def anchors(result: dict, events: list[dict], window: int = 2, n_iter: int = 1000, seed: int = 0) -> dict:
    starts = [w["date_start"] for w in result["weeks"]]
    pos = {s: k for k, s in enumerate(starts)}
    W = len(starts)
    near = np.zeros(W, dtype=bool)
    ev_idx = []
    for ws in event_weeks(events):
        ks = [pos[s] for s in ws if s in pos]
        if not ks:
            continue
        ev_idx.append(ks)
        for k in ks:
            near[max(0, k - window):min(W, k + window + 1)] = True
    cand = np.array([w["candidate"] for w in result["weeks"]])
    judged = np.array([any(v["pr"] is not None for v in w["ind"].values()) for w in result["weeks"]])
    obs = float(cand[near].mean()) if near.any() else 0.0
    far = judged & ~near
    rng = np.random.default_rng(seed)
    null = [float(np.roll(cand, int(rng.integers(0, W)))[near].mean()) for _ in range(n_iter)]
    recall = float(np.mean([cand[max(0, min(ks) - 1):max(ks) + 2].any() for ks in ev_idx])) if ev_idx else None
    return {
        "n_events": len(ev_idx),
        "event_recall_pm1": None if recall is None else round(recall, 3),
        "candidate_share_near_events": round(obs, 3),
        "candidate_share_far": round(float(cand[far].mean()), 3) if far.any() else None,
        "null_mean_near": round(float(np.mean(null)), 3),
        "enrichment": round(obs / np.mean(null), 3) if np.mean(null) > 0 else None,
        "p_value": round(float(np.mean([x >= obs for x in null])), 4),
    }


def chance_rate(result: dict, events: list[dict], guard: int = 3) -> float | None:
    """사건(앞뒤 guard 주)과 영구 변화(시작 앞 guard 주~뒤 8주)에서 먼 주 가운데 판정된 주의 비율."""
    ev = event_weeks([e for e in events if not e.get("persistent")])
    starts = [w["date_start"] for w in result["weeks"]]
    pos = {s: k for k, s in enumerate(starts)}
    near = np.zeros(len(starts), dtype=bool)
    for ws in ev:
        for s in ws:
            if s in pos:
                k = pos[s]
                near[max(0, k - guard):k + guard + 1] = True
    for e in events:
        if e.get("persistent"):
            d = monday(parse_date(e["start"])).isoformat()
            if d in pos:
                k = pos[d]
                near[max(0, k - guard):k + 9] = True
    judged = np.array([any(v["pr"] is not None for v in w["ind"].values()) for w in result["weeks"]], dtype=bool)
    cand = np.array([w["candidate"] for w in result["weeks"]], dtype=bool)
    far = judged & ~near
    return round(float(cand[far].mean()), 3) if far.any() else None


def persistent_boundary_recall(result: dict, events: list[dict], tol: int = 6) -> dict:
    """영구 변화(이사·이직 등) 시작일 앞뒤 tol 주 안에 시기 경계가 있는 비율."""
    bounds = [parse_date(e["start"]) for e in result["eras"]][1:]
    pers = [e for e in events if e.get("persistent")]
    hits = []
    for e in pers:
        d = parse_date(e["start"])
        hits.append(any(abs((b - d).days) <= tol * 7 for b in bounds))
    return {"n": len(pers), "recall": round(float(np.mean(hits)), 3) if pers else None, "n_eras": len(result["eras"])}
