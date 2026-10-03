# -*- coding: utf-8 -*-
"""공유용 샘플 데이터 생성기 — 실제 기록을 쓰지 않습니다.
구조만 같고 내용은 전부 지어낸 것입니다. 씨드 고정이라 항상 같은 결과가 나옵니다.
  python3 gen_sample.py  →  sample_data.json
앱(MineD_blank.html)에 이 파일을 끌어다 놓으면 됩니다."""
import json, random, datetime as dt
random.seed(20260822)

FAM = {'걸음수':'health','수면 시간':'health','메모 작성 수':'memo','메모 길이':'memo',
       '메모 심야 작성 비율':'memo','사진 촬영 수':'photo','심야 촬영 비율':'photo',
       '유튜브 심야 비율':'yt','유튜브 검색량':'yt','일정 개수':'cal'}
LABELS = list(FAM)
PHRASE = {
 '걸음수':('걸음수가 평소보다 적었습니다','걸음수가 평소보다 많았습니다'),
 '수면 시간':('잠이 평소보다 짧았습니다','잠이 평소보다 길었습니다'),
 '메모 작성 수':('메모를 평소보다 적게 남겼습니다','메모를 평소보다 많이 남겼습니다'),
 '메모 길이':('메모가 평소보다 짧았습니다','메모가 평소보다 길었습니다'),
 '메모 심야 작성 비율':('새벽에 쓴 메모가 평소보다 적었습니다','새벽에 쓴 메모가 평소보다 많았습니다'),
 '사진 촬영 수':('사진을 평소보다 적게 남겼습니다','사진을 평소보다 많이 남겼습니다'),
 '심야 촬영 비율':('새벽에 찍은 사진이 평소보다 적었습니다','새벽에 찍은 사진이 평소보다 많았습니다'),
 '유튜브 심야 비율':('새벽에 본 영상이 평소보다 적었습니다','새벽에 본 영상이 평소보다 많았습니다'),
 '유튜브 검색량':('검색이 평소보다 적었습니다','검색이 평소보다 많았습니다'),
 '일정 개수':('일정이 평소보다 적었습니다','일정이 평소보다 많았습니다')}

# 전부 지어낸 메모입니다. 실제 기록이 아닙니다. (오타는 의도적입니다 — 원문을 고치지 않는다는 원칙을 보여주려고)
NOTES = [
 "비 오는 날 지하철 창에 맺힌 물방울이 위로 올라가는 것처럼 보였다 속도 때문일까",
 "단편 아이디어. 매일 같은 시간에 같은 자리에 앉는 사람. 어느 날 그 자리에 다른 사람이 앉는다",
 "된장찌개에 두부를 넣는 순서를 계속 잊는다 다음엔 마지막에",
 "발표 구성 1 문제 2 왜 아무도 안 했나 3 우리가 한 것 4 남은 것. 4번을 먼저 말해도 되나",
 "고양이는 창밖을 볼 때 눈을 거의 안 움직인다 목만 돌린다",
 "새벽 세시. 아무 소리도 안 나는데 냉장고 소리만 크게 들린다",
 "제목 후보 — 오래된 빛 / 다시 쓰는 계절 / 그 방의 온도",
 "지난주에 산 화분 잎이 한쪽으로만 자란다 화분을 돌려줘야 한다는데 매번 잊는다",
 "회의 메모. 결정 안 된 것만 적어두기로 함. 결정된 건 어차피 기억함",
 "버스에서 앞자리 사람이 계속 같은 페이지를 보고 있었다 삼십 분 동안",
 "라디오에서 우표 모으는 얘기를 들었다 색이 바래는 게 핵심이라고 했다",
 "국수 삶는 물에 소금 넣는 걸 또 잊었다 세 번째다",
 "낮잠을 자면 그날 저녁이 두 번 오는 것 같다",
 "습작. 그는 문을 닫지 않고 나갔다 그게 대답이었다",
 "산책길에 늘 있던 자전거가 없어졌다 삼 년쯤 세워져 있던 것",
 "책 정리하다 접힌 페이지를 발견했다 내가 접은 기억이 없다",
 "이번 달 목표 세 개만 적기 세 개 이상은 못 지킴",
 "지도 앱이 안내한 길로 갔는데 처음 보는 골목이 나왔다 십 년 살았는데",
 "커피를 줄이려고 했는데 잔을 줄이니까 횟수가 늘었다",
 "친구가 이사 간 동네 이름을 계속 다르게 기억한다",
 "빨래를 개면서 드라마를 보면 둘 다 기억이 안 남는다",
 "구상 중. 광산 안에 도서관이 있고 책이 광석으로 되어 있다",
 "밤에 창문 열면 멀리서 개 짖는 소리가 항상 같은 방향에서 온다",
 "체리 씨를 세어봤다 열두 개 왜 세었는지는 모르겠다",
 "새 노트를 사면 첫 장을 잘 못 쓴다 두 번째 장부터 편해진다",
 "우산을 두고 왔다 비는 안 왔다 그래도 아까웠다",
 "메모 앱을 정리하다 삼년 전 메모를 읽었다 누가 쓴 건지 모르겠는 문장이 있었다",
 "달리기 이십 분. 처음 오 분이 항상 제일 길다",
 "시장에서 파는 김밥이 왜 더 맛있는지 계속 생각했다 아마 크기",
 "영화 보다가 배경에 지나가는 사람만 봤다 그게 더 재미있었다",
 "아이디어. 소리로만 길을 찾는 게임. 눈을 감아도 되는",
 "일요일 오후 네시가 일주일 중에 제일 조용하다",
 "전화번호를 외우던 시절이 있었다는 게 이상하게 느껴진다",
 "화분에 물을 너무 많이 줬다 며칠 두고 봐야 한다고 함",
 "글 쓰다가 지운 문장이 남긴 문장보다 좋았던 것 같은데 기억이 안 난다",
 "장 보러 가서 계획한 것만 사는 데 성공했다 기록해둔다",
 "오래된 사진첩을 넘기다 배경에 있는 물건들만 봤다 사람보다 그게 기억을 부른다",
 "잠들기 전에 하는 생각을 아침에 다시 하면 대체로 별로다",
 "지하철 환승 통로에서 부는 바람은 계절이 없는 것 같다",
 "습작 이어서. 그녀는 창을 닫고 다시 앉았다 그게 대답이었다",
 "라면에 계란을 언제 넣어야 하는지는 아직 결론이 안 났다",
 "새 신발을 신으면 걷는 길이 달라 보인다 같은 길인데",
 "이번 주에 읽은 것 중 남은 문장은 하나뿐이다 그것도 반쪽만",
 "이사 온 지 이 년인데 아직 우편함 번호를 헷갈린다",
 "밤에 쓴 글은 아침에 읽으면 낯설다 그래도 안 지우기로 했다"]

