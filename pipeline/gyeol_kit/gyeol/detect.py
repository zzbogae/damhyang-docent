# -*- coding: utf-8 -*-
"""
data/ 폴더를 훑어 "이 파일이 무슨 채널인지"를 스스로 알아냅니다.

파일 이름에 의존하지 않습니다 — 안을 열어보고 판단합니다.
팀원이 파일명을 어떻게 바꿔 놨든, 압축을 풀었든 안 풀었든 동작해야 합니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
import io
import json
import os
import zipfile


def _peek_zip(path: str) -> str | None:
    try:
        names = zipfile.ZipFile(path).namelist()
    except (zipfile.BadZipFile, OSError):
        return None
    joined = '\n'.join(names).lower()

    if 'export.xml' in joined or 'apple_health_export' in joined or '내보내기.xml' in joined:
        return 'health_apple'
    if 'com.samsung.shealth' in joined or 'samsunghealth' in joined:
        return 'health_samsung'
    if 'conversations.json' in joined:
        return 'ai_chat'
    if 'watch-history' in joined or 'search-history' in joined \
       or 'takeout' in joined or '시청 기록' in joined:
        return 'takeout'
    if joined.count('.ics') > 0:
        return 'takeout'
    if joined.strip().endswith('.xml') and 'export' in joined:
        return 'health_apple'
    return None


def _peek_csv(path: str) -> str | None:
    try:
        with open(path, encoding='utf-8-sig', errors='ignore') as f:
            head = f.read(4096)
    except OSError:
        return None
    first = head.split('\n', 1)[0].lower()
    if 'user' in first and 'message' in first:
        return 'kakao'
    if 'created_at' in first and ('char_count' in first or 'modified_at' in first):
        return 'notes'
    if 'taken_at' in first:
        return 'photo'
    if 'step' in first and 'date' in first:
        return 'health_csv'
    if 'sleep' in first and 'date' in first:
        return 'health_csv'
    return None


def _peek_txt(path: str) -> str | None:
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            head = f.read(3000)
    except OSError:
        return None
    if '카카오톡 대화' in head or 'KakaoTalk' in head:
        return 'kakao'
    if ('오전' in head or '오후' in head) and head.count(' : ') > 3:
        return 'kakao'
    if head.count('] [') > 3:
        return 'kakao'
    return None


def _peek_json(path: str) -> str | None:
    base = os.path.basename(path).lower()
    if 'conversation' in base:
        return 'ai_chat'
    if 'watch-history' in base or 'search-history' in base:
        return 'takeout'
    if 'myactivity' in base:
        return 'takeout'
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            head = f.read(2000)
    except OSError:
        return None
    if '"chat_messages"' in head or '"mapping"' in head:
        return 'ai_chat'
    if '"titleUrl"' in head or '"header": "YouTube' in head:
        return 'takeout'
    return None


IGNORE = {'.ds_store', 'readme.txt', 'readme.md', '.gitkeep'}


def scan(data_dir: str) -> dict:
    """
    반환: {channel_key: [paths]}  +  '_unknown': [paths]
    """
    found: dict[str, list[str]] = {}

    def add(ch, p):
        found.setdefault(ch, []).append(p)

    if not os.path.isdir(data_dir):
        return found

    for entry in sorted(os.listdir(data_dir)):
        p = os.path.join(data_dir, entry)
        if entry.lower() in IGNORE or entry.startswith('.'):
            continue

        if os.path.isdir(p):
            # 압축을 풀어서 넣은 경우 (Takeout 폴더 등)
            low = entry.lower()
            inner = '\n'.join(
                os.path.join(r, f) for r, _, fs in os.walk(p) for f in fs).lower()
            if 'takeout' in low or 'watch-history' in inner or '.ics' in inner:
                add('takeout', p)
            elif 'conversations.json' in inner:
                add('ai_chat', p)
            elif 'export.xml' in inner:
                add('health_apple', p)
            else:
                add('_unknown', p)
            continue

        ext = os.path.splitext(entry)[1].lower()
        ch = None
        if ext == '.zip':
            ch = _peek_zip(p)
        elif ext == '.csv':
            ch = _peek_csv(p)
        elif ext == '.txt':
            ch = _peek_txt(p)
        elif ext == '.json':
            ch = _peek_json(p)
        elif ext == '.ics':
            ch = 'takeout'
        elif ext == '.xml':
            ch = 'health_apple'

        add(ch or '_unknown', p)

    return found
