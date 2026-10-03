# -*- coding: utf-8 -*-
# 건강 zip -> data/my_health_daily.csv (date, steps, sleep_hours 만)
from __future__ import annotations
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)      # 키트 최상단 (data/ · out/ 가 있는 곳)
sys.path.insert(0, HERE)
from gyeol import parse_health as PH
from gyeol import detect

def main():
    dd = os.path.join(ROOT, 'data')
    found = detect.scan(dd)
    targets = []
    for kind in ('health_apple', 'health_samsung'):
        for p in (found.get(kind) or []):
            targets.append((p, kind))
    if not targets:
        for fn in sorted(os.listdir(dd)):
            low = fn.lower()
            if low.endswith('.zip') and ('health' in low or '내보내기' in fn or 'export' in low):
                targets.append((os.path.join(dd, fn), 'health_apple'))
    if not targets:
        print(' data/ 에서 건강 zip을 못 찾았습니다.'); return 1
    merged = {}
    for path, kind in targets:
        mb = os.path.getsize(path) / 1024 / 1024
        print('\n> %s (%.0fMB) %s' % (os.path.basename(path), mb, kind))
        print('  읽는 중... 몇 분 걸립니다. 그냥 두세요.')
        try:
            rows = PH.load_health(path, kind, progress=lambda m: print(m))
        except Exception as e:
            print('  건너뜀: %s' % e); continue
        print('  %d일 읽음' % len(rows))
        for r in rows:
            c = merged.setdefault(r['date'], {'date': r['date'], 'steps': None, 'sleep_hours': None})
            if r.get('steps') is not None:
                c['steps'] = max(c['steps'] or 0, r['steps'])
            if r.get('sleep_hours') is not None:
                c['sleep_hours'] = max(c['sleep_hours'] or 0, r['sleep_hours'])
    if not merged:
        print('\n 읽어낸 날이 없습니다.'); return 1
    rows = [merged[k] for k in sorted(merged)]
    out = os.path.join(dd, 'my_health_daily.csv')
    PH.write_csv(rows, out)
    st = sum(1 for r in rows if r['steps'] is not None)
    sl = sum(1 for r in rows if r['sleep_hours'] is not None)
    print('\n완성: %s (%.0fKB)' % (out, os.path.getsize(out) / 1024))
    print('  %d일 · %s ~ %s' % (len(rows), rows[0]['date'], rows[-1]['date']))
    print('  걸음수 %d일 · 수면 %d일' % (st, sl))
    return 0

sys.exit(main())
