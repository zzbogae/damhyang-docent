#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
「결」 — 내 데이터로 한 번 돌려보기.

    python3 run_gyeol.py

data/ 폴더에 있는 파일을 스스로 알아보고, 있는 것만으로 돌립니다.
하나만 넣어도 돌아가고, 여섯 개를 다 넣어도 돌아갑니다.
필요한 설치 없음 — 파이썬 표준 라이브러리만 씁니다.

내 컴퓨터 안에서만 돌아갑니다. 어디로도 전송하지 않습니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import os
import sys

PY_MIN = (3, 7)
if sys.version_info < PY_MIN:
    sys.stderr.write(
        f"\n이 키트는 파이썬 {PY_MIN[0]}.{PY_MIN[1]} 이상이 필요합니다.\n"
        f"지금 쓰시는 건 {sys.version.split()[0]} 입니다.\n"
        f"python.org/downloads 에서 최신 버전을 받으시면 됩니다.\n\n")
    raise SystemExit(1)

import argparse
from collections import defaultdict
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gyeol import detect, report                                    # noqa: E402
from gyeol.channels import BY_KEY, CHANNELS, FEATURE_DIRECTION, FEATURE_LABEL  # noqa: E402
from gyeol import parse_health, parse_takeout, parse_kakao, parse_ai, parse_notes, parse_photos  # noqa: E402
from gyeol.feature_extractor import compute_weekly_features          # noqa: E402
from gyeol import rolling_baseline as RB                             # noqa: E402
from gyeol import crisis_filter                                      # noqa: E402
from gyeol.judge import apply_evidence_floor                         # noqa: E402


def log(msg=''):
    print(msg, flush=True)


def week_key(d):
    iso = d.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}'


def span_of(weeks):
    if not weeks:
        return None, None
    ks = sorted(weeks)
    from gyeol.analyzer_v3 import week_date_range
    return week_date_range(ks[0])[0], week_date_range(ks[-1])[1]


# ── 채널별 적재 ────────────────────────────────────────────

