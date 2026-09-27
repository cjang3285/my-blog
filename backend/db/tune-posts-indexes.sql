-- posts 인덱스 정리 (2026-09-27 쿼리 튜닝 점검 결과)
-- 적용: sudo -u postgres psql -d my_blog -c "SET search_path TO blog" -f - < backend/db/tune-posts-indexes.sql
-- CI 테스트 DB(test_blog 스키마)에도 같은 SQL을 적용해야 한다.

-- posts_slug_key(UNIQUE)와 컬럼이 같은 중복 인덱스: 쓰기 비용만 늘린다
DROP INDEX IF EXISTS idx_posts_slug;

-- 필터 없는 목록/페이지네이션(ORDER BY date DESC, id DESC)용
-- idx_posts_category_date는 category가 선두 컬럼이라 분류 필터가 없으면 쓰이지 않는다
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts (date DESC, id DESC);

-- 태그 필터용 GIN 인덱스: 쿼리는 `$1 = ANY(tags)` 대신 `tags @> ARRAY[$1]` 형태여야 사용된다
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING gin (tags);

ANALYZE posts;
