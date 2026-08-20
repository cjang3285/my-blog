#!/bin/bash
# 프로덕션 데이터베이스 전체 백업 스크립트 (cron에서 매일 실행)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../config/.env"

# .env에서 DB 접속 정보 로드
set -a
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-my_blog}"
DB_USER="${DB_USER:-postgres}"

BACKUP_DIR="/home/jcw/backups/my-blog-db"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/my_blog_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] DB 백업 시작: $BACKUP_FILE"

PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  -f "$BACKUP_FILE"

echo "[$(date +'%Y-%m-%d %H:%M:%S')] DB 백업 완료: $(du -h "$BACKUP_FILE" | cut -f1)"

# 보관 기간(14일)이 지난 백업 삭제
find "$BACKUP_DIR" -name "my_blog_*.dump" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date +'%Y-%m-%d %H:%M:%S')] ${RETENTION_DAYS}일 지난 백업 정리 완료"

# 오프사이트 백업 (Google Drive, rclone) - 로컬 디스크 장애 시 대비
RCLONE_REMOTE="gdrive:my-blog-backups"
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] rclone 업로드 시작: $RCLONE_REMOTE"
  rclone copy "$BACKUP_FILE" "$RCLONE_REMOTE" --log-level ERROR
  rclone delete "$RCLONE_REMOTE" --min-age "${RETENTION_DAYS}d" --log-level ERROR
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] rclone 업로드 완료"
else
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] 경고: rclone gdrive remote 미설정, 오프사이트 백업 건너뜀" >&2
fi
