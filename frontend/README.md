# Frontend

Astro 5.x 기반 블로그 프론트엔드.

## 기술 스택

- **Framework**: Astro 5.x (SSR, `@astrojs/node`)
- **스타일**: Tailwind CSS 4.x (`@tailwindcss/typography` 포함)
- **언어**: TypeScript
- **테스트**: Vitest
- **린터/포맷터**: ESLint, Prettier

## 프로젝트 구조

```
frontend/
├── src/
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── PostEditorModal.astro
│   │   ├── PostRow.astro
│   │   └── ProjectCard.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── lib/
│   │   ├── api.js          # SSR용 백엔드 호출 (SERVER_API_URL)
│   │   └── post.js         # 글 분류 라벨, 날짜(KST) 포맷
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog.astro
│   │   ├── blog/[slug].astro
│   │   ├── projects.astro
│   │   ├── projects/[id].astro
│   │   ├── about.astro
│   │   ├── rss.xml.js
│   │   ├── status.astro
│   │   └── admin/login.astro
│   └── styles/
│       └── global.css
└── config/
    ├── astro.config.mjs
    ├── eslint.config.js
    ├── vitest.config.js
    └── (prettier 설정)
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 서버 실행 (`localhost:4321`) |
| `npm run build` | 프로덕션 빌드 (`./dist/`) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | Vitest 테스트 실행 |
| `npm run test:ui` | Vitest UI 모드 |
| `npm run type-check` | TypeScript 타입 검사 |
| `npm run lint` | ESLint 검사 |
| `npm run lint:fix` | ESLint 자동 수정 |
| `npm run format` | Prettier 포맷 |
| `npm run format:check` | Prettier 검사 |

## 환경변수

| 변수 | 시점 | 설명 | 기본값 |
|------|------|------|--------|
| `PUBLIC_API_URL` | 빌드 | 브라우저 스크립트가 호출할 API 주소 | `''` (상대 경로, nginx 프록시) |
| `SERVER_API_URL` | 런타임 | SSR(페이지 frontmatter, `rss.xml`)이 호출할 백엔드 주소 | `http://localhost:3000` |
| `ADMIN_PATH_SECRET` | 런타임 | 관리자 페이지 경로 | - |

`src/middleware.js`의 방문 기록 호출은 아직 `http://localhost:3000`을 직접 사용한다.

## 글 분류

`blog.posts.category`(`backend/db/add-category-to-posts.sql`)로 글을 나눈다.

| 값 | 표시 | 기준 |
|----|------|------|
| `article` | 글 | 독자용 정리 글. 메인, `/blog` 기본 탭, RSS에 노출 |
| `ps` | 문제 풀이 | 백준/알고리즘 풀이 |
| `log` | 개발 로그 | LearningCollector의 `<레포명>: ...` 커밋/PR 요약, 짧은 메모 |

새 글 작성 시 `category`를 보내지 않으면 백엔드가 제목으로 추정한다 (`<레포명>:`로 시작하면 `log`, 그 외 `article`). 관리자 수정 모달에서 바꿀 수 있다.
