# LEARNINGS.md

개발·개선·운영 과정에서 발견한 문제와 그로부터 얻은 교훈을 기록한다. 최신 항목이 위에 온다. 문서화 규칙(어투, 성능 수치 등)은 [CLAUDE.MD](./CLAUDE.MD) 3장을 따른다.

## 2026-09-27 DB 쿼리 튜닝 점검 — 시퀀스 권한 누락으로 INSERT 전면 실패, 인덱스 정리, 쿼리 관측 도입

### 배경

쿼리 튜닝 상태를 점검하기 위해 `pg_stat_user_tables`/`pg_stat_user_indexes`/`pg_settings` 조회와 서비스 계층 쿼리의 `EXPLAIN (ANALYZE, BUFFERS)`를 수행했다. 7일 방문 통계 쿼리가 0행을 반환해 원인을 추적하던 중, 튜닝과 별개로 쓰기 경로 장애를 발견했다.

### 트러블슈팅: 서버 이전 후 모든 INSERT 실패

- 증상: `blog.visits`의 최신 행이 덤프 시점(2026-09-08)에 멈춰 있었고, `backend/logs/err.log`에 `permission denied for sequence visits_id_seq`가 17,866건 누적.
- 원인: 2026-09-24 이전 시 `pg_restore --no-privileges`로 복원해 GRANT가 전부 빠졌다. 테이블·시퀀스 소유자는 `postgres`이고 앱 계정(`jcw`)은 소유자가 아니므로 별도 권한이 필요하다. `SERIAL` 컬럼의 기본값은 `nextval('..._id_seq')`이고, `nextval`은 테이블 INSERT 권한과 별개로 시퀀스의 `USAGE`(또는 `UPDATE`) 권한을 요구한다. `has_sequence_privilege`로 확인한 결과 `blog`/`learning` 스키마의 시퀀스 7개 모두 `false`.
- 영향: 방문 기록 유실(2026-09-24 ~ 09-27), `createPost`/`createProject` 및 LearningCollector 자동 게시도 같은 이유로 실패 상태였다. 읽기 경로는 정상이라 페이지는 정상 동작해 드러나지 않았다.
- 조치: `backend/db/grant-app-privileges.sql` — `GRANT USAGE ON ALL SEQUENCES`와 `ALTER DEFAULT PRIVILEGES`(이후 생성될 시퀀스용)를 적용. 적용 후 페이지 요청이 `visits`에 기록되는 것을 확인.

### 조치: 인덱스 및 쿼리

점검 시점 데이터 규모는 posts 347행(힙 376 kB, TOAST 3 MB), visits 약 2.2만 행으로 전부 shared_buffers 안에 들어간다. 지연 문제는 없었고, 조치는 불필요한 비용 제거와 데이터 증가 대비가 목적이다.

1. 목록 쿼리의 `SELECT *`를 목록용 컬럼(`LIST_COLUMNS`)으로 교체. posts는 본문(`content_markdown`, `content_html`)이 TOAST에 저장되는데, `SELECT *`는 목록에 쓰지 않는 본문까지 매 행 detoast해서 전송했다.
2. `idx_posts_slug` 삭제: `posts_slug_key`(UNIQUE 제약이 만든 인덱스)와 컬럼이 같은 중복 인덱스로, 조회 이득 없이 쓰기 시 유지 비용만 발생.
3. `idx_posts_date (date DESC, id DESC)` 추가: 기존 `idx_posts_category_date`는 선두 컬럼이 `category`라 분류 필터가 없는 목록 쿼리에는 쓰이지 않았다(B-tree는 선두 컬럼 조건 없이 정렬 순서를 활용할 수 없음). 적용 후 필터 없는 1페이지 조회가 Seq Scan + top-N 정렬(47페이지 읽기)에서 Index Scan(5페이지)으로 바뀌었다.
4. 태그 필터를 `$1 = ANY(tags)`에서 `tags @> ARRAY[$1::text]`로 변경하고 GIN 인덱스 `idx_posts_tags` 추가. GIN 배열 연산자 클래스(`array_ops`)는 `@>`, `<@`, `&&`, `=` 연산자만 지원하므로 `= ANY()` 형태는 인덱스를 탈 수 없다. 전체 태그 479개에 대해 변경 전후 결과 id 집합이 동일함을 확인. 적용 후 Seq Scan에서 Bitmap Index Scan으로 바뀌었다.
5. 쿼리 관측 설정: `pg_stat_statements`(쿼리별 호출 수·누적 시간), `log_min_duration_statement = 100ms`(느린 쿼리 로그), `track_io_timing = on`(EXPLAIN과 통계에 I/O 대기 시간 포함). `shared_preload_libraries` 변경은 재시작이 필요하다.

### 핵심 교훈

1. `pg_restore --no-privileges`로 복원했다면 앱 계정 권한을 반드시 다시 부여해야 한다. 테이블 권한만 확인하면 부족하고, 시퀀스 권한이 없으면 SELECT는 되고 INSERT만 실패해 읽기 위주 서비스에서는 장애가 드러나지 않는다.
2. 복원 검증 항목에 row 수 대조뿐 아니라 앱 계정으로 쓰기 한 건을 수행하는 확인을 포함해야 한다.
3. 쿼리가 인덱스를 쓰는지는 연산자 형태에 따라 달라진다. 같은 의미의 조건이라도 인덱스가 지원하는 연산자로 작성해야 한다.
4. 느린 쿼리를 추측하지 않으려면 `pg_stat_statements`가 먼저 있어야 한다.

