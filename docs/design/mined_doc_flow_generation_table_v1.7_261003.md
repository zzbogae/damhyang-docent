# Mine D — Flow 반자동 생성 실행표 v1

**작성일:** 2026-10-02  
**범위:** 섬 데모 영상 10컷 최초 생성만  
**금지:** Quality 모델, 결제/플랜 변경, 자동 재생성, 다른 제공자 전환, 음악 삽입

## 0. 생성 전 숫자 게이트

Flow 프로젝트 화면에서 아래 네 숫자를 먼저 기록한다.

- 현재 잔여 크레딧: `____`
- 선택 모델과 컷당 비용: `Veo ____ / ____ 크레딧`
- 10컷 총 예상 비용: `컷당 비용 × 10 = ____`
- 생성 후 예상 잔액: `현재 잔액 - 총 예상 비용 = ____`

**실행 상한:** 영상 10건, 컷당 최초 생성 1회, 재생성 0회.  
이미 QUEUED/RUNNING 작업이 하나라도 있으면 중복 제출하지 않고 멈춘다.

## 1. 프로젝트와 참조 이미지

- 프로젝트 이름: `261002_MineD_섬데모_FLOW_v1`
- 화면비: 16:9
- 길이: 컷당 8초
- 모델: 화면에 표시된 Fast 또는 Lite만
- 오디오: 자연환경음만, 음악 없음

참조 이미지:

- K1: `261002_MineD_섬데모_K1_v1.png`
- K2: `261002_MineD_섬데모_K2_v1.png`
- K3: `261002_MineD_섬데모_K3_v1.png`
- K4: `261002_MineD_섬데모_K4_v1.png`

**2026-10-03 스타일 판정:** 위 v1 키 이미지는 지리·구조 참조로만 보존한다. 채도와 광택이 강하고 리조트 광고처럼 완벽해 현재 취지에는 `HOLD_STYLE`이다. 이 이미지를 강한 스타일 참조로 넣어 영상을 제출하지 않는다. 생활감 있는 v2 키 이미지가 확정되기 전에는 영상 생성도 HOLD한다.

## 이 영상을 만드는 이유 — 정본 확인

이 영상은 아름다운 휴양지를 홍보하는 결과물이 아니다. Mine D에서 **사용자가 자기 기록에서 꺼낸 단어를 보고, 민디와 대화하며 스스로 말한 바람이, AI를 거쳐 직접 들어가 살아볼 수 있는 1인칭 개인 공간이 되는 것**을 증명하는 사전 제작 데모다.

- 민디는 기록의 사실과 단어를 펼칠 뿐, 사용자가 원하는 세계를 대신 결론내리지 않는다.
- 사용자가 `바다`, `다이빙`, `천천히 유영`, `고래상어와 복어`라고 말했기 때문에 이 섬이 열린다.
- 생성 도구로 나가는 것은 사용자가 고른 단어와 장면 묘사뿐이며 원문 기록은 나가지 않는다.
- 관객이 봐야 하는 것은 `멋진 섬`보다 `내가 말한 공간 안에서 내 몸으로 마시고, 걷고, 문을 열고, 다이빙하고, 생물과 교감하는 경험`이다.
- 공간은 새 리조트가 아니라 기억과 시간이 조금씩 쌓인 **낡고 다정한 개인 공간**이어야 한다.

## 공통 스타일 문장

모든 프롬프트 첫 문장:

`Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered wood with salt stains and small repairs, frayed rope, uneven paint, modest personal objects and signs of daily use, gentle film grain, quiet intimate first-person embodied POV, physically plausible human-height camera, restrained natural motion.`

모든 프롬프트 마지막 문장:

`Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.`

---

## 전체 연출 원칙 — 구경이 아니라 직접 체험

두 드림코어 Vlog의 핵심은 풍경을 보여주는 카메라가 아니라 **그 공간에서 몸이 실제 행동하는 1인칭 체험**이다. 손·발은 장식이 아니라 접촉과 감각의 증거다.

**주인공 정체성 잠금:** 이 섬을 체험하는 주인공은 처음부터 끝까지 동일한 **성인 여성 1명**이다. 얼굴은 보여주지 않되, 매 컷에 등장하는 손·팔·다리·체형과 물속 웃음소리는 같은 여성으로 일관되어야 한다. 자연스러운 맨손과 맨발, 짧고 꾸밈없는 손톱, 장신구 없음, 과장된 여성성이나 성적 구도 없음.

