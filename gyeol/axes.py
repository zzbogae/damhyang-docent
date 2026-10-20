# -*- coding: utf-8 -*-
"""
gyeol/axes.py — 4축 판정의 정본 (확정 기록 v2 · 2026.09.11)

    from gyeol.axes import build_axes, week_record

이 파일 하나가 「무엇을 어떻게 재는가」의 전부입니다.
숫자를 바꾸려면 여기만 고칩니다. 다른 파일은 이걸 가져다 씁니다.

── 확정 근거 ────────────────────────────────────────────────
  실데이터 800주 캘리브레이션 (2026.09.11)
  문서: 04_팀_회의 / 260911_MineD_판정설계_확정기록_v2.md
  멘토 조언: 안대철님 (log1p · 평균절대편차 대체 · 유클리드)

── 하지 않는 것 ─────────────────────────────────────────────
  · 원문을 읽지 않습니다. 개수·시각·길이만 씁니다
  · 없는 값을 지어내지 않습니다. 모르면 None 입니다
  · 해석하지 않습니다. 축과 방향만 내보냅니다
"""
from __future__ import annotations
import math
import statistics
from collections import defaultdict

from .channels import FEATURE_FAMILY


# ═══════════════════════════════════════════════════════════
#  1. 축 정의
# ═══════════════════════════════════════════════════════════
#
# 원칙 둘
#   ① 축에는 「양(量)」 지표만. 비율 지표(심야 비율·1인칭 비율·
#      단정 표현 비율·캡처 비율)는 축 밖입니다.
#      「보기 많음」은 얼마나 봤나이지 언제 봤나가 아닙니다.
#   ② 부호는 「축이 올라가는 방향」. 답장 지연은 길수록 덜 남긴
#      것이므로 −1 입니다.
#
# ─────────────────────────────────────────────────────────
# label  = 이 창이 쓰는 이름. 문서·로그·회의에서 축을 가리킬 때.
# screen = 화면에 뜨는 이름. **창 B 소관입니다.**
#          지금은 label 과 같게 두었습니다. 창 B 가 다른 이름을 정하면
#          여기 screen 만 바꾸면 됩니다 — 판정 로직은 안 건드립니다.
#          (9/11 창 B 회신 대기: 걸음·잠·화면·기록 안이 살아 있습니다)
#          ⚠ rest 에는 밤 무기록 구간 대체 지표가 들어올 예정이라
#            「잠」으로 고정하면 이름이 내용보다 좁아집니다.
# ─────────────────────────────────────────────────────────
AXES = {
    'move':  {'label': '움직임', 'screen': '움직임', 'feats': {'avg_steps': +1}},
    'rest':  {'label': '쉼',     'screen': '쉼',     'feats': {'avg_sleep': +1}},
    'watch': {'label': '보기',   'screen': '보기',   'feats': {'yt_total': +1, 'yt_search': +1}},
    'leave': {'label': '남기기', 'screen': '남기기', 'feats': {
        'notes_count': +1, 'notes_avg_length': +1,
        'photo_count': +1,
        'avg_length': +1, 'avg_reply_delay_min': -1,
        'ai_count': +1,
    }},
}
AXIS_ORDER = ['move', 'rest', 'watch', 'leave']   # 동점일 때의 고정 순서

# 축 밖 — 근거 문장 전용
RATIO_FEATS = {
    'yt_night_ratio', 'notes_night_ratio', 'photo_night_ratio',
    'capture_ratio', 'night_ratio', 'first_person_ratio',
    'absolute_ratio', 'ai_night_ratio',
}

# 축이 아닙니다. 맥락 한 줄로만 — 많다·적다를 붙이지 않습니다
CONTEXT_FEATS = {'cal_events'}


# ═══════════════════════════════════════════════════════════
#  2. 계산 상수 — 실데이터 800주에서 나온 값
# ═══════════════════════════════════════════════════════════

