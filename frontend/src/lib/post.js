// 글 분류 표시 정보. 백엔드 utils/postCategory.js의 POST_CATEGORIES와 같은 키를 유지해야 한다.
export const CATEGORIES = {
	article: {
		label: '글',
		description: '운영하면서 막힌 문제와 공부한 내용을 다른 사람도 읽을 수 있게 정리한 글입니다.',
	},
	ps: {
		label: '문제 풀이',
		description: '백준 등 알고리즘 문제를 풀며 정리한 풀이와 개념입니다.',
	},
	log: {
		label: '개발 로그',
		description: '프로젝트 커밋과 PR 단위로 남긴 짧은 작업 기록입니다.',
	},
};

export const DEFAULT_CATEGORY = 'article';

export const isCategory = (value) => Object.hasOwn(CATEGORIES, value);

const KST = 'Asia/Seoul';

// 2026-08-22
export const formatDate = (value) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: KST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

// 08-22
export const formatMonthDay = (value) => formatDate(value).slice(5);

export const getYear = (value) => formatDate(value).slice(0, 4);

// 한국어 기술 글 기준 분당 약 500자
const CHARS_PER_MINUTE = 500;

export const readingMinutes = (markdown = '') => Math.max(1, Math.round(markdown.length / CHARS_PER_MINUTE));

// 연도별로 묶기 (입력은 날짜 내림차순이라고 가정)
export function groupByYear(posts) {
	const groups = [];
	for (const post of posts) {
		const year = getYear(post.date);
		const last = groups[groups.length - 1];
		if (last && last.year === year) last.posts.push(post);
		else groups.push({ year, posts: [post] });
	}
	return groups;
}
