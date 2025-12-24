import pool from '../../config/db.js';

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

    // Shift all existing todo cards down by 1
    await client.query(
      `UPDATE projects
       SET kanban_position = kanban_position + 1
       WHERE kanban_status = 'todo'`
    );

    // Insert new project at position 0 in todo column
    const result = await client.query(
      `INSERT INTO projects (title, description, content, stack, github_url, kanban_status, kanban_position)
       VALUES ($1, $2, $3, $4, $5, 'todo', 0)
       RETURNING *`,
      [title, description, content, stack, github_url]
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
      updates.push(`content = $${paramCount}`);
      values.push(content);
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
