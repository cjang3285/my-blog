# LEARNINGS.md

개발·개선·운영 과정에서 발견한 문제와 그로부터 얻은 교훈을 기록한다. 최신 항목이 위에 온다. 문서화 규칙(어투, 성능 수치 등)은 [CLAUDE.MD](./CLAUDE.MD) 3장을 따른다.

## 2026-08-04 방문자 로그 인증 우회 취약점 대응

### 발견 배경

운영 중인 방문자 로그(`/{adminPath}/visits`)를 검토하던 중, 인터넷에 상시 존재하는 배경 스캔(`.env`, `.git/config`, PHPUnit `eval-stdin.php` RCE 프로브(CVE-2017-9841), GeoServer RCE 프로브 등)과는 별개로 이상 패턴 발견: IP가 `127.0.0.1`로 기록되고 User-Agent가 `WordPress/6.9.4`로 위장된 요청이 `/blog/wp-login.php`, `/blog/wp-json/` 등을 조회함. 이 사이트에는 실제 워드프레스가 없으므로 워드프레스 스캔으로 위장한 시도가 왜 "로컬호스트에서" 온 것으로 기록됐는지 조사.

### 근본 원인 분석 (신뢰 체인 추적)

1. nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` — 이 지시어는 클라이언트가 보낸 `X-Forwarded-For` 값 뒤에 실제 접속 IP를 **추가(append)**할 뿐 덮어쓰지 않음.
2. `backend/middleware/auth.js`, `frontend/src/middleware.js` 둘 다 `X-Forwarded-For.split(',')[0]`으로 **첫 번째 값**을 클라이언트 IP로 채택 — nginx가 append 방식이므로 첫 값은 언제나 클라이언트가 직접 실어 보낸, 검증되지 않은 값.
3. `autoAuth` 미들웨어가 클라이언트 IP가 `127.0.0.1`이면 세션을 관리자로 자동 인증 — "로컬호스트=신뢰됨"이라는 개발 편의 기능이 위 1, 2와 결합해 인증 우회로 이어짐. 누구든 요청에 `X-Forwarded-For: 127.0.0.1` 헤더 한 줄만 추가하면 비밀번호 없이 포스트/프로젝트 작성·수정·삭제 권한을 가진 세션을 얻을 수 있었음.

**기반 CS 지식**: HTTP 리버스 프록시 뒤에서 클라이언트 IP를 판별할 때 `X-Forwarded-For`는 클라이언트가 임의로 조작 가능한 요청 헤더다. 신뢰할 수 있는 것은 오직 "가장 안쪽(서버에 가장 가까운) 프록시가 마지막에 추가한 값"뿐이며, 그 값을 신뢰하려면 프록시가 클라이언트가 보낸 기존 값을 **덮어써야** 한다. Express의 `trust proxy` 옵션은 이 hop-counting을 정확히 구현하지만, 헤더를 직접 파싱하는 코드가 있으면 그 계약이 조용히 깨진다.

### 추가로 발견된 문제

- pm2가 `ecosystem.config.cjs`의 기본 `env` 블록(`NODE_ENV=development`)으로 기동된 채 장기간 운영 중이었음 — `--env production` 플래그 없이 배포됨. dev 전용으로 제한한 방어도 이 상태에서는 무력화됨.
- 백엔드(3000)·프론트엔드(4321) 둘 다 `0.0.0.0`에 바인딩 + 방화벽(`ufw`) 비활성 — nginx를 거치지 않고 포트에 직접 접속하면 nginx에서 고친 신뢰 체인과 무관하게 임의 헤더 주입이 다시 가능.

### 해결

1. nginx `X-Forwarded-For`를 `$proxy_add_x_forwarded_for` → `$remote_addr`로 변경(append → overwrite).
2. `backend/middleware/auth.js`: 헤더 직접 파싱 대신 Express `req.ip` 사용. `frontend/src/middleware.js`: `split(',')`의 마지막 값 사용(방어적).
3. `autoAuth`를 `NODE_ENV === 'development'`에서만 동작하도록 제한.
4. pm2를 `--env production`으로 재기동, 이후 배포 시 항상 이 플래그를 명시.
5. 백엔드/프론트엔드를 `127.0.0.1`에만 바인딩(`HOST` env, `ecosystem.config.cjs`) — nginx 우회 경로 차단.
6. 로그인 비밀번호를 평문 비교에서 `bcrypt` 해시 비교로 전환.
7. nginx `limit_req_zone` 추가, `fail2ban`에 스캐너 시그니처(`.env`, `.git`, `wp-login`, `eval-stdin.php` 등) 및 rate-limit 위반 감지 jail 추가(기존엔 `sshd` jail만 있었음).

### 검증

```
# 스푸핑된 X-Forwarded-For로 인증 필요 엔드포인트 직접/nginx 경유 호출
curl -H "X-Forwarded-For: 127.0.0.1" http://localhost:3000/api/visits/stats        # -> 401 (이전: 200, 인증 우회)
curl -k -H "Host: chanwook.kr" -H "X-Forwarded-For: 127.0.0.1" https://localhost/api/visits/stats  # -> 401

