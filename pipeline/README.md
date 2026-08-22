# pipeline

여기는 비어 있습니다. 각자 로컬 `gyeol_kit/`을 복사해 넣으세요.

```
pipeline/
  run_gyeol.py
  export_app_data.py
  gyeol/
    channels.py          채널 정의 — 여기만 고치면 나머지가 따라옴
    detect.py            파일 이름이 아니라 내용으로 채널 판별
    parse_health.py      애플 zip · 삼성 zip[미검증] · CSV
    parse_takeout.py     유튜브 · 캘린더 ICS · Gemini
    parse_kakao.py       카톡 txt 3종 + csv
    parse_ai.py          Claude · ChatGPT
    rolling_baseline.py  이동 기준선
    analyzer_v3.py       백분위 판정
    judge.py             근거 부족·단일 출처 억제 + 문장 생성
    crisis_filter.py     인출 필터
    core_generator.py    걸음수 → 코어 SVG
    report.py            커버리지 리포트
```

`data/`는 `.gitignore`가 차단합니다. **절대 커밋하지 마세요.**

## 수정 예정 (redesign v1 §1)

| 파일 | 무엇 | 난이도 |
|---|---|---|
| `export_app_data.py` | 축별 robust z 내보내기 추가 | 낮음 |
| `export_app_data.py` | `current` 필드 (최근 7일) 추가 | 낮음 |
| `rolling_baseline.py` | 4축 집계 추가 | 중간 |
| `judge.py` | 회복 판정 4주/3주 창 | 중간 |
