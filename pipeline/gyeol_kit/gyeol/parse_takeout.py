# -*- coding: utf-8 -*-
"""
Google Takeout 통합 파서 — JSON · HTML(한/영) · ICS · Gemini 모두.

기존 takeout_parser.py는 한국어 HTML만 읽었습니다.
튜토리얼이 JSON을 권장하므로 JSON을 1순위로 읽고, HTML도 계속 받습니다.

원칙:
  · 유튜브 제목·검색어는 탐지에만. 렐릭으로 되돌려주지 않는다
  · 캘린더는 제목을 보지 않는다. 개수와 시각만
  · 미래 일정은 제외한다 (Takeout에는 2030년까지 들어 있다)
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import html as htmllib
import json
import os
import re
import zipfile
from collections import defaultdict
from datetime import datetime, date


def week_key(d) -> str:
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def strip_tags(s: str) -> str:
    return htmllib.unescape(re.sub(r'<[^>]+>', ' ', s)).strip()


# ── 날짜 파싱 ───────────────────────────────────────────────

_KDATE = re.compile(
    r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오쬄|오후)\s*(\d{1,2}):(\d{2}):(\d{2})')
_EDATE = re.compile(
    r'(\w{3}) (\d{1,2}), (\d{4}), (\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)')
_EMON = {m: i + 1 for i, m in enumerate(
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}


def parse_kdate(s: str):
    m = _KDATE.search(s)
    if m:
        y, mo, d, mer, h, mi, sec = m.groups()
        h = int(h)
        if mer == '오후' and h != 12:
            h += 12
        if mer == '오전' and h == 12:
            h = 0
        try:
            return datetime(int(y), int(mo), int(d), h, int(mi), int(sec))
        except ValueError:
            return None
    m = _EDATE.search(s)
    if m:
        mon, d, y, h, mi, sec, mer = m.groups()
        if mon not in _EMON:
            return None
        h = int(h)
        if mer == 'PM' and h != 12:
            h += 12
        if mer == 'AM' and h == 12:
            h = 0
        try:
            return datetime(int(y), _EMON[mon], int(d), h, int(mi), int(sec))
        except ValueError:
            return None
    return None


def parse_iso(s: str):
    """'2026-08-10T06:17:30.123Z' → 로컬 naive datetime (UTC+9 가정)."""
    if not s:
        return None
    try:
        t = s.replace('Z', '+00:00')
        dt = datetime.fromisoformat(t)
        if dt.tzinfo is not None:
            from datetime import timezone, timedelta
            dt = dt.astimezone(timezone(timedelta(hours=9))).replace(tzinfo=None)
        return dt
    except ValueError:
        return None


# ── 유튜브 JSON ─────────────────────────────────────────────

def parse_youtube_json(raw: str):
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []

    out = []
    for e in data:
        if not isinstance(e, dict):
            continue
        dt = parse_iso(e.get('time', ''))
        if dt is None:
            continue
        title = e.get('title', '') or ''
        url = e.get('titleUrl', '') or ''
        header = e.get('header', '') or ''

        is_search = ('search_query' in url) or title.startswith('Searched for') \
                    or title.endswith('검색함') or '을(를) 검색함' in title
        if is_search:
            kind = 'yt_search'
        elif 'YouTube Music' in header:
            kind = 'yt_music'
        else:
            if 'watch?v=' not in url:
                continue        # 광고·채널 방문 등은 시청이 아님
            kind = 'yt_watch'
        out.append({'dt': dt, 'kind': kind, 'text': '', 'url': ''})
    return out


# ── 유튜브 HTML ─────────────────────────────────────────────

_CELL = re.compile(r'<div class="outer-cell')
_CONTENT = re.compile(
    r'<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">(.*?)</div>',
    re.S)
_LINK = re.compile(r'<a href="([^"]+)">(.*?)</a>', re.S)


def parse_youtube_html(raw: str, hint: str):
    out = []
    for chunk in _CELL.split(raw)[1:]:
        cm = _CONTENT.search(chunk)
        if not cm:
            continue
        body = cm.group(1)
        plain = strip_tags(body)
        dt = parse_kdate(plain)
        if dt is None:
            continue
        lm = _LINK.search(body)
        url = lm.group(1) if lm else ''

        if ('방문했습니다' in plain or 'Visited' in plain) and 'watch?v=' not in url:
            continue

        is_search = hint == 'search' or '검색함' in plain or 'Searched for' in plain \
                    or 'search_query' in url
        is_music = 'music.youtube.com' in chunk
        kind = 'yt_search' if is_search else ('yt_music' if is_music else 'yt_watch')
        if kind == 'yt_watch' and 'watch?v=' not in url:
            continue
        out.append({'dt': dt, 'kind': kind, 'text': '', 'url': ''})
    return out


# ── 캘린더 ICS ──────────────────────────────────────────────

def parse_ics(raw: str, cal_name: str, today: date):
    out = []
    raw = re.sub(r'\r?\n[ \t]', '', raw)
    for block in raw.split('BEGIN:VEVENT')[1:]:
        m = re.search(r'DTSTART(?:;VALUE=DATE)?(?:;TZID=[^:]+)?:([0-9TZ]+)', block)
        if not m:
            continue
        v = m.group(1)
        try:
            dt = datetime.strptime(v, '%Y%m%d') if len(v) == 8 \
                else datetime.strptime(v.replace('Z', ''), '%Y%m%dT%H%M%S')
        except ValueError:
            continue
        if dt.date() > today:        # 미래 일정 제외
            continue
        out.append({'dt': dt,
                    'kind': 'cal_allday' if len(v) == 8 else 'cal_event',
                    'text': '', 'url': cal_name})
    return out


# ── Gemini ──────────────────────────────────────────────────

def parse_gemini_txt(raw: str, fname: str):
    dt = None
    for line in raw.split('\n'):
        d = parse_kdate(line)
        if d:
            dt = d
    if dt is None:
        m = re.search(r'conversation_(\d{9,})', fname)
        if m:
            try:
                dt = datetime.fromtimestamp(int(m.group(1)))
            except (ValueError, OSError):
                pass
    return [{'dt': dt, 'kind': 'ai', 'text': '', 'url': ''}] if dt else []


def parse_myactivity_json(raw: str):
    """내 활동 > Gemini 앱 의 MyActivity.json"""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    out = []
    for e in data if isinstance(data, list) else []:
        if not isinstance(e, dict):
            continue
        dt = parse_iso(e.get('time', ''))
        if dt:
            out.append({'dt': dt, 'kind': 'ai', 'text': '', 'url': ''})
    return out


# ── 파일 라우팅 ─────────────────────────────────────────────

def _route(name: str, raw: str, today: date):
    low = name.lower()
    base = os.path.basename(low)

    if base.endswith('.json'):
        if 'watch-history' in base or 'search-history' in base or '기록' in low:
            return parse_youtube_json(raw), 'youtube'
        if 'myactivity' in base and ('gemini' in low or 'bard' in low):
            return parse_myactivity_json(raw), 'ai'
        return [], None

    if base.endswith('.html') or base.endswith('.htm'):
        if 'youtube' in low or '시청 기록' in low or 'history' in low:
            hint = 'search' if ('검색' in low or 'search' in base) else 'watch'
            return parse_youtube_html(raw, hint), 'youtube'
        if 'myactivity' in base and ('gemini' in low or 'bard' in low):
            return [], None
        return [], None

    if base.endswith('.ics'):
        return parse_ics(raw, base.replace('.ics', ''), today), 'calendar'

    if base.endswith('.txt') and ('gemini' in low or 'bard' in low):
        return parse_gemini_txt(raw, name), 'ai'

    return [], None


def load_takeout(paths, today: date | None = None, progress=None):
    """
    zip 경로들과/또는 폴더·개별 파일 경로들을 받아 레코드로 정규화.
    반환: (records, stats{channel: n}, spans{channel: (min,max)})
    """
    today = today or date.today()
    records, stats = [], defaultdict(int)

    def take(recs, ch):
        if not recs or not ch:
            return
        records.extend(recs)
        stats[ch] += len(recs)

    for p in paths:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                for fn in files:
                    fp = os.path.join(root, fn)
                    try:
                        raw = open(fp, 'r', encoding='utf-8', errors='ignore').read()
                    except OSError:
                        continue
                    take(*_route(os.path.relpath(fp, p), raw, today))
            continue

        if p.lower().endswith('.zip'):
            try:
                z = zipfile.ZipFile(p)
            except zipfile.BadZipFile:
                if progress:
                    progress(f'  ⚠ 열 수 없음: {os.path.basename(p)}')
                continue
            for info in z.infolist():
                if info.is_dir() or info.file_size == 0:
                    continue
                try:
                    raw = z.read(info).decode('utf-8', errors='ignore')
                except Exception:                    # noqa: BLE001
                    continue
                take(*_route(info.filename, raw, today))
            continue

        try:
            raw = open(p, 'r', encoding='utf-8', errors='ignore').read()
        except OSError:
            continue
        take(*_route(p, raw, today))

    records.sort(key=lambda x: x['dt'])
    spans = {}
    for ch in stats:
        pass
    return records, dict(stats)


# ── 주 단위 집계 ────────────────────────────────────────────

def weekly_from_records(records) -> dict:
    W = defaultdict(lambda: {'yt_total': 0, 'yt_night': 0, 'yt_search': 0,
                             'cal_events': 0, 'ai': 0, 'ai_night': 0})
    for r in records:
        k = week_key(r['dt'])
        w = W[k]
        h = r['dt'].hour
        kind = r['kind']
        if kind in ('yt_watch', 'yt_music'):
            w['yt_total'] += 1
            if 0 <= h <= 4:
                w['yt_night'] += 1
        elif kind == 'yt_search':
            w['yt_search'] += 1
            if 0 <= h <= 4:
                w['yt_night'] += 1
        elif kind in ('cal_event', 'cal_allday'):
            w['cal_events'] += 1
        elif kind == 'ai':
            w['ai'] += 1
            if 0 <= h <= 4:
                w['ai_night'] += 1

    out = {}
    for k, w in W.items():
        row = {}
        seen = w['yt_total'] + w['yt_search']
        if seen >= 3:                       # 표본이 너무 적으면 비율이 무의미
            row['yt_total'] = w['yt_total'] or None
            row['yt_search'] = w['yt_search'] or None
            row['yt_night_ratio'] = w['yt_night'] / seen
        if w['cal_events']:
            row['cal_events'] = w['cal_events']
        if w['ai'] >= 3:
            row['ai_count'] = w['ai']
            row['ai_night_ratio'] = w['ai_night'] / w['ai']
        if row:
            out[k] = row
    return out
