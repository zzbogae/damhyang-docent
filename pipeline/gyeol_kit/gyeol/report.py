# -*- coding: utf-8 -*-
"""
커버리지 리포트 — "내 데이터에서 무엇이 읽혔고, 무엇이 못 읽혔고,
무엇을 더 넣으면 무엇이 열리는가"를 한 장으로 보여줍니다.

이 리포트가 이 키트의 핵심입니다.
판정 결과보다 이 표가 먼저 나와야 팀원이 자기 데이터를 이해합니다.
"""
from __future__ import annotations   # 파이썬 3.7~3.9 에서도 돌아가게
import html
from collections import defaultdict
from datetime import date

from .channels import (CHANNELS, BY_KEY, FEATURE_LABEL, FEATURE_SOURCE,
                       FEATURE_FAMILY, FAMILY_LABEL)
from .judge import (evidence, build_sentence, pct_label, families,
                    MIN_EVIDENCE)
from .core_generator import MINERALS, core_params, draw_core

SHAPE_KO = {'round': '둥근 것', 'angular': '각진 것',
            'long': '길쭉한 것', 'wide': '넓은 것'}
TIER_KO = {'recovered': '그 뒤 4주는 평소 범위였습니다',
           'passed': '돌아왔지만 그 뒤는 확인되지 않았습니다',
           'observed': '이 주 뒤는 아직 확인되지 않았습니다'}


def e(s):
    return html.escape(str(s))


# ── 커버리지 계산 ───────────────────────────────────────────

def feature_coverage(merged: dict, features: list[str]) -> list[dict]:
    total = len(merged)
    out = []
    for f in features:
        n = sum(1 for row in merged.values() if row.get(f) is not None)
        out.append({
            'feature': f,
            'label': FEATURE_LABEL.get(f, f),
            'channel': FAMILY_LABEL.get(FEATURE_FAMILY.get(f), '기타'),
            'weeks': n,
            'total': total,
            'pct': (n / total * 100) if total else 0,
        })
    out.sort(key=lambda x: -x['weeks'])
    return out


def unlock_estimate(cands: list[dict], merged: dict) -> dict:
    """
    '넣으면 열리는 것'의 근거가 될 실제 숫자.
    지금 근거 지표가 부족해서 판정을 보류한 주가 몇 개인지 셉니다.
    """
    thin = sum(1 for c in cands if c.get('thin'))
    single = sum(1 for c in cands if c.get('single_source') and not c.get('thin'))
    weeks_1 = sum(1 for row in merged.values()
                  if sum(1 for v in row.values() if v is not None) == 1)
    fams = set()
    for row in merged.values():
        fams |= set(families(list(row)))
    return {'thin_candidates': thin, 'single_source': single,
            'single_indicator_weeks': weeks_1,
            'n_families': len(fams), 'total_weeks': len(merged)}


# ── 콘솔 출력 ───────────────────────────────────────────────