## 2026-09-24 독자 기준 개편 — 글 분류(category), 목록/상세 SSR 전환, 디자인 교체

### 배경

글 348개 중 약 60%가 LearningCollector가 올린 `<레포명>: ...` 형식의 커밋/PR 요약이었고, 정리 글과 같은 목록에 같은 비중으로 섞여 있었다. 처음 방문한 독자가 정리 글을 찾기 어려웠다. 또 `/blog`, `/blog/[slug]`는 브라우저에서 API를 호출해 그리는 구조라 서버가 내려주는 HTML에는 본문이 없었다(검색엔진 수집, 링크 미리보기 불가).

### 조치

1. `blog.posts.category`(`article`/`ps`/`log`) 추가 및 기존 글 규칙 기반 일괄 분류 (`backend/db/add-category-to-posts.sql`). 결과: article 70, ps 68, log 210.
   - 테이블 소유자가 `postgres`라 앱 계정(`jcw`)으로는 DDL 불가. `sudo -u postgres psql -f <파일>`은 `postgres` OS 유저가 `/home/jcw`를 읽지 못해 `Permission denied` — `-f - < 파일`로 jcw 쉘이 파일을 읽어 표준 입력으로 넘겨서 해결.
2. API: `GET /api/posts?category=`, `GET /api/posts/tags?category=`, `GET /api/posts/categories` 추가. 작성 시 `category` 미지정이면 제목으로 추정(`utils/postCategory.js`)해 LearningCollector 쪽 수정 없이 로그로 분류된다.
3. 프론트엔드: 메인, `/blog`, `/blog/[slug]`, `/status`를 SSR로 전환. RSS(`/rss.xml`, article만), canonical/og 메타 추가. 색 토큰을 `warm-*`에서 `ink-*`로 바꾸고 다크 모드(OS 설정 + 수동 전환)를 CSS 변수 재정의로 구현.
4. `/status`가 운영에서 500이던 문제 수정: SSR에서 `PUBLIC_API_URL`(빈 문자열)로 상대 경로 fetch를 해서 실패했고, 응답 필드명(`cpuLoad` 등)도 페이지와 맞지 않았다.
5. SSR 백엔드 주소를 `SERVER_API_URL` 런타임 환경변수로 분리. CI는 테스트 백엔드를 3001에 띄우는데 SSR은 3000(운영 백엔드)을 호출하고 있었다 — `ci.yml`에 `SERVER_API_URL=http://localhost:3001` 지정.

### 트러블슈팅: 테스트 빌드가 운영 프론트엔드를 바꿔버림

운영 서버(raspiWorker1)의 작업 디렉터리에서 테스트용으로 `npm run build`를 실행하자, PM2의 `blog-frontend`가 쓰는 `frontend/dist`가 교체됐다. Astro SSR 빌드는 `entry.mjs`가 페이지 청크를 요청 시점에 동적 import하므로, 재시작 없이도 이미 떠 있던 프로세스가 새 페이지 코드를 서빙하기 시작했다. 백엔드는 이전 코드라 `category` 필터가 무시되는 불일치 상태가 됐고, PM2 두 프로세스를 재시작해 맞췄다.

### 핵심 교훈

1. 운영 서버의 체크아웃에서 빌드하면 그 자체가 배포다. 검증용 빌드는 별도 worktree/디렉터리에서 해야 한다.
2. 동적 import로 청크를 불러오는 SSR 빌드는 "프로세스 재시작 전까지는 이전 코드"라는 가정이 성립하지 않는다.
3. 운영 DB는 앱 계정에 DDL 권한이 없다. 마이그레이션은 `sudo -u postgres psql -d my_blog -c "SET search_path TO blog" -f - < <sql>`로 적용한다. (2026-09-27 CI 제거로 `test_blog` 적용은 불필요)

## 2026-09-24 새 서버(Ubuntu 22.04)로 블로그 이전 — DB 버전 불일치, dotenv 로드 순서 버그, 자동 게시 인증

### 배경

블로그를 라즈베리파이 `raspiworker1`(Ubuntu 22.04.5, nginx 1.18)에 새로 구축하고, 2026-09-09자 오프사이트 덤프(`my_blog_20260909_000001.dump`)로 DB를 복원함. 이 과정에서 기존 서버에서는 드러나지 않던 문제가 연속으로 발견됨.

### 문제와 원인

