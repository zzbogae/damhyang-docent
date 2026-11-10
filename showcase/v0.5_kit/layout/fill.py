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

SCEN_S = '흩어진 나의 기록을 지층으로 쌓고, 평소와 달랐던 주를 광석으로 캐내는 웹 체험.'
SCEN_L = '앞으로만 달려온 나에게 잠시 쉬어 갈 곳. 흩어진 기록이 한 주에 한 층씩 쌓이고, 평소와 달랐던 주는 광석이 된다. 민디와 나눈 말로 나만의 섬을 짓는다.'
TECH_S = '한 주를 한 층으로. 기록은 기기 안에서만 읽고, 달랐던 축을 결 색으로 보여 준다.'
TECH_L = '기록을 ‘한 주 = 한 층’으로 다시 정의했다. 수면·걸음·언어·소통 네 축을 나의 평소와 비교해 달랐던 주는 광석, 달랐던 축은 결 색으로 보여 준다. 원문은 기기 밖으로 나가지 않는다. KAIST 문화기술대학원 Social Computing Lab은 기록 기반 개인 챗봇을 개발해, 민디와의 대화에 연계하도록 설계했다.'
TECH_XL = ['기록을 ‘한 주 = 한 층’으로 다시 정의했다. 수면·걸음·언어·소통 네 축을 나의 지난 기록과 같은 척도(백분위)로 비교해, 가장 크게 벗어난 축이 광석의 겉색이 되고 세 축 이상이면 여러 색 광석이 된다. 개인 기록이라 원문은 기기 밖으로 나가지 않는다.',
           '진단하지 않기 위해, 민디와의 대화는 판정값 질문과 위기·진단 문장을 앱 규칙이 먼저 받고 나머지 말만 KAIST 문화기술대학원 Social Computing Lab의 기록 기반 개인 챗봇이 받도록 연계했다. 챗봇이 꺼져 있어도 선택지로 섬까지 완성된다.']
AITOOL = 'Claude, ChatGPT, Google Flow(Veo 3.1), Seedance 2.0, GPT 이미지, Kling, Gemini, Suno, Kokoro, MediaPipe, CLIP'

def tech_box(slide, body):
    sh = find(slide, '이 부분에는')
    body = body if isinstance(body, list) else [body]
    set_text(sh, body + [[(True, 'AI Tool '), (False, AITOOL)]]); return sh

# 메인 3 · 서브 7·8 · 심포지엄 17·18
set_text(find(S(3), '이미 쌓인'), [SCEN_S]); tech_box(S(3), TECH_S)
for n in (7, 17):
    set_text(find(S(n), '이미 쌓인'), [SCEN_L])
for n in (8, 18):
    sh = tech_box(S(n), TECH_L) if n == 8 else tech_box(S(n), TECH_XL); sh.top = sh.top - Inches(0.6)
    if n == 18:  # 긴 판은 글자를 0.82배로 줄이고 조금 더 올림(바닥 HERIZON 줄과 겹치지 않게)
        sh.top = sh.top - Inches(1.4)
        from pptx.util import Pt
        szs = [int(x) for x in sh._element.xpath('.//a:defRPr/@sz | .//a:rPr/@sz')]
        base = max(szs) if szs else 5400
        for pp in sh.text_frame.paragraphs:
            for r in pp.runs: r.font.size = Pt(base / 100 * 0.78)
    h = find(S(n), '구현 기술'); h.top = h.top - Inches(0.6)
    t = find(S(n), 'MineD: Your'); t.top = t.top - Inches(0.4)
    if n == 18: h.top = h.top - Inches(1.2); t.top = t.top - Inches(0.6)

