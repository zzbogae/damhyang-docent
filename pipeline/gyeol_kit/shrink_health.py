#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
건강 zip을 작은 CSV 한 장으로 줄입니다.

    python3 shrink_health.py

왜 필요한가
  애플 건강 내보내기는 828MB입니다. 클라우드에 올릴 수 없습니다.
  그런데 「결」이 실제로 쓰는 건 그 안에서 딱 두 가지 —
  **하루 걸음수**와 **하루 수면 시간**뿐입니다.
  나머지(심박·체중·운동 기록·기기 정보)는 읽지도 않습니다.

  그래서 여기서 미리 짜냅니다. 828MB → 20KB 남짓.

무엇이 나가고 무엇이 안 나갂나
  나감    date, steps, sleep_hours   (하루 한 줄)
  안 나감 그 외 전부. 심박·체중·운동 종목·기기 일련번호·위치 —
          이 스크립트는 애초에 꺼내지 않습니다.

  결과 CSV를 열어보시면 무엇이 나가는지 그대로 보입니다.
  숫자 세 칸이 전부입니다.

돌린 뒤
  data/my_health_daily.csv 를 올려주세요.
  원본 zip은 그대로 두셔도 됩니다 — 같은 폴더에 있어도 CSV가 우선합니다.
"""
from __future__ import annotations
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gyeol import parse_health as PH   # noqa: E402
from gyeol import detect               # noqa: E402

OUT = os.path.join(HERE, 'data', 'my_health_daily.csv')


def main():
    data_dir = os.path.join(HERE, 'data')
    found = detect.scan(data_dir)

    targets = []
    for kind in ('health_apple', 'health_samsung'):
        for p in (found.get(kind) or []):
            targets.append((p, kind))

    if not targets:
        # detect가 못 잡으면 이름으로 한 번 더 찾습니다
        for fn in sorted(os.listdir(data_dir)):
            low = fn.lower()
            if low.endswith('.zip') and ('health' in low or '내보내기' in fn or 'export' in low):
                targets.append((os.path.join(data_dir, fn), 'health_apple'))

    if not targets:
        print(' data/ 안에서 건강 zip을 못 찾았습니다.')
        print(' apple_health_export.zip · 내보내기.zip 을 data/ 에 두고 다시 돌려주세요.')
        return 1

    merged: dict = {}
    for path, kind in targets:
        name = os.path.basename(path)
        size = os.path.getsize(path) / 1024 / 1024
        print(f'\n▸ {name}  ({size:.0f}MB) — {kind}')
        print('  읽는 중… 828MB 기준 2~10분 걸립니다. 그냥 두세요.')
        try:
            rows = PH.load_health(path, kind, progress=lambda m: print(m))
        except Exception as e:                                   # noqa: BLE001
            print(f'  건너뜀: {e}')
            continue
        print(f'  {len(rows):,}일 읽음')
        for r in rows:
            cur = merged.setdefault(r['date'], {'date': r['date'],
                                                'steps': None, 'sleep_hours': None})
            # 두 zip이 겹치면 값이 있는 관을 남깁니다
            if r.get('steps') is not None:
                cur['steps'] = max(cur['steps'] or 0, r['steps'])
            if r.get('sleep_hours') is not None:
                cur['sleep_hours'] = max(cur['sleep_hours'] or 0, r['sleep_hours'])

    if not merged:
        print('\n 읽어낸 날이 없습니다.')
        return 1

    rows = [merged[k] for k in sorted(merged)]
    PH.write_csv(rows, OUT)

    n_st = sum(1 for r in rows if r['steps'] is not None)
    n_sl = sum(1 for r in rows if r['sleep_hours'] is not None)
    kb = os.path.getsize(OUT) / 1024
    print(f'\n완성: {OUT}  ({kb:.0f}KB)')
    print(f'  {len(rows):,}일 · {rows[0]["date"]} ~ {rows[-1]["date"]}')
    print(f'  걸음수 {n_st:,}일 · 수면 {n_sl:,}일')
    print('\n이 파일 하나만 올리시면 됩니다. 열어보시면 무엇이 나가는지 그대로 보입니다.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
