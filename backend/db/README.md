# PostgreSQL 데이터베이스 설정

## 1. PostgreSQL 설치 확인
```bash
psql --version
```

## 2. PostgreSQL 접속
```bash
psql -U postgres
```

## 3. 데이터베이스 생성
```sql
CREATE DATABASE my_blog;
```

## 4. 데이터베이스 연결
```sql
\c my_blog
```

## 5. 테이블 생성 (프로젝트 루트에서)
```bash
psql -U postgres -d my_blog -f backend/db/init.sql
```

또는 PostgreSQL 쉘에서:
```sql
\i backend/db/init.sql
```

## 6. 환경 변수 설정
```bash
# backend 폴더로 이동
cd backend

# .env.example을 .env로 복사
cp .env.example .env

# .env 파일을 편집하여 실제 DB 정보 입력
```

## 7. npm 패키지 설치
```bash
cd backend
npm install
```

## 8. 서버 실행
```bash
npm run dev
```

## 테이블 확인
```sql
-- PostgreSQL 쉘에서
\dt

-- 테이블 구조 확인
\d projects

-- 데이터 확인
SELECT * FROM projects;
```

## 테이블 초기화 (필요시)
```sql
DROP TABLE IF EXISTS projects;
```
그 후 다시 init.sql을 실행하세요.
