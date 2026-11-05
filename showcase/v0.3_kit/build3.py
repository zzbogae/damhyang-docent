"""Mine D 쇼케이스 출품 영상 v0.3 조립기 ('써보고 싶게' 흐름).

흐름: 제목 → 기술 사용 → [이야기: 민디의 일] → 이제, 당신의 기록으로 → [실제 작동 화면] → [나의 섬] → 여운 → 크레딧
사용:
  python3 build3.py --sea 바다.mp4 --sky 하늘산.mp4 --jungle 정글.mp4 --music 음악방.mp4 [--out 출력.mp4]
  FAST=1 이면 960x540 시험판.
폴더 구조(이 파일 옆): cards/out_*.png · assets/(mus_*.mp3, demo_rec2_4k.mp4, voice/line_B_*.mp3) · gen/K01.mp4 … (Kling 클립, 없으면 gen/src/*.png 정지 이미지로 대신)
"""
import argparse, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
FAST = os.environ.get('FAST') == '1'
W, H = (960, 540) if FAST else (3840, 2160)
FPS = 30
XF = 0.5  # 이야기 장면 사이 디졸브
VENC = ['-c:v', 'libx264', '-preset', 'veryfast' if FAST else 'slow', '-crf', '28' if FAST else '16',
        '-pix_fmt', 'yuv420p', '-r', str(FPS)]
AENC = ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-ac', '2']
A = 'assets'
DEMO_REC = f'{A}/demo_rec2_4k.mp4' if os.path.exists(f'{A}/demo_rec2_4k.mp4') else '../v0.2_kit/assets/demo_rec2_4k.mp4'
os.makedirs('seg', exist_ok=True)


def run(args):
    print('ffmpeg', ' '.join(str(a) for a in args[-1:]))
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + [str(a) for a in args], check=True)


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                          '-of', 'csv=p=0', f]))


def fit(extra=''):
    s = f'scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H},setsar=1,fps={FPS}'
    return s + (',' + extra if extra else '')


def ov(png_idx, t0, t1, fade=0.3):
    """오버레이 PNG를 t0~t1 사이에 페이드로 띄우는 필터 조각(입력 라벨 반환 없이 문자열)."""
    return (f'[{png_idx}:v]scale={W}:{H},format=rgba,'
            f'fade=t=in:st={t0}:d={fade}:alpha=1,fade=t=out:st={t1 - fade:.2f}:d={fade}:alpha=1')


def punch(z0, z1, cx, cy, d):
    """1920x1080 기준 중심(cx,cy)으로 z0→z1 천천히 확대 (Ken Burns). 입력은 이미 W×H."""
    fx, fy = cx / 1920, cy / 1080
    z = f'({z0}+({z1}-{z0})*min(t/{d},1))'
    return (f"scale=w='iw*{z}':h='ih*{z}':eval=frame:flags=lanczos,"
            f"crop={W}:{H}:x='max(0,min(iw-{W},iw*{fx}-{W}/2))':y='max(0,min(ih-{H},ih*{fy}-{H}/2))'")


