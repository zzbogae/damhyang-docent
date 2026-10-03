#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scan_app.py — 앱을 훑어서 「무엇을 어디서 고쳐야 하는지」만 뽑습니다.

    python3 scan_app.py ~/Desktop/gyeol_kit [더 볼 폴더 ...]

앱 파일을 올리지 않아도 됩니다. 나가는 건 out/app_scan.md 한 장이고,
거기엔 코드 줄 번호와 짧은 조각만 들어갑니다. 기록은 안 들어갑니다.

찾는 것
  ① pickGem  — 정의와 호출 자리 (교체 지점)
  ② 광물 이름이 박힌 곳
  ③ tier / grade 문자열을 화면에 그리는 곳   ← 창 B 질문
  ④ 금지어 — 「지나갔」 「회복」 「recovered」
  ⑤ 주 객체에서 실제로 읽는 필드
"""
from __future__ import annotations
import os
import re
import sys

SKIP_DIRS = {'_구버전', 'node_modules', '.git', '__pycache__', 'data', '_backup_판정v2'}
EXTS = ('.html', '.js', '.mjs', '.css')
MAX_LINE = 110

GEMS = ['obsidian', 'amethyst', 'lapis', 'amber', 'fluorite',
        'garnet', 'moonstone', 'pyrite', 'rose']

# 서비스 모토는 금지어에서 빼 둡니다 (창 B 확정 · 예외)
MOTTO = re.compile(r'이미\s*한\s*번\s*여기를\s*지나갔')

# 화면에 그리는 것으로 보이는 줄 — 변수로만 쓰는 줄과 가릅니다
DRAWS = re.compile(
    r'textContent|innerHTML|innerText|insertAdjacent|appendChild|'
    r'createTextNode|\.text\(|\.html\(|document\.write|'
    r'<[a-zA-Z][^>]*>|\$\{|label|caption|aria-label')

PATTERNS = [
    ('pickgem',  re.compile(r'pickGem')),
    ('gemdata',  re.compile(r'MINERAL_COLOR|GEMS\b|gems\.js|gem-|--gem-')),
    ('tier',     re.compile(r"\btier\b|\bgrade\b|recovered|returned_unconfirmed|insufficient|passed|observed")),
    ('banned',   re.compile(r'지나갔|회복')),
    ('dataload', re.compile(r'gyeol_data\.json|gyeol_axes\.json|STAGE|stage-data')),
    ('axisfield', re.compile(r'\bz52\b|\bz8\b|dominant_axis|cross_validated|evidence_families|badges')),
]

LABEL = {
    'pickgem':   '① pickGem — 교체 지점',
    'gemdata':   '② 광물 이름·색이 박힌 곳',
    'tier':      '③ tier / grade / 등급 문자열',
    'banned':    '④ ⚠ 금지어 — 「지나갔」 「회복」',
    'dataload':  '⑤ 데이터를 읽는 곳',
    'axisfield': '⑥ 새 필드를 이미 쓰는 곳',
}


def short(s):
    s = s.strip()
    return s if len(s) <= MAX_LINE else s[:MAX_LINE] + ' …'


def scan(roots):
    hits = {k: [] for k, _ in PATTERNS}
    files = []
    seen = set()
    for root in roots:
        base = os.path.dirname(os.path.normpath(root))
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                if not fn.endswith(EXTS):
                    continue
                p = os.path.realpath(os.path.join(dirpath, fn))
                if p in seen:
                    continue
                seen.add(p)
                rel = os.path.relpath(p, base)
                try:
                    txt = open(p, encoding='utf-8', errors='replace').read()
                except Exception:                               # noqa: BLE001
                    continue
                files.append((rel, len(txt), txt.count('\n') + 1))
                for i, line in enumerate(txt.splitlines(), 1):
                    for key, rx in PATTERNS:
                        if not rx.search(line):
                            continue
                        mark = ''
                        if key == 'banned' and MOTTO.search(line):
                            mark = '모토 — 예외, 그대로 둡니다'
                        elif key == 'tier' and DRAWS.search(line):
                            mark = '화면에 그리는 것으로 보입니다'
                        hits[key].append((rel, i, short(line), mark))
    return files, hits


def main():
    roots = [os.path.abspath(a) for a in sys.argv[1:]] or [os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))]
    roots = [r for r in roots if os.path.isdir(r)]
    if not roots:
        print('[X] 볼 폴더가 없습니다.')
        return 1

    out_env = os.environ.get('SCAN_OUT')
    out_dir = out_env if out_env else os.path.join(roots[0], 'out')
    os.makedirs(out_dir, exist_ok=True)

    for r in roots:
        print(f'▸ 훑는 중… {r}')
    files, hits = scan(roots)
    print(f'  파일 {len(files)}개')
    if not files:
        print('  [!] .html / .js 파일이 하나도 없습니다.')

    L = []
    A = L.append
    A('# 앱 스캔 결과')
    A('')
    A('`scan_app.py` · 코드 줄만 봅니다. 기록은 읽지 않습니다.')
    A('')
    A('## 0. 훑은 파일')
    A('')
    for r in roots:
        A(f'- `{r}`')
    A('')
    if not files:
        A('**`.html` / `.js` 파일이 하나도 없습니다.** '
          '앱 폴더가 이 안에 없는 것 같습니다. 앱이 어디 있는지 알려주세요.')
        A('')
    A('| 파일 | 줄 수 | 크기 |')
    A('|---|---|---|')
    for rel, size, lines in sorted(files, key=lambda x: -x[1])[:20]:
        A(f'| `{rel}` | {lines:,} | {size/1024:.0f} KB |')
    if len(files) > 20:
        A(f'| … 외 {len(files)-20}개 | | |')
    A('')

    for key, _ in PATTERNS:
        rows = hits[key]
        A(f'## {LABEL[key]}')
        A('')
        if not rows:
            A('찾은 게 없습니다.')
            A('')
            continue
        A(f'{len(rows)}곳')
        A('')
        A('```')
        for rel, i, line, mark in rows[:40]:
            A(f'{rel}:{i}' + (f'   <- {mark}' if mark else ''))
            A(f'    {line}')
        if len(rows) > 40:
            A(f'… 외 {len(rows)-40}곳')
        A('```')
        A('')

    # ── 판단 ────────────────────────────────────────────────
    A('---')
    A('')
    A('## 이 스캔이 답하는 것')
    A('')
    banned_all = hits['banned']
    banned = [r for r in banned_all if not r[3]]      # 모토 뺀 것
    motto_n = len(banned_all) - len(banned)
    tier = hits['tier']
    tier_drawn = [r for r in tier if r[3]]
    pick = hits['pickgem']

    A('### 창 B 질문 — `held` 의 화면 라벨이 있는가')
    A('')
    if not tier:
        A('**없습니다.** 앱이 등급 문자열을 아예 쓰지 않습니다. '
          '문장이 곧 라벨이라는 설계가 코드에서도 그대로입니다.')
        A('')
        A('> 창 B 회신: **`held` 의 화면 라벨은 없습니다.** '
          '등급은 뒤에서만 쓰는 이름이고, 화면에 나가는 건 문장 한 줄뿐입니다.')
    elif not tier_drawn:
        A(f'등급 문자열이 **{len(tier)}곳**에 있지만 **전부 변수로만** 씁니다. '
          '화면에 그리는 줄은 없습니다.')
        A('')
        A('> 창 B 회신: **`held` 의 화면 라벨은 없습니다.** '
          '등급은 분기용 이름이고, 화면에 나가는 건 문장 한 줄뿐입니다.')
    else:
        A(f'**{len(tier_drawn)}곳이 화면에 그리는 것으로 보입니다** '
          f'(전체 {len(tier)}곳 중). 위 ③ 목록에서 `<-` 표시된 줄입니다.')
        A('')
        A('> 창 B 회신: 라벨이 **있습니다.** 위 줄들을 그대로 창 B 에 넘겨서 '
          '문안을 받아야 합니다. 이 창이 문장을 정하지 않습니다.')
    A('')

    A('### 금지어')
    A('')
    if not banned and not motto_n:
        A('**앱에 「지나갔」·「회복」이 없습니다.** 고칠 게 없습니다.')
    elif not banned:
        A(f'**고칠 곳은 없습니다.** 걸린 {motto_n}곳은 전부 서비스 모토라 '
          '예외입니다 — 그대로 둡니다.')
    else:
        A(f'**{len(banned)}곳을 고쳐야 합니다.**'
          + (f' (모토 {motto_n}곳은 뺀 수입니다)' if motto_n else ''))
        A('')
        A('> 「당신은 이미 한 번 여기를 지나갔습니다」는 **예외입니다.** '
          '④ 목록에서 `모토` 표시가 붙은 줄은 건드리지 마세요.')
    A('')

    A('### pickGem 교체')
    A('')
    if not pick:
        A('`pickGem` 을 못 찾았습니다. 하빈님 `gems/` 가 아직 앱에 '
          '안 붙었을 수 있습니다.')
    else:
        A(f'`pickGem` 이 **{len(pick)}곳**에 있습니다. 위 ① 목록의 '
          '정의 한 곳과 호출 자리들을 바꾸면 됩니다.')
        A('')
        A('```js')
        A('// 지금 — 주차 문자열을 해시해서 9로 나눈 나머지')
        A('pickGem(week.week)')
        A('')
        A('// 바꾸면 — gyeol_axes.json 이 이미 gem 을 들고 있습니다')
        A('week.gem            // 광물 이름 (없으면 null = 평범한 주)')
        A('week.grain          // 결: mixed | coarse | regular')
        A('week.grain_strength // 무늬 밀도용 최대 |z|')
        A('```')
        A('')
        A('> 앱에서 광물을 **계산할 필요가 없습니다.** 파이프라인이 이미 '
          '정해서 내보냅니다. `pickGem` 호출을 `week.gem` 읽기로 바꾸면 끝입니다.')
    A('')

    A('## 다음에 필요한 것')
    A('')
    A('1. 이 파일(`out/app_scan.md`)만 대화창에 붙이면 됩니다')
    A('2. ③ 목록에서 **화면에 그리는 줄**이 있으면 표시해 주세요')
    A('3. 그러면 붙여넣을 수 있는 패치를 만들어 드립니다')
    A('')

    path = os.path.join(out_dir, 'app_scan.md')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))
    print(f'\n  ✅ {path}')
    print(f'  pickGem {len(pick)}곳 · 등급 문자열 {len(tier)}곳'
          f'(화면 {len(tier_drawn)}) · 고칠 금지어 {len(banned)}곳'
          f'(모토 예외 {motto_n})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
