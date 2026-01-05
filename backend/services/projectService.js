import pool from '../config/db.js';
import { marked } from 'marked';
import createDOMPurify from 'isomorphic-dompurify';

const DOMPurify = createDOMPurify();

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
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'del', 'code', 'pre',
      'a', 'img',
      'blockquote',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
  });

  return cleanHtml;
}

// Get all projects (ordered by created_at descending)
export const getAllProjects = async () => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects ORDER BY created_at DESC, id DESC'
    );
    return result.rows;
  } catch (error) {
    console.error('Error in getAllProjects service:', error);
    throw error;
  }
};

// Get single project by ID
export const getProjectById = async (id) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in getProjectById service:', error);
    throw error;
  }
};

// Create new project
export const createProject = async (projectData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { title, description, content = '', stack = [], github_url } = projectData;

    // 마크다운을 HTML로 변환
    const content_markdown = content;
    const content_html = renderMarkdown(content);

    // Shift all existing todo cards down by 1
    await client.query(
      `UPDATE projects
       SET kanban_position = kanban_position + 1
       WHERE kanban_status = 'todo'`
    );

    // Insert new project at position 0 in todo column
    const result = await client.query(
      `INSERT INTO projects (title, description, content_markdown, content_html, stack, github_url, kanban_status, kanban_position)
       VALUES ($1, $2, $3, $4, $5, $6, 'todo', 0)
       RETURNING *`,
      [title, description, content_markdown, content_html, stack, github_url]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in createProject service:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update existing project
export const updateProject = async (id, projectData) => {
  try {
    const { title, description, content, stack, github_url } = projectData;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(title);
      paramCount++;
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(description);
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
    if (stack !== undefined) {
      updates.push(`stack = $${paramCount}`);
      values.push(stack);
      paramCount++;
    }
    if (github_url !== undefined) {
      updates.push(`github_url = $${paramCount}`);
      values.push(github_url);
      paramCount++;
    }

    if (updates.length === 0) {
      return await getProjectById(id);
    }

    values.push(id);
    const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in updateProject service:', error);
    throw error;
  }
};

// Delete project by ID
export const deleteProject = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get project info before deleting
    const projectResult = await client.query(
      'SELECT kanban_status, kanban_position FROM projects WHERE id = $1',
      [id]
    );

    if (projectResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const { kanban_status, kanban_position } = projectResult.rows[0];

    // Delete the project
    const result = await client.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );

    // Update positions of remaining projects in the same column
    await client.query(
      `UPDATE projects
       SET kanban_position = kanban_position - 1
       WHERE kanban_status = $1 AND kanban_position > $2`,
      [kanban_status, kanban_position]
    );

    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteProject service:', error);
    throw error;
  } finally {
    client.release();
  }
};
