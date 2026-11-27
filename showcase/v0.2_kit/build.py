"""Mine D 쇼케이스 출품 영상 조립 v0.2 (4K 30fps, H.264 + AAC 48k stereo). 필요: python3, ffmpeg.
사용: python3 build.py 바다.mp4 하늘산.mp4 정글.mp4 음악방.mp4 [출력.mp4]
- 나의 공간은 공간마다 끝에서 7초~1초 전 구간(6초)을 씀. 바꾸려면 myspace.json([[파일,시작,끝,키],...])을 만들어 두면 그걸 씀.
- FAST=1 이면 960×540 시험판.
"""
import subprocess, sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)
SND = 'assets'
ORIGIN = os.environ.get('ORIGIN', 'assets/origin_v1.0_alienB.mp4')  # 기원 영상 정지판 v1.0(외계어 B) 경로
FAST = os.environ.get('FAST') == '1'
W, H, FPS = (960, 540, 30) if FAST else (3840, 2160, 30)
VOUT = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', str(FPS),
        '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart']
SCALE = f'scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={FPS}'
os.makedirs('seg', exist_ok=True)

def run(args):
    print(' '.join(a if ' ' not in a else repr(a) for a in args[:6]), '...')
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]))

def fades(d, fi=0.5, fo=0.5):
    return f'fade=t=in:st=0:d={fi},fade=t=out:st={d-fo:.3f}:d={fo}'

def overlay_chapter(png, d):
    # 챕터 라벨: 0.6초부터 4.6초까지, 0.4초 페이드
    return (f'[1:v]scale={W}:{H},format=rgba,fade=t=in:st=0.6:d=0.4:alpha=1,fade=t=out:st=4.2:d=0.4:alpha=1[ov];'
            f'[base][ov]overlay=0:0:enable=\'between(t,0.6,4.6)\'')

# 1) 제목 6초 (음악 home)
def still(png, d, music, mstart, out, fi=0.8, fo=0.6):
    run(['-loop', '1', '-t', str(d), '-i', png, '-ss', str(mstart), '-t', str(d), '-i', music,
         '-filter_complex', f'[0:v]{SCALE},zoompan=z=\'1+0.012*on/{d*FPS}\':d=1:s={W}x{H}:fps={FPS},{fades(d,fi,fo)}[v];'
         f'[1:a]volume=0.55,afade=t=in:st=0:d=1.2,afade=t=out:st={d-1:.2f}:d=1[a]',
         '-map', '[v]', '-map', '[a]', '-t', str(d)] + VOUT + [out])

still('cards/out_title.png', 6, f'{SND}/mus_home.mp3', 0, 'seg/01_title.mp4', fi=1.0)
still('cards/out_spec.png', 10, f'{SND}/mus_home.mp3', 6, 'seg/02_spec.mp4')

# 3) 기원 영상 94초 (자체 음악·목소리)
d = dur(ORIGIN)
run(['-i', ORIGIN, '-loop', '1', '-i', 'cards/out_ch1.png',
     '-filter_complex', f'[0:v]{SCALE},{fades(d,0.5,0.6)}[base];' + overlay_chapter('', d) + '[v];'
     f'[0:a]afade=t=in:st=0:d=0.3,afade=t=out:st={d-0.6:.2f}:d=0.6[a]',
     '-map', '[v]', '-map', '[a]', '-t', f'{d:.3f}'] + VOUT + ['seg/03_origin.mp4'])

# 4) 시연 화면: 구간만 이어 붙이기 (관측소·말풍선 / 엘리베이터 / 지층 / 광석 캐기·열기·기록 보기)
parts = [(1.4, 8.5), (8.8, 12.5), (14.5, 17.5), (19.2, 21.5), (25.8, 40.5), (42.1, 46.0)]
sel = '+'.join(f'between(t,{a},{b})' for a, b in parts)
dd = sum(b - a for a, b in parts)
run(['-i', 'assets/demo_rec2_4k.mp4', '-i', f'{SND}/mus_hearth.mp3', '-loop', '1', '-i', 'cards/out_ch2.png',
     '-filter_complex', f"[0:v]select='{sel}',setpts=N/{FPS}/TB,{SCALE},{fades(dd,0.5,0.6)}[base];"
     f"[2:v]scale={W}:{H},format=rgba,fade=t=in:st=0.6:d=0.4:alpha=1,fade=t=out:st=4.2:d=0.4:alpha=1[ov];"
     f"[base][ov]overlay=0:0:enable='between(t,0.6,4.6)'[v];"
     f'[1:a]volume=0.6,afade=t=in:st=0:d=1,afade=t=out:st={dd-1.5:.2f}:d=1.5[a]',
     '-map', '[v]', '-map', '[a]', '-t', f'{dd:.3f}'] + VOUT + ['seg/04_demo.mp4'])

