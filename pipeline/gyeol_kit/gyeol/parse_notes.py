# -*- coding: utf-8 -*-
"""
메모 기록 파서 — 맥 메모(Apple Notes) 등에서 뽑은 CSV.

받는 형식 (열 이름으로 알아봅니다):
    created_at,modified_at,char_count[,locked]
    2024-09-02 02:47,2024-09-02 03:10,412,0

왜 별도 계열인가:
  메모는 카톡과 같은 '글'이지만 **다른 출처**입니다.
  카톡 지표 5개가 함께 튀는 건 증거 1개지만,
  카톡과 메모가 각각 튀면 그건 증거 2개입니다. 그게 이 채널을 넣는 이유입니다.

읽지 않는 것:
  제목도 본문도 읽지 않습니다. 언제 썼는지와 얼마나 길게 썼는지만 셉니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
from collections import defaultdict
from datetime import datetime

_FORMATS = ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%dT%H:%M:%S')


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


def load_notes_csv(path: str) -> list[dict]:
    """반환: [{'dt': datetime, 'chars': int|None}, ...] — 작성 시각 기준"""
    return dedupe(_read_one(path))


def _read_one(path: str) -> list[dict]:
    out = []
    with open(path, encoding='utf-8-sig', errors='ignore', newline='') as f:
        for r in csv.DictReader(f):
            key = next((k for k in r if k and k.strip().lower() in
                        ('created_at', 'created', 'creation_date', 'date')), None)
            if not key:
                continue
            dt = _dt(r.get(key))
            if dt is None:
                continue
            chars = None
            ck = next((k for k in r if k and k.strip().lower() in
                       ('char_count', 'chars', 'length')), None)
            if ck:
                try:
                    v = int(float(r.get(ck) or -1))
                    chars = v if v >= 0 else None      # -1 = 못 가져온 것
                except ValueError:
                    pass
            out.append({'dt': dt, 'chars': chars})
    out.sort(key=lambda x: x['dt'])
    return out


def dedupe(rows: list[dict]) -> list[dict]:
    """
    같은 메모를 두 번 세지 않습니다.

    실제로 겪은 일: my_notes.csv(v1)와 my_notes2.csv(v2)를 둘 다 넣었더니
    3,097개 메모가 6,218개로 세어졌습니다. 두 번 내보낸 같은 메모였습니다.
    작성 시각이 같으면 같은 메모로 봅니다. 글자 수가 있는 쪽을 남깁니다.
    """
    best: dict = {}
    for r in rows:
        k = r['dt']
        old = best.get(k)
        if old is None or (old['chars'] is None and r['chars'] is not None):
            best[k] = r
    return sorted(best.values(), key=lambda x: x['dt'])


def weekly_notes(rows: list[dict], min_per_week: int = 3) -> dict:
    """
    주 단위 지표.
      notes_count       그 주에 쓴 메모 수
      notes_night_ratio 0~4시에 쓴 비율   → 표본이 적으면 비율이 무의미하므로 하한을 둠
      notes_avg_length  평균 글자 수 (못 가져왔으면 없음)
    """
    W = defaultdict(lambda: {'n': 0, 'night': 0, 'lens': []})
    for r in rows:
        d = r['dt']
        iso = d.isocalendar()
        w = W[f'{iso[0]}-W{iso[1]:02d}']
        w['n'] += 1
        if 0 <= d.hour <= 4:
            w['night'] += 1
        if r['chars'] is not None:
            w['lens'].append(r['chars'])

    out = {}
    for k, w in W.items():
        row = {'notes_count': w['n']}
        if w['n'] >= min_per_week:
            row['notes_night_ratio'] = w['night'] / w['n']
        if w['lens']:
            row['notes_avg_length'] = sum(w['lens']) / len(w['lens'])
        out[k] = row
    return out


def looks_like_notes_csv(head: str) -> bool:
    first = head.split('\n', 1)[0].lower()
    return ('created_at' in first and
            ('char_count' in first or 'modified_at' in first))
