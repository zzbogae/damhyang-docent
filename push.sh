#!/usr/bin/env bash
# 민디(MineD) — 깃허브에 올리기
#
#   bash push.sh                       (저장소 이름 기본값 mined)
#   bash push.sh 원하는이름
#   bash push.sh 이름 public           (기본은 private)
#
# gh CLI가 있으면 저장소 생성까지 자동으로 합니다.
# 없으면 깃허브에서 빈 저장소를 만든 뒤 URL만 붙여넣으면 됩니다.

set -euo pipefail

NAME="${1:-mined}"
VIS="${2:-private}"

cd "$(dirname "$0")"

# ── 0. 여기가 repo인지 확인 ────────────────────────────────
if [ ! -d .git ]; then
  echo "✗ .git 폴더가 없습니다. zip을 풀 때 폴더째로 풀렸는지 확인하세요."
  exit 1
fi

# ── 1. 개인정보 최종 검사 ──────────────────────────────────
echo "▸ 개인정보 검사"
SUSPECT=$(git ls-files | grep -Ei '\.(zip|jpg|jpeg|heic|mp4|csv)$|카톡|카카오|takeout|bokyung' || true)
if [ -n "$SUSPECT" ]; then
  echo "⚠ 아래 파일이 저장소에 들어 있습니다. 확인하고 지운 뒤 다시 실행하세요."
  echo "$SUSPECT"
  exit 1
fi
echo "  ✅ 원본 데이터 없음"

# ── 2. 커밋 안 된 변경 있으면 커밋 ─────────────────────────
if [ -n "$(git status --porcelain)" ]; then
  echo "▸ 변경사항 커밋"
  git add -A
  git commit -q -m "작업 반영"
fi

# ── 3. 올리기 ──────────────────────────────────────────────
if git remote get-url origin >/dev/null 2>&1; then
  echo "▸ origin 이 이미 설정돼 있습니다 — 그대로 푸시합니다"
  git push -u origin main
  echo "✅ 완료"
  exit 0
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "▸ gh CLI로 저장소를 만들고 바로 올립니다 ($NAME · $VIS)"
  gh repo create "$NAME" --"$VIS" --source=. --remote=origin --push
  echo "✅ 완료 — $(gh repo view "$NAME" --json url --jq .url 2>/dev/null || echo '깃허브에서 확인하세요')"
  exit 0
fi

# ── 4. gh 가 없을 때 ───────────────────────────────────────
cat <<'EOF'

gh CLI가 없습니다. 두 가지 방법 중 하나로 하세요.

[방법 A] gh 설치 후 이 스크립트 다시 실행 — 가장 빠릅니다
    macOS:    brew install gh && gh auth login
    Windows:  winget install GitHub.cli
    그다음:    bash push.sh

[방법 B] 브라우저로 빈 저장소 만들고 URL 붙여넣기
    1) https://github.com/new 접속
    2) Repository name 에 이름 입력
    3) Private 선택
    4) "Add a README file" 체크 해제  ← 중요. 체크하면 충돌납니다
    5) Create repository
    6) 나온 주소를 아래에 붙여넣기

EOF

read -r -p "저장소 주소 (https://github.com/사용자명/저장소.git): " URL
[ -z "$URL" ] && { echo "취소했습니다."; exit 1; }

git remote add origin "$URL"
git branch -M main
git push -u origin main
echo "✅ 완료 — ${URL%.git}"