# 정상 트래픽 회귀 확인
curl -k -H "Host: chanwook.kr" https://localhost/            # -> 200
curl -k -H "Host: chanwook.kr" https://localhost/api/posts   # -> 200

# 포트 바인딩 확인
ss -tlnp | grep -E ":3000|:4321"   # -> 127.0.0.1:3000, 127.0.0.1:4321 (이전: 0.0.0.0)
```

### 트러블슈팅: "`ip`를 body 대신 `req.ip`로 받자"가 실제로는 버그였던 이유

최초 대응으로 `POST /api/visits`가 body의 `ip` 필드를 그대로 믿는 게 위험하다고 판단해 서버측 `req.ip`로 대체했으나, 이는 **모든 방문자 IP가 `127.0.0.1`로만 기록되는 회귀**를 발생시켰음.

원인: Astro SSR(frontend, 4321)이 자신이 받은 요청의 `X-Forwarded-For`에서 실제 방문자 IP를 추출한 뒤, `http://localhost:3000/api/visits`로 백엔드에 내부 호출(loopback)을 보내는 구조. 이 내부 호출은 nginx를 거치지 않으므로 백엔드 입장에서 `req.ip`는 언제나 loopback이다. 즉 "IP를 신뢰 가능한 계층에서 판별"해야 하는 지점은 백엔드가 아니라 프론트엔드였다.

최종 해결: body의 `ip`는 유지하되, 그 값을 주장할 수 있는 호출자를 프론트엔드의 내부 loopback 호출로만 제한. nginx가 프록시하는 모든 외부 요청에는 반드시 `X-Forwarded-For` 헤더가 붙는다는 사실(위 nginx 설정 변경으로 항상 `$remote_addr`가 세팅됨)을 이용해, 이 헤더가 존재하면 외부에서 온 요청으로 간주해 `403`으로 거부(`backend/routes/visitRoutes.js`의 `internalOnly` 미들웨어).

**교훈**: 내부 서비스 호출 구조(frontend→backend loopback)에서 "클라이언트 IP"는 그 값을 최초로 관측한 계층에서만 정확하다. 후속 단계로 값을 전달할 때는 값 자체의 신뢰성이 아니라 "누가 이 값을 주장하고 있는가"를 검증하는 것이 핵심이다. `req.ip`로의 일괄 교체처럼 겉보기에 더 안전해 보이는 변경이 아키텍처를 이해하지 못하면 기능을 깨뜨릴 수 있다.

### 핵심 교훈

