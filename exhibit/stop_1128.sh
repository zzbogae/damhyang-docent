#!/bin/bash
# 11/28 전시 끄기: 기존 전시 + 그림 서버
source "$(dirname "$0")/_env_1128.sh"
[ -f "$EXHIBIT_DIR/stop_exhibit.sh" ] && bash "$EXHIBIT_DIR/stop_exhibit.sh"
pids=$(lsof -ti tcp:$SPACE_PORT 2>/dev/null); [ -n "$pids" ] && kill $pids && echo "그림 서버 끔"
true
