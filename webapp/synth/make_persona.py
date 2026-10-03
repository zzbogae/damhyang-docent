# -*- coding: utf-8 -*-
"""합성 인물 생성기.

가상 인물의 하루하루 행동을 시뮬레이션해서 기록 단위 레코드를 만들고, 같은 레코드에서
(1) 원천 내보내기 파일(Takeout zip, 애플 건강 export.zip, 삼성 헬스 CSV, 카카오톡 txt, 사진 폴더)과
(2) 브라우저 파서가 그 파일에서 만들어야 할 정답 일 단위 표(truth_daily.json)·채널 메타(truth_meta.json),
(3) 평가용 정답 사건 목록(events.json)을 함께 쓴다.

실제 개인 기록은 쓰지 않는다. 메모·메시지·제목은 전부 지어낸 문장이다.
규칙은 docs/import_rules.md, 파이썬 판은 synth/rules.py.

실행: core/.venv/bin/python synth/make_persona.py [long short elder]
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import io
import json
import math
import random
import shutil
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np
import piexif
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import texts as T  # noqa: E402
from rules import (  # noqa: E402
    REPLY_CAP_MIN,
    SLEEP_ASLEEP_VALUES,
    chars,
    is_assertive,
    is_first_person,
    is_night,
    local_to_utc,
    nfc,
)

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
D = dt.date
UTC = dt.timezone.utc
WEEKDAY_KO = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"]

# ---------------------------------------------------------------------------
# 인물 설정
# ---------------------------------------------------------------------------

PERSONAS = {
    "long": dict(
        seed=20110301,
        name="한도윤",
        start=D(2011, 3, 1),
        end=D(2026, 8, 30),
        export_utc=dt.datetime(2026, 9, 1, 1, 15, 0, tzinfo=UTC),
        channels={
            "memo": [(D(2011, 3, 1), D(2026, 8, 30))],
            "photo": [(D(2012, 1, 2), D(2016, 1, 31)), (D(2016, 5, 2), D(2026, 8, 30))],
            "health": [(D(2014, 1, 10), D(2026, 8, 30))],
            "yt": [(D(2013, 6, 1), D(2026, 8, 30))],
            "cal": [(D(2015, 3, 2), D(2016, 12, 30)), (D(2021, 3, 2), D(2026, 8, 30))],
            "kakao": [(D(2019, 2, 1), D(2019, 11, 30)), (D(2023, 5, 1), D(2024, 2, 29))],
        },
        health_gaps=[(D(2016, 8, 1), D(2016, 8, 24)), (D(2020, 2, 10), D(2020, 3, 5))],
        health="apple",
        watch_from=D(2019, 6, 10),
        sleep_from=D(2019, 6, 10),
        kakao_format="pc",
        takeout_lang="ko",
        takeout_split=True,
        gphotos=30,
        memo_rate=0.5,
        photo_rate=0.62,
        screenshot_rate=0.06,
        steps_base=7200,
        steps_weekend=0.85,
        sleep_base=415,
        yt_weekly=(0.4, 60.0),  # 채널 시작 → 끝, 지수 증가
        yt_night=0.06,
        cal_rate=0.13,
        kakao_rate=13.0,
        kakao_rooms=[("김서연", ["김서연"]), ("박준호", ["박준호"]), ("가족", ["엄마", "아빠", "한지우"]), ("동기 모임", ["이하은", "최민재", "정우"])],
        level_shifts=[
            dict(date=D(2014, 9, 15), kind="move", effects=dict(steps=0.85, photo_rate=1.2)),
            dict(date=D(2021, 3, 2), kind="job", effects=dict(cal_rate=1.6, steps=0.9, yt_rate=1.15)),
            dict(date=D(2023, 11, 6), kind="move", effects=dict(steps=1.15, photo_rate=0.85)),
        ],
        n_events=dict(hard=14, trip=12, busy=8),
        events_from=D(2014, 3, 1),
        makes=[(D(2011, 1, 1), "Apple", "iPhone 4S"), (D(2014, 10, 1), "Apple", "iPhone 6"), (D(2017, 11, 1), "Apple", "iPhone 8"),
               (D(2021, 10, 1), "Apple", "iPhone 13"), (D(2024, 10, 1), "Apple", "iPhone 16")],
    ),
    "short": dict(
        seed=20240901,
        name="서지안",
        start=D(2024, 9, 2),
        end=D(2026, 8, 30),
        export_utc=dt.datetime(2026, 9, 1, 1, 15, 0, tzinfo=UTC),
        channels={
            "memo": [(D(2024, 9, 2), D(2026, 8, 30))],
            "photo": [(D(2024, 9, 2), D(2026, 8, 30))],
            "health": [(D(2024, 9, 2), D(2026, 8, 30))],
            "kakao": [(D(2024, 9, 2), D(2026, 8, 30))],
        },
        health_gaps=[(D(2025, 7, 14), D(2025, 7, 27))],
        health="samsung",
        watch_from=D(2025, 3, 3),
        sleep_from=D(2024, 9, 2),
        kakao_format="android",
        takeout_lang="ko",
        takeout_split=False,
        gphotos=0,
        memo_rate=0.8,
        photo_rate=0.75,
        screenshot_rate=0.1,
        steps_base=6800,
        steps_weekend=0.9,
        sleep_base=400,
        yt_weekly=None,
        yt_night=0.0,
        cal_rate=0.0,
        kakao_rate=9.0,
        kakao_rooms=[("윤하람", ["윤하람"]), ("팀 채팅", ["오세진", "강민서", "배도현"]), ("엄마", ["엄마"])],
        level_shifts=[dict(date=D(2025, 9, 1), kind="job", effects=dict(steps=0.85, kakao_rate=1.3))],
        n_events=dict(hard=3, trip=2, busy=1),
        events_from=D(2025, 1, 6),
        makes=[(D(2020, 1, 1), "samsung", "SM-S921N")],
    ),
    "elder": dict(
        seed=19550412,
        name="문영자",
        start=D(2018, 1, 1),
        end=D(2026, 8, 30),
        export_utc=dt.datetime(2026, 8, 31, 11, 2, 0, tzinfo=UTC),
        channels={
            "memo": [(D(2019, 5, 1), D(2026, 8, 30))],
            "photo": [(D(2018, 1, 1), D(2026, 8, 30))],
            "health": [(D(2020, 3, 2), D(2026, 8, 30))],
            "yt": [(D(2018, 1, 1), D(2026, 8, 30))],
            "kakao": [(D(2022, 4, 4), D(2022, 5, 29)), (D(2025, 9, 1), D(2025, 11, 30))],
        },
        health_gaps=[(D(2023, 1, 9), D(2023, 2, 12))],
        health="fit",  # 안드로이드 + 구글 피트니스(Takeout 안에 들어감)
        yt_format="html",  # Takeout 유튜브 기록 기본 형식(고연령 사용자는 JSON 으로 바꾸지 않는다고 가정)
        watch_from=None,
        sleep_from=D(2020, 3, 2),
        kakao_format="ios",
        takeout_lang="en",
        takeout_split=False,
        gphotos=0,
        memo_rate=0.12,
        photo_rate=0.45,
        screenshot_rate=0.03,
        steps_base=4600,
        steps_weekend=1.0,
        sleep_base=470,
        yt_weekly=(35.0, 48.0),
        yt_night=0.05,
        cal_rate=0.0,
        kakao_rate=1.6,
        kakao_rooms=[("큰딸", ["큰딸"]), ("복지관 모임", ["김순자", "이정희"])],
        level_shifts=[dict(date=D(2021, 1, 11), kind="retire", effects=dict(steps=1.2, yt_rate=1.3))],
        n_events=dict(hard=5, trip=4, busy=1),
        events_from=D(2019, 1, 7),
        makes=[(D(2015, 1, 1), "samsung", "SM-G930K"), (D(2021, 6, 1), "samsung", "SM-A536N")],
    ),
}

EFFECTS = {
    # 곱셈 효과(값이 없으면 1). sleep 은 분 단위 덧셈. *_night 는 확률 대체값.
    "hard": dict(steps=0.6, sleep=-70, memo_rate=1.4, memo_night=0.35, memo_len=2.4, photo_rate=0.5, photo_night=0.08,
                 yt_rate=1.7, yt_night=0.35, yt_search=1.6, cal_rate=0.7, kakao_rate=0.6, kakao_night=0.25,
                 kakao_delay=3.0, kakao_first=1.7),
    "trip": dict(steps=1.7, sleep=-20, memo_rate=0.5, photo_rate=8.0, yt_rate=0.3, yt_search=0.5, cal_rate=0.3,
                 kakao_rate=0.7),
    "busy": dict(steps=0.9, sleep=-35, cal_rate=4.0, photo_rate=0.4, yt_rate=0.7, memo_rate=0.8, kakao_rate=1.2,
                 kakao_delay=1.8),
}
# 평가용: 사건이 움직이는 지표(판정 코어 지표 이름 기준)
EFFECT_INDICATORS = {
    "hard": {"steps": "down", "sleep": "down", "memo_n": "up", "memo_len": "up", "memo_night": "up", "photo_n": "down",
             "yt_watch": "up", "yt_night": "up", "yt_search": "up", "kakao_n": "down", "kakao_night": "up",
             "kakao_delay": "up", "kakao_first": "up"},
    "trip": {"steps": "up", "photo_n": "up", "memo_n": "down", "yt_watch": "down", "yt_search": "down", "cal_n": "down",
             "kakao_n": "down"},
    "busy": {"cal_n": "up", "photo_n": "down", "sleep": "down", "yt_watch": "down", "kakao_delay": "up"},
}
DURATION = {"hard": (7, 21), "trip": (3, 9), "busy": (14, 42)}

# 새 채널(원페이지 02절 "SNS·AI 대화 연동"): 인스타그램, AI 대화. 기존 채널의 난수 흐름을 바꾸지 않도록 따로 시뮬레이션한다.
PERSONAS["long"]["channels"]["sns"] = [(D(2015, 6, 1), D(2026, 8, 30))]
PERSONAS["long"]["channels"]["ai"] = [(D(2023, 1, 9), D(2026, 8, 30))]
PERSONAS["long"].update(sns_post_rate=0.14, sns_dm_rate=0.9, sns_threads=["김서연", "박준호", "이하은"], ai_app="chatgpt", ai_rate=(0.25, 2.2))
PERSONAS["short"]["channels"]["sns"] = [(D(2024, 9, 2), D(2026, 8, 30))]
PERSONAS["short"]["channels"]["ai"] = [(D(2025, 1, 6), D(2026, 8, 30))]
PERSONAS["short"].update(sns_post_rate=0.3, sns_dm_rate=1.6, sns_threads=["윤하람", "오세진"], ai_app="claude", ai_rate=(0.8, 1.6))
EFFECTS["hard"].update(ai_rate=1.8, ai_night=0.35, sns_post_rate=0.5, sns_dm_rate=0.6, sns_night=0.3)
EFFECTS["trip"].update(sns_post_rate=3.0, sns_dm_rate=1.3, ai_rate=0.4)
EFFECTS["busy"].update(ai_rate=1.4)
EFFECT_INDICATORS["hard"].update(ai_msg="up", ai_night="up", ai_len="up", sns_post="down", sns_night="up")
EFFECT_INDICATORS["trip"].update(sns_post="up", ai_msg="down")
EFFECT_INDICATORS["busy"].update(ai_msg="up")


def drange(a: dt.date, b: dt.date):
    d = a
    while d <= b:
        yield d
        d += dt.timedelta(days=1)


def in_ranges(d: dt.date, ranges) -> bool:
    return any(a <= d <= b for a, b in ranges)


class Persona:
    def __init__(self, key: str):
        self.key = key
        self.cfg = PERSONAS[key]
        c = self.cfg
        self.rng = random.Random(c["seed"])
        self.np = np.random.default_rng(c["seed"])
        self.name = c["name"]
        self.start, self.end = c["start"], c["end"]
        self.export_utc: dt.datetime = c["export_utc"]
        self.export_local = self.export_utc.astimezone(dt.timezone(dt.timedelta(hours=9))).replace(tzinfo=None)
        self.out = OUT / key
        self.exp = self.out / "exports"
        # 레코드
        self.memos: list[dict] = []
        self.photos: list[dict] = []
        self.yt_watch: list[dict] = []
        self.yt_search: list[dict] = []
        self.cal_events: list[dict] = []
        self.kakao: dict[str, list[dict]] = defaultdict(list)
        self.steps_src: dict[tuple[dt.date, str], list[tuple[dt.datetime, dt.datetime, int]]] = defaultdict(list)
        self.sleep_src: dict[str, list[tuple[dt.datetime, dt.datetime, str]]] = defaultdict(list)
        self.events: list[dict] = []

    # -- 사건 ------------------------------------------------------------------
    def place_events(self):
        c = self.cfg
        spans: list[tuple[dt.date, dt.date]] = []
        items = []
        for kind, n in c["n_events"].items():
            items += [kind] * n
        self.rng.shuffle(items)
        lo, hi = c["events_from"], self.end - dt.timedelta(days=60)
        total_days = (hi - lo).days
        for i, kind in enumerate(items):
            for _try in range(400):
                s = lo + dt.timedelta(days=self.rng.randint(0, total_days))
                s -= dt.timedelta(days=s.weekday())  # 월요일 시작
                dur = self.rng.randint(*DURATION[kind])
                e = s + dt.timedelta(days=dur - 1)
                if e > hi:
                    continue
                if any(not (e + dt.timedelta(days=21) < a or s - dt.timedelta(days=21) > b) for a, b in spans):
                    continue
                spans.append((s, e))
                self.events.append(dict(id=f"{self.key}-{kind}-{i:02d}", type=kind, start=s.isoformat(), end=e.isoformat(),
                                        persistent=False, effects=EFFECT_INDICATORS[kind]))
                break
        self.events.sort(key=lambda x: x["start"])
        for ls in c["level_shifts"]:
            eff_ind = {}
            for k, v in ls["effects"].items():
                ind = {"steps": "steps", "photo_rate": "photo_n", "cal_rate": "cal_n", "yt_rate": "yt_watch", "kakao_rate": "kakao_n"}[k]
                eff_ind[ind] = "up" if v > 1 else "down"
            self.events.append(dict(id=f"{self.key}-{ls['kind']}-{ls['date'].isoformat()}", type=ls["kind"], start=ls["date"].isoformat(),
                                    end=None, persistent=True, effects=eff_ind))
        if c.get("watch_from") and c["health"] in ("apple", "samsung", "fit"):
            self.events.append(dict(id=f"{self.key}-device-{c['watch_from'].isoformat()}", type="device", start=c["watch_from"].isoformat(),
                                    end=None, persistent=True, effects={"steps": "up"}))

    def day_effects(self, d: dt.date) -> dict:
        eff = defaultdict(lambda: 1.0)
        eff["sleep"] = 0.0
        for ev in self.events:
            if ev["persistent"] or ev["type"] not in EFFECTS:
                continue
            if ev["start"] <= d.isoformat() <= ev["end"]:
                for k, v in EFFECTS[ev["type"]].items():
                    if k == "sleep":
                        eff["sleep"] += v
                    elif k.endswith("_night"):
                        eff[k] = v
                    else:
                        eff[k] *= v
        for ls in self.cfg["level_shifts"]:
            if d >= ls["date"]:
                for k, v in ls["effects"].items():
                    eff[k] *= v
        return eff

    def hard_on(self, d: dt.date) -> bool:
        return any(ev["type"] == "hard" and ev["start"] <= d.isoformat() <= ev["end"] for ev in self.events)

    # -- 시각 뽑기 ---------------------------------------------------------------
    def day_time(self, d: dt.date, p_night: float, peak=(9, 23)) -> dt.datetime:
        if self.rng.random() < p_night:
            h = self.rng.randint(0, 4)
        else:
            h = self.rng.choices(range(peak[0], peak[1]), weights=[1 + (i % 5) for i in range(peak[1] - peak[0])])[0]
        return dt.datetime(d.year, d.month, d.day, h, self.rng.randint(0, 59), self.rng.randint(0, 59))

    # -- 시뮬레이션 -----------------------------------------------------------------
    def simulate(self):
        c = self.cfg
        ch = c["channels"]
        yt_start = ch["yt"][0][0] if "yt" in ch else None
        secrets = list(T.FAKE_SECRETS)
        crisis = list(T.CRISIS_NOTES)
        memo_days = [d for d in drange(self.start, self.end) if in_ranges(d, ch.get("memo", []))]
        # 가짜 자격증명·위기 메모를 넣을 날(힘든 주에 위기 메모)
        secret_days = set(self.rng.sample(memo_days, min(len(secrets), len(memo_days)))) if memo_days else set()
        hard_days = [d for d in memo_days if self.hard_on(d)]
        crisis_days = set(self.rng.sample(hard_days, min(len(crisis), len(hard_days)))) if hard_days else set()
        room_last: dict[str, dt.datetime] = {}

        for d in drange(self.start, self.end):
            eff = self.day_effects(d)
            doy = d.timetuple().tm_yday
            wkend = d.weekday() >= 5
            hard = self.hard_on(d)

            # 메모
            if in_ranges(d, ch.get("memo", [])):
                lam = c["memo_rate"] * eff["memo_rate"]
                n = int(self.np.poisson(lam))
                if d in secret_days:
                    text, kinds = secrets.pop()
                    self._add_memo(d, text, "", flags=dict(secret=True, secretKinds=kinds))
                if d in crisis_days:
                    self._add_memo(d, crisis.pop(), "", flags=dict(crisis=True), p_night=0.6)
                for _ in range(n):
                    extra = eff["memo_len"] if eff["memo_len"] != 1.0 else 1.0
                    n_sent = 1 + int(self.np.poisson(0.3 * extra * extra))
                    text = T.memo_text(self.rng, n_sent, hard=hard)
                    title = self.rng.choice(T.MEMO_TITLES)
                    p_night = eff["memo_night"] if eff["memo_night"] != 1.0 else 0.02
                    self._add_memo(d, text, title, p_night=p_night)

            # 사진
            if in_ranges(d, ch.get("photo", [])):
                season = 1 + 0.3 * math.cos(2 * math.pi * (doy - 130) / 365.25)
                lam = c["photo_rate"] * season * (1.8 if wkend else 1.0) * eff["photo_rate"]
                p_night = eff["photo_night"] if eff["photo_night"] != 1.0 else 0.015
                for _ in range(int(self.np.poisson(lam))):
                    t = self.day_time(d, p_night, peak=(8, 22))
                    self.photos.append(dict(dt=t, kind="camera"))
                for _ in range(int(self.np.poisson(c["screenshot_rate"]))):
                    t = self.day_time(d, 0.03)
                    self.photos.append(dict(dt=t, kind="screenshot"))

            # 건강
            if in_ranges(d, ch.get("health", [])) and not in_ranges(d, c["health_gaps"]):
                season = 1 + 0.18 * math.cos(2 * math.pi * (doy - 196) / 365.25)
                wk = c["steps_weekend"] if wkend else 1.0
                true_steps = c["steps_base"] * season * wk * eff["steps"] * math.exp(self.np.normal(0, 0.28))
                if self.rng.random() < 0.96:
                    self._add_steps(d, true_steps)
                if c["sleep_from"] and d >= c["sleep_from"] and self.rng.random() < 0.88:
                    s_season = 15 * math.cos(2 * math.pi * (doy - 15) / 365.25)
                    total = c["sleep_base"] + s_season + eff["sleep"] + self.np.normal(0, 35)
                    self._add_sleep(d, int(max(180, min(660, round(total)))))

            # 유튜브
            if yt_start and in_ranges(d, ch.get("yt", [])):
                a, b = c["yt_weekly"]
                span = (ch["yt"][-1][1] - yt_start).days or 1
                frac = (d - yt_start).days / span
                weekly = a * (b / a) ** frac
                lam = weekly / 7 * (1.35 if wkend else 0.9) * eff["yt_rate"]
                p_night = eff["yt_night"] if eff["yt_night"] != 1.0 else c["yt_night"]
                for _ in range(int(self.np.poisson(lam))):
                    t = self.day_time(d, p_night, peak=(7, 24))
                    ad = self.rng.random() < 0.03
                    self.yt_watch.append(dict(dt=t, ad=False, title=T.video_title(self.rng, c["takeout_lang"])))
                    if ad:
                        self.yt_watch.append(dict(dt=t + dt.timedelta(seconds=5), ad=True, title="광고 영상"))
                lam_s = (0.08 * weekly / 7 + 0.03) * eff["yt_search"]
                for _ in range(int(self.np.poisson(lam_s))):
                    t = self.day_time(d, p_night, peak=(8, 24))
                    self.yt_search.append(dict(dt=t, q=T.search_query(self.rng)))

            # 캘린더
            if in_ranges(d, ch.get("cal", [])):
                lam = c["cal_rate"] * (0.4 if wkend else 1.3) * eff["cal_rate"]
                for _ in range(int(self.np.poisson(lam))):
                    r = self.rng.random()
                    kind = "utc" if r < 0.6 else ("tzid" if r < 0.85 else "date")
                    h = self.rng.randint(8, 20)
                    t = dt.datetime(d.year, d.month, d.day, h, self.rng.choice([0, 30]))
                    cancelled = self.rng.random() < 0.02
                    self.cal_events.append(dict(kind=kind, dt=t, title=self.rng.choice(T.CAL_TITLES), cancelled=cancelled,
                                                cal=self.rng.choice(["personal", "work"])))

            # 카카오톡
            if in_ranges(d, ch.get("kakao", [])):
                lam = c["kakao_rate"] * eff["kakao_rate"] / 3.0
                p_night = eff["kakao_night"] if eff["kakao_night"] != 1.0 else 0.04
                p_first = min(0.8, 0.28 * eff["kakao_first"])
                for _ in range(int(self.np.poisson(lam))):
                    room, members = self.rng.choice(c["kakao_rooms"])
                    t0 = self.day_time(d, p_night, peak=(7, 24))
                    t0 = t0.replace(second=0)
                    if room in room_last and t0 <= room_last[room]:
                        t0 = room_last[room] + dt.timedelta(minutes=1)
                    self._kakao_burst(room, members, t0, eff["kakao_delay"], p_first)
                    room_last[room] = self.kakao[room][-1]["dt"]

        # 반복 일정·취소·재정의 없는 반복 등 캘린더 특수 항목
        self._add_recurring()
        # 구글 포토 사진(Takeout, long 만)
        self._assign_photo_sources()

    def simulate_extra(self):
        """인스타그램·AI 대화. 별도 난수 생성기를 써서 기존 채널 데이터는 그대로 둔다."""
        c = self.cfg
        ch = c["channels"]
        rx = random.Random(c["seed"] + 7)
        nx = np.random.default_rng(c["seed"] + 7)
        self.ig_posts: list[dict] = []
        self.ig_threads: dict[str, list[dict]] = defaultdict(list)
        self.ai_convs: list[dict] = []
        sns, ai = ch.get("sns", []), ch.get("ai", [])
        if not sns and not ai:
            return

        def tpick(d, p_night, peak=(9, 24)):
            h = rx.randint(0, 4) if rx.random() < p_night else rx.randint(peak[0], peak[1] - 1)
            return dt.datetime(d.year, d.month, d.day, h, rx.randint(0, 59), rx.randint(0, 59))

        ai_start = ai[0][0] if ai else None
        for d in drange(self.start, self.end):
            eff = self.day_effects(d)
            wkend = d.weekday() >= 5
            if in_ranges(d, sns):
                for _ in range(int(nx.poisson(c["sns_post_rate"] * eff["sns_post_rate"] * (1.6 if wkend else 1.0)))):
                    kind = rx.choices(["post", "story", "reel"], weights=[5, 4, 1])[0]
                    self.ig_posts.append(dict(dt=tpick(d, 0.03), kind=kind, caption=nfc(T.memo_sentence(rx))))
                p_night = eff["sns_night"] if eff["sns_night"] != 1.0 else 0.05
                for _ in range(int(nx.poisson(c["sns_dm_rate"] * eff["sns_dm_rate"]))):
                    other = rx.choice(c["sns_threads"])
                    t = tpick(d, p_night, (8, 24))
                    for k in range(rx.randint(2, 6)):
                        sender = self.name if k % 2 == 0 else other
                        self.ig_threads[other].append(dict(dt=t, sender=sender, text=nfc(T.kakao_other(rx))))
                        t += dt.timedelta(seconds=rx.randint(20, 240))
            if ai_start and in_ranges(d, ai):
                a, b = c["ai_rate"]
                span = (ai[-1][1] - ai_start).days or 1
                lam = (a + (b - a) * (d - ai_start).days / span) * eff["ai_rate"]
                p_night = eff["ai_night"] if eff["ai_night"] != 1.0 else 0.06
                for _ in range(int(nx.poisson(lam))):
                    t = tpick(d, p_night)
                    msgs = []
                    for _k in range(rx.randint(1, 5)):
                        q = T.search_query(rx) + rx.choice([" 알려줘", " 정리해 줘", " 예시 들어 줘", "는 왜 그런가요?"])
                        if eff["ai_rate"] > 1.5:
                            q += " " + T.memo_sentence(rx)
                        msgs.append(dict(dt=t, role="user", text=nfc(q)))
                        msgs.append(dict(dt=t + dt.timedelta(seconds=rx.randint(5, 40)), role="assistant", text="(가상 답변입니다)"))
                        t += dt.timedelta(seconds=rx.randint(60, 400))
                    self.ai_convs.append(dict(start=msgs[0]["dt"], msgs=msgs, title=nfc(msgs[0]["text"][:20])))

    def _add_memo(self, d, text, title, flags=None, p_night=0.02):
        t = self.day_time(d, p_night, peak=(7, 24))
        trashed = self.rng.random() < 0.03 and not flags
        checklist = (not flags) and self.rng.random() < 0.02
        legacy = (not flags) and self.rng.random() < 0.05  # createdTimestampUsec 없는 옛 메모
        self.memos.append(dict(dt=t, text=nfc(text), title=nfc(title), trashed=trashed, checklist=checklist,
                               legacy=legacy, flags=flags or {}))

    def _add_steps(self, d: dt.date, true_steps: float):
        c = self.cfg
        watch = c.get("watch_from") and d >= c["watch_from"]
        sources = [("iPhone" if c["health"] == "apple" else "phone", 0.8)]
        if watch:
            sources.append(("Apple Watch" if c["health"] == "apple" else "watch", 1.0))
        for src, factor in sources:
            total = max(50, int(round(true_steps * factor)))
            k = self.rng.randint(8, 24) if c["health"] == "apple" else 1
            cuts = sorted(self.rng.sample(range(1, total), k - 1)) if k > 1 and total > k else []
            parts = [b - a for a, b in zip([0] + cuts, cuts + [total])]
            hours = sorted(self.rng.choices(range(7, 23), k=len(parts)))
            for h, v in zip(hours, parts):
                m = self.rng.randint(0, 49)
                s = dt.datetime(d.year, d.month, d.day, h, m, self.rng.randint(0, 59))
                self.steps_src[(d, src)].append((s, s + dt.timedelta(minutes=self.rng.randint(2, 9)), v))

    def _add_sleep(self, wake: dt.date, total_min: int):
        c = self.cfg
        prev = wake - dt.timedelta(days=1)
        start = dt.datetime(prev.year, prev.month, prev.day, 22, 30) + dt.timedelta(minutes=self.rng.randint(0, 180))
        src = "Apple Watch" if c["health"] == "apple" else "samsung"
        t = start
        remaining = total_min
        segs = []
        stages = ["HKCategoryValueSleepAnalysisAsleepCore", "HKCategoryValueSleepAnalysisAsleepDeep",
                  "HKCategoryValueSleepAnalysisAsleepREM"]
        if c["health"] == "apple":
            while remaining > 0:
                L = min(remaining, self.rng.randint(15, 70))
                segs.append((t, t + dt.timedelta(minutes=L), self.rng.choice(stages)))
                t += dt.timedelta(minutes=L)
                remaining -= L
                if remaining > 0 and self.rng.random() < 0.15:
                    aw = self.rng.randint(2, 12)
                    segs.append((t, t + dt.timedelta(minutes=aw), "HKCategoryValueSleepAnalysisAwake"))
                    t += dt.timedelta(minutes=aw)
            # 아이폰의 침대에 있던 시간(세지 않음)
            self.sleep_src["iPhone"].append((start - dt.timedelta(minutes=10), t + dt.timedelta(minutes=15),
                                             "HKCategoryValueSleepAnalysisInBed"))
        else:
            if total_min > 240 and self.rng.random() < 0.3:
                a = self.rng.randint(120, total_min - 100)
                segs.append((t, t + dt.timedelta(minutes=a), "asleep"))
                t2 = t + dt.timedelta(minutes=a + self.rng.randint(5, 25))
                segs.append((t2, t2 + dt.timedelta(minutes=total_min - a), "asleep"))
            else:
                segs.append((t, t + dt.timedelta(minutes=total_min), "asleep"))
        # 깬 날짜가 wake 가 되도록 끝 시각 확인(깬 날짜 기준 규칙). 넘치면 시작을 당긴다.
        end = segs[-1][1]
        if end.date() != wake:
            shift = end - dt.datetime(wake.year, wake.month, wake.day, 9, 0)
            if end.date() > wake:
                segs = [(a - shift, b - shift, v) for a, b, v in segs]
        self.sleep_src[src].extend(segs)

    def _kakao_burst(self, room, members, t0, delay_mult, p_first):
        c = self.cfg
        L = self.rng.randint(2, 8)
        t = t0
        sender = self.name if self.rng.random() < 0.3 else self.rng.choice(members)
        prev = None
        for _ in range(L):
            if prev is not None:
                if sender == self.name and prev != self.name:
                    if self.rng.random() < 0.1:
                        gap = self.rng.randint(60, 420)
                    else:
                        gap = int(round(self.np.exponential(6 * delay_mult)))
                elif sender == self.name:
                    gap = self.rng.randint(0, 2)
                else:
                    gap = int(round(self.np.exponential(4)))
                t = t + dt.timedelta(minutes=gap)
            if sender == self.name:
                text = T.kakao_mine(self.rng, p_first, 0.07)
            else:
                text = T.kakao_other(self.rng)
            self.kakao[room].append(dict(dt=t, sender=sender, text=nfc(text)))
            prev = sender
            # 다음 발화자
            if sender == self.name:
                sender = self.name if self.rng.random() < 0.25 else self.rng.choice(members)
            else:
                sender = self.name if self.rng.random() < 0.6 else self.rng.choice(members)
        # 모바일 형식은 가끔 시스템 줄(들어왔습니다)을 넣는다. 파서는 무시해야 한다.
        if c["kakao_format"] in ("android", "ios") and self.rng.random() < 0.01:
            self.kakao[room].append(dict(dt=t + dt.timedelta(minutes=1), sender=None, text=f"{self.rng.choice(members)}님이 들어왔습니다."))

    def _add_recurring(self):
        ch = self.cfg["channels"].get("cal")
        if not ch:
            return
        a, b = ch[-1]
        s1 = a + dt.timedelta(days=30)
        s1 -= dt.timedelta(days=s1.weekday())
        self.cal_events.append(dict(kind="utc", dt=dt.datetime(s1.year, s1.month, s1.day, 10, 0), title="주간 회의",
                                    cancelled=False, cal="work", rrule=dict(count=10)))
        s2 = a + dt.timedelta(days=120)
        s2 -= dt.timedelta(days=s2.weekday() - 2) if s2.weekday() >= 2 else dt.timedelta(days=-(2 - s2.weekday()))
        until = s2 + dt.timedelta(days=7 * 12)
        ex = s2 + dt.timedelta(days=7 * 3)
        self.cal_events.append(dict(kind="tzid", dt=dt.datetime(s2.year, s2.month, s2.day, 19, 0), title="스터디",
                                    cancelled=False, cal="personal",
                                    rrule=dict(until=dt.datetime(until.year, until.month, until.day, 23, 59)),
                                    exdate=[dt.datetime(ex.year, ex.month, ex.day, 19, 0)]))
        s3 = b - dt.timedelta(days=50)
        s3 -= dt.timedelta(days=s3.weekday() - 1) if s3.weekday() >= 1 else dt.timedelta(days=-1)
        self.cal_events.append(dict(kind="tzid", dt=dt.datetime(s3.year, s3.month, s3.day, 7, 30), title="운동",
                                    cancelled=False, cal="personal", rrule=dict(infinite=True)))

    def _assign_photo_sources(self):
        n_g = self.cfg["gphotos"]
        self.photos.sort(key=lambda p: p["dt"])
        for p in self.photos:
            p["source"] = "folder"
            p["exif"] = p["kind"] == "camera"
            p["name_date"] = False
        cams = [p for p in self.photos if p["kind"] == "camera"]
        # 3% 는 EXIF 없이 이름에 날짜가 있는 JPEG(메신저에서 저장한 사진 등)
        for p in self.rng.sample(cams, int(len(cams) * 0.03)):
            p["exif"] = False
            p["name_date"] = True
        if n_g:
            y2019 = [p for p in cams if p["dt"].year in (2019, 2020) and p["exif"]]
            chosen = self.rng.sample(y2019, min(n_g, len(y2019)))
            for i, p in enumerate(chosen):
                p["source"] = "takeout"
                p["exif"] = i % 2 == 0
                p["sidecar_style"] = "plain" if i % 3 else "supplemental"
            shots = [p for p in self.photos if p["kind"] == "screenshot" and p["dt"].year in (2019, 2020)]
            if shots:
                s = self.rng.choice(shots)
                s["source"] = "takeout"
                s["sidecar_style"] = "plain"

    # -----------------------------------------------------------------------
    # 원천 파일 쓰기
    # -----------------------------------------------------------------------
    def write_exports(self):
        if self.out.exists():
            shutil.rmtree(self.out)
        self.exp.mkdir(parents=True)
        self.memo_ids: dict[int, str] = {}
        self.photo_paths: dict[int, str] = {}
        takeout = self._takeout_entries()
        self._write_takeout(takeout)
        if self.cfg["health"] == "apple":
            self._write_apple_health()
        elif self.cfg["health"] == "samsung":
            self._write_samsung_health()
        # fit 은 Takeout zip 안에 들어간다(_takeout_entries)
        self._write_kakao()
        self._write_instagram()
        self._write_ai()
        self._write_photo_folder()

    # Takeout ------------------------------------------------------------------
    def _takeout_entries(self) -> dict[str, list[tuple[str, bytes]]]:
        """zip 파트 번호 → [(경로, 바이트)]"""
        lang = self.cfg["takeout_lang"]
        parts: dict[int, list[tuple[str, bytes]]] = defaultdict(list)
        p_yt = 1
        p_rest = 2 if self.cfg["takeout_split"] else 1
        parts[1].append(("Takeout/archive_browser.html", b"<html><body>archive</body></html>"))
        # 유튜브
        if self.yt_watch or self.yt_search:
            if lang == "ko":
                base = "Takeout/YouTube 및 YouTube Music/기록/"
                wname, sname = "시청 기록.json", "검색 기록.json"
            else:
                base = "Takeout/YouTube and YouTube Music/history/"
                wname, sname = "watch-history.json", "search-history.json"
            watch = []
            for i, w in enumerate(sorted(self.yt_watch, key=lambda x: x["dt"], reverse=True)):
                utc = local_to_utc(w["dt"])
                iso = utc.strftime("%Y-%m-%dT%H:%M:%S") + (f".{self.rng.randint(0, 999):03d}Z" if i % 4 else "Z")
                vid = "v" + hashlib.md5(f"{w['dt']}{w['title']}{i}".encode()).hexdigest()[:10]
                title = f"{w['title']}을(를) 시청했습니다." if lang == "ko" else f"Watched {w['title']}"
                item = {"header": "YouTube", "title": title, "titleUrl": f"https://www.youtube.com/watch?v={vid}",
                        "subtitles": [{"name": "가상 채널" if lang == "ko" else "Sample Channel",
                                       "url": "https://www.youtube.com/channel/UCsample"}],
                        "time": iso, "products": ["YouTube"],
                        "activityControls": ["YouTube 시청 기록" if lang == "ko" else "YouTube watch history"]}
                if w["ad"]:
                    item["details"] = [{"name": "Google 광고" if lang == "ko" else "From Google Ads"}]
                    item.pop("subtitles")
                watch.append(item)
            search = []
            for s in sorted(self.yt_search, key=lambda x: x["dt"], reverse=True):
                utc = local_to_utc(s["dt"])
                iso = utc.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                title = f"{s['q']}을(를) 검색했습니다." if lang == "ko" else f"Searched for {s['q']}"
                search.append({"header": "YouTube", "title": title,
                               "titleUrl": "https://www.youtube.com/results?search_query=sample", "time": iso,
                               "products": ["YouTube"],
                               "activityControls": ["YouTube 검색 기록" if lang == "ko" else "YouTube search history"]})
            if self.cfg.get("yt_format") == "html":
                parts[p_yt].append((base + wname.replace(".json", ".html"), self._yt_html(watch, "watch", lang).encode()))
                parts[p_yt].append((base + sname.replace(".json", ".html"), self._yt_html(search, "search", lang).encode()))
            else:
                parts[p_yt].append((base + wname, json.dumps(watch, ensure_ascii=False, indent=2).encode()))
                parts[p_yt].append((base + sname, json.dumps(search, ensure_ascii=False, indent=2).encode()))
        # 구글 피트니스
        if self.cfg["health"] == "fit":
            for path, data in self._fit_entries(lang):
                parts[p_rest].append((path, data))
        # Keep
        used = set()
        for i, m in enumerate(self.memos):
            utc = local_to_utc(m["dt"])
            usec = int(utc.timestamp()) * 1_000_000 + self.rng.randint(0, 999_999)
            # 앞 필드 정수 초만 쓰면 날짜가 흔들리지 않는다(마이크로초는 초 안에서만 흔든다)
            if m["title"]:
                stem = m["title"]
            else:
                stem = m["dt"].strftime("%Y-%m-%dT%H_%M_%S.") + f"{i % 1000:03d}+09_00"
            name = stem
            k = 1
            while name in used:
                name = f"{stem}({k})"
                k += 1
            used.add(name)
            path = f"Takeout/Keep/{name}.json"
            note = {"color": "DEFAULT", "isTrashed": m["trashed"], "isPinned": False, "isArchived": False,
                    "title": m["title"], "userEditedTimestampUsec": usec + 3_600_000_000 * self.rng.randint(0, 48),
                    "labels": []}
            if m["legacy"]:
                note["userEditedTimestampUsec"] = usec
            else:
                note["createdTimestampUsec"] = usec
            if m["checklist"]:
                lines = [x.strip() for x in m["text"].replace(". ", "\n").split("\n") if x.strip()]
                note["listContent"] = [{"textHtml": x, "text": x, "isChecked": False} for x in lines]
                m["text"] = "\n".join(lines)
            else:
                note["textContent"] = m["text"]
                note["textContentHtml"] = f"<p dir=\"ltr\">{m['text']}</p>"
            parts[p_yt].append((path, json.dumps(note, ensure_ascii=False).encode()))
            if i % 50 == 0:
                parts[p_yt].append((f"Takeout/Keep/{name}.html", f"<html><body>{m['text']}</body></html>".encode()))
            self.memo_ids[i] = f"keep:{path}"
        # 캘린더
        if self.cal_events:
            for cal in ("personal", "work"):
                evs = [e for e in self.cal_events if e["cal"] == cal]
                if not evs:
                    continue
                name = {"personal": "개인", "work": "업무"}[cal] if lang == "ko" else {"personal": "Personal", "work": "Work"}[cal]
                folder = "Takeout/캘린더/" if lang == "ko" else "Takeout/Calendar/"
                parts[p_rest].append((f"{folder}{name}.ics", self._ics(evs, name).encode()))
        # 구글 포토
        img_cache = self._img_cache()
        for idx, p in enumerate(self.photos):
            if p["source"] != "takeout":
                continue
            t = p["dt"]
            if p["kind"] == "screenshot":
                fname = f"Screenshot_{t:%Y%m%d-%H%M%S}.png"
                data = self._png_bytes(img_cache)
            else:
                fname = f"IMG_{t:%Y%m%d_%H%M%S}.jpg"
                data = self._jpeg_bytes(img_cache, p, t)
            folder = f"Takeout/Google 포토/Photos from {t.year}/" if lang == "ko" else f"Takeout/Google Photos/Photos from {t.year}/"
            parts[p_rest].append((folder + fname, data))
            ts = int(local_to_utc(t).timestamp())
            side = {"title": fname, "description": "", "imageViews": "0",
                    "creationTime": {"timestamp": str(ts + 3600), "formatted": ""},
                    "photoTakenTime": {"timestamp": str(ts), "formatted": ""},
                    "geoData": {"latitude": 0.0, "longitude": 0.0, "altitude": 0.0}}
            sname = fname + (".supplemental-metadata.json" if p.get("sidecar_style") == "supplemental" else ".json")
            parts[p_rest].append((folder + sname, json.dumps(side, ensure_ascii=False).encode()))
            self.photo_paths[idx] = None  # zip 이름이 정해진 뒤 채움
            p["zip_entry"] = folder + fname
        return parts

    def _ics(self, evs, calname) -> str:
        L = ["BEGIN:VCALENDAR", "PRODID:-//Google Inc//Google Calendar 70.9054//EN", "VERSION:2.0",
             "CALSCALE:GREGORIAN", "METHOD:PUBLISH", f"X-WR-CALNAME:{calname}", "X-WR-TIMEZONE:Asia/Seoul",
             "BEGIN:VTIMEZONE", "TZID:Asia/Seoul", "X-LIC-LOCATION:Asia/Seoul", "BEGIN:STANDARD",
             "TZOFFSETFROM:+0900", "TZOFFSETTO:+0900", "TZNAME:KST", "DTSTART:19700101T000000", "END:STANDARD",
             "END:VTIMEZONE"]
        for i, e in enumerate(evs):
            t = e["dt"]
            L.append("BEGIN:VEVENT")
            if e["kind"] == "utc":
                u = local_to_utc(t)
                L.append(f"DTSTART:{u:%Y%m%dT%H%M%S}Z")
                L.append(f"DTEND:{u + dt.timedelta(hours=1):%Y%m%dT%H%M%S}Z")
            elif e["kind"] == "tzid":
                L.append(f"DTSTART;TZID=Asia/Seoul:{t:%Y%m%dT%H%M%S}")
                L.append(f"DTEND;TZID=Asia/Seoul:{t + dt.timedelta(hours=1):%Y%m%dT%H%M%S}")
            else:
                L.append(f"DTSTART;VALUE=DATE:{t:%Y%m%d}")
                L.append(f"DTEND;VALUE=DATE:{t + dt.timedelta(days=1):%Y%m%d}")
            rr = e.get("rrule")
            if rr:
                if "count" in rr:
                    L.append(f"RRULE:FREQ=WEEKLY;COUNT={rr['count']}")
                elif "until" in rr:
                    L.append(f"RRULE:FREQ=WEEKLY;UNTIL={local_to_utc(rr['until']):%Y%m%dT%H%M%S}Z")
                else:
                    L.append("RRULE:FREQ=WEEKLY")
                for x in e.get("exdate", []):
                    L.append(f"EXDATE;TZID=Asia/Seoul:{x:%Y%m%dT%H%M%S}")
            L.append(f"DTSTAMP:{self.export_utc:%Y%m%dT%H%M%S}Z")
            L.append(f"UID:{self.key}-{calname}-{i}@google.com")
            L.append(f"SUMMARY:{e['title']}")
            L.append("STATUS:CANCELLED" if e["cancelled"] else "STATUS:CONFIRMED")
            L.append("TRANSP:OPAQUE")
            L.append("END:VEVENT")
        L.append("END:VCALENDAR")
        return "\r\n".join(L) + "\r\n"

    def _yt_html(self, items: list[dict], kind: str, lang: str) -> str:
        """Takeout 유튜브 기록 HTML(내 활동 형식). 항목 순서·광고 표시는 JSON 판과 같다. 설문 항목을 몇 개 섞는다(세지 않음)."""
        import html as H
        head = ('<html><head><meta charset="UTF-8"><title>' + ("시청 기록" if kind == "watch" else "검색 기록") +
                '</title><style>.mdl-grid{}</style></head><body><div class="mdl-grid">')
        out = [head]
        ko_ampm = lambda h: ("오전" if h < 12 else "오후", 12 if h % 12 == 0 else h % 12)
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        for i, it in enumerate(items):
            t = dt.datetime.strptime(it["time"][:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=UTC)
            # 대부분 한국 시간으로, 일부는 UTC 로 적어 시간대 변환도 시험한다
            if i % 23 == 7:
                lt, tz = t, "UTC"
            else:
                lt, tz = t.astimezone(dt.timezone(dt.timedelta(hours=9))), "KST"
            if lang == "ko":
                ap, hh = ko_ampm(lt.hour)
                dline = f"{lt.year}. {lt.month}. {lt.day}. {ap} {hh}:{lt.minute:02d}:{lt.second:02d} {tz}"
            else:
                ap = "AM" if lt.hour < 12 else "PM"
                hh = 12 if lt.hour % 12 == 0 else lt.hour % 12
                sep = "\u202f" if i % 2 else " "
                dline = f"{months[lt.month - 1]} {lt.day}, {lt.year}, {hh}:{lt.minute:02d}:{lt.second:02d}{sep}{ap} {tz}"
            title = it["title"]
            if kind == "watch":
                name = title.replace("을(를) 시청했습니다.", "").replace("Watched ", "")
                link = f'<a href="{it.get("titleUrl", "")}">{H.escape(name)}</a>'
                body = (f"{link}을(를) 시청했습니다.<br>" if lang == "ko" else f"Watched&nbsp;{link}<br>")
                if it.get("subtitles"):
                    body += f'<a href="{it["subtitles"][0]["url"]}">{H.escape(it["subtitles"][0]["name"])}</a><br>'
            else:
                q = title.replace("을(를) 검색했습니다.", "").replace("Searched for ", "")
                link = f'<a href="{it.get("titleUrl", "")}">{H.escape(q)}</a>'
                body = (f"{link}을(를) 검색했습니다.<br>" if lang == "ko" else f"Searched for&nbsp;{link}<br>")
            body += dline + "<br>"
            prod = "제품:" if lang == "ko" else "Products:"
            cap = f"<b>{prod}</b><br>&emsp;YouTube<br>"
            if it.get("details"):
                cap += f'<b>{"세부정보:" if lang == "ko" else "Details:"}</b><br>&emsp;{it["details"][0]["name"]}<br>'
            out.append('<div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"><div class="mdl-grid">'
                       '<div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">YouTube<br></p></div>'
                       f'<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">{body}</div>'
                       '<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right"></div>'
                       f'<div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption">{cap}</div></div></div>')
            if kind == "watch" and i % 97 == 13:
                sq = "설문조사 질문에 답변함" if lang == "ko" else "Answered survey question"
                out.append('<div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"><div class="mdl-grid">'
                           f'<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">{sq}<br>{dline}<br></div>'
                           '<div class="content-cell mdl-cell mdl-cell--12-col mdl-typography--caption"></div></div></div>')
        out.append("</div></body></html>")
        return "".join(out)

    def _fit_entries(self, lang: str) -> list[tuple[str, bytes]]:
        """구글 피트니스 Takeout: 일일 활동 측정항목 합계 CSV(걸음수) + 모든 세션 JSON(수면). 한국어 판 경로·머리글은 추정."""
        if lang == "ko":
            root, dname, sname = "Takeout/피트니스/", "일일 활동 측정항목", "모든 세션"
            head = ["날짜", "이동 시간(분)", "칼로리(kcal)", "거리(m)", "걸음 수"]
        else:
            root, dname, sname = "Takeout/Fit/", "Daily activity metrics", "All Sessions"
            head = ["Date", "Move Minutes count", "Calories (kcal)", "Distance (m)", "Heart Points", "Step count"]
        per_day: dict[dt.date, int] = {}
        for (d, _src), items in self.steps_src.items():
            per_day[d] = max(per_day.get(d, 0), sum(v for _, _, v in items))
        rows = [",".join(head)]
        for d in sorted(per_day):
            v = per_day[d]
            vals = [d.isoformat(), str(v // 110), f"{v * 0.04:.1f}", f"{v * 0.7:.1f}"]
            if lang != "ko":
                vals.append(str(v // 400))
            vals.append(str(v))
            rows.append(",".join(vals))
        out = [(f"{root}{dname}/{dname}.csv", ("\n".join(rows) + "\n").encode())]
        # 날짜별 15분 단위 파일도 하나 넣는다(합계 파일만 읽어야 함)
        if per_day:
            d0 = sorted(per_day)[0]
            out.append((f"{root}{dname}/{d0.isoformat()}.csv", (",".join(["Start time", "End time", "Step count"]) + "\n").encode()))
        for src, segs in self.sleep_src.items():
            for s, e, _v in segs:
                su, eu = local_to_utc(s), local_to_utc(e)
                obj = {"fitnessActivity": "sleep", "startTime": su.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                       "endTime": eu.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
                       "duration": f"{int((eu - su).total_seconds())}s", "segment": []}
                fname = f"{s:%Y-%m-%dT%H_%M_%S}+09_00_SLEEP.json"
                out.append((f"{root}{sname}/{fname}", json.dumps(obj).encode()))
        # 수면이 아닌 세션도 하나(세지 않음)
        out.append((f"{root}{sname}/2024-01-01T10_00_00+09_00_WALKING.json",
                    json.dumps({"fitnessActivity": "walking", "startTime": "2024-01-01T01:00:00.000Z", "endTime": "2024-01-01T01:30:00.000Z"}).encode()))
        return out

    def _write_takeout(self, parts):
        stamp = f"{self.export_utc:%Y%m%dT%H%M%S}Z"
        self.takeout_zips = []
        for k in sorted(parts):
            zname = f"takeout-{stamp}-{k:03d}.zip"
            with zipfile.ZipFile(self.exp / zname, "w", zipfile.ZIP_DEFLATED) as z:
                for path, data in parts[k]:
                    z.writestr(nfc(path), data)
            self.takeout_zips.append(zname)
            for idx, p in enumerate(self.photos):
                if p.get("zip_entry") and any(p["zip_entry"] == nfc(x[0]) for x in parts[k] if x[0] == p["zip_entry"]):
                    self.photo_paths[idx] = f"{zname}::{nfc(p['zip_entry'])}"

    # 건강 ---------------------------------------------------------------------
    def _write_apple_health(self):
        out = io.StringIO()
        exp_local = self.export_local
        out.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        out.write('<!DOCTYPE HealthData [\n<!ELEMENT HealthData (ExportDate,Me,(Record|Workout)*)>\n'
                  '<!ATTLIST ExportDate value CDATA #REQUIRED>\n]>\n')
        out.write('<HealthData locale="ko_KR">\n')
        out.write(f' <ExportDate value="{exp_local:%Y-%m-%d %H:%M:%S} +0900"/>\n')
        out.write(' <Me HKCharacteristicTypeIdentifierDateOfBirth="" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet"/>\n')

        def fmt(t):
            return f"{t:%Y-%m-%d %H:%M:%S} +0900"

        recs = []
        for (d, src), items in self.steps_src.items():
            dev = "iPhone" if src == "iPhone" else "Watch"
            for s, e, v in items:
                recs.append((s, f' <Record type="HKQuantityTypeIdentifierStepCount" sourceName="{src}" sourceVersion="16.1" '
                                f'device="&lt;&lt;HKDevice&gt;, name:{dev}&gt;" unit="count" creationDate="{fmt(e)}" '
                                f'startDate="{fmt(s)}" endDate="{fmt(e)}" value="{v}"/>\n'))
        for src, segs in self.sleep_src.items():
            for s, e, v in segs:
                recs.append((s, f' <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="{src}" sourceVersion="9.0" '
                                f'creationDate="{fmt(e)}" startDate="{fmt(s)}" endDate="{fmt(e)}" value="{v}"/>\n'))
        # 세지 않는 다른 기록(심박)도 조금 섞는다
        for (d, src), items in self.steps_src.items():
            for s, _e, _v in items[::2]:
                recs.append((s, f' <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="{src}" unit="count/min" '
                                f'creationDate="{fmt(s)}" startDate="{fmt(s)}" endDate="{fmt(s)}" value="{self.rng.randint(55, 110)}"/>\n'))
        recs.sort(key=lambda x: x[0])
        for _, line in recs:
            out.write(line)
        out.write('</HealthData>\n')
        with zipfile.ZipFile(self.exp / "export.zip", "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("apple_health_export/export.xml", out.getvalue())
            z.writestr("apple_health_export/export_cda.xml", '<?xml version="1.0"?><ClinicalDocument/>')

    def _write_samsung_health(self):
        stamp = f"{self.export_local:%Y%m%d%H%M%S}"
        folder = self.exp / f"samsunghealth_{self.key}_{stamp}"
        folder.mkdir()
        cols = ["create_sh_ver", "step_count", "binning_data", "active_time", "recommendation", "run_step_count",
                "update_time", "source_package_name", "create_time", "source_info", "speed", "distance", "calorie",
                "walk_step_count", "deviceuuid", "day_time", "pkg_name", "datauuid"]
        rows = []
        for (d, src), items in sorted(self.steps_src.items()):
            total = sum(v for _, _, v in items)
            day_ms = int(dt.datetime(d.year, d.month, d.day, tzinfo=UTC).timestamp() * 1000)
            uuid = "Ph0neUUID1" if src == "phone" else "W4tchUUID2"
            info = '"{""a"":1,""b"":2}"'
            rows.append([ "6315005", str(total), "", str(total * 600), "6000", "0",
                          f"{d} 23:59:00.000", "com.sec.android.app.shealth", f"{d} 23:59:00.000", info,
                          "1.3", f"{total * 0.7:.1f}", f"{total * 0.04:.2f}", str(total), uuid, str(day_ms),
                          "com.sec.android.app.shealth", f"uuid-{d}-{src}"])
        with open(folder / f"com.samsung.shealth.tracker.pedometer_day_summary.{stamp}.csv", "w", encoding="utf-8") as f:
            f.write(f"com.samsung.shealth.tracker.pedometer_day_summary,6315005,{len(rows)}\n")
            f.write(",".join(cols) + ",\n")
            for r in rows:
                f.write(",".join(r) + ",\n")
        pre = "com.samsung.health.sleep."
        scols = ["original_efficiency", "mental_recovery", "factor_01", pre + "start_time", pre + "end_time",
                 pre + "time_offset", pre + "comment", pre + "custom", pre + "datauuid", pre + "deviceuuid"]
        srows = []
        for src, segs in self.sleep_src.items():
            for s, e, v in segs:
                su = local_to_utc(s)
                eu = local_to_utc(e)
                srows.append(["90", "", "", f"{su:%Y-%m-%d %H:%M:%S}.000", f"{eu:%Y-%m-%d %H:%M:%S}.000", "UTC+0900",
                              "", "", f"sl-{s:%Y%m%d%H%M}", "W4tchUUID2"])
        # 같은 시작·끝 행을 가끔 한 번 더 넣는다(한 번만 세야 함)
        dups = [r for i, r in enumerate(srows) if i % 37 == 5]
        srows += dups
        srows.sort(key=lambda r: r[3])
        with open(folder / f"com.samsung.health.sleep.{stamp}.csv", "w", encoding="utf-8") as f:
            f.write(f"com.samsung.health.sleep,6315001,{len(srows)}\n")
            f.write(",".join(scols) + ",\n")
            for r in srows:
                f.write(",".join(r) + ",\n")
        with open(folder / f"com.samsung.health.sleep_stage.{stamp}.csv", "w", encoding="utf-8") as f:
            f.write("com.samsung.health.sleep_stage,6315001,0\nstart_time,end_time,stage,\n")
        self.samsung_folder = folder.name

    # 카카오톡 ------------------------------------------------------------------
    def _write_kakao(self):
        if not self.kakao:
            return
        fmt = self.cfg["kakao_format"]
        kdir = self.exp / "kakao"
        kdir.mkdir()
        el = self.export_local
        for room, msgs in self.kakao.items():
            msgs.sort(key=lambda m: m["dt"])
            L = [f"{room} 님과 카카오톡 대화"]
            if fmt == "pc":
                L.append(f"저장한 날짜 : {el:%Y-%m-%d %H:%M:%S}")
            elif fmt == "android":
                L.append(f"저장한 날짜 : {el.year}년 {el.month}월 {el.day}일 {ampm(el)}")
            else:
                L.append(f"저장한 날짜 : {el.year}. {el.month}. {el.day}. {ampm(el)}")
            L.append("")
            last_day = None
            for m in msgs:
                t = m["dt"]
                if t.date() != last_day:
                    last_day = t.date()
                    if fmt == "pc":
                        L.append(f"--------------- {t.year}년 {t.month}월 {t.day}일 {WEEKDAY_KO[t.weekday()]} ---------------")
                    else:
                        L.append(f"{t.year}년 {t.month}월 {t.day}일 {WEEKDAY_KO[t.weekday()]}")
                lines = m["text"].split("\n")
                if m["sender"] is None:
                    if fmt == "android":
                        L.append(f"{t.year}년 {t.month}월 {t.day}일 {ampm(t)}, {lines[0]}")
                    else:
                        L.append(f"{t.year}. {t.month}. {t.day}. {ampm(t)}, {lines[0]}")
                    continue
                if fmt == "pc":
                    head = f"[{m['sender']}] [{ampm(t)}] {lines[0]}"
                elif fmt == "android":
                    head = f"{t.year}년 {t.month}월 {t.day}일 {ampm(t)}, {m['sender']} : {lines[0]}"
                else:
                    head = f"{t.year}. {t.month}. {t.day}. {ampm(t)}, {m['sender']} : {lines[0]}"
                L.append(head)
                L.extend(lines[1:])
            name = f"KakaoTalk_Chat_{room}_{el:%Y-%m-%d-%H-%M-%S}.txt" if fmt == "pc" else f"KakaoTalk_{el:%Y%m%d_%H%M}_{room}.txt"
            (kdir / nfc(name)).write_text("\n".join(L) + "\n", encoding="utf-8")

    # 사진 ---------------------------------------------------------------------
    def _write_instagram(self):
        """인스타그램 내 정보 다운로드(JSON). 한글은 인스타그램처럼 UTF-8 바이트를 한 글자씩(\\u00XX) 적는다."""
        if not getattr(self, "ig_posts", None) and not getattr(self, "ig_threads", None):
            return
        mg = lambda x: x.encode("utf-8").decode("latin-1")
        ts = lambda t: int(local_to_utc(t).timestamp())
        user = f"doyun_{self.key}"
        root = "your_instagram_activity/"
        posts = [p for p in self.ig_posts if p["kind"] == "post"]
        stories = [p for p in self.ig_posts if p["kind"] == "story"]
        reels = [p for p in self.ig_posts if p["kind"] == "reel"]
        files = {
            root + "content/posts_1.json": [{"media": [{"uri": f"media/posts/{p['dt']:%Y%m}/{i}.jpg", "creation_timestamp": ts(p["dt"]),
                                                          "title": mg(p["caption"])}]} for i, p in enumerate(posts)],
            root + "content/stories.json": {"ig_stories": [{"uri": f"media/stories/{p['dt']:%Y%m}/{i}.jpg", "creation_timestamp": ts(p["dt"]),
                                                            "title": ""} for i, p in enumerate(stories)]},
            root + "content/reels.json": {"ig_reels_media": [{"media": [{"uri": f"media/reels/{p['dt']:%Y%m}/{i}.mp4",
                                                                        "creation_timestamp": ts(p["dt"]), "title": mg(p["caption"])}]}
                                                           for i, p in enumerate(reels)]},
            "personal_information/personal_information/personal_information.json":
                {"profile_user": [{"string_map_data": {"Name": {"value": mg(self.name)}, "Username": {"value": user}}}]},
        }
        for k, (other, msgs) in enumerate(sorted(self.ig_threads.items())):
            msgs = sorted(msgs, key=lambda m: m["dt"], reverse=True)
            files[root + f"messages/inbox/thread{k}_{1000 + k}/message_1.json"] = {
                "participants": [{"name": mg(other)}, {"name": mg(self.name)}],
                "messages": [{"sender_name": mg(m["sender"]), "timestamp_ms": ts(m["dt"]) * 1000, "content": mg(m["text"])} for m in msgs],
                "title": mg(other), "is_still_participant": True}
        with zipfile.ZipFile(self.exp / f"instagram-{user}-{self.export_local:%Y-%m-%d}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for path, obj in files.items():
                z.writestr(path, json.dumps(obj, ensure_ascii=True, indent=1))
            # 올린 사진 파일(사진 채널에 넣으면 안 됨)
            cache = self._img_cache()
            for i, p in enumerate(posts[:2]):
                z.writestr(f"media/posts/{p['dt']:%Y%m}/{i}.jpg", self._png_bytes(cache))

    def _write_ai(self):
        """AI 대화 내보내기: ChatGPT(conversations.json, mapping 나무) 또는 Claude(conversations.json, chat_messages)."""
        convs = getattr(self, "ai_convs", None)
        if not convs:
            return
        utc = lambda t: local_to_utc(t)
        if self.cfg["ai_app"] == "chatgpt":
            out = []
            for i, cv in enumerate(convs):
                root_id = f"root-{i}"
                mapping = {root_id: {"id": root_id, "message": None, "parent": None, "children": []}}
                sys_id = f"sys-{i}"
                mapping[sys_id] = {"id": sys_id, "parent": root_id, "children": [],
                                   "message": {"id": sys_id, "author": {"role": "system"}, "create_time": None,
                                               "content": {"content_type": "text", "parts": [""]},
                                               "metadata": {"is_visually_hidden_from_conversation": True}}}
                mapping[root_id]["children"].append(sys_id)
                prev = sys_id
                for k, m in enumerate(cv["msgs"]):
                    mid = f"m-{i}-{k}"
                    frac = self.rng.random() if False else (k * 0.137) % 1
                    mapping[mid] = {"id": mid, "parent": prev, "children": [],
                                    "message": {"id": mid, "author": {"role": m["role"]}, "create_time": utc(m["dt"]).timestamp() + frac * 0.9,
                                                "content": {"content_type": "text", "parts": [m["text"]]}, "metadata": {}}}
                    mapping[prev]["children"].append(mid)
                    prev = mid
                out.append({"title": cv["title"], "create_time": utc(cv["start"]).timestamp(), "update_time": utc(cv["msgs"][-1]["dt"]).timestamp(),
                            "mapping": mapping, "current_node": prev, "conversation_id": f"conv-{i}"})
            with zipfile.ZipFile(self.exp / f"chatgpt-export-{self.export_local:%Y%m%d}.zip", "w", zipfile.ZIP_DEFLATED) as z:
                z.writestr("conversations.json", json.dumps(out, ensure_ascii=False))
                z.writestr("chat.html", "<html><body>chat</body></html>")
                z.writestr("user.json", json.dumps({"id": "user-sample"}))
        else:
            out = []
            for i, cv in enumerate(convs):
                iso = lambda t: utc(t).strftime("%Y-%m-%dT%H:%M:%S.000000Z")
                out.append({"uuid": f"c-{i}", "name": cv["title"], "created_at": iso(cv["start"]), "updated_at": iso(cv["msgs"][-1]["dt"]),
                            "chat_messages": [{"uuid": f"c-{i}-{k}", "sender": "human" if m["role"] == "user" else "assistant",
                                               "created_at": iso(m["dt"]), "text": m["text"] if k % 3 else "",
                                               "content": [{"type": "text", "text": m["text"]}]} for k, m in enumerate(cv["msgs"])]})
            with zipfile.ZipFile(self.exp / f"data-{self.export_local:%Y-%m-%d}-claude.zip", "w", zipfile.ZIP_DEFLATED) as z:
                z.writestr("conversations.json", json.dumps(out, ensure_ascii=False))
                z.writestr("users.json", json.dumps([{"uuid": "u-sample"}]))
                z.writestr("projects.json", "[]")

    def _img_cache(self):
        if hasattr(self, "_imgs"):
            return self._imgs
        rng = self.rng
        imgs = []
        for i in range(40):
            im = Image.new("RGB", (96, 72), (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255)))
            px = im.load()
            c2 = (rng.randint(0, 255), rng.randint(0, 255), rng.randint(0, 255))
            for x in range(96):
                for y in range(36, 72):
                    if (x + y) % 3 == 0:
                        px[x, y] = c2
            b = io.BytesIO()
            im.save(b, "JPEG", quality=70)
            imgs.append(b.getvalue())
        pngs = []
        for i in range(6):
            im = Image.new("RGB", (64, 128), (240, 240, 240))
            b = io.BytesIO()
            im.save(b, "PNG")
            pngs.append(b.getvalue())
        self._imgs = (imgs, pngs)
        return self._imgs

    def _jpeg_bytes(self, cache, p, t):
        imgs, _ = cache
        base = self.rng.choice(imgs)
        if not p["exif"]:
            return base
        make, model = self._make_for(t.date())
        stamp = t.strftime("%Y:%m:%d %H:%M:%S").encode()
        exif = {"0th": {piexif.ImageIFD.Make: make.encode(), piexif.ImageIFD.Model: model.encode(),
                        piexif.ImageIFD.DateTime: stamp},
                "Exif": {piexif.ExifIFD.DateTimeOriginal: stamp, piexif.ExifIFD.DateTimeDigitized: stamp},
                "GPS": {}, "1st": {}, "thumbnail": None}
        out = io.BytesIO()
        piexif.insert(piexif.dump(exif), base, out)
        return out.getvalue()

    def _png_bytes(self, cache):
        return self.rng.choice(cache[1])

    def _make_for(self, d):
        cur = self.cfg["makes"][0]
        for m in self.cfg["makes"]:
            if d >= m[0]:
                cur = m
        return cur[1], cur[2]

    def _write_photo_folder(self):
        cache = self._img_cache()
        root = self.exp / "photos"
        n = 0
        seq = 1000
        for idx, p in enumerate(self.photos):
            if p["source"] != "folder":
                continue
            t = p["dt"]
            sub = root / "DCIM" / str(t.year)
            sub.mkdir(parents=True, exist_ok=True)
            if p["kind"] == "screenshot":
                fname = (f"Screenshot_{t:%Y%m%d-%H%M%S}.png" if idx % 2 else
                         f"스크린샷 {t:%Y-%m-%d} {'오전' if t.hour < 12 else '오후'} {(t.hour % 12) or 12}.{t:%M.%S}.png")
                data = self._png_bytes(cache)
            elif p["name_date"]:
                fname = f"IMG_{t:%Y%m%d_%H%M%S}.jpg"
                data = self._jpeg_bytes(cache, p, t)
            else:
                seq += 1
                fname = f"IMG_{seq:04d}.JPG"
                data = self._jpeg_bytes(cache, p, t)
            fname = nfc(fname)
            k = 1
            while (sub / fname).exists():
                stem, ext = fname.rsplit(".", 1)
                fname = f"{stem}_{k}.{ext}"
                k += 1
            (sub / fname).write_bytes(data)
            self.photo_paths[idx] = f"photos/DCIM/{t.year}/{fname}"
            n += 1
        # 날짜를 알 수 없는 사진(색인하지 않음)
        misc = root / "misc"
        misc.mkdir(parents=True, exist_ok=True)
        for i in range(5):
            (misc / f"photo_{i:02d}.jpg").write_bytes(cache[0][i])
        return n

    # -----------------------------------------------------------------------
    # 정답 표
    # -----------------------------------------------------------------------
    def truth(self):
        rows: dict[str, dict] = defaultdict(dict)
        chan: dict[str, dict] = {}

        def add(date, key, v=1):
            r = rows[date]
            r[key] = r.get(key, 0) + v

        def touch(channel, date, source, n=1):
            c = chan.setdefault(channel, dict(first=date, last=date, sources=set(), records=0))
            c["first"] = min(c["first"], date)
            c["last"] = max(c["last"], date)
            c["sources"].add(source)
            c["records"] += n

        memos_out = []
        for i, m in enumerate(self.memos):
            if m["trashed"]:
                continue
            text = m["text"].strip()
            if not text and not m["title"]:
                continue
            t = m["dt"]
            date = t.date().isoformat()
            add(date, "memo_n")
            add(date, "memo_chars", chars(text))
            if is_night(t.hour):
                add(date, "memo_night_n")
            touch("memo", date, "keep")
            memos_out.append(dict(id=self.memo_ids[i], ts=t.strftime("%Y-%m-%dT%H:%M"), date=date, hour=t.hour,
                                  title=m["title"], text=text, chars=chars(text), flags=m["flags"]))

        photos_out = []
        for idx, p in enumerate(self.photos):
            path = self.photo_paths.get(idx)
            if not path:
                continue
            t = p["dt"]
            date = t.date().isoformat()
            shot = p["kind"] == "screenshot"
            photos_out.append(dict(path=path, date=date, hour=t.hour, screenshot=shot, counted=not shot,
                                   source=p["source"], exif=p["exif"]))
            if shot:
                continue
            add(date, "photo_n")
            if is_night(t.hour):
                add(date, "photo_night_n")
            touch("photo", date, "takeout-photos" if p["source"] == "takeout" else "folder")

        for w in self.yt_watch:
            if w["ad"]:
                continue
            t = w["dt"]
            date = t.date().isoformat()
            add(date, "yt_watch_n")
            if is_night(t.hour):
                add(date, "yt_watch_night_n")
            touch("yt", date, "takeout-youtube")
        for s in self.yt_search:
            date = s["dt"].date().isoformat()
            add(date, "yt_search_n")
            touch("yt", date, "takeout-youtube")

        for cal in ("personal", "work"):
            evs = [e for e in self.cal_events if e["cal"] == cal]
            if not evs:
                continue
            nonrec = [e["dt"].date() for e in evs if not e.get("rrule")]
            bound = max(nonrec) if nonrec else None
            for e in evs:
                if e["cancelled"]:
                    continue
                occ = [e["dt"]]
                rr = e.get("rrule")
                if rr:
                    occ = []
                    k = 0
                    ex = set(e.get("exdate", []))
                    while True:
                        t = e["dt"] + dt.timedelta(days=7 * k)
                        k += 1
                        if "count" in rr and k > rr["count"]:
                            break
                        if "until" in rr and t > rr["until"]:
                            break
                        if rr.get("infinite") and (bound is None or t.date() > bound):
                            break
                        if t in ex:
                            continue
                        occ.append(t)
                for t in occ:
                    date = t.date().isoformat()
                    add(date, "cal_n")
                    touch("cal", date, "ics")

        # 카카오톡: 나 = 인물 이름
        me = self.name
        src = {"pc": "kakao-pc", "android": "kakao-android", "ios": "kakao-ios"}[self.cfg["kakao_format"]]
        for room, msgs in self.kakao.items():
            prev = None
            for m in sorted(msgs, key=lambda x: x["dt"]):
                if m["sender"] is None:
                    continue
                t = m["dt"]
                if m["sender"] == me:
                    date = t.date().isoformat()
                    add(date, "kakao_n")
                    add(date, "kakao_chars", chars(m["text"]))
                    if is_night(t.hour):
                        add(date, "kakao_night_n")
                    if is_first_person(m["text"]):
                        add(date, "kakao_first_n")
                    if is_assertive(m["text"]):
                        add(date, "kakao_assert_n")
                    if prev is not None and prev["sender"] != me:
                        delay = int((t - prev["dt"]).total_seconds() // 60)
                        delay = max(0, min(REPLY_CAP_MIN, delay))
                        add(date, "kakao_reply_n")
                        add(date, "kakao_reply_min_sum", delay)
                    touch("kakao", date, src)
                prev = m

        # 인스타그램: 게시·스토리·릴스, 내가 보낸 DM
        for p in getattr(self, "ig_posts", []):
            date = p["dt"].date().isoformat()
            add(date, "sns_post_n")
            touch("sns", date, "instagram")
        for _other, msgs in getattr(self, "ig_threads", {}).items():
            for m in msgs:
                if m["sender"] != self.name:
                    continue
                date = m["dt"].date().isoformat()
                add(date, "sns_dm_n")
                if is_night(m["dt"].hour):
                    add(date, "sns_dm_night_n")
                touch("sns", date, "instagram")
        # AI 대화: 내가 보낸 메시지
        for conv in getattr(self, "ai_convs", []):
            for m in conv["msgs"]:
                if m["role"] != "user":
                    continue
                date = m["dt"].date().isoformat()
                add(date, "ai_msg_n")
                if is_night(m["dt"].hour):
                    add(date, "ai_msg_night_n")
                add(date, "ai_chars", chars(m["text"]))
                touch("ai", date, self.cfg["ai_app"])

        # 건강: 출처별 합 → 가장 큰 값
        steps_day: dict[str, dict[str, int]] = defaultdict(dict)
        for (d, s), items in self.steps_src.items():
            steps_day[d.isoformat()][s] = sum(v for _, _, v in items)
        sleep_day: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
        hsrc = {"apple": "apple-health", "samsung": "samsung-health", "fit": "google-fit"}[self.cfg["health"]]
        for s, segs in self.sleep_src.items():
            asleep = sorted({(a, b) for a, b, v in segs
                             if self.cfg["health"] != "apple" or v in SLEEP_ASLEEP_VALUES})
            for end, minutes in sleep_sessions(asleep):
                sleep_day[end.date().isoformat()][s] += minutes
        health_days = set()
        for date, per in steps_day.items():
            rows[date]["steps"] = int(round(max(per.values())))
            health_days.add(date)
        for date, per in sleep_day.items():
            rows[date]["sleep_min"] = int(round(max(per.values())))
            health_days.add(date)
        if health_days:
            chan["health"] = dict(first=min(health_days), last=max(health_days), sources={hsrc}, records=len(health_days))

        daily = []
        for date in sorted(rows):
            r = {"date": date}
            for k, v in sorted(rows[date].items()):
                if k in ("steps", "sleep_min"):
                    r[k] = v
                elif k == "kakao_reply_min_sum":
                    if rows[date].get("kakao_reply_n"):
                        r[k] = v
                elif v:
                    r[k] = v
            if len(r) > 1:
                daily.append(r)

        meta = dict(tz="Asia/Seoul", night_hours=[0, 5], export_date=self.export_local.date().isoformat(),
                    channels={k: dict(first=v["first"], last=v["last"], sources=sorted(v["sources"]), records=v["records"])
                              for k, v in sorted(chan.items())})
        return daily, meta, memos_out, photos_out

    def structural_gaps(self):
        ch = self.cfg["channels"]
        gaps = {}
        for name, ranges in ch.items():
            g = []
            for (a1, b1), (a2, b2) in zip(ranges, ranges[1:]):
                g.append([(b1 + dt.timedelta(days=1)).isoformat(), (a2 - dt.timedelta(days=1)).isoformat()])
            if name == "health":
                g += [[a.isoformat(), b.isoformat()] for a, b in self.cfg["health_gaps"]]
            if g:
                gaps[name] = g
        return gaps

    def run(self):
        self.place_events()
        self.simulate()
        self.simulate_extra()
        self.write_exports()
        daily, meta, memos, photos = self.truth()
        dump(self.out / "truth_daily.json", daily)
        dump(self.out / "truth_meta.json", meta)
        dump(self.out / "memos.json", memos)
        dump(self.out / "photos.json", photos)
        dump(self.out / "events.json", dict(
            persona=self.key, name=self.name, start=self.start.isoformat(), end=self.end.isoformat(),
            export_date=meta["export_date"], kakao_me=self.name,
            channel_ranges={k: [[a.isoformat(), b.isoformat()] for a, b in v] for k, v in self.cfg["channels"].items()},
            structural_gaps=self.structural_gaps(), events=self.events,
            note="effects 의 지표 이름은 판정 코어 지표 id(steps, sleep, memo_n, memo_len, memo_night, photo_n, yt_watch, "
                 "yt_night, yt_search, cal_n, kakao_n, kakao_night, kakao_delay, kakao_first, kakao_assert) 기준"))
        size = sum(f.stat().st_size for f in self.out.rglob("*") if f.is_file())
        print(f"{self.key}: days={len(daily)} memos={len(memos)} photos={len(photos)} yt={len(self.yt_watch)} "
              f"cal={len(self.cal_events)} kakao_rooms={len(self.kakao)} events={len(self.events)} size={size / 1e6:.1f}MB")


def sleep_sessions(segs):
    """잠 구간을 한 번의 잠(세션)으로 묶는다. 앞 세션 끝에서 90분 넘게 떨어진 구간은 새 세션.

    돌려주는 값: [(세션 끝 시각, 잠든 분 합)]. 세션 날짜 = 끝 시각의 현지 날짜(깬 날짜).
    """
    out = []
    cur_end = None
    total = 0.0
    for a, b in sorted(segs):
        if cur_end is not None and (a - cur_end).total_seconds() / 60 > 90:
            out.append((cur_end, total))
            cur_end, total = None, 0.0
        cur_end = b if cur_end is None else max(cur_end, b)
        total += (b - a).total_seconds() / 60
    if cur_end is not None:
        out.append((cur_end, total))
    return out


def ampm(t: dt.datetime) -> str:
    h = t.hour
    ap = "오전" if h < 12 else "오후"
    h12 = h % 12
    if h12 == 0:
        h12 = 12
    return f"{ap} {h12}:{t.minute:02d}"


def dump(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("personas", nargs="*", default=list(PERSONAS))
    args = ap.parse_args()
    for k in args.personas:
        Persona(k).run()


if __name__ == "__main__":
    main()
