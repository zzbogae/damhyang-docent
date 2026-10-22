#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
freq_scan.py — 대화 빈도 분석 (v5 §5-1)

    python3 freq_scan.py --me "홍길동"
    python3 freq_scan.py --list-speakers     # 이름만 먼저 확인할 때

교수님 방향(v5 §2): 대화 빈도 분석 → LLM이 공간 제약조건 도출 → XR Blocks 생성.
이 스크립트는 그 **첫 칸**입니다. LLM을 부르지 않습니다 — 순수 파이썬입니다.
크레딧이 없어도 돕니다.

═══ 하드룰 — 고치지 마세요 ═══

1. **본인 발화만 셉니다.** 카톡에는 상대방 말이 들어 있는데 그 사람들은
   동의한 적이 없습니다. `--me` 로 준 이름과 일치하는 발화만 봅니다.
   `--me` 없이는 아예 안 돕니다.

2. **원문 문장은 어디에도 안 남깁니다.** 나가는 건 단어와 그 개수뿐입니다.
   길이 1글자 단어, 숫자만인 토큰, 그리고 N번 미만 등장한 단어는 버립니다 —
   드물게 나오는 말일수록 그 사람을 특정합니다.

3. 나가는 파일은 `out/freq_summary.md` 와 `out/freq_for_llm.json` 둘뿐입니다.
   둘 다 집계값만 들어 있습니다. `data/` 는 읽기만 하고 절대 복사하지 않습니다.

⚠ `--list-speakers` 결과에는 **사람 이름이 나옵니다.** 그건 화면에서만 보시고
   대화창에 붙여넣지 마세요.
