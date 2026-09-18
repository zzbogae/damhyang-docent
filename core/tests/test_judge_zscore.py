"""축별 robust z-score 엔진 테스트 — docs/team_spec_sync_260913.md §1 확정값 검증.

judge.py 에 새로 추가한 robust_z/axis_extreme/hyeongseok_condition/grade_d 를,
team_spec_sync_260913.md 에 적힌 숫자·조건을 그대로 재현하는지로 검증한다(실제 팀
캘리브레이션 데이터가 없으니, "문서에 적힌 규칙을 코드가 맞게 구현했는가"만 확인한다 —
τ 값 자체가 실데이터에 맞는지는 팀 검증 대상으로 남는다).
"""
from __future__ import annotations

import numpy as np
import pytest

from mined_core.judge import (
    AXIS_TAU,
    D_SPEC,
    axis_extreme,
    grade_d,
    hyeongseok_condition,
    robust_z,
)


# ── robust_z ─────────────────────────────────────────────────────────────

def test_robust_z_basic_normal_case():
    rng = np.random.default_rng(0)
    v = rng.normal(0, 1, 60)
    v[59] = 10.0  # 명백한 극단값
    z, reason = robust_z(v, window=52, min_history=12)
    assert reason[59] is None
    assert z[59] > 5  # 충분히 큰 양의 z


def test_robust_z_missing_history_too_short():
    v = np.arange(10, dtype=float)
    z, reason = robust_z(v, window=52, min_history=12)
    # 처음 12주는 기준 자체가 12주 미만이라 항상 baseline_short
    assert all(r == "baseline_short" for r in reason)
    assert np.all(np.isnan(z))


def test_robust_z_nan_current_is_missing():
    v = np.arange(30, dtype=float)
    v[20] = np.nan
    z, reason = robust_z(v, window=52, min_history=12)
    assert reason[20] == "missing"
    assert np.isnan(z[20])


def test_robust_z_mad_zero_falls_back_to_meanad_1_2533(monkeypatch=None):
    # 기준 26주 중 대부분이 같은 값(중위=그 값, MAD=0)이고 몇 개만 흩어져 있으면
    # median absolute deviation 은 0 이 되고, 평균절대편차 × 1.2533 대체가 걸려야 한다.
    base = [5.0] * 20 + [5.0, 5.0, 7.0, 3.0, 5.0, 5.0]  # 26개, MAD(median)=0, meanAD>0
    v = np.array(base + [5.0], dtype=float)  # 27번째(idx 26)가 판정 대상
    z, reason = robust_z(v, window=52, min_history=12)
    base_arr = np.array(base)
    med = np.median(base_arr)
    assert med == 5.0
    mad = np.median(np.abs(base_arr - med))
    assert mad == 0.0
    meanad = np.mean(np.abs(base_arr - med))
    sigma = 1.2533 * meanad
    expect_z = (5.0 - med) / sigma
    assert reason[26] is None
    assert z[26] == pytest.approx(expect_z)


def test_robust_z_mad_and_meanad_both_zero_is_no_spread():
    v = np.array([5.0] * 20, dtype=float)
    z, reason = robust_z(v, window=52, min_history=12)
    assert reason[19] == "no_spread"
    assert np.isnan(z[19])


def test_robust_z_log1p_reduces_thick_tail_spurious_extremity():
    # 건수형 지표(길게 꼬리 있는 분포)에서 log1p 없이는 큰 값이 훨씬 더 극단으로 보인다.
    rng = np.random.default_rng(3)
    v = rng.poisson(2, 60).astype(float)
    v[59] = 30.0
    z_raw, _ = robust_z(v.copy(), window=52, min_history=12, log1p=False)
    z_log, _ = robust_z(v.copy(), window=52, min_history=12, log1p=True)
    assert abs(z_log[59]) < abs(z_raw[59])


# ── axis_extreme / τ ────────────────────────────────────────────────────

def test_axis_tau_values_match_team_spec():
    assert AXIS_TAU == {"steps": 3.03, "sleep": 2.36, "screen": 1.99, "record": 2.16}


def test_axis_extreme_uses_axis_specific_tau():
    assert axis_extreme(3.03, "steps") is True
    assert axis_extreme(3.0299, "steps") is False
    assert axis_extreme(1.99, "screen") is True   # screen 의 τ 는 더 낮다
    assert axis_extreme(1.99, "steps") is False   # 같은 z 라도 축마다 문턱이 다르다


def test_axis_extreme_nan_is_never_extreme():
    assert axis_extreme(float("nan"), "steps") is False
    assert axis_extreme(None, "steps") is False


