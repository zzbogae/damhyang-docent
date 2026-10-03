# 합성 인물과 원천 내보내기 파일

실제 개인 기록 없이 가져오기·판정·평가를 시험하기 위한 가상 인물 생성기다. 메모·메시지·제목은 전부 지어낸 문장이다.

```bash
core/.venv/bin/python synth/make_persona.py            # long short elder 모두
core/.venv/bin/python synth/make_persona.py short      # 하나만
core/.venv/bin/python synth/build_sample.py short      # web/public/sample 번들(5MB 이하)
```

| 인물 | 기간 | 채널 | 특징 |
|---|---|---|---|
| `long` | 2011-03 ~ 2026-08 | 6채널 전부 | 유튜브 주당 0.4회→60회 비정상, 새벽 메모 영과잉, 워치 도입(2019-06)으로 걸음 수준 이동, 카카오톡은 두 기간만 백업, Takeout 분할 zip 2개, 애플 건강 XML 약 50MB |
| `short` | 2024-09 ~ 2026-08 | 메모·사진·건강(삼성)·카카오톡(안드로이드) | 웹 샘플 번들의 원천 |
| `elder` | 2018-01 ~ 2026-08 | 유튜브(영어 Takeout)·메모·사진·건강(삼성)·카카오톡(iOS) | 유튜브 커버리지 높고 카카오톡 매우 낮음 |

산출물(`synth/out/<인물>/`, 저장소에는 넣지 않음):

- `truth_daily.json`, `truth_meta.json`: 파서가 원천 파일에서 만들어야 할 정답(docs/contract.md 1·2절)
- `events.json`: 평가용 정답 사건. `events[]` 는 `{id, type(hard|trip|busy|move|job|retire|device), start, end(없으면 이후 계속), persistent, effects: {지표 id: up|down}}`, `structural_gaps` 는 채널별 구조적 결측 기간, `channel_ranges` 는 채널별 활동 기간, `kakao_me` 는 카카오톡의 "나"
- `memos.json`: 센 메모 원문과 필터 시험용 정답 플래그(`flags.secret`, `flags.crisis`)
- `photos.json`: 색인해야 할 사진(경로·날짜·화면 캡처 여부)
- `exports/`: 원천 내보내기 파일

규칙은 `docs/import_rules.md`. 규칙을 바꾸면 `synth/rules.py` 와 `web/src/import/rules.ts` 를 함께 고친다.
