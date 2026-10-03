# Mine D 웹앱 — 멘토 구현본 (KAIST CT×AI 캡스톤 1조)

1조 구현계획서 1~3단계를 멘토 쪽에서 구현한 브라우저 앱이다. 판정 코어는 팀 HERIZON 의 9/23 차이 분석 확정 규칙(스키마 v8)과 10/2 NOW 문서의 등급 문구를 따른다. 팀 저장소 `zzbogae/damhyang-docent` 에서는 `webapp/` 아래에 있다.

실제 개인 기록은 들어 있지 않다. 샘플·시험 데이터는 전부 합성(가상 인물)이다.

팀 저장소의 `.gitignore`(개인정보 하드룰)가 zip·jpg·png·카톡 파일 이름을 막기 때문에, 아래 파일은 저장소에 없고 다시 만들어 쓴다.

- `web/public/sample/` 샘플 번들: `synth/make_persona.py` → `synth/build_sample.py short` 로 다시 만든다(약 10초). 「가짜 샘플 기록으로 먼저 보기」와 vitest·playwright 시험이 이 번들을 쓰므로 먼저 만들어 둔다
- `web/lab/testset/` 사진 필터 시험셋, `web/tests/helpers/exif_template.jpg`: `playwright.lab.config.ts` 시험과 `BENCH=1` 속도 측정에만 쓰여서 앱 실행과 기본 시험에는 필요 없다
- `web/public/icons/mined-*.png` PWA 아이콘: 없으면 홈 화면 추가 때 기본 아이콘이 쓰인다

## 구조

| 경로 | 내용 |
|---|---|
| `core/mined_core/` | 판정 코어 v7(Python, numpy 만 사용). CLI 와 브라우저 Pyodide 가 같은 코드를 실행한다 |
| `core/scripts/eval_all.py` | 합성 인물 세 명으로 기준값 비교·홀드아웃·합성 이상 주입·창 길이·결측 평가 → `out/eval/`, `docs/eval.md` |
| `core/mined_core/field_eval.py`, `core/scripts/field_collect.py` | 실제 기록 평가 보고서(숫자만)와 여러 보고서를 한 표로 모으기(`docs/field_eval.md`) |
| `synth/` | 합성 인물 생성기와 원천 내보내기 파일(Takeout zip·애플/삼성 건강·카톡 txt·사진 폴더) 생성 |
| `web/src/import/` | 브라우저 가져오기(zip.js 항목 단위 읽기, 채널 파서: 유튜브 JSON·HTML, Keep, ICS, 애플·삼성 건강, 구글 피트니스, 카톡 3형식, 인스타그램, AI 대화(ChatGPT·Claude), 사진 EXIF, 가져오기 워커, 사진 폴더 핸들) |
| `web/src/judge/` | Pyodide 판정 워커 |
| `web/src/filter/` | 사진 안전 필터(화면 캡처 규칙 → PP-OCRv5 글자 영역 → BlazeFace 얼굴), 메모 필터(자격증명·위기 표현) |
| `web/src/relic/` | 되돌려줄 원문 고르기 |
| `web/src/eval/`, `web/src/ui/Eval.tsx` | 실제 기록으로 평가하기(사건 봉인 → 가린 주 기억해 보기 → 숫자 보고서) |
| `web/src/cli/mined.ts` | 명령줄 가져오기(브라우저와 같은 파서, Pyodide 판정, v6 JSON, 평가 보고서) |
| `web/src/photos/` | 주 사진 확인 서비스, 비슷한 사진 묶기(dHash) |
| `web/src/mindi/` | 민디 템플릿, 말투 다듬기 검사(숫자 보존·금지어), 화면 읽기(Web Speech, 접근성 기능) |
| `web/src/ui/`, `web/src/room/`, `web/src/islands/`, `web/src/letters/` | 지층·주 상세·민디에게 묻기·시기·편지·설정 화면, 나의 방 v0(three.js, WebXR), 이어진 갱도 설계 시연(`?islands`) |
| `web/src/ui/design.ts`, `web/src/assets/design/` | 드라이브 디자인 에셋(입장 영상·로고·민디·광물 9종·곡괭이). 화면 대응은 `docs/design_from_drive.md` |
| `docs/` | 데이터 계약, 가져오기 규칙, 필터 평가(비슷한 사진 묶기 포함), 판정 평가, 실제 기록 평가 절차 |

## 실행