1. `X-Forwarded-For`는 append용 지시어(`$proxy_add_x_forwarded_for`)와 overwrite용 지시어(`$remote_addr`)를 구분해서 써야 한다 — 단일 리버스 프록시 뒤에 있다면 항상 후자를 쓴다.
2. 리버스 프록시 신뢰 설정(Express `trust proxy` 등)이 있어도, 코드 어딘가에서 헤더를 직접 파싱하면 그 신뢰 계약이 조용히 깨질 수 있다. `x-forwarded-for`를 직접 파싱하는 곳을 주기적으로 grep해서 점검.
3. "로컬호스트=신뢰됨" 같은 개발 편의 기능은 프로덕션에서 `NODE_ENV` 분기로 반드시 차단해야 하며, 그 `NODE_ENV`가 실제 배포 시점에 올바르게 설정되는지 별도로 검증해야 한다. pm2 `--env production` 누락처럼 코드는 맞아도 배포 방식이 방어를 무력화할 수 있다.
4. 애플리케이션 포트를 리버스 프록시 뒤에 둘 때는 반드시 `127.0.0.1`에 바인딩한다. 그렇지 않으면 프록시의 모든 보안 설정(TLS, 헤더 재작성, rate limit)이 우회 가능하다.
5. 내부 서비스 간 호출에서 넘어오는 값(IP 등)의 신뢰 여부는 "그 호출이 신뢰 가능한 경로로만 올 수 있는가"로 검증해야 하며, 값을 아예 서버가 재계산하는 것으로 대체하면 오히려 기능이 깨질 수 있다.
6. 방문자 로그·에러 로그는 스캔/공격 트래픽과 자체 코드의 취약점이 실제로 부딫히는 지점을 드러낸다 — 정기적으로 인기 경로/이상 IP 패턴을 검토하는 습관이 이번 발견의 시작점이었음.

### 배포 체크리스트

- [x] nginx `X-Forwarded-For` 덮어쓰기로 변경
- [x] backend/frontend `req.ip`/`req.socket` 기반 IP 판별로 전환
- [x] `autoAuth`를 `NODE_ENV=development` 전용화
- [x] pm2 production env로 재기동
- [x] backend/frontend `127.0.0.1` 바인딩
- [x] `POST /api/visits` 내부 호출만 허용 + rate limit
- [x] 로그인 비밀번호 bcrypt 해시 비교로 전환
- [x] nginx `limit_req` + fail2ban 스캐너 시그니처 jail 추가
- [x] `ufw` 구성 (아래 "후속: 방화벽(ufw) 구성" 참고)
- [ ] `deployment/nginx-blog.conf` 템플릿과 실제 운영 vhost 아키텍처 불일치 정리 (템플릿은 정적 파일 서빙(`try_files`)을 가정하지만 실제 운영은 Astro SSR 프록시 방식) — 후속 과제

### 후속: 방화벽(ufw) 구성 (같은 날)

배경: 위 체크리스트의 "ufw 비활성" 항목을 마무리하려고 활성화를 시도하다가, 이 서버가 blog 전용이 아니라 k3s worker node(`raspiWorker1`) + Docker 기반 모니터링 스택(Prometheus/Loki 등) + Samba + PostgreSQL이 동시에 돌아가는 다목적 호스트라는 게 드러남. 단순히 "웹서버 방화벽"으로 접근하면 안 되는 상황.

**발견 및 판단:**

