import { renderMarkdown } from './markdown.js';

/**
 * 마크다운 유틸리티 단위 테스트
 */

console.log('=== Markdown Utility Tests ===\n');

// Test 1: 기본 마크다운 변환
const test1 = renderMarkdown('# Header\n\n**Bold** and *italic*');
console.log('Test 1 - Basic Markdown:');
console.log('Input: # Header\\n\\n**Bold** and *italic*');
console.log('Output:', test1);
console.log('Pass:', test1.includes('<h1>') && test1.includes('<strong>') && test1.includes('<em>'));
console.log('');

// Test 2: XSS 방지
const test2 = renderMarkdown('<script>alert("XSS")</script>');
console.log('Test 2 - XSS Prevention:');
console.log('Input: <script>alert("XSS")</script>');
console.log('Output:', test2);
console.log('Pass:', !test2.includes('<script>'));
console.log('');

// Test 3: null/undefined 처리
const test3 = renderMarkdown(null);
console.log('Test 3 - Null Input:');
console.log('Input: null');
console.log('Output:', test3);
console.log('Pass:', test3 === '');
console.log('');

// Test 4: GFM 테이블
const test4 = renderMarkdown('| Col1 | Col2 |\n|------|------|\n| A | B |');
console.log('Test 4 - GFM Table:');
console.log('Input: | Col1 | Col2 |...');
console.log('Output:', test4);
console.log('Pass:', test4.includes('<table>') && test4.includes('<td>'));
console.log('');

// Test 5: 개행 처리
const test5 = renderMarkdown('Line 1\nLine 2');
console.log('Test 5 - Line Breaks:');
console.log('Input: Line 1\\nLine 2');
console.log('Output:', test5);
console.log('Pass:', test5.includes('<br'));
console.log('');

console.log('=== All Tests Completed ===');