def print_console(ctx):
    found, missing = ctx['found'], ctx['missing']
    print()
    print('=' * 68)
    print(' 「결」 — 내 데이터에서 읽힌 것')
    print('=' * 68)

    print('\n[1] 읽힌 채널')
    if not found:
        print('   (없음) — data/ 폴더가 비어 있습니다.')
    for f in found:
        span = f'{f["start"]} ~ {f["end"]}' if f.get('start') else '기간 불명'
        print(f'   ✓ {f["label"]:<16} {f["n"]:>8,}건   {span}  ({f["weeks"]}주)')

    print('\n[2] 없는 채널 — 넣으면 열리는 것')
    if not missing:
        print('   (없음) 모든 채널이 들어왔습니다.')
    for m in missing:
        print(f'   · {m["label"]:<16} → {", ".join(m["adds"])}')

    print('\n[3] 지표 커버리지')
    for c in ctx['coverage']:
        bar = '█' * int(c['pct'] / 5) + '·' * (20 - int(c['pct'] / 5))
        print(f'   {c["label"]:<18} {bar} {c["weeks"]:>4}/{c["total"]}주 ({c["pct"]:.0f}%)')

    t = ctx['tiers']
    print('\n[4] 판정')
    print(f'   전체 {ctx["n_weeks"]}주 · 기준선이 생겨 판정 가능해진 주 {ctx["n_judgeable"]}주')
    print(f'   그 뒤 4주가 평소 범위였던 주  {len(t["recovered"]):>4}주')
    print(f'   평소 범위로 돌아왔지만 그 뒤는 확인 안 된 주  {len(t["passed"]):>4}주')
    print(f'   관찰만                  {len(t["observed"]):>4}건'
          f'   (그중 근거 부족 {ctx["unlock"]["thin_candidates"]}건)')
    print(f'   ⚠ 한 종류의 기록만 보고 내린 판정 {ctx["unlock"]["single_source"]}건'
          f'  — 지금 기록 종류가 {ctx["unlock"]["n_families"]}가지입니다')

    if ctx['n_judgeable'] == 0:
        print(f'\n   ⓘ 아직 판정을 시작할 수 없습니다. 각 주를 "직전 1년의 나"와 비교하는데,')
        print(f'     비교할 과거가 최소 20주는 쌓여야 합니다 (지금 {ctx["n_weeks"]}주).')
        print(f'     로직이 틀린 게 아니라 기간이 짧은 것입니다 — 이대로 공유해주세요.')

    s = ctx['ex_summary']
    print('\n[5] 인출 필터 — 실제 앱이라면')
    print(f'   되돌려줄 것 {len(ctx["retrievable"]):>4}건'
          f'   /   되돌려주지 않을 것 {len(ctx["withheld"]):>4}건')
    print(f'   전체 {s["total"]}주 중 {s["n"]}주({s["pct"]:.0f}%)가 되돌려주기 대상에서 빠졌습니다')
    print('   왜 빠졌는지는 화면에 설명하지 않습니다 — 그 설명 자체가 판정이 되기 때문입니다')

    print('\n[6] 예시 — 되돌려줄 것 중에서')
    if not ctx['retrievable']:
        print('   (없음)')
    for c in ctx['retrievable'][:3]:
        print(f'   → {build_sentence(c)}')

    print(f'\n리포트: {ctx["html_path"]}')
    print('=' * 68)


# ── HTML ────────────────────────────────────────────────────

CSS = """
*{box-sizing:border-box}
body{background:#0b0d10;color:#e8e6e0;margin:0;padding:40px 22px 80px;
 font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 line-height:1.75;-webkit-font-smoothing:antialiased}
.wrap{max-width:880px;margin:0 auto}
h1{font-size:22px;margin:0 0 6px;color:#f0ead6;letter-spacing:-.01em}
.sub{color:#7d7972;font-size:13px;margin:0 0 34px}
h2{font-size:15px;color:#d8d3c6;margin:44px 0 4px;letter-spacing:-.01em}
h2 .n{color:#4a5160;font-variant-numeric:tabular-nums;margin-right:8px}
.lead{color:#7d7972;font-size:12.5px;margin:0 0 16px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:11px}
.card{background:#12151a;border-radius:9px;padding:15px 17px;border:1px solid #1a1e26}
.card.on{border-color:#2c3f33}
.card.off{border-color:#221c1c;background:#100f11}
.card h3{margin:0 0 3px;font-size:13.5px;color:#e0dbcf;font-weight:600}
.card .meta{font-size:11.5px;color:#6e6a63;font-variant-numeric:tabular-nums}
.card .adds{font-size:11.5px;color:#8a8680;margin-top:9px;padding-top:9px;border-top:1px solid #1c2027}
.card .adds b{color:#b9b3a5;font-weight:500}
.card .how{font-size:11px;color:#5d5a55;margin-top:7px;line-height:1.65}
.pill{display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:20px;
 background:#1b2129;color:#7f8794;margin:0 4px 4px 0;font-variant-numeric:tabular-nums}
.pill.hi{background:#233028;color:#8fbf9c}
.pill.warn{background:#2e2620;color:#c09a6a}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #191d24;vertical-align:middle}
th{color:#6e6a63;font-weight:500;font-size:11.5px}
td{color:#a8a49c}
td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.bar{height:6px;border-radius:3px;background:#1a1e26;overflow:hidden;min-width:110px}
.bar i{display:block;height:100%;background:#3f6b52}
.bar i.low{background:#6b523f}
.stat{display:flex;gap:11px;flex-wrap:wrap;margin:14px 0 0}
.stat div{background:#12151a;border-radius:8px;padding:12px 16px;min-width:118px;
 border:1px solid #1a1e26}
.stat b{display:block;font-size:22px;color:#e8e2d2;font-variant-numeric:tabular-nums;
 line-height:1.3;font-weight:600}
.stat span{font-size:11px;color:#6e6a63}
.week{background:#12151a;border-radius:9px;padding:15px 18px;margin-bottom:9px;
 border-left:2.5px solid #2c3f33}
.week.passed{border-left-color:#4a4433}
.week.observed{border-left-color:#2b3038}
.week .hd{font-size:11.5px;color:#6e6a63;font-variant-numeric:tabular-nums;
 display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
.week .sent{font-size:13.5px;color:#ddd8ca;margin:7px 0 9px;line-height:1.8}
.note{background:#101318;border-left:2.5px solid #2b3038;padding:16px 19px;
 border-radius:6px;font-size:12.5px;color:#8a8680;line-height:1.9;margin-top:14px}
.note b{color:#c2bcae}
.note ul{margin:8px 0 0;padding-left:18px}
.note li{margin-bottom:5px}
.cores{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.cores .c{background:#12151a;border-radius:9px;padding:12px 8px;text-align:center;
 border:1px solid #1a1e26}
.cores .lbl{font-size:11.5px;color:#c9c5bd;margin-top:6px;font-variant-numeric:tabular-nums}
.cores .tag{font-size:10.5px;color:#7d7972;margin-top:2px}
.empty{color:#5d5a55;font-size:12.5px;padding:14px 0}
"""


