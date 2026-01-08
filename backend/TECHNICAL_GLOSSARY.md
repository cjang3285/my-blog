# 기술 용어 완전 해설

본 문서는 마크다운 지원 구현 과정에서 사용된 모든 기술 용어, 커맨드, 코드를 세세하게 설명합니다.

## 1. 데이터베이스 (PostgreSQL)

### SQL 커맨드

#### `ALTER TABLE blog.posts RENAME COLUMN content TO content_markdown;`
- `ALTER TABLE`: 기존 테이블의 구조를 변경하는 SQL DDL(Data Definition Language) 명령
- `blog.posts`: `blog` 스키마에 속한 `posts` 테이블 지정
  - 스키마: 데이터베이스 내에서 테이블을 논리적으로 그룹화하는 네임스페이스
- `RENAME COLUMN`: 컬럼명 변경 지시
- `content TO content_markdown`: `content` 컬럼을 `content_markdown`으로 변경
- `;`: SQL 문의 종료를 나타내는 구분자

#### `ALTER TABLE blog.posts ADD COLUMN content_html TEXT DEFAULT '';`
- `ADD COLUMN`: 테이블에 새로운 컬럼 추가
- `content_html`: 추가할 컬럼명
- `TEXT`: PostgreSQL 데이터 타입, 가변 길이 문자열 (최대 1GB)
  - `VARCHAR`와 달리 길이 제한 없음
- `DEFAULT ''`: 기본값 설정, 빈 문자열
  - 기존 레코드에 NULL이 아닌 빈 문자열이 할당됨

#### `sudo -u postgres psql -d my_blog`
- `sudo`: superuser do, 관리자 권한으로 명령 실행
- `-u postgres`: postgres 사용자로 실행
- `psql`: PostgreSQL 대화형 터미널
- `-d my_blog`: my_blog 데이터베이스에 연결

#### `\d blog.posts`
- `\d`: psql 메타 커맨드, describe의 약자
- 테이블 구조(컬럼, 타입, 제약조건) 출력

#### `SELECT id, content_markdown FROM blog.posts WHERE content_html = '';`
- `SELECT`: 데이터 조회 SQL DML(Data Manipulation Language)
- `id, content_markdown`: 조회할 컬럼 목록
- `FROM blog.posts`: 조회 대상 테이블
- `WHERE content_html = ''`: 조건절, content_html이 빈 문자열인 레코드만
- `''`: 빈 문자열 리터럴 (NULL과 다름)

#### `UPDATE blog.posts SET content_html = $1 WHERE id = $2`
- `UPDATE`: 기존 레코드 수정
- `SET`: 수정할 컬럼과 값 지정
- `$1, $2`: 파라미터 플레이스홀더 (Prepared Statement)
  - SQL 인젝션 방지
  - 값은 별도로 바인딩됨

### PostgreSQL 연결 풀

#### `pool.query()`
- `pool`: pg 라이브러리의 연결 풀 객체
- 연결 풀: 데이터베이스 연결을 미리 생성하여 재사용
  - 매번 연결/해제 오버헤드 제거
  - 동시 접속 수 제한으로 리소스 관리

#### `const client = await pool.connect();`
- `await`: async/await 비동기 처리
  - Promise가 resolve될 때까지 대기
- `pool.connect()`: 풀에서 클라이언트 하나 가져옴
- `client.release()`: 사용 후 풀에 반환 (필수)

## 2. Node.js & JavaScript

### ES Modules (ESM)

#### `import { marked } from 'marked';`
- `import`: ES6 모듈 import 문
- `{ marked }`: named export 가져오기
- `from 'marked'`: node_modules/marked에서 로드
- 확장자 `.js` 생략 가능 (Node.js가 자동 해석)

#### `import pool from '../config/db.js';`
- default export 가져오기
- `../config/db.js`: 상대 경로, 반드시 `.js` 확장자 필요 (ESM 규칙)
- `..`: 상위 디렉토리

#### `export const getAllPosts = async () => { ... }`
- `export`: 함수를 모듈 외부로 노출
- `const`: 상수 선언 (재할당 불가)
- `async`: 비동기 함수 선언
  - 함수 내부에서 `await` 사용 가능
  - 자동으로 Promise 반환

#### `export default renderMarkdown;`
- default export: 모듈당 하나만 가능
- import 시 중괄호 없이 사용: `import renderMarkdown from ...`

### CommonJS vs ESM

#### ERR_REQUIRE_ESM 에러
```
Error [ERR_REQUIRE_ESM]: require() of ES Module ... not supported.
```

