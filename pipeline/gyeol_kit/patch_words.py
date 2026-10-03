#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_words.py — 화면문구 규칙 v3 확정안을 원본 코드에 반영합니다.

    python3 patch_words.py <키트폴더>            # 보기만
    python3 patch_words.py <키트폴더> --apply    # 실제로 고침

근거 — 260911_MineD_화면문구_규칙_v3 (창 B 확정 2026.09.12)

고치는 것
  gyeol_app.html        근거 줄 (세는 자리)
  gyeol/report.py       TIER_KO 3종 · 터미널 2줄 · 리포트 HTML 4곳
  gyeol/judge.py        reason 1줄
  gyeol/analyzer_v3.py  reason 1줄  ← 비노출 기본값으로
  gyeol/rolling_baseline.py  reason 1줄  ← 위와 같은 문장

안 고치는 것
  out/ 안의 생성물 — report.py 를 고치고 다시 돌리면 같이 바뀝니다
  주석·독스트링·내부 .md 보고서 — §2-2 「내부 문서는 그대로」
  docs/START_HERE.html — 팀 안내서지 앱 화면이 아닙니다
"""
from __future__ import annotations
import os
import re
import shutil
import sys

TQ = chr(34) * 3
SQ = chr(39) * 3

# ── 확정 문안 (v3) ──────────────────────────────────────────
GRADE = {
    'held':         '그 뒤 4주는 평소 범위였습니다',
    'returned':     '돌아왔지만 그 뒤는 확인되지 않았습니다',
    'open':         '이 주 뒤는 아직 확인되지 않았습니다',
    'insufficient': '기록이 비어 판정할 수 없습니다',
}
# 세는 자리에 쓰는 명사구
HELD_NOUN     = '그 뒤 4주가 평소 범위였던 주'
RETURNED_NOUN = '평소 범위로 돌아왔지만 그 뒤는 확인 안 된 주'
# 근거가 얇을 때
THIN_LI   = '이 주들은 한 지표에만 기대고 있어서, 그 뒤가 어땠는지는 말하지 않았습니다.'
THIN_LEAD = '확인되지 않은 것을 확인되었다고 말하지 않습니다. 네 단계로 구분합니다.'
# reason
REASON_ONE  = ('이 시기엔 {only} 기록만 남아 있습니다 — '
               '한 지표만으로는 그 뒤가 어땠는지 말하지 않습니다')
REASON_HOLD = '그 뒤가 평소 범위였는지는 아직 확인되지 않았습니다'

# ── 교체표 ──────────────────────────────────────────────────
# (파일, 설명, 정규식, 치환, 최소 기대 건수)
EDITS = [
    # ① 앱 — 세는 자리. 「전체 판정 N건」 → 「살펴본 N주 중 M주」
    ('gyeol_app.html', '근거 줄 — 판정/건 교체',
     re.compile(r"근거: 전체 판정 \$\{WEEKS\.length\}건 중 '[^']*' \$\{rec\}건"),
     "근거: 살펴본 ${WEEKS.length}주 중 '" + HELD_NOUN + "' ${rec}주", 1),

    # ② report.py — TIER_KO. 키로 잡습니다. 값이 뭐든 갈아끼웁니다.
    ('gyeol/report.py', 'TIER_KO recovered',
     re.compile(r"('recovered'\s*:\s*)'[^']*'"),
     lambda m: m.group(1) + "'" + GRADE['held'] + "'", 1),
    ('gyeol/report.py', 'TIER_KO passed',
     re.compile(r"('passed'\s*:\s*)'[^']*'"),
     lambda m: m.group(1) + "'" + GRADE['returned'] + "'", 1),
    ('gyeol/report.py', 'TIER_KO observed',
     re.compile(r"('observed'\s*:\s*)'[^']*'"),
     lambda m: m.group(1) + "'" + GRADE['open'] + "'", 0),

    # ③ report.py — 터미널 두 줄. 어휘를 화면과 맞춥니다.
    ('gyeol/report.py', '터미널 집계 — recovered',
     re.compile(r"print\(f'\s*지나갔고 그 뒤가 이어짐\s*\{len\(t\[\"recovered\"\]\):>4\}건'\)"),
     'print(f\'   ' + HELD_NOUN + '  {len(t["recovered"]):>4}주\')', 1),
    ('gyeol/report.py', '터미널 집계 — passed',
     re.compile(r"print\(f'\s*지나갔지만 확인 안 됨\s*\{len\(t\[\"passed\"\]\):>4\}건'\)"),
     'print(f\'   ' + RETURNED_NOUN + '  {len(t["passed"]):>4}주\')', 1),

    # ④ report.py — 리포트 HTML
    ('gyeol/report.py', '근거 얇음 <li>',
     re.compile(r"이 주들은 그 한 지표에 판정이 좌우되므로 회복 여부를 말하지 않았습니다\."),
     THIN_LI, 1),
    ('gyeol/report.py', '근거 얇음 lead',
     re.compile(r"회복을 확신할 수 없으면 회복이라고 말하지 않습니다\. 세 단계로만 구분합니다\."),
     THIN_LEAD, 1),
    ('gyeol/report.py', '<span> 집계 — 지나갔고 이어진 주',
     re.compile(r"<span>지나갔고 이어진 주</span>"),
     '<span>' + HELD_NOUN + '</span>', 1),
    ('gyeol/report.py', '<span> 집계 — 지나갔고, 그 뒤가 이어짐',
     re.compile(r"<span>지나갔고, 그 뒤가 이어짐</span>"),
     '<span>' + HELD_NOUN + '</span>', 1),
    ('gyeol/report.py', '<span> 집계 — 지나갔지만 확인 안 됨',
     re.compile(r"<span>지나갔지만 확인 안 됨</span>"),
     '<span>' + RETURNED_NOUN + '</span>', 1),

    # ⑤ judge.py — 앱까지 가는 reason
    ('gyeol/judge.py', 'reason — 한 지표만',
     re.compile(r"이 시기엔 \{only\} 기록만 남아 있습니다 — 한 지표만으로는 회복을 말하지 않습니다"),
     REASON_ONE, 1),

    # ⑥ 비노출 기본값. 화면에 나갈 자리가 아직 없지만,
    #    새면 안 되는 문장이라 확정 문안으로 바꿔 둡니다.
    ('gyeol/analyzer_v3.py', 'reason — 비노출 기본값',
     re.compile(r"'지표가 충분히 오래 안정되지 않음 — 회복을 단정하지 않음'"),
     "'" + REASON_HOLD + "'", 1),
    ('gyeol/rolling_baseline.py', 'reason — 비노출 기본값',
     re.compile(r"'지표가 충분히 오래 안정되지 않음 — 회복을 단정하지 않음'"),
     "'" + REASON_HOLD + "'", 1),
]

# 이미 반영됐는지 보는 표식 (파일별)
DONE = {
    'gyeol_app.html':           '살펴본 ',
    'gyeol/report.py':          HELD_NOUN,
    'gyeol/judge.py':           '그 뒤가 어땠는지 말하지 않습니다',
    'gyeol/analyzer_v3.py':     REASON_HOLD,
    'gyeol/rolling_baseline.py': REASON_HOLD,
}


def find(kit, rel):
    """키트 어디에 있든 찾습니다. code/ 아래일 수도, 루트일 수도."""
    for cand in (os.path.join(kit, rel), os.path.join(kit, 'code', rel)):
        if os.path.isfile(cand):
            return cand
    base = os.path.basename(rel)
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if d not in {'out', 'data', '_구버전', '__pycache__',
                                    '_backup_판정v2', '_backup_문구'}]
        if base in filenames:
            return os.path.join(dirpath, base)
    return None


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
    backup = os.path.join(kit, '_backup_문구v3')

    # 파일별로 모아서 한 번에 씁니다
    by_file = {}
    for rel, desc, rx, rep, need in EDITS:
        by_file.setdefault(rel, []).append((desc, rx, rep, need))

    L = []
    A = L.append
    A('# 화면문구 v3 반영')
    A('')
    A('`patch_words.py` · ' + ('**실제로 고쳤습니다**' if apply
                               else '보기만 했습니다 (아무것도 안 고쳤습니다)'))
    A('')
    A('> 근거: 260911_MineD_화면문구_규칙_v3 (창 B 확정)')
    A('')

    total_ok = total_miss = 0
    A('## 1. 줄별 결과')
    A('')
    A('| 파일 | 고친 것 | 건수 |')
    A('|---|---|---|')
    problems = []

    for rel, items in by_file.items():
        path = find(kit, rel)
        if path is None:
            A(f'| `{rel}` | **파일을 못 찾았습니다** | — |')
            problems.append(f'`{rel}` 를 못 찾았습니다')
            continue
        src = open(path, encoding='utf-8').read()
        new = src
        done_mark = DONE.get(rel)
        already = bool(done_mark and done_mark in src)

        for desc, rx, rep, need in items:
            cand = rx.sub(rep, new)
            n = len(rx.findall(new))
            if n and cand != new:
                new = cand
                total_ok += n
                A(f'| `{rel}` | {desc} | {n} |')
            elif n:
                # 정규식은 걸렸지만 바꿔도 그대로 — 이미 확정 문안입니다
                A(f'| `{rel}` | {desc} | 이미 반영 |')
            elif already:
                A(f'| `{rel}` | {desc} | 이미 반영 |')
            elif need == 0:
                A(f'| `{rel}` | {desc} | 없음 (선택) |')
            else:
                total_miss += 1
                A(f'| `{rel}` | **{desc} — 못 찾음** | 0 |')
                problems.append(f'`{rel}` — {desc}')

        if apply and new != src:
            os.makedirs(backup, exist_ok=True)
            shutil.copy2(path, os.path.join(backup, os.path.basename(path)))
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new)
    A('')
    if apply and os.path.isdir(backup):
        A(f'> 원본은 `_backup_문구v3/` 에 있습니다.')
        A('')

    # ── 2. 남은 금지어 ─────────────────────────────────────
    A('## 2. 원본에 남은 금지어')
    A('')
    rx = re.compile(r'지나갔|회복')
    cmt = re.compile(r'^\s*(#|//|/\*|\*|<!--)')
    rows = []
    for dirpath, dirnames, filenames in os.walk(kit):
        dirnames[:] = [d for d in dirnames
                       if d not in {'out', 'data', '_구버전', '__pycache__',
                                    'node_modules', '.git',
                                    '_backup_판정v2', '_backup_문구',
                                    '_backup_문구v3'}]
        for fn in filenames:
            if not fn.endswith(('.html', '.js', '.mjs', '.py')):
                continue
            if fn in {'patch_app.py', 'patch_words.py', 'scan_app.py',
                      '_new_axes.py', '_new_build.py'}:
                continue
            p = os.path.join(dirpath, fn)
            rel = os.path.relpath(p, kit)
            try:
                txt = open(p, encoding='utf-8').read()
            except Exception:                                   # noqa: BLE001
                continue
            for i, line in enumerate(txt.splitlines(), 1):
                m = rx.search(line)
                if not m:
                    continue
                a0 = m.start()
                # 줄 끝 주석 안이면 화면이 아닙니다 (# 이 매치보다 앞)
                hx, sx = line.find('#'), line.find('//')
                inline_cmt = ((0 <= hx < a0 and fn.endswith('.py'))
                              or (0 <= sx < a0 and not fn.endswith('.py')))
                st = line.strip()
                is_doc = any(st.startswith(q) or st.endswith(q)
                             for q in (TQ, SQ))
                if '이미 한 번 여기를 지나갔' in line:
                    tag = '모토 — 예외'
                elif cmt.match(line) or inline_cmt:
                    tag = '주석'
                elif is_doc:
                    tag = '독스트링'
                elif fn in {'compare_specs.py'}:
                    tag = '내부 보고서'
                elif fn == 'START_HERE.html':
                    tag = '팀 안내서 — 앱 화면 아님'
                else:
                    tag = ''
                a, b = m.start(), m.end()
                snip = ('…' if a > 24 else '') + line[max(0, a-24):b+24].strip()
                rows.append((rel, i, snip, tag))
    real = [r for r in rows if not r[3]]
    A(f'**표시 없는 것 {len(real)}곳** (주석·모토·내부문서 {len(rows)-len(real)}곳 제외)')
    A('')
    if real:
        A('```')
        for rel, i, snip, _t in real[:30]:
            A(f'{rel}:{i}')
            A(f'    {snip}')
        if len(real) > 30:
            A(f'… 외 {len(real)-30}곳')
        A('```')
        A('')
        A('> 남은 것은 대부분 독스트링·설명문입니다. 화면에 나가는지 '
          '한 줄씩 보셔야 합니다.')
    else:
        A('원본에 화면용 금지어가 없습니다.')
    A('')

    # ── 3. 남은 일 ────────────────────────────────────────
    A('## 3. 아직 안 끝난 것')
    A('')
    A('1. **`out/*.html` 다시 찍기** — `report.py` 를 고쳤으니 리포트를 '
      '다시 만들어야 새 문구가 나옵니다. 지금 `out/` 안의 것은 옛 문구입니다')
    A('2. **진짜 비노출** — `analyzer_v3.py` · `rolling_baseline.py` 의 '
      '`reason` 은 문장만 확정안으로 바꿨습니다. 앱이 안 그리게 하려면 '
      '그리는 자리를 찾아야 합니다. 아직 안 봤습니다')
    A('3. **판정 모듈 셋** — `judge.py` · `analyzer_v3.py` · '
      '`rolling_baseline.py` 가 같은 일을 나눠 갖고 있습니다. '
      '어느 게 실제로 도는지 확인이 필요합니다')
    A('')

    if problems:
        A('## ⚠ 못 찾은 줄')
        A('')
        for p in problems:
            A(f'- {p}')
        A('')
        A('파일이 그새 바뀌었을 수 있습니다. 이 목록을 보여주세요.')
        A('')

    md = os.path.join(out_dir, 'words_v3.md')
    with open(md, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n  ✅ {md}')
    print(f'  고친 줄 {total_ok} · 못 찾은 줄 {total_miss} · '
          f'남은 금지어 {len(real)}곳')
    if not apply:
        print('  (보기만 했습니다. 실제로 고치려면 --apply)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
