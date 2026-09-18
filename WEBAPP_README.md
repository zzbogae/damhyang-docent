# Mine D 멘토 뼈대 (KAIST CT×AI 캡스톤 1조)

1조 구현계획서(`../1조_MineD_구현계획서.md`) 1~3단계를 멘토 쪽에서 먼저 구현한 저장소다. 팀 저장소를 아직 받지 못해서 판정 코어를 새로 짰다. 팀의 판정 로직 v6 가 있으면 `core/mined_core/judge.py` 의 `DEFAULT_CONFIG` 와 규칙 함수를 팀 규칙으로 바꾸면 된다. 로컬 전용이며 원격에 올리지 않았다.

실제 개인 기록은 들어 있지 않다. 샘플·시험 데이터는 전부 합성(가상 인물)이다.

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
| `web/src/mindi/` | 민디 템플릿, 말투 다듬기 검사(숫자 보존·금지어), 목소리(Web Speech) |
| `web/src/ui/`, `web/src/room/`, `web/src/islands/` | 지층·주 상세·민디에게 묻기·시기·설정 화면, 나의 방 v0(three.js, WebXR), 이어진 섬 설계 시연 |
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
npx playwright test -c playwright.lab.config.ts  # 사진 필터 시험셋 재현율·정밀도·장당 시간, 비슷한 사진 묶기(3개)
LIVE=1 npx vitest run tests/mindiTone.live.test.ts  # 실제 모델 말투 변환 통과율(키 필요)
cd ../core && .venv/bin/python scripts/eval_all.py && .venv/bin/python scripts/eval_report.py
```

## 팀 파이프라인과 잇기

- 팀 v6 판정 JSON(`sample_data.json` 형식)은 가져오기 화면의 "팀 v6 판정 JSON 불러오기"로 이 화면에서 볼 수 있다.
- 이 뼈대의 판정 결과는 설정의 "팀 뷰어용 v6 JSON 내려받기"로 팀 뷰어 형식으로 내보낸다(`web/src/bridge/v6.ts`).

## 팀이 이어서 할 것

- 팀 판정 로직 v6 와 기준값을 `core/mined_core/judge.py` 에 옮기고, `core/scripts/eval_all.py` 로 기존 값과 비교한다.
- 광물·모양 계산 규칙(`judge.mineral_shape`), 4축에 지표를 묶는 방식(`judge.axes_for`)을 팀 규칙으로 바꾼다.
- 팀원 4명의 동의받은 실제 기록으로 브라우저 가져오기 완주 시험과 실제 기록 평가(앱의 "평가" 화면, 절차는 `docs/field_eval.md`), 받은 보고서는 `core/scripts/field_collect.py` 로 모은다. 사진 필터 500장 재측정(같은 장면 묶음 라벨 포함).
- 발표 자료와 리허설. 시연은 `web/public/sample/` 의 가짜 샘플로 한다.
