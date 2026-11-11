#!/bin/bash
# 공개판(터널·중계·챗봇) 끄기
pkill -f 'run_public.sh' ; pkill -f 'cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080'
pkill -f 'uvicorn server:app --host 127.0.0.1 --port 8080' ; pkill -f 'space_boot.py'
echo "공개판 꺼짐"
