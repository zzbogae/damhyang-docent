#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_axes_json.py — 과제 ①②③ 산출물

    python3 build_axes_json.py --data ../data --out ../out

axes.py 의 확정 규칙으로 주별 레코드를 만들어 JSON 으로 내보냅니다.
기존 export_app_data.py 를 건드리지 않습니다. 별도 파일로 나갑니다.

나오는 것
  out/gyeol_axes.json     앱이 읽을 축 데이터 (원문 없음)
  out/axes_summary.md     사람이 읽을 요약 — 이것만 대화창에 붙이면 됩니다

과제 대응
  ① 축별 robust z · dominant_axis · direction     → axes / dominant_axis / direction
  ② current(최근 주)                              → weeks 의 마지막 + current 블록
  ③ 닮은 주 3개                                    → similar (검증용. 실제는 앱에서 계산)
"""
from __future__ import annotations
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run_gyeol as RG                       # noqa: E402
from gyeol import detect                     # noqa: E402
from gyeol import axes as AX                 # noqa: E402


def pct_label(p):
    """
    백분위를 사람이 읽는 말로.
    낮은 값을 「상위 100%」라고 쓰면 안 됩니다 — 「하위 N%」입니다.
    """
    if p is None:
        return '—'
    if p >= 50:
        return '상위 %d%%' % (100 - p)
    return '하위 %d%%' % p


def week_sort_key(w):
    y, n = w.split('-W')
    return (int(y), int(n))


def rolling_pct(A52, weeks, window=AX.WIN_LONG):
    """
    축별 롤링 백분위 — 근거 줄 전용 ("직전 52주 중 상위 12%").
    판정에는 쓰지 않습니다. z 가 판정하고, 백분위는 사람이 읽습니다.
    """
    out = {w: {} for w in weeks}
    hist = {ax: [] for ax in AX.AXIS_ORDER}
    for w in weeks:
        for ax in AX.AXIS_ORDER:
            z = A52[w][ax][0]
            if z is None:
                out[w][ax] = None
                continue
            h = hist[ax][-window:]
            if len(h) >= AX.MIN_PERIODS:
                below = sum(1 for x in h if x < z)
                out[w][ax] = round(100.0 * below / len(h))
            else:
                out[w][ax] = None
            hist[ax].append(z)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--name', default=None)
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--mark-range', default=None, metavar='2024-W44:2025-W20',
                    help='이 구간의 광물을 표로 보여줍니다')
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    print('▸ data/ 읽는 중…')
    found = detect.scan(args.data)
    weekly, _, _ = RG.load_all(found, args.name, interactive=False)
    merged = RG.merge_weekly(weekly)
    weeks = sorted(merged, key=week_sort_key)
    print(f'  {len(weeks)}주')

    print('▸ 축 계산 (log1p → robust z, 창 52주 / 8주)…')
    A52, A8, flags = AX.build_axes(merged, weeks)
    pcts = rolling_pct(A52, weeks)

    print('▸ 주별 레코드 만드는 중…')
    # 「평소 있던 계열」은 그 주 이전만 봅니다. 미래를 보면 안 됩니다.
    records = []
    for i, w in enumerate(weeks):
        hist = [merged[x] for x in weeks[max(0, i - AX.WIN_LONG):i]]
        usual = AX.usual_families(hist)
        records.append(
            AX.week_record(w, merged[w], A52[w], A8[w], pcts[w], usual=usual))

    # ② current — 「마지막 주」가 아니라 「읽을 수 있는 마지막 주」.
    #    내보내기가 오래됐으면 캘린더만 남은 꼬리 주가 마지막이 됩니다.
    #    그걸 「지금의 나」라고 부르면 거짓말입니다.
    cur_i = None
    for i in range(len(records) - 1, -1, -1):
        n_ax = sum(1 for ax in AX.AXIS_ORDER
                   if records[i]['axes'][ax]['z52'] is not None)
        if n_ax >= 2:
            cur_i = i
            break
    if cur_i is None:
        cur_i = len(records) - 1

    cur = dict(records[cur_i])
    cur['week'] = 'current'
    cur['source_week'] = records[cur_i]['week']
    cur['weeks_behind'] = len(records) - 1 - cur_i   # 몇 주 전인지
    cur['gem'] = None          # 캐기 전입니다
    cur['grade'] = None        # 그 뒤가 없으니 등급이 없습니다

    # ③ 닮은 주 — 검증용. 실제 서비스에서는 앱이 계산합니다.
    similar = AX.similar_weeks(A52, weeks, weeks[cur_i], k=3)

    out = {
        'schema': 'mined.axes.v2',
        'generated_from': f'{len(weeks)}주',
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
    path = os.path.join(args.out, 'gyeol_axes.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    size_kb = os.path.getsize(path) / 1024.0

    # ── 요약 ────────────────────────────────────────────────
    n_gem = sum(1 for r in records if r['gem'])
    n_flu = sum(1 for r in records if r['gem'] == AX.GEM_COMPLEX)
    n_cross = sum(1 for r in records if r['cross_validated'])
    gem_count, dom_count, cov = {}, {}, {ax: 0 for ax in AX.AXIS_ORDER}
    for r in records:
        if r['gem']:
            gem_count[r['gem']] = gem_count.get(r['gem'], 0) + 1
        if r['dominant_axis']:
            dom_count[r['dominant_axis']] = dom_count.get(r['dominant_axis'], 0) + 1
        for ax in AX.AXIS_ORDER:
            if r['axes'][ax]['z52'] is not None:
                cov[ax] += 1

    L = []
    A = L.append
    A('# 축 데이터 생성 결과')
    A('')
    A(f'`build_axes_json.py` · **{len(weeks)}주** · '
      f'`gyeol_axes.json` **{size_kb:.0f} KB**')
    A('')
    A('> 이 JSON 에는 원문이 없습니다. 축 z · 계열 · 광물 · 일정 개수뿐입니다.')
    A('')
    A('## 1. 확정 규칙이 그대로 들어갔는지')
    A('')
    A('| | 값 |')
    A('|---|---|')
    tau_txt = ' · '.join('%s %s' % (AX.AXES[k]['label'], v)
                         for k, v in AX.TAU.items())
    A('| τ | ' + tau_txt + ' |')
    A(f'| 계단식 문턱 | {AX.STEP} × τ |')
    A(f'| log1p 대상 | {len(AX.LOG1P)}종 |')
    A(f'| 창 | z52 {AX.WIN_LONG}주 · z8 {AX.WIN_SHORT}주 |')
    A(f'| 유사도 | 유클리드 · 클립 ±{AX.SIM_CLIP:g} · '
      f'최근 {AX.SIM_EXCLUDE_RECENT}주 제외 · 앞뒤 {AX.SIM_NEIGHBOR_GAP}주 제외 |')
    A('')
    A('## 2. 결과')
    A('')
    A('| | 주 수 | 비율 |')
    A('|---|---|---|')
    A(f'| 광물이 생긴 주 | {n_gem} | {100.0*n_gem/len(weeks):.0f}% |')
    A(f'| 그중 형석 | {n_flu} | {100.0*n_flu/len(weeks):.1f}% |')
    A(f'| 평범한 주 (광물 없음) | {len(weeks)-n_gem} | {100.0*(len(weeks)-n_gem)/len(weeks):.0f}% |')
    A(f'| 계열 2종 이상 | {n_cross} | {100.0*n_cross/len(weeks):.0f}% |')
    A('')
    A('**확정 기록 v2와 비교** — 광물 130주(16%) · 형석 25주(3.1%) 였습니다. '
      '크게 다르면 채널 구성이 바뀐 것입니다.')
    A('')
    A('## 3. 축별 커버리지')
    A('')
    A('| 축 | z52 있는 주 | 비율 | dominant |')
    A('|---|---|---|---|')
    for ax in AX.AXIS_ORDER:
        A(f"| {AX.AXES[ax]['label']} `{ax}` | {cov[ax]} | "
          f"{100.0*cov[ax]/len(weeks):.0f}% | {dom_count.get(ax, 0)}주 |")
    A('')
    # 공정한 비교를 위해 공통 τ 도 이 데이터에서 새로 뽑습니다.
    # (axes.py 의 TAU 는 보경님 800주에서 나온 상수라,
    #  데이터가 바뀌면 맞지 않을 수 있습니다)
    tau_fresh = AX.calibrate_tau(A52, weeks)
    tau_up, tau_down = AX.calibrate_tau_directional(A52, weeks)

    def _count(up=None, down=None, base=None):
        _s = (AX.TAU_UP, AX.TAU_DOWN)
        AX.TAU_UP, AX.TAU_DOWN = up, down
        c = {}
        for w in weeks:
            g, _d, _di, _n = AX.pick_gem(A52[w], tau=base or AX.TAU)
            if g:
                c[g] = c.get(g, 0) + 1
        AX.TAU_UP, AX.TAU_DOWN = _s
        return c

    fresh_gem = _count(base=tau_fresh)
    dir_gem = _count(up=tau_up, down=tau_down, base=tau_fresh)

    A('## 4. 광물 분포')
    A('')
    A('| 광물 | 주 수 |')
    A('|---|---|')
    for g, n in sorted(gem_count.items(), key=lambda x: -x[1]):
        star = ' ★' if g == AX.GEM_COMPLEX else ''
        A(f'| `{g}`{star} | {n} |')
    if len(gem_count) < 9:
        miss = (set(AX.GEM.values()) | {AX.GEM_COMPLEX}) - set(gem_count)
        A('')
        A(f"> ⚠ 한 번도 안 나온 광물: {', '.join(sorted(miss))}")
    A('')

    # ── 4-b. 방향별 τ 로 바꾸면 ──────────────────────────────
    A('## 4-b. ★ 방향별 τ 로 바꾸면')
    A('')
    A('지금은 `|z|` 하나로 자릅니다. 건수형 지표는 오른쪽 꼬리가 길어서 '
      '**그 문턱을 위쪽이 거의 다 먹습니다.** 아래로 꽤 드문 주도 '
      '위쪽에 가려 안 잡힙니다.')
    A('')
    A('| 축 | τ 위 | τ 아래 | 지금(공통) |')
    A('|---|---|---|---|')
    for ax in AX.AXIS_ORDER:
        u = '—' if tau_up[ax] is None else '%.2f' % tau_up[ax]
        d = '—' if tau_down[ax] is None else '%.2f' % tau_down[ax]
        A(f"| {AX.AXES[ax]['label']} | {u} | {d} | {AX.TAU[ax]} |")
    A('')
    up_names = {AX.GEM[(ax, 'up')] for ax in AX.AXIS_ORDER}
    now_up = sum(n for g, n in fresh_gem.items() if g in up_names)
    now_dn = sum(n for g, n in fresh_gem.items()
                 if g not in up_names and g != AX.GEM_COMPLEX)
    new_up = sum(n for g, n in dir_gem.items() if g in up_names)
    new_dn = sum(n for g, n in dir_gem.items()
                 if g not in up_names and g != AX.GEM_COMPLEX)
    drift = max(abs(AX.TAU[ax] - tau_fresh[ax]) for ax in AX.AXIS_ORDER
                if tau_fresh[ax] is not None)
    if drift > 0.3:
        A(f'> ⚠ 이 데이터에서 새로 뽑은 공통 τ 가 `axes.py` 의 상수와 '
          f'최대 {drift:.2f} 차이납니다. 채널 구성이 바뀌었다는 뜻이라 '
          f'τ 를 다시 박아야 합니다.')
        A('')
    A('아래는 **둘 다 이 데이터에서 새로 뽑은 문턱**으로 비교한 것입니다.')
    A('')
    A('| | 공통 τ | 방향별 τ |')
    A('|---|---|---|')
    A(f"| 광물 생긴 주 | {sum(fresh_gem.values())} | {sum(dir_gem.values())} |")
    A(f"| 위(up) 광물 | {now_up} | {new_up} |")
    A(f"| 아래(down) 광물 | **{now_dn}** | **{new_dn}** |")
    A(f"| 형석 | {fresh_gem.get(AX.GEM_COMPLEX, 0)} | {dir_gem.get(AX.GEM_COMPLEX, 0)} |")
    A(f"| 안 쓰인 광물 | {9-len(fresh_gem)}종 | {9-len(dir_gem)}종 |")
    A('')
    A('| 광물 | 공통 τ | 방향별 τ |')
    A('|---|---|---|')
    for g in sorted(set(AX.GEM.values()) | {AX.GEM_COMPLEX}):
        star = ' ★' if g == AX.GEM_COMPLEX else ''
        A(f"| `{g}`{star} | {fresh_gem.get(g, 0)} | {dir_gem.get(g, 0)} |")
    A('')
    A('**고르는 법** — 「덜 움직인 주」가 우리 세계관의 핵심인데 '
      '지금은 거의 안 나옵니다. 방향별로 바꿔서 아래 광물이 적당히 '
      '생기고 전체 광물 수가 20%를 안 넘으면 그쪽이 맞습니다.')
    A('')
    # ── 4-c. 지정 구간의 광물 ────────────────────────────────
    if args.mark_range:
        a_, b_ = args.mark_range.split(':')
        lo, hi = week_sort_key(a_), week_sort_key(b_)
        span = [r for r in records if lo <= week_sort_key(r['week']) <= hi]
        if span:
            A('## 4-c. 지정 구간 — 지금 규칙으로 실제 박히는 광물')
            A('')
            A('| 주 | 움직임 | 쉼 | 보기 | 남기기 | **광물** | 계열 |')
            A('|---|---|---|---|---|---|---|')
            for r in span:
                cells = []
                for ax in AX.AXIS_ORDER:
                    z = r['axes'][ax]['z52']
                    if z is None:
                        cells.append('·')
                    elif ax == r['dominant_axis'] or ax in r['near_axes']:
                        cells.append('**%.2f**' % z if ax == r['dominant_axis']
                                     else '_%.2f_' % z)
                    else:
                        cells.append('%.2f' % z)
                g = r['gem'] or '—'
                if g == AX.GEM_COMPLEX:
                    g = '**%s**' % g
                A(f"| {r['week']} | {cells[0]} | {cells[1]} | {cells[2]} | "
                  f"{cells[3]} | {g} | {len(r['evidence_families'])}종 |")
            A('')
            ng = sum(1 for r in span if r['gem'])
            nf = sum(1 for r in span if r['gem'] == AX.GEM_COMPLEX)
            nd = sum(1 for r in span if r['direction'] == 'down')
            A(f'이 구간 {len(span)}주 중 **광물 {ng}개** · 형석 **{nf}개** · '
              f'아래 방향 **{nd}개**')
            A('')
            A('- **굵게** = dominant 축 · _기울임_ = 근접 축 · `·` = 기록 없음')
            A('')

    # 결 분포
    gr = {}
    for r in records:
        gr[r['grain']] = gr.get(r['grain'], 0) + 1
    A('## 4-d. 결(줄무늬) 분포')
    A('')
    A('광물은 τ(드문 정도), 결은 z 크기로 따로 정합니다.')
    A('')
    A('| 결 | 패턴 | 주 수 | 비율 |')
    A('|---|---|---|---|')
    for k, label in (('mixed', '여러 축이 벗어남'),
                     ('coarse', '한 축만 벗어남'),
                     ('regular', '전부 평소 범위')):
        n = gr.get(k, 0)
        A(f"| `{k}` | {AX.GRAIN[k]} — {label} | {n} | {100.0*n/len(weeks):.0f}% |")
    A('')
    n_miss = sum(1 for r in records if r['context_lines'])
    A('')
    A('### 결측 맥락 줄 (§7-③)')
    A('')
    A(f'- 이 줄이 붙는 주: **{n_miss}주** ({100.0*n_miss/len(records):.0f}%)')
    A('- 조건부입니다. 빈 계열이 없으면 아예 안 나옵니다')
    A('')

    no_gem_but_grain = sum(1 for r in records
                           if not r['gem'] and r['grain'] != 'regular')
    A(f'**광물은 없는데 결이 평평하지 않은 주: {no_gem_but_grain}주** — '
      '이 주들이 이전에는 전부 같은 무늬였습니다.')
    A('')

    A('## 5. 지금의 나 (`current`)')
    A('')
    behind = cur.get('weeks_behind', 0)
    if behind:
        A(f"기준 주 `{cur['source_week']}` — **마지막 주보다 {behind}주 전입니다**")
        A('')
        A('> 마지막 주에는 캘린더만 남아 있어서 축을 만들 수 없었습니다.')
        A('> 화면에서 「지금의 나」라고 부르면 거짓말이 됩니다 — '
          '**「마지막으로 읽을 수 있는 주」**가 맞습니다.')
    else:
        A(f"기준 주 `{cur['source_week']}`")
    A('')
    A('| 축 | z52 | z8 | 상위 % |')
    A('|---|---|---|---|')
    for ax in AX.AXIS_ORDER:
        a = cur['axes'][ax]
        pct = pct_label(a['pct52'])
        A(f"| {AX.AXES[ax]['label']} | {a['z52'] if a['z52'] is not None else '·'} | "
          f"{a['z8'] if a['z8'] is not None else '·'} | {pct} |")
    A('')
    A(f"- 벗어난 축 {cur['n_axes_out']}개 · 계열 {len(cur['evidence_families'])}종 "
      f"({', '.join(cur['evidence_families']) or '없음'})")
    A(f"- `gem` 과 `grade` 는 **`null`** 입니다 — 아직 캐기 전이고, 그 뒤가 없습니다")
    A('')
    A('## 6. 닮은 주 3개 (검증용)')
    A('')
    if similar:
        A('| 순위 | 주 | 거리 | 쓴 축 | |')
        A('|---|---|---|---|---|')
        for i, s in enumerate(similar, 1):
            thin = '근거 얇음' if s['thin'] else ''
            A(f"| {i} | {s['week']} | {s['distance']} | {s['axes_used']}축 | {thin} |")
        A('')
        A(f"> 최근 {AX.SIM_EXCLUDE_RECENT}주를 뺐기 때문에 지난달이 안 나옵니다. "
          f"그리고 1위 앞뒤 {AX.SIM_NEIGHBOR_GAP}주를 빼서 서로 다른 시기가 나옵니다.")
        A('> **실제 서비스에서는 앱이 계산합니다.** 이건 규칙이 맞는지 보는 용도입니다.')
    else:
        A('닮은 주를 못 찾았습니다 — 비교할 과거 주가 부족합니다.')
    A('')
    A('---')
    A('')
    A('## 다음')
    A('')
    A('1. 이 요약만 대화창에 붙이면 됩니다. `gyeol_axes.json` 은 올리지 마세요')
    A('2. 앱의 `pickGem(week.week)` → `pickGem(dominant_axis, direction, cross_validated)`')
    A('3. 게이지가 이 JSON 의 `z52` 와 `pct52` 를 읽게 연결')
    A('')

    spath = os.path.join(args.out, 'axes_summary.md')
    with open(spath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))

    print('')
    print(f'  ✅ {path}  ({size_kb:.0f} KB)')
    print(f'  ✅ {spath}')
    print('')
    print(f'  광물 {n_gem}주 · 형석 {n_flu}주 · 평범한 주 {len(weeks)-n_gem}주')
    return 0


if __name__ == '__main__':
    sys.exit(main())
