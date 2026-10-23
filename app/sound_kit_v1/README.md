# Mine D 사운드 키트 v1.2

**2026-10-23** · v1.2 = 음악·민디 목소리 반영 (v1·v1.1 폴더는 그대로 둠) · 보경 지시 · 정리 Claude · 상태: **제안** (보경 청취 확인 전)
**바탕**: `261023_MineD_사운드_빈구간_챗봇연결_이름짓기_문구기준_v1.md` §1 · `261023_MineD_화면설계_최종본_v6.md` · `261023_MineD_버튼배치_확정_v1.md`

## 요약

- 화면 구역 P0~P13마다 바탕 소리를 정하고, 버튼·사건마다 효과음 31종, 민디 음절 22종을 붙였습니다.
- v1.1: 화면·하위 창·버튼·상태 전환 107개를 하나씩 대조해 빈 곳 52개를 채웠습니다. 전체 표는 `261023_MineD_사운드_빠짐점검표_v2.md`, 사운드 창 맨 아래에서 ▶로 들어 볼 수 있습니다.
- 파일 하나(`mined-sound.js`)만 넣으면 됩니다. 외부 라이브러리 없음.
- 바로 들어 보기: `index.html`(사운드 창)을 브라우저로 열고 「소리 켜기」.

## v1.2에서 바뀐 것

| 항목 | 내용 | 출처 |
|---|---|---|
| 음악 · 안개 (P0~P2) | 원곡 전체 2분 45초, 고리 재생 | 예전 홈페이지 `MineD_stage_v4` 배경음(8/22 Suno 곡) |
| 음악 · 등불 (P3·P4·P9·P10) | 원곡 34~102초 구간, 고음을 걷어 먹먹하게 | 같은 곡 |
| 음악 · 열린 곳 (P11·P12) | 원곡 106~150초 구간 | 같은 곡 |
| 지하 (P5~P8) | 음악 없음 (설계 그대로) | — |
| 민디 목소리 a (기본) | 인형 변말 합창 목업, +2반음, 음절 18개 | 청룡사 E08 인형 목소리 오디션 260922 |
| 민디 목소리 b | 인형 변말 홍동지, +5반음, 음절 18개 | 같은 오디션 |

- 원곡 분석: F단조 5음(F·A♭·B♭·C·E♭), 약 76 BPM. 파일을 못 불러오면 같은 조와 빠르기로 코드가 대신 연주합니다.
- 민디 목소리는 음절 하나씩 섞어 쓰므로 원래 낱말은 남지 않습니다. 대사는 말풍선 자막으로 보여 줍니다.
- 음악이 흐르면 임시 패드는 30%로 낮춥니다. 겹쳐 뜨는 창이 열리면 음악도 함께 낮아집니다.

```js
MineDSound.setMusic(false);   // 음악만 끄기
MineDSound.setVoice('b');     // 민디 목소리 a | b | synth
```

## 지킬 것 한 가지

소리는 **사용자가 어디에 있는지**(구역·깊이·고른 환경)에만 반응합니다. 기록 내용(힘들었던 주, 광석 종류·등급, 지표 방향)으로 소리를 바꾸지 않습니다. 그래서 키트의 어떤 함수도 기록 데이터를 받지 않습니다. 모든 광석은 같은 「쨍」입니다.

## 폴더

| 파일 | 내용 |
|---|---|
| `index.html` | 사운드 창. 구역·효과음·민디 목소리를 버튼으로 들어 보는 시험 페이지 |
| `mined-sound.js` | 사운드 엔진. `window.MineDSound` |
| `sound-map.json` | 구역 → 소리 매핑 + `events`(107개 항목별 소리) (개발 참고용) |
| `261023_MineD_사운드_빠짐점검표_v2.md` | 빠짐 점검표 |
| `audio/*.wav` | 섬 영상에서 잘라 낸 소리 5개 (약 0.8 MB) |

## 구역별 매핑

| 구역 | 바탕 소리 | 효과음 (이벤트 → 이름) | 민디 |
|---|---|---|---|
| P0 첫 화면 · 안개 | 안개 바람 + 낮은 패드 | ENTER → `door` | — |
| P1 로그인 | 안개 (작게) | 버튼 → `tap` | — |
| P2 데이터 연결 | 안개 (작게) | 연결 완료 → `confirm` | — |
| P3 관측소 | 고른 장면: 등불(기본)·비·바람·없음, 선율 없음 | 기능 버튼 5개 → `tap` · 관측소의 문 → `door` | 첫 만남 `hello` · 말풍선 `say()` |
| P4 하루 고르기 | 관측소와 같음 | → `tap` | `say()` |
| P5 엘리베이터 | 출발 덜컹 → 기계음 + 깊이 이동 → 도착 종 | 내려간다 → `confirm` · 돌아가기 → `back` | `wait` |
| P6 연도 지층 | 깊이에 따라 바람↓ 저주파·물방울↑, 음악 없음 | 층 넘김 → `tap` | `found` |
| P7 광석 캐기 | 지층 소리 그대로 | 곡괭이 3번 → `pick` ×3 · 깨짐 → `ore_crack` | `mined` |
| P8 광석 상세 | 지층 소리 70% | VIBE → `tap` · 이름 붙이기 → `name_save` · 보관 → `keep` | `say()` |
| P9 민디와 이야기 | 등불 (작게) | 보내기 → `tap` | 답마다 `say()` · `react()` |
| P10 캔 광석 보관함 | 등불 + 물방울 (작게) | 넣기 → `keep` | — |
| P11 나의 공간 만들기 | 고른 환경 미리 듣기 (60%) | 고르기 → `tap` · 열림 → `space_open` | `say()` |
| P12 나의 공간 | 바다 = 파도 + 물결 / 산 = 바람 + 새 / 하늘 = 높은 바람 / 정글 = 풀벌레 + 새 / 방 = 방 공기 | 걷기 → `step` · 소품 → `keep` | — |
| P13 설정 | 바꾸지 않음 (겹쳐 뜨는 창) | 토글 → `toggle` | — |

