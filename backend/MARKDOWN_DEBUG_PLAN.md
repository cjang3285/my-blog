# 마크다운 미작동 원인 진단 계획

## 문제 증상
- 라즈베리파이 환경에서 마크다운이 렌더링되지 않음
- 로컬 개발 환경에서는 정상 동작 (확인 필요)

## 진단 순서

### 1단계: 데이터베이스 레이어 확인
**목적:** DB 스키마와 데이터가 올바른지 확인

```bash
# 1-1. 스키마 확인 (content_markdown, content_html 컬럼 존재 여부)
sudo -u postgres psql -d my_blog -c "\d blog.posts" | grep content

# 1-2. 실제 데이터 샘플 확인
sudo -u postgres psql -d my_blog -c "SELECT id, title, LEFT(content_markdown, 50) as markdown_preview, LEFT(content_html, 50) as html_preview FROM blog.posts LIMIT 3"

# 1-3. content_html이 비어있는 레코드 개수
sudo -u postgres psql -d my_blog -c "SELECT COUNT(*) FROM blog.posts WHERE content_html = ''"
```

**예상 결과:**
- `content_markdown` TEXT 컬럼 존재
- `content_html` TEXT 컬럼 존재
- content_html에 HTML 태그(`<p>`, `<h2>` 등) 포함

**실패 시:**
- 스키마 변경 안됨: DB 마이그레이션 필요
- content_html 비어있음: 백엔드 로직 미작동

---

### 2단계: 백엔드 레이어 확인
**목적:** 서비스 코드와 마크다운 모듈 확인

```bash
cd ~/my-blog/backend

# 2-1. utils/markdown.js 파일 존재 확인
ls -la utils/markdown.js

# 2-2. postService.js에서 마크다운 모듈 import 확인
head -5 services/postService.js

# 2-3. node_modules에 패키지 설치 확인
ls node_modules/ | grep -E "^marked$|^sanitize-html$"

# 2-4. package.json 의존성 확인
grep -A 3 '"dependencies"' package.json

# 2-5. 백엔드 로그 확인 (에러 여부)
pm2 logs blog-backend --lines 50 --err
```

**예상 결과:**
- `utils/markdown.js` 파일 존재
- `import { renderMarkdown } from '../utils/markdown.js';` 확인
- `marked`, `sanitize-html` 디렉토리 존재
- package.json에 marked, sanitize-html 포함
- 백엔드 에러 없음

**실패 시:**
- 파일 없음: git pull 안됨
- import 다름: 코드 동기화 안됨
- 패키지 없음: npm install 필요
- 에러 있음: 에러 내용 분석

---

### 3단계: API 응답 확인
**목적:** 백엔드가 올바른 데이터를 반환하는지 확인

```bash
# 3-1. Posts API 응답 구조 확인
curl -s http://localhost:3000/api/posts | jq '.[0] | keys' | head -20

# 3-2. content_html 필드 존재 및 내용 확인
curl -s http://localhost:3000/api/posts | jq -r '.[0] | {id, title, content_html_length: (.content_html | length), content_html_sample: (.content_html | .[0:100])}'

# 3-3. 마크다운 원본도 확인
curl -s http://localhost:3000/api/posts | jq -r '.[0] | {content_markdown_sample: (.content_markdown | .[0:100])}'
```

**예상 결과:**
- API 응답에 `content_html`, `content_markdown` 필드 포함
- `content_html_length` > 0
- `content_html_sample`에 `<h2>`, `<p>` 같은 HTML 태그 포함

**실패 시:**
- 필드 없음: 백엔드 SELECT 쿼리 문제
- content_html 빈 문자열: 렌더링 로직 미실행
- HTML 태그 없음: 마크다운 파싱 실패

---

### 4단계: 프론트엔드 레이어 확인
**목적:** 프론트엔드 코드가 최신인지, 렌더링 로직이 올바른지 확인

```bash
cd ~/my-blog/frontend

# 4-1. 최신 코드인지 확인
git log --oneline -3 src/pages/blog/[slug].astro

# 4-2. innerHTML 설정 코드 확인
grep -n "innerHTML.*content_html" src/pages/blog/[slug].astro

# 4-3. div id 확인
grep -n 'id="post-body"' src/pages/blog/[slug].astro

# 4-4. 프론트엔드 빌드 및 재시작
npm run build
pm2 restart blog-frontend
pm2 logs blog-frontend --lines 20
```

**예상 결과:**
- `contentDiv.innerHTML = post.content_html || post.content_markdown || post.content || '';` 존재
- `<div id="post-body">` 존재
- 빌드 에러 없음

**실패 시:**
- 코드 다름: git pull 안됨
- innerHTML 설정 없음: 코드 누락
- 빌드 에러: 에러 내용 분석

---

### 5단계: 브라우저 레벨 확인
**목적:** 실제 브라우저에서 렌더링 확인

```bash
# 5-1. 브라우저 개발자 도구 (F12) 열기
# 5-2. Console 탭에서 에러 확인
# 5-3. Network 탭에서 API 요청 응답 확인
#      - /api/posts 응답에 content_html 있는지
# 5-4. Elements 탭에서 DOM 확인
#      - <div id="post-body"> 안에 HTML 태그가 있는지
#      - innerHTML이 제대로 설정되었는지
```

**확인 방법:**
브라우저 Console에서 실행:
```javascript
// API 응답 확인
fetch('/api/posts').then(r => r.json()).then(d => console.log(d[0].content_html));

// DOM 확인
console.log(document.getElementById('post-body').innerHTML);
```

**예상 결과:**
- API 응답에 HTML 태그 포함
- post-body div에 HTML 렌더링됨
- Console 에러 없음

---

## 진단 실행 순서

1. **라즈베리파이에서 1~4단계 커맨드 순차 실행**
2. **각 단계에서 실패 지점 발견 시 멈추고 결과 보고**
3. **실패 지점에 따라 해결 방안 적용**

---

## 예상 원인별 해결 방안

### 원인 1: 코드 동기화 안됨
**증상:** git pull 안했거나 파일 누락
**해결:**
```bash
cd ~/my-blog
git pull origin claude/add-markdown-support-6fGtE
cd backend && npm install
cd ../frontend && npm install && npm run build
pm2 restart all
```

### 원인 2: DB 스키마 변경 안됨
**증상:** content_markdown, content_html 컬럼 없음
**해결:**
```bash
sudo -u postgres psql -d my_blog <<EOF
ALTER TABLE blog.posts RENAME COLUMN content TO content_markdown;
ALTER TABLE blog.posts ADD COLUMN content_html TEXT DEFAULT '';
ALTER TABLE blog.projects RENAME COLUMN content TO content_markdown;
ALTER TABLE blog.projects ADD COLUMN content_html TEXT DEFAULT '';
EOF
```

### 원인 3: content_html 비어있음 (렌더링 안됨)
**증상:** content_html = ''
**해결:** 마이그레이션 스크립트 실행 필요 (별도 제공)

### 원인 4: npm 패키지 미설치
**증상:** marked, sanitize-html 없음
**해결:**
```bash
cd ~/my-blog/backend
rm -rf node_modules package-lock.json
npm install
pm2 restart blog-backend
```

### 원인 5: 프론트엔드 빌드 안됨
**증상:** 프론트엔드 코드 변경 반영 안됨
**해결:**
```bash
cd ~/my-blog/frontend
npm run build
pm2 restart blog-frontend
```

---

## 다음 단계

위 커맨드들을 라즈베리파이에서 순차 실행하고 결과를 보고해주세요.
실패 지점을 찾으면 즉시 해결 방안을 제시하겠습니다.
