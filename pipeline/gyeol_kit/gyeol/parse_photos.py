# -*- coding: utf-8 -*-
"""
사진 촬영 기록 파서 — 사진 폴더에서 뽑은 CSV.

받는 형식:
    taken_at,kind
    2024-09-02 02:47,photo        (photo | screenshot | video)

읽지 않는 것:
  사진 자체를 열지 않습니다. 파일도 복사하지 않습니다.
  언제 몇 장을 찍었는지, 그리고 그게 사진인지 캡처인지만 셉니다.

왜 촬영 '수'가 'low' 방향인가:
  많이 찍은 주가 아니라 **평소보다 적게 찍은 주**가 이상치 쪽입니다.
  밖에 안 나가고 남길 것이 없었던 주요. 걸음수와 같은 방향입니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
from collections import defaultdict
from datetime import datetime

_FORMATS = ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S')

# EXIF가 깨진 파일은 '0' 시각으로 나옵니다. 실제 촬영일이 아니므로 버립니다.
#   1970-01-01  유닉스 에폭
#   2001-01-01  애플 Core Data 기준일
MIN_YEAR = 2000
SENTINELS = {(1970, 1, 1), (2001, 1, 1)}


def _dt(s):
    s = (s or '').strip()
    if not s:
        return None
    for f in _FORMATS:
        try:
            return datetime.strptime(s[:19], f)
        except ValueError:
            continue
    return None


def load_photos_csv(path: str) -> list[dict]:
    out = []
    with open(path, encoding='utf-8-sig', errors='ignore', newline='') as f:
        for r in csv.DictReader(f):
            key = next((k for k in r if k and k.strip().lower() in
                        ('taken_at', 'taken', 'datetime', 'date')), None)
            if not key:
                continue
            dt = _dt(r.get(key))
            if dt is None or dt.year < MIN_YEAR \
                    or (dt.year, dt.month, dt.day) in SENTINELS:
                continue
            kk = next((k for k in r if k and k.strip().lower() == 'kind'), None)
            kind = (r.get(kk) or 'photo').strip().lower() if kk else 'photo'
            if kind not in ('photo', 'screenshot', 'video'):
                kind = 'photo'
            out.append({'dt': dt, 'kind': kind})
    # 같은 시각·같은 종류는 한 번만 (같은 폴더를 두 번 내보낸 경우)
    seen, uniq = set(), []
    for r in sorted(out, key=lambda x: x['dt']):
        k = (r['dt'], r['kind'])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    return uniq


def weekly_photos(rows: list[dict], min_per_week: int = 3) -> dict:
    """
      photo_count        그 주에 남긴 것 (사진+영상)
      photo_night_ratio  0~4시 촬영 비율
      capture_ratio      캡처 비율 — 밖을 찍는 대신 화면을 저장한 주
    """
    W = defaultdict(lambda: {'n': 0, 'night': 0, 'cap': 0})
    for r in rows:
        d = r['dt']
        iso = d.isocalendar()
        w = W[f'{iso[0]}-W{iso[1]:02d}']
        w['n'] += 1
        if 0 <= d.hour <= 4:
            w['night'] += 1
        if r['kind'] == 'screenshot':
            w['cap'] += 1

    out = {}
    for k, w in W.items():
        row = {'photo_count': w['n']}
        if w['n'] >= min_per_week:
            row['photo_night_ratio'] = w['night'] / w['n']
            if w['cap']:
                row['capture_ratio'] = w['cap'] / w['n']
        out[k] = row
    return out
