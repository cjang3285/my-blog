# Blog Backend API

Express.js 기반의 블로그 백엔드 API 서버입니다.

## 기술 스택

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL
- **Process Manager**: PM2
- **Web Server**: nginx (reverse proxy)

## 주요 기능

- 📝 블로그 포스트 CRUD API
- 📊 프로젝트 관리 API
- 🎯 칸반 보드 API
- 🎤 컨퍼런스 정보 API
- 🚀 릴리즈 정보 API
- ❤️ 상태 및 헬스체크 API

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

`.env` 파일을 수정하여 데이터베이스 연결 정보를 설정합니다:

```env
NODE_ENV=production
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=my_blog
DB_USER=your_db_user
DB_PASSWORD=your_db_password
```

### 3. 개발 모드 실행

```bash
npm run dev
```

### 4. 프로덕션 모드 실행 (PM2)

```bash
# PM2로 시작
pm2 start ecosystem.config.js --env production

# 또는 배포 스크립트 사용
./deploy.sh
```

## API 엔드포인트

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/health` | 헬스체크 |
| `GET /api/posts` | 포스트 목록 조회 |
| `GET /api/posts/:id` | 포스트 상세 조회 |
| `POST /api/posts` | 포스트 생성 |
| `PUT /api/posts/:id` | 포스트 수정 |
| `DELETE /api/posts/:id` | 포스트 삭제 |
| `GET /api/projects` | 프로젝트 목록 |
| `GET /api/kanban` | 칸반 보드 데이터 |
| `GET /api/conferences` | 컨퍼런스 정보 |
| `GET /api/releases` | 릴리즈 정보 |
| `GET /api/status` | 현재 상태 |

## PM2 관리 명령어

```bash
# 서버 시작
pm2 start ecosystem.config.js --env production

# 서버 중지
pm2 stop blog-backend

# 서버 재시작
pm2 restart blog-backend

# 서버 재로드 (무중단)
pm2 reload blog-backend

# 로그 확인
pm2 logs blog-backend

# 상태 확인
pm2 status

# PM2 프로세스 저장 (재부팅 후 자동 시작)
pm2 save
pm2 startup
```

## nginx 설정

백엔드 API는 nginx를 통해 reverse proxy로 동작합니다.

nginx 설정 파일 (`/etc/nginx/sites-available/blog`):

```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
}
```

nginx 재시작:

```bash
sudo nginx -t  # 설정 검증
sudo systemctl reload nginx
```

## 데이터베이스 설정

PostgreSQL이 설치되고 실행 중이어야 합니다:

```bash
# PostgreSQL 상태 확인
sudo systemctl status postgresql

# 데이터베이스 생성
sudo -u postgres psql
CREATE DATABASE my_blog;
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE my_blog TO your_user;
```

## 디렉토리 구조

```
backend/
├── app.js                 # 메인 서버 파일
├── config/
│   └── db.js             # 데이터베이스 연결 설정
├── controllers/          # 컨트롤러
├── routes/               # 라우트
├── services/             # 비즈니스 로직
├── data/                 # JSON 데이터 파일
├── logs/                 # 로그 파일 (자동 생성)
├── ecosystem.config.js   # PM2 설정
├── deploy.sh            # 배포 스크립트
├── .env                 # 환경 변수 (git에 미포함)
├── .env.example         # 환경 변수 예시
└── package.json
```

## 배포

배포 스크립트를 사용하여 간편하게 배포할 수 있습니다:

```bash
cd /home/jcw/my-blog/backend
./deploy.sh
```

배포 스크립트는 다음 작업을 수행합니다:
1. 최신 코드 pull
2. 의존성 설치
3. .env 파일 확인
4. logs 디렉토리 생성
5. PM2로 서버 재시작

## 문제 해결

### 포트가 이미 사용 중인 경우

```bash
# 3000 포트를 사용하는 프로세스 확인
lsof -i :3000

# 프로세스 종료
kill -9 <PID>
```

### 데이터베이스 연결 오류

1. PostgreSQL이 실행 중인지 확인
2. `.env` 파일의 데이터베이스 설정 확인
3. 데이터베이스 사용자 권한 확인

### PM2 로그 확인

```bash
# 실시간 로그
pm2 logs blog-backend --lines 100

# 에러 로그만
pm2 logs blog-backend --err

# 로그 파일 직접 확인
tail -f logs/err.log
tail -f logs/out.log
```

## 라이센스

ISC
