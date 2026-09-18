"""판정 파이프라인 전체: 일 단위 표 + 채널 메타 → 주 레코드 v7 목록.

CPython CLI 와 브라우저 Pyodide 가 이 함수를 그대로 부른다(run_json).
"""
from __future__ import annotations

import datetime as dt
import json
import math

import numpy as np

from .changepoint import changepoints_with_gaps, deseasonalize, strong_shift
from .coverage import coverage_masks
from .indicators import BY_ID, FAMILIES, INDICATORS
from .judge import DEFAULT_CONFIG, axes_for, make_badges, mineral_shape, rolling_percentile, sentence_for
from .weeks import build_weeks, iso_key

SCHEMA_WEEK = "mined.week/7"
SCHEMA_RESULT = "mined.result/7"


def _r(x, nd=4):
    if x is None:
        return None
    if isinstance(x, float) and math.isnan(x):
        return None
    return round(float(x), nd)


def indicator_arrays(weeks: list[dict], masks: dict[str, list[str]]):
    n = len(weeks)
    V: dict[str, np.ndarray] = {}
    WHY: dict[str, list[str | None]] = {}
    for ind in INDICATORS:
        arr = np.full(n, np.nan)
        why: list[str | None] = [None] * n
        m = masks[ind.family]
        for w in range(n):
            if m[w] != "observed":
                why[w] = "missing"
                continue
            val = ind.compute(weeks[w])
            if val is None:
                why[w] = "no_denominator"
                continue
            arr[w] = val
        V[ind.id] = arr
        WHY[ind.id] = why
    return V, WHY


def consensus_boundaries(CP: dict[str, list[int]], tol: int = 4, min_families: int = 2,
                         DS: dict[str, np.ndarray] | None = None, strong: float = 1.5):
    pts = sorted((c, BY_ID[i].family, i) for i, cs in CP.items() for c in cs)
    clusters: list[dict] = []
    for c, f, i in pts:
        if clusters and c - clusters[-1]["last"] <= tol:
            clusters[-1]["items"].append((c, f, i))
            clusters[-1]["last"] = c
        else:
            clusters.append({"items": [(c, f, i)], "last": c})
    out = []
    for cl in clusters:
        fams = {f for _, f, _ in cl["items"]}
        at = int(np.median([c for c, _, _ in cl["items"]]))
        ids = sorted({i for _, _, i in cl["items"]})
        if len(fams) >= min_families:
            out.append((at, ids))
        elif DS is not None and any(strong_shift(DS[i], c) >= strong for c, _, i in cl["items"]):
            # 한 계열만 바뀌어도 앞뒤 반년 평균이 잡음의 strong 배 이상 차이 나면 경계로 본다(예: 기기 교체)
            out.append((at, ids))
    return out


def build_eras(n: int, mondays: list[dt.date], bounds, candidate: list[bool], min_len: int = 13):
    cuts = [b for b, _ in bounds if 0 < b < n]
    why = {b: ids for b, ids in bounds}
    segs = []
    start = 0
    for c in cuts:
        if c - start < min_len:
            continue
        segs.append((start, c))
        start = c
    segs.append((start, n))
    if len(segs) > 1 and segs[-1][1] - segs[-1][0] < min_len:
        a, _ = segs[-2]
        segs = segs[:-2] + [(a, n)]
    eras = []
    for k, (a, b) in enumerate(segs):
        eras.append({
            "id": f"era-{k + 1:02d}",
            "start": mondays[a].isoformat(),
            "end": (mondays[b - 1] + dt.timedelta(days=6)).isoformat(),
            "start_index": a, "end_index": b,
            "boundary_indicators": why.get(a, []),
            "n_weeks": b - a,
            "n_candidates": int(sum(candidate[a:b])),
        })
    return eras


def similar_weeks(w: int, M: np.ndarray, fam_onehot: np.ndarray, ids: list[str], cfg: dict):
    hi = w - cfg["similar_exclude"]
    if hi <= 0:
        return []
    x = M[w]
    X = M[:hi]
    both = (~np.isnan(X)) & (~np.isnan(x))[None, :]
    cnt = both.sum(1)
    fam_cnt = ((both.astype(int) @ fam_onehot) > 0).sum(1)
    diff = np.where(both, np.abs(np.nan_to_num(X) - np.nan_to_num(x)[None, :]), 0.0)
    dist = diff.sum(1) / np.maximum(cnt, 1)
    ok = (cnt >= cfg["similar_min_shared"]) & (fam_cnt >= cfg["similar_min_families"])
    idx = np.where(ok)[0]
    if len(idx) == 0:
        return []
    order = idx[np.argsort(dist[idx], kind="stable")]
    picked: list[int] = []
    for u in order:
        if all(abs(int(u) - p) >= 4 for p in picked):
            picked.append(int(u))
        if len(picked) >= cfg["similar_top"]:
            break
    out = []
    for u in picked:
        same = []
        for k, iid in enumerate(ids):
            a, b = x[k], M[u, k]
            if np.isnan(a) or np.isnan(b):
                continue
            if a >= 0.8 and b >= 0.8:
                same.append(f"{iid}:up")
            elif a <= 0.2 and b <= 0.2:
                same.append(f"{iid}:down")
        out.append({"index": u, "distance": _r(dist[u]), "shared_families": int(fam_cnt[u]), "same_direction": same})
    return out