# ───────────────────────── 1·2 제목 · 기술 사용
def still(png, d, music, mstart, out, fi=0.8, fo=0.6):
    run(['-loop', '1', '-t', d, '-i', png, '-ss', mstart, '-t', d, '-i', music, '-filter_complex',
         f'[0:v]{fit()},zoompan=z=\'1+0.010*on/{d * FPS}\':d=1:s={W}x{H}:fps={FPS},'
         f'fade=t=in:st=0:d={fi},fade=t=out:st={d - fo:.2f}:d={fo}[v];'
         f'[1:a]volume=0.5,afade=t=in:st=0:d=1,afade=t=out:st={d - 0.8:.2f}:d=0.8[a]',
         '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 3 이야기 (Kling 클립 + 말풍선 + 목소리)
SKIP = {'K10': 0.7}  # 클립 앞에서 건너뛸 초
STORY = [  # 클립, 길이, [(말풍선, 시작, 끝, 목소리)]
    ('K01', 7.0, [('b01', 1.0, 6.4, 'C01_1')]),
    ('K02', 8.0, [('b02a', 0.6, 2.8, 'C02_1'), ('b02b', 3.2, 7.6, 'C02_2')]),
    ('K03', 7.0, [('b03', 0.8, 6.6, 'C03_1')]),
    ('K06', 6.0, [('b06', 0.9, 5.6, 'C06_1')]),
    ('K10', 6.0, [('b10', 2.9, 6.0, 'C10_1')]),  # 시작 0.7초(날짜 글자) 건너뜀: SKIP 참고
]


def src_input(key, d):
    v = f'gen/{key}.mp4'
    if os.path.exists(v):
        return ['-i', v], ''
    png = f'gen/src/C{key[1:]}.png'
    print('  (Kling 클립 없음 → 정지 이미지)', png)
    return ['-loop', '1', '-t', d + 1, '-i', png], f'zoompan=z=\'1+0.04*on/{d * FPS}\':d=1:s={W}x{H}:fps={FPS},'


def story(out):
    ins, fc, n_png = [], '', 0
    # 비디오 입력 먼저, 그다음 PNG
    for i, (k, d, _) in enumerate(STORY):
        a, _z = src_input(k, d)
        ins += a
    base = len(STORY)
    pngs = [b for _, _, bs in STORY for b in bs]
    for b in pngs:
        ins += ['-loop', '1', '-i', f'cards/out_{b[0]}.png']
    vo = base + len(pngs)
    for b in pngs:
        ins += ['-i', f'{A}/voice/line_B_{b[3]}.mp3']
    ins += ['-i', f'{A}/mus_hearth.mp3']
    mus = vo + len(pngs)
    pi = 0
    for i, (k, d, bs) in enumerate(STORY):
        _a, z = src_input(k, d)
        ss = SKIP.get(k, 0) if not z else 0
        fc += f'[{i}:v]trim={ss}:{ss + d},setpts=PTS-STARTPTS,{fit()},{z}format=yuv420p[c{i}];'
        last = f'c{i}'
        for j, (b, t0, t1, _v) in enumerate(bs):
            fc += ov(base + pi, t0, t1) + f'[o{i}{j}];[{last}][o{i}{j}]overlay=0:0:shortest=1[c{i}_{j}];'
            last = f'c{i}_{j}'
            pi += 1
        fc += f'[{last}]trim=0:{d},setpts=PTS-STARTPTS[s{i}];'
    # 디졸브 연결
    acc, t = 's0', STORY[0][1]
    starts = [0.0]
    for i in range(1, len(STORY)):
        fc += f'[{acc}][s{i}]xfade=transition=fade:duration={XF}:offset={t - XF:.2f}[x{i}];'
        starts.append(t - XF)
        acc, t = f'x{i}', t + STORY[i][1] - XF
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.6[v];'
    # 소리: 음악 + 목소리
    pi, amix = 0, []
    for i, (k, d, bs) in enumerate(STORY):
        for (b, t0, t1, _v) in bs:
            ms = int((starts[i] + t0 + 0.15) * 1000)
            fc += f'[{vo + pi}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.6,adelay={ms}|{ms}[vo{pi}];'
            amix.append(f'[vo{pi}]')
            pi += 1
    fc += (f'[{mus}:a]atrim=0:{total + 4},aresample=48000,volume=0.42,afade=t=in:st=0:d=1.5[m];'
           f'[m]{"".join(amix)}amix=inputs={len(amix) + 1}:normalize=0,atrim=0:{total}[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 4 다리 카드
def card(png, d, out, music=None, mstart=0, mvol=0.45, fi=0.6, fo=0.6):
    ins = ['-loop', '1', '-t', d, '-i', png]
    if music:
        ins += ['-ss', mstart, '-t', d, '-i', music]
        af = f'[1:a]aresample=48000,volume={mvol},afade=t=in:st=0:d=0.4,afade=t=out:st={d - 0.6:.2f}:d=0.6[a]'
    else:
        ins += ['-f', 'lavfi', '-t', d, '-i', 'anullsrc=r=48000:cl=stereo']
        af = '[1:a]anull[a]'
    run(ins + ['-filter_complex', f'[0:v]{fit()},fade=t=in:st=0:d={fi},fade=t=out:st={d - fo:.2f}:d={fo}[v];' + af,
               '-map', '[v]', '-map', '[a]', '-t', d] + VENC + AENC + [out])


# ───────────────────────── 5 실제 작동 화면 (구간 + 확대 + 한 줄 안내)
DEMO = [  # 시작, 끝, (z0, z1, cx, cy), 안내 카드
    (2.0, 8.0, (1.00, 1.12, 1000, 520), None),
    (9.0, 13.6, (1.55, 1.85, 1000, 300), 's1'),
    (14.5, 21.5, (1.00, 1.10, 960, 600), 's2'),
    (25.8, 36.0, (1.10, 1.35, 940, 640), 's3'),
    (36.0, 40.6, (1.15, 1.30, 1180, 560), None),
    (42.1, 47.4, (1.35, 1.65, 730, 470), 's4'),
]


def demo(out, music, mstart):
    ins, fc, segs = ['-i', DEMO_REC], '', []
    cards = [c for *_x, c in DEMO if c]
    for c in cards:
        ins += ['-loop', '1', '-i', f'cards/out_{c}.png']
    ins += ['-ss', mstart, '-i', music]
    ci = 1
    fc += f'[0:v]split={len(DEMO)}' + ''.join(f'[r{i}]' for i in range(len(DEMO))) + ';'
    for i, (a, b, (z0, z1, cx, cy), c) in enumerate(DEMO):
        d = b - a
        fc += f'[r{i}]trim={a}:{b},setpts=PTS-STARTPTS,{fit()},{punch(z0, z1, cx, cy, d)},setsar=1[p{i}];'
        if c:
            fc += ov(ci, 0.4, d - 0.1, 0.35) + f'[q{i}];[p{i}][q{i}]overlay=0:0:shortest=1[d{i}];'
            ci += 1
        else:
            fc += f'[p{i}]null[d{i}];'
        segs.append(d)
    acc, t = 'd0', segs[0]
    for i in range(1, len(segs)):
        fc += f'[{acc}][d{i}]xfade=transition=fade:duration=0.35:offset={t - 0.35:.2f}[y{i}];'
        acc, t = f'y{i}', t + segs[i] - 0.35
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.5,fade=t=out:st={total - 0.6:.2f}:d=0.6[v];'
    fc += f'[{ci}:a]aresample=48000,volume=0.5,afade=t=in:st=0:d=1,afade=t=out:st={total - 1.5:.2f}:d=1.5,atrim=0:{total}[a]'
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 6 나의 섬
def islands(spaces, out):
    """spaces: [(파일, 시작, 끝, key)]"""
    n = len(spaces)
    ins, fc = [], ''
    for f, *_x in spaces:
        ins += ['-i', f]
    for *_x, key in spaces:
        ins += ['-loop', '1', '-i', f'cards/out_opt_{key}.png']
    ins += ['-loop', '1', '-i', 'cards/out_isl.png', '-i', f'{A}/mus_open.mp3']
    isl, mus = 2 * n, 2 * n + 1
    segs = []
    for i, (f, a, b, key) in enumerate(spaces):
        d = b - a
        fc += (f'[{i}:v]trim={a}:{b},setpts=PTS-STARTPTS,{fit()}[r{i}];'
               + ov(n + i, 0.5, min(5.5, d - 0.3), 0.4) + f'[o{i}];[r{i}][o{i}]overlay=0:0:shortest=1[t{i}];')
        if i == 0:
            fc += ov(isl, 0.4, 4.4, 0.5) + f'[il];[t0][il]overlay=0:0:shortest=1[u0];'
        else:
            fc += f'[t{i}]null[u{i}];'
        fc += (f'[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,'
               f'volume=0.9[n{i}];')
        segs.append(d)
    acc, aacc, t = 'u0', 'n0', segs[0]
    for i in range(1, n):
        fc += f'[{acc}][u{i}]xfade=transition=fade:duration=0.8:offset={t - 0.8:.2f}[w{i}];'
        fc += f'[{aacc}][n{i}]acrossfade=d=0.8[m{i}];'
        acc, aacc, t = f'w{i}', f'm{i}', t + segs[i] - 0.8
    total = t
    fc += f'[{acc}]fade=t=in:st=0:d=0.6,fade=t=out:st={total - 0.8:.2f}:d=0.8[v];'
    fc += (f'[{mus}:a]aresample=48000,volume=0.32,afade=t=in:st=0:d=2,afade=t=out:st={total - 2:.2f}:d=2,'
           f'apad,atrim=0:{total}[bm];[{aacc}][bm]amix=inputs=2:normalize=0,afade=t=out:st={total - 1:.2f}:d=1[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{total:.3f}'] + VENC + AENC + [out])
    return total


# ───────────────────────── 7 여운
def ending(out, music, mstart):
    k = 'gen/K12.mp4' if os.path.exists('gen/K12.mp4') else ('gen/K02.mp4' if os.path.exists('gen/K02.mp4') else None)
    d1, d2, d3 = 5.0, 3.8, 5.5
    if k:
        src = ['-sseof', '-5.5', '-i', k]
        z = ''
    else:
        src = ['-loop', '1', '-t', d1 + 1, '-i', 'gen/src/C12.png']
        z = f'zoompan=z=\'1+0.03*on/{d1 * FPS}\':d=1:s={W}x{H}:fps={FPS},'
    ins = src + ['-loop', '1', '-i', 'cards/out_b12.png', '-loop', '1', '-t', d2, '-i', 'cards/out_end1.png',
                 '-loop', '1', '-t', d3, '-i', 'cards/out_end2.png', '-i', f'{A}/voice/line_B_C12_1.mp3',
                 '-ss', mstart, '-i', music]
    tot = d1 + d2 + d3 - 1.6
    fc = (f'[0:v]trim=0:{d1},setpts=PTS-STARTPTS,{fit()},{z}eq=brightness=-0.06:saturation=0.9,format=yuv420p[k];'
          + ov(1, 0.6, d1 - 0.2) + f'[b];[k][b]overlay=0:0:shortest=1,trim=0:{d1},setpts=PTS-STARTPTS[e0];'
          f'[2:v]{fit()}[e1];[3:v]{fit()},zoompan=z=\'1+0.015*on/{d3 * FPS}\':d=1:s={W}x{H}:fps={FPS}[e2];'
          f'[e0][e1]xfade=transition=fade:duration=0.8:offset={d1 - 0.8}[f1];'
          f'[f1][e2]xfade=transition=fade:duration=0.8:offset={d1 + d2 - 1.6}[f2];'
          f'[f2]fade=t=out:st={tot - 0.8:.2f}:d=0.8[v];'
          f'[4:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.6,adelay=750|750[vo];'
          f'[5:a]aresample=48000,volume=0.5,afade=t=in:st=0:d=1.2,afade=t=out:st={tot - 1.5:.2f}:d=1.5,atrim=0:{tot}[m];'
          f'[m][vo]amix=inputs=2:normalize=0,atrim=0:{tot}[a]')
    run(ins + ['-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', f'{tot:.3f}'] + VENC + AENC + [out])


def main():
    ap = argparse.ArgumentParser()
    for k in ('sea', 'sky', 'jungle', 'music'):
        ap.add_argument('--' + k, required=True)
    ap.add_argument('--out', default='MineD_쇼케이스_v0.3.mp4')
    o = ap.parse_args()
    cut = json.load(open('myspace.json')) if os.path.exists('myspace.json') else {}
    spaces = []
    for key in ('sea', 'sky', 'jungle', 'music'):
        f = getattr(o, key)
        d = dur(f)
        a, b = cut.get(key, [max(0, d - 14), d - 0.5])
        spaces.append((f, a, b, key))
    home = f'{A}/mus_home.mp3'
    still('cards/out_title.png', 5, home, 0, 'seg/01_title.mp4', fi=1.0)
    still('cards/out_spec.png', 9, home, 5, 'seg/02_spec.mp4')
    story('seg/03_story.mp4')
    card('cards/out_bridge.png', 3.2, 'seg/04_bridge.mp4', f'{A}/mus_hearth.mp3', 40, 0.3)
    demo('seg/05_demo.mp4', home, 30)
    islands(spaces, 'seg/06_islands.mp4')
    ending('seg/07_end.mp4', home, 140)
    card('cards/out_credit.png', 7, 'seg/08_credit.mp4', f'{A}/mus_open.mp3', 30, 0.4, fo=1.0)
    run(['-f', 'lavfi', '-t', 1, '-i', f'color=c=black:s={W}x{H}:r={FPS}', '-f', 'lavfi', '-t', 1,
         '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a', '-t', 1] + VENC + AENC + ['seg/09_black.mp4'])
    segs = ['01_title', '02_spec', '03_story', '04_bridge', '05_demo', '06_islands', '07_end', '08_credit', '09_black']
    open('seg/list.txt', 'w').write('\n'.join(f"file '{s}.mp4'" for s in segs))
    run(['-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', 'seg/joined.mp4'])
    # 최종 음량: 통합 -16 LUFS, 트루 피크 -1.5 dB (영상은 그대로 복사)
    run(['-i', 'seg/joined.mp4', '-c:v', 'copy', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11'] + AENC
        + ['-movflags', '+faststart', o.out])
    for s in segs:
        print(f'{s:12s} {dur(f"seg/{s}.mp4"):6.2f}')
    print('TOTAL', round(dur(o.out), 2), o.out)


if __name__ == '__main__':
    main()
