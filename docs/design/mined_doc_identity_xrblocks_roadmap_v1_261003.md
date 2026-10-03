# Mine D — 정체성·구동·AI 자동생성·XR Blocks 로드맵 v1

**기준일:** 2026-10-03  
**정본 우선순위:** `NOW.md` → `261002_MineD_전체경과_실행계획_v10.md` → 본 문서

## 1. Mine D의 정체성

Mine D는 기록을 심리 상태로 판정하는 서비스가 아니다. 사진·카톡·메모·건강·캘린더·유튜브 기록을 기기 안에서 주 단위 특징으로 바꾸고, 평소 범위를 크게 벗어난 주를 **광석**으로 보여준다. 연도별 시간은 **지층**으로 쌓인다. 캐릭터 **민디**는 기록에서 확인되는 사실을 펼치지만 의미나 욕구를 대신 결론 내리지 않는다. 사용자가 직접 말한 바람만 **섬 설계도**가 되어 1인칭 개인 공간을 연다.

핵심 문장: **민디는 사실을 펼치고, 결론은 사용자가 말한다.**

## 2. 구동 과정

1. 원본 기록은 기기 안에서 채널별 주간 특징으로 집계한다.
2. 직전 52주 기준선과 방향별 임계값으로 벗어난 주를 찾는다.
3. 4축과 방향, 교차검증 결과로 광물을 결정하고 지층에 배치한다.
4. 사용자가 광석과 단어 칩을 열어 민디와 대화한다.
5. 민디는 근거가 있는 사실만 보여주고, 사용자가 원하는 장면을 자기 말로 확정한다.
6. 외부 생성 도구에는 원문 대신 `선택 단어 + 사용자 장면 + 스타일 파라미터`만 보낸다.
7. AI가 키 이미지와 컷 영상을 만들고, 사람의 정상속도 검수 뒤 섬 영상에 연결한다.

## 3. AI 자동 영상생성 계약

```json
{
  "scene": "사용자가 말한 장면",
  "mood": ["바랜 노을", "생활감 있는 몽환 실사"],
  "pov": "same adult woman, embodied first-person",
  "physical_actions": ["support", "contact", "weight", "inertia", "water resistance"],
  "privacy": {"raw_records": false, "selected_words_only": true},
  "generation": {"provider_order": ["Kling MCP", "Higgsfield MCP fallback"], "retry": 0}
}
```

파이프라인: `설계도 검증 → START/END 이미지 → 해부학·톤 검수 → 비용/잔액 확인 → Kling I2V 1회 → 상태조회 → 정상속도/오디오 QC → 실패 원인 1개 기록 → 필요할 때만 Higgsfield 견적·대체`.

## 4. 영상의 주인공·물리 잠금

- 모든 컷은 같은 **성인 여성**의 몸 안에서 본 시점이다. 얼굴은 보이지 않는다.
- 짧고 꾸미지 않은 손톱, 장신구 없음, 같은 피부톤·손·팔·다리 비율을 유지한다.
- 컷마다 지지면, 접촉점, 질량, 준비동작, 주동작, 관성 정착을 눈으로 확인할 수 있어야 한다.
- 보행은 발 접지와 체중 이동, 문은 손잡이·힌지·문턱, 입수는 포물선·수면 충돌·감속, 수중은 부력·물 저항으로 증명한다.
- START/END가 좋아도 중간 프레임에서 손가락·유리잔·사지·동물 형태가 무너지면 HOLD다.

## 5. XR Blocks 적용 판단

XR Blocks는 three.js와 WebXR 위에서 데스크톱 시뮬레이터와 Android XR을 지원하는 오픈소스 SDK다. `user / world / ui / ai` 고수준 프리미티브, 손 추적·제스처·물리·공간 상호작용을 제공하므로 Mine D의 **섬 탐색과 광석 배치 프로토타입**에 적합하다. 단, 공식 지원 제품이 아니라 커뮤니티와 XR Labs가 유지하는 프로젝트이므로 전시 MVP의 유일한 실행 경로로 의존하지 않는다.

### 최소 테스트

1. Chrome 데스크톱 시뮬레이터에서 섬 바닥·광석 1개·민디 위치를 로드한다.
2. 단어 칩 JSON을 `world` 파라미터로 변환한다.
3. pinch 또는 point로 광석을 선택하고, 선택 결과만 로컬 상태에 기록한다.
4. Gemini 기능을 붙일 때는 원문이 아니라 섬 설계도만 전송한다.
5. 권한 거부·WebXR 미지원 시에는 사전 생성 영상으로 안전하게 폴백한다.

## 6. 현재 검증 상태

- Kling MCP OAuth·모델·크레딧 조회: 완료.
- 컷 1 START/END 해부학 수정: 완료. Kling I2V 1회 제출, 재제출 금지 상태.
- 컷 2~10 통일 톤 기준 이미지: 제작 진행 중.
- XR Blocks: 공식 문서·저장소 기반 기술 적합성 확인. 로컬 실행 테스트는 별도 코드 작업이 필요하며 아직 완료로 말하지 않는다.

## 참고

- https://github.com/google/xrblocks
- https://xrblocks.github.io/docs/
- https://research.google/blog/xr-blocks-accelerating-ai-xr-innovation/
- https://research.google/blog/vibe-coding-xr-accelerating-ai-xr-prototyping-with-xr-blocks-and-gemini/
