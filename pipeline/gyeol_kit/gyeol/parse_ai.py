# -*- coding: utf-8 -*-
"""
AI 대화 내보내기 파서 — Claude / ChatGPT / Gemini.

⚠ 이 채널은 카톡보다 한 단계 더 조심합니다 (팀 합의).
   · 탐지에만 씁니다. 원문은 저장하지도, 되돌려주지도 않습니다.
   · 여기서 뽑는 것은 "언제, 몇 번 말했는가" 뿐입니다. 내용은 즉시 버립니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import json
import os
import zipfile
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))


def _iso(s):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(str(s).replace('Z', '+00:00'))
        if dt.tzinfo is not None:
            dt = dt.astimezone(KST).replace(tzinfo=None)
        return dt
    except (ValueError, TypeError):
        return None


def _epoch(v):
    try:
        return datetime.fromtimestamp(float(v), KST).replace(tzinfo=None)
    except (ValueError, TypeError, OSError):
        return None


def parse_claude_conversations(data) -> list[datetime]:
    """claude.ai Export data → conversations.json"""
    out = []
    for conv in data if isinstance(data, list) else []:
        if not isinstance(conv, dict):
            continue
        for m in conv.get('chat_messages', []) or []:
            if not isinstance(m, dict):
                continue
            if m.get('sender') != 'human':          # 내 발화만
                continue
            dt = _iso(m.get('created_at'))
            if dt:
                out.append(dt)
        if not conv.get('chat_messages'):
            dt = _iso(conv.get('created_at'))
            if dt:
                out.append(dt)
    return out


def parse_chatgpt_conversations(data) -> list[datetime]:
    """ChatGPT 데이터 내보내기 → conversations.json (mapping 구조)"""
    out = []
    for conv in data if isinstance(data, list) else []:
        if not isinstance(conv, dict):
            continue
        for node in (conv.get('mapping') or {}).values():
            msg = (node or {}).get('message')
            if not isinstance(msg, dict):
                continue
            role = ((msg.get('author') or {}).get('role'))
            if role != 'user':                      # 내 발화만
                continue
            dt = _epoch(msg.get('create_time'))
            if dt:
                out.append(dt)
    return out


def _detect_and_parse(raw: str) -> tuple[list[datetime], str | None]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return [], None
    if not isinstance(data, list) or not data:
        return [], None
    head = data[0] if isinstance(data[0], dict) else {}
    if 'chat_messages' in head:
        return parse_claude_conversations(data), 'Claude'
    if 'mapping' in head:
        return parse_chatgpt_conversations(data), 'ChatGPT'
    return [], None


def load_ai_chats(paths) -> tuple[list[dict], dict]:
    """
    반환: (records[{dt, kind:'ai'}], info{vendor: n})
    """
    times, info = [], {}

    def feed(raw):
        ts, vendor = _detect_and_parse(raw)
        if ts:
            times.extend(ts)
            info[vendor] = info.get(vendor, 0) + len(ts)

    for p in paths:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for fn in files:
                    if fn.lower().endswith('.json') and 'conversation' in fn.lower():
                        try:
                            feed(open(os.path.join(root, fn), encoding='utf-8',
                                      errors='ignore').read())
                        except OSError:
                            pass
        elif p.lower().endswith('.zip'):
            try:
                z = zipfile.ZipFile(p)
            except zipfile.BadZipFile:
                continue
            for info_ in z.infolist():
                n = info_.filename.lower()
                if n.endswith('.json') and 'conversation' in os.path.basename(n):
                    try:
                        feed(z.read(info_).decode('utf-8', errors='ignore'))
                    except Exception:                # noqa: BLE001
                        pass
        elif p.lower().endswith('.json'):
            try:
                feed(open(p, encoding='utf-8', errors='ignore').read())
            except OSError:
                pass

    times.sort()
    return [{'dt': t, 'kind': 'ai', 'text': '', 'url': ''} for t in times], info
