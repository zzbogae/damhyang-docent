"""insufficient 기준(tier_min_obs) 실측: 합성 인물 기록에 주 단위 공백을 넣고, 공백 없는 기록의 등급과 견준다.

  core/.venv/bin/python core/scripts/insufficient_sweep.py

공백을 넣은 기록에서 not_returned(「돌아오지 않았다」)라고 했는데 공백 없는 기록에서는 돌아왔던 주(held·broken·returned)는
기록이 비어서 생긴 거짓 진술이다. 기준을 높이면 그런 주가 insufficient 로 빠지지만, 그만큼 말할 수 있는 주도 준다.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core"))
from mined_core import run  # noqa: E402
from mined_core.indicators import FAMILIES  # noqa: E402

THRESHOLDS = [0.25, 0.5, 0.75, 1.0]
GAP_RATES = [0.1, 0.2, 0.3]
RETURNED = {"held", "broken", "returned"}


def with_gaps(daily, meta, rate, seed):
    rng = np.random.default_rng(seed)
    days = sorted({r["date"] for r in daily})
    d0 = dt.date.fromisoformat(days[0])
    n_weeks = (dt.date.fromisoformat(days[-1]) - d0).days // 7 + 1
    drop = np.zeros(n_weeks, bool)
    w = 0
    while w < n_weeks:  # 1~3주짜리 공백 덩어리
        if rng.random() < rate / 2:
            k = int(rng.integers(1, 4))
            drop[w:w + k] = True
            w += k
        w += 1
    spans = []
    for i in np.where(drop)[0]:
        a = d0 + dt.timedelta(days=7 * int(i))
        spans.append([a.isoformat(), (a + dt.timedelta(days=6)).isoformat()])
    gone = {s for a, b in spans for s in [(dt.date.fromisoformat(a) + dt.timedelta(days=k)).isoformat() for k in range(7)]}
    rows = [r for r in daily if r["date"] not in gone]
    m = json.loads(json.dumps(meta))
    m["gaps"] = {ch: spans for ch in FAMILIES}
    return rows, m, float(drop.mean())


SEEDS = [11, 12, 13, 14, 15]


def main():
    tot = {t: {"cand": 0, "ins": 0, "nr": 0, "lie": 0} for t in THRESHOLDS}
    for persona in ("long", "elder"):
        d = ROOT / "synth" / "out" / persona
        daily = json.loads((d / "truth_daily.json").read_text(encoding="utf-8"))
        meta = json.loads((d / "truth_meta.json").read_text(encoding="utf-8"))
        full = {w["week"]: w["grade"] for w in run(daily, meta, {"null_iter": 0})["weeks"] if w["candidate"]}
        for rate in GAP_RATES:
            for seed in SEEDS:
                rows, m, _ = with_gaps(daily, meta, rate, seed=seed)
                for thr in THRESHOLDS:
                    res = run(rows, m, {"null_iter": 0, "tier_min_obs": thr})
                    c = [w for w in res["weeks"] if w["candidate"] and w["week"] in full]
                    nr = [w for w in c if w["grade"] == "not_returned"]
                    t = tot[thr]
                    t["cand"] += len(c)
                    t["ins"] += sum(1 for w in c if w["grade"] == "insufficient")
                    t["nr"] += len(nr)
                    t["lie"] += sum(1 for w in nr if full[w["week"]] in RETURNED)
    lines = [f"합성 인물 long·elder × 공백 비율 {GAP_RATES} × 씨앗 {len(SEEDS)}개 합계", "",
             "| 기준(관측 비율) | 판정 주 | insufficient | not_returned | 그중 거짓(원래는 돌아옴) |", "|---|---|---|---|---|"]
    for thr, t in tot.items():
        lines.append(f"| {thr} | {t['cand']} | {t['ins']} ({t['ins'] / t['cand']:.1%}) | {t['nr']} | {t['lie']} |")
    out = "\n".join(lines)
    print(out)
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out" / "insufficient_sweep.md").write_text(out + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
