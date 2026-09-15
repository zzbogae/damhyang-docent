import json
import time

import numpy as np
import pytest

from mined_core import run, run_json
from mined_core.changepoint import pelt_l2
from mined_core.judge import rank_phrase, rolling_percentile

from .fixtures import make_daily


def test_mid_rank_percentile_zero_inflated():
    # 88% 가 0인 지표: 0인 주는 중간 순위를 받아 백분위가 0이나 0.88 로 튀지 않는다
    rng = np.random.default_rng(1)
    v = np.where(rng.random(200) < 0.88, 0.0, rng.integers(1, 5, 200)).astype(float)
    v[150] = 0.0
    R = rolling_percentile(v, 52, 26)
    b = v[98:150]
    expect = (np.sum(b < 0) + 0.5 * np.sum(b == 0)) / len(b)
    assert R["pr"][150] == pytest.approx(expect)
    assert 0.3 < R["pr"][150] < 0.6


def test_baseline_short_and_missing():
    v = np.arange(40, dtype=float)
    v[35] = np.nan
    R = rolling_percentile(v, 52, 26)
    assert R["why"][10] == "baseline_short"
    assert R["why"][35] == "missing"
    assert R["pr"][30] == 1.0  # 증가 수열: 직전 기준 전체보다 크다


def test_rank_phrase():
    assert rank_phrase(1, 52) == "직전 52주 중 가장"
    assert rank_phrase(4, 50) == "직전 50주 중 네 번째로"
    assert rank_phrase(12, 52) == "직전 52주 중 12번째로"


def test_pelt_matches_ruptures():
    ruptures = pytest.importorskip("ruptures")
    rng = np.random.default_rng(3)
    x = np.concatenate([rng.normal(0, 1, 120), rng.normal(3, 1, 80), rng.normal(-1, 1, 100)])
    pen = 3 * np.log(len(x))
    ours = pelt_l2(x, pen, min_size=8)
    theirs = ruptures.Pelt(model="l2", min_size=8, jump=1).fit(x).predict(pen=pen)[:-1]
    assert ours == theirs


def test_run_end_to_end_detects_hard_weeks():
    events = [("2022-03-07", 7, "hard"), ("2023-05-15", 7, "hard"), ("2022-09-12", 7, "trip")]
    rows, meta = make_daily(years=4, events=events)
    t = time.time()
    res = run(rows, meta)
    elapsed = time.time() - t
    assert res["schema"] == "mined.result/7"
    wk = {w["week"]: w for w in res["weeks"]}
    for key in ["2022-W10", "2023-W20", "2022-W37"]:
        assert wk[key]["candidate"], key
        assert wk[key]["evidence"]["cross_validated"], key
        assert wk[key]["sentence"].startswith(wk[key]["date_start"][:4] + "년")
    hard = wk["2022-W10"]
    dirs = {b["indicator"]: b["direction"] for b in hard["badges"]}
    assert dirs.get("steps") == "down"
    assert dirs.get("sleep") == "down"
    s = res["summary"]
    assert 0 < s["n_candidates"] < s["n_weeks"] * 0.4
    assert elapsed < 20


def test_structural_gap_is_not_zero():
    rows, meta = make_daily(years=4, gap=("photo", "2021-03-01", "2021-10-31"))
    res = run(rows, meta)
    wk = {w["week"]: w for w in res["weeks"]}
    assert wk["2021-W20"]["coverage"]["photo"] == "structural_missing"
    assert wk["2021-W20"]["ind"]["photo_n"]["pr"] is None
    assert wk["2020-W30"]["coverage"]["photo"] == "observed"
    # 공백 구간은 판정 근거가 되지 않는다
    for key in ["2021-W12", "2021-W30", "2021-W40"]:
        assert not any(b["family"] == "photo" for b in wk[key]["badges"])


def test_similar_weeks_past_only_and_explained():
    events = [("2021-04-05", 7, "hard"), ("2023-04-10", 7, "hard")]
    rows, meta = make_daily(years=4, events=events)
    res = run(rows, meta)
    wk = {w["week"]: w for w in res["weeks"]}
    later = wk["2023-W15"]
    assert later["candidate"]
    sims = [s["week"] for s in later["similar"]]
    assert "2021-W14" in sims
    for s in later["similar"]:
        assert s["week"] < "2023-W07"
        assert s["shared_families"] >= 2


def test_tier_history_and_access():
    events = [("2022-06-06", 7, "hard")]
    rows, meta = make_daily(years=3, events=events)
    res = run(rows, meta)
    w = next(x for x in res["weeks"] if x["week"] == "2022-W23")
    assert w["tier"] in ("recovered", "passed", "observed")
    assert w["tier_history"][0]["tier"] == "observed"
    assert w["access"] in ("auto", "confirm")


def test_run_json_roundtrip_and_determinism():
    rows, meta = make_daily(years=2)
    a = run_json(json.dumps(rows), json.dumps(meta))
    b = run_json(json.dumps(rows), json.dumps(meta))
    assert a == b
    assert json.loads(a)["weeks"][0]["schema"] == "mined.week/7"


def test_linked_indicators_count_as_one_evidence():
    # 새벽 유튜브와 새벽 메모를 같은 잠재 요인(늦게까지 깨어 있음)이 움직이는 합성 기록
    import datetime as dt
    rng = np.random.default_rng(11)
    d0 = dt.date(2020, 1, 6)
    rows = []
    late = rng.random(260)  # 주마다 한 값
    for i in range(260 * 7):
        d = d0 + dt.timedelta(days=i)
        L = late[i // 7]
        watch = int(rng.poisson(8))
        memo = int(rng.poisson(1.2)) + 1
        rows.append({"date": d.isoformat(), "yt_watch_n": watch, "yt_watch_night_n": min(watch, int(round(watch * L * 0.8))),
                     "memo_n": memo, "memo_night_n": min(memo, int(round(memo * L * 0.9))), "steps": int(rng.normal(7000, 1200))})
    meta = {"channels": {c: {"first": rows[0]["date"], "last": rows[-1]["date"]} for c in ("yt", "memo", "health")}}
    res = run(rows, meta)
    pairs = {(p["a"], p["b"]) for p in res["summary"]["linked_pairs"]}
    assert ("memo_night", "yt_night") in pairs or ("yt_night", "memo_night") in pairs
    both = [w for w in res["weeks"] if w["candidate"] and {b["indicator"] for b in w["badges"]} >= {"memo_night", "yt_night"}]
    assert both, "새벽 두 지표가 함께 배지를 받은 주가 있어야 한다"
    for w in both:
        inds = {b["indicator"] for b in w["badges"]}
        if inds == {"memo_night", "yt_night"}:
            assert w["evidence"]["independent"] == 1
            assert not w["evidence"]["cross_validated"]
    off = run(rows, meta, {"auto_link": False})
    assert off["summary"]["n_cross"] >= res["summary"]["n_cross"]