def _channel_cards_found(found):
    out = []
    for f in found:
        span = f'{f["start"]} ~ {f["end"]}' if f.get('start') else '기간 불명'
        gives = ' '.join(f'<span class="pill hi">{e(FEATURE_LABEL.get(g, g))}</span>'
                         for g in f['gives_actual'])
        warn = ''
        if f.get('warn'):
            warn = f'<div class="how">⚠ {e(f["warn"])}</div>'
        out.append(f'''<div class="card on">
<h3>✓ {e(f['label'])}</h3>
<div class="meta">{f['n']:,}건 · {e(span)} · {f['weeks']}주</div>
<div class="meta" style="margin-top:4px;color:#4f4c48">{e(f['files'])}</div>
<div class="adds">{gives or '<span class="pill">주 단위로 묶기엔 표본이 적습니다</span>'}</div>
{warn}</div>''')
    return ''.join(out) or '<p class="empty">읽힌 채널이 없습니다. data/ 폴더에 파일을 넣고 다시 실행하세요.</p>'


def _channel_cards_missing(missing, unlock):
    out = []
    for m in missing:
        adds = ' '.join(f'<span class="pill">{e(a)}</span>' for a in m['adds'])
        out.append(f'''<div class="card off">
<h3>{e(m['label'])}</h3>
<div class="meta">{e(m['platform'])} · 약 {m['minutes']}분</div>
<div class="adds"><b>넣으면 생기는 지표</b><br>{adds}</div>
<div class="how">{e(m['how'])}</div>
<div class="how" style="color:#4f4c48">{e(m['note'])}</div>
</div>''')
    return ''.join(out) or '<p class="empty">빠진 채널이 없습니다.</p>'


def _coverage_table(coverage):
    rows = []
    for c in coverage:
        cls = ' class="low"' if c['pct'] < 40 else ''
        rows.append(f'''<tr>
<td>{e(c['label'])}</td>
<td style="color:#5d5a55">{e(c['channel'])}</td>
<td style="width:40%"><div class="bar"><i{cls} style="width:{c['pct']:.0f}%"></i></div></td>
<td class="num">{c['weeks']:,} / {c['total']:,}주</td>
<td class="num" style="color:#6e6a63">{c['pct']:.0f}%</td>
</tr>''')
    if not rows:
        return '<p class="empty">계산할 지표가 없습니다.</p>'
    return ('<table><tr><th>지표</th><th>출처</th><th>커버리지</th>'
            '<th class="num">있는 주</th><th class="num">%</th></tr>'
            + ''.join(rows) + '</table>')