# 건수형·꼬리가 긴 지표는 log1p 먼저.
# 없으면 유튜브 검색량 z가 17~18까지 가서 축 간 스케일이 깨집니다.
LOG1P = {
    'yt_total', 'yt_search', 'notes_count', 'photo_count', 'ai_count',
    'avg_reply_delay_min',
}

WIN_LONG = 52          # z52 — 게이지 · 광물 · 자동 노출
WIN_SHORT = 8          # z8  — 이탈 · 복귀 · 지속
MIN_PERIODS = 12       # 긴 창에서 이만큼 없으면 z를 만들지 않습니다
MIN_PERIODS_SHORT = 4

# τ — |z| 상위 7.5% 지점 (800주 실측).
# 이건 상수입니다. 사용자마다 같은 값을 씁니다 —
# 개인화는 τ가 아니라 z 계산 안에 이미 있습니다
# (z = 그 사람의 직전 52주 중위·MAD 대비).
TAU = {
    'move':  3.03,
    'rest':  2.36,
    'watch': 1.99,
    'leave': 2.16,
}
TAU_PCT = 7.5          # 재캘리브레이션할 때 쓸 백분위

# 방향별 τ — 위로 드문 주와 아래로 드문 주를 따로 잽니다.
# 건수형 지표는 오른쪽 꼬리가 깁니다. 메모를 3개 쓰던 사람이 0개로 가면
# 조금 내려가지만 30개로 가면 크게 올라갑니다. 아래로는 0이라는 바닥이
# 있어서 갈 데가 없습니다. |z| 하나로 자르면 그 문턱을 위쪽이 거의 다
# 먹어서, 아래로 꽤 드문 주가 위쪽에 가려 안 잡힙니다.
#   None 이면 TAU 를 양쪽에 똑같이 씁니다.
#
# 실측 (800주 · 2026.09.11) — 채택 근거
#   공통 τ  : 아래 광물 4주, 안 쓰인 광물 2종 (pyrite · rose 가 0주)
#   방향별 τ: 아래 광물 33주, 안 쓰인 광물 0종, 전체 광물 수는 그대로(129주)
#
#   움직임이 특히 극단적입니다 — 위로 4.91 까지 가야 드문데
#   아래로는 1.60 만 내려가도 드뭅니다. 걸음수엔 바닥이 있으니까요.
#   공통 τ 3.03 을 쓰면 「덜 움직인 주」가 영원히 안 잡힙니다.
#   쉼만 반대입니다 (위 2.21 / 아래 2.99) — 수면은 아래 꼬리가 더 깁니다.
TAU_UP = {
    'move':  4.91,
    'rest':  2.21,
    'watch': 2.48,
    'leave': 2.85,
}
TAU_DOWN = {
    'move':  1.60,
    'rest':  2.99,
    'watch': 1.44,
    'leave': 1.37,
}
STEP = 0.6             # 계단식 복합 조건의 두 번째 문턱 비율

# 판정 스펙 D — 4주 이내 복귀 + 4주 지속
Z_OUT = 2.0            # 이탈 (z8 기준)
Z_BAND = 1.0           # 「내 평소」 밴드
RETURN_WINDOW = 4
HOLD_WEEKS = 4

# 유사도 전용 — dominant_axis·코어 크기에는 자르지 않은 z를 씁니다
SIM_CLIP = 3.0
SIM_EXCLUDE_RECENT = 12   # 최근 N주는 「닮은 주」 후보에서 제외
SIM_NEIGHBOR_GAP = 4      # 1위를 뽑은 뒤 앞뒤 N주 제외
SIM_MIN_AXES = 2          # 공통 축이 이보다 적으면 후보에서 뺍니다.
                          # 축 하나만 겹치면 거리가 쉽게 0에 가까워져서,
                          # 기록이 거의 없던 옛날 주가 1위를 독식합니다.

