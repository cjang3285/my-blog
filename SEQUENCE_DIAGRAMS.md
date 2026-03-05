# 블로그 시퀀스 다이어그램

> 참여자 범례
> - **User** : 브라우저(사용자)
> - **Astro** : 프론트엔드 페이지 (SSR 서버 / 클라이언트 스크립트)
> - **Express** : 백엔드 API 서버 (Node.js)
> - **Middleware** : Auth 미들웨어
> - **Controller** : 컨트롤러 (비즈니스 로직)
> - **Service** : 서비스 레이어 (DB 쿼리)
> - **DB** : PostgreSQL

---

## 1. 홈 페이지 방문 (`GET /`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro SSR<br/>(index.astro)
    participant Express
    participant Controller as postController /<br/>projectController
    participant Service as postService /<br/>projectService
    participant DB as PostgreSQL

    User->>Astro: GET /

    Note over Astro: 서버사이드 렌더링 (frontmatter)

    Astro->>Express: GET /api/posts
    Express->>Controller: getPosts()
    Controller->>Service: getAllPosts()
    Service->>DB: SELECT * FROM posts ORDER BY date DESC LIMIT 3
    DB-->>Service: 최신 포스트 3개
    Service-->>Controller: posts[]
    Controller-->>Express: 200 OK + posts[]
    Express-->>Astro: posts[]

    Astro->>Express: GET /api/projects
    Express->>Controller: getProjects()
    Controller->>Service: getAllProjects()
    Service->>DB: SELECT * FROM projects ORDER BY created_at DESC LIMIT 3
    DB-->>Service: 최신 프로젝트 3개
    Service-->>Controller: projects[]
    Controller-->>Express: 200 OK + projects[]
    Express-->>Astro: projects[]

    Note over Astro: Hero, BlogCard, ProjectCard 컴포넌트로 HTML 렌더링
    Astro-->>User: 완성된 HTML 페이지 반환
```

---

## 2. 블로그 목록 조회 (`GET /blog`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(blog.astro)
    participant Express
    participant Middleware as authMiddleware
    participant Controller as authController /<br/>postController
    participant Service as postService
    participant DB as PostgreSQL

    User->>Astro: GET /blog
    Astro-->>User: 빈 HTML + 클라이언트 스크립트 전달

    Note over Astro: 클라이언트 스크립트 실행

    par 인증 상태 확인
        Astro->>Express: GET /api/auth/check
        Express->>Controller: checkAuth()
        Controller-->>Express: { isAuthenticated: boolean }
        Express-->>Astro: 200 OK + { isAuthenticated }
        Note over Astro: isAuthenticated=true → "+ 새 글 작성" 버튼 표시
    and 포스트 목록 로드
        Astro->>Express: GET /api/posts
        Express->>Controller: getPosts()
        Controller->>Service: getAllPosts()
        Service->>DB: SELECT * FROM posts ORDER BY date DESC, id DESC
        DB-->>Service: posts[]
        Service-->>Controller: posts[]
        Controller-->>Express: 200 OK + posts[]
        Express-->>Astro: posts[]
        Note over Astro: 포스트 카드 렌더링<br/>(날짜, 태그, 제목, 발췌)
    end

    Astro-->>User: 포스트 목록 표시
```

---

## 3. 블로그 글 상세 조회 (`GET /blog/[slug]`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(blog/[slug].astro)
    participant Express
    participant Controller as authController /<br/>postController
    participant Service as postService
    participant DB as PostgreSQL
    participant CDN as KaTeX CDN

    User->>Astro: GET /blog/{slug}
    Astro-->>User: 빈 HTML + 클라이언트 스크립트 전달

    Note over Astro: 클라이언트 스크립트 실행

    par 포스트 로드
        Astro->>Express: GET /api/posts/{slug}
        Express->>Controller: getPost(slug)
        Controller->>Service: getPostBySlug(slug)
        Service->>DB: SELECT * FROM posts WHERE slug = $1
        DB-->>Service: post (or null)
        Service-->>Controller: post
        Controller-->>Express: 200 OK + post / 404
        Express-->>Astro: post 객체

        Note over Astro: content_html 렌더링<br/>(서버에서 미리 변환된 HTML)

        alt post.has_math === true
            Astro->>CDN: KaTeX CSS 동적 로드
            CDN-->>Astro: katex.min.css
        end
    and 인증 상태 확인
        Astro->>Express: GET /api/auth/check
        Express->>Controller: checkAuth()
        Controller-->>Express: { isAuthenticated }
        Express-->>Astro: { isAuthenticated }
        Note over Astro: isAuthenticated=true → 편집/삭제 버튼 표시
    end

    Astro-->>User: 포스트 상세 표시
