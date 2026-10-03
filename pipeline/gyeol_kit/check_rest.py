#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
check_rest.py — 쉼 축이 왜 15%인지 진단합니다.

의심: 건강 채널이 세 개(애플·삼성·CSV)인데 merge_weekly 가 순서대로
덮어써서, 뒤에 오는 CSV 가 애플헬스를 이깁니다.
애플헬스 수면 1,190일이 CSV 595일로 반토막 날 수 있습니다.

아무것도 고치지 않습니다. 읽고 세기만 합니다.
"""
from __future__ import annotations
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gyeol import detect, parse_health          # noqa: E402
from gyeol.channels import BY_KEY               # noqa: E402

HEALTH_KEYS = ('health_apple', 'health_samsung', 'health_csv')


def week_key(d):
    iso = d.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}'


def main():
    data = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'data')
    print('')
    print('=' * 60)
    print(' 쉼 축 진단 — 건강 채널이 서로 덮어쓰는지')
    print('=' * 60)
    print('')

    found = detect.scan(data)
    per_channel = {}

    for key in HEALTH_KEYS:
        paths = found.get(key) or []
        if not paths:
            continue
        print(f'▸ {BY_KEY[key]["label"]} 읽는 중…')
        rows = []
        for p in paths:
            try:
                rows += parse_health.load_health(p, key)
            except Exception as ex:                       # noqa: BLE001
                print(f'  ! {os.path.basename(p)} — {ex}')
        if not rows:
            continue
        w = parse_health.compute_weekly_health(rows)
        sleep_weeks = {k for k, v in w.items() if v.get('avg_sleep') is not None}
        step_weeks = {k for k, v in w.items() if v.get('avg_steps') is not None}
        per_channel[key] = dict(
            label=BY_KEY[key]['label'],
            n_sleep_days=sum(1 for r in rows if r.get('sleep_hours') is not None),
            n_step_days=sum(1 for r in rows if r.get('steps') is not None),
            sleep_weeks=sleep_weeks, step_weeks=step_weeks,
            files=[os.path.basename(p) for p in paths],
        )
        print(f'  수면 {len(sleep_weeks)}주 · 걸음 {len(step_weeks)}주')

    if not per_channel:
        print('\n건강 채널을 못 찾았습니다.')
        return 1

    print('')
    print('-' * 60)
    print(' 채널별 수면 커버리지')
    print('-' * 60)
    for key in HEALTH_KEYS:
        c = per_channel.get(key)
        if not c:
            continue
        print(f"  {c['label']:<16} 수면 {len(c['sleep_weeks']):>4}주   "
              f"걸음 {len(c['step_weeks']):>4}주   ({', '.join(c['files'])})")

    # merge_weekly 는 채널을 순서대로 돌며 덮어씁니다 — 마지막이 이깁니다
    winner = [k for k in HEALTH_KEYS if k in per_channel][-1]
    union = set()
    for c in per_channel.values():
        union |= c['sleep_weeks']

    now = len(per_channel[winner]['sleep_weeks'])
    best = len(union)

    print('')
    print('-' * 60)
    print(' 지금 실제로 쓰이는 것')
    print('-' * 60)
    print(f"  merge_weekly 는 마지막 채널이 이깁니다 → {per_channel[winner]['label']}")
    print(f"  지금 쉼 축이 쓰는 수면 주 수 : {now}주")
    print(f"  세 채널을 합치면            : {best}주")
    print('')

    if best > now:
        gain = best - now
        print('=' * 60)
        print(f'  [!] 버그입니다. 수면 {gain}주를 버리고 있습니다.')
        print('')
        print('      merge_weekly 가 값이 이미 있어도 덮어씁니다.')
        print('      고칠 곳: 값이 None 이 아니면 덮어쓰지 않도록.')
        print('')
        print('      당장 확인만 하려면 CSV 를 잠시 치우고 다시 돌리세요:')
        print('        mv data/my_health_daily.csv data/_off_my_health_daily.csv')
        print('=' * 60)
    else:
        print('=' * 60)
        print('  [OK] 덮어쓰기로 잃는 수면 주는 없습니다.')
        print('       쉼 축이 얇은 건 데이터 자체의 한계입니다.')
        print('       → 밤 무기록 구간 대체 지표가 필요합니다.')
        print('=' * 60)

    print('')
    print(f'  참고: 전체 분석 주가 800주이므로, 수면 {best}주면 '
          f'커버리지 {100.0*best/800:.0f}% 입니다.')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())
