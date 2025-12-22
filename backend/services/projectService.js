import pool from '../config/db.js';

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
    const { title, description, stack = [], github_url } = projectData;

    const result = await pool.query(
      `INSERT INTO projects (title, description, stack, github_url)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, description, stack, github_url]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error in createProject service:', error);
    throw error;
  }
};

// Update existing project
export const updateProject = async (id, projectData) => {
  try {
    const { title, description, stack, github_url } = projectData;

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
  try {
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error in deleteProject service:', error);
    throw error;
  }
};
