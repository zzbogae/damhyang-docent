# -*- coding: utf-8 -*-
"""4축·화면 문구 정본 — `260912_MineD_화면문구_규칙_v4` 확정 사항.

`docs/team_spec_sync_260913.md` §2 에서 확정된 숫자·규칙만 그대로 상수로 옮긴 파일이다.
문구가 확정된 대로 "같은 상황에는 같은 문장"이 되도록(§2-3), 이 파일이 **화면 노출 문구의
단 하나뿐인 정본**이다. `judge.py`, `analyzer_v3.py`, `rolling_baseline.py`, `report.py` 등
다른 gyeol_kit 모듈은 문구를 직접 짜지 말고 전부 여기서 가져다 써야 한다. 같은 문장이 두 벌
있어도 하나를 숨기지 않는다 — 문장을 하나로 통일하는 것이 답이지, 숨기는 건 원칙 6
(원본을 가공하지 않는다) 위반이다(v3의 "숨기자" 결정은 v4에서 철회됨).

τ(문턱값)·형석 조건·스펙D 시간창 같은 **수치** 확정값은 이 파일이 아니라(이 파일은 문구만
다룸) `docs/team_spec_sync_260913.md` §1 에 있다 — `analyzer_v3.py`(아직 팀에서 못 받음,
`MISSING_DEPENDENCIES.md` 참고)가 들어올 때 그 문서를 기준으로 옮겨야 한다.

이 파일 자체는 아직 어디에서도 import 되지 않는다(§2-3에 "만들 것"으로만 지정돼 있었음).
"""
from __future__ import annotations

# ── 축 ──────────────────────────────────────────────────────
# 확정 2026-09-11 (team_spec_sync §2-5). 코드명은 그대로, 화면 표기만 바뀌었다.

AXES = ["move", "rest", "watch", "leave"]

AXIS_LABEL = {                 # 내부 라벨 (코드·로그·발표 대본에서 사용)
    "move": "움직임",
    "rest": "쉼",
    "watch": "보기",
    "leave": "남기기",
}

AXIS_SCREEN_LABEL = {          # 화면 표기 (사용자에게 보이는 이름)
    "move": "걸음",
    "rest": "쉼",
    "watch": "화면",
    "leave": "기록",
}

# ── 확인 등급 (스펙 D 확정, team_spec_sync §1-3) ─────────────
# sustain=4주, 복귀 인정 창=4주, 대기 하한 없음.
# 구 명칭 → 신 명칭: recovered→held / passed→returned / observed→open / (자리 없음)→insufficient
# 내부 변수명을 구 명칭에서 신 명칭으로 바꾸는 것은 아직 팀 승인 보류 중(§1-6) —
# 코드에서 실제로 tier 값을 이 상수로 바꿔 쓸 때는 그 승인 여부를 먼저 확인할 것.

TIERS = ["held", "returned", "open", "insufficient"]

GRADE_TEXT = {                 # 화면 문장 (확정, team_spec_sync §2-4)
    "held": "그 뒤 4주는 평소 범위였습니다",
    "returned": "돌아왔지만 그 뒤는 확인되지 않았습니다",
    "open": "이 주 뒤는 아직 확인되지 않았습니다",
    "insufficient": "기록이 비어 말할 수 없습니다",
}

GRADE_NOUN = {                 # 명사구 (목록·요약에서 쓰는 짧은 표현)
    "held": "그 뒤 4주가 평소 범위였던 주",
    "returned": "평소 범위로 돌아왔지만 그 뒤는 확인 안 된 주",
    "open": None,
    "insufficient": None,
}

GRADE_PRINCIPLE_TEXT = "확인되지 않은 것을 확인되었다고 말하지 않습니다. 네 단계로 구분합니다."

# ── 결측·근거 문구 ────────────────────────────────────────────

MISSING_TEXT = "그 주에 평소 있던 기록 중 {n}종이 비어 있습니다"
# n: 실측값. 기준: 직전 52주 중 절반 이상 나타난 계열인데 이 주엔 없는 경우.

SINGLE_SOURCE_WARN_TEXT = (
    "이 주들은 한 지표에만 기대고 있어서, 그 뒤가 어땠는지는 말하지 않았습니다."
)
SINGLE_SOURCE_REASON_TEXT = (
    "이 시기엔 {only} 기록만 남아 있습니다 — 한 지표만으로는 그 뒤가 어땠는지 말하지 않습니다"
)

COUNT_PHRASE_TEXT = "살펴본 {n}주 중 {m}주"   # 구 "전체 판정 N건"의 대체(판정 제거·건→주·전체→살펴본)

# ── 세계관 문장 (예외) ────────────────────────────────────────
# 서비스 모토. §2-2 금지어("지나갔습니다") 목록의 유일한 예외 — 판정/화면 문구가 아니라
# 세계관 문장이라서다. 2026-09-13 시점까지 앱 어디에도 배치되지 않았다.

WORLDVIEW_MOTTO_TEXT = "당신은 이미 한 번 여기를 지나갔습니다"

# ── 금지어 (화면 노출 문구 기준, team_spec_sync §2-2) ─────────
# 내부 문서·코드 변수명·발표 대본에는 적용되지 않는다(주석에 예외 표시).

BANNED_ON_SCREEN = {
    "지나갔습니다/지나갔고/지나감": "전면 금지 (세계관 모토 WORLDVIEW_MOTTO_TEXT 만 예외)",
    "판정": "금지 — 원칙: 판정·해석·진단하지 않는다",
    "회복": "화면 문구에서만 금지. 발표 대본·내부 문서에서는 허용",
    "더 나아질 겁니다/괜찮아질 겁니다": "예측 — 금지",
    "○○일 남았습니다": "스트릭 — 금지",
    "진단명·임상 용어": "금지",
}

__all__ = [
    "AXES", "AXIS_LABEL", "AXIS_SCREEN_LABEL",
    "TIERS", "GRADE_TEXT", "GRADE_NOUN", "GRADE_PRINCIPLE_TEXT",
    "MISSING_TEXT", "SINGLE_SOURCE_WARN_TEXT", "SINGLE_SOURCE_REASON_TEXT",
    "COUNT_PHRASE_TEXT", "WORLDVIEW_MOTTO_TEXT", "BANNED_ON_SCREEN",
]
