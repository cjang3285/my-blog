/**
 * 기존 글들에 수학 수식 렌더링 적용 마이그레이션 스크립트
 * - has_math 플래그 설정
 * - content_html 재렌더링 (KaTeX 적용)
 *
 * 실행: node scripts/migrate-math.js
 */

import 'dotenv/config';
import pool from '../config/db.js';
import { renderMarkdown, hasMathExpression } from '../utils/markdown.js';

async function migrateMath() {
  console.log('수학 수식 마이그레이션 시작...\n');

  try {
    // 모든 포스트 조회
    const result = await pool.query(
      'SELECT id, title, content_markdown FROM blog.posts ORDER BY id'
    );
    const posts = result.rows;

    console.log(`총 ${posts.length}개의 글 발견\n`);

    let updatedCount = 0;
    let mathCount = 0;

    for (const post of posts) {
      const { id, title, content_markdown } = post;

      if (!content_markdown) {
        console.log(`[${id}] "${title}" - 본문 없음, 건너뜀`);
        continue;
      }

      // 수식 여부 체크
      const has_math = hasMathExpression(content_markdown);

      // HTML 재렌더링
      const content_html = renderMarkdown(content_markdown);

      // 업데이트
      await pool.query(
        'UPDATE blog.posts SET content_html = $1, has_math = $2 WHERE id = $3',
        [content_html, has_math, id]
      );

      if (has_math) {
        mathCount++;
        console.log(`[${id}] "${title}" - ✓ 수식 있음, 업데이트 완료`);
      } else {
        console.log(`[${id}] "${title}" - 업데이트 완료`);
      }

      updatedCount++;
    }

    console.log('\n마이그레이션 완료!');
    console.log(`- 총 업데이트: ${updatedCount}개`);
    console.log(`- 수식 포함 글: ${mathCount}개`);

  } catch (error) {
    console.error('마이그레이션 오류:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateMath();
