#!/bin/bash
# 테스트 전 데이터베이스 백업 스크립트

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-my_blog}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_SCHEMA="${DB_SCHEMA:-public}"
BACKUP_DIR="/tmp/blog-test-backups"

# 백업 디렉토리 생성
mkdir -p "$BACKUP_DIR"

echo "🔄 Backing up database tables (posts, projects)..."

# posts 테이블 백업
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema="$DB_SCHEMA" \
  --table="$DB_SCHEMA.posts" \
  --data-only \
  > "$BACKUP_DIR/posts.sql"

# projects 테이블 백업
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --schema="$DB_SCHEMA" \
  --table="$DB_SCHEMA.projects" \
  --data-only \
  > "$BACKUP_DIR/projects.sql"

echo "✅ Database backed up to $BACKUP_DIR"
echo "   - posts.sql"
echo "   - projects.sql"