# 확인 등급의 화면 문장 (창 B 확정 2026.09.11)
#
# 숫자를 박지 않습니다. 판정이 실제로 본 창 수를 넣습니다 —
# 박아두면 스펙이 바뀔 때 화면이 틀린 사실을 말하게 됩니다.
#
# ⚠ 금지어: 「지나갔습니다」 · 「지나갔고」
#    축이 밴드로 돌아온 건 지표에 대한 사실인데, 「지나갔다」는 주어를
#    지표에서 시기로 옮깁니다. 그 한 걸음이 해석입니다.
#
#    예외 — 서비스 모토 「당신은 이미 한 번 여기를 지나갔습니다」는 유지합니다.
#    모토는 특정 주에 붙는 판정이 아니라 사용자 전체에 대한 세계관 문장이고,
#    주어가 처음부터 사람입니다. 이 예외를 지우지 마세요.
GRADE_TEXT = {
    'held':         '그 뒤 {n}주는 평소 범위였습니다',
    'returned':     '돌아왔지만 그 뒤는 확인되지 않았습니다',
    'open':         '이 주 뒤는 아직 확인되지 않았습니다',
    'insufficient': '기록이 비어 판정할 수 없습니다',
}


def grade_text(grade, n=None):
    """확인 등급 → 화면 문장. n 은 판정이 실제로 본 창 수입니다."""
    t = GRADE_TEXT.get(grade)
    if t is None:
        return None
    return t.format(n=(HOLD_WEEKS if n is None else n))


def axis_screen(ax):
    """축 → 화면에 뜨는 이름. 문서·로그에는 AXES[ax]['label'] 을 씁니다."""
    a = AXES.get(ax)
    return None if a is None else a.get('screen', a['label'])


# ═══════════════════════════════════════════════════════════
#  2-b. 결측 맥락 줄 (§7-③ · 창 B 확정 2026.09.11)
# ═══════════════════════════════════════════════════════════
#
# 왜 있는가 — 「그 뒤 4주는 평소 범위였습니다」는 사실이지만,
# 기록이 멈춘 주에서는 「아무 일도 없던 주」로 읽힙니다.
# 실제로는 잴 것이 없었던 주입니다. 그래서 아래 한 줄을 같이 띄웁니다.
#
# 이 줄은 판정하지 않습니다. 셉니다.
#   · 많다·적다를 붙이지 않습니다
#   · 왜 비었는지 말하지 않습니다 (기기 교체와 앱 삭제는 똑같이 보입니다)
#   · 조건부입니다 — 빈 계열이 없으면 아예 안 나옵니다
MISSING_TEXT = '그 주에 평소 있던 기록 중 {n}종이 비어 있습니다'

# 직전 창에서 이 비율 이상 나타난 계열을 「평소 있던 것」으로 봅니다.
# 절반으로 잡은 이유 — 더 낮추면 옛날에 한두 번 쓴 앱이 영원히
# 「평소 있던 것」으로 남아 매주 결측으로 잡힙니다.
USUAL_MIN = 0.5


def usual_families(history_rows, min_ratio=USUAL_MIN):
    """직전 주들의 row 목록 → 「평소 있던」 계열 집합."""
    rows = [r for r in history_rows if r]
    if not rows:
        return set()
    cnt = defaultdict(int)
    for r in rows:
        for fam in evidence_families(r):
            cnt[fam] += 1
    need = len(rows) * min_ratio
    return {fam for fam, c in cnt.items() if c >= need}


def missing_families(row, usual):
    """평소 있던 계열 중 이번 주에 비어 있는 것. 정렬된 목록."""
    if not usual:
        return []
    return sorted(set(usual) - set(evidence_families(row)))


def missing_text(n):
    """결측 계열 수 → 맥락 줄. 0 이면 None (줄 자체가 안 나옵니다)."""
    return None if not n else MISSING_TEXT.format(n=n)


