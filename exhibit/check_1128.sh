#!/bin/bash
# 5분 자가 점검. start_1128.sh 로 켠 뒤 다른 터미널에서:  bash check_1128.sh        (돈 안 듦)
#                                                          bash check_1128.sh --real (그림 1장 실제 생성, 약 0.04달러)
source "$(dirname "$0")/_env_1128.sh"
ok(){ echo "✅ $1"; }; bad(){ echo "❌ $1"; FAIL=1; }; FAIL=0
H=$(curl -sf "http://127.0.0.1:$SPACE_PORT/api/space/health") && ok "그림 서버 켜짐 ($SPACE_PORT)" || bad "그림 서버 꺼짐 → start_1128.sh 로 다시 켜기"
echo "$H" | grep -q '"key":true' && ok "오픈라우터 키 들어감" || bad "키 없음 → $KEY_FILE 확인 후 stop_1128.sh·start_1128.sh"
curl -sf "http://127.0.0.1:$WEB_PORT/" >/dev/null && ok "시연판 켜짐 ($WEB_PORT)" || bad "시연판 꺼짐"
# 시연판 → 그림 서버 중계: 빈 본문을 보내 404가 아니면 연결된 것 (빈 본문은 생성하지 않음… 대신 413/400/429/503/502 중 하나)
C=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://127.0.0.1:$WEB_PORT/api/space/image" -H 'content-type: application/json' --data-binary @<(head -c 5000 /dev/zero | tr '\0' 'x'))
[ "$C" = "413" ] && ok "시연판 → 그림 서버 연결" || bad "시연판이 그림 서버로 안 넘김(코드 $C) → start_1128.sh 로 켰는지 확인"
if [ "${1:-}" = "--real" ]; then
  mkdir -p "$HOME/Desktop"; OUT="$HOME/Desktop/mined_space_check_$(date +%H%M%S).jpg"
  R=$(curl -s -X POST "http://127.0.0.1:$WEB_PORT/api/space/image" -H 'content-type: application/json' \
      -d '{"island":"sea","time":"해질녘","weather":["여름","햇살"],"place":"바다","dwelling":"오두막","words":["부두","컵"]}')
  if echo "$R" | grep -q '"image":"data:image/'; then
    echo "$R" | "$VENV/bin/python" -c "import sys,json,base64;j=json.load(sys.stdin);open(sys.argv[1],'wb').write(base64.b64decode(j['image'].split(',',1)[1]));print(f\"✅ 실제 생성 {j.get('ms')}ms, 비용 {j.get('cost')}\")" "$OUT"
    open "$OUT" 2>/dev/null; echo "   그림: $OUT (바탕화면)"
  else bad "실제 생성 실패: $(echo "$R" | head -c 200)"; fi
fi
[ $FAIL = 0 ] && echo "— 모두 정상. 크롬에서 나의 공간 → 섬 방문으로 눈으로 한 번 확인하세요." || echo "— 위 ❌ 항목을 고친 뒤 다시 점검하세요. 그림이 안 돼도 나의 공간은 예시 영상으로 나옵니다."
