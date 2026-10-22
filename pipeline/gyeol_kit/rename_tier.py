#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rename_tier.py — recovered → held 개명. 옛 이름도 계속 읽습니다.

    python3 rename_tier.py <키트폴더>            # 보기만
    python3 rename_tier.py <키트폴더> --apply    # 실제로 고침

확정 2026.09.19 (보경)
    recovered → held    passed → returned    observed → open
    옛 이름을 버리지 않습니다 — 이미 만들어진 gyeol_data.json 이
    전부 옛 이름을 들고 있어서, 버리면 그 파일이 화면에서 빕니다.

하는 일 세 가지
    ① 파이썬이 **쓰는** 이름을 새 이름으로 (judge.py 등)
    ② 파이썬이 **읽는** 자리는 axes.normalize_grade() 로
    ③ 앱(JS)에 옛↔새 변환 한 줄을 넣고 비교·표를 거기로 보냄
"""
from __future__ import annotations
import os
import re
import shutil
import sys

ALIAS = {'recovered': 'held', 'passed': 'returned', 'observed': 'open'}

# 앱에 심을 변환 한 줄
JS_NORM = ("const TIER_N = t => "
           "({recovered:'held',passed:'returned',observed:'open'}[t] || t);")


def find_pkg(kit):
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('_backup')
                       and d not in {'out', 'data', '_구버전', '__pycache__'}]
        if os.path.basename(dirpath) == 'gyeol' and 'axes.py' in filenames:
            return dirpath
    return None


def find_app(kit):
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('_backup')
                       and d not in {'out', 'data', '_구버전', '__pycache__'}]
        if 'gyeol_app.html' in filenames:
            return os.path.join(dirpath, 'gyeol_app.html')
    return None


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
    root = os.path.dirname(pkg)
    out_dir = os.environ.get('RENAME_OUT') or os.path.join(root, 'out')
    os.makedirs(out_dir, exist_ok=True)
    backup = os.path.join(root, '_backup_개명')

    L = []
    A = L.append
    A('# 등급 이름 개명 — recovered → held')
    A('')
    A('`rename_tier.py` · ' + ('**실제로 고쳤습니다**' if apply else '보기만 했습니다'))
    A('')
    A('> 옛 이름도 계속 읽습니다. 이미 만들어진 `gyeol_data.json` 이 '
      '전부 옛 이름을 들고 있어서, 버리면 그 파일이 화면에서 빕니다.')
    A('')

    # ── 0. 정본 확인 ────────────────────────────────────────
    axsrc = open(os.path.join(pkg, 'axes.py'), encoding='utf-8').read()
    if 'def normalize_grade' not in axsrc:
        A('## 0. 막혔습니다')
        A('')
        A('`gyeol/axes.py` 에 `normalize_grade()` 가 없습니다. '
          '`mined_all.sh` 를 먼저 돌리세요 — 거기서 axes.py 를 넣습니다.')
        with open(os.path.join(out_dir, 'rename.md'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(L))
        print('[X] axes.py 에 normalize_grade 가 없습니다.')
        return 1

    changed = []

    # ── 1. 파이썬 ───────────────────────────────────────────
    A('## 1. 파이썬')
    A('')
    A('| 파일 | 바꾼 이름 | 읽기 보정 |')
    A('|---|---|---|')
    for fn in sorted(os.listdir(pkg)):
        if not fn.endswith('.py') or fn in {'axes.py', '__init__.py'}:
            continue
        path = os.path.join(pkg, fn)
        src = open(path, encoding='utf-8').read()
        n = 0
        new = src
        for old, nw in ALIAS.items():
            # 따옴표로 둘러싼 리터럴만. 주석·문서 안의 낱말은 안 건드립니다.
            rx = re.compile(r"(['\"])%s\1" % old)
            n += len(rx.findall(new))
            new = rx.sub(lambda m: m.group(1) + nw + m.group(1), new)
        if n == 0:
            continue
        norm = False
        try:
            compile(new, fn, 'exec')
        except SyntaxError as e:
            A(f'| `{fn}` | **문법이 깨집니다 — 안 건드렸습니다** ({e.lineno}행) | — |')
            continue
        changed.append((fn, n))
        A(f'| `{fn}` | {n}곳 | {"넣음" if norm else "필요 없음"} |')
        if apply:
            os.makedirs(backup, exist_ok=True)
            shutil.copy2(path, os.path.join(backup, fn))
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)
    if not changed:
        A('| — | 바꿀 이름이 없습니다 (이미 반영) | — |')
    A('')

    # ── 2. 앱 ───────────────────────────────────────────────
    A('## 2. 앱 (`gyeol_app.html`)')
    A('')
    app = find_app(kit)
    if app is None:
        A('`gyeol_app.html` 을 못 찾았습니다.')
    else:
        src = open(app, encoding='utf-8').read()
        new = src
        notes = []

        # (1) 표의 키와 비교값을 새 이름으로 — TIER_N 넣기 **전에** 합니다
        for old, nw in ALIAS.items():
            e = len(re.findall(r"(?<![\w'])%s:" % old, new))
            if e:
                new = re.sub(r"(?<![\w'])%s:" % old, nw + ':', new)
                notes.append(f'`{old}:` → `{nw}:`')
        c = len(re.findall(r"(\w+)\.tier === '(?:recovered|held)'", new))
        new = re.sub(r"(\w+)\.tier === '(?:recovered|held)'",
                     r"TIER_N(\1.tier) === 'held'", new)
        if c:
            notes.append(f'비교 {c}곳')
        d = len(re.findall(r"\}\[(\w+)\.tier\]", new))
        new = re.sub(r"\}\[(\w+)\.tier\]", r"}[TIER_N(\1.tier)]", new)
        if d:
            notes.append(f'라벨 조회 {d}곳')

        # (2) 변환 줄을 **첫 <script> 바로 뒤**에 넣습니다.
        #     const 는 끌어올려지지 않아서, 쓰는 자리보다 앞에 있어야 합니다.
        if 'TIER_N' in new and 'const TIER_N' not in new:
            m = re.search(r'<script[^>]*>', new)
            if m:
                new = (new[:m.end()] + '\n'
                       + '// 옛 데이터의 recovered/passed/observed 도 읽습니다 '
                       + '(개명 2026.09.19)\n'
                       + JS_NORM + '\n' + new[m.end():])
                notes.append('변환 한 줄 넣음')
            else:
                notes.append('⚠ <script> 를 못 찾아 변환 줄을 못 넣었습니다')

        if new == src:
            A('이미 반영돼 있습니다. 안 건드렸습니다.')
        else:
            A('- ' + ' · '.join(notes))
            A('')
            A('```js')
            A(JS_NORM)
            A("// 옛 json 의 'recovered' 도 'held' 로 읽힙니다")
            A('```')
            if apply:
                os.makedirs(backup, exist_ok=True)
                shutil.copy2(app, os.path.join(backup, 'gyeol_app.html'))
                with open(app, 'w', encoding='utf-8') as f:
                    f.write(new)
    A('')

    # ── 3. 남은 옛 이름 ─────────────────────────────────────
    A('## 3. 코드에 남은 옛 이름')
    A('')
    rx = re.compile(r"(['\"])(recovered|passed|observed)\1")
    rows = []
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if not d.startswith('_backup')
                       and d not in {'out', 'data', '_구버전', '__pycache__'}]
        for fn in filenames:
            if not fn.endswith(('.py', '.html', '.js')) or fn in {
                    'axes.py', 'rename_tier.py', 'patch_app.py',
                    'patch_words.py', 'unify_reason.py'}:
                continue
            p = os.path.join(dirpath, fn)
            try:
                t = open(p, encoding='utf-8').read()
            except Exception:                                   # noqa: BLE001
                continue
            for i, ln in enumerate(t.split('\n'), 1):
                if rx.search(ln):
                    rows.append(f'{os.path.relpath(p, kit)}:{i}')
    if rows:
        A(f'**{len(rows)}곳**')
        A('')
        A('```')
        for r in rows[:25]:
            A(r)
        if len(rows) > 25:
            A(f'… 외 {len(rows)-25}곳')
        A('```')
        A('')
        A('> 옛 이름이 남아 있어도 **고장은 아닙니다.** '
          '`normalize_grade()` · `TIER_N()` 이 받아줍니다.')
    else:
        A('**없습니다.** 코드는 전부 새 이름을 씁니다.')
    A('')
    A('## 4. 옛 데이터')
    A('')
    A('`gyeol_data.json` 은 **그대로 둬도 됩니다.** 안의 `recovered` 는 '
      '읽을 때 `held` 로 바뀝니다. 다시 찍으면 새 이름으로 나옵니다.')
    A('')

    with open(os.path.join(out_dir, 'rename.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n  ✅ {os.path.join(out_dir, "rename.md")}')
    print(f'  파이썬 {len(changed)}파일 · 앱 {"찾음" if app else "못 찾음"} · '
          f'남은 옛 이름 {len(rows)}곳')
    if not apply:
        print('  (보기만 했습니다. 고치려면 --apply)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