# 결(줄무늬) — 광물과 다른 기준입니다.
#
# 광물은 「얼마나 드문가」(τ)로 정하고, 결은 「얼마나 벗어났나」(z 크기)로
# 정합니다. 둘을 같은 기준으로 묶으면 τ 를 못 넘은 주가 전부 똑같은 결을
# 갖게 됩니다 — 움직임 4.74 인 주와 0.1 인 주가 같은 무늬가 됩니다.
#
# 문턱은 새로 만들지 않고 이미 정의된 밴드를 씁니다 (redesign §2):
#   |z| < 1  내 평소   /   |z| >= 1  벗어남   /   |z| >= 2  많이 벗어남
GRAIN_BAND = 1.0

# 유단희님 단면 패턴 3안에 대응합니다 (방향성재정리 2026.09.07)
GRAIN = {
    'mixed':   'C',   # 여러 색이 섞임 — 2축 이상이 밴드 밖
    'coarse':  'A',   # 결이 굵고 경계가 뚜렷 — 한 축만 밴드 밖
    'regular': 'B',   # 층이 규칙적 — 전부 밴드 안
}

# 광물 배정 (하빈님 gems/ 9종)
GEM = {
    ('move',  'up'): 'amber',     ('move',  'down'): 'pyrite',
    ('rest',  'up'): 'lapis',     ('rest',  'down'): 'moonstone',
    ('watch', 'up'): 'amethyst',  ('watch', 'down'): 'rose',
    ('leave', 'up'): 'obsidian',  ('leave', 'down'): 'garnet',
}
GEM_COMPLEX = 'fluorite'   # 형석 — 교차검증된 주에만


# ═══════════════════════════════════════════════════════════
#  3. robust z
# ═══════════════════════════════════════════════════════════

def robust_z(value, history, min_periods):
    """
    직전 history 대비 robust z.

    MAD 가 0이면 평균절대편차 × 1.2533 으로 대체합니다.
    (Iglewicz–Hoaglin. 멘토 안대철님 조언 2026.09.11)
    둘 다 0이면 계산하지 않습니다 — 억지로 큰 수를 넣지 않습니다.

    반환: (z or None, 사유)
      'ok'      MAD 로 계산
      'meanad'  평균절대편차로 대체
      'few'     이력 부족
      'flat'    변화가 전혀 없어 계산 불가
    """
    hist = [h for h in history if h is not None]
    if len(hist) < min_periods:
        return None, 'few'
    med = statistics.median(hist)
    mad = statistics.median([abs(h - med) for h in hist])
    if mad > 0:
        return (value - med) / (1.4826 * mad), 'ok'
    mean_ad = sum(abs(h - med) for h in hist) / len(hist)
    if mean_ad > 0:
        return (value - med) / (1.2533 * mean_ad), 'meanad'
    return None, 'flat'


def build_feature_z(merged, weeks, window, min_periods):
    """
    지표별 robust z 를 주 단위로 계산.
    merged: {week: {feature: value}}   weeks: 시간순 주차 목록
    반환: ({week: {feat: z}}, {feat: {사유: 횟수}})
    """
    feats = sorted({f for row in merged.values() for f in row})
    zmap, flags = defaultdict(dict), {f: defaultdict(int) for f in feats}
    series = {f: [] for f in feats}

    for w in weeks:
        row = merged.get(w, {})
        for f in feats:
            v = row.get(f)
            if v is None:
                series[f].append(None)
                continue
            if f in LOG1P and v >= 0:
                v = math.log1p(v)
            hist = [x for x in series[f][-window:] if x is not None]
            z, why = robust_z(v, hist, min_periods)
            flags[f][why] += 1
            if z is not None:
                zmap[w][f] = z
            series[f].append(v)
    return zmap, flags