iso = lambda d: (lambda y,w,_: f"{y}-W{w:02d}")(*d.isocalendar())
mon = lambda d: d - dt.timedelta(days=d.weekday())
PER_YEAR = {2012:7,2013:4,2014:2,2015:5,2016:5,2017:6,2018:9,2019:5,
            2020:8,2021:2,2022:12,2023:4,2024:6,2025:4,2026:1}
pct = lambda strong: "직전 1년 중 가장 두드러진 주" if strong else \
      f"상위 {random.choice([2,3,4,5,6,7,8,9,10,11,12,14,15,17,18])}%"

weeks, used = [], set()
for year, n in PER_YEAR.items():
    for _ in range(n):
        for _t in range(60):
            d = mon(dt.date(year, random.randint(1,12), random.randint(1,28)))
            if iso(d) not in used and d.year == year: used.add(iso(d)); break
        else: continue
        labs = random.sample(LABELS, random.choice([1,2,2,3,3,3,4,4]))
        si = 0 if random.random() < 0.22 else -1
        badges = [{"label":l,"pct":pct(i==si)} for i,l in enumerate(labs)]
        cross = len({FAM[l] for l in labs}) >= 2
        segs = [f"{PHRASE[l][1 if random.random()<0.45 else 0]} ({badges[i]['pct']})"
                for i,l in enumerate(labs[:2])]
        body = " 그리고 ".join(segs) + "."
        r = random.random()
        if r < 0.29: tier, tail = "recovered", f" 그리고 약 {random.choice([4,5,6,7,9])}주 뒤부터 평소의 흐름이 이어졌습니다."
        elif r < 0.48: tier, tail = "passed", " 그 뒤로 평소의 흐름이 충분히 오래 이어졌는지는 확인되지 않았습니다."
        else: tier, tail = "observed", ""
        ext = any(b["pct"].startswith("직전") or (b["pct"].startswith("상위 ") and int(b["pct"][3:-1])<=5) for b in badges)
        if ext and tier=="recovered": tier, tail = "observed", ""   # v6: 두드러진 주엔 회복 서사를 붙이지 않습니다
        sc = sum(2 if b["pct"].startswith("직전") else (1 if b["pct"].startswith("상위 ") and int(b["pct"][3:-1])<=5 else 0) for b in badges)
        relic = None
        if random.random() < 0.62:
            relic = {"q":[{"t":random.choice(NOTES), "d":str(d+dt.timedelta(days=random.randint(0,6))),
                           "h":random.choice([0,1,7,9,11,13,15,18,20,21,22,23]),
                           "mi":random.randint(0,59), "n":0, "len":0}
                          for _ in range(random.choice([1,2,2,3]))]}
        weeks.append({"week":iso(d),"date_start":str(d),"date_end":str(d+dt.timedelta(days=6)),
                      "tier":tier,"sentence":f"{d.year}년 {d.month}월 {d.day}일부터 한 주간, "+body+tail,
                      "cross_validated":cross,"badges":badges,
                      "mineral":random.choice(["흑요석","자수정","청금석","호박"]),
                      "shape":random.choice(["angular","round","diamond"]),
                      "relic":relic,"access":"confirm" if sc>=2 else "auto"})

weeks.sort(key=lambda w: w["date_start"])
json.dump({"weeks":weeks,"principles":"v6","sample":True,
           "notice":"공유용 샘플 데이터입니다. 실제 개인 기록이 아니며 전부 생성된 값입니다."},
          open('sample_data.json','w',encoding='utf-8'), ensure_ascii=False)
from collections import Counter
print("주",len(weeks),"| tier",dict(Counter(w['tier'] for w in weeks)),
      "| 교차검증",sum(1 for w in weeks if w['cross_validated']),
      "| 원문",sum(1 for w in weeks if w['relic']))
