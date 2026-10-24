#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
(하위호환용) 코어에 그때 쓴 글을 붙입니다 — 이제 run_gyeol.py 가 직접 합니다.

    python3 run_gyeol.py          ← 이것 하나면 됩니다

이미 만들어 둔 out/gyeol_wall.html 에 원문만 다시 붙이고 싶을 때를 위해 남겨 둡니다.
원칙 v6 적용과 한 묶음이라(전에는 add_relics → apply_principles 순서로 같은 파일을 덮어씀)
벽에는 원칙 v6 도 함께 입힙니다. 처리 내용은 gyeol/principles.py 에 있습니다.
"""
from __future__ import annotations
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)      # 키트 최상단 (data/ · out/ 가 있는 곳)
sys.path.insert(0, HERE)

from gyeol import principles      # noqa: E402

WALL = os.path.join(ROOT, 'out', 'gyeol_wall.html')


def main():
    print('⚠ add_relics.py 는 run_gyeol.py 에 흡수됐습니다. 다음부터는 run_gyeol.py 하나만 돌리세요.\n')
    if not os.path.exists(WALL):
        sys.stderr.write('\n out/gyeol_wall.html 이 없습니다. run_gyeol.py 를 돌려주세요.\n\n')
        return 1
    relics = principles.load_relics(os.path.join(ROOT, 'data'))
    if not relics:
        return 1
    principles.apply_to_wall(WALL, relics)
    print(f'\n완성: {WALL}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