def axis_z(feat_z):
    """
    축 z = 계열별 평균 z 의 평균.

    계열로 한 번 접는 이유는 v5 와 같습니다 —
    카톡 지표 다섯 개가 남기기 축을 혼자 끌고 가면 안 됩니다.
    「지표 5개는 증거 5개가 아니라 1개」.

    반환: {axis: (z or None, 쓴 지표 수, [계열])}
    """
    out = {}
    for ax in AXIS_ORDER:
        by_family, n = defaultdict(list), 0
        for f, sign in AXES[ax]['feats'].items():
            z = feat_z.get(f)
            if z is None:
                continue
            by_family[FEATURE_FAMILY.get(f, f)].append(sign * z)
            n += 1
        if not by_family:
            out[ax] = (None, 0, [])
            continue
        fam_means = [sum(v) / len(v) for v in by_family.values()]
        out[ax] = (sum(fam_means) / len(fam_means), n, sorted(by_family))
    return out


def build_axes(merged, weeks):
    """한 번에: 두 창의 축 z 를 만듭니다. 반환 (A52, A8, flags)"""
    z52, flags = build_feature_z(merged, weeks, WIN_LONG, MIN_PERIODS)
    z8, _ = build_feature_z(merged, weeks, WIN_SHORT, MIN_PERIODS_SHORT)
    A52 = {w: axis_z(z52.get(w, {})) for w in weeks}
    A8 = {w: axis_z(z8.get(w, {})) for w in weeks}
    return A52, A8, flags


# ═══════════════════════════════════════════════════════════
#  4. 광물 — 축 + 방향, 난수 없음
# ═══════════════════════════════════════════════════════════

def _thr(ax, z, tau):
    """그 축·그 방향의 문턱. 방향별 τ 가 있으면 그걸 씁니다."""
    if z >= 0 and TAU_UP:
        return TAU_UP.get(ax)
    if z < 0 and TAU_DOWN:
        return TAU_DOWN.get(ax)
    return tau.get(ax)


def exceeded(a, tau=None):
    """τ 를 넘은 축 목록. [(axis, z), ...]"""
    tau = tau or TAU
    out = []
    for ax in AXIS_ORDER:
        z = a[ax][0]
        if z is None:
            continue
        t = _thr(ax, z, tau)
        if t and abs(z) >= t:
            out.append((ax, z))
    return out


def pick_gem(a, tau=None, step=STEP):
    """
    그 주의 광물을 결정합니다. 같은 데이터면 언제나 같은 광물입니다.

    형석 조건 (계단식)
      최대 축이 τ 초과
      AND 다른 축 하나가 step×τ 초과
      AND 그 축들을 채운 계열이 2종 이상

    계열 조건이 핵심입니다. 움직임과 쉼은 둘 다 애플헬스에서 나올 수
    있어서, 그 둘만 벗어난 주를 형석으로 부르면 「형석이 박힌 자리 =
    교차검증된 주」가 거짓이 됩니다.

    반환: (gem or None, dominant_axis or None, direction or None, [근접 축])
    """
    tau = tau or TAU
    exc = exceeded(a, tau)
    if not exc:
        return None, None, None, []          # 평범한 주 — 광물 없음

    top_ax, top_z = max(exc, key=lambda x: abs(x[1]))
    direction = 'up' if top_z > 0 else 'down'

    near = []
    for ax in AXIS_ORDER:
        if ax == top_ax:
            continue
        z = a[ax][0]
        if z is None:
            continue
        t = _thr(ax, z, tau)
        if t and abs(z) >= step * t:
            near.append(ax)

    fams = set(a[top_ax][2])
    for ax in near:
        fams |= set(a[ax][2])

    if near and len(fams) >= 2:
        return GEM_COMPLEX, top_ax, direction, near
    return GEM[(top_ax, direction)], top_ax, direction, near


# ═══════════════════════════════════════════════════════════
#  5. 주 단위 레코드 — 앱에 내보낼 모양
# ═══════════════════════════════════════════════════════════

