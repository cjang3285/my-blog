# 설치 가이드

## 필요한 패키지 설치

### Backend

```bash
cd backend
npm install express-session
```

### 환경 변수 설정

`.env` 파일에 다음 변수 추가:

```bash
# Session secret (production에서는 반드시 변경!)
SESSION_SECRET=your-random-secret-key-here

# Admin password
ADMIN_PASSWORD=your-secure-password-here

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:4321
```

**보안 참고사항:**
- `SESSION_SECRET`: 랜덤한 긴 문자열로 설정 (최소 32자 이상 권장)
- `ADMIN_PASSWORD`: 강력한 비밀번호 사용 (production 환경에서는 bcrypt 사용 권장)

### DB 마이그레이션

```bash
psql -U postgres -d my_blog < backend/db/add-kanban-to-projects.sql
```

## 개발 서버 실행

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run dev
```

## Production 배포

### PM2 재시작

```bash
cd backend
pm2 restart ecosystem.config.cjs
```

### 로그인

브라우저에서 `/admin/login`으로 이동하여 관리자 비밀번호 입력

## 인증 시스템 개요

- **관리자 전용 기능**: 글/프로젝트 추가, 수정, 삭제
- **공개 기능**: 모든 콘텐츠 조회
- **세션 기반 인증**: 7일간 유지
- **로그인 페이지**: `/admin/login`
