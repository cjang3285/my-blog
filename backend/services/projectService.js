import pool from '../config/db.js';
import { renderMarkdown } from '../utils/markdown.js';

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
  try {
    const { title, description, content = '', stack = [], github_url } = projectData;

    // 마크다운을 HTML로 변환
    const content_markdown = content;
    const content_html = renderMarkdown(content);

    const result = await pool.query(
      `INSERT INTO projects (title, description, content_markdown, content_html, stack, github_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, content_markdown, content_html, stack, github_url]
    );

    console.log(`[PROJECT] Created: id=${result.rows[0].id}, title="${title}"`);
    return result.rows[0];
  } catch (error) {
    console.error('Error in createProject service:', error);
    throw error;
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
    if (result.rows[0]) {
      console.log(`[PROJECT] Updated: id=${id}, fields=[${updates.map(u => u.split(' =')[0]).join(', ')}]`);
    }
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in updateProject service:', error);
    throw error;
  }
};

// Delete project by ID
export const deleteProject = async (id) => {
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows[0]) {
      console.log(`[PROJECT] Deleted: id=${id}, title="${result.rows[0].title}"`);
    }
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in deleteProject service:', error);
    throw error;
  }
};
