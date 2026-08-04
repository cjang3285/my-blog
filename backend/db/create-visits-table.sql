-- 방문 로그 테이블 생성
-- 프론트엔드 SSR 미들웨어에서 페이지 요청마다 기록

CREATE TABLE IF NOT EXISTS visits (
  id SERIAL PRIMARY KEY,
  path VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL DEFAULT 'GET',
  ip VARCHAR(64),
  user_agent TEXT,
  referrer VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visits_path ON visits(path);
