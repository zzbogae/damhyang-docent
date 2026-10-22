#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
diag_format.py — 카톡 내보내기 파일의 '형식'만 봅니다. 내용은 절대 안 보여줍니다.

    python3 diag_format.py --data "<data 폴더 경로>"

한글 단어·영문 단어·숫자를 전부 X/9로 가려서 길이와 쉼표·따옴표·괄호
위치만 남깁니다. 이 출력은 원문이 아니므로 대화창에 붙여넣으셔도 됩니다.
"""
import argparse, os, re, sys

HANGUL = re.compile(r'[가-힣]+')
LATIN  = re.compile(r'[A-Za-z]+')
DIGIT  = re.compile(r'\d')

def mask(line):
    line = HANGUL.sub(lambda m: 'X' * len(m.group()), line)
    line = LATIN.sub(lambda m: 'x' * len(m.group()), line)
    line = DIGIT.sub('9', line)
    return line

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--n', type=int, default=6, help='파일당 볼 줄 수')
    a = ap.parse_args()

    if not os.path.isdir(a.data):
        print(f'[X] {a.data} 가 없습니다.'); sys.exit(1)

    for root, dirs, files in os.walk(a.data):
        dirs[:] = [d for d in dirs if not d.startswith(('.', '_'))]
        for f in sorted(files):
            if not f.lower().endswith(('.txt', '.csv')):
                continue
            p = os.path.join(root, f)
            print(f'\n===== {f} =====')
            try:
                with open(p, encoding='utf-8', errors='replace') as fh:
                    for i, line in enumerate(fh):
                        if i >= a.n:
                            break
                        print(f'{i}: {mask(line.rstrip(chr(10)))}')
            except Exception as e:
                print(f'  [읽기 실패: {e}]')

if __name__ == '__main__':
    main()