def _week_blocks(cands, limit=12):
    out = []
    for c in cands[:limit]:
        s, en = c['date_range']
        badges = ''.join(
            f'<span class="pill hi">{e(FEATURE_LABEL.get(f, f))} · {e(pct_label(p))}</span>'
            for f, p in evidence(c)[:4])
        if c.get('thin'):
            badges += '<span class="pill warn">근거 지표 1개 — 판정 보류</span>'
        elif c.get('single_source'):
            badges += '<span class="pill warn">한 종류의 기록만 — 교차검증 안 됨</span>'
        out.append(f'''<div class="week {c['tier']}">
<div class="hd"><span>{e(s)} ~ {e(en)}</span>
<span>{e(TIER_KO[c['tier']])}</span></div>
<div class="sent">{e(build_sentence(c))}</div>
<div>{badges}</div>
</div>''')
    return ''.join(out) or '<p class="empty">후보가 없습니다. 데이터 기간이 짧으면 정상입니다 — 최소 6개월, 권장 12개월.</p>'


def _core_cards(health_rows, weeks_wanted):
    if not health_rows:
        return ''
    by_week = defaultdict(lambda: {'days': [], 'sleep': []})
    for r in health_rows:
        iso = r['date'].isocalendar()
        k = f'{iso[0]}-W{iso[1]:02d}'
        if r.get('steps') is not None:
            by_week[k]['days'].append((r['date'], r['steps']))
        if r.get('sleep_hours') is not None:
            by_week[k]['sleep'].append(r['sleep_hours'])
    for k in by_week:
        by_week[k]['days'].sort()

    avgs = [sum(v for _, v in d['days']) / len(d['days'])
            for d in by_week.values() if d['days']]
    if not avgs:
        return ''

    cards = []
    for k in weeks_wanted:
        if k not in by_week or not by_week[k]['days']:
            continue
        p = core_params(k, by_week[k], avgs)
        if not p:
            continue
        M = MINERALS[p['mineral']]
        cards.append(f'''<div class="c">{draw_core(p, w=132, h=168)}
<div class="lbl">{e(p['date'])}</div>
<div class="tag">{e(M['name'])} · {e(SHAPE_KO[p['shape']])}</div></div>''')
        if len(cards) >= 8:
            break
    if not cards:
        return ''
    return f'''<h2><span class="n">06</span>이 주들이 코어로는 이렇게 생겼습니다</h2>
<p class="lead">AI 이미지 생성이 아닙니다. 가로 줄무늬는 그 주 7일간의 실제 일별 걸음수입니다.
같은 데이터를 넣으면 언제나 같은 코어가 나옵니다.</p>
<div class="cores">{''.join(cards)}</div>'''