```

---

## 4. 로그인 (`POST /api/auth/login`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(admin/login.astro)
    participant Express
    participant Controller as authController
    participant Session as express-session

    User->>Astro: GET /admin/login
    Astro-->>User: 로그인 폼 HTML 반환

    User->>Astro: 비밀번호 입력 후 제출
    Astro->>Express: POST /api/auth/login<br/>{ password } + credentials: 'include'

    Express->>Controller: login(req, res)

    alt 비밀번호 일치 (=== process.env.ADMIN_PASSWORD)
        Controller->>Session: req.session.isAuthenticated = true
        Session-->>Controller: 세션 저장 완료
        Controller-->>Express: { success: true }
        Express-->>Astro: 200 OK + Set-Cookie: connect.sid
        Astro->>User: 리다이렉트 → / (또는 ?redirect 파라미터)
    else 비밀번호 불일치
        Controller-->>Express: { error: 'Invalid password' }
        Express-->>Astro: 401 Unauthorized
        Astro-->>User: 에러 메시지 표시
    end
```

---

## 5. 블로그 글 작성 (`POST /api/posts`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(blog.astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as postController
    participant Util as markdown.js
    participant Service as postService
    participant DB as PostgreSQL

    User->>Astro: "+ 새 글 작성" 버튼 클릭
    Astro-->>User: 작성 모달 표시

    User->>Astro: 제목, 발췌, 내용(Markdown), 태그, 추천 여부 입력 후 제출

    Astro->>Express: POST /api/posts<br/>{ title, excerpt, content, tags, featured }

    Express->>Middleware: requireAuth(req, res, next)
    alt 세션 인증됨
        Middleware-->>Express: next()
        Express->>Controller: addPost(req, res)

        Note over Controller: 슬러그 생성<br/>title → lowercase → 공백→'-' → 특수문자 제거

        Controller->>Util: renderMarkdown(content)
        Note over Util: 1. 수식($...$, $$...$$) 추출 및 플레이스홀더 치환<br/>2. marked.parse() → HTML<br/>3. KaTeX로 수식 렌더링<br/>4. sanitize-html로 XSS 방지
        Util-->>Controller: content_html

        Controller->>Util: hasMathExpression(content)
        Util-->>Controller: has_math (boolean)

        Controller->>Service: createPost({ title, slug, excerpt, content_markdown, content_html, date, tags, featured, has_math })
        Service->>DB: INSERT INTO posts (...) VALUES (...)
        DB-->>Service: 생성된 post (id 포함)
        Service-->>Controller: post
        Controller-->>Express: 201 Created + post
        Express-->>Astro: 201 + 새 포스트 객체

        Astro->>Express: GET /api/posts (목록 새로고침)
        Express-->>Astro: 갱신된 posts[]
        Astro-->>User: 모달 닫기 + 목록 업데이트
    else 인증 안 됨
        Middleware-->>Express: 401 Unauthorized
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 6. 블로그 글 수정 (`PUT /api/posts/:id`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(blog/[slug].astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as postController
    participant Util as markdown.js
    participant Service as postService
    participant DB as PostgreSQL

    User->>Astro: 편집 버튼 클릭
    Astro-->>User: 기존 데이터로 채워진 편집 모달 표시

    User->>Astro: 필드 수정 후 제출

    Astro->>Express: PUT /api/posts/{id}<br/>{ title?, excerpt?, content?, tags?, featured? }

    Express->>Middleware: requireAuth
    alt 인증됨
        Middleware-->>Express: next()
        Express->>Controller: updatePost(req, res)

        Controller->>Service: getPostById(id)
        Service->>DB: SELECT * FROM posts WHERE id = $1
        DB-->>Service: 기존 post
        Service-->>Controller: 기존 post

        alt title 변경됨
            Note over Controller: 새 슬러그 재생성
        end

        alt content 변경됨
            Controller->>Util: renderMarkdown(newContent)
            Util-->>Controller: content_html
            Controller->>Util: hasMathExpression(newContent)
            Util-->>Controller: has_math
        end

        Controller->>Service: updatePost(id, changedFields)
        Service->>DB: UPDATE posts SET ... WHERE id = $1
        DB-->>Service: 수정된 post
        Service-->>Controller: post
        Controller-->>Express: 200 OK + post
        Express-->>Astro: 수정된 포스트 객체

        alt 슬러그 변경됨
            Astro->>User: 새 URL로 리다이렉트<br/>(/blog/{newSlug})
        else 슬러그 동일
            Astro->>Express: GET /api/posts/{slug} (재로드)
            Express-->>Astro: 갱신된 post
            Astro-->>User: 모달 닫기 + 내용 업데이트
        end
    else 인증 안 됨
        Middleware-->>Express: 401
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 7. 블로그 글 삭제 (`DELETE /api/posts/:id`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(blog/[slug].astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as postController
    participant Service as postService
    participant DB as PostgreSQL

    User->>Astro: 삭제 버튼 클릭
    Astro-->>User: 확인 다이얼로그 표시

    User->>Astro: 삭제 확인

    Astro->>Express: DELETE /api/posts/{id}

    Express->>Middleware: requireAuth
    alt 인증됨
        Middleware-->>Express: next()
        Express->>Controller: deletePost(req, res)
        Controller->>Service: deletePost(id)
        Service->>DB: DELETE FROM posts WHERE id = $1
        DB-->>Service: 삭제된 post
        Service-->>Controller: deletedPost
        Controller-->>Express: 200 OK + { success: true, deletedPost }
        Express-->>Astro: 200 OK
        Astro->>User: /blog 로 리다이렉트
    else 인증 안 됨
        Middleware-->>Express: 401
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 8. 프로젝트 목록 조회 (`GET /projects`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(projects.astro)
    participant Express
    participant Controller as authController /<br/>projectController
    participant Service as projectService
    participant DB as PostgreSQL

    User->>Astro: GET /projects
    Astro-->>User: 빈 HTML + 클라이언트 스크립트 전달

    Note over Astro: 클라이언트 스크립트 실행

    par 인증 상태 확인
        Astro->>Express: GET /api/auth/check
        Express->>Controller: checkAuth()
        Controller-->>Express: { isAuthenticated }
        Express-->>Astro: { isAuthenticated }
        Note over Astro: isAuthenticated=true → "+ 새 프로젝트 추가" 버튼 표시
    and 프로젝트 목록 로드
        Astro->>Express: GET /api/projects
        Express->>Controller: getProjects()
        Controller->>Service: getAllProjects()
        Service->>DB: SELECT * FROM projects ORDER BY created_at DESC, id DESC
        DB-->>Service: projects[]
        Service-->>Controller: projects[]
        Controller-->>Express: 200 OK + projects[]
        Express-->>Astro: projects[]
        Note over Astro: ProjectCard 컴포넌트로 렌더링<br/>(제목, 설명, 스택, GitHub 링크)
    end

    Astro-->>User: 프로젝트 목록 표시
```

---

## 9. 프로젝트 상세 조회 (`GET /projects/[id]`)

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(projects/[id].astro)
    participant Express
    participant Controller as authController /<br/>projectController
    participant Service as projectService
    participant DB as PostgreSQL

    User->>Astro: GET /projects/{id}
    Astro-->>User: 빈 HTML + 클라이언트 스크립트 전달

    Note over Astro: 클라이언트 스크립트 실행

    par 프로젝트 로드
        Astro->>Express: GET /api/projects/{id}
        Express->>Controller: getProject(id)

        alt id가 숫자가 아님
            Controller-->>Express: 400 Bad Request
            Express-->>Astro: 400
            Astro-->>User: 에러 표시
        else 정상 요청
            Controller->>Service: getProjectById(id)
            Service->>DB: SELECT * FROM projects WHERE id = $1
            DB-->>Service: project (or null)
            Service-->>Controller: project
            alt project 없음
                Controller-->>Express: 404 Not Found
            else 존재
                Controller-->>Express: 200 OK + project
                Express-->>Astro: project 객체
                Note over Astro: content_html 렌더링<br/>스택 태그, GitHub 링크 표시
            end
        end
    and 인증 상태 확인
        Astro->>Express: GET /api/auth/check
        Express->>Controller: checkAuth()
        Controller-->>Express: { isAuthenticated }
        Express-->>Astro: { isAuthenticated }
        Note over Astro: isAuthenticated=true → 편집/삭제 버튼 표시
    end

    Astro-->>User: 프로젝트 상세 표시
```

---

## 10. 프로젝트 추가 (`POST /api/projects`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(projects.astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as projectController
    participant Service as projectService
    participant Util as markdown.js
    participant DB as PostgreSQL

    User->>Astro: "+ 새 프로젝트 추가" 버튼 클릭
    Astro-->>User: 추가 모달 표시

    User->>Astro: 제목, 설명, 내용(Markdown), 스택, GitHub URL 입력 후 제출

    Astro->>Express: POST /api/projects<br/>{ title, description, content, stack, github_url }

    Express->>Middleware: requireAuth
    alt 인증됨
        Middleware-->>Express: next()
        Express->>Controller: addProject(req, res)

        Note over Controller: 필수 필드 검증<br/>(title, description, stack, github_url)

        Controller->>Service: createProject({ title, description, content_markdown, stack[], github_url })
        Service->>Util: renderMarkdown(content)
        Note over Util: marked.parse() → HTML<br/>sanitize-html로 XSS 방지
        Util-->>Service: content_html
        Service->>DB: INSERT INTO projects (...) VALUES (...)
        DB-->>Service: 생성된 project
        Service-->>Controller: project
        Controller-->>Express: 201 Created + project
        Express-->>Astro: 201 + 새 프로젝트 객체

        Astro->>Express: GET /api/projects (목록 새로고침)
        Express-->>Astro: 갱신된 projects[]
        Astro-->>User: 모달 닫기 + 목록 업데이트
    else 인증 안 됨
        Middleware-->>Express: 401
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 11. 프로젝트 수정 (`PUT /api/projects/:id`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(projects/[id].astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as projectController
    participant Service as projectService
    participant Util as markdown.js
    participant DB as PostgreSQL

    User->>Astro: 편집 버튼 클릭
    Astro-->>User: 기존 데이터로 채워진 편집 모달 표시

    User->>Astro: 필드 수정 후 제출

    Astro->>Express: PUT /api/projects/{id}<br/>{ title?, description?, content?, stack?, github_url? }

    Express->>Middleware: requireAuth
    alt 인증됨
        Middleware-->>Express: next()
        Express->>Controller: updateProject(req, res)

        Controller->>Service: getProjectById(id)
        Service->>DB: SELECT * FROM projects WHERE id = $1
        DB-->>Service: 기존 project
        Service-->>Controller: 기존 project

        alt content 변경됨
            Controller->>Util: renderMarkdown(newContent)
            Util-->>Controller: content_html
        end

        Controller->>Service: updateProject(id, changedFields)
        Service->>DB: UPDATE projects SET ... WHERE id = $1
        DB-->>Service: 수정된 project
        Service-->>Controller: project
        Controller-->>Express: 200 OK + project
        Express-->>Astro: 수정된 프로젝트 객체

        Astro->>Express: GET /api/projects/{id} (재로드)
        Express-->>Astro: 갱신된 project
        Astro-->>User: 모달 닫기 + 내용 업데이트
    else 인증 안 됨
        Middleware-->>Express: 401
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 12. 프로젝트 삭제 (`DELETE /api/projects/:id`) — 인증 필요

```mermaid
sequenceDiagram
    participant User
    participant Astro as Astro Client<br/>(projects/[id].astro)
    participant Express
    participant Middleware as requireAuth
    participant Controller as projectController
    participant Service as projectService
    participant DB as PostgreSQL

    User->>Astro: 삭제 버튼 클릭
    Astro-->>User: 확인 다이얼로그 표시

    User->>Astro: 삭제 확인

    Astro->>Express: DELETE /api/projects/{id}

    Express->>Middleware: requireAuth
    alt 인증됨
        Middleware-->>Express: next()
        Express->>Controller: deleteProject(req, res)
        Controller->>Service: deleteProject(id)
        Service->>DB: DELETE FROM projects WHERE id = $1
        DB-->>Service: 삭제된 project
        Service-->>Controller: deletedProject
        Controller-->>Express: 200 OK + { success: true, deletedProject }
        Express-->>Astro: 200 OK
        Astro->>User: /projects 로 리다이렉트
    else 인증 안 됨
        Middleware-->>Express: 401
        Express-->>Astro: 401
        Astro-->>User: 에러 표시
    end
```

---

## 처리 위치 요약표

| 요청 종류 | 클라이언트 (브라우저) | 프론트 서버 (Astro SSR) | 백엔드 (Express) | DB |
|---|---|---|---|---|
| 홈 페이지 방문 | HTML 수신 | `index.astro` SSR 렌더링 | `/api/posts`, `/api/projects` | SELECT |
| 블로그 목록 조회 | `checkAuth()`, `loadPosts()` | — | `/api/auth/check`, `/api/posts` | SELECT |
| 블로그 글 상세 조회 | `loadPost()`, `checkAuth()` | — | `/api/posts/:slug`, `/api/auth/check` | SELECT |
| 로그인 | 폼 제출 | — | `/api/auth/login`, 세션 생성 | — |
| 블로그 글 작성 | 모달 폼 제출 | — | `/api/posts` (POST), 마크다운 렌더링 | INSERT |
| 블로그 글 수정 | 모달 폼 제출 | — | `/api/posts/:id` (PUT), 마크다운 재렌더링 | UPDATE |
| 블로그 글 삭제 | 삭제 확인 | — | `/api/posts/:id` (DELETE) | DELETE |
| 프로젝트 목록 조회 | `checkAuth()`, `loadProjects()` | — | `/api/auth/check`, `/api/projects` | SELECT |
| 프로젝트 상세 조회 | `loadProject()`, `checkAuth()` | — | `/api/projects/:id`, `/api/auth/check` | SELECT |
| 프로젝트 추가 | 모달 폼 제출 | — | `/api/projects` (POST), 마크다운 렌더링 | INSERT |
| 프로젝트 수정 | 모달 폼 제출 | — | `/api/projects/:id` (PUT), 마크다운 재렌더링 | UPDATE |
| 프로젝트 삭제 | 삭제 확인 | — | `/api/projects/:id` (DELETE) | DELETE |

> **핵심 특이점**
> - 홈 페이지(`/`)만 Astro SSR에서 API를 직접 호출해 서버에서 렌더링
> - 나머지 모든 페이지는 클라이언트 JS가 직접 Express API를 `fetch()`로 호출
> - 마크다운 → HTML 변환은 항상 **백엔드(Express)**에서 수행되어 DB에 저장
> - 수학식 포함 여부(`has_math`)가 true일 때만 KaTeX CSS를 CDN에서 동적 로드
> - 인증은 세션 쿠키(`connect.sid`)로 관리, 로컬호스트는 자동 인증(`autoAuth` 미들웨어)
