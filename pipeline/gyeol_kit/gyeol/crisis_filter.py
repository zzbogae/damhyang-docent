# -*- coding: utf-8 -*-
"""
인출 필터 — 되돌려주지 않을 주를 골라낸다.

────────────────────────────────────────────────────────────
왜 '감지'가 아니라 '제외'인가
────────────────────────────────────────────────────────────

처음 설계는 "위기 신호를 감지해서 도움을 연결한다"였다. 조사해보니
**감지해서 알리는 것 자체가 해악의 경로**였다.

  · Facebook 자살위험 예측: 정신질환 이력이 없는 사람이 알고리즘 플래그만으로
    경찰에 의해 입원병동으로 이송된 사례 (J. Law and the Biosciences, 2021)
  · Facebook Year in Review 2014: 그해 딸을 잃은 사람에게 딸 사진을
    "It's been a great year!"와 함께 노출. 끄는 방법도 없었음
  · Google Photos Memories: 이혼 후에도 결혼식 사진이 반복 노출
    — "내 폰은 우리 엄마가 죽은 걸 모른다"

**마지막 둘은 우리와 정확히 같은 기능이다.** 우리는 과거의 한 주를
되돌려주는 앱이다. 그래서 저 실패를 사고 난 뒤에 고치는 게 아니라
처음부터 넣는다.

그래서 뒤집었다:

  ❌ 위기를 감지해서 사용자에게 알린다
  ✅ 위기일 수 있는 주를 **조용히 되돌려주지 않는다**

────────────────────────────────────────────────────────────
비대칭 원칙 — 필터는 공격적으로, 발화는 하지 않는다
────────────────────────────────────────────────────────────

이 필터가 헛짚으면(오탐) 일어나는 일: **그 주를 안 보여준다.** 거의 무해하다.
이 필터가 놓치면(미탐) 일어나는 일: **가장 힘들었던 주를 불쑥 들이민다.** 해롭다.

비용이 이만큼 비대칭이므로 **의심스러우면 무조건 제외**한다.
정확도를 목표로 하지 않는다. 안전 마진을 목표로 한다.

────────────────────────────────────────────────────────────
하지 않는 것
────────────────────────────────────────────────────────────

  · 왜 제외했는지 사용자에게 설명하지 않는다
    — "이 주는 위험해 보여서 뺐습니다"는 그 자체로 판정이다
  · 위기 점수·플래그를 저장하지 않는다
    — 저장하는 순간 개인정보보호법상 건강 민감정보가 된다.
      계산하고 그 자리에서 버린다
  · 제3자(가족·기관)에게 알리지 않는다
    — 응급입원은 의사와 경찰관의 동의를 요구하는 절차다. 앱이 개시할 수 없다.
      통보 가능성이 있다는 사실만으로 사용자는 아무것도 안 남기게 된다
  · 텍스트 내용을 읽지 않는다
    — 이 필터는 지표의 모양만 본다. 무슨 말을 했는지는 보지 않는다
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
from datetime import date

from .analyzer_v3 import week_to_index, week_date_range

# ── 임계값 ──────────────────────────────────────────────────
# 전부 '넉넉하게 제외되는' 쪽으로 잡혀 있다. 조이지 말 것.

# 처음엔 "지표 하나라도 백분위 99 이상이면 제외"로 잡았다가 되돌렸다.
# 실측: 지표가 12종이면 그중 하나가 직전 1년 최고치인 주가 **20%**나 된다.
# 그건 위기가 아니어 노이즈다. 47%의 주가 제외되어 되돌려줄 것이 남지 않았다.
# → 지표 하나가 아니라 **그 주 전체의 이탈 정도**를 본다.

DEVIATION_TOP_PCT = 5.0   # 이탈 상위 이 % 안에 드는 주 (= 가장 두드러졌던 주)
P_EXTREME_MULTI = 97.0    # 이 위인 지표가 2개 이상이면 제외
SPREAD_WEEKS = 2          # 제외된 주의 앞뒤로 함께 제외할 범위
GAP_MIN_WEEKS = 2         # 기록이 이만큼 끊기면 공백으로 본다
GAP_SPREAD_WEEKS = 4      # 공백 앞뒤로 함께 제외할 범위
RECENT_WEEKS = 8          # 최근 이 기간은 회고 대상에서 제외

# 내부용 사유 코드. 화면에 절대 노출하지 않는다.
REASONS = {
    'extreme':  '단일 지표 극단',
    'compound': '복합 극단',
    'adjacent': '제외 구간 인접',
    'gap':      '기록 공백 주변',
    'recent':   '최근 구간',
    'user':     '사용자 지정',
}


def _parse_range(r):
    """('2024-09-01', '2024-10-31') 또는 (date, date) → (date, date)"""
    a, b = r
    if isinstance(a, str):
        a = date.fromisoformat(a)
    if isinstance(b, str):
        b = date.fromisoformat(b)
    return (a, b) if a <= b else (b, a)


def excluded_weeks(p_weekly: dict, merged: dict, *,
                   user_ranges=None,
                   recent_weeks: int = RECENT_WEEKS,
                   today: date | None = None) -> dict:
    """
    되돌려주지 않을 주를 고른다.

    반환: {week_key: reason_code}   ← 사유는 내부 검증용. 화면에 안 나간다.
    """
    today = today or date.today()
    weeks = sorted(merged.keys())
    if not weeks:
        return {}

    out: dict[str, str] = {}
    idx = {w: week_to_index(w) for w in weeks}
    by_idx = {idx[w]: w for w in weeks}

    # ① 사용자가 직접 지정한 구간 — 다른 무엇보다 우선한다
    for r in (user_ranges or []):
        a, b = _parse_range(r)
        for w in weeks:
            s, e = week_date_range(w)
            if not (e < a or s > b):
                out[w] = 'user'

    # ② 최근 구간 — 아직 지나가지 않은 것은 되돌려주지 않는다
    last = max(idx.values())
    for w in weeks:
        if last - idx[w] < recent_weeks:
            out.setdefault(w, 'recent')

    # ③ 가장 두드러졌던 주 — 그 사람의 주들 중 이탈 상위 5%
    devs = {}
    for w in weeks:
        vals = [v for v in (p_weekly.get(w) or {}).values() if v is not None]
        if vals:
            devs[w] = sum(v - 50 for v in vals) / len(vals)

    core = []
    if devs:
        ranked = sorted(devs.values(), reverse=True)
        cut_i = max(int(len(ranked) * DEVIATION_TOP_PCT / 100) - 1, 0)
        cutoff = ranked[cut_i]
        for w, d in devs.items():
            if d >= cutoff:
                out.setdefault(w, 'extreme')
                core.append(w)

    # ③-b 복합 극단 — 서로 다른 지표 2개가 동시에 상위 3% 안
    for w in weeks:
        vals = [v for v in (p_weekly.get(w) or {}).values() if v is not None]
        if sum(1 for v in vals if v >= P_EXTREME_MULTI) >= 2:
            out.setdefault(w, 'compound')
            if w not in core:
                core.append(w)

    # ④ 극단 구간의 앞뒤 — 힘든 시기는 한 주에 시작하고 끝나지 않는다
    for w in core:
        for k in range(idx[w] - SPREAD_WEEKS, idx[w] + SPREAD_WEEKS + 1):
            nb = by_idx.get(k)
            if nb:
                out.setdefault(nb, 'adjacent')

    # ⑤ 기록 공백 — 모든 채널이 동시에 끊긴 구ꄄ과 그 주변
    #    기록이 사라진 이유는 알 수 없다. 알 수 없으면 건드리지 않는다.
    ordered = [idx[w] for w in weeks]
    for a, b in zip(ordered, ordered[1:]):
        if b - a - 1 >= GAP_MIN_WEEKS:
            for k in range(a - GAP_SPREAD_WEEKS, b + GAP_SPREAD_WEEKS + 1):
                nb = by_idx.get(k)
                if nb:
                    out.setdefault(nb, 'gap')

    return out


def split(cands: list[dict], excluded: dict) -> tuple[list, list]:
    """후보를 (되돌려줄 것, 되돌려주지 않을 것)으로 가른다."""
    keep, drop = [], []
    for c in cands:
        if c['week'] in excluded:
            drop.append({**c, '_excluded_by': excluded[c['week']]})
        else:
            keep.append(c)
    return keep, drop


def summary(excluded: dict, total_weeks: int) -> dict:
    """검증용 요약. 제품 화면에는 이 중 어느 것도 표시하지 않는다."""
    by_reason: dict[str, int] = {}
    for r in excluded.values():
        by_reason[r] = by_reason.get(r, 0) + 1
    return {
        'n': len(excluded),
        'total': total_weeks,
        'pct': (len(excluded) / total_weeks * 100) if total_weeks else 0,
        'by_reason': by_reason,
    }