- 컷마다 `내 몸의 행동 → 대상과 접촉 → 감각 반응 → 잠깐 머묾`이 보여야 한다.
- 잔을 들면 실제로 마시고, 문은 손잡이를 잡아 열고, 다리는 발바닥이 판자에 닿으며, 물에는 수면 접촉과 저항을 거쳐 들어간다.
- 풍경만 훑는 홍보 영상, 건배 포즈, 드론식 공간 소개, 신체 없는 부유 카메라를 금지한다.
- 손·발·호흡·체중 이동·접촉음으로 `내가 여기 있다`는 느낌을 우선한다.
- 완벽하게 정돈된 럭셔리 리조트, 과도한 HDR, 네온 청록색 바다, 지나치게 쨍한 파랑·오렌지, 광택 나는 새 목재, 광고용 렌즈플레어를 금지한다.
- 나무의 소금 자국, 살짝 벗겨진 페인트, 수선한 로프, 오래 쓴 의자, 반쯤 읽은 책, 물자국 난 유리잔처럼 `누군가 실제로 머물러 온 흔적`을 남긴다.

## 컷 01 — 해변 의자에서 맥주를 실제로 한 모금 마시기

**판정:** 기존 K1은 몸·의자·잔이 없는 풍경 이미지이므로 영상 START로 사용하지 않는다. K1은 섬의 지리와 방갈로 위치만 참고한다. 먼저 아래 전용 START/END 정지 이미지를 만든 뒤 `Frames to Video`로 연결한다.  
**입력 파일:** `261003_MineD_C01_BEER_START_16x9_v2.png` → `261003_MineD_C01_BEER_END_16x9_v2.png`. v1 START/END는 가운데에 제3의 다리/발이 생긴 해부학 오류로 `HOLD_ANATOMY`; Flow에 업로드하지 않는다.  
**단일 목적:** 여성 주인공의 몸 안에서 차가운 맥주 한 모금을 실제로 마시고 삼키는 감각을 체험한다.  
**주동작:** 잔을 드는 동작이 아니라 `입술 접촉 상태 → 잔 기울기와 액체 이동 → 한 번 삼킴 → 잔 내림`이다.  
**길이:** 6초 권장. 한 컷에 다른 행동을 추가하지 않는다.

### START 정지 이미지 프롬프트 — 반드시 먼저 생성

```text
16:9 cinematic still, exact first-person viewpoint from the eyes of the same adult woman reclining in a modest weathered canvas beach chair on her personal island, her face never visible. The clear cold beer glass is already at her mouth at the very first instant: the near rim visibly touches the lower edge of the camera viewpoint where her lips are, filling much of the lower-center foreground and partially occluding the sea and horizon. Her anatomically correct right hand wraps naturally around the lower half of the glass, short unpolished nails, no jewelry. Golden beer and a thin uneven foam ring are clearly visible through the glass; condensation beads and one water trail catch soft light. Her bare knees and relaxed lower legs remain faintly visible below and to either side of the glass, establishing that the camera is inside her seated body rather than floating in space. The bungalow and boardwalk from K1 remain small, soft background geography only. Natural late-afternoon exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, weathered fabric and wood with salt marks and small repairs, gentle film grain, intimate lived-in dreamcore realism, not a luxury resort. Fixed natural human field of view, approximately 35mm equivalent. No toast, no glass extended toward the scenery, no product-shot composition, no hand merely holding the glass at chest or lap level, no visible face, no extra fingers, no straw, no bottle, no logo, no text, no glossy advertising color, no HDR, no neon-turquoise water.
```

### END 정지 이미지 프롬프트

```text
16:9 cinematic still, exact same adult woman's first-person seated viewpoint, same body, chair, hand, glass, island geography, lighting and 35mm-equivalent field of view as the START image. The completed sip is over. Her right hand has lowered the same cold beer glass naturally to just above her lap in the lower-right foreground; the beer level is slightly lower and the liquid surface is horizontal and settling, with a broken foam trace left higher on the inside wall showing that the glass was just tilted. Her bare legs extend loosely into the sand, toes relaxed after the swallow. The sea and distant bungalow become visible again because the glass no longer blocks the center of view. Quiet ordinary satisfaction, subtle breathing, lived-in personal memory rather than a tourism advertisement. Preserve anatomy and exact object identity. No toast, no raised glass, no product presentation, no visible face, no extra limbs or fingers, no logo, no text, no glossy commercial grading, no HDR, no neon-turquoise water.
```

