#!/usr/bin/env python3
"""민디 감탄사 목소리 → 스프라이트 한 장 + 자리표 JSON (사운드 키트 v1.4).

쓰는 법:
  python3 voice_sprite.py <감탄사 폴더> <키트 audio 폴더>
감탄사 폴더에는 자리 이름으로 된 소리 파일을 둔다(mp3/wav/m4a).
  hello.mp3 ask.mp3 explain.mp3 cheer.mp3 comfort.mp3 think.mp3 surprise.mp3
  found.mp3 mined.mp3 wait.mp3 effort.mp3 notice.mp3 laugh.mp3
같은 자리에 여러 벌을 두려면 hello_2.mp3 처럼 _숫자 를 붙인다.
결과: <audio>/mindi_voice_cute.mp3 + <audio>/mindi_voice_cute.json ({자리: [[시작초, 길이초], ...]})
ffmpeg·ffprobe 가 필요하다. 앞뒤 무음을 자르고 소리 크기를 -18 LUFS 로 맞춘다.
"""
import json, os, re, subprocess, sys, tempfile

GAP = 0.15  # 낱말 사이 빈 틈(초). 재생은 자리표로 잘라 쓰므로 틈은 안전용

def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout

def duration(path):
    return float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path).strip())

def main(src, dest):
    files = sorted(f for f in os.listdir(src) if re.search(r'\.(mp3|wav|m4a|ogg|flac)$', f, re.I))
    if not files:
        sys.exit('감탄사 파일이 없습니다: ' + src)
    tmp = tempfile.mkdtemp()
    units, pieces, t = {}, [], 0.0
    sil = os.path.join(tmp, 'gap.wav')
    run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', str(GAP), sil)
    for f in files:
        key = re.sub(r'(_\d+)?\.[^.]+$', '', f)
        out = os.path.join(tmp, re.sub(r'\.[^.]+$', '.wav', f))
        run('ffmpeg', '-v', 'error', '-y', '-i', os.path.join(src, f), '-af',
            'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03,'
            'areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.06,areverse,'
            'loudnorm=I=-18:TP=-2', '-ac', '1', '-ar', '24000', out)
        d = duration(out)
        units.setdefault(key, []).append([round(t, 3), round(d, 3)])
        pieces += [out, sil]
        t += d + GAP
    lst = os.path.join(tmp, 'list.txt')
    with open(lst, 'w') as fh:
        for p in pieces:
            fh.write("file '%s'\n" % p)
    os.makedirs(dest, exist_ok=True)
    run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-ac', '1', '-ar', '24000', '-b:a', '64k',
        os.path.join(dest, 'mindi_voice_cute.mp3'))
    with open(os.path.join(dest, 'mindi_voice_cute.json'), 'w', encoding='utf-8') as fh:
        json.dump(units, fh, ensure_ascii=False, indent=1)
    print('자리', len(units), '개 / 낱말', sum(len(v) for v in units.values()), '개 / 길이 %.1f초' % t)
    for k, v in units.items():
        print(' ', k, v)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
