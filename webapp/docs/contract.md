# 모듈 사이 데이터 계약

브라우저 가져오기(JS)와 판정 코어(Python)는 아래 세 가지로만 주고받는다. 원문 텍스트와 사진은 판정 코어로 넘기지 않는다.

## 1. 일 단위 표 (JS → Python)

하루에 한 행. 키가 없으면 그날 그 값의 기록이 없다는 뜻이다.

| 필드 | 채널 | 뜻 |
|---|---|---|
| `date` | 공통 | 현지 날짜 `YYYY-MM-DD` (기본 Asia/Seoul) |
| `steps` | health | 그날 걸음수 합. 키가 있으면 그날 건강 기록이 있는 날 |
| `sleep_min` | health | 그날 잠든 시간(분). 잠에서 깬 날짜 기준 |
| `memo_n`, `memo_chars`, `memo_night_n` | memo | 작성한 메모 수, 글자 수 합, 새벽(00~05시)에 쓴 메모 수 |
| `photo_n`, `photo_night_n` | photo | 찍은 사진 수, 새벽에 찍은 사진 수 |
| `yt_watch_n`, `yt_watch_night_n`, `yt_search_n` | yt | 시청 수, 새벽 시청 수, 검색 수 |
| `cal_n` | cal | 그날 시작하는 일정 수 |
| `kakao_n`, `kakao_night_n`, `kakao_chars` | kakao | 내가 보낸 메시지 수, 새벽에 보낸 수, 글자 수 합 |
| `kakao_reply_n`, `kakao_reply_min_sum` | kakao | 상대 메시지 뒤 내가 답한 횟수, 답장까지 걸린 분의 합(한 번에 최대 360분) |
| `kakao_first_n`, `kakao_assert_n` | kakao | 1인칭(나·내·저·제)이 들어간 메시지 수, 단정어가 들어간 메시지 수 |
| `sns_post_n`, `sns_dm_n`, `sns_dm_night_n` | sns | 인스타그램에 올린 게시물·스토리·릴스 수, 내가 보낸 DM 수, 새벽에 보낸 DM 수 |
| `ai_msg_n`, `ai_msg_night_n`, `ai_chars` | ai | AI(ChatGPT·Claude)에게 보낸 메시지 수, 새벽에 보낸 수, 글자 수 합 |

개수 채널(memo·photo·yt·cal·kakao·sns·ai)은 채널의 활동 범위 안에서 키가 없으면 0으로 본다. 건강(steps·sleep_min)은 키가 없으면 결측이다.

## 2. 채널 메타 (JS → Python)

```json
{
  "tz": "Asia/Seoul",
  "night_hours": [0, 5],
  "export_date": "2026-09-01",
  "channels": {
    "memo":  { "first": "2011-03-02", "last": "2026-08-30", "sources": ["keep"], "records": 3097 },
    "photo": { "first": "2012-01-08", "last": "2026-08-29", "sources": ["folder"], "records": 20465 }
  },
  "gaps": { "kakao": [["2016-01-01", "2017-12-31"]] }
}
```

`gaps` 는 사용자가 알려 준 구조적 결측(백업 안 한 기간 등)이다. 없으면 코어가 0 연속 길이 규칙으로 찾는다.

## 3. 판정 결과 (Python → JS)

`mined_core.run(daily_rows, meta, config=None)` 가 돌려주는 JSON. 스키마는 `schema/mined.week.v8.schema.json`.

v8(2026-10-03, 팀 9/23 확정 규칙 반영)에서 바뀐 필드:

- `axes` 키: `move`·`rest`·`watch`·`leave`(화면 이름 걸음·쉼·화면·기록). 각 축에 `z`(축 안 게이지 지표 robust z 의 중앙값)가 붙는다
- `gyeol`: 결(줄무늬). 밴드 `|z| < band` 밖의 축 수로 `mixed`(2축 이상)·`coarse`(1축)·`regular`(0축)
- `grade`: 확인 등급 `held`·`returned`·`open`·`insufficient`·`broken`·`not_returned`, 판정되지 않은 주는 `null`(이탈 없음)
- `grade_history`: `[{as_of, grade}]` — 그 시점에 화면에 무엇이 나갔는지
- `return_week`·`hold_until`: 복귀 주와 지속 창 끝 주(`YYYY-Www`). 카드가 그리는 구간은 언제나 이 둘 사이
- `mineral`: 9종(축 × 방향 8종 + 형석)
- 없어진 필드: `tier`, `tier_history`, `recovered_after`
- `summary.tiers` → `summary.grades`

```json
{
  "schema": "mined.result/8",
  "config": { "window": 52, "min_base": 26, "q_badge": 0.05 },
  "weeks": [ { "schema": "mined.week/8", "week": "2017-W07", "candidate": true, "grade": "broken",
               "return_week": "2017-W09", "hold_until": "2017-W13", "mineral": "월장석", "gyeol": "coarse" } ],
  "eras": [ { "id": "era-01", "start": "2012-01-02", "end": "2013-05-26" } ],
  "summary": { "n_weeks": 796, "n_candidates": 204, "n_cross": 136 }
}
```

`weeks` 는 첫 주부터 마지막 주까지 모든 주를 담는다(지층 화면과 4축 게이지가 모든 주를 쓴다). 판정된 주는 `candidate: true`.

## 4. 브라우저 저장소 (IndexedDB, 판정 코어로 넘기지 않음)

- `memos`: `{ id, ts, date, week, hour, text, chars, source, title?, flags? }` — `flags` 는 `{ secret, secretKinds, crisis }`
- `photos`: `{ id, date, week, hour, name, path, size, mime, source, hasExif, make?, model?, filter? }` — 원본 바이트는 저장하지 않고, 필터를 통과한 사진의 작은 미리보기만 `thumbs` 에 저장
- `daily`, `meta`, `result`: 위 1~3
- `labels`: `{ id, week, name, createdAt }`
- `state`: 민디가 첫 인사를 했는지 등
- `kv.letters`: 편지 `{ id, horizon, text, written_at, opens_at, opened_at? }` — `opens_at` 은 화면에 내지 않는다

카카오톡·유튜브·캘린더는 집계값만 남기고 메시지·제목 원문은 저장하지 않는다.
