import pool from '../config/db.js';

export const getAllProjects = async () => {
  const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
  return result.rows;
};

export const createProject = async (projectData) => {
  const { title, description, stack, github_url } = projectData;
  const result = await pool.query(
    'INSERT INTO projects (title, description, stack, github_url) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, description, stack, github_url]
  );
  return result.rows[0];
};

export const getProjectById = async (id) => {
  const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return result.rows[0];
};

export const updateProject = async (id, projectData) => {
  const { title, description, stack, github_url } = projectData;

  // Build dynamic update query
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
    return getProjectById(id);
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const deleteProject = async (id) => {
  const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};
