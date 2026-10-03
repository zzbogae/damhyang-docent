"""필터 시험셋 조립: raw/ 의 원본(AI 생성 가상 이미지, MediaPipe 공개 시험 이미지)과
PIL 로 그린 문서·영수증·가짜 회원증·스크린샷을 모아 testset/ 에 저장하고 정답을 labels.json 에 적는다.
실제 개인 기록은 쓰지 않는다. 실행: core/.venv/bin/python web/lab/tools/build_testset.py"""
import json, pathlib, random, subprocess, io
from PIL import Image, ImageDraw, ImageFont
import piexif

HERE = pathlib.Path(__file__).resolve().parent
TS = HERE.parent / 'testset'
RAW = TS / 'raw'
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
random.seed(20260911)


def font(size, idx=0):
    return ImageFont.truetype(FONT, size, index=idx)


def camera_exif(make='samsung', model='SM-S928N', dt='2025:10:03 14:22:10', orientation=1):
    zeroth = {piexif.ImageIFD.Make: make.encode(), piexif.ImageIFD.Model: model.encode(),
              piexif.ImageIFD.Orientation: orientation}
    exif = {piexif.ExifIFD.DateTimeOriginal: dt.encode()}
    return piexif.dump({'0th': zeroth, 'Exif': exif})


def save_jpeg(im, name, exif=True, long_side=1280, **kw):
    im = im.convert('RGB')
    im.thumbnail((long_side, long_side))
    dest = TS / name
    if exif:
        im.save(dest, 'JPEG', quality=84, exif=camera_exif(**kw))
    else:
        im.save(dest, 'JPEG', quality=84)
    return dest


LABELS = []


def add(name, hide, reason, source, note='', hard=False):
    LABELS.append({'file': name, 'hide': hide, 'reason': reason, 'source': source, 'note': note, 'hard': hard})


# 1) AI 생성 가상 이미지와 MediaPipe 시험 이미지 → 카메라 EXIF 를 붙인 JPEG
AI = {
    'ai_selfie': (True, 'face', ''), 'ai_group_dinner': (True, 'face', ''),
    'ai_park_far': (True, 'face', '15m 거리 작은 얼굴', True), 'ai_profile_sea': (True, 'face', '옆얼굴', True),
    'ai_birthday': (True, 'face', ''), 'ai_hiking_two': (True, 'face', ''),
    'ai_mirror_selfie': (True, 'face', '폰이 얼굴 일부를 가림'), 'ai_concert_crowd': (True, 'face', '관객 얼굴이 아주 작음', True),
    'ai_doc_desk': (True, 'text', ''), 'ai_receipt': (True, 'text', ''), 'ai_whiteboard': (True, 'text', ''),
    'ai_laptop_sheet': (True, 'text', '화면 속 표'), 'ai_notebook': (True, 'text', '손글씨 일기'),
    'ai_mountain': (False, '', ''), 'ai_bibimbap': (False, '', ''), 'ai_cat_sofa': (False, '', ''),
    'ai_neon_street': (False, '', '멀리 간판 글자'), 'ai_beach_sunset': (False, '', ''), 'ai_flowers': (False, '', ''),
    'ai_bookshelf': (False, '', '책등 글자'), 'ai_skyline': (False, '', ''), 'ai_latte': (False, '', ''),
    'ai_dog_park': (False, '', ''), 'ai_backs': (False, '', '뒷모습만'),
}
for stem, spec in AI.items():
    hide, reason, note = spec[:3]
    hard = spec[3] if len(spec) > 3 else False
    im = Image.open(RAW / f'{stem}.png')
    save_jpeg(im, f'{stem}.jpg')
    add(f'{stem}.jpg', hide, reason, 'AI 생성(OpenRouter gemini-3.1-flash-image-preview), 가상 인물', note, hard)

MP = {'mp_portrait': (True, 'face', ''), 'mp_portrait_rotated': (True, 'face', '픽셀 자체가 90도 돌아간 사진', True),
      'mp_pose': (True, 'face', '작은 옆얼굴', True), 'mp_cats_and_dogs': (False, '', ''), 'mp_burger': (False, '', '')}
for stem, (hide, reason, note, *h) in MP.items():
    im = Image.open(RAW / f'{stem}.jpg')
    save_jpeg(im, f'{stem}.jpg', make='Canon', model='EOS R6')
    add(f'{stem}.jpg', hide, reason, 'MediaPipe 공개 시험 이미지(storage.googleapis.com/mediapipe-assets, Apache-2.0)', note, bool(h and h[0]))

