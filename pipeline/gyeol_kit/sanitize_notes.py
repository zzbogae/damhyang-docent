# -*- coding: utf-8 -*-
"""
메모 원문 위생 필터 v2

    python3 sanitize_notes.py data/my_notes_text.tsv data/my_notes_text_clean.tsv data/_dropped.tsv

v1에서 고친 것 — 실제 결과를 보고 잡은 오탐
  ① URL을 키워드 검사보다 **먼저** 가립니다.
  ② '비밀번호'라는 낱말만으로는 버리지 않습니다.
     실제 자격증명(영문+숫자 덩어리)이 같이 있을 때만 버립니다.
  ③ 내가 쓴 글이 아닌 것을 거릅니다 ([Web발신]·(광고)·알림톡·고객님).
"""
from __future__ import annotations
import csv, re, sys, unicodedata
from collections import Counter

MINLEN, MAXLEN = 40, 400

MASK = [
    (re.compile(r'https?://\S+'), ' [링크] '),
    (re.compile(r'\bwww\.\S+'), ' [링크] '),
    (re.compile(r'\b01[016-9][-. ]?\d{3,4}[-. ]?\d{4}\b'), ' [전화번호] '),
    (re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.]+\b'), ' [이메일] '),
]

NUMBER_KILL = [
    (re.compile(r'\d{6}\s*[-–]\s*[1-4]\d{6}'), '주민번호'),
    (re.compile(r'\b\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}\b'), '카드번호'),
    (re.compile(r'\b\d{2,4}-\d{2,6}-\d{2,6}\b'), '계좌번호'),
]

CRED_WORDS = re.compile(
    r'(비밀번호|비번|password|passwd|\bpwd\b|공동인증|공인인증|보안카드|'
    r'인증번호|\botp\b|\bcvc\b|api[ _-]?key|secret[ _-]?key|access[ _-]?token)',
    re.I)
CRED_VALUE = re.compile(r'(?=[A-Za-z]*\d)(?=\d*[A-Za-z])[A-Za-z\d!@#$%^&*]{6,}')
ACCOUNT_LIST = 3

NOT_MINE = re.compile(
    r'(\[Web발신\]|\(광고\)|알림톡|고객님|무료 ?특강|수신거부|'
    r'구독하기|본 메일은|주문하신|배송|결제하신)')


def norm(s):
    s = unicodedata.normalize('NFC', s or '')
    s = s.replace('￼', ' ').replace('​', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def mask(t):
    for p, r in MASK:
        t = p.sub(r, t)
    return re.sub(r'\s+', ' ', t).strip()


def kill_reason(t):
    for p, why in NUMBER_KILL:
        if p.search(t):
            return why
    vals = CRED_VALUE.findall(t)
    if CRED_WORDS.search(t) and vals:
        return '자격증명'
    if len(vals) >= ACCOUNT_LIST:
        return '계정목록'
    if NOT_MINE.search(t):
        return '내가 쓴 글 아님'
    return None


def run(src, dst, report=None):
    keep, drop = [], []
    with open(src, encoding='utf-8') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            raw = norm(row.get('text'))
            if len(raw) < MINLEN:
                drop.append((row['created_at'], '너무 짧음', raw[:40])); continue
            t = mask(raw)
            why = kill_reason(t)
            if why:
                drop.append((row['created_at'], why, raw[:40])); continue
            body = re.sub(r'(\s*\[링크\]\s*)+', ' ', t).strip()
            if len(body) < MINLEN:
                drop.append((row['created_at'], '링크뿐', raw[:40])); continue
            keep.append({'created_at': row['created_at'],
                         'char_count': len(t), 'text': t[:MAXLEN]})

    with open(dst, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, ['created_at', 'char_count', 'text'], delimiter='\t')
        w.writeheader(); w.writerows(keep)

    print(f'남김 {len(keep)}   버림 {len(drop)}')
    for r, n in Counter(d[1] for d in drop).most_common():
        print(f'   {r:16s} {n}')
    if report:
        with open(report, 'w', encoding='utf-8', newline='') as f:
            w = csv.writer(f, delimiter='\t')
            w.writerow(['created_at', 'reason', 'preview']); w.writerows(drop)
        print(f'\n버린 목록 → {report}  (앞 40자만)')
    print('\n버린 목록을 한 번 훑어보세요. 남아 있으면 안 되는 게 남았는지,')
    print('버리면 안 되는 게 버려졌는지는 사람만 판단할 수 있습니다.')


if __name__ == '__main__':
    run(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