def build_html(ctx) -> str:
    u = ctx['unlock']
    t = ctx['tiers']
    ordered = t['recovered'] + t['passed'] + t['observed']

    zero_note = ''
    if ctx['n_judgeable'] == 0:
        zero_note = (f'<div class="note" style="border-left-color:#3d3122;color:#a08a68">'
                     f'<b>아직 판정을 시작할 수 없습니다 — 그리고 그건 정상입니다.</b><br>'
                     f'「결」은 각 주를 <b>직전 1년의 나</b>와 비교합니다. 비교할 과거가 '
                     f'최소 20주는 쌓여 있어야 판정이 시작되는데, 지금은 '
                     f'<b>{ctx["n_weeks"]}주</b>뿐입니다.<br>'
                     f'로직이 틀린 게 아니라 기간이 짧은 것입니다. 이 리포트를 그대로 공유해주세요 — '
                     f'"얼마나 있어야 되는가"도 알아내야 하는 답입니다.</div>')

    limits = ['<li>이 결과는 <b>판정이지 진단이 아닙니다.</b> 감정에 이름을 붙이지 않고, 지표가 평소와 달랐다는 사실만 말합니다.</li>']
    if u['single_source']:
        limits.append(f'<li><b>{u["single_source"]}건</b>은 한 종류의 기록만 보고 내린 판정입니다. '
                      f'같은 출처의 지표 여러 개가 함께 튀는 것은 증거 여러 개가 아니라 '
                      f'<b>증거 하나</b>입니다 — 다른 채널을 넣으면 이 판정들이 바뀔 수 있습니다.</li>')
    if u['single_indicator_weeks']:
        limits.append(f'<li>지표가 <b>1개뿐인 주가 {u["single_indicator_weeks"]}주</b> 있습니다. '
                      f'이 주들은 한 지표에만 기대고 있어서, 그 뒤가 어땠는지는 말하지 않았습니다.</li>')
    if ctx['n_weeks'] < 26:
        limits.append(f'<li>데이터가 <b>{ctx["n_weeks"]}주</b>뿐입니다. '
                      f'실측상 최소 26주(6개월), 권장 52주(1년)가 있어야 후보가 나옵니다. '
                      f'후보가 0건이어도 로직이 틀린 게 아니라 데이터가 짧은 것입니다.</li>')
    limits.append('<li>비교 기준은 <b>직전 1년의 나</b>입니다. 남과 비교하지 않고, 10년 전의 나와도 비교하지 않습니다.</li>')
    limits.append('<li>유튜브 시청 제목·검색어, AI 대화 내용은 <b>세는 데만 쓰고 저장하지 않습니다.</b> '
                  '이 리포트 어디에도 원문이 나오지 않습니다.</li>')

    core_html = _core_cards(ctx.get('health_rows'),
                            [c['week'] for c in ordered])

    return f'''<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>결 — 내 데이터 리포트</title><style>{CSS}</style></head><body><div class="wrap">

<h1>내 데이터에서 읽힌 것</h1>
<p class="sub">{e(ctx['who'])} · {e(ctx['run_at'])} · 이 파일은 내 컴퓨터에서만 만들어졌고 어디로도 전송되지 않았습니다</p>

<div class="stat">
<div><b>{len(ctx['found'])}</b><span>읽힌 채널</span></div>
<div><b>{ctx['n_weeks']:,}</b><span>분석된 주</span></div>
<div><b>{ctx['n_judgeable']:,}</b><span>판정 가능한 주</span></div>
<div><b>{len(t['recovered'])}</b><span>그 뒤 4주가 평소 범위였던 주</span></div>
</div>

<h2><span class="n">01</span>읽힌 것</h2>
<p class="lead">파일 이름이 아니라 파일 안을 열어보고 판단했습니다.</p>
<div class="grid">{_channel_cards_found(ctx['found'])}</div>

<h2><span class="n">02</span>없는 것 — 넣으면 열리는 것</h2>
<p class="lead">지금 <b style="color:#c09a6a">{u['n_families']}종류</b>의 기록으로 보고 있습니다.
그래서 교차검증이 안 된 판정이 <b style="color:#c09a6a">{u['single_source']}건</b>,
근거가 부족해 보류한 주가 <b style="color:#c09a6a">{u['thin_candidates']}건</b> 있습니다.
아래 채널을 하나 더 넣을 때마다 이 숫자가 줄어듭니다.
<br>서로 다른 두 기록이 <b>독립적으로 같은 주를 지목</b>할 때 비로소 믿을 만한 판정이 됩니다.</p>
<div class="grid">{_channel_cards_missing(ctx['missing'], u)}</div>

<h2><span class="n">03</span>지표 커버리지</h2>
<p class="lead">어떤 지표가 몇 주 동안 존재했는지. 커버리지가 낮은 지표는 그 구간에서 판정에 참여하지 못합니다.</p>
{_coverage_table(ctx['coverage'])}

<h2><span class="n">04</span>판정</h2>
<p class="lead">확인되지 않은 것을 확인되었다고 말하지 않습니다. 네 단계로 구분합니다.</p>
<div class="stat">
<div><b>{len(t['recovered'])}</b><span>그 뒤 4주가 평소 범위였던 주</span></div>
<div><b>{len(t['passed'])}</b><span>평소 범위로 돌아왔지만 그 뒤는 확인 안 된 주</span></div>
<div><b>{len(t['observed'])}</b><span>관찰만</span></div>
</div>
{zero_note}
<div style="margin-top:16px">{_week_blocks(ordered)}</div>

{_filter_section(ctx)}

{core_html}

<h2><span class="n">{'07' if core_html else '06'}</span>이 결과의 한계</h2>
<div class="note"><b>정직하게 적어둡니다</b><ul>{''.join(limits)}</ul></div>

</div></body></html>'''


