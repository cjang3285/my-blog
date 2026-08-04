# My Blog

개인 블로그 프로젝트. Astro 프론트엔드와 Express.js 백엔드로 구성.

## 프로젝트 구조

```
my-blog/
├── frontend/                  # Astro 프론트엔드
│   ├── src/
│   │   ├── components/        # BlogCard, ProjectCard, Hero, Layout
│   │   ├── layouts/           # Layout.astro
│   │   ├── pages/             # 라우팅 페이지
│   │   └── styles/            # 전역 CSS
│   └── config/                # Astro, ESLint, Vitest, Prettier 설정
├── backend/                   # Express.js 백엔드 API
│   ├── controllers/           # 요청 핸들러
│   ├── routes/                # API 라우터
│   ├── services/              # 비즈니스 로직
│   ├── middleware/            # 인증 미들웨어
│   ├── utils/                 # 유틸리티 (마크다운 등)
│   ├── db/                    # DB 마이그레이션 SQL
│   └── config/                # 환경변수, DB, ESLint, Vitest 설정
├── deployment/                # 배포 설정 파일
│   ├── nginx-blog.conf
│   ├── blog-backend.service
│   └── redeploy.sh
├── ecosystem.config.cjs       # PM2 설정
├── CLAUDE.MD                  # AI 개발 가이드라인
├── LEARNINGS.md               # 개발·운영 중 발견한 문제와 교훈 기록
└── LICENSE
```

## 기술 스택

### Frontend
- **Framework**: Astro 5.x (SSR, `@astrojs/node`)
- **스타일**: Tailwind CSS 4.x
- **언어**: TypeScript
- **테스트**: Vitest
- **린터/포맷터**: ESLint, Prettier

### Backend
- **Runtime**: Node.js 18+ (ESM)
- **Framework**: Express.js 5.x
- **Database**: PostgreSQL (`blog` 스키마)
- **ORM**: `pg` (node-postgres)
- **마크다운**: `marked` + `sanitize-html`
- **세션**: `express-session`
- **테스트**: Jest
- **린터/포맷터**: ESLint, Prettier
- **개발 서버**: nodemon

### 인프라
- **Process Manager**: PM2
- **Web Server**: nginx (리버스 프록시)

## 페이지 구성

| 경로 | 설명 |
|------|------|
| `/` | 홈 |
| `/blog` | 블로그 포스트 목록 |
| `/blog/[slug]` | 블로그 포스트 상세 |
| `/projects` | 프로젝트 목록 |
| `/projects/[id]` | 프로젝트 상세 |
| `/about` | 소개 |
| `/status` | 시스템 상태 |
| `/{secret-path}/login` | 관리자 로그인 (경로 비공개, 배포 환경별 설정) |

## API 엔드포인트

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/auth/login` | 로그인 |
| `POST` | `/api/auth/logout` | 로그아웃 |
| `GET` | `/api/auth/check` | 인증 상태 확인 |

### 포스트 (공개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/posts` | 포스트 목록 |
| `GET` | `/api/posts/featured` | 주요 포스트 |
| `GET` | `/api/posts/:slug` | 포스트 상세 |

### 포스트 (인증 필요)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/posts` | 포스트 생성 |
| `PUT` | `/api/posts/:id` | 포스트 수정 |
| `DELETE` | `/api/posts/:id` | 포스트 삭제 |

### 프로젝트 (공개)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/projects` | 프로젝트 목록 |
| `GET` | `/api/projects/:id` | 프로젝트 상세 |

### 프로젝트 (인증 필요)
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/projects` | 프로젝트 생성 |
| `PUT` | `/api/projects/:id` | 프로젝트 수정 |
| `DELETE` | `/api/projects/:id` | 프로젝트 삭제 |

### 기타
| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/status` | 시스템 상태 |
| `GET` | `/api/` | 헬스체크 |

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

SESSION_SECRET=your-random-secret-key
ADMIN_PASSWORD=your-admin-password
FRONTEND_URL=http://localhost:4321

# 선택사항: 신뢰할 IP 추가 (쉼표 구분)
# TRUSTED_IPS=192.168.1.100,10.0.0.5
```

```bash
# 개발 서버 실행
npm run dev
```

#### 4. 프론트엔드 설정

```bash
cd ../frontend
npm install

# 개발 서버 실행
npm run dev
```

## 스크립트

### Backend (`backend/`)

| 명령어 | 설명 |
|--------|------|
| `npm start` | 프로덕션 서버 실행 |
| `npm run dev` | nodemon 개발 서버 실행 |
| `npm test` | Vitest 테스트 실행 (`vitest run`) |
| `npm run test:watch` | Vitest watch 모드 (`vitest`) |
| `npm run test:integration` | 백엔드 통합 테스트 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run format` | Prettier 포맷 |
| `npm run format:check` | Prettier 검사 |

