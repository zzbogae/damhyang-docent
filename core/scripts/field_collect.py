"""참가자 평가 보고서(mined.fieldeval/1) 여러 개를 한 표로 모은다. 합성 인물 기준값을 함께 넣을 수 있다.

  core/.venv/bin/python core/scripts/field_collect.py reports/*.json -o docs/field_eval_results.md [--with-synth]

보고서에는 숫자만 있으므로 이 표를 팀과 멘토가 함께 봐도 된다.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core"))
from mined_core.field_eval import field_report  # noqa: E402

SYNTH_KIND = {"hard": "hard", "trip": "good", "busy": "good"}


def synth_report(persona: str) -> dict:
    d = ROOT / "synth" / "out" / persona
    daily = json.loads((d / "truth_daily.json").read_text(encoding="utf-8"))
    meta = json.loads((d / "truth_meta.json").read_text(encoding="utf-8"))
    evs = json.loads((d / "events.json").read_text(encoding="utf-8"))["events"]
    ui = [{"start": e["start"], "end": e.get("end"), "kind": "change" if e.get("persistent") else SYNTH_KIND.get(e["type"], "good")}
          for e in evs]
    rep = field_report(daily, meta, ui, {"quick": True})
    rep["participant"] = f"합성:{persona}"
    rep["seal"] = {"sealed": True, "before_result": True, "seals": 1}
    return rep


def pct(x):
    return "-" if x is None else f"{x * 100:.0f}%"


def num(x, nd=2):
    return "-" if x is None else f"{x:.{nd}f}"


def row(rep: dict) -> list[str]:
    r = rep.get("result", {})
    anc = rep.get("anchors") or {}
    rt = rep.get("ratings") or {}
    hold = {k: v for k, v in (rep.get("holdout") or {}).items() if v.get("lift") is not None}
    best = max(hold.items(), key=lambda kv: kv[1]["lift"]) if hold else None
    seal = rep.get("seal") or {}
    win = rep.get("window") or {}
    return [
        str(rep.get("participant", "?")),
        "예" if seal.get("before_result") else ("뒤에 봉인" if seal.get("sealed") else "안 함"),
        num(rep.get("span", {}).get("years"), 1),
        str(len(rep.get("channels", {}))),
        f"{r.get('n_candidates', '-')} ({pct(r.get('candidate_rate'))})",
        pct(rep.get("chance_rate_far")),
        f"{pct(anc.get('event_recall_pm1'))} / {anc.get('n_events', 0)}건",
        f"{num(anc.get('enrichment'))}배 (p={num(anc.get('p_value'), 3)})" if anc else "-",
        pct((rep.get("persistent_boundaries") or {}).get("recall")),
        f"{pct(rt.get('rate_candidates'))} 대 {pct(rt.get('rate_controls'))} (p={num(rt.get('p_one_sided'), 3)})" if rt.get("n_candidates") else "-",
        f"{best[0]} {num(best[1]['lift'])}" if best else "-",
        f"{num((win.get('26') or {}).get('jaccard_vs_52'))} / {num((win.get('104') or {}).get('jaccard_vs_52'))}",
        pct((rep.get("missing") or {}).get("kept_both")),
    ]


HEAD = ["참가자", "결과 보기 전 봉인", "기간(년)", "채널", "판정 주(판정률)", "사건에서 먼 주 판정률", "사건 재현율(±1주)",
        "사건 앞뒤 집중도", "계속되는 변화 경계 재현율", "가린 평가: 기억남 비율(판정 주 대 평범한 주)", "한 채널 빼기 최고 향상도",
        "창 26/104주 자카드", "결측 가정 바꿔도 유지"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reports", nargs="*")
    ap.add_argument("-o", "--out")
    ap.add_argument("--with-synth", action="store_true")
    a = ap.parse_args()
    reps = []
    for p in a.reports:
        j = json.loads(pathlib.Path(p).read_text(encoding="utf-8"))
        if j.get("schema") != "mined.fieldeval/1":
            print(f"건너뜀(평가 보고서 아님): {p}", file=sys.stderr)
            continue
        reps.append(j)
    if a.with_synth:
        for persona in ("long", "elder", "short"):
            reps.append(synth_report(persona))
    lines = ["| " + " | ".join(HEAD) + " |", "|" + "---|" * len(HEAD)]
    for rep in reps:
        lines.append("| " + " | ".join(row(rep)) + " |")
    out = "\n".join(lines) + "\n"
    if a.out:
        pathlib.Path(a.out).write_text(out, encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