1. **덤프와 PostgreSQL 메이저 버전 불일치**: 덤프 헤더(`strings`로 확인)상 원본은 PostgreSQL 18.6(Ubuntu 26.04)에서 생성됨. Ubuntu 22.04 기본 apt 저장소의 PostgreSQL은 14이며, `pg_restore`는 자신보다 새 메이저 버전의 `pg_dump`가 만든 custom 포맷 아카이브를 읽지 못함.
2. **nginx `http2 on;` 미지원**: `http2` 지시어는 nginx 1.25.1에서 추가됨. 1.18에서는 `listen 443 ssl http2;` 파라미터 방식만 동작.
3. **ESM import 호이스팅으로 `.env`가 DB 풀 생성 이후에 로드됨**: `app.js`가 본문 첫 줄에서 `dotenv.config()`를 호출했지만, ES 모듈은 모듈 그래프의 모든 `import`를 먼저 평가한 뒤 본문을 실행한다. 따라서 `routes → services → config/db.js`의 `new Pool()`이 `DB_*`가 비어 있는 상태에서 생성되어 기본값 `postgres`/`postgres`로 접속을 시도했고, 새 서버에서는 `password authentication failed for user "postgres"`로 전 API가 500. 기존 서버에서 정상 동작했다는 것은 앱이 슈퍼유저 `postgres` + 기본 비밀번호로 DB에 붙어 있었다는 의미.
4. **백업 권한 부족**: 앱 계정 `jcw`로 `pg_dump` 실행 시 `permission denied for schema learning`. 덤프상 `blog` 스키마에는 `jcw`에게 `USAGE`가 부여돼 있었으나 `learning` 스키마에는 없었음. 3번과 같은 이유로 기존 서버에서는 슈퍼유저로 백업이 돌아 드러나지 않았음.
5. **LearningCollector 자동 게시 불가**: LearningCollector는 `localhost:3000/api/posts`에 인증 없이 POST하며, 2026-08-04 인증 우회 대응으로 `autoAuth`(localhost 자동 인증)가 `NODE_ENV=development`에서만 동작하도록 제한된 이후로는 프로덕션에서 401을 받는 구조.
6. **서버 내부에서 공인 도메인 접속 불가**: 서버에서 `https://chanwook.kr`로 요청하면 타임아웃. 공유기가 헤어핀 NAT(내부망에서 자기 공인 IP로 나갔다 돌아오는 트래픽)를 지원하지 않기 때문이며, 서비스 장애가 아님.

### 해결

1. PGDG 공식 저장소(`/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh`)로 `postgresql-18` 설치 후, 원본과 동일하게 스키마 소유자는 `postgres`, 앱 계정은 `jcw`로 두고 `sudo -u postgres pg_restore`로 복원. 복원 후 row 수 확인(posts 348, projects 7, visits 22380, learning.* 4개 테이블).
2. `deployment/nginx-blog.conf`를 `listen 443 ssl http2;`로 변경.
3. `dotenv.config()`를 `backend/config/env.js`로 분리하고 `app.js`의 첫 `import`로 둠. `import` 문은 작성 순서대로 평가되므로 이후 모든 모듈보다 먼저 `.env`가 로드됨. 수정 후 `pg_stat_activity`로 앱 커넥션이 `jcw`로 붙는 것을 확인.
4. 백업 계정에 `pg_read_all_data`(PostgreSQL 14+ 내장 롤, 모든 스키마 읽기 전용) 부여 (`sudo -u postgres psql -c "GRANT pg_read_all_data TO jcw;"`). 스키마별 `GRANT`는 새 스키마·테이블이 생길 때마다 누락될 수 있어 내장 롤을 선택.
5. `POST /api/posts`에만 `Authorization: Bearer <POST_API_TOKEN>`을 허용하는 `requireAuthOrPostApiToken` 미들웨어 추가. 토큰 비교는 양쪽을 SHA-256 다이제스트로 만든 뒤 `crypto.timingSafeEqual`로 수행 — 길이가 달라도 예외 없이 상수 시간 비교가 되도록 함. PUT/DELETE는 기존 세션 인증만 허용해 토큰 유출 시 피해 범위를 글 작성으로 한정. LearningCollector는 `BLOG_API_TOKEN` 환경변수로 같은 값을 전송.
6. 서버 내부 검증은 `curl --resolve chanwook.kr:443:127.0.0.1`로 로컬 nginx를 거쳐 수행하고, 외부 접속은 모바일망에서 별도 확인.

### 핵심 교훈

1. 덤프 복원 전에 덤프를 만든 PostgreSQL 버전과 복원 대상 버전을 먼저 대조해야 한다. `pg_restore`는 하위 호환(구버전 덤프 → 신버전)만 보장한다.
2. ESM에서 `dotenv.config()`를 본문에서 호출하는 패턴은 import된 모듈이 로드 시점에 `process.env`를 읽으면 조용히 실패한다. 기본값 폴백(`|| 'postgres'`)이 있으면 에러 없이 잘못된 계정으로 동작하므로, 문제가 "다른 환경에서만" 드러난다.
3. 서버 이전은 기존 환경이 우연히 가려주던 문제(슈퍼유저 접속, 권한 누락)를 드러내는 기회다. 새 환경에서 최소 권한으로 구성하면 기존 설정에 숨어 있던 의존성이 에러로 나타난다.
4. 보안 대응으로 인증 경로를 막을 때는 그 경로에 의존하던 자동화(LearningCollector)를 함께 점검해야 한다. 자동화 쪽 실패는 해당 도구의 로그에만 남아 블로그 쪽에서는 보이지 않는다.

