# -*- coding: utf-8 -*-
"""
코어(광석) 절차적 생성기
— 실제 주간 데이터를 받아 SVG 코어를 그린다. AI 이미지 생성 없음.

설계 원칙:
  ① 모든 시각 요소는 데이터에서 계산된다 (임의값 없음)
  ② 단면의 결 = 그 주 7일간의 실제 일별 걸음수  ← "그래프를 돌에 새긴다"
  ③ 진단어를 쓰지 않는다 — 색은 광물 이름으로만 부른다
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import csv
import math
from collections import defaultdict
from datetime import date

HEALTH = '/home/claude/herizon_test/my_health.csv'

# 광물 팔레트 (진단어 아님)
MINERALS = {
    'obsidian':  {'name': '흑요석', 'base': '#1f2430', 'vein': '#3d4657', 'glow': '#5a6478'},
    'amethyst':  {'name': '자수정', 'base': '#2e2438', 'vein': '#5c4372', 'glow': '#8a63ab'},
    'lapis':     {'name': '청금석', 'base': '#1c2a3d', 'vein': '#2f4d78', 'glow': '#4a7ab8'},
    'amber':     {'name': '호박',   'base': '#33281a', 'vein': '#6b5124', 'glow': '#b8883a'},
}


def week_key(d):
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def week_start(k):
    y, w = k.split('-W')
    return date.fromisocalendar(int(y), int(w), 1)


def load_daily():
    """주차별 일별 데이터를 그대로 보관 (결 무늬의 재료)"""
    weeks = defaultdict(lambda: {'days': [], 'sleep': []})
    with open(HEALTH, encoding='utf-8') as f:
        for r in csv.DictReader(f):
            y, m, d = map(int, r['date'].split('-'))
            k = week_key(date(y, m, d))
            if r['steps']:
                weeks[k]['days'].append((date(y, m, d), float(r['steps'])))
            if r['sleep_hours']:
                weeks[k]['sleep'].append(float(r['sleep_hours']))
    for k in weeks:
        weeks[k]['days'].sort()
    return weeks


def core_params(week, wk_data, all_avgs):
    """주간 데이터 → 코어의 시각 파라미터"""
    days = [v for _, v in wk_data['days']]
    if not days:
        return None
    avg = sum(days) / len(days)
    sleep = (sum(wk_data['sleep']) / len(wk_data['sleep'])) if wk_data['sleep'] else None

    # 전체 평균 대비 위치 (0~1)
    lo, hi = min(all_avgs), max(all_avgs)
    pos = (avg - lo) / (hi - lo) if hi > lo else 0.5

    # 불규칙성: 요일 간 편차
    var = (max(days) - min(days)) / avg if avg > 0 else 0
    # 거의 안 움직인 날
    low_days = sum(1 for x in days if x < avg * 0.4)

    # --- 색: 무엇이 가장 두드러졌는가 ---
    if sleep is not None and sleep < 4:
        mineral = 'obsidian'          # 수면이 크게 무너진 주
    elif var > 1.2:
        mineral = 'amethyst'          # 요일별 진폭이 큰 주
    elif pos > 0.6:
        mineral = 'amber'             # 활동이 많았던 주
    else:
        mineral = 'lapis'             # 잔잔했던 주

    # --- 형태: 4유형 ---
    if var > 1.3:
        shape = 'angular'   # 각진 것 — 진폭이 큼
    elif low_days >= 3:
        shape = 'long'      # 길쭉한 것 — 낮은 상태가 이어짐
    elif pos > 0.65:
        shape = 'wide'      # 넓은 것 — 활동이 많음
    else:
        shape = 'round'     # 둥근 것 — 완만함

    return {
        'week': week, 'date': str(week_start(week)),
        'avg': avg, 'sleep': sleep, 'var': var, 'low_days': low_days,
        'pos': pos, 'mineral': mineral, 'shape': shape,
        'days': days,
        'size': 0.55 + min(abs(pos - 0.5) * 1.4, 0.45),   # 편차 클수록 큼
    }


def draw_core(p, w=150, h=190):
    """코어 하나를 SVG로. 겉 형태 + 단면의 결"""
    M = MINERALS[p['mineral']]
    cx, cy = w / 2, h / 2
    bw = w * 0.52 * p['size']       # 몸통 반폭
    bh = h * 0.40 * p['size']       # 몸통 반높이

    # 형태별 실루엣
    if p['shape'] == 'angular':
        pts = [(cx, cy-bh), (cx+bw*.9, cy-bh*.45), (cx+bw*.7, cy+bh*.6),
               (cx, cy+bh), (cx-bw*.7, cy+bh*.6), (cx-bw*.9, cy-bh*.45)]
    elif p['shape'] == 'long':
        bh *= 1.35; bw *= 0.62
        pts = [(cx, cy-bh), (cx+bw, cy-bh*.6), (cx+bw*.85, cy+bh*.7),
               (cx, cy+bh), (cx-bw*.85, cy+bh*.7), (cx-bw, cy-bh*.6)]
    elif p['shape'] == 'wide':
        bw *= 1.3; bh *= 0.78
        pts = [(cx, cy-bh), (cx+bw*.95, cy-bh*.3), (cx+bw, cy+bh*.5),
               (cx, cy+bh), (cx-bw, cy+bh*.5), (cx-bw*.95, cy-bh*.3)]
    else:  # round
        pts = [(cx + bw*math.cos(a), cy + bh*math.sin(a))
               for a in [math.radians(x) for x in range(-90, 270, 45)]]

    poly = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    uid = p['week'].replace('-', '')

    # 결 무늬: 그 주 7일간의 일별 걸음수를 가로 줄무늬 두께로
    days = p['days']
    mx = max(days) or 1
    veins = []
    n = len(days)
    for i, v in enumerate(days):
        ratio = v / mx
        y = cy - bh*0.82 + (i + 0.5) * (bh*1.64 / n)
        half = bw * 0.80 * (0.28 + ratio * 0.62)
        thick = 1.1 + ratio * 3.4
        op = 0.30 + ratio * 0.55
        veins.append(
            f'<line x1="{cx-half:.1f}" y1="{y:.1f}" x2="{cx+half:.1f}" y2="{y:.1f}" '
            f'stroke="{M["vein"]}" stroke-width="{thick:.1f}" opacity="{op:.2f}" '
            f'stroke-linecap="round"/>')

    return f'''<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg">
<defs>
<radialGradient id="g{uid}" cx="38%" cy="30%">
  <stop offset="0%" stop-color="{M['glow']}" stop-opacity=".30"/>
  <stop offset="60%" stop-color="{M['base']}" stop-opacity="1"/>
  <stop offset="100%" stop-color="#0d0f12" stop-opacity="1"/>
</radialGradient>
<clipPath id="c{uid}"><polygon points="{poly}"/></clipPath>
</defs>
<polygon points="{poly}" fill="url(#g{uid})" stroke="{M['glow']}" stroke-width="1" opacity=".95"/>
<g clip-path="url(#c{uid})">{''.join(veins)}</g>
<polygon points="{poly}" fill="none" stroke="{M['glow']}" stroke-width=".8" opacity=".5"/>
</svg>'''


if __name__ == '__main__':
    weeks = load_daily()
    keys = sorted(weeks.keys())
    all_avgs = [sum(v for _, v in weeks[k]['days']) / len(weeks[k]['days'])
                for k in keys if weeks[k]['days']]

    # 대표 주차 선정: 다양한 형태가 나오도록
    picks = ['2025-W05', '2025-W06', '2025-W09', '2026-W01',
             '2024-W20', '2021-W30', '2022-W44', '2026-W28']
    picks = [k for k in picks if k in weeks]

    cards = []
    SH = {'round': '둥근 것', 'angular': '각진 것', 'long': '길쭉한 것', 'wide': '넓은 것'}
    for k in picks:
        p = core_params(k, weeks[k], all_avgs)
        if not p:
            continue
        svg = draw_core(p)
        M = MINERALS[p['mineral']]
        sl = f"{p['sleep']:.1f}h" if p['sleep'] else '기록 없음'
        cards.append(f'''<div class="card">
  {svg}
  <div class="lbl">{p['date']}</div>
  <div class="tag">{M['name']} · {SH[p['shape']]}</div>
  <div class="num">걸음 {p['avg']:,.0f} · 수면 {sl}<br>진폭 {p['var']:.2f} · 낮은 날 {p['low_days']}일</div>
</div>''')

    html = '''<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<title>코어 생성 시안 — 실제 데이터</title><style>
body{background:#0b0d10;color:#e8e6e0;font-family:-apple-system,'Malgun Gothic',sans-serif;
 padding:36px 22px;max-width:960px;margin:0 auto;line-height:1.7}
h1{font-size:19px;color:#f0ead6}
.sub{color:#7d7972;font-size:13px;margin:7px 0 26px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.card{background:#12151a;border-radius:10px;padding:14px 10px;text-align:center}
.lbl{font-size:12px;color:#c9c5bd;margin-top:8px;font-variant-numeric:tabular-nums}
.tag{font-size:11.5px;color:#8a8680;margin-top:3px}
.num{font-size:10.5px;color:#54585f;margin-top:7px;line-height:1.6}
.note{background:#12151a;border-left:2.5px solid #3a4150;padding:16px 19px;border-radius:6px;
 font-size:12.5px;color:#8a8680;line-height:1.9;margin-top:30px}
.note b{color:#c9c5bd}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:12.5px}
th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #1c2027}
th{color:#8a8680;font-weight:500}
td{color:#a8a49c}
</style></head><body>
<h1>코어 생성 시안 — 실제 데이터에서 계산됨</h1>
<p class="sub">AI 이미지 생성이 아닙니다. 각 코어의 형태·색·결 무늬는 그 주의 실제 걸음수·수면 데이터에서
규칙으로 계산되어 SVG로 그려졌습니다. 같은 데이터를 넣으면 항상 같은 코어가 나옵니다.</p>
<div class="grid">''' + ''.join(cards) + '''</div>

<div class="note">
<b>무엇이 무엇을 결정하는가</b>
<table>
<tr><th>보이는 것</th><th>결정하는 데이터</th></tr>
<tr><td>가로 줄무늬(결)</td><td><b>그 주 7일간의 일별 걸음수</b> — 그래프를 그대로 돌에 새김</td></tr>
<tr><td>형태 4유형</td><td>요일 간 진폭(각진 것) · 낮은 날 수(길쭉한 것) · 활동량(넓은 것)</td></tr>
<tr><td>색 (광물)</td><td>수면 4시간 미만→흑요석 / 진폭 큼→자수정 / 활동 많음→호박 / 잔잔함→청금석</td></tr>
<tr><td>크기</td><td>평소로부터의 이탈 정도</td></tr>
</table>
<br>
<b>진단어를 쓰지 않습니다.</b> "불안한 주"가 아니라 "흑요석"입니다.
색 이름은 광물 이름일 뿐, 좋고 나쁨을 뜻하지 않습니다.
</div>
</body></html>'''

    open('/mnt/user-data/outputs/코어_생성시안.html', 'w', encoding='utf-8').write(html)
    print(f"생성 완료 — 코어 {len(cards)}개")
    for k in picks:
        p = core_params(k, weeks[k], all_avgs)
        if p:
            print(f"  {p['date']}  {MINERALS[p['mineral']]['name']:4s} {SH[p['shape']]:6s} "
                  f"걸음{p['avg']:6.0f} 진폭{p['var']:.2f}")
