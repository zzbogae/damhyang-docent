#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_patch.py — 캘린더 확정안을 코드에 반영합니다.

확정 (260911_MineD_판정설계_확정기록_v2.md §6)
  캘린더는 세되 말하지 않는다.
    · judge.py   SENTENCE 에서 'cal_events' 삭제   ← 「적었습니다」를 막습니다
    · channels.py FEATURE_DIRECTION 은 그대로      ← 교차검증 계열로는 계속 셉니다

고치기 전에 원본을 _backup_판정v2/ 로 복사합니다.
이미 반영돼 있으면 아무것도 하지 않습니다.
"""
from __future__ import annotations
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.join(HERE, 'gyeol')
BACKUP = os.path.join(HERE, '_backup_판정v2')

TARGET = "    'cal_events':          '잡혀 있던 일정이 평소보다 적었습니다',\n"


def main():
    judge = os.path.join(PKG, 'judge.py')
    if not os.path.exists(judge):
        print(f'[X] {judge} 가 없습니다.')
        return 1

    src = open(judge, encoding='utf-8').read()

    if "'cal_events'" not in src:
        print('[=] judge.py — 이미 반영돼 있습니다. 건드리지 않습니다.')
        return 0

    # 정확한 한 줄을 찾습니다. 못 찾으면 손대지 않습니다.
    line = None
    for ln in src.splitlines(keepends=True):
        if "'cal_events':" in ln and '적었습니다' in ln:
            line = ln
            break
    if line is None:
        print('[X] judge.py 의 SENTENCE 에서 cal_events 줄을 못 찾았습니다.')
        print('    파일이 바뀐 것 같습니다. 직접 확인해 주세요:')
        for i, ln in enumerate(src.splitlines(), 1):
            if 'cal_events' in ln:
                print(f'      {i}: {ln.strip()}')
        return 1

    os.makedirs(BACKUP, exist_ok=True)
    shutil.copy2(judge, os.path.join(BACKUP, 'judge.py'))
    ch = os.path.join(PKG, 'channels.py')
    if os.path.exists(ch):
        shutil.copy2(ch, os.path.join(BACKUP, 'channels.py'))

    out = src.replace(line, '')
    # 흔적을 남깁니다 — 왜 없는지 다음 사람이 알 수 있게
    out = out.replace(
        "SENTENCE = {\n",
        "# 캘린더 문장은 일부러 없습니다 (확정 v2 · 2026.09.11)\n"
        "#   「일정이 평소보다 적었습니다」는 많다·적다를 붙이는 말이라 금지입니다.\n"
        "#   캘린더는 화면에 「그 주에 일정이 N건 있었습니다」만 쓰고,\n"
        "#   뒤에서는 교차검증 계열로 계속 셉니다.\n"
        "SENTENCE = {\n", 1)

    with open(judge, 'w', encoding='utf-8') as f:
        f.write(out)

    print('[OK] judge.py — SENTENCE 에서 cal_events 삭제')
    print(f'     원본은 {BACKUP}/judge.py 에 있습니다')
    print('[=] channels.py — FEATURE_DIRECTION 은 그대로 둡니다 (계열로는 셉니다)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
