-- 프로젝트 테이블에 content 컬럼 추가
-- description: 간단 소개 (리스트/칸반에 표시)
-- content: 본문 (상세 페이지에만 표시)

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- 기존 프로젝트에 기본값 설정
UPDATE projects
SET content = '프로젝트 상세 내용을 작성해주세요.'
WHERE content = '' OR content IS NULL;

COMMENT ON COLUMN projects.content IS '프로젝트 상세 본문 (Markdown 지원)';