### Frontend (`frontend/`)

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Astro 개발 서버 (`localhost:4321`) |
| `npm run build` | 프로덕션 빌드 (`./dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | Vitest 테스트 실행 |
| `npm run test:ui` | Vitest UI 모드 |
| `npm run type-check` | TypeScript 타입 검사 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run format` | Prettier 포맷 |
| `npm run format:check` | Prettier 검사 |

## 프로덕션 배포

### 1. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

### 2. PM2로 서버 시작

```bash
# 프로젝트 루트에서
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # 시스템 부팅 시 자동 시작
```

### 3. nginx 설정

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

### 4. SSL 인증서 (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot renew --dry-run
```

## 배포 업데이트

### 백엔드 업데이트

```bash
git pull origin master
pm2 restart blog-backend
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
pm2 logs blog-backend         # 백엔드 로그
pm2 logs blog-frontend        # 프론트엔드 로그
pm2 restart blog-backend      # 재시작
pm2 monit                     # 실시간 모니터링
```

### PostgreSQL

```bash
sudo systemctl status postgresql
sudo -u postgres psql -d my_blog

# 수동 백업/복원 (스크립트 사용 권장, 아래 참고)
pg_dump -U your_user -d my_blog -n blog > backup.sql
psql -U your_user -d my_blog < backup.sql
```

### DB 자동 백업

- 스크립트: `backend/scripts/backup-db.sh` (전체 DB, `pg_dump -Fc` 커스텀 포맷)
- 저장 위치: `/home/jcw/backups/my-blog-db/` (저장소 외부, git 추적 안 함)
- 보관 기간: 14일 경과분 자동 삭제
- 스케줄: crontab `@daily` 등록
- 복원: `backend/scripts/restore-db.sh <백업파일.dump>`

### nginx

```bash
sudo nginx -t                 # 설정 테스트
sudo systemctl reload nginx   # 무중단 재로드
sudo systemctl restart nginx  # 재시작
sudo tail -f /var/log/nginx/blog_error.log
```

## 인증 시스템

### 자동 인증
- **개발 환경(`NODE_ENV=development`)에서만** localhost 접속 시 자동 관리자 인증. 프로덕션에서는 비활성화됨(2026-08-04, [LEARNINGS.md](./LEARNINGS.md) 참고).
- 신뢰 IP 추가: `TRUSTED_IPS` 환경변수에 쉼표 구분으로 설정
- 클라이언트 IP는 Express `trust proxy` + nginx `X-Forwarded-For: $remote_addr`(overwrite, append 아님)로 판별. 헤더를 직접 파싱하는 코드를 추가할 경우 이 신뢰 체인을 깨뜨릴 수 있으니 주의.
- 세션 유지: 7일

### 수동 로그인
- URL: 비공개 경로 (공개 저장소에 노출 방지를 위해 문서화하지 않음)
- 비밀번호: `ADMIN_PASSWORD_HASH` 환경변수에 bcrypt 해시로 설정 (평문 저장 금지)
- 로그인 시도는 `express-rate-limit`으로 15분당 10회 제한

### 네트워크 격리
- backend(3000)·frontend(4321) 모두 `127.0.0.1`에만 바인딩 — nginx를 거치지 않고 포트에 직접 접속하는 경로 차단
- `POST /api/visits`는 프론트엔드의 내부 loopback 호출만 허용(nginx를 거친 요청은 `X-Forwarded-For`가 항상 붙으므로 이를 근거로 403 처리) + rate limit
- nginx `limit_req_zone`으로 과도한 요청 제한, `fail2ban`에 `.env`/`.git`/`wp-login`/PHPUnit `eval-stdin.php` 등 스캐너 시그니처 jail 추가

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

DB 스키마 확인:
```bash
sudo -u postgres psql -d my_blog -c "\dn"
# blog 스키마가 없으면 생성
sudo -u postgres psql -d my_blog -c "CREATE SCHEMA blog;"
pm2 restart blog-backend
```

### PM2 프로세스 확인

```bash
pm2 logs blog-backend --err --lines 100
pm2 describe blog-backend
```

### nginx 502 Bad Gateway

1. 백엔드 실행 확인: `pm2 status`
2. 포트 확인: `curl http://localhost:3000/api/`
3. 로그 확인: `sudo tail -f /var/log/nginx/blog_error.log`

## 개발 가이드

AI 협업 시 코드 작성 규칙은 [CLAUDE.MD](./CLAUDE.MD) 참조. 개발·운영 중 발견한 문제와 교훈은 [LEARNINGS.md](./LEARNINGS.md)에 기록.

## 라이센스

MIT