**원인:**
- CommonJS (`require()`) 방식으로 ESM 전용 모듈 로드 시도
- `@exodus/bytes`가 ESM만 지원 (`"type": "module"` in package.json)
- `html-encoding-sniffer`가 CommonJS 방식으로 require() 호출

**ESM vs CommonJS:**
- CommonJS: `require()`, `module.exports` (Node.js 전통 방식)
- ESM: `import`, `export` (표준 JavaScript, 브라우저 호환)
- Node.js에서 ESM 사용: package.json에 `"type": "module"` 추가

### 비동기 처리

#### `async/await`
```javascript
async function migrate() {
  const posts = await client.query('SELECT ...');
  for (const post of posts.rows) {
    await client.query('UPDATE ...');
  }
}
```

- `async`: 함수를 비동기로 선언
- `await`: Promise 완료까지 대기 (블로킹)
- `for...of`: 배열 순회, await 사용 가능 (forEach는 불가)
- `.rows`: pg 라이브러리 쿼리 결과의 레코드 배열

#### Promise
```javascript
migrate().catch(console.error);
```
- `catch()`: Promise rejection 처리
- `console.error`: 에러 로깅

### 함수 및 제어문

#### 타입 검사
```javascript
if (!markdown || typeof markdown !== 'string') {
  return '';
}
```
- `!markdown`: falsy 체크 (null, undefined, '', 0, false)
- `typeof markdown !== 'string'`: 타입 확인
- early return 패턴: 유효성 검사 실패 시 즉시 반환

#### 템플릿 리터럴
```javascript
const html = `<h1>${title}</h1>`;
```
- 백틱(`)으로 감싼 문자열
- `${}`: 표현식 삽입 (interpolation)
- 멀티라인 지원

#### Heredoc (Bash에서)
```bash
git commit -m "$(cat <<'EOF'
메시지 내용
EOF
)"
```
- `<<'EOF'`: here-document 시작 (EOF까지 입력)
- 작은따옴표: 변수 치환 안함
- 큰따옴표 없으면: 변수 치환 함
- `$(...)`: command substitution, 커맨드 출력을 문자열로

## 3. 마크다운 처리

### marked 라이브러리

#### `marked.setOptions()`
```javascript
marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: true,
  mangle: false,
});
```

- `gfm`: GitHub Flavored Markdown 활성화
  - 테이블: `| col1 | col2 |`
  - 취소선: `~~text~~`
  - 자동 링크: URL 자동 감지
  - 작업 리스트: `- [ ] task`
- `breaks`: 개행(`\n`)을 `<br />` 태그로 변환
  - false: 개행 무시 (두 번 개행만 단락 분리)
- `headerIds`: 헤더에 id 속성 자동 생성
  - `# Title` → `<h1 id="title">Title</h1>`
  - 앵커 링크 가능: `#title`로 이동
- `mangle`: 이메일 주소 난독화 비활성화
  - true: `email@example.com` → HTML entity로 변환

#### `marked.parse()`
```javascript
const rawHtml = marked.parse(markdown);
```
- 마크다운 문자열을 HTML로 파싱
- 동기 함수 (비동기 버전도 있음)
- 반환값: HTML 문자열 (정제되지 않음)

### sanitize-html 라이브러리

#### XSS (Cross-Site Scripting) 방지
```javascript
const cleanHtml = sanitizeHtml(rawHtml, {
  allowedTags: ['h1', 'h2', ...],
  allowedAttributes: {
    a: ['href', 'title'],
    '*': ['class', 'id']
  },
});
```

**allowedTags:**
- 화이트리스트 방식: 명시된 태그만 허용
- 나머지는 제거 또는 이스케이프
- 예: `<script>` → 제거됨

**allowedAttributes:**
- 태그별 허용 속성 지정
- `a: ['href', 'title']`: a 태그는 href, title만
- `'*': ['class', 'id']`: 모든 태그에 class, id 허용
- `onerror`, `onclick` 등 이벤트 핸들러 차단

**XSS 공격 예시:**
```html
<img src=x onerror=alert('XSS')>
```
sanitize 후:
```html
<img src="x" />
```
- `onerror` 속성 제거됨
- 악성 스크립트 실행 불가

### 마크다운 문법

#### 헤더
```markdown
# H1
## H2
### H3
```
- `#` 개수로 레벨 지정 (1~6)
- **반드시 `#` 뒤에 공백 필요**
- `##text` → 파싱 안됨
- `## text` → `<h2>text</h2>`