## 2026-08-20 DB 백업 오프사이트 복제(rclone/Google Drive) 및 복구 플로우 검증

### 배경

`backend/scripts/backup-db.sh`가 `@daily` cron으로 `pg_dump`를 떠서 `/home/jcw/backups/my-blog-db`에 저장하고 있었으나, DB 원본과 백업이 같은 라즈베리파이의 같은 디스크에 있었음. 디스크·SD카드 장애 시 원본과 백업이 동시에 소실되는 구조라 재해복구 관점에서는 백업이 아니었음. 또한 "백업 파일이 생성됨"과 "그 파일로 실제 복원이 됨"은 별개로, 복원 플로우가 실제로 검증된 적이 없었음.

### 조치

1. `backup-db.sh`에 로컬 백업·정리 이후 `rclone copy`로 Google Drive(`gdrive:my-blog-backups`)에 업로드하는 단계 추가. 로컬과 동일하게 14일 지난 원격 백업은 `rclone delete --min-age`로 정리. `gdrive` remote가 없으면(`rclone listremotes`로 확인) 에러 없이 경고만 남기고 건너뛰도록 가드 처리 — remote 설정 전에 cron이 돌아도 백업 자체는 깨지지 않게 함.
2. `rclone config`/`rclone authorize`는 브라우저 또는 대화형 stdin이 필요한 커맨드라 헤드리스 서버(SSH만 있는 환경)에서 직접 실행 불가. 브라우저 있는 별도 기기에서 `rclone authorize "drive"`를 실행하되, Pi로의 SSH 세션에 `-L 53682:localhost:53682` 로컬 포트포워딩을 걸어 OAuth 콜백이 Pi에서 열려 있는 로컬 서버로 돌아오게 함. 그 결과로 나온 토큰 JSON은 `rclone config create gdrive drive scope=drive config_is_local=false token='...'`로 완전 비대화형 생성.
3. `pg_restore --list`로 덤프 파일의 TOC를 확인해 스키마뿐 아니라 `TABLE DATA` 항목(blog.posts, blog.projects, blog.visits, learning.* 4개 테이블)이 실제로 포함돼 있는지 확인.
4. 임시 DB(`my_blog_restore_test`, 작업 종료 후 즉시 drop)에 로컬 덤프를 `pg_restore --no-owner --no-privileges`로 복원하고, 운영 DB와 테이블별 row 수·최근 게시글 샘플을 대조해 완전히 일치함을 확인 (posts 344, projects 8, visits 16698, learning.* 4개 테이블 포함).
5. Google Drive에 업로드된 파일을 다시 내려받아 로컬 원본과 `sha256sum` 비교로 무손실 업로드를 확인하고, 그 다운로드본만으로 별도 임시 DB(`my_blog_restore_test2`)에 복원해 동일한 row 수가 나오는지까지 검증 — 로컬 덤프가 아니라 오프사이트 사본 자체로 복구가 가능함을 확인.
6. 검증에 사용한 임시 DB와 다운로드 파일은 확인 직후 삭제. 운영 DB(`my_blog`)는 어느 단계에서도 건드리지 않음.

### 핵심 교훈

1. 원본과 같은 장애 도메인(같은 디스크/같은 호스트)에만 있는 백업은 재해복구용 백업이 아니다. 오프사이트 복제본이 있어야 호스트 자체의 손실에서도 복구할 수 있다.
2. rclone의 OAuth 설정은 헤드리스 서버에서 자동화하기 까다롭다 — `rclone authorize`를 브라우저가 있는 별도 기기에서 실행하거나 SSH 로컬 포트포워딩으로 콜백 포트를 끌어와야 한다. 이미 발급받은 토큰이 있어도 `rclone config create`의 `config_is_local` 기본값(true)을 그대로 두면 이미 준 토큰을 무시하고 auto-config를 다시 시도하다 멈춘다(hang) — `config_is_local=false`를 명시해야 완전 비대화형으로 remote가 생성된다.
3. "덤프가 에러 없이 끝났다"는 "복원 가능하다"의 증거가 아니다. `pg_restore --list`로 TABLE DATA 존재를 확인하고, 실제로 별도 DB에 복원해 row 수·샘플 데이터를 원본과 대조해야 백업이 유효하다는 게 검증된다.
4. 오프사이트 복제본은 업로드 자체가 무손실인지(체크섬 대조), 그리고 그 복제본만으로 복원이 되는지까지 확인해야 진짜 DR 검증이 끝난 것이다. 로컬 원본만 복원해보는 것으로는 원격 사본이 손상되지 않았다는 보장이 없다.

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
- [x] `deployment/nginx-blog.conf` 템플릿과 실제 운영 vhost 아키텍처 불일치 정리 (아래 "후속: 배포 템플릿 정리" 참고)

### 후속: 배포 템플릿 정리 (2026-08-04)

`deployment/nginx-blog.conf`가 정적 파일 서빙(`root`+`try_files`)을 가정하고 있었으나, 실제 운영은 Astro SSR(`@astrojs/node`, PM2가 4321에서 구동)을 nginx가 프록시하는 방식이었음. `frontend/dist`는 정적 HTML이 아니라 `dist/server/entry.mjs`(Node 서버)라서, 이 템플릿으로 새로 배포하면 애초에 동작하지 않았을 것.