def grain(a):
    """
    그 주의 결. 광물이 없어도 결은 있습니다.

    반환: (kind, 패턴, 세기)
      kind    'mixed' | 'coarse' | 'regular'
      패턴    유단희님 A / B / C
      세기    최대 |z| — 무늬 밀도에 쓰라고 같이 줍니다
    """
    zs = [abs(a[ax][0]) for ax in AXIS_ORDER if a[ax][0] is not None]
    if not zs:
        return 'regular', GRAIN['regular'], None      # 읽을 게 없으면 평평하게
    out = sum(1 for z in zs if z >= GRAIN_BAND)
    if out >= 2:
        kind = 'mixed'
    elif out == 1:
        kind = 'coarse'
    else:
        kind = 'regular'
    return kind, GRAIN[kind], round(max(zs), 3)


def evidence_families(row):
    """그 주에 값이 있었던 지표들의 계열 (캘린더 포함)."""
    return sorted({FEATURE_FAMILY[f] for f in row if f in FEATURE_FAMILY})


def week_record(week, row, a52, a8, pct=None, usual=None):
    """
    한 주를 앱이 읽을 모양으로.

    규칙
      · raw 가 없으면 z 도 None. 0 으로 채우지 않습니다
        (「기록 없음」과 「평소였음」은 다릅니다)
      · cross_validated 는 계열 수로 셉니다. 축 수로 세지 않습니다
      · 캘린더는 context 에만. 백분위도 문장도 없습니다
    """
    gem, dom, direction, near = pick_gem(a52)
    grain_kind, grain_pattern, grain_strength = grain(a52)
    fams = evidence_families(row)
    miss = missing_families(row, usual)

    axes = {}
    for ax in AXIS_ORDER:
        z52, _, ax_fams = a52[ax]
        z8 = a8[ax][0]
        first = next(iter(AXES[ax]['feats']))
        axes[ax] = {
            'screen': axis_screen(ax),
            'raw':   row.get(first) if len(AXES[ax]['feats']) == 1 else None,
            'z52':   None if z52 is None else round(z52, 3),
            'z8':    None if z8 is None else round(z8, 3),
            'pct52': (pct or {}).get(ax),
            'families': ax_fams,
        }

    return {
        'week': week,
        'axes': axes,
        'dominant_axis': dom,
        'direction': direction,
        'near_axes': near,
        'n_axes_out': len(exceeded(a52)),
        'evidence_families': fams,
        'cross_validated': len(fams) >= 2,
        'gem': gem,
        'grain': grain_kind,
        'grain_pattern': grain_pattern,
        'grain_strength': grain_strength,
        'missing_families': miss,
        'context': ({'cal_events': row['cal_events']}
                    if 'cal_events' in row else {}),
        # 화면에 그대로 띄우는 줄. 등급 문장 아래에 붙습니다.
        # 비어 있으면 아무것도 안 붙습니다 — 조건부입니다.
        'context_lines': [t for t in [missing_text(len(miss))] if t],
    }


# ═══════════════════════════════════════════════════════════
#  6. 유사도 — 참고 구현
# ═══════════════════════════════════════════════════════════
#
# 실제 계산은 앱(브라우저)에서 합니다. 현재 주는 매주 바뀌는데
# 파이프라인에서 계산하면 매주 터미널을 다시 써야 하기 때문입니다.
# 여기 있는 건 테스트·검증용입니다.
#
# 척도는 유클리드입니다. 코사인은 방향만 봐서
# (0.2, 0.2, -0.2, 0.2) 인 평범한 주와 (3, 3, -3, 3) 인 극단적인 주를
# 같은 주로 봅니다. 우리 데이터의 84%가 평범한 주입니다.

def _vec(a):
    return {ax: (None if a[ax][0] is None
                 else max(-SIM_CLIP, min(SIM_CLIP, a[ax][0])))
            for ax in AXIS_ORDER}


