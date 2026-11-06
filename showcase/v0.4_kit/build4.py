"""Mine D 쇼케이스 출품 영상 v0.4 조립기.

v0.3에서 바뀐 점
- 민디가 나오는 장면은 AI 생성 클립 대신 원본 민디 이미지 합성(comp/*.mp4, render_story.py)으로 바꿔 일관성을 지킨다.
  굴에서 민디가 걸어 나와 서는 컷(기원 영상 C08)을 되살렸다. 점심 장면에는 하빈님 종이 에셋을 쓴다.
- 이야기 구간은 목소리 없이 자막만. 민디 목소리는 마지막 「오늘도 한 층 쌓였습니다」 한 줄에만.
- 효과음은 앱 사운드(mined-sound.js)에서 그대로 렌더링한 sfx/*.flac, 바탕 소리는 사운드 키트 amb_room_tone.
- 작동 화면 효과음은 녹화 때 누른 시각에 맞춘다(엘리베이터·곡괭이 3번·광석 깨짐·기록 열기).

사용 (v0.3_kit 옆에서):
  python3 build4.py --sea 바다.mp4 --sky 하늘산.mp4 --jungle 정글.mp4 --music 음악방.mp4 [--out 출력.mp4]
  FAST=1 이면 960x540 시험판. 나의 섬 구간은 ../v0.3_kit/myspace.json 을 함께 쓴다 ({"sea": [[a,b],[c,d]], ...} 도 됨).
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
FAST = os.environ.get('FAST') == '1'
W, H = (960, 540) if FAST else (3840, 2160)
FPS = 30
XF = 0.5
VENC = ['-c:v', 'libx264', '-preset', 'veryfast' if FAST else 'slow', '-crf', '28' if FAST else '16',
        '-pix_fmt', 'yuv420p', '-r', str(FPS)]
AENC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2']
K3 = '../v0.3_kit'
A = f'{K3}/assets'
CARDS3 = f'{K3}/cards'
DEMO_REC = next(p for p in [f'{A}/demo_rec2_4k.mp4', '../v0.2_kit/assets/demo_rec2_4k.mp4'] if os.path.exists(p))
os.makedirs('seg', exist_ok=True)
VEO_LOGO = 'delogo=x=1236:y=686:w=38:h=24,'


def run(args):
    print('ffmpeg …', args[-1])
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + [str(a) for a in args], check=True)


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'csv=p=0', f]))


def fit(extra=''):
    s = f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},setsar=1,fps={FPS}'
    return s + (',' + extra if extra else '')


def card_png(c):
    p = f'cards/out_{c}.png'
    return p if os.path.exists(p) else f'{CARDS3}/out_{c}.png'


def ov(idx, t0, t1, fade=0.3):
    return (f'[{idx}:v]scale={W}:{H},format=rgba,'
            f'fade=t=in:st={t0}:d={fade}:alpha=1,fade=t=out:st={t1 - fade:.2f}:d={fade}:alpha=1')


def punch(z0, z1, cx, cy, d):
    fx, fy = cx / 1920, cy / 1080
    z = f'({z0}+({z1}-{z0})*min(t/{d},1))'
    return (f"scale=w='iw*{z}':h='ih*{z}':eval=frame:flags=lanczos,"
            f"crop={W}:{H}:x='max(0,min(iw-{W},iw*{fx}-{W}/2))':y='max(0,min(ih-{H},ih*{fy}-{H}/2))'")


class Mix:
    """효과음 이벤트를 모아 입력과 필터를 만든다. events: (이름, 시각, 음량)."""

    def __init__(self, first_input):
        self.n0, self.ins, self.fc, self.labels = first_input, [], '', []

    def add(self, name, t, gain=1.0):
        i = self.n0 + len(self.ins) // 2
        self.ins += ['-i', f'sfx/{name}.flac']
        ms = max(0, int(t * 1000))
        lab = f'fx{len(self.labels)}'
        self.fc += (f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain},'
                    f'adelay={ms}|{ms}[{lab}];')
        self.labels.append(f'[{lab}]')
        return self


def k10_crack(path, skip, d):
    """K10(광석이 열리는 Flow 클립)에서 화면이 가장 크게 바뀌는 순간 = 깨지는 소리 자리."""
    try:
        raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-ss', str(skip), '-t', str(d), '-i', path,
                                       '-vf', 'scale=64:36,format=gray,fps=30', '-f', 'rawvideo', '-'])
    except Exception:
        return 2.4
    n = len(raw) // (64 * 36)
    best, bt = -1, 2.4
    for k in range(1, n):
        a, b = raw[(k - 1) * 2304:k * 2304], raw[k * 2304:(k + 1) * 2304]
        s = sum(abs(x - y) for x, y in zip(a, b))
        if s > best:
            best, bt = s, k / 30
    print(f'  K10 깨짐 시각 {bt:.2f}s')
    return bt


# ───────────────────────── 1·2 제목 · 기술 사용
def still(png, d, music, mstart, out, fi=0.8, fo=0.6):
    run(['-loop', '1', '-t', d, '-i', png, '-ss', mstart, '-t', d, '-i', music, '-filter_complex',
         f'[0:v]{fit()},zoompan=z=\'1+0.010*on/{d * FPS}\':d=1:s={W}x{H}:fps={FPS},'
         f'fade=t=in:st=0:d={fi},fade=t=out:st={d - fo:.2f}:d={fo}[v];'
         f'[1:a]volume=0.5,afade=t=in:st=0:d=1,afade=t=out:st={d - 0.8:.2f}:d=0.8[a]',
         '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 3 이야기: 자막만, 목소리 없음
STEPS = [0.9 + k / 2.3 for k in range(1, 14)]  # render_story.py walk_pose(step_hz=1.15)의 발 닿는 시각
STORY = [  # (클립, 길이, 건너뛸 초, Flow 여부, [(자막, 시작, 끝)], 바탕 소리 음량)
    (f'{K3}/gen/K01.mp4', 6.5, 0.0, True, [('sub01', 0.9, 6.2)], 0.0),
    ('comp/S2_walk.mp4', 8.0, 0.0, False, [('sub02', 4.4, 7.8)], 0.55),
    ('comp/S3_papers.mp4', 7.0, 0.0, False, [('sub03', 0.8, 6.7)], 0.5),
    ('comp/S4_strata.mp4', 6.0, 0.0, False, [('sub06', 0.9, 5.8)], 0.45),
    (f'{K3}/gen/K10.mp4', 6.0, 0.7, True, [('sub10', 2.9, 5.9)], 0.3),
]


def story(out):
    ins, fc = [], ''
    for f, d, ss, *_x in STORY:
        ins += ['-i', f]
    subs = [s for *_x, ss_, _a in STORY for s in ss_]
    base = len(STORY)
    for s in subs:
        ins += ['-loop', '1', '-i', card_png(s[0])]
    mus = base + len(subs)
    ins += ['-i', f'{A}/mus_hearth.mp3', '-stream_loop', '-1', '-i', 'sfx/amb_room_tone.flac']
    amb = mus + 1
    pi = 0
    for i, (f, d, ss, flow, ss_, _a) in enumerate(STORY):
        fc += f'[{i}:v]{VEO_LOGO if flow else ""}trim={ss}:{ss + d},setpts=PTS-STARTPTS,{fit()},format=yuv420p[c{i}];'
        last = f'c{i}'
        for j, (s, t0, t1) in enumerate(ss_):
            fc += ov(base + pi, t0, t1, 0.35) + f'[o{i}{j}];[{last}][o{i}{j}]overlay=0:0:shortest=1[c{i}_{j}];'
            last = f'c{i}_{j}'
            pi += 1
        fc += f'[{last}]trim=0:{d},setpts=PTS-STARTPTS[s{i}];'
    acc, t, starts = 's0', STORY[0][1], [0.0]
    for i in range(1, len(STORY)):
        fc += f'[{acc}][s{i}]xfade=transition=fade:duration={XF}:offset={t - XF:.2f}[x{i}];'
        starts.append(t - XF)
        acc, t = f'x{i}', t + STORY[i][1] - XF
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.6[v];'
    # 효과음
    mx = Mix(amb + 1)
    s1, s2, s3, s4 = starts[1:5]
    mx.add('fog_clear', 0.2, 0.9)
    for k, st in enumerate(STEPS):  # 굴 안 → 앞: 멀리서 점점 가까이
        mx.add('step1', s1 + st, 1.2 + 2.6 * k / (len(STEPS) - 1))
    mx.add('shuffle', s2 + 0.3, 2.2).add('card', s2 + 0.5, 1.8)
    for k in range(15):  # 지층 위 날짜 표시가 하나씩 생길 때
        mx.add('floor_tick', s3 + 0.4 + k * 0.32 + 0.45, 0.35)
    crack = k10_crack(STORY[4][0], STORY[4][2], STORY[4][1])
    mx.add('glint', s4 + 0.4, 1.2).add('ore_crack', s4 + crack, 1.0)
    ins += mx.ins
    fc += mx.fc
    # 바탕 소리: 굴 장면 동안만 (S2~S4), 장면 사이 부드럽게
    ae = (f'volume=0:enable=\'lt(t,{s1 - 0.3:.2f})+gt(t,{s4 + 1.5:.2f})\','
          f'afade=t=in:st={s1 - 0.3:.2f}:d=1.2')
    fc += (f'[{amb}:a]atrim=0:{total},aresample=48000,aformat=channel_layouts=stereo,volume=0.55,{ae}[am];'
           f'[{mus}:a]atrim=0:{total + 4},aresample=48000,volume=0.48,afade=t=in:st=0:d=1.5[m];'
           f'[m][am]{"".join(mx.labels)}amix=inputs={len(mx.labels) + 2}:normalize=0,atrim=0:{total}[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 4 다리 카드
def card(png, d, out, music=None, mstart=0, mvol=0.45, fi=0.6, fo=0.6, fx=()):
    ins = ['-loop', '1', '-t', d, '-i', png]
    if music:
        ins += ['-ss', mstart, '-t', d, '-i', music]
        af = f'[1:a]aresample=48000,volume={mvol},afade=t=in:st=0:d=0.4,afade=t=out:st={d - 0.6:.2f}:d=0.6[a0];'
    else:
        ins += ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo']
        af = '[1:a]anull[a0];'
    mx = Mix(2)
    for e in fx:
        mx.add(*e)
    ins += mx.ins
    af += mx.fc + f'[a0]{"".join(mx.labels)}amix=inputs={len(mx.labels) + 1}:normalize=0,atrim=0:{d}[a]'
    run(ins + ['-filter_complex', f'[0:v]{fit()},fade=t=in:st=0:d={fi},fade=t=out:st={d - fo:.2f}:d={fo}[v];' + af,
               '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 5 실제 작동 화면
DEMO = [
    (2.0, 8.0, (1.00, 1.12, 1000, 520), None),
    (9.0, 13.6, (1.55, 1.85, 1000, 300), 's1'),
    (14.5, 21.5, (1.00, 1.10, 960, 600), 's2'),
    (25.8, 36.0, (1.10, 1.35, 940, 640), 's3'),
    (36.0, 40.6, (1.15, 1.30, 1180, 560), None),
    (42.1, 47.4, (1.35, 1.65, 730, 470), 's4'),
]
# 녹화 원본 시각(record2.js 표시 + 화면 변화)에 맞춘 앱 효과음
DEMO_FX = [('appear', 2.2, 1.0), ('memory_note', 9.2, 1.4), ('confirm', 14.55, 1.2),
           ('lift_start', 19.3, 1.0), ('lift_arrive', 21.9, 1.0), ('tap', 27.3, 1.2),
           ('pick', 30.27, 1.1), ('pick', 32.55, 1.1), ('pick', 34.83, 1.1), ('ore_crack', 34.9, 1.0),
           ('glint', 36.4, 1.0), ('panel_open', 42.45, 2.0)]


def demo(out, music, mstart):
    ins, fc, segs = ['-i', DEMO_REC], '', []
    cards = [c for *_x, c in DEMO if c]
    for c in cards:
        ins += ['-loop', '1', '-i', card_png(c)]
    ins += ['-ss', mstart, '-i', music]
    mi = 1 + len(cards)
    ci = 1
    fc += f'[0:v]split={len(DEMO)}' + ''.join(f'[r{i}]' for i in range(len(DEMO))) + ';'
    starts, t = [], 0.0
    for i, (a, b, (z0, z1, cx, cy), c) in enumerate(DEMO):
        d = b - a
        fc += f'[r{i}]trim={a}:{b},setpts=PTS-STARTPTS,{fit()},{punch(z0, z1, cx, cy, d)},setsar=1[p{i}];'
        if c:
            fc += ov(ci, 0.4, d - 0.1, 0.35) + f'[q{i}];[p{i}][q{i}]overlay=0:0:shortest=1[d{i}];'
            ci += 1
        else:
            fc += f'[p{i}]null[d{i}];'
        starts.append(t if i == 0 else t - 0.35)
        t = d if i == 0 else t + d - 0.35
        segs.append(d)
    acc = 'd0'
    for i in range(1, len(segs)):
        fc += f'[{acc}][d{i}]xfade=transition=fade:duration=0.35:offset={starts[i]:.2f}[y{i}];'
        acc = f'y{i}'
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.6:.2f}:d=0.6[v];'

    def out_t(src):  # 원본 시각 → 이 구간 시각 (보이는 조각 안일 때만)
        for (a, b, *_x), s in zip(DEMO, starts):
            if a <= src < b:
                return s + src - a
        return None
    mx = Mix(mi + 1)
    for name, src, g in DEMO_FX:
        ot = out_t(src)
        if ot is not None:
            mx.add(name, ot, g)
    ins += mx.ins
    fc += mx.fc
    fc += (f'[{mi}:a]aresample=48000,volume=0.42,afade=t=in:st=0:d=1,afade=t=out:st={total - 1.5:.2f}:d=1.5,'
           f'atrim=0:{total}[m];[m]{"".join(mx.labels)}amix=inputs={len(mx.labels) + 1}:normalize=0,atrim=0:{total}[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 6 나의 섬 (구간 여러 개 지원)
def islands(spaces, out):
    """spaces: [(파일, [(a,b),...], key)]"""
    ins, fc = [], ''
    for f, *_x in spaces:
        ins += ['-i', f]
    n = len(spaces)
    for *_x, key in spaces:
        ins += ['-loop', '1', '-i', card_png(f'opt_{key}')]
    ins += ['-loop', '1', '-i', card_png('isl'), '-i', f'{A}/mus_open.mp3']
    isl, mus = 2 * n, 2 * n + 1
    pieces = []  # (비디오 라벨, 오디오 라벨, 길이)
    for i, (f, cuts, key) in enumerate(spaces):
        fc += f'[{i}:v]split={len(cuts)}' + ''.join(f'[v{i}_{j}]' for j in range(len(cuts))) + ';'
        fc += f'[{i}:a]asplit={len(cuts)}' + ''.join(f'[a{i}_{j}]' for j in range(len(cuts))) + ';'
        for j, (a, b) in enumerate(cuts):
            d = b - a
            fc += f'[v{i}_{j}]trim={a}:{b},setpts=PTS-STARTPTS,{fit()}[r{i}_{j}];'
            last = f'r{i}_{j}'
            if j == 0:
                fc += ov(n + i, 0.5, min(5.5, d - 0.3), 0.4) + f'[o{i}];[{last}][o{i}]overlay=0:0:shortest=1[t{i}];'
                last = f't{i}'
                if i == 0:
                    fc += ov(isl, 0.4, 4.4, 0.5) + f'[il];[{last}][il]overlay=0:0:shortest=1[u0];'
                    last = 'u0'
            fc += (f'[a{i}_{j}]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,'
                   f'volume=0.9[n{i}_{j}];')
            pieces.append((last, f'n{i}_{j}', d, j == 0))
    acc, aacc, t = pieces[0][0], pieces[0][1], pieces[0][2]
    for k in range(1, len(pieces)):
        v, a, d, new_space = pieces[k]
        x = 0.8 if new_space else 0.4
        fc += f'[{acc}][{v}]xfade=transition=fade:duration={x}:offset={t - x:.2f}[w{k}];'
        fc += f'[{aacc}][{a}]acrossfade=d={x}[m{k}];'
        acc, aacc, t = f'w{k}', f'm{k}', t + d - x
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.8:.2f}:d=0.8[v];'
    mx = Mix(mus + 1)
    mx.add('space_open', 0.5, 1.2)
    ins += mx.ins
    fc += mx.fc
    fc += (f'[{mus}:a]aresample=48000,volume=0.32,afade=t=in:st=0:d=2,afade=t=out:st={total - 2:.2f}:d=2,'
           f'apad,atrim=0:{total}[bm];[{aacc}][bm]{"".join(mx.labels)}amix=inputs={len(mx.labels) + 2}:normalize=0,'
           f'afade=t=out:st={total - 1:.2f}:d=1[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 7 여운: 굴 앞에 선 민디 + 오늘의 한마디(유일한 목소리)
def ending(out, music, mstart):
    d1, d2, d3 = 6.0, 3.8, 5.5
    ins = ['-i', 'comp/S9_end.mp4', '-loop', '1', '-i', card_png('b12'), '-loop', '1', '-t', d2, '-i', card_png('end1'),
           '-loop', '1', '-t', d3, '-i', card_png('end2'), '-i', f'{A}/voice/line_B_C12_1.mp3',
           '-ss', mstart, '-i', music, '-stream_loop', '-1', '-i', 'sfx/amb_room_tone.flac']
    tot = d1 + d2 + d3 - 1.6
    fc = (f'[0:v]trim=0:{d1},setpts=PTS-STARTPTS,{fit()},format=yuv420p[k];'
          + ov(1, 0.9, d1 - 0.3) + f'[b];[k][b]overlay=0:0:shortest=1,trim=0:{d1},setpts=PTS-STARTPTS[e0];'
          f'[2:v]{fit()}[e1];[3:v]{fit()},zoompan=z=\'1+0.015*on/{d3 * FPS}\':d=1:s={W}x{H}:fps={FPS}[e2];'
          f'[e0][e1]xfade=transition=fade:duration=0.8:offset={d1 - 0.8}[f1];'
          f'[f1][e2]xfade=transition=fade:duration=0.8:offset={d1 + d2 - 1.6}[f2];'
          f'[f2]fade=t=in:st=0:d=0.6,fade=t=out:st={tot - 0.8:.2f}:d=0.8[v];'
          f'[4:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.6,adelay=1100|1100[vo];'
          f'[5:a]aresample=48000,volume=0.5,afade=t=in:st=0:d=1.2,afade=t=out:st={tot - 1.5:.2f}:d=1.5,atrim=0:{tot}[m];'
          f'[6:a]atrim=0:{d1},aresample=48000,aformat=channel_layouts=stereo,volume=0.45,afade=t=in:st=0:d=0.8,'
          f'afade=t=out:st={d1 - 1.2}:d=1.2[am];')
    mx = Mix(7)
    mx.add('name_save', d1 + d2 - 1.2, 0.8)
    ins += mx.ins
    fc += mx.fc + f'[m][vo][am]{"".join(mx.labels)}amix=inputs={3 + len(mx.labels)}:normalize=0,atrim=0:{tot}[a]'
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{tot:.3f}'] + VENC + AENC + [out])


def main():
    ap = argparse.ArgumentParser()
    for k in ('sea', 'sky', 'jungle', 'music'):
        ap.add_argument('--' + k, required=True)
    ap.add_argument('--out', default='MineD_쇼케이스_v0.4.mp4')
    o = ap.parse_args()
    mj = next((p for p in ['myspace.json', f'{K3}/myspace.json'] if os.path.exists(p)), None)
    cut = json.load(open(mj)) if mj else {}
    spaces = []
    for key in ('sea', 'sky', 'jungle', 'music'):
        f = getattr(o, key)
        c = cut.get(key)
        if not c:
            d = dur(f)
            c = [max(0, d - 14), d - 0.5]
        cuts = [tuple(x) for x in c] if isinstance(c[0], (list, tuple)) else [tuple(c)]
        spaces.append((f, cuts, key))
    home = f'{A}/mus_home.mp3'
    still(card_png('title'), 5, home, 0, 'seg/01_title.mp4', fi=1.0)
    still(card_png('spec'), 9, home, 5, 'seg/02_spec.mp4')
    story('seg/03_story.mp4')
    card(card_png('bridge'), 3.2, 'seg/04_bridge.mp4', f'{A}/mus_hearth.mp3', 40, 0.3, fx=[('confirm', 0.5, 0.8)])
    demo('seg/05_demo.mp4', home, 30)
    islands(spaces, 'seg/06_islands.mp4')
    ending('seg/07_end.mp4', home, 140)
    card(card_png('credit'), 7, 'seg/08_credit.mp4', f'{A}/mus_open.mp3', 30, 0.4, fo=1.0)
    run(['-f', 'lavfi', '-t', 1, '-i', f'color=c=black:s={W}x{H}:r={FPS}', '-f', 'lavfi', '-t', 1,
         '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a', '-t', 1] + VENC + AENC + ['seg/09_black.mp4'])
    segs = ['01_title', '02_spec', '03_story', '04_bridge', '05_demo', '06_islands', '07_end', '08_credit', '09_black']
    open('seg/list.txt', 'w').write('\n'.join(f"file '{s}.mp4'" for s in segs))
    run(['-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', 'seg/joined.mp4'])
    run(['-i', 'seg/joined.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11'] + AENC
        + ['-movflags', '+faststart', o.out])
    for s in segs:
        print(f'{s:12s} {dur(f"seg/{s}.mp4"):6.2f}')
    print('TOTAL', round(dur(o.out), 2), o.out)


if __name__ == '__main__':
    main()
