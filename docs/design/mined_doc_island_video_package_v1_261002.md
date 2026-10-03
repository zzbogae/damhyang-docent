# Mine D — 「나의 섬」 데모 영상 제작 패키지 (v1)

**2026.10.02** · 팀 HERIZON · 김보경
**용도** — 섬 1인칭 체험 데모 영상 (Google Flow 생성 → 편집 툴에서 음악·사운드 합성)
**레퍼런스** — 드림코어 브이로그(01_기획_세계관), 무드 분석 `261002_MineD_나만의공간_무드레퍼런스_분석_v1.md`

---

## 0. 한눈에

해변에서 맥주 한 잔 → 섬 둘러보기 → 맨발로 나무다리 → **수상 방갈로**(바다 위 나무 집) 안 → 뒷문 데크의 작은 요트 → 비치가운 벗고 다이빙 → 수중 유영(고래상어·환도상어·복어) → 수면 위로 일렁이는 하늘.

- 총 10컷 × 8초 ≈ **80초** (Extend로 컷마다 늘리면 2분 이상 가능)
- 톤: **현실과 애니의 경계, 살짝 현실 쪽** — 거대한 뭉게구름, 선명한 하늘, 디테일한 주변 환경, 몽환적 빛
- 음악: **영상 처음부터 끝까지 한 곡이 끊기지 않고**, 물속에 들어가는 순간 **물속에서 듣는 소리로 바뀜**

---

## 1. 스타일 고정 문장 (모든 프롬프트 맨 앞에 붙이기)

컷마다 톤이 흔들리지 않게, 아래 문장을 **매번 그대로** 맨 앞에 붙입니다.

```
Semi-realistic cinematic fantasy, on the border between photoreal and anime but leaning toward realism, towering sculpted cumulus clouds, luminous saturated blue sky, crystal-clear turquoise water, highly detailed environment, soft bloom and gentle light rays, dreamy and serene, first-person POV, smooth slow camera,
```

**금지(끝에 붙이기):** `no text, no watermark, no other people, no faces`

---

## 2. 먼저 만들 키 이미지 4장 (Nano Banana Pro)

영상보다 **이미지를 먼저** 만들고, 이 이미지를 Flow의 Ingredients(참조 이미지)로 넣어야 방갈로·바다·하늘이 컷마다 똑같이 나옵니다.

| # | 내용 | 프롬프트 (스타일 고정 문장 뒤에) |
|---|---|---|
| K1 | 해변에서 본 섬 | `wide view from a white sand beach of a small tropical island, palm trees, shallow turquoise lagoon, a slender wooden boardwalk leading to a single overwater bungalow with a thatched roof, a small white sailboat tied to its pilings, enormous cumulus clouds, late afternoon golden light` |
| K2 | 수상 방갈로 외관 + 다리 | `close view of a cozy overwater bungalow on wooden stilts, weathered wooden boardwalk with gaps showing sparkling water below, thatched roof, warm lanterns, enormous clouds behind` |
| K3 | 방갈로 내부 | `interior of a small overwater bungalow, simple bed with white linen, rattan lounge chair, a bucket of iced drinks, seashell mobile, warm lantern, a few books, small plants, a softly glowing amber crystal on a shelf, sheer curtains moving in the breeze, glass floor panel showing the sea below, window view of the ocean and clouds` |
| K4 | 수중 | `deep clear blue underwater scene, light rays from the surface, a gentle whale shark, coral reef, a small pufferfish, rising bubbles, dreamy` |

> K3의 「은은하게 빛나는 호박색 광석」은 Mine D 연결 장치입니다 — 내 광석이 섬의 소품이 된 것.

---

## 3. 컷 리스트 (Veo 3.1, 각 8초)

**만드는 법:** 각 컷 = 스타일 고정 문장 + 아래 프롬프트 + 금지 문장. Ingredients에 해당 키 이미지를 넣거나, Frames to Video로 시작·끝 이미지를 지정.
**소리:** 프롬프트 끝에 `natural ambient sound only, no music` — 음악은 편집에서 한 곡으로 깝니다(§4).

| 컷 | 장면 | 프롬프트 | 키 이미지 |
|---|---|---|---|
| 1 | 해변, 맥주 한 잔 | `I am lounging on a beach chair, my bare feet in the sand at the bottom of frame, my hand raises a cold glass of beer with condensation toward the sea, gentle waves, the overwater bungalow far away on the lagoon` | K1 |
| 2 | 섬 둘러보기 | `I stand up and slowly look around the island: swaying palm trees, white sand, clear shallow water, then the camera settles on the wooden boardwalk leading to the bungalow` | K1 |
| 3 | 맨발로 나무다리 | `walking barefoot along a narrow wooden boardwalk over the sea, my feet visible stepping on sun-warmed planks, glittering water between the gaps, small fish below, the bungalow getting closer` | K2 |
| 4 | 방갈로로 들어감 | `my hand pushes open a wooden door of the bungalow and I step inside into a cozy cool room` | K2 → K3 |
| 5 | 방 안 둘러보기 | `slowly looking around the cozy bungalow interior: the simple bed, rattan chair, iced drinks, seashell mobile, a softly glowing amber crystal on the shelf, curtains moving in the sea breeze` | K3 |
| 6 | 뒷문 데크와 요트 | `I open the back door onto a wooden deck over open water, a small white sailboat tied to the bungalow's wooden pilings gently bobbing, endless ocean and towering clouds` | K2 |
| 7 | 비치가운 벗기 | `standing at the edge of the deck, my hands untie a light linen beach robe and let it fall onto the deck, wearing swimwear underneath, looking down into the clear deep blue water` | K2 |
| 8 | 다이빙 | `I dive off the deck into the ocean, the view plunges through the sparkling surface with a splash, transitioning from bright sky to soft blue underwater light and bubbles` | K2 → K4 |
| 9 | 고래상어 | `first-person scuba-free dive, my hands gently sweeping forward, gliding through deep clear blue water as a giant whale shark swims calmly past, sun rays from above` | K4 |
| 10 | 환도상어·복어 → 수면 | `a thresher shark in the distance, a small pufferfish near the coral, then I look up toward the surface where the sky and clouds shimmer through the rippling water, light dancing, peaceful ending` | K4 |

