-- posts 테이블에 category 컬럼 추가
-- 독자용 정리 글(article), 알고리즘 문제 풀이(ps), 작업 로그(log)를 구분해
-- 목록/메인 페이지에서 정리 글이 작업 로그에 묻히지 않도록 한다.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'article';

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check;
ALTER TABLE posts
  ADD CONSTRAINT posts_category_check CHECK (category IN ('article', 'ps', 'log'));

CREATE INDEX IF NOT EXISTS idx_posts_category_date ON posts (category, date DESC, id DESC);

COMMENT ON COLUMN posts.category IS '글 분류: article(정리 글), ps(문제 풀이), log(작업 로그)';

-- 기존 글 일괄 분류 (1회성)
-- log: LearningCollector가 올린 "<레포명>: ..." 형식의 커밋/PR 요약,
--      날짜로 시작하는 과제 기록, 본문 1000자 미만의 짧은 메모
UPDATE posts SET category = 'log'
WHERE title ~ '^[A-Za-z][A-Za-z0-9_.-]*:'
   OR title ~ '^[0-9]{8}'
   OR title ~ '^[0-9]{4}-[0-9]-Algorithm-assignments'
   OR title LIKE 'SECURITY.md%'
   OR length(content_markdown) < 1000;

-- ps: 백준 풀이와 알고리즘 태그 글
UPDATE posts SET category = 'ps'
WHERE category = 'article'
  AND (title ~ '^백준 '
    OR title ~ '^[0-9]+번 '
    OR '알고리즘' = ANY(tags)
    OR '백준' = ANY(tags));