def _filter_section(ctx) -> str:
    s = ctx['ex_summary']
    keep, drop = ctx['retrievable'], ctx['withheld']
    ur = ctx.get('user_ranges') or []

    user_row = ''
    if ur:
        user_row = ('<p class="lead" style="margin-top:10px">직접 지정하신 제외 구간 '
                    f'<b>{len(ur)}개</b>가 반영됐습니다. 이건 다른 무엇보다 우선합니다.</p>')

    if drop:
        drop_list = ''.join(
            f'<span class="pill warn">{e(c["date_range"][0])}</span>' for c in drop[:20])
        drop_html = (f'<p class="lead" style="margin-top:14px">아래 주들은 판정에는 잡혔지만 '
                     f'<b>앱에서는 되돌려주지 않습니다.</b> 날짜만 적습니다 — '
                     f'왜 제외됐는지는 적지 않습니다.</p><div>{drop_list}</div>')
    else:
        drop_html = ('<p class="lead" style="margin-top:14px">제외 대상에 걸린 후보가 '
                     '없습니다.</p>')

    return f'''<h2><span class="n">05</span>실제 앱이라면 무엇을 되돌려줄까</h2>
<p class="lead">「결」은 과거의 한 주를 <b>되돌려주는</b> 앱입니다. 그래서 되돌려주면 안 되는 주를
고르는 일이 기능이 아니라 <b>안전장치</b>입니다. 아래는 그 필터가 실제로 동작한 결과입니다.</p>

<div class="stat">
<div><b>{len(keep)}</b><span>되돌려줄 것</span></div>
<div><b>{len(drop)}</b><span>되돌려주지 않을 것</span></div>
<div><b>{s['n']}</b><span>제외된 주 (전체 {s['total']}주)</span></div>
<div><b>{s['pct']:.0f}%</b><span>제외 비율</span></div>
</div>
{user_row}
{drop_html}

<div class="note" style="margin-top:18px"><b>왜 이렇게 만들었나</b>
<ul>
<li><b>헛짚어도 안전하고, 놓치면 위험합니다.</b> 이 필터가 틀리면 그 주를 안 보여줄 뿐입니다.
반대로 놓치면 가장 힘들었던 주를 불쑥 들이밀게 됩니다. 그래서 <b>의심스러우면 무조건 제외</b>합니다.
정확도가 아니라 안전 마진을 목표로 합니다.</li>
<li><b>왜 뺐는지 말하지 않습니다.</b> "이 주는 위험해 보여서 뺐습니다"는 그 자체로 판정입니다.
조용히 빠지고, 사용자는 그 주가 있었다는 것도 모릅니다.</li>
<li><b>아무것도 저장하지 않습니다.</b> 위기 점수나 플래그를 남기는 순간 그건 건강 민감정보가 됩니다.
계산하고 그 자리에서 버립니다. 이 리포트의 숫자도 파일을 지우면 사라집니다.</li>
<li><b>누구에게도 알리지 않습니다.</b> 가족·기관 통보 기능을 넣지 않습니다.
알림 가능성이 있다는 것만으로 사람은 아무것도 안 남기게 됩니다.</li>
<li><b>직접 지울 수 있습니다.</b> <code style="background:#1a1f26;padding:1px 5px;border-radius:4px">--exclude 2024-09-01:2024-10-31</code>
처럼 기간을 지정하면 그 구간은 무조건 빠집니다. 이유를 설명할 필요 없습니다.</li>
</ul>
<p style="margin:12px 0 0;font-size:12px;color:#6e6a63">
Facebook이 2014년 사고 뒤 1년에 걸쳐 붙인 제어(인물 제외·기간 제외·미리보기)를,
우리는 첫 버전에 넣습니다. 회고 기능에서 이건 부가기능이 아니라 안전장치입니다.</p>
</div>'''
