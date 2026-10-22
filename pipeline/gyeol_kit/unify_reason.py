#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
unify_reason.py — 사유 문장을 axes.py 한 곳으로 모읍니다.

    python3 unify_reason.py <키트폴더>            # 보기만
    python3 unify_reason.py <키트폴더> --apply    # 실제로 고침

왜 — 같은 상황에 문장이 두 벌이면 버그입니다.
judge.py · analyzer_v3.py · rolling_baseline.py 가 「근거가 얇다」는
같은 상황에 각자 문장을 들고 있습니다. 어느 모듈이 도는지에 따라
화면이 달라지는데, 사용자는 그걸 고를 수 없습니다.

하는 일 — 문장 리터럴을 axes.reason_text() 호출로 바꾸고,
필요하면 import 한 줄을 넣습니다. 문장 자체는 안 바뀝니다.
"""
from __future__ import annotations
import ast
import os
import re
import shutil
import sys

IMPORT_LINE = 'from .axes import reason_text\n'
TQ = chr(34) * 3
SQ = chr(39) * 3

# (파일, 설명, 찾을 정규식, 바꿀 것)
EDITS = [
    ('judge.py', 'reason — 근거 계열 하나',
     re.compile(r"f'이 시기엔 \{only\} 기록만 남아 있습니다 — "
                r"한 지표만으로는 그 뒤가 어땠는지 말하지 않습니다'"),
     "reason_text('one_family', only=only)"),
    ('analyzer_v3.py', 'reason — 아직 확인 안 됨',
     re.compile(r"'그 뒤가 평소 범위였는지는 아직 확인되지 않았습니다'"),
     "reason_text('not_held')"),
    ('rolling_baseline.py', 'reason — 아직 확인 안 됨',
     re.compile(r"'그 뒤가 평소 범위였는지는 아직 확인되지 않았습니다'"),
     "reason_text('not_held')"),
]


def find_pkg(kit):
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('_backup') and d not in {'out', 'data', '_구버전', '__pycache__'}]
        if os.path.basename(dirpath) == 'gyeol' and 'axes.py' in filenames:
            return dirpath
    return None


def add_import(src):
    """import 를 안전한 자리에 넣습니다. 이미 있으면 그대로.

    자리 규칙 — 파이썬 문법 트리(ast)로 **마지막 최상위 import 가 끝나는 줄**을
    찾아 그 다음에 넣습니다. 글자만 보고 찾으면
        from .channels import (
            A, B,
        )
    같이 여러 줄에 걸친 import 의 괄호 안으로 들어가 파일이 깨집니다.
    (실제로 rolling_baseline.py 에서 그렇게 깨졌습니다 · 2026.09.19)
    """
    if 'from .axes import reason_text' in src:
        return src, False
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return src, False

    at = 0
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            at = node.end_lineno
        elif (isinstance(node, ast.Expr)
              and isinstance(node.value, ast.Constant)
              and isinstance(node.value.value, str)):
            at = max(at, node.end_lineno)      # 모듈 독스트링
        else:
            break                              # 코드가 시작되면 멈춥니다

    lines = src.split('\n')
    lines.insert(at, IMPORT_LINE.rstrip('\n'))
    return '\n'.join(lines), True


def main():
    if len(sys.argv) < 2:
        print('[X] 키트 폴더를 알려주세요.')
        return 1
    kit = os.path.abspath(sys.argv[1])
    apply = '--apply' in sys.argv
    pkg = find_pkg(kit)
    if pkg is None:
        print('[X] gyeol/ 패키지를 못 찾았습니다.')
        return 1

    out_dir = os.environ.get('UNIFY_OUT') or os.path.join(
        os.path.dirname(pkg), 'out')
    os.makedirs(out_dir, exist_ok=True)
    backup = os.path.join(os.path.dirname(pkg), '_backup_사유통일')

    L = []
    A = L.append
    A('# 사유 문장 통일')
    A('')
    A('`unify_reason.py` · ' + ('**실제로 고쳤습니다**' if apply
                                else '보기만 했습니다'))
    A('')
    A('> 같은 상황에 문장이 두 벌이면 버그입니다. 정본은 `gyeol/axes.py` 의 '
      '`REASON` 한 곳입니다.')
    A('')

    # ── 0. axes.py 에 정본이 있는지 ─────────────────────────
    ax = os.path.join(pkg, 'axes.py')
    axsrc = open(ax, encoding='utf-8').read()
    has_reason = 'def reason_text' in axsrc and 'REASON = {' in axsrc
    A('## 0. 정본')
    A('')
    if has_reason:
        A('`gyeol/axes.py` 에 `REASON` · `reason_text()` 가 있습니다.')
    else:
        A('**`gyeol/axes.py` 에 `REASON` 이 없습니다.** '
          '`mined_fix.sh apply` 를 먼저 돌리세요 — 거기서 axes.py 를 넣습니다.')
        A('')
        with open(os.path.join(out_dir, 'unify.md'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(L))
        print('[X] axes.py 에 REASON 이 없습니다. mined_fix.sh apply 먼저.')
        return 1
    A('')

    # ── 1. 교체 ─────────────────────────────────────────────
    A('## 1. 교체')
    A('')
    A('| 파일 | 바꾼 것 | import |')
    A('|---|---|---|')
    ok = miss = 0
    for fn, desc, rx, rep in EDITS:
        path = os.path.join(pkg, fn)
        if not os.path.exists(path):
            A(f'| `{fn}` | **파일 없음** | — |')
            miss += 1
            continue
        src = open(path, encoding='utf-8').read()
        n = len(rx.findall(src))
        if n == 0:
            if 'reason_text(' in src:
                A(f'| `{fn}` | 이미 반영 | — |')
            else:
                A(f'| `{fn}` | **못 찾음** | — |')
                miss += 1
            continue
        new = rx.sub(rep, src)
        new, added = add_import(new)
        try:
            compile(new, fn, 'exec')
        except SyntaxError as e:
            A(f'| `{fn}` | **고치면 문법이 깨집니다 — 안 건드렸습니다** '
              f'({e.lineno}행) | — |')
            miss += 1
            continue
        ok += n
        A(f'| `{fn}` | {desc} · {n}곳 | {"넣음" if added else "이미 있음"} |')
        if apply:
            os.makedirs(backup, exist_ok=True)
            shutil.copy2(path, os.path.join(backup, fn))
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)
    A('')
    if apply and os.path.isdir(backup):
        A('> 원본은 `_backup_사유통일/` 에 있습니다.')
        A('')

    # ── 2. 두 벌이 남았는지 ─────────────────────────────────
    A('## 2. 문장이 두 벌 남았는지')
    A('')
    lit = re.compile(r"'[^']*(그 뒤가 평소 범위였는지는|한 지표만으로는)[^']*'")
    dup = []
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('_backup') and d not in {'out', 'data', '_구버전', '__pycache__',
                                    '_backup_판정v2', '_backup_문구',
                                    '_backup_문구v3', '_backup_사유통일'}]
        for fn in filenames:
            if not fn.endswith('.py') or fn in {'axes.py', 'unify_reason.py',
                                                'patch_words.py', 'patch_app.py'}:
                continue
            p = os.path.join(dirpath, fn)
            try:
                t = open(p, encoding='utf-8').read()
            except Exception:                                   # noqa: BLE001
                continue
            for i, ln in enumerate(t.split('\n'), 1):
                if lit.search(ln) and not ln.strip().startswith('#'):
                    dup.append(f'{os.path.relpath(p, kit)}:{i}')
    if dup:
        A(f'**{len(dup)}곳에 문장이 직접 박혀 있습니다.** 정본을 안 쓰고 있습니다.')
        A('')
        A('```')
        for d in dup[:20]:
            A(d)
        A('```')
    else:
        A('**없습니다.** 사유 문장은 `axes.py` 한 곳에만 있습니다.')
    A('')

    with open(os.path.join(out_dir, 'unify.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n  ✅ {os.path.join(out_dir, "unify.md")}')
    print(f'  바꾼 곳 {ok} · 못 찾은 파일 {miss} · 두 벌 남은 곳 {len(dup)}')
    if not apply:
        print('  (보기만 했습니다. 고치려면 --apply)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
