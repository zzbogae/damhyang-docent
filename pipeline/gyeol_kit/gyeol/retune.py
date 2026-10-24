# -*- coding: utf-8 -*-
"""
gyeol/retune.py — τ 다시 재기 (10/23 지표 넷 교체 뒤 lang·talk 임시값을 실측값으로)

    python3 calibrate_axes.py --name "표시되는이름" --write

calibrate_axes.py 가 부릅니다. 하는 일
  1. axes.py 정본 축(build_axes)으로 z52 를 만들고 방향별 τ 를 TAU_PCT(7.5%) 지점에서 뽑습니다
  2. 새 τ 로 광물이 몇 주 생기는지, 결(mixed/coarse/regular)이 몇 주인지 다시 셉니다
  3. 붙여 넣을 값을 출력합니다 — gyeol/axes.py · webapp/core/mined_core/judge.py · docs/NOW.md
  4. --write 면 위 세 파일을 직접 고칩니다(있는 것만)

기본은 lang·talk 만 바꿉니다. move·rest 는 9/11 800주 실측으로 확정된 값이라
--axes move,rest,lang,talk 로 명시할 때만 바꿉니다.

나가는 것은 τ·주 수·비율뿐입니다. 원문·원값은 없습니다.
"""
from __future__ import annotations
import os
import re
from collections import Counter

from . import axes as AX

DEFAULT_AXES = ('lang', 'talk')


def compute(merged, weeks, axes_to_update=DEFAULT_AXES, pct=None):
    """반환: dict(tau_up, tau_down, tau, cur_up, cur_down, cur, n_weeks, grain, gems, gems_cur)"""
    pct = AX.TAU_PCT if pct is None else pct
    A52, _A8, _flags = AX.build_axes(merged, weeks)
    up, down = AX.calibrate_tau_directional(A52, weeks, pct)
    sym = AX.calibrate_tau(A52, weeks, pct)

    cur_up, cur_down, cur = dict(AX.TAU_UP), dict(AX.TAU_DOWN), dict(AX.TAU)
    new_up, new_down, new = dict(cur_up), dict(cur_down), dict(cur)
    # 위·아래 모두 20주 이상 값이 있어야 잰 것으로 칩니다. 못 잰 축은 지금 값(임시)을 그대로 둡니다
    measured = [ax for ax in axes_to_update
                if up.get(ax) is not None and down.get(ax) is not None and sym.get(ax) is not None]
    skipped = [ax for ax in axes_to_update if ax not in measured]
    for ax in measured:
        new_up[ax] = round(up[ax], 2)
        new_down[ax] = round(down[ax], 2)
        new[ax] = round(sym[ax], 2)

    def gem_count(tu, td, t):
        saved = AX.TAU_UP, AX.TAU_DOWN
        AX.TAU_UP, AX.TAU_DOWN = tu, td
        try:
            return Counter(AX.pick_gem(A52[w], t)[0] for w in weeks)
        finally:
            AX.TAU_UP, AX.TAU_DOWN = saved

    grain = Counter(AX.grain(A52[w])[0] for w in weeks)
    return dict(
        axes=measured, skipped=skipped, pct=pct, n_weeks=len(weeks),
        tau_up=new_up, tau_down=new_down, tau=new,
        cur_up=cur_up, cur_down=cur_down, cur=cur,
        measured_up=up, measured_down=down,
        grain=dict(grain),
        gems=dict(gem_count(new_up, new_down, new)),
        gems_cur=dict(gem_count(cur_up, cur_down, cur)),
    )


GEM_KO = {'amber': '호박', 'pyrite': '황철석', 'lapis': '청금석', 'moonstone': '월장석',
          'amethyst': '자수정', 'rose': '홍옥', 'obsidian': '흑요석', 'garnet': '석류석',
          'fluorite': '형석'}


def _f(v):
    return '—' if v is None else f'{v:.2f}'


