"""명령줄: 판정·검증·평가.

  mined judge daily.json meta.json -o result.json [--set q_badge=0.03 --set cp_restart=true]
  mined validate result.json
  mined eval synth/out/long -o report.json [--quick]
  mined field daily.json meta.json events.json -o report.json [--quick]   (참가자 평가 보고서, 숫자만)
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time

from . import evaluate, field_eval, validate
from .run import run


def _cfg(pairs: list[str] | None) -> dict:
    out = {}
    for p in pairs or []:
        k, v = p.split("=", 1)
        try:
            out[k] = json.loads(v)
        except json.JSONDecodeError:
            out[k] = v
    return out


def _load(p: str):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def cmd_judge(a):
    res = run(_load(a.daily), _load(a.meta) if a.meta else {}, _cfg(a.set))
    s = json.dumps(res, ensure_ascii=False)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(json.dumps(res["summary"], ensure_ascii=False, indent=1))


def cmd_validate(a):
    print(json.dumps(validate.report(_load(a.result), n_iter=a.iter), ensure_ascii=False, indent=1))


def cmd_eval(a):
    d = pathlib.Path(a.persona)
    daily = _load(d / "truth_daily.json")
    meta = _load(d / "truth_meta.json")
    events = _load(d / "events.json") if (d / "events.json").exists() else []
    if isinstance(events, dict):
        events = events.get("events", [])
    cfg = _cfg(a.set)
    t0 = time.time()
    full = run(daily, meta, cfg)
    rep = {"persona": d.name, "config": cfg, "summary": full["summary"]}
    rep["validate"] = validate.report(full, n_iter=200 if a.quick else 1000)
    rep["validate"].pop("corr", None)
    if events:
        rep["anchors"] = evaluate.anchors(full, events)
    rep["holdout"] = evaluate.holdout(daily, meta, cfg, full=full, n_boot=200 if a.quick else 1000)
    ev_weeks = set().union(*evaluate.event_weeks(events)) if events else set()
    avoid = {w["week"] for w in full["weeks"] if w["date_start"] in ev_weeks}
    rep["injection_hard"] = evaluate.injection(daily, meta, cfg, pattern="hard", runs=1 if a.quick else 3, avoid=avoid)
    rep["injection_steps"] = evaluate.injection(daily, meta, cfg, pattern="steps", runs=1 if a.quick else 3, avoid=avoid)
    rep["window"] = evaluate.window_sensitivity(daily, meta, cfg)
    rep["missing"] = evaluate.missing_sensitivity(daily, meta, cfg)
    rep["seconds"] = round(time.time() - t0, 1)
    s = json.dumps(rep, ensure_ascii=False, indent=1)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(s)


def cmd_field(a):
    events = _load(a.events) if a.events else []
    if isinstance(events, dict):
        events = events.get("events", [])
    rep = field_eval.field_report(_load(a.daily), _load(a.meta), events, {"quick": a.quick, "config": _cfg(a.set)},
                                  progress=lambda s: print(f"  {s}", file=sys.stderr, flush=True))
    s = json.dumps(rep, ensure_ascii=False, indent=1)
    if a.out:
        pathlib.Path(a.out).write_text(s, encoding="utf-8")
    print(s)


def main(argv=None):
    ap = argparse.ArgumentParser(prog="mined")
    sub = ap.add_subparsers(dest="cmd", required=True)
    j = sub.add_parser("judge")
    j.add_argument("daily")
    j.add_argument("meta", nargs="?")
    j.add_argument("-o", "--out")
    j.add_argument("--set", action="append")
    j.set_defaults(fn=cmd_judge)
    v = sub.add_parser("validate")
    v.add_argument("result")
    v.add_argument("--iter", type=int, default=1000)
    v.set_defaults(fn=cmd_validate)
    e = sub.add_parser("eval")
    e.add_argument("persona")
    e.add_argument("-o", "--out")
    e.add_argument("--set", action="append")
    e.add_argument("--quick", action="store_true")
    e.set_defaults(fn=cmd_eval)
    f = sub.add_parser("field")
    f.add_argument("daily")
    f.add_argument("meta")
    f.add_argument("events", nargs="?")
    f.add_argument("-o", "--out")
    f.add_argument("--set", action="append")
    f.add_argument("--quick", action="store_true")
    f.set_defaults(fn=cmd_field)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
