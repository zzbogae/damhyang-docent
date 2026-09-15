# 가져오기 규칙

브라우저 파서(`web/src/import/`)와 합성 인물 생성기(`synth/make_persona.py`)는 이 문서의 규칙을 똑같이 쓴다. 생성기가 원천 파일과 함께 만드는 정답 표(`truth_daily.json`)는 파서가 이 규칙대로 원천 파일을 읽었을 때 나와야 하는 값이다. 규칙을 바꾸면 두 쪽(`web/src/import/rules.ts`, `synth/rules.py`)을 함께 고친다.

## 공통

- 시간대는 한국 시간(UTC+9, 서머타임 없음)으로 본다. UTC 로 적힌 시각은 9시간을 더해 현지 날짜·시각을 구한다.
- 새벽은 현지 시각 00:00~04:59 이다(`night_hours = [0, 5]`).
- 글자 수는 유니코드 코드 포인트 수다(JS `[...s].length`, Python `len(s)`). 텍스트는 NFC 로 정규화한 뒤 센다.
- zip 안의 경로와 파일 이름은 NFC 로 정규화한 뒤 판별한다.

## 유튜브 (Google Takeout)

- 시청 기록: `…/YouTube 및 YouTube Music/기록/시청 기록.json`, `…/YouTube and YouTube Music/history/watch-history.json`
- 검색 기록: 같은 폴더의 `검색 기록.json`, `search-history.json`
- 항목마다 `time`(UTC ISO)을 현지 시각으로 바꿔 날짜·시각을 정한다.
- 광고 항목(`details` 에 `Google 광고` 또는 `From Google Ads` 가 있는 항목)은 세지 않는다.
- `yt_watch_n` 은 시청 항목 수, `yt_watch_night_n` 은 그중 새벽 항목 수, `yt_search_n` 은 검색 항목 수다.
- HTML 형식(`시청 기록.html`)은 지원하지 않는다. 내보낼 때 형식을 JSON 으로 고르도록 안내한다.

## Keep 메모 (Google Takeout)

- `…/Keep/*.json` 파일 하나가 메모 하나다. 같은 이름의 `.html` 은 무시한다.
- `isTrashed: true` 인 메모는 세지 않는다.
- 작성 시각은 `createdTimestampUsec`, 없으면 `userEditedTimestampUsec`(UTC 마이크로초)다.
- 본문은 `textContent`, 체크리스트면 `listContent[].text` 를 줄바꿈으로 이은 것이다. 본문과 `title` 이 모두 비어 있으면 세지 않는다.
- `memo_chars` 는 본문(앞뒤 공백 제거)의 글자 수 합이다. 제목은 세지 않는다.
- 메모 ID 는 `keep:<zip 안 경로>` 다.

## 캘린더 (ICS)

- `.ics` 파일의 `VEVENT` 하나가 일정 하나다. `STATUS:CANCELLED` 는 세지 않는다.
- `DTSTART` 가 `Z` 로 끝나면 UTC, `TZID=Asia/Seoul` 이거나 시간대 표시가 없으면 현지 벽시계 시각, `VALUE=DATE` 면 그 날짜다. 다른 `TZID` 는 브라우저의 시간대 데이터로 바꾼다.
- 반복 일정(`RRULE`)은 펼쳐서 발생마다 한 건으로 센다. `COUNT`·`UNTIL` 이 없으면 같은 파일에서 반복이 아닌 일정(상태와 관계없이) 가운데 가장 늦은 현지 시작 날짜까지 펼치고, 그런 일정이 없으면 첫 발생부터 1년까지만 펼친다. `EXDATE` 에 든 발생은 뺀다. `RECURRENCE-ID` 로 바뀐 발생은 원래 발생 대신 바뀐 일정 한 건으로 센다.
- `cal_n` 은 현지 시작 날짜 기준 일정 수다.

## 건강

### 애플 건강 (`apple_health_export/export.xml`)