# 5) 나의 공간: 바다·하늘산·정글·음악방 (myspace.json: [[파일, 시작, 끝], ...])
if os.path.exists('myspace.json'):
    spaces = json.load(open('myspace.json'))
else:
    keys = ['sea', 'sky', 'jungle', 'music']
    spaces = []
    for f, k in zip(sys.argv[1:5], keys):
        d = dur(f)
        spaces.append([f, max(0, d - 7), d - 1, k])
    print('myspace', spaces)
n = len(spaces)
ins, vf, af = [], '', ''
for i, (f, a, b, key) in enumerate(spaces):
    ins += ['-i', f]
for i, (f, a, b, key) in enumerate(spaces):
    ins += ['-loop', '1', '-i', f'cards/out_opt_{key}.png']
for i, (f, a, b, key) in enumerate(spaces):
    d = b - a
    vf += (f'[{i}:v]trim={a}:{b},setpts=PTS-STARTPTS,{SCALE}[r{i}];'
           f'[{n+i}:v]scale={W}:{H},format=rgba,fade=t=in:st=0.3:d=0.4:alpha=1,fade=t=out:st={d-0.7:.2f}:d=0.4:alpha=1[o{i}];'
           f"[r{i}][o{i}]overlay=0:0:shortest=1,fade=t=in:st=0:d=0.35,fade=t=out:st={d-0.35:.2f}:d=0.35[s{i}];")
    af += f'[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,afade=t=in:st=0:d=0.35,afade=t=out:st={d-0.35:.2f}:d=0.35[a{i}];'
ms = sum(b - a for _, a, b, _k in spaces)
run(ins + ['-loop', '1', '-i', 'cards/out_ch3.png', '-filter_complex',
    vf + af + ''.join(f'[s{i}]' for i in range(n)) + f'concat=n={n}:v=1:a=0[base];'
    + ''.join(f'[a{i}]' for i in range(n)) + f'concat=n={n}:v=0:a=1[a];'
    f"[{2*n}:v]scale={W}:{H},format=rgba,fade=t=in:st=0.6:d=0.4:alpha=1,fade=t=out:st=4.2:d=0.4:alpha=1[ov];"
    f"[base][ov]overlay=0:0:enable='between(t,0.6,4.6)'[v]",
    '-map', '[v]', '-map', '[a]', '-t', f'{ms:.3f}'] + VOUT + ['seg/05_myspace.mp4'])

# 6) 크레딧 8초 + 끝 검정 1초 (음악 open)
still('cards/out_credit.png', 8, f'{SND}/mus_open.mp3', 20, 'seg/06_credit.mp4', fo=1.2)
run(['-f', 'lavfi', '-t', '1', '-i', f'color=c=black:s={W}x{H}:r={FPS}', '-f', 'lavfi', '-t', '1',
     '-i', 'anullsrc=r=48000:cl=stereo', '-map', '0:v', '-map', '1:a', '-t', '1'] + VOUT + ['seg/07_black.mp4'])

segs = ['01_title', '02_spec', '03_origin', '04_demo', '05_myspace', '06_credit', '07_black']
open('seg/list.txt', 'w').write('\n'.join(f"file '{s}.mp4'" for s in segs))
out = sys.argv[5] if len(sys.argv) >= 6 else 'MineD_쇼케이스영상_v0.2.mp4'
run(['-f', 'concat', '-safe', '0', '-i', 'seg/list.txt', '-c', 'copy', '-movflags', '+faststart', out])
for s in segs:
    print(s, round(dur(f'seg/{s}.mp4'), 2))
print('TOTAL', round(dur(out), 2), out)