- `nginx-blog.conf`: `root`/`try_files`를 제거하고 실제 운영 vhost와 동일하게 `location /`을 `proxy_pass http://localhost:4321`로 변경, 오늘 추가한 `limit_req` 두 줄도 반영
- `nginx-ratelimit.conf`(신규): `limit_req_zone` 정의는 `http` 블록에서만 유효해 `server` 블록 파일(`nginx-blog.conf`) 안에 넣을 수 없음 — `/etc/nginx/conf.d/`에 설치하는 별도 파일로 분리
- README의 nginx 설정 단계에 `nginx-ratelimit.conf` 설치 스텝 추가

**추가로 발견한 문제**: `deployment/redeploy.sh`(GitHub Actions `deploy.yml`이 push마다 실행)가 `pm2 start ecosystem.config.cjs`를 `--env production` 없이 호출하고 있었음. 이 상태로 다음 자동배포가 실행되면 오늘 고친 `NODE_ENV=production` 설정이 `ecosystem.config.cjs`의 기본 `env` 블록(`development`)으로 되돌아가면서, `autoAuth` 등 프로덕션 전용 방어가 조용히 무력화된다. `pm2 start ecosystem.config.cjs --env production`으로 수정.

**교훈**: 배포 자동화 스크립트(CI가 실행하는 스크립트)는 코드 리뷰에서 놓치기 쉽다. 설정값 하나(`NODE_ENV`)를 코드에서 올바르게 분기해뒀어도, 그 값을 실제로 채워주는 배포 스크립트가 틀려 있으면 다음 배포에서 조용히 원상복구된다 — 보안 관련 설정을 고쳤다면 "이 설정이 다음 배포에도 유지되는가"까지 배포 스크립트 레벨에서 확인해야 한다.

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

## 2026-07-14 ~ 07-18 라즈베리파이 반복 재부팅/전원 꺼짐 — 원인이 세 개였다

### 배경

집에서 돌리는 라즈베리파이가 며칠 간격으로 알 수 없이 재부팅되거나, 전원이 내려간 것처럼 멈추는 증상이 반복됨. 하나의 원인을 고쳐도 증상이 완전히 사라지지 않아서, 조사해보니 서로 무관한 원인 세 개가 겹쳐 있었음.

### 원인 1: EEPROM `USB_MSD_STARTUP_DELAY` — `sudo reboot`가 부팅 실패로 이어짐

카드리더 경유 USB 저장장치(`/dev/sda`)로 부팅하는 구성에서 `sudo reboot`를 실행하면 "can't open file"로 부팅이 멈추고, 전원선을 뽑았다 꽂아야만 정상 부팅됨. EEPROM `USB_MSD_STARTUP_DELAY`가 기본값 0이라, 소프트 리부트로는 USB 카드리더가 완전히 재초기화되지 않은 상태에서 1단계 부트로더가 부팅 파일을 찾다 실패하는 것. `rpi-eeprom-config`로 `USB_MSD_STARTUP_DELAY=2`를 적용했지만 완전히 해결되지는 않았음.

**현재 운영 방침**: 카드리더를 거치지 않는 USB SSD로 전체 클론하기 전까지는 **`sudo reboot`를 쓰지 않고, 재부팅이 필요하면 전원을 물리적으로 뽑았다 꽂는다.**

### 원인 2: crontab + Ansible이 걸어둔 자동 재부팅

매일 새벽 1시 `crontab`이 `~/cluster-admin/ansible/run-update.sh`를 실행했는데, 이 스크립트가 호출하는 Ansible playbook에 다음 로직이 있었음.

```yaml
- name: Check if reboot is required
  stat:
    path: /var/run/reboot-required
  register: reboot_required
- name: reboot
  reboot: ...
  when: reboot_required.stat.exists
```

`unattended-upgrades`는 이미 꺼둔 상태였지만, 이 crontab+playbook 조합이 `/var/run/reboot-required` 파일 존재 여부만으로 매일 자동 재부팅을 트리거하고 있었음. `cluster-admin` 폴더 자체는 이미 삭제된 상태라 당장은 무해했지만, 폴더가 재생성되면 언제든 재발할 수 있는 상태였음. 해결: 재부팅을 트리거하던 crontab 항목 삭제.

### 원인 3: systemd 좀비 서비스의 무한 재시작 루프

`journalctl`로 전체 서비스 이력을 훑어서 재시작 횟수가 비정상적인 유닛을 찾음. `learningetl.service`("LearningETL Daemon")가 하루 약 8,433번(약 10초 간격) `Scheduled restart`를 반복 중이었고, 보존된 저널 기준 누적 실패가 46만 회를 넘어 있었음.

```
learningetl.service: Failed to load environment files: No such file or directory
learningetl.service: Failed to spawn 'start-pre' task: No such file or directory
learningetl.service: Failed with result 'resources'.
```

