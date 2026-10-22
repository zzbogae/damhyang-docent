#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_fixture.py — 합성 데이터로 gyeol_axes_fake.json 을 찍습니다.

    python3 make_fixture.py            # out/gyeol_axes_fake.json

왜 있는가
  합류자(LLM 개발)에게 앱을 보여주려면 데이터가 필요한데,
  지금 있는 데모 빌드는 전부 보경 님 실기록으로 구워져 있습니다.
  out/gyeol_wall.html 에는 메모 원문이, out/gyeol_demo_app_v2.html 에는
  날짜 박힌 문장 800주치가 들어 있습니다. 넘기면 되돌릴 수 없습니다.

  그래서 값만 합성하고 구조는 진짜인 파일을 따로 찍습니다.
  data/ 를 읽지 않습니다. judge.py 도 부르지 않습니다.
  gyeol/axes.py 의 실제 코드 경로를 그대로 타기 때문에, 스키마가
  어긋날 수가 없습니다 — 어긋나면 진짜 파이프라인도 어긋난 겁니다.

무엇이 가짜이고 무엇이 진짜인가
  가짜 : 주별 원시 수치(걸음·수면·영상·기록 건수 …), 주차 라벨
  진짜 : robust z 계산, τ, 광물 배정, 결 판정, 등급 문장, JSON 스키마

⚠ 이 파일은 실데이터가 아닙니다. 분석하지 마세요. 숫자에 의미가 없습니다.
   앱이 도는지, 화면이 채워지는지 보는 용도입니다.