- 파일이 GB 단위일 수 있으므로 스트림으로 읽는다. `export_cda.xml` 은 무시한다.
- 걸음: `HKQuantityTypeIdentifierStepCount` 의 `value` 를 `startDate` 의 현지 날짜·`sourceName` 별로 더한다. 하루에 출처가 여럿이면(아이폰과 워치가 같은 걸음을 함께 잰 경우) 합이 가장 큰 출처의 값을 그날 걸음으로 쓴다.
- 잠: `HKCategoryTypeIdentifierSleepAnalysis` 중 `value` 가 `HKCategoryValueSleepAnalysisAsleep*`(Asleep, AsleepCore, AsleepDeep, AsleepREM, AsleepUnspecified)인 기록만 쓴다. `InBed`, `Awake` 는 세지 않는다. 출처별로 구간을 시작 시각순으로 놓고, 앞 세션의 끝에서 90분 넘게 떨어진 구간부터 새 세션(한 번의 잠)으로 묶는다. 세션의 잠든 분 합을 세션 끝 시각의 현지 날짜(깬 날짜)에 더하고, 하루에 출처가 여럿이면 가장 큰 값을 쓴다. 자정 전에 끝나는 구간도 같은 세션이면 깬 날짜로 들어간다.
- 날짜 문자열은 `2019-01-01 08:00:00 +0900` 형식이다. 오프셋을 반영해 UTC 로 바꾼 뒤 현지 시각을 구한다.
- `ExportDate` 는 내보낸 날짜 후보로 쓴다.

### 삼성 헬스 (CSV)

- 첫 줄은 메타 행(`com.samsung.shealth.…,버전,개수`)이고 둘째 줄이 열 이름이다. 열 이름은 `com.samsung.health.sleep.start_time` 처럼 접두어가 붙을 수 있으므로 마지막 점 뒤 이름으로 찾는다.
- 걸음: `…pedometer_day_summary.*.csv` 의 `day_time`(해당 날짜 00:00 UTC 의 밀리초)과 `step_count`. 같은 날 행이 여럿이면(기기별) 가장 큰 값을 쓴다.
- 잠: `….sleep.<숫자>.csv` 의 `start_time`·`end_time`(UTC, `YYYY-MM-DD HH:MM:SS.sss`)과 `time_offset`(`UTC+0900`). 시작·끝이 같은 행은 한 번만 센다. 애플 건강과 같은 세션 규칙(90분)으로 묶어 깬 날짜에 더한다. `…sleep_stage…` 파일은 무시한다.

### 건강 채널 기록 수

채널 메타의 `records` 는 걸음이나 잠 기록이 있는 날의 수다.

## 사진

- 날짜·시각은 EXIF `DateTimeOriginal` → `CreateDate` → Google 포토 사이드카(`photoTakenTime.timestamp`, UTC 초) → 파일 이름 순서로 찾는다. Takeout 의 Google 포토는 사이드카를 먼저 본다. EXIF 시각은 현지 벽시계 시각으로 그대로 쓴다.
- 파일 이름 날짜 패턴: `Screenshot_YYYYMMDD-HHMMSS`, `스크린샷 YYYY-MM-DD 오전|오후 H.MM.SS`, `IMG_YYYYMMDD_HHMMSS`, `YYYYMMDD_HHMMSS`.
- 날짜를 찾지 못한 사진은 색인하지 않는다(경고로만 센다).
- 화면 캡처 = EXIF 에 `Make`·`Model` 이 없고, PNG 이거나 파일 이름이 스크린샷 패턴(`Screenshot`, `스크린샷`, `Screen Shot`)인 이미지. 화면 캡처는 `PhotoRecord` 로 남기되 `photo_n`·`photo_night_n` 에는 넣지 않는다.
- 사이드카 짝은 같은 폴더 안에서 사이드카의 `title`(원래 파일 이름)으로 찾는다.
- 사진 ID 는 `ph:<경로>` 다. 폴더에서 고른 사진의 경로는 `webkitRelativePath`, zip 안 사진은 `<zip 이름>::<zip 안 경로>` 다.

