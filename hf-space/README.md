---
title: Mine D 시연판
emoji: 🪨
colorFrom: gray
colorTo: indigo
sdk: docker
app_port: 8080
pinned: false
---

# Mine D 공개 시연판 + 민디 챗봇 (전시용)

- `/` : Mine D 시연판(합성 인물 샘플, `VITE_DEMO_SNAPSHOT=1` 빌드)
- `/api/lifebot/*` : 같은 컨테이너 안의 라이프로그 챗봇 전시 모드로 중계
- 챗봇: 팀 1조 이서연님 라이프로그 챗봇(코드 사본 사용 허락) + 전시 모드. **합성 인물 「민」 데이터(data_demo)만** 들어 있습니다. 실제 개인 기록은 없습니다.
- 답 생성: OpenRouter(Space Secret `OPENROUTER_API_KEY`). 기억 검색: bge-m3(CPU).
- 대화 원문은 저장하지 않습니다. 공개 주소이므로 IP당·하루 호출 상한이 있습니다.

HERIZON × Social Computing Lab