def render(r):
    """사람이 읽고 붙여 넣을 블록(마크다운)."""
    n = r['n_weeks'] or 1
    L = []
    A = L.append
    A(f"## τ 다시 재기 — 바꾼 축: {', '.join(r['axes']) or '없음'} (|z| 상위 {r['pct']:g}%, {r['n_weeks']}주)")
    A('')
    if r['skipped']:
        A(f"> ⚠ **{', '.join(r['skipped'])} 는 재지 못했습니다** — 그 축 기록이 위·아래 각각 20주가 안 됩니다"
          f"(소통이면 카톡 본인 이름 `--name` 을 확인하세요). 그 축은 지금 값(임시)을 그대로 두고, "
          f"결 주 수도 쓰지 않습니다.")
        A('')
    A('| 축 | τ 위 (지금 → 새) | τ 아래 (지금 → 새) | 공통 τ (지금 → 새) |')
    A('|---|---|---|---|')
    for ax in AX.AXIS_ORDER:
        mark = ' ★' if ax in r['axes'] else ''
        A(f"| {ax}{mark} | {_f(r['cur_up'].get(ax))} → **{_f(r['tau_up'].get(ax))}** | "
          f"{_f(r['cur_down'].get(ax))} → **{_f(r['tau_down'].get(ax))}** | "
          f"{_f(r['cur'].get(ax))} → **{_f(r['tau'].get(ax))}** |")
    A('')
    A('### 광물이 생기는 주 (지금 τ → 새 τ)')
    A('')
    A('| 광물 | 지금 | 새 τ |')
    A('|---|---|---|')
    keys = [k for k in GEM_KO if k in r['gems'] or k in r['gems_cur']]
    for k in keys:
        A(f"| {GEM_KO[k]} | {r['gems_cur'].get(k, 0)}주 | {r['gems'].get(k, 0)}주 |")
    tot_c = sum(v for k, v in r['gems_cur'].items() if k)
    tot_n = sum(v for k, v in r['gems'].items() if k)
    A(f"| 합계 | {tot_c}주 ({100.0 * tot_c / n:.0f}%) | {tot_n}주 ({100.0 * tot_n / n:.0f}%) |")
    A('')
    A('### 결 (|z| ≥ 1.0 밴드 밖 축 수, 지표 넷 기준)')
    A('')
    A('| 결 | 뜻 | 주 수 |')
    A('| :---- | :---- | :---- |')
    for k, lab in (('mixed', '`mixed` C | 2축 이상 밴드 밖'), ('coarse', '`coarse` A | 1축만 밴드 밖'),
                   ('regular', '`regular` B | 전부 밴드 안')):
        v = r['grain'].get(k, 0)
        A(f'| {lab} | {v} ({100.0 * v / n:.0f}%) |')
    A('')
    A('### 붙여 넣을 값')
    A('')
    A('`pipeline/gyeol_kit/gyeol/axes.py`')
    A('```python')
    for name, d in (('TAU', r['tau']), ('TAU_UP', r['tau_up']), ('TAU_DOWN', r['tau_down'])):
        A(f'{name} = {{')
        for ax in AX.AXIS_ORDER:
            A(f"    '{ax}':  {_f(d.get(ax))},")
        A('}')
    A('```')
    A('')
    A('`webapp/core/mined_core/judge.py`')
    A('```python')
    A('TEAM_V6_TAU = {')
    for ax in AX.AXIS_ORDER:
        A(f'    "{ax}": {{"up": {_f(r["tau_up"].get(ax))}, "down": {_f(r["tau_down"].get(ax))}}},')
    A('}')
    A('```')
    A('')
    return '\n'.join(L)


# ── --write ────────────────────────────────────────────────

def _sub_dict_line(text, dict_name, ax, value, quote="'"):
    """axes.py 의 `TAU_UP = { ... 'lang':  2.85,   # 임시` 같은 줄을 값으로 바꾸고 「임시」 꼬리표를 뗍니다."""
    m = re.search(rf'^{dict_name} = \{{\n(.*?)^\}}', text, re.S | re.M)
    if not m:
        return text, False
    body = m.group(1)
    pat = re.compile(rf"^(\s*{quote}{ax}{quote}:\s*)[0-9.]+,[^\n]*$", re.M)
    new_body, k = pat.subn(lambda mm: f'{mm.group(1)}{value:.2f},', body)
    if not k:
        return text, False
    return text[:m.start(1)] + new_body + text[m.end(1):], True


def write_axes_py(path, r):
    text = open(path, encoding='utf-8').read()
    changed = False
    for name, d in (('TAU', r['tau']), ('TAU_UP', r['tau_up']), ('TAU_DOWN', r['tau_down'])):
        for ax in r['axes']:
            if d.get(ax) is None:
                continue
            text, ok = _sub_dict_line(text, name, ax, d[ax])
            changed |= ok
    if changed:
        if not r['skipped']:
            text = text.replace(
                "# ⚠ lang·talk 는 옛 남기기(leave) 값을 임시로 옮겼습니다. calibrate_axes.py 를 실데이터로 다시 돌려 바꿉니다\n",
                "# lang·talk 는 calibrate_axes.py --write 로 실데이터에서 다시 잰 값입니다\n")
        open(path, 'w', encoding='utf-8').write(text)
    return changed