# 9 콘텐츠 개발
s9 = S(9); kill(s9, '여기엔 캐릭터 개발, 이미지 사운드 생성, 스토리 개발 등\n')
DARK = '3A3530'
set_text(find(s9, '캐릭터 개발 및 생성'), ['캐릭터'])
set_text(find(s9, '3차원 장면'), ['세계와 소리'])
set_text(find(s9, '시나리오 개발'), ['시나리오'])
bodies = [sh for sh in s9.shapes if sh.has_text_frame and sh.text_frame.text.startswith('여기엔 캐릭터')]
bodies.sort(key=lambda sh: (sh.left, sh.top))
b1, b2, b3a, b3b = bodies  # x순: 3.3 / 19.5 / 36.0(19.3) / 43.5
if b3a.left > b3b.left: b3a, b3b = b3b, b3a
set_text(b1, ['관측소지기 민디. 기준 시트로 모든 장면의 모습을 맞췄다.', 'AI 모델: GPT 이미지, Kling'], DARK)
set_text(b2, ['관측소와 섬 4곳은 AI 영상으로 짓고, 효과음 21종은 직접 만들었다.', 'AI 모델: Google Flow(Veo 3.1), Seedance 2.0, Suno, Kokoro'], DARK)
# b3a: 36.0,19.3 넓은 글 / b3b: 43.5,9.6 좁은 글
nar, wide = (b3b, b3a) if b3b.width < b3a.width else (b3a, b3b)
set_text(nar, ['“묻힌 것은 사라진 것이 아니다.”'], DARK)
set_text(wide, ['관측소에서 섬까지 이어지는 하나의 이야기.', 'AI 모델: Claude, ChatGPT'], DARK)
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
set_text(find(s10, 'OOOO'), [' '])  # 11/09 운영: 연구실 칸은 연구실이 작성 중, 비워 둠
tmpl = b1  # 9번 본문 상자 서식 복제
for k, (img, lines) in enumerate([
    ('ore.png', ['한 주는 한 층. 네 축을 나의 지난 기록과 같은 척도(백분위)로 비교해 가장 크게 벗어난 축이 겉색, 세 축 이상이면 여러 색 광석이 된다.']),
    ('diag.png', ['처리는 모두 기기 안에서. 민디 대화는 판정 질문·위기 문장을 앱 규칙이 먼저 받고, 나머지만 연구실 챗봇이 받는다.'])]):
    x = 2.5 + k * 16.35
    pic(s10, I(img), x + 0.6, 9.9, 14.5, 8.0)
    el = copy.deepcopy(tmpl._element); s10.shapes._spTree.append(el)
    sh = s10.shapes[-1]; sh.left, sh.top, sh.width, sh.height = Inches(x + 0.6), Inches(18.3), Inches(14.5), Inches(6.0)
    set_text(sh, lines, DARK)

# 9·10 테마 (11/09 보별: 흰 양식이 의무가 아니면 우리 어두운 포맷이 낫다). THEME=white 로 흰 양식 유지
import os
from pptx.enum.shapes import MSO_SHAPE_TYPE
THEME = os.environ.get('THEME', 'dark')
def runs_of(sh):
    for pp in sh.text_frame.paragraphs:
        for r in pp.runs: yield r
def placeholder03(slide, color):
    el = copy.deepcopy(tmpl._element); slide.shapes._spTree.append(el)
    sh = slide.shapes[-1]; sh.left, sh.top, sh.width, sh.height = Inches(36.0), Inches(15.2), Inches(14.3), Inches(2.0)
    set_text(sh, ['연구실 작성 예정'], color)
    from pptx.enum.text import PP_ALIGN
    for pp in sh.text_frame.paragraphs: pp.alignment = PP_ALIGN.CENTER
placeholder03(s10, '6B645C' if THEME == 'dark' else 'B0B0B0')
if THEME == 'dark':
    BG, BODY, HEAD, ACC, SUB, LINE = '15120F', 'D9D2C8', 'F2ECE4', 'F0A24A', '8C857C', '4A443D'
    for slide in (s9, s10):
        slide.background.fill.solid(); slide.background.fill.fore_color.rgb = RGBColor.from_string(BG)
        for sh in slide.shapes:
            if sh.shape_type == MSO_SHAPE_TYPE.AUTO_SHAPE:
                if sh.fill.type == 1: sh.fill.fore_color.rgb = RGBColor.from_string('2A2622')
                try:
                    if sh.line.fill.type == 1: sh.line.color.rgb = RGBColor.from_string(LINE)
                except Exception: pass
            if not sh.has_text_frame or not sh.text_frame.text.strip(): continue
            t = sh.text_frame.text.strip()
            if t.startswith('2026 KAIST'): c = SUB
            elif t.startswith('MineD: Your'): c = 'E8962E'
            elif t in ('콘텐츠 개발', '기술 개발') or t in ('01', '02', '03') or t.startswith('HERIZON'): c = HEAD
            elif t in ('캐릭터', '세계와 소리', '시나리오', '지층·광석 판정', '시스템 구조'): c = ACC
            elif t in ('Social Computing Lab', '연구실 작성 예정'): c = '6B645C'
            else: c = BODY
            for r in runs_of(sh): r.font.color.rgb = RGBColor.from_string(c)

