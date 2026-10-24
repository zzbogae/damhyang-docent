#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
(하위호환용) 원칙 v6 적용 — 이제 run_gyeol.py 가 직접 합니다.

    python3 run_gyeol.py          ← 이것 하나면 됩니다

이 파일은 이미 만들어 둔 out/gyeol_wall.html · gyeol_data.json 에
원칙 v6(봉인 걷기·회복 서사 빼기·원문 붙이기)만 다시 입히고 싶을 때를 위해 남겨 둡니다.
처리 내용은 gyeol/principles.py 에 있습니다.
"""
from __future__ import annotations
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)      # 키트 최상단 (data/ · out/ 가 있는 곳)
sys.path.insert(0, HERE)

from gyeol import principles      # noqa: E402

WALL = os.path.join(ROOT, 'out', 'gyeol_wall.html')
DATA = os.path.join(ROOT, 'gyeol_data.json')


if __name__ == '__main__':
    print('⚠ apply_principles.py 는 run_gyeol.py 에 흡수됐습니다. 다음부터는 run_gyeol.py 하나만 돌리세요.\n')
    R = principles.load_relics(os.path.join(ROOT, 'data'))
    print(f'원문      {sum(len(v["q"]) for v in R.values())}개 · {len(R)}주\n')
    principles.apply_to_data(DATA, R)
    principles.apply_to_wall(WALL, R)
    print('\n완료. 왜 말수를 줄였는지는 화면에 적지 않습니다.')
