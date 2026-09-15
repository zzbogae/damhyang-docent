#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
관측소 코어 벽 만들기 — data/ 를 읽어 웹페이지 한 장을 뽑습니다.

    python3 make_wall.py

결과: out/gyeol_wall.html   (혼자 도는 파일 하나. 그대로 웹에 올리면 됩니다)

무엇을 만드나
  · 한 주 = 코어 하나. 지층 벽에 연도별로 박혀 있습니다
  · 코어를 누르면 단면이 열립니다 — 그 주 7일의 결 + 관찰 문장
  · 인출 필터로 빠진 주는 벽에 있지만 열리지 않습니다. 이유는 적지 않습니다

원칙
  · 코어 모양은 브라우저가 데이터로 계산합니다. AI 이미지가 아닙니다
  · 축하하지 않습니다. 판정하지 않습니다
  · 안 열리는 것에 대해 설명하지 않습니다
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import json
import os
import sys

PY_MIN = (3, 7)
if sys.version_info < PY_MIN:
    sys.stderr.write(
        f"\n이 키트는 파이썬 {PY_MIN[0]}.{PY_MIN[1]} 이상이 필요합니다.\n"
        f"지금 쓰시는 건 {sys.version.split()[0]} 입니다.\n\n")
    raise SystemExit(1)
from collections import defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from gyeol import detect, crisis_filter, rolling_baseline as RB      # noqa: E402
from gyeol.channels import FEATURE_DIRECTION, FAMILY_LABEL           # noqa: E402
from gyeol.judge import apply_evidence_floor, build_sentence, families  # noqa: E402
from gyeol.analyzer_v3 import week_date_range                        # noqa: E402
from gyeol import parse_notes, parse_photos                          # noqa: E402
import run_gyeol as R                                                # noqa: E402

MINERALS = {
    'obsidian': {'name': '흑요석', 'base': '#1f2430', 'vein': '#3d4657', 'glow': '#5a6478'},
    'amethyst': {'name': '자수정', 'base': '#2e2438', 'vein': '#5c4372', 'glow': '#8a63ab'},
    'lapis':    {'name': '청금석', 'base': '#1c2a3d', 'vein': '#2f4d78', 'glow': '#4a7ab8'},
    'amber':    {'name': '호박',   'base': '#33281a', 'vein': '#6b5124', 'glow': '#b8883a'},
}


def week_of(d):
    iso = d.isocalendar()
    return f'{iso[0]}-W{iso[1]:02d}'


def build_daily(found, health_rows):
    """
    결(줄무늬)의 재료 — 하루치 값.
    걸음수가 있으면 걸음수를, 없으면 그날 남긴 기록 수를 씁니다.
    """
    daily, source = {}, None
    if health_rows:
        for r in health_rows:
            if r.get('steps') is not None:
                daily[r['date']] = float(r['steps'])
        if daily:
            return daily, 'steps'

    counts = defaultdict(float)
    for key, loader in (('notes', parse_notes.load_notes_csv),
                        ('photo', parse_photos.load_photos_csv)):
        for p in found.get(key) or []:
            try:
                for r in loader(p):
                    counts[r['dt'].date()] += 1
            except Exception:                                        # noqa: BLE001
                pass
    if counts:
        source = 'records'
    return dict(counts), source


def core_shape(days, sleep, all_avgs):
    """core_generator.py 와 같은 규칙. 여기서 계산해 브라우저로 넘깁니다."""
    if not days:
        return None
    avg = sum(days) / len(days)
    lo, hi = min(all_avgs), max(all_avgs)
    pos = (avg - lo) / (hi - lo) if hi > lo else 0.5
    var = (max(days) - min(days)) / avg if avg > 0 else 0
    low_days = sum(1 for x in days if x < avg * 0.4)

    if sleep is not None and sleep < 4:
        mineral = 'obsidian'
    elif var > 1.2:
        mineral = 'amethyst'
    elif pos > 0.6:
        mineral = 'amber'
    else:
        mineral = 'lapis'

    if var > 1.3:
        shape = 'angular'
    elif low_days >= 3:
        shape = 'long'
    elif pos > 0.65:
        shape = 'wide'
    else:
        shape = 'round'

    return {'m': mineral, 's': shape, 'days': [round(x, 1) for x in days],
            'size': round(0.55 + min(abs(pos - 0.5) * 1.4, 0.45), 3)}