# 2) EXIF 회전: 픽셀은 옆으로 누워 있고 EXIF Orientation=6 이 바로 세우라고 알려 주는 셀카
im = Image.open(RAW / 'ai_selfie.png').convert('RGB').rotate(90, expand=True)
save_jpeg(im, 'exif_rot_selfie.jpg', orientation=6)
add('exif_rot_selfie.jpg', True, 'face', 'ai_selfie 를 눕히고 EXIF Orientation=6', '브라우저가 EXIF 방향을 적용해야 얼굴이 섬')


# 3) PIL 로 그린 문서류(카메라 EXIF 를 붙여 화면 캡처 규칙이 아니라 글자 검출로 걸러지게)
def paper(w, h, color=(250, 250, 246)):
    return Image.new('RGB', (w, h), color)


LOREM = ('이번 분기 운영 계획은 다음과 같습니다. 첫 주에는 담당자별 일정을 확인하고, 둘째 주부터 현장 점검을 진행합니다. '
         '예산 집행 내역은 매주 금요일까지 정리해 공유해 주십시오. 회의록은 공용 폴더에 올리고 결정되지 않은 항목만 표시합니다. '
         '고객 문의는 접수 순서대로 처리하며, 긴급 건은 별도로 보고합니다.')


def wrap(draw, text, fnt, width):
    lines, cur = [], ''
    for ch in text:
        if draw.textlength(cur + ch, font=fnt) > width:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


# 3-1) A4 문서(책상 위에 놓인 것처럼 약간 기울임)
doc = paper(1240, 1754)
d = ImageDraw.Draw(doc)
d.text((120, 110), '2025년 4분기 운영 계획서 (가상 문서)', font=font(52, 6), fill=(20, 20, 20))
y = 220
for para in range(6):
    for line in wrap(d, LOREM, font(30), 1000):
        d.text((120, y), line, font=font(30), fill=(35, 35, 35)); y += 46
    y += 30
for r in range(6):
    for c in range(4):
        d.rectangle([120 + c * 250, y + r * 50, 370 + c * 250, y + (r + 1) * 50], outline=(60, 60, 60))
        d.text((135 + c * 250, y + r * 50 + 10), f'항목 {r}-{c}', font=font(24), fill=(40, 40, 40))
desk = Image.new('RGB', (1600, 1200), (150, 110, 75))
docr = doc.resize((760, 1075)).rotate(8, expand=True, fillcolor=(150, 110, 75))
desk.paste(docr, (400, 40))
save_jpeg(desk, 'pil_doc_desk.jpg')
add('pil_doc_desk.jpg', True, 'text', 'PIL 렌더링 가상 문서', '책상 위 기울어진 A4')

# 3-2) 영수증
rc = paper(560, 1500, (255, 255, 252))
d = ImageDraw.Draw(rc)
d.text((150, 40), '가상상점 영수증', font=font(40, 6), fill=(10, 10, 10))
y = 120
for i in range(22):
    d.text((40, y), f'상품 {i + 1:02d}  x{random.randint(1, 3)}', font=font(28), fill=(20, 20, 20))
    d.text((380, y), f'{random.randint(1, 30) * 500:,}원', font=font(28), fill=(20, 20, 20))
    y += 52
d.text((40, y + 20), '합계  128,500원   카드 ****-****-****-1234', font=font(28, 6), fill=(0, 0, 0))
table = Image.new('RGB', (1200, 1500), (95, 70, 55))
table.paste(rc.rotate(-5, expand=True, fillcolor=(95, 70, 55)), (300, 0))
save_jpeg(table, 'pil_receipt.jpg')
add('pil_receipt.jpg', True, 'text', 'PIL 렌더링 가상 영수증')

# 3-3) 가짜 회원증(얼굴 사진 + 글자). 명백한 가짜 표시
card = Image.new('RGB', (1012, 638), (232, 240, 250))
d = ImageDraw.Draw(card)
d.rectangle([0, 0, 1012, 90], fill=(40, 70, 140))
d.text((30, 22), 'SAMPLE 가짜 회원증 · 실제 신분증 아님', font=font(40, 6), fill=(255, 255, 255))
face = Image.open(RAW / 'ai_selfie.png').convert('RGB')
fw, fh = face.size
face = face.crop((int(fw * 0.25), int(fh * 0.25), int(fw * 0.8), int(fh * 0.72))).resize((260, 300))
card.paste(face, (40, 130))
for i, t in enumerate(['이름  가상인', '회원번호  0000-0000-00', '발급일  2025.10.03', '유효기간  2030.10.02', '가상 도서관 발급']):
    d.text((340, 150 + i * 70), t, font=font(38), fill=(20, 20, 40))