def load_all(found, my_name_hint, interactive):
    """
    반환: (weekly_by_channel, found_info[], health_rows)
    weekly_by_channel: {channel_key: {week: {feature: value}}}
    """
    weekly, info, health_rows = {}, [], None

    # 1) 건강
    # 애플/삼성/직접 CSV 세 소스는 같은 두 필드(steps, sleep_hours)를 채운다.
    # 예전에는 소스별로 주 평균을 따로 낸 뒤 merge_weekly가 채널 순서대로(마지막이
    # health_csv) 그냥 덮어써서, 애플 건강에 이미 있던 주의 수면 기록이 CSV 쪽 값으로
    # 통째로 바뀔 수 있었다(쉼 축 커버리지 저하 후보 원인 — team_spec_sync_260913.md
    # §1-6). 지금은 날짜·필드 단위로 먼저 합친 뒤(parse_health.merge_daily_rows,
    # 애플·삼성이 CSV보다 우선) 주 평균을 한 번만 낸다.
    health_by_source = []
    for key in ('health_apple', 'health_samsung', 'health_csv'):
        paths = found.get(key) or []
        if not paths:
            continue
        log(f'▸ {BY_KEY[key]["label"]} 읽는 중…')
        rows = []
        for p in paths:
            try:
                rows += parse_health.load_health(p, key, progress=log)
            except Exception as ex:                                  # noqa: BLE001
                log(f'  ⚠ {os.path.basename(p)} — {ex}')
        if not rows:
            continue
        health_rows = (health_rows or []) + rows
        health_by_source.append((key, rows))
        n_step = sum(1 for r in rows if r.get('steps') is not None)
        n_sleep = sum(1 for r in rows if r.get('sleep_hours') is not None)
        gives = (['avg_steps'] if n_step else []) + (['avg_sleep'] if n_sleep else [])
        s, en = min(r['date'] for r in rows), max(r['date'] for r in rows)
        info.append(dict(key=key, label=BY_KEY[key]['label'], n=len(rows),
                         start=s, end=en, weeks=None,  # 아래 병합 후 채움
                         files=', '.join(os.path.basename(p) for p in paths),
                         gives_actual=gives,
                         warn=None if n_sleep else '수면 기록이 없습니다 — 걸음수만으로 판정합니다'))
        log(f'  걸음 {n_step:,}일 · 수면 {n_sleep:,}일')

    if health_by_source:
        merged_rows = parse_health.merge_daily_rows(health_by_source)
        w = parse_health.compute_weekly_health(merged_rows)
        weekly['health'] = {k: {kk: vv for kk, vv in v.items() if vv is not None}
                            for k, v in w.items()}
        for it in info:
            if it['key'] in ('health_apple', 'health_samsung', 'health_csv'):
                it['weeks'] = len(weekly['health'])
        log(f"  합쳐서 {len(weekly['health'])}주")

    # 2) Takeout (유튜브 + 캘린더 + Gemini)
    paths = found.get('takeout') or []
    if paths:
        log('▸ Google Takeout 읽는 중…')
        recs, stats = parse_takeout.load_takeout(paths, today=date.today(), progress=log)
        w = parse_takeout.weekly_from_records(recs)
        yt = {k: {kk: vv for kk, vv in v.items()
                  if kk.startswith('yt_') and vv is not None} for k, v in w.items()}
        yt = {k: v for k, v in yt.items() if v}
        cal = {k: {'cal_events': v['cal_events']} for k, v in w.items() if v.get('cal_events')}
        ai = {k: {kk: vv for kk, vv in v.items() if kk.startswith('ai_')}
              for k, v in w.items() if v.get('ai_count')}

        for ch, wk, kinds in (('youtube', yt, ('yt_watch', 'yt_music', 'yt_search')),
                              ('calendar', cal, ('cal_event', 'cal_allday')),
                              ('ai_chat', ai, ('ai',))):
            if not wk:
                continue
            sub = [r for r in recs if r['kind'] in kinds]
            weekly[ch] = wk
            gives = sorted({f for v in wk.values() for f in v})
            info.append(dict(key=ch, label=BY_KEY[ch]['label'], n=len(sub),
                             start=sub[0]['dt'].date() if sub else None,
                             end=sub[-1]['dt'].date() if sub else None,
                             weeks=len(wk),
                             files=', '.join(os.path.basename(p) for p in paths),
                             gives_actual=gives, warn=None))
            log(f'  {BY_KEY[ch]["label"]}: {len(sub):,}건 · {len(wk)}주')

        if 'youtube' in weekly:
            ys = [r for r in recs if r['kind'] in ('yt_watch', 'yt_music', 'yt_search')]
            if ys:
                days = (ys[-1]['dt'] - ys[0]['dt']).days
                if days < 400:
                    for it in info:
                        if it['key'] == 'youtube':
                            it['warn'] = (f'{days // 30}개월치뿐입니다 — 구글 계정의 '
                                          f'"활동 자동 삭제"가 켜져 있을 수 있습니다')

    # 3) AI 대화 (별도 conversations.json)
    paths = found.get('ai_chat') or []
    if paths:
        log('▸ AI 대화 기록 읽는 중…')
        recs, vend = parse_ai.load_ai_chats(paths)
        if recs:
            W = defaultdict(lambda: [0, 0])
            for r in recs:
                k = week_key(r['dt'])
                W[k][0] += 1
                if 0 <= r['dt'].hour <= 4:
                    W[k][1] += 1
            wk = {k: {'ai_count': n, 'ai_night_ratio': ni / n}
                  for k, (n, ni) in W.items() if n >= 3}
            if wk:
                prev = weekly.get('ai_chat', {})
                for k, v in wk.items():
                    prev[k] = v
                weekly['ai_chat'] = prev
                info = [i for i in info if i['key'] != 'ai_chat']
                info.append(dict(key='ai_chat', label=BY_KEY['ai_chat']['label'],
                                 n=len(recs), start=recs[0]['dt'].date(),
                                 end=recs[-1]['dt'].date(), weeks=len(prev),
                                 files=' + '.join(f'{k} {v:,}건' for k, v in vend.items()),
                                 gives_actual=['ai_count', 'ai_night_ratio'],
                                 warn='내용은 읽지 않았습니다. 시각과 횟수만 셌습니다.'))
                log(f'  {len(recs):,}건 · {len(prev)}주')

    # 3-b) 메모
    paths = found.get('notes') or []
    if paths:
        log('▸ 메모 기록 읽는 중…')
        rows = []
        for p_ in paths:
            rows += parse_notes.load_notes_csv(p_)
        before = len(rows)
        rows = parse_notes.dedupe(rows)      # 파일이 여러 개면 합친 뒤 다시 한 번
        if before != len(rows):
            log(f'  중복 {before - len(rows):,}개 제거 (같은 메모를 두 번 내보낸 파일)')
        if rows:
            wk = parse_notes.weekly_notes(rows)
            weekly['notes'] = wk
            gives = sorted({f for v in wk.values() for f in v})
            n_len = sum(1 for r in rows if r['chars'] is not None)
            info.append(dict(key='notes', label=BY_KEY['notes']['label'], n=len(rows),
                             start=rows[0]['dt'].date(), end=rows[-1]['dt'].date(),
                             weeks=len(wk),
                             files=', '.join(os.path.basename(x) for x in paths),
                             gives_actual=gives,
                             warn=None if n_len else '글자 수를 못 가져왔습니다 — 작성 시각만으로 셉니다'))
            log(f'  {len(rows):,}개 · {len(wk)}주'
                + ('' if n_len else '  (글자 수 없음)'))

    # 3-c) 사진
    paths = found.get('photo') or []
    if paths:
        log('▸ 사진 촬영 기록 읽는 중…')
        rows = []
        for p_ in paths:
            rows += parse_photos.load_photos_csv(p_)
        if rows:
            wk = parse_photos.weekly_photos(rows)
            weekly['photo'] = wk
            gives = sorted({f for v in wk.values() for f in v})
            kinds = {}
            for r in rows:
                kinds[r['kind']] = kinds.get(r['kind'], 0) + 1
            info.append(dict(key='photo', label=BY_KEY['photo']['label'], n=len(rows),
                             start=rows[0]['dt'].date(), end=rows[-1]['dt'].date(),
                             weeks=len(wk),
                             files=' · '.join(f'{k} {v:,}' for k, v in sorted(kinds.items())),
                             gives_actual=gives,
                             warn='사진을 열지 않았습니다. 촬영 시각과 종류만 셌습니다.'))
            log(f'  {len(rows):,}장 · {len(wk)}주  ({kinds})')

    # 4) 카카오톡
    paths = found.get('kakao') or []
    if paths:
        log('▸ 카카오톡 읽는 중…')
        msgs, senders, resolved, per_file = parse_kakao.load_many(paths, my_name_hint)
        for fn, n, err in per_file:
            log(f'  {fn}: {n:,}줄' + (f'  ⚠ {err}' if err else ''))

        if not resolved and senders:
            top = list(senders.items())[:12]
            log('\n  이 대화방의 참가자:')
            for i, (s, n) in enumerate(top, 1):
                log(f'    {i}. {s}  ({n:,}건)')
            if interactive:
                try:
                    ans = input('\n  이 중 본인은 몇 번입니까? (숫자 입력, 건너뛰려면 Enter) ').strip()
                    if ans.isdigit() and 1 <= int(ans) <= len(top):
                        resolved = top[int(ans) - 1][0]
                except (EOFError, KeyboardInterrupt):
                    pass
            if not resolved:
                log('  ⚠ 본인 이름을 못 찾아 카톡을 건너뜁니다. '
                    '다시 실행할 때  python3 run_gyeol.py --name "표시되는이름"  으로 알려주세요.')

        if resolved:
            my = parse_kakao.extract_my_messages(msgs, resolved)
            text_msgs = [m for m in my if not m['is_attachment']]
            w = compute_weekly_features(text_msgs)
            w = {k: v for k, v in w.items() if v['message_count'] >= 5}
            keep = ['night_ratio', 'first_person_ratio', 'absolute_ratio',
                    'avg_reply_delay_min', 'avg_length']
            weekly['kakao'] = {k: {f: v[f] for f in keep if v.get(f) is not None}
                               for k, v in w.items()}
            s, en = (msgs[0].dt.date(), msgs[-1].dt.date()) if msgs else (None, None)
            info.append(dict(key='kakao', label=f'카카오톡 ({resolved})',
                             n=len(text_msgs), start=s, end=en,
                             weeks=len(weekly['kakao']),
                             files=', '.join(os.path.basename(p) for p in paths),
                             gives_actual=keep,
                             warn='내 발화만 썼습니다. 상대방 메시지는 답장 지연 계산에만 쓰고 버렸습니다.'))
            log(f'  내 발화 {len(text_msgs):,}건 · {len(weekly["kakao"])}주')

    return weekly, info, health_rows


