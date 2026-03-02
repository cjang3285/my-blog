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
│   │   ├── BlogCard.astro
│   │   ├── Hero.astro
│   │   └── ProjectCard.astro
│   ├── layouts/
│   │   └── Layout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── blog.astro
│   │   ├── blog/[slug].astro
│   │   ├── projects.astro
│   │   ├── projects/[id].astro
│   │   ├── about.astro
│   │   ├── status.astro
│   │   ├── conferences.astro
│   │   ├── releases.astro
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
