import copy, sys
from pptx import Presentation
from pptx.util import Inches
from pptx.dml.color import RGBColor
from PIL import Image
L = sys.argv[1]; IMG = sys.argv[2]; OUT = sys.argv[3]
p = Presentation(L)
S = lambda n: p.slides[n - 1]

def find(slide, start):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip().startswith(start):
            return sh
    raise KeyError(start)

def set_text(sh, lines, color=None):
    """첫 문단·첫 런의 서식을 살려 lines(문단 목록)로 바꾼다. 문단 안에서 (굵게?, 글) 튜플 목록도 됨."""
    tf = sh.text_frame
    paras = tf.paragraphs
    tmpl = copy.deepcopy(paras[0]._p)
    for pp in paras[1:]:
        pp._p.getparent().remove(pp._p)
    first = True
    for line in lines:
        if first:
            pel = paras[0]._p
        else:
            pel = copy.deepcopy(tmpl)
            tf._txBody.append(pel)
        first = False
        from pptx.text.text import _Paragraph
        para = _Paragraph(pel, tf)
        runs = para.runs
        segs = line if isinstance(line, list) else [(None, line)]
        r0 = copy.deepcopy(runs[0]._r) if runs else None
        for r in runs:
            r._r.getparent().remove(r._r)
        for b, txt in segs:
            if r0 is not None:
                rel = copy.deepcopy(r0)
                pel.append(rel) if pel.find('{http://schemas.openxmlformats.org/drawingml/2006/main}endParaRPr') is None else pel.find('{http://schemas.openxmlformats.org/drawingml/2006/main}endParaRPr').addprevious(rel)
                from pptx.text.text import _Run
                run = _Run(rel, para)
            else:
                run = para.add_run()
            run.text = txt
            if b is not None:
                run.font.bold = b
            if color:
                run.font.color.rgb = RGBColor.from_string(color)

def kill(slide, start):
    sh = find(slide, start); sh._element.getparent().remove(sh._element)

def pic(slide, path, x, y, w, h):
    """상자(인치)를 채우도록 가운데 잘라 넣는다."""
    im = Image.open(path); iw, ih = im.size; r = w / h
    if iw / ih > r:
        cw = ih * r; l = (iw - cw) / 2 / iw; cl = (l, 0)
    else:
        ch = iw / r; t = (ih - ch) / 2 / ih; cl = (0, t)
    pc = slide.shapes.add_picture(path, Inches(x), Inches(y), Inches(w), Inches(h))
    pc.crop_left = pc.crop_right = cl[0]; pc.crop_top = pc.crop_bottom = cl[1]
    return pc

SCEN_S = '이미 쌓인 나의 기록(사진·메모·건강·메신저·일정)을 시간의 ‘지층’으로 쌓아, 직접 캐 보며 지난 시간을 다시 만나는 웹 체험이다. 평소와 크게 달랐던 주는 ‘광석’이 되고, 캐서 깨면 그 주의 결 색이 드러난다.'
SCEN_L = ('이미 쌓인 나의 기록(사진·메모·건강·메신저·일정)을 시간의 ‘지층’으로 쌓아, 직접 캐 보며 지난 시간을 다시 만나는 웹 체험이다. '
          '최근 12주는 한 주가 한 층, 그 아래는 해마다 한 층으로 쌓인다. 평소와 크게 달랐던 주는 검은 ‘광석’으로 박히고, 캐서 깨면 그 주의 결 색이 드러난다. '
          '관측소에서 만나는 캐릭터 ‘민디’와 대화하며 고른 말로 나만의 섬을 짓는다. 앱은 해석하거나 진단하지 않고 기록의 사실만 보여 주며, 원문은 기기 밖으로 나가지 않는다. '
          '세계를 여는 영상과 민디의 목소리는 생성형 AI로 만들었다.')
TECH_S = '개인 기록을 ‘한 주 = 한 층’이라는 시간 단위로 다시 정의했다. 기록을 브라우저 안에서만 읽어 수면·걸음·언어·소통 네 축을 그 사람의 평소 범위와 비교하고, 달랐던 축을 광석의 결 색으로 바꾼다.'
TECH_L = ('MineD는 개인 기록을 ‘한 주 = 한 층’이라는 시간 단위로 다시 정의한 기록 시각화 웹 앱이다. 기록을 브라우저 안에서만 읽어 '
          '수면·걸음·언어·소통 네 축을 그 사람의 평소 범위와 비교하고, 평소를 벗어난 주는 광석으로, 벗어난 축은 결 색으로 바꾼다. 원문은 기기 밖으로 나가지 않는다. '
          'KAIST 문화기술대학원 Social Computing Lab은 자기 기록 안에서 근거를 찾아 답하는 개인 기록 챗봇을 개발해 민디와의 대화에 연계하도록 설계했다.')
AITOOL = 'Claude, ChatGPT, Google Flow(Veo 3.1), Seedance 2.0, GPT 이미지, Kling, Gemini, Suno, Kokoro, MediaPipe, CLIP'

def tech_box(slide, body):
    sh = find(slide, '이 부분에는')
    set_text(sh, [body, [(True, 'AI Tool '), (False, AITOOL)]])

# 메인 3 · 서브 7·8 · 심포지엄 17·18
set_text(find(S(3), '이미 쌓인'), [SCEN_S]); tech_box(S(3), TECH_S)
for n in (7, 17):
    set_text(find(S(n), '이미 쌓인'), [SCEN_L])
