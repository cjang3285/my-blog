# 라즈베리파이 페이지네이션 테스트 배포 가이드

## 1. 라즈베리파이 준비

### 필수 패키지 설치
```bash
sudo apt-get update
sudo apt-get install -y \
  nodejs npm \
  postgresql postgresql-contrib \
  nginx \
  git
```

### Node.js 버전 확인 (18+ 필요)
```bash
node --version  # v18 이상 필요
npm --version
```

## 2. 프로젝트 클론 및 브랜치 체크아웃

```bash
cd /home/pi  # 또는 원하는 디렉토리
git clone <repository-url> my-blog
cd my-blog
git checkout claude/add-blog-pagination-WbObs
```

## 3. 데이터베이스 설정

### PostgreSQL 시작
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 데이터베이스 및 사용자 생성
```bash
sudo -u postgres psql << 'EOF'
CREATE DATABASE my_blog;
CREATE USER blog_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE my_blog TO blog_user;
\c my_blog
CREATE SCHEMA IF NOT EXISTS blog;
ALTER SCHEMA blog OWNER TO blog_user;
EOF
```

### 테이블 생성
```bash
sudo -u postgres psql -d my_blog << 'EOF'
SET search_path TO blog;

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  excerpt TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  content_html TEXT DEFAULT '',
  date DATE NOT NULL,
  tags TEXT[] DEFAULT '{}',
  featured BOOLEAN DEFAULT FALSE,
  has_math BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  content_markdown TEXT,
  content_html TEXT DEFAULT '',
  stack TEXT[] NOT NULL DEFAULT '{}',
  github_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

GRANT ALL PRIVILEGES ON SCHEMA blog TO blog_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA blog TO blog_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA blog TO blog_user;
EOF
```

## 4. 백엔드 설정

### 의존성 설치
```bash
cd /path/to/my-blog/backend
npm install
```

### 환경 변수 설정
```bash
cat > config/.env << 'EOF'
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_blog
DB_USER=blog_user
DB_PASSWORD=your_secure_password
DB_SCHEMA=blog

SESSION_SECRET=your-random-secret-key-here
ADMIN_PASSWORD=your-admin-password
FRONTEND_URL=http://your-raspberry-pi-ip:80
EOF
```

### 백엔드 빌드 (선택사항)
```bash
# 또는 그냥 npm start로 실행
npm run build  # 있다면
```

## 5. 프론트엔드 설정

### 의존성 설치
```bash
cd /path/to/my-blog/frontend
npm install
```

### 프론트엔드 빌드
```bash
PUBLIC_API_URL=http://your-raspberry-pi-ip:3000 npm run build
```

## 6. Nginx 설정

### 리버스 프록시 설정
```bash
sudo cat > /etc/nginx/sites-available/my-blog << 'EOF'
upstream backend {
    server localhost:3000;
}

upstream frontend {
    server localhost:4321;
}

server {
    listen 80;
    server_name your-raspberry-pi-ip;

    # 프론트엔드
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API 요청
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

### Nginx 활성화
```bash
sudo ln -s /etc/nginx/sites-available/my-blog /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t
sudo systemctl restart nginx
```

## 7. 서버 실행 (PM2 권장)

### PM2 설치
```bash
sudo npm install -g pm2
```

### 백엔드 실행
```bash
cd /path/to/my-blog/backend
pm2 start app.js --name "my-blog-backend" \
  --env DB_HOST=localhost \
  --env DB_PORT=5432 \
  --env DB_NAME=my_blog \
  --env DB_USER=blog_user \
  --env DB_PASSWORD=your_secure_password \
  --env DB_SCHEMA=blog
```

### 프론트엔드 실행
```bash
cd /path/to/my-blog/frontend
pm2 start "npm run preview" --name "my-blog-frontend" \
  --env PUBLIC_API_URL=http://your-raspberry-pi-ip:3000
```

### PM2 자동 시작 설정
```bash
pm2 startup systemd -u pi --hp /home/pi
pm2 save
```

## 8. 테스트

### 백엔드 API 테스트
```bash
curl http://your-raspberry-pi-ip:3000/api/posts?page=1&limit=10
```

### 브라우저 접속
```
http://your-raspberry-pi-ip/blog
```

### 페이지네이션 확인
- 페이지 아래 "1", "2", "다음" 버튼 확인
- 페이지 2 클릭하여 다음 5개 포스트 로드 확인

## 9. 트러블슈팅

### PostgreSQL 연결 문제
```bash
# 데이터베이스 연결 테스트
psql -h localhost -U blog_user -d my_blog -c "SELECT COUNT(*) FROM blog.posts;"
```

### 포트 충돌 확인
```bash
lsof -i :3000  # 백엔드
lsof -i :4321  # 프론트엔드
lsof -i :80    # Nginx
```

### 로그 확인
```bash
pm2 logs my-blog-backend
pm2 logs my-blog-frontend
sudo tail -f /var/log/nginx/error.log
```

## 10. 운영 환경 적용 전 체크리스트

- [ ] 페이지네이션이 정상 작동하는가?
- [ ] 페이지 버튼들이 올바르게 표시되는가?
- [ ] 각 페이지의 포스트가 정확하게 로드되는가?
- [ ] 새 포스트 작성 시 첫 페이지로 이동하는가?
- [ ] 기존 포스트 수정 시 현재 페이지가 유지되는가?
- [ ] 브라우저 콘솔에 에러가 없는가?
- [ ] 반응형 디자인이 잘 작동하는가?
