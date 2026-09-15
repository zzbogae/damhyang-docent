"""합성 인물 세 명으로 판정 코어를 평가하고 docs/eval.md 를 만든다.

  core/.venv/bin/python core/scripts/eval_all.py [--quick]
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys
import time

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core"))
from mined_core import evaluate, run, validate  # noqa: E402
from mined_core.weeks import monday, parse_date  # noqa: E402

QUICK = "--quick" in sys.argv
PERSONAS = ["long", "elder", "short"]
CONFIGS = {
    "기본(v7)": {},
    "추세 보정 끔": {"detrend": False},
    "배지 기준 5%": {"q_badge": 0.05, "q_extreme": 0.02},
    "배지 하나 극단도 판정": {"single_extreme_candidate": True},
    "변화점 뒤 기준 재시작": {"cp_restart": True},
}


def load(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def gap_accuracy(result, truth_gaps):
    out = {}
    starts = [w["date_start"] for w in result["weeks"]]
    for ch, spans in truth_gaps.items():
        truth = set()
        for a, b in spans:
            a, b = parse_date(a), parse_date(b)
            k = monday(a)
            while k <= b:
                # 주의 대부분(5일 이상)이 공백일 때만 정답 공백 주로 센다
                days = sum(1 for i in range(7) if a <= k + dt.timedelta(days=i) <= b)
                if days >= 5:
                    truth.add(k.isoformat())
                k += dt.timedelta(days=7)
        det = {w["date_start"] for w in result["weeks"] if w["coverage"][ch] == "structural_missing"}
        det &= set(starts)
        rng = [w["date_start"] for w in result["weeks"] if w["coverage"][ch] != "structural_missing" or w["date_start"] in truth]
        inside = {s for s in det if s >= min(truth or {starts[0]}) and s <= max(truth or {starts[-1]})}
        tp = len(truth & det)
        out[ch] = {"truth_weeks": len(truth), "detected_in_truth": tp,
                   "recall": round(tp / len(truth), 3) if truth else None,
                   "detected_inside_range_not_truth": len(inside - truth)}
    return out


def main():
    report = {}
    t0 = time.time()
    for p in PERSONAS:
        d = ROOT / "synth" / "out" / p
        daily, meta, ev = load(d / "truth_daily.json"), load(d / "truth_meta.json"), load(d / "events.json")
        events = ev["events"]
        transient = [e for e in events if not e.get("persistent")]
        rp = {"n_events": len(events), "n_transient": len(transient), "configs": {}}
        for name, cfg in CONFIGS.items():
            res = run(daily, meta, cfg)
            s = res["summary"]
            anc = evaluate.anchors(res, transient)
            rp["configs"][name] = {
                "n_weeks": s["n_weeks"], "n_candidates": s["n_candidates"], "n_cross": s["n_cross"],
                "chance_rate_far": evaluate.chance_rate(res, events),
                "event_recall": anc["event_recall_pm1"], "enrichment": anc["enrichment"],
                "cross_null": s.get("cross_null"),
                "tiers": s["tiers"],
            }
            if name == "기본(v7)":
                base = res
        cfg = {}
        rp["gap_detection"] = gap_accuracy(base, ev.get("structural_gaps", {}))
        rp["persistent_boundaries"] = evaluate.persistent_boundary_recall(base, events)
        vr = validate.report(base, n_iter=200 if QUICK else 1000)
        vr.pop("corr", None)
        rp["validate"] = vr
        rp["holdout"] = evaluate.holdout(daily, meta, cfg, full=base, n_boot=200 if QUICK else 1000)
        ev_weeks = set().union(*evaluate.event_weeks(events)) if events else set()
        avoid = {w["week"] for w in base["weeks"] if w["date_start"] in ev_weeks}
        rp["injection_hard"] = evaluate.injection(daily, meta, cfg, pattern="hard", runs=1 if QUICK else 3, avoid=avoid)
        rp["injection_steps"] = evaluate.injection(daily, meta, cfg, pattern="steps", runs=1 if QUICK else 3, avoid=avoid)
        rp["window"] = evaluate.window_sensitivity(daily, meta, cfg, base=base)
        rp["missing"] = evaluate.missing_sensitivity(daily, meta, cfg, base=base)
        report[p] = rp
        print(p, "done", round(time.time() - t0, 1), "s", flush=True)
    out = ROOT / "out" / "eval"
    out.mkdir(parents=True, exist_ok=True)
    (out / "eval_all.json").write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({p: {k: v for k, v in r.items() if k in ("configs",)} for p, r in report.items()}, ensure_ascii=False)[:3000])


if __name__ == "__main__":
    main()
