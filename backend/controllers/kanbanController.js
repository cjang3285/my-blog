import { loadKanban, saveKanban } from '../services/kanbanService.js';

export const getKanban = (req, res) => {
  res.json(loadKanban());
};

export const addCard = (req, res) => {
  const { column, title, description } = req.body;
  const kanban = loadKanban();

  const newCard = {
    id: Date.now(),
    title,
    description
  };

  kanban[column].push(newCard);
  saveKanban(kanban);
  res.json(newCard);
};

export const moveCard = (req, res) => {
  const { cardId, fromColumn, toColumn, toIndex } = req.body;
  const kanban = loadKanban();

  // Find and remove card from source column
  const cardIndex = kanban[fromColumn].findIndex(card => card.id === cardId);
  if (cardIndex === -1) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const [card] = kanban[fromColumn].splice(cardIndex, 1);

  // Add card to destination column
  kanban[toColumn].splice(toIndex, 0, card);

  saveKanban(kanban);
  res.json(kanban);
};

export const deleteCard = (req, res) => {
  const { cardId, column } = req.body;
  const kanban = loadKanban();

  kanban[column] = kanban[column].filter(card => card.id !== parseInt(cardId));

  saveKanban(kanban);
  res.json({ success: true });
};

export const updateCard = (req, res) => {
  const { cardId, column, title, description } = req.body;
  const kanban = loadKanban();

  const card = kanban[column].find(card => card.id === cardId);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  card.title = title;
  card.description = description;

  saveKanban(kanban);
  res.json(card);
};