**깊이 (P5~P8)**: `depth` 0 → 1. 음량 100% → 55%, 고음 18 kHz → 2.5 kHz, 울림 0.4초 → 2.8초, 울림 비율 10% → 45%. 깊이는 **몇 번째 층인지**로만 계산합니다(예: `층 번호 / 전체 층 수`).

## v1.1에서 더한 효과음

`toggle_on` `toggle_off` `close` `card` `panel_open` `panel_close` `floor_tick` `locked` `glint` `hide` `erase` `send` `memory_note` `shuffle` `fog_clear` `appear` `spotlight` `mindi_steps` — 이름과 쓰는 곳은 점검표 참고. 마우스 올리기·튜토리얼 안내띠는 일부러 무음입니다.

## 소리 출처

| 소리 | 출처 | 상태 |
|---|---|---|
| 민디 상황음 `found` `wait` `mined` | 웹앱 `webapp/web/src/mindi/sound.ts` 값 그대로 | 확정 (기존) |
| 민디 옹알이 음색 | v5 웹 데모 `start.html` blip. 난수를 빼서 같은 문장 길이면 같은 소리 | 제안 |
| 민디 기본 10 · 끝맺음 3 · 맞장구 4 · 상황음 `surprise` `hello` | 새로 합성 | 제안 |
| 파도 `amb_sea_waves` | 10/3 섬 영상 C02 (Seedance 원음) | 제안 · 청취 확인 필요 |
| 방 공기 `amb_room_tone` | 섬 영상 C05 | 제안 · 청취 확인 필요 |
| 문 `sfx_door_open` | 섬 영상 C04 손잡이·경첩 | 제안 · 청취 확인 필요 |
| 나무 발소리 `sfx_step_wood(_2)` | 섬 영상 C03 | 제안 · 청취 확인 필요 |
| 바람·패드·등불·물방울·기계음·저주파·비·새·풀벌레·효과음 나머지 | `mined-sound.js` 안에서 합성 | 제안 |

파일을 못 불러오면 합성음으로 대신하므로 페이지는 멈추지 않습니다.

## 붙이는 법

```html
<script src="sound/mined-sound.js"></script>
<script>
  MineDSound.init({ base: 'sound/audio/' }).bind(document);
</script>

<button data-sound-toggle>소리 켜기</button>      <!-- 첫 소리는 반드시 클릭으로 -->
<button data-sfx="door">ENTER</button>
<section data-sound-zone="P3">관측소…</section>   <!-- 화면에 60% 보이면 자동 전환 -->
```

React 등 상태로 화면을 바꿀 때는 직접 부릅니다.

```js
MineDSound.setZone('P6');                      // 화면이 바뀔 때
MineDSound.setDepth(layerIndex / layerCount);  // 지층 스크롤
await MineDSound.descend(0.6, 3.5);            // 엘리베이터 (덜컹 → 이동 → 종)
MineDSound.sfx('pick'); MineDSound.sfx('ore_crack');
MineDSound.say(bubbleText, { tone: 'quiet' }); // quiet | warm | plain | dry
MineDSound.setZone('P12', { env: 'sea' });     // sea | mountain | sky | jungle | room | none
MineDSound.setScene('rain');                   // P3 바탕: lantern | rain | wind | none
MineDSound.overlay('help', true);              // 창 열림: door | help | panel | notice → 바탕만 낮춤
MineDSound.overlay('help', false);             // 창 닫힘
MineDSound.setReduced(true);                   // 「연출 줄이기」를 켜면 바탕 소리 절반
```

기본은 꺼짐입니다. 켜짐 여부는 브라우저에 기억하고(`MineDSound.wasOn()`), 다음 클릭 때 `enable()`로 살립니다. 소리를 꺼도 앱은 그대로 작동합니다.

## 확인 필요

1. 섬 영상 원음 4종을 직접 들어 보고 쓸지 정하기 (잘라 낸 구간은 `sound-map.json`에 적음)
2. 음악 3곡 구간과 민디 목소리 a·b 중 무엇을 쓸지 들어 보고 정하기
3. 깊이 수치(§1-2 표)는 초안. 실제로 들으며 조정
4. 사운드 담당 미정 (10/23 슬랙 모집 글에 댓글 없음)

---
*팀 HERIZON · 담향루 스튜디오*
