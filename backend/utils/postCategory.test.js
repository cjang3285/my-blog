import { describe, it, expect } from 'vitest';
import { inferCategory, isValidCategory } from './postCategory.js';

describe('inferCategory', () => {
  it('"<레포명>: ..." 제목은 log', () => {
    expect(inferCategory('website: nginx에 레이트리미팅 3단계 존 도입')).toBe('log');
    expect(inferCategory('LearningCollector: auto 모드는 PR 요약만 포스팅')).toBe('log');
    expect(inferCategory('my-blog: 태그 사이드바 높이 제한')).toBe('log');
  });

  it('그 외 제목은 article', () => {
    expect(inferCategory('VXLAN 터널링, 개념부터 다시 뜯어보기 (VXLAN 3부작 ②)')).toBe('article');
    expect(inferCategory('백준 11049: 행렬 곱셈 순서')).toBe('article');
    expect(inferCategory('LearningCollector 포스팅이 갑자기 멈춘 이유: 401 에러부터')).toBe('article');
  });
});

describe('isValidCategory', () => {
  it('허용된 값만 통과', () => {
    expect(isValidCategory('article')).toBe(true);
    expect(isValidCategory('ps')).toBe(true);
    expect(isValidCategory('log')).toBe(true);
    expect(isValidCategory('etc')).toBe(false);
    expect(isValidCategory(undefined)).toBe(false);
  });
});