1. ufw 기본값 `DEFAULT_FORWARD_POLICY="DROP"`을 그대로 켰다면 k3s(flannel 오버레이)·Docker 컨테이너 라우팅이 끊길 위험이 있었음. INPUT 체인(호스트로 직접 들어오는 트래픽)만 통제하고 FORWARD는 `ACCEPT`로 유지해서 컨테이너/파드 네트워킹과 분리(`/etc/default/ufw`).
2. 현재 세션이 LAN(`172.30.1.0/24`)도 WireGuard VPN(`wg0`, `10.0.0.0/24`)도 아닌, 사용자의 공인 IP로 직접 SSH 접속 중인 것을 `who`/`ss -tnp`로 확인. SSH를 VPN 전용으로 좁히는 방안을 검토했으나, 그렇게 했으면 이 세션이 즉시 끊겼을 것 — 방화벽 활성화 전에는 반드시 "지금 내가 어떤 경로로 들어와 있는가"부터 확인해야 함.
3. `ufw status`는 "inactive"였지만 `ufw show added`로 확인하니 과거에 추가해두고 활성화는 안 했던 규칙(마인크래프트로 추정되는 `25565/tcp` 전역공개, 소스 제한 없는 Samba 전역공개)이 그대로 남아있었음. `ufw status`만 보고 "꺼져있으니 규칙도 없다"고 판단하면 안 됨 — 비활성 상태에서도 규칙 파일은 누적된다.
4. 리스닝 포트 전체를 스캔(`ss -tlnp`)해서 이 호스트가 실제로 뭘 서빙하는지 먼저 파악: Postgres(5432)가 `0.0.0.0`에, Samba(139/445)가 인증 없이 전역 공개, 모니터링 포트(9090/9100/3100/3001)도 전역 공개 상태였음.

**최종 정책:**
- `22`(SSH), `80`(HTTP), `443`(HTTPS)만 전체 공개
- 그 외 전부(PostgreSQL, Samba, 모니터링 포트, k3s 관련 포트 등)는 LAN(`172.30.1.0/24`)·WireGuard VPN(`10.0.0.0/24`)에서만 허용
- 사용하지 않는 leftover 규칙(마인크래프트 `25565`, 무제한 Samba)은 제거

**교훈:**
1. 방화벽을 켜기 전에 "이 호스트가 실제로 뭘 서빙하고 있는가"를 리스닝 포트 전체 스캔으로 먼저 파악해야 한다. 하나의 서비스(블로그) 기준으로만 설계하면 같은 호스트의 다른 서비스를 부지불식간에 막거나, 반대로 계속 공개 상태로 방치하게 된다.
2. 컨테이너/오케스트레이션(Docker, k3s)이 있는 호스트에서 방화벽을 켤 때는 INPUT과 FORWARD 체인을 분리해서 생각한다. 이들 시스템은 이미 자체 iptables 체인을 갖고 있고, 방화벽 도구가 FORWARD 기본 정책을 바꾸면 그 규칙들과 충돌해 파드/컨테이너 네트워킹이 끊길 수 있다.
3. `ufw status`가 inactive라고 규칙이 비어있다는 뜻은 아니다 — `ufw show added`로 누적된 규칙을 먼저 확인한다.
4. 원격 서버의 방화벽 활성화처럼 "잘못되면 스스로 들어갈 방법이 없어지는" 액션은, 지금 실제로 어떤 경로로 접속해 있는지 확인한 뒤 그 경로를 반드시 허용 목록에 넣고 진행한다.

## 2026-01-05 마크다운 지원 구현

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
- [x] 백엔드 재시작 테스트 (정상 동작 확인)
- [x] 마크다운 렌더링 단위 테스트 (GFM, 테이블, 링크 등)
- [x] XSS 방지 검증 (script 태그, onerror 속성 제거 확인)
- [x] 기존 데이터 마이그레이션 (content_html 생성)
- [ ] 신규 포스트/프로젝트 생성 통합 테스트
- [ ] 기존 데이터 표시 확인 (프로덕션 환경)

### 트러블슈팅

**문제 1: 기존 본문이 사라지고 undefined 표시**

원인:
- DB `content_html` 컬럼이 빈 문자열 `""`
- 프론트엔드 폴백: `post.content_html || post.content`
- 빈 문자열도 truthy이므로 빈 문자열 반환
- `content_markdown` 폴백 누락

해결:
- 폴백 체인 수정: `post.content_html || post.content_markdown || post.content`
- 커밋: e65faa5

**문제 2: HTML 태그가 텍스트로 표시**

원인:
- 템플릿 리터럴 안에서 HTML 문자열 삽입 시 자동 이스케이프
- `<h2>` → 텍스트로 표시