#### 강조
```markdown
**bold** *italic* ~~strikethrough~~
```
- `**`: `<strong>bold</strong>`
- `*`: `<em>italic</em>`
- `~~`: `<del>strikethrough</del>` (GFM)

#### 리스트
```markdown
- item 1
- item 2
  - nested
```
- `-`, `*`, `+`: 순서 없는 리스트
- `1.`, `2.`: 순서 있는 리스트
- 들여쓰기 (2칸 또는 4칸): 중첩

#### 코드
```markdown
`inline code`

\`\`\`javascript
function test() {}
\`\`\`
```
- 백틱 1개: 인라인 코드 → `<code>`
- 백틱 3개: 코드 블록 → `<pre><code>`
- 언어 지정: syntax highlighting (marked는 class만 추가)

#### 링크 및 이미지
```markdown
[text](url "title")
![alt](url "title")
```
- `[text](url)`: `<a href="url">text</a>`
- `![alt](url)`: `<img src="url" alt="alt">`

#### 테이블 (GFM)
```markdown
| Col1 | Col2 |
|------|------|
| A    | B    |
```
- 첫 행: 헤더
- 두 번째 행: 구분선 (`-` 3개 이상)
- 정렬: `:---` (왼쪽), `:---:` (중앙), `---:` (오른쪽)

## 4. 프론트엔드 (Astro & JavaScript)

### Astro 템플릿

#### 동적 콘텐츠 렌더링
```javascript
container.innerHTML = `
  <article>
    <h1>${post.title}</h1>
    <div id="post-content"></div>
  </article>
`;
```

**템플릿 리터럴 내 HTML:**
- `${}`: JavaScript 표현식 삽입
- **자동 이스케이프:** 특수 문자가 HTML entity로 변환
  - `<` → `&lt;`
  - `>` → `&gt;`
- HTML 태그가 텍스트로 표시됨

#### innerHTML을 사용한 HTML 삽입
```javascript
const contentDiv = document.getElementById('post-content');
contentDiv.innerHTML = post.content_html;
```

**innerHTML:**
- 문자열을 HTML로 파싱하여 DOM에 삽입
- **보안 위험:** XSS 공격 가능
- 사용 조건: 신뢰할 수 있는 콘텐츠만 (서버에서 정제된 HTML)

**대안 (안전):**
- `textContent`: 텍스트만 삽입 (HTML 태그 이스케이프)
- `createElement()`: DOM API로 요소 생성

### JavaScript DOM 조작

#### `document.getElementById()`
```javascript
const div = document.getElementById('post-content');
```
- ID로 DOM 요소 찾기
- 반환: Element 또는 null
- 빠름 (ID는 고유)

#### `addEventListener()`
```javascript
button.addEventListener('click', handleClick);
```
- 이벤트 리스너 등록
- `click`: 이벤트 타입
- `handleClick`: 콜백 함수

#### `fetch()`
```javascript
const res = await fetch('/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ markdown })
});
const data = await res.json();
```

**fetch API:**
- HTTP 요청 (AJAX)
- `method`: HTTP 메서드 (GET, POST, PUT, DELETE)
- `headers`: HTTP 헤더
  - `Content-Type`: 요청 본문 형식
  - `application/json`: JSON 데이터
- `body`: 요청 본문
  - `JSON.stringify()`: JS 객체 → JSON 문자열
- `res.json()`: 응답 본문을 JSON으로 파싱

### Tailwind CSS

#### `prose prose-invert`
```html
<div class="prose prose-invert max-w-none">
```

- `prose`: Tailwind Typography 플러그인 클래스
  - 마크다운 콘텐츠 스타일링
  - 헤더, 단락, 리스트 등 자동 스타일 적용
- `prose-invert`: 다크 모드 색상
- `max-w-none`: 최대 너비 제한 없음 (기본: prose는 제한 있음)

## 5. Express.js (백엔드 프레임워크)

### 미들웨어 및 라우팅

#### `app.use(express.json())`
- JSON 본문 파싱 미들웨어
- `Content-Type: application/json` 요청 처리
- `req.body`에 파싱된 객체 저장

#### `app.post('/render', (req, res) => { ... })`
- POST 요청 라우트 정의
- `/render`: 엔드포인트 경로
- `(req, res)`: 핸들러 함수
  - `req`: 요청 객체 (body, params, query, headers 등)
  - `res`: 응답 객체 (send, json, status 등)

