import pool from '../config/db.js';
import { renderMarkdown, hasMathExpression } from '../utils/markdown.js';
import { inferCategory } from '../utils/postCategory.js';

// 목록 응답용 컬럼: 본문(content_markdown/content_html, 글당 ~55KB)은 상세 조회에서만 내려준다
const LIST_COLUMNS = `id, title, slug, excerpt, date, tags, featured, category, has_math,
  created_at, updated_at, source_artifact_ids, auto_generated, ai_model`;

// WHERE 절 조립: 태그/분류 필터를 선택적으로 조합
const buildPostFilter = ({ tag = null, category = null } = {}) => {
  const conditions = [];
  const values = [];
  if (tag) {
    values.push(tag);
    // `= ANY(tags)`는 GIN 인덱스(idx_posts_tags)를 못 탄다
    conditions.push(`tags @> ARRAY[$${values.length}::text]`);
  }
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
};

// Get posts with pagination (optional tag/category filter)
export const getPostsPaginated = async (page, limit, filter = {}) => {
  try {
    const offset = (page - 1) * limit;
    const { where, values } = buildPostFilter(filter);
    const limitParam = values.length + 1;
    const [rowsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT ${LIST_COLUMNS} FROM posts ${where} ORDER BY date DESC, id DESC LIMIT $${limitParam} OFFSET $${limitParam + 1}`,
        [...values, limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM posts ${where}`, values),
    ]);
    const total = parseInt(countResult.rows[0].count, 10);
    return {
      posts: rowsResult.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    console.error('Error in getPostsPaginated service:', error);
    throw error;
  }
};

// Get all unique tags with post counts (optional category filter)
export const getAllTags = async (category = null) => {
  try {
    const result = await pool.query(
      `SELECT unnest(tags) AS tag, COUNT(*) AS count
       FROM posts
       WHERE tags != '{}' AND ($1::text IS NULL OR category = $1)
       GROUP BY tag
       ORDER BY count DESC, tag ASC`,
      [category]
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getAllTags service:', error);
    throw error;
  }
};

// Get post counts per category
export const getCategoryCounts = async () => {
  try {
    const result = await pool.query(
      'SELECT category, COUNT(*)::int AS count FROM posts GROUP BY category'
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getCategoryCounts service:', error);
    throw error;
  }
};

// Get all posts (ordered by date descending)
export const getAllPosts = async () => {
  try {
    const result = await pool.query(
      `SELECT ${LIST_COLUMNS} FROM posts ORDER BY date DESC, id DESC`
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
      `SELECT ${LIST_COLUMNS} FROM posts WHERE featured = true ORDER BY date DESC, id DESC`
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
    const category = postData.category || inferCategory(title);
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9가-힣-]/g, '');
    const date = new Date().toISOString().split('T')[0];

    // 마크다운을 HTML로 변환
    const content_markdown = content;
    const content_html = renderMarkdown(content);
    const has_math = hasMathExpression(content);

    const result = await pool.query(
      `INSERT INTO posts (title, slug, excerpt, content_markdown, content_html, date, tags, featured, has_math, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, slug, excerpt, content_markdown, content_html, date, tags, featured, has_math, category]
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
    const { title, excerpt, content, tags, featured, category } = postData;

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
      updates.push(`has_math = $${paramCount}`);
      values.push(hasMathExpression(content));
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
    if (category !== undefined) {
      updates.push(`category = $${paramCount}`);
      values.push(category);
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