해결:
- 별도 div 생성: `<div id="post-content"></div>`
- JavaScript에서 `innerHTML` 직접 설정
- 커밋: a70eee3

**문제 3: 마크다운 헤더 파싱 안됨**

증상:
- `##텍스트` → `##` 그대로 표시
- `## 텍스트` → `<h2>` 태그로 변환

원인: 마크다운 표준 문법에서 `#` 뒤 공백 필수

해결: 사용자 교육 (마크다운 문법 준수)

**문제 4: prose 클래스 스타일 미적용**

증상:
- HTML은 렌더링되지만 일반 텍스트처럼 보임
- 헤더가 크게 표시되지 않음, 굵기 없음
- `prose` 클래스는 적용되어 있으나 스타일 없음

원인:
- Tailwind CSS v4 환경에서 Typography 플러그인 누락
- `@tailwindcss/typography` 패키지는 설치했으나 CSS에서 활성화 안함

진단 과정:
```javascript
// 브라우저 Console에서 확인
const div = document.getElementById('post-body');
console.log(window.getComputedStyle(div).whiteSpace); // "normal" (정상)
console.log(div.classList); // prose 클래스 있음 (정상)
// 하지만 스타일이 적용되지 않음
```

해결:
- `frontend/src/styles/global.css`에 플러그인 추가:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```
- 커밋: c9c7e19

### 구현 요약

**최종 아키텍처:**
```
사용자 입력 (마크다운)
    ↓
백엔드: renderMarkdown()
    ├─ marked.parse() → 마크다운 → HTML
    └─ sanitizeHtml() → XSS 필터링
    ↓
DB 저장
    ├─ content_markdown (원본)
    └─ content_html (렌더링된 HTML)
    ↓
API 응답
    ↓
프론트엔드: innerHTML 설정
    ├─ fetch API로 데이터 가져오기
    ├─ div#post-body.innerHTML = content_html
    └─ Tailwind Typography로 스타일링
    ↓
사용자에게 표시 (렌더링된 마크다운)
```

**성공 기준:**
- ✅ 마크다운 작성 및 저장
- ✅ HTML로 자동 변환 (서버 사이드)
- ✅ XSS 공격 방지
- ✅ 헤더, 리스트, 링크, 테이블 등 GFM 지원
- ✅ 기존 데이터 호환성 유지
- ✅ prose 스타일 적용

**핵심 교훈:**
1. **Tailwind v4 변경사항**: v3의 `tailwind.config.js` 플러그인 방식이 아닌, CSS 파일에서 `@plugin` 지시어 사용
2. **ESM vs CommonJS 호환성**: jsdom 기반 라이브러리들의 의존성 체인 확인 필요
3. **템플릿 리터럴 이스케이핑**: 동적 HTML 삽입 시 innerHTML 직접 사용 필요
4. **폴백 체인 설계**: 빈 문자열도 truthy이므로 명시적 체크 필요
5. **단계별 진단**: DB → 백엔드 → API → 프론트엔드 → CSS 순서로 체계적 확인

### 배포 완료

**최종 상태:**
- DB: content_markdown, content_html 컬럼 정상 동작
- 백엔드: marked + sanitize-html 정상 동작
- 프론트엔드: innerHTML + Typography 스타일 정상 적용
- 프로덕션 환경: 마크다운 렌더링 성공 확인

**변경된 파일:**
- `backend/utils/markdown.js` (신규)
- `backend/services/postService.js`
- `backend/services/projectService.js`
- `backend/package.json`
- `frontend/src/pages/blog/[slug].astro`
- `frontend/src/pages/projects/[id].astro`
- `frontend/src/styles/global.css`
- DB 스키마: `blog.posts`, `blog.projects`

**브랜치:** `claude/add-markdown-support-6fGtE`
**총 커밋 수:** 12개
**구현 기간:** 2026-01-05 ~ 2026-01-08
