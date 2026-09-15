#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gyeol_kit/export_app_data.py

run_gyeol.py와 똑같이 data/ 를 읽어서 판정까지 돌린 다음,
HTML 리포트 대신 **앱이 읽을 수 있는 JSON**으로 저장합니다.

사용법 (gyeol_kit 폴더 안에서):
    python3 export_app_data.py --who "보경"

data/ 폴더는 run_gyeol.py 때와 완전히 같은 걸 씁니다. 새로 넣을 것 없습니다.

출력: out/gyeol_data.json

포함하는 것 — "되돌려줄 것"(인출 필터를 통과한 주)만, 각 주마다:
  · date_range        그 주의 시작~끝 날짜
  · sentence          판정 문장 (build_sentence 그대로 — "지나갔고 이어짐" 등 표현 규칙 준수)
  · tier              recovered / passed / observed
  · badges            근거 지표 (있는 만큼)
  · cross_validated   교차검증 여부 (단일 출처면 false)
  · core_svg          실제 걸음수로 절차적 생성된 코어 SVG (문자열 그대로)
                       — 건강 데이터가 그 주에 없으면 null (AI가 지어내지 않음)

포함하지 않는 것 (그대로 유지 — 프라이버시 원칙):
  · 카톡 원문, 메모 원문, 사진 파일 자체 — 이 스크립트는 만들지 않습니다.
    화면에 실제 원본을 보여주고 싶은 주가 있으면, 그 주만 골라 사람이 직접
    사진/메모를 찾아서 앱 쪽에 별도로 넣어야 합니다 (지금까지 해온 방식 그대로).
  · 인출 필터에서 제외된 주(withheld) — 애초에 이 JSON에 들어가지 않습니다.
  · 위기 점수·플래그 — 계산에만 쓰이고 저장되지 않습니다 (crisis_filter.py 원칙 그대로).
"""
import argparse
import json
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import run_gyeol as G                                   # noqa: E402
from gyeol import detect, crisis_filter                  # noqa: E402
from gyeol import rolling_baseline as RB                 # noqa: E402
from gyeol.judge import apply_evidence_floor, build_sentence, evidence, pct_label  # noqa: E402
from gyeol.channels import FEATURE_DIRECTION, FEATURE_LABEL  # noqa: E402
from gyeol.core_generator import core_params, draw_core, MINERALS  # noqa: E402


def build_health_index(health_rows):
    """건강 rows를 주차별로 묶고, 전체 평균 목록도 같이 반환 (core_generator 입력 형식)"""
    if not health_rows:
        return {}, []
    by_week = defaultdict(lambda: {'days': [], 'sleep': []})
    for r in health_rows:
        iso = r['date'].isocalendar()
        k = f'{iso[0]}-W{iso[1]:02d}'
        if r.get('steps') is not None:
            by_week[k]['days'].append((r['date'], r['steps']))
        if r.get('sleep_hours') is not None:
            by_week[k]['sleep'].append(r['sleep_hours'])
    for k in by_week:
        by_week[k]['days'].sort()
    avgs = [sum(v for _, v in d['days']) / len(d['days'])
            for d in by_week.values() if d['days']]
    return by_week, avgs


def week_key_from_range(date_range):
    """cand['date_range']의 시작일(문자열 또는 date 객체) → ISO 주차 키"""
    from datetime import date as D
    start = date_range[0]
    if isinstance(start, D):
        d0 = start
    else:
        y, m, d = map(int, str(start).split('-'))
        d0 = D(y, m, d)
    iso = d0.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}'


def fmt_date(d):
    return d.isoformat() if hasattr(d, 'isoformat') else str(d)


def main():
    ap = argparse.ArgumentParser(description='「결」 — 앱용 JSON 내보내기')
    ap.add_argument('--name', default=None)
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--who', default='')
    ap.add_argument('--yes', action='store_true')
    ap.add_argument('--exclude', action='append', default=[], metavar='시작:끝')
    ap.add_argument('--limit', type=int, default=40,
                     help='앱에 넣을 최대 주 수 (기본 40 — 너무 많으면 지도가 복잡해짐)')
    args = ap.parse_args()

    user_ranges = []
    for r in args.exclude:
        a, b = r.split(':')
        user_ranges.append((a.strip(), b.strip()))

    os.makedirs(args.out, exist_ok=True)

    found = detect.scan(args.data)
    if not found or set(found) == {'_unknown'}:
        print(f'data/ 폴더에 알아볼 파일이 없습니다: {args.data}')
        return 1

    weekly, info, health_rows = G.load_all(found, args.name, interactive=not args.yes)
    merged = G.merge_weekly(weekly)
    if not merged:
        print('주 단위로 묶을 데이터가 없습니다.')
        return 1

    present = sorted({f for row in merged.values() for f in row})
    feats = [(f, d) for f, d in FEATURE_DIRECTION if f in present]

    p = RB.compute_rolling_percentiles(merged, feats, window=52)
    cands = apply_evidence_floor(RB.find_candidates_rolling(p, merged))

    excluded = crisis_filter.excluded_weeks(p, merged, user_ranges=user_ranges)
    retrievable, withheld = crisis_filter.split(cands, excluded)

    print(f'▸ {len(merged)}주 중 되돌려줄 것 {len(retrievable)}건 (제외 {len(withheld)}건)')

    by_week_health, avgs = build_health_index(health_rows)

    # deviation 큰 순 — 가장 또렷한 주부터 앱에 우선 배치
    retrievable_sorted = sorted(retrievable, key=lambda c: -c.get('deviation', 0))[:args.limit]

    weeks_out = []
    for c in retrievable_sorted:
        wk = week_key_from_range(c['date_range'])
        core_svg = None
        mineral = shape = None
        if wk in by_week_health and by_week_health[wk]['days'] and avgs:
            pr = core_params(wk, by_week_health[wk], avgs)
            if pr:
                core_svg = draw_core(pr, w=150, h=190)
                mineral = MINERALS[pr['mineral']]['name']
                shape = pr['shape']

        badges = [
            {'label': FEATURE_LABEL.get(f, f), 'pct': pct_label(pv)}
            for f, pv in evidence(c)[:4]
        ]

        weeks_out.append({
            'week': wk,
            'date_start': fmt_date(c['date_range'][0]),
            'date_end': fmt_date(c['date_range'][1]),
            'tier': c['tier'],
            'sentence': build_sentence(c),
            'cross_validated': not c.get('single_source', False) and not c.get('thin', False),
            'badges': badges,
            'mineral': mineral,
            'shape': shape,
            'core_svg': core_svg,
            'relic': None,   # 실제 원본(사진/메모/카톡) 서으면 복붙해지만 글뙴 습니다
        })

    out_path = os.path.join(args.out, 'gyeol_data.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'generated_weeks': len(weeks_out), 'weeks': weeks_out}, f,
                   ensure_ascii=False, indent=2)

    print(f'✅ 저장 완료: {out_path}  ({len(weeks_out)}주)')
    print('   relic 필는 비어 있으다는 — 실제로 보여줄 사랄이/메모가 있는 주만')
    print('   직접 챇웫넣 줍였으요 (지금까지 해온 방식 그대로).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