#### `res.json({ html })`
- JSON 응답 전송
- `Content-Type: application/json` 헤더 자동 설정
- 객체를 JSON 문자열로 직렬화

#### `app.listen(3333, callback)`
- HTTP 서버 시작
- `3333`: 포트 번호
- `callback`: 서버 시작 후 실행될 함수

## 6. Git 커맨드

### 기본 커맨드

#### `git status`
- 작업 디렉토리 상태 확인
- Modified: 수정된 파일
- Untracked: 추적되지 않는 새 파일
- Staged: 커밋 대기 중인 파일

#### `git add <file>`
- 파일을 staging area에 추가
- 다음 커밋에 포함될 변경사항 선택

#### `git commit -m "message"`
- staging area의 변경사항을 커밋
- `-m`: 커밋 메시지 지정
- SHA-1 해시로 고유 식별

#### `git push -u origin <branch>`
- 로컬 브랜치를 원격 저장소에 푸시
- `-u`: upstream 설정 (tracking branch)
- `origin`: 원격 저장소 이름 (기본값)
- 이후 `git push`만으로 푸시 가능

#### `git pull origin <branch>`
- 원격 브랜치를 로컬에 가져와 병합
- `git fetch` + `git merge`

#### `git checkout <branch>`
- 브랜치 전환
- 작업 디렉토리를 해당 브랜치 상태로 변경

### 고급 커맨드

#### `git pull --rebase origin <branch>`
- 원격 변경사항을 rebase로 적용
- `merge`와 달리 히스토리가 선형으로 유지
- 충돌 시 rebase 과정을 단계별로 해결

**Rebase vs Merge:**
- Merge: 두 브랜치를 병합 커밋으로 합침 (히스토리 분기)
- Rebase: 커밋을 다시 적용 (히스토리 선형)

#### `git reset HEAD~1`
- 최근 커밋 1개 취소
- `HEAD~1`: HEAD의 부모 커밋
- 변경사항은 작업 디렉토리에 유지 (unstaged)
- `--hard`: 변경사항 완전 삭제
- `--soft`: staging area에 유지

#### `git log --oneline -5`
- 최근 5개 커밋 간략 출력
- `--oneline`: 한 줄로 표시 (해시 + 메시지)
- `-5`: 개수 제한

#### `git diff <commit1>..<commit2> --name-status`
- 두 커밋 간 변경된 파일 목록
- `--name-status`: 파일명과 상태만
  - `M`: Modified
  - `A`: Added
  - `D`: Deleted

## 7. Linux/Bash 커맨드

### 파일 시스템

#### `ls -la`
- 파일/디렉토리 목록 출력
- `-l`: long format (권한, 소유자, 크기, 날짜)
- `-a`: all, 숨김 파일 포함 (`.`로 시작)

**출력 예시:**
```
-rw-r--r-- 1 root root 1035 Jan 5 02:00 package.json
```
- `-rw-r--r--`: 권한 (파일, 읽기/쓰기, 읽기, 읽기)
- `1`: 하드링크 수
- `root root`: 소유자, 그룹
- `1035`: 크기 (바이트)
- 날짜 및 파일명

#### `cd <path>`
- Change Directory, 디렉토리 이동
- `cd ~`: 홈 디렉토리
- `cd ..`: 상위 디렉토리
- `cd -`: 이전 디렉토리

#### `pwd`
- Print Working Directory, 현재 경로 출력

#### `mkdir <dir>`
- 디렉토리 생성
- `-p`: 중간 경로도 생성 (`mkdir -p a/b/c`)

#### `rm -rf <path>`
- 파일/디렉토리 삭제
- `-r`: recursive, 디렉토리 내용 포함
- `-f`: force, 확인 없이 삭제
- **주의:** 복구 불가능

#### `cat <file>`
- 파일 내용 출력
- concatenate의 약자

#### `head -5 <file>`
- 파일의 처음 5줄 출력
- 기본: 10줄

#### `tail -20 <file>`
- 파일의 마지막 20줄 출력
- `-f`: follow, 실시간 추가 내용 출력 (로그 모니터링)

#### `grep <pattern> <file>`
- 파일에서 패턴 검색
- 정규식 지원
- `-r`: 디렉토리 재귀 검색
- `-i`: 대소문자 무시
- `-n`: 줄 번호 표시

**예시:**
```bash
grep "renderMarkdown" services/postService.js
```
- postService.js에서 renderMarkdown 문자열 검색

