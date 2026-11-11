#!/bin/sh
# 챗봇(Gradio, 안쪽 7861) → 중계·시연판(바깥 7860)
set -e
cd /app/chatbot
GRADIO_SERVER_NAME=127.0.0.1 GRADIO_SERVER_PORT=7861 python app_exhibit.py &
cd /app
exec uvicorn server:app --host 0.0.0.0 --port 7860 --proxy-headers --forwarded-allow-ips='*'
