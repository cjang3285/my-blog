import pool from '../config/db.js';

// Get all kanban cards grouped by status
export const getKanban = async () => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, content, stack, github_url, kanban_status, kanban_position, created_at, updated_at
       FROM projects
       ORDER BY kanban_status, kanban_position ASC`
    );

    // Group by status
    const kanban = {
      todo: [],
      inprogress: [],
      done: []
    };

    result.rows.forEach(project => {
      const card = {
        id: project.id,
        title: project.title,
        description: project.description,
        stack: project.stack,
        github_url: project.github_url,
        position: project.kanban_position
      };

      if (project.kanban_status === 'todo') {
        kanban.todo.push(card);
      } else if (project.kanban_status === 'inprogress') {
        kanban.inprogress.push(card);
      } else if (project.kanban_status === 'done') {
        kanban.done.push(card);
      }
    });

    return kanban;
  } catch (error) {
    console.error('Error in getKanban service:', error);
    throw error;
  }
};

// Move card between columns
export const moveCard = async (cardId, fromColumn, toColumn, toIndex) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the card being moved
    const cardResult = await client.query(
      'SELECT * FROM projects WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      throw new Error('Card not found');
    }

    // Normalize column names
    const normalizeColumn = (col) => {
      if (col === 'inProgress') return 'inprogress';
      return col.toLowerCase();
    };

    const normalizedFromColumn = normalizeColumn(fromColumn);
    const normalizedToColumn = normalizeColumn(toColumn);

    // If moving within same column, just reorder
    if (normalizedFromColumn === normalizedToColumn) {
      // Get all cards in the column
      const cardsResult = await client.query(
        'SELECT id, kanban_position FROM projects WHERE kanban_status = $1 ORDER BY kanban_position ASC',
        [normalizedFromColumn]
      );

      const cards = cardsResult.rows.filter(c => c.id !== cardId);
      cards.splice(toIndex, 0, { id: cardId, kanban_position: toIndex });

      // Update positions
      for (let i = 0; i < cards.length; i++) {
        await client.query(
          'UPDATE projects SET kanban_position = $1 WHERE id = $2',
          [i, cards[i].id]
        );
      }
    } else {
      // Moving to different column
      // 1. Update positions in source column
      await client.query(
        `UPDATE projects
         SET kanban_position = kanban_position - 1
         WHERE kanban_status = $1 AND kanban_position > $2`,
        [normalizedFromColumn, cardResult.rows[0].kanban_position]
      );

      // 2. Make space in destination column
      await client.query(
        `UPDATE projects
         SET kanban_position = kanban_position + 1
         WHERE kanban_status = $1 AND kanban_position >= $2`,
        [normalizedToColumn, toIndex]
      );

      // 3. Move the card
      await client.query(
        'UPDATE projects SET kanban_status = $1, kanban_position = $2 WHERE id = $3',
        [normalizedToColumn, toIndex, cardId]
      );
    }

    await client.query('COMMIT');
    return await getKanban();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in moveCard service:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Delete card (project)
export const deleteCard = async (cardId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get card info before deleting
    const cardResult = await client.query(
      'SELECT kanban_status, kanban_position FROM projects WHERE id = $1',
      [cardId]
    );

    if (cardResult.rows.length === 0) {
      throw new Error('Card not found');
    }

    const { kanban_status, kanban_position } = cardResult.rows[0];

    // Delete the card (project)
    await client.query('DELETE FROM projects WHERE id = $1', [cardId]);

    // Update positions of remaining cards in the same column
    await client.query(
      `UPDATE projects
       SET kanban_position = kanban_position - 1
       WHERE kanban_status = $1 AND kanban_position > $2`,
      [kanban_status, kanban_position]
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in deleteCard service:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Note: addCard is not needed anymore because creating a project automatically adds it to kanban
// updateCard can use the existing updateProject function from projectService
