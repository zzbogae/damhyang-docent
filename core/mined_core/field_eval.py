"""참가자 평가 보고서(실제 기록 평가). 기록 주인의 기기 안에서 계산하고, 밖으로 보내는 보고서에는 숫자만 담는다.

입력
- daily, meta: 일 단위 표와 채널 메타(docs/contract.md)
- events: 참가자가 결과를 보기 전에 적어 둔 사건. [{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"?, "kind": "hard"|"good"|"change"}]
  change(이사·이직·입학처럼 계속되는 변화)는 시기 경계 재현율에, 나머지는 사건 집중도와 재현율에 쓴다.
- opts: {"quick": 설정 비교·이상 주입을 건너뛴다, "config": 판정 설정 덮어쓰기}

출력 스키마는 mined.fieldeval/1 이다. 날짜(YYYY-MM-DD, YYYY-Www)가 섞이면 보고서를 만들지 않는다(닫힌 쪽 실패).
브라우저(Pyodide)와 명령줄(CPython)이 같은 함수를 부른다.
"""
from __future__ import annotations

import json
import re
import time

import numpy as np

from . import VERSION
from . import evaluate
from .indicators import FAMILIES
from .run import run
from .validate import meff, pr_matrix, spearman_pairwise

REPORT_SCHEMA = "mined.fieldeval/1"
KINDS = ("hard", "good", "change")

# docs/eval.md 의 설정 비교와 같은 대안(기본값과 견줄 것만)
ALT_CONFIGS = {
    "no_detrend": {"detrend": False},
    "q_badge_5pct": {"q_badge": 0.05, "q_extreme": 0.02},
    "single_extreme": {"single_extreme_candidate": True},
}

_DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}")


def normalize_events(events: list[dict]) -> list[dict]:
    """화면에서 적은 사건을 evaluate 모듈이 읽는 모양으로 바꾼다. 알 수 없는 종류와 날짜가 빠진 사건은 버린다."""
    out = []
    for e in events or []:
        kind = e.get("kind")
        start = str(e.get("start") or "")
        if kind not in KINDS or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", start):
            continue
        end = e.get("end")
        if kind != "change" and end and re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(end)) and str(end) >= start:
            out.append({"start": start, "end": str(end), "type": kind, "persistent": False})
        else:
            out.append({"start": start, "days": 1 if kind == "change" else 7, "type": kind, "persistent": kind == "change"})
    return out