```bash
# 파이썬 코어
cd core && uv venv --python 3.14 && uv pip install -e ".[research,synth]" pytest
.venv/bin/python -m pytest -q tests

# 합성 인물과 샘플 번들(선택, 약 10초)
.venv/bin/python ../synth/make_persona.py && .venv/bin/python ../synth/build_sample.py short

# 웹 (이 맥은 NODE_ENV=production 이라 --include=dev 가 필요)
cd ../web && npm install --include=dev --legacy-peer-deps
npm run assets        # Pyodide 런타임·numpy·사진 필터 모델을 public/ 아래로 받음(약 50MB, 저장소에는 넣지 않음)
npm run dev           # http://localhost:5181 — "가짜 샘플 기록으로 먼저 보기"로 전 과정을 볼 수 있다
```

나의 방 WebXR 은 헤드셋 브라우저에서만 버튼이 나온다. 데스크톱에서 시험하려면 주소에 `?xr-emulate` 를 붙인다(IWER 에뮬레이터, localhost 에서만).

브라우저 대신 명령줄로 가져오려면 `npm run cli -- <내보내기 파일·폴더> -o <출력 폴더> [--judge] [--v6] [--events 사건.json --participant P1]` 을 쓴다. 같은 파서로 `daily.json`·`meta.json` 을 만들고, 선택하면 Pyodide 로 판정까지 한다(15년 합성 인물 약 5초). 사진 필터는 브라우저에서만 돈다.

민디 말투 다듬기를 켜려면 `OPENROUTER_API_KEY` 를 환경변수로 두고 dev/preview 서버를 띄운다. 브라우저는 판정 문장만 `/api/mindi` 로 보내고, 키는 서버 쪽에만 있다. 키가 없으면 템플릿 문장을 그대로 쓴다.

## 시험

```bash
cd web
npx vitest run                                   # 가져오기·필터·원문 고르기·민디 답변·v6 다리·CPython↔Pyodide 일치·평가 보고서·명령줄·비슷한 사진(131개)
npx playwright test                              # 앱 전 과정·좁은 화면·나의 방·민디에게 묻기·이어진 섬·WebXR 에뮬레이터·팀 v6 불러오기·두 기간 비교·오프라인·외부 요청 0건·실제 기록 평가(14개)
BENCH=1 npx playwright test e2e/bench.spec.ts    # 사진 2만 장 폴더 가져오기+판정 시간
npx playwright test -c playwright.lab.config.ts  # 사진 필터 시험셋 재현율·정밀도·장당 시간, 비슷한 사진 묶기, 스크린타임 캡처 읽기(4개)
BENCH=1 npx vitest run tests/kakaoBench.test.ts  # 카카오톡 60만 개 읽기·집계 시간
LIVE=1 npx vitest run tests/mindiTone.live.test.ts  # 실제 모델 말투 변환 통과율(키 필요)
cd ../core && .venv/bin/python scripts/eval_all.py && .venv/bin/python scripts/eval_report.py
```

## 팀 파이프라인과 잇기

- 팀 v6 판정 JSON(`sample_data.json` 형식)은 가져오기 화면의 "팀 v6 판정 JSON 불러오기"로 이 화면에서 볼 수 있다.
- 이 뼈대의 판정 결과는 설정의 "팀 뷰어용 v6 JSON 내려받기"로 팀 뷰어 형식으로 내보낸다(`web/src/bridge/v6.ts`).

## 팀 확정 규칙 반영(v8, 2026-10-03)

팀 9/23 차이 분석 문서의 확정 사항(축 이름 두 층, 광물 9종, 결, 확인 등급 4종 + broken, 위기 안내 상시 배치, 민디 목소리 대신 화면 읽기, 편지, 이어진 섬 분리)과 요청(판정 지표 스위치, 방향별 문턱, 상관 병합 출력)을 반영했다. 2차 고도화(밤 기록 공백, 민디 자유 질문, `insufficient` 기준 실측, 스크린타임 캡처·깃 커밋, 안드로이드 사진 공유, 접근성 점검, 카톡 메모리)도 같은 문서 끝에 있다. 내역·설정값·합성 인물 비교는 `docs/team_rules_v8.md`, 참가자에게 보낼 평가 안내문은 `docs/participant_guide.md`.

## 팀이 이어서 할 것

- 실기록 평가 보고서의 두 번째 표(판정 지표 비교)로 `metric` 을 정한다. `broken`·`not_returned` 화면 문안과 형석(GEM_COMPLEX) 정의를 정해 `judge.py` 에 넣는다.
- 팀원 4명의 동의받은 실제 기록으로 브라우저 가져오기 완주 시험과 실제 기록 평가(앱의 "평가" 화면, 절차는 `docs/field_eval.md`), 받은 보고서는 `core/scripts/field_collect.py` 로 모은다. 사진 필터 500장 재측정(같은 장면 묶음 라벨 포함).
- 발표 자료와 리허설. 시연은 `web/public/sample/` 의 가짜 샘플로 한다.
