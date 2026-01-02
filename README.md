# My Blog

개인 블로그 프로젝트. Astro 프론트엔드와 Express.js 백엔드로 구성.

## 프로젝트 구조

```
my-blog/
├── frontend/              # Astro 프론트엔드
├── backend/               # Express.js 백엔드 API
├── deployment/            # 배포 설정 파일
│   ├── nginx-blog.conf
│   ├── blog-backend.service
│   └── redeploy.sh
├── ecosystem.config.cjs   # PM2 설정
├── CLAUDE.MD              # AI 개발 가이드라인
└── LICENSE
```

## 기술 스택

### Frontend
- **Framework**: Astro (SSR)
- **빌드 도구**: Vite
- **스타일**: Tailwind CSS

### Backend
- **Runtime**: Node.js 18+ (ESM)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL 12+ (스키마: `blog`)
- **Process Manager**: PM2
- **Web Server**: nginx (리버스 프록시)

## 빠른 시작

### 사전 요구사항

- Node.js 18+
- PostgreSQL 12+
- PM2 (프로덕션 배포용)
- nginx (프로덕션 배포용)

### 개발 환경 설정

#### 1. 저장소 클론

```bash
git clone <repository-url>
cd my-blog
```

#### 2. 데이터베이스 설정

```bash
# PostgreSQL 접속
sudo -u postgres psql

# 데이터베이스 및 스키마 생성
CREATE DATABASE my_blog;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE my_blog TO your_user;
\c my_blog
CREATE SCHEMA blog;
ALTER SCHEMA blog OWNER TO your_user;
\q
```

#### 3. 백엔드 설정

```bash
cd backend
npm install

# 환경 변수 설정
cp config/.env.example config/.env
# config/.env 파일 편집하여 데이터베이스 정보 입력
```

`backend/config/.env` 예시:
```env
NODE_ENV=development
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_blog
DB_USER=your_user
DB_PASSWORD=your_password
DB_SCHEMA=blog

SESSION_SECRET=your-random-secret-key
ADMIN_PASSWORD=your-password
FRONTEND_URL=http://localhost:4321
```

```bash
# 개발 서버 실행
npm run dev
```

#### 4. 프론트엔드 설정

```bash
cd ../frontend
npm install

# 환경 변수 설정 (선택사항)
cp .env.example .env

# 개발 서버 실행
npm run dev
```

## 프로덕션 배포

### 1. PM2로 서버 시작

```bash
# 프로젝트 루트에서
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # 시스템 부팅 시 자동 시작
```

### 2. nginx 설정

```bash
# nginx 설치
sudo apt install nginx

# 설정 파일 복사
sudo cp deployment/nginx-blog.conf /etc/nginx/sites-available/blog
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/

# 설정 테스트 및 재시작
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 3. SSL 인증서 (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run
```

## 배포 업데이트

### 백엔드 업데이트

```bash
cd backend
./deploy.sh
```

### 프론트엔드 업데이트

```bash
cd frontend
git pull
npm install
npm run build
pm2 restart blog-frontend
```

## 관리 명령어

### PM2

```bash
pm2 status                    # 상태 확인
pm2 logs blog-backend         # 로그 확인
pm2 restart blog-backend      # 재시작
pm2 monit                     # 실시간 모니터링
```

### PostgreSQL

```bash
sudo systemctl status postgresql
sudo -u postgres psql -d my_blog

# 백업
pg_dump -U your_user -d my_blog -n blog > backup.sql

# 복원
psql -U your_user -d my_blog < backup.sql
```

### nginx

```bash
sudo nginx -t                 # 설정 테스트
sudo systemctl reload nginx   # 무중단 재로드
sudo systemctl restart nginx  # 재시작
sudo tail -f /var/log/nginx/blog_error.log
```

## 인증 시스템

### 자동 인증
- localhost 접속 시 자동 관리자 인증
- 신뢰 IP 추가: `TRUSTED_IPS` 환경변수 설정

### 수동 로그인
- URL: `https://yourdomain.com/admin/login`
- 세션 유지: 7일

## 아키텍처

```
브라우저
   │ HTTPS (443)
   ▼
nginx (SSL/TLS, 리버스 프록시)
   ├─▶ Frontend (Astro SSR, PM2:4321)
   └─▶ Backend API (Express, PM2:3000)
         └─▶ PostgreSQL (blog 스키마, 5432)
```

## 트러블슈팅

### relation "posts" does not exist

DB 스키마 설정 확인:
```bash
# config/.env에 DB_SCHEMA=blog 추가
echo "DB_SCHEMA=blog" >> backend/config/.env
pm2 restart blog-backend
```

### PM2 프로세스 확인

```bash
pm2 logs blog-backend --err --lines 100
pm2 describe blog-backend
```

### nginx 502 Bad Gateway

1. 백엔드 실행 확인: `pm2 status`
2. 포트 확인: `curl http://localhost:3000/api/health`
3. 로그 확인: `sudo tail -f /var/log/nginx/blog_error.log`

## 개발 가이드

AI 협업 시 코드 작성 규칙은 [CLAUDE.MD](./CLAUDE.MD) 참조.

## 라이센스

MIT