## 카카오톡 (txt)

- 형식 세 가지를 읽는다.
  - PC: 날짜 줄 `--------------- 2023년 1월 1일 일요일 ---------------`, 메시지 줄 `[이름] [오후 3:04] 내용`
  - 안드로이드: `2023년 1월 1일 오후 3:04, 이름 : 내용`
  - iOS: `2023. 1. 1. 오후 3:04, 이름 : 내용`
- 메시지 줄 형식이 아닌 줄은 앞 메시지의 이어지는 줄로 본다(줄바꿈 `\n` 으로 잇는다). 단, 빈 줄, 날짜 줄(`2023년 1월 1일 일요일`, PC 의 `---- … ----`), 파일 머리말(`… 님과 카카오톡 대화`, `저장한 날짜 : …`)은 무시한다. 모바일 형식에서 시각으로 시작하지만 `이름 : ` 이 없는 줄(`…, 홍길동님이 들어왔습니다.`)은 시스템 줄로 보고 무시한다. PC 형식의 시스템 줄은 구분할 수 없어 이어지는 줄로 들어간다(알려진 한계).
- 오전 12시는 0시, 오후 12시는 12시다. 시각은 현지 벽시계 시각이다.
- "나"는 모든 대화 파일을 통틀어 가장 많이 등장한 참여자(등장한 파일 수가 가장 많은 사람, 같으면 메시지 수가 많은 사람)다. 화면에서 바꿀 수 있다.
- 내 메시지만 센다: `kakao_n`(수), `kakao_night_n`(새벽에 보낸 수), `kakao_chars`(글자 수 합, 이어지는 줄의 `\n` 도 1자로 셈).
- 답장: 같은 대화 파일 안에서 바로 앞 메시지를 상대가 보냈고 이번 메시지를 내가 보냈으면 답장 한 번이다. 지연 = 이번 메시지 시각 − 바로 앞 메시지 시각(분), 0~360 으로 자른다. 답장 메시지의 현지 날짜에 `kakao_reply_n` 과 `kakao_reply_min_sum` 을 더한다.
- 1인칭: 메시지를 공백으로 나눈 토큰의 앞뒤에서 글자·숫자가 아닌 문자를 떼어 낸 뒤, 토큰이 `^(나|내|저|제)(는|도|가|를|랑|한테|에게|만)?$` 이면 1인칭 토큰이다. 1인칭 토큰이 하나라도 있는 내 메시지 수가 `kakao_first_n` 이다.
- 단정어: 내 메시지에 아래 낱말 중 하나라도 들어 있으면(부분 문자열) 단정어 메시지다. `반드시, 절대, 무조건, 항상, 전혀, 당연히, 확실히, 분명히, 틀림없이, 결코`. 그 수가 `kakao_assert_n` 이다.
- 채널 메타의 `records` 는 내 메시지 수다. `저장한 날짜` 는 내보낸 날짜 후보로 쓴다.

## 채널 메타

- `first`·`last` 는 그 채널에서 센 기록의 가장 이른·늦은 현지 날짜다.
- `records`: 메모 수, 센 사진 수(화면 캡처 제외), 유튜브 시청+검색 항목 수, 일정 수(반복 펼친 뒤), 카톡 내 메시지 수, 건강 기록이 있는 날 수.
- `export_date` 는 Takeout zip 이름의 날짜(`takeout-YYYYMMDDTHHMMSSZ-001.zip`, UTC→현지), 애플 건강 `ExportDate`, 카톡 `저장한 날짜` 가운데 가장 늦은 현지 날짜다. 하나도 없으면 비워 둔다.
- `gaps` 는 파서가 채우지 않는다(사용자가 알려 주는 값).

## 일 단위 표 출력

