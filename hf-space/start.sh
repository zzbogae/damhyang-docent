#!/bin/sh
# 챗봇(전시 모드, 안쪽 127.0.0.1:7860 — app_mined.py 고정) → 중계·시연판(바깥 8080)
set -e
cd /app/chatbot
python space_boot.py &
cd /app
exec uvicorn server:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips='*'
