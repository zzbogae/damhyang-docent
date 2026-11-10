"""Mine D 쇼케이스 출품 영상 v0.5 조립기 (보별 11/06 v0.4.1 피드백 반영).

바뀐 점
- 민디가 굴에서 걸어 나오는 장면 = 홈페이지(시연판) 관측소 첫 방문 화면을 실제로 녹화한 rec/walk.mp4
- 지층 = 시연판 새 방식(맨 위 최근 12주가 한 주 한 층, 아래로 연 층), 광석 = 단희님 원 디자인(검은 돌 → 깨면 결 색)
- 기술 설명 = 멘토 방식처럼 「넣은 기록(화면 속 화면) → 광석의 결」을 한 화면에
- 민디와 이야기(챗봇) · 나의 섬 고르기 단계를 실제 화면으로 추가
- 민디가 말할 때 외계어 목소리를 낮게 깔고, 자막 글씨는 v0.4 크기
- 음악은 처음부터 끝까지 한 줄(mus_home 이어 붙임)로 깔고, 구간마다 음량만 바꿔 끊기지 않게

사용 (v0.3_kit · v0.4_kit 옆):
  python3 build5.py --sea 바다.mp4 --sky 하늘산.mp4 --jungle 정글.mp4 --music 음악방.mp4 [--out 출력.mp4]
  FAST=1 이면 960x540 시험판.
"""
import argparse, json, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
FAST = os.environ.get('FAST') == '1'
W, H = (960, 540) if FAST else (3840, 2160)
FPS = 30
VENC = ['-c:v', 'libx264', '-preset', 'veryfast' if FAST else 'slow', '-crf', '28' if FAST else '16',
        '-pix_fmt', 'yuv420p', '-r', str(FPS)]
AENC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2']
K3, K4 = '../v0.3_kit', '../v0.4_kit'
A = f'{K3}/assets'
VEO_LOGO = 'delogo=x=1236:y=686:w=38:h=24,'
VOICE = 0.6  # 민디 목소리: 낮게 깔기 (v0.4는 1.6)
os.makedirs('seg', exist_ok=True)


def run(args):
    print('ffmpeg …', args[-1])
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + [str(a) for a in args], check=True)


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'csv=p=0', f]))


def fit(extra=''):
    s = f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},setsar=1,fps={FPS}'
    return s + (',' + extra if extra else '')


def card(c):
    for d in ('cards', f'{K4}/cards', f'{K3}/cards'):
        if os.path.exists(f'{d}/out_{c}.png'):
            return f'{d}/out_{c}.png'
    raise FileNotFoundError(c)


def ov(idx, t0, t1, fade=0.35):
    return (f'[{idx}:v]scale={W}:{H},format=rgba,'
            f'fade=t=in:st={t0}:d={fade}:alpha=1,fade=t=out:st={t1 - fade:.2f}:d={fade}:alpha=1')


def punch(z0, z1, cx, cy, d):
    fx, fy = cx / 1920, cy / 1080
    z = f'({z0}+({z1}-{z0})*min(t/{d},1))'
    return (f"scale=w='iw*{z}':h='ih*{z}':eval=frame:flags=lanczos,"
            f"crop={W}:{H}:x='max(0,min(iw-{W},iw*{fx}-{W}/2))':y='max(0,min(ih-{H},ih*{fy}-{H}/2))'")


class Mix:
    def __init__(self, first):
        self.n0, self.ins, self.fc, self.labels = first, [], '', []

    def add(self, path, t, gain=1.0):
        i = self.n0 + len(self.ins) // 2
        self.ins += ['-i', path]
        ms = max(0, int(t * 1000))
        lab = f'fx{len(self.labels)}'
        self.fc += f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain},adelay={ms}|{ms}[{lab}];'
        self.labels.append(f'[{lab}]')
        return self

    def sfx(self, name, t, gain=1.0):
        return self.add(f'{K4}/sfx/{name}.flac', t, gain)

    def voice(self, line, t):
        return self.add(f'{A}/voice/line_B_{line}.mp3', t, VOICE)

    def out(self, d, base=None):
        """효과음을 모두 섞은 [a]. base: 이미 있는 오디오 라벨."""
        labs = ([base] if base else []) + self.labels
        if not labs:
            return f'anullsrc=r=48000:cl=stereo,atrim=0:{d}[a]'
        return f'{"".join(labs)}amix=inputs={len(labs)}:normalize=0,apad,atrim=0:{d}[a]'


