#!/bin/bash
# 집 맥에서 공개 시연판(+챗봇)을 띄우고 무료 Cloudflare 터널로 연다.
# - 챗봇: ~/Downloads/mined-hf-space/chatbot (합성 인물 data_demo 공개판 사본, 127.0.0.1:7860)
# - 중계+시연판: server.py (127.0.0.1:8080) ← 터널은 이것만 연다(챗봇 7860은 열지 않음)
# - 터널 주소가 바뀌면 live-target 브랜치 target.json 을 갱신 → 고정 주소 docs/live/ 가 그리로 넘김
# - caffeinate 로 잠자기 방지. 멈추면 stop_public.sh
set -uo pipefail
OUT=${OUT:-~/Downloads/mined-hf-space}
PY=${PY:-python}                       # sentence-transformers 가 설치된 환경의 python
REPO=${REPO:-~/Downloads/mined-hf-src} # live-target 브랜치를 push 할 작업트리(별도)
LOG=${LOG:-~/Downloads/mined-public-logs}
mkdir -p "$LOG"

lsof -ti tcp:7860 >/dev/null && { echo "7860 사용 중 — 전시판 챗봇(stop_exhibit.sh)을 먼저 끄세요"; exit 1; }

caffeinate -dimsu -w $$ &

( cd "$OUT/chatbot" && LIFEBOT_OR_FALLBACK=none OPENROUTER_ENV_FILE=~/Downloads/mined-secrets/.env \
    exec "$PY" space_boot.py >"$LOG/chatbot.log" 2>&1 ) &
for i in $(seq 1 240); do curl -sf http://127.0.0.1:7860/gradio_api/info >/dev/null && break; sleep 1; done

( cd "$OUT" && DEMO_DIR="$OUT/demo" exec "$PY" -m uvicorn server:app --host 127.0.0.1 --port 8080 \
    --proxy-headers --forwarded-allow-ips='*' >"$LOG/server.log" 2>&1 ) &
sleep 3

publish() {  # $1 = https://xxx.trycloudflare.com
  local wt="$REPO-live"
  [ -d "$wt" ] || git -C "$REPO" worktree add -q "$wt" -B live-target origin/live-target 2>/dev/null \
    || { git -C "$REPO" worktree add -q --detach "$wt" && git -C "$wt" checkout -q --orphan live-target && git -C "$wt" rm -rfq . ; }
  printf '{"url":"%s","at":"%s"}\n' "$1" "$(date -u +%FT%TZ)" > "$wt/target.json"
  git -C "$wt" add target.json && git -C "$wt" commit -qm "live: tunnel address" && git -C "$wt" push -q -u origin live-target \
    && echo "고정 주소 갱신: $1"
}

# 터널이 끊기면 다시 열고 주소를 다시 올린다
while true; do
  cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080 2>&1 | tee -a "$LOG/tunnel.log" | while read -r line; do
    url=$(echo "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1)
    [ -n "$url" ] && publish "$url"
  done
  echo "터널 끊김 — 5초 뒤 다시"; sleep 5
done
