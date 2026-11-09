# Mine D 쇼케이스 출품 영상 v0.5 키트

v0.4.1에서 바뀐 점 (보별 11/06 피드백)
- 민디가 굴에서 걸어 나오는 장면 = 홈페이지 관측소 첫 방문 화면을 실제로 녹화(`rec/walk.mp4`)
- 지층 = 맨 위 최근 12주는 한 주 한 층, 그 아래는 해마다 한 층 / 광석 = 검은 돌, 깨면 결 색 고리. 시연판 39f87f0(합성 샘플 2026-11-08까지)에서 2026년 10월 3주 형석을 캐는 장면(`rec/mine3.mp4`)
- 멘토 방식처럼 「넣은 기록(화면 속 화면) → 광석의 결」을 한 화면에
- 민디와 이야기(챗봇), 나의 섬 고르기(시간 → 날씨·계절 → 장소 → 시대 → 머물 곳 → 소리) 실제 화면 추가
- 민디 외계어 목소리는 낮게 깔고, 「오늘도 한 층 쌓였습니다」만 또렷하게. 자막 글씨는 v0.4 크기
- 음악은 처음부터 끝까지 한 줄로 깔고 구간마다 음량만 바꿈(끊김 없음)

## 흐름 (약 2:40)
제목 5 · 기술 9 · 이야기 19.8 · 다리 3.2 · 작동 화면 57.7(지층 → 광석 → 챗봇 → 섬 고르기) · 나의 섬 35.6 · 여운 13.7 · 크레딧 7 · 검정 1

## 실행 (맥, v0.3_kit · v0.4_kit 옆)
```
cd showcase/v0.5_kit
python3 build5.py --sea <바다> --sky <하늘산> --jungle <정글> --music <음악방> --out <출력.mp4>
```
- `../v0.3_kit/gen/K01.mp4`, `../v0.3_kit/assets`, `../v0.3_kit/myspace.json`, `../v0.4_kit/comp`, `../v0.4_kit/sfx` 를 함께 씁니다.
- `rec/*.mp4` 는 시연판(합성 샘플)을 4K로 녹화한 화면입니다. 실제 개인 기록은 없습니다.
- `FAST=1` 이면 960×540 시험판. 최종 음량 -16 LUFS, 트루 피크 -1.5 dB.

## 제출 묶음 3편 (11/10 공식 레이아웃)
`layout/pages/slide-NN.png` = 공식 「영상콘텐츠 레이아웃」에 글·스크린샷을 채운 4K 장(`layout/render.sh 원본.pptx layout/img 출력폴더`로 다시 만듦).
```
P=layout/pages
# 1 메인 디스플레이: 제목·소개 장 + 1분 축약
python3 build5.py --cut main --pre $P/slide-02.png,$P/slide-03.png --page-sec 6 --sea … --sky … --jungle … --music … --out MineD메인.mp4
# 2 서브 디스플레이: 제목·시나리오·구현기술·콘텐츠개발·기술개발 → 풀 영상 2분 → 크레딧
python3 build5.py --cut sub --pre $P/slide-06.png,$P/slide-07.png,$P/slide-08.png,$P/slide-09.png,$P/slide-10.png --post $P/slide-12.png --page-sec 7 … --out MineD서브.mp4
# 3 심포지엄: 제목·시나리오·구현기술 → 풀 영상 2분 → 크레딧
python3 build5.py --cut sub --pre $P/slide-16.png,$P/slide-17.png,$P/slide-18.png --post $P/slide-20.png --page-sec 7 … --out MineD심포지엄.mp4
```
