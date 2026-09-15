# -*- coding: utf-8 -*-
"""
건강 데이터 로더 — 애플 건강 zip / 삼성 헬스 zip / 직접 만든 CSV.

세 경로 모두 같은 형태로 정규화합니다:
    [{'date': date, 'steps': float|None, 'sleep_hours': float|None}, ...]

애플 zip은 압축을 풀지 않고 스트리밍으로 읽습니다 (828MB XML 검증됨).
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
import io
import os
import re
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta, date

# ── 공통 ────────────────────────────────────────────────────

def _week_key(d) -> str:
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def compute_weekly_health(rows: list[dict]) -> dict:
    weekly = defaultdict(lambda: {'steps': [], 'sleep': []})
    for r in rows:
        wk = _week_key(r['date'])
        if r.get('steps') is not None:
            weekly[wk]['steps'].append(r['steps'])
        if r.get('sleep_hours') is not None:
            weekly[wk]['sleep'].append(r['sleep_hours'])
    out = {}
    for wk, v in weekly.items():
        out[wk] = {
            'avg_steps': sum(v['steps']) / len(v['steps']) if v['steps'] else None,
            'avg_sleep': sum(v['sleep']) / len(v['sleep']) if v['sleep'] else None,
        }
    return out


def daily_to_rows(daily_steps: dict, daily_sleep_h: dict) -> list[dict]:
    all_dates = sorted(set(daily_steps) | set(daily_sleep_h))
    rows = []
    for d in all_dates:
        dd = d if isinstance(d, date) else datetime.strptime(d, '%Y-%m-%d').date()
        rows.append({
            'date': dd,
            'steps': daily_steps.get(d),
            'sleep_hours': daily_sleep_h.get(d),
        })
    return rows


def write_csv(rows: list[dict], path: str):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['date', 'steps', 'sleep_hours'])
        for r in rows:
            w.writerow([r['date'].isoformat(),
                        '' if r['steps'] is None else int(r['steps']),
                        '' if r['sleep_hours'] is None else f"{r['sleep_hours']:.2f}"])


# ── 1) 직접 만든 CSV ────────────────────────────────────────

def load_health_csv(path: str) -> list[dict]:
    rows = []
    with open(path, 'r', encoding='utf-8-sig', errors='ignore') as f:
        for r in csv.DictReader(f):
            ds = (r.get('date') or r.get('Date') or '').strip()
            if not ds:
                continue
            try:
                d = datetime.strptime(ds[:10], '%Y-%m-%d').date()
            except ValueError:
                continue
            def num(k1, k2=None):
                v = (r.get(k1) or (r.get(k2) if k2 else '') or '').strip()
                try:
                    return float(v) if v else None
                except ValueError:
                    return None
            rows.append({'date': d,
                         'steps': num('steps', 'Steps'),
                         'sleep_hours': num('sleep_hours', 'Sleep')})
    return rows


# ── 2) 애플 건강 zip ────────────────────────────────────────

STEP_TYPE = 'HKQuantityTypeIdentifierStepCount'
SLEEP_TYPE = 'HKCategoryTypeIdentifierSleepAnalysis'
ASLEEP_VALUES = {
    'HKCategoryValueSleepAnalysisAsleep',
    'HKCategoryValueSleepAnalysisAsleepCore',
    'HKCategoryValueSleepAnalysisAsleepDeep',
    'HKCategoryValueSleepAnalysisAsleepREM',
    'HKCategoryValueSleepAnalysisAsleepUnspecified',
}
_APPLE_FMT = '%Y-%m-%d %H:%M:%S %z'


def load_apple_health_zip(zip_path: str, progress=None) -> list[dict]:
    daily_steps = defaultdict(float)
    daily_sleep_sec = defaultdict(float)
    seen_steps = set()          # 아이폰+워치 중복 기록 제거

    with zipfile.ZipFile(zip_path) as z:
        xmls = [i for i in z.infolist()
                if i.filename.lower().endswith('.xml') and 'export_cda' not in i.filename]
        if not xmls:
            raise ValueError('zip 안에 export.xml이 없습니다. 애플 건강 내보내기 파일이 맞는지 확인하세요.')
        target = max(xmls, key=lambda i: i.file_size)
        if progress:
            progress(f'  대상 XML {target.file_size / 1024 / 1024:.0f}MB — 스트리밍 처리')

        with z.open(target) as f:
            count = 0
            for _, elem in ET.iterparse(f, events=('end',)):
                if elem.tag == 'Record':
                    rtype = elem.get('type')
                    if rtype == STEP_TYPE:
                        start, end = elem.get('startDate'), elem.get('endDate')
                        value = elem.get('value')
                        if start and value:
                            key = (start, end, value)
                            if key not in seen_steps:
                                seen_steps.add(key)
                                daily_steps[start.split(' ')[0]] += float(value)
                    elif rtype == SLEEP_TYPE and elem.get('value') in ASLEEP_VALUES:
                        start, end = elem.get('startDate'), elem.get('endDate')
                        if start and end:
                            try:
                                dt_s = datetime.strptime(start, _APPLE_FMT)
                                dur = (datetime.strptime(end, _APPLE_FMT) - dt_s).total_seconds()
                                key_date = dt_s.date()
                                if dt_s.hour < 12:      # 새벽 수면은 전날 밤으로
                                    key_date = (dt_s - timedelta(days=1)).date()
                                daily_sleep_sec[key_date.isoformat()] += dur
                            except ValueError:
                                pass
                    count += 1
                    if progress and count % 1_000_000 == 0:
                        progress(f'  ...{count:,}개 레코드')
                elem.clear()

    sleep_h = {k: v / 3600 for k, v in daily_sleep_sec.items()}
    return daily_to_rows(dict(daily_steps), sleep_h)


# ── 3) 삼성 헬스 zip ────────────────────────────────────────
# 내부 CSV는 1행이 메타데이터, 2행이 실제 헤더인 경우가 많습니다.
# [미검증] 실제 삼성 파일로 아직 확인하지 못했습니다.

_STEP_COL = re.compile(r'(^|\.)(step_count|count)$')
_DAYTIME_COL = re.compile(r'(^|\.)(day_time|start_time|create_time)$')


def _read_samsung_csv(raw: bytes):
    text = raw.decode('utf-8', errors='ignore')
    lines = text.split('\n')
    # 헤더 행 찾기: 쉼표가 여러 개이고 알파벳 컬럼명이 있는 첫 줄
    hidx = 0
    for i, ln in enumerate(lines[:5]):
        if ln.count(',') >= 3 and re.search(r'[a-z_]{4,}', ln):
            hidx = i
            break
    return list(csv.DictReader(io.StringIO('\n'.join(lines[hidx:]))))


def _samsung_ts(v: str):
    v = (v or '').strip()
    if not v:
        return None
    if v.isdigit():
        ts = int(v)
        if ts > 10 ** 12:
            ts //= 1000
        try:
            return datetime.fromtimestamp(ts)
        except (ValueError, OSError):
            return None
    for fmt in ('%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(v[:26], fmt)
        except ValueError:
            continue
    return None


def load_samsung_health_zip(zip_path: str, progress=None) -> list[dict]:
    daily_steps = defaultdict(float)
    daily_sleep_sec = defaultdict(float)

    with zipfile.ZipFile(zip_path) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.csv')]
        step_files = [n for n in names if 'pedometer_day_summary' in n] or \
                     [n for n in names if 'step_count' in n or 'pedometer' in n]
        sleep_files = [n for n in names if 'sleep' in n.lower()]

        for n in step_files[:6]:
            try:
                rows = _read_samsung_csv(z.read(n))
            except Exception:                        # noqa: BLE001
                continue
            for r in rows:
                tcol = next((k for k in r if _DAYTIME_COL.search(k or '')), None)
                scol = next((k for k in r if _STEP_COL.search(k or '')), None)
                if not tcol or not scol:
                    continue
                dt = _samsung_ts(r.get(tcol))
                try:
                    v = float(r.get(scol) or 0)
                except ValueError:
                    continue
                if dt and v > 0:
                    daily_steps[dt.date().isoformat()] = max(
                        daily_steps.get(dt.date().isoformat(), 0), v)

        for n in sleep_files[:6]:
            try:
                rows = _read_samsung_csv(z.read(n))
            except Exception:                        # noqa: BLE001
                continue
            for r in rows:
                skey = next((k for k in r if k and k.endswith('start_time')), None)
                ekey = next((k for k in r if k and k.endswith('end_time')), None)
                if not skey or not ekey:
                    continue
                s, e = _samsung_ts(r.get(skey)), _samsung_ts(r.get(ekey))
                if not s or not e or e <= s:
                    continue
                key_date = s.date()
                if s.hour < 12:
                    key_date = (s - timedelta(days=1)).date()
                daily_sleep_sec[key_date.isoformat()] += (e - s).total_seconds()

    if progress:
        progress(f'  걸음 {len(daily_steps)}일 · 수면 {len(daily_sleep_sec)}일')
    sleep_h = {k: v / 3600 for k, v in daily_sleep_sec.items()}
    return daily_to_rows(dict(daily_steps), sleep_h)


# ── 진입점 ──────────────────────────────────────────────────

def load_health(path: str, kind: str, progress=None) -> list[dict]:
    if kind == 'health_apple':
        return load_apple_health_zip(path, progress)
    if kind == 'health_samsung':
        return load_samsung_health_zip(path, progress)
    return load_health_csv(path)
