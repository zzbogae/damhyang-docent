# -*- coding: utf-8 -*-
"""
채널 레지스트리 — 「결」이 읽을 수 있는 데이터 채널의 단일 정의처.

여기 한 곳만 고치면 튜토리얼·감지기·리포트가 모두 따라옵니다.

원칙 (팀 합의):
  · 유튜브 시청 제목·검색어는 탐지에만 쓰고 렐릭으로 되돌려주지 않는다
  · 캘린더는 제목을 보지 않고 개수·시각만 쓴다
  · AI 대화는 카톡보다 한 단계 더 조심한다
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게

# detect: 이상치 탐지 기여도 (0~3)
# relic:  '되돌려주기'(원본 인용) 사용 가능성 (0~3)
CHANNELS = [
    dict(
        key='health_apple', label='애플 건강', group='건강',
        platform='iPhone',
        gives=['avg_steps', 'avg_sleep'],
        detect=3, relic=0,
        typical_span='설치 이후 전체 (수년)',
        how='건강 앱 → 우측 상단 프로필 → 맨 아래 "모든 건강 데이터 보내기"',
        filename='내보내기.zip / export.zip',
        minutes=10,
        note='용량이 큽니다(수백 MB~1.5GB). Wi-Fi·충전 중에 실행하고, 생성이 끝날 때까지 앱을 벗어나지 마세요.',
        verified=True,
    ),
    dict(
        key='health_samsung', label='삼성 헬스', group='건강',
        platform='Android',
        gives=['avg_steps', 'avg_sleep'],
        detect=3, relic=0,
        typical_span='설치 이후 전체',
        how='삼성 헬스 → 더보기(⋮) → 설정 → 개인 데이터 다운로드',
        filename='samsunghealth_*.zip',
        minutes=10,
        note='먼저 설정 → 삼성 계정과 동기화 → "지금 동기화"를 눌러야 최신 데이터가 담깁니다. '
             '이 경로는 아직 실제 파일로 검증하지 못했습니다 — 안 되면 파일을 보경에게 보내주세요.',
        verified=False,
    ),
    dict(
        key='health_csv', label='직접 만든 건강 CSV', group='건강',
        platform='공통',
        gives=['avg_steps', 'avg_sleep'],
        detect=3, relic=0,
        typical_span='직접 넣은 만큼',
        how='date,steps,sleep_hours 세 열짜리 CSV를 직접 작성',
        filename='*health*.csv',
        minutes=5,
        note='위 두 경로가 모두 막혔을 때의 최후 수단. 최소 6개월치가 있어야 의미가 있습니다.',
        verified=True,
    ),
    dict(
        key='youtube', label='유튜브 시청·검색 기록', group='구글',
        platform='공통',
        gives=['yt_night_ratio', 'yt_search', 'yt_total'],
        detect=3, relic=1,
        typical_span='자동삭제 설정에 따라 3개월~12년',
        how='Takeout → YouTube → 형식을 JSON으로 → history만 체크',
        filename='takeout-*.zip',
        minutes=15,
        note='내보내기 전에 "활동 자동 삭제" 설정을 반드시 먼저 확인하세요. '
             '3개월로 잡혀 있으면 3개월치만 나옵니다. 시청 제목·검색어는 렐릭으로 쓰지 않습니다.',
        verified=True,
    ),
    dict(
        key='calendar', label='구글 캘린더', group='구글',
        platform='공통',
        gives=['cal_events'],
        detect=2, relic=0,
        typical_span='계정 사용 기간 전체',
        how='Google 캘린더(웹) → 설정 → 가져오기 및 내보내기 → 내보내기',
        filename='*.ics 또는 takeout zip 안',
        minutes=3,
        note='일정 제목은 읽지 않습니다. 개수와 시각만 씁니다. 오늘 이후의 미래 일정은 자동으로 제외됩니다.',
        verified=True,
    ),
    dict(
        key='kakao', label='카카오톡 대화', group='대화',
        platform='공통',
        gives=['night_ratio', 'first_person_ratio', 'absolute_ratio',
               'avg_reply_delay_min', 'avg_length'],
        detect=2, relic=3,
        typical_span='기기에 남아 있는 만큼 (기기 변경 시 초기화)',
        how='PC: 채팅방 ≡ → 대화 내용 → 대화 내보내기 / 모바일: 채팅방 ≡ → 채팅방 데이터 → 대화 내용 내보내기',
        filename='KakaoTalkChats.txt 등',
        minutes=5,
        note='대화방 1개가 아니라 자주 쓰는 방 2~3개를 넣으면 훨씬 정확합니다. '
             '내 발화만 추출하고 상대방 메시지는 답장 지연 계산에만 쓰고 버립니다.',
        verified=True,
    ),
    dict(
        key='ai_chat', label='Claude / ChatGPT 대화', group='대화',
        platform='공통',
        gives=['ai_night_ratio', 'ai_count'],
        detect=2, relic=0,
        typical_span='계정 사용 기간 전체',
        how='Claude: 설정 → Privacy → Export data (메일로 링크, 24시간 만료) / ChatGPT: 설정 → 데이터 제어 → 데이터 내보내기',
        filename='conversations.json',
        minutes=10,
        note='아무도 안 볼 거라 생각하고 쓴 말입니다. 탐지에만 쓰고 원문은 절대 되돌려주지 않습니다.',
        verified=True,
    ),
    dict(
        key='notes', label='메모 (맥 메모 등)', group='기타',
        platform='공통',
        gives=['notes_count', 'notes_night_ratio', 'notes_avg_length'],
        detect=2, relic=3,
        typical_span='앱을 쓴 기간 전체 (수년~십수년)',
        how='맥: 터미널에서 AppleScript로 작성 시각·글자 수만 뽑아 CSV로',
        filename='my_notes.csv',
        minutes=5,
        note='제목도 본문도 읽지 않습니다. 언제 썼는지와 얼마나 길게 썼는지만 셉니다. '
             '카톡과 다른 출처 계열이라 교차검증에 실제로 기여합니다.',
        verified=True,
    ),
    dict(
        key='photo', label='사진 촬영 기록', group='기타',
        platform='공통',
        gives=['photo_count', 'photo_night_ratio', 'capture_ratio'],
        detect=2, relic=3,
        typical_span='기기에 있는 만큼',
        how='맥: 사진 앱에서 "원본 미편집본"으로 폴더에 내보낸 뒤, mdls로 촬영 시각만 CSV로',
        filename='my_photos.csv',
        minutes=20,
        note='사진을 열지 않습니다. 파일도 복사하지 않습니다. '
             '언제 몇 장 찍었는지와 사진/캡처 구분만 셉니다.',
        verified=True,
    ),
]

BY_KEY = {c['key']: c for c in CHANNELS}

# 지표 → 사람이 읽는 이름 / 어느 채널에서 오는지
FEATURE_LABEL = {
    'avg_steps':            '걸음수',
    'avg_sleep':            '수면 시간',
    'yt_night_ratio':       '유튜브 심야 비율',
    'yt_search':            '유튜브 검색량',
    'yt_total':             '유튜브 시청량',
    'cal_events':           '일정 개수',
    'night_ratio':          '카톡 새벽 발화 비율',
    'first_person_ratio':   "카톡 '나' 발화 비율",
    'absolute_ratio':       '카톡 단정 표현 비율',
    'avg_reply_delay_min':  '카톡 답장 지연',
    'avg_length':           '카톡 발화 길이',
    'ai_night_ratio':       'AI 대화 심야 비율',
    'ai_count':             'AI 대화량',
    'photo_count':          '사진 촬영 수',
    'photo_night_ratio':    '심야 촬영 비율',
    'capture_ratio':        '캡처 비율',
    'notes_count':          '메모 작성 수',
    'notes_night_ratio':    '메모 심야 작성 비율',
    'notes_avg_length':     '메모 길이',
}

FEATURE_SOURCE = {}
for _c in CHANNELS:
    for _f in _c['gives']:
        FEATURE_SOURCE.setdefault(_f, []).append(_c['key'])

# 판정에 쓰는 지표와 방향 ('low' = 낮을수록 이상치)
FEATURE_DIRECTION = [
    ('avg_steps', 'low'),
    ('avg_sleep', 'low'),
    ('yt_night_ratio', 'high'),
    ('yt_search', 'high'),
    ('yt_total', 'high'),
    ('cal_events', 'low'),
    ('night_ratio', 'high'),
    ('first_person_ratio', 'high'),
    ('absolute_ratio', 'high'),
    ('avg_reply_delay_min', 'high'),
    ('avg_length', 'low'),
    ('ai_night_ratio', 'high'),
    ('notes_count', 'high'),
    ('notes_night_ratio', 'high'),
    ('notes_avg_length', 'low'),
    ('photo_count', 'low'),
    ('photo_night_ratio', 'high'),
    ('capture_ratio', 'high'),
]


# 지표가 어느 "출처 계열"에서 오는지.
# 같은 계열의 지표 5개는 서로 독립적인 증거가 아닙니다 (카톡 지표 5개는 전부 카톡 하나).
FEATURE_FAMILY = {
    'avg_steps': 'health', 'avg_sleep': 'health',
    'yt_night_ratio': 'youtube', 'yt_search': 'youtube', 'yt_total': 'youtube',
    'cal_events': 'calendar',
    'night_ratio': 'kakao', 'first_person_ratio': 'kakao',
    'absolute_ratio': 'kakao', 'avg_reply_delay_min': 'kakao',
    'avg_length': 'kakao',
    'ai_night_ratio': 'ai', 'ai_count': 'ai',
    'notes_count': 'notes', 'notes_night_ratio': 'notes',
    'notes_avg_length': 'notes',
    'photo_count': 'photo', 'photo_night_ratio': 'photo',
    'capture_ratio': 'photo',
}

FAMILY_LABEL = {
    'health': '건강 기록', 'youtube': '유튜브 기록', 'calendar': '일정 기록',
    'kakao': '카톡 기록', 'ai': 'AI 대화 기록',
    'notes': '메모 기록', 'photo': '사진 기록',
}
