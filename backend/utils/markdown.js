import { marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import sanitizeHtml from 'sanitize-html';

// KaTeX 확장 등록
marked.use(markedKatex({
  throwOnError: false,  // 에러 시 원본 텍스트 표시
  output: 'html',
}));

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
    // 기존 마크다운 태그
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'em', 'del', 'code', 'pre',
    'a', 'img',
    'blockquote',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // KaTeX 렌더링용 태그
    'span', 'div',
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
    'msup', 'msub', 'msubsup', 'mfrac', 'mroot', 'msqrt',
    'mover', 'munder', 'munderover', 'mtable', 'mtr', 'mtd',
    'annotation', 'annotation-xml',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title'],
    '*': ['class', 'id', 'aria-hidden', 'role'],
    // KaTeX span에 style 허용 (제한적)
    span: ['class', 'style', 'aria-hidden'],
    div: ['class', 'style'],
    // MathML 속성
    math: ['xmlns', 'display'],
    annotation: ['encoding'],
  },
  // KaTeX가 사용하는 CSS 속성만 허용
  allowedStyles: {
    '*': {
      'color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      'background-color': [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(/, /^rgba\(/],
      'height': [/^[\d.]+em$/, /^[\d.]+px$/],
      'width': [/^[\d.]+em$/, /^[\d.]+px$/],
      'min-width': [/^[\d.]+em$/, /^[\d.]+px$/],
      'margin-left': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'margin-right': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'margin-top': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'margin-bottom': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'padding-left': [/^[\d.]+em$/, /^[\d.]+px$/],
      'padding-right': [/^[\d.]+em$/, /^[\d.]+px$/],
      'top': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'left': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'bottom': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'right': [/^-?[\d.]+em$/, /^-?[\d.]+px$/],
      'vertical-align': [/^-?[\d.]+em$/, /^-?[\d.]+px$/, /^(top|middle|bottom|baseline|sub|super|text-top|text-bottom)$/],
      'font-size': [/^[\d.]+em$/, /^[\d.]+px$/, /^[\d.]+%$/],
      'line-height': [/^[\d.]+$/, /^[\d.]+em$/, /^[\d.]+px$/],
      'position': [/^(relative|absolute)$/],
      'display': [/^(inline-block|block|inline)$/],
      'border-bottom': [/.*/],  // KaTeX fraction lines
    },
  },
};

/**
 * 수학 수식 존재 여부 체크
 * - $...$ 또는 $$...$$ 패턴 감지
 * - 단순 $숫자 (가격 표시)는 제외
 * - 정규식 끝의 $ 제외
 * @param {string} markdown - 마크다운 원본 텍스트
 * @returns {boolean} 수식 존재 여부
 */
export function hasMathExpression(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return false;
  }

  // 블록 수식: $$...$$
  const blockMathPattern = /\$\$[\s\S]+?\$\$/;
  if (blockMathPattern.test(markdown)) {
    return true;
  }

  // 인라인 수식: $...$
  // 제외 조건:
  // 1. $숫자 형태 (가격: $100, $50.00)
  // 2. 정규식 끝 $ (단독 $ 또는 문자열 끝)
  // 3. 이스케이프된 \$

  // LaTeX 명령어나 수식 문법이 포함된 인라인 수식 탐지
  // 예: $a^2$, $\frac{1}{2}$, $x_i$, $\binom{n}{k}$
  const inlineMathPattern = /(?<!\\)\$(?!\d+(?:[.,]\d+)?(?:\s|$))([^$\n]+?)(?<!\\)\$/;

  if (inlineMathPattern.test(markdown)) {
    // 추가 검증: LaTeX 문법이 실제로 있는지
    const matches = markdown.match(/(?<!\\)\$([^$\n]+?)(?<!\\)\$/g);
    if (matches) {
      for (const match of matches) {
        const content = match.slice(1, -1);
        // LaTeX 문법 패턴: ^, _, \, {, }, frac, binom, sqrt, sum, int 등
        if (/[\\^_{}]|\\[a-zA-Z]+/.test(content)) {
          return true;
        }
        // 그리스 문자나 수학 기호
        if (/[αβγδεζηθικλμνξπρστυφχψωΓΔΘΛΞΠΣΦΨΩ∑∏∫∂∇√∞≈≠≤≥±×÷]/.test(content)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 마크다운 텍스트를 안전한 HTML로 변환
 * @param {string} markdown - 마크다운 원본 텍스트
 * @returns {string} XSS 필터링된 HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // 1. 마크다운 → HTML 파싱 (KaTeX 포함)
  const rawHtml = marked.parse(markdown);

  // 2. XSS 방지를 위한 HTML 정제
  const cleanHtml = sanitizeHtml(rawHtml, SANITIZE_OPTIONS);

  return cleanHtml;
}

export default renderMarkdown;
