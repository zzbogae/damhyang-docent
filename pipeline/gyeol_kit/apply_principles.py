#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
원칙 v6 적용 — 막는 대신 말수를 줄입니다.

    python3 apply_principles.py

고치는 것
  out/gyeol_wall.html     지층 벽
  out/gyeol_data.json     앱 데이터
읽는 것
  data/my_notes_text_clean.tsv

────────────────────────────────────────────────────────────
무엇이 바뀌나
────────────────────────────────────────────────────────────

v5까지는 "가장 두드러진 주는 되돌려주지 않는다"였습니다.
근거는 Facebook Year in Review와 Google Photos Memories였는데,
저 사례에서 실제로 해로웠던 건 **그 기억을 보여준 것**이 아니라
**묻지도 않고 들이민 것**이고 **"It's been a great year!"라는 서사를 얹은 것**입니다.

우리는 그걸 "밀지 않기"가 아니라 "안 보여주기"로 옮겼습니다. 과잉이었습니다.

  ① 봉인을 걷는다
     사용자가 직접 찾아가는 탐사는 열린다. 최근 8주만 남긴다
     — 아직 지나가지 않은 것을 회고로 만들지 않기 위해서다

  ② 대신 말수를 줄인다
     두드러진 주에는 **회복 서사를 붙이지 않는다.**
     "약 4주 뒤부터 평소의 흐름이 이어졌습니다" — 이 한 절이
     그 주를 지나간 에피소드로 만든다. 지표는 사실이지만 이 절은 해석이다.
     브리프 3장: "완전한 해소·봉합으로 끝내지 않는다. 흔적을 남긴다."

  ③ 원문을 붙인다
     지표는 그 주가 있었다는 것만 말한다. 원문은 그 주를 돌려준다

하지 않는 것
  · 왜 말수를 줄였는지 화면에 적지 않는다
  · 먼저 말 걸기(알림)는 여전히 금지 — 이 스크립트가 손대는 건 탐사 화면뿐