### Flow `Frames to Video` 입력용 최종 프롬프트

```text
One single embodied action: the same adult woman takes one real sip of beer from inside her own first-person viewpoint. Begin with the glass rim already touching her lips and already blocking the lower center of the view; do not begin by raising or presenting the glass. The camera is a BODY_RIG fixed at her eye position while she reclines in the chair, fixed 35mm-equivalent lens, no independent camera move and no zoom.

0.0–0.8 s — CONTACT HOLD: preserve the visible rim-to-lips contact at the camera's lower edge. Her hand and glass are still for a brief moment; subtle breathing only.
0.8–2.6 s — SIP: her wrist rotates the rigid glass toward her by about 25–30 degrees in one small natural arc. The beer surface responds to gravity, sliding and tilting inside the glass; a thin foam trace remains on the inner wall. Her head and body tip back only 2–3 degrees against the chair. The glass briefly occludes more of the horizon. No arm extension toward the sea.
2.6–3.3 s — SWALLOW: the wrist pauses at the drinking angle for one unmistakable swallow. A tiny body pulse and quiet nasal exhale follow; the hand does not freeze unnaturally and the glass does not change shape.
3.3–5.4 s — LOWER AND SETTLE: her elbow extends and the same glass travels down from her mouth to just above her lap along the reverse arc. The beer sloshes once with slight delayed inertia, then its surface becomes horizontal. The sea and bungalow are revealed again.
5.4–6.0 s — REST: her wrist softens, shoulders settle into the chair, and her toes loosen slightly in the sand. End in the exact END-frame composition.

Physical evidence that must remain readable at normal speed: continuous rim-to-mouth contact at the beginning, glass rotation toward the mouth, gravity-driven liquid-level change, one swallow beat, then the glass leaving the mouth and lowering to the lap. Natural close sound: one small sip, one swallow, soft exhale, faint glass/ice movement, distant waves and breeze; no music and no dialogue. Preserve the restrained lived-in dreamcore realism of the input frames.

Hard prohibitions: holding pose instead of drinking; toast or cheers gesture; glass extended toward the horizon; product advertisement; repeated sipping; pouring beer onto the face or camera; liquid moving against gravity; rubbery or morphing glass; detached hand; extra fingers or arms; visible face; floating camera; pan, dolly, orbit, crane, zoom, horizon drift; architecture warp; glossy tropical-resort grading; text, logo or watermark.
```

### CAMERA PHYSICS BLOCK

```text
Narrative purpose: make the viewer physically feel one cold sip, not observe a beverage.
Rig: BODY_RIG at the seated woman's eye position.
Mount/position: reclining chair, eye height approximately 1.05 m above sand (directing estimate, tolerance ±0.10 m).
Start: pitch approximately -3 degrees; glass rim touches the lower edge of the viewpoint; bungalow remains distant background.
Lens: fixed 35mm equivalent, no optical or digital zoom.
Allowed motion: body/head pitch only 2–3 degrees backward and return over 3.3 seconds; physiological breathing sway under 1 degree.
End: same eye position and pitch; glass lowered to lap; horizon stable.
Subject blocking: right hand owns one rigid glass; elbow supported near torso; bare legs remain passive body anchors.
Parallax anchors: condensation and rim / knees and sand / sea, boardwalk and bungalow.
Hard prohibitions: any movement independent of the woman's head/body, free-floating camera, horizon pan, orbit, rise or translation.
Continuity: END composition must allow the next island-look shot to begin from the unobstructed sea view.
```

**동작 원리 검수:** `staging`은 잔과 입의 접촉 하나만 읽혀야 한다. `arcs`는 손목·팔꿈치의 짧은 왕복 호로 확인한다. `timing/slow in-out`은 접촉 정지–기울임–삼킴 정지–내림–정착으로 확인한다. `follow-through`는 잔이 멈춘 뒤 맥주가 한 번 늦게 흔들리고 가라앉는 것으로 확인한다. 첫·접촉·삼킴·종료 프레임과 그 사이 손가락·유리잔 형태를 정상 속도로 확인하기 전 `usable`로 판정하지 않는다.

