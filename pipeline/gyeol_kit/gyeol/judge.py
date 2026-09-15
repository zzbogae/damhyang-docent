# -*- coding: utf-8 -*-
"""
판정 후처리 — v4(이동 기준선) 위에 두 가지를 더 얹습니다.

v4 문서에 '남은 문제'로 적어둔 것 중 두 개를 여기서 처리합니다.

 ① 지표가 1개뿐인 주는 그 지표에 판정이 좌우된다
    → 근거 지표가 1개뿐이면 회복/미회복을 말하지 않고 '관찰만'으로 낮추고,
      문장에 "이 시기엔 ○○ 기록만 남아 있습니다"를 붙여 한계를 드러냅니다.

 ② 문장이 단조로워진다 (대부분 "걸음수가 평소보다 적었습니다")
    → 새 채널(유튜브·캘린더·AI)의 지표에도 문장을 붙입니다.

원칙은 그대로입니다: 회복을 확신할 수 없으면 회복이라고 말하지 않는다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
from .channels import FEATURE_LABEL, FEATURE_SOURCE, FEATURE_FAMILY, FAMILY_LABEL

MIN_EVIDENCE = 2        # 회복/미회복을 말하려면 근거 지표가 최소 이만큼


SENTENCE = {
    'avg_steps':           '걸음수가 평소보다 적었습니다',
    'avg_sleep':           '수면 시간이 평소와 달랐습니다',
    'yt_night_ratio':      '새벽에 화면을 본 비중이 평소보다 높았습니다',
    'yt_search':           '무언가를 찾아본 횟수가 평소보다 많았습니다',
    'yt_total':            '영상을 본 양이 평소보다 많았습니다',
    'cal_events':          '잡혀 있던 일정이 평소보다 적었습니다',
    'night_ratio':         '새벽 시간대에 남긴 말이 평소보다 많았습니다',
    'first_person_ratio':  "'나'로 시작하는 말이 평소보다 많았습니다",
    'absolute_ratio':      "'항상', '전혀' 같은 단정적인 표현이 평소보다 많았습니다",
    'avg_reply_delay_min': '답장까지 걸린 시간이 평소보다 길었습니다',
    'avg_length':          '평소보다 짧게 말했습니다',
    'ai_night_ratio':      '새벽에 AI와 나눈 대화가 평소보다 많았습니다',
    'ai_count':            'AI와 나눈 대화가 평소보다 많았습니다',
    'notes_count':         '메모를 평소보다 많이 남겼습니다',
    'notes_night_ratio':   '새벽에 적어둔 메모가 평소보다 많았습니다',
    'notes_avg_length':    '메모가 평소보다 짧았습니다',
    'photo_count':         '사진을 평소보다 적게 남겼습니다',
    'photo_night_ratio':   '새벽에 찍은 사진이 평소보다 많았습니다',
    'capture_ratio':       '화면을 저장해둔 비중이 평소보다 높았습니다',
}


def pct_label(p: float) -> str:
    rest = 100 - p
    if rest < 1:
        return '직전 1년 중 가장 두드러진 주'
    return f'상위 {rest:.0f}%'


def evidence(cand) -> list[tuple[str, float]]:
    """근거로 쓸 수 있는 지표 — 상위 20% 안에 든 것만, 강한 순."""
    rows = [(f, p) for f, p in cand['p_row'].items() if p is not None]
    rows.sort(key=lambda x: -x[1])
    return [(f, p) for f, p in rows if p >= 80]


def available(cand) -> list[str]:
    """이 주에 실제로 값이 있었던 지표 (판정에 쓸 수 있었던 것)."""
    return [f for f, p in cand['p_row'].items() if p is not None]


def families(feats) -> list[str]:
    """지표들이 몇 '종류의 기록'에서 왔는지. 카톡 지표 5개는 카톡 하나로 셉니다."""
    seen = []
    for f in feats:
        fam = FEATURE_FAMILY.get(f)
        if fam and fam not in seen:
            seen.append(fam)
    return seen


def apply_evidence_floor(cands: list[dict]) -> list[dict]:
    """
    근거가 부족한 주는 회복/미회복을 말하지 않는다. 두 단계로 봅니다.

      · 지표가 1개뿐        → '관찰만'으로 낮춤 (thin)
      · 지표는 여럿인데
        출처가 한 종류뿐    → 판정은 하되 '교차검증 안 됨'을 명시 (single_source)

    카톡 지표 5개가 동시에 튀는 것은 증거 5개가 아니라 증거 1개입니다.
    보경 데이터에서 카톡과 헬스가 독립적으로 같은 주를 지목했을 때 비로소
    교차검증이 됐다고 말할 수 있었습니다.
    """
    out = []
    for c in cands:
        avail = available(c)
        fams = families(avail)
        ev_fams = families([f for f, _ in evidence(c)])
        c = {**c, 'n_available': len(avail), 'available': avail,
             'families': fams, 'evidence_families': ev_fams}

        if len(avail) < MIN_EVIDENCE and c['tier'] != 'observed':
            only = FEATURE_LABEL.get(avail[0], avail[0]) if avail else '한 가지'
            c = {**c, 'tier': 'observed', 'recovered_at': None,
                 'reason': f'이 시기엔 {only} 기록만 남아 있습니다 — 한 지표만으로는 회복을 말하지 않습니다',
                 'thin': True, 'single_source': True}
        else:
            c = {**c, 'thin': False, 'single_source': len(ev_fams) <= 1}
        out.append(c)
    return out


def build_sentence(cand, with_percentile=True, max_facts=2) -> str:
    start, _ = cand['date_range']
    period = f'{start.year}년 {start.month}월 {start.day}일부터 한 주간'

    facts = []
    for f, p in evidence(cand):
        if len(facts) >= max_facts:
            break
        s = SENTENCE.get(f)
        if not s:
            continue
        if with_percentile:
            s += f' ({pct_label(p)})'
        facts.append(s)

    if not facts:
        return f'{period}, 평소와 다른 흐름이 있었습니다.'

    body = f'{period}, ' + ' 그리고 '.join(facts) + '.'

    if cand.get('thin'):
        body += f" 다만 {cand['reason']}."
        return body

    if cand.get('single_source'):
        fam = cand.get('evidence_families') or cand.get('families') or []
        name = FAMILY_LABEL.get(fam[0], '한 종류의 기록') if fam else '한 종류의 기록'
        body += (f' 다만 이건 {name} 한 종류만 보고 말한 것이라, '
                 f'다른 기록이 더해지면 달라질 수 있습니다.')
        return body

    if cand['tier'] == 'recovered' and cand.get('recovered_at'):
        from .analyzer_v3 import week_date_range
        rs, _ = week_date_range(cand['recovered_at'])
        gap = (rs - start).days // 7
        body += f' 그리고 약 {gap}주 뒤부터 평소의 흐름이 이어졌습니다.'
    elif cand['tier'] == 'passed':
        body += ' 그 뒤로 평소의 흐름이 충분히 오래 이어졌는지는 확인되지 않았습니다.'

    return body


def feature_channel(f: str) -> str:
    return (FEATURE_SOURCE.get(f) or ['?'])[0]
