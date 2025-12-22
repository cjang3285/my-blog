# My Blog

개인 블로그 프로젝트입니다. Astro 프론트엔드와 Express.js 백엔드로 구성되어 있습니다.

## 프로젝트 구조

```
my-blog/
├── frontend/          # Astro 프론트엔드
├── backend/           # Express.js 백엔드 API
├── nginx-blog.conf   # nginx 설정 파일
└── blog-backend.service  # systemd 서비스 파일 (선택사항)
```

## 기술 스택

### Frontend
- **Framework**: Astro
- **빌드 도구**: Vite
- **스타일**: CSS/Tailwind (확인 필요)

### Backend
- **Runtime**: Node.js (ESM)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL
- **Process Manager**: PM2
- **Web Server**: nginx

## 시작하기

### 사전 요구사항

- Node.js 18+
- PostgreSQL 12+
- nginx
- PM2 (프로덕션 배포용)

### 개발 환경 설정

#### 1. 저장소 클론

```bash
git clone <repository-url>
cd my-blog
```

#### 2. 백엔드 설정

```bash
cd backend
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일을 편집하여 데이터베이스 정보 입력

# 개발 서버 실행
npm run dev
```

#### 3. 프론트엔드 설정

```bash
cd ../frontend
npm install

# 개발 서버 실행
npm run dev
```

## 프로덕션 배포

### 1. 데이터베이스 설정

```bash
# PostgreSQL 설치 및 시작
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# 데이터베이스 생성
sudo -u postgres psql
```

PostgreSQL 프롬프트에서:

```sql
CREATE DATABASE my_blog;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE my_blog TO your_user;
\q
```

### 2. PM2 설치 및 설정

```bash
# PM2 글로벌 설치
sudo npm install -g pm2

# 백엔드 서버 시작
cd /home/jcw/my-blog/backend
cp .env.example .env
# .env 파일 편집
nano .env

# PM2로 서버 시작
pm2 start ecosystem.config.js --env production

# PM2를 시스템 부팅 시 자동 시작하도록 설정
pm2 startup
pm2 save
```

### 3. nginx 설정

```bash
# nginx 설치
sudo apt install nginx

# 설정 파일 복사
sudo cp nginx-blog.conf /etc/nginx/sites-available/blog
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/

# 기본 설정 비활성화 (선택사항)
sudo rm /etc/nginx/sites-enabled/default

# 설정 테스트 및 nginx 재시작
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 4. SSL 인증서 설정 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d chanwook.kr -d www.chanwook.kr

# 자동 갱신 확인
sudo certbot renew --dry-run
```

### 5. 프론트엔드 빌드 및 배포

```bash
cd /home/jcw/my-blog/frontend
npm install
npm run build

# 빌드된 파일은 dist/ 디렉토리에 생성되며
# nginx가 이를 정적 파일로 서빙합니다
```

## 빠른 배포 (업데이트)

백엔드 업데이트 시:

```bash
cd /home/jcw/my-blog/backend
./deploy.sh
```

프론트엔드 업데이트 시:

```bash
cd /home/jcw/my-blog/frontend
git pull origin main
npm install
npm run build
sudo systemctl reload nginx
```

## 서버 관리

### PM2 명령어

```bash
# 상태 확인
pm2 status

# 로그 확인
pm2 logs blog-backend

# 서버 재시작
pm2 restart blog-backend

# 서버 중지
pm2 stop blog-backend

# 서버 시작
pm2 start blog-backend
```

### nginx 명령어

```bash
# 설정 테스트
sudo nginx -t

# nginx 재시작
sudo systemctl restart nginx

# nginx 재로드 (무중단)
sudo systemctl reload nginx

# nginx 상태 확인
sudo systemctl status nginx

# 로그 확인
sudo tail -f /var/log/nginx/blog_access.log
sudo tail -f /var/log/nginx/blog_error.log
```

### PostgreSQL 명령어

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# PostgreSQL 접속
sudo -u postgres psql

# 데이터베이스 백업
pg_dump -U your_user my_blog > backup.sql

# 데이터베이스 복원
psql -U your_user my_blog < backup.sql
```

## 아키텍처

```
                    ┌─────────────┐
                    │   브라우저   │
                    └──────┬──────┘
                           │ HTTPS (443)
                    ┌──────▼──────┐
                    │    nginx    │
                    │  (SSL/TLS)  │
                    └──┬───────┬──┘
                       │       │
        ┌──────────────┘       └──────────────┐
        │ Static Files                        │ /api
        │ (Astro dist/)                       │
        │                              ┌──────▼──────┐
        │                              │   Express   │
        │                              │  (PM2: 3000)│
        │                              └──────┬──────┘
        │                                     │
        │                              ┌──────▼──────┐
        │                              │ PostgreSQL  │
        │                              │   (5432)    │
        │                              └─────────────┘
        ▼
   Frontend (Astro)
```

## 트러블슈팅

### 포트 충돌

```bash
# 3000번 포트 사용 중인 프로세스 확인
sudo lsof -i :3000
kill -9 <PID>
```

### nginx 502 Bad Gateway

1. 백엔드 서버가 실행 중인지 확인: `pm2 status`
2. 포트 3000이 열려있는지 확인: `curl http://localhost:3000/api/health`
3. nginx 에러 로그 확인: `sudo tail -f /var/log/nginx/blog_error.log`

### 데이터베이스 연결 오류

1. PostgreSQL 실행 확인: `sudo systemctl status postgresql`
2. .env 파일의 데이터베이스 설정 확인
3. 방화벽 설정 확인

## 환경 변수

### Backend (.env)

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_blog
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

## 개발

### 브랜치 전략

- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치

### 커밋 컨벤션

- `feat`: 새로운 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드
- `chore`: 빌드, 설정 파일 수정

## 라이센스

ISC

## 기여

이슈와 PR은 언제나 환영합니다!
