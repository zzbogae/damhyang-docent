#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
코어에 그때 쓴 글을 붙입니다.

    python3 add_relics.py

읽는 것   out/gyeol_wall.html          (make_wall.py 가 만든 것)
          data/my_notes_text_clean.tsv (sanitize_notes.py 를 통과한 것)
쓰는 것   out/gyeol_wall.html          (같은 자리에 덮어씁니다)

왜 필요한가
  "새벽에 적어둔 메모가 평소보다 많았습니다"는 **나에 대한 요약**입니다.
  나 자신이 아닙니다. 팀 테스트에서 이렇게 나왔습니다 —
    "패턴만으로 오래된 기억을 떠올리는 게 생각보다 쉽지 않습니다."
  지표는 그 주가 있었다는 것만 말합니다. 원문은 그 주를 돌려줍니다.

하지 않는 것
  · 원문을 해석하지 않습니다. 그대로 놓습니다
  · 글이 없는 주에 "기록이 없습니다"라고 쓰지 않습니다 — 아무것도 안 씁니다
  · 봉인된 주에는 애초에 닿지 않습니다 (열리지 않으므로)
  · 위생 필터를 통과하지 않은 파일은 읽지 않습니다
"""
from __future__ import annotations
import csv, json, os, re, sys
from collections import defaultdict
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))
WALL = os.path.join(HERE, 'out', 'gyeol_wall.html')
SRC  = os.path.join(HERE, 'data', 'my_notes_text_clean.tsv')
RAW  = os.path.join(HERE, 'data', 'my_notes_text.tsv')

MAX_PER_WEEK = 3
CUT = 160


def week_of(d):
    y, w, _ = d.isocalendar()
    return f'{y}-W{w:02d}'


def load():
    if not os.path.exists(SRC):
        if os.path.exists(RAW):
            sys.stderr.write(
                '\n data/my_notes_text_clean.tsv 가 없습니다.\n'
                ' 원본에는 비밀번호가 섞여 있을 수 있어 읽지 않습니다. 먼저 이걸 돌려주세요:\n\n'
                '   python3 sanitize_notes.py data/my_notes_text.tsv '
                'data/my_notes_text_clean.tsv data/_dropped.tsv\n\n')
        else:
            sys.stderr.write('\n data/my_notes_text_clean.tsv 가 없습니다.\n\n')
        raise SystemExit(1)

    by_week = defaultdict(list)
    with open(SRC, encoding='utf-8') as f:
        for row in csv.DictReader(f, delimiter='\t'):
            try:
                dt = datetime.strptime(row['created_at'][:16], '%Y-%m-%d %H:%M')
            except ValueError:
                continue
            t = (row.get('text') or '').strip()
            if not t:
                continue
            by_week[week_of(dt.date())].append({
                't': t[:CUT] + ('…' if len(t) > CUT else ''),
                'd': dt.strftime('%Y-%m-%d'), 'h': dt.hour, 'mi': dt.minute,
                'n': 1 if 0 <= dt.hour < 5 else 0, 'len': len(t)})

    out = {}
    for k, v in by_week.items():
        v.sort(key=lambda x: -x['len'])     # 긴 글이 그 주를 더 잘 되돌려줍니다
        out[k] = {'q': v[:MAX_PER_WEEK], 'more': max(len(v) - MAX_PER_WEEK, 0)}
    return out


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

  function esc(s){ return s.replace(/[&<>]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

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
    if(!r){ box.innerHTML = ''; return; }   /* 없으면 아무 말도 하지 않습니다 */
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


def main():
    if not os.path.exists(WALL):
        sys.stderr.write('\n out/gyeol_wall.html 이 없습니다. make_wall.py 를 먼저 돌려주세요.\n\n')
        return 1

    relics = load()
    html = open(WALL, encoding='utf-8').read()

    if 'id="prelic"' in html:                       # 여러 번 돌려도 안전하게
        html = re.sub(r'<script>\n/\* 유물 .*?</script>\n', '', html, flags=re.S)
    else:
        if '<div class="fam" id="pfam"></div>' not in html:
            sys.stderr.write('\n 벽 파일 구조가 예상과 다릅니다. make_wall.py 버전을 확인해주세요.\n\n')
            return 1
        html = html.replace(
            '<div class="fam" id="pfam"></div>',
            '<div class="fam" id="pfam"></div>\n      <div class="relic" id="prelic"></div>')
        html = html.replace('</style>', CSS + '</style>', 1)

    html = html.replace(
        '</body>',
        JS.replace('/*__RELICS__*/', json.dumps(relics, ensure_ascii=False)) + '</body>')

    with open(WALL, 'w', encoding='utf-8') as f:
        f.write(html)

    m = re.search(r'const WEEKS\s*=\s*(\[.*?\]);', html, re.S)
    opened = hit = 0
    if m:
        for w in json.loads(m.group(1)):
            if w.get('open'):
                opened += 1
                if w['w'] in relics:
                    hit += 1
    print(f'유물 {sum(len(v["q"]) for v in relics.values())}개 · {len(relics)}주에 붙었습니다')
    print(f'열리는 코어 {opened}개 중 글이 나오는 것 {hit}개 '
          f'({round(hit / opened * 100) if opened else 0}%)')
    print(f'\n완성: {WALL}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