#### `find . -name "*.md"`
- 파일 검색
- `.`: 현재 디렉토리부터
- `-name`: 이름 패턴
- `-type f`: 파일만 (d: 디렉토리)

### 프로세스 관리

#### `node app.js &`
- `&`: 백그라운드 실행
- 터미널이 종료되어도 프로세스 유지 (nohup과 함께 사용 권장)
- PID 출력됨

#### `kill <PID>`
- 프로세스 종료
- 기본: SIGTERM (정상 종료 요청)
- `-9`: SIGKILL (강제 종료)

#### `pkill -f "node app.js"`
- 프로세스 이름으로 종료
- `-f`: full command line 매칭
- 여러 프로세스 동시 종료 가능

#### `sleep 3`
- 3초 대기
- 스크립트에서 타이밍 조정용

### 패키지 관리

#### `npm install`
- package.json의 dependencies 설치
- node_modules/ 디렉토리 생성
- package-lock.json 생성/업데이트 (정확한 버전 고정)

#### `npm install <package>`
- 특정 패키지 설치
- `--save`: dependencies에 추가 (기본값)
- `--save-dev`: devDependencies에 추가
- `@<version>`: 버전 지정

#### `npm run dev`
- package.json의 scripts.dev 실행
- nodemon으로 개발 서버 실행 (파일 변경 시 자동 재시작)

### PM2 (Process Manager)

#### `pm2 start app.js --name blog-backend`
- Node.js 앱을 데몬으로 실행
- `--name`: 프로세스 이름 지정
- 자동 재시작, 로그 관리, 모니터링

#### `pm2 restart blog-backend`
- 프로세스 재시작
- 무중단 배포 가능 (클러스터 모드)

#### `pm2 logs blog-backend --lines 50`
- 로그 출력
- `--lines`: 최근 N줄
- `--err`: 에러 로그만

#### `pm2 status`
- 모든 프로세스 상태 확인
- CPU, 메모리 사용량 표시

### 파이프 및 리디렉션

#### `|` (파이프)
```bash
curl http://localhost:3000/api/posts | jq '.[0]'
```
- 왼쪽 커맨드의 출력을 오른쪽 커맨드의 입력으로
- 체인 가능: `cat file | grep pattern | wc -l`

#### `>` (출력 리디렉션)
```bash
echo "hello" > file.txt
```
- 커맨드 출력을 파일로 (덮어쓰기)
- `>>`: 파일 끝에 추가

#### `2>&1` (stderr → stdout)
```bash
command 2>&1
```
- 파일 디스크립터 2 (stderr)를 1 (stdout)로 리디렉션
- 에러와 정상 출력 모두 캡처

#### `< <(command)` (Process Substitution)
```bash
psql < <(echo "SELECT * FROM users;")
```
- 커맨드 출력을 파일처럼 사용

### jq (JSON 프로세서)

#### `jq '.[0]'`
- JSON 배열의 첫 번째 요소

#### `jq '.id, .title'`
- 여러 필드 선택

#### `jq '.[0] | {id, title}'`
- 객체 재구성 (특정 필드만)

#### `jq -r '.content_html'`
- `-r`: raw 출력 (따옴표 제거)

#### `jq 'length'`
- 배열/객체 길이

## 8. HTTP & API

### HTTP 메서드

#### GET
- 리소스 조회
- body 없음 (query string 사용)
- 멱등성: 여러 번 호출해도 같은 결과
- 캐싱 가능

#### POST
- 리소스 생성
- body에 데이터 전송
- 멱등성 없음

#### PUT
- 리소스 전체 수정
- 멱등성 있음

#### DELETE
- 리소스 삭제

### HTTP 상태 코드

#### 2xx (성공)
- 200 OK: 요청 성공
- 201 Created: 리소스 생성 성공

#### 4xx (클라이언트 에러)
- 400 Bad Request: 잘못된 요청
- 401 Unauthorized: 인증 필요
- 403 Forbidden: 권한 없음
- 404 Not Found: 리소스 없음

#### 5xx (서버 에러)
- 500 Internal Server Error: 서버 오류
- 502 Bad Gateway: 게이트웨이 오류 (프록시)

### CORS (Cross-Origin Resource Sharing)

```javascript
app.use(cors());
```

- 다른 도메인에서의 API 요청 허용
- Same-Origin Policy 우회
- `Access-Control-Allow-Origin` 헤더 설정
- 보안 위험: 신뢰할 수 있는 도메인만 허용 권장

### curl

#### `curl http://localhost:3000/api/posts`
- HTTP 요청 전송
- 기본: GET