- 기록이 하나라도 있는 날만 행을 만들고 날짜순으로 정렬한다.
- 개수 필드는 0 이면 키를 넣지 않는다. `kakao_reply_min_sum` 은 `kakao_reply_n` 이 있으면 0 이어도 넣는다.
- `steps` 는 정수로 반올림, `sleep_min` 은 분 단위 합을 마지막에 정수로 반올림한다.


## 추가 형식 (2026-09-12)

- **유튜브 Takeout HTML**(`시청 기록.html`·`watch-history.html`, `검색 기록.html`·`search-history.html`): Takeout 기본 형식. `outer-cell` 단위로 조각을 잘라 읽고(DOMParser 없음, 파일 전체를 메모리에 올리지 않음), 첫 본문 칸의 마지막 줄을 날짜로 읽는다. 날짜 줄은 한국어(`2023. 1. 1. 오후 3:04:05 KST`)와 영어(`Jan 1, 2023, 3:04:05 PM KST`, PM 앞 공백이 U+202F 인 판 포함)를 읽고, 표시된 시간대가 KST 가 아니면 한국 시각으로 옮긴다(UTC·GMT±n·PST 등). 캡션에 `Google 광고`·`From Google Ads` 가 있으면 광고로 빼고, 첫 줄이 설문 응답(`Answered survey question`, 한국어는 '설문…에 답변' 추정)이면 뺀다.
- **구글 피트니스**(`Fit`·`피트니스`): `Daily activity metrics/Daily activity metrics.csv`(합계 파일만, 날짜별 파일은 무시)의 `Step count` 를 그날 걸음수로, `All Sessions/*.json` 의 `fitnessActivity` 가 `sleep` 으로 시작하는 세션을 잠 구간으로 넣는다. 합계 CSV 에 `Sleep duration (ms)` 가 있으면 그날 아침 7시에 깬 잠으로 놓되, 출처를 따로 두어 세션과 겹쳐 세지 않는다(하루 값은 출처 중 큰 값). 한국어 판 폴더 이름·머리글(`피트니스`, `일일 활동 측정항목`, `걸음 수`, `날짜`)은 실물을 확인하지 못한 추정이다.
- **사진 폴더 핸들**(크롬·엣지): "사진 폴더 고르기"가 File System Access API 로 폴더 핸들을 IndexedDB 에 저장한다. 새로고침 뒤 세션 레지스트리에 원본이 없으면, 권한이 있을 때 핸들 안에서 상대 경로(폴더이름/하위/파일, NFC·NFD 모두)로 찾는다. 권한이 없으면 주 화면의 "사진 폴더 다시 연결"로 다시 받는다. 사파리·파이어폭스는 지금처럼 폴더를 다시 고른다.

## 새 채널 (2026-09-12, 원페이지 02절 "SNS·AI 대화 연동")

- **인스타그램**(내 정보 다운로드, JSON): `content/posts_N.json`(게시물 1건 = 1), `content/stories.json`, `content/reels.json` 의 올린 시각으로 `sns_post_n`, `messages/inbox/*/message_N.json` 에서 내가 보낸 메시지로 `sns_dm_n`·`sns_dm_night_n` 을 센다. 앞에 `your_instagram_activity/` 가 붙은 판과 없는 판을 모두 읽는다. 인스타그램은 한글을 UTF-8 바이트 단위(`\u00XX`)로 적으므로 되살린다. "나"는 `personal_information/personal_information/personal_information.json` 의 이름, 없으면 가장 많은 대화방에 나오는 사람. 올린 사진 파일(`media/posts/…`)은 카메라 사진과 겹치므로 사진 채널에 넣지 않는다. 캡션·메시지 원문은 저장하지 않는다.
- **AI 대화**(`conversations.json`): ChatGPT 판(`mapping` 나무, `author.role == "user"`, `create_time` 초, 숨긴 메시지 제외)과 Claude 판(`chat_messages`, `sender == "human"`, `created_at` ISO)을 내용으로 가린다. 내가 보낸 메시지 수(`ai_msg_n`), 새벽 메시지 수(`ai_msg_night_n`), 글자 수 합(`ai_chars`)만 남긴다.
