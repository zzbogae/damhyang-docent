#!/bin/bash
# 처음 한 번(집에서, 인터넷 될 때): 그림 서버용 파이썬 환경을 만든다. 다시 돌려도 괜찮다.
set -euo pipefail
source "$(dirname "$0")/_env_1128.sh"
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/pip" install -q --upgrade pip
"$VENV/bin/pip" install -q fastapi uvicorn httpx pillow
"$VENV/bin/python" -c "import fastapi, uvicorn, httpx, PIL; print('그림 서버 환경 준비 완료:', '$VENV')"
[ -f "$KEY_FILE" ] && grep -q '^OPENROUTER_API_KEY=.' "$KEY_FILE" && echo "키 파일 확인: $KEY_FILE" \
  || echo "⚠ 키 파일이 없거나 비었습니다: $KEY_FILE (OPENROUTER_API_KEY=... 한 줄)"
