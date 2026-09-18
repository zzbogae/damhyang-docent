# 빠진 의존성 (해결됨)

이 파이프라인 코드는 2026-09-13에 구글 드라이브 `01_개인/02_교육_KAIST/카이스트/02_프로젝트_결/02_파이프라인/pipeline/` 폴더에서
그대로 가져왔습니다. 그런데 이 폴더 안에 아래 두 파일이 없어서, 한동안 이 두 파일이 "팀에게서 받아야 할 진짜로 없는 파일"이라고
기록되어 있었습니다:

- `gyeol/analyzer_v3.py`  (week_to_index, week_date_range, _percentile_rank, classify_shape, build_sentence 등을 제공해야 함)
- `gyeol/report.py`       (feature_coverage, unlock_estimate, build_html, print_console 등을 제공해야 함)

**2026-09-18 업데이트: 실제로는 없어진 게 아니라, 처음 검색한 드라이브 폴더가 아닌 다른 폴더("gyeol", 폴더 id
`1ACxruHnul_0QnbEaVF4acPP9Y2OebIxA`)에 들어 있었습니다.** 이 폴더에는 `__pycache__`까지 있어서 실제로 실행해본 원본으로
보이며, 여기서 두 파일을 다시 내려받아 바이트 수(9974 / 22288)와 `ast.parse` 통과를 확인한 뒤 이 자리에 배치했습니다.
두 파일 모두 이제 `gyeol/analyzer_v3.py`, `gyeol/report.py`로 존재합니다.

같은 폴더에는 `axes.py`도 있었는데, 그건 별도 세션이 오늘 추가했을 수 있는 `gyeol/axes.py`와 겹칠 수 있어 이 커밋에서는
건드리지 않았습니다. 게다가 이 `axes.py`(25795바이트)는 헤더 주석의 특수 유니코드(원문자 ①②, 박스 구분선 등)가 밀집되어
있어, base64 전송 중 반복적으로 깨졌습니다(재다운로드 포함 두 차례 시도 모두 실패, analyzer_v3.py/report.py와 달리
byte-exact 확인에 실패). 그래서 `.candidate` 파일도 만들지 않았습니다 — 깨진 내용을 커밋하는 것보다 안 커밋하는 쪽을
택했습니다. 자세한 내용과 axes.py가 정의하는 것에 대한 구조적 분석은 이 세션의 스크래치패드에 남긴
`axes_py_comparison.md`를 참고하세요(저장소 파일이 아니라 세션 스크래치패드에만 있습니다). 후속 세션에서 이 파일을
다시 받아 병합할지 판단해야 합니다.

## 참고: 다운로드 중 발견된 별도 이슈

`run_gyeol.py`와 `gyeol/parse_kakao.py` 두 파일은 구글 드라이브에서 base64로 내려받는 과정에서
특정 구간(한국어 정규식·주석이 밀집된 영역)이 반복적으로 깨져서 전달되는 문제가 있었습니다
(동일 파일을 여러 차례 독립적으로 재다운로드해도 똑같은 위치에서 손상됨).

- `run_gyeol.py`: 나머지는 원본 그대로이며, AI 대화 집계 이후 `메모(3-b)` · `사진(3-c)` · `카카오톡(4)` 로딩
  블록의 일부 문자열/주석은 파일 내 다른 곳의 확정된 패턴(라벨명, 함수 시그니처, 로그 문구 스타일)을 근거로
  재구성했습니다. 로직·함수 호출·키 이름은 검증된 대로지만, 일부 한국어 문구는 정확한 원문과
  다를 수 있습니다.
- `gyeol/parse_kakao.py`: 상단 docstring·정규식 RE_A_DATE·RE_A_MSG는 원본과 100% 일치하도록 확인했습니다.
  그 이후 RE_B/RE_C/RE_EN 정규식과 전체 함수 본문(`parse_kakao_txt` 등)은 위와 같은 이유로
  재구성한 것입니다. `run_gyeol.py`가 기대하는 반환값 구조(`load_many` → `(msgs, senders, resolved, per_file)`,
  `extract_my_messages` → `dt/text/reply_delay_sec/is_attachment` 키)는 그대로 맞췄습니다.

원본과 완전히 동일한 버전이 필요하면 팀에게 이 두 파일만 다시 직접 공유받는 것을 권장합니다.