## 컷 02 — 섬 둘러보기

**참조:** K1  
**단일 목적:** 해변에서 나무다리로 시선 이동  
**카메라:** 사람 목의 느린 단일 팬. 이동·줌 금지.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible human-height camera, restrained smooth motion. I am now standing still on the white sand at normal eye height. Hold the starting view for one second. Then make one slow, continuous human head turn from swaying palm trees across the shallow lagoon toward the wooden boardwalk. By second 6 the boardwalk is centered as a clear leading line to the same bungalow; hold and settle for the final two seconds. Fixed 35mm-equivalent lens, level horizon, no forward movement, no orbit, no crane motion. Palm fronds respond gently to the same sea breeze and the water remains physically coherent. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 03 — 맨발로 나무다리 걷기

**참조:** K2  
**단일 목적:** 따뜻한 나무판의 감촉과 삐걱임을 느끼며 내 몸으로 방갈로까지 건너가는 체험  
**카메라:** 가슴·머리와 함께 움직이는 실제 사람 시점. 처음 한 걸음만 잠깐 내려다본 뒤 시선은 방갈로를 향한다. 발을 계속 촬영하지 않는다.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, immersive first-person POV from inside my own moving body, physically plausible human-height camera. I am personally crossing the same narrow weathered wooden boardwalk toward the bungalow, not watching someone else's feet. Begin standing still at the first plank with the bungalow ahead. During seconds 1 to 2, my gaze dips naturally just enough to see one bare foot reach forward and press onto a sun-warmed plank; the toes spread subtly on contact, the board gives a tiny physical flex under my weight, and a soft barefoot step and wooden creak are heard. My weight transfers over that planted foot before the other leg passes. At the same time, one anatomically correct hand briefly touches and slides along the rope railing for balance; the rope responds with slight tension instead of passing through the hand. During seconds 2 to 6, my gaze rises back toward the bungalow and I continue walking at a calm human pace, feeling three or four believable alternating weight shifts through mild head-and-shoulder bob. The feet appear only as occasional natural glimpses at the very bottom edge, never as the subject. Sunlight flashes on the water through gaps between the planks and small fish move below, while the bungalow grows gradually closer from real forward travel. During seconds 6 to 8, I shorten my final step and come to a balanced stop near the entrance; body inertia settles before the shot ends. Use one continuous body-mounted human walking path, fixed 35mm-equivalent lens, stable horizon with small physiological sway, coherent foreground-to-background parallax. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only: alternating bare-foot contact, subtle board creaks, rope friction, water and breeze; no music. No third-person body, no detached legs, no camera floating ahead of the walker, no staring continuously at the feet, no foot close-up, no sliding feet, no moonwalk, no extra toes, no extra limbs, no running, no flying, no orbit, no zoom, no boardwalk bending or warping, no text, no watermark, no other people, no faces.
```

## 컷 04 — 방갈로로 들어가기

**참조:** 시작 K2 / 끝 K3  
**단일 목적:** 외부에서 내부로 문을 통과  
**카메라:** 실제 손으로 문을 열고 한 걸음 진입. 벽 통과 금지.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible human-height camera, restrained smooth motion. Begin directly in front of the same bungalow door from the exterior reference. One anatomically correct hand reaches forward, grips the real door handle, and pushes the hinged wooden door inward. The door rotates around its visible hinge with natural resistance. After the doorway is fully clear, take one slow human step across the threshold into the exact compact interior from the end reference. Eyes adapt gently from bright exterior to warm interior exposure. End standing still just inside the room with the bed, rattan chair and ocean window readable. Fixed lens, no passing through the door or wall, no magical dissolve. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 05 — 방 안 둘러보기

**참조:** K3  
**단일 목적:** 개인 공간과 호박 광석 소개  
**카메라:** 방 중앙 고정 위치에서 느린 한 방향 팬.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible human-height camera, restrained smooth motion. Stand still inside the same compact bungalow. Make one slow continuous look across the simple bed with white linen, the single rattan chair, the iced drink bucket, the seashell mobile moving gently in the sea breeze, a few books and small plants, then finish on the single softly glowing amber crystal on the shelf. The amber crystal remains small, solid and stationary; it does not levitate or emit magical particles. Sheer curtains lag softly behind the breeze and settle. Fixed lens, level eye height, no walking, no orbit, no room expansion. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 06 — 뒷문 데크와 요트

**참조:** K2 또는 K3  
**단일 목적:** 다이빙 장소와 배 위치 소개  
**카메라:** 문 열기 후 데크로 한 걸음. 직선 이동만.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible human-height camera, restrained smooth motion. From inside the same bungalow, one hand opens the back door and I take one slow step onto the real wooden deck over open water. Reveal the same small white sailboat tied securely to the bungalow pilings, bobbing gently with consistent rope tension. Hold the view on the deck edge, sailboat, endless ocean and towering clouds for the final three seconds. Fixed 35mm-equivalent lens, normal standing eye height, straight movement only, no crane rise, no orbit, no boat duplication. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 07 — 비치가운 벗기

**참조:** K2  
**단일 목적:** 다이빙 직전 준비동작  
**카메라:** 데크 가장자리 고정, 아래쪽으로 제한된 고개 움직임.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible human-height camera, restrained smooth motion. Stand securely at the same deck edge. Two anatomically correct hands enter frame and untie one simple knot of a light linen beach robe at the waist. The robe loosens naturally, slides from the shoulders outside the visible frame, and is placed onto the deck rather than blown away. Plain non-revealing swimwear is visible only at the lower edge. After the robe settles, tilt the head down slightly toward the clear deep-blue water and hold for two seconds, preparing to dive. Fixed lens and body position, no jump yet, no spinning, no extra arms, no nudity. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 08 — 다이빙

**참조:** 시작 K2 / 끝 K4  
**단일 목적:** 데크에서 물속으로 연속 진입  
**카메라:** 사람 머리의 포물선, 수면 접촉 후 감속. 비행 금지.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, first-person POV, physically plausible body-mounted camera, restrained smooth motion. Begin at the same deck edge looking at the clear ocean. A short preparatory bend occurs for one second, then the body pushes once from the deck and follows one believable forward-downward human diving arc. Hands extend together briefly at the lower center just before contact. At about second 3, break the water surface with one coherent splash; bubbles rush past and motion decelerates from water resistance. Transition naturally from bright sky to the exact clear-blue underwater world of the end reference, then stabilize underwater for the final three seconds. No aerial hover, no second jump, no cut, no body inversion, no instant depth change. Preserve only the referenced geography, object placement and architecture; reinterpret its color, exposure and materials according to the restrained lived-in style above, and do not inherit the reference image's glossy saturation or resort-advertising polish. Natural ambient sound only, no music; underwater sound becomes muffled immediately after surface contact. No text, no watermark, no other people, no faces, no camera teleportation, no zoom, no architecture warping, no duplicated limbs or objects.
```