"""
from __future__ import annotations
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gyeol import axes as AX                              # noqa: E402
from build_axes_json import rolling_pct, week_sort_key    # noqa: E402

SEED = 20260922          # 고정 — 같은 씨앗이면 같은 픽스처가 나옵니다
N_WEEKS = 208            # 4년. 52주 기준선 + 판정 창 + 닮은 주 후보가 다 나옵니다
START_YEAR = 2021

# 주별 기준값. 실데이터의 값이 아닙니다 — 그럴듯한 크기만 맞춘 것입니다.
BASE = {
    'avg_steps':           6800,
    'avg_sleep':            6.6,
    'yt_total':              48,
    'yt_search':             11,
    'notes_count':            4,
    'notes_avg_length':     180,
    'photo_count':           22,
    'avg_length':            34,
    'avg_reply_delay_min':   18,
    'ai_count':               3,
    'cal_events':             5,
}
SPREAD = {   # 변동폭 (기준값 대비 비율)
    'avg_steps': .22, 'avg_sleep': .11, 'yt_total': .45, 'yt_search': .55,
    'notes_count': .60, 'notes_avg_length': .35, 'photo_count': .70,
    'avg_length': .30, 'avg_reply_delay_min': .50, 'ai_count': .80,
    'cal_events': .50,
}
# 이탈 구간 — 실데이터 실측(800주 중 광물 129주 = 16%, 안 쓰인 광물 0종)에
# 가깝게 맞춘 값입니다. 광물이 너무 자주 나오면 「드문 주」가 아니게 되고,
# 한 종이라도 0주면 합류자가 9종 화면을 다 못 봅니다.
N_SPIKES = 13
AMP_UP   = (4.0, 7.5)
AMP_DOWN = (1.5, 2.6)
NOISE    = 0.30
DRIFT    = (0.10, 0.05)

# ⚠ 광물 비율을 일부러 실데이터보다 높였습니다.
#   실데이터 800주 → 광물 129주 (16%)
#   이 픽스처 208주 → 광물 약 27%
#   208주에서 16%면 광물이 33주인데, 그걸 9종에 나누면 한 종도 못 보는
#   화면이 생깁니다. 합류자는 9종이 다 그려지는 걸 봐야 폐쇄 어휘를
#   설계할 수 있습니다. 그래서 빈도보다 커버리지를 택했습니다.
#   ⚠ 이 비율을 실제 빈도로 인용하지 마세요. 16% 가 실측입니다.

COMBOS = [(ax, sg) for ax in AX.AXIS_ORDER for sg in (+1, -1)]

FAM_OF_FEAT = {   # 결측을 계열 단위로 끊기 위한 묶음
    'health':   ['avg_steps', 'avg_sleep'],
    'youtube':  ['yt_total', 'yt_search'],
    'notes':    ['notes_count', 'notes_avg_length'],
    'photo':    ['photo_count'],
    'kakao':    ['avg_length', 'avg_reply_delay_min'],
    'ai':       ['ai_count'],
    'calendar': ['cal_events'],
}


def iso_weeks(n, start_year=START_YEAR):
    out, y, w = [], start_year, 1
    for _ in range(n):
        out.append(f'{y}-W{w:02d}')
        w += 1
        if w > 52:
            y, w = y + 1, 1
    return out


def make_merged(weeks, rng):
    """
    합성 주간표.

    그냥 난수만 뿌리면 광물이 거의 안 나옵니다 — 화면이 비어서
    합류자가 아무것도 못 봅니다. 그래서 세 가지를 일부러 넣습니다.
      · 완만한 흐름  : 계절처럼 천천히 오르내리는 성분
      · 이탈 구간    : 한 축을 크게 밀어 광물·등급이 실제로 나오게
      · 결측 구간    : 계열을 통째로 비워 「기록 없음」 경로를 타게
    """
    n = len(weeks)

    # ① 이탈 구간 — 시작 주와 밀어 올릴(내릴) 축
    spikes = []
    pool = list(range(56, n - 14))
    rng.shuffle(pool)
    taken = []
    for i in pool:
        if any(abs(i - t) < 10 for t in taken):
            continue
        taken.append(i)
        if len(spikes) < len(COMBOS):
            axis, sign = COMBOS[len(spikes)]
        else:
            axis, sign = rng.choice(AX.AXIS_ORDER), rng.choice([+1, -1])
        spikes.append({
            'at':   i,
            'axis': axis,
            'sign': sign,
            # 위아래 진폭을 다르게 줍니다. 건수형 지표는 log1p 를 거치고
            # 아래로는 0이라는 바닥이 있어서, 같은 비율로 밀면 아래쪽 z 만
            # 커집니다. 그대로 두면 위쪽 광물(호박·청금석·자수정)이
            # 한 주도 안 나와서 9종을 다 못 보여줍니다.
            'amp':  rng.uniform(*(AMP_UP if sign > 0 else AMP_DOWN)),
            'len':  rng.randint(1, 3),
            'back': rng.randint(1, 4),       # 몇 주 만에 돌아오는가
        })
        if len(spikes) >= N_SPIKES:
            break

    # ② 결측 구간 — 계열 통째로
    holes = []
    pool = list(range(30, n - 6))
    rng.shuffle(pool)
    taken = []
    for i in pool:
        if any(abs(i - t) < 12 for t in taken):
            continue
        taken.append(i)
        fams = rng.sample(list(FAM_OF_FEAT), rng.randint(1, 3))
        holes.append({'at': i, 'len': rng.randint(1, 4), 'fams': fams})
        if len(holes) >= 14:
            break
    # 판정이 안 되는 주도 하나는 있어야 insufficient 경로가 돕니다
    holes.append({'at': n - 30, 'len': 6, 'fams': list(FAM_OF_FEAT)})

    merged = {}
    for i, w in enumerate(weeks):
        row = {}
        for f, base in BASE.items():
            drift = 1.0 + DRIFT[0] * math.sin(i / 26.0 * math.pi) \
                        + DRIFT[1] * math.sin(i / 9.0 * math.pi + 1.1)
            v = base * drift * (1.0 + rng.gauss(0, SPREAD[f] * NOISE))
            row[f] = v

        for s in spikes:
            if s['at'] <= i < s['at'] + s['len']:
                k = 1.0
            elif s['at'] + s['len'] <= i < s['at'] + s['len'] + s['back']:
                k = 0.45          # 돌아오는 중
            else:
                continue
            for f, sgn in AX.AXES[s['axis']]['feats'].items():
                if f not in row:
                    continue
                d = s['amp'] * SPREAD[f] * k * s['sign'] * sgn
                row[f] = row[f] * (1.0 + d)

        for f in row:
            if f in AX.LOG1P or f in ('cal_events',):
                row[f] = max(0.0, round(row[f]))
            elif f == 'avg_sleep':
                row[f] = round(max(2.0, min(11.0, row[f])), 2)
            else:
                row[f] = round(max(0.0, row[f]), 2)

        for h in holes:
            if h['at'] <= i < h['at'] + h['len']:
                for fam in h['fams']:
                    for f in FAM_OF_FEAT[fam]:
                        row.pop(f, None)

        merged[w] = row
    return merged, spikes, holes


def main():
    out_dir = os.path.join(HERE, 'out')
    os.makedirs(out_dir, exist_ok=True)
    rng = random.Random(SEED)

    weeks = iso_weeks(N_WEEKS)
    weeks.sort(key=week_sort_key)
    merged, spikes, holes = make_merged(weeks, rng)

    A52, A8, _flags = AX.build_axes(merged, weeks)
    pcts = rolling_pct(A52, weeks)
    verdicts = AX.judge_weeks(A8, weeks)      # 확인 등급 — 스펙 D

    records = []
    for i, w in enumerate(weeks):
        hist = [merged[x] for x in weeks[max(0, i - AX.WIN_LONG):i]]
        usual = AX.usual_families(hist)
        records.append(
            AX.week_record(w, merged[w], A52[w], A8[w], pcts[w], usual=usual,
                           verdict=verdicts[w]))

    cur_i = None
    for i in range(len(records) - 1, -1, -1):
        if sum(1 for ax in AX.AXIS_ORDER
               if records[i]['axes'][ax]['z52'] is not None) >= 2:
            cur_i = i
            break
    if cur_i is None:
        cur_i = len(records) - 1

    cur = dict(records[cur_i])
    cur['week'] = 'current'
    cur['source_week'] = records[cur_i]['week']
    cur['weeks_behind'] = len(records) - 1 - cur_i
    cur['gem'] = None
    cur['grade'] = None

    similar = AX.similar_weeks(A52, weeks, weeks[cur_i], k=5)

    out = {
        '_WARNING': '합성 데이터입니다. 실기록이 아닙니다. 분석하지 마세요.',
        'fixture': True,
        'fixture_seed': SEED,
        'schema': 'mined.axes.v2',
        'generated_from': f'합성 {len(weeks)}주 (실데이터 아님)',
        'spec': {
            'tau': AX.TAU, 'tau_pct': AX.TAU_PCT, 'step': AX.STEP,
            'log1p': sorted(AX.LOG1P),
            'win_long': AX.WIN_LONG, 'win_short': AX.WIN_SHORT,
            'min_periods': AX.MIN_PERIODS,
            'similarity': {'metric': 'euclidean', 'clip': AX.SIM_CLIP,
                           'exclude_recent': AX.SIM_EXCLUDE_RECENT,
                           'neighbor_gap': AX.SIM_NEIGHBOR_GAP},
        },
        'weeks': records,
        'current': cur,
        'similar_to_current': similar,
    }
    path = os.path.join(out_dir, 'gyeol_axes_fake.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    # ── 요약 ────────────────────────────────────────────────
    n_gem = sum(1 for r in records if r['gem'])
    n_flu = sum(1 for r in records if r['gem'] == AX.GEM_COMPLEX)
    gems = {}
    for r in records:
        if r['gem']:
            gems[r['gem']] = gems.get(r['gem'], 0) + 1
    grains = {}
    for r in records:
        grains[r['grain']] = grains.get(r['grain'], 0) + 1
    n_missing = sum(1 for r in records if r['missing_families'])
    n_thin = sum(1 for r in records if not r['cross_validated'])
    cov = {ax: sum(1 for r in records if r['axes'][ax]['z52'] is not None)
           for ax in AX.AXIS_ORDER}

    L = []
    def A(s=''): L.append(s)
    A('# fixture_summary — 합성 픽스처')
    A('')
    A('> **실데이터가 아닙니다.** 값은 전부 지어낸 것이고, 숫자에 의미가 없습니다.')
    A('> 구조·계산·스키마만 진짜입니다 (`gyeol/axes.py` 코드 경로를 그대로 탑니다).')
    A('')
    A(f'- 주 수 **{len(weeks)}** ({weeks[0]} ~ {weeks[-1]})')
    A(f'- 씨앗 `{SEED}` — 같은 씨앗이면 같은 파일이 나옵니다')
    A(f'- 광물이 나온 주 **{n_gem}** ({100.0*n_gem/len(weeks):.0f}%) · 형석 {n_flu}주')
    A('  - ⚠ **실측은 16%** 입니다 (실데이터 800주 중 129주). 픽스처는 9종을 다')
    A('    보여주려고 일부러 더 자주 나오게 했습니다. **이 비율을 인용하지 마세요.**')
    A(f'- 결측 줄이 붙은 주 **{n_missing}** · 근거가 얇은 주(계열 1개) **{n_thin}**')
    A('')
    A('**광물 분포**')
    A('')
    A('| 광물 | 주 |')
    A('|---|---|')
    for g, c in sorted(gems.items(), key=lambda x: -x[1]):
        A(f'| `{g}` | {c} |')
    A('')
    A('**결**')
    A('')
    A('| 결 | 주 |')
    A('|---|---|')
    for g, c in sorted(grains.items(), key=lambda x: -x[1]):
        A(f'| `{g}` | {c} |')
    A('')
    A('**축 커버리지** (z52 가 만들어진 주)')
    A('')
    A('| 축 | 화면 이름 | 주 |')
    A('|---|---|---|')
    for ax in AX.AXIS_ORDER:
        A(f'| `{ax}` | {AX.axis_screen(ax)} | {cov[ax]} |')
    A('')
    from collections import Counter
    gr = Counter(r['grade'] for r in records)
    A('**확인 등급** (스펙 D · `judge_weeks`)')
    A('')
    A('| 등급 | 주 |')
    A('|---|---|')
    for g in AX.GRADE_ORDER + AX.GRADE_PENDING:
        A(f'| `{g}` | {gr.get(g, 0)} |')
    A(f'| 이탈 없음(판정 대상 아님) | {gr.get(None, 0)} |')
    A('')
    A(f'**닮은 주 (current 기준, k=5)** — {len(similar)}개')
    A('')
    A('| 주 | 거리 | 쓴 축 | 얇음 |')
    A('|---|---|---|---|')
    for s in similar:
        A(f"| {s['week']} | {s['distance']} | {s['axes_used']} | {'예' if s['thin'] else '아니오'} |")
    A('')
    A('---')
    A('')
    A('아직 안 들어간 것 — `grade` · `return_week` · `hold_until`.')
    A('`judge.py` 를 붙인 뒤 이 파일도 같이 다시 찍어야 합니다.')

    spath = os.path.join(out_dir, 'fixture_summary.md')
    open(spath, 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    kb = os.path.getsize(path) / 1024.0
    print(f'[OK] {path}  ({kb:.0f}KB)')
    print(f'[OK] {spath}')
    print(f'     {len(weeks)}주 · 광물 {n_gem}주 · 결측 {n_missing}주 · 닮은 주 {len(similar)}개')


if __name__ == '__main__':
    main()