원인: 프로젝트 폴더가 `/home/jcw/LearningETL` → `/home/jcw/LearningCollector_v1.0`으로 이름이 바뀌었는데, systemd 유닛의 `EnvironmentFile`/실행 스크립트 경로는 옛 경로 그대로 남아 있었음. `Restart=` 정책 때문에 systemd가 절대 포기하지 않고 몇 달째 10초 간격 재시도를 반복. `learningcollector-daily.service`/`.timer`도 같은 이름 불일치로 매일 자정 `203/EXEC No such file or directory`로 실패 중이었음. `journalctl --list-boots`로 대조해보니 이 무한 루프가 방치된 기간에 재부팅 빈도도 겹쳐서 늘어나 있었음. 해결: 죽어버린 두 유닛을 중지 후 유닛 파일 자체를 삭제.

### 핵심 교훈

1. 하나의 증상(재부팅/전원 꺼짐)에 서로 무관한 원인이 여러 개 겹쳐 있을 수 있다. 하나를 고쳤는데 증상이 안 사라지면 "고친 원인과는 다른 새 원인"일 가능성을 열어둬야 한다.
2. `Restart=` 정책이 걸린 데몬형 서비스는 실패해도 화면에 티가 안 난다. 조용히 백그라운드에서 반복 실패하며 리소스를 갉아먹으므로, 로그를 직접 뒤지지 않으면 발견할 수 없다.
3. 프로젝트 폴더를 옮기거나 이름을 바꾸는 작업은 폴더 하나만 건드리는 게 아니라, 그 경로를 참조하는 모든 설정(systemd 유닛, crontab, 환경변수 파일)을 함께 점검해야 한다. 이름을 바꾼 직후 `systemctl list-units --type=service --all`과 `journalctl -u <서비스명> -f`로 즉시 확인하는 습관이 필요.
4. 자동화 스크립트(Ansible playbook 등)에 재부팅을 트리거하는 로직이 있으면, 그 스크립트를 실행하는 crontab/타이머가 아직도 걸려 있는지 별도로 확인해야 한다. 스크립트가 있는 폴더를 지웠다고 트리거(crontab)까지 같이 지워지는 건 아니다.

## 2026-02-25 ~ 03-03 클러스터 호스트네임 오염과 블로그 서버 접속 불가 — 범인은 Cloud-init

### 배경

Ansible로 라즈베리파이 클러스터 시스템 업데이트를 자동화하는 과정(2026-02-25)에서, 마스터 노드의 호스트네임이 `raspiMaster`에서 `raspiWorker1`로 계속 바뀌는 현상을 발견. `hostnamectl`과 `/etc/hostname`, `/etc/hosts`를 직접 고쳐도 재부팅하면 다시 `raspiWorker1`로 돌아왔음.

일주일 뒤(2026-03-03), 실제 서비스 장애로 이어짐: 외부에서 블로그 서버에 SSH/HTTP 접속이 전혀 안 되는 상태가 발생.

### 원인 분석

1. **직접 원인**: 워커1(내부 IP 끝자리 94) 노드의 와이파이 연결이 공유기 재시작 이후 재연결에 실패해 네트워크가 끊김.
2. **호스트네임 오염의 진짜 원인**: 마스터 노드(내부 IP 끝자리 84)의 SD카드를 굽는 과정에서 hostname이 실수로 `raspiWorker1`로 설정됐고, **Cloud-init이 매 부팅마다 `/boot/firmware/user-data`에 적힌 값으로 hostname을 재적용**하고 있었음. `hostnamectl set-hostname`이나 `/etc/hostname` 수정은 Cloud-init이 다음 부팅에 덮어써버리므로 근본 해결이 아니었음.

**기반 CS 지식**: Cloud-init은 클라우드/임베디드 이미지의 "최초 부팅 시 설정"을 매 부팅마다 다시 적용하는 도구다. `/boot/firmware/user-data`처럼 이미지 굽기 단계에서 심어진 설정 파일이 진짜 소스이며, 런타임에 `/etc/hostname` 등을 직접 고치는 건 이 소스가 그대로 있는 한 임시방편에 불과하다.

### 해결

```bash
# 원인 파일 확인
cat /boot/firmware/user-data

# 소스 자체를 수정 (런타임 파일이 아니라 Cloud-init이 참조하는 원본)
sudo sed -i 's/hostname: raspiWorker1/hostname: raspiMaster/' /boot/firmware/user-data
sudo sed -i 's/manage_etc_hosts: true/manage_etc_hosts: false/' /boot/firmware/user-data
```

`manage_etc_hosts: false`로 Cloud-init이 `/etc/hosts`를 계속 관리(덮어쓰기)하지 못하게 막은 것이 핵심.

### 핵심 교훈

1. 임베디드/클라우드 이미지에서 설정이 "자꾸 원래대로 돌아온다"면, 런타임 파일이 아니라 그 파일을 매번 재생성하는 상위 소스(Cloud-init의 `user-data` 등)를 찾아야 한다.
2. SD카드 이미지를 구울 때 Raspberry Pi Imager의 "고급 설정"에서 hostname을 명확히 지정해야 한다. 나중에 발견하면 여러 노드의 호스트네임이 뒤섞인 상태로 몇 주씩 운영되고 있을 수 있다.
3. 장애 진단은 "외부 접속 → 내부 IP 접속 → 서비스 상태 → 포트 → 설정" 순서로 좁혀가는 게 효율적이다. `Connection timed out`(네트워크 도달 불가)과 `Connection refused`(서버가 명시적으로 거부)는 원인이 다르므로 구분해서 접근해야 한다.
4. 이번처럼 서로 무관한 두 문제(와이파이 단절 + 호스트네임 오염)가 동시에 존재하면, 하나를 고쳐도 장애가 안 풀려서 "아직도 안 됨"으로 오인하기 쉽다. 증상 하나에 원인 하나라고 가정하지 않는다.

