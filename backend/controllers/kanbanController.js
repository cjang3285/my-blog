import { getKanban as getKanbanService, moveCard as moveCardService, deleteCard as deleteCardService } from '../services/kanbanService.js';

export const getKanban = async (req, res) => {
  try {
    const kanban = await getKanbanService();
    res.json(kanban);
  } catch (error) {
    console.error('Error in getKanban controller:', error);
    res.status(500).json({ error: 'Failed to fetch kanban board' });
  }
};

export const moveCard = async (req, res) => {
  try {
    const { cardId, fromColumn, toColumn, toIndex } = req.body;
    const kanban = await moveCardService(cardId, fromColumn, toColumn, toIndex);
    res.json(kanban);
  } catch (error) {
    console.error('Error in moveCard controller:', error);
    res.status(500).json({ error: 'Failed to move card' });
  }
};

export const deleteCard = async (req, res) => {
  try {
    const { cardId } = req.body;
    const result = await deleteCardService(cardId);
    res.json(result);
  } catch (error) {
    console.error('Error in deleteCard controller:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
};

// Note: addCard and updateCard are removed
// Projects are automatically added to kanban when created
// Use /api/projects/:id to update project details
