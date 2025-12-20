-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  stack TEXT[] NOT NULL,
  github_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- Insert sample data (optional)
INSERT INTO projects (title, description, stack, github_url) VALUES
  ('Conferences Management', '컨퍼런스 정보를 관리하고 공유하는 시스템입니다. Express.js를 활용하여 RESTful API를 구현했으며, CRUD 기능을 제공합니다.', ARRAY['Express', 'REST API', 'JSON'], 'https://github.com/'),
  ('Release Tracker', '소프트웨어 릴리즈 파일을 추적하고 다운로드할 수 있는 도구입니다. 파일 시스템과 연동하여 릴리즈 관리를 자동화합니다.', ARRAY['Node.js', 'File Management', 'Download'], 'https://github.com/'),
  ('Status Monitor', '시스템 상태를 실시간으로 모니터링하고 표시하는 대시보드입니다. 서버 상태를 한눈에 확인할 수 있습니다.', ARRAY['Monitoring', 'Dashboard', 'Real-time'], 'https://github.com/'),
  ('Personal Blog', 'Astro와 Express.js를 활용한 풀스택 블로그입니다. 미니멀한 디자인과 다크모드를 지원하며, 백엔드 API와 연동됩니다.', ARRAY['Astro', 'Express', 'Fullstack', 'Tailwind CSS'], 'https://github.com/');
