# -*- coding: utf-8 -*-
"""
내 발화(my_msgs)로부터 주(週) 단위 특징을 계산한다.
- 1인칭 비율, 절대어 비율, 새벽 발화 비율, 평균 문장 길이, 평균 답장 지연
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import re
from collections import defaultdict
from datetime import date

FIRST_PERSON = ['나는', '내가', '제가', '나의', '내', '저는', '나도', '내꺼', '나만']
ABSOLUTE_WORDS = ['항상', '언제나', '절대', '전혀', '아무도', '완전', '진짜', '너무',
                   '맨날', '결국', '다시는', '아예']

def _week_key(dt) -> str:
    iso = dt.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def compute_weekly_features(my_msgs: list[dict]) -> dict:
    """주차별로 묶어서 특징 계산. 반환: {week_key: {feature: value}}"""
    weekly = defaultdict(lambda: {
        'count': 0,
        'total_len': 0,
        'night_count': 0,      # 새벽 1~4시 발화 수
        'first_person_count': 0,
        'absolute_count': 0,
        'delay_sum': 0.0,
        'delay_n': 0,
        'kk_lengths': [],      # ㅋ 길이 분포
    })

    for m in my_msgs:
        wk = _week_key(m['dt'])
        w = weekly[wk]
        text = m['text']
        w['count'] += 1
        w['total_len'] += len(text)

        if 1 <= m['dt'].hour <= 4:
            w['night_count'] += 1

        for fp in FIRST_PERSON:
            if fp in text:
                w['first_person_count'] += 1
                break

        for ab in ABSOLUTE_WORDS:
            if ab in text:
                w['absolute_count'] += 1
                break

        if m['reply_delay_sec'] is not None:
            w['delay_sum'] += m['reply_delay_sec']
            w['delay_n'] += 1

        kk = re.findall(r'ㅋ+', text)
        if kk:
            w['kk_lengths'].append(max(len(x) for x in kk))

    result = {}
    for wk, w in weekly.items():
        n = max(w['count'], 1)
        result[wk] = {
            'message_count': w['count'],
            'avg_length': w['total_len'] / n,
            'night_ratio': w['night_count'] / n,
            'first_person_ratio': w['first_person_count'] / n,
            'absolute_ratio': w['absolute_count'] / n,
            'avg_reply_delay_min': (w['delay_sum'] / w['delay_n'] / 60) if w['delay_n'] else None,
            'avg_kk_length': (sum(w['kk_lengths']) / len(w['kk_lengths'])) if w['kk_lengths'] else 0,
        }
    return result
