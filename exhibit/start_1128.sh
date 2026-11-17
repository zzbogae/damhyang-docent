#!/bin/bash
# 11/28 전시 켜기: ① 나의 공간 그림 서버(127.0.0.1:8791) ② 기존 전시(챗봇·시연판 4173·전용 크롬)
# 그림 서버가 안 떠도 전시는 켜진다 — 그때 나의 공간은 지금처럼 예시 영상으로 나온다.
set -uo pipefail
source "$(dirname "$0")/_env_1128.sh"

if lsof -ti tcp:$SPACE_PORT >/dev/null 2>&1; then
  echo "그림 서버가 이미 켜져 있습니다($SPACE_PORT)"
elif [ ! -x "$VENV/bin/python" ]; then
  echo "⚠ 그림 서버 환경이 없습니다. 먼저: bash $HERE/setup_1128.sh  (지금은 예시 영상으로 진행)"
else
  ( set -a; [ -f "$KEY_FILE" ] && source "$KEY_FILE"; set +a
    cd "$HERE" && exec "$VENV/bin/python" -m uvicorn space_only:app --host 127.0.0.1 --port $SPACE_PORT \
      >"$LOG/space_image.log" 2>&1 ) &
  for i in $(seq 1 20); do curl -sf "http://127.0.0.1:$SPACE_PORT/api/space/health" >/dev/null && break; sleep 0.5; done
  curl -sf "http://127.0.0.1:$SPACE_PORT/api/space/health" | grep -q '"key":true' \
    && echo "그림 서버 켜짐 (키 있음)" || echo "⚠ 그림 서버가 키 없이 떴거나 안 떴습니다 → 로그 $LOG/space_image.log"
fi

# 시연판(vite preview)이 /api/space 를 그림 서버로 넘기게 한다 (webapp/web/vite.config.ts 의 preview.proxy)
export SPACE_API_URL="http://127.0.0.1:$SPACE_PORT"
exec bash "$EXHIBIT_DIR/start_exhibit.sh" "$@"
