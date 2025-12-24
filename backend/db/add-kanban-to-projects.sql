-- Projects 테이블에 Kanban 관련 컬럼 추가
-- 각 프로젝트는 칸반보드의 한 카드가 됨

-- Kanban status enum 타입 생성
DO $$ BEGIN
  CREATE TYPE kanban_status AS ENUM ('todo', 'inprogress', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Projects 테이블에 kanban 컬럼 추가
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS kanban_status kanban_status DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS kanban_position INTEGER DEFAULT 0;

-- 기존 프로젝트들에 대한 position 설정
WITH ranked_projects AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS position
  FROM projects
  WHERE kanban_position = 0
)
UPDATE projects
SET kanban_position = ranked_projects.position
FROM ranked_projects
WHERE projects.id = ranked_projects.id;

-- 인덱스 생성 (칸반보드 조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_projects_kanban_status ON projects(kanban_status);
CREATE INDEX IF NOT EXISTS idx_projects_kanban_position ON projects(kanban_status, kanban_position);

-- 설명:
-- kanban_status: 프로젝트가 속한 칸반 컬럼 (todo, inprogress, done)
-- kanban_position: 같은 컬럼 내에서의 순서 (드래그 앤 드롭 순서 유지)
