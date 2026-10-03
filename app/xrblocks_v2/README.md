# Mine D XR Blocks Prototype v2

**2026-10-03** · Claude · v1 보존, `main.js`·`index.html`만 수정

## 실행
`06_발표_프로토타입`에서 `python3 -m http.server 8080` → `http://127.0.0.1:8080/MineD_XRBlocks_v2/?formFactor=desktop`

## v1 → v2
- 광석 이름을 축 규칙과 일치: 2026 호박(걸음↑) / 2022 형석(2종 교차) / 2016 황철석(걸음↓) — 웹 v4와 같은 값
- 웹 v4에서 넘어온 `mineD.xrPayload`(raw_records_exported:false)가 있으면 광석·에셋·장면·근거를 payload 값으로 표시
- 지층 라벨을 연도 범위로(「현재층·중간층·심층」 해석 제거)
- 버튼 활성 표시 버그 수정 (JS는 `.on`을 붙이는데 CSS는 `.active`만 있었음)

## 한계 (v1과 동일)
데스크톱 시뮬레이터 검증 범위. 웹 v4의 2021·2015는 XR에 층이 없어 B1으로 열림.