# 크레딧 12·20 (HERIZON × SCL): 11/09 보별 결정 = 팀원 개인 이름은 넣지 않음, 협업 = 이원재 교수 연구실 이서연
# 크레딧 이름·역할: layout/credit_names.txt 한 줄에 한 명(이 파일만 고치고 render.sh 다시 돌리면 됨)
_cn = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'credit_names.txt')
NAMES = [l.rstrip() for l in open(_cn, encoding='utf-8') if l.strip()]
CREDIT = os.environ.get('CREDIT', 'team')  # team=HERIZON만(11/10 보별 확정) / names=이름·역할(credit_names.txt)
from pptx.enum.text import PP_ALIGN
def credit_cols(slide):
    """이름(오른쪽 정렬) | 역할(왼쪽 정렬, 가는 글씨) 두 칸. 줄 높이가 같게 글자 크기는 같게 둔다."""
    box = find(slide, '이서연')
    rows = [l.rstrip('\n').split('\t') for l in NAMES]
    cx = box.left + box.width // 2          # HERIZON 칸 가운데
    el = copy.deepcopy(box._element); slide.shapes._spTree.append(el); rb = slide.shapes[-1]
    # 이름(약 2.9in) + 사이 0.7in + 가장 긴 역할(약 6.3in) 묶음을 HERIZON 아래 가운데에
    nr = cx - Inches(2.05)
    box.left, box.width = nr - Inches(6.0), Inches(6.0)
    rb.left, rb.width = nr + Inches(0.7), Inches(8.0)
    rb.top, rb.height = box.top, box.height
    set_text(box, [r[0] for r in rows])
    set_text(rb, [r[1] if len(r) > 1 else '' for r in rows], 'C9C1B6')
    for pp in box.text_frame.paragraphs: pp.alignment = PP_ALIGN.RIGHT
    for pp in rb.text_frame.paragraphs:
        pp.alignment = PP_ALIGN.LEFT
        for r in pp.runs: r.font.name = 'Helvetica Neue Light'
for n in (12, 20):
    if CREDIT == 'names': credit_cols(S(n))
    else: kill(S(n), '이서연')
    set_text(find(S(n), '이원재'), ['이원재 교수 연구실', '이서연'])
for n in (13, 21):  # 팀 단독 장(쓰지 않음)
    if CREDIT == 'names': credit_cols(S(n))
    else: kill(S(n), '이서연')
from pptx.oxml.ns import qn
def ea(sh, face):
    for pp in sh.text_frame.paragraphs:
        for r in pp.runs:
            rPr = r._r.get_or_add_rPr()
            for tag in ('a:latin', 'a:ea'):
                el = rPr.find(qn(tag))
                if el is None:
                    el = rPr.makeelement(qn(tag), {}); rPr.append(el)
                el.set('typeface', face)
HEADS = ('콘텐츠 시나리오', '구현 기술', '콘텐츠 개발', '기술 개발', '개발팀', '캐릭터', '세계와 소리', '시나리오', '지층·광석 판정', '시스템 구조')
for slide in p.slides:
    for sh in slide.shapes:
        if not sh.has_text_frame: continue
        t = sh.text_frame.text.strip()
        if t in HEADS:
            ea(sh, 'MaruBuri')
            for pp in sh.text_frame.paragraphs:
                for r in pp.runs: r.font.bold = True
        elif t.startswith('“묻힌'): ea(sh, 'MaruBuri')
p.save(OUT)