# ── 병합 · 판정 ──────────────────────────────────────────────

def merge_weekly(weekly_by_channel):
    merged = defaultdict(dict)
    for wk_map in weekly_by_channel.values():
        for week, row in wk_map.items():
            for f, v in row.items():
                if v is not None:
                    merged[week][f] = v
    return dict(merged)


def main():
    ap = argparse.ArgumentParser(description='「결」 — 내 데이터로 한 번 돌려보기')
    ap.add_argument('--name', default=None, help='카톡에 표시되는 본인 이름')
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out', default=os.path.join(HERE, 'out'))
    ap.add_argument('--who', default='', help='리포트에 적을 이름 (선택)')
    ap.add_argument('--yes', action='store_true', help='물어보지 않고 진행')
    ap.add_argument('--exclude', action='append', default=[],
                    metavar='시작:끝',
                    help='되돌려받고 싶지 않은 기간. 예: --exclude 2024-09-01:2024-10-31 '
                         '(여러 번 쓸 수 있습니다)')
    args = ap.parse_args()

    user_ranges = []
    for r in args.exclude:
        try:
            a, b = r.split(':')
            user_ranges.append((a.strip(), b.strip()))
        except ValueError:
            log(f'⚠ --exclude 형식이 잘못됐습니다: {r}  (예: 2024-09-01:2024-10-31)')
            return 1

    os.makedirs(args.out, exist_ok=True)

    log('=' * 68)
    log(' 「결」 — data/ 폴더를 살펴봅니다')
    log('=' * 68)

    found = detect.scan(args.data)
    if not found or set(found) == {'_unknown'}:
        log(f'\n data/ 폴더에 알아볼 수 있는 파일이 없습니다.\n   경로: {args.data}')
        log('   START_HERE.html 을 열어 채널 하나만이라도 받아서 넣어주세요.')
        return 1

    for ch, ps in found.items():
        if ch == '_unknown':
            for p in ps:
                log(f'  ? {os.path.basename(p)} — 무슨 파일인지 모르겠습니다 (건너뜀)')
        else:
            label = BY_KEY.get(ch, {}).get('label', 'Google Takeout' if ch == 'takeout' else ch)
            log(f'  ✓ {os.path.basename(ps[0])}{"" if len(ps) == 1 else f" 외 {len(ps)-1}개"} → {label}')
    log()

    weekly, info, health_rows = load_all(found, args.name, interactive=not args.yes)
    merged = merge_weekly(weekly)

    if not merged:
        log('\n 주 단위로 묶을 수 있는 데이터가 없었습니다.')
        return 1

    present = sorted({f for row in merged.values() for f in row})
    feats = [(f, d) for f, d in FEATURE_DIRECTION if f in present]

    log(f'\n▸ 판정 중 — {len(merged)}주 · 지표 {len(feats)}종 · 직전 52주 기준선')
    p = RB.compute_rolling_percentiles(merged, feats, window=52)
    cands = apply_evidence_floor(RB.find_candidates_rolling(p, merged))

    tiers = {'recovered': [], 'passed': [], 'observed': []}
    for c in cands:
        tiers[c['tier']].append(c)
    for k in tiers:
        tiers[k].sort(key=lambda c: -c['deviation'])

    n_judgeable = sum(1 for v in p.values() if any(x is not None for x in v.values()))

    # 인출 필터 — 되돌려주지 않을 주를 고른다. 사유는 저장하지 않고 여기서 끝난다.
    excluded = crisis_filter.excluded_weeks(p, merged, user_ranges=user_ranges)
    retrievable, withheld = crisis_filter.split(cands, excluded)
    ex_summary = crisis_filter.summary(excluded, len(merged))
    if user_ranges:
        log(f'▸ 사용자 지정 제외 구간 {len(user_ranges)}개 반영')
    log(f'▸ 인출 필터 — {len(merged)}주 중 {ex_summary["n"]}주를 되돌려주기 대상에서 제외')

    have = {i['key'] for i in info}
    if 'health_apple' in have or 'health_samsung' in have or 'health_csv' in have:
        have |= {'health_apple', 'health_samsung', 'health_csv'}
    missing = [dict(label=c['label'], platform=c['platform'], minutes=c['minutes'],
                    how=c['how'], note=c['note'],
                    adds=[FEATURE_LABEL.get(g, g) for g in c['gives']])
               for c in CHANNELS if c['key'] not in have and c['key'] != 'health_csv']

    ctx = dict(
        who=args.who or (args.name or '내'),
        run_at=datetime.now().strftime('%Y년 %m월 %d일 %H:%M'),
        found=info, missing=missing,
        coverage=report.feature_coverage(merged, present),
        n_weeks=len(merged), n_judgeable=n_judgeable,
        tiers=tiers, unlock=report.unlock_estimate(cands, merged),
        health_rows=health_rows,
        retrievable=retrievable, withheld=withheld, ex_summary=ex_summary,
        user_ranges=user_ranges,
        html_path=os.path.join(args.out, 'gyeol_report.html'),
    )

    with open(ctx['html_path'], 'w', encoding='utf-8') as f:
        f.write(report.build_html(ctx))

    report.print_console(ctx)
    return 0


if __name__ == '__main__':
    sys.exit(main())