#### `curl -s http://...`
- `-s`: silent, 진행 상황 숨김

#### `curl -X POST -H "Content-Type: application/json" -d '{"key":"value"}'`
- `-X`: HTTP 메서드 지정
- `-H`: 헤더 추가
- `-d`: 데이터 (body)

## 9. 보안

### XSS (Cross-Site Scripting)

**공격 예시:**
```html
<img src=x onerror=alert(document.cookie)>
```
- 악성 스크립트가 피해자 브라우저에서 실행
- 쿠키 탈취, 세션 하이재킹

**방어:**
1. 입력 검증 (서버)
2. HTML 이스케이프
3. CSP (Content Security Policy) 헤더
4. HttpOnly 쿠키

### SQL Injection

**공격 예시:**
```javascript
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
// id = "1 OR 1=1" → 모든 레코드 반환
```

**방어: Prepared Statement**
```javascript
const query = 'SELECT * FROM users WHERE id = $1';
pool.query(query, [req.params.id]);
```
- 파라미터 바인딩
- SQL과 데이터 분리

### CSRF (Cross-Site Request Forgery)

- 사용자가 의도하지 않은 요청 전송
- 방어: CSRF 토큰, SameSite 쿠키

## 10. 환경 변수 (.env)

```env
DB_HOST=localhost
DB_PORT=5432
```

#### `dotenv` 라이브러리
```javascript
import dotenv from 'dotenv';
dotenv.config();

const host = process.env.DB_HOST;
```

- `.env` 파일을 `process.env`로 로드
- 환경별 설정 분리 (dev, prod)
- **보안:** `.env`는 git에 커밋 금지 (.gitignore)

## 11. 정규식 (Regex)

#### `grep -E "pattern"`
- `-E`: Extended regex
- `.`: 임의의 한 문자
- `*`: 0개 이상 반복
- `+`: 1개 이상 반복
- `^`: 줄 시작
- `$`: 줄 끝
- `[]`: 문자 클래스
- `|`: OR

**예시:**
```bash
ls | grep -E "\.js$"
```
- `.js`로 끝나는 파일만

## 12. 아키텍처 패턴

### MVC (Model-View-Controller)

**Model (services/):**
- 비즈니스 로직
- 데이터베이스 접근
- `postService.js`, `projectService.js`

**Controller (controllers/):**
- 요청 처리
- 입력 검증
- 서비스 호출

**View (frontend/):**
- UI 렌더링
- Astro 템플릿

### 레이어드 아키텍처

```
Router → Controller → Service → Database
```

- 관심사 분리 (Separation of Concerns)
- 의존성 단방향
- 테스트 용이성

## 13. 패키지 버전

#### Semantic Versioning (SemVer)
```json
"marked": "15.0.6"
```

- `MAJOR.MINOR.PATCH`
- MAJOR: 호환성 깨지는 변경
- MINOR: 기능 추가 (하위 호환)
- PATCH: 버그 수정

#### 버전 범위
- `^15.0.6`: 15.x.x (MAJOR 고정)
- `~15.0.6`: 15.0.x (MINOR 고정)
- `15.0.6`: 정확한 버전

## 14. 에러 처리

### try-catch
```javascript
try {
  const result = await pool.query('SELECT ...');
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: 'Internal Server Error' });
}
```

- `try`: 예외 발생 가능 코드
- `catch`: 예외 처리
- `finally`: 항상 실행 (옵션)

### Promise 체인
```javascript
fetch('/api')
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

- `then()`: 성공 처리
- `catch()`: 실패 처리
- async/await로 대체 가능 (가독성)

## 15. 기타

### `package.json` 필드

```json
{
  "type": "module",
  "main": "app.js",
  "scripts": { "dev": "nodemon app.js" },
  "dependencies": {},
  "devDependencies": {}
}
```

- `type`: 모듈 시스템 (module: ESM, commonjs: CommonJS)
- `main`: 진입점
- `scripts`: 커스텀 명령
- `dependencies`: 프로덕션 의존성
- `devDependencies`: 개발 의존성 (빌드 도구, 테스트)

### `node_modules/`
- npm으로 설치된 패키지 저장소
- 프로젝트별로 독립적
- `.gitignore`에 추가 (용량 큼)
- `npm install`로 재생성 가능

### `package-lock.json`
- 정확한 의존성 버전 트리
- 팀원 간 동일한 버전 보장
- git에 커밋 필수

이상 마크다운 구현 과정에서 사용된 모든 기술 용어의 상세 설명입니다.