## 2026-03-02 ~ 03-03 CI/CD 파이프라인 단순화 — lint/unit/integration 제거, e2e + DB 백업·복원으로 정리

### 배경

초기 CI에는 `lint`, `unit-tests`, `integration-tests`, `e2e-tests`, `check-infra` 잡이 전부 있었으나, 운영하면서 다음 마찰이 누적됨:
- 테스트 파일이 아직 없는 상태에서 `unit-tests`가 그냥 실패로 처리됨
- `integration-tests`가 `DB_SCHEMA=test_blog` 설정 없이 운영 스키마와 충돌
- CI 러너에서 `unattended-upgrades`가 `apt` 락을 잡고 있어 Playwright 설치 단계가 간헐적으로 멈춤

### 조치 (단계적으로 시도)

1. `test: passWithNoTests` 설정 — 테스트 파일이 없어도 CI가 실패하지 않게
2. `unit-tests` 스킵 + `npm install` → `npm ci` 전환
3. `integration-tests`, `e2e-tests`를 `if: false`로 임시 스킵
4. `systemctl stop unattended-upgrades`를 CI 스텝에 추가해 apt 락 대기 문제 회피
5. 최종적으로 `lint`/`unit-tests`/`integration-tests`/`check-infra` 잡을 전부 제거하고, `e2e-tests`를 `web-page-tests`로 이름을 바꿔 하나만 남김
6. 남은 e2e 테스트가 실제 posts/projects 테이블에 데이터를 만들고 지우므로, 테스트 전 `backup-test-db.sh`로 백업하고 테스트 후(`if: always()`) `restore-test-db.sh`로 원복하는 방식으로 데이터 격리 확보

### 핵심 교훈

1. CI 잡을 여러 개 늘리는 것보다, 실제로 신뢰하고 유지보수할 수 있는 범위로 좁히는 게 낫다. 실패가 잦고 원인이 CI 인프라(apt 락, 스키마 충돌)에 있는 잡은 신호 대신 소음이 된다.
2. e2e 테스트가 라이브 DB의 실제 테이블에 쓰기 작업을 한다면, "백업 → 테스트 → 복원(항상 실행)" 패턴으로 테스트 격리를 확보할 수 있다. DB를 매번 새로 만들 필요는 없다.
3. CI 환경의 배경 프로세스(`unattended-upgrades` 등)가 `apt` 락을 잡고 있으면 패키지 설치 스텝이 이유 없이 멈춘 것처럼 보인다 — 잡히지 않는 CI 실패는 러너의 배경 작업부터 의심.

## 2026-02-02 KaTeX 수식과 마크다운 강조 문법(`_`, `*`)의 충돌

### 배경

마크다운 지원(2026-01-05~08, 아래 항목)에 이어 수학 수식(KaTeX) 렌더링을 추가하는 과정에서, `$Z_p^*$`, `$a_0$`처럼 언더스코어/별표가 들어간 수식이 깨져서 표시됨.

### 원인

`marked-katex-extension`을 marked 파서에 플러그인으로 등록하는 방식을 썼는데, marked가 수식 내부의 `_`와 `*`를 KaTeX 확장이 처리하기 전에 먼저 마크다운의 강조 문법(기울임/굵게)으로 해석해버림. 즉 두 파서가 같은 문자를 서로 다른 의미로 먼저 가져가려고 경합한 것.

### 해결

`marked-katex-extension`(marked 파서 내부에서 동작)을 걷어내고, 수식을 marked에게 넘기기 전에 직접 처리하는 방식으로 전환:
1. 마크다운 파싱 **전에** `$...$`/`$$...$$` 수식을 정규식으로 먼저 추출해 KaTeX로 렌더링
2. 렌더링된 결과를 placeholder 문자열로 치환한 상태로 marked에 넘김 (이 단계에서는 수식 부분에 `_`/`*`가 없으므로 마크다운이 건드릴 게 없음)
3. 마크다운 파싱이 끝난 뒤 placeholder를 실제 렌더링된 수식 HTML로 복원

### 핵심 교훈

1. 서로 다른 두 파서(마크다운, LaTeX)가 같은 특수문자(`_`, `*`, `^`)를 다른 문법으로 쓸 때는, "먼저 처리해서 안전한 형태로 감싼 뒤 나중 파서에 넘기는" 순서 제어가 필요하다. 파서 확장/플러그인에만 맡기면 실행 순서를 제어할 수 없어 충돌이 재발한다.
2. `hasMathExpression()` 같은 감지 함수를 만들 때, 가격 표시(`$100`)처럼 수식이 아닌 `$` 사용과 실제 LaTeX 수식을 구분하는 정규식은 처음부터 완벽하게 짜기 어렵다 — 실제 콘텐츠로 반복 검증하며 다듬어야 하는 영역.

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
## 2026-01-02 PostgreSQL 스키마 분리 후 "relation does not exist" — `search_path` 미설정

