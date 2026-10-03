"""필터 시험셋용 가상 이미지 생성(OpenRouter). 등장 인물은 모두 AI 가 만든 가상 인물이다.
키는 환경변수 OPENROUTER_API_KEY 에서만 읽고 파일·로그에 남기지 않는다."""
import base64, json, os, sys, urllib.request, concurrent.futures as cf, pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'testset' / 'raw'
MODEL = 'google/gemini-3.1-flash-image-preview'
STYLE = 'Photorealistic casual smartphone photo, natural lighting, no text overlay, no watermark. '
JOBS = {
  # 얼굴(숨겨야 함)
  'ai_selfie':        ('3:4', STYLE + 'A close-up selfie of a Korean woman in her 30s smiling at a cafe, face fills about a third of the frame.'),
  'ai_group_dinner':  ('4:3', STYLE + 'Five Korean friends around a restaurant table with Korean BBQ, all facing the camera, medium distance.'),
  'ai_park_far':      ('4:3', STYLE + 'Wide shot of a park lawn with a family of four having a picnic about 15 meters away, small people in the frame, faces visible but tiny.'),
  'ai_profile_sea':   ('4:3', STYLE + 'Side profile of an older Korean man looking at the sea from a pier, face in profile, upper body in frame.'),
  'ai_birthday':      ('4:3', STYLE + 'A child blowing out candles on a birthday cake with two parents smiling behind, indoor warm light.'),
  'ai_hiking_two':    ('3:4', STYLE + 'Two hikers on a Korean mountain trail, one facing the camera and one looking at the view, faces at medium size.'),
  'ai_mirror_selfie': ('3:4', STYLE + 'Mirror selfie of a young man in an elevator holding a phone, phone covers part of his face, eyes and mouth visible.'),
  'ai_concert_crowd': ('16:9', STYLE + 'Crowd at an outdoor concert from behind the stage, many small faces of the audience visible.'),
  # 글자(숨겨야 함)
  'ai_doc_desk':      ('4:3', 'Photorealistic smartphone photo of a printed A4 document in Korean on a wooden desk, dense paragraphs of Korean text and a table, shot slightly from above, the whole page fills most of the frame.'),
  'ai_receipt':       ('3:4', 'Photorealistic smartphone photo of a long paper receipt in Korean lying on a cafe table, many itemized lines with prices, fills most of the frame.'),
  'ai_whiteboard':    ('4:3', 'Photorealistic smartphone photo of an office whiteboard covered with handwritten Korean notes, arrows and a diagram, no people.'),
  'ai_laptop_sheet':  ('4:3', 'Photorealistic smartphone photo of a laptop screen showing a spreadsheet full of numbers and Korean column headers, taken at a slight angle.'),
  'ai_notebook':      ('3:4', 'Photorealistic smartphone photo of an open notebook with handwritten Korean diary text filling both pages.'),
  # 보여도 됨
  'ai_mountain':      ('4:3', STYLE + 'Autumn mountain landscape in Korea with colorful trees and a valley, no people.'),
  'ai_bibimbap':      ('1:1', STYLE + 'Overhead shot of bibimbap in a stone bowl with side dishes on a table, no people, no text.'),
  'ai_cat_sofa':      ('4:3', STYLE + 'A gray cat sleeping on a beige sofa, no people.'),
  'ai_neon_street':   ('4:3', STYLE + 'A Seoul alley at night with a few colorful neon shop signs in the distance, wet pavement, no people close to the camera.'),
  'ai_beach_sunset':  ('16:9', STYLE + 'Sunset over a quiet beach with waves, no people.'),
  'ai_flowers':       ('1:1', STYLE + 'Close-up of pink cosmos flowers in a field, shallow depth of field.'),
  'ai_bookshelf':     ('3:4', STYLE + 'A home bookshelf with rows of books, spines visible from a few meters away, plants on top.'),
  'ai_skyline':       ('16:9', STYLE + 'Seoul city skyline at dusk seen from a hill, no people.'),
  'ai_latte':         ('1:1', STYLE + 'A latte with heart latte art on a wooden table, top-down, no text.'),
  'ai_dog_park':      ('4:3', STYLE + 'A golden retriever running on grass in a park, no people.'),
  'ai_backs':         ('4:3', STYLE + 'Two people walking away on a forest path seen from behind, backs only, no faces visible.'),
}

def call(name, ratio, prompt):
    dest = OUT / f'{name}.png'
    if dest.exists():
        return name, 'skip'
    body = json.dumps({'model': MODEL, 'modalities': ['image', 'text'],
                       'messages': [{'role': 'user', 'content': prompt}],
                       'image_config': {'aspect_ratio': ratio, 'image_size': '1K'}}).encode()
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=body,
                                 headers={'Content-Type': 'application/json',
                                          'Authorization': 'Bearer ' + os.environ['OPENROUTER_API_KEY']})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                j = json.load(r)
            url = j['choices'][0]['message']['images'][0]['image_url']['url']
            dest.write_bytes(base64.b64decode(url.split(',', 1)[1]))
            return name, 'ok'
        except Exception as e:  # 재시도
            err = type(e).__name__
    return name, 'fail ' + err

if __name__ == '__main__':
    names = sys.argv[1:] or list(JOBS)
    with cf.ThreadPoolExecutor(8) as ex:
        for name, st in ex.map(lambda n: call(n, *JOBS[n]), names):
            print(name, st, flush=True)
