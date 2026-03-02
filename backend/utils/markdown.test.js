import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
  it('기본 마크다운 변환 (헤더, 볼드, 이탤릭)', () => {
    const result = renderMarkdown('# Header\n\n**Bold** and *italic*');
    expect(result).toContain('<h1>');
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
  });

  it('XSS 방지: <script> 태그 제거', () => {
    const result = renderMarkdown('<script>alert("XSS")</script>');
    expect(result).not.toContain('<script>');
  });

  it('null 입력 시 빈 문자열 반환', () => {
    expect(renderMarkdown(null)).toBe('');
  });

  it('GFM 테이블 렌더링', () => {
    const result = renderMarkdown('| Col1 | Col2 |\n|------|------|\n| A | B |');
    expect(result).toContain('<table>');
    expect(result).toContain('<td>');
  });

  it('개행 처리 (<br> 태그)', () => {
    const result = renderMarkdown('Line 1\nLine 2');
    expect(result).toContain('<br');
  });
});
