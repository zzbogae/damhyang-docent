from __future__ import annotations
"""민디 전체 대본집(docs/world/mined_doc_mindi_script_book_*.md)의 표에서 앱이 쓰는 대사를 꺼내
src/mindi/scripts.gen.ts 로 옮긴다. 대본집이 바뀌면 이 스크립트만 다시 돌린다(손으로 고치지 않는다).

    python3 webapp/web/scripts/script_book_to_ts.py

옮기는 것(대본집 v1.1 절 번호):
  §23-1 오늘의 한 마디 44 × 말투 4종 · §11-2 / §23-12 오프너 1~10(하늘·날씨, 가장 안전) · §11-1 첫 대화 고지
  §23-8 공감 · §23-9 돌려 답하기 · §23-13 섬 잠김·말투 바꿈 · §17 진단·치료·위기 고정형
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BOOK = sorted((ROOT / 'docs/world').glob('mined_doc_mindi_script_book_*.md'))[-1]
OUT = ROOT / 'webapp/web/src/mindi/scripts.gen.ts'
VOICES = ['quiet', 'warm', 'plain', 'dry']

text = BOOK.read_text(encoding='utf-8')


def section(head: str) -> str:
    """`### 23-1.` 처럼 시작하는 절 하나(다음 같은 단계 머리까지)"""
    m = re.search(rf'^(#+) {re.escape(head)}.*$', text, re.M)
    if not m:
        sys.exit(f'절을 찾지 못함: {head}')
    level = len(m.group(1))
    rest = text[m.end():]
    end = re.search(rf'^#{{1,{level}}} ', rest, re.M)
    return rest[: end.start()] if end else rest


def clean(cell: str) -> str:
    s = cell.strip().replace('<br>', '\n').replace('`', '')
    s = re.sub(r'★ ?10/24 ?', '', s)
    s = re.sub(r'\s*\((?:농담 없음|같음[^)]*)\)\s*$', '', s)
    return s.strip()


def rows(sec: str) -> list[list[str]]:
    out = []
    for line in sec.splitlines():
        if not line.startswith('|') or re.match(r'^\|[\s|:-]+\|$', line):
            continue
        out.append([c for c in line.strip().strip('|').split('|')])
    return out[1:]  # 머리 행 제외


def four(cells: list[str], quiet_fallback: str | None = None) -> dict:
    """조용한·다정한·담백한·시니컬한 네 칸. 「(같음)」은 조용한 결을 그대로 쓴다"""
    d = {}
    for v, c in zip(VOICES, cells):
        raw = c.strip()
        d[v] = clean(raw) if clean(raw) and not raw.startswith('(같음') and not raw.startswith('(§') else None
    q = d['quiet'] or quiet_fallback
    return {v: (d[v] or q) for v in VOICES}


# 오늘의 한 마디 44 × 4
DAILY = {v: [] for v in VOICES}
for r in rows(section('23-1.')):
    if not r[0].strip().isdigit():
        continue
    for v, s in four(r[1:5]).items():
        DAILY[v].append(s)
assert all(len(x) == 44 for x in DAILY.values()), {v: len(x) for v, x in DAILY.items()}

# 오프너 1~10 (하늘·날씨): 조용한은 §11-2 표, 나머지는 §23-12
op_row = next(r for r in rows(section('11-2.')) if r[0].strip().startswith('1 '))
quiet_open = re.findall(r'★?(\d+) (.*?)(?= · ★?\d+ |$)', op_row[1].strip())
quiet_open = [clean(s) for n, s in quiet_open if 1 <= int(n) <= 10]
others = [r for r in rows(section('23-12.')) if r[0].strip().isdigit() and 1 <= int(r[0]) <= 10]
OPENERS = {'quiet': quiet_open, 'warm': [clean(r[1]) for r in others], 'plain': [clean(r[2]) for r in others], 'dry': [clean(r[3]) for r in others]}
assert all(len(x) == 10 for x in OPENERS.values()), {v: len(x) for v, x in OPENERS.items()}


def table_by_key(head: str) -> dict:
    return {clean(r[0]): four(r[1:5]) for r in rows(section(head))}


START = table_by_key('23-6.')
NOTICE = START['첫 대화 고지 10-2']['quiet']
EMPATHY = table_by_key('23-8.')
JUDGMENT = {k: v for k, v in table_by_key('23-9.').items() if k != '나 잘했지?'}
ISLAND = table_by_key('23-13.')

fixed_rows = {clean(r[0]).split(' ')[0]: clean(r[1]) for r in rows(section('17.')) if len(r) == 2}
FIXED = {'diagnosis': fixed_rows['진단'], 'treatment': fixed_rows['치료'], 'crisis': fixed_rows['위기']}

data = {
    'DAILY': DAILY,
    'OPENERS': OPENERS,
    'NOTICE_FIRST_CHAT': NOTICE,
    'MODE_GUIDE': START['모드 안내 10-5'],
    'EMPATHY': EMPATHY,
    'JUDGMENT': JUDGMENT,
    'ISLAND_LOCKED_TWO': ISLAND['잠겨 있을 때 ①'],
    'ISLAND_LOCKED_EARLY': ISLAND['잠겨 있을 때 ②'],
    'VOICE_CHANGED': ISLAND['P13 말투 바꿈'],
    'FIXED': FIXED,
}

lines = [
    '// 자동 생성 — 손으로 고치지 마세요. 원본: docs/world/' + BOOK.name,
    '// 다시 만들기: python3 webapp/web/scripts/script_book_to_ts.py',
    "import type { Voice } from './voices';",
    '',
    'type ByVoice = Record<Voice, string>;',
]
types = {
    'DAILY': 'Record<Voice, string[]>', 'OPENERS': 'Record<Voice, string[]>', 'NOTICE_FIRST_CHAT': 'string',
    'MODE_GUIDE': 'ByVoice', 'EMPATHY': 'Record<string, ByVoice>', 'JUDGMENT': 'Record<string, ByVoice>',
    'ISLAND_LOCKED_TWO': 'ByVoice', 'ISLAND_LOCKED_EARLY': 'ByVoice', 'VOICE_CHANGED': 'ByVoice',
    'FIXED': '{ diagnosis: string; treatment: string; crisis: string }',
}
for k, v in data.items():
    lines.append(f'export const {k}: {types[k]} = {json.dumps(v, ensure_ascii=False, indent=2)};')
OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(f'{OUT.relative_to(ROOT)} ← {BOOK.name}: 한 마디 {len(DAILY["quiet"])}×4, 오프너 {len(OPENERS["quiet"])}×4, 공감 {len(EMPATHY)}, 돌려 답하기 {len(JUDGMENT)}')
