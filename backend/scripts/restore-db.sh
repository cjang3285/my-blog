#!/bin/bash
# 프로덕션 데이터베이스 복원 스크립트
# 사용법: ./restore-db.sh /home/jcw/backups/my-blog-db/my_blog_20260724_030000.dump

set -e

BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "사용법: $0 <백업파일.dump>"
  echo "예: $0 /home/jcw/backups/my-blog-db/my_blog_20260724_030000.dump"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../config/.env"

set -a
source "$ENV_FILE"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-my_blog}"
DB_USER="${DB_USER:-postgres}"

read -p "'$DB_NAME' 데이터베이스를 '$BACKUP_FILE'으로 덮어씁니다. 계속하시겠습니까? (yes 입력) " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "취소되었습니다."
  exit 1
fi

PGPASSWORD="$DB_PASSWORD" pg_restore \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  "$BACKUP_FILE"

echo "복원 완료"
