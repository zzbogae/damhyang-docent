"""팀 9/23 확정 규칙: 확인 등급 4종 + broken, 지표 스위치, 방향별 문턱, 광물 9종, 결."""
import numpy as np
import pytest

from mined_core import run
from mined_core.indicators import AXES, axis_screen
from mined_core.judge import (DEFAULT_CONFIG, GRADE_TEXT, MINERAL_BY_AXIS_DIR, grade_sequence, gyeol_for,
                              mineral_shape, robust_z, thresholds)

from .fixtures import make_daily

T, F = True, False


def g(obs, nor, upto=None, h=4, run_=4):
    return grade_sequence(obs, nor, h, run_, len(obs) if upto is None else upto)


def test_held_when_return_then_four_normal_weeks():
    assert g([T] * 8, [F, T, T, T, T, T, T, T]) == ("held", 2, 6)


def test_broken_when_leaving_band_inside_hold_window():
    # 2주 뒤 돌아왔다가 4주 뒤 다시 벗어남: 확인은 됐고 유지가 안 된 것
    assert g([T] * 8, [F, T, T, F, T, T, T, T]) == ("broken", 2, 6)


def test_returned_when_hold_window_has_gap_or_not_yet():
    assert g([T, T, F, T, T, T, T, T], [F, T, F, T, T, T, T, T])[0] == "returned"
    assert g([T] * 8, [T] * 8, upto=3)[0] == "returned"


def test_open_until_horizon_passes_then_not_returned():
    assert g([T] * 8, [F] * 8, upto=3)[0] == "open"
    assert g([T] * 8, [F] * 8)[0] == "not_returned"


def test_insufficient_unless_whole_wait_window_observed():
    # 기본값(1.0): 4주가 모두 관측돼야 「돌아오지 않았다」고 말한다
    assert g([F, T, T, T, T, T, T, T], [F] * 8)[0] == "insufficient"
    assert g([T] * 8, [F] * 8)[0] == "not_returned"
    assert grade_sequence([F, F, T, T, T, T, T, T], [F] * 8, 4, 4, 8, min_obs=0.5)[0] == "not_returned"


def test_grade_text_matches_team_wording_and_leaves_broken_blank():
    assert GRADE_TEXT["held"].format(run=4) == "그 뒤 4주는 평소 범위였습니다."
    assert GRADE_TEXT["broken"] == "돌아왔지만 다시 벗어났습니다."
    assert GRADE_TEXT["not_returned"] is None
    banned = ("회복", "지나갔습니다", "지나갔고")
    assert not any(b in (t or "") for t in GRADE_TEXT.values() for b in banned)


def test_robust_z_mad_zero_falls_back_to_mean_abs_dev():
    b = np.array([0.0] * 30 + [4.0] * 10)
    # 중앙값 0, MAD 0 → 평균절대편차 1.0 × 1.2533
    assert robust_z(b, 4.0) == pytest.approx(4.0 / 1.2533, rel=1e-3)
    assert robust_z(np.zeros(30), 0.0) == 0.0


def test_directional_thresholds():
    cfg = {**DEFAULT_CONFIG, "adaptive_q": False, "q_dir": {"move": {"up": 0.02, "down": 0.06}}}
    assert thresholds("move", 5, cfg) == (0.02, 0.06)
    assert thresholds("rest", 5, cfg) == (0.03, 0.03)
    z = {**DEFAULT_CONFIG, "metric": "robust_z"}
    assert thresholds("move", 5, z) == (4.91, 1.60)


def test_minerals_follow_axis_and_direction():
    assert len(set(MINERAL_BY_AXIS_DIR.values())) == 8
    b = [{"axis": "rest", "direction": "down"}, {"axis": "move", "direction": "down"}]
    assert mineral_shape(b) == ("월장석", "round")
    b3 = b + [{"axis": "watch", "direction": "up"}]
    assert mineral_shape(b3) == ("형석", "diamond")


def test_gyeol_counts_axes_outside_band():
    ax = {"move": {"z": 1.5}, "rest": {"z": 0.2}, "watch": None, "leave": {"z": -1.1}}
    assert gyeol_for(ax) == "mixed"
    ax["leave"]["z"] = 0.0
    assert gyeol_for(ax) == "coarse"
    ax["move"]["z"] = 0.0
    assert gyeol_for(ax) == "regular"


def test_axis_names_two_layers():
    assert AXES == ["move", "rest", "watch", "leave"]
    assert [axis_screen(a) for a in AXES] == ["걸음", "쉼", "화면", "기록"]


@pytest.mark.parametrize("metric", ["mid_rank_pct", "robust_z"])
def test_metric_switch_runs_end_to_end(metric):
    rows, meta = make_daily(years=3, events=[("2022-06-06", 10, "hard")])
    res = run(rows, meta, {"metric": metric, "null_iter": 0})
    hit = [w for w in res["weeks"] if w["candidate"]]
    assert hit, metric
    assert any(w["week"] in ("2022-W23", "2022-W24") for w in hit)
    for w in hit:
        assert w["grade"] in ("held", "returned", "open", "insufficient", "broken", "not_returned")
        if w["grade"] in ("held", "broken", "returned"):
            assert w["return_week"] and w["hold_until"] and w["return_week"] < w["hold_until"]
        assert w["mineral"] in set(MINERAL_BY_AXIS_DIR.values()) | {"형석"}
    assert set(res["summary"]["grades"]) >= {"held", "broken", "insufficient"}


def test_quiet_fills_rest_axis_only_when_sleep_missing_and_gives_no_badges():
    rows, meta = make_daily(years=3, events=[("2022-06-06", 10, "hard")])
    rng = np.random.default_rng(3)
    for r in rows:
        r["quiet_min"] = int(rng.normal(480, 40))
        if r["date"] >= "2021-01-01":
            r.pop("sleep_min", None)
    res = run(rows, meta, {"null_iter": 0})
    early = next(w for w in res["weeks"] if w["week"] == "2020-W40")
    late = next(w for w in res["weeks"] if w["week"] == "2022-W40")
    assert early["axes"]["rest"] and "via" not in early["axes"]["rest"]
    assert late["axes"]["rest"]["via"] == "quiet"
    assert not any(b["indicator"] == "quiet" for w in res["weeks"] for b in w["badges"])
    on = run(rows, meta, {"null_iter": 0, "badge_off": []})
    assert on["summary"]["coverage"]["quiet"]["observed_weeks"] > 100
