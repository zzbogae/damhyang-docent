"""발표 데모용 유물 순서 고정.
앱은 relic.q[0]을 보여준다. 문장다움 점수로 뽑힌 순서가 발표에서 늘 최선은 아니어서,
데모 3개 주에 한해 '먼저 보여줄 글'을 지정한다. 글 자체를 고치거나 지어내지 않는다.
지정 기준: 그 주에 실제로 남긴 글 중, 관객이 맥락 없이 읽어도 오해하지 않을 것."""
import json, sys

PIN = {
    '2018-W36': '어릴깨 엄마가 불러주던 자장가',   # 21:30에 쓴 글 — 데모에서 먼저 보여줌
}

p = sys.argv[1] if len(sys.argv) > 1 else 'gyeol_data.json'
d = json.load(open(p, encoding='utf-8'))
n = 0
for w in d['weeks']:
    key = PIN.get(w['week'])
    if not key: continue
    q = (w.get('relic') or {}).get('q') or []
    i = next((j for j, it in enumerate(q) if key in it.get('t', '')), None)
    if i is None:
        print('  ! 못 찾음:', w['week']); continue
    q.insert(0, q.pop(i)); n += 1
    print('  고정:', w['week'], '→', q[0]['t'][:40])
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'{n}개 주 순서 고정 완료')
