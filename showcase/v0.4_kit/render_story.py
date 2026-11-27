"""Mine D 쇼케이스 v0.4 이야기 장면 합성기.
민디는 생성하지 않고 원화(mindi_full.webp)를 그대로 얹어 움직인다 → 모든 컷에서 같은 민디.
출력: out/S2_walk.mp4 S3_papers.mp4 S4_strata.mp4 S9_end.mp4 (1920x1080 30fps, 영상만)
사용: python3 render_story.py [--only S2] [--still]  (--still 은 첫·끝 프레임 PNG만)
"""
import math, os, random, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
AS = os.path.join(HERE, 'assets')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1920, 1080, 30
DARK = (13, 12, 11)


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def load(name):
    return Image.open(os.path.join(AS, name)).convert('RGBA')


MINDI = load('mindi_full.webp')
PAPER = load('habin_paper.png')


def stars(seed=4, n=140):
    im = Image.new('RGBA', (W, H), DARK + (255,))
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(n):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(0.6, 1.8)
        a = int(rnd.uniform(60, 200))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 236, 200, a))
    return im


def cave_base():
    im = load('E03_지하관측소_내부.png')
    can = stars()
    im = im.resize((int(im.width * H / im.height), H), Image.LANCZOS)
    can.alpha_composite(im, ((W - im.width) // 2, 0))
    return can


def strata_base():
    im = load('E07_지층_단면.png').convert('RGB')
    s = max(W / im.width, H / im.height)
    im = im.resize((math.ceil(im.width * s), math.ceil(im.height * s)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    can = im.crop((x, y, x + W, y + H))
    return Image.blend(can, Image.new('RGB', (W, H), DARK), 0.25).convert('RGBA')


def vignette(strength=0.75):
    v = Image.new('L', (W // 4, H // 4), 0)
    ImageDraw.Draw(v).ellipse([-W // 16, -H // 16, W // 4 + W // 16, H // 4 + H // 16], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(40)).resize((W, H))
    a = v.point(lambda p: int((255 - p) * strength))
    return Image.merge('RGBA', [Image.new('L', (W, H), 0)] * 3 + [a])


VIG = vignette()


def glow_img(r, col=(255, 176, 72)):
    g = Image.new('RGBA', (r * 4, r * 4), col + (0,))
    a = Image.new('L', (r * 4, r * 4), 0)
    ImageDraw.Draw(a).ellipse([r, r, r * 3, r * 3], fill=255)
    g.putalpha(a.filter(ImageFilter.GaussianBlur(r * 0.55)))
    return g


GLOW = glow_img(260)


def lantern(f, t, x=0.345, y=0.40, lv=0.85):
    lv *= 0.9 + 0.1 * math.sin(t * 7.1) * math.sin(t * 3.3)
    g = GLOW.copy()
    g.putalpha(g.split()[3].point(lambda a: int(a * lv)))
    f.alpha_composite(g, (int(x * W - g.width / 2), int(y * H - g.height / 2)))


class Specks:
    def __init__(self, n=46, seed=11):
        rnd = random.Random(seed)
        self.p = [(rnd.uniform(0, W), rnd.uniform(-H, H), rnd.uniform(30, 90), rnd.uniform(2.5, 6), rnd.uniform(0, 6.28))
                  for _ in range(n)]

    def draw(self, f, t, alpha=1.0):
        ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        for x, y, sp, r, ph in self.p:
            yy = (y + sp * t) % (H * 1.1) - H * 0.05
            xx = x + 14 * math.sin(t * 0.9 + ph)
            a = int((140 + 80 * math.sin(t * 2 + ph)) * alpha)
            d.ellipse([xx - r, yy - r, xx + r, yy + r], fill=(255, 226, 160, a))
        f.alpha_composite(ov.filter(ImageFilter.GaussianBlur(2.2)))


_cache = {}


def mindi_sprite(h, rot=0.0, bright=1.0):
    key = (int(h), round(rot, 1), round(bright, 2))
    if key not in _cache:
        m = MINDI.resize((int(MINDI.width * h / MINDI.height), int(h)), Image.LANCZOS)
        if bright < 0.999:
            rgb = ImageEnhance.Brightness(m.convert('RGB')).enhance(bright)
            rgb.putalpha(m.split()[3])
            m = rgb
        if abs(rot) > 0.05:
            m = m.rotate(rot, resample=Image.BICUBIC, expand=True, center=(m.width / 2, m.height))
        if len(_cache) > 400:
            _cache.clear()
        _cache[key] = m
    return _cache[key]


def put_mindi(f, x, y, h, rot=0.0, bright=1.0, shadow=0.43):
    """x,y = 발 중심(0~1). h = 키(픽셀)"""
    m = mindi_sprite(h, rot, bright)
    if shadow > 0:
        sw = int(h * 0.62)
        sh = Image.new('RGBA', (sw, max(4, int(sw * 0.2))), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([0, 0, sh.width - 1, sh.height - 1], fill=(0, 0, 0, int(255 * shadow * bright)))
        sh = sh.filter(ImageFilter.GaussianBlur(max(2, h / 60)))
        f.alpha_composite(sh, (int(x * W - sh.width / 2), int(y * H - sh.height * 0.55)))
    f.alpha_composite(m, (int(x * W - m.width / 2), int(y * H - m.height)))


def zoom(f, t, d, z0, z1, cx=0.5, cy=0.5):
    z = z0 + (z1 - z0) * ease(t / d)
    cw, ch = W / z, H / z
    x = min(max(cx * W - cw / 2, 0), W - cw)
    y = min(max(cy * H - ch / 2, 0), H - ch)
    return f.resize((W, H), Image.BICUBIC, box=(x, y, x + cw, y + ch))


# ───────────── 장면들
CAVE = None


def walk_pose(t, t0, t1, p0, p1, h0, h1, b0, b1, step_hz=1.15):
    """굴 안 → 앞으로. 천천히 뒤뚱."""
    p = ease((t - t0) / (t1 - t0))
    x = p0[0] + (p1[0] - p0[0]) * p
    y = p0[1] + (p1[1] - p0[1]) * p
    h = h0 + (h1 - h0) * p
    b = b0 + (b1 - b0) * min(1, max(0, (t - t0) / ((t1 - t0) * 0.55)))
    walking = t0 < t < t1
    ph = (t - t0) * 2 * math.pi * step_hz
    rot = 3.2 * math.sin(ph) if walking else 0.0
    lift = abs(math.sin(ph)) * h * 0.018 if walking else 0.0
    # 멈춘 뒤 숨쉬기
    if t >= t1:
        lift = h * 0.006 * math.sin((t - t1) * 2 * math.pi * 0.6)
    return x, y - lift / H, h, rot, b


def S2(t, d):
    """굴에서 민디가 천천히 걸어 나와 앞으로 와서 선다 (원 기원 영상 C08)."""
    f = CAVE.copy()
    lantern(f, t, lv=0.55 + 0.35 * ease((t - 0.3) / 1.5))
    x, y, h, rot, b = walk_pose(t, 0.9, 6.6, (0.468, 0.40), (0.535, 0.77), 120, 285, 0.35, 1.0)
    put_mindi(f, x, y, h, rot, b, shadow=0.45)
    SP.draw(f, t, 0.8)
    f = zoom(f, t, d, 1.0, 1.06, 0.52, 0.58)
    f.alpha_composite(VIG)
    return f


def S9(t, d):
    """여운: 같은 굴, 민디는 등불 옆. 오늘의 빛 조각이 내려앉는다."""
    f = CAVE.copy()
    lantern(f, t, lv=0.95)
    put_mindi(f, 0.535, 0.77 - 0.0016 * math.sin(t * 2 * math.pi * 0.6), 285, 0, 1.0)
    SP.draw(f, t + 20, 1.0)
    f = zoom(f, t, d, 1.08, 1.0, 0.52, 0.58)
    f.alpha_composite(VIG)
    return f


PAPER_S = None


def S3(t, d):
    """기록 더미 앞의 민디. 하빈님 종이 에셋(메모·사진·걸음·그래프)."""
    f = CAVE.copy()
    lantern(f, t, lv=0.9)
    f = zoom(f, 0, 1, 1.14, 1.14, 0.5, 0.62)  # 고정 확대된 배경
    # 종이 더미: 천천히 떠오르듯 빛남
    p = PAPER_S.copy()
    pulse = 0.92 + 0.08 * math.sin(t * 1.6)
    p.putalpha(p.split()[3].point(lambda a: int(a * pulse)))
    f.alpha_composite(p, (int(0.68 * W - p.width / 2), int(0.45 * H - p.height / 2 - 6 * math.sin(t * 0.8))))
    # 민디: 종이 쪽으로 살짝 기울었다 돌아옴
    tilt = -4.0 * ease((t - 1.0) / 1.2) + 4.0 * ease((t - 4.6) / 1.2)
    bob = 0.004 * math.sin(t * 2 * math.pi * 0.6)
    put_mindi(f, 0.17, 0.97 - bob, 560, tilt, 1.0, shadow=0.5)
    SP.draw(f, t + 7, 0.6)
    f = zoom(f, t, d, 1.0, 1.04, 0.5, 0.55)
    f.alpha_composite(VIG)
    return f


STRATA = None


def chalk(text, size=30):
    f = ImageFont.truetype(FONT, size)
    bb = f.getbbox(text)
    im = Image.new('RGBA', (bb[2] + 20, bb[3] + 20), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((10, 6), text, font=f, fill=(238, 234, 222, 210))
    rnd = np.random.default_rng(1)
    a = np.array(im.split()[3], dtype=np.float32) * (0.55 + 0.45 * rnd.random(im.size[::-1]))
    im.putalpha(Image.fromarray(a.astype('uint8')))
    return im.rotate(-3, expand=True, resample=Image.BICUBIC)


MARKS = None


def S4(t, d):
    """그렇게 십 년: 분필 날짜가 하나씩 늘어난다. 민디는 그 앞에 서 있다."""
    f = STRATA.copy()
    for x, y, tm, im in MARKS:
        if t > tm:
            m = im.copy()
            m.putalpha(m.split()[3].point(lambda a: int(a * ease((t - tm) / 0.35))))
            f.alpha_composite(m, (int(x * W), int(y * H)))
    lantern(f, t, 0.5, 0.64, 0.35)
    put_mindi(f, 0.5, 0.77 - 0.002 * math.sin(t * 2 * math.pi * 0.6), 300, 0, 1.0)
    SP.draw(f, t + 13, 0.7)
    f = zoom(f, t, d, 1.18, 1.0, 0.5, 0.6)
    f.alpha_composite(VIG)
    return f


SCENES = {'S2': (S2, 8.0, 'S2_walk'), 'S3': (S3, 7.0, 'S3_papers'), 'S4': (S4, 6.0, 'S4_strata'),
          'S9': (S9, 6.0, 'S9_end')}
FONT = None


def main():
    global CAVE, SP, PAPER_S, STRATA, MARKS, FONT
    FONT = next(p for p in [os.path.join(AS, 'Pretendard-Medium.otf'), '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
                if os.path.exists(p))
    CAVE = cave_base()
    SP = Specks()
    s = 0.56 * W / PAPER.width
    PAPER_S = PAPER.resize((int(PAPER.width * s), int(PAPER.height * s)), Image.LANCZOS)
    STRATA = strata_base()
    rnd = random.Random(5)
    cells = [(c, r) for r in range(3) for c in range(5)]
    rnd.shuffle(cells)
    MARKS = [(.07 + c * .17 + rnd.uniform(0, .06), .09 + r * .14 + rnd.uniform(0, .05), 0.4 + i * 0.32,
              chalk(f'{2016 + i // 2}. {rnd.randint(1, 12)}.')) for i, (c, r) in enumerate(cells)]
    only = sys.argv[sys.argv.index('--only') + 1].split(',') if '--only' in sys.argv else list(SCENES)
    still = '--still' in sys.argv
    for k in only:
        fn, d, name = SCENES[k]
        n = int(round(d * FPS))
        if still:
            for i in (0, n // 2, n - 1):
                fn(i / FPS, d).convert('RGB').save(os.path.join(OUT, f'{name}_{i:03d}.png'))
            continue
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
                              '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14',
                              '-pix_fmt', 'yuv420p', os.path.join(OUT, name + '.mp4')], stdin=subprocess.PIPE)
        for i in range(n):
            p.stdin.write(fn(i / FPS, d).convert('RGB').tobytes())
        p.stdin.close()
        p.wait()
        print(name, d)


if __name__ == '__main__':
    main()