### 배경

테이블을 `public` 스키마에서 `blog` 스키마로 옮긴 뒤, 백엔드에서 `relation "posts" does not exist` 에러가 발생.

### 원인

`pg` 커넥션 풀 설정에 스키마 지정이 없어서, 세션의 `search_path`가 기본값 `public`으로 남아있었음. 테이블은 `blog.posts`에 있는데 쿼리는 `posts`(암묵적으로 `public.posts`)를 찾고 있었던 것.

### 해결

```javascript
const pool = new Pool({
  // ...
  options: `-c search_path=${process.env.DB_SCHEMA || 'public'}`,
});
```

`DB_SCHEMA` 환경변수로 스키마를 지정하고, 기본값은 `public`으로 두어 스키마를 안 쓰는 다른 환경과의 하위 호환성을 유지.

### 핵심 교훈

- 스키마를 도입하면서 테이블 참조(`CREATE TABLE`, 쿼리)만 바꾸기 쉬운데, 커넥션 자체의 `search_path`도 같이 맞춰야 한다는 걸 놓치기 쉽다. `relation does not exist`가 스키마 변경 직후 발생하면 코드의 쿼리 문제가 아니라 커넥션 설정 문제일 가능성부터 확인.
- 로컬에서 진단 스크립트(`psql`)를 돌릴 때도 앱과 동일한 사용자/스키마로 접속해야 앱이 보는 것과 같은 결과를 볼 수 있다. `sudo -u postgres psql`처럼 다른 OS 유저의 peer 인증으로 접속하면 앱의 연결 경로(`-h localhost -U <앱 유저>`, TCP 인증)와 달라져서 진단이 어긋날 수 있다.

## 2025-12-22 ~ 12-24 백엔드 설정 파일 구조 개편과 SSR/클라이언트 API URL 분기

### 배경

초기 배포 단계에서 백엔드 모듈 로딩 에러, 누락된 의존성, PM2 경로 문제, 프론트엔드 환경변수 미설정, SSR/클라이언트 API 호출 실패가 한꺼번에 얽혀서 나타남.

### 문제와 원인

1. **백엔드 모듈 로딩 에러**: 루트 `config/` 폴더에 `package.json`이 없어 그 안의 파일이 CommonJS로 인식됨 → `config/db.js`를 `backend/config/db.js`로 이동(각 프로젝트 설정은 해당 프로젝트 내부에 배치).
2. **누락된 의존성**: `express-session` 미설치로 백엔드 크래시 → `backend/package.json`에 추가.
3. **PM2 설정 경로 문제**: `ecosystem.config.cjs`를 config 폴더 안에 두었더니 스크립트 경로 해석이 어긋남 → 프로젝트 **루트**로 이동하고 각 앱에 `cwd`를 명시. (설정 파일을 폴더별로 정리하려던 시도가, PM2처럼 "루트 기준 상대경로"를 가정하는 도구와는 충돌한 사례.)
4. **프론트엔드 환경변수 미설정**: Astro `envDir` 커스텀 설정 때문에 `PUBLIC_API_URL`이 빌드에 반영 안 됨 → `.env`를 `frontend/` 기본 위치로 되돌리고 `envDir` 설정 제거.
5. **SSR vs 클라이언트 API 호출 차이**: 메인 페이지(SSR)에서는 상대 경로 API 호출이 실패하고, blog/projects 페이지(클라이언트)에서는 `localhost:3000` 직접 호출이 연결 거부됨. SSR은 서버 프로세스 내부에서 도는 것이므로 `http://localhost:3000`(백엔드 내부 주소)을 써야 하고, 클라이언트(브라우저)는 nginx가 프록시하는 상대 경로를 써야 함 — `import.meta.env.SSR`로 두 경로를 분기해서 해결.

### 핵심 교훈

1. **SSR과 클라이언트는 서로 다른 네트워크 위치에서 실행된다.** SSR 코드가 만드는 API 호출은 서버 프로세스 관점(내부 주소)에서, 클라이언트 코드가 만드는 호출은 브라우저 관점(공개 주소/상대경로)에서 짜야 한다. 이 구분을 안 하면 한쪽은 되고 한쪽은 실패하는 상태가 된다.
2. 설정 파일을 "폴더별로 깔끔하게" 정리하는 리팩터링은, PM2·Astro처럼 특정 경로 구조(루트 기준 상대경로, 기본 `envDir`)를 가정하는 도구와 충돌할 수 있다. 도구가 파일을 어디서 찾는지 먼저 확인하고 옮겨야 한다.
3. Node 프로젝트에서 폴더 안 파일이 ESM/CommonJS 중 무엇으로 해석되는지는 그 폴더 계층에 있는(또는 없는) `package.json`의 `type` 필드가 결정한다. 설정 폴더를 새로 만들 때 이 점을 놓치면 import 에러의 원인을 코드가 아닌 곳에서 찾게 된다.