def main():
    data_dir = os.path.join(HERE, 'data')
    out_dir = os.path.join(HERE, 'out')
    os.makedirs(out_dir, exist_ok=True)

    who = sys.argv[1] if len(sys.argv) > 1 else ''

    print('data/ 읽는 중…')
    found = detect.scan(data_dir)
    if not found or set(found) == {'_unknown'}:
        print(' data/ 폴더에 알아볼 수 있는 파일이 없습니다.')
        return 1

    weekly, info, health_rows = R.load_all(found, None, interactive=False)
    merged = R.merge_weekly(weekly)
    if not merged:
        print(' 주 단위로 묶을 데이터가 없습니다.')
        return 1

    present = sorted({f for row in merged.values() for f in row})
    feats = [(f, d) for f, d in FEATURE_DIRECTION if f in present]
    p = RB.compute_rolling_percentiles(merged, feats, window=52)
    cands = apply_evidence_floor(RB.find_candidates_rolling(p, merged))
    excluded = crisis_filter.excluded_weeks(p, merged)

    by_week = {c['week']: c for c in cands}

    # 결의 재료
    daily, src = build_daily(found, health_rows)
    print(f'결 무늬 재료: {"걸음수" if src == "steps" else "일별 기록 수"} · {len(daily)}일')

    wk_days = defaultdict(list)
    for d, v in daily.items():
        wk_days[week_of(d)].append((d, v))
    for k in wk_days:
        wk_days[k].sort()

    sleep_by_week = {k: v.get('avg_sleep') for k, v in merged.items()}
    all_avgs = [sum(v for _, v in wk_days[k]) / len(wk_days[k])
                for k in wk_days if wk_days[k]] or [1.0]

    weeks = []
    for k in sorted(merged.keys()):
        s, e = week_date_range(k)
        days = [v for _, v in wk_days.get(k, [])]
        shape = core_shape(days, sleep_by_week.get(k), all_avgs)
        if shape is None:
            shape = {'m': 'lapis', 's': 'round', 'days': [], 'size': 0.5}

        c = by_week.get(k)
        openable = k not in excluded
        rec = {
            'w': k, 'y': s.year, 'd': s.isoformat(),
            'm': shape['m'], 'sh': shape['s'], 'sz': shape['size'],
            'v': shape['days'], 'open': 1 if openable else 0,
        }
        if c and openable:
            rec['t'] = build_sentence(c)
            rec['tier'] = c['tier']
            rec['fam'] = [FAMILY_LABEL.get(f, f) for f in (c.get('evidence_families') or [])]
        weeks.append(rec)

    n_open = sum(1 for w in weeks if w['open'])
    n_word = sum(1 for w in weeks if w.get('t'))
    print(f'코어 {len(weeks)}개 · 열리는 것 {n_open} · 말이 붙은 것 {n_word}')

    meta = {
        'who': who,
        'weeks': len(weeks),
        'span': f"{weeks[0]['d']} ~ {weeks[-1]['d']}" if weeks else '',
        'years': round((len(weeks) / 52), 1),
        'families': len({f for row in merged.values() for f in families(list(row))}),
        'channels': [i['label'] for i in info],
        'vein': '걸음수' if src == 'steps' else '그날 남긴 기록 수',
        'sealed': len(weeks) - n_open,
    }

    html = TEMPLATE.replace('/*__DATA__*/', json.dumps(weeks, ensure_ascii=False)) \
                   .replace('/*__META__*/', json.dumps(meta, ensure_ascii=False)) \
                   .replace('/*__MIN__*/', json.dumps(MINERALS, ensure_ascii=False))
    path = os.path.join(out_dir, 'gyeol_wall.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'\n완성: {path}')
    print('브라우저로 열어보세요. 그대로 웹에 올려도 됩니다.')
    return 0


TEMPLATE = r'''<!DOCTYPE html><html lang="ko"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>관측소</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;background:#08090b;color:#ddd8cc;
 font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 -webkit-font-smoothing:antialiased}
body{padding:0 0 120px}
.wrap{max-width:1000px;margin:0 auto;padding:0 18px}
header{padding:64px 0 30px;border-bottom:1px solid #14171c}
h1{font-size:22px;margin:0 0 12px;color:#efe8d5;letter-spacing:.16em;font-weight:500}
.lede{color:#7c766c;font-size:13.5px;line-height:1.9;margin:0;max-width:560px}
.lede b{color:#b9b2a3;font-weight:500}
.meta{display:flex;gap:26px;flex-wrap:wrap;margin-top:22px;font-size:12px;color:#5d5952}
.meta b{display:block;color:#cfc7b6;font-size:17px;font-variant-numeric:tabular-nums;
 font-weight:600;line-height:1.5}
.yr{margin-top:38px}
.yr h2{font-size:12px;color:#4d5560;margin:0 0 10px;font-variant-numeric:tabular-nums;
 letter-spacing:.1em;font-weight:600}
.row{display:flex;flex-wrap:wrap;gap:4px}
.core{width:34px;height:44px;cursor:pointer;position:relative;flex:0 0 auto;
 transition:transform .12s}
.core:hover{transform:translateY(-3px)}
.core.sealed{cursor:default;opacity:.4}
.core.sealed:hover{transform:none}
.core.on{transform:translateY(-4px)}
.core svg{display:block}
.panel{position:fixed;left:0;right:0;bottom:0;background:#0d1014;
 border-top:1px solid #1c2129;padding:22px 18px 30px;transform:translateY(102%);
 transition:transform .22s cubic-bezier(.2,.7,.3,1);z-index:20;
 box-shadow:0 -22px 60px rgba(0,0,0,.6)}
.panel.on{transform:none}
.panel .in{max-width:1000px;margin:0 auto;display:flex;gap:24px;align-items:flex-start}
@media(max-width:640px){.panel .in{flex-direction:column;gap:16px}}
.panel .big{flex:0 0 auto}
.panel .txt{flex:1;min-width:0}
.panel .dt{font-size:11.5px;color:#5d5952;font-variant-numeric:tabular-nums;
 letter-spacing:.05em}
.panel .mn{font-size:12.5px;color:#8a8478;margin-top:3px}
.panel .sent{font-size:15px;color:#e3ddd0;line-height:1.95;margin:12px 0 0}
.panel .fam{margin-top:12px}
.pill{display:inline-block;font-size:10.5px;padding:2px 9px;border-radius:20px;
 background:#1a212a;color:#7d8794;margin:0 4px 4px 0}
.pill.g{background:#1c2a22;color:#84b795}
.panel .close{position:absolute;top:14px;right:18px;background:none;border:0;
 color:#4d4941;font-size:22px;cursor:pointer;line-height:1;font-family:inherit}
.note{margin-top:54px;padding-top:22px;border-top:1px solid #14171c;
 color:#55524b;font-size:12px;line-height:2}
.note b{color:#8a8478;font-weight:500}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:14px;font-size:11.5px;color:#5d5952}
.legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;
 vertical-align:-1px}
</style></head><body>

<div class="wrap">
<header>
<h1>관 측 소</h1>
<p class="lede">한 주가 코어 하나입니다. 지층에 박힌 채로 쌓여 있습니다.<br>
<b>겉은 광물이고, 잘라보면 그 주 7일의 결이 있습니다.</b><br>
누르면 열립니다. 열리지 않는 것도 있습니다.</p>
<div class="meta" id="meta"></div>
</header>

<div id="wall"></div>

<div class="note">
<b>이 화면에 대해</b><br>
코어의 모양·색·결은 전부 데이터에서 계산됩니다. AI가 그린 그림이 아닙니다.
같은 데이터를 넣으면 언제나 같은 코어가 나옵니다.<br>
가로 줄무늬는 <b id="veinsrc">그 주 7일의 기록</b>입니다. 그래프를 그대로 돌에 새긴 것입니다.<br>
색은 광물 이름으로만 부릅니다. 좋고 나쁨을 뜻하지 않습니다.
<div class="legend" id="legend"></div>
</div>
</div>

<div class="panel" id="panel">
  <button class="close" id="close">×</button>
  <div class="in">
    <div class="big" id="big"></div>
    <div class="txt">
      <div class="dt" id="pdt"></div>
      <div class="mn" id="pmn"></div>
      <div class="sent" id="psent"></div>
      <div class="fam" id="pfam"></div>
    </div>
  </div>
</div>

<script>
const WEEKS = /*__DATA__*/;
const META  = /*__META__*/;
const MIN   = /*__MIN__*/;
const SH = {round:'둥근 것', angular:'각진 것', long:'길쭉한 것', wide:'넓은 것'};

function drawCore(p, w, h, tag){
  const M = MIN[p.m], cx = w/2, cy = h/2;
  let bw = w*0.52*p.sz, bh = h*0.40*p.sz, pts;
  if(p.sh === 'angular'){
    pts = [[cx,cy-bh],[cx+bw*.9,cy-bh*.45],[cx+bw*.7,cy+bh*.6],
           [cx,cy+bh],[cx-bw*.7,cy+bh*.6],[cx-bw*.9,cy-bh*.45]];
  } else if(p.sh === 'long'){
    bh*=1.35; bw*=0.62;
    pts = [[cx,cy-bh],[cx+bw,cy-bh*.6],[cx+bw*.85,cy+bh*.7],
           [cx,cy+bh],[cx-bw*.85,cy+bh*.7],[cx-bw,cy-bh*.6]];
  } else if(p.sh === 'wide'){
    bw*=1.3; bh*=0.78;
    pts = [[cx,cy-bh],[cx+bw*.95,cy-bh*.3],[cx+bw,cy+bh*.5],
           [cx,cy+bh],[cx-bw,cy+bh*.5],[cx-bw*.95,cy-bh*.3]];
  } else {
    pts = [];
    for(let a=-90; a<270; a+=45){
      const r = a*Math.PI/180;
      pts.push([cx+bw*Math.cos(r), cy+bh*Math.sin(r)]);
    }
  }
  const poly = pts.map(q => q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ');
  const uid = 'c'+p.w.replace(/-/g,'')+(tag||'');

  let veins = '';
  const days = p.v || [];
  if(days.length){
    const mx = Math.max.apply(null, days) || 1;
    days.forEach((val,i)=>{
      const ratio = val/mx;
      const y = cy - bh*0.82 + (i+0.5)*(bh*1.64/days.length);
      const half = bw*0.80*(0.28 + ratio*0.62);
      const th = 1.1 + ratio*3.4;
      const op = 0.30 + ratio*0.55;
      veins += `<line x1="${(cx-half).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(cx+half).toFixed(1)}" y2="${y.toFixed(1)}" stroke="${M.vein}" stroke-width="${th.toFixed(1)}" opacity="${op.toFixed(2)}" stroke-linecap="round"/>`;
    });
  }
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="g${uid}" cx="38%" cy="30%">
<stop offset="0%" stop-color="${M.glow}" stop-opacity=".30"/>
<stop offset="60%" stop-color="${M.base}" stop-opacity="1"/>
<stop offset="100%" stop-color="#0a0c0e" stop-opacity="1"/></radialGradient>
<clipPath id="k${uid}"><polygon points="${poly}"/></clipPath></defs>
<polygon points="${poly}" fill="url(#g${uid})" stroke="${M.glow}" stroke-width="1" opacity=".95"/>
<g clip-path="url(#k${uid})">${veins}</g>
<polygon points="${poly}" fill="none" stroke="${M.glow}" stroke-width=".8" opacity=".5"/></svg>`;
}

// 머리말
document.getElementById('meta').innerHTML =
  `<div><b>${META.weeks.toLocaleString()}</b>쌓인 주</div>` +
  `<div><b>${META.years}</b>년</div>` +
  `<div><b>${META.families}</b>종류의 기록</div>` +
  `<div><b>${META.channels.length}</b>개 채널</div>`;
document.getElementById('veinsrc').textContent = '그 주 7일의 ' + META.vein;

document.getElementById('legend').innerHTML = Object.keys(MIN).map(k =>
  `<span><i style="background:${MIN[k].glow}"></i>${MIN[k].name}</span>`).join('');

// 벽
const byYear = {};
WEEKS.forEach(w => { (byYear[w.y] = byYear[w.y] || []).push(w); });
document.getElementById('wall').innerHTML = Object.keys(byYear).sort().map(y =>
  `<div class="yr"><h2>${y}</h2><div class="row">` +
  byYear[y].map(w =>
    `<div class="core${w.open ? '' : ' sealed'}" data-w="${w.w}">${drawCore(w,34,44,'s')}</div>`
  ).join('') + `</div></div>`).join('');

// 열기
const panel = document.getElementById('panel');
let cur = null;

function open(w){
  if(!w.open) return;                 // 조용히 안 열립니다. 아무 말도 하지 않습니다.
  document.querySelectorAll('.core.on').forEach(e => e.classList.remove('on'));
  document.querySelector(`.core[data-w="${w.w}"]`).classList.add('on');

  const d = new Date(w.d + 'T00:00:00');
  document.getElementById('big').innerHTML = drawCore(w, 128, 164, 'big');
  document.getElementById('pdt').textContent =
    `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일부터 한 주간`;
  document.getElementById('pmn').textContent =
    `${MIN[w.m].name} · ${SH[w.sh]}`;
  document.getElementById('psent').textContent =
    w.t || '이 주에 대해 남은 관찰은 없습니다.';
  document.getElementById('pfam').innerHTML =
    (w.fam || []).map(f => `<span class="pill g">${f}</span>`).join('');
  panel.classList.add('on');
  cur = w;
}

document.getElementById('wall').addEventListener('click', e => {
  const el = e.target.closest('.core');
  if(!el) return;
  const w = WEEKS.find(x => x.w === el.dataset.w);
  if(w) open(w);
});
document.getElementById('close').addEventListener('click', () => {
  panel.classList.remove('on');
  document.querySelectorAll('.core.on').forEach(e => e.classList.remove('on'));
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') document.getElementById('close').click();
});
</script>
</body></html>'''


if __name__ == '__main__':
    sys.exit(main())
