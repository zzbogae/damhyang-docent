# -*- coding: utf-8 -*-
"""
run_gyeol.py 에 흡수한 원칙 v6·원문 붙이기(gyeol/principles.py)와
τ 다시 재기(gyeol/retune.py)의 시험. 실데이터 없이 돕니다.

    python3 -m pytest -q pipeline/gyeol_kit/tests
"""
import json
import os
import random
import shutil
import sys
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE)
REPO = os.path.dirname(os.path.dirname(KIT))
sys.path.insert(0, KIT)

from gyeol import principles as P   # noqa: E402
from gyeol import retune as RT      # noqa: E402

REC = '그리고 약 4주 뒤부터 평소의 흐름이 이어졌습니다.'


def _relics(tmp_path, rows):
    d = tmp_path / 'data'
    d.mkdir()
    with open(d / P.CLEAN_NAME, 'w', encoding='utf-8') as f:
        f.write('created_at\ttext\n')
        for ts, t in rows:
            f.write(f'{ts}\t{t}\n')
    return P.load_relics(str(d), log=lambda *_: None)


def test_relics_skip_raw_file(tmp_path):
    d = tmp_path / 'data'
    d.mkdir()
    (d / P.RAW_NAME).write_text('created_at\ttext\n2024-01-02 10:00\tpw 1234\n', encoding='utf-8')
    msgs = []
    assert P.load_relics(str(d), log=msgs.append) == {}
    assert any('sanitize_notes' in m for m in msgs)


def test_relics_longest_first_and_more(tmp_path):
    r = _relics(tmp_path, [('2024-01-02 10:00', 'a'), ('2024-01-02 03:10', 'bbbb'),
                           ('2024-01-03 11:00', 'cc'), ('2024-01-04 12:00', 'ddd')])
    wk = r['2024-W01']
    assert [q['t'] for q in wk['q']] == ['bbbb', 'ddd', 'cc']
    assert wk['more'] == 1
    assert wk['q'][0]['n'] == 1     # 새벽 0~4시


def test_apply_to_data_mutes_recovery_and_attaches(tmp_path):
    relics = _relics(tmp_path, [('2024-01-02 10:00', '그 주의 글')])
    path = tmp_path / 'gyeol_data.json'
    weeks = [
        {'week': '2024-W01', 'sentence': f'걸음이 많았습니다 (상위 3%) {REC}', 'tier': 'recovered', 'relic': None},
        {'week': '2024-W10', 'sentence': f'걸음이 많았습니다 (상위 18%) {REC}', 'tier': 'recovered', 'relic': None},
    ]
    path.write_text(json.dumps({'weeks': weeks}, ensure_ascii=False), encoding='utf-8')
    st = P.apply_to_data(str(path), relics, log=lambda *_: None)
    d = json.loads(path.read_text(encoding='utf-8'))
    assert st == {'weeks': 2, 'muted': 1, 'relic': 1}
    assert d['principles'] == 'v6'
    assert '흐름이 이어졌습니다' not in d['weeks'][0]['sentence'] and d['weeks'][0]['tier'] == 'observed'
    assert d['weeks'][1]['tier'] == 'recovered'            # 두드러지지 않은 주는 그대로
    assert d['weeks'][0]['relic']['q'][0]['t'] == '그 주의 글'


def _wall(tmp_path, n=20):
    last = date(2024, 6, 3)
    W = []
    for i in range(n):
        d0 = last - timedelta(weeks=n - 1 - i)
        y, w, _ = d0.isocalendar()
        W.append({'w': f'{y}-W{w:02d}', 'd': d0.isoformat(), 'open': 0 if i % 3 == 0 else 1,
                  **({'t': f'많았습니다 (상위 2%) {REC}'} if i == 1 else {})})
    html = ('<html><style>.a{}</style><body>'
            '<p>누르면 열립니다. 열리지 않는 것도 있습니다.</p>'
            '<div class="fam" id="pfam"></div>'
            f'<script>const WEEKS = {json.dumps(W, ensure_ascii=False)};</script></body></html>')
    p = tmp_path / 'gyeol_wall.html'
    p.write_text(html, encoding='utf-8')
    return p, W


def test_apply_to_wall_unseals_keeps_recent_and_is_idempotent(tmp_path):
    p, W = _wall(tmp_path)
    relics = {W[2]['w']: {'q': [{'t': 'x', 'd': W[2]['d'], 'h': 1, 'mi': 2, 'n': 1, 'len': 1}], 'more': 0}}
    st = P.apply_to_wall(str(p), relics, log=lambda *_: None)
    assert st['weeks'] == 20 and st['muted'] == 1
    assert st['open'] == 20 - P.RECENT_WEEKS                  # 최근 8주만 닫힘
    once = p.read_text(encoding='utf-8')
    assert once.count('/* 유물') == 1 and 'id="prelic"' in once
    assert '아직 지나가지 않은 것은 열리지 않습니다' in once
    P.apply_to_wall(str(p), relics, log=lambda *_: None)
    assert p.read_text(encoding='utf-8') == once               # 여러 번 돌려도 같음


