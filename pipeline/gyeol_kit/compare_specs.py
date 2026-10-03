#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
compare_specs.py — 판정 스펙 2×2 비교 (과제 ⑧ 검증용)

    cp compare_specs.py calibrate_axes.py ~/Desktop/gyeol_kit/
    cd ~/Desktop/gyeol_kit
    python3 compare_specs.py --name "표시되는이름" --mark 2018-W36

무엇을 비교하는가
  우리 v5 = 최소 4주 대기 + 4주 지속
  과제    = 4주 이내 복귀 + 3주 지속

  이 둘은 **두 군데**가 다릅니다. 그래서 2×2로 돌립니다.

              지속 3주   지속 4주
  대기 없음      A          B
  대기 4주       C          D = v5 현행

핵심 지표
  「지나갔다(held)」가 늘어난 만큼 「모른다(insufficient)」가 줄었으면
  그 증가분은 전부 오판입니다. 그 숫자를 뽑는 게 이 스크립트의 목적입니다.

결과물
  out/spec_compare.md  ← 이 파일만 채팅 창에 붙이면 됩니다
"""
from __future__ import annotations
import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run_gyeol as RG                                  # noqa: E402
from gyeol import detect                                # noqa: E402
from calibrate_axes import (AXES, build_feature_z, axis_z,   # noqa: E402
                            week_sort_key, WIN_SHORT, MIN_PERIODS_SHORT)

Z_OUT = 2.0    # 이탈 — redesign §4
Z_BAND = 1.0   # 「내 평소」 밴드 — redesign §2
RETURN_WINDOW = 4   # 복귀 상한 (두 스펙 공통)


def grade_axis(zs, start, hold, wait_min):
    """
    한 축에서, start 주에 시작된 이탈 하나를 판정합니다.

    zs        [(week, z or None), ...] 시간순
    hold      지속으로 인정할 연속 주 수 (3 또는 4)
    wait_min  이탈 종료 후 이만큼 지나기 전에는 판정하지 않음 (0 또는 4)

    반환: 'held' | 'returned' | 'open' | 'insufficient'
    """
    n = len(zs)

    # 1) 이탈 구간의 끝을 찾는다 — |z| < Z_OUT 이 되는 첫 주
    i = start
    while i < n and zs[i][1] is not None and abs(zs[i][1]) >= Z_OUT:
        i += 1
    if i >= n:
        return 'open'          # 데이터 끝까지 이탈 중
    end = i                    # 이탈이 끝난 직후 주

    # 2) 대기 하한 — 아직 충분히 지나지 않았으면 판정하지 않는다
    if end + wait_min > n - 1:
        return 'open'

    # 3) 복귀 — end 부터 RETURN_WINDOW 주 안에 밴드 안으로 들어오는가
    back = None
    for j in range(end, min(end + RETURN_WINDOW, n)):
        z = zs[j][1]
        if z is None:
            return 'insufficient'      # 판정 창에 결측 → 모른다
        if abs(z) < Z_BAND:
            back = j
            break
    if back is None:
        return 'open'

    # 4) 지속 — 복귀 후 hold 주 동안 밴드 유지
    tail = zs[back:back + hold]
    if len(tail) < hold:
        return 'returned'              # 아직 그만큼 지나지 않음
    for _, z in tail:
        if z is None:
            return 'insufficient'      # 지속 창에 결측 → 모른다
        if abs(z) >= Z_BAND:
            return 'returned'
    return 'held'


def run_spec(axis_series, hold, wait_min):
    """
    2×2 한 칸을 돌립니다.
    반환: (counts, per_week)
      counts   {'held': n, 'returned': n, 'open': n, 'insufficient': n}
      per_week {week: grade}   ← 이탈이 시작된 주에만 등급이 붙습니다
    """
    counts = {'held': 0, 'returned': 0, 'open': 0, 'insufficient': 0}
    per_week = {}
    RANK = ['held', 'returned', 'open', 'insufficient']   # 보수적일수록 뒤

    for ax, zs in axis_series.items():
        n = len(zs)
        i = 0
        while i < n:
            z = zs[i][1]
            if z is None or abs(z) < Z_OUT:
                i += 1
                continue
            # 이탈 시작
            g = grade_axis(zs, i, hold, wait_min)
            w = zs[i][0]
            prev = per_week.get(w)
            if prev is None or RANK.index(g) > RANK.index(prev):
                per_week[w] = g
            # 이 이탈 구간을 건너뛴다
            while i < n and zs[i][1] is not None and abs(zs[i][1]) >= Z_OUT:
                i += 1

    for g in per_week.values():
        counts[g] += 1
    return counts, per_week


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default=None)
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--mark', action='append', default=[], metavar='2018-W36',
                    help='이 주가 각 칸에서 어떻게 판정되는지 표시')
    ap.add_argument('--mark-range', default=None, metavar='2025-W01:2025-W14')
    args = ap.parse_args()
    if args.mark_range:
        from calibrate_axes import expand_range
        args.mark = sorted(set(args.mark) | set(expand_range(args.mark_range)),
                           key=week_sort_key)

    os.makedirs(args.out, exist_ok=True)
    print('▸ data/ 읽는 중…')
    found = detect.scan(args.data)
    weekly, _, _ = RG.load_all(found, args.name, interactive=False)
    merged = RG.merge_weekly(weekly)
    weeks = sorted(merged, key=week_sort_key)
    print(f'  {len(weeks)}주')

    print('▸ 축별 z8 계산…')
    z8, _ = build_feature_z(merged, weeks, WIN_SHORT, MIN_PERIODS_SHORT)
    A8 = {w: axis_z(z8.get(w, {})) for w in weeks}
    axis_series = {ax: [(w, A8[w][ax][0]) for w in weeks] for ax in AXES}

    CELLS = [
        ('A', 3, 0, '지속 3주 · 대기 없음  (과제 스펙에 가까움)'),
        ('B', 4, 0, '지속 4주 · 대기 없음'),
        ('C', 3, 4, '지속 3주 · 대기 4주'),
        ('D', 4, 4, '지속 4주 · 대기 4주  ← v5 현행'),
    ]

    print('▸ 2×2 판정…')
    results = {}
    for name, hold, wait, _label in CELLS:
        results[name] = run_spec(axis_series, hold, wait)

    # ── 리포트 ──────────────────────────────────────────────
    L = []
    A = L.append
    A('# 판정 스펙 2×2 비교')
    A('')
    A(f'`compare_specs.py` · 분석 주 **{len(weeks)}주** · '
      f'이탈 |z8| ≥ {Z_OUT} · 밴드 |z8| < {Z_BAND} · 복귀 상한 {RETURN_WINDOW}주')
    A('')
    A('## 1. 결과')
    A('')
    A('| 칸 | 스펙 | 지나갔다 `held` | 돌아왔다 `returned` | 아직 `open` | 모른다 `insufficient` |')
    A('|---|---|---|---|---|---|')
    for name, hold, wait, label in CELLS:
        c = results[name][0]
        A(f"| **{name}** | {label} | **{c['held']}** | {c['returned']} | "
          f"{c['open']} | {c['insufficient']} |")
    A('')

    A('## 2. ⚠ 핵심 — held 증가분이 insufficient에서 왔는가')
    A('')
    A('「모른다」가 「지나갔다」로 바뀐 건 우리 원칙에서 가장 비싼 오류입니다.')
    A('')
    A('| 비교 | held 변화 | insufficient 변화 | 판정 |')
    A('|---|---|---|---|')
    base = results['D'][0]
    for name, hold, wait, label in CELLS:
        if name == 'D':
            continue
        c = results[name][0]
        dh = c['held'] - base['held']
        di = c['insufficient'] - base['insufficient']
        if dh > 0 and di < 0:
            verdict = f'⚠ **{min(dh, -di)}주가 「모른다」에서 넘어왔습니다**'
        elif dh > 0:
            verdict = 'held는 늘었지만 insufficient에서 온 건 아닙니다'
        else:
            verdict = '문제 없음'
        A(f'| {name} vs D | {dh:+d} | {di:+d} | {verdict} |')
    A('')

    A('## 2-b. 대기 하한이 의미가 있는가')
    A('')
    same_ac = results['A'][0]['held'] == results['C'][0]['held']
    same_bd = results['B'][0]['held'] == results['D'][0]['held']
    if same_ac and same_bd:
        A('**A = C, B = D 입니다. 「최소 4주 대기」가 결과를 바꾸지 않았습니다.**')
        A('')
        A(f'복귀를 {RETURN_WINDOW}주 창 안에서 찾기 때문에, 판정 시점이 '
          f'어차피 이탈 종료 + {RETURN_WINDOW}주 뒤가 됩니다. '
          '**대기 하한이 복귀 상한에 이미 흡수돼 있습니다.**')
        A('')
        A('> 그러면 v5와 과제 스펙의 진짜 차이는 **지속 3주 vs 4주 하나뿐**입니다.')
        A('> 회의 안건이 2×2에서 단일 선택으로 줄어듭니다.')
    else:
        A('A≠C 또는 B≠D 입니다 — 대기 하한이 실제로 결과를 바꿉니다. '
          '두 변수를 따로 정해야 합니다.')
    A('')

    if args.mark:
        A('## 3. 지정한 주 — 여기서 탈락이 갈립니다')
        A('')
        A('| 주 | A | B | C | D (v5) |')
        A('|---|---|---|---|---|')
        for w in args.mark:
            row = [results[n][1].get(w, '—') for n, _, _, _ in CELLS]
            A(f"| **{w}** | {row[0]} | {row[1]} | {row[2]} | {row[3]} |")
        A('')
        A('> **`held`가 나온 칸은 즉시 탈락입니다.** 장례 주간을 '
          '「지나갔다」로 판정하는 스펙은 v1의 오판이 되살아난 것입니다.')
        A('')
        A('> `—`는 그 주에 이탈이 시작되지 않았다는 뜻입니다. '
          '이탈 자체가 안 잡히면 그것도 문제이니, 그때는 τ를 낮춰서 다시 보세요.')
        A('')

    A('---')
    A('')
    A('## 읽는 순서')
    A('')
    A('1. **3장 먼저.** `held`가 뜬 칸을 지웁니다')
    A('2. 남은 칸 중 2장에서 「모른다에서 넘어온 주」가 0인 것을 고릅니다')
    A('3. 그래도 둘이 남으면 1장에서 `open`이 적은 쪽 — 더 많이 말해줄 수 있는 쪽입니다')
    A('')
    A('> 이 파일만 채팅 창에 붙이시면 됩니다. 원본은 올리지 마세요.')
    A('')

    path = os.path.join(args.out, 'spec_compare.md')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n✅ {path}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
