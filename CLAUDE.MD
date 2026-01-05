# CLAUDE.MD

Claude AI 개발 가이드라인

## 1. 코드 작성 규칙

### 테스트 환경 제외, 절대 모킹하지 않기
- 실제 동작하는 코드만 작성
- 테스트 환경이 아닌 곳에서는 모킹 금지

### 오버엔지니어링 금지
- 구현을 원하는 명확한 기능만 구현
- 임의로 기능 추가 금지
- 과도한 구현 금지

### 네이밍 규칙
- 기능을 명확히 나타내는 이름 사용
- 구현 수정으로 인해 기존 클래스, 함수, 모듈의 이름이 내부 구현과 일치하지 않게 된다면 즉시 리네이밍

### 라이브러리 관리
- 최신 버전 지향
- 배포를 고려하여 버전 고정
- 새로운 의존성 도입 시마다 버전 고정 원칙 준수

### 코딩 스타일
- 각 언어의 공식 코딩 스타일과 주석 스타일 준수
- 예시: Python의 경우 [PEP 8](https://peps.python.org/pep-0008/) 철저히 준수

### SOLID 원칙 및 설계
- SOLID 원칙 준수
- 하드코딩 금지
- 유지보수성 중요시
- 과도한 추상화 지양, 요구사항에 적절한 수준의 추상화만 사용
- 디자인 패턴 적절히 응용
- **결합도는 최대한 낮게, 응집도는 최대한 높게**
- 코드 수정의 영향은 하나의 모듈에서 그치도록 설계
- 정보 교환 시 언어 자체 지원 자료형 우선 사용 (Python의 경우 built-in types)

### 환경변수 추적
- 환경변수 변경사항 철저히 확인
- 환경변수 의존성 명확히 문서화

### 인프라 환경 추적
- 코드가 인프라 영향을 받는 경우 사전 고지
- 하드웨어적, 소프트웨어적 환경 조건 명시
- 의사결정에 필요한 인프라 정보 제공

## 2. 답변 규칙

### 묻는 것에만 답하기
- 질문된 내용에만 집중
- 과도한 텍스트 작성 금지
- 정말 필요한 코드만 작성

### Before & After
- 코드 수정 전후 직접 의존하거나 의존되는 모듈의 영향 파악
- 변경사항의 파급효과 분석 및 명시

## 3. 문서화 규칙

### 기술적 어투
- 과장하는 어투 금지
- 이모지 사용 금지
- 드라이하게 구현 내용 중심으로 작성
- 문제 해결 과정을 구체적으로 기술
- 사고 과정을 상세히 문서화
- 해당 사고 과정에 필요한 기반 CS 지식 명시

### 성능 수치
- 전문 소프트웨어로 측정한 성능 수치만 기입
- 로컬 테스트 수치는 절대 기입 금지
- 신뢰 가능한 벤치마크 결과만 문서화

## 4. 마크다운 지원 구현 (2026-01-05)

### 구현 목표
블로그 포스트 및 프로젝트의 본문 작성 시 마크다운 문법 지원

### 아키텍처 결정: 서버 사이드 렌더링 (Option A)
DB에 마크다운 원본(`content_markdown`)과 렌더링된 HTML(`content_html`)을 모두 저장하는 이중 컬럼 방식 채택.

**선택 이유:**
- SEO: 서버에서 HTML을 생성하여 검색엔진 크롤러가 콘텐츠를 즉시 읽을 수 있음
- 성능: 클라이언트에서 매번 마크다운 파싱하는 오버헤드 제거
- 보안: 서버에서 XSS 방지 처리를 중앙화하여 클라이언트 우회 불가능
- 유지보수: 원본 마크다운을 보존하여 수정 시 원본 데이터 유지

**대안 (미채택):**
- Option B (클라이언트 렌더링): 클라이언트 번들 크기 증가, SEO 불리
- Option C (캐시 기반): 인프라 복잡도 증가, 오버엔지니어링

### 데이터베이스 스키마 변경

```sql
-- blog.posts 테이블
ALTER TABLE blog.posts RENAME COLUMN content TO content_markdown;
ALTER TABLE blog.posts ADD COLUMN content_html TEXT DEFAULT '';

-- blog.projects 테이블
ALTER TABLE blog.projects RENAME COLUMN content TO content_markdown;
ALTER TABLE blog.projects ADD COLUMN content_html TEXT DEFAULT '';
```

**적용 범위:**
- Posts: 본문(`content`) 필드만 마크다운 지원
- Projects: 상세 내용(`content`) 필드만 마크다운 지원, 간단한 소개(`description`)는 plain text 유지

### 라이브러리 선택: marked + sanitize-html

**marked v15.0.6**
- 역할: 마크다운 → HTML 파싱
- GitHub Flavored Markdown (GFM) 지원
- 설정:
  - `gfm: true` - 테이블, 취소선, 자동 링크 등
  - `breaks: true` - 개행을 `<br>` 태그로 변환
  - `headerIds: true` - 헤더에 ID 자동 생성 (앵커 링크)
  - `mangle: false` - 이메일 주소 난독화 비활성화

**sanitize-html v2.14.0**
- 역할: XSS 공격 방지
- 허용 태그: h1~h6, p, br, hr, ul, ol, li, strong, em, del, code, pre, a, img, blockquote, table, thead, tbody, tr, th, td
- 허용 속성:
  - `a`: href, title
  - `img`: src, alt, title
  - `*`: class, id

**대안 라이브러리 시도 및 실패:**
1. `isomorphic-dompurify`: ERR_REQUIRE_ESM 에러 발생
   - 에러 경로: `node_modules/@exodus/bytes/encoding-lite.js`
   - 원인: jsdom → html-encoding-sniffer → @exodus/bytes 의존성 체인에서 @exodus/bytes가 ESM 전용 모듈이나 CommonJS 컨텍스트에서 require()로 로드 시도
   - 로그: `/home/jcw/my-blog/backend/logs/err.log`에서 확인

2. `sanitize-html`로 교체 후 해결
   - 동일한 jsdom 의존성을 갖지만 최신 버전에서 ESM 호환성 개선됨
   - 격리 환경 테스트(`node test-sanitize.mjs`)에서 정상 동작 확인

### 백엔드 구현

**`backend/services/postService.js`**
**`backend/services/projectService.js`**

```javascript
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: true,
  mangle: false,
});

function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }
  const rawHtml = marked.parse(markdown);
  const cleanHtml = sanitizeHtml(rawHtml, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'del', 'code', 'pre',
      'a', 'img',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
      '*': ['class', 'id']
    },
  });
  return cleanHtml;
}
```

**CREATE 로직 변경:**
- 입력: `content` (마크다운 원본)
- DB 저장: `content_markdown` = 원본, `content_html` = renderMarkdown(원본)

**UPDATE 로직 변경:**
- `content` 필드 수정 시 `content_markdown`와 `content_html` 모두 업데이트
- 파라미터 카운트: content 하나로 2개 컬럼 업데이트

### 프론트엔드 구현

**`frontend/src/pages/blog/[slug].astro`**
- 표시: `post.content_html || post.content`
  - 우선 content_html 사용 (렌더링된 HTML)
  - 없으면 content 폴백 (마이그레이션 이전 데이터 호환)
- 수정 모달: `currentPost.content_markdown || currentPost.content`
  - 편집 시 마크다운 원본 사용

**`frontend/src/pages/projects/[id].astro`**
- 동일한 패턴 적용

**스타일링:**
- Tailwind Typography (`prose prose-invert`) 클래스 사용
- 다크 테마 대응, 최대 너비 제한 없음

### 보안 고려사항

**XSS 방지 계층:**
1. 서버: sanitizeHtml로 허용되지 않은 태그/속성 제거
2. DB: 사전 정제된 HTML만 저장
3. 프론트엔드: innerHTML 대신 템플릿 리터럴 사용 (Astro 기본 이스케이핑)

**허용하지 않는 태그:**
- `<script>`, `<iframe>`, `<object>`, `<embed>`: 코드 실행 방지
- `<form>`, `<input>`: CSRF 공격 벡터 제거
- `<style>`: CSS 인젝션 방지

### 에러 핸들링

**renderMarkdown 함수:**
- 입력이 null/undefined/non-string: 빈 문자열 반환
- 마크다운 파싱 실패: marked 라이브러리가 일반 텍스트로 처리
- HTML 정제 실패: sanitizeHtml이 모든 태그 제거 (빈 문자열 또는 텍스트만 남김)

### 마이그레이션 전략

**기존 데이터 호환성:**
- 컬럼명 변경: `content` → `content_markdown`
- 기존 `content` 데이터는 마크다운 원본으로 간주
- `content_html`은 빈 문자열 기본값
- 프론트엔드에서 폴백 처리로 기존 데이터 표시 가능

**점진적 적용:**
1. 스키마 변경
2. 백엔드 코드 배포
3. 신규 작성 글부터 자동으로 HTML 생성
4. 기존 글 수정 시 HTML 자동 생성

### 테스트 계획

1. 마크다운 파싱 테스트
   - 헤더, 리스트, 코드 블록, 링크, 이미지
   - GFM 확장 문법: 테이블, 취소선, 체크박스

2. XSS 방지 테스트
   - `<script>alert('XSS')</script>` → 제거됨
   - `<img src=x onerror=alert('XSS')>` → onerror 속성 제거됨

3. 기존 데이터 호환성 테스트
   - content_html이 없는 레코드도 정상 표시

### 배포 체크리스트

- [x] DB 스키마 변경 적용
- [x] package.json에 의존성 추가 (marked, sanitize-html)
- [x] npm install 실행
- [x] 백엔드 서비스 코드 수정
- [x] 프론트엔드 페이지 수정
- [ ] 백엔드 재시작 테스트
- [ ] 신규 포스트/프로젝트 생성 테스트
- [ ] 기존 데이터 표시 확인
- [ ] XSS 방지 검증