## 컷 09 — 다양한 물고기 사이로 고래상어와 유영

**참조:** K4  
**단일 목적:** 여러 수심층의 물고기 사이를 내 몸으로 헤엄치다가 고래상어와 평화롭게 조우  
**카메라:** 느린 프리다이빙 전진, 고래상어와 안전거리 유지.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, immersive first-person POV from inside my own swimming body, physically plausible free-diving camera. I glide slowly forward at a calm human swimming speed through a living reef ecosystem. Two anatomically correct hands make one gentle symmetrical swimming sweep during the first two seconds, producing small bubbles and real forward propulsion, then relax at the lower edges of frame. Different species occupy distinct depth layers without crowding: a small school of orange anthias above the coral, two butterflyfish crossing the near midground, several blue tangs farther to the side, and a few tiny silver fish near the surface light. They swim independently with realistic fin motion and keep safe distance from my body. The same single whale shark then passes calmly across the open midground at a safe distance with stable anatomy and realistic tail propulsion. I slow my stroke and gently turn my head to follow it, then settle neutrally buoyant for the final two seconds. Fixed lens, coherent water resistance and parallax, no chasing, no touching, no rapid ascent, no aggressive animal motion. Preserve the referenced reef layout, surface-light direction and whale shark identity, but reinterpret color and exposure with restrained natural underwater haze and no aquarium-commercial saturation. Natural ambient underwater sound only: muffled water movement, soft bubbles and distant reef texture; no music. No aquarium crowding, no fish collisions, no repeated cloned fish, no multiple whale sharks, no animal morphing, no text, no watermark, no other people, no visible face, no camera teleportation, no zoom, no duplicated limbs.
```

## 컷 10 — 조개를 찾아 가시복어에게 건네기

**참조:** K4  
**단일 목적:** 내가 모래에서 작은 조갯살을 찾아 건네고, 가시복어가 다가와 콕콕 먹다 귀엽게 뱉는 모습을 보며 물속에서 웃는 교감 체험  
**카메라:** 산호 바닥 가까이 중성부력으로 머물며 두 손과 복어의 접촉을 직접 내려다보는 시점. 복어를 쫓지 않는다.

```text
The viewer-character is the same adult woman throughout every shot; preserve the same natural female hands, forearms, bare legs, body proportions and muffled female laugh whenever they appear, with short unpolished nails and no jewelry; her face is never visible. Grounded dreamlike cinematic realism with subtle fantasy inside ordinary tactile life, a believable lived-in personal island shaped by memory rather than a luxury resort, natural exposure, slightly faded sun-bleached colors, soft ocean haze, restrained contrast, large sculptural clouds softened by atmosphere, clear seawater without neon turquoise, weathered materials with salt stains and small repairs, modest personal objects and signs of daily use, gentle film grain, quiet intimate atmosphere, immersive first-person POV from inside my own neutrally buoyant swimming body, physically plausible underwater movement. Begin hovering calmly just above a sandy patch beside the same coral reef. My anatomically correct left hand gently brushes aside only the loose top layer of sand and finds one small already-open clam shell containing a tiny soft piece of clam; no tool, no breaking coral and no damage to the seabed. During seconds 1 to 3, I pick up the small shell carefully between thumb and forefinger and hold it still on my open palm. A single cute porcupine pufferfish notices from nearby and approaches under its own power with realistic fluttering fins, curious but not inflated. During seconds 3 to 6, the porcupine pufferfish stops in front of my hand and gives the clam two distinct tiny pecks: peck, pause, peck. It takes a very small soft morsel, chews briefly, then comically spits one tiny harmless fragment back out; the fragment drifts slowly in the water. The fish remains anatomically stable and never bites my fingers. During seconds 6 to 8, my hand reflexively pulls back just a few centimeters, my shoulders shake once with a spontaneous muffled adult woman underwater laugh, and a short stream of laughing bubbles rises past the camera while the pufferfish hovers innocently and looks at me. Other species provide gentle background life without stealing focus: a few orange anthias above the coral, two butterflyfish crossing far behind, and small silver fish near the light rays. Use a fixed 35mm-equivalent lens, coherent buoyancy, slow water resistance and intimate arm-length distance. Preserve the referenced reef layout and surface-light direction, but reinterpret color and exposure with restrained natural underwater haze and no aquarium-commercial saturation. Natural ambient underwater sound only: sand brushing, tiny shell tap, two delicate pecks, muffled adult woman closed-mouth underwater chuckle inside the mask or breath-hold mouth, and rising bubbles; no clear dry voice, no dialogue, no music. No forced feeding, no animal distress, no inflated pufferfish, no biting fingers, no blood, no broken coral, no shell duplication, no extra hands, no fish collisions, no repeated cloned fish, no animal morphing, no text, no watermark, no other people, no visible face, no camera teleportation, no zoom.
```

## 3. 컷별 제출·검수 기록

각 컷 생성 직후 다음 표를 작성한다. QUEUED/RUNNING이면 새 제출을 하지 않는다.

| 컷 | 모델 | 비용 | 상태/Job ID | 정상속도 QC | 판정 |
|---|---|---:|---|---|---|
| 01 | | | | 손·유리잔·수평선·방갈로 | |
| 02 | | | | 단일 팬·수평선·공간축 | |
| 03 | | | | 발·접지·보행 속도·다리 워프 | |
| 04 | | | | 손잡이 접촉·문 힌지·문턱 | |
| 05 | | | | 방 크기·소품 수·호박 1개 | |
| 06 | | | | 문·한 걸음·요트 로프 | |
| 07 | | | | 손 2개·가운·준비동작 | |
| 08 | | | | 포물선·수면 접촉·기포·감속 | |
| 09 | | | | 손·고래상어 형태·꼬리 추진 | |
| 10 | | | | 환도상어 거리·복어·틸트업 | |

판정은 `usable`, `usable trim`, `HOLD` 중 하나만 사용한다. 사용자 승인 전 `FINAL`로 쓰지 않는다.
