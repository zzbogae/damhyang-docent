"""지표 정의: 일 단위 표(docs/contract.md 1절)에서 주 단위 값을 계산하는 규칙과 문장 조각.

지표마다 계열(family, 같은 파일·같은 측정 과정)과 4축(axis) 중 어디에 속하는지 적는다.
문장 조각의 {r} 자리에는 "직전 52주 중 가장" / "직전 52주 중 네 번째로" 가 들어간다.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

FAMILIES = ["health", "memo", "photo", "yt", "cal", "kakao", "sns", "ai", "quiet", "screen", "git"]
FAMILY_LABEL = {"health": "건강", "memo": "메모", "photo": "사진", "yt": "유튜브", "cal": "캘린더", "kakao": "카카오톡",
                "sns": "인스타그램", "ai": "AI 대화", "quiet": "밤 공백",
                "screen": "스크린타임", "git": "깃헙"}
# 다른 채널의 활동 시각에서 계산한 계열. 독립 근거로 세지 않는다(교차검증 수에 넣지 않음)
DERIVED_FAMILIES = {"quiet"}
# 팀 결정(10/22 화면설계 v6 §8): 지표 넷 = 수면 · 걸음 · 언어 · 소통. 축 키는 move/rest/lang/talk.
# 이전 보기(watch)·남기기(leave)는 없앴다. 남기기는 언어(글로 남긴 것)와 소통(사람과 주고받은 것)으로 나눴고,
# 유튜브·스크린타임·사진·화면 캡처·일정은 어느 지표에도 넣지 않는다(axis=None). 이 기록들은 광석 판정에 쓰지 않고
# 열린 광석의 근거(그때의 사진·수치)로만 보여 준다.
AXES = ["move", "rest", "lang", "talk"]
AXIS_NAMES = {
    "move": {"label": "걸음", "screen": "걸음"},
    "rest": {"label": "수면", "screen": "수면"},
    "lang": {"label": "언어", "screen": "언어"},
    "talk": {"label": "소통", "screen": "소통"},
}
AXIS_LABEL = {ax: v["screen"] for ax, v in AXIS_NAMES.items()}


def axis_screen(ax: str) -> str:
    return AXIS_NAMES[ax]["screen"]


@dataclass(frozen=True)
class Indicator:
    id: str
    label: str
    family: str
    axis: str | None  # None 이면 4지표 밖(근거 전용): 배지·광석·게이지에 쓰지 않는다
    kind: str  # count | level | ratio
    down: str  # 적은 쪽 문장 조각
    up: str  # 많은 쪽 문장 조각
    gauge: bool = False  # 4축 게이지에 들어가는 '양' 지표인지
    compute: Callable[[dict], float | None] | None = None


def _ratio(num: str, den: str, min_den: int):
    def f(w: dict) -> float | None:
        d = w.get(den, 0)
        if d < min_den:
            return None
        return w.get(num, 0) / d

    return f


def _mean_level(field: str, days_field: str, min_days: int = 4):
    def f(w: dict) -> float | None:
        if w.get(days_field, 0) < min_days:
            return None
        return w.get(field, 0) / w[days_field]

    return f


def _sum(field: str):
    return lambda w: float(w.get(field, 0))


INDICATORS: list[Indicator] = [
    Indicator("steps", "걸음수", "health", "move", "level",
              "걸음수가 {r} 적었습니다", "걸음수가 {r} 많았습니다", True,
              _mean_level("steps", "steps_days")),
    Indicator("sleep", "수면 시간", "health", "rest", "level",
              "잠이 {r} 짧았습니다", "잠이 {r} 길었습니다", True,
              _mean_level("sleep_min", "sleep_days")),
    # 팀 9/23 §1-2 밤 무기록 구간 대체 지표: 수면 기록이 없을 때 쉼 축을 채운다. 잠이 아니라 기록이 끊긴 시간이다
    Indicator("quiet", "밤 기록 공백", "quiet", "rest", "level",
              "밤에 기록이 끊긴 시간이 {r} 짧았습니다", "밤에 기록이 끊긴 시간이 {r} 길었습니다", True,
              _mean_level("quiet_min", "quiet_days")),
    # 회의 질문 1: 스크린타임 캡처(기기 안 OCR)에서 읽은 하루 사용 시간(분)
    Indicator("screen_time", "스크린타임", "screen", None, "level",
              "휴대폰 사용 시간이 {r} 짧았습니다", "휴대폰 사용 시간이 {r} 길었습니다", True,
              _mean_level("screen_min", "screen_days")),
    # 회의 질문 4: git log 또는 GitHub 데이터 내보내기의 커밋 수
    Indicator("git_commits", "커밋 수", "git", "lang", "count",
              "커밋을 {r} 적게 남겼습니다", "커밋을 {r} 많이 남겼습니다", False, _sum("git_commits")),
    Indicator("memo_n", "메모 작성 수", "memo", "lang", "count",
              "메모를 {r} 적게 남겼습니다", "메모를 {r} 많이 남겼습니다", True, _sum("memo_n")),
    Indicator("memo_len", "메모 길이", "memo", "lang", "ratio",
              "메모가 {r} 짧았습니다", "메모가 {r} 길었습니다", False,
              _ratio("memo_chars", "memo_n", 2)),
    Indicator("memo_night", "메모 심야 작성 비율", "memo", "lang", "ratio",
              "새벽에 쓴 메모의 비율이 {r} 낮았습니다", "새벽에 쓴 메모의 비율이 {r} 높았습니다", False,
              _ratio("memo_night_n", "memo_n", 3)),
    Indicator("photo_n", "사진 촬영 수", "photo", None, "count",
              "사진을 {r} 적게 찍었습니다", "사진을 {r} 많이 찍었습니다", True, _sum("photo_n")),
    # 9/12 회의 1번: 스크린샷은 내용을 읽지 않고 「그 주에 몇 장, 몇 시에」만 센다(사진 폴더 안 화면 캡처)
    Indicator("shot_n", "화면 캡처 수", "photo", None, "count",
              "화면을 {r} 적게 캡처했습니다", "화면을 {r} 많이 캡처했습니다", False, _sum("shot_n")),
    Indicator("shot_night", "새벽 화면 캡처 비율", "photo", None, "ratio",
              "새벽에 한 화면 캡처의 비율이 {r} 낮았습니다", "새벽에 한 화면 캡처의 비율이 {r} 높았습니다", False,
              _ratio("shot_night_n", "shot_n", 3)),
    Indicator("photo_night", "심야 촬영 비율", "photo", None, "ratio",
              "새벽에 찍은 사진의 비율이 {r} 낮았습니다", "새벽에 찍은 사진의 비율이 {r} 높았습니다", False,
              _ratio("photo_night_n", "photo_n", 5)),
    Indicator("yt_watch", "유튜브 시청 수", "yt", None, "count",
              "유튜브를 {r} 적게 봤습니다", "유튜브를 {r} 많이 봤습니다", True, _sum("yt_watch_n")),
    Indicator("yt_night", "유튜브 심야 비율", "yt", None, "ratio",
              "새벽에 본 영상의 비율이 {r} 낮았습니다", "새벽에 본 영상의 비율이 {r} 높았습니다", False,
              _ratio("yt_watch_night_n", "yt_watch_n", 5)),
    Indicator("yt_search", "유튜브 검색량", "yt", None, "count",
              "유튜브 검색을 {r} 적게 했습니다", "유튜브 검색을 {r} 많이 했습니다", True, _sum("yt_search_n")),
    Indicator("cal_n", "일정 개수", "cal", None, "count",
              "일정이 {r} 적었습니다", "일정이 {r} 많았습니다", True, _sum("cal_n")),
    # 10/22 소통 지표의 양(量) 게이지: 카톡을 몇 번 보냈는지(원문은 읽지 않고 개수만)
    Indicator("kakao_n", "카톡 보낸 수", "kakao", "talk", "count",
              "카톡을 {r} 적게 보냈습니다", "카톡을 {r} 많이 보냈습니다", True, _sum("kakao_n")),
    Indicator("kakao_night", "카톡 새벽 발화 비율", "kakao", "talk", "ratio",
              "새벽에 보낸 카톡의 비율이 {r} 낮았습니다", "새벽에 보낸 카톡의 비율이 {r} 높았습니다", False,
              _ratio("kakao_night_n", "kakao_n", 10)),
    Indicator("kakao_len", "카톡 발화 길이", "kakao", "talk", "ratio",
              "카톡 한 번에 쓴 글이 {r} 짧았습니다", "카톡 한 번에 쓴 글이 {r} 길었습니다", False,
              _ratio("kakao_chars", "kakao_n", 10)),
    Indicator("kakao_delay", "카톡 답장 지연", "kakao", "talk", "ratio",
              "카톡 답장이 {r} 빨랐습니다", "카톡 답장이 {r} 늦었습니다", False,
              _ratio("kakao_reply_min_sum", "kakao_reply_n", 3)),
    Indicator("kakao_first", "카톡 1인칭 비율", "kakao", "talk", "ratio",
              "카톡에서 자기 이야기를 한 비율이 {r} 낮았습니다", "카톡에서 자기 이야기를 한 비율이 {r} 높았습니다", False,
              _ratio("kakao_first_n", "kakao_n", 10)),
    Indicator("kakao_assert", "카톡 단정어 비율", "kakao", "talk", "ratio",
              "카톡에서 단정하는 말의 비율이 {r} 낮았습니다", "카톡에서 단정하는 말의 비율이 {r} 높았습니다", False,
              _ratio("kakao_assert_n", "kakao_n", 10)),
    # 원페이지 02절 "SNS·AI 대화 연동": 인스타그램 내보내기, ChatGPT·Claude 대화 내보내기(원문은 저장하지 않고 개수만)
    Indicator("sns_post", "인스타그램 게시 수", "sns", "lang", "count",
              "인스타그램에 {r} 적게 올렸습니다", "인스타그램에 {r} 많이 올렸습니다", False, _sum("sns_post_n")),
    Indicator("sns_dm", "인스타그램 DM 수", "sns", "talk", "count",
              "인스타그램 DM을 {r} 적게 보냈습니다", "인스타그램 DM을 {r} 많이 보냈습니다", False, _sum("sns_dm_n")),
    Indicator("sns_night", "인스타그램 새벽 DM 비율", "sns", "talk", "ratio",
              "새벽에 보낸 DM의 비율이 {r} 낮았습니다", "새벽에 보낸 DM의 비율이 {r} 높았습니다", False,
              _ratio("sns_dm_night_n", "sns_dm_n", 5)),
    Indicator("ai_msg", "AI 대화 메시지 수", "ai", "lang", "count",
              "AI와 {r} 적게 대화했습니다", "AI와 {r} 많이 대화했습니다", False, _sum("ai_msg_n")),
    Indicator("ai_night", "AI 대화 새벽 비율", "ai", "lang", "ratio",
              "새벽에 AI와 나눈 대화의 비율이 {r} 낮았습니다", "새벽에 AI와 나눈 대화의 비율이 {r} 높았습니다", False,
              _ratio("ai_msg_night_n", "ai_msg_n", 5)),
    Indicator("ai_len", "AI에게 쓴 글 길이", "ai", "lang", "ratio",
              "AI에게 쓴 글이 {r} 짧았습니다", "AI에게 쓴 글이 {r} 길었습니다", False,
              _ratio("ai_chars", "ai_msg_n", 3)),
]

BY_ID = {i.id: i for i in INDICATORS}

# 채널마다 주 단위 '기록 건수'로 쓰는 필드(구조적 결측을 찾을 때 0 연속 길이를 이 값으로 잰다)
CHANNEL_COUNT_FIELDS = {
    "memo": ["memo_n"],
    "photo": ["photo_n"],
    "yt": ["yt_watch_n", "yt_search_n"],
    "cal": ["cal_n"],
    "kakao": ["kakao_n"],
    "sns": ["sns_post_n", "sns_dm_n"],
    "ai": ["ai_msg_n"],
    "git": ["git_commits"],
}
# 개수가 아니라 값이 있는 날 수로 관측 여부를 보는 계열과 그 날 수 필드
DAY_FAMILIES = {"health": ["steps_days", "sleep_days"], "quiet": ["quiet_days"], "screen": ["screen_days"]}
# 건강은 개수가 아니라 수준 값이라, 키가 있는 날 수로 관측 여부를 본다
HEALTH_DAY_FIELDS = {"steps": "steps_days", "sleep_min": "sleep_days", "quiet_min": "quiet_days", "screen_min": "screen_days"}

DAILY_SUM_FIELDS = [
    "steps", "sleep_min", "quiet_min", "screen_min", "git_commits",
    "memo_n", "memo_chars", "memo_night_n",
    "photo_n", "photo_night_n", "shot_n", "shot_night_n",
    "yt_watch_n", "yt_watch_night_n", "yt_search_n",
    "cal_n",
    "kakao_n", "kakao_night_n", "kakao_chars", "kakao_reply_n", "kakao_reply_min_sum",
    "kakao_first_n", "kakao_assert_n",
    "sns_post_n", "sns_dm_n", "sns_dm_night_n",
    "ai_msg_n", "ai_msg_night_n", "ai_chars",
]

FIELD_CHANNEL = {
    "steps": "health", "sleep_min": "health", "quiet_min": "quiet", "screen_min": "screen", "git_commits": "git",
    **{f: "memo" for f in ["memo_n", "memo_chars", "memo_night_n"]},
    **{f: "photo" for f in ["photo_n", "photo_night_n", "shot_n", "shot_night_n"]},
    **{f: "yt" for f in ["yt_watch_n", "yt_watch_night_n", "yt_search_n"]},
    "cal_n": "cal",
    **{f: "kakao" for f in ["kakao_n", "kakao_night_n", "kakao_chars", "kakao_reply_n", "kakao_reply_min_sum",
                            "kakao_first_n", "kakao_assert_n"]},
    **{f: "sns" for f in ["sns_post_n", "sns_dm_n", "sns_dm_night_n"]},
    **{f: "ai" for f in ["ai_msg_n", "ai_msg_night_n", "ai_chars"]},
}
