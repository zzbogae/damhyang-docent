# 빠진 의존성

이 파이프라인 코드는 2026-09-13에 구글 드라이브 `01_개인/02_교육_KAIST/카이스트/02_프로젝트_결/02_파이프라인/pipeline/` 폴더에서
그대로 가져왔습니다. 그런데 이 폴더 안에 아래 두 파일이 없습니다 (judge.py, rolling_baseline.py, export_app_data.py,
make_wall.py 등 여러 파일이 이 두 모듈을 import 합니다):

- `gyeol/analyzer_v3.py`  (week_to_index, week_date_range, _percentile_rank, classify_shape, build_sentence 등을 제공해야 함)
- `gyeol/report.py`       (feature_coverage, unlock_estimate, build_html, print_console 등을 제공해야 함)

두 파일 없이는 이 코드가 실행되지 않습니다. 팀에게 요청해서 받아야 합니다.

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
