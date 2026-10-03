#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
calibrate_axes.py — 4축 robust z 캘리브레이션 (과제 ① 검증용)

    cp calibrate_axes.py ~/Desktop/gyeol_kit/
    cd ~/Desktop/gyeol_kit
    python3 calibrate_axes.py --name "표시되는이름"

무엇을 하는가
  data/ 안의 실데이터를 run_gyeol.py와 똑같은 방식으로 읽어서,
  4축(움직임·쉼·보기·남기기)의 robust z를 계산하고
  τ(임계값) 후보와 분포만 표로 내보냅니다.

무엇을 하지 않는가
  · 원문·원값을 출력하지 않습니다. 나가는 건 비율·개수뿐입니다
  · 파일을 고치지 않습니다. gyeol_data.json 을 건드리지 않습니다
  · 네트워크를 쓰지 않습니다

결과물
  out/calibration_report.md  ← 이 파일만 채팅 창에 붙이면 됩니다 (에어갭 유지)
"""
from __future__ import annotations
import argparse
import os
import math
import statistics
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run_gyeol as RG                      # noqa: E402
from gyeol import detect                    # noqa: E402
from gyeol.channels import FEATURE_FAMILY   # noqa: E402


# ─────────────────────────────────────────────────────────────
# 축 정의 — 여기만 고치면 전부 따라옵니다
# ─────────────────────────────────────────────────────────────
#
# 원칙 두 개
#   1) 축에는 「양(量)」 지표만 넣습니다.
#      비율 지표(심야 비율·1인칭 비율·단정 표현 비율·캡처 비율)는 축에서 뺍니다.
#      「보기 많음」은 얼마나 봤나이지 언제 봤나가 아닙니다.
#      비율 지표는 근거 문장에만 씁니다.
#   2) 부호는 「축이 올라가는 방향」입니다.
#      답장 지연은 길수록 덜 남긴 것이므로 −1 입니다.
#
AXES = {
    'move':  {'label': '움직임', 'feats': {'avg_steps': +1}},
    'rest':  {'label': '쉼',     'feats': {'avg_sleep': +1}},
    'watch': {'label': '보기',   'feats': {'yt_total': +1, 'yt_search': +1}},
    'leave': {'label': '남기기', 'feats': {
        'notes_count': +1, 'notes_avg_length': +1,
        'photo_count': +1,
        'avg_length': +1, 'avg_reply_delay_min': -1,
        'ai_count': +1,
    }},
}

# 축에 안 들어가는 지표 (근거 문장 전용) — 참고용으로만 셉니다
RATIO_FEATS = {
    'yt_night_ratio', 'notes_night_ratio', 'photo_night_ratio',
    'capture_ratio', 'night_ratio', 'first_person_ratio',
    'absolute_ratio', 'ai_night_ratio',
}

# 광물 배정 (하빈님 gems/ 9종) — 창 B 확정 축 이름 기준
GEM = {
    ('move',  'up'):   '호박',   ('move',  'down'): '황철석',
    ('rest',  'up'):   '청금석', ('rest',  'down'): '월장석',
    ('watch', 'up'):   '자수정', ('watch', 'down'): '홍옥',
    ('leave', 'up'):   '흑요석', ('leave', 'down'): '석류석',
}
GEM_COMPLEX = '형석'

# 건수형·꼬리가 긴 지표는 log1p 먼저 — 멘토 안대철님 2026.09.11
# 유튜브 검색량 같은 건수는 가끔 폭발해서, 원값 z가 17~18까지 갑니다.
# log1p 를 먼저 씌우면 축끼리 스케일이 맞습니다.
LOG1P = {
    'yt_total', 'yt_search', 'notes_count', 'photo_count', 'ai_count',
    'avg_reply_delay_min',
}

# 캘린더는 축이 아닙니다 (창 B 확정 2026.09.09)
CONTEXT_FEATS = {'cal_events'}

WIN_LONG = 52    # 게이지·광물·자동노출
WIN_SHORT = 8    # 이탈·복귀·지속
MIN_PERIODS = 12  # 긴 창에서 이만큼은 있어야 z를 계산합니다
MIN_PERIODS_SHORT = 4


# ─────────────────────────────────────────────────────────────

def week_sort_key(w):
    y, n = w.split('-W')
    return (int(y), int(n))


def robust_z(value, history, min_periods):
    """
    직전 history(리스트) 대비 robust z.
    MAD == 0 이면 계산하지 않고 None 을 돌려줍니다.
    억지로 큰 수를 만들어 넣지 않습니다.
    """
    hist = [h for h in history if h is not None]
    if len(hist) < min_periods:
        return None, 'few'
    med = statistics.median(hist)
    mad = statistics.median([abs(h - med) for h in hist])
    if mad > 0:
        return (value - med) / (1.4826 * mad), 'ok'
    # MAD 가 0 이면 평균절대편차로 대체 (멘토 안대철님 2026.09.11)
    mean_ad = sum(abs(h - med) for h in hist) / len(hist)
    if mean_ad > 0:
        return (value - med) / (1.2533 * mean_ad), 'meanad'
    return None, 'flat'


def percentile_of(value, history):
    hist = [h for h in history if h is not None]
    if len(hist) < MIN_PERIODS:
        return None
    below = sum(1 for h in hist if h < value)
    return 100.0 * below / len(hist)


def build_feature_z(merged, weeks, window, min_periods, use_log=True):
    """
    지표별 robust z 를 주 단위로 계산.
    반환: (zmap, flags)
      zmap  {week: {feat: z}}
      flags {feat: {'ok': n, 'mad0': n, 'few': n}}
    """
    feats = sorted({f for row in merged.values() for f in row})
    zmap = defaultdict(dict)
    flags = {f: defaultdict(int) for f in feats}
    series = {f: [] for f in feats}   # (week, value) 시간순

    for w in weeks:
        row = merged.get(w, {})
        for f in feats:
            v = row.get(f)
            if v is None:
                series[f].append(None)
                continue
            if use_log and f in LOG1P and v >= 0:
                v = math.log1p(v)
            hist = [x for x in series[f][-window:] if x is not None]
            z, why = robust_z(v, hist, min_periods)
            flags[f][why] += 1
            if z is not None:
                zmap[w][f] = z
            series[f].append(v)
    return zmap, flags


def axis_z(week_feat_z):
    """
    축 z = 계열별 평균 z 의 평균.

    계열로 한 번 접는 이유는 v5 와 같습니다 —
    카톡 지표 여러 개가 남기기 축을 혼자 끌고 가면 안 됩니다.
    반환: {axis: (z, n_feats, [families])}
    """
    out = {}
    for ax, spec in AXES.items():
        by_family = defaultdict(list)
        n = 0
        for f, sign in spec['feats'].items():
            z = week_feat_z.get(f)
            if z is None:
                continue
            by_family[FEATURE_FAMILY.get(f, f)].append(sign * z)
            n += 1
        if not by_family:
            out[ax] = (None, 0, [])
            continue
        fam_means = [sum(v) / len(v) for v in by_family.values()]
        out[ax] = (sum(fam_means) / len(fam_means), n, sorted(by_family))
    return out


def expand_range(spec):
    """'2025-W01:2025-W14' → 주차 목록"""
    a, b = spec.split(':')
    (ya, na), (yb, nb) = week_sort_key(a), week_sort_key(b)
    out, y, n = [], ya, na
    while (y, n) <= (yb, nb) and len(out) < 300:
        out.append(f'{y}-W{n:02d}')
        n += 1
        if n > 53:
            n = 1
            y += 1
    return out


def tau_at(A52, weeks, pct):
    """축별 |z| 백분위 pct 지점을 τ 후보로."""
    tau = {}
    for ax in AXES:
        vals = []
        for w in weeks:
            z = A52[w][ax][0]
            if z is not None:
                vals.append(abs(z))
        if len(vals) < 20:
            tau[ax] = None
            continue
        vals.sort()
        tau[ax] = vals[min(int(len(vals) * pct / 100.0), len(vals) - 1)]
    return tau


def exceeded(a, tau):
    out = []
    for ax in AXES:
        z = a[ax][0]
        if z is not None and tau.get(ax) and abs(z) >= tau[ax]:
            out.append((ax, z))
    return out


def evaluate_tau(A52, weeks, tau, step):
    """
    한 τ 세트에서 무엇이 나오는지 셉니다.
      none        어느 축도 안 벗어난 주
      one         1축만
      strict      2축 모두 τ 초과 + 계열 2종 이상 (결정 2-나 원안)
      stepped     최대 축 τ 초과 + 다른 축이 step×τ 초과 + 계열 2종 이상
    """
    c = dict(none=0, one=0, multi=0, strict=0, stepped=0)
    for w in weeks:
        a = A52[w]
        exc = exceeded(a, tau)
        if not exc:
            c['none'] += 1
            continue
        if len(exc) == 1:
            c['one'] += 1
        else:
            c['multi'] += 1
        fams = set()
        for ax, _ in exc:
            fams |= set(a[ax][2])
        if len(exc) >= 2 and len(fams) >= 2:
            c['strict'] += 1
        # 계단식
        top = max(exc, key=lambda x: abs(x[1]))
        near = []
        for ax in AXES:
            if ax == top[0]:
                continue
            z = a[ax][0]
            if z is not None and tau.get(ax) and abs(z) >= step * tau[ax]:
                near.append(ax)
        if near:
            f2 = set(a[top[0]][2])
            for ax in near:
                f2 |= set(a[ax][2])
            if len(f2) >= 2:
                c['stepped'] += 1
    return c


def evidence_families(week_row):
    """그 주에 값이 있었던 지표들의 계열 (캘린더 포함)."""
    return sorted({FEATURE_FAMILY[f] for f in week_row if f in FEATURE_FAMILY})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default=None, help='카톡에 표시되는 본인 이름')
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--tau', type=float, default=None,
                    help='τ 를 직접 지정 (축 공통). 보통은 --tau-pct 를 씁니다')
    ap.add_argument('--tau-pct', type=float, default=5.0, metavar='7.5',
                    help='tau 를 |z| 상위 몇 퍼센트로 잡을지 (기본 5)')
    ap.add_argument('--mark', action='append', default=[], metavar='2018-W36',
                    help='이 주가 어떻게 판정되는지 따로 표시 (여러 번 가능)')
    ap.add_argument('--mark-range', default=None, metavar='2025-W01:2025-W14',
                    help='구간 전체를 표시')
    ap.add_argument('--step', type=float, default=0.6,
                    help='계단식 복합 조건에서 두 번째 축의 문턱 비율 (기본 0.6)')
    args = ap.parse_args()
    if args.mark_range:
        args.mark = sorted(set(args.mark) | set(expand_range(args.mark_range)),
                           key=week_sort_key)

    os.makedirs(args.out, exist_ok=True)
    print('▸ data/ 읽는 중…')
    found = detect.scan(args.data)
    weekly, info, _ = RG.load_all(found, args.name, interactive=False)
    merged = RG.merge_weekly(weekly)
    weeks = sorted(merged, key=week_sort_key)
    print(f'  {len(weeks)}주')

    print(f'▸ 지표별 robust z 계산 (창 {WIN_LONG}주 / {WIN_SHORT}주)…')
    z52, flags52 = build_feature_z(merged, weeks, WIN_LONG, MIN_PERIODS)
    z52r, _ = build_feature_z(merged, weeks, WIN_LONG, MIN_PERIODS, use_log=False)
    z8, _ = build_feature_z(merged, weeks, WIN_SHORT, MIN_PERIODS_SHORT)

    print('▸ 축으로 접는 중…')
    A52 = {w: axis_z(z52.get(w, {})) for w in weeks}
    A52r = {w: axis_z(z52r.get(w, {})) for w in weeks}
    A8 = {w: axis_z(z8.get(w, {})) for w in weeks}

    # ── τ 후보 ──────────────────────────────────────────────
    PCT = 100.0 - args.tau_pct
    tau = tau_at(A52, weeks, PCT)
    tau_used = {ax: (args.tau if args.tau is not None else tau[ax]) for ax in AXES}

    # ── 집계 ────────────────────────────────────────────────
    axis_cov = {ax: 0 for ax in AXES}
    axis_mad0 = {ax: 0 for ax in AXES}
    dominant = defaultdict(int)
    direction = defaultdict(int)
    n_out_hist = defaultdict(int)
    fluorite_axis = 0     # 결정 2-가: 2축 이상
    fluorite_family = 0   # 결정 2-나: 2축 이상 + 계열 2종 이상
    no_axis_out = 0
    cross_validated = 0
    cross_wo_cal = 0
    marked = {}

    for w in weeks:
        row = merged[w]
        a = A52[w]
        for ax in AXES:
            if a[ax][0] is not None:
                axis_cov[ax] += 1

        out = [(ax, a[ax][0]) for ax in AXES
               if a[ax][0] is not None and tau_used[ax]
               and abs(a[ax][0]) >= tau_used[ax]]
        n_out_hist[len(out)] += 1

        fams_all = evidence_families(row)
        out_fams = sorted({f for ax, _ in out for f in a[ax][2]})

        if len(fams_all) >= 2:
            cross_validated += 1
        if len([f for f in fams_all if f != 'calendar']) >= 2:
            cross_wo_cal += 1

        if not out:
            no_axis_out += 1
            gem = None
        elif len(out) >= 2:
            fluorite_axis += 1
            if len(out_fams) >= 2:
                fluorite_family += 1
                gem = 'fluorite'
            else:
                # 결정 2-나에서는 형석이 아니라 최대 축의 광물
                gem = None
        else:
            gem = None

        if out:
            dom = max(out, key=lambda x: abs(x[1]))
            dominant[dom[0]] += 1
            direction['up' if dom[1] > 0 else 'down'] += 1

        if w in args.mark:
            # 근접 축 — τ 의 step 배를 넘은 축 (계단식 조건)
            near = []
            if out:
                top = max(out, key=lambda x: abs(x[1]))
                for ax in AXES:
                    if ax == top[0]:
                        continue
                    z = a[ax][0]
                    if z is not None and tau_used[ax] and abs(z) >= args.step * tau_used[ax]:
                        near.append(ax)
                f2 = set(a[top[0]][2])
                for ax in near:
                    f2 |= set(a[ax][2])
                if near and len(f2) >= 2:
                    gem = GEM_COMPLEX
                else:
                    gem = GEM.get((top[0], 'up' if top[1] > 0 else 'down'), '?')
                # 표시용 — 이미 벗어난 축은 근접 칸에 또 적지 않습니다
                outax = {ax for ax, _ in out}
                near = [ax for ax in near if ax not in outax]
            else:
                gem = None
            # 평소 있던 계열 중 이번 주에 빈 것 — 직전 8주 기준
            idx = weeks.index(w)
            base = set()
            for pw in weeks[max(0, idx - 8):idx]:
                base |= set(evidence_families(merged[pw]))
            gone = sorted(base - set(fams_all))
            marked[w] = dict(
                axes={ax: (None if a[ax][0] is None else round(a[ax][0], 2))
                      for ax in AXES},
                out=[ax for ax, _ in out],
                near=near,
                gem=gem,
                families=fams_all,
                gone=gone,
            )

    # ── MAD=0 비율은 지표 단위로 셉니다 ──────────────────────
    mad0_rows = []
    for f, c in sorted(flags52.items()):
        tot = c['ok'] + c['mad0'] + c['few']
        if not tot:
            continue
        where = ('축 밖 (비율)' if f in RATIO_FEATS else
                 '맥락' if f in CONTEXT_FEATS else
                 next((AXES[ax]['label'] for ax in AXES if f in AXES[ax]['feats']), '—'))
        mad0_rows.append((f, where, c['ok'], c['mad0'], c['few'],
                          100.0 * c['mad0'] / tot))

    # ── 리포트 ──────────────────────────────────────────────
    L = []
    A = L.append
    A('# 4축 캘리브레이션 결과')
    A('')
    A(f'`calibrate_axes.py` · 분석 주 **{len(weeks)}주** · '
      f'창 {WIN_LONG}주(z52) / {WIN_SHORT}주(z8)')
    A('')
    A('> 이 파일에는 원문도 원값도 없습니다. 비율과 개수뿐입니다.')
    A('')
    A('## 1. 축별 요약 — τ 후보가 여기 있습니다')
    A('')
    tau_raw = tau_at(A52r, weeks, PCT)
    A(f'| 축 | 커버리지 | **τ (log1p)** | τ (원값) | dominant 빈도 |')
    A('|---|---|---|---|---|')
    n_dom = sum(dominant.values()) or 1
    for ax in AXES:
        t, tr = tau[ax], tau_raw[ax]
        A(f"| {AXES[ax]['label']} `{ax}` | {axis_cov[ax]}주 "
          f"({100.0*axis_cov[ax]/len(weeks):.0f}%) | "
          f"**{'—' if t is None else f'{t:.2f}'}** | "
          f"{'—' if tr is None else f'{tr:.2f}'} | "
          f"{dominant[ax]}주 ({100.0*dominant[ax]/n_dom:.0f}%) |")
    A('')
    A('> **log1p** — 건수형 지표(유튜브 시청·검색, 메모·사진 수, 답장 지연)에 '
      '로그를 먼저 씌운 값입니다. 멘토 안대철님 조언(2026.09.11).')
    A('> 원값 τ가 축마다 몇 배씩 차이나면 **축 간 스케일이 안 맞는 것**이고, '
      'log1p 쪽이 고르면 그걸로 갑니다.')
    A('')
    A('**읽는 법**')
    A('')
    A('- τ 후보가 축마다 2.0에서 크게 벗어나면 **축마다 다른 τ**가 필요합니다')
    A('- 한 축이 dominant를 60% 넘게 독식하면 **축 간 스케일 문제**입니다')
    A('- 커버리지가 낮은 축은 게이지에서 「기록 없음」으로 자주 뜹니다')
    A('')
    A('## 2. MAD = 0 — z를 계산할 수 없었던 비율')
    A('')
    A('| 지표 | 어디 | 계산됨 | MAD=0 | 이력부족 | MAD=0 비율 |')
    A('|---|---|---|---|---|---|')
    for f, where, ok, m0, few, pct in mad0_rows:
        star = ' ⚠' if pct >= 50 and where not in ('축 밖 (비율)', '맥락') else ''
        A(f'| `{f}` | {where} | {ok} | {m0} | {few} | **{pct:.0f}%**{star} |')
    A('')
    A('> ⚠ 표시는 **축에 들어가는 지표인데 절반 이상에서 z를 못 만든 것**입니다.')
    A('> 여기 표시가 뜨면 `floor` 방식을 다시 설계해야 합니다.')
    A('')
    A('## 3. 벗어난 축 개수 분포')
    A('')
    A('| 벗어난 축 | 주 수 | 비율 |')
    A('|---|---|---|')
    for k in sorted(n_out_hist):
        A(f'| {k}개 | {n_out_hist[k]}주 | {100.0*n_out_hist[k]/len(weeks):.0f}% |')
    A('')
    A(f'- **어느 축도 안 벗어난 주: {no_axis_out}주 '
      f'({100.0*no_axis_out/len(weeks):.0f}%)** → 결정 4 (광물 없이 평범한 주)')
    A('')
    A('## 4. 형석(복합) 비율 — 결정 2')
    A('')
    A('| 조건 | 주 수 | 비율 |')
    A('|---|---|---|')
    A(f'| **2-가** 2축 이상 벗어남 | {fluorite_axis}주 | '
      f'{100.0*fluorite_axis/len(weeks):.0f}% |')
    A(f'| **2-나** 2축 이상 + 계열 2종 이상 | {fluorite_family}주 | '
      f'{100.0*fluorite_family/len(weeks):.0f}% |')
    A('')
    A(f'차이 **{fluorite_axis - fluorite_family}주** — 이게 '
      f'「같은 로그에서만 나온 2축」입니다. 2-가로 가면 이 주들도 형석이 됩니다.')
    A('')
    A('> 형석이 30%를 넘으면 흔해져서 「교차검증된 주」라는 의미를 잃습니다.')
    A('')
    A('## 5. 교차검증 — 캘린더를 세는가 (결정 1)')
    A('')
    A('| | 주 수 | 비율 |')
    A('|---|---|---|')
    A(f'| 계열 2종 이상 (캘린더 포함) | {cross_validated}주 | '
      f'{100.0*cross_validated/len(weeks):.0f}% |')
    A(f'| 계열 2종 이상 (캘린더 제외) | {cross_wo_cal}주 | '
      f'{100.0*cross_wo_cal/len(weeks):.0f}% |')
    A('')
    A(f'**캘린더가 있어야만 교차검증되는 주: {cross_validated - cross_wo_cal}주.**')
    A('이 숫자가 결정 1의 실제 대가입니다. 작으면 (가)로 가도 잃는 게 없습니다.')
    A('')

    # ── 6. τ 스윕 ───────────────────────────────────────────
    A('## 6. ★ τ 후보 훑기 — 형석이 몇 주 나오는가')
    A('')
    A('상위 5%로 자르면 4축이 동시에 걸릴 일이 거의 없어서 **형석이 0주가 됩니다.**')
    A('문턱을 낮추거나, 복합 조건을 계단식으로 바꿔야 합니다. 둘 다 여기서 비교합니다.')
    A('')
    A(f'- **엄격** — 2축 모두 τ 초과 + 계열 2종 이상')
    A(f'- **계단식** — 최대 축이 τ 초과 + 다른 축이 **{args.step:g}×τ** 초과 + 계열 2종 이상')
    A('')
    A('| 상위 % | 움직임 τ | 쉼 τ | 보기 τ | 남기기 τ | 광물 생김 | 그중 1축 | 형석(엄격) | 형석(계단식) |')
    A('|---|---|---|---|---|---|---|---|---|')
    for pct in (99, 97.5, 95, 92.5, 90, 85, 80):
        t = tau_at(A52, weeks, pct)
        c = evaluate_tau(A52, weeks, t, args.step)
        got = len(weeks) - c['none']
        fmt = lambda ax: ('—' if t[ax] is None else f'{t[ax]:.2f}')
        A(f"| 상위 {100-pct:g}% | {fmt('move')} | {fmt('rest')} | {fmt('watch')} | "
          f"{fmt('leave')} | {got}주 ({100.0*got/len(weeks):.0f}%) | {c['one']}주 | "
          f"**{c['strict']}주** | **{c['stepped']}주** |")
    A('')
    A('**고르는 법**')
    A('')
    A('1. 형석이 **전체의 3~10%** 정도 나오는 줄을 찾습니다. 0이면 죽은 광물이고, 30%를 넘으면 흔해져서 「교차검증된 주」라는 뜻을 잃습니다')
    A('2. 그 줄에서 「광물 생김」이 너무 크면 지층이 시끄러워집니다. 20% 안쪽이 적당합니다')
    A('3. 엄격과 계단식 중 형석이 실제로 나오는 쪽을 씁니다')
    A('')

    if marked:
        A('## 7. 지정한 구간')
        A('')
        A(f'τ = **|z| 상위 {args.tau_pct:g}%** — '
          + ' · '.join(f"{AXES[ax]['label']} {('—' if tau_used[ax] is None else f'{tau_used[ax]:.2f}')}"
                       for ax in AXES))
        A(f'계단식 복합 조건: 최대 축이 τ 초과 + 다른 축이 **{args.step:g}×τ** 초과 + 계열 2종 이상')
        A('')
        A('| 주 | 움직임 | 쉼 | 보기 | 남기기 | 벗어남 | 근접 | **광물** | 평소 있다 빈 기록 |')
        A('|---|---|---|---|---|---|---|---|---|')
        for w in sorted(marked, key=week_sort_key):
            m = marked[w]
            cells = []
            for ax in AXES:
                v = m['axes'][ax]
                if v is None:
                    cells.append('·')
                elif ax in m['out']:
                    cells.append(f'**{v}**')
                elif ax in m['near']:
                    cells.append(f'_{v}_')
                else:
                    cells.append(f'{v}')
            gem = m['gem'] or '—'
            if gem == GEM_COMPLEX:
                gem = f'**{gem}**'
            A(f"| {w} | {cells[0]} | {cells[1]} | {cells[2]} | {cells[3]} | "
              f"{', '.join(m['out']) or '—'} | {', '.join(m['near']) or '—'} | "
              f"{gem} | {', '.join(m['gone']) or '—'} |")
        A('')
        A('- `·` = 기록 없음 · **굵게** = τ 초과 · _기울임_ = 근접 (0.6τ 초과)')
        A('- 축 값은 z52 (직전 52주 대비)')
        A('- **평소 있다 빈 기록** = 직전 8주에 있었는데 이 주엔 없는 계열')
        A('')
        A('> 마지막 칸은 **판정에 쓰지 않습니다.** 폰 교체·앱 삭제로도 똑같이 비니까요.')
        A('> 캘린더와 같은 자리 — 맥락 한 줄로만 씁니다.')
        A('')
        gems = [m['gem'] for m in marked.values() if m['gem']]
        A(f"이 구간 {len(marked)}주 중 **광물이 생긴 주 {len(gems)}개** · "
          f"그중 형석 **{sum(1 for g in gems if g == GEM_COMPLEX)}개**")
        A('')

    A('---')
    A('')
    A('## 다음 할 일')
    A('')
    A('1. 1장의 τ 후보를 보고 **τ를 확정** (결정 3)')
    A('2. 4장을 보고 **형석 조건 확정** (결정 2)')
    A('3. 5장을 보고 **캘린더 처리 확정** (결정 1)')
    A('4. 이 파일만 채팅 창에 붙이면 됩니다. 원본은 올리지 않습니다')
    A('')

    path = os.path.join(args.out, 'calibration_report.md')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n✅ {path}')
    print('   이 파일만 채팅 창에 붙이시면 됩니다. 원본은 올리지 마세요.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
