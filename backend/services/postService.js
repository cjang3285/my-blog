import pool from '../config/db.js';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// Markdown 설정
marked.setOptions({
  gfm: true,              // GitHub Flavored Markdown
  breaks: true,           // 줄바꿈을 <br>로 변환
  headerIds: true,        // 헤더에 ID 자동 생성
  mangle: false,          // 이메일 주소 난독화 비활성화
});

/**
 * 마크다운을 안전한 HTML로 변환
 * @param {string} markdown - 마크다운 텍스트
 * @returns {string} - 안전한 HTML
 */
function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  // 마크다운 → HTML
  const rawHtml = marked.parse(markdown);

  // XSS 방지 처리
  const cleanHtml = sanitizeHtml(rawHtml, {
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
      '*': ['class', 'id']
    },
  });

  return cleanHtml;
}

// Get all posts (ordered by date descending)
export const getAllPosts = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM posts ORDER BY date DESC, id DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getAllPosts service:', error);
    throw error;
  }
};

// Get featured posts only
export const getFeaturedPosts = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM posts WHERE featured = true ORDER BY date DESC, id DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getFeaturedPosts service:', error);
    throw error;
  }
};

// Get single post by slug
export const getPostBySlug = async (slug) => {
  try {
    const result = await pool.query(
      'SELECT * FROM posts WHERE slug = $1',
      [slug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in getPostBySlug service:', error);
    throw error;
  }
};

// Get single post by ID
export const getPostById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM posts WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in getPostById service:', error);
    throw error;
  }
};

// Create new post
export const createPost = async (postData) => {
  try {
    const { title, excerpt, content, tags = [], featured = false } = postData;
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
    const date = new Date().toISOString().split('T')[0];

    // 마크다운을 HTML로 변환
    const content_markdown = content;
    const content_html = renderMarkdown(content);

    const result = await pool.query(
      `INSERT INTO posts (title, slug, excerpt, content_markdown, content_html, date, tags, featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, slug, excerpt, content_markdown, content_html, date, tags, featured]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in createPost service:', error);
    throw error;
  }
};

// Update existing post
export const updatePost = async (id, postData) => {
  try {
    const { title, excerpt, content, tags, featured } = postData;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
      const newSlug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
      updates.push(`slug = $${paramCount}`);
      values.push(newSlug);
      paramCount++;
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount}`);
      values.push(excerpt);
      paramCount++;
    }
    if (content !== undefined) {
      // 마크다운과 HTML 둘 다 업데이트
      updates.push(`content_markdown = $${paramCount}`);
      values.push(content);
      paramCount++;
      updates.push(`content_html = $${paramCount}`);
      values.push(renderMarkdown(content));
      paramCount++;
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount}`);
      values.push(tags);
      paramCount++;
    }
    if (featured !== undefined) {
      updates.push(`featured = $${paramCount}`);
      values.push(featured);
      paramCount++;
    }

    if (updates.length === 0) {
      return await getPostById(id);
    }

    values.push(id);
    const query = `UPDATE posts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in updatePost service:', error);
    throw error;
  }
};

// Delete post by ID
export const deletePost = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM posts WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in deletePost service:', error);
    throw error;
  }
};