"""
from __future__ import annotations
import csv, json, os, re, sys
from collections import defaultdict
from datetime import datetime, date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
WALL = os.path.join(HERE, 'out', 'gyeol_wall.html')
DATA = os.path.join(HERE, 'out', 'gyeol_data.json')
SRC  = os.path.join(HERE, 'data', 'my_notes_text_clean.tsv')

RECENT_WEEKS  = 8      # 이 구간은 계속 열지 않는다
MAX_PER_WEEK  = 3
CUT           = 160

# 지우는 절 — "그리고 약 N주 뒤부터 평소의 흐름이 이어졌습니다."
RECOVERY = re.compile(r'\s*그리고\s*약\s*\d+주\s*뒤부터\s*평소의\s*흐름이\s*이어졌습니다\.?')
# 두드러짐의 표시
EXTREME  = re.compile(r'(직전 1년 중 가장 두드러진 주|상위 [1-5]%)')


# ── 유물 ────────────────────────────────────────────────────

def week_of(d):
    y, w, _ = d.isocalendar()
    return f'{y}-W{w:02d}'


def load_relics():
    if not os.path.exists(SRC):
        sys.stderr.write(f'\n {SRC} 가 없습니다.\n\n'); raise SystemExit(1)
    by = defaultdict(list)
    with open(SRC, encoding='utf-8') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            try:
                dt = datetime.strptime(row['created_at'][:16], '%Y-%m-%d %H:%M')
            except ValueError:
                continue
            t = (row.get('text') or '').strip()
            if not t:
                continue
            by[week_of(dt.date())].append({
                't': t[:CUT] + ('…' if len(t) > CUT else ''),
                'd': dt.strftime('%Y-%m-%d'), 'h': dt.hour, 'mi': dt.minute,
                'n': 1 if 0 <= dt.hour < 5 else 0, 'len': len(t)})
    out = {}
    for k, v in by.items():
        v.sort(key=lambda x: -x['len'])
        out[k] = {'q': v[:MAX_PER_WEEK], 'more': max(len(v) - MAX_PER_WEEK, 0)}
    return out


# ── 앱 데이터 ───────────────────────────────────────────────

def do_data(relics):
    if not os.path.exists(DATA):
        print(' out/gyeol_data.json 없음 — 건너뜀'); return
    d = json.load(open(DATA, encoding='utf-8'))
    muted = withrelic = 0
    for w in d['weeks']:
        s = w.get('sentence') or ''
        if EXTREME.search(s) and RECOVERY.search(s):
            w['sentence'] = RECOVERY.sub('', s).strip()
            w['tier'] = 'observed'          # 무엇이 뒤따랐는지 말하지 않는다
            w['recovery_withheld'] = True   # 내부용. 화면에 안 나감
            muted += 1
        r = relics.get(w['week'])
        if r:
            w['relic'] = r; withrelic += 1
    d['principles'] = 'v6'
    json.dump(d, open(DATA, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'앱 데이터  {len(d["weeks"])}주 · 회복 서사 뺀 것 {muted} · 원문 붙은 것 {withrelic}')


# ── 벽 ──────────────────────────────────────────────────────

CSS = '''
.panel .relic{margin-top:16px;padding-top:15px;border-top:1px solid #191d24}
.panel .relic .lb{font-size:11px;color:#4f5b55;letter-spacing:.05em;margin-bottom:10px}
.panel .relic blockquote{margin:0 0 13px;padding:11px 0 11px 14px;
 border-left:2px solid #33413a;background:none}
.panel .relic blockquote p{margin:0;font-size:14.5px;line-height:1.95;color:#ddd6c6;
 white-space:pre-wrap;word-break:break-word}
.panel .relic blockquote .src{margin-top:7px;font-size:10.5px;color:#565249;
 font-variant-numeric:tabular-nums}
.panel .relic blockquote .src .nt{color:#6d7f92}
.panel .relic .more{font-size:11px;color:#4a4740}
'''

JS = r'''
<script>
/* 유물 — 그 주에 실제로 쓴 글. 해석하지 않고 그대로 놓습니다. */
(function(){
  const RELICS = /*__RELICS__*/;
  const box = document.getElementById('prelic');
  if(!box) return;
  function esc(s){ return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function ampm(h, mi){
    const m2 = String(mi).padStart(2,'0');
    if(h === 0)  return `밤 12시 ${m2}분`;
    if(h < 5)    return `새벽 ${h}시 ${m2}분`;
    if(h < 12)   return `오전 ${h}시 ${m2}분`;
    if(h === 12) return `낮 12시 ${m2}분`;
    if(h < 18)   return `오후 ${h-12}시 ${m2}분`;
    if(h < 21)   return `저녁 ${h-12}시 ${m2}분`;
    return `밤 ${h-12}시 ${m2}분`;
  }
  function render(wk){
    const r = RELICS[wk];
    if(!r){ box.innerHTML = ''; return; }
    let h = '<div class="lb">그 주에 이렇게 적으셨습니다</div>';
    r.q.forEach(q => {
      const d = new Date(q.d + 'T00:00:00');
      h += '<blockquote><p>' + esc(q.t) + '</p><div class="src">'
         + `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 `
         + (q.n ? '<span class="nt">' + ampm(q.h,q.mi) + '</span>' : ampm(q.h,q.mi))
         + '</div></blockquote>';
    });
    if(r.more > 0) h += `<div class="more">그 주에 남긴 글이 ${r.more}개 더 있습니다</div>`;
    box.innerHTML = h;
  }
  document.getElementById('wall').addEventListener('click', e => {
    const el = e.target.closest('.core');
    if(!el || el.classList.contains('sealed')) return;
    render(el.dataset.w);
  });
  const c = document.getElementById('close');
  if(c) c.addEventListener('click', () => { box.innerHTML = ''; });
})();
</script>
'''


def do_wall(relics):
    if not os.path.exists(WALL):
        print(' out/gyeol_wall.html 없음 — 건너뜀'); return
    html = open(WALL, encoding='utf-8').read()
    m = re.search(r'const WEEKS\s*=\s*(\[.*?\]);', html, re.S)
    if not m:
        print(' 벽 구조가 예상과 다릅니다'); return
    W = json.loads(m.group(1))

    last = max(date.fromisoformat(w['d']) for w in W)
    cutoff = last - timedelta(weeks=RECENT_WEEKS - 1)

    unsealed = muted = 0
    for w in W:
        d0 = date.fromisoformat(w['d'])
        recent = d0 >= cutoff
        if not w.get('open') and not recent:
            w['open'] = 1; unsealed += 1        # ① 봉인을 걷는다
        if recent:
            w['open'] = 0                        # 최근 구간은 계속 닫는다
        s = w.get('t') or ''
        if s and EXTREME.search(s) and RECOVERY.search(s):
            w['t'] = RECOVERY.sub('', s).strip() # ② 회복 서사를 뺀다
            muted += 1

    html = html[:m.start(1)] + json.dumps(W, ensure_ascii=False) + html[m.end(1):]

    # ③ 원문
    if 'id="prelic"' in html:
        html = re.sub(r'<script>\n/\* 유물 .*?</script>\n', '', html, flags=re.S)
    else:
        html = html.replace(
            '<div class="fam" id="pfam"></div>',
            '<div class="fam" id="pfam"></div>\n      <div class="relic" id="prelic"></div>')
        html = html.replace('</style>', CSS + '</style>', 1)
    html = html.replace('</body>',
        JS.replace('/*__RELICS__*/', json.dumps(relics, ensure_ascii=False)) + '</body>')

    # 머리말 문구 — 봉인이 줄었으니 표현도 맞춥니다
    html = html.replace('누르면 열립니다. 열리지 않는 것도 있습니다.',
                        '누르면 열립니다. 아직 지나가지 않은 것은 열리지 않습니다.')

    open(WALL, 'w', encoding='utf-8').write(html)
    n_open = sum(1 for w in W if w['open'])
    hit = sum(1 for w in W if w['open'] and w['w'] in relics)
    print(f'벽        {len(W)}주 · 열림 {n_open} (봉인 해제 {unsealed}) · '
          f'회복 서사 뺀 것 {muted} · 원문 나오는 것 {hit}')


if __name__ == '__main__':
    R = load_relics()
    print(f'원문      {sum(len(v["q"]) for v in R.values())}개 · {len(R)}주\n')
    do_data(R)
    do_wall(R)
    print('\n완료. 왜 말수를 줄였는지는 화면에 적지 않습니다.')
