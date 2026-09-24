// 글 분류 값. DB CHECK 제약(posts_category_check)과 같은 목록을 유지해야 한다.
export const POST_CATEGORIES = ['article', 'ps', 'log'];

// LearningCollector가 올리는 커밋/PR 요약은 "<레포명>: ..." 형식의 제목을 가진다.
const REPO_PREFIX_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*:/;

export const isValidCategory = (category) => POST_CATEGORIES.includes(category);

// 글 작성 시 category가 명시되지 않았을 때의 기본 분류
export const inferCategory = (title) => (REPO_PREFIX_PATTERN.test(title) ? 'log' : 'article');
