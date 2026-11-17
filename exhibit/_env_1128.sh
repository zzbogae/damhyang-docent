# 11/28 전시 공용 설정 (start/stop/check 가 source 한다)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
EXHIBIT_DIR=${EXHIBIT_DIR:-$HOME/Downloads/mined-exhibit}   # 기존 전시 스크립트(start_exhibit.sh·stop_exhibit.sh)
KEY_FILE=${KEY_FILE:-$HOME/Downloads/mined-secrets/.env}    # OPENROUTER_API_KEY=... 한 줄 (chmod 600)
VENV=${VENV:-$HOME/Downloads/mined-space-venv}              # 그림 서버 전용 파이썬 (setup_1128.sh 가 만든다)
SPACE_PORT=${SPACE_PORT:-8791}
WEB_PORT=${WEB_PORT:-4173}                                  # start_exhibit.sh 의 시연판 주소
LOG=${LOG:-$HOME/Downloads/mined-exhibit-logs}
mkdir -p "$LOG"
# 전시장은 관객이 모두 같은 기기(같은 IP)라 1분 상한을 조금 올린다. 하루 상한 300장 ≈ 12달러.
export SPACE_IMAGE_PER_MIN=${SPACE_IMAGE_PER_MIN:-6}
export SPACE_IMAGE_PER_DAY=${SPACE_IMAGE_PER_DAY:-300}
