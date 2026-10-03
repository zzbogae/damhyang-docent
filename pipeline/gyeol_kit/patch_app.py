#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_app.py — 앱의 화면 문구를 확정 문안으로 바꿉니다.

    python3 patch_app.py <키트폴더>            # 보기만 (아무것도 안 고침)
    python3 patch_app.py <키트폴더> --apply    # 실제로 고침

근거 — 260911_MineD_화면문구_규칙 (창 B) · 확정기록 v2 GRADE_TEXT

고치는 것
  gyeol_app.html  tierLabel 객체  → 확정 4종 문안
  gyeol_app.html  근거 줄의 '지나갔고 이어짐'

안 고치는 것
  out/ 안의 것 — 생성물입니다. 다시 돌리면 되돌아옵니다.
  내부 문서·변수명 — 금지는 화면에 나가는 문장에만 걸립니다.
"""
from __future__ import annotations
import os
import re
import shutil
import sys

SKIP_DIRS = {'out', 'data', '_구버전', '_backup_판정v2', '_backup_문구',
             'node_modules', '.git', '__pycache__'}
SRC_EXTS = ('.html', '.js', '.mjs', '.py')

# 이 도구들 자신은 안 봅니다. 교체 문안을 본문에 들고 있어서
# 안 빼면 자기 표를 자기가 덮어씁니다.
SKIP_FILES = {'patch_app.py', 'scan_app.py', 'scan_words.py',
              '_new_axes.py', '_new_build.py'}

# 주석 줄은 화면에 안 나갑니다 — 금지 대상이 아닙니다.
COMMENT = re.compile(r'^\s*(#|//|/\*|\*|<!--)')

# ── 확정 문안 ────────────────────────────────────────────────
# axes.py GRADE_TEXT 와 같은 문장입니다. 한 군데서만 고치도록
# 여기 적어 둡니다 — 앱은 파이썬을 못 읽으니까요.
GRADE = {
    'held':         '그 뒤 4주는 평소 범위였습니다',
    'returned':     '돌아왔지만 그 뒤는 확인되지 않았습니다',
    'open':         '이 주 뒤는 아직 확인되지 않았습니다',
    'insufficient': '기록이 비어 판정할 수 없습니다',
}

# 앱 tier 3종 ↔ 스펙 등급 4종.
#   recovered → held      확실합니다
#   passed    → returned  확실합니다 (둘 다 「돌아왔지만 뒤가 미확인」)
#   observed  → open      [추정] — 「관찰만」이 open 인지 insufficient 인지
#                         창 B 확인이 필요합니다. 지금은 open 으로 둡니다.
TIER_MAP = {'recovered': 'held', 'passed': 'returned', 'observed': 'open'}

# 세는 자리에 쓸 짧은 이름. 문장이 아니라 명사구라 따로 둡니다.
# 확정 문장 「그 뒤 4주는 평소 범위였습니다」에서 끌어온 것이고,
# 새로 지어낸 문장이 아닙니다. 그래도 창 B 승인 대상입니다.
HELD_NOUN = '그 뒤가 평소 범위였던 주'

# ── 정확히 이 줄만 바꿉니다 ──────────────────────────────────
EDITS = [
    (
        "tierLabel 객체",
        "const tierLabel = {recovered:'지나갔고 그 뒤가 이어짐', "
        "passed:'지나갔지만 확인 안 됨', observed:'관찰만'}[w.tier] || '';",
        "const tierLabel = {"
        + ", ".join("%s:'%s'" % (t, GRADE[g]) for t, g in TIER_MAP.items())
        + "}[w.tier] || '';",
    ),
    (
        "근거 줄",
        "'지나갔고 이어짐'",
        "'%s'" % HELD_NOUN,
    ),
]

# 고쳤는지 확인할 때 쓰는 표식
DONE_MARK = GRADE['held']


def find_roots(kit):
    out = []
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            if fn.endswith(SRC_EXTS) and fn not in SKIP_FILES:
                out.append(os.path.join(dirpath, fn))
    return out


def redact(line, m, pad=24):
    """걸린 단어 앞뒤 pad 글자만 남깁니다. 기록이 딸려 나오지 않게."""
    a, b = m.start(), m.end()
    head = line[max(0, a - pad):a]
    tail = line[b:b + pad]
    pre = '…' if a - pad > 0 else ''
    post = '…' if b + pad < len(line) else ''
    return (pre + head + '【' + line[a:b] + '】' + tail + post).strip()


def main():
    if len(sys.argv) < 2:
        print('[X] 키트 폴더를 알려주세요.')
        return 1
    kit = os.path.abspath(sys.argv[1])
    apply = '--apply' in sys.argv
    if not os.path.isdir(kit):
        print(f'[X] {kit} 가 없습니다.')
        return 1

    out_dir = os.environ.get('PATCH_OUT') or os.path.join(kit, 'out')
    os.makedirs(out_dir, exist_ok=True)
    backup = os.path.join(kit, '_backup_문구')

    src = find_roots(kit)
    print(f'▸ 원본 파일 {len(src)}개 (out/ · data/ · _구버전 제외)')

    L = []
    A = L.append
    A('# 화면 문구 패치')
    A('')
    A('`patch_app.py` · ' + ('**실제로 고쳤습니다**' if apply
                             else '보기만 했습니다 (아무것도 안 고쳤습니다)'))
    A('')
    A('> `out/` 안의 생성물은 건드리지 않습니다. 다시 돌리면 새 문구로 나옵니다.')
    A('')

    # ── 1. 교체 ─────────────────────────────────────────────
    A('## 1. 교체')
    A('')
    changed, already, missing = [], [], []
    for path in src:
        try:
            txt = open(path, encoding='utf-8').read()
        except Exception:                                       # noqa: BLE001
            continue
        rel = os.path.relpath(path, kit)
        new = txt
        hits = []
        for name, old, repl in EDITS:
            if old in new:
                new = new.replace(old, repl)
                hits.append(name)
        if not hits:
            if DONE_MARK in txt:
                already.append(rel)
            continue
        changed.append((rel, hits))
        if apply:
            os.makedirs(backup, exist_ok=True)
            shutil.copy2(path, os.path.join(backup, os.path.basename(path)))
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)

    if changed:
        for rel, hits in changed:
            A(f'- `{rel}` — {" · ".join(hits)}')
    if already:
        for rel in already:
            A(f'- `{rel}` — 이미 반영돼 있습니다. 안 건드렸습니다')
    if not changed and not already:
        A('**바꿀 줄을 못 찾았습니다.** 파일이 그새 바뀐 것 같습니다. '
          '아래 ②를 보고 알려주세요.')
    A('')
    if changed and apply:
        A(f'> 원본은 `_backup_문구/` 에 있습니다.')
        A('')

    A('바뀐 문안')
    A('')
    A('| 앱 `tier` | 스펙 등급 | 문장 |')
    A('|---|---|---|')
    for t, g in TIER_MAP.items():
        star = ' [추정]' if t == 'observed' else ''
        A(f'| `{t}` | `{g}`{star} | {GRADE[g]} |')
    A(f'| — | `insufficient` | {GRADE["insufficient"]} — 앱에 자리가 없습니다 |')
    A('')

    # ── 2. 남은 금지어 ──────────────────────────────────────
    A('## 2. 원본에 남은 금지어')
    A('')
    A('앞뒤 24자만 보여줍니다. 기록이 딸려 나오지 않게 잘랐습니다.')
    A('')
    rx = re.compile(r'지나갔|회복')
    rows = []
    for path in src:
        try:
            txt = open(path, encoding='utf-8').read()
        except Exception:                                       # noqa: BLE001
            continue
        rel = os.path.relpath(path, kit)
        for i, line in enumerate(txt.splitlines(), 1):
            m = rx.search(line)
            if not m:
                continue
            if '이미 한 번 여기를 지나갔' in line:
                tag = '모토 — 예외'
            elif COMMENT.match(line):
                tag = '주석 — 화면에 안 나감'
            else:
                tag = ''
            rows.append((rel, i, redact(line, m), tag))
    real = [r for r in rows if not r[3]]
    if not rows:
        A('**없습니다.** 원본은 깨끗합니다.')
    elif not real:
        A(f'**고칠 곳은 없습니다.** 걸린 {len(rows)}곳은 전부 주석이거나 '
          '서비스 모토입니다.')
    else:
        A(f'**고칠 곳 {len(real)}곳** (주석·모토 {len(rows)-len(real)}곳은 뺀 수)')
        A('')
        A('```')
        for rel, i, snip, tag in rows[:40]:
            A(f'{rel}:{i}' + (f'   [{tag}]' if tag else ''))
            A(f'    {snip}')
        if len(rows) > 40:
            A(f'… 외 {len(rows)-40}곳')
        A('```')
    A('')

    # ── 3. 생성기 찾기 ──────────────────────────────────────
    A('## 3. 리포트를 찍어내는 곳')
    A('')
    A('`out/*.html` 은 생성물입니다. 문구를 고치려면 찍어내는 쪽을 고칩니다.')
    A('')
    gen = []
    grx = re.compile(r'gyeol_report|sample_report|gyeol_wall|persona_compare'
                     r'|demo_app')
    for path in src:
        if not path.endswith('.py'):
            continue
        try:
            txt = open(path, encoding='utf-8').read()
        except Exception:                                       # noqa: BLE001
            continue
        rel = os.path.relpath(path, kit)
        for i, line in enumerate(txt.splitlines(), 1):
            m = grx.search(line)
            if m:
                gen.append((rel, i, redact(line, m)))
    if not gen:
        A('`.py` 안에서 못 찾았습니다. 리포트가 딴 데서 만들어지거나, '
          '이미 만들어 놓고 안 돌리는 것일 수 있습니다.')
    else:
        A('```')
        for rel, i, snip in gen[:25]:
            A(f'{rel}:{i}')
            A(f'    {snip}')
        if len(gen) > 25:
            A(f'… 외 {len(gen)-25}곳')
        A('```')
    A('')

    # ── 4. 창 B 로 넘길 것 ──────────────────────────────────
    A('## 4. 창 B 확인이 필요한 것')
    A('')
    A(f'1. `observed` 가 `open` 인지 `insufficient` 인지 — 지금은 `open` [추정]')
    A(f'2. 세는 자리 명사구 「{HELD_NOUN}」 — 확정 문장에서 끌어왔지만 '
      '문장은 창 B 소관입니다')
    A('3. `근거: 전체 **판정** N건` — 화면에 「판정」이 그대로 나옵니다. '
      '「판정·해석·진단하지 않는다」와 부딪칩니다')
    A(f'4. `insufficient` 는 앱에 자리가 없습니다 — 넣을지')
    A('')

    path_md = os.path.join(out_dir, 'app_patch.md')
    with open(path_md, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n  ✅ {path_md}')
    print(f'  교체 {len(changed)}파일 · 이미 반영 {len(already)}파일 · '
          f'고칠 금지어 {len(real)}곳 (주석·모토 {len(rows)-len(real)}곳 제외)')
    if not apply:
        print('  (보기만 했습니다. 실제로 고치려면 --apply 를 붙이세요)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