**더 길게:** 마음에 드는 컷은 Flow의 **Extend**로 이어 붙이면 같은 장면이 자연스럽게 늘어납니다. 특히 1(해변)·5(방 안)·9(수중)를 늘리면 「머무는」 느낌이 좋아집니다.

---

## 4. 음악·사운드 — 편집 툴에서 합성

Veo가 컷마다 따로 소리를 만들기 때문에, **음악은 영상에서 만들지 않고 편집에서 한 곡을 처음부터 끝까지 깝니다.** 그래야 끊기지 않습니다.

### 4-1. 음악 한 곡 만들기
AI 음악 생성 도구(수업 8회차 음악·소리 생성 참고 — 예: Google MusicFX/Lyria, Suno 등)에 아래를 넣고 **영상 길이보다 길게** 뽑습니다.

```
Dreamy ambient instrumental, 72 BPM, soft piano and warm synth pads, gentle acoustic guitar and kalimba, light ocean-breeze texture, hopeful and floating, feels like drifting through a beautiful dream, no vocals, smooth build in the middle and a calm airy ending, 2 minutes
```

※ 전시·발표에 쓰려면 해당 도구의 이용약관(상업·공개 사용 허용 여부)을 꼭 확인하세요.

### 4-2. 물속으로 들어가는 순간 소리 바꾸기
컷 8(다이빙)에서 물에 닿는 순간부터:
1. 음악 트랙에 **로우패스 필터(고음 깎기)** 적용 → 소리가 먹먹하게, 물속에서 듣는 느낌
   - 무료 DaVinci Resolve: Fairlight의 EQ에서 로우패스, 대략 500~800Hz부터 시작해 귀로 조절
   - CapCut·Premiere도 로우패스/EQ 효과로 같은 처리 가능
2. 같은 지점에 **리버브(울림)** 살짝 추가
3. 첨벙 소리 직후 **물방울·버블·낮은 웅웅거림** 효과음 레이어 추가
4. 필터는 0.5초 정도에 걸쳐 서서히 걸리게(키프레임) — 뚝 바뀌면 어색함
5. 마지막 컷 10에서 수면을 올려다볼 때 필터를 살짝 풀면 「떠오르는」 느낌

### 4-3. 효과음 레이어 (낮은 볼륨으로)
파도·바람(1~2) / 맨발로 나무 밟는 소리·삐걱임(3) / 문 여닫는 소리(4·6) / 얼음 잔 소리(1·5) / 요트 로프·물결(6) / 천이 떨어지는 소리(7) / 첨벙(8) / 버블(9~10)
Veo가 만든 자연 소리(`natural ambient sound only`)를 그대로 낮게 깔아 써도 됩니다.

### 4-4. 편집 순서
1. 10컷을 순서대로 놓기 → 컷 사이는 0.5~1초 크로스페이드(꿈같이 흐르는 느낌)
2. 색 맞추기: 컷마다 밝기·채도가 다르면 한 컷 기준으로 맞춤
3. 음악 한 곡 깔기 → 컷 8에서 수중 처리
4. 효과음 레이어
5. 첫 0.5초 페이드인, 마지막 2초 페이드아웃
6. 1080p 이상 내보내기

---

## 5. 크레딧과 시간 현실

- Veo Quality는 컷당 약 100크레딧, Fast 20, Lite 10 (출처마다 다를 수 있음)
- 무료 하루 50크레딧이면 Fast 2컷/일 → 10컷 전부 Quality는 무료로는 어려움
- **내일(10/3) 발표용:** 컷 1(해변 맥주)·8(다이빙)·9(고래상어) 3컷만 Fast로 → 약 24초 짧은 버전
- **전시용 풀버전:** Flow Pro 한 달(월 1,000크레딧)이면 10컷 Quality 가능

---

## 6. 결과물 저장

- 파일명: `261002_MineD_섬데모_컷01_v1.mp4` … / 최종본 `261002_MineD_섬데모_full_v1.mp4`
- 저장: `03_에셋_디자인`
- 원문 개인 데이터는 어떤 생성 도구에도 넣지 않음 — 이 프롬프트는 전부 장면 묘사뿐

---
*팀 HERIZON · 담향루 스튜디오*