# ── hyeongseok_condition (형석 계단식 조건, §1-2) ──────────────────────────

def test_hyeongseok_holds_with_two_sources_and_second_axis_above_0_6_tau():
    axis_z = {"sleep": -2.4, "steps": -1.9}  # sleep τ=2.36 → |z| 넘음; steps 0.6*3.03=1.818 → 넘음
    fams = {"sleep": {"health"}, "steps": {"health"}}
    r = hyeongseok_condition(axis_z, fams)
    # 같은 출처(health)뿐이라 계단식은 통과하지만 출처 조건에서 걸려야 한다
    assert r["holds"] is False
    assert r["reason"] == "same_source_only"


def test_hyeongseok_holds_with_genuinely_different_sources():
    axis_z = {"sleep": -2.4, "screen": 1.2}  # screen 자신의 τ=1.99*0.6=1.194 → 1.2 는 넘음(근소)
    fams = {"sleep": {"health"}, "screen": {"yt"}}
    r = hyeongseok_condition(axis_z, fams)
    assert r["holds"] is True
    assert r["max_axis"] == "sleep"
    assert r["second_axis"] == "screen"


def test_hyeongseok_fails_when_second_axis_below_0_6_tau():
    axis_z = {"sleep": -2.4, "screen": 0.5}  # 0.5 < 1.194
    fams = {"sleep": {"health"}, "screen": {"yt"}}
    r = hyeongseok_condition(axis_z, fams)
    assert r["holds"] is False
    assert r["reason"] == "no_second_axis"


def test_hyeongseok_fails_when_max_axis_itself_below_tau():
    axis_z = {"sleep": -1.0, "screen": 1.0}
    fams = {"sleep": {"health"}, "screen": {"yt"}}
    r = hyeongseok_condition(axis_z, fams)
    assert r["holds"] is False
    assert r["reason"] == "max_axis_below_tau"


def test_hyeongseok_no_data_when_all_missing():
    r = hyeongseok_condition({"sleep": float("nan")}, {})
    assert r["holds"] is False
    assert r["reason"] == "no_data"


def test_hyeongseok_does_not_require_four_axes_extreme():
    # v1/구 규칙("4축 모두 극단")은 폐기됨 — 2축만으로 성립해야 한다.
    axis_z = {"sleep": -3.0, "record": 1.5, "steps": 0.1}  # record τ=2.16*0.6=1.296 → 1.5 넘음
    fams = {"sleep": {"health"}, "record": {"memo"}, "steps": {"health"}}
    r = hyeongseok_condition(axis_z, fams)
    assert r["holds"] is True


# ── grade_d (스펙 D, §1-3) ──────────────────────────────────────────────

def test_grade_d_matches_team_spec_constants():
    assert D_SPEC == {"sustain": 4, "wait_cap": 4, "min_history": 12}


def test_grade_d_held_when_return_within_cap_and_sustain_fully_confirmed():
    band = [True, True, True, True, True]  # 1주차에 바로 복귀, 그 뒤 4주 연속 유지
    assert grade_d(band, sustain=4, wait_cap=4) == "held"


def test_grade_d_returned_when_sustain_broken():
    band = [True, True, False, True]  # 복귀는 됐지만 지속 3주째에 다시 이탈
    assert grade_d(band, sustain=4, wait_cap=4) == "returned"


def test_grade_d_returned_when_sustain_not_yet_fully_observed():
    band = [True, True]  # 복귀는 확인됐지만 지속 4주를 볼 만큼 시간이 아직 안 지났다
    assert grade_d(band, sustain=4, wait_cap=4) == "returned"


def test_grade_d_open_when_no_return_within_wait_cap():
    band = [False, False, False, False, True]  # 5번째 주(창 밖)에 복귀해도 인정 안 됨
    assert grade_d(band, sustain=4, wait_cap=4) == "open"


def test_grade_d_open_does_not_require_full_window_observed_yet():
    band = [False, False]  # 아직 창이 다 지나지 않았어도, 지금까지 복귀가 없으면 open
    assert grade_d(band, sustain=4, wait_cap=4) == "open"


def test_grade_d_insufficient_when_entire_window_missing():
    band = [None, None, None, None]
    assert grade_d(band, sustain=4, wait_cap=4) == "insufficient"


def test_grade_d_return_recognized_even_with_some_missing_weeks_in_window():
    band = [None, True, None, None]  # 창 안 어딘가에 복귀가 '확인'되면 insufficient 가 아니다
    assert grade_d(band, sustain=4, wait_cap=4) in ("returned", "held")