"""
from __future__ import annotations
import argparse, csv, json, os, re, sys, unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))

MIN_COUNT   = 5      # 이보다 드물게 나온 단어는 버립니다 (개인 특정 위험)
TOP_N       = 60
MIN_LEN     = 2

# 카톡 내보내기 형식 — 기기·버전마다 다릅니다. 셋 다 봅니다.
PATTERNS = [
    # 2024년 1월 3일 오후 3:24, 홍길동 : 메시지
    re.compile(r'^\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*(?:오전|오후)\s*\d{1,2}:\d{2},\s*(?P<who>[^:]{1,40}?)\s*:\s*(?P<msg>.*)$'),
    # [홍길동] [오후 3:24] 메시지
    re.compile(r'^\[(?P<who>[^\]]{1,40})\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s*(?P<msg>.*)$'),
    # 2024-01-03 15:24:00,홍길동,메시지   (CSV 계열)
    re.compile(r'^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\s*,\s*(?P<who>[^,]{1,40})\s*,\s*(?P<msg>.*)$'),
]
TIME_RE = re.compile(r'(?P<ap>오전|오후)\s*(?P<h>\d{1,2}):(?P<m>\d{2})')
ISO_RE  = re.compile(r'^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})')
KDATE_RE = re.compile(r'^(?P<y>\d{4})년\s*(?P<mo>\d{1,2})월\s*(?P<d>\d{1,2})일')

RECENT_WEEKS = 8      # 「최근」의 길이
PAST_WEEKS   = 52     # 비교 대상 기간
NEW_MIN      = 3      # 새 말로 치는 최소 등장 수

# 빼는 말 — 내용이 없거나 어디서나 나오는 것
STOP = set('''
그래 그거 그건 그게 그럼 그리고 그래서 근데 그런데 하지만 그러면 그니까 그냥
나는 내가 너는 네가 우리 저는 제가 이거 이건 이게 저거 저건 여기 거기 저기
진짜 정말 완전 엄청 너무 약간 조금 되게 많이 좀 더 또 다시 계속 아직 벌써
지금 오늘 내일 어제 이번 다음 아까 나중 먼저 이제 그때 언제 항상 가끔
응 어 아 음 네 예 아니 아닌 맞아 맞다 그치 그렇 ㅋㅋ ㅎㅎ ㅠㅠ ㅜㅜ
사진 동영상 이모티콘 삭제된 메시지입니다 파일 링크 샵검색 선물
있다 없다 하다 되다 이다 같다 보다 알다 모르다 오다 가다 주다 받다
것 수 등 및 거 게 걸 건 때 중 안 못 잘 다 왜 뭐 뭔 누구 어디
'''.split())

JOSA = ('으로는','에서는','에게는','한테는','까지는','부터는','이라고','라고',
        '으로','에서','에게','한테','까지','부터','이랑','하고','처럼','보다',
        '는데','은데','이나','라도','마다','조차','밖에',
        '을','를','이','가','은','는','에','의','도','만','과','와','로','고','며','서')

def strip_josa(t):
    for j in JOSA:
        if len(t) > len(j) + 1 and t.endswith(j):
            return t[:-len(j)]
    return t

TOKEN_RE = re.compile(r'[가-힣]{2,}|[A-Za-z]{3,}')

def tokens(msg):
    msg = unicodedata.normalize('NFC', msg)
    out = []
    for t in TOKEN_RE.findall(msg):
        t = strip_josa(t.lower() if t.isascii() else t)
        if len(t) < MIN_LEN or t in STOP:
            continue
        out.append(t)
    return out


def parse_line(line):
    """반환: (who, msg, hour, ymd) — 못 읽으면 None. 원문은 호출부가 안 저장합니다."""
    for rx in PATTERNS:
        m = rx.match(line)
        if not m:
            continue
        who = unicodedata.normalize('NFC', m.group('who').strip())
        msg = m.group('msg')
        hour, ymd = None, None
        tm = TIME_RE.search(line)
        if tm:
            h = int(tm.group('h')) % 12
            hour = h + (12 if tm.group('ap') == '오후' else 0)
        km = KDATE_RE.match(line)
        if km:
            ymd = (int(km.group('y')), int(km.group('mo')), int(km.group('d')))
        im = ISO_RE.match(line)
        if im:
            if hour is None:
                hour = int(im.group(4))
            ymd = (int(im.group(1)), int(im.group(2)), int(im.group(3)))
        return who, msg, hour, ymd
    return None


def parse_kakao_row(row):
    """카카오톡 CSV 한 행(csv 모듈이 인용부호를 이미 벗겨낸 상태) → (who, msg, hour, ymd).
    헤더 행이거나 형식이 안 맞으면 None."""
    if len(row) < 2:
        return None
    date_s = row[0].strip()
    im = ISO_RE.match(date_s)
    if not im:
        return None  # 헤더 행이거나 날짜가 아닙니다
    who = unicodedata.normalize('NFC', row[1].strip())
    msg = ','.join(row[2:]) if len(row) > 2 else ''
    hour = int(im.group(4))
    ymd = (int(im.group(1)), int(im.group(2)), int(im.group(3)))
    return who, msg, hour, ymd


def records(path):
    """파일 하나에서 (who, msg, hour, ymd) 또는 None(못 읽은 줄/행)을 하나씩 냅니다.
    카카오톡 내보내기 CSV(파일명에 KakaoTalk 포함)는 인용부호·줄바꿈 포함 메시지를
    제대로 다루기 위해 csv 모듈로 읽고, 그 외 .txt/.csv는 줄 단위 정규식으로 읽습니다."""
    is_kakao_csv = 'kakaotalk' in os.path.basename(path).lower() and path.lower().endswith('.csv')
    if is_kakao_csv:
        with open(path, encoding='utf-8', errors='replace', newline='') as fh:
            for row in csv.reader(fh):
                if not row:
                    continue
                yield parse_kakao_row(row)
    else:
        with open(path, encoding='utf-8', errors='replace') as fh:
            for line in fh:
                yield parse_line(line)


def walk(data_dir):
    for root, dirs, files in os.walk(data_dir):
        dirs[:] = [d for d in dirs if not d.startswith(('.', '_'))]
        for f in files:
            if f.lower().endswith(('.txt', '.csv')):
                yield os.path.join(root, f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=os.path.join(HERE, 'data'))
    ap.add_argument('--out',  default=os.path.join(HERE, 'out'))
    ap.add_argument('--me', default=None,
                    help='내 카톡 표시 이름. 이것과 일치하는 발화만 셉니다')
    ap.add_argument('--list-speakers', action='store_true',
                    help='이름 목록만 봅니다. ⚠ 결과를 대화창에 붙여넣지 마세요')
    ap.add_argument('--min-count', type=int, default=MIN_COUNT)
    a = ap.parse_args()
    if a.me:
        a.me = unicodedata.normalize('NFC', a.me.strip())

    if not os.path.isdir(a.data):
        print(f'[X] {a.data} 가 없습니다. data/ 복원이 먼저입니다.'); sys.exit(1)
    files = list(walk(a.data))
    if not files:
        print(f'[X] {a.data} 안에 .txt/.csv 가 없습니다.'); sys.exit(1)
    os.makedirs(a.out, exist_ok=True)

    if a.list_speakers:
        who_n = Counter()
        for p in files:
            for r in records(p):
                if r:
                    who_n[r[0]] += 1
        if not who_n:
            print('[X] 읽을 수 있는 대화 줄이 없습니다. 형식이 다릅니다 — 알려주세요.')
            sys.exit(1)
        print('\n이름 (발화 수) — ⚠ 화면에서만 보세요. 붙여넣지 마세요\n')
        for w, n in who_n.most_common(20):
            print(f'  {n:>7,}  {w}')
        print(f'\n다음: python3 freq_scan.py --me "이름"')
        return

    if not a.me:
        print('[X] --me 가 필요합니다. 본인 발화만 세기 때문입니다.')
        print('    이름을 모르시면: python3 freq_scan.py --list-speakers')
        sys.exit(1)

    words, bigrams = Counter(), Counter()
    by_hour, by_len = Counter(), Counter()
    n_mine = n_other = n_unparsed = 0
    # 「최근 들어 나타난 말」을 찾기 위해 날짜별로도 셉니다.
    # 날짜 자체는 나가지 않습니다 — 최근/이전 두 뭉치로만 씁니다.
    by_day = defaultdict(Counter)     # (y,m,d) → 단어 카운터
    days_seen = set()

    for p in files:
        for r in records(p):
            if not r:
                n_unparsed += 1
                continue
            who, msg, hour, ymd = r
            if who != a.me:
                n_other += 1
                continue          # ← 하드룰 1. 여기서 끝입니다
            n_mine += 1
            if hour is not None:
                by_hour[hour] += 1
            ts = tokens(msg)
            by_len[min(len(ts) // 5 * 5, 30)] += 1
            words.update(ts)
            bigrams.update(f'{x} {y}' for x, y in zip(ts, ts[1:]))
            if ymd:
                by_day[ymd].update(ts)
                days_seen.add(ymd)
            del msg, ts               # 원문은 여기서 버립니다

    keep  = {w: c for w, c in words.items()   if c >= a.min_count}
    keepb = {w: c for w, c in bigrams.items() if c >= a.min_count}
    top   = Counter(keep).most_common(TOP_N)
    topb  = Counter(keepb).most_common(TOP_N // 2)

    night = sum(c for h, c in by_hour.items() if h >= 23 or h < 5)
    tot_h = sum(by_hour.values()) or 1

    # ── 「최근 들어 나타난 말」 ──────────────────────────────
    # 최근 RECENT_WEEKS 와 그 앞 PAST_WEEKS 를 비교합니다.
    # 새로 생긴 말 = 이전에 한 번도 없었고 최근에 NEW_MIN 이상.
    # 늘어난 말   = 둘 다 있는데 최근 쪽 비중이 훨씬 큰 것.
    new_words, surged = [], []
    if days_seen:
        order = sorted(days_seen)
        cut_r = order[-min(len(order), RECENT_WEEKS * 7)]
        cut_p = order[-min(len(order), (RECENT_WEEKS + PAST_WEEKS) * 7)]
        rec, pas = Counter(), Counter()
        for d, c in by_day.items():
            if d >= cut_r:
                rec.update(c)
            elif d >= cut_p:
                pas.update(c)
        nr = sum(rec.values()) or 1
        np_ = sum(pas.values()) or 1
        for w, c in rec.most_common():
            if c < NEW_MIN:
                continue
            if w not in pas:
                new_words.append((w, c))
            else:
                ratio = (c / nr) / (pas[w] / np_)
                if ratio >= 2.5:
                    surged.append((w, c, round(ratio, 1)))
        new_words = new_words[:20]
        surged = sorted(surged, key=lambda x: -x[2])[:20]

    L = []
    def A(s=''): L.append(s)
    A('# freq_summary — 대화 빈도 (본인 발화만)')
    A('')
    A('> **원문 문장은 이 파일에 없습니다.** 단어와 개수뿐입니다.')
    A(f'> {a.min_count}번 미만 나온 단어는 버렸습니다 — 드문 말일수록 사람을 특정합니다.')
    A('')
    A(f'- 읽은 파일 **{len(files)}개**')
    A(f'- 내 발화 **{n_mine:,}줄** · 상대 발화 {n_other:,}줄 (**세지 않았습니다**) · 못 읽은 줄 {n_unparsed:,}')
    A(f'- 살아남은 단어 종류 **{len(keep):,}** (전체 {len(words):,} 중)')
    A(f'- 밤(23–05시) 발화 비율 **{100.0*night/tot_h:.0f}%**')
    A('')
    A('## 시간대')
    A('')
    A('| 시 | 발화 |')
    A('|---|---|')
    for h in range(24):
        if by_hour.get(h):
            A(f'| {h:02d} | {by_hour[h]:,} |')
    A('')
    A(f'## 자주 쓴 말 상위 {len(top)}')
    A('')
    A('| 말 | 횟수 |')
    A('|---|---|')
    for w, c in top:
        A(f'| {w} | {c:,} |')
    A('')
    A(f'## 자주 붙어 나온 두 말 상위 {len(topb)}')
    A('')
    A('| 말 | 횟수 |')
    A('|---|---|')
    for w, c in topb:
        A(f'| {w} | {c:,} |')
    A('')
    if new_words or surged:
        A(f'## 최근 {RECENT_WEEKS}주에 새로 나타난 말')
        A('')
        if new_words:
            A('| 말 | 최근 횟수 |')
            A('|---|---|')
            for w, c in new_words:
                A(f'| {w} | {c:,} |')
        else:
            A('없습니다.')
        A('')
        A(f'## 최근 {RECENT_WEEKS}주에 부쩍 늘어난 말')
        A('')
        if surged:
            A('| 말 | 최근 횟수 | 이전 대비 |')
            A('|---|---|---|')
            for w, c, r in surged:
                A(f'| {w} | {c:,} | {r}배 |')
        else:
            A('없습니다.')
        A('')
    else:
        A('## 최근 들어 나타난 말')
        A('')
        A('날짜를 못 읽어서 최근/이전을 못 나눴습니다. 형식을 알려주시면 맞추겠습니다.')
        A('')
    A('---')
    A('')
    A('다음 칸 — 이 표를 보면서 **사용자가 민디와 대화로** 공간을 정합니다 (v5 §5-2).')
    A('`freq_for_llm.json` 이 그 대화의 재료입니다. 앱이 혼자 도출하지 않습니다.')

    sp = os.path.join(a.out, 'freq_summary.md')
    open(sp, 'w', encoding='utf-8').write('\n'.join(L) + '\n')

    payload = {
        '_WARNING': '집계값만. 원문 없음. 본인 발화만.',
        'n_messages_mine': n_mine,
        'min_count': a.min_count,
        'night_ratio': round(night / tot_h, 3),
        'by_hour': {str(h): by_hour[h] for h in sorted(by_hour)},
        'top_words': [{'w': w, 'n': c} for w, c in top],
        'top_bigrams': [{'w': w, 'n': c} for w, c in topb],
        'recent_new': [{'w': w, 'n': c} for w, c in new_words],
        'recent_surged': [{'w': w, 'n': c, 'x': r} for w, c, r in surged],
        'recent_weeks': RECENT_WEEKS,
    }
    jp = os.path.join(a.out, 'freq_for_llm.json')
    json.dump(payload, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f'[OK] {sp}')
    print(f'[OK] {jp}')
    print(f'     내 발화 {n_mine:,}줄 · 단어 {len(keep):,}종 · 못 읽은 줄 {n_unparsed:,}')
    if n_unparsed > n_mine:
        print('[!]  못 읽은 줄이 더 많습니다. 내보내기 형식이 다를 수 있습니다 —')
        print('     freq_summary.md 를 올려주시면 형식을 맞추겠습니다.')


if __name__ == '__main__':
    main()