bg = Image.new('RGB', (1400, 1050), (200, 200, 195))
bg.paste(card.rotate(3, expand=True, fillcolor=(200, 200, 195)), (180, 180))
save_jpeg(bg, 'pil_fake_card.jpg')
add('pil_fake_card.jpg', True, 'text', 'PIL 렌더링 가짜 회원증 + AI 가상 인물 얼굴', '얼굴과 글자가 함께 있음')


# 4) 스크린샷(EXIF 없음). 두 장은 PNG+이름 규칙으로, 한 장은 JPEG 로 저장해 글자 검출로 걸러지는지 확인
def chat_ui(w=1170, h=2532):
    im = Image.new('RGB', (w, h), (185, 206, 224))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 180], fill=(170, 190, 210))
    d.text((60, 90), '가상 대화방', font=font(52, 6), fill=(20, 20, 20))
    y = 240
    for i in range(16):
        mine = i % 3 == 0
        txt = random.choice(['내일 몇 시에 볼까?', '회의 자료 보냈어요', '점심 뭐 먹을래', '거의 다 왔어', '사진 확인 부탁해요', '오늘 고마웠어'])
        tw = d.textlength(txt, font=font(44)) + 60
        x0 = w - tw - 60 if mine else 60
        d.rounded_rectangle([x0, y, x0 + tw, y + 100], radius=30, fill=(255, 235, 51) if mine else (255, 255, 255))
        d.text((x0 + 30, y + 25), txt, font=font(44), fill=(20, 20, 20))
        y += 140
    return im


ui = chat_ui()
ui.save(TS / '스크린샷 2025-10-03 오후 3.12.45.png')
add('스크린샷 2025-10-03 오후 3.12.45.png', True, 'screenshot', 'PIL 렌더링 가상 대화 화면', 'PNG·EXIF 없음·이름')
ui2 = chat_ui()
ui2.save(TS / 'Screenshot_20251003-151245.png')
add('Screenshot_20251003-151245.png', True, 'screenshot', 'PIL 렌더링 가상 대화 화면', 'PNG·EXIF 없음·이름')
ui3 = chat_ui().convert('RGB')
ui3.thumbnail((1280, 1280))
ui3.save(TS / 'IMG_4821.jpg', 'JPEG', quality=84)
add('IMG_4821.jpg', True, 'text', 'PIL 렌더링 가상 대화 화면(JPEG, EXIF 없음, 평범한 이름)', '화면 캡처 규칙은 못 잡고 글자 검출이 잡아야 함')

# 5) 오탐 측정용: EXIF 없는 PNG 풍경(메신저로 받은 사진 등). 규칙상 화면 캡처로 숨겨짐(알려진 오탐)
ls = Image.open(RAW / 'ai_mountain.png').convert('RGB')
ls.thumbnail((1280, 1280))
ls.save(TS / 'KakaoTalk_20251003_landscape.png')
add('KakaoTalk_20251003_landscape.png', False, '', 'ai_mountain 을 EXIF 없는 PNG 로 저장', '규칙상 화면 캡처로 숨겨지는 알려진 오탐')

# 6) HEIC(macOS sips 변환). 크롬은 기본 해독을 못 하므로 libheif-js 경로를 탄다
for stem, hide, reason in [('ai_mountain', False, ''), ('ai_selfie', True, 'face')]:
    src = TS / f'{stem}.jpg'
    dest = TS / f'{stem}.heic'
    subprocess.run(['sips', '-s', 'format', 'heic', str(src), '--out', str(dest)], check=True, capture_output=True)
    add(f'{stem}.heic', hide, reason, f'{stem}.jpg 를 sips 로 HEIC 변환', 'HEIC 해독 경로')

(TS / 'labels.json').write_text(json.dumps(LABELS, ensure_ascii=False, indent=1), encoding='utf-8')
print(len(LABELS), 'images;', sum(l['hide'] for l in LABELS), 'should hide')