for n in (8, 18):
    tech_box(S(n), TECH_L)
    sh = find(S(n), 'MineD는'); sh.top = sh.top - Inches(1.6)
    h = find(S(n), '구현 기술'); h.top = h.top - Inches(1.4)
    t = find(S(n), 'MineD: Your'); t.top = t.top - Inches(1.0)

# 9 콘텐츠 개발
s9 = S(9); kill(s9, '여기엔 캐릭터 개발, 이미지 사운드 생성, 스토리 개발 등\n')
DARK = '3A3530'
set_text(find(s9, '캐릭터 개발 및 생성'), ['캐릭터 개발 및 생성'])
set_text(find(s9, '3차원 장면'), ['세계·나의 섬 영상과 사운드'])
set_text(find(s9, '시나리오 개발'), ['시나리오 개발'])
bodies = [sh for sh in s9.shapes if sh.has_text_frame and sh.text_frame.text.startswith('여기엔 캐릭터')]
bodies.sort(key=lambda sh: (sh.left, sh.top))
b1, b2, b3a, b3b = bodies  # x순: 3.3 / 19.5 / 36.0(19.3) / 43.5
if b3a.left > b3b.left: b3a, b3b = b3b, b3a
set_text(b1, ['기록을 지키는 관측소지기 ‘민디’. 이미지 생성으로 기준 시트를 만들어 모든 장면에서 같은 모습을 지켰다.',
              '말투 4종 대사집과, TTS에 음높이 변환을 더한 외계어 목소리를 입혔다.'], DARK)
set_text(b2, ['안개 관측소와 나의 섬 4곳(바다·하늘산·정글·음악방)을 Google Flow(Veo 3.1)와 Seedance 2.0으로 생성했다. 날씨·계절·시대를 바꾼 변주도 함께 만들었다.',
              '효과음 21종과 바탕 소리는 앱 사운드 엔진으로 직접 만들었다.'], DARK)
# b3a: 36.0,19.3 넓은 글 / b3b: 43.5,9.6 좁은 글
nar, wide = (b3b, b3a) if b3b.width < b3a.width else (b3a, b3b)
set_text(nar, ['“묻힌 것은 사라진 것이 아니다.”', '기록을 지층으로, 다시 만나는 순간을 광석으로 옮겼다.'], DARK)
set_text(wide, ['관측소 → 지층 → 광석 → 민디와 이야기 → 나의 섬으로 이어지는 체험 흐름을 설계했다. 첫 방문 튜토리얼, 결 색 범례, 광석 이름 짓기까지 한 줄의 이야기로 묶었다.'], DARK)
I = lambda f: f'{IMG}/{f}'
pic(s9, I('mindi_sq.png'), 3.4, 9.9, 7.3, 7.3)
pic(s9, I('mindi_character_box.png'), 11.1, 9.9, 6.5, 3.0)
pic(s9, I('stone_cut_box.png'), 11.1, 13.3, 6.5, 3.9)
pic(s9, I('island_mountain_reveal.png'), 19.6, 9.9, 14.1, 3.6)
pic(s9, I('island_sea_reveal.png'), 19.6, 18.5, 14.1, 5.4)
pic(s9, I('intro_fog_poster.png'), 36.0, 9.8, 7.0, 5.7)
pic(s9, I('strata.png'), 36.0, 16.1, 14.3, 2.7)

# 10 기술 개발
s10 = S(10); kill(s10, '여기엔 주요 기술')
set_text(find(s10, '주요 개발 기술'), ['지층·광석 판정'])
set_text(find(s10, '시스템 구조'), ['시스템 구조'])
set_text(find(s10, 'OOOO'), ['개인 기록 챗봇'])
tmpl = b1  # 9번 본문 상자 서식 복제
for k, (img, lines) in enumerate([
    ('ore.png', ['최근 12주는 한 주 한 층, 그 아래는 해마다 한 층. 네 축이 평소 범위를 벗어난 주를 광석으로 판정하고, 벗어난 축의 수만큼 결 색 고리를 겹친다.', '광석 판정과 지층 그리기는 모두 브라우저 안에서 이루어진다.']),
    ('diag.png', ['기록 가져오기부터 나의 섬까지 모든 처리를 기기 안에서 한다. 원문은 서버나 외부 모델로 보내지 않는다.', '생성형 AI는 세계 영상·이미지·목소리 제작에만 썼다.']),
    ('chat.png', ['물으면 자기 기록 안에서 근거를 찾아 답하는 개인 기록 챗봇(검색 증강 생성).', 'Social Computing Lab이 개발하고, 민디와의 대화에 연계하도록 설계했다.']),
]):
    x = 2.5 + k * 16.35
    pic(s10, I(img), x + 0.6, 9.9, 14.5, 8.0)
    el = copy.deepcopy(tmpl._element); s10.shapes._spTree.append(el)
    sh = s10.shapes[-1]; sh.left, sh.top, sh.width, sh.height = Inches(x + 0.6), Inches(18.3), Inches(14.5), Inches(6.0)
    set_text(sh, lines, DARK)

# 크레딧 12·20 (HERIZON × SCL): 11/09 보별 결정 = 팀원 개인 이름은 넣지 않음, 협업 = 이원재 교수 연구실 이서연
for n in (12, 20):
    kill(S(n), '이서연')
    set_text(find(S(n), '이원재'), ['이원재 교수 연구실', '이서연'])
for n in (13, 21):  # 팀 단독 장(쓰지 않음): 이름 칸 비움
    kill(S(n), '이서연')
p.save(OUT)
