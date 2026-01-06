import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Marked 글로벌 설정
marked.setOptions({
  gfm: true,           // GitHub Flavored Markdown
  breaks: true,        // 개행을 <br> 태그로 변환
  headerIds: true,     // 헤더에 ID 자동 생성
  mangle: false,       // 이메일 주소 난독화 비활성화
});

// XSS 방지를 위한 허용 태그 및 속성 설정
const SANITIZE_OPTIONS = {
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
    '*': ['class', 'id'],
  },
};

/**
 * 마크다운 텍스트를 안전한 HTML로 변환
 * @param {string} markdown - 마크다운 원본 텍스트
 * @returns {string} XSS 필터링된 HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // 1. 마크다운 → HTML 파싱
  const rawHtml = marked.parse(markdown);

  // 2. XSS 방지를 위한 HTML 정제
  const cleanHtml = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);

  return cleanHtml;
}

export default renderMarkdown;