def silent_ins(d):
    return ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo']


# ───────────────────────── 1·2 제목 · 기술 사용 (음악은 마지막에 한 줄로)
def still(png, d, out, fi=0.8, fo=0.6):
    run(['-loop', '1', '-t', d, '-i', png] + silent_ins(d) + ['-filter_complex',
         f'[0:v]{fit()},zoompan=z=\'1+0.010*on/{d * FPS}\':d=1:s={W}x{H}:fps={FPS},'
         f'fade=t=in:st=0:d={fi},fade=t=out:st={d - fo:.2f}:d={fo}[v];[1:a]anull[a]',
         '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 3 이야기: 안개 관측소 → 홈페이지 관측소에서 민디가 걸어 나옴 → 점심 사진
STORY = [  # (파일, 시작, 길이, Flow 여부, 확대(z0,z1,cx,cy) 또는 None, [(자막, t0, t1, 목소리)])
    (f'{K3}/gen/K01.mp4', 0.0, 6.5, True, None, [('sub01', 0.9, 6.2, 'C01_1')]),
    ('rec/walk.mp4', 1.1, 6.9, False, (1.0, 1.08, 1000, 600), [('sub02', 3.3, 6.7, 'C02_2')]),  # 11/09 walk 1.00초 컷 앞 0.2초 숏 빼기
    (f'{K4}/comp/S3_papers.mp4', 0.0, 7.0, False, None, [('sub03', 0.8, 6.7, 'C03_1')]),
]
XF = 0.6


def story(out, STORY=STORY):
    ins, fc = [], ''
    for f, ss, d, *_x in STORY:
        ins += ['-ss', ss, '-t', d + 0.2, '-i', f]
    subs = [s for *_x, ss_ in STORY for s in ss_]
    base = len(STORY)
    for s in subs:
        ins += ['-loop', '1', '-i', card(s[0])]
    amb = base + len(subs)
    ins += ['-stream_loop', '-1', '-i', f'{K4}/sfx/amb_room_tone.flac']
    pi = 0
    for i, (f, ss, d, flow, z, ss_) in enumerate(STORY):
        zf = (',' + punch(*z, d)) if z else ''
        fc += f'[{i}:v]{VEO_LOGO if flow else ""}trim=0:{d},setpts=PTS-STARTPTS,{fit()}{zf},format=yuv420p[c{i}];'
        last = f'c{i}'
        for j, (s, t0, t1, _v) in enumerate(ss_):
            fc += ov(base + pi, t0, t1) + f'[o{i}{j}];[{last}][o{i}{j}]overlay=0:0:shortest=1[c{i}_{j}];'
            last = f'c{i}_{j}'
            pi += 1
        fc += f'[{last}]trim=0:{d},setpts=PTS-STARTPTS[s{i}];'
    acc, t, starts = 's0', STORY[0][2], [0.0]
    for i in range(1, len(STORY)):
        fc += f'[{acc}][s{i}]xfade=transition=fade:duration={XF}:offset={t - XF:.2f}[x{i}];'
        starts.append(t - XF)
        acc, t = f'x{i}', t + STORY[i][2] - XF
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.5:.2f}:d=0.5[v];'
    mx = Mix(amb + 1)
    mx.sfx('fog_clear', 0.2, 0.8)
    for i, (*_x, ss_) in enumerate(STORY):
        for (_s, t0, _t1, v) in ss_:
            mx.voice(v, starts[i] + t0 + 0.15)
    w = starts[1]
    for k in range(8):  # 홈페이지 걸어 나오기(4.2초로 늦춤) 발소리
        mx.sfx('step1', w + 0.15 + k * 0.48, 1.0 + 2.2 * k / 7)
    if len(STORY) > 2:
        mx.sfx('shuffle', starts[2] + 0.3, 2.0).sfx('card', starts[2] + 0.5, 1.6)
    ins += mx.ins
    fc += mx.fc
    fc += (f'[{amb}:a]atrim=0:{total},aresample=48000,aformat=channel_layouts=stereo,volume=0.5,'
           f'volume=0:enable=\'lt(t,{w - 0.3:.2f})\',afade=t=in:st={w - 0.3:.2f}:d=1.0,'
           f'afade=t=out:st={total - 1.2:.2f}:d=1.2[am];' + mx.out(total, '[am]'))
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


def bridge(out, d=3.2):
    mx = Mix(2).sfx('confirm', 0.5, 0.8)
    run(['-loop', '1', '-t', d, '-i', card('bridge')] + silent_ins(d) + mx.ins + ['-filter_complex',
        f'[0:v]{fit()},fade=t=in:st=0:d=0.6,fade=t=out:st={d - 0.6:.2f}:d=0.6[v];' + mx.fc + mx.out(d),
        '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 5 실제 작동 화면 (시연판 PR #22 녹화)
# (파일, 시작, 끝, 속도, 확대, [(카드, t0, t1)], [(효과음, 원본 시각, 음량)])
DEMO = [
    # mine3 = 시연판 39f87f0(합성 샘플 2026-11-08까지): 엘리베이터 → 최근 12주 → 2026년 10월 3주 형석 캐기
    ('rec/mine3.mp4', 1.0, 6.9, 1.0, (1.0, 1.06, 960, 560), [('w1', 0.4, 5.9)],
     [('tap', 1.5, 1.0), ('lift_start', 4.75, 1.0), ('floor_tick', 6.4, 1.0)]),
    ('rec/mine3.mp4', 7.7, 14.3, 1.0, (1.0, 1.10, 960, 480), [('w1', 0.0, 6.6)],  # 7.40·7.60 컷 뒤부터
     [('lift_arrive', 7.75, 1.0)]),
    ('rec/mine3.mp4', 14.2, 28.4, 1.0, (1.0, 1.08, 1100, 640), [('pip1', 1.0, 14.2), ('w2', 1.0, 14.2)],
     [('tap', 14.46, 1.2), ('pick', 18.09, 1.1), ('pick', 20.45, 1.1), ('pick', 22.81, 1.1),
      ('ore_crack', 22.88, 1.0), ('glint', 23.66, 1.0)]),
    ('rec/chat.mp4', 13.8, 23.35, 1.0, (1.12, 1.30, 1300, 420), [('w3', 0.3, 9.5)],  # 13.70 컷 뒤부터  # 녹화 길이 23.43초
     [('tap', 13.13, 1.0), ('memory_note', 14.2, 1.3), ('panel_open', 21.19, 1.8)]),
    ('rec/island.mp4', 4.0, 33.2, 1.6, (1.18, 1.30, 1250, 560), [('w4', 0.5, 20.2)],
     [('tap', 8.13, 0.9), ('tap', 10.75, 0.9), ('tap', 12.57, 0.9), ('tap', 17.8, 0.9), ('tap', 20.45, 0.9),
      ('tap', 23.09, 0.9), ('tap', 25.76, 0.9), ('keep', 29.28, 1.0), ('space_open', 31.8, 1.2)]),
]
DXF = 0.4

# ───────────────────────── 1분 축약판(메인 디스플레이)용 구간 · 11/09 보별: 처음 보는 사람에게 왜 필요한지 읽히게(m0·mw 카드)
STORY_S = [
    (f'{K3}/gen/K01.mp4', 0.0, 4.5, True, None, [('m0', 0.5, 4.3, 'C01_1')]),
    ('rec/walk.mp4', 1.1, 6.9, False, (1.0, 1.08, 1000, 600), [('sub02', 3.3, 6.7, 'C02_2')]),  # 11/09 walk 1.00초 컷 앞 0.2초 숏 빼기
]
DEMO_S = [
    ('rec/mine3.mp4', 9.4, 14.3, 1.0, (1.0, 1.08, 960, 480), [('mw1', 0.3, 4.9)], []),
    ('rec/mine3.mp4', 14.2, 25.0, 1.0, (1.0, 1.08, 1100, 640), [('pip1', 0.8, 10.8), ('mw2', 0.8, 10.8)],
     [('tap', 14.46, 1.2), ('pick', 18.09, 1.1), ('pick', 20.45, 1.1), ('pick', 22.81, 1.1),
      ('ore_crack', 22.88, 1.0), ('glint', 23.66, 1.0)]),
    ('rec/chat.mp4', 16.5, 23.35, 1.0, (1.12, 1.30, 1300, 420), [('mw3', 0.3, 6.85)],
     [('panel_open', 21.19, 1.8)]),
    ('rec/island.mp4', 6.0, 33.2, 2.8, (1.18, 1.30, 1250, 560), [('mw4', 0.3, 10.9)],
     [('tap', 8.13, 0.9), ('tap', 10.75, 0.9), ('tap', 12.57, 0.9), ('tap', 17.8, 0.9), ('tap', 20.45, 0.9),
      ('tap', 23.09, 0.9), ('tap', 25.76, 0.9), ('keep', 29.28, 1.0), ('space_open', 31.8, 1.2)]),
]


def demo(out, DEMO=DEMO):
    ins, fc, segs = [], '', []
    for f, a, b, sp, z, cs, _fx in DEMO:
        assert b <= dur(f) - 0.03, f'{f}: 끝 {b}초가 녹화 길이 {dur(f):.2f}초를 넘음'
        ins += ['-ss', a, '-t', b - a + 0.2, '-i', f]
    n = len(DEMO)
    ci = n
    for k, (f, a, b, sp, z, cs, _fx) in enumerate(DEMO):
        d = (b - a) / sp
        fc += f'[{k}:v]trim=0:{b - a},setpts=(PTS-STARTPTS)/{sp},{fit()},{punch(*z, d)},setsar=1[p{k}];'
        last = f'p{k}'
        for j, (c, t0, t1) in enumerate(cs):
            ins += ['-loop', '1', '-i', card(c)]
            fc += ov(ci, t0, min(t1, d - 0.05)) + f'[q{k}{j}];[{last}][q{k}{j}]overlay=0:0:shortest=1[d{k}{j}];'
            last = f'd{k}{j}'
            ci += 1
        fc += f'[{last}]trim=0:{d},setpts=PTS-STARTPTS[e{k}];'
        segs.append(d)
    acc, t, starts = 'e0', segs[0], [0.0]
    for k in range(1, n):
        fc += f'[{acc}][e{k}]xfade=transition=fade:duration={DXF}:offset={t - DXF:.2f}[y{k}];'
        starts.append(t - DXF)
        acc, t = f'y{k}', t + segs[k] - DXF
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.6:.2f}:d=0.6[v];'
    mx = Mix(ci)
    for k, (f, a, b, sp, z, cs, fx) in enumerate(DEMO):
        for name, src, g in fx:
            if a <= src < b:
                mx.sfx(name, starts[k] + (src - a) / sp, g)
    ins += mx.ins
    fc += mx.fc + mx.out(total)
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# 11/09 v5: island 34.60 컷(섬 카드 모음, 썸네일에 손) 앞, 빈 챗 화면도 빼고 33.6에서 끝 / 서브 섬 조각 3.5초 미만 버림(음악방 창밖 2.5초 숏) / 메인 바다 8.75 컷 앞 8.4
# 섬 끝은 풍경을 느긋이 보는 엔딩으로 (11/06 맥 스레드 확인: 손 없는 구간)
ISLAND_CUTS = {'sky': [(4.4, 12.6), (30.5, 35.5)], 'jungle': [(6.0, 11.1), (27.0, 32.0)]}


# ───────────────────────── 6 나의 섬 (섬 고르기 녹화에서 고른 음악방부터)
def islands(spaces, out, cap=12.0, ixf=0.6, xf=0.8, min_piece=3.0):
    """spaces: [(파일, [(a,b),...], key)]. myspace.json의 구간 안에서만 자른다(구간 밖 컷이 섞이지 않게).
    섬 하나는 최대 cap초: 구간을 차례로 쓰고, 넘치면 마지막 구간을 줄인다.
    min_piece초보다 짧게 남는 조각은 넣지 않는다(11/09 보별: 중간에 너무 짧은 컷 금지)."""
    ins, fc = [], ''
    for f, *_x in spaces:
        ins += ['-i', f]
    n = len(spaces)
    for *_x, key in spaces:
        ins += ['-loop', '1', '-i', card(f'opt_{key}')]
    ins += ['-loop', '1', '-i', card('isl2')]  # 11/10 보별: 기록이 쌓여 나만의 섬이 된다 · 스스로 디자인 · 섬끼리 연결
    lens = []
    for i, (f, cuts, key) in enumerate(spaces):
        use, left = [], cap
        for (ca, cb) in cuts:
            d = min(cb - ca, left + (ixf if use else 0))
            if d < min_piece - 1e-6:  # 부동소수 오차(33.8-30.3=3.4999…)
                break
            use.append((ca, ca + d))
            left -= d - (ixf if len(use) > 1 else 0)
        k = len(use)
        fc += f'[{i}:v]split={k}' + ''.join(f'[sv{i}_{j}]' for j in range(k)) + ';'
        fc += f'[{i}:a]asplit={k}' + ''.join(f'[sa{i}_{j}]' for j in range(k)) + ';'
        for j, (ca, cb) in enumerate(use):
            fc += (f'[sv{i}_{j}]trim={ca}:{cb},setpts=PTS-STARTPTS,{fit()}[cv{i}_{j}];'
                   f'[sa{i}_{j}]atrim={ca}:{cb},asetpts=PTS-STARTPTS,aresample=48000,'
                   f'aformat=channel_layouts=stereo[ca{i}_{j}];')
        vacc, aacc, t = f'cv{i}_0', f'ca{i}_0', use[0][1] - use[0][0]
        for j in range(1, k):
            fc += (f'[{vacc}][cv{i}_{j}]xfade=transition=fade:duration={ixf}:offset={t - ixf:.2f}[iv{i}_{j}];'
                   f'[{aacc}][ca{i}_{j}]acrossfade=d={ixf}:c1=qsin:c2=qsin[ia{i}_{j}];')
            vacc, aacc, t = f'iv{i}_{j}', f'ia{i}_{j}', t + (use[j][1] - use[j][0]) - ixf
        fc += (ov(n + i, 0.5, min(5.5, t - 0.3), 0.4) + f'[o{i}];[{vacc}][o{i}]overlay=0:0:shortest=1,'
               f'trim=0:{t:.3f},setpts=PTS-STARTPTS[t{i}];'
               f'[{aacc}]atrim=0:{t:.3f},loudnorm=I=-24:LRA=6:TP=-4,aresample=48000[n{i}];')  # 섬마다 같은 크기로
        lens.append(t)
        print(f'  섬 {key}: ' + ', '.join(f'{x:.1f}~{y:.1f}' for x, y in use) + f' → {t:.1f}초')
    acc, aacc, t = 't0', 'n0', lens[0]
    for i in range(1, n):
        fc += f'[{acc}][t{i}]xfade=transition=fade:duration={xf}:offset={t - xf:.2f}[w{i}];'
        fc += f'[{aacc}][n{i}]acrossfade=d={xf}:c1=qsin:c2=qsin[m{i}];'
        acc, aacc, t = f'w{i}', f'm{i}', t + lens[i] - xf
    total = t
    fc += ov(2 * n, 0.4, min(6.5, total - 1.0), 0.5) + f'[isl];[{acc}][isl]overlay=0:0:shortest=1[ac2];'
    acc = 'ac2'
    fc += (f'[{acc}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.8:.2f}:d=0.8[v];'
           f'[{aacc}]afade=t=in:st=0:d=0.6,afade=t=out:st={total - 1:.2f}:d=1,atrim=0:{total}[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 7 여운 · 오늘의 한마디
def ending(out, short=False):
    if short:  # 오늘의 한마디 → 마지막 질문만
        return ending_short(out)
    d1, d2, d3 = 6.0, 3.8, 5.5
    tot = d1 + d2 + d3 - 1.6
    mx = Mix(4).voice('C12_1', 1.1).sfx('name_save', d1 + d2 - 1.2, 0.7)
    # 오늘의 한마디는 조금 더 또렷하게
    mx.fc = mx.fc.replace(f'volume={VOICE},', 'volume=1.0,', 1)
    run(['-i', f'{K4}/comp/S9_end.mp4', '-loop', '1', '-i', card('b12'), '-loop', '1', '-t', d2, '-i', card('end1'),
         '-loop', '1', '-t', d3, '-i', card('end2')] + mx.ins + ['-filter_complex',
        f'[0:v]trim=0:{d1},setpts=PTS-STARTPTS,{fit()},format=yuv420p[k];'
        + ov(1, 0.9, d1 - 0.3) + f'[b];[k][b]overlay=0:0:shortest=1,trim=0:{d1},setpts=PTS-STARTPTS[e0];'
        f'[2:v]{fit()}[e1];[3:v]{fit()},zoompan=z=\'1+0.015*on/{d3 * FPS}\':d=1:s={W}x{H}:fps={FPS}[e2];'
        f'[e0][e1]xfade=transition=fade:duration=0.8:offset={d1 - 0.8}[f1];'
        f'[f1][e2]xfade=transition=fade:duration=0.8:offset={d1 + d2 - 1.6}[f2];'
        f'[f2]fade=t=in:st=0:d=0.6,fade=t=out:st={tot - 0.8:.2f}:d=0.8[v];' + mx.fc + mx.out(tot),
        '-map', '[v]', '-map', '[a]', '-t', f'{tot:.3f}'] + VENC + AENC + [out])
    return tot


def ending_short(out):
    d1, d3 = 6.0, 3.5
    tot = d1 + d3 - 0.8
    mx = Mix(3).voice('C12_1', 1.1).sfx('name_save', d1 - 1.0, 0.7)
    mx.fc = mx.fc.replace(f'volume={VOICE},', 'volume=1.0,', 1)
    run(['-i', f'{K4}/comp/S9_end.mp4', '-loop', '1', '-i', card('b12'), '-loop', '1', '-t', d3, '-i', card('end2')]
        + mx.ins + ['-filter_complex',
        f'[0:v]trim=0:{d1},setpts=PTS-STARTPTS,{fit()},format=yuv420p[k];'
        + ov(1, 0.9, d1 - 0.3) + f'[b];[k][b]overlay=0:0:shortest=1,trim=0:{d1},setpts=PTS-STARTPTS[e0];'
        f'[2:v]{fit()},zoompan=z=\'1+0.015*on/{d3 * FPS}\':d=1:s={W}x{H}:fps={FPS}[e2];'
        f'[e0][e2]xfade=transition=fade:duration=0.8:offset={d1 - 0.8}[f2];'
        f'[f2]fade=t=in:st=0:d=0.6,fade=t=out:st={tot - 0.8:.2f}:d=0.8[v];' + mx.fc + mx.out(tot),
        '-map', '[v]', '-map', '[a]', '-t', f'{tot:.3f}'] + VENC + AENC + [out])
    return tot


def page(png, d, out):
    """공식 레이아웃 장(PNG) 한 장을 d초 정지 화면으로.
    같은 이름_s0~s3.png가 있으면 배경 → 과정 줄 → 로고 → 부제 → 팀명 순서로 한 줄씩 뜨게(11/10 보별)."""
    stg = [png[:-4] + f'_s{k}.png' for k in range(4)]
    if all(os.path.exists(x) for x in stg):
        ts = [0.10, 0.22, 0.37, 0.52]  # s1·s2·s3·완성 장이 뜨는 시각(길이 비율)
        lay = stg[1:] + [png]
        ins = ['-loop', '1', '-t', d, '-i', stg[0]]
        for x in lay: ins += ['-loop', '1', '-t', d, '-i', x]
        fc = f'[0:v]{fit()}[b0];'
        for i, x in enumerate(lay):
            t0 = ts[i] * float(d)
            fc += f'[{i + 1}:v]{fit()},format=rgba,fade=t=in:st={t0:.2f}:d=0.6:alpha=1[l{i}];[b{i}][l{i}]overlay=format=auto[b{i + 1}];'
        fc += f'[b{len(lay)}]format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st={float(d) - 0.5:.2f}:d=0.5[v];[{len(lay) + 1}:a]anull[a]'
        run(ins + silent_ins(d) + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])
        return
    run(['-loop', '1', '-t', d, '-i', png] + silent_ins(d) + ['-filter_complex',
        f'[0:v]{fit()},fade=t=in:st=0:d=0.5,fade=t=out:st={d - 0.5:.2f}:d=0.5[v];[1:a]anull[a]',
        '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


def credit(out, d=7.0):
    run(['-loop', '1', '-t', d, '-i', card('credit')] + silent_ins(d) + ['-filter_complex',
        f'[0:v]{fit()},fade=t=in:st=0:d=0.6,fade=t=out:st={d - 1.0:.2f}:d=1.0[v];[1:a]anull[a]',
        '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


def env_expr(base, ducks, ramp=1.2):
    """음악 음량: base에서 시작해 구간마다 (a,b,v)로 부드럽게 바뀜."""
    e = f'{base}'
    for a, b, v in ducks:
        k = f'(clip((t-{a})/{ramp},0,1)*clip(({b}-t)/{ramp},0,1))'
        e += f'+({v}-{base})*{k}'
    return e


def main():
    ap = argparse.ArgumentParser()
    for k in ('sea', 'sky', 'jungle', 'music'):
        ap.add_argument('--' + k, required=True)
    ap.add_argument('--onsen', default='', help='온천 섬 영상(11/10 보별: 온천도 넣기)')
    ap.add_argument('--onsen-cut', default='', help='온천에서 쓸 구간 a,b(초). 비우면 끝 풍경(길이-6.8 ~ 길이-0.8)')
    ap.add_argument('--out', default='MineD_쇼케이스_v0.5.mp4')
    ap.add_argument('--cut', choices=['full', 'sub', 'main'], default='full',
                    help='full=출품 영상(제목·기술·본편·크레딧) / sub=서브·심포지엄(레이아웃 장+본편 2분+크레딧 장) / main=메인(레이아웃 장+1분 축약)')
    ap.add_argument('--pre', default='', help='본편 앞에 붙일 레이아웃 장 PNG들(쉼표로)')
    ap.add_argument('--post', default='', help='본편 뒤에 붙일 레이아웃 장 PNG들(쉼표로)')
    ap.add_argument('--page-sec', default='6', help='레이아웃 장 길이(초). 하나면 모든 장, 쉼표 목록이면 --pre 장들 다음 --post 장들 순서로(모자라면 마지막 값)')
    ap.add_argument('--copy', choices=['a', 'b'], default='a', help='메인 자막 묶음: a=m0·mw1~4, b=m0b·mw1b~4b(노션 스레드 5줄안)')
    o = ap.parse_args()
    mj = next((p for p in ['myspace.json', f'{K3}/myspace.json'] if os.path.exists(p)), None)
    cut = json.load(open(mj)) if mj else {}
    spaces = []
    for key in ('music', 'sea', 'sky', 'jungle'):  # 섬 고르기에서 음악방을 골랐으니 음악방부터
        f = getattr(o, key)
        c = cut.get(key) or [max(0, dur(f) - 14), dur(f) - 0.5]
        cuts = [tuple(x) for x in c] if isinstance(c[0], (list, tuple)) else [tuple(c)]
        cuts = ISLAND_CUTS.get(key, cuts)
        spaces.append((f, cuts, key))
    if o.onsen:  # 손이 나오는 잔 컷(S4)은 피하고 끝 풍경(S5)을 쓴다
        oc = tuple(float(x) for x in o.onsen_cut.split(',')) if o.onsen_cut else (dur(o.onsen) - 6.8, dur(o.onsen) - 0.8)
        spaces.append((o.onsen, [oc], 'onsen'))
    pre = [x for x in o.pre.split(',') if x]
    post = [x for x in o.post.split(',') if x]
    segs = []
    secs = [float(x) for x in str(o.page_sec).split(',') if x]
    sec_it = iter(secs)

    def pages(lst, tag):
        for i, png in enumerate(lst):
            name = f'{tag}{i + 1}'
            d = next(sec_it, secs[-1])
            page(png, d, f'seg/{name}.mp4')
            segs.append(name)

    if pre:
        pages(pre, '00_pre')
    elif o.cut != 'main':
        still(card('title'), 5, 'seg/01_title.mp4', fi=1.0); segs.append('01_title')
        still(card('spec'), 9, 'seg/02_spec.mp4'); segs.append('02_spec')
    else:
        still(card('title'), 4, 'seg/01_title.mp4', fi=1.0); segs.append('01_title')
    if o.cut == 'main':  # 1분 축약
        sfx_ = 'b' if o.copy == 'b' else ''
        rc = lambda c: c + sfx_ if c == 'm0' or c.startswith('mw') else c
        st_ = [x[:5] + ([(rc(c), *r) for c, *r in x[5]],) for x in STORY_S]
        dm_ = [x[:5] + ([(rc(c), *r) for c, *r in x[5]],) + x[6:] for x in DEMO_S]
        story('seg/03_story.mp4', st_); segs.append('03_story')
        demo('seg/05_demo.mp4', dm_); segs.append('05_demo')
        two = [(f, [(4.4, 9.4)] if k == 'sky' else [(3.4, 8.4)] if k == 'sea' else c, k) for f, c, k in spaces if k in ('sea', 'sky', 'onsen')]  # 하늘산 원본 9.52초 컷 뒤 짧은 숏 빼기
        islands(two, 'seg/06_islands.mp4', cap=4.6 if o.onsen else 6.0); segs.append('06_islands')
        ending('seg/07_end.mp4', short=True); segs.append('07_end')
    else:
        story('seg/03_story.mp4'); segs.append('03_story')
        bridge('seg/04_bridge.mp4'); segs.append('04_bridge')
        if o.cut == 'sub':  # 11/10 보별: 멘토 기술 시연(10/24 AtoZ) 내용을 긴 판에 — 실제 구현 5가지
            still(card('tech'), 11, 'seg/045_tech.mp4', fi=0.6, fo=0.6); segs.append('045_tech')
        two_min = o.cut == 'sub'  # 서브·심포지엄 「풀 영상」: 섬 고르기를 조금 빠르게, 섬마다 10초(운영: 3분 조금 넘어도 됨)
        dm = [(x[:3] + (2.0,) + x[4:]) if two_min and 'island' in x[0] else x for x in DEMO]
        demo('seg/05_demo.mp4', dm); segs.append('05_demo')
        if two_min:  # 11/10 보별: 섬마다 포인트 한 컷 + 온천. 한 컷은 원본 안 컷 사이 구간만, 음악방은 창밖 풍경 컷(공간은 풍경으로 끝난다)
            pt = {'sky': [(4.4, 9.4)], 'music': [(30.3, 33.8)], 'sea': [(3.4, 8.4)], 'jungle': [(6.0, 11.1)]}
            spaces = [(f, pt.get(k, c[:1]), k) for f, c, k in spaces]
        islands(spaces, 'seg/06_islands.mp4', cap=6.0 if two_min else 12.0, min_piece=3.5 if two_min else 3.0); segs.append('06_islands')
        ending('seg/07_end.mp4'); segs.append('07_end')
    if post:
        pages(post, '08_post')
    elif o.cut != 'main':
        credit('seg/08_credit.mp4'); segs.append('08_credit')
    run(['-f', 'lavfi', '-t', 1, '-i', f'color=c=black:s={W}x{H}:r={FPS}'] + silent_ins(1)
        + ['-map', '0:v', '-map', '1:a', '-t', 1] + VENC + AENC + ['seg/09_black.mp4'])
    segs.append('09_black')
    open('seg/list.txt', 'w').write('\n'.join(f"file '{s}.mp4'" for s in segs))
    run(['-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', 'seg/joined.mp4'])
    # 음악 한 줄: mus_home을 두 번 이어(3초 겹침) 전체 길이에 깔고, 구간마다 음량만 바꿈
    T = dur('seg/joined.mp4')
    st = {}
    acc = 0.0
    for s in segs:
        st[s] = (acc, acc + dur(f'seg/{s}.mp4'))
        acc = st[s][1]
    ducks = [(st['03_story'][0], st['03_story'][1], 0.30),  # 이야기: 목소리·발소리 위로
             (st['05_demo'][0], st['05_demo'][1], 0.34),
             (st['06_islands'][0], st['06_islands'][1], 0.14),  # 섬 영상은 제 소리가 있으니 낮게
             (st['07_end'][0] + 0.8, st['07_end'][0] + 5.5, 0.26)]  # 오늘의 한마디
    if 'main' == o.cut:
        ducks[2] = (st['06_islands'][0], st['06_islands'][1], 0.22)
    vol = env_expr(0.46, ducks)
    run(['-i', 'seg/joined.mp4', '-i', f'{A}/mus_home.mp3', '-i', f'{A}/mus_home.mp3', '-filter_complex',
         f'[1:a][2:a]acrossfade=d=3,aresample=48000,atrim=0:{T},'
         f"volume='{vol}':eval=frame,afade=t=in:st=0:d=1.5,afade=t=out:st={T - 2.5:.2f}:d=2.5[m];"
         f'[0:a][m]amix=inputs=2:normalize=0,atrim=0:{T}[a]',
         '-map', '0:v', '-map', '[a]', '-c:v', 'copy'] + AENC + ['seg/mixed.mp4'])
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', 'seg/mixed.mp4', '-af',
                        'loudnorm=I=-16:TP=-1.6:LRA=11:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
    ln = (f"loudnorm=I=-16:TP=-1.6:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run(['-i', 'seg/mixed.mp4', '-c:v', 'copy', '-af', ln + ',aresample=48000'] + AENC
        + ['-movflags', '+faststart', o.out])
    for s in segs:
        print(f'{s:12s} {st[s][0]:7.2f} → {st[s][1]:7.2f}')
    print('TOTAL', round(dur(o.out), 2), o.out)


if __name__ == '__main__':
    main()
