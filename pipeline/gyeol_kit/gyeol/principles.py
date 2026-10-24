# -*- coding: utf-8 -*-
"""
원칙 v6 적용과 원문(유물) 붙이기 — run_gyeol.py 가 벽·앱 데이터를 만든 직후에 부릅니다.

전에는 make_wall.py → add_relics.py → apply_principles.py 가 같은 파일을
순서대로 덮어썼습니다. 순서를 틀리거나 하나를 빠뜨리면 산출물이 달라졌습니다.
지금은 run_gyeol.py 한 번이 같은 일을 같은 순서로 합니다.
(add_relics.py · apply_principles.py 는 이 모듈을 부르는 얇은 래퍼로만 남았습니다.)

원칙 v6 — 막는 대신 말수를 줄입니다.
  ① 봉인을 걷는다   사용자가 직접 찾아가는 탐사는 열린다. 최근 8주만 남긴다
                    — 아직 지나가지 않은 것을 회고로 만들지 않기 위해서다
  ② 말수를 줄인다   두드러진 주에는 회복 서사를 붙이지 않는다
                    (판정 쪽 gyeol/judge.py withholds_recovery 가 이미 빼지만,
                     옛 판으로 만든 파일이 들어와도 같은 결과가 나오게 여기서도 지운다)
  ③ 원문을 붙인다   지표는 그 주가 있었다는 것만 말한다. 원문은 그 주를 돌려준다

하지 않는 것
  · 왜 말수를 줄였는지 화면에 적지 않는다
  · 원문을 해석하지 않는다. 글이 없는 주에 "기록이 없습니다"라고 쓰지 않는다
  · 위생 필터(sanitize_notes.py)를 통과하지 않은 파일은 읽지 않는다
  · 먼저 말 걸기(알림)는 여전히 금지 — 손대는 건 탐사 화면뿐
"""
from __future__ import annotations
import csv
import json
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta

CLEAN_NAME = 'my_notes_text_clean.tsv'
RAW_NAME = 'my_notes_text.tsv'

RECENT_WEEKS = 8      # 이 구간은 계속 열지 않는다
MAX_PER_WEEK = 3
CUT = 160

# 지우는 절 — "그리고 약 N주 뒤부터 평소의 흐름이 이어졌습니다."
RECOVERY = re.compile(r'\s*그리고\s*약\s*\d+주\s*뒤부터\s*평소의\s*흐름이\s*이어졌습니다\.?')
# 두드러짐의 표시
EXTREME = re.compile(r'(직전 1년 중 가장 두드러진 주|상위 [1-5]%)')


def week_of(d):
    y, w, _ = d.isocalendar()
    return f'{y}-W{w:02d}'


# ── 유물 ────────────────────────────────────────────────────

def load_relics(data_dir, log=print):
    """
    data/my_notes_text_clean.tsv → {주: {'q': [...], 'more': n}}.
    정제본이 없으면 빈 dict 를 돌려주고 이유를 한 줄 알립니다(원본은 읽지 않음).
    """
    src = os.path.join(data_dir, CLEAN_NAME)
    if not os.path.exists(src):
        if os.path.exists(os.path.join(data_dir, RAW_NAME)):
            log(f' ⚠ {CLEAN_NAME} 가 없습니다. 원본에는 비밀번호가 섞여 있을 수 있어 읽지 않습니다.\n'
                f'   먼저: python3 sanitize_notes.py data/{RAW_NAME} data/{CLEAN_NAME} data/_dropped.tsv')
        else:
            log(f' · {CLEAN_NAME} 가 없어 원문은 붙이지 않습니다.')
        return {}
    by = defaultdict(list)
    with open(src, encoding='utf-8') as f:
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
        v.sort(key=lambda x: -x['len'])     # 긴 글이 그 주를 더 잘 되돌려줍니다
        out[k] = {'q': v[:MAX_PER_WEEK], 'more': max(len(v) - MAX_PER_WEEK, 0)}
    return out


# ── 앱 데이터 ───────────────────────────────────────────────

def apply_to_data(path, relics, log=print):
    if not os.path.exists(path):
        log(f' {os.path.basename(path)} 없음 — 건너뜀')
        return None
    d = json.load(open(path, encoding='utf-8'))
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
            w['relic'] = r
            withrelic += 1
    d['principles'] = 'v6'
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    log(f'앱 데이터  {len(d["weeks"])}주 · 회복 서사 뺀 것 {muted} · 원문 붙은 것 {withrelic}')
    return dict(weeks=len(d['weeks']), muted=muted, relic=withrelic)


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


def apply_to_wall(path, relics, log=print):
    if not os.path.exists(path):
        log(f' {os.path.basename(path)} 없음 — 건너뜀')
        return None
    html = open(path, encoding='utf-8').read()
    m = re.search(r'const WEEKS\s*=\s*(\[.*?\]);', html, re.S)
    if not m:
        log(' 벽 구조가 예상과 다릅니다')
        return None
    W = json.loads(m.group(1))

    last = max(date.fromisoformat(w['d']) for w in W)
    cutoff = last - timedelta(weeks=RECENT_WEEKS - 1)

    unsealed = muted = 0
    for w in W:
        d0 = date.fromisoformat(w['d'])
        recent = d0 >= cutoff
        if not w.get('open') and not recent:
            w['open'] = 1                        # ① 봉인을 걷는다
            unsealed += 1
        if recent:
            w['open'] = 0                        # 최근 구간은 계속 닫는다
        s = w.get('t') or ''
        if s and EXTREME.search(s) and RECOVERY.search(s):
            w['t'] = RECOVERY.sub('', s).strip()  # ② 회복 서사를 뺀다
            muted += 1

    html = html[:m.start(1)] + json.dumps(W, ensure_ascii=False) + html[m.end(1):]

    # ③ 원문 — 여러 번 돌려도 스크립트가 하나만 남게
    if 'id="prelic"' in html:
        # 붙일 때 앞에 넣은 줄바꿈까지 지워야 돌릴 때마다 빈 줄이 늘지 않습니다
        html = re.sub(r'\n?<script>\n/\* 유물 .*?</script>\n', '', html, flags=re.S)
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

    open(path, 'w', encoding='utf-8').write(html)
    n_open = sum(1 for w in W if w['open'])
    hit = sum(1 for w in W if w['open'] and w['w'] in relics)
    log(f'벽        {len(W)}주 · 열림 {n_open} (봉인 해제 {unsealed}) · '
        f'회복 서사 뺀 것 {muted} · 원문 나오는 것 {hit}')
    return dict(weeks=len(W), open=n_open, unsealed=unsealed, muted=muted, relic=hit)
