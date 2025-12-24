# 백엔드 포트 이슈 및 설정 파일 구조 개선

## 📋 요약

백엔드 서버 연결 문제 해결 및 프로젝트 설정 파일 구조 전면 개선

## 🐛 해결된 문제들

### 1. 백엔드 모듈 로딩 에러
- **문제**: `config/db.js`에서 ESM import 문법 에러 발생
- **원인**: 루트 config 폴더에 `package.json`이 없어 CommonJS로 인식
- **해결**:
  - `config/db.js`를 `backend/config/db.js`로 이동
  - 각 프로젝트의 설정은 해당 프로젝트 내부에 배치
  - Backend 서비스 파일들의 import 경로 수정

### 2. 누락된 의존성
- **문제**: `express-session` 패키지 미설치로 백엔드 크래시
- **해결**: `backend/package.json`에 `express-session` 추가

### 3. PM2 설정 파일 경로 문제
- **문제**: `ecosystem.config.cjs`가 config 폴더에 있어 스크립트 경로 해석 오류
- **해결**:
  - `ecosystem.config.cjs`를 프로젝트 루트로 이동
  - `cwd` 설정 추가로 올바른 디렉토리에서 실행

### 4. 프론트엔드 환경 변수 미설정
- **문제**: `PUBLIC_API_URL` 환경 변수가 빌드에 포함되지 않음
- **원인**: Astro `envDir` 설정 오류
- **해결**:
  - `.env` 파일을 `frontend/` 루트로 이동
  - `envDir` 설정 제거하여 Astro 기본 동작 사용

### 5. SSR vs 클라이언트 사이드 API 호출 차이
- **문제**:
  - 메인 페이지(SSR): 상대 경로 API 호출 실패
  - Blog/Projects 페이지(클라이언트): `localhost:3000` 연결 거부
- **해결**:
  - SSR: `http://localhost:3000` 사용 (서버 내부 통신)
  - 클라이언트: 상대 경로 사용 (Nginx 프록시)
  - `import.meta.env.SSR`로 환경 구분

### 6. 메인 페이지 빈 프로젝트 카드
- **문제**: 완료된 프로젝트 목록에 빈 카드 표시
- **해결**: `title`과 `description` 존재 여부 확인 필터 추가

## 🏗️ 개발된 내용

### 설정 파일 구조 개선
```
my-blog/
├── backend/
│   └── config/
│       ├── .env
│       ├── .env.example
│       ├── db.js              # DB 연결 설정
│       ├── eslint.config.js
│       ├── jest.config.js
│       └── nodemon.json
├── frontend/
│   ├── .env                   # 프론트엔드 환경 변수
│   ├── .env.example
│   └── config/
│       ├── astro.config.mjs
│       ├── eslint.config.js
│       ├── tailwind.config.js
│       └── vitest.config.js
└── ecosystem.config.cjs       # PM2 설정 (루트)
```

### 환경 변수 설정
- **Backend** (`backend/config/.env`):
  - DB 연결 정보
  - 세션 시크릿
  - 포트 설정

- **Frontend** (`frontend/.env`):
  - `PUBLIC_API_URL=""` (프로덕션: 빈 문자열로 상대 경로 사용)

### 디버깅 개선
- 메인 페이지: SSR API 호출 로그 추가
- Blog 페이지: 클라이언트 사이드 로그 추가
- Projects 페이지: 클라이언트 사이드 로그 추가
- 에러 발생 시 사용자에게 상세 에러 메시지 표시

## 🔄 변경된 파일

### 추가된 파일
- `frontend/.env.example`
- `backend/config/.env.example`
- `backend/config/db.js`

### 이동된 파일
- `config/db.js` → `backend/config/db.js`
- `backend/config/ecosystem.config.cjs` → `ecosystem.config.cjs`
- `frontend/config/.env.example` → `frontend/.env.example`

### 수정된 파일
- `backend/package.json` - express-session 의존성 추가
- `backend/app.js` - dotenv 경로 명시
- `backend/services/*.js` - db.js import 경로 수정
- `frontend/config/astro.config.mjs` - envDir 설정 제거
- `frontend/package.json` - config 플래그 추가
- `frontend/src/pages/index.astro` - SSR/클라이언트 환경 구분
- `frontend/src/pages/blog.astro` - 디버깅 로그 추가
- `frontend/src/pages/projects.astro` - 디버깅 로그 추가
- `ecosystem.config.cjs` - cwd 설정 추가

## ✅ 테스트 확인사항

- [x] 백엔드 서버 정상 시작 (포트 3000)
- [x] 프론트엔드 서버 정상 시작 (포트 4321)
- [x] 메인 페이지에서 최신 글 3개 표시
- [x] 메인 페이지에서 완료된 프로젝트 표시
- [x] Blog 페이지에서 모든 글 목록 표시
- [x] Projects 페이지에서 모든 프로젝트 표시
- [x] 프로젝트 칸반보드 정상 작동
- [x] PM2로 서버 재시작 시 정상 작동

## 📝 배포 가이드

### 서버 배포 시 필요한 작업
```bash
# 1. 코드 가져오기
git pull origin claude/fix-backend-port-issue-fcDyG

# 2. Backend 의존성 설치
cd backend
npm install

# 3. Frontend .env 파일 생성
cd ../frontend
cp .env.example .env
# PUBLIC_API_URL은 빈 문자열로 설정 (상대 경로 사용)

# 4. Frontend 빌드
npm run build

# 5. PM2 재시작
cd ..
pm2 restart ecosystem.config.cjs
```

## 🎯 핵심 개선사항

1. **설정 파일 통합**: 각 프로젝트의 설정이 해당 프로젝트 내부에 정리됨
2. **환경 변수 관리**: .env.example 파일로 필요한 환경 변수 문서화
3. **SSR/클라이언트 구분**: 실행 환경에 따라 적절한 API URL 사용
4. **에러 처리 개선**: 사용자 친화적인 에러 메시지 제공
5. **디버깅 강화**: 상세한 로그로 문제 진단 용이

## 🔗 관련 이슈

- 백엔드 포트 연결 문제
- ESM 모듈 로딩 에러
- 환경 변수 설정 문제
- SSR API 호출 실패