# ── retune ────────────────────────────────────────────────

def _merged(with_talk=True, n=260, seed=3):
    rnd = random.Random(seed)
    out = {}
    d0 = date(2019, 1, 7)
    for i in range(n):
        y, w, _ = (d0 + timedelta(weeks=i)).isocalendar()
        row = {'avg_steps': rnd.gauss(7000, 1500), 'avg_sleep': rnd.gauss(6.8, 0.6),
               'notes_count': max(0, int(rnd.expovariate(1 / 6))), 'notes_avg_length': rnd.gauss(80, 25)}
        if with_talk:
            row.update(avg_length=rnd.gauss(14, 4), avg_reply_delay_min=abs(rnd.gauss(30, 20)))
        out[f'{y}-W{w:02d}'] = row
    return out


def _weeks(m):
    return sorted(m, key=lambda k: (int(k.split('-W')[0]), int(k.split('-W')[1])))


def test_retune_measures_lang_talk_only():
    m = _merged()
    r = RT.compute(m, _weeks(m))
    assert r['axes'] == ['lang', 'talk'] and r['skipped'] == []
    assert r['tau_up']['move'] == r['cur_up']['move']          # 확정값은 그대로
    assert r['tau_up']['lang'] != r['cur_up']['lang']
    assert sum(r['grain'].values()) == len(m)
    assert '붙여 넣을 값' in RT.render(r)


def test_retune_skips_axis_without_data_and_keeps_temp_marks(tmp_path):
    m = _merged(with_talk=False)
    r = RT.compute(m, _weeks(m))
    assert r['axes'] == ['lang'] and r['skipped'] == ['talk']
    kit = tmp_path / 'kit'
    (kit / 'gyeol').mkdir(parents=True)
    shutil.copy(os.path.join(KIT, 'gyeol', 'axes.py'), kit / 'gyeol' / 'axes.py')
    repo = tmp_path / 'repo'
    (repo / 'webapp' / 'core' / 'mined_core').mkdir(parents=True)
    (repo / 'docs').mkdir()
    shutil.copy(os.path.join(REPO, 'webapp', 'core', 'mined_core', 'judge.py'), repo / 'webapp' / 'core' / 'mined_core' / 'judge.py')
    shutil.copy(os.path.join(REPO, 'docs', 'NOW.md'), repo / 'docs' / 'NOW.md')
    done = RT.write_all(r, str(kit), str(repo), log=lambda *_: None)
    assert len(done) == 3
    ax = (kit / 'gyeol' / 'axes.py').read_text(encoding='utf-8')
    assert f"'lang':  {r['tau_up']['lang']:.2f}," in ax
    assert "'talk':  2.85,   # 임시" in ax                     # 못 잰 축은 임시 그대로
    now = (repo / 'docs' / 'NOW.md').read_text(encoding='utf-8')
    assert '| talk | 2.85 ⚠ | 1.37 ⚠ |' in now
    assert f"| lang | {r['tau_up']['lang']:.2f} | {r['tau_down']['lang']:.2f} |" in now
    assert '⚠ 옛 `leave` 값을 임시로 씁니다' in now               # 결 주 수·안내 줄도 그대로


def test_retune_write_all_axes_clears_temp_marks(tmp_path):
    m = _merged()
    r = RT.compute(m, _weeks(m))
    kit = tmp_path / 'kit'
    (kit / 'gyeol').mkdir(parents=True)
    shutil.copy(os.path.join(KIT, 'gyeol', 'axes.py'), kit / 'gyeol' / 'axes.py')
    repo = tmp_path / 'repo'
    (repo / 'webapp' / 'core' / 'mined_core').mkdir(parents=True)
    (repo / 'docs').mkdir()
    jp = repo / 'webapp' / 'core' / 'mined_core' / 'judge.py'
    shutil.copy(os.path.join(REPO, 'webapp', 'core', 'mined_core', 'judge.py'), jp)
    shutil.copy(os.path.join(REPO, 'docs', 'NOW.md'), repo / 'docs' / 'NOW.md')
    RT.write_all(r, str(kit), str(repo), log=lambda *_: None)
    ax = (kit / 'gyeol' / 'axes.py').read_text(encoding='utf-8')
    assert '임시' not in ax.split('STEP =')[0].split('TAU = {')[1]
    j = jp.read_text(encoding='utf-8')
    assert f'"talk": {{"up": {r["tau_up"]["talk"]:.2f}, "down": {r["tau_down"]["talk"]:.2f}}},' in j
    compile(j, 'judge.py', 'exec')
    now = (repo / 'docs' / 'NOW.md').read_text(encoding='utf-8')
    assert '⚠ 옛 `leave`' not in now and '다시 센 값입니다' in now
    assert f"| `regular` B | 전부 밴드 안 | {r['grain'].get('regular', 0)} (" in now
