-- conferences 테이블 생성
CREATE TABLE IF NOT EXISTS conferences (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 초기 데이터 삽입 (선택 사항)
-- TRUNCATE TABLE conferences RESTART IDENTITY; -- 기존 데이터 삭제 후 ID 초기화
-- INSERT INTO conferences (name, url) VALUES
-- ('NDC', 'https://ndc.nexon.com/'),
-- ('GDC', 'https://gdconf.com/'),
-- ('Devsday', 'https://devsday.com/');
