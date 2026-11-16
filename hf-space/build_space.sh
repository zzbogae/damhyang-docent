#!/bin/bash
# 맥에서 실행: Space에 올릴 폴더를 ~/Downloads/mined-hf-space 에 만든다(업로드는 하지 않음).
# 실제 기록(data/)·키·.auth·usage.jsonl은 넣지 않는다.
set -euo pipefail
SRC=~/Downloads/lifelog-chatbot
WEB=~/Downloads/damhyang-docent
OUT=~/Downloads/mined-hf-space
HERE="$(cd "$(dirname "$0")" && pwd)"
rm -rf "$OUT"; mkdir -p "$OUT/chatbot"
cp "$HERE"/{server.py,start.sh,Dockerfile,requirements.txt,README.md} "$OUT/"
# 나의 공간 그림 생성 중계(server.py 가 import) + 섬 키워드 사전(space_words.py 가 server.py 옆에서 먼저 찾는다)
cp "$HERE"/{space_image.py,space_prompt.py,space_words.py} "$OUT/"
cp "$WEB/webapp/web/src/space/islandKeywords.json" "$OUT/"
cp "$HERE/space_boot.py" "$OUT/chatbot/"
# 챗봇 코드(원본 그대로) + 합성 데이터
rsync -a --exclude '__pycache__' --exclude '*.bak*' "$SRC/lifebot" "$OUT/chatbot/"
cp "$SRC"/{app_mined.py,app_exhibit.py} "$OUT/chatbot/"
[ -d "$SRC/mined_web" ] && rsync -a "$SRC/mined_web" "$OUT/chatbot/"
rsync -a --exclude 'usage.jsonl' --exclude 'islands/*' "$SRC/data_demo" "$OUT/chatbot/"
mkdir -p "$OUT/chatbot/data_demo/islands"
test -f "$OUT/chatbot/data_demo/SYNTHETIC" || { echo "SYNTHETIC 표지 없음 — 중단"; exit 1; }
# 시연판 빌드
( cd "$WEB/webapp/web" && VITE_DEMO_SNAPSHOT=1 npx vite build --base=./ --outDir "$OUT/demo" --emptyOutDir )
[ -d "$WEB/docs/demo/demo" ] && rsync -a "$WEB/docs/demo/demo" "$OUT/demo/"
[ -d "$WEB/docs/demo/sound" ] && rsync -a "$WEB/docs/demo/sound" "$OUT/demo/"
# 마지막 점검: 금지 파일
if find "$OUT" \( -name '.env' -o -name '.auth' -o -path '*/data/*' -o -name 'usage.jsonl' \) | grep -q .; then echo "금지 파일 발견 — 중단"; exit 1; fi
du -sh "$OUT"; echo "준비 완료: $OUT"
