# pipeline

`gyeol_kit/` 은 드라이브 `gyeol_kit/code/` 의 9/12 판입니다(`_backup*`, `out/`, `__pycache__/` 제외). 4축 판정의 정본은 `gyeol/axes.py` 입니다.

```
gyeol_kit/
  run_gyeol.py          리포트
  build_axes_json.py    4축 판정 JSON (axes.py 사용)
  calibrate_axes.py     τ 캘리브레이션
  compare_specs.py      스펙 비교
  check_rest.py         쉼 축 점검
  export_app_data.py    앱용 JSON
  gyeol/
    axes.py             4축·τ·광물·결 — 정본
    channels.py         채널 정의
    detect.py           파일 내용으로 채널 판별
    parse_*.py          건강·Takeout·카톡·AI·메모·사진 파서
    rolling_baseline.py 이동 기준선
    analyzer_v3.py      백분위 판정
    judge.py            근거 부족·단일 출처 억제 + 문장 생성
    crisis_filter.py    인출 필터
    report.py           커버리지 리포트
```

`data/` 는 `.gitignore`가 차단합니다. **절대 커밋하지 마세요.**

NOW(10/2) 의 열린 일 가운데 파이프라인 몫: `apply_principles.py`·`add_relics.py` 를 `run_gyeol.py` 에 흡수, `pickGem` 을 축·방향·교차검증 기준으로, 쉼 축 밤 무기록 대체 지표(웹앱 `webapp/web/src/import/quiet.ts` 에 구현돼 있음).
