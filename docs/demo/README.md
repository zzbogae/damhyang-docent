# Mine D 홈페이지 v2 시연판

- 주소: GitHub Pages(이 저장소) `…/demo/` — 카톡 등 인앱 브라우저에서도 바로 열림
- 내용: `webapp/web`을 `VITE_DEMO_SNAPSHOT=1 npx vite build --base=./`로 빌드한 정적 파일. 가짜 샘플 기록(합성)만 들어 있음. 실제 개인 기록 없음
- 다시 만들기: 빌드 뒤 `pyodide/ sample/ dev/ sw.js`를 빼고 `demo/snapshot.json`(합성 판정 스냅숏)을 넣는다