def write_core_judge(path, r):
    text = open(path, encoding='utf-8').read()
    changed = False
    for ax in r['axes']:
        u, d = r['tau_up'].get(ax), r['tau_down'].get(ax)
        if u is None or d is None:
            continue
        pat = re.compile(rf'^(\s*"{ax}": )\{{"up": [0-9.]+, "down": [0-9.]+\}},[^\n]*$', re.M)
        text, k = pat.subn(lambda mm: f'{mm.group(1)}{{"up": {u:.2f}, "down": {d:.2f}}},', text)
        changed |= bool(k)
    if changed:
        if not r['skipped']:
            text = text.replace(
                "# ⚠ lang·talk 는 10/23 이전 남기기(leave) 축의 τ 를 임시로 옮겨 썼다. 실기록으로 다시 재야 한다\n"
                "#   (pipeline/gyeol_kit/calibrate_axes.py, 기기 안에서만). 기본 metric(mid_rank_pct)은 τ 를 쓰지 않는다.\n",
                "# lang·talk 는 pipeline/gyeol_kit/calibrate_axes.py --write 로 실기록에서 다시 잰 값이다(기기 안에서만).\n"
                "#   기본 metric(mid_rank_pct)은 τ 를 쓰지 않는다.\n")
        open(path, 'w', encoding='utf-8').write(text)
    return changed


def write_now_md(path, r):
    text = open(path, encoding='utf-8').read()
    orig = text
    for ax in r['axes']:
        u, d = r['tau_up'].get(ax), r['tau_down'].get(ax)
        if u is None or d is None:
            continue
        text = re.sub(rf'^\| {ax} \| [^|\n]+\| [^|\n]+\|$', f'| {ax} | {u:.2f} | {d:.2f} |', text, flags=re.M)
    if r['skipped']:
        # 못 잰 축이 있으면 임시 표시·결 주 수는 그대로 둡니다
        if text != orig:
            open(path, 'w', encoding='utf-8').write(text)
            return True
        return False
    text = re.sub(r'^⚠ 옛 `leave` 값을 임시로 씁니다\..*$',
                  'lang·talk 는 `calibrate_axes.py --write` 로 실데이터에서 다시 잰 값입니다.', text, flags=re.M)
    n = r['n_weeks'] or 1
    for k in ('mixed', 'coarse', 'regular'):
        v = r['grain'].get(k, 0)
        text = re.sub(rf'^(\| `{k}` [A-C] \| [^|\n]+\| )[^|\n]+\|$',
                      lambda mm: f'{mm.group(1)}{v} ({100.0 * v / n:.0f}%) |', text, flags=re.M)
    text = text.replace('주 수는 10/2 옛 4축 기준입니다. τ 재계산 뒤 다시 셉니다.',
                        f'주 수는 지표 넷 기준 실데이터 {r["n_weeks"]}주에서 다시 센 값입니다.')
    if text != orig:
        open(path, 'w', encoding='utf-8').write(text)
        return True
    return False


def write_all(r, kit_dir, repo_root=None, log=print):
    """있는 파일만 고칩니다. 반환: 고친 파일 경로 목록."""
    if r['skipped']:
        log(f"  ⚠ {', '.join(r['skipped'])} 는 재지 못해 지금 값(임시)을 그대로 둡니다")
    if not r['axes']:
        log('  · 잰 축이 없어 아무 파일도 바꾸지 않았습니다')
        return []
    targets = [(os.path.join(kit_dir, 'gyeol', 'axes.py'), write_axes_py)]
    if repo_root:
        targets += [(os.path.join(repo_root, 'webapp', 'core', 'mined_core', 'judge.py'), write_core_judge),
                    (os.path.join(repo_root, 'docs', 'NOW.md'), write_now_md)]
    done = []
    for path, fn in targets:
        if not os.path.exists(path):
            log(f'  · {path} 없음 — 건너뜀 (위 「붙여 넣을 값」을 손으로 옮겨 주세요)')
            continue
        if fn(path, r):
            done.append(path)
            log(f'  ✓ {path}')
        else:
            log(f'  · {path} — 바꿀 줄을 못 찾았거나 이미 같은 값')
    return done
