# -*- coding: utf-8 -*-
"""
카카오톡 대화 내보내기 파서 — .txt(기기별 3종) + .csv 모두 지원.

기존 kakao_csv_parser.py는 CSV만 받았는데, 실제 팀원이 내보내면
대부분 .txt가 나옵니다. 기기·OS마다 줄 형식이 달라서 세 가지를 모두 봅니다.

  A) 윈도우 PC   : 날짜 구분선 + [이름] [오전 10:53] 메시지
  B) 안드로이드·맥: 2026년 4월 20일 오전 10:53, 이름 : 메시지
  C) iOS        : 2026. 4. 20. 오전 10:53, 이름 : 메시지

여러 줄 메시지는 다음 줄들을 앞 메시지에 붙입니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
import os
import re
from datetime import datetime
from dataclasses import dataclass


@dataclass
class Message:
    dt: datetime
    sender: str
    text: str


SYSTEM_PATTERNS = [
    '님이 나갔습니다', '님을 초대했습니다', '님이 들어왔습니다',
    '채팅방 관리자가', '님이 방장이 되었습니다', '삭제된 메시지입니다',
    '운영정책 위반', '저장한 날짜', '님과 카카오톡 대화',
]
ATTACHMENT_MARKERS = ['사진', '동영상', '이모티콘', '보이스톡', '페이스톡',
                      '음성메시지', '지도', '연락처']


def is_system_message(text: str) -> bool:
    return any(p in text for p in SYSTEM_PATTERNS)


def is_attachment_only(text: str) -> bool:
    t = text.strip()
    if t in ATTACHMENT_MARKERS:
        return True
    if t.startswith('파일: ') or t.startswith('샵검색: '):
        return True
    if re.fullmatch(r'사진 \d+장', t):
        return True
    return False


def _h24(mer: str, h: int) -> int:
    if mer in ('오후', 'PM') and h != 12:
        return h + 12
    if mer in ('오전', 'AM') and h == 12:
        return 0
    return h


# ── A) 윈도우 PC ────────────────────────────────────────────
RE_A_DATE = re.compile(r'^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일.*-+\s*$')
RE_A_MSG = re.compile(r'^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$')

# ── B) 안드로이드·맥 ────────────────────────────────────────
RE_B = re.compile(
    r'^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s?(.*)$')

# ── C) iOS ──────────────────────────────────────────────────
RE_C = re.compile(
    r'^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s?(.*)$')

# 영어 UI
RE_EN = re.compile(
    r'^(\w{3,9}) (\d{1,2}), (\d{4}) at (\d{1,2}):(\d{2})\s*(AM|PM), (.+?) : (.*)$')
_EN_MONTH = {m: i + 1 for i, m in enumerate(
    ['January', 'February', 'March', 'April', 'May', 'June', 'July',
     'August', 'September', 'October', 'November', 'December'])}


def parse_kakao_txt(path: str) -> list[Message]:
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.read().split('\n')

    msgs: list[Message] = []
    cur_date = None

    for raw in lines:
        line = raw.rstrip('\r')
        if not line.strip():
            continue

        m = RE_A_DATE.match(line.strip())
        if m:
            y, mo, d = map(int, m.groups())
            cur_date = (y, mo, d)
            continue

        hit = None
        m = RE_A_MSG.match(line)
        if m and cur_date:
            sender, mer, h, mi, text = m.groups()
            y, mo, d = cur_date
            hit = (y, mo, d, mer, int(h), int(mi), sender, text)

        if hit is None:
            for rx in (RE_B, RE_C):
                m = rx.match(line)
                if m:
                    y, mo, d, mer, h, mi, sender, text = m.groups()
                    hit = (int(y), int(mo), int(d), mer, int(h), int(mi), sender, text)
                    break

        if hit is None:
            m = RE_EN.match(line)
            if m:
                mon, d, y, h, mi, mer, sender, text = m.groups()
                if mon in _EN_MONTH:
                    hit = (int(y), _EN_MONTH[mon], int(d), mer, int(h), int(mi), sender, text)

        if hit is None:
            # 앞 메시지의 여러 줄째 이어붙임
            if msgs:
                msgs[-1].text += '\n' + line
            continue

        y, mo, d, mer, h, mi, sender, text = hit
        try:
            dt = datetime(y, mo, d, _h24(mer, h), mi)
        except ValueError:
            continue
        msgs.append(Message(dt, sender.strip(), text))

    return [m for m in msgs if not is_system_message(m.text)]


def parse_kakao_csv(path: str) -> list[Message]:
    msgs = []
    with open(path, 'r', encoding='utf-8-sig', errors='ignore', newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_str = (row.get('Date') or row.get('date') or '').strip()
            sender = (row.get('User') or row.get('user') or '').strip()
            text = (row.get('Message') or row.get('message') or '').strip()
            if not date_str or not sender:
                continue
            dt = None
            for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
                try:
                    dt = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
            if dt is None or is_system_message(text):
                continue
            msgs.append(Message(dt, sender, text))
    return msgs


def parse_kakao(path: str) -> list[Message]:
    if path.lower().endswith('.csv'):
        return parse_kakao_csv(path)
    return parse_kakao_txt(path)


def list_senders(msgs: list[Message]) -> dict:
    counts = {}
    for m in msgs:
        counts[m.sender] = counts.get(m.sender, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: -x[1]))


def guess_my_name(msgs: list[Message], hint: str | None = None) -> str | None:
    """
    내 이름 찾기. hint가 있으면 완전 일치나 부분 일치로 먼저 찾고,
    없으면 2명 대화방에서 발신자 이름 중 걸 스스로 고르게 하는 건 None을 돌려준다.
    (호출 측에서 상호작용으로 알려주든 통계로 판단하든 넘기는 쪽)
    """
    senders = list_senders(msgs)
    if hint:
        for s in senders:
            if hint in s or s in hint:
                return s
    return None


def extract_my_messages(all_messages: list[Message], my_name: str) -> list[dict]:
    """내 메시지만. 상대방 메시지에는 답장 지연 계산에 필요한 정보를 남겨서 넘긴다."""
    my_msgs = []
    last_other_dt = None
    for msg in all_messages:
        if msg.sender == my_name:
            delay_sec = None
            if last_other_dt is not None:
                delay_sec = (msg.dt - last_other_dt).total_seconds()
                if delay_sec < 0 or delay_sec > 60 * 60 * 24 * 3:
                    delay_sec = None
            my_msgs.append({
                'dt': msg.dt, 'text': msg.text,
                'reply_delay_sec': delay_sec,
                'is_attachment': is_attachment_only(msg.text),
            })
            last_other_dt = None
        else:
            if last_other_dt is None:
                last_other_dt = msg.dt
    return my_msgs


def load_many(paths: list[str], my_name: str | None):
    """
    여러 대화방 파일을 한꺼번에. 이름을 못 알아내면 (None, 후보목록)을 돌려준다.
    """
    all_msgs, per_file = [], []
    for p in paths:
        try:
            m = parse_kakao(p)
        except Exception as e:                                     # noqa: BLE001
            per_file.append((os.path.basename(p), 0, f'읽기 실패: {e}'))
            continue
        per_file.append((os.path.basename(p), len(m), None))
        all_msgs += m

    all_msgs.sort(key=lambda m: m.dt)
    senders = list_senders(all_msgs)

    resolved = None
    if my_name:
        resolved = guess_my_name(all_msgs, my_name)
    return all_msgs, senders, resolved, per_file