def find_dates(obj, path: str = "") -> list[str]:
    """보고서 안에서 날짜처럼 보이는 문자열의 위치를 모두 찾는다(키 이름 포함)."""
    hits = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if _DATE_RE.search(str(k)):
                hits.append(f"{path}/{k}(key)")
            hits += find_dates(v, f"{path}/{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            hits += find_dates(v, f"{path}[{i}]")
    elif isinstance(obj, str) and _DATE_RE.search(obj):
        hits.append(path)
    return hits


def _judged_weeks(result: dict) -> int:
    return sum(1 for w in result["weeks"] if any(v["pr"] is not None for v in w["ind"].values()))


def _brief(result: dict, events: list[dict]) -> dict:
    transient = [e for e in events if not e["persistent"]]
    anc = evaluate.anchors(result, transient, n_iter=500) if transient else None
    s = result["summary"]
    return {
        "n_candidates": s["n_candidates"],
        "n_cross": s["n_cross"],
        "chance_rate_far": evaluate.chance_rate(result, events) if events else None,
        "event_recall_pm1": anc["event_recall_pm1"] if anc else None,
        "enrichment": anc["enrichment"] if anc else None,
    }


def field_report(daily: list[dict], meta: dict, events: list[dict], opts: dict | None = None, progress=None) -> dict:
    opts = {"quick": False, **(opts or {})}
    say = progress or (lambda _s: None)
    cfg = dict(opts.get("config") or {})
    quick = bool(opts.get("quick"))
    ev = normalize_events(events)
    transient = [e for e in ev if not e["persistent"]]
    persistent = [e for e in ev if e["persistent"]]
    t0 = time.time()

    say("판정 다시 하는 중")
    full = run(daily, meta, cfg)
    s = full["summary"]
    n_weeks = s.get("n_weeks", 0)
    if not n_weeks:
        raise ValueError("판정할 주가 없습니다")
    judged = _judged_weeks(full)
    ch_meta = (meta or {}).get("channels") or {}
    channels = {}
    for ch in FAMILIES:
        c = s["coverage"][ch]
        if not c["observed_weeks"]:
            continue
        channels[ch] = {
            "observed_weeks": c["observed_weeks"],
            "share": c["share"],
            "gaps_found": c.get("gaps"),
            "sources": sorted(str(x) for x in (ch_meta.get(ch) or {}).get("sources", [])),
        }
    badge_families: dict[str, int] = {}
    for w in full["weeks"]:
        if w["candidate"]:
            for f in w["evidence"]["families"]:
                badge_families[f] = badge_families.get(f, 0) + 1

    rep: dict = {
        "schema": REPORT_SCHEMA,
        "core_version": VERSION,
        "mode": "quick" if quick else "full",
        "config": {k: v for k, v in full["config"].items() if isinstance(v, (int, float, bool, str)) or v is None},
        "span": {"n_weeks": n_weeks, "years": round(n_weeks / 52.18, 1), "judged_weeks": judged},
        "channels": channels,
        "result": {
            "n_candidates": s["n_candidates"],
            "n_cross": s["n_cross"],
            "n_single_source": s["n_single_source"],
            "candidate_rate": round(s["n_candidates"] / judged, 3) if judged else None,
            "tiers": s["tiers"],
            "n_confirm": s["n_confirm"],
            "n_eras": s["n_eras"],
            "n_episodes": s.get("n_episodes", 0),
            "cross_null": s.get("cross_null"),
            "families_in_candidates": dict(sorted(badge_families.items())),
            "linked_pairs": s.get("linked_pairs", []),
        },
        "events": {
            "n": len(ev),
            "by_kind": {k: sum(1 for e in ev if e["type"] == k) for k in KINDS},
            "dropped": len(events or []) - len(ev),
        },
    }

    say("사건 앞뒤에 판정이 몰리는지 보는 중")
    if transient:
        rep["anchors"] = evaluate.anchors(full, transient)
        rep["anchors_by_kind"] = {}
        for k in ("hard", "good"):
            sub = [e for e in transient if e["type"] == k]
            if sub:
                a = evaluate.anchors(full, sub, n_iter=500)
                rep["anchors_by_kind"][k] = {x: a[x] for x in ("n_events", "event_recall_pm1", "enrichment", "p_value")}
    if ev:
        rep["chance_rate_far"] = evaluate.chance_rate(full, ev)
    if persistent:
        rep["persistent_boundaries"] = evaluate.persistent_boundary_recall(full, ev)

    say("계열 사이 상관 계산 중")
    ids, M = pr_matrix(full)
    C = spearman_pairwise(M)
    live = [k for k in range(len(ids)) if np.sum(~np.isnan(M[:, k])) >= 30]
    rep["meff_all"] = meff(C[np.ix_(live, live)])

    say("채널 하나씩 빼고 판정하는 중")
    rep["holdout"] = evaluate.holdout(daily, meta, cfg, full=full, n_boot=200 if quick else 1000)
    say("창 길이를 바꿔 판정하는 중")
    rep["window"] = evaluate.window_sensitivity(daily, meta, cfg, base=full)
    say("결측 가정을 바꿔 판정하는 중")
    rep["missing"] = evaluate.missing_sensitivity(daily, meta, cfg, base=full)

    if not quick:
        say("평소 주에 변화를 넣어 찾는지 보는 중")
        ev_weeks = set().union(*evaluate.event_weeks(ev)) if ev else set()
        avoid = {w["week"] for w in full["weeks"] if w["date_start"] in ev_weeks}
        rep["injection_hard"] = evaluate.injection(daily, meta, cfg, magnitudes=(0.2, 0.3, 0.5), pattern="hard",
                                                   runs=1, avoid=avoid, base=full)
        rep["configs"] = {"default": _brief(full, ev)}
        for name, alt in ALT_CONFIGS.items():
            say(f"설정 비교 중 ({name})")
            rep["configs"][name] = _brief(run(daily, meta, {**cfg, **alt}), ev)

    rep["seconds"] = round(time.time() - t0, 1)
    leaks = find_dates(rep)
    if leaks:
        raise ValueError(f"보고서에 날짜가 섞였습니다: {leaks[:5]}")
    return rep


def field_report_json(daily_json: str, meta_json: str, events_json: str, opts_json: str = "{}", progress=None) -> str:
    """Pyodide 진입점."""
    return json.dumps(field_report(json.loads(daily_json), json.loads(meta_json or "{}"), json.loads(events_json or "[]"),
                                   json.loads(opts_json or "{}"), progress), ensure_ascii=False)
