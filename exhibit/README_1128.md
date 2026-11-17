# 11/28 카이스트 전시 — 켜기·점검 (보별 맥북 프로)

전시판 = PR #38(사운드 v1.4 · 광석 이름 짓기 · 나의 공간 섬 그림 실시간 생성).
그림은 관객이 고른 6가지 + 사전에 있는 대화 단어만 오픈라우터로 보냅니다(이름·지명·대화 원문은 안 나감, 저장 안 함).
그림이 실패하거나 20초를 넘으면 지금처럼 예시 영상이 나옵니다. **그림 서버가 꺼져도 전시는 멈추지 않습니다.**

## 처음 한 번 (집에서, 30분)
| # | 할 일 | 명령 |
|---|---|---|
| 1 | PR #38 머지 (GitHub) | — |
| 2 | 맥 저장소 최신으로 | `cd ~/Downloads/damhyang-docent && git checkout main && git pull` |
| 3 | 전시판 다시 빌드 | `bash ~/Downloads/mined-exhibit/build_exhibit.sh` |
| 4 | 그림 서버 환경 만들기 | `bash ~/Downloads/damhyang-docent/exhibit/setup_1128.sh` |
| 5 | 키 확인 | `~/Downloads/mined-secrets/.env` 에 `OPENROUTER_API_KEY=...` 한 줄 (이미 챗봇이 쓰는 파일) |
| 6 | 켜기 + 점검 | 아래 「전시 당일」 그대로 한 번 해 보기 |

## 전시 당일 (5분)
1. 켜기: `bash ~/Downloads/damhyang-docent/exhibit/start_1128.sh`  (챗봇 · 시연판 · 전용 크롬 · 그림 서버가 한 번에)
2. 새 터미널 창에서 점검: `bash ~/Downloads/damhyang-docent/exhibit/check_1128.sh --real`
   - ✅ 5줄이 나오고 바탕화면에 섬 그림 1장이 열리면 끝 (약 0.04달러)
3. 눈으로 확인: 크롬에서 나의 공간 → 섬 고르기 → 방문 → 「고른 것으로 섬을 그리고 있어요」 → 7~10초 뒤 그림
4. 끄기: `bash ~/Downloads/damhyang-docent/exhibit/stop_1128.sh`

## 막힐 때
| 증상 | 할 일 |
|---|---|
| ❌ 그림 서버 꺼짐 | `setup_1128.sh` 했는지 확인 → stop → start |
| ❌ 키 없음 | `.env` 파일 확인 → stop → start |
| ❌ 시연판이 그림 서버로 안 넘김 | `start_exhibit.sh` 대신 `start_1128.sh` 로 켰는지 확인 |
| 실제 생성 실패(402·잔액) | 오픈라우터 잔액 확인. 안 되면 그대로 전시(예시 영상) |
| 와이파이 없음 | 그림·챗봇 모두 예시로 진행. 와이파이 없을 땐 기존 `start_exhibit_local.sh` |

## 비용·상한
- 1장 약 0.039달러. 1분 6장, 하루 300장(약 12달러)에서 멈추고 예시 영상으로 돌아갑니다.
- 바꾸려면 켜기 전에 `SPACE_IMAGE_PER_MIN=… SPACE_IMAGE_PER_DAY=… bash start_1128.sh`
- 로그: `~/Downloads/mined-exhibit-logs/space_image.log` (요청 내용·그림은 기록 안 함)
