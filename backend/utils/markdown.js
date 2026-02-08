import { marked } from 'marked';
import katex from 'katex';
import sanitizeHtml from 'sanitize-html';

// Marked 글로벌 설정 (KaTeX extension 제거 - 직접 처리)
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
 * @param {string} markdown - 마크다운 원본 텍스트
 * @returns {boolean} 수식 존재 여부
 */
export function hasMathExpression(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return false;
  }

  // 블록 수식: $$...$$
  if (/\$\$[\s\S]+?\$\$/.test(markdown)) {
    return true;
  }

  // 인라인 수식: $...$ (가격 표시 $100 제외)
  const inlineMatches = markdown.match(/(?<!\\)\$(?!\$)(.+?)(?<!\\)\$/g);
  if (inlineMatches) {
    for (const match of inlineMatches) {
      const content = match.slice(1, -1);
      // 단순 숫자(가격)가 아닌 경우 수식으로 판단
      if (!/^\d+([.,]\d+)?$/.test(content)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * KaTeX로 수식 렌더링
 * @param {string} latex - LaTeX 수식
 * @param {boolean} displayMode - 블록 모드 여부
 * @returns {string} 렌더링된 HTML 또는 에러 시 원본
 */
function renderKatex(latex, displayMode = false) {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
  } catch (error) {
    console.warn(`[MARKDOWN] KaTeX render failed (${displayMode ? 'block' : 'inline'}): "${latex.substring(0, 80)}" - ${error.message}`);
    return displayMode ? `$$${latex}$$` : `$${latex}$`;
  }
}

/**
 * 마크다운 텍스트를 안전한 HTML로 변환
 * 수식을 먼저 처리하여 마크다운 파싱과의 충돌 방지
 * @param {string} markdown - 마크다운 원본 텍스트
 * @returns {string} XSS 필터링된 HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // 수식 저장용 맵
  const mathMap = new Map();
  let mathIndex = 0;

  // 1. 블록 수식 ($$...$$) 먼저 추출 및 렌더링
  let processed = markdown.replace(/\$\$([\s\S]+?)\$\$/g, (match, latex) => {
    const placeholder = `%%MATH_BLOCK_${mathIndex}%%`;
    mathMap.set(placeholder, renderKatex(latex.trim(), true));
    mathIndex++;
    return placeholder;
  });

  // 2. 인라인 수식 ($...$) 추출 및 렌더링
  // 가격 표시 ($100) 제외
  processed = processed.replace(/(?<!\\)\$(?!\$)(.+?)(?<!\\)\$/g, (match, latex) => {
    // 단순 숫자는 수식이 아님
    if (/^\d+([.,]\d+)?$/.test(latex)) {
      return match;
    }
    const placeholder = `%%MATH_INLINE_${mathIndex}%%`;
    mathMap.set(placeholder, renderKatex(latex.trim(), false));
    mathIndex++;
    return placeholder;
  });

  // 3. 마크다운 → HTML 파싱
  let html = marked.parse(processed);

  // 4. placeholder를 렌더링된 수식으로 복원
  for (const [placeholder, rendered] of mathMap) {
    html = html.replace(placeholder, rendered);
  }

  // 5. XSS 방지를 위한 HTML 정제
  const cleanHtml = sanitizeHtml(html, SANITIZE_OPTIONS);

  return cleanHtml;
}

export default renderMarkdown;
