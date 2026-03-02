#!/bin/bash
# 테스트 후 데이터베이스 복구 스크립트

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-my_blog}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"
DB_SCHEMA="${DB_SCHEMA:-public}"
BACKUP_DIR="/tmp/blog-test-backups"

echo "🔄 Restoring database tables..."

# posts 테이블 데이터 삭제 후 복구
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "DELETE FROM $DB_SCHEMA.posts;"

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$BACKUP_DIR/posts.sql"

# projects 테이블 데이터 삭제 후 복구
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -c "DELETE FROM $DB_SCHEMA.projects;"

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -f "$BACKUP_DIR/projects.sql"

echo "✅ Database restored to pre-test state"