def run(daily: list[dict], meta: dict | None = None, config: dict | None = None) -> dict:
    meta = meta or {}
    cfg = {**DEFAULT_CONFIG, **(config or {})}
    mondays, weeks, ranges = build_weeks(daily, meta)
    n = len(weeks)
    if n == 0:
        return {"schema": SCHEMA_RESULT, "config": cfg, "weeks": [], "eras": [], "episodes": [], "summary": {"n_weeks": 0}}
    masks, cov_info = coverage_masks(mondays, weeks, meta, cfg.get("gap_detection", True))
    V, WHY = indicator_arrays(weeks, masks)
    woy = [m.isocalendar()[1] for m in mondays]
    CP = {ind.id: changepoints_with_gaps(V[ind.id], ind.kind, cfg["cp_k"], cfg["cp_min_size"],
                                         woy if cfg.get("cp_deseason", True) else None) for ind in INDICATORS}
    # 강한 단일 변화(효과 크기)도 시기 경계 후보로 쓰기 위해 계절을 뺀 수열을 남긴다
    DS = {}
    for ind in INDICATORS:
        v = np.log1p(V[ind.id]) if ind.kind == "count" else V[ind.id].astype(float)
        DS[ind.id] = deseasonalize(v, woy) if cfg.get("cp_deseason", True) else v
    P: dict[str, dict] = {}
    for ind in INDICATORS:
        R = rolling_percentile(V[ind.id], cfg["window"], cfg["min_base"], CP[ind.id] if cfg["cp_restart"] else None,
                               detrend=cfg["detrend"], log=(ind.kind == "count"))
        for w in range(n):
            if WHY[ind.id][w]:
                R["why"][w] = WHY[ind.id][w]
        P[ind.id] = R

    badges = [make_badges(w, P, cfg) for w in range(n)]
    candidate = [len(b) >= 2 or (cfg["single_extreme_candidate"] and any(x["extreme"] == 2 for x in b)) for b in badges]
    merge = cfg.get("family_merge") or {}

    # 멘토 질문 ②: 이 사람 기록에서 계열이 달라도 함께 움직이는 지표 쌍(|ρ| ≥ link_rho)은 근거 하나로 센다.
    # 파일 단위 규칙(측정 오류가 겹치는 범위)은 그대로 두고, 같은 정보를 두 번 세는 것만 막는다.
    ids_all = [i.id for i in INDICATORS]
    PRM = np.column_stack([P[i]["pr"] for i in ids_all])
    linked: dict[tuple[str, str], float] = {}
    if cfg.get("auto_link", True):
        thr = float(cfg.get("link_rho", 0.6))
        min_n = int(cfg.get("link_min_weeks", 52))
        for a in range(len(ids_all)):
            for b in range(a + 1, len(ids_all)):
                ia, ib = ids_all[a], ids_all[b]
                if BY_ID[ia].family == BY_ID[ib].family:
                    continue
                m = ~np.isnan(PRM[:, a]) & ~np.isnan(PRM[:, b])
                if m.sum() < min_n:
                    continue
                x, y = PRM[m, a], PRM[m, b]
                if x.std() == 0 or y.std() == 0:
                    continue
                r = float(np.corrcoef(x, y)[0, 1])
                if abs(r) >= thr:
                    linked[(ia, ib)] = linked[(ib, ia)] = round(r, 3)

    def groups_of(bs):
        """배지를 근거 묶음으로 나눈다: 같은 계열(또는 family_merge)이거나 함께 움직이는 지표 쌍이면 한 묶음."""
        parent = list(range(len(bs)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        fam = [merge.get(b["family"], b["family"]) for b in bs]
        for i in range(len(bs)):
            for j in range(i + 1, len(bs)):
                if fam[i] == fam[j] or (bs[i]["indicator"], bs[j]["indicator"]) in linked:
                    parent[find(i)] = find(j)
        comps: dict[int, set[str]] = {}
        for i in range(len(bs)):
            comps.setdefault(find(i), set()).add(fam[i])
        return sorted(sorted(c) for c in comps.values())

    def linked_in(bs):
        out = []
        for i in range(len(bs)):
            for j in range(i + 1, len(bs)):
                k = (bs[i]["indicator"], bs[j]["indicator"])
                if k in linked:
                    out.append({"a": k[0], "b": k[1], "rho": linked[k]})
        return out

    H, RUN = cfg["tier_horizon"], cfg["tier_run"]

    def is_normal(t: int, fams: set[str]) -> bool:
        if candidate[t]:
            return False
        if any(b["family"] in fams for b in badges[t]):
            return False
        return any(not np.isnan(P[i.id]["pr"][t]) for i in INDICATORS if i.family in fams)

    def tier_as_of(w: int, t_end: int, fams: set[str], extreme2: bool):
        run_len = 0
        start = None
        for t in range(w + 1, min(t_end, w + H + RUN - 1) + 1):
            if is_normal(t, fams):
                if run_len == 0:
                    start = t
                run_len += 1
                if run_len >= RUN and start - w <= H:
                    return ("observed", None) if extreme2 else ("recovered", start - w)
            else:
                run_len = 0
        if t_end >= w + H + RUN - 1:
            return "passed", None
        return "observed", None

    # 에피소드: 판정된 주 사이 간격이 episode_gap 주 이하면 하나의 이어진 변화로 묶는다(2주 이상일 때만)
    gap = int(cfg.get("episode_gap", 2))
    cand_idx = [w for w in range(n) if candidate[w]]
    groups: list[list[int]] = []
    for w in cand_idx:
        if groups and w - groups[-1][-1] <= gap:
            groups[-1].append(w)
        else:
            groups.append([w])
    episodes = []
    ep_of: list[str | None] = [None] * n
    for g in groups:
        if len(g) < 2:
            continue
        eid = f"ep-{len(episodes) + 1:03d}"
        fams = sorted({b["family"] for w in g for b in badges[w]})
        top = max((b for w in g for b in badges[w]), key=lambda b: (b["extreme"], abs(b["pr"] - 0.5)))
        episodes.append({
            "id": eid,
            "weeks": [iso_key(mondays[w]) for w in g],
            "date_start": mondays[g[0]].isoformat(),
            "date_end": (mondays[g[-1]] + dt.timedelta(days=6)).isoformat(),
            "span_weeks": g[-1] - g[0] + 1,
            "families": fams,
            "strongest": {"indicator": top["indicator"], "label": top["label"], "direction": top["direction"]},
        })
        for w in range(g[0], g[-1] + 1):
            ep_of[w] = eid

    bounds = consensus_boundaries(CP, DS=DS, strong=cfg.get("era_strong_shift", 1.5))
    eras = build_eras(n, mondays, bounds, candidate)
    for k, e in enumerate(eras):
        lv = {}
        for ind in INDICATORS:
            if not ind.gauge and ind.id not in ("memo_night", "yt_night"):
                continue
            seg = V[ind.id][e["start_index"]:e["end_index"]]
            seg = seg[~np.isnan(seg)]
            lv[ind.id] = None if len(seg) < 8 else round(float(np.median(seg)), 3)
        e["levels"] = lv
        if k > 0:
            prev = eras[k - 1]["levels"]
            ch = {}
            for i, x in lv.items():
                y = prev.get(i)
                if x is None or y is None:
                    continue
                floor = 0.05 if BY_ID[i].kind == "ratio" else 1.0
                if abs(y) >= floor:
                    r = (x - y) / abs(y)
                    if abs(r) >= 0.15:
                        ch[i] = {"from": y, "to": x, "ratio": round(r, 3)}
                elif abs(x) >= floor:
                    ch[i] = {"from": y, "to": x, "ratio": None}
            e["change_vs_prev"] = ch
    era_of = [None] * n
    for e in eras:
        for k in range(e["start_index"], e["end_index"]):
            era_of[k] = e["id"]

    ids = [i.id for i in INDICATORS]
    M = np.column_stack([P[i]["pr"] for i in ids])
    fam_onehot = np.zeros((len(ids), len(FAMILIES)), dtype=int)
    for k, i in enumerate(ids):
        fam_onehot[k, FAMILIES.index(BY_ID[i].family)] = 1
    last_obs = max((w for w in range(n) if not np.all(np.isnan(M[w]))), default=n - 1)
    sim_targets = set(w for w in range(n) if candidate[w]) | set(range(max(0, last_obs - 3), last_obs + 1))

    out_weeks = []
    tiers_count = {"recovered": 0, "passed": 0, "observed": 0}
    for w in range(n):
        mon = mondays[w]
        bs = badges[w]
        fams = {b["family"] for b in bs}
        groups = groups_of(bs)
        cross = len(groups) >= 2
        tier = None
        after = None
        history = []
        if candidate[w]:
            ext2 = any(b["extreme"] == 2 for b in bs)
            prev = None
            for t_end in range(w, min(n - 1, w + H + RUN - 1) + 1):
                tr, af = tier_as_of(w, t_end, fams, ext2)
                if tr != prev:
                    history.append({"as_of": (mondays[t_end] + dt.timedelta(days=6)).isoformat(), "tier": tr})
                    prev = tr
                tier, after = tr, af
            tiers_count[tier] += 1
        score = sum(2 if b["extreme"] == 2 else (1 if b["extreme"] == 1 else 0) for b in bs)
        mineral, shape = mineral_shape(bs) if candidate[w] else (None, None)
        sim = []
        if w in sim_targets:
            for s in similar_weeks(w, M, fam_onehot, ids, cfg):
                u = s.pop("index")
                s["week"] = iso_key(mondays[u])
                sim.append(s)
        ind_out = {}
        for i in ids:
            R = P[i]
            p = R["pr"][w]
            ind_out[i] = {
                "v": _r(V[i][w], 3),
                "pr": _r(p),
                "n_base": int(R["n_base"][w]),
                "rank_low": None if np.isnan(p) else int(R["less"][w]) + 1,
                "rank_high": None if np.isnan(p) else int(R["gr"][w]) + 1,
                "why": R["why"][w],
            }
        out_weeks.append({
            "schema": SCHEMA_WEEK,
            "week": iso_key(mon),
            "date_start": mon.isoformat(),
            "date_end": (mon + dt.timedelta(days=6)).isoformat(),
            "candidate": bool(candidate[w]),
            "coverage": {ch: masks[ch][w] for ch in FAMILIES},
            "ind": ind_out,
            "axes": axes_for(w, P),
            "badges": bs if candidate[w] else bs,
            "evidence": {"families": sorted(fams), "independent": len(groups), "cross_validated": bool(cross and candidate[w]),
                         **({"linked": linked_in(bs)} if candidate[w] and linked_in(bs) else {})},
            "tier": tier,
            "tier_history": history,
            "recovered_after": after,
            "access": "confirm" if (candidate[w] and score >= 2) else "auto",
            "era": era_of[w],
            "episode": ep_of[w] if candidate[w] else None,
            "mineral": mineral,
            "shape": shape,
            "similar": sim,
            "sentence": sentence_for(mon, bs, tier, after, cross, bool(linked_in(bs))) if candidate[w] else None,
        })

    n_cand = int(sum(candidate))
    n_cross = sum(1 for x in out_weeks if x["evidence"]["cross_validated"])
    summary = {
        "n_weeks": n,
        "first_week": iso_key(mondays[0]),
        "last_week": iso_key(mondays[-1]),
        "n_candidates": n_cand,
        "n_cross": n_cross,
        "n_single_source": n_cand - n_cross,
        "tiers": tiers_count,
        "n_confirm": sum(1 for x in out_weeks if x["access"] == "confirm"),
        "coverage": {ch: {"observed_weeks": cov_info[ch]["observed_weeks"],
                          "share": round(cov_info[ch]["observed_weeks"] / n, 3),
                          **{k: v for k, v in cov_info[ch].items() if k != "observed_weeks"}} for ch in FAMILIES},
        "changepoints": {i: [iso_key(mondays[c]) for c in cs] for i, cs in CP.items() if cs},
        "n_eras": len(eras),
        "linked_pairs": sorted(({"a": a, "b": b, "rho": r} for (a, b), r in linked.items() if a < b), key=lambda x: -abs(x["rho"])),
    }
    if cfg.get("null_iter"):
        from .validate import circular_null
        summary["cross_null"] = circular_null({"weeks": out_weeks}, n_iter=int(cfg["null_iter"]))
    for e in episodes:
        e["tier"] = next((x["tier"] for x in reversed(out_weeks) if x["week"] in set(e["weeks"])), None)
    summary["n_episodes"] = len(episodes)
    return {"schema": SCHEMA_RESULT, "config": cfg, "weeks": out_weeks, "eras": eras, "episodes": episodes, "summary": summary}


def run_json(daily_json: str, meta_json: str = "{}", config_json: str = "{}") -> str:
    """Pyodide 진입점: 문자열로 받고 문자열로 돌려준다."""
    return json.dumps(run(json.loads(daily_json), json.loads(meta_json or "{}"), json.loads(config_json or "{}")),
                      ensure_ascii=False)
