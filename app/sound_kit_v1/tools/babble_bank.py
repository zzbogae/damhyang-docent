#!/usr/bin/env python3
"""옹알이 낱말 묶음 → 한 파일 + 낱말 위치표 (사운드 키트 v1.4, 설명 대사용).

쓰는 법: python3 babble_bank.py <낱말 폴더> <키트 audio 폴더> [이름=bella]
낱말 폴더의 소리 파일(mp3/wav…)을 이름순으로 이어 <audio>/mindi_voice_<이름>.mp3 와
<audio>/mindi_voice_<이름>.json ([[시작초, 길이초, 1.0], ...]) 을 만든다. ffmpeg·ffprobe 필요.
이미 한 파일로 이어진 뱅크가 있으면 그 파일만 든 폴더를 주면 된다(그때는 낱말 하나로 잡히므로 낱말별 파일을 권장).
"""
import json, os, re, subprocess, sys, tempfile

GAP = 0.08

def run(*cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout

def duration(path):
    return float(run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path).strip())

def main(src, dest, name='bella'):
    files = sorted(f for f in os.listdir(src) if re.search(r'\.(mp3|wav|m4a|ogg|flac)$', f, re.I))
    if not files:
        sys.exit('낱말 파일이 없습니다: ' + src)
    tmp = tempfile.mkdtemp(); units, pieces, t = [], [], 0.0
    sil = os.path.join(tmp, 'gap.wav')
    run('ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', str(GAP), sil)
    for f in files:
        out = os.path.join(tmp, re.sub(r'\.[^.]+$', '.wav', f))
        run('ffmpeg', '-v', 'error', '-y', '-i', os.path.join(src, f), '-af',
            'silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03,'
            'areverse,silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.05,areverse,'
            'loudnorm=I=-18:TP=-2', '-ac', '1', '-ar', '24000', out)
        d = duration(out); units.append([round(t, 3), round(d, 3), 1.0]); pieces += [out, sil]; t += d + GAP
    lst = os.path.join(tmp, 'list.txt')
    with open(lst, 'w') as fh:
        for p in pieces: fh.write("file '%s'\n" % p)
    os.makedirs(dest, exist_ok=True)
    run('ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-ac', '1', '-ar', '24000', '-b:a', '64k',
        os.path.join(dest, 'mindi_voice_%s.mp3' % name))
    with open(os.path.join(dest, 'mindi_voice_%s.json' % name), 'w') as fh:
        json.dump(units, fh)
    print('낱말', len(units), '개 / 길이 %.1f초' % t)

if __name__ == '__main__':
    if len(sys.argv) not in (3, 4): sys.exit(__doc__)
    main(*sys.argv[1:])
