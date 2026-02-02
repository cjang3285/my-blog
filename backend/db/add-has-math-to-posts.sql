-- posts 테이블에 has_math 컬럼 추가
-- 수학 수식 포함 여부를 저장하여 프론트엔드에서 KaTeX CSS 조건부 로드

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS has_math BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN posts.has_math IS '수학 수식 포함 여부 (KaTeX CSS 조건부 로드용)';