def distance(a, b):
    """
    두 주의 유클리드 거리. 공통으로 값이 있는 축만 씁니다.
    결측을 0 으로 채우면 「기록 없음」이 「평소였음」이 됩니다.
    반환: (거리 or None, 쓴 축 수)
    """
    va, vb = _vec(a), _vec(b)
    used = [ax for ax in AXIS_ORDER if va[ax] is not None and vb[ax] is not None]
    if not used:
        return None, 0
    d = math.sqrt(sum((va[ax] - vb[ax]) ** 2 for ax in used) / len(used))
    return d, len(used)


def similar_weeks(A, weeks, target, k=3, min_axes=SIM_MIN_AXES):
    """
    target 과 닮은 과거 주 k 개.

    최근 12주를 빼는 이유 — 안 빼면 지난주·2주 전이 상위를 독식합니다.
    당연히 가장 가까운 주가 가장 비슷하니까요. 그러면
    「당신은 이미 한 번 여기를 지나갔다」가 성립하지 않습니다.

    1위를 뽑은 뒤 앞뒤 4주를 빼는 이유 — 같은 시기가 3개 나오는 걸 막습니다.

    공통 축이 2개 미만인 주를 빼는 이유 — 축 하나만 겹치면 거리가 쉽게
    0에 가까워집니다. 그러면 기록이 거의 없던 옛날 주가 1위가 되는데,
    그건 닮은 게 아니라 비교할 게 없었던 것입니다.
    """
    i = weeks.index(target)
    pool = weeks[:max(0, i - SIM_EXCLUDE_RECENT)]
    scored = []
    for w in pool:
        d, n = distance(A[target], A[w])
        if d is not None and n >= min_axes:
            scored.append((d, -n, w, n))
    # 거리가 같으면 축이 많은 쪽을 먼저 — 근거가 두꺼운 쪽입니다
    scored.sort()

    out, taken = [], set()
    for d, _negn, w, n in scored:
        j = weeks.index(w)
        if any(abs(j - t) <= SIM_NEIGHBOR_GAP for t in taken):
            continue
        out.append({'week': w, 'distance': round(d, 3),
                    'axes_used': n, 'thin': n <= 2})
        taken.add(j)
        if len(out) >= k:
            break
    return out


# ═══════════════════════════════════════════════════════════
#  7. 재캘리브레이션 — 채널이 바뀌면 τ 를 다시 뽑습니다
# ═══════════════════════════════════════════════════════════

def calibrate_tau_directional(A52, weeks, pct=TAU_PCT):
    """
    위로 드문 주 / 아래로 드문 주의 문턱을 따로 뽑습니다.
    반환: (tau_up, tau_down) — 둘 다 양수입니다.
    """
    up, down = {}, {}
    for ax in AXIS_ORDER:
        pos = sorted(A52[w][ax][0] for w in weeks
                     if A52[w][ax][0] is not None and A52[w][ax][0] >= 0)
        neg = sorted(-A52[w][ax][0] for w in weeks
                     if A52[w][ax][0] is not None and A52[w][ax][0] < 0)
        up[ax] = (pos[min(int(len(pos) * (100 - pct) / 100.0), len(pos) - 1)]
                  if len(pos) >= 20 else None)
        down[ax] = (neg[min(int(len(neg) * (100 - pct) / 100.0), len(neg) - 1)]
                    if len(neg) >= 20 else None)
    return up, down


def calibrate_tau(A52, weeks, pct=TAU_PCT):
    """축별 |z| 상위 pct 지점. 결과를 위 TAU 에 적어 넣습니다."""
    tau = {}
    for ax in AXIS_ORDER:
        vals = sorted(abs(A52[w][ax][0]) for w in weeks
                      if A52[w][ax][0] is not None)
        tau[ax] = (vals[min(int(len(vals) * (100 - pct) / 100.0), len(vals) - 1)]
                   if len(vals) >= 20 else None)
    return tau
